import express from 'express';
import cors from 'cors';
import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

function envTrim(value) {
  const s = value == null ? '' : String(value);
  const t = s.trim();
  return t.length > 0 ? t : '';
}

const app = express();
app.use(cors());
app.use(express.json());

app.post('/test', async (req, res) => {
  const { host, port = 1433, database, user, password, type = 'sqlserver' } = req.body || {};
  if (!host || !database || !user || !password) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }
  if (String(type).toLowerCase() !== 'sqlserver') {
    return res.status(400).json({ success: false, error: 'Only SQL Server is supported by tester' });
  }

  const config = {
    server: host,
    port: Number(port),
    database,
    user,
    password,
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
    pool: { max: 1, min: 0, idleTimeoutMillis: 3000 },
  };

  try {
    const pool = await sql.connect(config);
    await pool.request().query('SELECT 1 AS ok');
    await pool.close();
    return res.json({ success: true });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ success: false, error: message });
  }
});

// Fetch employee IDs from MTIMasterEmployeeDB.employee_core
// Uses MASTER_DB_* environment variables for connection security
app.get('/employees', async (req, res) => {
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
      encrypt: String(MASTER_DB_ENCRYPT || 'false').toLowerCase() === 'true',
      trustServerCertificate: String(MASTER_DB_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() === 'true',
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

app.get('/employee-core', async (req, res) => {
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
      encrypt: String(MASTER_DB_ENCRYPT || 'false').toLowerCase() === 'true',
      trustServerCertificate: String(MASTER_DB_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() === 'true',
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

    const schemaResult = await pool.request().query(`
      SELECT TOP 1 TABLE_SCHEMA AS schema_name
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'employee_core'
      ORDER BY CASE WHEN TABLE_SCHEMA = 'dbo' THEN 0 ELSE 1 END, TABLE_SCHEMA
    `);

    const schema = schemaResult?.recordset?.[0]?.schema_name ? String(schemaResult.recordset[0].schema_name) : 'dbo';

    const colReq = pool.request();
    colReq.input('schema', sql.VarChar(128), schema);
    const columnsResult = await colReq.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'employee_core' AND TABLE_SCHEMA = @schema
    `);
    const columns = (columnsResult?.recordset || []).map((r) => String(r.COLUMN_NAME));

    const employeeIdCol = pickColumn(columns, ['employee_id', 'Employee ID', 'employeeid', 'EmployeeID', 'emp_id', 'EmpID']);
    const nameCol = pickColumn(columns, ['name', 'Name', 'employee_name', 'Employee Name', 'full_name', 'FullName']);
    const deptCol = pickColumn(columns, ['department', 'Department', 'dept', 'Dept', 'dept_name', 'DeptName']);
    const cardCol = pickColumn(columns, ['id_card', 'ID Card', 'card_no', 'Card No', 'CardNo']);
    const genderCol = pickColumn(columns, ['gender', 'Gender', 'sex', 'Sex', 'jenis_kelamin', 'Jenis Kelamin']);

    if (!employeeIdCol || !nameCol) {
      await pool.close();
      return res.status(200).json({
        ok: false,
        error: 'employee_core must have employee_id and Name columns',
        employees: [],
      });
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

    const query = `
      SELECT TOP (${limit})
        ${selectCols}
      FROM [${schema}].[employee_core]
      ${whereSql}
      ORDER BY [${employeeIdCol}] ASC
    `;

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

// GymDB availability for a given date, grouped by time (HH:MM)
app.get('/gym-availability', async (req, res) => {
  const {
    DB_SERVER,
    DB_PORT,
    DB_DATABASE,
    DB_USER,
    DB_PASSWORD,
    DB_ENCRYPT,
    DB_TRUST_SERVER_CERTIFICATE,
  } = process.env;

  const dateStr = String(req.query.date || '').trim();
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return res.status(400).json({ success: false, error: 'Invalid or missing date (yyyy-MM-dd)' });
  }

  if (!DB_SERVER || !DB_DATABASE || !DB_USER || !DB_PASSWORD) {
    return res.status(500).json({ success: false, error: 'Gym DB env is not configured' });
  }

  const config = {
    server: DB_SERVER,
    port: Number(DB_PORT || 1433),
    database: DB_DATABASE,
    user: DB_USER,
    password: DB_PASSWORD,
    options: {
      encrypt: String(DB_ENCRYPT || 'false').toLowerCase() === 'true',
      trustServerCertificate: String(DB_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() === 'true',
    },
    pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
  };

  // Default quota per session
  const DEFAULT_QUOTA = 15;

  try {
    const pool = await sql.connect(config);
    const request = pool.request();
    request.input('dateParam', sql.Date, new Date(dateStr));

    // Group bookings by minute (HH:MM); count only status = 'BOOKED'
    const query = `
      SELECT 
        CONVERT(varchar(5), schedule_time, 108) AS hhmm,
        COUNT(*) AS booked_count
      FROM dbo.gym_schedule
      WHERE CAST(schedule_time AS DATE) = @dateParam
        AND status = 'BOOKED'
      GROUP BY CONVERT(varchar(5), schedule_time, 108)
      ORDER BY hhmm
    `;

    const result = await request.query(query);
    await pool.close();

    const rows = Array.isArray(result?.recordset) ? result.recordset : [];

    // Map HH:MM to session label buckets
    function labelFor(hhmm) {
      const [hh, mm] = String(hhmm).split(':').map((v) => Number(v));
      const minutes = hh * 60 + (mm || 0);
      if (minutes < 12 * 60) return 'Morning';
      if (minutes < 20 * 60) return 'Night 1';
      return 'Night 2';
    }

    const sessions = rows.map((r) => {
      const hhmm = String(r.hhmm);
      const booked = Number(r.booked_count) || 0;
      const quota = DEFAULT_QUOTA;
      return {
        session_label: labelFor(hhmm),
        time_start: hhmm,
        time_end: null,
        quota,
        booked_count: booked,
        available: Math.max(quota - booked, 0),
      };
    });

    return res.json({ success: true, sessions });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ success: false, error: message, sessions: [] });
  }
});

// GymDB sessions: distinct start times -> session label, start, end, quota
app.get('/gym-sessions', async (req, res) => {
  const {
    DB_SERVER,
    DB_PORT,
    DB_DATABASE,
    DB_USER,
    DB_PASSWORD,
    DB_ENCRYPT,
    DB_TRUST_SERVER_CERTIFICATE,
  } = process.env;

  if (!DB_SERVER || !DB_DATABASE || !DB_USER || !DB_PASSWORD) {
    return res.status(500).json({ ok: false, error: 'Gym DB env is not configured', sessions: [] });
  }

  const config = {
    server: DB_SERVER,
    port: Number(DB_PORT || 1433),
    database: DB_DATABASE,
    user: DB_USER,
    password: DB_PASSWORD,
    options: {
      encrypt: String(DB_ENCRYPT || 'false').toLowerCase() === 'true',
      trustServerCertificate: String(DB_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() === 'true',
    },
    pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
  };

  // Default quota per session
  const DEFAULT_QUOTA = 15;

  // Simple mapping for end times by label
  function labelFor(hhmm) {
    const [hh, mm] = String(hhmm).split(':').map((v) => Number(v));
    const minutes = hh * 60 + (mm || 0);
    if (minutes < 12 * 60) return 'Morning';
    if (minutes < 20 * 60) return 'Night 1';
    return 'Night 2';
  }
  function endFor(label) {
    switch (label) {
      case 'Morning':
        return '06:30';
      case 'Night 1':
        return '20:00';
      case 'Night 2':
        return '22:00';
      default:
        return null;
    }
  }

  try {
    const pool = await sql.connect(config);
    const request = pool.request();
    const result = await request.query(`
      SELECT 
        Session AS session_name,
        CONVERT(varchar(5), StartTime, 108) AS time_start,
        CONVERT(varchar(5), EndTime, 108) AS time_end,
        Quota AS quota
      FROM dbo.gym_schedule
      ORDER BY StartTime
    `);
    await pool.close();

    const rows = Array.isArray(result?.recordset) ? result.recordset : [];
    const sessions = rows.map((r) => ({
      session_name: String(r.session_name),
      time_start: String(r.time_start),
      time_end: r.time_end ? String(r.time_end) : null,
      quota: Number(r.quota) || DEFAULT_QUOTA,
    }));

    return res.json({ ok: true, sessions });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message, sessions: [] });
  }
});

// Create session record (Session Name, Time Start, Time End, Quota) in GymDB.gym_schedule
app.post('/gym-session-create', async (req, res) => {
  const {
    DB_SERVER,
    DB_PORT,
    DB_DATABASE,
    DB_USER,
    DB_PASSWORD,
    DB_ENCRYPT,
    DB_TRUST_SERVER_CERTIFICATE,
  } = process.env;

  if (!DB_SERVER || !DB_DATABASE || !DB_USER || !DB_PASSWORD) {
    return res.status(500).json({ ok: false, error: 'Gym DB env is not configured' });
  }

  const { session_name, time_start, time_end, quota } = req.body || {};
  if (!session_name || !time_start || !time_end || typeof quota !== 'number') {
    return res.status(400).json({ ok: false, error: 'session_name, time_start, time_end, quota are required' });
  }

  const config = {
    server: DB_SERVER,
    port: Number(DB_PORT || 1433),
    database: DB_DATABASE,
    user: DB_USER,
    password: DB_PASSWORD,
    options: {
      encrypt: String(DB_ENCRYPT || 'false').toLowerCase() === 'true',
      trustServerCertificate: String(DB_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() === 'true',
    },
    pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
  };

  try {
    const pool = await sql.connect(config);
    const request = pool.request();
    const columnsCheck = await request.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'gym_schedule'
        AND COLUMN_NAME IN ('Session','StartTime','EndTime','Quota')
    `);
    const present = new Set((columnsCheck?.recordset || []).map((r) => String(r.COLUMN_NAME)));
    const missing = ['Session','StartTime','EndTime','Quota'].filter((c) => !present.has(c));
    if (missing.length > 0) {
      await pool.close();
      return res.status(200).json({ ok: false, error: `Missing columns in dbo.gym_schedule: ${missing.join(', ')}` });
    }

    request.input('session_name', sql.VarChar(20), String(session_name));
    request.input('time_start', sql.VarChar(5), String(time_start));
    request.input('time_end', sql.VarChar(5), String(time_end));
    request.input('quota', sql.Int, Number(quota));
    await request.query(`
      INSERT INTO dbo.gym_schedule (Session, StartTime, EndTime, Quota)
      VALUES (@session_name, CAST(@time_start AS time(0)), CAST(@time_end AS time(0)), @quota)
    `);
    await pool.close();
    return res.json({ ok: true });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message });
  }
});

