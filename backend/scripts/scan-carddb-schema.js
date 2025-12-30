import sql from 'mssql';
import dotenv from 'dotenv';
import { envTrim, envBool } from '../lib/env.js';

dotenv.config();

async function resolveConfig() {
  const server = envTrim(process.env.CARD_DB_SERVER) || envTrim(process.env.CARDDB_SERVER);
  const database = envTrim(process.env.CARD_DB_DATABASE) || envTrim(process.env.CARDDB_NAME);
  const user = envTrim(process.env.CARD_DB_USER) || envTrim(process.env.CARDDB_USER);
  const password = envTrim(process.env.CARD_DB_PASSWORD) || envTrim(process.env.CARDDB_PASSWORD);
  const port = Number(envTrim(process.env.CARD_DB_PORT) || envTrim(process.env.CARDDB_PORT) || '1433');
  const encrypt = envBool(process.env.CARD_DB_ENCRYPT, false) || envBool(process.env.CARDDB_ENCRYPT, false);
  const tsc = envBool(process.env.CARD_DB_TRUST_SERVER_CERTIFICATE, true) || envBool(process.env.CARDDB_TRUST_SERVER_CERTIFICATE, true);
  const schema = envTrim(process.env.CARD_DB_SCHEMA) || envTrim(process.env.CARDDB_SCHEMA) || '';
  return { server, database, user, password, port, encrypt, tsc, schema };
}

async function pickSchema(pool, tableName, preferred) {
  const safe = String(tableName || '').trim();
  if (preferred) {
    const r = await pool.request().query(
      `SELECT 1 AS ok FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = '${preferred.replace(/'/g, "''")}' AND TABLE_NAME = '${safe.replace(/'/g, "''")}'`
    );
    if (Array.isArray(r?.recordset) && r.recordset.length > 0) return preferred;
  }
  const r = await pool.request().query(
    `SELECT TOP 1 TABLE_SCHEMA AS schema_name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = '${safe.replace(/'/g, "''")}' ORDER BY CASE WHEN TABLE_SCHEMA = 'dbo' THEN 0 ELSE 1 END, TABLE_SCHEMA`
  );
  const s = r?.recordset?.[0]?.schema_name ? String(r.recordset[0].schema_name) : null;
  return s || preferred || 'dbo';
}

async function listColumns(pool, schema, table) {
  const r = await pool.request().query(
    `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = '${schema.replace(/'/g, "''")}' AND TABLE_NAME = '${table.replace(/'/g, "''")}' ORDER BY ORDINAL_POSITION`
  );
  return Array.isArray(r?.recordset)
    ? r.recordset.map((row) => ({ name: String(row.COLUMN_NAME), type: String(row.DATA_TYPE), nullable: String(row.IS_NULLABLE) === 'YES' }))
    : [];
}

async function listIndexes(pool, schema, table) {
  const r = await pool.request().query(
    `SELECT i.name FROM sys.indexes i JOIN sys.tables t ON i.object_id = t.object_id WHERE t.name = '${table.replace(/'/g, "''")}' AND SCHEMA_NAME(t.schema_id) = '${schema.replace(/'/g, "''")}' AND i.name IS NOT NULL`
  );
  return Array.isArray(r?.recordset) ? r.recordset.map((row) => String(row.name)) : [];
}

async function countRows(pool, schema, table) {
  const r = await pool.request().query(`SELECT COUNT(*) AS cnt FROM [${schema}].[${table}]`);
  return Number(r?.recordset?.[0]?.cnt || 0);
}

async function discoverCandidates(pool) {
  const candidates = ['tblTransaction','Transaction','Transactions','AccessLog','EventLog','Logs','Attendance','History','CardTransaction'];
  const r = await pool.request().query(
    `SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' AND TABLE_NAME IN (${candidates.map((t)=>`'${t}'`).join(',')}) ORDER BY CASE WHEN TABLE_SCHEMA='dbo' THEN 0 ELSE 1 END, TABLE_SCHEMA, TABLE_NAME`
  );
  const rows = Array.isArray(r?.recordset) ? r.recordset : [];
  const out = [];
  for (const row of rows) {
    const schema = String(row.TABLE_SCHEMA);
    const table = String(row.TABLE_NAME);
    const cols = await listColumns(pool, schema, table);
    out.push({ schema, table, columns: cols });
  }
  return out;
}

async function run() {
  const cfg = await resolveConfig();
  if (!cfg.server || !cfg.database || !cfg.user || !cfg.password) {
    console.error(JSON.stringify({ ok: false, error: 'CardDB env is not configured' }));
    process.exit(1);
  }
  const dbConfig = { server: cfg.server, port: cfg.port, database: cfg.database, user: cfg.user, password: cfg.password, options: { encrypt: cfg.encrypt, trustServerCertificate: cfg.tsc }, pool: { max: 1, min: 0, idleTimeoutMillis: 5000 } };
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const tableName = 'tblTransactionLive';
    const schema = await pickSchema(pool, tableName, cfg.schema);
    const existsRes = await pool.request().query(
      `SELECT 1 AS ok FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='${schema.replace(/'/g, "''")}' AND TABLE_NAME='${tableName}'`
    );
    const exists = Array.isArray(existsRes?.recordset) && existsRes.recordset.length > 0;
    const columns = exists ? await listColumns(pool, schema, tableName) : [];
    const indexes = exists ? await listIndexes(pool, schema, tableName) : [];
    const rowCount = exists ? await countRows(pool, schema, tableName) : 0;
    const candidates = await discoverCandidates(pool);
    console.log(JSON.stringify({ ok: true, connection: { server: cfg.server, database: cfg.database }, table: { schema, name: tableName, exists, rowCount, columns, indexes }, sources: candidates }, null, 2));
  } catch (e) {
    console.error(JSON.stringify({ ok: false, error: e?.message || String(e) }));
  } finally {
    try { if (pool) await pool.close(); } catch {}
  }
}

run();
