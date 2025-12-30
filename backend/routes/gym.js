import express from 'express';
import sql from 'mssql';
import bcrypt from 'bcryptjs';
import { envTrim, envBool } from '../lib/env.js';

const router = express.Router();

router.get('/env-dump', (req, res) => {
  const out = {
    CARD_DB_TX_TABLE: envTrim(process.env.CARD_DB_TX_TABLE),
    CARD_DB_TX_SCHEMA: envTrim(process.env.CARD_DB_TX_SCHEMA),
    CARDDB_SCHEMA: envTrim(process.env.CARDDB_SCHEMA),
    CARDDB_SERVER: envTrim(process.env.CARDDB_SERVER),
    CARDDB_NAME: envTrim(process.env.CARDDB_NAME),
  };
  res.json({ ok: true, env: out });
});

router.get('/gym-availability', async (req, res) => {
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
      encrypt: envBool(DB_ENCRYPT, false),
      trustServerCertificate: envBool(DB_TRUST_SERVER_CERTIFICATE, true),
    },
    pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
  };

  const DEFAULT_QUOTA = 15;

  try {
    const pool = await sql.connect(config);
    const request = pool.request();
    request.input('dateParam', sql.Date, new Date(dateStr));
    const result = await request.query(
      "SELECT CONVERT(varchar(5), gs.StartTime, 108) AS hhmm, ISNULL(gs.Quota, 15) AS quota, COUNT(gb.BookingID) AS booked_count FROM dbo.gym_schedule gs LEFT JOIN dbo.gym_booking gb ON gb.ScheduleID = gs.ScheduleID AND gb.BookingDate = @dateParam AND gb.Status IN ('BOOKED','CHECKIN') GROUP BY CONVERT(varchar(5), gs.StartTime, 108), ISNULL(gs.Quota, 15) ORDER BY hhmm"
    );
    await pool.close();

    const rows = Array.isArray(result?.recordset) ? result.recordset : [];

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
      const quota = r.quota != null ? Number(r.quota) : DEFAULT_QUOTA;
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

router.get('/gym-sessions', async (req, res) => {
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
    const missing_env = [
      !DB_SERVER ? 'DB_SERVER' : null,
      !DB_DATABASE ? 'DB_DATABASE' : null,
      !DB_USER ? 'DB_USER' : null,
      !DB_PASSWORD ? 'DB_PASSWORD' : null,
    ].filter(Boolean);
    return res.status(200).json({ ok: false, error: 'Gym DB env is not configured', sessions: [], missing_env });
  }

  const config = {
    server: DB_SERVER,
    port: Number(DB_PORT || 1433),
    database: DB_DATABASE,
    user: DB_USER,
    password: DB_PASSWORD,
    options: {
      encrypt: envBool(DB_ENCRYPT, false),
      trustServerCertificate: envBool(DB_TRUST_SERVER_CERTIFICATE, true),
    },
    pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
  };

  const DEFAULT_QUOTA = 15;

  try {
    const pool = await sql.connect(config);
    const request = pool.request();
    const result = await request.query(
      "SELECT Session AS session_name, CONVERT(varchar(5), StartTime, 108) AS time_start, CONVERT(varchar(5), EndTime, 108) AS time_end, Quota AS quota FROM dbo.gym_schedule ORDER BY StartTime"
    );
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

router.post('/gym-session-create', async (req, res) => {
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
      encrypt: envBool(DB_ENCRYPT, false),
      trustServerCertificate: envBool(DB_TRUST_SERVER_CERTIFICATE, true),
    },
    pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
  };

  try {
    const pool = await sql.connect(config);
    const request = pool.request();
    const columnsCheck = await request.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'gym_schedule' AND COLUMN_NAME IN ('Session','StartTime','EndTime','Quota')"
    );
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
    await request.query(
      'INSERT INTO dbo.gym_schedule (Session, StartTime, EndTime, Quota) VALUES (@session_name, CAST(@time_start AS time(0)), CAST(@time_end AS time(0)), @quota)'
    );
    await pool.close();
    return res.json({ ok: true });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message });
  }
});

