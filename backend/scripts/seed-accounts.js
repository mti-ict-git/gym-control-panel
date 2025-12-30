import sql from 'mssql';
import dotenv from 'dotenv';
import { envTrim, envBool } from '../lib/env.js';

dotenv.config();

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

  const seeds = [
    { username: 'committee_user', email: 'committee@example.com', role: 'committee', is_active: true },
    { username: 'admin_user', email: 'admin@example.com', role: 'admin', is_active: true },
  ];

  try {
    const pool = await new sql.ConnectionPool(config).connect();
    for (const s of seeds) {
      const req = pool.request();
      req.input('Email', sql.VarChar(200), String(s.email));
      const exists = await req.query('SELECT TOP 1 1 AS one FROM dbo.gym_account WHERE Email = @Email');
      const has = Array.isArray(exists?.recordset) && exists.recordset.length > 0;
      if (has) {
        console.log(`Skip existing: ${s.email}`);
        continue;
      }
      const req2 = pool.request();
      req2.input('Username', sql.VarChar(100), String(s.username));
      req2.input('Email', sql.VarChar(200), String(s.email));
      req2.input('Role', sql.VarChar(20), String(s.role));
      req2.input('IsActive', sql.Bit, s.is_active ? 1 : 0);
      await req2.query('INSERT INTO dbo.gym_account (Username, Email, Role, IsActive) VALUES (@Username, @Email, @Role, @IsActive)');
      console.log(`Inserted: ${s.email}`);
    }
    await pool.close();
    console.log('Seeding completed');
  } catch (error) {
    const message = error?.message || String(error);
    console.error('Error:', message);
    process.exit(1);
  }
}

void main();

