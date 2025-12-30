import express from 'express';
import sql from 'mssql';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { envTrim, envBool } from '../lib/env.js';

const router = express.Router();

function mapDbRoleToUi(role) {
  const r = role != null ? String(role) : '';
  if (r === 'SuperAdmin') return 'superadmin';
  if (r === 'Admin') return 'admin';
  return 'committee';
}

function getJwtSecret() {
  const s = envTrim(process.env.JWT_SECRET);
  if (!s) throw new Error('Missing JWT_SECRET');
  return s;
}

function getDbConfig() {
  const server = envTrim(process.env.DB_SERVER);
  const database = envTrim(process.env.DB_DATABASE);
  const user = envTrim(process.env.DB_USER);
  const password = envTrim(process.env.DB_PASSWORD);
  const port = Number(envTrim(process.env.DB_PORT) || '1433');
  const encrypt = envBool(process.env.DB_ENCRYPT, false);
  const trustServerCertificate = envBool(process.env.DB_TRUST_SERVER_CERTIFICATE, true);
  if (!server || !database || !user || !password) {
    throw new Error('Gym DB env is not configured');
  }
  return {
    server,
    port,
    database,
    user,
    password,
    options: { encrypt, trustServerCertificate },
    pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
  };
}

async function hasColumn(pool, table, column) {
  const req = pool.request();
  const q = "SELECT 1 AS ok FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = @Table AND COLUMN_NAME = @Column";
  req.input('Table', sql.VarChar(128), String(table));
  req.input('Column', sql.VarChar(128), String(column));
  const r = await req.query(q);
  return Array.isArray(r?.recordset) && r.recordset.length > 0;
}

router.post('/auth/login', async (req, res) => {
  const { email, username, password } = req.body || {};
  if ((!email && !username) || !password) {
    return res.status(400).json({ ok: false, error: 'email or username, and password are required' });
  }
  try {
    const config = getDbConfig();
    const pool = await new sql.ConnectionPool(config).connect();
    const req1 = pool.request();
    if (email) req1.input('Email', sql.VarChar(100), String(email));
    if (username) req1.input('Username', sql.VarChar(50), String(username));
    const query = email
      ? 'SELECT TOP 1 AccountID, Username, Email, Role, IsActive, PasswordHash, PasswordResetRequired FROM dbo.gym_account WHERE Email = @Email'
      : 'SELECT TOP 1 AccountID, Username, Email, Role, IsActive, PasswordHash, PasswordResetRequired FROM dbo.gym_account WHERE Username = @Username';
    const r = await req1.query(query);
    const row = Array.isArray(r?.recordset) && r.recordset.length > 0 ? r.recordset[0] : null;
    if (!row) {
      await pool.close();
      return res.status(200).json({ ok: false, error: 'Account not found' });
    }
    if (!row.IsActive) {
      await pool.close();
      return res.status(200).json({ ok: false, error: 'Account is inactive' });
    }
    const hash = row.PasswordHash != null ? String(row.PasswordHash) : '';
    const match = await bcrypt.compare(String(password), hash);
    if (!match) {
      await pool.close();
      return res.status(200).json({ ok: false, error: 'Invalid credentials' });
    }
    try {
      const up = pool.request();
      up.input('Id', sql.Int, Number(row.AccountID));
      const hasLastSignIn = await hasColumn(pool, 'gym_account', 'LastSignIn');
      const hasLastSignInAt = await hasColumn(pool, 'gym_account', 'LastSignInAt');
      const sets = [];
      if (hasLastSignIn) sets.push('LastSignIn = SYSDATETIME()');
      if (hasLastSignInAt) sets.push('LastSignInAt = SYSDATETIME()');
      sets.push('UpdatedAt = SYSDATETIME()');
      const q = `UPDATE dbo.gym_account SET ${sets.join(', ')} WHERE AccountID = @Id`;
      await up.query(q);
    } catch (_) {
      // swallow update errors to not block login
    }
    await pool.close();
    const payload = {
      account_id: Number(row.AccountID),
      username: row.Username != null ? String(row.Username) : '',
      email: row.Email != null ? String(row.Email) : '',
      role: mapDbRoleToUi(row.Role),
    };
    const token = jwt.sign(payload, getJwtSecret(), { expiresIn: '8h', issuer: 'gym-control' });
    return res.json({ ok: true, token, user: payload, password_reset_required: row.PasswordResetRequired ? true : false });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message });
  }
});

router.get('/auth/me', async (req, res) => {
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ ok: false, error: 'Missing bearer token' });
  const token = m[1];
  try {
    const payload = jwt.verify(token, getJwtSecret());
    try {
      const accountId = Number(payload?.account_id || 0);
      if (Number.isFinite(accountId) && accountId > 0) {
        const config = getDbConfig();
        const pool = await new sql.ConnectionPool(config).connect();
        try {
          const req1 = pool.request();
          req1.input('Id', sql.Int, accountId);
          const hasLastSignIn = await hasColumn(pool, 'gym_account', 'LastSignIn');
          const hasLastSignInAt = await hasColumn(pool, 'gym_account', 'LastSignInAt');
          const selCol = hasLastSignIn ? 'LastSignIn' : (hasLastSignInAt ? 'LastSignInAt' : 'UpdatedAt');
          const r = await req1.query(`SELECT TOP 1 ${selCol} AS last FROM dbo.gym_account WHERE AccountID = @Id`);
          const last = Array.isArray(r?.recordset) && r.recordset.length > 0 ? r.recordset[0]?.last : null;
          const now = Date.now();
          const lastMs = last instanceof Date ? last.getTime() : (last ? new Date(String(last)).getTime() : 0);
          const diff = now - (Number.isFinite(lastMs) ? lastMs : 0);
          if (!Number.isFinite(lastMs) || diff >= 30 * 60 * 1000) {
            const up = pool.request();
            up.input('Id', sql.Int, accountId);
            const sets = [];
            if (hasLastSignIn) sets.push('LastSignIn = SYSDATETIME()');
            if (hasLastSignInAt) sets.push('LastSignInAt = SYSDATETIME()');
            sets.push('UpdatedAt = SYSDATETIME()');
            await up.query(`UPDATE dbo.gym_account SET ${sets.join(', ')} WHERE AccountID = @Id`);
          }
        } finally {
          await pool.close();
        }
      }
    } catch (_) {}
    return res.json({ ok: true, user: payload });
  } catch (error) {
    return res.status(401).json({ ok: false, error: 'Invalid token' });
  }
});

