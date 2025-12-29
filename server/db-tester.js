import express from 'express';
import cors from 'cors';
import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

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

  if (!MASTER_DB_SERVER || !MASTER_DB_DATABASE || !MASTER_DB_USER || !MASTER_DB_PASSWORD) {
    return res.status(500).json({ success: false, error: 'Master DB env is not configured' });
  }

  const config = {
    server: MASTER_DB_SERVER,
    port: Number(MASTER_DB_PORT || 1433),
    database: MASTER_DB_DATABASE,
    user: MASTER_DB_USER,
    password: MASTER_DB_PASSWORD,
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

const PORT = process.env.PORT || 5055;
app.listen(PORT, () => {
  console.log(`DB tester listening on http://localhost:${PORT}`);
});
