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

async function ensureTable(pool) {
  const q = `IF OBJECT_ID('dbo.tblTransactionLive','U') IS NULL BEGIN
    CREATE TABLE dbo.tblTransactionLive (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      TxnTime DATETIME NOT NULL,
      Device NVARCHAR(100) NULL,
      CardNo NVARCHAR(100) NULL,
      StaffNo NVARCHAR(50) NULL,
      EventType NVARCHAR(50) NULL,
      Raw NVARCHAR(MAX) NULL,
      CreatedAt DATETIME NOT NULL CONSTRAINT DF_tblTransactionLive_CreatedAt DEFAULT GETDATE()
    );
  END`;
  await pool.request().query(q);
}

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

  if (explicitTable) {
    const colsRes = await pool.request().query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='${explicitSchema.replace(/'/g,"''")}' AND TABLE_NAME='${explicitTable.replace(/'/g,"''")}'`
    );
    const cols = (colsRes?.recordset || []).map((x)=>String(x.COLUMN_NAME));
    const timeCol = explicitTime ? pickColumn(cols, [explicitTime]) : pickColumn(cols, ['TransDateTime','EventTime','LogTime','DateTime','Time','timestamp','datetime','TransTime']);
    if (!timeCol) return null;
    const deviceCol = explicitDevice ? pickColumn(cols, [explicitDevice]) : pickColumn(cols, ['Device','Reader','Terminal','Door','DeviceName']);
    const cardCol = explicitCard ? pickColumn(cols, [explicitCard]) : pickColumn(cols, ['CardNo','CardNumber','Card','CardID','IDCard']);
    const staffCol = explicitStaff ? pickColumn(cols, [explicitStaff]) : pickColumn(cols, ['StaffNo','EmployeeID','EmpID','employee_id']);
    const eventCol = explicitEvent ? pickColumn(cols, [explicitEvent]) : pickColumn(cols, ['Event','EventType','Status','Action','Result']);
    return { schema: explicitSchema, table: explicitTable, timeCol, deviceCol, cardCol, staffCol, eventCol };
  }

  const candidates = [
    'tblTransaction',
    'Transaction',
    'Transactions',
    'AccessLog',
    'EventLog',
    'Logs',
    'Attendance',
    'History',
    'CardTransaction',
  ];
  const r = await pool.request().query(
    `SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' AND TABLE_NAME IN (${candidates.map((t)=>`'${t}'`).join(',')}) ORDER BY CASE WHEN TABLE_SCHEMA='dbo' THEN 0 ELSE 1 END, TABLE_SCHEMA`
  );
  const row = r?.recordset?.[0];
  if (!row) return null;
  const schema = String(row.TABLE_SCHEMA);
  const table = String(row.TABLE_NAME);
  const colsRes = await pool.request().query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='${schema.replace(/'/g,"''")}' AND TABLE_NAME='${table.replace(/'/g,"''")}'`
  );
  const cols = (colsRes?.recordset || []).map((x)=>String(x.COLUMN_NAME));
  const timeCol = pickColumn(cols, ['TransDateTime','EventTime','LogTime','DateTime','Time','timestamp','datetime','TransTime']);
  const deviceCol = pickColumn(cols, ['Device','Reader','Terminal','Door','DeviceName']);
  const cardCol = pickColumn(cols, ['CardNo','CardNumber','Card','CardID','IDCard']);
  const staffCol = pickColumn(cols, ['StaffNo','EmployeeID','EmpID','employee_id']);
  const eventCol = pickColumn(cols, ['Event','EventType','Status','Action','Result']);
  if (!timeCol) return null;
  return { schema, table, timeCol, deviceCol, cardCol, staffCol, eventCol };
}

async function run() {
  if (!cardServer || !cardDatabase || !cardUser || !cardPassword) {
    console.error('CardDB env is not configured');
    process.exit(1);
  }

  const config = {
    server: cardServer,
    port: cardPort,
    database: cardDatabase,
    user: cardUser,
    password: cardPassword,
    options: { encrypt: cardEncrypt, trustServerCertificate: cardTSC },
    pool: { max: 1, min: 0, idleTimeoutMillis: 5000 },
  };

  let pool;
  try {
    pool = await sql.connect(config);
    await ensureTable(pool);

    const src = await discoverSource(pool);
    if (!src) {
      console.error('No transaction source table discovered');
      return;
    }

    const sel = pool.request();
    const orderBy = `[${src.timeCol}] DESC`;
    const query = `SELECT TOP 1 ${[
      `[${src.timeCol}] AS txn_time`,
      src.deviceCol ? `[${src.deviceCol}] AS device` : `CAST(NULL AS nvarchar(100)) AS device`,
      src.cardCol ? `[${src.cardCol}] AS card_no` : `CAST(NULL AS nvarchar(100)) AS card_no`,
      src.staffCol ? `[${src.staffCol}] AS staff_no` : `CAST(NULL AS nvarchar(50)) AS staff_no`,
      src.eventCol ? `[${src.eventCol}] AS event_type` : `CAST(NULL AS nvarchar(50)) AS event_type`,
    ].join(', ')} FROM [${src.schema}].[${src.table}] ORDER BY ${orderBy}`;
    const last = await sel.query(query);
    const row = last?.recordset?.[0];
    if (!row) return;

    const insert = pool.request();
    insert.input('txn_time', sql.DateTime, row.txn_time instanceof Date ? row.txn_time : new Date(String(row.txn_time)));
    insert.input('device', sql.NVarChar(100), row.device != null ? String(row.device) : null);
    insert.input('card_no', sql.NVarChar(100), row.card_no != null ? String(row.card_no) : null);
    insert.input('staff_no', sql.NVarChar(50), row.staff_no != null ? String(row.staff_no) : null);
    insert.input('event_type', sql.NVarChar(50), row.event_type != null ? String(row.event_type) : null);
    insert.input('raw', sql.NVarChar(sql.MAX), JSON.stringify(row));

    const upsert = `IF NOT EXISTS (
      SELECT 1 FROM dbo.tblTransactionLive WHERE TxnTime = @txn_time AND ISNULL(CardNo,'') = ISNULL(@card_no,'') AND ISNULL(Device,'') = ISNULL(@device,'')
    ) BEGIN
      INSERT INTO dbo.tblTransactionLive (TxnTime, Device, CardNo, StaffNo, EventType, Raw) VALUES (@txn_time, @device, @card_no, @staff_no, @event_type, @raw)
    END`;
    await insert.query(upsert);
    console.log('Inserted last transaction');
  } catch (e) {
    console.error(e?.message || String(e));
  } finally {
    try { if (pool) await pool.close(); } catch {}
  }
}

run();
