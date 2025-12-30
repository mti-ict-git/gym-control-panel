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

  try {
    const pool = await new sql.ConnectionPool(config).connect();
    // Drop any existing check constraints on dbo.gym_account to allow migration
    await pool.request().query(`DECLARE @cn NVARCHAR(256);
      DECLARE c CURSOR FOR
        SELECT name FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('dbo.gym_account');
      OPEN c;
      FETCH NEXT FROM c INTO @cn;
      WHILE @@FETCH_STATUS = 0
      BEGIN
        EXEC('ALTER TABLE dbo.gym_account DROP CONSTRAINT [' + @cn + ']');
        FETCH NEXT FROM c INTO @cn;
      END
      CLOSE c;
      DEALLOCATE c;`);

    // Normalize and migrate role values
    await pool.request().query("UPDATE dbo.gym_account SET Role = 'SuperAdmin' WHERE Role IN ('superadmin','SUPERADMIN','Super Admin')");
    await pool.request().query("UPDATE dbo.gym_account SET Role = 'Admin' WHERE Role IN ('admin','ADMIN')");
    await pool.request().query("UPDATE dbo.gym_account SET Role = 'Staff' WHERE Role NOT IN ('SuperAdmin','Admin') OR Role IS NULL");

    // Re-add the standardized constraint
    await pool.request().query("ALTER TABLE dbo.gym_account ADD CONSTRAINT CK_gym_account_Role CHECK (Role IN ('SuperAdmin','Admin','Staff'))");

    await pool.close();
    console.log('Role migration completed');
  } catch (error) {
    const message = error?.message || String(error);
    console.error('Error:', message);
    process.exit(1);
  }
}

void main();