router.post('/gym-session-update', async (req, res) => {
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
      encrypt: envBool(DB_ENCRYPT, false),
      trustServerCertificate: envBool(DB_TRUST_SERVER_CERTIFICATE, true),
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

    const result = await request.query(
      'UPDATE dbo.gym_schedule SET Session = @session_name, StartTime = CAST(@time_start AS time(0)), EndTime = CAST(@time_end AS time(0)), Quota = @quota WHERE Session = @original_session_name AND StartTime = CAST(@original_time_start AS time(0))'
    );

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

router.post('/gym-session-delete', async (req, res) => {
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
      encrypt: envBool(DB_ENCRYPT, false),
      trustServerCertificate: envBool(DB_TRUST_SERVER_CERTIFICATE, true),
    },
    pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
  };

  try {
    const pool = await sql.connect(config);
    const request = pool.request();
    request.input('session_name', sql.VarChar(20), String(session_name));
    request.input('time_start', sql.VarChar(5), String(time_start));

    const result = await request.query(
      'DELETE FROM dbo.gym_schedule WHERE Session = @session_name AND StartTime = CAST(@time_start AS time(0))'
    );

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

router.post('/gym-schedule-create', async (req, res) => {
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
      encrypt: envBool(DB_ENCRYPT, false),
      trustServerCertificate: envBool(DB_TRUST_SERVER_CERTIFICATE, true),
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

    const queryWithUser = `INSERT INTO dbo.gym_schedule (${gym_user_id ? 'gym_user_id,' : ''} schedule_time, status) VALUES (${gym_user_id ? '@gym_user_id,' : ''} @schedule_time, @status)`;

    try {
      await request.query(queryWithUser);
    } catch (err) {
      if (gym_user_id) {
        const request2 = pool.request();
        request2.input('schedule_time', sql.DateTime, scheduleDate);
        request2.input('status', sql.VarChar(20), status);
        await request2.query('INSERT INTO dbo.gym_schedule (schedule_time, status) VALUES (@schedule_time, @status)');
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

router.get('/gym-bookings', async (req, res) => {
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
      encrypt: envBool(DB_ENCRYPT, false),
      trustServerCertificate: envBool(DB_TRUST_SERVER_CERTIFICATE, true),
    },
    pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
  };

  try {
    const pool = await sql.connect(config);
    const request = pool.request();
    request.input('fromDate', sql.Date, new Date(from));
    request.input('toDate', sql.Date, new Date(to));

    const result = await request.query(
      `SELECT
        gb.BookingID AS booking_id,
        gb.EmployeeID AS employee_id,
        COALESCE(cd.CardNo, gb.CardNo) AS card_no,
        ec.name AS employee_name,
        COALESCE(ee.department, gb.Department, cd.Department) AS department,
        ec.gender AS gender,
        gb.SessionName AS session_name,
        gb.ScheduleID AS schedule_id,
        CONVERT(varchar(10), gb.BookingDate, 23) AS booking_date,
        gb.Status AS status,
        gb.ApprovalStatus AS approval_status,
        gb.CreatedAt AS created_at,
        CONVERT(varchar(5), s.StartTime, 108) AS time_start,
        CONVERT(varchar(5), s.EndTime, 108) AS time_end
      FROM dbo.gym_booking gb
      LEFT JOIN dbo.gym_schedule s
        ON s.ScheduleID = gb.ScheduleID
      LEFT JOIN MTIMasterEmployeeDB.dbo.employee_core ec
        ON gb.EmployeeID = ec.employee_id
      LEFT JOIN MTIMasterEmployeeDB.dbo.employee_employment ee
        ON gb.EmployeeID = ee.employee_id
        AND ee.status = 'ACTIVE'
      OUTER APPLY (
        SELECT TOP 1 c.*
        FROM DataDBEnt.dbo.CardDB c
        WHERE c.StaffNo = gb.EmployeeID
          AND c.Status = 1
          AND (c.Block IS NULL OR c.Block = 0)
          AND c.del_state = 0
      ) cd
      WHERE gb.BookingDate >= @fromDate
        AND gb.BookingDate <= @toDate
        AND gb.Status IN ('BOOKED','CHECKIN','COMPLETED')
      ORDER BY gb.BookingDate ASC, time_start ASC, gb.CreatedAt ASC`
    );
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

router.post('/gym-booking-update-status', async (req, res) => {
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

  const { booking_id, approval_status } = req.body || {};
  if (!booking_id || !approval_status) {
    return res.status(400).json({ ok: false, error: 'booking_id and approval_status are required' });
  }

  const validStatuses = ['APPROVED', 'REJECTED', 'PENDING'];
  const statusUpper = String(approval_status).toUpperCase();
  if (!validStatuses.includes(statusUpper)) {
    return res.status(400).json({ ok: false, error: 'Invalid approval_status' });
  }

  const config = {
    server: DB_SERVER,
    port: Number(DB_PORT || 1433),
    database: DB_DATABASE,
    user: DB_USER,
    password: DB_PASSWORD,
    options: {
      encrypt: envBool(DB_ENCRYPT, false),
      trustServerCertificate: envBool(DB_TRUST_SERVER_CERTIFICATE, true),
    },
    pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
  };

  try {
    const pool = await sql.connect(config);
    const request = pool.request();
    request.input('booking_id', sql.Int, Number(booking_id));
    request.input('approval_status', sql.VarChar(20), statusUpper);

    const result = await request.query(
      'UPDATE dbo.gym_booking SET ApprovalStatus = @approval_status WHERE BookingID = @booking_id'
    );

    await pool.close();

    const affected = Array.isArray(result?.rowsAffected) ? Number(result.rowsAffected[0] || 0) : 0;
    if (affected < 1) {
      return res.status(200).json({ ok: false, error: 'Booking not found or not updated' });
    }

    return res.json({ ok: true, affected });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message });
  }
});

router.post('/gym-booking-backfill-cardno', async (req, res) => {
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

  const config = {
    server: DB_SERVER,
    port: Number(DB_PORT || 1433),
    database: DB_DATABASE,
    user: DB_USER,
    password: DB_PASSWORD,
    options: {
      encrypt: envBool(DB_ENCRYPT, false),
      trustServerCertificate: envBool(DB_TRUST_SERVER_CERTIFICATE, true),
    },
    pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
  };

  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(
      `UPDATE gb
       SET gb.CardNo = cd.CardNo
       FROM dbo.gym_booking gb
       OUTER APPLY (
         SELECT TOP 1 c.CardNo
         FROM DataDBEnt.dbo.CardDB c
         WHERE c.StaffNo = gb.EmployeeID
           AND c.Status = 1
           AND (c.Block IS NULL OR c.Block = 0)
           AND c.del_state = 1
       ) cd
       WHERE gb.CardNo IS NULL AND cd.CardNo IS NOT NULL`
    );
    await pool.close();

    const affected = Array.isArray(result?.rowsAffected) ? Number(result.rowsAffected[0] || 0) : 0;
    return res.json({ ok: true, affected });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message });
  }
});

router.post('/gym-booking-create', async (req, res) => {
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
    CARDDB_SERVER,
    CARDDB_PORT,
    CARDDB_NAME,
    CARDDB_USER,
    CARDDB_PASSWORD,
    CARDDB_ENCRYPT,
    CARDDB_TRUST_SERVER_CERTIFICATE,
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
    return res.status(400).json({ ok: false, error: 'employee_id (body or x-employee-id header), session_id, booking_date are required' });
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
      encrypt: envBool(DB_ENCRYPT, false),
      trustServerCertificate: envBool(DB_TRUST_SERVER_CERTIFICATE, true),
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

  const pickSchemaForTable = async (pool, tableName) => {
    const safe = String(tableName || '').trim();
    if (!/^[A-Za-z0-9_]+$/.test(safe)) return null;
    const req = pool.request();
    req.input('tableName', sql.VarChar(128), safe);
    const r = await req.query(
      'SELECT TOP 1 TABLE_SCHEMA AS schema_name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @tableName ORDER BY CASE WHEN TABLE_SCHEMA = \'dbo\' THEN 0 ELSE 1 END, TABLE_SCHEMA'
    );
    const schemaName = r?.recordset?.[0]?.schema_name ? String(r.recordset[0].schema_name) : null;
    return schemaName && schemaName.trim().length > 0 ? schemaName : null;
  };

  const tryLoadActiveCardNo = async (empId) => {
    const cardServer = envTrim(CARD_DB_SERVER) || envTrim(CARDDB_SERVER);
    const cardDatabase = envTrim(CARD_DB_DATABASE) || envTrim(CARDDB_NAME);
    const cardUser = envTrim(CARD_DB_USER) || envTrim(CARDDB_USER);
    const cardPassword = envTrim(CARD_DB_PASSWORD) || envTrim(CARDDB_PASSWORD);

    if (!cardServer || !cardDatabase || !cardUser || !cardPassword) return null;

    const cardConfig = {
      server: cardServer,
      port: Number(CARD_DB_PORT || CARDDB_PORT || 1433),
      database: cardDatabase,
      user: cardUser,
      password: cardPassword,
      options: {
        encrypt: envBool(CARD_DB_ENCRYPT, false) || envBool(CARDDB_ENCRYPT, false),
        trustServerCertificate: envBool(CARD_DB_TRUST_SERVER_CERTIFICATE, true) || envBool(CARDDB_TRUST_SERVER_CERTIFICATE, true),
      },
      pool: { max: 1, min: 0, idleTimeoutMillis: 5000 },
    };

    const tableCandidates = ['CardDB', 'employee_card', 'employee_cards', 'cards', 'card'];

    let pool;
    try {
      pool = await sql.connect(cardConfig);
      const tableResult = await pool.request().query(
        `SELECT TOP 1 TABLE_SCHEMA AS schema_name, TABLE_NAME AS table_name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME IN (${tableCandidates.map((t) => `'${t}'`).join(', ')}) ORDER BY CASE WHEN TABLE_SCHEMA = 'dbo' THEN 0 ELSE 1 END, TABLE_SCHEMA`
      );
      const row = tableResult?.recordset?.[0] || null;
      if (!row?.schema_name || !row?.table_name) {
        await pool.close();
        return null;
      }

      const schema = String(row.schema_name);
      const table = String(row.table_name);

      const colsResult = await pool.request().query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = '${schema.replace(/'/g, "''")}' AND TABLE_NAME = '${table.replace(/'/g, "''")}'`
      );
      const cols = (colsResult?.recordset || []).map((r) => String(r.COLUMN_NAME));
      const empCol = pickColumn(cols, ['employee_id', 'EmployeeID', 'emp_id', 'EmpID', 'StaffNo', 'staff_no']);
      const cardCol = pickColumn(cols, ['card_no', 'CardNo', 'card_number', 'CardNumber', 'id_card', 'IDCard']);
      const activeCol = pickColumn(cols, ['is_active', 'IsActive', 'active', 'Active', 'status', 'Status']);
      const delStateCol = pickColumn(cols, ['del_state', 'DelState']);
      const blockCol = pickColumn(cols, ['block', 'Block', 'is_blocked', 'IsBlocked']);

      if (!empCol || !cardCol) {
        await pool.close();
        return null;
      }

      const req2 = pool.request();
      req2.input('id', sql.VarChar(100), String(empId));

      const delStateWhere = delStateCol ? `AND ([${delStateCol}] = 0 OR [${delStateCol}] IS NULL)` : '';
      const blockWhere = blockCol ? `AND ([${blockCol}] IS NULL OR [${blockCol}] = 0 OR UPPER(CAST([${blockCol}] AS varchar(50))) IN ('UNBLOCK','FALSE','0'))` : '';
      const orderBy = activeCol
        ? `ORDER BY CASE WHEN ([${activeCol}] = 1 OR UPPER(CAST([${activeCol}] AS varchar(50))) IN ('ACTIVE','AKTIF','1','TRUE')) THEN 0 ELSE 1 END`
        : '';

      const cardResult = await req2.query(
        `SELECT TOP 1 [${cardCol}] AS card_no FROM [${schema}].[${table}] WHERE [${empCol}] = @id ${delStateWhere} ${blockWhere} ${orderBy}`
      );
      await pool.close();

      const cardNo = cardResult?.recordset?.[0]?.card_no;
      return cardNo != null ? String(cardNo).trim() : null;
    } catch (_) {
      try {
        if (pool) await pool.close();
      } catch (_) {}
      return null;
    }
  };

  try {
    const bookingDate = new Date(bookingDateStr);
    if (isNaN(bookingDate.getTime())) throw new Error('Invalid booking_date');

    const gymPool = await new sql.ConnectionPool(gymConfig).connect();
    const scheduleReq = gymPool.request();
    scheduleReq.input('session_name', sql.VarChar(50), sessionName);
    scheduleReq.input('time_start', sql.VarChar(5), timeStart);
    const scheduleResult = await scheduleReq.query(
      "SELECT TOP 1 ScheduleID AS schedule_id, Quota AS quota FROM dbo.gym_schedule WHERE Session = @session_name AND StartTime = CAST(@time_start AS time(0))"
    );

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
    const dupResult = await dupReq.query(
      "SELECT COUNT(*) AS cnt FROM dbo.gym_booking WHERE EmployeeID = @employee_id AND BookingDate = @booking_date AND Status IN ('BOOKED','CHECKIN')"
    );
    const duplicateCount = Number(dupResult?.recordset?.[0]?.cnt || 0);
    if (duplicateCount > 0) {
      await gymPool.close();
      return res.status(200).json({ ok: false, error: 'You are already registered for this day' });
    }

    const quotaReq = gymPool.request();
    quotaReq.input('schedule_id', sql.Int, scheduleId);
    quotaReq.input('booking_date', sql.Date, bookingDate);
    const quotaResult = await quotaReq.query(
      "SELECT COUNT(*) AS cnt FROM dbo.gym_booking WHERE ScheduleID = @schedule_id AND BookingDate = @booking_date AND Status IN ('BOOKED','CHECKIN')"
    );
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

    const columnsResult = await masterPool.request().query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'employee_core' AND TABLE_SCHEMA = '${coreSchema.replace(/'/g, "''")}'`
    );
    const columns = (columnsResult?.recordset || []).map((r) => String(r.COLUMN_NAME));

    const employeeIdCol = pickColumn(columns, ['employee_id', 'Employee ID', 'employeeid', 'EmployeeID', 'emp_id', 'EmpID']);
    const nameCol = pickColumn(columns, ['name', 'Name', 'employee_name', 'Employee Name', 'full_name', 'FullName']);
    const deptCol = pickColumn(columns, ['department', 'Department', 'dept', 'Dept', 'dept_name', 'DeptName']);
    const cardCol = pickColumn(columns, ['id_card', 'ID Card', 'IDCard', 'card_no', 'Card No', 'CardNo']);
    const staffNoCol = pickColumn(columns, ['staff_no', 'StaffNo', 'employee_no', 'EmployeeNo']);
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
      staffNoCol ? `[${staffNoCol}] AS staff_no` : `CAST(NULL AS varchar(255)) AS staff_no`,
      genderCol ? `[${genderCol}] AS gender` : `CAST(NULL AS varchar(50)) AS gender`,
    ].join(',\n        ');

    const empReq = masterPool.request();
    empReq.input('id', sql.VarChar(100), employeeId);
    const empResult = await empReq.query(
      `SELECT TOP 1 ${selectCols} FROM [${coreSchema}].[employee_core] WHERE [${employeeIdCol}] = @id`
    );

    const empRow = Array.isArray(empResult?.recordset) ? empResult.recordset[0] : null;
    if (!empRow) {
      await masterPool.close();
      return res.status(200).json({ ok: false, error: 'Employee not found' });
    }

    let department = empRow.department != null ? String(empRow.department).trim() : '';
    const employmentSchema = await pickSchemaForTable(masterPool, 'employee_employment');
    if (employmentSchema) {
      const empColsResult = await masterPool.request().query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'employee_employment' AND TABLE_SCHEMA = '${employmentSchema.replace(/'/g, "''")}'`
      );
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
        const deptResult = await empReq2.query(
          `SELECT TOP 1 [${deptCol2}] AS department FROM [${employmentSchema}].[employee_employment] WHERE [${empIdCol2}] = @id ${orderBy}`
        );
        const deptRow = Array.isArray(deptResult?.recordset) ? deptResult.recordset[0] : null;
        if (deptRow?.department != null && String(deptRow.department).trim()) {
          department = String(deptRow.department).trim();
        }
      }
    }

    await masterPool.close();

    const employeeName = String(empRow.name ?? '').trim();
    const cardNoMaster = empRow.card_no != null ? String(empRow.card_no).trim() : null;
    const staffIdForCard = empRow.staff_no != null && String(empRow.staff_no).trim().length > 0
      ? String(empRow.staff_no).trim()
      : employeeId;
    const cardNoCardDbPrimary = await tryLoadActiveCardNo(staffIdForCard);
    const cardNoCardDbFallback = cardNoCardDbPrimary != null ? null : await tryLoadActiveCardNo(employeeId);
    const cardNo = (cardNoCardDbPrimary || cardNoCardDbFallback) ?? cardNoMaster;
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

    const insertResult = await insertReq.query(
      'INSERT INTO dbo.gym_booking (EmployeeID, CardNo, EmployeeName, Department, Gender, SessionName, ScheduleID, BookingDate, Status) OUTPUT INSERTED.BookingID AS booking_id VALUES (@employee_id, @card_no, @employee_name, @department, @gender, @session_name, @schedule_id, @booking_date, \'BOOKED\')'
    );

    await gymPool2.close();
    const bookingId = Number(insertResult?.recordset?.[0]?.booking_id || 0);
    return res.json({ ok: true, booking_id: bookingId, schedule_id: scheduleId });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message });
  }
});

