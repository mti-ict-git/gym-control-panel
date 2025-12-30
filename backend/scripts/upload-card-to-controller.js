import dotenv from 'dotenv';
import sql from 'mssql';
import { envBool, envTrim } from '../lib/env.js';

dotenv.config();

function parseArgs(argv) {
  const args = { employee: 'MTI230279', unit: '0031', tz: '01', showCard: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--employee' || a === '-e') args.employee = String(argv[i + 1] ?? '');
    if (a === '--unit' || a === '-u') args.unit = String(argv[i + 1] ?? '');
    if (a === '--tz') args.tz = String(argv[i + 1] ?? '');
    if (a === '--show-card') args.showCard = true;
  }
  args.employee = envTrim(args.employee);
  args.unit = envTrim(args.unit);
  args.tz = envTrim(args.tz);
  return args;
}

function maskCard(cardNo) {
  const s = cardNo == null ? '' : String(cardNo);
  if (s.length <= 4) return s;
  return `${'*'.repeat(Math.max(0, s.length - 4))}${s.slice(-4)}`;
}

function mssqlConfigFromEnv({ server, port, database, user, password, encrypt, trustServerCertificate }) {
  const s = envTrim(server);
  const d = envTrim(database);
  const u = envTrim(user);
  const p = envTrim(password);
  if (!s || !d || !u || !p) return null;
  return {
    server: s,
    port: Number(envTrim(port || '1433')) || 1433,
    database: d,
    user: u,
    password: p,
    options: { encrypt: envBool(encrypt, false), trustServerCertificate: envBool(trustServerCertificate, true) },
    pool: { max: 1, min: 0, idleTimeoutMillis: 5000 },
  };
}

async function tryCardNoFromGymDb(employeeId) {
  const config = mssqlConfigFromEnv({
    server: process.env.DB_SERVER,
    port: process.env.DB_PORT,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    encrypt: process.env.DB_ENCRYPT,
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE,
  });
  if (!config) return null;
  let pool;
  try {
    pool = await sql.connect(config);
    const r = await pool
      .request()
      .input('emp', sql.NVarChar(50), employeeId)
      .query(
        "SELECT TOP 1 CardNo FROM dbo.gym_live_taps WHERE EmployeeID = @emp AND CardNo IS NOT NULL AND LTRIM(RTRIM(CardNo)) <> '' ORDER BY TxnTime DESC"
      );
    const cardNo = r?.recordset?.[0]?.CardNo != null ? String(r.recordset[0].CardNo).trim() : null;
    return cardNo && cardNo.length > 0 ? cardNo : null;
  } catch (_) {
    return null;
  } finally {
    try {
      if (pool) await pool.close();
    } catch (_) {}
  }
}

function pickColumn(columns, candidates) {
  const map = new Map(columns.map((c) => [String(c).toLowerCase(), String(c)]));
  for (const cand of candidates) {
    const hit = map.get(String(cand).toLowerCase());
    if (hit) return hit;
  }
  return null;
}