app.post('/gym-session-update', async (req, res) => {
  const {
    DB_SERVER,
    DB_PORT,
    DB_DATABASE,
    DB_USER,
    DB_PASSWORD,
    DB_ENCRYPT,
    DB_TRUST_SERVER_CERTIFICATE,
  } = process.env;

  if (!DB_SERVER || !DB_DATABASE || !DB_USER || !DB_PASSWORD) {
    return res.status(500).json({ ok: false, error: 'Gym DB env is not configured' });
  }

  const {
    original_session_name,
    original_time_start,
    session_name,
    time_start,
    time_end,
    quota,
  } = req.body || {};

  if (!original_session_name || !original_time_start) {
    return res.status(400).json({ ok: false, error: 'original_session_name and original_time_start are required' });
  }
  if (!session_name || !time_start || !time_end || typeof quota !== 'number') {
    return res.status(400).json({ ok: false, error: 'session_name, time_start, time_end, quota are required' });
  }

  const config = {
    server: DB_SERVER,
    port: Number(DB_PORT || 1433),
    database: DB_DATABASE,
    user: DB_USER,
    password: DB_PASSWORD,
    options: {
      encrypt: String(DB_ENCRYPT || 'false').toLowerCase() === 'true',
      trustServerCertificate: String(DB_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() === 'true',
    },
    pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
  };

  try {
    const pool = await sql.connect(config);
    const request = pool.request();
    request.input('original_session_name', sql.VarChar(20), String(original_session_name));
    request.input('original_time_start', sql.VarChar(5), String(original_time_start));
    request.input('session_name', sql.VarChar(20), String(session_name));
    request.input('time_start', sql.VarChar(5), String(time_start));
    request.input('time_end', sql.VarChar(5), String(time_end));
    request.input('quota', sql.Int, Number(quota));

    const result = await request.query(`
      UPDATE dbo.gym_schedule
      SET
        Session = @session_name,
        StartTime = CAST(@time_start AS time(0)),
        EndTime = CAST(@time_end AS time(0)),
        Quota = @quota
      WHERE Session = @original_session_name
        AND StartTime = CAST(@original_time_start AS time(0))
    `);

    await pool.close();

    const affected = Array.isArray(result?.rowsAffected) ? Number(result.rowsAffected[0] || 0) : 0;
    if (affected < 1) {
      return res.status(200).json({ ok: false, error: 'Session not found or not updated' });
    }

    return res.json({ ok: true, affected });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message });
  }
});