router.post('/gym-booking-init', async (req, res) => {
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
      encrypt: envBool(DB_ENCRYPT, false),
      trustServerCertificate: envBool(DB_TRUST_SERVER_CERTIFICATE, true),
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

      await exec(
        'IF COL_LENGTH(\'dbo.gym_schedule\', \'ScheduleID\') IS NULL BEGIN ALTER TABLE dbo.gym_schedule ADD ScheduleID INT IDENTITY(1,1) NOT NULL; END'
      );

      await exec(
        "IF NOT EXISTS (SELECT 1 FROM sys.key_constraints kc JOIN sys.tables t ON t.object_id = kc.parent_object_id WHERE kc.[type] = 'UQ' AND kc.name = 'UQ_gym_schedule_ScheduleID' AND t.name = 'gym_schedule' AND SCHEMA_NAME(t.schema_id) = 'dbo') BEGIN ALTER TABLE dbo.gym_schedule ADD CONSTRAINT UQ_gym_schedule_ScheduleID UNIQUE (ScheduleID); END"
      );

      const bookingExists = await exec("SELECT OBJECT_ID('dbo.gym_booking', 'U') AS id;");
      if (!bookingExists?.recordset?.[0]?.id) {
        await exec(
          "CREATE TABLE dbo.gym_booking (BookingID INT IDENTITY(1,1) PRIMARY KEY, EmployeeID VARCHAR(20) NOT NULL, CardNo VARCHAR(50) NULL, EmployeeName VARCHAR(100) NOT NULL, Department VARCHAR(100) NOT NULL, Gender VARCHAR(10) NOT NULL, SessionName VARCHAR(50) NOT NULL, ScheduleID INT NOT NULL, BookingDate DATE NOT NULL, Status VARCHAR(20) NOT NULL CONSTRAINT CK_gym_booking_Status CHECK (Status IN ('BOOKED','CHECKIN','COMPLETED','CANCELLED','EXPIRED')), ApprovalStatus VARCHAR(20) NOT NULL CONSTRAINT DF_gym_booking_ApprovalDefault DEFAULT ('PENDING') CONSTRAINT CK_gym_booking_ApprovalStatus CHECK (ApprovalStatus IN ('PENDING','APPROVED','REJECTED')), ApprovedBy VARCHAR(50) NULL, ApprovedAt DATETIME NULL, RejectedReason VARCHAR(255) NULL, CreatedAt DATETIME NOT NULL CONSTRAINT DF_gym_booking_CreatedAt DEFAULT GETDATE(), CONSTRAINT FK_gym_booking_schedule FOREIGN KEY (ScheduleID) REFERENCES dbo.gym_schedule(ScheduleID));"
        );
      } else {
        const columnsRaw = await exec(
          "SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.gym_booking')"
        );
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

        await exec(
          `IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_gym_booking_ApprovalDefault' AND parent_object_id = OBJECT_ID('dbo.gym_booking')) BEGIN ALTER TABLE dbo.gym_booking ADD CONSTRAINT DF_gym_booking_ApprovalDefault DEFAULT ('PENDING') FOR [${approvalColName}]; END`
        );

        await exec(
          "IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_gym_booking_Status' AND parent_object_id = OBJECT_ID('dbo.gym_booking')) BEGIN ALTER TABLE dbo.gym_booking ADD CONSTRAINT CK_gym_booking_Status CHECK ([Status] IN ('BOOKED','CHECKIN','COMPLETED','CANCELLED','EXPIRED')); END"
        );

        await exec(
          "IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_gym_booking_ApprovalStatus' AND parent_object_id = OBJECT_ID('dbo.gym_booking')) BEGIN ALTER TABLE dbo.gym_booking ADD CONSTRAINT CK_gym_booking_ApprovalStatus CHECK ([" + approvalColName + "] IN ('PENDING','APPROVED','REJECTED')); END"
        );

        await exec(
          "IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_gym_booking_schedule' AND parent_object_id = OBJECT_ID('dbo.gym_booking')) BEGIN ALTER TABLE dbo.gym_booking ADD CONSTRAINT FK_gym_booking_schedule FOREIGN KEY (ScheduleID) REFERENCES dbo.gym_schedule(ScheduleID); END"
        );
      }

      const idxExists = await exec(
        "SELECT 1 AS ok FROM sys.indexes WHERE name = 'UX_gym_booking_one_per_day' AND object_id = OBJECT_ID('dbo.gym_booking')"
      );

      if (!(idxExists?.recordset || []).length) {
        const dupResult = await exec(
          "SELECT TOP 20 EmployeeID, BookingDate, COUNT(*) AS cnt FROM dbo.gym_booking WHERE Status IN ('BOOKED','CHECKIN') GROUP BY EmployeeID, BookingDate HAVING COUNT(*) > 1 ORDER BY cnt DESC"
        );
        duplicates = Array.isArray(dupResult?.recordset) ? dupResult.recordset : [];
        if (duplicates.length > 0) {
          throw new Error('Duplicate active bookings exist; cannot create unique index UX_gym_booking_one_per_day');
        }

        await exec(
          "CREATE UNIQUE INDEX UX_gym_booking_one_per_day ON dbo.gym_booking (EmployeeID, BookingDate) WHERE Status IN ('BOOKED','CHECKIN')"
        );
      }

      const todayIdxExists = await exec(
        "SELECT 1 AS ok FROM sys.indexes WHERE name = 'IX_gym_booking_today' AND object_id = OBJECT_ID('dbo.gym_booking')"
      );

      if (!(todayIdxExists?.recordset || []).length) {
        await exec(
          "CREATE INDEX IX_gym_booking_today ON dbo.gym_booking (BookingDate, ApprovalStatus, Status) INCLUDE (EmployeeName, Department, SessionName)"
        );
      }

      await tx.commit();
    } catch (e) {
      try {
        await tx.rollback();
      } catch (_) {}
      throw e;
    }

    const schemaResult = await pool.request().query(
      "SELECT COLUMN_NAME AS name, DATA_TYPE AS type, IS_NULLABLE AS is_nullable FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'gym_booking' ORDER BY ORDINAL_POSITION"
    );

    const indexResult = await pool.request().query(
      "SELECT 1 AS ok FROM sys.indexes WHERE name = 'UX_gym_booking_one_per_day' AND object_id = OBJECT_ID('dbo.gym_booking')"
    );

    const todayIndexResult = await pool.request().query(
      "SELECT 1 AS ok FROM sys.indexes WHERE name = 'IX_gym_booking_today' AND object_id = OBJECT_ID('dbo.gym_booking')"
    );

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

router.get('/gym-live-sync', async (req, res) => {
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
    CARDDB_SERVER,
    CARDDB_PORT,
    CARDDB_NAME,
    CARDDB_USER,
    CARDDB_PASSWORD,
    CARDDB_ENCRYPT,
    CARDDB_TRUST_SERVER_CERTIFICATE,
    CARD_DB_TX_TABLE,
    CARD_DB_TX_SCHEMA,
    CARD_DB_TX_TIME_COL,
    CARD_DB_TX_DEVICE_COL,
    CARD_DB_TX_CARD_COL,
    CARD_DB_TX_STAFF_COL,
    CARD_DB_TX_EVENT_COL,
    CARD_DB_TX_UNIT_COL,
  } = process.env;

  const gymServer = envTrim(DB_SERVER);
  const gymDatabase = envTrim(DB_DATABASE);
  const gymUser = envTrim(DB_USER);
  const gymPassword = envTrim(DB_PASSWORD);
  if (!gymServer || !gymDatabase || !gymUser || !gymPassword) {
    return res.status(500).json({ ok: false, error: 'Gym DB env is not configured' });
  }

  const gymConfig = {
    server: gymServer,
    port: Number(DB_PORT || 1433),
    database: gymDatabase,
    user: gymUser,
    password: gymPassword,
    options: { encrypt: envBool(DB_ENCRYPT, false), trustServerCertificate: envBool(DB_TRUST_SERVER_CERTIFICATE, true) },
    pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
  };

  const masterServer = envTrim(MASTER_DB_SERVER);
  const masterDatabase = envTrim(MASTER_DB_DATABASE);
  const masterUser = envTrim(MASTER_DB_USER);
  const masterPassword = envTrim(MASTER_DB_PASSWORD);
  const masterConfig = masterServer && masterDatabase && masterUser && masterPassword
    ? {
        server: masterServer,
        port: Number(MASTER_DB_PORT || 1433),
        database: masterDatabase,
        user: masterUser,
        password: masterPassword,
        options: { encrypt: envBool(MASTER_DB_ENCRYPT, false), trustServerCertificate: envBool(MASTER_DB_TRUST_SERVER_CERTIFICATE, true) },
        pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
      }
    : null;

  const cardServer = envTrim(CARD_DB_SERVER) || envTrim(CARDDB_SERVER);
  const cardDatabase = envTrim(CARD_DB_DATABASE) || envTrim(CARDDB_NAME);
  const cardUser = envTrim(CARD_DB_USER) || envTrim(CARDDB_USER);
  const cardPassword = envTrim(CARD_DB_PASSWORD) || envTrim(CARDDB_PASSWORD);
  if (!cardServer || !cardDatabase || !cardUser || !cardPassword) {
    return res.status(500).json({ ok: false, error: 'CardDB env is not configured' });
  }

  const cardConfig = {
    server: cardServer,
    port: Number(CARD_DB_PORT || CARDDB_PORT || 1433),
    database: cardDatabase,
    user: cardUser,
    password: cardPassword,
    options: { encrypt: envBool(CARD_DB_ENCRYPT, false) || envBool(CARDDB_ENCRYPT, false), trustServerCertificate: envBool(CARD_DB_TRUST_SERVER_CERTIFICATE, true) || envBool(CARDDB_TRUST_SERVER_CERTIFICATE, true) },
    pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
  };

  const sinceStr = String(req.query.since || '').trim();
  const limit = Number(String(req.query.limit || '200'));
  const maxRows = Number.isFinite(limit) && limit > 0 && limit <= 1000 ? limit : 200;

  const pickColumn = (columns, candidates) => {
    const map = new Map(columns.map((c) => [String(c).toLowerCase(), String(c)]));
    for (const cand of candidates) {
      const hit = map.get(String(cand).toLowerCase());
      if (hit) return hit;
    }
    return null;
  };

  const discoverSource = async (pool) => {
    const explicitTable = envTrim(CARD_DB_TX_TABLE);
    const explicitSchema = envTrim(CARD_DB_TX_SCHEMA) || 'dbo';
    const explicitTime = envTrim(CARD_DB_TX_TIME_COL);
    const explicitDevice = envTrim(CARD_DB_TX_DEVICE_COL);
    const explicitCard = envTrim(CARD_DB_TX_CARD_COL);
    const explicitStaff = envTrim(CARD_DB_TX_STAFF_COL);
    const explicitEvent = envTrim(CARD_DB_TX_EVENT_COL);
    const explicitUnit = envTrim(CARD_DB_TX_UNIT_COL);
    if (explicitTable) {
      const existsRes = await pool.request().query(`SELECT 1 AS ok FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='${explicitSchema.replace(/'/g,"''")}' AND TABLE_NAME='${explicitTable.replace(/'/g,"''")}'`);
      const exists = Array.isArray(existsRes?.recordset) && existsRes.recordset.length > 0;
      if (!exists) {
        
      } else {
      const colsRes = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='${explicitSchema.replace(/'/g,"''")}' AND TABLE_NAME='${explicitTable.replace(/'/g,"''")}'`);
      const cols = (colsRes?.recordset || []).map((x) => String(x.COLUMN_NAME));
      const timeCol = explicitTime ? pickColumn(cols, [explicitTime]) : pickColumn(cols, ['TrDateTime','TransDateTime','EventTime','LogTime','DateTime','Time','timestamp','datetime','TransTime']);
      const deviceCol = explicitDevice ? pickColumn(cols, [explicitDevice]) : pickColumn(cols, ['TrController','Device','Reader','Terminal','Door','DeviceName']);
      const cardCol = explicitCard ? pickColumn(cols, [explicitCard]) : pickColumn(cols, ['CardNo','TrCardID','CardNumber','Card','CardID','IDCard']);
      const staffCol = explicitStaff ? pickColumn(cols, [explicitStaff]) : pickColumn(cols, ['StaffNo','EmployeeID','EmpID','employee_id']);
      const eventCol = explicitEvent ? pickColumn(cols, [explicitEvent]) : pickColumn(cols, ['Transaction','Event','EventType','Status','Action','Result']);
      const nameCol = pickColumn(cols, ['TrName','Name','EmployeeName','EmpName','StaffName']);
      const controllerCol = pickColumn(cols, ['TrController','Controller','Device','Reader','Terminal','Door','DeviceName']);
      const unitCol = explicitUnit ? pickColumn(cols, [explicitUnit]) : pickColumn(cols, ['UnitNo','Unit','ControllerID','DeviceID','ReaderID','DeviceNo','ReaderNo']);
      const dateCol = pickColumn(cols, ['TrDate','Date','TransDate']);
      const timeOnlyCol = pickColumn(cols, ['TrTime','Time']);
      return { schema: explicitSchema, table: explicitTable, timeCol, deviceCol, cardCol, staffCol, eventCol, nameCol, controllerCol, unitCol, dateCol, timeOnlyCol };
      }
    }
    const candidates = ['tblTransaction','tblTransactionLive','Transaction','Transactions','AccessLog','EventLog','Logs','Attendance','History','CardTransaction'];
    const r = await pool.request().query(`SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' AND TABLE_NAME IN (${candidates.map((t)=>`'${t}'`).join(',')}) ORDER BY CASE WHEN TABLE_SCHEMA='dbo' THEN 0 ELSE 1 END, TABLE_SCHEMA, TABLE_NAME`);
    const rows = Array.isArray(r?.recordset) ? r.recordset : [];
    for (const row of rows) {
      const schema = String(row.TABLE_SCHEMA);
      const table = String(row.TABLE_NAME);
      const colsRes = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='${schema.replace(/'/g,"''")}' AND TABLE_NAME='${table.replace(/'/g,"''")}'`);
      const cols = (colsRes?.recordset || []).map((x) => String(x.COLUMN_NAME));
      const timeCol = pickColumn(cols, ['TrDateTime','TransDateTime','EventTime','LogTime','DateTime','timestamp','datetime','TransTime']);
      const deviceCol = pickColumn(cols, ['TrController','Device','Reader','Terminal','Door','DeviceName']);
      const cardCol = pickColumn(cols, ['CardNo','TrCardID','CardNumber','Card','CardID','IDCard']);
      const staffCol = pickColumn(cols, ['StaffNo','EmployeeID','EmpID','employee_id']);
      const eventCol = pickColumn(cols, ['Transaction','Event','EventType','Status','Action','Result']);
      const nameCol = pickColumn(cols, ['TrName','Name','EmployeeName','EmpName','StaffName']);
      const controllerCol = pickColumn(cols, ['TrController','Controller','Device','Reader','Terminal','Door','DeviceName']);
      const unitCol = pickColumn(cols, ['UnitNo','Unit','ControllerID','DeviceID','ReaderID','DeviceNo','ReaderNo']);
      const dateCol = pickColumn(cols, ['TrDate','Date','TransDate']);
      const timeOnlyCol = pickColumn(cols, ['TrTime','Time']);
      if (!timeCol && !(dateCol && timeOnlyCol)) continue;
      return { schema, table, timeCol, deviceCol, cardCol, staffCol, eventCol, nameCol, controllerCol, unitCol, dateCol, timeOnlyCol };
    }
    const defaultSchema = envTrim(process.env.CARD_DB_TX_SCHEMA) || envTrim(process.env.CARDDB_SCHEMA) || 'dbo';
    for (const table of ['tblTransactionLive','tblTransaction']) {
      const existsRes = await pool.request().query(`SELECT 1 AS ok FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='${defaultSchema.replace(/'/g,"''")}' AND TABLE_NAME='${table}'`);
      const exists = Array.isArray(existsRes?.recordset) && existsRes.recordset.length > 0;
      if (!exists) continue;
      const colsRes = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='${defaultSchema.replace(/'/g,"''")}' AND TABLE_NAME='${table}'`);
      const cols = (colsRes?.recordset || []).map((x) => String(x.COLUMN_NAME));
      const timeCol = pickColumn(cols, ['TrDateTime','TransDateTime','EventTime','LogTime','DateTime','Time','timestamp','datetime','TransTime']);
      if (!timeCol) continue;
      const deviceCol = pickColumn(cols, ['TrController','Device','Reader','Terminal','Door','DeviceName']);
      const cardCol = pickColumn(cols, ['CardNo','TrCardID','CardNumber','Card','CardID','IDCard']);
      const staffCol = pickColumn(cols, ['StaffNo','EmployeeID','EmpID','employee_id']);
      const eventCol = pickColumn(cols, ['Transaction','Event','EventType','Status','Action','Result']);
      const nameCol = pickColumn(cols, ['TrName','Name','EmployeeName','EmpName','StaffName']);
      const controllerCol = pickColumn(cols, ['TrController','Controller','Device','Reader','Terminal','Door','DeviceName']);
      const unitCol = pickColumn(cols, ['UnitNo','Unit','ControllerID','DeviceID','ReaderID','DeviceNo','ReaderNo']);
      return { schema: defaultSchema, table, timeCol, deviceCol, cardCol, staffCol, eventCol, nameCol, controllerCol, unitCol };
    }
    return null;
  };

  try {
    const gymPool = await sql.connect(gymConfig);
    const tx = new sql.Transaction(gymPool);
    await tx.begin();
    const exec = async (q) => tx.request().query(q);
    await exec('SET NOCOUNT ON;');
    await exec(`IF OBJECT_ID('dbo.gym_live_taps','U') IS NULL BEGIN
      CREATE TABLE dbo.gym_live_taps (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        TrName NVARCHAR(200) NULL,
        TrController NVARCHAR(200) NULL,
        [Transaction] NVARCHAR(100) NULL,
        CardNo NVARCHAR(100) NULL,
        UnitNo NVARCHAR(100) NULL,
        EmployeeID NVARCHAR(50) NULL,
        TrDate DATE NULL,
        TrTime VARCHAR(8) NULL,
        TxnTime DATETIME NOT NULL,
        CreatedAt DATETIME NOT NULL CONSTRAINT DF_gym_live_taps_CreatedAt DEFAULT GETDATE()
      );
    END`);
    await exec(`IF COL_LENGTH('dbo.gym_live_taps','UnitNo') IS NULL BEGIN ALTER TABLE dbo.gym_live_taps ADD UnitNo NVARCHAR(100) NULL; END`);
    await exec(`IF COL_LENGTH('dbo.gym_live_taps','EmployeeID') IS NULL BEGIN ALTER TABLE dbo.gym_live_taps ADD EmployeeID NVARCHAR(50) NULL; END`);
    await exec(`IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_gym_live_taps_unique' AND object_id = OBJECT_ID('dbo.gym_live_taps')) BEGIN
      CREATE UNIQUE INDEX UX_gym_live_taps_unique ON dbo.gym_live_taps (CardNo, TxnTime, TrController) WHERE CardNo IS NOT NULL;
    END`);
    await tx.commit();

    const cardPool = await new sql.ConnectionPool(cardConfig).connect();
    const src = await discoverSource(cardPool);
    if (!src) {
      await cardPool.close();
      await gymPool.close();
      return res.status(200).json({ ok: false, error: 'No transaction source table discovered' });
    }

    const req2 = cardPool.request();
    let where = '';
    if (sinceStr) {
      const sinceDate = new Date(sinceStr);
      if (!isNaN(sinceDate.getTime())) {
        req2.input('since', sql.DateTime, sinceDate);
        where = `WHERE [${src.timeCol}] > @since`;
      }
    }
    const unitFilterRaw = envTrim(process.env.GYM_UNIT_FILTER) || envTrim(process.env.GYM_UNIT_NO) || '';
    const unitFilters = unitFilterRaw ? unitFilterRaw.split(',').map((s) => s.trim()).filter((v) => v.length > 0) : [];
    if (src.unitCol && unitFilters.length > 0) {
      const list = unitFilters.map((v) => `'${v.replace(/'/g, "''")}'`).join(',');
      where = where ? `${where} AND [${src.unitCol}] IN (${list})` : `WHERE [${src.unitCol}] IN (${list})`;
    }
    const orderBy = src.timeCol ? `[${src.timeCol}] DESC` : `IDRow DESC`;
    const trDateExpr = src.timeCol ? `CONVERT(date, [${src.timeCol}])` : (src.dateCol ? `[${src.dateCol}]` : `CAST(NULL AS date)`);
    const trTimeExpr = src.timeCol ? `CONVERT(varchar(8), [${src.timeCol}], 108)` : (src.timeOnlyCol ? `[${src.timeOnlyCol}]` : `CAST(NULL AS varchar(8))`);
    const txnTimeExpr = src.timeCol ? `[${src.timeCol}]` : (src.dateCol && src.timeOnlyCol ? `TRY_CONVERT(datetime, CONCAT([${src.dateCol}], ' ', [${src.timeOnlyCol}]))` : `NULL`);
    const query = `SELECT TOP ${maxRows} ${[
      src.nameCol ? `[${src.nameCol}] AS TrName` : `CAST(NULL AS nvarchar(200)) AS TrName`,
      src.controllerCol ? `[${src.controllerCol}] AS TrController` : `CAST(NULL AS nvarchar(200)) AS TrController`,
      src.eventCol ? `[${src.eventCol}] AS [Transaction]` : `CAST(NULL AS nvarchar(100)) AS [Transaction]`,
      src.cardCol ? `[${src.cardCol}] AS CardNo` : `CAST(NULL AS nvarchar(100)) AS CardNo`,
      src.unitCol ? `[${src.unitCol}] AS UnitNo` : `CAST(NULL AS nvarchar(100)) AS UnitNo`,
      src.staffCol ? `[${src.staffCol}] AS EmployeeID` : `CAST(NULL AS nvarchar(50)) AS EmployeeID`,
      `${trDateExpr} AS TrDate`,
      `${trTimeExpr} AS TrTime`,
      `${txnTimeExpr} AS TxnTime`
    ].join(', ')} FROM [${src.schema}].[${src.table}] ${where} ORDER BY ${orderBy}`;
    const result = await req2.query(query);
    await cardPool.close();

    const rows = Array.isArray(result?.recordset) ? result.recordset : [];

    const pickSchemaForTable = async (pool, tableName) => {
      const safe = String(tableName || '').trim();
      if (!/^[A-Za-z0-9_]+$/.test(safe)) return null;
      const req3 = pool.request();
      req3.input('tableName', sql.VarChar(128), safe);
      const r = await req3.query(
        'SELECT TOP 1 TABLE_SCHEMA AS schema_name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @tableName ORDER BY CASE WHEN TABLE_SCHEMA = \'dbo\' THEN 0 ELSE 1 END, TABLE_SCHEMA'
      );
      const schemaName = r?.recordset?.[0]?.schema_name ? String(r.recordset[0].schema_name) : null;
      return schemaName && schemaName.trim().length > 0 ? schemaName : null;
    };

    const cardToEmployeeId = new Map();
    const missingCards = Array.from(
      new Set(
        rows
          .filter((r) => r && (r.EmployeeID == null || String(r.EmployeeID).trim().length === 0) && r.CardNo != null)
          .map((r) => String(r.CardNo).trim())
          .filter((v) => v.length > 0 && v.toUpperCase() !== 'FFFFFFFFFF')
      )
    ).slice(0, 200);

    if (missingCards.length > 0) {
      const tableCandidates = ['CardDB', 'employee_card', 'employee_cards', 'cards', 'card'];
      let cardPool2;
      try {
        cardPool2 = await new sql.ConnectionPool(cardConfig).connect();
        const tableRes = await cardPool2.request().query(
          `SELECT TOP 1 TABLE_SCHEMA AS schema_name, TABLE_NAME AS table_name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME IN (${tableCandidates
            .map((t) => `'${String(t).replace(/'/g, "''")}'`)
            .join(', ')}) ORDER BY CASE WHEN TABLE_SCHEMA = 'dbo' THEN 0 ELSE 1 END, TABLE_SCHEMA`
        );
        const row = tableRes?.recordset?.[0] || null;
        if (row?.schema_name && row?.table_name) {
          const schema = String(row.schema_name);
          const table = String(row.table_name);
          const colsRes = await cardPool2.request().query(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='${schema.replace(/'/g, "''")}' AND TABLE_NAME='${table.replace(/'/g, "''")}'`
          );
          const cols = (colsRes?.recordset || []).map((x) => String(x.COLUMN_NAME));
          const empCol = pickColumn(cols, ['employee_id', 'EmployeeID', 'emp_id', 'EmpID', 'StaffNo', 'staff_no']);
          const cardCol = pickColumn(cols, ['card_no', 'CardNo', 'card_number', 'CardNumber', 'id_card', 'IDCard', 'CardID', 'cardid']);
          const delStateCol = pickColumn(cols, ['del_state', 'DelState']);
          const blockCol = pickColumn(cols, ['block', 'Block', 'is_blocked', 'IsBlocked']);

          if (empCol && cardCol) {
            const req4 = cardPool2.request();
            missingCards.forEach((c, idx) => {
              req4.input(`c${idx}`, sql.VarChar(100), c);
            });
            const delStateWhere = delStateCol ? `AND ([${delStateCol}] = 0 OR [${delStateCol}] IS NULL)` : '';
            const blockWhere = blockCol ? `AND ([${blockCol}] IS NULL OR [${blockCol}] = 0 OR UPPER(CAST([${blockCol}] AS varchar(50))) IN ('UNBLOCK','FALSE','0'))` : '';
            const inList = missingCards.map((_, idx) => `@c${idx}`).join(',');
            const q2 = `SELECT [${empCol}] AS employee_id, [${cardCol}] AS card_no FROM [${schema}].[${table}] WHERE [${cardCol}] IN (${inList}) ${delStateWhere} ${blockWhere}`;
            const r2 = await req4.query(q2);
            const found = Array.isArray(r2?.recordset) ? r2.recordset : [];
            for (const x of found) {
              const cardNo = x?.card_no != null ? String(x.card_no).trim() : '';
              const empId = x?.employee_id != null ? String(x.employee_id).trim() : '';
              if (cardNo && empId && !cardToEmployeeId.has(cardNo)) cardToEmployeeId.set(cardNo, empId);
            }
          }
        }
        await cardPool2.close();
      } catch (_) {
        try {
          if (cardPool2) await cardPool2.close();
        } catch (_) {}
      }
    }

    if (masterConfig && missingCards.length > 0) {
      const stillMissing = missingCards.filter((c) => !cardToEmployeeId.has(c)).slice(0, 200);
      if (stillMissing.length > 0) {
        let masterPool;
        try {
          masterPool = await new sql.ConnectionPool(masterConfig).connect();
          const coreSchema = (await pickSchemaForTable(masterPool, 'employee_core')) || 'dbo';
          const colsRes = await masterPool.request().query(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='${coreSchema.replace(/'/g, "''")}' AND TABLE_NAME='employee_core'`
          );
          const cols = (colsRes?.recordset || []).map((x) => String(x.COLUMN_NAME));
          const empIdCol = pickColumn(cols, ['employee_id', 'EmployeeID', 'employeeid', 'emp_id', 'EmpID', 'StaffNo', 'staff_no']);
          const cardCol = pickColumn(cols, ['id_card', 'ID Card', 'card_no', 'Card No', 'CardNo', 'IDCard', 'CardID', 'cardid']);

          if (empIdCol && cardCol) {
            const req5 = masterPool.request();
            stillMissing.forEach((c, idx) => {
              req5.input(`c${idx}`, sql.VarChar(100), c);
            });
            const inList = stillMissing.map((_, idx) => `@c${idx}`).join(',');
            const q3 = `SELECT [${empIdCol}] AS employee_id, [${cardCol}] AS card_no FROM [${coreSchema}].[employee_core] WHERE [${cardCol}] IN (${inList})`;
            const r3 = await req5.query(q3);
            const found = Array.isArray(r3?.recordset) ? r3.recordset : [];
            for (const x of found) {
              const cardNo = x?.card_no != null ? String(x.card_no).trim() : '';
              const empId = x?.employee_id != null ? String(x.employee_id).trim() : '';
              if (cardNo && empId && !cardToEmployeeId.has(cardNo)) cardToEmployeeId.set(cardNo, empId);
            }
          }

          await masterPool.close();
        } catch (_) {
          try {
            if (masterPool) await masterPool.close();
          } catch (_) {}
        }
      }
    }

    let inserted = 0;
    for (const r of rows) {
      const ins = gymPool.request();
      ins.input('TrName', sql.NVarChar(200), r.TrName != null ? String(r.TrName) : null);
      ins.input('TrController', sql.NVarChar(200), r.TrController != null ? String(r.TrController) : null);
      ins.input('Transaction', sql.NVarChar(100), r.Transaction != null ? String(r.Transaction) : null);
      ins.input('CardNo', sql.NVarChar(100), r.CardNo != null ? String(r.CardNo) : null);
      ins.input('UnitNo', sql.NVarChar(100), r.UnitNo != null ? String(r.UnitNo) : null);
      ins.input('TrDate', sql.Date, r.TrDate != null ? new Date(String(r.TrDate)) : null);
      ins.input('TrTime', sql.VarChar(8), r.TrTime != null ? String(r.TrTime) : null);
      ins.input('TxnTime', sql.DateTime, r.TxnTime instanceof Date ? r.TxnTime : new Date(String(r.TxnTime)));
      const resolvedEmployeeId = r.EmployeeID != null && String(r.EmployeeID).trim().length > 0
        ? String(r.EmployeeID).trim()
        : (r.CardNo != null ? (cardToEmployeeId.get(String(r.CardNo).trim()) || null) : null);
      ins.input('EmployeeID', sql.NVarChar(50), resolvedEmployeeId);
      const insRes = await ins.query(`IF EXISTS (
        SELECT 1 FROM dbo.gym_live_taps WHERE ISNULL(CardNo,'') = ISNULL(@CardNo,'') AND TxnTime = @TxnTime AND ISNULL(TrController,'') = ISNULL(@TrController,'')
      ) BEGIN
        UPDATE dbo.gym_live_taps SET EmployeeID = CASE WHEN (EmployeeID IS NULL OR LTRIM(RTRIM(EmployeeID)) = '') AND @EmployeeID IS NOT NULL THEN @EmployeeID ELSE EmployeeID END
        WHERE ISNULL(CardNo,'') = ISNULL(@CardNo,'') AND TxnTime = @TxnTime AND ISNULL(TrController,'') = ISNULL(@TrController,'');
      END ELSE BEGIN
        INSERT INTO dbo.gym_live_taps (TrName, TrController, [Transaction], CardNo, UnitNo, EmployeeID, TrDate, TrTime, TxnTime) VALUES (@TrName, @TrController, @Transaction, @CardNo, @UnitNo, @EmployeeID, @TrDate, @TrTime, @TxnTime)
      END`);
      const affected = Array.isArray(insRes?.rowsAffected) ? Number(insRes.rowsAffected[0] || 0) : 0;
      if (affected > 0) inserted += affected;
    }

    await gymPool.close();
    return res.json({ ok: true, inserted, fetched: rows.length });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message });
  }
});

