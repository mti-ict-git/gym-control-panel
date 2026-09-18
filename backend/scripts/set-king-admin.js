// Make an existing panel account King Admin.
//
//   node backend/scripts/set-king-admin.js <email-or-username> [--dry-run]
//
// In the panel only a King Admin can create or promote another King Admin, so the first
// one (or a replacement, if every King Admin account is lost) has to come from here.
// Also widens CK_gym_account_Role to allow 'KingAdmin' if the database predates the role.
import sql from 'mssql';
import dotenv from 'dotenv';
import { envTrim, envBool } from '../lib/env.js';

dotenv.config();

const who = String(process.argv[2] || '').trim();
const dryRun = process.argv.includes('--dry-run');
if (!who || who.startsWith('--')) {
  console.error('Usage: node backend/scripts/set-king-admin.js <email-or-username> [--dry-run]');
  process.exit(1);
}

const config = {
  server: envTrim(process.env.DB_SERVER),
  port: Number(envTrim(process.env.DB_PORT) || '1433'),
  database: envTrim(process.env.DB_DATABASE),
  user: envTrim(process.env.DB_USER),
  password: envTrim(process.env.DB_PASSWORD),
  options: {
    encrypt: envBool(process.env.DB_ENCRYPT, false),
    trustServerCertificate: envBool(process.env.DB_TRUST_SERVER_CERTIFICATE, true),
  },
};

async function main() {
  const pool = await new sql.ConnectionPool(config).connect();
  try {
    const found = await pool
      .request()
      .input('who', sql.VarChar(100), who)
      .query('SELECT AccountID, Username, Email, Role, IsActive FROM dbo.gym_account WHERE Email = @who OR Username = @who');
    const rows = found.recordset || [];
    if (rows.length !== 1) {
      console.error(rows.length === 0 ? `No account matches "${who}".` : `"${who}" matches ${rows.length} accounts; use the exact email.`);
      process.exitCode = 1;
      return;
    }
    const acc = rows[0];
    console.log(`Account ${acc.AccountID}: ${acc.Username} <${acc.Email}> role=${acc.Role} active=${acc.IsActive ? 1 : 0}`);
    if (!acc.IsActive) console.warn('Warning: this account is inactive and cannot log in until it is reactivated.');

    const ck = await pool.request().query(`
      SELECT cc.name, cc.definition
      FROM sys.check_constraints cc
      WHERE cc.parent_object_id = OBJECT_ID('dbo.gym_account')`);
    const roleChecks = (ck.recordset || []).filter((c) => /\[?Role\]?/i.test(String(c.definition)));
    const needsWiden = roleChecks.length === 0 || roleChecks.some((c) => !/KingAdmin/i.test(String(c.definition)));
    console.log(`Role CHECK constraint: ${needsWiden ? 'will be widened to include KingAdmin' : 'already allows KingAdmin'}`);

    if (acc.Role === 'KingAdmin') {
      console.log('Already King Admin; nothing to do.');
      return;
    }
    if (dryRun) {
      console.log('--dry-run: no changes made.');
      return;
    }

    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      if (needsWiden) {
        for (const c of roleChecks) {
          await tx.request().query(`ALTER TABLE dbo.gym_account DROP CONSTRAINT [${String(c.name).replace(/]/g, ']]')}]`);
        }
        await tx.request().query(
          "ALTER TABLE dbo.gym_account ADD CONSTRAINT CK_gym_account_Role CHECK (Role IN ('KingAdmin','SuperAdmin','Admin','Staff'))"
        );
      }
      const up = await tx
        .request()
        .input('id', sql.Int, acc.AccountID)
        .query("UPDATE dbo.gym_account SET Role = 'KingAdmin', UpdatedAt = SYSDATETIME() WHERE AccountID = @id");
      if (Number(up.rowsAffected?.[0] || 0) !== 1) throw new Error('update touched no row');
      await tx.commit();
    } catch (e) {
      await tx.rollback().catch(() => {});
      throw e;
    }
    const after = await pool
      .request()
      .input('id', sql.Int, acc.AccountID)
      .query('SELECT Role FROM dbo.gym_account WHERE AccountID = @id');
    console.log(`Done: ${acc.Username} is now ${after.recordset?.[0]?.Role}. Log out and back in to pick up the new role.`);
  } finally {
    await pool.close();
  }
}

main().catch((e) => {
  console.error('Error:', e?.message || String(e));
  process.exit(1);
});