app.post('/gym-session-delete', async (req, res) => {
  const {
    DB_SERVER,
    DB_PORT,
    DB_DATABASE,
    DB_USER,
    DB_PASSWORD,
    DB_ENCRYPT,
    DB_TRUST_SERVER_CERTIFICATE,
  } = process.env;

  if (!DB_SERVER || !DB_DATABASE || !DB_USER || !DB_PASSWORD) {
    return res.status(500).json({ ok: false, error: 'Gym DB env is not configured' });
  }

  const { session_name, time_start } = req.body || {};
  if (!session_name || !time_start) {
    return res.status(400).json({ ok: false, error: 'session_name and time_start are required' });
  }

  const config = {
    server: DB_SERVER,
    port: Number(DB_PORT || 1433),
    database: DB_DATABASE,
    user: DB_USER,
    password: DB_PASSWORD,
    options: {
      encrypt: String(DB_ENCRYPT || 'false').toLowerCase() === 'true',
      trustServerCertificate: String(DB_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() === 'true',
    },
    pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
  };

  try {
    const pool = await sql.connect(config);
    const request = pool.request();
    request.input('session_name', sql.VarChar(20), String(session_name));
    request.input('time_start', sql.VarChar(5), String(time_start));

    const result = await request.query(`
      DELETE FROM dbo.gym_schedule
      WHERE Session = @session_name
        AND StartTime = CAST(@time_start AS time(0))
    `);

    await pool.close();

    const affected = Array.isArray(result?.rowsAffected) ? Number(result.rowsAffected[0] || 0) : 0;
    if (affected < 1) {
      return res.status(200).json({ ok: false, error: 'Session not found or not deleted' });
    }

    return res.json({ ok: true, affected });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message });
  }
});

// Create a schedule booking in GymDB.gym_schedule
// Body: { gym_user_id?: string, schedule_time: string(ISO), status?: 'BOOKED'|'IN_GYM'|'OUT' }
app.post('/gym-schedule-create', async (req, res) => {
  const {
    DB_SERVER,
    DB_PORT,
    DB_DATABASE,
    DB_USER,
    DB_PASSWORD,
    DB_ENCRYPT,
    DB_TRUST_SERVER_CERTIFICATE,
  } = process.env;

  if (!DB_SERVER || !DB_DATABASE || !DB_USER || !DB_PASSWORD) {
    return res.status(500).json({ ok: false, error: 'Gym DB env is not configured' });
  }

  const { gym_user_id = null, schedule_time, status = 'BOOKED' } = req.body || {};
  if (!schedule_time || typeof schedule_time !== 'string') {
    return res.status(400).json({ ok: false, error: 'schedule_time (ISO) is required' });
  }

  let scheduleDate;
  try {
    scheduleDate = new Date(schedule_time);
    if (isNaN(scheduleDate.getTime())) throw new Error('Invalid date');
  } catch (_) {
    return res.status(400).json({ ok: false, error: 'Invalid schedule_time' });
  }

  const config = {
    server: DB_SERVER,
    port: Number(DB_PORT || 1433),
    database: DB_DATABASE,
    user: DB_USER,
    password: DB_PASSWORD,
    options: {
      encrypt: String(DB_ENCRYPT || 'false').toLowerCase() === 'true',
      trustServerCertificate: String(DB_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() === 'true',
    },
    pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
  };

  try {
    const pool = await sql.connect(config);
    const request = pool.request();
    request.input('schedule_time', sql.DateTime, scheduleDate);
    request.input('status', sql.VarChar(20), status);
    if (gym_user_id) {
      request.input('gym_user_id', sql.VarChar(64), String(gym_user_id));
    }

    // Try inserting with gym_user_id; if column doesn't exist, fallback to without
    const queryWithUser = `
      INSERT INTO dbo.gym_schedule (${gym_user_id ? 'gym_user_id,' : ''} schedule_time, status)
      VALUES (${gym_user_id ? '@gym_user_id,' : ''} @schedule_time, @status)
    `;

    try {
      await request.query(queryWithUser);
    } catch (err) {
      // Fallback: insert without gym_user_id if column is missing
      if (gym_user_id) {
        const request2 = pool.request();
        request2.input('schedule_time', sql.DateTime, scheduleDate);
        request2.input('status', sql.VarChar(20), status);
        await request2.query(`INSERT INTO dbo.gym_schedule (schedule_time, status) VALUES (@schedule_time, @status)`);
      } else {
        throw err;
      }
    }

    await pool.close();
    return res.json({ ok: true });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message });
  }
});

