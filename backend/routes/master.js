import express from 'express';
import sql from 'mssql';
import { envTrim, envBool } from '../lib/env.js';

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
  } = process.env;

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
    const pool = await sql.connect(config);
    const request = pool.request();
    if (q) {
      request.input('q', sql.VarChar(50), q + '%');
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

router.get('/employee-core', async (req, res) => {
  const {
    MASTER_DB_SERVER,
    MASTER_DB_PORT,
    MASTER_DB_DATABASE,
    MASTER_DB_USER,
    MASTER_DB_PASSWORD,
    MASTER_DB_ENCRYPT,
    MASTER_DB_TRUST_SERVER_CERTIFICATE,
  } = process.env;

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

  const pickColumn = (columns, candidates) => {
    const map = new Map(columns.map((c) => [String(c).toLowerCase(), String(c)]));
    for (const cand of candidates) {
      const hit = map.get(String(cand).toLowerCase());
      if (hit) return hit;
    }
    return null;
  };

  try {
    const pool = await sql.connect(config);

    const schemaResult = await pool.request().query(
      "SELECT TOP 1 TABLE_SCHEMA AS schema_name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'employee_core' ORDER BY CASE WHEN TABLE_SCHEMA = 'dbo' THEN 0 ELSE 1 END, TABLE_SCHEMA"
    );

    const schema = schemaResult?.recordset?.[0]?.schema_name ? String(schemaResult.recordset[0].schema_name) : 'dbo';

    const colReq = pool.request();
    colReq.input('schema', sql.VarChar(128), schema);
    const columnsResult = await colReq.query(
      'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = \'employee_core\' AND TABLE_SCHEMA = @schema'
    );
    const columns = (columnsResult?.recordset || []).map((r) => String(r.COLUMN_NAME));

    const employeeIdCol = pickColumn(columns, ['employee_id', 'Employee ID', 'employeeid', 'EmployeeID', 'emp_id', 'EmpID']);
    const nameCol = pickColumn(columns, ['name', 'Name', 'employee_name', 'Employee Name', 'full_name', 'FullName']);
    const deptCol = pickColumn(columns, ['department', 'Department', 'dept', 'Dept', 'dept_name', 'DeptName']);
    const cardCol = pickColumn(columns, ['id_card', 'ID Card', 'card_no', 'Card No', 'CardNo']);
    const genderCol = pickColumn(columns, ['gender', 'Gender', 'sex', 'Sex', 'jenis_kelamin', 'Jenis Kelamin']);

    if (!employeeIdCol || !nameCol) {
      await pool.close();
      return res.status(200).json({ ok: false, error: 'employee_core must have employee_id and Name columns', employees: [] });
    }

    const selectCols = [
      `[${employeeIdCol}] AS employee_id`,
      `[${nameCol}] AS name`,
      deptCol ? `[${deptCol}] AS department` : `CAST(NULL AS varchar(255)) AS department`,
      cardCol ? `[${cardCol}] AS card_no` : `CAST(NULL AS varchar(255)) AS card_no`,
      genderCol ? `[${genderCol}] AS gender` : `CAST(NULL AS varchar(50)) AS gender`,
    ].join(',\n        ');

    const request = pool.request();
    let whereSql = '';

    if (ids.length > 0) {
      const params = ids.map((_, idx) => `@id${idx}`);
      ids.forEach((id, idx) => {
        request.input(`id${idx}`, sql.VarChar(100), id);
      });
      whereSql = `WHERE [${employeeIdCol}] IN (${params.join(', ')})`;
    } else if (q) {
      request.input('qEmp', sql.VarChar(100), q + '%');
      request.input('qName', sql.VarChar(200), q + '%');
      whereSql = `WHERE [${employeeIdCol}] LIKE @qEmp OR [${nameCol}] LIKE @qName`;
    }

    const query = `SELECT TOP (${limit}) ${selectCols} FROM [${schema}].[employee_core] ${whereSql} ORDER BY [${employeeIdCol}] ASC`;

    const result = await request.query(query);
    await pool.close();

    const employees = (result?.recordset || []).map((row) => ({
      employee_id: String(row.employee_id ?? '').trim(),
      name: String(row.name ?? '').trim(),
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

export default router;
