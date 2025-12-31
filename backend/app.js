import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sql from 'mssql';
import testerRouter from './routes/tester.js';
import masterRouter from './routes/master.js';
import gymRouter from './routes/gym.js';
import authRouter from './routes/auth.js';
import { envBool, envTrim } from './lib/env.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Support both /api prefix and root-level routes to tolerate different proxy setups
app.use('/api', testerRouter);
app.use('/api', masterRouter);
app.use('/api', gymRouter);
app.use('/api', authRouter);
app.use(testerRouter);
app.use(masterRouter);
app.use(gymRouter);
app.use(authRouter);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/gym-live-status', (_req, res) => {
  res.json({ ok: true, people: [] });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT || 5055;
app.listen(PORT, () => {
  console.log(`DB tester listening on http://localhost:${PORT}`);
});

const enableAutoSync = String(process.env.GYM_SYNC_ENABLE || '1').trim().toLowerCase();
if (['1','true','yes','y'].includes(enableAutoSync)) {
  let syncing = false;
  setInterval(async () => {
    if (syncing) return;
    syncing = true;
    try {
      const since = new Date(Date.now() - 5 * 60 * 1000).toISOString().slice(0, 19);
      const url = `http://localhost:${PORT}/gym-live-sync?since=${encodeURIComponent(since)}&limit=200`;
      const r = await fetch(url);
      await r.text();
    } catch (_) {
    } finally {
      syncing = false;
    }
  }, 5000);
}