router.post('/auth/change-password', async (req, res) => {
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ ok: false, error: 'Missing bearer token' });
  const token = m[1];
  const { old_password, new_password } = req.body || {};
  if (!old_password || !new_password) {
    return res.status(400).json({ ok: false, error: 'old_password and new_password are required' });
  }
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const accountId = Number(decoded?.account_id || 0);
    if (!Number.isFinite(accountId) || accountId <= 0) {
      return res.status(401).json({ ok: false, error: 'Invalid token account' });
    }
    const config = getDbConfig();
    const pool = await new sql.ConnectionPool(config).connect();
    const current = await pool.request().input('Id', sql.Int, accountId).query(
      'SELECT TOP 1 PasswordHash FROM dbo.gym_account WHERE AccountID = @Id'
    );
    const row = Array.isArray(current?.recordset) && current.recordset.length > 0 ? current.recordset[0] : null;
    if (!row) {
      await pool.close();
      return res.status(200).json({ ok: false, error: 'Account not found' });
    }
    const okOld = await bcrypt.compare(String(old_password), String(row.PasswordHash || ''));
    if (!okOld) {
      await pool.close();
      return res.status(200).json({ ok: false, error: 'Old password does not match' });
    }
    const newHash = await bcrypt.hash(String(new_password), 10);
    const req1 = pool.request();
    req1.input('Id', sql.Int, accountId);
    req1.input('Hash', sql.VarChar(255), String(newHash));
    await req1.query(
      'UPDATE dbo.gym_account SET PasswordHash = @Hash, PasswordResetRequired = 0, UpdatedAt = SYSDATETIME() WHERE AccountID = @Id'
    );
    await pool.close();
    return res.json({ ok: true });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message });
  }
});

export default router;
router.post('/auth/refresh', async (req, res) => {
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ ok: false, error: 'Missing bearer token' });
  const token = m[1];
  try {
    const old = jwt.verify(token, getJwtSecret());
    const accountId = Number(old?.account_id || 0);
    if (!Number.isFinite(accountId) || accountId <= 0) {
      return res.status(401).json({ ok: false, error: 'Invalid token account' });
    }
    const config = getDbConfig();
    const pool = await new sql.ConnectionPool(config).connect();
    try {
      const hasLastSignIn = await hasColumn(pool, 'gym_account', 'LastSignIn');
      const hasLastSignInAt = await hasColumn(pool, 'gym_account', 'LastSignInAt');
      const req1 = pool.request();
      req1.input('Id', sql.Int, accountId);
      const selectCols = ['AccountID', 'Username', 'Email', 'Role', 'IsActive'];
      if (hasLastSignIn || hasLastSignInAt) {
        selectCols.push((hasLastSignIn ? 'LastSignIn' : 'LastSignInAt'));
      }
      const r = await req1.query(
        `SELECT TOP 1 ${selectCols.join(', ')} FROM dbo.gym_account WHERE AccountID = @Id`
      );
      const row = Array.isArray(r?.recordset) && r.recordset.length > 0 ? r.recordset[0] : null;
      if (!row) {
        return res.status(200).json({ ok: false, error: 'Account not found' });
      }
      if (!row.IsActive) {
        return res.status(200).json({ ok: false, error: 'Account is inactive' });
      }
      const last = hasLastSignIn ? row.LastSignIn : (hasLastSignInAt ? row.LastSignInAt : null);
      const now = Date.now();
      const lastMs = last instanceof Date ? last.getTime() : (last ? new Date(String(last)).getTime() : 0);
      const diff = now - (Number.isFinite(lastMs) ? lastMs : 0);
      if (!Number.isFinite(lastMs) || diff >= 30 * 60 * 1000) {
        const up = pool.request();
        up.input('Id', sql.Int, accountId);
        const sets = [];
        if (hasLastSignIn) sets.push('LastSignIn = SYSDATETIME()');
        if (hasLastSignInAt) sets.push('LastSignInAt = SYSDATETIME()');
        sets.push('UpdatedAt = SYSDATETIME()');
        await up.query(`UPDATE dbo.gym_account SET ${sets.join(', ')} WHERE AccountID = @Id`);
      }
      const payload = {
        account_id: Number(row.AccountID),
        username: row.Username != null ? String(row.Username) : '',
        email: row.Email != null ? String(row.Email) : '',
        role: mapDbRoleToUi(row.Role),
      };
      const newToken = jwt.sign(payload, getJwtSecret(), { expiresIn: '8h', issuer: 'gym-control' });
      return res.json({ ok: true, token: newToken, user: payload });
    } finally {
      await pool.close();
    }
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message });
  }
});
