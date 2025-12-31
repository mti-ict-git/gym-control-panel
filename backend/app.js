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
  const intervalMs = Number(process.env.GYM_AUTO_ORGANIZE_WORKER_INTERVAL_MS || 60000);
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

  const pad2 = (n) => String(n).padStart(2, '0');
  const toYmd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const parseHHMM = (hhmm) => {
    const m = /^(\d{2}):(\d{2})$/.exec(String(hhmm || '').trim());
    if (!m) return null;
    return { hh: Number(m[1]), mm: Number(m[2]) };
  };

  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const cfg = gymDbConfig();
      if (!cfg) return;

      const now = new Date();
      const todayStr = toYmd(now);

      const pool = await new sql.ConnectionPool(cfg).connect();
      await pool.request().query(`IF OBJECT_ID('dbo.gym_controller_settings','U') IS NULL BEGIN
        CREATE TABLE dbo.gym_controller_settings (
          Id INT NOT NULL CONSTRAINT PK_gym_controller_settings PRIMARY KEY,
          EnableAutoOrganize BIT NOT NULL CONSTRAINT DF_gym_controller_settings_EnableAutoOrganize DEFAULT 0,
          CreatedAt DATETIME NOT NULL CONSTRAINT DF_gym_controller_settings_CreatedAt DEFAULT GETDATE(),
          UpdatedAt DATETIME NULL
        );
      END`);
      await pool.request().query(`IF NOT EXISTS (SELECT 1 FROM dbo.gym_controller_settings WHERE Id = 1)
        INSERT INTO dbo.gym_controller_settings (Id, EnableAutoOrganize) VALUES (1, 0)`);

      const settingsRow = await pool.request().query(`SELECT TOP 1 EnableAutoOrganize FROM dbo.gym_controller_settings WHERE Id = 1`);
      const enabled = settingsRow?.recordset?.[0]?.EnableAutoOrganize ? true : false;
      if (!enabled) {
        await pool.close();
        return;
      }

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

      const overridesRes = await pool.request().input('unit', sql.VarChar(20), unitNo).query(
        `SELECT EmployeeID, CustomAccessTZ FROM dbo.gym_controller_access_override WHERE UnitNo = @unit`
      );
      const overrideMap = new Map(
        (Array.isArray(overridesRes?.recordset) ? overridesRes.recordset : []).map((r) => [String(r.EmployeeID).trim(), String(r.CustomAccessTZ).trim()])
      );

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
      await pool.close();

      const rows = Array.isArray(bookingsRes?.recordset) ? bookingsRes.recordset : [];
      for (const row of rows) {
        const employeeId = String(row.employee_id ?? '').trim();
        if (!employeeId) continue;

        const start = parseHHMM(row.time_start);
        if (!start) continue;
        const end = parseHHMM(row.time_end);

        const startAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), start.hh, start.mm, 0, 0);
        const endAt = end
          ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), end.hh, end.mm, 0, 0)
          : new Date(startAt.getTime() + 60 * 60 * 1000);

        const inRange = now.getTime() >= startAt.getTime() && now.getTime() <= endAt.getTime();
        const desiredTz = inRange ? tzAllow : tzDeny;
        const currentTz = overrideMap.get(employeeId) || null;
        if (currentTz === desiredTz) continue;

        const body = {
          employee_id: employeeId,
          access: inRange ? true : false,
          unit_no: unitNo,
          card_no: row.card_no != null ? String(row.card_no).trim() : undefined,
        };

        try {
          const resp = await fetch(`http://localhost:${PORT}/gym-controller-access`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const json = await resp.json().catch(() => null);
          if (json?.ok) {
            overrideMap.set(employeeId, desiredTz);
          }
        } catch (_) {
        }
      }
    } catch (_) {
    } finally {
      running = false;
    }
  }, Number.isFinite(intervalMs) && intervalMs >= 5000 ? intervalMs : 60000);
}
