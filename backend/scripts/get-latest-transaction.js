import sql from 'mssql';
import dotenv from 'dotenv';
import { envTrim, envBool } from '../lib/env.js';

dotenv.config();

const cardServer = envTrim(process.env.CARD_DB_SERVER) || envTrim(process.env.CARDDB_SERVER);
const cardDatabase = envTrim(process.env.CARD_DB_DATABASE) || envTrim(process.env.CARDDB_NAME);
const cardUser = envTrim(process.env.CARD_DB_USER) || envTrim(process.env.CARDDB_USER);
const cardPassword = envTrim(process.env.CARD_DB_PASSWORD) || envTrim(process.env.CARDDB_PASSWORD);
const cardPort = Number(envTrim(process.env.CARD_DB_PORT) || envTrim(process.env.CARDDB_PORT) || '1433');
const cardEncrypt = envBool(process.env.CARD_DB_ENCRYPT, false) || envBool(process.env.CARDDB_ENCRYPT, false);
const cardTSC = envBool(process.env.CARD_DB_TRUST_SERVER_CERTIFICATE, true) || envBool(process.env.CARDDB_TRUST_SERVER_CERTIFICATE, true);

function pickColumn(columns, candidates) {
  const map = new Map(columns.map((c) => [String(c).toLowerCase(), String(c)]));
  for (const cand of candidates) {
    const hit = map.get(String(cand).toLowerCase());
    if (hit) return hit;
  }
  return null;
}

