import dotenv from 'dotenv';
import sql from 'mssql';

dotenv.config();

async function run() {
  const { DB_SERVER, DB_PORT, DB_DATABASE, DB_USER, DB_PASSWORD, DB_ENCRYPT, DB_TRUST_SERVER_CERTIFICATE } = process.env;
  if (!DB_SERVER || !DB_DATABASE || !DB_USER || !DB_PASSWORD) {
    console.error(JSON.stringify({ ok: false, error: 'Gym DB env is not configured' }));
    process.exit(1);
  }
  const config = { server: DB_SERVER, port: Number(DB_PORT || 1433), database: DB_DATABASE, user: DB_USER, password: DB_PASSWORD, options: { encrypt: String(DB_ENCRYPT || 'false').toLowerCase() === 'true', trustServerCertificate: String(DB_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() === 'true' }, pool: { max: 2, min: 0, idleTimeoutMillis: 5000 } };
  let pool;
  try {
    pool = await sql.connect(config);
    const existsRes = await pool.request().query("SELECT OBJECT_ID('dbo.gym_reports', 'U') AS id;");
    const exists = Boolean(existsRes?.recordset?.[0]?.id);
    if (!exists) {
      console.error(JSON.stringify({ ok: false, error: 'Missing table dbo.gym_reports' }));
      process.exit(2);
    }
    await pool.request().query("IF COL_LENGTH('dbo.gym_reports', 'Name') IS NULL BEGIN ALTER TABLE dbo.gym_reports ADD Name VARCHAR(100) NULL END");
    console.log(JSON.stringify({ ok: true }));
  } catch (e) {
    console.error(JSON.stringify({ ok: false, error: e?.message || String(e) }));
    process.exit(3);
  } finally {
    try { if (pool) await pool.close(); } catch {}
  }
}

run();
