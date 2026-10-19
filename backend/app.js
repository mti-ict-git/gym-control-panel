import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sql from 'mssql';
import jwt from 'jsonwebtoken';
import testerRouter from './routes/tester.js';
import masterRouter from './routes/master.js';
import gymRouter from './routes/gym.js';
import authRouter from './routes/auth.js';
import settingsRouter from './routes/settings.js';
import auditRouter from './routes/audit.js';
import { envBool, envTrim, envInt, startOfDayUtcDateForOffsetMinutes } from './lib/env.js';
import { recordAudit } from './lib/audit.js';
import { enforcedBanExistsSql, committeeExemptSql, managerExemptSql, titleManagerSql } from './lib/gymBan.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const sseClients = new Set();
const accessEvents = [];
const pushAccessEvent = (evt) => {
  try {
    accessEvents.push(evt);
    if (accessEvents.length > 500) accessEvents.shift();
    const data = `data: ${JSON.stringify(evt)}\n\n`;
    for (const res of sseClients) {
      res.write(data);
    }
  } catch (_) {}
};

app.get('/api/gym-access-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  for (const evt of accessEvents) {
    res.write(`data: ${JSON.stringify(evt)}\n\n`);
  }
  sseClients.add(res);
  req.on('close', () => {
    try {
      sseClients.delete(res);
    } catch (_) {}
  });
});

app.get('/gym-access-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  for (const evt of accessEvents) {
    res.write(`data: ${JSON.stringify(evt)}\n\n`);
  }
  sseClients.add(res);
  req.on('close', () => {
    try {
      sseClients.delete(res);
    } catch (_) {}
  });
});

// Outcome of the most recent proactive ban scan. Kept apart from accessEvents because that
// ring buffer rotates in about two minutes, and the scan only runs every 6h: its failure
// went unnoticed for months while it lived only in the process console.
let lastBanScan = null;

app.get('/api/gym-access-log', (_req, res) => {
  res.json({ ok: true, events: accessEvents.slice(-200), ban_scan: lastBanScan });
});

app.get('/gym-access-log', (_req, res) => {
  res.json({ ok: true, events: accessEvents.slice(-200), ban_scan: lastBanScan });
});