app.get('/gym-bookings', async (req, res) => {
  const {
    DB_SERVER,
    DB_PORT,
    DB_DATABASE,
    DB_USER,
    DB_PASSWORD,
    DB_ENCRYPT,
    DB_TRUST_SERVER_CERTIFICATE,
  } = process.env;

  if (!DB_SERVER || !DB_DATABASE || !DB_USER || !DB_PASSWORD) {
    return res.status(500).json({ ok: false, error: 'Gym DB env is not configured', bookings: [] });
  }

  const from = String(req.query.from || '').trim();
  const to = String(req.query.to || '').trim();
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return res.status(400).json({ ok: false, error: 'from and to are required (yyyy-MM-dd)', bookings: [] });
  }

  const config = {
    server: DB_SERVER,
    port: Number(DB_PORT || 1433),
    database: DB_DATABASE,
    user: DB_USER,
    password: DB_PASSWORD,
    options: {
      encrypt: String(DB_ENCRYPT || 'false').toLowerCase() === 'true',
      trustServerCertificate: String(DB_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() === 'true',
    },
    pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
  };

  try {
    const pool = await sql.connect(config);
    const request = pool.request();
    request.input('fromDate', sql.Date, new Date(from));
    request.input('toDate', sql.Date, new Date(to));

    const result = await request.query(`
      SELECT
        b.BookingID AS booking_id,
        b.EmployeeID AS employee_id,
        b.CardNo AS card_no,
        b.EmployeeName AS employee_name,
        b.Department AS department,
        b.Gender AS gender,
        b.SessionName AS session_name,
        b.ScheduleID AS schedule_id,
        CONVERT(varchar(10), b.BookingDate, 23) AS booking_date,
        b.Status AS status,
        b.ApprovalStatus AS approval_status,
        b.CreatedAt AS created_at,
        CONVERT(varchar(5), s.StartTime, 108) AS time_start,
        CONVERT(varchar(5), s.EndTime, 108) AS time_end
      FROM dbo.gym_booking b
      LEFT JOIN dbo.gym_schedule s
        ON s.ScheduleID = b.ScheduleID
      WHERE b.BookingDate >= @fromDate
        AND b.BookingDate <= @toDate
        AND b.Status IN ('BOOKED','CHECKIN','COMPLETED')
      ORDER BY b.BookingDate ASC, time_start ASC, b.CreatedAt ASC
    `);
    await pool.close();

    const bookings = Array.isArray(result?.recordset)
      ? result.recordset.map((r) => ({
          booking_id: Number(r.booking_id),
          employee_id: String(r.employee_id ?? '').trim(),
          card_no: r.card_no != null ? String(r.card_no).trim() : null,
          employee_name: String(r.employee_name ?? '').trim(),
          department: r.department != null ? String(r.department).trim() : null,
          gender: r.gender != null ? String(r.gender).trim() : null,
          session_name: String(r.session_name ?? '').trim(),
          schedule_id: Number(r.schedule_id),
          booking_date: String(r.booking_date ?? '').trim(),
          status: String(r.status ?? '').trim(),
          approval_status: r.approval_status != null ? String(r.approval_status).trim() : null,
          created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ''),
          time_start: r.time_start != null ? String(r.time_start).trim() : null,
          time_end: r.time_end != null ? String(r.time_end).trim() : null,
        }))
      : [];

    return res.json({ ok: true, bookings });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message, bookings: [] });
  }
});

