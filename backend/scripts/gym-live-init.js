import sql from 'mssql';
import dotenv from 'dotenv';
import { envTrim, envBool } from '../lib/env.js';

dotenv.config();

async function main() {
  const server = envTrim(process.env.DB_SERVER);
  const database = envTrim(process.env.DB_DATABASE);
  const user = envTrim(process.env.DB_USER);
  const password = envTrim(process.env.DB_PASSWORD);
  const port = Number(envTrim(process.env.DB_PORT || '1433'));
  const encrypt = envBool(process.env.DB_ENCRYPT, false);
  const tsc = envBool(process.env.DB_TRUST_SERVER_CERTIFICATE, true);
  if (!server || !database || !user || !password) {
    console.error(JSON.stringify({ ok: false, error: 'Gym DB env is not configured' }));
    process.exit(1);
  }
  const config = { server, port, database, user, password, options: { encrypt, trustServerCertificate: tsc }, pool: { max: 2, min: 0, idleTimeoutMillis: 5000 } };
  let pool;
  try {
    pool = await sql.connect(config);
    const tx = new sql.Transaction(pool);
    await tx.begin();
    const exec = async (q) => tx.request().query(q);
    await exec('SET NOCOUNT ON;');
    await exec(`IF OBJECT_ID('dbo.gym_live_taps','U') IS NULL BEGIN
      CREATE TABLE dbo.gym_live_taps (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        TrName NVARCHAR(200) NULL,
        TrController NVARCHAR(200) NULL,
        [Transaction] NVARCHAR(100) NULL,
        CardNo NVARCHAR(100) NULL,
        UnitNo NVARCHAR(100) NULL,
        EmployeeID NVARCHAR(50) NULL,
        TrDate DATE NULL,
        TrTime VARCHAR(8) NULL,
        TxnTime DATETIME NOT NULL,
        CreatedAt DATETIME NOT NULL CONSTRAINT DF_gym_live_taps_CreatedAt DEFAULT GETDATE()
      );
    END`);
    await exec("IF COL_LENGTH('dbo.gym_live_taps','UnitNo') IS NULL BEGIN ALTER TABLE dbo.gym_live_taps ADD UnitNo NVARCHAR(100) NULL; END");
    await exec("IF COL_LENGTH('dbo.gym_live_taps','EmployeeID') IS NULL BEGIN ALTER TABLE dbo.gym_live_taps ADD EmployeeID NVARCHAR(50) NULL; END");
    await exec(`IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_gym_live_taps_unique' AND object_id = OBJECT_ID('dbo.gym_live_taps')) BEGIN
      CREATE UNIQUE INDEX UX_gym_live_taps_unique ON dbo.gym_live_taps (CardNo, TxnTime, TrController) WHERE CardNo IS NOT NULL;
    END`);
    await tx.commit();
    const r = await pool.request().query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='gym_live_taps'");
    const cols = Array.isArray(r?.recordset) ? r.recordset.map((x) => ({ name: String(x.COLUMN_NAME), type: String(x.DATA_TYPE) })) : [];
    console.log(JSON.stringify({ ok: true, table: 'dbo.gym_live_taps', columns: cols }));
  } catch (e) {
    console.error(JSON.stringify({ ok: false, error: e?.message || String(e) }));
    process.exitCode = 1;
  } finally {
    try { if (pool) await pool.close(); } catch {}
  }
}

main();