async function discoverSource(pool) {
  const explicitTable = envTrim(process.env.CARD_DB_TX_TABLE);
  const explicitSchema = envTrim(process.env.CARD_DB_TX_SCHEMA) || 'dbo';
  const explicitTime = envTrim(process.env.CARD_DB_TX_TIME_COL);
  const explicitDevice = envTrim(process.env.CARD_DB_TX_DEVICE_COL);
  const explicitCard = envTrim(process.env.CARD_DB_TX_CARD_COL);
  const explicitStaff = envTrim(process.env.CARD_DB_TX_STAFF_COL);
  const explicitEvent = envTrim(process.env.CARD_DB_TX_EVENT_COL);
  const explicitUnit = envTrim(process.env.CARD_DB_TX_UNIT_COL);

  if (explicitTable) {
    const colsRes = await pool.request().query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='${explicitSchema.replace(/'/g,"''")}' AND TABLE_NAME='${explicitTable.replace(/'/g,"''")}'`
    );
    const cols = (colsRes?.recordset || []).map((x) => String(x.COLUMN_NAME));
    const timeCol = explicitTime ? pickColumn(cols, [explicitTime]) : pickColumn(cols, ['TransDateTime','EventTime','LogTime','DateTime','Time','timestamp','datetime','TransTime']);
    if (!timeCol) return null;
    const deviceCol = explicitDevice ? pickColumn(cols, [explicitDevice]) : pickColumn(cols, ['Device','Reader','Terminal','Door','DeviceName']);
    const cardCol = explicitCard ? pickColumn(cols, [explicitCard]) : pickColumn(cols, ['CardNo','CardNumber','Card','CardID','IDCard']);
    const staffCol = explicitStaff ? pickColumn(cols, [explicitStaff]) : pickColumn(cols, ['StaffNo','EmployeeID','EmpID','employee_id']);
    const eventCol = explicitEvent ? pickColumn(cols, [explicitEvent]) : pickColumn(cols, ['Event','EventType','Status','Action','Result']);
    const unitCol = explicitUnit ? pickColumn(cols, [explicitUnit]) : pickColumn(cols, ['UnitNo','Unit','ControllerID','DeviceID','ReaderID','DeviceNo','ReaderNo']);
    return { schema: explicitSchema, table: explicitTable, timeCol, deviceCol, cardCol, staffCol, eventCol, unitCol };
  }

  const candidates = ['tblTransaction','Transaction','Transactions','AccessLog','EventLog','Logs','Attendance','History','CardTransaction'];
  const r = await pool.request().query(
    `SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' AND TABLE_NAME IN (${candidates.map((t) => `'${t}'`).join(',')}) ORDER BY CASE WHEN TABLE_SCHEMA='dbo' THEN 0 ELSE 1 END, TABLE_SCHEMA`
  );
  const row = r?.recordset?.[0];
  if (!row) return null;
  const schema = String(row.TABLE_SCHEMA);
  const table = String(row.TABLE_NAME);
  const colsRes = await pool.request().query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='${schema.replace(/'/g,"''")}' AND TABLE_NAME='${table.replace(/'/g,"''")}'`
  );
  const cols = (colsRes?.recordset || []).map((x) => String(x.COLUMN_NAME));
  const timeCol = pickColumn(cols, ['TransDateTime','EventTime','LogTime','DateTime','Time','timestamp','datetime','TransTime','TrDateTime']);
  const deviceCol = pickColumn(cols, ['Device','Reader','Terminal','Door','DeviceName','TrController']);
  const cardCol = pickColumn(cols, ['CardNo','CardNumber','Card','CardID','IDCard','TrCardID']);
  const staffCol = pickColumn(cols, ['StaffNo','EmployeeID','EmpID','employee_id']);
  const eventCol = pickColumn(cols, ['Event','EventType','Status','Action','Result','Transaction','TrEventType']);
  const nameCol = pickColumn(cols, ['TrName','Name','EmployeeName','EmpName','StaffName']);
  const controllerCol = pickColumn(cols, ['TrController','Controller','Device','Reader','Terminal','Door','DeviceName']);
  const unitCol = pickColumn(cols, ['UnitNo','Unit','ControllerID','DeviceID','ReaderID','DeviceNo','ReaderNo']);
  if (!timeCol) return null;
  return { schema, table, timeCol, deviceCol, cardCol, staffCol, eventCol, nameCol, controllerCol, unitCol };
}

async function findTable(pool, tableName) {
  const safe = String(tableName || '').trim();
  const r = await pool.request().query(
    `SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' AND TABLE_NAME='${safe.replace(/'/g,"''")}' ORDER BY CASE WHEN TABLE_SCHEMA='dbo' THEN 0 ELSE 1 END, TABLE_SCHEMA`
  );
  const row = r?.recordset?.[0];
  if (!row) return null;
  const schema = String(row.TABLE_SCHEMA);
  const table = String(row.TABLE_NAME);
  const colsRes = await pool.request().query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='${schema.replace(/'/g,"''")}' AND TABLE_NAME='${table.replace(/'/g,"''")}'`
  );
  const cols = (colsRes?.recordset || []).map((x) => String(x.COLUMN_NAME));
  const timeCol = pickColumn(cols, ['TrDateTime','TxnTime','TransDateTime','EventTime','LogTime','DateTime','Time','timestamp','datetime','TransTime']);
  const deviceCol = pickColumn(cols, ['Device','Reader','Terminal','Door','DeviceName','TrDoorName','TrDoorID','TrController']);
  const cardCol = pickColumn(cols, ['TrCardID','CardNo','CardNumber','Card','CardID','IDCard']);
  const staffCol = pickColumn(cols, ['StaffNo','EmployeeID','EmpID','employee_id']);
  const eventCol = pickColumn(cols, ['Event','EventType','Status','Action','Result','TrEventType','Transaction']);
  const nameCol = pickColumn(cols, ['TrName','Name','EmployeeName','EmpName','StaffName']);
  const controllerCol = pickColumn(cols, ['TrController','Controller','Device','Reader','Terminal','Door','DeviceName']);
  if (!timeCol) return null;
  return { schema, table, timeCol, deviceCol, cardCol, staffCol, eventCol, nameCol, controllerCol };
}

async function run() {
  if (!cardServer || !cardDatabase || !cardUser || !cardPassword) {
    console.error(JSON.stringify({ ok: false, error: 'CardDB env is not configured' }));
    process.exit(1);
  }

  const config = { server: cardServer, port: cardPort, database: cardDatabase, user: cardUser, password: cardPassword, options: { encrypt: cardEncrypt, trustServerCertificate: cardTSC }, pool: { max: 1, min: 0, idleTimeoutMillis: 5000 } };

  let pool;
  try {
    pool = await sql.connect(config);
    let src = await discoverSource(pool);
    if (!src) src = await findTable(pool, 'tblTransactionLive');
    if (!src) {
      console.log(JSON.stringify({ ok: false, error: 'No transaction source table discovered' }));
      return;
    }
    const orderBy = `[${src.timeCol}] DESC`;
    const query = `SELECT TOP 1 ${[
      src.nameCol ? `[${src.nameCol}] AS TrName` : `CAST(NULL AS nvarchar(200)) AS TrName`,
      src.controllerCol ? `[${src.controllerCol}] AS TrController` : `CAST(NULL AS nvarchar(200)) AS TrController`,
      src.eventCol ? `[${src.eventCol}] AS [Transaction]` : `CAST(NULL AS nvarchar(100)) AS [Transaction]`,
      src.cardCol ? `[${src.cardCol}] AS CardNo` : `CAST(NULL AS nvarchar(100)) AS CardNo`,
      src.unitCol ? `[${src.unitCol}] AS UnitNo` : `CAST(NULL AS nvarchar(100)) AS UnitNo`,
      `CONVERT(date, [${src.timeCol}]) AS TrDate`,
      `CONVERT(varchar(8), [${src.timeCol}], 108) AS TrTime`,
    ].join(', ')} FROM [${src.schema}].[${src.table}] ORDER BY ${orderBy}`;
    const res = await pool.request().query(query);
    const row = res?.recordset?.[0] || null;
    const out = {
      ok: true,
      source: src,
      transaction: row
        ? {
            TrName: row.TrName != null ? String(row.TrName) : null,
            TrController: row.TrController != null ? String(row.TrController) : null,
            Transaction: row.Transaction != null ? String(row.Transaction) : null,
            CardNo: row.CardNo != null ? String(row.CardNo) : null,
            TrDate: row.TrDate != null ? String(row.TrDate) : null,
            TrTime: row.TrTime != null ? String(row.TrTime) : null,
            UnitNo: row.UnitNo != null ? String(row.UnitNo) : null,
          }
        : null,
      raw: row || null,
    };
    console.log(JSON.stringify(out, null, 2));
  } catch (e) {
    console.log(JSON.stringify({ ok: false, error: e?.message || String(e) }));
  } finally {
    try { if (pool) await pool.close(); } catch {}
  }
}

run();
