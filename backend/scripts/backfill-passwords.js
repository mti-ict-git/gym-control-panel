import sql from 'mssql';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { envTrim, envBool } from '../lib/env.js';

dotenv.config();

function genSecurePassword(length = 16) {
  const buf = crypto.randomBytes(length);
  // Use base64 and slice to desired length with mixed chars
  const base = buf.toString('base64').replace(/[^A-Za-z0-9]/g, '');
  const candidate = base.slice(0, length - 2) + '!1';
  return candidate;
}

async function main() {
  const server = envTrim(process.env.DB_SERVER);
  const port = Number(envTrim(process.env.DB_PORT) || '1433');
  const database = envTrim(process.env.DB_DATABASE);
  const user = envTrim(process.env.DB_USER);
  const password = envTrim(process.env.DB_PASSWORD);
  const encrypt = envBool(process.env.DB_ENCRYPT, false);
  const trustServerCertificate = envBool(process.env.DB_TRUST_SERVER_CERTIFICATE, true);

  if (!server || !database || !user || !password) {
    console.error('Gym DB env is not configured');
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

  try {
    const pool = await new sql.ConnectionPool(config).connect();
    const before = await pool.request().query(
      "SELECT AccountID, Username, Email FROM dbo.gym_account WHERE PasswordHash IS NULL"
    );
    const toFix = Array.isArray(before?.recordset) ? before.recordset : [];
    console.log(`Accounts with NULL PasswordHash: ${toFix.length}`);

    for (const row of toFix) {
      const pwd = genSecurePassword(16);
      const hash = await bcrypt.hash(String(pwd), 10);
      const req = pool.request();
      req.input('Id', sql.Int, Number(row.AccountID));
      req.input('Hash', sql.VarChar(255), String(hash));
      req.input('UpdatedBy', sql.VarChar(50), 'ENFORCE_NOT_NULL_BACKFILL');
      await req.query(
        "UPDATE dbo.gym_account SET PasswordHash = @Hash, PasswordResetRequired = 1, UpdatedBy = @UpdatedBy, UpdatedAt = SYSDATETIME() WHERE AccountID = @Id"
      );
      console.log(`Backfilled AccountID=${row.AccountID} (${row.Email})`);
    }

    const afterNulls = await pool.request().query(
      "SELECT COUNT(1) AS cnt FROM dbo.gym_account WHERE PasswordHash IS NULL"
    );
    const remaining = Number(afterNulls?.recordset?.[0]?.cnt || 0);
    if (remaining === 0) {
      console.log('No NULL PasswordHash remaining; enforcing NOT NULL...');
      await pool.request().query(
        "ALTER TABLE dbo.gym_account ALTER COLUMN PasswordHash VARCHAR(255) NOT NULL"
      );
      console.log('PasswordHash is now NOT NULL');
    } else {
      console.log(`Still ${remaining} NULL PasswordHash rows; NOT NULL not enforced.`);
    }

    await pool.close();
    console.log('Backfill completed');
  } catch (error) {
    const message = error?.message || String(error);
    console.error('Error:', message);
    process.exit(1);
  }
}

void main();