router.get('/gym-live-persisted', async (req, res) => {
  const { DB_SERVER, DB_PORT, DB_DATABASE, DB_USER, DB_PASSWORD, DB_ENCRYPT, DB_TRUST_SERVER_CERTIFICATE } = process.env;
  const server = envTrim(DB_SERVER);
  const database = envTrim(DB_DATABASE);
  const user = envTrim(DB_USER);
  const password = envTrim(DB_PASSWORD);
  if (!server || !database || !user || !password) {
    return res.status(500).json({ ok: false, error: 'Gym DB env is not configured' });
  }
  const config = { server, port: Number(DB_PORT || 1433), database, user, password, options: { encrypt: envBool(DB_ENCRYPT, false), trustServerCertificate: envBool(DB_TRUST_SERVER_CERTIFICATE, true) }, pool: { max: 2, min: 0, idleTimeoutMillis: 5000 } };
  const sinceStr = String(req.query.since || '').trim();
  const unitStr = String(req.query.unit || '').trim();
  const allStr = String(req.query.all || '').trim();
  const allowAll = allStr.length > 0 && ['1', 'true', 'yes', 'y'].includes(allStr.toLowerCase());
  const limit = Number(String(req.query.limit || '100'));
  const maxRows = Number.isFinite(limit) && limit > 0 && limit <= 1000 ? limit : 100;
  try {
    const pool = await new sql.ConnectionPool(config).connect();
    const req2 = pool.request();
    const whereParts = [];
    if (sinceStr) {
      const sinceDate = new Date(sinceStr);
      if (!isNaN(sinceDate.getTime())) {
        req2.input('since', sql.DateTime, sinceDate);
        whereParts.push('TxnTime > @since');
      }
    }

    let units = [];
    if (unitStr) {
      units = unitStr.split(',').map((s) => s.trim()).filter((v) => v.length > 0);
    } else if (!allowAll) {
      const envUnits = envTrim(process.env.GYM_UNIT_FILTER) || envTrim(process.env.GYM_UNIT_NO) || '';
      units = envUnits ? envUnits.split(',').map((s) => s.trim()).filter((v) => v.length > 0) : [];
    }

    const safeUnits = units
      .filter((u) => /^[A-Za-z0-9_-]+$/.test(u))
      .slice(0, 50);
    if (safeUnits.length > 0) {
      safeUnits.forEach((u, idx) => {
        req2.input(`u${idx}`, sql.VarChar(50), u);
      });
      const inList = safeUnits.map((_, idx) => `@u${idx}`).join(',');
      whereParts.push(`UnitNo IN (${inList})`);
    }

    const where = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
    const q = `SELECT TOP ${maxRows} TrName, TrController, [Transaction], CardNo, UnitNo, EmployeeID, TrDate, TrTime, TxnTime FROM dbo.gym_live_taps ${where} ORDER BY TxnTime DESC`;
    const r = await req2.query(q);
    await pool.close();
    const rows = Array.isArray(r?.recordset) ? r.recordset : [];
    const out = rows.map((x) => ({
      TrName: x.TrName != null ? String(x.TrName) : null,
      TrController: x.TrController != null ? String(x.TrController) : null,
      Transaction: x.Transaction != null ? String(x.Transaction) : null,
      CardNo: x.CardNo != null ? String(x.CardNo) : null,
      UnitNo: x.UnitNo != null ? String(x.UnitNo) : null,
      EmployeeID: x.EmployeeID != null ? String(x.EmployeeID) : null,
      TrDate: x.TrDate != null ? String(x.TrDate) : null,
      TrTime: x.TrTime != null ? String(x.TrTime) : null,
      TxnTime: x.TxnTime instanceof Date ? x.TxnTime.toISOString() : String(x.TxnTime || '')
    }));
    return res.json({ ok: true, transactions: out });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message });
  }
});

