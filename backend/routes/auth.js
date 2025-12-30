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
    await pool.close();
    const row = Array.isArray(r?.recordset) && r.recordset.length > 0 ? r.recordset[0] : null;
    if (!row) {
      return res.status(200).json({ ok: false, error: 'Account not found' });
    }
    if (!row.IsActive) {
      return res.status(200).json({ ok: false, error: 'Account is inactive' });
    }
    const hash = row.PasswordHash != null ? String(row.PasswordHash) : '';
    const match = await bcrypt.compare(String(password), hash);
    if (!match) {
      return res.status(200).json({ ok: false, error: 'Invalid credentials' });
    }
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