async function tryCardNoFromCardDbTransactions(employeeId) {
  const config = mssqlConfigFromEnv({
    server: process.env.CARD_DB_SERVER || process.env.CARDDB_SERVER,
    port: process.env.CARD_DB_PORT || process.env.CARDDB_PORT,
    database: process.env.CARD_DB_DATABASE || process.env.CARDDB_NAME,
    user: process.env.CARD_DB_USER || process.env.CARDDB_USER,
    password: process.env.CARD_DB_PASSWORD || process.env.CARDDB_PASSWORD,
    encrypt: process.env.CARD_DB_ENCRYPT || process.env.CARDDB_ENCRYPT,
    trustServerCertificate: process.env.CARD_DB_TRUST_SERVER_CERTIFICATE || process.env.CARDDB_TRUST_SERVER_CERTIFICATE,
  });
  if (!config) return null;

  const table = envTrim(process.env.CARD_DB_TX_TABLE || 'tblTransaction');
  const schema = envTrim(process.env.CARD_DB_TX_SCHEMA || 'dbo') || 'dbo';
  if (!/^[A-Za-z0-9_]+$/.test(table) || !/^[A-Za-z0-9_]+$/.test(schema)) return null;

  let pool;
  try {
    pool = await sql.connect(config);
    const colsRes = await pool
      .request()
      .query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='${schema.replace(/'/g, "''")}' AND TABLE_NAME='${table.replace(/'/g, "''")}'`
      );
    const cols = (colsRes?.recordset || []).map((x) => String(x.COLUMN_NAME));
    const timeCol = pickColumn(cols, ['TxnTime', 'TrTime', 'Time', 'DateTime', 'Datetime', 'LogTime', 'TrDateTime']);
    const staffCol = pickColumn(cols, ['EmployeeID', 'employee_id', 'StaffNo', 'staff_no', 'Staff', 'Employee', 'UserID', 'UserId', 'PersonID']);
    const cardCol = pickColumn(cols, ['CardNo', 'card_no', 'Card', 'CardNumber', 'CardID', 'CardId', 'IDCard']);
    if (!staffCol || !cardCol) return null;

    const order = timeCol ? `ORDER BY [${timeCol}] DESC` : '';
    const q = `SELECT TOP 1 [${cardCol}] AS CardNo FROM [${schema}].[${table}] WHERE [${staffCol}] = @emp AND [${cardCol}] IS NOT NULL ${order}`;
    const r = await pool.request().input('emp', sql.NVarChar(50), employeeId).query(q);
    const cardNo = r?.recordset?.[0]?.CardNo != null ? String(r.recordset[0].CardNo).trim() : null;
    return cardNo && cardNo.length > 0 ? cardNo : null;
  } catch (_) {
    return null;
  } finally {
    try {
      if (pool) await pool.close();
    } catch (_) {}
  }
}

async function uploadCardByDoorUnitNo({ cardNo, unitNo, tz }) {
  const base = envTrim(process.env.VAULT_ASMX_BASE_URL || 'http://10.60.10.6/Vaultsite/APIwebservice2.asmx');
  const url = new URL(`${base.replace(/\/+$/, '')}/UploadCardByDoorUnitNo`);
  url.searchParams.set('CardNo', String(cardNo));
  url.searchParams.set('UnitNo', String(unitNo));
  url.searchParams.set('CustomAccessTZ', String(tz));
  const r = await fetch(url.toString(), { method: 'GET' });
  const text = await r.text();
  const extractTag = (xml, tag) => {
    const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const m = re.exec(xml);
    if (!m) return null;
    return String(m[1]).replace(/\\r\\n/g, '\n').trim();
  };
  const parsed = {
    unitNo: extractTag(text, 'UnitNo'),
    doorName: extractTag(text, 'DoorName'),
    ipAddress: extractTag(text, 'IPAddress'),
    doorId: extractTag(text, 'DoorID'),
    uploadStatus: extractTag(text, 'UploadStatus'),
    log: extractTag(text, 'Log'),
  };
  return { status: r.status, ok: r.ok, url: url.toString(), body: text, parsed };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.employee) {
    console.error(JSON.stringify({ ok: false, error: 'Missing --employee' }));
    process.exitCode = 1;
    return;
  }
  if (!args.unit) {
    console.error(JSON.stringify({ ok: false, error: 'Missing --unit' }));
    process.exitCode = 1;
    return;
  }
  if (!args.tz) {
    console.error(JSON.stringify({ ok: false, error: 'Missing --tz' }));
    process.exitCode = 1;
    return;
  }

  const cardNo =
    (await tryCardNoFromGymDb(args.employee)) ||
    (await tryCardNoFromCardDbTransactions(args.employee));

  if (!cardNo) {
    console.error(JSON.stringify({ ok: false, error: 'CardNo not found for employee', employee: args.employee }));
    process.exitCode = 1;
    return;
  }

  const res = await uploadCardByDoorUnitNo({ cardNo, unitNo: args.unit, tz: args.tz });
  const payload = {
    ok: res.ok,
    status: res.status,
    employee: args.employee,
    unit: args.unit,
    tz: args.tz,
    cardNo: args.showCard ? String(cardNo) : maskCard(cardNo),
    url: res.url,
    parsed: res.parsed,
    body: res.body,
  };
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

main().catch((e) => {
  process.stderr.write(`${JSON.stringify({ ok: false, error: e?.message || String(e) })}\n`);
  process.exitCode = 1;
});