router.post('/gym-accounts-init', async (req, res) => {
  const { DB_SERVER, DB_PORT, DB_DATABASE, DB_USER, DB_PASSWORD, DB_ENCRYPT, DB_TRUST_SERVER_CERTIFICATE } = process.env;
  const server = envTrim(DB_SERVER);
  const database = envTrim(DB_DATABASE);
  const user = envTrim(DB_USER);
  const password = envTrim(DB_PASSWORD);
  if (!server || !database || !user || !password) {
    return res.status(500).json({ ok: false, error: 'Gym DB env is not configured' });
  }
  const config = { server, port: Number(DB_PORT || 1433), database, user, password, options: { encrypt: envBool(DB_ENCRYPT, false), trustServerCertificate: envBool(DB_TRUST_SERVER_CERTIFICATE, true) }, pool: { max: 2, min: 0, idleTimeoutMillis: 5000 } };
  try {
    const pool = await new sql.ConnectionPool(config).connect();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    const exec = async (q) => tx.request().query(q);
    await exec('SET NOCOUNT ON;');
    await exec(`IF OBJECT_ID('dbo.gym_account','U') IS NULL BEGIN
      CREATE TABLE dbo.gym_account (
        AccountID INT IDENTITY(1,1) PRIMARY KEY,
        Username VARCHAR(50) NOT NULL UNIQUE,
        Email VARCHAR(100) NOT NULL UNIQUE,
        PasswordHash VARCHAR(255) NOT NULL,
        Role VARCHAR(30) NOT NULL CONSTRAINT CK_gym_account_Role CHECK (Role IN ('SuperAdmin','Admin','Staff')),
        IsActive BIT NOT NULL CONSTRAINT DF_gym_account_IsActive DEFAULT (1),
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_gym_account_CreatedAt DEFAULT SYSDATETIME(),
        CreatedBy VARCHAR(50) NULL,
        UpdatedAt DATETIME2 NULL,
        UpdatedBy VARCHAR(50) NULL
      );
    END`);
    await exec(`IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'gym_account' AND COLUMN_NAME = 'CreatedBy') BEGIN
      ALTER TABLE dbo.gym_account ADD CreatedBy VARCHAR(50) NULL;
    END`);
    await exec(`IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'gym_account' AND COLUMN_NAME = 'UpdatedBy') BEGIN
      ALTER TABLE dbo.gym_account ADD UpdatedBy VARCHAR(50) NULL;
    END`);
    await exec(`IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'gym_account' AND COLUMN_NAME = 'PasswordResetRequired') BEGIN
      ALTER TABLE dbo.gym_account ADD PasswordResetRequired BIT NOT NULL CONSTRAINT DF_gym_account_PasswordResetRequired DEFAULT (0);
    END`);
    await exec(`IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'gym_account' AND COLUMN_NAME = 'PasswordAlgorithm') BEGIN
      ALTER TABLE dbo.gym_account DROP COLUMN PasswordAlgorithm;
    END`);
    await exec(`IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'gym_account' AND COLUMN_NAME = 'PasswordHash') BEGIN
      ALTER TABLE dbo.gym_account ALTER COLUMN PasswordHash VARCHAR(255) NULL;
    END`);
    await exec(`DECLARE @cn NVARCHAR(256);
    DECLARE c CURSOR FOR
      SELECT name FROM sys.check_constraints
      WHERE parent_object_id = OBJECT_ID('dbo.gym_account');
    OPEN c;
    FETCH NEXT FROM c INTO @cn;
    WHILE @@FETCH_STATUS = 0
    BEGIN
      EXEC('ALTER TABLE dbo.gym_account DROP CONSTRAINT [' + @cn + ']');
      FETCH NEXT FROM c INTO @cn;
    END
    CLOSE c;
    DEALLOCATE c;`);
    await exec(`UPDATE dbo.gym_account SET Role = 'SuperAdmin' WHERE Role IN ('superadmin','SUPERADMIN','Super Admin')`);
    await exec(`UPDATE dbo.gym_account SET Role = 'Admin' WHERE Role IN ('admin','ADMIN')`);
    await exec(`UPDATE dbo.gym_account SET Role = 'Staff' WHERE Role NOT IN ('SuperAdmin','Admin') OR Role IS NULL`);
    await exec(`ALTER TABLE dbo.gym_account ADD CONSTRAINT CK_gym_account_Role CHECK (Role IN ('SuperAdmin','Admin','Staff'))`);
    await exec(`IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_gym_account_Email' AND object_id = OBJECT_ID('dbo.gym_account')) BEGIN
      CREATE UNIQUE INDEX UX_gym_account_Email ON dbo.gym_account (Email);
    END`);
    await exec(`IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_gym_account_Username' AND object_id = OBJECT_ID('dbo.gym_account')) BEGIN
      CREATE UNIQUE INDEX UX_gym_account_Username ON dbo.gym_account (Username);
    END`);
    await exec(`IF OBJECT_ID('dbo.tr_gym_account_SetUpdatedAt','TR') IS NULL BEGIN
      EXEC('CREATE TRIGGER dbo.tr_gym_account_SetUpdatedAt ON dbo.gym_account AFTER UPDATE AS BEGIN SET NOCOUNT ON; UPDATE a SET UpdatedAt = SYSDATETIME() FROM dbo.gym_account a INNER JOIN inserted i ON a.AccountID = i.AccountID; END');
    END`);
    await tx.commit();
    await pool.close();
    return res.json({ ok: true });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message });
  }
});

