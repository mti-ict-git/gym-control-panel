import express from 'express';
import sql from 'mssql';
import { envTrim, envBool } from '../lib/env.js';

/**
 * GET /employees
 * Purpose: Search employee IDs by prefix.
 * Params: query { q?: string }.
 * Response: { success: boolean, employees: string[], error?: string }.
 */
export const createMasterRouter = ({ sqlImpl = sql, env = process.env } = {}) => {
  const router = express.Router();

  router.get('/employees', async (req, res) => {
  const {
    MASTER_DB_SERVER,
    MASTER_DB_PORT,
    MASTER_DB_DATABASE,
    MASTER_DB_USER,
    MASTER_DB_PASSWORD,
    MASTER_DB_ENCRYPT,
    MASTER_DB_TRUST_SERVER_CERTIFICATE,
  } = env;

  const q = String(req.query.q || '').trim();

  const masterServer = envTrim(MASTER_DB_SERVER);
  const masterDatabase = envTrim(MASTER_DB_DATABASE);
  const masterUser = envTrim(MASTER_DB_USER);
  const masterPassword = envTrim(MASTER_DB_PASSWORD);

  if (!masterServer || !masterDatabase || !masterUser || !masterPassword) {
    return res.status(500).json({ success: false, error: 'Master DB env is not configured' });
  }

  const config = {
    server: masterServer,
    port: Number(MASTER_DB_PORT || 1433),
    database: masterDatabase,
    user: masterUser,
    password: masterPassword,
    options: {
      encrypt: envBool(MASTER_DB_ENCRYPT, false),
      trustServerCertificate: envBool(MASTER_DB_TRUST_SERVER_CERTIFICATE, true),
    },
    pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
  };

  try {
    const pool = await sqlImpl.connect(config);
    const request = pool.request();
    if (q) {
      request.input('q', sqlImpl.VarChar(50), q + '%');
    }
    const query = q
      ? 'SELECT TOP 20 employee_id FROM employee_core WHERE employee_id LIKE @q ORDER BY employee_id'
      : 'SELECT TOP 20 employee_id FROM employee_core ORDER BY employee_id';
    const result = await request.query(query);
    await pool.close();
    const employees = (result?.recordset || []).map((row) => String(row.employee_id));
    return res.json({ success: true, employees });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ success: false, error: message, employees: [] });
  }
  });

/**
 * GET /employee-core
 * Purpose: Fetch employee core details by IDs or search query.
 * Params: query { q?: string, ids?: string, limit?: number }.
 * Response: { ok: boolean, employees: object[], error?: string }.
 */
  router.get('/employee-core', async (req, res) => {
  const {
    MASTER_DB_SERVER,
    MASTER_DB_PORT,
    MASTER_DB_DATABASE,
    MASTER_DB_USER,
    MASTER_DB_PASSWORD,
    MASTER_DB_ENCRYPT,
    MASTER_DB_TRUST_SERVER_CERTIFICATE,
  } = env;

  const q = String(req.query.q || '').trim();
  const idsRaw = String(req.query.ids || '').trim();
  const limitRaw = Number(req.query.limit || 200);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(1000, Math.floor(limitRaw))) : 200;

  const ids = idsRaw
    ? idsRaw
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
        .slice(0, 200)
    : [];

  const masterServer = envTrim(MASTER_DB_SERVER);
  const masterDatabase = envTrim(MASTER_DB_DATABASE);
  const masterUser = envTrim(MASTER_DB_USER);
  const masterPassword = envTrim(MASTER_DB_PASSWORD);

  if (!masterServer || !masterDatabase || !masterUser || !masterPassword) {
    return res.status(500).json({ ok: false, error: 'Master DB env is not configured', employees: [] });
  }

  const config = {
    server: masterServer,
    port: Number(MASTER_DB_PORT || 1433),
    database: masterDatabase,
    user: masterUser,
    password: masterPassword,
    options: {
      encrypt: envBool(MASTER_DB_ENCRYPT, false),
      trustServerCertificate: envBool(MASTER_DB_TRUST_SERVER_CERTIFICATE, true),
    },
    pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
  };

  try {
    const pool = await sqlImpl.connect(config);
    const req1 = pool.request();
    if (q) req1.input('q', sqlImpl.VarChar(100), `%${q}%`);
    const clause = ids.length > 0 ? `WHERE employee_id IN (${ids.map((_, i) => `@emp${i}`).join(', ')})` : (q ? 'WHERE employee_id LIKE @q OR name LIKE @q' : '');
    if (ids.length > 0) {
      ids.forEach((id, i) => req1.input(`emp${i}`, sqlImpl.VarChar(50), id));
    }
    req1.input('Limit', sqlImpl.Int, limit);
    const r = await req1.query(
      `SELECT TOP (@Limit) employee_id, name, department, card_no, gender FROM employee_core ${clause} ORDER BY employee_id`
    );
    await pool.close();
    const employees = (r?.recordset || []).map((row) => ({
      employee_id: row.employee_id != null ? String(row.employee_id).trim() : '',
      name: row.name != null ? String(row.name).trim() : null,
      department: row.department != null ? String(row.department).trim() : null,
      card_no: row.card_no != null ? String(row.card_no).trim() : null,
      gender: row.gender != null ? String(row.gender).trim() : null,
    })).filter((e) => e.employee_id);

    return res.json({ ok: true, employees });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message, employees: [] });
  }
  });

  return router;
};

export default createMasterRouter();