const enableAutoOrganizeWorker = String(process.env.GYM_AUTO_ORGANIZE_WORKER_ENABLE || '1').trim().toLowerCase();
if (['1', 'true', 'yes', 'y'].includes(enableAutoOrganizeWorker)) {
  let running = false;

  const gymDbConfig = () => {
    const server = envTrim(process.env.DB_SERVER);
    const database = envTrim(process.env.DB_DATABASE);
    const user = envTrim(process.env.DB_USER);
    const password = envTrim(process.env.DB_PASSWORD);
    if (!server || !database || !user || !password) return null;
    return {
      server,
      port: Number(process.env.DB_PORT || 1433),
      database,
      user,
      password,
      options: {
        encrypt: envBool(process.env.DB_ENCRYPT, false),
        trustServerCertificate: envBool(process.env.DB_TRUST_SERVER_CERTIFICATE, true),
      },
      pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
    };
  };

  const masterDbConfig = () => {
    const server = envTrim(process.env.MASTER_DB_SERVER);
    const database = envTrim(process.env.MASTER_DB_DATABASE);
    const user = envTrim(process.env.MASTER_DB_USER);
    const password = envTrim(process.env.MASTER_DB_PASSWORD);
    if (!server || !database || !user || !password) return null;
    return {
      server,
      port: Number(process.env.MASTER_DB_PORT || 1433),
      database,
      user,
      password,
      options: {
        encrypt: envBool(process.env.MASTER_DB_ENCRYPT, false),
        trustServerCertificate: envBool(process.env.MASTER_DB_TRUST_SERVER_CERTIFICATE, true),
      },
      pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
    };
  };

  const pad2 = (n) => String(n).padStart(2, '0');
  const toYmd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const parseHHMM = (hhmm) => {
    const m = /^(\d{2}):(\d{2})$/.exec(String(hhmm || '').trim());
    if (!m) return null;
    return { hh: Number(m[1]), mm: Number(m[2]) };
  };

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  const pickColumn = (columns, candidates) => {
    const map = new Map(columns.map((c) => [String(c).toLowerCase(), String(c)]));
    for (const cand of candidates) {
      const hit = map.get(String(cand).toLowerCase());
      if (hit) return hit;
    }
    return null;
  };

  const pickSchemaForTable = async (pool, tableName) => {
    const req = pool.request();
    req.input('table', sql.VarChar(128), String(tableName));
    const r = await req.query(
      `SELECT TOP 1 TABLE_SCHEMA AS schema_name
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_NAME = @table
       ORDER BY CASE WHEN TABLE_SCHEMA = 'dbo' THEN 0 ELSE 1 END, TABLE_SCHEMA`
    );
    const row = r?.recordset?.[0] || null;
    return row?.schema_name ? String(row.schema_name) : null;
  };

  const normRole = (v) =>
    String(v ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase();

  const isManagerRole = (role) => {
    const r = normRole(role);
    if (!r) return false;
    if (r === 'GM') return true;
    if (r === 'MANAGER') return true;
    if (r === 'SR MANAGER' || r === 'SR. MANAGER' || r === 'SENIOR MANAGER') return true;
    if (r.includes('SENIOR') && r.includes('MANAGER')) return true;
    if (r.includes('SR') && r.includes('MANAGER')) return true;
    return false;
  };

  const runOnce = async () => {
    const cfg = gymDbConfig();
    if (!cfg) return { nextIntervalMs: 60000 };

    const now = new Date();
    const todayStr = toYmd(now);

    const pool = await new sql.ConnectionPool(cfg).connect();
    await pool.request().query(`IF OBJECT_ID('dbo.gym_controller_settings','U') IS NULL BEGIN
      CREATE TABLE dbo.gym_controller_settings (
        Id INT NOT NULL CONSTRAINT PK_gym_controller_settings PRIMARY KEY,
        EnableAutoOrganize BIT NOT NULL CONSTRAINT DF_gym_controller_settings_EnableAutoOrganize DEFAULT 0,
        EnableManagerAllSessionAccess BIT NOT NULL CONSTRAINT DF_gym_controller_settings_EnableManagerAllSessionAccess DEFAULT 0,
        GraceBeforeMin INT NOT NULL CONSTRAINT DF_gym_controller_settings_GraceBeforeMin DEFAULT 0,
        GraceAfterMin INT NOT NULL CONSTRAINT DF_gym_controller_settings_GraceAfterMin DEFAULT 0,
        WorkerIntervalMs INT NOT NULL CONSTRAINT DF_gym_controller_settings_WorkerIntervalMs DEFAULT 60000,
        CreatedAt DATETIME NOT NULL CONSTRAINT DF_gym_controller_settings_CreatedAt DEFAULT GETDATE(),
        UpdatedAt DATETIME NULL
      );
    END`);
    await pool.request().query(`IF COL_LENGTH('dbo.gym_controller_settings', 'EnableManagerAllSessionAccess') IS NULL BEGIN
      ALTER TABLE dbo.gym_controller_settings ADD EnableManagerAllSessionAccess BIT NOT NULL CONSTRAINT DF_gym_controller_settings_EnableManagerAllSessionAccess DEFAULT 0;
    END`);
    await pool.request().query(`IF COL_LENGTH('dbo.gym_controller_settings', 'GraceBeforeMin') IS NULL BEGIN
      ALTER TABLE dbo.gym_controller_settings ADD GraceBeforeMin INT NOT NULL CONSTRAINT DF_gym_controller_settings_GraceBeforeMin DEFAULT 0;
    END`);
    await pool.request().query(`IF COL_LENGTH('dbo.gym_controller_settings', 'GraceAfterMin') IS NULL BEGIN
      ALTER TABLE dbo.gym_controller_settings ADD GraceAfterMin INT NOT NULL CONSTRAINT DF_gym_controller_settings_GraceAfterMin DEFAULT 0;
    END`);
    await pool.request().query(`IF COL_LENGTH('dbo.gym_controller_settings', 'WorkerIntervalMs') IS NULL BEGIN
      ALTER TABLE dbo.gym_controller_settings ADD WorkerIntervalMs INT NOT NULL CONSTRAINT DF_gym_controller_settings_WorkerIntervalMs DEFAULT 60000;
    END`);
    await pool.request().query(`IF NOT EXISTS (SELECT 1 FROM dbo.gym_controller_settings WHERE Id = 1)
      INSERT INTO dbo.gym_controller_settings (Id, EnableAutoOrganize) VALUES (1, 0)`);

    const settingsRow = await pool.request().query(
      `SELECT TOP 1 EnableAutoOrganize, EnableManagerAllSessionAccess, GraceBeforeMin, GraceAfterMin, WorkerIntervalMs FROM dbo.gym_controller_settings WHERE Id = 1`
    );
    const settings = settingsRow?.recordset?.[0] || null;
    const enabled = settings?.EnableAutoOrganize ? true : false;
    const enableManagerAllSessionAccess = settings?.EnableManagerAllSessionAccess ? true : false;
    const graceBeforeMin = clamp(Number(settings?.GraceBeforeMin ?? 0) || 0, 0, 24 * 60);
    const graceAfterMin = clamp(Number(settings?.GraceAfterMin ?? 0) || 0, 0, 24 * 60);
    const intervalMsRaw =
      Number(settings?.WorkerIntervalMs ?? NaN) ||
      Number(process.env.GYM_AUTO_ORGANIZE_WORKER_INTERVAL_MS || 60000) ||
      60000;
    const nextIntervalMs = clamp(intervalMsRaw, 5000, 60 * 60 * 1000);

    const tzAllow = envTrim(process.env.GYM_ACCESS_TZ_ALLOW) || '01';
    const tzDeny = envTrim(process.env.GYM_ACCESS_TZ_DENY) || '00';
    const unitFallback = (envTrim(process.env.GYM_UNIT_FILTER) || envTrim(process.env.GYM_UNIT_NO) || '').split(',')[0]?.trim() || '';
    const unitNo = envTrim(process.env.GYM_CONTROLLER_UNIT_NO) || unitFallback || '0031';

    await pool.request().query(`IF OBJECT_ID('dbo.gym_controller_access_override','U') IS NULL BEGIN
      CREATE TABLE dbo.gym_controller_access_override (
        EmployeeID VARCHAR(20) NOT NULL,
        UnitNo VARCHAR(20) NOT NULL,
        CustomAccessTZ VARCHAR(2) NOT NULL,
        UpdatedAt DATETIME NOT NULL CONSTRAINT DF_gym_controller_access_override_UpdatedAt DEFAULT GETDATE(),
        CONSTRAINT PK_gym_controller_access_override PRIMARY KEY (EmployeeID, UnitNo)
      );
    END`);

    await pool.request().query(`IF OBJECT_ID('dbo.gym_access_committee','U') IS NULL BEGIN
      CREATE TABLE dbo.gym_access_committee (
        EmployeeID VARCHAR(20) NOT NULL,
        UnitNo VARCHAR(20) NOT NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_gym_access_committee_IsActive DEFAULT 1,
        CreatedAt DATETIME NOT NULL CONSTRAINT DF_gym_access_committee_CreatedAt DEFAULT GETDATE(),
        UpdatedAt DATETIME NULL,
        CONSTRAINT PK_gym_access_committee PRIMARY KEY (EmployeeID, UnitNo)
      );
    END`);

    const overridesRes = await pool
      .request()
      .input('unit', sql.VarChar(20), unitNo)
      .query(`SELECT EmployeeID, CustomAccessTZ FROM dbo.gym_controller_access_override WHERE UnitNo = @unit`);
    const overrideMap = new Map(
      (Array.isArray(overridesRes?.recordset) ? overridesRes.recordset : []).map((r) => [
        String(r.EmployeeID).trim(),
        String(r.CustomAccessTZ).trim(),
      ])
    );

    const committeeRes = await pool
      .request()
      .input('unit', sql.VarChar(20), unitNo)
      .query(`SELECT EmployeeID FROM dbo.gym_access_committee WHERE UnitNo = @unit AND IsActive = 1`);

    const alwaysAllow = new Set(
      (Array.isArray(committeeRes?.recordset) ? committeeRes.recordset : [])
        .map((r) => String(r.EmployeeID ?? '').trim())
        .filter(Boolean)
    );

    if (enableManagerAllSessionAccess) {
      try {
        const masterCfg = masterDbConfig();
        if (masterCfg) {
          const masterPool = await new sql.ConnectionPool(masterCfg).connect();
          const employmentSchema = await pickSchemaForTable(masterPool, 'employee_employment');
          if (employmentSchema) {
            const colsRes = await masterPool.request().query(
              `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'employee_employment' AND TABLE_SCHEMA = '${employmentSchema.replace(/'/g, "''")}'`
            );
            const cols = (colsRes?.recordset || []).map((x) => String(x.COLUMN_NAME));
            const empIdCol = pickColumn(cols, ['employee_id', 'EmployeeID', 'emp_id', 'EmpID', 'StaffNo', 'staff_no']);
            const roleCol = pickColumn(cols, [
              'grade',
              'Grade',
              'job_grade',
              'JobGrade',
              'job_title',
              'JobTitle',
              'title',
              'Title',
              'position',
              'Position',
              'job_position',
              'JobPosition',
              'level',
              'Level',
              'band',
              'Band',
              'rank',
              'Rank',
            ]);
            const statusCol = pickColumn(cols, ['status', 'Status', 'employment_status', 'EmploymentStatus', 'is_active', 'IsActive', 'active', 'Active']);
            const endDateCol = pickColumn(cols, ['end_date', 'EndDate', 'enddate', 'termination_date', 'TerminationDate']);
            const startDateCol = pickColumn(cols, ['start_date', 'StartDate', 'startdate', 'effective_date', 'EffectiveDate']);

            if (empIdCol && roleCol) {
              const today = new Date(todayStr);
              const reqEmp = masterPool.request();
              if (statusCol) reqEmp.input('active', sql.VarChar(50), 'ACTIVE');
              reqEmp.input('today', sql.Date, today);
              const whereParts = [];
              if (statusCol) whereParts.push(`UPPER(LTRIM(RTRIM([${statusCol}]))) = UPPER(@active)`);
              if (endDateCol) whereParts.push(`([${endDateCol}] IS NULL OR [${endDateCol}] >= @today)`);
              if (startDateCol) whereParts.push(`([${startDateCol}] IS NULL OR [${startDateCol}] <= @today)`);
              whereParts.push(
                `(UPPER(LTRIM(RTRIM([${roleCol}]))) IN ('MANAGER','GM','SR MANAGER','SR. MANAGER','SENIOR MANAGER')
                  OR UPPER(LTRIM(RTRIM([${roleCol}]))) LIKE '%SR%MANAGER%'
                  OR UPPER(LTRIM(RTRIM([${roleCol}]))) LIKE '%SENIOR%MANAGER%')`
              );

              const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
              const q = `SELECT TOP 5000 [${empIdCol}] AS employee_id, [${roleCol}] AS role_value FROM [${employmentSchema}].[employee_employment] ${whereSql}`;
              const r = await reqEmp.query(q);
              const rows = Array.isArray(r?.recordset) ? r.recordset : [];
              for (const row of rows) {
                const employeeId = String(row.employee_id ?? '').trim();
                if (!employeeId) continue;
                if (isManagerRole(row.role_value)) alwaysAllow.add(employeeId);
              }
            }
          }
          await masterPool.close();
        }
      } catch (_) {
      }
    }

    if (!enabled && alwaysAllow.size === 0) {
      await pool.close();
      return { nextIntervalMs };
    }

    const bookingMap = new Map();
    if (enabled) {
      const reqBookings = pool.request();
      reqBookings.input('today', sql.Date, new Date(todayStr));
      const bookingsRes = await reqBookings.query(
        `SELECT
          gb.EmployeeID AS employee_id,
          gb.CardNo AS card_no,
          CONVERT(varchar(5), s.StartTime, 108) AS time_start,
          CONVERT(varchar(5), s.EndTime, 108) AS time_end
        FROM dbo.gym_booking gb
        LEFT JOIN dbo.gym_schedule s ON s.ScheduleID = gb.ScheduleID
        WHERE gb.BookingDate = @today
          AND gb.Status IN ('BOOKED','CHECKIN','COMPLETED')`
      );

      const rows = Array.isArray(bookingsRes?.recordset) ? bookingsRes.recordset : [];
      for (const row of rows) {
        const employeeId = String(row.employee_id ?? '').trim();
        if (!employeeId) continue;
        if (alwaysAllow.has(employeeId)) continue;

        const start = parseHHMM(row.time_start);
        if (!start) continue;
        const end = parseHHMM(row.time_end);

        const startAtRaw = new Date(now.getFullYear(), now.getMonth(), now.getDate(), start.hh, start.mm, 0, 0);
        const endAtRaw = end
          ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), end.hh, end.mm, 0, 0)
          : new Date(startAtRaw.getTime() + 60 * 60 * 1000);

        const startAt = new Date(startAtRaw.getTime() - graceBeforeMin * 60 * 1000);
        const endAt = new Date(endAtRaw.getTime() + graceAfterMin * 60 * 1000);

        const inRange = now.getTime() >= startAt.getTime() && now.getTime() <= endAt.getTime();
        const prev = bookingMap.get(employeeId) || { inRange: false, card_no: null };
        bookingMap.set(employeeId, {
          inRange: Boolean(prev.inRange || inRange),
          card_no: prev.card_no || (row.card_no != null ? String(row.card_no).trim() : null),
        });
      }
    }

    await pool.close();

    const updateEmployeeAccess = async (employeeId, allow, cardNo) => {
      const desiredTz = allow ? tzAllow : tzDeny;
      const currentTz = overrideMap.get(employeeId) || null;
      if (currentTz === desiredTz) return;
      const body = {
        employee_id: employeeId,
        access: allow ? true : false,
        unit_no: unitNo,
        card_no: cardNo ? String(cardNo).trim() : undefined,
      };

      try {
        const resp = await fetch(`http://localhost:${PORT}/gym-controller-access`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = await resp.json().catch(() => null);
        if (json?.ok) overrideMap.set(employeeId, desiredTz);
      } catch (_) {
      }
    };

    for (const employeeId of alwaysAllow) {
      await updateEmployeeAccess(employeeId, true, null);
    }

    if (enabled) {
      const allEmployeeIds = new Set([...overrideMap.keys(), ...bookingMap.keys(), ...alwaysAllow]);
      for (const employeeId of allEmployeeIds) {
        if (!employeeId) continue;
        if (alwaysAllow.has(employeeId)) continue;
        const booking = bookingMap.get(employeeId) || null;
        const allow = booking ? Boolean(booking.inRange) : false;
        await updateEmployeeAccess(employeeId, allow, booking?.card_no || null);
      }
    }

    return { nextIntervalMs };
  };

  const loop = async () => {
    if (running) return;
    running = true;
    let nextIntervalMs = 60000;
    try {
      const r = await runOnce();
      nextIntervalMs = Number(r?.nextIntervalMs || 60000);
    } catch (_) {
      nextIntervalMs = 60000;
    } finally {
      running = false;
      setTimeout(loop, clamp(nextIntervalMs, 5000, 60 * 60 * 1000));
    }
  };

  setTimeout(loop, 5000);
}

const enableReportsAutoSync = String(process.env.GYM_REPORTS_SYNC_ENABLE || '1').trim().toLowerCase();
if (['1', 'true', 'yes', 'y'].includes(enableReportsAutoSync)) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const today = new Date();
      const pad2 = (n) => String(n).padStart(2, '0');
      const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      for (let i = 0; i < 7; i++) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
        const day = ymd(d);
        const url = `http://localhost:${PORT}/gym-reports-sync?from=${encodeURIComponent(day)}&to=${encodeURIComponent(day)}`;
        try {
          const r = await fetch(url, { method: 'POST' });
          await r.text();
        } catch (_) {}
      }
    } catch (_) {
    } finally {
      running = false;
      setTimeout(tick, 20000);
    }
  };
  setTimeout(tick, 10000);
}