router.get('/gym-accounts', async (req, res) => {
  const { DB_SERVER, DB_PORT, DB_DATABASE, DB_USER, DB_PASSWORD, DB_ENCRYPT, DB_TRUST_SERVER_CERTIFICATE } = process.env;
  const server = envTrim(DB_SERVER);
  const database = envTrim(DB_DATABASE);
  const user = envTrim(DB_USER);
  const password = envTrim(DB_PASSWORD);
  if (!server || !database || !user || !password) {
    return res.status(500).json({ ok: false, error: 'Gym DB env is not configured' });
  }
  const config = { server, port: Number(DB_PORT || 1433), database, user, password, options: { encrypt: envBool(DB_ENCRYPT, false), trustServerCertificate: envBool(DB_TRUST_SERVER_CERTIFICATE, true) }, pool: { max: 2, min: 0, idleTimeoutMillis: 5000 } };
  try {
    const pool = await new sql.ConnectionPool(config).connect();
    const result = await pool.request().query(
      'SELECT AccountID, Username, Email, Role, IsActive, CreatedAt, UpdatedAt FROM dbo.gym_account ORDER BY CreatedAt DESC'
    );
    await pool.close();
    const rows = Array.isArray(result?.recordset) ? result.recordset : [];
    const accounts = rows.map((r) => {
      const dbRole = r.Role != null ? String(r.Role) : '';
      const role = dbRole === 'SuperAdmin' ? 'superadmin' : dbRole === 'Admin' ? 'admin' : 'committee';
      return {
        account_id: Number(r.AccountID),
        username: r.Username != null ? String(r.Username) : '',
        email: r.Email != null ? String(r.Email) : '',
        role,
        is_active: r.IsActive ? true : false,
        created_at: r.CreatedAt instanceof Date ? r.CreatedAt.toISOString() : String(r.CreatedAt || ''),
        updated_at: r.UpdatedAt instanceof Date ? r.UpdatedAt.toISOString() : String(r.UpdatedAt || ''),
      };
    });
    return res.json({ ok: true, accounts });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message, accounts: [] });
  }
});

router.get('/gym-bookings-by-employee', async (req, res) => {
  const { DB_SERVER, DB_PORT, DB_DATABASE, DB_USER, DB_PASSWORD, DB_ENCRYPT, DB_TRUST_SERVER_CERTIFICATE } = process.env;
  if (!DB_SERVER || !DB_DATABASE || !DB_USER || !DB_PASSWORD) {
    return res.status(500).json({ ok: false, error: 'Gym DB env is not configured', bookings: [] });
  }
  const employeeId = String(req.query.employee_id || '').trim();
  const from = String(req.query.from || '').trim();
  const to = String(req.query.to || '').trim();
  if (!employeeId || !from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return res.status(400).json({ ok: false, error: 'employee_id, from, to are required (yyyy-MM-dd)', bookings: [] });
  }
  const config = { server: DB_SERVER, port: Number(DB_PORT || 1433), database: DB_DATABASE, user: DB_USER, password: DB_PASSWORD, options: { encrypt: envBool(DB_ENCRYPT, false), trustServerCertificate: envBool(DB_TRUST_SERVER_CERTIFICATE, true) }, pool: { max: 2, min: 0, idleTimeoutMillis: 5000 } };
  try {
    const pool = await sql.connect(config);
    const request = pool.request();
    request.input('fromDate', sql.Date, new Date(from));
    request.input('toDate', sql.Date, new Date(to));
    request.input('employeeId', sql.VarChar(20), employeeId);
    const result = await request.query(
      `SELECT
        gb.BookingID AS booking_id,
        gb.EmployeeID AS employee_id,
        COALESCE(cd.CardNo, gb.CardNo) AS card_no,
        gb.EmployeeName AS employee_name,
        gb.Department AS department,
        gb.Gender AS gender,
        gb.SessionName AS session_name,
        gb.ScheduleID AS schedule_id,
        CONVERT(varchar(10), gb.BookingDate, 23) AS booking_date,
        gb.Status AS status,
        gb.ApprovalStatus AS approval_status,
        s.StartTime AS time_start_raw,
        s.EndTime AS time_end_raw,
        CONVERT(varchar(5), s.StartTime, 108) AS time_start,
        CONVERT(varchar(5), s.EndTime, 108) AS time_end
      FROM dbo.gym_booking gb
      LEFT JOIN dbo.gym_schedule s ON s.ScheduleID = gb.ScheduleID
      OUTER APPLY (
        SELECT TOP 1 c.CardNo FROM dbo.gym_card_registry c WHERE c.EmployeeID = gb.EmployeeID ORDER BY c.UpdatedAt DESC
      ) cd
      WHERE gb.EmployeeID = @employeeId AND gb.BookingDate >= @fromDate AND gb.BookingDate <= @toDate AND gb.Status IN ('BOOKED','CHECKIN','COMPLETED')
      ORDER BY gb.BookingDate DESC, time_start DESC, gb.CreatedAt DESC`
    );
    await pool.close();
    const rows = Array.isArray(result?.recordset) ? result.recordset : [];
    const bookings = rows.map((r) => ({
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
      time_start: r.time_start != null ? String(r.time_start).trim() : null,
      time_end: r.time_end != null ? String(r.time_end).trim() : null,
    }));
    return res.json({ ok: true, bookings });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message, bookings: [] });
  }
});

router.post('/gym-booking-status', async (req, res) => {
  const { DB_SERVER, DB_PORT, DB_DATABASE, DB_USER, DB_PASSWORD, DB_ENCRYPT, DB_TRUST_SERVER_CERTIFICATE } = process.env;
  if (!DB_SERVER || !DB_DATABASE || !DB_USER || !DB_PASSWORD) {
    return res.status(500).json({ ok: false, error: 'Gym DB env is not configured' });
  }
  const { booking_id, status } = req.body || {};
  const valid = ['BOOKED','CHECKIN','COMPLETED','CANCELLED','EXPIRED'];
  const statusUpper = String(status || '').toUpperCase();
  if (!booking_id || !valid.includes(statusUpper)) {
    return res.status(400).json({ ok: false, error: 'booking_id and valid status are required' });
  }
  const config = { server: DB_SERVER, port: Number(DB_PORT || 1433), database: DB_DATABASE, user: DB_USER, password: DB_PASSWORD, options: { encrypt: envBool(DB_ENCRYPT, false), trustServerCertificate: envBool(DB_TRUST_SERVER_CERTIFICATE, true) }, pool: { max: 2, min: 0, idleTimeoutMillis: 5000 } };
  try {
    const pool = await sql.connect(config);
    const req1 = pool.request();
    req1.input('id', sql.Int, Number(booking_id));
    req1.input('status', sql.VarChar(20), statusUpper);
    const result = await req1.query('UPDATE dbo.gym_booking SET Status = @status WHERE BookingID = @id');
    await pool.close();
    const affected = Array.isArray(result?.rowsAffected) ? Number(result.rowsAffected[0] || 0) : 0;
    if (affected < 1) return res.status(200).json({ ok: false, error: 'Not updated' });
    return res.json({ ok: true, affected });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message });
  }
});

router.delete('/gym-booking/:id', async (req, res) => {
  const { DB_SERVER, DB_PORT, DB_DATABASE, DB_USER, DB_PASSWORD, DB_ENCRYPT, DB_TRUST_SERVER_CERTIFICATE } = process.env;
  if (!DB_SERVER || !DB_DATABASE || !DB_USER || !DB_PASSWORD) {
    return res.status(500).json({ ok: false, error: 'Gym DB env is not configured' });
  }
  const id = Number(String(req.params.id || ''));
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ ok: false, error: 'Invalid id' });
  }
  const config = { server: DB_SERVER, port: Number(DB_PORT || 1433), database: DB_DATABASE, user: DB_USER, password: DB_PASSWORD, options: { encrypt: envBool(DB_ENCRYPT, false), trustServerCertificate: envBool(DB_TRUST_SERVER_CERTIFICATE, true) }, pool: { max: 2, min: 0, idleTimeoutMillis: 5000 } };
  try {
    const pool = await sql.connect(config);
    const req1 = pool.request();
    req1.input('id', sql.Int, id);
    const r = await req1.query('DELETE FROM dbo.gym_booking WHERE BookingID = @id');
    await pool.close();
    const affected = Array.isArray(r?.rowsAffected) ? Number(r.rowsAffected[0] || 0) : 0;
    if (affected < 1) return res.status(200).json({ ok: false, error: 'Not deleted' });
    return res.json({ ok: true, affected });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message });
  }
});

