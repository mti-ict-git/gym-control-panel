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
  const config = { server, port, database, user, password, options: { encrypt, trustServerCertificate }, pool: { max: 2, min: 0, idleTimeoutMillis: 5000 } };
  try {
    const pool = await new sql.ConnectionPool(config).connect();
    const r = await pool.request().query("SELECT DISTINCT Role FROM dbo.gym_account ORDER BY Role");
    await pool.close();
    const roles = (r?.recordset || []).map((x) => String(x.Role));
    console.log('Distinct roles:', roles);
  } catch (error) {
    const message = error?.message || String(error);
    console.error('Error:', message);
    process.exit(1);
  }
}

void main();