app.post('/gym-booking-create', async (req, res) => {
  const {
    DB_SERVER,
    DB_PORT,
    DB_DATABASE,
    DB_USER,
    DB_PASSWORD,
    DB_ENCRYPT,
    DB_TRUST_SERVER_CERTIFICATE,
    MASTER_DB_SERVER,
    MASTER_DB_PORT,
    MASTER_DB_DATABASE,
    MASTER_DB_USER,
    MASTER_DB_PASSWORD,
    MASTER_DB_ENCRYPT,
    MASTER_DB_TRUST_SERVER_CERTIFICATE,
    CARD_DB_SERVER,
    CARD_DB_PORT,
    CARD_DB_DATABASE,
    CARD_DB_USER,
    CARD_DB_PASSWORD,
    CARD_DB_ENCRYPT,
    CARD_DB_TRUST_SERVER_CERTIFICATE,
  } = process.env;

  const gymServer = envTrim(DB_SERVER);
  const gymDatabase = envTrim(DB_DATABASE);
  const gymUser = envTrim(DB_USER);
  const gymPassword = envTrim(DB_PASSWORD);
  if (!gymServer || !gymDatabase || !gymUser || !gymPassword) {
    return res.status(500).json({ ok: false, error: 'Gym DB env is not configured' });
  }

  const masterServer = envTrim(MASTER_DB_SERVER);
  const masterDatabase = envTrim(MASTER_DB_DATABASE);
  const masterUser = envTrim(MASTER_DB_USER);
  const masterPassword = envTrim(MASTER_DB_PASSWORD);
  if (!masterServer || !masterDatabase || !masterUser || !masterPassword) {
    return res.status(500).json({ ok: false, error: 'Master DB env is not configured' });
  }

  const { employee_id, session_id, booking_date } = req.body || {};
  const employeeIdHeader = envTrim(req.headers['x-employee-id'] || req.headers['x-employee_id']);
  const employeeId = String(employee_id || employeeIdHeader || '').trim();
  const sessionId = String(session_id || '').trim();
  const bookingDateStr = String(booking_date || '').trim();

  if (!employeeId || !sessionId || !bookingDateStr) {
    return res.status(400).json({
      ok: false,
      error: 'employee_id (body or x-employee-id header), session_id, booking_date are required',
    });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDateStr)) {
    return res.status(400).json({ ok: false, error: 'booking_date must be yyyy-MM-dd' });
  }

  const parts = sessionId.split('__');
  const sessionName = String(parts[0] || '').trim();
  const timeStart = String(parts[1] || '').trim();
  if (!sessionName || !timeStart || !/^\d{2}:\d{2}$/.test(timeStart)) {
    return res.status(400).json({ ok: false, error: 'session_id must be "Session__HH:MM"' });
  }

  const gymConfig = {
    server: gymServer,
    port: Number(DB_PORT || 1433),
    database: gymDatabase,
    user: gymUser,
    password: gymPassword,
    options: {
      encrypt: String(DB_ENCRYPT || 'false').toLowerCase() === 'true',
      trustServerCertificate: String(DB_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() === 'true',
    },
    pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
  };

  const masterConfig = {
    server: masterServer,
    port: Number(MASTER_DB_PORT || 1433),
    database: masterDatabase,
    user: masterUser,
    password: masterPassword,
    options: {
      encrypt: String(MASTER_DB_ENCRYPT || 'false').toLowerCase() === 'true',
      trustServerCertificate: String(MASTER_DB_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() === 'true',
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

  const pickSchemaForTable = async (pool, tableName) => {
    const safe = String(tableName || '').trim();
    if (!/^[A-Za-z0-9_]+$/.test(safe)) return null;
    const req = pool.request();
    req.input('tableName', sql.VarChar(128), safe);
    const r = await req.query(`
      SELECT TOP 1 TABLE_SCHEMA AS schema_name
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = @tableName
      ORDER BY CASE WHEN TABLE_SCHEMA = 'dbo' THEN 0 ELSE 1 END, TABLE_SCHEMA
    `);
    const schemaName = r?.recordset?.[0]?.schema_name ? String(r.recordset[0].schema_name) : null;
    return schemaName && schemaName.trim().length > 0 ? schemaName : null;
  };

  const tryLoadActiveCardNo = async (empId) => {
    const cardServer = envTrim(CARD_DB_SERVER);
    const cardDatabase = envTrim(CARD_DB_DATABASE);
    const cardUser = envTrim(CARD_DB_USER);
    const cardPassword = envTrim(CARD_DB_PASSWORD);

    if (!cardServer || !cardDatabase || !cardUser || !cardPassword) return null;

    const cardConfig = {
      server: cardServer,
      port: Number(CARD_DB_PORT || 1433),
      database: cardDatabase,
      user: cardUser,
      password: cardPassword,
      options: {
        encrypt: String(CARD_DB_ENCRYPT || 'false').toLowerCase() === 'true',
        trustServerCertificate: String(CARD_DB_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() === 'true',
      },
      pool: { max: 1, min: 0, idleTimeoutMillis: 5000 },
    };

    const tableCandidates = ['employee_card', 'employee_cards', 'cards', 'card'];

    let pool;
    try {
      pool = await sql.connect(cardConfig);
      const tableResult = await pool.request().query(`
        SELECT TOP 1 TABLE_SCHEMA AS schema_name, TABLE_NAME AS table_name
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE'
          AND TABLE_NAME IN (${tableCandidates.map((t) => `'${t}'`).join(', ')})
        ORDER BY CASE WHEN TABLE_SCHEMA = 'dbo' THEN 0 ELSE 1 END, TABLE_SCHEMA
      `);
      const row = tableResult?.recordset?.[0] || null;
      if (!row?.schema_name || !row?.table_name) {
        await pool.close();
        return null;
      }

      const schema = String(row.schema_name);
      const table = String(row.table_name);

      const colsResult = await pool.request().query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = '${schema.replace(/'/g, "''")}'
          AND TABLE_NAME = '${table.replace(/'/g, "''")}'
      `);
      const cols = (colsResult?.recordset || []).map((r) => String(r.COLUMN_NAME));
      const empCol = pickColumn(cols, ['employee_id', 'EmployeeID', 'emp_id', 'EmpID']);
      const cardCol = pickColumn(cols, ['card_no', 'CardNo', 'card_number', 'CardNumber', 'id_card', 'IDCard']);
      const activeCol = pickColumn(cols, ['is_active', 'IsActive', 'active', 'Active', 'status', 'Status']);

      if (!empCol || !cardCol) {
        await pool.close();
        return null;
      }

      const req = pool.request();
      req.input('id', sql.VarChar(100), String(empId));

      const activeWhere = activeCol
        ? `AND (\n          [${activeCol}] = 1\n          OR UPPER(CAST([${activeCol}] AS varchar(50))) IN ('ACTIVE','AKTIF','1','TRUE')\n        )`
        : '';

      const cardResult = await req.query(`
        SELECT TOP 1
          [${cardCol}] AS card_no
        FROM [${schema}].[${table}]
        WHERE [${empCol}] = @id
        ${activeWhere}
      `);
      await pool.close();

      const cardNo = cardResult?.recordset?.[0]?.card_no;
      return cardNo != null ? String(cardNo).trim() : null;
    } catch (_) {
      try {
        if (pool) await pool.close();
      } catch (_) {
      }
      return null;
    }
  };

  try {
    const bookingDate = new Date(bookingDateStr);
    if (isNaN(bookingDate.getTime())) throw new Error('Invalid booking_date');

    const gymPool = await sql.connect(gymConfig);
    const scheduleReq = gymPool.request();
    scheduleReq.input('session_name', sql.VarChar(50), sessionName);
    scheduleReq.input('time_start', sql.VarChar(5), timeStart);
    const scheduleResult = await scheduleReq.query(`
      SELECT TOP 1
        ScheduleID AS schedule_id,
        Quota AS quota
      FROM dbo.gym_schedule
      WHERE Session = @session_name
        AND StartTime = CAST(@time_start AS time(0))
    `);

    const scheduleRow = Array.isArray(scheduleResult?.recordset) ? scheduleResult.recordset[0] : null;
    const scheduleId = scheduleRow?.schedule_id != null ? Number(scheduleRow.schedule_id) : null;
    const quota = scheduleRow?.quota != null ? Number(scheduleRow.quota) : 15;
    if (!scheduleId || !Number.isFinite(scheduleId)) {
      await gymPool.close();
      return res.status(200).json({ ok: false, error: 'Session not found in GymDB' });
    }

    const dupReq = gymPool.request();
    dupReq.input('employee_id', sql.VarChar(20), employeeId);
    dupReq.input('booking_date', sql.Date, bookingDate);
    const dupResult = await dupReq.query(`
      SELECT COUNT(*) AS cnt
      FROM dbo.gym_booking
      WHERE EmployeeID = @employee_id
        AND BookingDate = @booking_date
        AND Status IN ('BOOKED','CHECKIN')
    `);
    const duplicateCount = Number(dupResult?.recordset?.[0]?.cnt || 0);
    if (duplicateCount > 0) {
      await gymPool.close();
      return res.status(200).json({ ok: false, error: 'You are already registered for this day' });
    }

    const quotaReq = gymPool.request();
    quotaReq.input('schedule_id', sql.Int, scheduleId);
    quotaReq.input('booking_date', sql.Date, bookingDate);
    const quotaResult = await quotaReq.query(`
      SELECT COUNT(*) AS cnt
      FROM dbo.gym_booking
      WHERE ScheduleID = @schedule_id
        AND BookingDate = @booking_date
        AND Status IN ('BOOKED','CHECKIN')
    `);
    const bookedCount = Number(quotaResult?.recordset?.[0]?.cnt || 0);
    if (bookedCount >= quota) {
      await gymPool.close();
      return res.status(200).json({ ok: false, error: 'This session is full' });
    }

    await gymPool.close();

    const masterPool = await sql.connect(masterConfig);

    const coreSchema = await pickSchemaForTable(masterPool, 'employee_core');
    if (!coreSchema) {
      await masterPool.close();
      return res.status(200).json({ ok: false, error: 'Missing table employee_core' });
    }

    const columnsResult = await masterPool.request().query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'employee_core' AND TABLE_SCHEMA = '${coreSchema.replace(/'/g, "''")}'
    `);
    const columns = (columnsResult?.recordset || []).map((r) => String(r.COLUMN_NAME));

    const employeeIdCol = pickColumn(columns, ['employee_id', 'Employee ID', 'employeeid', 'EmployeeID', 'emp_id', 'EmpID']);
    const nameCol = pickColumn(columns, ['name', 'Name', 'employee_name', 'Employee Name', 'full_name', 'FullName']);
    const deptCol = pickColumn(columns, ['department', 'Department', 'dept', 'Dept', 'dept_name', 'DeptName']);
    const cardCol = pickColumn(columns, ['id_card', 'ID Card', 'card_no', 'Card No', 'CardNo']);
    const genderCol = pickColumn(columns, ['gender', 'Gender', 'sex', 'Sex', 'jenis_kelamin', 'Jenis Kelamin']);

    if (!employeeIdCol || !nameCol) {
      await masterPool.close();
      return res.status(200).json({ ok: false, error: 'employee_core must have employee_id and Name columns' });
    }

    const selectCols = [
      `[${employeeIdCol}] AS employee_id`,
      `[${nameCol}] AS name`,
      deptCol ? `[${deptCol}] AS department` : `CAST(NULL AS varchar(255)) AS department`,
      cardCol ? `[${cardCol}] AS card_no` : `CAST(NULL AS varchar(255)) AS card_no`,
      genderCol ? `[${genderCol}] AS gender` : `CAST(NULL AS varchar(50)) AS gender`,
    ].join(',\n        ');

    const empReq = masterPool.request();
    empReq.input('id', sql.VarChar(100), employeeId);
    const empResult = await empReq.query(`
      SELECT TOP 1
        ${selectCols}
      FROM [${coreSchema}].[employee_core]
      WHERE [${employeeIdCol}] = @id
    `);

    const empRow = Array.isArray(empResult?.recordset) ? empResult.recordset[0] : null;
    if (!empRow) {
      await masterPool.close();
      return res.status(200).json({ ok: false, error: 'Employee not found' });
    }

    let department = empRow.department != null ? String(empRow.department).trim() : '';
    const employmentSchema = await pickSchemaForTable(masterPool, 'employee_employment');
    if (employmentSchema) {
      const empColsResult = await masterPool.request().query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'employee_employment' AND TABLE_SCHEMA = '${employmentSchema.replace(/'/g, "''")}'
      `);
      const empCols = (empColsResult?.recordset || []).map((r) => String(r.COLUMN_NAME));
      const empIdCol2 = pickColumn(empCols, ['employee_id', 'EmployeeID', 'emp_id', 'EmpID']);
      const deptCol2 = pickColumn(empCols, ['department', 'Department', 'dept', 'Dept', 'department_name', 'DepartmentName', 'dept_name', 'DeptName']);
      const endDateCol = pickColumn(empCols, ['end_date', 'EndDate', 'enddate', 'termination_date', 'TerminationDate']);
      const startDateCol = pickColumn(empCols, ['start_date', 'StartDate', 'startdate', 'effective_date', 'EffectiveDate']);

      if (empIdCol2 && deptCol2) {
        const empReq2 = masterPool.request();
        empReq2.input('id', sql.VarChar(100), employeeId);
        const orderParts = [];
        if (endDateCol) orderParts.push(`CASE WHEN [${endDateCol}] IS NULL THEN 0 ELSE 1 END`);
        if (startDateCol) orderParts.push(`[${startDateCol}] DESC`);
        const orderBy = orderParts.length > 0 ? `ORDER BY ${orderParts.join(', ')}` : '';
        const deptResult = await empReq2.query(`
          SELECT TOP 1
            [${deptCol2}] AS department
          FROM [${employmentSchema}].[employee_employment]
          WHERE [${empIdCol2}] = @id
          ${orderBy}
        `);
        const deptRow = Array.isArray(deptResult?.recordset) ? deptResult.recordset[0] : null;
        if (deptRow?.department != null && String(deptRow.department).trim()) {
          department = String(deptRow.department).trim();
        }
      }
    }

    await masterPool.close();

    const employeeName = String(empRow.name ?? '').trim();
    const cardNoMaster = empRow.card_no != null ? String(empRow.card_no).trim() : null;
    const cardNoCardDb = await tryLoadActiveCardNo(employeeId);
    const cardNo = cardNoCardDb || cardNoMaster;
    const gender = empRow.gender != null && String(empRow.gender).trim() ? String(empRow.gender).trim() : 'UNKNOWN';

    const gymPool2 = await sql.connect(gymConfig);
    const insertReq = gymPool2.request();
    insertReq.input('employee_id', sql.VarChar(20), employeeId);
    insertReq.input('card_no', sql.VarChar(50), cardNo);
    insertReq.input('employee_name', sql.VarChar(100), employeeName);
    insertReq.input('department', sql.VarChar(100), department);
    insertReq.input('gender', sql.VarChar(10), gender);
    insertReq.input('session_name', sql.VarChar(50), sessionName);
    insertReq.input('schedule_id', sql.Int, scheduleId);
    insertReq.input('booking_date', sql.Date, bookingDate);

    const insertResult = await insertReq.query(`
      INSERT INTO dbo.gym_booking (
        EmployeeID, CardNo, EmployeeName, Department, Gender, SessionName, ScheduleID, BookingDate, Status
      )
      OUTPUT INSERTED.BookingID AS booking_id
      VALUES (
        @employee_id, @card_no, @employee_name, @department, @gender, @session_name, @schedule_id, @booking_date, 'BOOKED'
      )
    `);

    await gymPool2.close();
    const bookingId = Number(insertResult?.recordset?.[0]?.booking_id || 0);
    return res.json({ ok: true, booking_id: bookingId, schedule_id: scheduleId });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message });
  }
});

app.post('/gym-booking-init', async (req, res) => {
  const {
    DB_SERVER,
    DB_PORT,
    DB_DATABASE,
    DB_USER,
    DB_PASSWORD,
    DB_ENCRYPT,
    DB_TRUST_SERVER_CERTIFICATE,
  } = process.env;

  const gymServer = envTrim(DB_SERVER);
  const gymDatabase = envTrim(DB_DATABASE);
  const gymUser = envTrim(DB_USER);
  const gymPassword = envTrim(DB_PASSWORD);

  if (!gymServer || !gymDatabase || !gymUser || !gymPassword) {
    return res.status(500).json({ ok: false, error: 'Gym DB env is not configured' });
  }

  const config = {
    server: gymServer,
    port: Number(DB_PORT || 1433),
    database: gymDatabase,
    user: gymUser,
    password: gymPassword,
    options: {
      encrypt: String(DB_ENCRYPT || 'false').toLowerCase() === 'true',
      trustServerCertificate: String(DB_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() === 'true',
    },
    pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
  };

  try {
    const pool = await sql.connect(config);
    const tx = new sql.Transaction(pool);
    await tx.begin();
    const exec = async (q) => tx.request().query(q);
    let duplicates = [];

    try {
      await exec('SET NOCOUNT ON;');

      const scheduleExists = await exec("SELECT OBJECT_ID('dbo.gym_schedule', 'U') AS id;");
      if (!scheduleExists?.recordset?.[0]?.id) {
        throw new Error('Missing table dbo.gym_schedule');
      }

      await exec(`
        IF COL_LENGTH('dbo.gym_schedule', 'ScheduleID') IS NULL
        BEGIN
          ALTER TABLE dbo.gym_schedule
            ADD ScheduleID INT IDENTITY(1,1) NOT NULL;
        END
      `);

      await exec(`
        IF NOT EXISTS (
          SELECT 1
          FROM sys.key_constraints kc
          JOIN sys.tables t ON t.object_id = kc.parent_object_id
          WHERE kc.[type] = 'UQ'
            AND kc.name = 'UQ_gym_schedule_ScheduleID'
            AND t.name = 'gym_schedule'
            AND SCHEMA_NAME(t.schema_id) = 'dbo'
        )
        BEGIN
          ALTER TABLE dbo.gym_schedule
            ADD CONSTRAINT UQ_gym_schedule_ScheduleID UNIQUE (ScheduleID);
        END
      `);

      const bookingExists = await exec("SELECT OBJECT_ID('dbo.gym_booking', 'U') AS id;");
      if (!bookingExists?.recordset?.[0]?.id) {
        await exec(`
          CREATE TABLE dbo.gym_booking (
            BookingID INT IDENTITY(1,1) PRIMARY KEY,
            EmployeeID VARCHAR(20) NOT NULL,
            CardNo VARCHAR(50) NULL,
            EmployeeName VARCHAR(100) NOT NULL,
            Department VARCHAR(100) NOT NULL,
            Gender VARCHAR(10) NOT NULL,
            SessionName VARCHAR(50) NOT NULL,
            ScheduleID INT NOT NULL,
            BookingDate DATE NOT NULL,
            Status VARCHAR(20) NOT NULL
              CONSTRAINT CK_gym_booking_Status
              CHECK (Status IN ('BOOKED','CHECKIN','COMPLETED','CANCELLED','EXPIRED')),
            ApprovalStatus VARCHAR(20) NOT NULL
              CONSTRAINT DF_gym_booking_ApprovalDefault DEFAULT ('PENDING')
              CONSTRAINT CK_gym_booking_ApprovalStatus CHECK (ApprovalStatus IN ('PENDING','APPROVED','REJECTED')),
            ApprovedBy VARCHAR(50) NULL,
            ApprovedAt DATETIME NULL,
            RejectedReason VARCHAR(255) NULL,
            CreatedAt DATETIME NOT NULL
              CONSTRAINT DF_gym_booking_CreatedAt DEFAULT GETDATE(),
            CONSTRAINT FK_gym_booking_schedule
              FOREIGN KEY (ScheduleID)
              REFERENCES dbo.gym_schedule(ScheduleID)
          );
        `);
      } else {
        const columnsRaw = await exec(`
          SELECT c.name
          FROM sys.columns c
          WHERE c.object_id = OBJECT_ID('dbo.gym_booking')
        `);
        const columnNames = new Set((columnsRaw?.recordset || []).map((r) => String(r.name)));
        const findColumn = (target) => {
          const lower = String(target).toLowerCase();
          for (const name of columnNames) {
            if (String(name).toLowerCase() === lower) return name;
          }
          return null;
        };

        if (!findColumn('ApprovedBy')) {
          await exec('ALTER TABLE dbo.gym_booking ADD ApprovedBy VARCHAR(50) NULL;');
        }
        if (!findColumn('ApprovedAt')) {
          await exec('ALTER TABLE dbo.gym_booking ADD ApprovedAt DATETIME NULL;');
        }
        if (!findColumn('RejectedReason')) {
          await exec('ALTER TABLE dbo.gym_booking ADD RejectedReason VARCHAR(255) NULL;');
        }

        const approvalCol = findColumn('ApprovalStatus');
        if (!approvalCol) {
          await exec('ALTER TABLE dbo.gym_booking ADD ApprovalStatus VARCHAR(20) NULL;');
          await exec("UPDATE dbo.gym_booking SET ApprovalStatus = 'PENDING' WHERE ApprovalStatus IS NULL;");
          await exec('ALTER TABLE dbo.gym_booking ALTER COLUMN ApprovalStatus VARCHAR(20) NOT NULL;');
        }
        const approvalColName = findColumn('ApprovalStatus') || 'ApprovalStatus';

        await exec(`
          IF NOT EXISTS (
            SELECT 1
            FROM sys.default_constraints
            WHERE name = 'DF_gym_booking_ApprovalDefault'
              AND parent_object_id = OBJECT_ID('dbo.gym_booking')
          )
          BEGIN
            ALTER TABLE dbo.gym_booking
              ADD CONSTRAINT DF_gym_booking_ApprovalDefault
              DEFAULT ('PENDING') FOR [${approvalColName}];
          END
        `);

        await exec(`
          IF NOT EXISTS (
            SELECT 1
            FROM sys.check_constraints
            WHERE name = 'CK_gym_booking_Status'
              AND parent_object_id = OBJECT_ID('dbo.gym_booking')
          )
          BEGIN
            ALTER TABLE dbo.gym_booking
              ADD CONSTRAINT CK_gym_booking_Status
              CHECK ([Status] IN ('BOOKED','CHECKIN','COMPLETED','CANCELLED','EXPIRED'));
          END
        `);

        await exec(`
          IF NOT EXISTS (
            SELECT 1
            FROM sys.check_constraints
            WHERE name = 'CK_gym_booking_ApprovalStatus'
              AND parent_object_id = OBJECT_ID('dbo.gym_booking')
          )
          BEGIN
            ALTER TABLE dbo.gym_booking
              ADD CONSTRAINT CK_gym_booking_ApprovalStatus
              CHECK ([${approvalColName}] IN ('PENDING','APPROVED','REJECTED'));
          END
        `);

        await exec(`
          IF NOT EXISTS (
            SELECT 1
            FROM sys.foreign_keys
            WHERE name = 'FK_gym_booking_schedule'
              AND parent_object_id = OBJECT_ID('dbo.gym_booking')
          )
          BEGIN
            ALTER TABLE dbo.gym_booking
              ADD CONSTRAINT FK_gym_booking_schedule
              FOREIGN KEY (ScheduleID) REFERENCES dbo.gym_schedule(ScheduleID);
          END
        `);
      }

      const idxExists = await exec(`
        SELECT 1 AS ok
        FROM sys.indexes
        WHERE name = 'UX_gym_booking_one_per_day'
          AND object_id = OBJECT_ID('dbo.gym_booking')
      `);

      if (!(idxExists?.recordset || []).length) {
        const dupResult = await exec(`
          SELECT TOP 20 EmployeeID, BookingDate, COUNT(*) AS cnt
          FROM dbo.gym_booking
          WHERE Status IN ('BOOKED','CHECKIN')
          GROUP BY EmployeeID, BookingDate
          HAVING COUNT(*) > 1
          ORDER BY cnt DESC
        `);
        duplicates = Array.isArray(dupResult?.recordset) ? dupResult.recordset : [];
        if (duplicates.length > 0) {
          throw new Error('Duplicate active bookings exist; cannot create unique index UX_gym_booking_one_per_day');
        }

        await exec(`
          CREATE UNIQUE INDEX UX_gym_booking_one_per_day
          ON dbo.gym_booking (EmployeeID, BookingDate)
          WHERE Status IN ('BOOKED','CHECKIN')
        `);
      }

      const todayIdxExists = await exec(`
        SELECT 1 AS ok
        FROM sys.indexes
        WHERE name = 'IX_gym_booking_today'
          AND object_id = OBJECT_ID('dbo.gym_booking')
      `);

      if (!(todayIdxExists?.recordset || []).length) {
        await exec(`
          CREATE INDEX IX_gym_booking_today
          ON dbo.gym_booking (BookingDate, ApprovalStatus, Status)
          INCLUDE (EmployeeName, Department, SessionName)
        `);
      }

      await tx.commit();
    } catch (e) {
      try {
        await tx.rollback();
      } catch (_) {
      }
      throw e;
    }

    const schemaResult = await pool.request().query(`
      SELECT
        COLUMN_NAME AS name,
        DATA_TYPE AS type,
        IS_NULLABLE AS is_nullable
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'gym_booking'
      ORDER BY ORDINAL_POSITION
    `);

    const indexResult = await pool.request().query(`
      SELECT 1 AS ok
      FROM sys.indexes
      WHERE name = 'UX_gym_booking_one_per_day'
        AND object_id = OBJECT_ID('dbo.gym_booking')
    `);

    const todayIndexResult = await pool.request().query(`
      SELECT 1 AS ok
      FROM sys.indexes
      WHERE name = 'IX_gym_booking_today'
        AND object_id = OBJECT_ID('dbo.gym_booking')
    `);

    await pool.close();
    const columns = Array.isArray(schemaResult?.recordset) ? schemaResult.recordset : [];
    const index_ok = Array.isArray(indexResult?.recordset) && indexResult.recordset.length > 0;
    const index_today_ok = Array.isArray(todayIndexResult?.recordset) && todayIndexResult.recordset.length > 0;
    return res.json({ ok: true, columns, index_ok, index_today_ok });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message, duplicates });
  }
});

const PORT = process.env.PORT || 5055;
app.listen(PORT, () => {
  console.log(`DB tester listening on http://localhost:${PORT}`);
});