// Support both /api prefix and root-level routes to tolerate different proxy setups
app.use('/api', testerRouter);
app.use('/api', masterRouter);
app.use('/api', gymRouter);
app.use('/api', authRouter);
app.use('/api', settingsRouter);
app.use('/api', auditRouter);
app.use(testerRouter);
app.use(masterRouter);
app.use(gymRouter);
app.use(authRouter);
app.use(settingsRouter);
app.use(auditRouter);

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
      const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
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
  const formatGmtPlus8 = (date) => {
    const base = date instanceof Date ? date : new Date();
    const shifted = new Date(base.getTime() + 8 * 60 * 60 * 1000);
    const p = (n) => String(n).padStart(2, '0');
    return `${shifted.getUTCFullYear()}-${p(shifted.getUTCMonth() + 1)}-${p(shifted.getUTCDate())} ${p(shifted.getUTCHours())}:${p(shifted.getUTCMinutes())}:${p(shifted.getUTCSeconds())} GMT+8`;
  };
  const parseHHMM = (hhmm) => {
    const m = /^(\d{2}):(\d{2})$/.exec(String(hhmm || '').trim());
    if (!m) return null;
    return { hh: Number(m[1]), mm: Number(m[2]) };
  };

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

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

  const lastRequiredState = new Map();
  const notRequiredStreak = new Map();
  // The pool a tick opened, so the tick loop can close it when a query throws mid-tick
  // (runOnce used to leak one connection pool per failed tick).
  let workerPool = null;

  // Employee IDs are compared case-insensitively by SQL Server but not by a JS Map, and the
  // override table does hold rows like 'mti260029' next to bookings for 'MTI260029'. Keyed
  // raw, the worker saw two people: it granted one key and revoked the other, on the same
  // card, every tick. Every map below is keyed through this.
  const empKey = (v) => String(v ?? '').trim().toUpperCase();

  // A revoke that fails (Vault down, card missing, timeout) used to be forgotten: the
  // override stayed at the allow TZ and the door stayed open around the clock, with no
  // booking needed. Revokes are now retried, but with backoff, so a card that can never be
  // revoked does not cost an 8s Vault timeout on every tick.
  const revokeBackoff = new Map();
  const revokeDue = (id) => {
    const b = revokeBackoff.get(id);
    return !b || Date.now() >= b.nextAt;
  };
  const noteRevoke = (id, ok) => {
    if (ok) {
      revokeBackoff.delete(id);
      return;
    }
    const fails = Math.min((revokeBackoff.get(id)?.fails || 0) + 1, 5);
    revokeBackoff.set(id, { fails, nextAt: Date.now() + 60_000 * 2 ** (fails - 1) });
  };

  const runOnce = async () => {
    const cfg = gymDbConfig();
    if (!cfg) return { nextIntervalMs: 60000 };

    const tzOffsetMinutes = envInt(process.env.GYM_TZ_OFFSET_MINUTES, 8 * 60);
    const nowUtcMs = Date.now();
    const nowInTz = new Date(nowUtcMs + tzOffsetMinutes * 60_000);
    const todayDate = startOfDayUtcDateForOffsetMinutes(tzOffsetMinutes);
    const todayStr = `${nowInTz.getUTCFullYear()}-${String(nowInTz.getUTCMonth() + 1).padStart(2, '0')}-${String(nowInTz.getUTCDate()).padStart(2, '0')}`;
    const yestInTz = new Date(nowInTz.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = `${yestInTz.getUTCFullYear()}-${String(yestInTz.getUTCMonth() + 1).padStart(2, '0')}-${String(yestInTz.getUTCDate()).padStart(2, '0')}`;
    const toUtcMsForTzDateTime = (baseDateUtc, hh, mm) => {
      return Date.UTC(baseDateUtc.getUTCFullYear(), baseDateUtc.getUTCMonth(), baseDateUtc.getUTCDate(), hh, mm, 0, 0) - tzOffsetMinutes * 60_000;
    };
    const parseYmdToUtcDate = (ymd) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
      if (!m) return null;
      return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0));
    };

    const pool = await new sql.ConnectionPool(cfg).connect();
    workerPool = pool;
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
        Source VARCHAR(20) NOT NULL CONSTRAINT DF_gym_controller_access_override_Source DEFAULT 'MANUAL',
        UpdatedAt DATETIME NOT NULL CONSTRAINT DF_gym_controller_access_override_UpdatedAt DEFAULT GETDATE(),
        CONSTRAINT PK_gym_controller_access_override PRIMARY KEY (EmployeeID, UnitNo)
      );
    END`);

    await pool.request().query(`IF COL_LENGTH('dbo.gym_controller_access_override','Source') IS NULL BEGIN
      ALTER TABLE dbo.gym_controller_access_override ADD Source VARCHAR(20) NOT NULL CONSTRAINT DF_gym_controller_access_override_Source DEFAULT 'MANUAL';
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
      .query(`SELECT EmployeeID, CustomAccessTZ, UpdatedAt, Source FROM dbo.gym_controller_access_override WHERE UnitNo = @unit`);
    const overrideMap = new Map(
      (Array.isArray(overridesRes?.recordset) ? overridesRes.recordset : []).map((r) => [
        empKey(r.EmployeeID),
        {
          tz: String(r.CustomAccessTZ).trim(),
          updatedAt: r?.UpdatedAt ? new Date(r.UpdatedAt).toISOString() : null,
          source: r?.Source != null ? String(r.Source).trim() : 'MANUAL',
        },
      ])
    );

    const committeeRes = await pool
      .request()
      .input('unit', sql.VarChar(20), unitNo)
      .query(`SELECT EmployeeID FROM dbo.gym_access_committee WHERE UnitNo = @unit AND IsActive = 1`);

    const alwaysAllow = new Set(
      (Array.isArray(committeeRes?.recordset) ? committeeRes.recordset : [])
        .map((r) => empKey(r.EmployeeID))
        .filter(Boolean)
    );

    console.log('[gym-worker] sources', {
      overrides: overrideMap.size,
      always_allow: alwaysAllow.size,
    });

    if (enableManagerAllSessionAccess) {
      let masterPool = null;
      try {
        const masterCfg = masterDbConfig();
        if (masterCfg) {
          masterPool = await new sql.ConnectionPool(masterCfg).connect();
          const employmentSchema = await pickSchemaForTable(masterPool, 'employee_employment');
          if (employmentSchema) {
            // Same title rule the ban exemption uses (lib/gymBan.js), so everyone let in
            // around the clock here is also exempt from bans - never "banned" while this
            // list keeps opening the door for them.
            const r = await masterPool.request().query(
              `SELECT TOP 5000 em.employee_id
               FROM [${employmentSchema.replace(/]/g, ']]')}].[employee_employment] em
               WHERE UPPER(LTRIM(RTRIM(ISNULL(em.status, '')))) = 'ACTIVE'
                 AND ${titleManagerSql('em')}`
            );
            for (const row of r?.recordset || []) {
              const employeeId = empKey(row.employee_id);
              if (employeeId) alwaysAllow.add(employeeId);
            }
          }
        }
      } catch (_) {
      } finally {
        if (masterPool) await masterPool.close().catch(() => {});
      }
    }

    if (!enabled && alwaysAllow.size === 0) {
      await pool.close();
      workerPool = null;
      return { nextIntervalMs };
    }

    const bookingMap = new Map();
    // People banned right now. The door is the only place a ban actually bites: a booking
    // that outlived its owner's ban (the scanner never cancelled any) used to be honoured
    // here, and banned employees walked in. Read separately and fail OPEN - with no ban
    // list this tick the worker behaves as it did before, rather than refusing everyone.
    const bannedSet = new Set();
    // False when the list came from the fallback query without the manager exemption. It
    // is then still good enough to withhold booking grants, but not to take a door away:
    // an exempt manager with a leftover ban row would be revoked on every database blip.
    let banListExact = false;
    if (enabled) {
      const readBanned = async (withManagerExemption) => {
        const r = await pool
          .request()
          .input('todayStr', sql.VarChar(10), todayStr)
          .input('unit', sql.VarChar(20), unitNo)
          .query(
            `SELECT DISTINCT b0.EmployeeID FROM dbo.gym_booking_ban b0
             WHERE ${enforcedBanExistsSql('b0.EmployeeID', 'CONVERT(date, @todayStr)', '@unit', { withManagerExemption })}`
          );
        for (const row of r?.recordset || []) {
          const id = empKey(row.EmployeeID);
          if (id && !alwaysAllow.has(id)) bannedSet.add(id);
        }
      };
      try {
        await readBanned(true);
        banListExact = true;
      } catch (e) {
        // The manager exemption reads MTIMasterEmployeeDB; don't let that database take
        // ban enforcement down with it.
        console.log('[gym-worker] ban list with manager exemption failed, retrying without:', e?.message || String(e));
        try {
          await readBanned(false);
        } catch (e2) {
          console.log('[gym-worker] ban list unavailable this tick:', e2?.message || String(e2));
        }
      }

      const reqBookings = pool.request();
      reqBookings.input('todayStr', sql.VarChar(10), todayStr);
      reqBookings.input('yesterdayStr', sql.VarChar(10), yesterdayStr);
      reqBookings.input('entryPat', sql.VarChar(120), `%${(envTrim(process.env.GYM_ENTRY_EVENT) || 'VALID ENTRY ACCESS').toUpperCase()}%`);
      // A REJECTED booking must not open the door either; PENDING/NULL still do (older
      // bookings were created PENDING and the approval step is otherwise advisory).
      const bookingsRes = await reqBookings.query(
        `SELECT
          gb.EmployeeID AS employee_id,
          gb.CardNo AS card_no,
          gb.Department AS department,
          gb.ApprovalStatus AS approval_status,
          gb.Status AS status,
          CONVERT(varchar(10), gb.BookingDate, 23) AS booking_date,
          CONVERT(varchar(5), s.StartTime, 108) AS time_start,
          CONVERT(varchar(5), s.EndTime, 108) AS time_end,
          CASE WHEN EXISTS (
            SELECT 1 FROM dbo.gym_live_taps t
            WHERE t.EmployeeID = gb.EmployeeID
              AND CONVERT(date, t.TxnTime) = gb.BookingDate
              AND UPPER(CAST(t.[Transaction] AS varchar(100))) LIKE @entryPat
          ) THEN 1 ELSE 0 END AS attended
        FROM dbo.gym_booking gb
        LEFT JOIN dbo.gym_schedule s ON s.ScheduleID = gb.ScheduleID
        WHERE CONVERT(varchar(10), gb.BookingDate, 23) IN (@todayStr, @yesterdayStr)
          AND gb.Status IN ('BOOKED','CHECKIN','COMPLETED')
          AND ISNULL(gb.ApprovalStatus, '') <> 'REJECTED'`
      );

      const rows = Array.isArray(bookingsRes?.recordset) ? bookingsRes.recordset : [];
      for (const row of rows) {
        const employeeId = empKey(row.employee_id);
        if (!employeeId) continue;
        if (alwaysAllow.has(employeeId)) continue;
        // A banned person gets no door from a booking - except the session they are
        // already in (checked in, or tapped in that day). The scanner leaves exactly those
        // bookings alone too, so a ban landing mid-session cannot shut someone out halfway.
        const alreadyInside = String(row.status || '').toUpperCase() === 'CHECKIN' || Number(row.attended) === 1;
        if (bannedSet.has(employeeId) && !alreadyInside) continue;

        const start = parseHHMM(row.time_start);
        if (!start) continue;
        const end = parseHHMM(row.time_end);

        const baseDate = parseYmdToUtcDate(row.booking_date) || new Date(Date.UTC(nowInTz.getUTCFullYear(), nowInTz.getUTCMonth(), nowInTz.getUTCDate(), 0, 0, 0, 0));
        const startAtRawUtcMs = toUtcMsForTzDateTime(baseDate, start.hh, start.mm);
        let endAtRawUtcMs = end ? toUtcMsForTzDateTime(baseDate, end.hh, end.mm) : startAtRawUtcMs + 60 * 60_000;
        if (endAtRawUtcMs <= startAtRawUtcMs) {
          endAtRawUtcMs += 24 * 60 * 60_000;
        }
        const startAtUtcMs = startAtRawUtcMs - graceBeforeMin * 60_000;
        const endAtUtcMs = endAtRawUtcMs + graceAfterMin * 60_000;

        const inRange = nowUtcMs >= startAtUtcMs && nowUtcMs <= endAtUtcMs;
        const prev = bookingMap.get(employeeId) || { inRange: false, card_no: null };
        bookingMap.set(employeeId, {
          inRange: Boolean(prev.inRange || inRange),
          card_no: prev.card_no || (row.card_no != null ? String(row.card_no).trim() : null),
        });
      }
    }

    await pool.close();
    workerPool = null;

    console.log('[gym-worker] today_bookings_rows', {
      rows: typeof bookingsRes !== 'undefined' && Array.isArray(bookingsRes?.recordset) ? bookingsRes.recordset.length : 0,
    });

    const grantRefreshMaxAgeMs = clamp(
      envInt(process.env.GYM_GRANT_REFRESH_MAX_AGE_MS, 5 * 60 * 1000),
      60 * 1000,
      24 * 60 * 60 * 1000
    );

    // A single tick can spuriously read "not required" (transient DB hiccup, a booking
    // row briefly missing its schedule join, etc.) even mid-session. Require the same
    // negative reading on this many consecutive ticks before actually revoking access,
    // so one bad tick can't lock someone out of a session they're still booked for.
    const pruneConfirmTicks = clamp(envInt(process.env.GYM_PRUNE_CONFIRM_TICKS, 2), 1, 10);

    const updateEmployeeAccess = async (employeeId, allow, cardNo, source, opts = {}) => {
      const desiredTz = allow ? tzAllow : tzDeny;
      const current = overrideMap.get(employeeId) || null;
      const currentTz = current && typeof current === 'object' ? current.tz : (current || null);
      const updatedAt = current && typeof current === 'object' ? current.updatedAt : null;
      if (currentTz === desiredTz) {
        const envMaxAge = Number(process.env.GYM_CONTROLLER_ACCESS_MAX_AGE_MS || 10 * 60 * 1000);
        const maxAgeMs = Number.isFinite(Number(opts?.maxAgeMs)) ? Number(opts.maxAgeMs) : envMaxAge;
        const recent = updatedAt ? (Date.now() - new Date(updatedAt).getTime()) < maxAgeMs : false;
        if (recent) return true;
      }
      console.log('[gym-worker] attempt', {
        employee_id: employeeId,
        unit_no: unitNo,
        allow: Boolean(allow),
        tz: desiredTz,
        card_no: cardNo ? String(cardNo).trim() : null,
        source: source || 'WORKER',
      });
      pushAccessEvent({ t: new Date().toISOString(), type: 'attempt', employee_id: employeeId, allow: Boolean(allow), unit_no: unitNo, tz: desiredTz, card_no: cardNo ? String(cardNo).trim() : null });
      const body = {
        employee_id: employeeId,
        access: allow ? true : false,
        unit_no: unitNo,
        card_no: cardNo ? String(cardNo).trim() : undefined,
        source: source || 'WORKER',
      };

      try {
        const resp = await fetch(`http://localhost:${PORT}/gym-controller-access`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt.sign({ role: 'system', username: 'gym-worker' }, envTrim(process.env.JWT_SECRET), { expiresIn: '5m', issuer: 'gym-control' })}`,
          },
          body: JSON.stringify(body),
        });
        const json = await resp.json().catch(() => null);
        if (json?.ok) {
          overrideMap.set(employeeId, { tz: desiredTz, updatedAt: new Date().toISOString(), source: source || 'WORKER' });
          console.log('[gym-worker] success', {
            employee_id: employeeId,
            unit_no: unitNo,
            allow: Boolean(allow),
            tz: desiredTz,
          });
          pushAccessEvent({ t: new Date().toISOString(), type: 'success', employee_id: employeeId, allow: Boolean(allow), unit_no: unitNo, tz: desiredTz });
          // A fresh grant starts a new session: an old revoke backoff must not delay this
          // session's own revoke by up to 16 minutes.
          if (allow) revokeBackoff.delete(employeeId);
          return true;
        } else {
          console.log('[gym-worker] fail', {
            employee_id: employeeId,
            unit_no: unitNo,
            allow: Boolean(allow),
            tz: desiredTz,
            error: json && typeof json === 'object' ? String(json.error || '') : '',
          });
          pushAccessEvent({ t: new Date().toISOString(), type: 'fail', employee_id: employeeId, allow: Boolean(allow), unit_no: unitNo, tz: desiredTz, error: json && typeof json === 'object' ? String(json.error || '') : '' });
        }
      } catch (_) {
        const message = _ && typeof _ === 'object' && 'message' in _ ? String(_.message) : String(_);
        console.log('[gym-worker] error', {
          employee_id: employeeId,
          unit_no: unitNo,
          allow: Boolean(allow),
          tz: desiredTz,
          error: message,
        });
        pushAccessEvent({ t: new Date().toISOString(), type: 'error', employee_id: employeeId, allow: Boolean(allow), unit_no: unitNo, tz: desiredTz, error: message });
      }
      return false;
    };

    for (const employeeId of alwaysAllow) {
      pushAccessEvent({ t: new Date().toISOString(), type: 'always_allow', employee_id: employeeId, unit_no: unitNo });
      await updateEmployeeAccess(employeeId, true, null, 'WORKER');
    }

    if (enabled) {
      const allEmployeeIds = new Set([...overrideMap.keys(), ...bookingMap.keys(), ...alwaysAllow]);
      console.log('[gym-worker] evaluating_employees', { count: allEmployeeIds.size });
      for (const employeeId of allEmployeeIds) {
        if (!employeeId) continue;
        if (alwaysAllow.has(employeeId)) continue;
        const booking = bookingMap.get(employeeId) || null;
        const inRange = Boolean(booking?.inRange);
        const current = overrideMap.get(employeeId) || null;

        const currentTz = current && typeof current === 'object' ? current.tz : null;
        const currentSourceRaw = current && typeof current === 'object' ? current.source : null;
        const currentSource = currentSourceRaw != null ? String(currentSourceRaw).trim() : 'MANUAL';
        const isWorkerOverride = currentSource.toUpperCase() === 'WORKER';
      const updatedAt = current && typeof current === 'object' ? current.updatedAt : null;
      const legacyManualPruneMaxAgeMs = clamp(
        envInt(process.env.GYM_LEGACY_MANUAL_PRUNE_MAX_AGE_MS, 24 * 60 * 60 * 1000),
        5 * 60 * 1000,
        30 * 24 * 60 * 60 * 1000
      );
      const isLegacyManualOverride = currentSource.toUpperCase() === 'MANUAL';
      const legacyManualFresh = updatedAt
        ? Date.now() - new Date(updatedAt).getTime() <= legacyManualPruneMaxAgeMs
        : false;
      const isPrunableOverride = isWorkerOverride || (isLegacyManualOverride && legacyManualFresh);
        const hadAllowOverride = currentTz === tzAllow;

        // Banned: take the door away whatever put it there, a manual (MANUAL_LOCK) grant
        // included - that source is otherwise never pruned, so one click in the Vault page
        // outlived the ban. No debounce: the ban comes from its own query, so a flaky
        // bookings read cannot trigger this. Exempt roles never reach here (alwaysAllow).
        // Not while they are in the session they already entered (inRange is only true
        // for a banned person in that case - see the bookings loop); that ends by itself.
        if (bannedSet.has(employeeId) && !inRange) {
          // If they were inside last tick, that came from the bookings read, which can
          // flap (a row briefly missing its schedule join) - confirm like a normal prune.
          if (lastRequiredState.get(employeeId) === true) {
            const streak = (notRequiredStreak.get(employeeId) || 0) + 1;
            if (streak < pruneConfirmTicks) {
              notRequiredStreak.set(employeeId, streak);
              continue;
            }
          }
          notRequiredStreak.delete(employeeId);
          lastRequiredState.set(employeeId, false);
          if (banListExact && hadAllowOverride && revokeDue(employeeId)) {
            console.log('[gym-worker] ban_revoke', { employee_id: employeeId, unit_no: unitNo, source: currentSource });
            pushAccessEvent({ t: new Date().toISOString(), type: 'ban_revoke', employee_id: employeeId, unit_no: unitNo });
            noteRevoke(employeeId, await updateEmployeeAccess(employeeId, false, null, 'WORKER'));
          }
          continue;
        }

        const prevRequiredRaw = lastRequiredState.get(employeeId);
        // Also treat a still-open worker grant as "was required", even when memory says
        // otherwise: that is exactly the state a failed revoke leaves behind (the override
        // row is only rewritten on success), and without this nothing ever retried it.
        const prevRequired =
          prevRequiredRaw === undefined
            ? Boolean(hadAllowOverride)
            : Boolean(prevRequiredRaw) || (hadAllowOverride && isPrunableOverride);
        const nowRequired = Boolean(inRange);

        if (nowRequired) {
          notRequiredStreak.delete(employeeId);
          if (!prevRequired) {
            console.log('[gym-worker] grant', {
              employee_id: employeeId,
              unit_no: unitNo,
              card_no: booking?.card_no || null,
            });
            pushAccessEvent({ t: new Date().toISOString(), type: 'grant', employee_id: employeeId, unit_no: unitNo });
            await updateEmployeeAccess(employeeId, true, booking?.card_no || null, 'WORKER');
          } else {
            await updateEmployeeAccess(employeeId, true, booking?.card_no || null, 'WORKER', { maxAgeMs: grantRefreshMaxAgeMs });
          }
        } else if (prevRequired) {
          const streak = (notRequiredStreak.get(employeeId) || 0) + 1;
          if (streak < pruneConfirmTicks) {
            // Not confirmed yet — keep treating him as still required so next tick's
            // prevRequired stays true and a real grant edge isn't lost mid-debounce.
            notRequiredStreak.set(employeeId, streak);
            lastRequiredState.set(employeeId, true);
            continue;
          }
          notRequiredStreak.delete(employeeId);
          if (current && isPrunableOverride && revokeDue(employeeId)) {
            console.log('[gym-worker] prune', {
              employee_id: employeeId,
              unit_no: unitNo,
            });
            pushAccessEvent({ t: new Date().toISOString(), type: 'prune', employee_id: employeeId, unit_no: unitNo });
            noteRevoke(employeeId, await updateEmployeeAccess(employeeId, false, booking?.card_no || null, 'WORKER'));
          }
        }

        lastRequiredState.set(employeeId, nowRequired);
      }
    }

    return { nextIntervalMs };
  };

  const loop = async () => {
    if (running) return;
    running = true;
    let nextIntervalMs = 60000;
    try {
      pushAccessEvent({ t: new Date().toISOString(), type: 'worker_tick_start' });
      console.log('[gym-worker] running access grant/prune checking at', formatGmtPlus8(new Date()));
      const r = await runOnce();
      nextIntervalMs = Number(r?.nextIntervalMs || 60000);
    } catch (_) {
      nextIntervalMs = 60000;
    } finally {
      if (workerPool) {
        const p = workerPool;
        workerPool = null;
        await p.close().catch(() => {});
      }
      pushAccessEvent({ t: new Date().toISOString(), type: 'worker_tick_end', next_interval_ms: clamp(nextIntervalMs, 5000, 60 * 60 * 1000) });
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

/* Proactive Daily Ban Scanner */
const enableProactiveScan = String(process.env.GYM_AUTO_BAN_SCANNER_ENABLE || '1').trim().toLowerCase();
if (['1', 'true', 'yes', 'y'].includes(enableProactiveScan)) {
  let runningScan = false;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const isTransientDbError = (error) => {
    const code = String(error?.code || '').toUpperCase();
    if (['ETIMEOUT', 'ESOCKET', 'ECONNRESET', 'EPIPE', 'ECONNCLOSED', 'EABORT'].includes(code)) return true;
    const msg = String(error?.message || '').toLowerCase();
    return (
      msg.includes('deadlock') ||
      msg.includes('timeout') ||
      msg.includes('temporar') ||
      msg.includes('could not open a connection') ||
      msg.includes('connection is closed') ||
      msg.includes('transport-level error')
    );
  };
  const runProactiveScanQuery = async (pool, entryPattern, gymUnit) => {
    // The scan joins gym_grant_failure; on a fresh database it would not exist yet and
    // the whole scan would fail rather than just skipping that signal.
    await pool.request().query(
      `IF OBJECT_ID('dbo.gym_grant_failure','U') IS NULL BEGIN
         CREATE TABLE dbo.gym_grant_failure (
           Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
           EmployeeID VARCHAR(20) NOT NULL,
           UnitNo VARCHAR(20) NOT NULL,
           FailDate DATE NOT NULL,
           FailedAt DATETIME NOT NULL CONSTRAINT DF_gym_grant_failure_FailedAt DEFAULT GETDATE(),
           Reason VARCHAR(500) NULL
         );
       END`
    );
    // The scan can be the first thing to touch the ban table after an upgrade, so it
    // cannot assume the routes have added these columns yet.
    await pool.request().query(
      `IF COL_LENGTH('dbo.gym_booking_ban', 'BanCount') IS NULL
         ALTER TABLE dbo.gym_booking_ban ADD BanCount INT NOT NULL CONSTRAINT DF_gym_booking_ban_BanCount DEFAULT 0;
       IF COL_LENGTH('dbo.gym_booking_ban', 'LastBannedAt') IS NULL
         ALTER TABLE dbo.gym_booking_ban ADD LastBannedAt DATETIME NULL;`
    );
    const scanReq = pool.request();
    scanReq.input('entryPat', sql.VarChar(120), `%${entryPattern}%`);
    scanReq.input('gymUnit', sql.VarChar(20), String(gymUnit || '0031'));
    // XACT_ABORT + one transaction: the ban and its booking cancellation land together or
    // not at all. The old batch had no transaction, and its cancel referenced a CTE that
    // had already gone out of scope - an error TRY/CATCH cannot catch - so every run
    // committed the bans and then died before cancelling a single booking.
    const scanRes = await scanReq.query(`
      SET XACT_ABORT ON;
      BEGIN TRY
        DECLARE @today DATE = CONVERT(date, DATEADD(hour, 8, GETUTCDATE()));
        DECLARE @windowStart DATE = DATEADD(day, -7, @today);
        DECLARE @bansWritten INT = 0;
        DECLARE @bookingsCancelled INT = 0;
        -- Who was banned, not just how many: without this the scan's only trace is a
        -- count, and after an unban wipes the row nothing says the person was ever banned.
        DECLARE @banned TABLE (
          EmployeeID VARCHAR(20),
          BannedUntil DATE,
          ConsecutiveNoShow INT,
          BanCount INT
        );
        BEGIN TRAN;
        ;WITH Candidate AS (
          SELECT DISTINCT gb.EmployeeID
          FROM dbo.gym_booking gb
          WHERE gb.BookingDate < @today
            AND gb.BookingDate >= @windowStart
            AND gb.Status IN ('BOOKED','CHECKIN')
            AND gb.EmployeeID IS NOT NULL
            AND LTRIM(RTRIM(gb.EmployeeID)) <> ''
            AND NOT EXISTS (
              SELECT 1
              FROM dbo.gym_booking_ban b
              WHERE b.EmployeeID = gb.EmployeeID
                AND b.BannedUntil >= @today
            )
            -- Committee members and managers are exempt from bans - the one definition in
            -- lib/gymBan.js that /gym-booking-create, the worker and the guards also use.
            AND NOT ${committeeExemptSql('gb.EmployeeID', '@gymUnit')}
            AND NOT ${managerExemptSql('gb.EmployeeID')}
        ),
        BookingRows AS (
          SELECT
            gb.EmployeeID,
            gb.BookingDate,
            ROW_NUMBER() OVER (
              PARTITION BY gb.EmployeeID
              ORDER BY gb.BookingDate DESC, gb.CreatedAt DESC, gb.BookingID DESC
            ) AS rn
          FROM dbo.gym_booking gb
          INNER JOIN Candidate c ON c.EmployeeID = gb.EmployeeID
          WHERE gb.BookingDate < @today
            AND gb.BookingDate >= @windowStart
            AND gb.Status IN ('BOOKED','CHECKIN')
            -- Honour a manual unban: bookings from BEFORE the unban were already
            -- forgiven by whoever lifted the ban. /gym-booking-create honours this via
            -- noShowSinceDate; without the same cut-off here the scanner simply re-bans
            -- the person on the same old bookings within 6h, silently undoing the unban.
            AND NOT EXISTS (
              SELECT 1
              FROM dbo.gym_booking_ban ub
              WHERE ub.EmployeeID = gb.EmployeeID
                AND ub.UnbanAt IS NOT NULL
                AND gb.BookingDate < CONVERT(date, ub.UnbanAt)
            )
        ),
        DayEntry AS (
          SELECT
            t.EmployeeID,
            CONVERT(date, t.TxnTime) AS TapDate,
            MAX(CASE WHEN UPPER(CAST(t.[Transaction] AS varchar(100))) LIKE @entryPat THEN 1 ELSE 0 END) AS HasEntry
          FROM dbo.gym_live_taps t
          INNER JOIN Candidate c ON c.EmployeeID = t.EmployeeID
          WHERE CONVERT(date, t.TxnTime) < @today
            AND CONVERT(date, t.TxnTime) >= @windowStart
          GROUP BY t.EmployeeID, CONVERT(date, t.TxnTime)
        ),
        -- "Showed up" detection: ANY tap at the gym door that day (including a
        -- rejected one such as "Wrong Time Zone") proves the person physically
        -- attended. Without this, users whose access grant never landed on the
        -- controller are wrongly counted as no-shows and auto-banned. Rejected
        -- taps are NOT synced into gym_live_taps (GYM_SYNC_ONLY_VALID=1), so we
        -- read the raw controller log and map CardNo -> StaffNo via CardDB.
        -- (DataDBEnt is on the same SQL instance as the gym DB.)
        DayAttempt AS (
          SELECT
            cd.StaffNo AS EmployeeID,
            CONVERT(date, tx.TrDateTime) AS TapDate
          FROM DataDBEnt.dbo.tblTransaction tx
          INNER JOIN DataDBEnt.dbo.CardDB cd ON cd.CardNo = tx.CardNo
          INNER JOIN Candidate c ON c.EmployeeID = cd.StaffNo
          WHERE tx.UnitNo = @gymUnit
            AND CONVERT(date, tx.TrDateTime) < @today
            AND CONVERT(date, tx.TrDateTime) >= @windowStart
          GROUP BY cd.StaffNo, CONVERT(date, tx.TrDateTime)
        ),
        -- Days on which the door grant itself failed for this person. A rejected tap
        -- proves they came, but someone whose grant never landed often gives up without
        -- tapping at all and leaves no trace anywhere - counting that as a no-show bans
        -- them for the system's own failure. Written by /gym-controller-access.
        DayGrantFail AS (
          SELECT gf.EmployeeID, gf.FailDate AS TapDate
          FROM dbo.gym_grant_failure gf
          INNER JOIN Candidate c ON c.EmployeeID = gf.EmployeeID
          WHERE gf.UnitNo = @gymUnit
            AND gf.FailDate < @today
            AND gf.FailDate >= @windowStart
          GROUP BY gf.EmployeeID, gf.FailDate
        ),
        Annotated AS (
          SELECT
            br.EmployeeID,
            br.rn,
            br.BookingDate,
            CASE WHEN ISNULL(de.HasEntry, 0) = 1 OR da.TapDate IS NOT NULL OR gfd.TapDate IS NOT NULL THEN 1 ELSE 0 END AS HasEntry,
            MIN(CASE WHEN ISNULL(de.HasEntry, 0) = 1 OR da.TapDate IS NOT NULL OR gfd.TapDate IS NOT NULL THEN br.rn END) OVER (PARTITION BY br.EmployeeID) AS firstEntryRn
          FROM BookingRows br
          LEFT JOIN DayEntry de
            ON de.EmployeeID = br.EmployeeID
           AND de.TapDate = br.BookingDate
          LEFT JOIN DayAttempt da
            ON da.EmployeeID = br.EmployeeID
           AND da.TapDate = br.BookingDate
          LEFT JOIN DayGrantFail gfd
            ON gfd.EmployeeID = br.EmployeeID
           AND gfd.TapDate = br.BookingDate
        ),
        NoShowCount AS (
          SELECT
            a.EmployeeID,
            SUM(CASE WHEN a.HasEntry = 0 AND (a.firstEntryRn IS NULL OR a.rn < a.firstEntryRn) THEN 1 ELSE 0 END) AS ConsecutiveNoShow,
            MAX(CASE WHEN a.HasEntry = 0 AND (a.firstEntryRn IS NULL OR a.rn < a.firstEntryRn) THEN a.BookingDate END) AS LastNoShowDate
          FROM Annotated a
          GROUP BY a.EmployeeID
        ),
        ToBan AS (
          -- The 7 days run from the offence, not from whenever the scan happened to
          -- notice it: this scan runs every 6h and the booking path only checks when the
          -- person books again, so anchoring to detection made the same offence end on a
          -- different date depending on timing. Floor it at @today so a late detection
          -- still costs at least the rest of the day rather than expiring on arrival.
          SELECT
            n.EmployeeID,
            n.ConsecutiveNoShow,
            CASE
              WHEN DATEADD(day, 7, n.LastNoShowDate) > @today THEN DATEADD(day, 7, n.LastNoShowDate)
              ELSE @today
            END AS BannedUntil
          FROM NoShowCount n
          WHERE n.ConsecutiveNoShow >= 3
        )
        MERGE dbo.gym_booking_ban AS tgt
        USING ToBan AS src
        ON tgt.EmployeeID = src.EmployeeID
        WHEN MATCHED THEN
          UPDATE SET
            BannedUntil = src.BannedUntil,
            Reason = 'NO_SHOW_3X',
            ConsecutiveNoShow = src.ConsecutiveNoShow,
            UnbanRemark = NULL,
            UnbanAt = NULL,
            ActionBy = NULL,
            BanCount = tgt.BanCount + 1,
            LastBannedAt = GETDATE(),
            UpdatedAt = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (EmployeeID, BannedUntil, Reason, ConsecutiveNoShow, BanCount, LastBannedAt)
          VALUES (src.EmployeeID, src.BannedUntil, 'NO_SHOW_3X', src.ConsecutiveNoShow, 1, GETDATE())
        OUTPUT inserted.EmployeeID, inserted.BannedUntil, inserted.ConsecutiveNoShow, inserted.BanCount INTO @banned;
        SELECT @bansWritten = @@ROWCOUNT;

        -- Cancel from the ban table's current state, not from this run's ToBan (a CTE,
        -- which does not exist past the MERGE anyway). Keyed on state, every run also
        -- sweeps up bookings a ban left behind - including the ones every earlier run
        -- failed to cancel - and a booking that slipped in after the ban.
        -- Only still-BOOKED rows from today on: a CHECKIN means they are inside right now,
        -- and a booking they already attended today is attendance history. The ban is
        -- checked against each booking's own date, so one dated after the ban ends stays.
        UPDATE gb
        SET
          gb.Status = 'CANCELLED',
          gb.RejectedReason = 'Auto-cancelled by System due to 3x No-Show Ban'
        FROM dbo.gym_booking gb
        WHERE gb.BookingDate >= @today
          AND gb.Status = 'BOOKED'
          AND ${enforcedBanExistsSql('gb.EmployeeID', 'gb.BookingDate', '@gymUnit')}
          AND NOT EXISTS (
            SELECT 1 FROM dbo.gym_live_taps t
            WHERE t.EmployeeID = gb.EmployeeID
              AND CONVERT(date, t.TxnTime) = gb.BookingDate
              AND UPPER(CAST(t.[Transaction] AS varchar(100))) LIKE @entryPat
          );
        SELECT @bookingsCancelled = @@ROWCOUNT;

        COMMIT;
        SELECT
          EmployeeID AS employee_id,
          CONVERT(varchar(10), BannedUntil, 23) AS banned_until,
          ConsecutiveNoShow AS consecutive_no_show,
          BanCount AS ban_count
        FROM @banned;
        SELECT @bansWritten AS bans_written, @bookingsCancelled AS bookings_cancelled;
      END TRY
      BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
      END CATCH
    `);
    const recs = Array.isArray(scanRes?.recordsets) ? scanRes.recordsets : [];
    const row = recs[recs.length - 1]?.[0] || null;
    const bannedRows = Array.isArray(recs[recs.length - 2]) ? recs[recs.length - 2] : [];
    return {
      bansWritten: Number(row?.bans_written || 0),
      bookingsCancelled: Number(row?.bookings_cancelled || 0),
      banned: bannedRows
        .filter((r) => r && r.employee_id)
        .map((r) => ({
          employeeId: String(r.employee_id).trim(),
          bannedUntil: r.banned_until != null ? String(r.banned_until) : null,
          consecutiveNoShow: Number(r.consecutive_no_show || 0),
          banCount: Number(r.ban_count || 0),
        })),
    };
  };
  const scanTick = async () => {
    if (runningScan) return;
    runningScan = true;
    try {
      const cfg = {
        server: envTrim(process.env.DB_SERVER),
        port: Number(process.env.DB_PORT || 1433),
        database: envTrim(process.env.DB_DATABASE),
        user: envTrim(process.env.DB_USER),
        password: envTrim(process.env.DB_PASSWORD),
        options: { encrypt: envBool(process.env.DB_ENCRYPT, false), trustServerCertificate: envBool(process.env.DB_TRUST_SERVER_CERTIFICATE, true) },
      };
      if (cfg.server && cfg.database) {
        const entryPattern = (envTrim(process.env.GYM_ENTRY_EVENT) || 'VALID ENTRY ACCESS').toUpperCase();
        const gymUnit = envTrim(process.env.GYM_CONTROLLER_UNIT_NO)
          || (envTrim(process.env.GYM_UNIT_FILTER) || '').split(',')[0]?.trim()
          || '0031';
        const maxAttempts = 3;
        let attempt = 0;
        let done = false;
        while (!done && attempt < maxAttempts) {
          attempt += 1;
          let pool = null;
          try {
            pool = await new sql.ConnectionPool(cfg).connect();
            const outcome = await runProactiveScanQuery(pool, entryPattern, gymUnit);
            console.log(
              `[gym-worker] Proactive Daily Ban Scanner cycle completed (attempt ${attempt}): ` +
                `${outcome.bansWritten} ban(s) written, ${outcome.bookingsCancelled} booking(s) cancelled.`
            );
            lastBanScan = { t: new Date().toISOString(), ok: true, attempt, bans_written: outcome.bansWritten, bookings_cancelled: outcome.bookingsCancelled };
            pushAccessEvent({ t: lastBanScan.t, type: 'ban_scan', bans_written: outcome.bansWritten, bookings_cancelled: outcome.bookingsCancelled });
            recordAudit({
              action: 'BAN_SCAN',
              details: { bans_written: outcome.bansWritten, bookings_cancelled: outcome.bookingsCancelled, attempt },
            });
            // One row per person, so a ban stays on the record after an unban clears the
            // ban table. The audit page resolves the employee's name from their bookings.
            for (const b of outcome.banned || []) {
              recordAudit({
                action: 'BAN_APPLIED',
                targetType: 'EMPLOYEE',
                targetId: b.employeeId,
                details: {
                  reason: 'NO_SHOW_3X',
                  consecutive_no_show: b.consecutiveNoShow,
                  banned_until: b.bannedUntil,
                  ban_count: b.banCount,
                  via: 'scanner',
                },
              });
            }
            done = true;
          } catch (e) {
            const transient = isTransientDbError(e);
            const canRetry = transient && attempt < maxAttempts;
            console.log(`[gym-worker] Proactive Daily Ban Scanner attempt ${attempt} failed: ${e?.message || String(e)}`);
            if (!canRetry) throw e;
            await sleep(attempt * 1500);
          } finally {
            try {
              if (pool) await pool.close();
            } catch (_) {}
          }
        }
      }
    } catch (e) {
      console.log('[gym-worker] Proactive Daily Ban Scanner error:', e.message);
      lastBanScan = { t: new Date().toISOString(), ok: false, error: String(e?.message || e) };
      pushAccessEvent({ t: lastBanScan.t, type: 'ban_scan_error', error: lastBanScan.error });
      recordAudit({ action: 'BAN_SCAN', result: 'FAIL', details: { error: lastBanScan.error } });
    } finally {
      runningScan = false;
      setTimeout(scanTick, 6 * 60 * 60 * 1000); // 6 hours
    }
  };
  setTimeout(scanTick, 60000); // start 1 minute after boot
}
