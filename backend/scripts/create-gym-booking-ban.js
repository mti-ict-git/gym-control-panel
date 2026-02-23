import dotenv from 'dotenv';
import sql from 'mssql';
import { envTrim, envBool } from '../lib/env.js';

dotenv.config();

async function run() {
  const server = envTrim(process.env.DB_SERVER);
  const port = Number(envTrim(process.env.DB_PORT) || '1433');
  const database = envTrim(process.env.DB_DATABASE);
  const user = envTrim(process.env.DB_USER);
  const password = envTrim(process.env.DB_PASSWORD);
  const encrypt = envBool(process.env.DB_ENCRYPT, false);
  const trustServerCertificate = envBool(process.env.DB_TRUST_SERVER_CERTIFICATE, true);

  if (!server || !database || !user || !password) {
    console.error(JSON.stringify({ ok: false, error: 'Gym DB env is not configured' }));
    process.exit(1);
  }

  const config = {
    server,
    port,
    database,
    user,
    password,
    options: { encrypt, trustServerCertificate },
    pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
  };

  let pool;
  try {
    pool = await sql.connect(config);
    await pool.request().query(
      `IF OBJECT_ID('dbo.gym_booking_ban','U') IS NULL BEGIN
        CREATE TABLE dbo.gym_booking_ban (
          EmployeeID VARCHAR(20) NOT NULL PRIMARY KEY,
          BannedUntil DATE NOT NULL,
          Reason VARCHAR(255) NULL,
          UnbanRemark VARCHAR(255) NULL,
          ActionBy VARCHAR(100) NULL,
          ConsecutiveNoShow INT NOT NULL CONSTRAINT DF_gym_booking_ban_ConsecutiveNoShow DEFAULT 0,
          CreatedAt DATETIME NOT NULL CONSTRAINT DF_gym_booking_ban_CreatedAt DEFAULT GETDATE(),
          UpdatedAt DATETIME NULL
        );
      END`
    );
    await pool.request().query(
      "IF COL_LENGTH('dbo.gym_booking_ban', 'UnbanRemark') IS NULL BEGIN ALTER TABLE dbo.gym_booking_ban ADD UnbanRemark VARCHAR(255) NULL; END"
    );
    await pool.request().query(
      "IF COL_LENGTH('dbo.gym_booking_ban', 'ActionBy') IS NULL BEGIN ALTER TABLE dbo.gym_booking_ban ADD ActionBy VARCHAR(100) NULL; END"
    );
    await pool.request().query(
      "IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_gym_booking_ban_BannedUntil' AND object_id = OBJECT_ID('dbo.gym_booking_ban')) BEGIN CREATE INDEX IX_gym_booking_ban_BannedUntil ON dbo.gym_booking_ban(BannedUntil); END"
    );
    const r = await pool.request().query("SELECT OBJECT_ID('dbo.gym_booking_ban','U') AS table_id");
    const tableId = r?.recordset?.[0]?.table_id ?? null;
    const colRes = await pool.request().query(
      "SELECT COL_LENGTH('dbo.gym_booking_ban','UnbanRemark') AS unban_remark_len, COL_LENGTH('dbo.gym_booking_ban','ActionBy') AS action_by_len"
    );
    const unbanRemarkLen = colRes?.recordset?.[0]?.unban_remark_len ?? null;
    const actionByLen = colRes?.recordset?.[0]?.action_by_len ?? null;
    console.log(JSON.stringify({ ok: true, table_id: tableId, unban_remark_len: unbanRemarkLen, action_by_len: actionByLen }));
  } catch (e) {
    console.error(JSON.stringify({ ok: false, error: e?.message || String(e) }));
    process.exit(2);
  } finally {
    try {
      if (pool) await pool.close();
    } catch {}
  }
}

void run();