router.post('/db-connections-init', async (req, res) => {
  const { DB_SERVER, DB_PORT, DB_DATABASE, DB_USER, DB_PASSWORD, DB_ENCRYPT, DB_TRUST_SERVER_CERTIFICATE } = process.env;
  const server = envTrim(DB_SERVER);
  const database = envTrim(DB_DATABASE);
  const user = envTrim(DB_USER);
  const password = envTrim(DB_PASSWORD);
  if (!server || !database || !user || !password) {
    return res.status(500).json({ ok: false, error: 'Gym DB env is not configured' });
  }
  const config = { server, port: Number(DB_PORT || 1433), database, user, password, options: { encrypt: envBool(DB_ENCRYPT, false), trustServerCertificate: envBool(DB_TRUST_SERVER_CERTIFICATE, true) }, pool: { max: 2, min: 0, idleTimeoutMillis: 5000 } };
  try {
    const pool = await new sql.ConnectionPool(config).connect();
    const exec = async (q) => { await pool.request().query(q); };
    await exec(`IF OBJECT_ID('dbo.gym_database_connections','U') IS NULL BEGIN
      CREATE TABLE dbo.gym_database_connections (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        DisplayName VARCHAR(100) NOT NULL,
        DatabaseType VARCHAR(30) NOT NULL,
        Host VARCHAR(200) NOT NULL,
        Port INT NOT NULL,
        DatabaseName VARCHAR(200) NOT NULL,
        Username VARCHAR(100) NOT NULL,
        PasswordEncrypted VARCHAR(255) NOT NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        ConnectionStatus VARCHAR(20) NOT NULL DEFAULT 'not_tested',
        LastTestedAt DATETIME NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NULL,
        CONSTRAINT PK_gym_database_connections PRIMARY KEY (Id)
      )
    END`);
    await exec(`IF OBJECT_ID('dbo.tr_gym_database_connections_SetUpdatedAt','TR') IS NULL BEGIN
      EXEC('CREATE TRIGGER dbo.tr_gym_database_connections_SetUpdatedAt ON dbo.gym_database_connections AFTER UPDATE AS BEGIN SET NOCOUNT ON; UPDATE c SET UpdatedAt = SYSDATETIME() FROM dbo.gym_database_connections c INNER JOIN inserted i ON c.Id = i.Id; END');
    END`);
    await pool.close();
    return res.json({ ok: true });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message });
  }
});

router.get('/db-connections', async (req, res) => {
  const { DB_SERVER, DB_PORT, DB_DATABASE, DB_USER, DB_PASSWORD, DB_ENCRYPT, DB_TRUST_SERVER_CERTIFICATE } = process.env;
  const server = envTrim(DB_SERVER);
  const database = envTrim(DB_DATABASE);
  const user = envTrim(DB_USER);
  const password = envTrim(DB_PASSWORD);
  if (!server || !database || !user || !password) {
    return res.status(500).json({ ok: false, error: 'Gym DB env is not configured' });
  }
  const config = { server, port: Number(DB_PORT || 1433), database, user, password, options: { encrypt: envBool(DB_ENCRYPT, false), trustServerCertificate: envBool(DB_TRUST_SERVER_CERTIFICATE, true) }, pool: { max: 2, min: 0, idleTimeoutMillis: 5000 } };
  try {
    const pool = await new sql.ConnectionPool(config).connect();
    const r = await pool.request().query(`SELECT Id, DisplayName, DatabaseType, Host, Port, DatabaseName, Username, PasswordEncrypted, IsActive, ConnectionStatus, LastTestedAt, CreatedAt, UpdatedAt FROM dbo.gym_database_connections ORDER BY CreatedAt DESC`);
    await pool.close();
    const rows = Array.isArray(r?.recordset) ? r.recordset : [];
    const connections = rows.map((x) => ({
      id: String(x.Id),
      display_name: String(x.DisplayName),
      database_type: String(x.DatabaseType),
      host: String(x.Host),
      port: Number(x.Port || 1433),
      database_name: String(x.DatabaseName),
      username: String(x.Username),
      password_encrypted: String(x.PasswordEncrypted),
      is_active: x.IsActive ? true : false,
      connection_status: String(x.ConnectionStatus || 'not_tested'),
      last_tested_at: x.LastTestedAt ? new Date(x.LastTestedAt).toISOString() : null,
      created_at: x.CreatedAt ? new Date(x.CreatedAt).toISOString() : new Date().toISOString(),
      updated_at: x.UpdatedAt ? new Date(x.UpdatedAt).toISOString() : new Date().toISOString(),
      created_by: null,
    }));
    return res.json({ ok: true, connections });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message, connections: [] });
  }
});

router.post('/db-connections', async (req, res) => {
  const { DB_SERVER, DB_PORT, DB_DATABASE, DB_USER, DB_PASSWORD, DB_ENCRYPT, DB_TRUST_SERVER_CERTIFICATE } = process.env;
  const server = envTrim(DB_SERVER);
  const database = envTrim(DB_DATABASE);
  const user = envTrim(DB_USER);
  const password = envTrim(DB_PASSWORD);
  if (!server || !database || !user || !password) {
    return res.status(500).json({ ok: false, error: 'Gym DB env is not configured' });
  }
  const { display_name, database_type, host, port, database_name, username, password_encrypted, is_active } = req.body || {};
  if (!display_name || !database_type || !host || !database_name || !username || !password_encrypted || typeof port !== 'number') {
    return res.status(400).json({ ok: false, error: 'Missing required fields' });
  }
  const config = { server, port: Number(DB_PORT || 1433), database, user, password, options: { encrypt: envBool(DB_ENCRYPT, false), trustServerCertificate: envBool(DB_TRUST_SERVER_CERTIFICATE, true) }, pool: { max: 2, min: 0, idleTimeoutMillis: 5000 } };
  try {
    const pool = await new sql.ConnectionPool(config).connect();
    const req1 = pool.request();
    req1.input('DisplayName', sql.VarChar(100), String(display_name));
    req1.input('DatabaseType', sql.VarChar(30), String(database_type));
    req1.input('Host', sql.VarChar(200), String(host));
    req1.input('Port', sql.Int, Number(port));
    req1.input('DatabaseName', sql.VarChar(200), String(database_name));
    req1.input('Username', sql.VarChar(100), String(username));
    req1.input('PasswordEncrypted', sql.VarChar(255), String(password_encrypted));
    req1.input('IsActive', sql.Bit, is_active === false ? 0 : 1);
    const r = await req1.query(`INSERT INTO dbo.gym_database_connections (DisplayName, DatabaseType, Host, Port, DatabaseName, Username, PasswordEncrypted, IsActive) OUTPUT inserted.Id VALUES (@DisplayName, @DatabaseType, @Host, @Port, @DatabaseName, @Username, @PasswordEncrypted, @IsActive)`);
    const id = r?.recordset?.[0]?.Id ? String(r.recordset[0].Id) : null;
    await pool.close();
    return res.json({ ok: true, id });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message });
  }
});

router.post('/db-connections-update', async (req, res) => {
  const { DB_SERVER, DB_PORT, DB_DATABASE, DB_USER, DB_PASSWORD, DB_ENCRYPT, DB_TRUST_SERVER_CERTIFICATE } = process.env;
  const server = envTrim(DB_SERVER);
  const database = envTrim(DB_DATABASE);
  const user = envTrim(DB_USER);
  const password = envTrim(DB_PASSWORD);
  if (!server || !database || !user || !password) {
    return res.status(500).json({ ok: false, error: 'Gym DB env is not configured' });
  }
  const { id, display_name, database_type, host, port, database_name, username, password_encrypted, is_active } = req.body || {};
  if (!id) return res.status(400).json({ ok: false, error: 'id is required' });
  const config = { server, port: Number(DB_PORT || 1433), database, user, password, options: { encrypt: envBool(DB_ENCRYPT, false), trustServerCertificate: envBool(DB_TRUST_SERVER_CERTIFICATE, true) }, pool: { max: 2, min: 0, idleTimeoutMillis: 5000 } };
  try {
    const pool = await new sql.ConnectionPool(config).connect();
    const req1 = pool.request();
    req1.input('Id', sql.UniqueIdentifier, id);
    req1.input('DisplayName', sql.VarChar(100), display_name ?? null);
    req1.input('DatabaseType', sql.VarChar(30), database_type ?? null);
    req1.input('Host', sql.VarChar(200), host ?? null);
    req1.input('Port', sql.Int, typeof port === 'number' ? port : null);
    req1.input('DatabaseName', sql.VarChar(200), database_name ?? null);
    req1.input('Username', sql.VarChar(100), username ?? null);
    req1.input('PasswordEncrypted', sql.VarChar(255), password_encrypted ?? null);
    req1.input('IsActive', sql.Bit, typeof is_active === 'boolean' ? (is_active ? 1 : 0) : null);
    await req1.query(`UPDATE dbo.gym_database_connections SET 
      DisplayName = COALESCE(@DisplayName, DisplayName),
      DatabaseType = COALESCE(@DatabaseType, DatabaseType),
      Host = COALESCE(@Host, Host),
      Port = COALESCE(@Port, Port),
      DatabaseName = COALESCE(@DatabaseName, DatabaseName),
      Username = COALESCE(@Username, Username),
      PasswordEncrypted = COALESCE(@PasswordEncrypted, PasswordEncrypted),
      IsActive = COALESCE(@IsActive, IsActive),
      UpdatedAt = SYSDATETIME()
    WHERE Id = @Id`);
    await pool.close();
    return res.json({ ok: true });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message });
  }
});

router.post('/db-connections-delete', async (req, res) => {
  const { DB_SERVER, DB_PORT, DB_DATABASE, DB_USER, DB_PASSWORD, DB_ENCRYPT, DB_TRUST_SERVER_CERTIFICATE } = process.env;
  const server = envTrim(DB_SERVER);
  const database = envTrim(DB_DATABASE);
  const user = envTrim(DB_USER);
  const password = envTrim(DB_PASSWORD);
  if (!server || !database || !user || !password) {
    return res.status(500).json({ ok: false, error: 'Gym DB env is not configured' });
  }
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ ok: false, error: 'id is required' });
  const config = { server, port: Number(DB_PORT || 1433), database, user, password, options: { encrypt: envBool(DB_ENCRYPT, false), trustServerCertificate: envBool(DB_TRUST_SERVER_CERTIFICATE, true) }, pool: { max: 2, min: 0, idleTimeoutMillis: 5000 } };
  try {
    const pool = await new sql.ConnectionPool(config).connect();
    const req1 = pool.request();
    req1.input('Id', sql.UniqueIdentifier, id);
    await req1.query(`DELETE FROM dbo.gym_database_connections WHERE Id = @Id`);
    await pool.close();
    return res.json({ ok: true });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message });
  }
});

router.post('/db-connections-test', async (req, res) => {
  const { DB_SERVER, DB_PORT, DB_DATABASE, DB_USER, DB_PASSWORD, DB_ENCRYPT, DB_TRUST_SERVER_CERTIFICATE } = process.env;
  const server = envTrim(DB_SERVER);
  const database = envTrim(DB_DATABASE);
  const user = envTrim(DB_USER);
  const password = envTrim(DB_PASSWORD);
  if (!server || !database || !user || !password) {
    return res.status(500).json({ ok: false, error: 'Gym DB env is not configured' });
  }
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ ok: false, error: 'id is required' });
  const gymConfig = { server, port: Number(DB_PORT || 1433), database, user, password, options: { encrypt: envBool(DB_ENCRYPT, false), trustServerCertificate: envBool(DB_TRUST_SERVER_CERTIFICATE, true) }, pool: { max: 2, min: 0, idleTimeoutMillis: 5000 } };
  try {
    const pool = await new sql.ConnectionPool(gymConfig).connect();
    const row = await pool.request().input('Id', sql.UniqueIdentifier, id).query(`SELECT TOP 1 Host, Port, DatabaseName, Username, PasswordEncrypted, DatabaseType FROM dbo.gym_database_connections WHERE Id = @Id`);
    const item = row?.recordset?.[0] || null;
    if (!item) { await pool.close(); return res.status(200).json({ ok: false, error: 'Not found' }); }
    const testConfig = {
      server: String(item.Host),
      port: Number(item.Port || 1433),
      database: String(item.DatabaseName),
      user: String(item.Username),
      password: String(item.PasswordEncrypted),
      options: { encrypt: false, trustServerCertificate: true },
      pool: { max: 1, min: 0, idleTimeoutMillis: 3000 },
    };
    let success = false;
    try {
      const tpool = await new sql.ConnectionPool(testConfig).connect();
      await tpool.request().query('SELECT 1 AS ok');
      await tpool.close();
      success = true;
    } catch (_) {
      success = false;
    }
    const req1 = pool.request();
    req1.input('Id', sql.UniqueIdentifier, id);
    req1.input('Status', sql.VarChar(20), success ? 'connected' : 'error');
    req1.input('At', sql.DateTime, new Date());
    await req1.query(`UPDATE dbo.gym_database_connections SET ConnectionStatus = @Status, LastTestedAt = @At WHERE Id = @Id`);
    await pool.close();
    return res.json({ ok: true, success });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message });
  }
});

router.post('/gym-accounts', async (req, res) => {
  const { DB_SERVER, DB_PORT, DB_DATABASE, DB_USER, DB_PASSWORD, DB_ENCRYPT, DB_TRUST_SERVER_CERTIFICATE } = process.env;
  const server = envTrim(DB_SERVER);
  const database = envTrim(DB_DATABASE);
  const user = envTrim(DB_USER);
  const password = envTrim(DB_PASSWORD);
  if (!server || !database || !user || !password) {
    return res.status(500).json({ ok: false, error: 'Gym DB env is not configured' });
  }
  const { username, email, role, is_active, password: rawPassword } = req.body || {};
  if (!username || !email || !role) {
    return res.status(400).json({ ok: false, error: 'username, email, role are required' });
  }
  const config = { server, port: Number(DB_PORT || 1433), database, user, password, options: { encrypt: envBool(DB_ENCRYPT, false), trustServerCertificate: envBool(DB_TRUST_SERVER_CERTIFICATE, true) }, pool: { max: 2, min: 0, idleTimeoutMillis: 5000 } };
  try {
    const pool = await new sql.ConnectionPool(config).connect();
    const req1 = pool.request();
    const dbRole = String(role).toLowerCase() === 'superadmin' ? 'SuperAdmin' : String(role).toLowerCase() === 'admin' ? 'Admin' : 'Staff';
    req1.input('Username', sql.VarChar(50), String(username));
    req1.input('Email', sql.VarChar(100), String(email));
    req1.input('Role', sql.VarChar(30), dbRole);
    req1.input('IsActive', sql.Bit, is_active === false ? 0 : 1);
    let hash = null;
    if (rawPassword && String(rawPassword).trim().length > 0) {
      const h = await bcrypt.hash(String(rawPassword), 10);
      hash = h;
      req1.input('PasswordHashText', sql.VarChar(255), String(h));
    }
    const q = hash
      ? "INSERT INTO dbo.gym_account (Username, Email, Role, IsActive, PasswordHash) VALUES (@Username, @Email, @Role, @IsActive, @PasswordHashText)"
      : "INSERT INTO dbo.gym_account (Username, Email, Role, IsActive) VALUES (@Username, @Email, @Role, @IsActive)";
    await req1.query(q);
    await pool.close();
    return res.json({ ok: true });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message });
  }
});

router.put('/gym-accounts/:id', async (req, res) => {
  const { DB_SERVER, DB_PORT, DB_DATABASE, DB_USER, DB_PASSWORD, DB_ENCRYPT, DB_TRUST_SERVER_CERTIFICATE } = process.env;
  const server = envTrim(DB_SERVER);
  const database = envTrim(DB_DATABASE);
  const user = envTrim(DB_USER);
  const password = envTrim(DB_PASSWORD);
  if (!server || !database || !user || !password) {
    return res.status(500).json({ ok: false, error: 'Gym DB env is not configured' });
  }
  const id = Number(String(req.params.id || ''));
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ ok: false, error: 'Invalid id' });
  }
  const { username, email, role, is_active, password: rawPassword } = req.body || {};
  const config = { server, port: Number(DB_PORT || 1433), database, user, password, options: { encrypt: envBool(DB_ENCRYPT, false), trustServerCertificate: envBool(DB_TRUST_SERVER_CERTIFICATE, true) }, pool: { max: 2, min: 0, idleTimeoutMillis: 5000 } };
  try {
    const pool = await new sql.ConnectionPool(config).connect();
    const req1 = pool.request();
    req1.input('Id', sql.Int, id);
    if (username != null) req1.input('Username', sql.VarChar(50), String(username));
    if (email != null) req1.input('Email', sql.VarChar(100), String(email));
    if (role != null) {
      const dbRole = String(role).toLowerCase() === 'superadmin' ? 'SuperAdmin' : String(role).toLowerCase() === 'admin' ? 'Admin' : 'Staff';
      req1.input('Role', sql.VarChar(30), dbRole);
    }
    if (is_active != null) req1.input('IsActive', sql.Bit, is_active ? 1 : 0);
    const setParts = [];
    if (username != null) setParts.push('Username = @Username');
    if (email != null) setParts.push('Email = @Email');
    if (role != null) setParts.push('Role = @Role');
    if (is_active != null) setParts.push('IsActive = @IsActive');
    if (rawPassword && String(rawPassword).trim().length > 0) {
      const h = await bcrypt.hash(String(rawPassword), 10);
      req1.input('PasswordHashText', sql.VarChar(255), String(h));
      setParts.push('PasswordHash = @PasswordHashText');
    }
    if (setParts.length < 1) {
      await pool.close();
      return res.status(400).json({ ok: false, error: 'No fields to update' });
    }
    const q = `UPDATE dbo.gym_account SET ${setParts.join(', ')}, UpdatedAt = SYSDATETIME() WHERE AccountID = @Id`;
    const r = await req1.query(q);
    await pool.close();
    const affected = Array.isArray(r?.rowsAffected) ? Number(r.rowsAffected[0] || 0) : 0;
    if (affected < 1) {
      return res.status(200).json({ ok: false, error: 'Account not found or not updated' });
    }
    return res.json({ ok: true, affected });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message });
  }
});

router.delete('/gym-accounts/:id', async (req, res) => {
  const { DB_SERVER, DB_PORT, DB_DATABASE, DB_USER, DB_PASSWORD, DB_ENCRYPT, DB_TRUST_SERVER_CERTIFICATE } = process.env;
  const server = envTrim(DB_SERVER);
  const database = envTrim(DB_DATABASE);
  const user = envTrim(DB_USER);
  const password = envTrim(DB_PASSWORD);
  if (!server || !database || !user || !password) {
    return res.status(500).json({ ok: false, error: 'Gym DB env is not configured' });
  }
  const id = Number(String(req.params.id || ''));
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ ok: false, error: 'Invalid id' });
  }
  const config = { server, port: Number(DB_PORT || 1433), database, user, password, options: { encrypt: envBool(DB_ENCRYPT, false), trustServerCertificate: envBool(DB_TRUST_SERVER_CERTIFICATE, true) }, pool: { max: 2, min: 0, idleTimeoutMillis: 5000 } };
  try {
    const pool = await new sql.ConnectionPool(config).connect();
    const req1 = pool.request();
    req1.input('Id', sql.Int, id);
    const r = await req1.query('DELETE FROM dbo.gym_account WHERE AccountID = @Id');
    await pool.close();
    const affected = Array.isArray(r?.rowsAffected) ? Number(r.rowsAffected[0] || 0) : 0;
    if (affected < 1) {
      return res.status(200).json({ ok: false, error: 'Account not found or not deleted' });
    }
    return res.json({ ok: true, affected });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message });
  }
});

router.get('/gym-live-status', async (req, res) => {
  const { DB_SERVER, DB_PORT, DB_DATABASE, DB_USER, DB_PASSWORD, DB_ENCRYPT, DB_TRUST_SERVER_CERTIFICATE } = process.env;
  const server = envTrim(DB_SERVER);
  const database = envTrim(DB_DATABASE);
  const user = envTrim(DB_USER);
  const password = envTrim(DB_PASSWORD);
  if (!server || !database || !user || !password) {
    return res.status(500).json({ ok: false, error: 'Gym DB env is not configured', people: [] });
  }
  const config = { server, port: Number(DB_PORT || 1433), database, user, password, options: { encrypt: envBool(DB_ENCRYPT, false), trustServerCertificate: envBool(DB_TRUST_SERVER_CERTIFICATE, true) }, pool: { max: 2, min: 0, idleTimeoutMillis: 5000 } };
  try {
    const pool = await new sql.ConnectionPool(config).connect();
    const request = pool.request();
    request.input('today', sql.Date, new Date());
    const result = await request.query(
      "SELECT ec.name AS employee_name, gb.EmployeeID AS employee_id, ee.department AS department, s.Session AS session_name, CONVERT(varchar(5), s.StartTime, 108) AS time_start, CONVERT(varchar(5), s.EndTime, 108) AS time_end, gb.Status AS booking_status FROM dbo.gym_booking gb LEFT JOIN dbo.gym_schedule s ON s.ScheduleID = gb.ScheduleID LEFT JOIN MTIMasterEmployeeDB.dbo.employee_core ec ON gb.EmployeeID = ec.employee_id LEFT JOIN MTIMasterEmployeeDB.dbo.employee_employment ee ON gb.EmployeeID = ee.employee_id AND ee.status = 'ACTIVE' WHERE gb.BookingDate = @today AND gb.Status IN ('CHECKIN','COMPLETED') ORDER BY s.StartTime ASC, ec.name ASC"
    );
    await pool.close();
    const people = Array.isArray(result?.recordset)
      ? result.recordset.map((r) => {
          const name = r?.employee_name != null ? String(r.employee_name).trim() : null;
          const empId = r?.employee_id != null ? String(r.employee_id).trim() : null;
          const dept = r?.department != null ? String(r.department).trim() : null;
          const sess = r?.session_name != null ? String(r.session_name).trim() : '';
          const ts = r?.time_start != null ? String(r.time_start).trim() : null;
          const te = r?.time_end != null ? String(r.time_end).trim() : null;
          const sched = sess ? (ts && te ? `${sess} ${ts}-${te}` : sess) : null;
          const bookingStatus = r?.booking_status != null ? String(r.booking_status).trim().toUpperCase() : '';
          const status = bookingStatus === 'CHECKIN' ? 'IN_GYM' : 'LEFT';
          return { name, employee_id: empId, department: dept, schedule: sched, time_in: null, time_out: null, status };
        })
      : [];
    return res.json({ ok: true, people });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ ok: false, error: message, people: [] });
  }
});

export default router;
