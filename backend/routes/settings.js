import express from 'express';
import fs from 'fs';
import path from 'path';
import sql from 'mssql';
import { envTrim, envBool } from '../lib/env.js';

const router = express.Router();

const DATA_DIR = path.resolve(process.cwd(), 'backend', 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'app-settings.json');

function ensureDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (_) {}
}

function readSettings() {
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
    const json = JSON.parse(raw);
    return typeof json === 'object' && json ? json : {};
  } catch (_) {
    return {};
  }
}

function writeSettings(obj) {
  ensureDir(DATA_DIR);
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(obj, null, 2), 'utf8');
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
    return null;
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

async function ensureAppSettingsTable(pool) {
  await pool.request().query(
    `IF OBJECT_ID('dbo.gym_app_settings','U') IS NULL
     BEGIN
       CREATE TABLE dbo.gym_app_settings (
         Id INT NOT NULL PRIMARY KEY,
         SupportContactName VARCHAR(100) NOT NULL,
         SupportContactPhone VARCHAR(20) NOT NULL,
         UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_gym_app_settings_UpdatedAt DEFAULT SYSUTCDATETIME(),
         UpdatedBy VARCHAR(50) NULL
       );
     END;
     IF NOT EXISTS (SELECT 1 FROM dbo.gym_app_settings WHERE Id = 1)
     BEGIN
       INSERT INTO dbo.gym_app_settings (Id, SupportContactName, SupportContactPhone)
       VALUES (1, 'Gym Coordinator', '+6281275000560');
     END;`
  );
}

router.get('/app-settings/support-contact', (_req, res) => {
  (async () => {
    const config = getDbConfig();
    if (!config) {
      const settings = readSettings();
      const name = typeof settings.support_contact_name === 'string' ? settings.support_contact_name : 'Gym Coordinator';
      const phone = typeof settings.support_contact_phone === 'string' ? settings.support_contact_phone : '+6281275000560';
      return res.json({ ok: true, name, phone });
    }
    try {
      const pool = await new sql.ConnectionPool(config).connect();
      await ensureAppSettingsTable(pool);
      const r = await pool.request().query(
        `SELECT TOP 1 SupportContactName AS name, SupportContactPhone AS phone FROM dbo.gym_app_settings WHERE Id = 1`
      );
      await pool.close();
      const row = Array.isArray(r?.recordset) && r.recordset.length > 0 ? r.recordset[0] : null;
      const name = row?.name ? String(row.name) : 'Gym Coordinator';
      const phone = row?.phone ? String(row.phone) : '+6281275000560';
      return res.json({ ok: true, name, phone });
    } catch (error) {
      const settings = readSettings();
      const name = typeof settings.support_contact_name === 'string' ? settings.support_contact_name : 'Gym Coordinator';
      const phone = typeof settings.support_contact_phone === 'string' ? settings.support_contact_phone : '+6281275000560';
      return res.json({ ok: true, name, phone });
    }
  })();
});

router.post('/app-settings/support-contact', (req, res) => {
  const name = String(req.body?.name || '').trim();
  const phone = String(req.body?.phone || '').trim();

  if (!name || name.length > 100) {
    return res.status(400).json({ ok: false, error: 'Invalid contact name' });
  }
  // Allow leading + and digits, minimum length check
  const digits = phone.replace(/[^+0-9]/g, '');
  if (!digits || digits.length < 6 || digits.length > 20 || !/^\+?[0-9]+$/.test(digits)) {
    return res.status(400).json({ ok: false, error: 'Invalid contact phone' });
  }

  (async () => {
    const config = getDbConfig();
    if (!config) {
      const current = readSettings();
      const next = { ...current, support_contact_name: name, support_contact_phone: digits };
      try {
        writeSettings(next);
        return res.json({ ok: true });
      } catch (e) {
        return res.status(500).json({ ok: false, error: 'Failed to persist settings' });
      }
    }
    try {
      const pool = await new sql.ConnectionPool(config).connect();
      await ensureAppSettingsTable(pool);
      const req1 = pool.request();
      req1.input('Id', sql.Int, 1);
      req1.input('Name', sql.VarChar(100), name);
      req1.input('Phone', sql.VarChar(20), digits);
      req1.input('UpdatedBy', sql.VarChar(50), 'SETTINGS_API');
      await req1.query(
        `IF EXISTS (SELECT 1 FROM dbo.gym_app_settings WHERE Id = @Id)
         BEGIN
           UPDATE dbo.gym_app_settings
           SET SupportContactName = @Name,
               SupportContactPhone = @Phone,
               UpdatedAt = SYSUTCDATETIME(),
               UpdatedBy = @UpdatedBy
           WHERE Id = @Id;
         END
         ELSE
         BEGIN
           INSERT INTO dbo.gym_app_settings (Id, SupportContactName, SupportContactPhone, UpdatedBy)
           VALUES (@Id, @Name, @Phone, @UpdatedBy);
         END`
      );
      await pool.close();
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ ok: false, error: 'Failed to persist settings to DB' });
    }
  })();
});

async function ensureGymControllerSettings(pool) {
  await pool.request().query(
    `IF OBJECT_ID('dbo.gym_controller_settings','U') IS NULL BEGIN
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
     END;
     IF COL_LENGTH('dbo.gym_controller_settings','EnableManagerAllSessionAccess') IS NULL BEGIN
       ALTER TABLE dbo.gym_controller_settings ADD EnableManagerAllSessionAccess BIT NOT NULL CONSTRAINT DF_gym_controller_settings_EnableManagerAllSessionAccess DEFAULT 0;
     END;
     IF COL_LENGTH('dbo.gym_controller_settings','GraceBeforeMin') IS NULL BEGIN
       ALTER TABLE dbo.gym_controller_settings ADD GraceBeforeMin INT NOT NULL CONSTRAINT DF_gym_controller_settings_GraceBeforeMin DEFAULT 0;
     END;
     IF COL_LENGTH('dbo.gym_controller_settings','GraceAfterMin') IS NULL BEGIN
       ALTER TABLE dbo.gym_controller_settings ADD GraceAfterMin INT NOT NULL CONSTRAINT DF_gym_controller_settings_GraceAfterMin DEFAULT 0;
     END;
     IF COL_LENGTH('dbo.gym_controller_settings','WorkerIntervalMs') IS NULL BEGIN
       ALTER TABLE dbo.gym_controller_settings ADD WorkerIntervalMs INT NOT NULL CONSTRAINT DF_gym_controller_settings_WorkerIntervalMs DEFAULT 60000;
     END;
     IF NOT EXISTS (SELECT 1 FROM dbo.gym_controller_settings WHERE Id = 1)
       INSERT INTO dbo.gym_controller_settings (Id, EnableAutoOrganize) VALUES (1, 0);`
  );
}

router.get('/gym-controller/settings', (_req, res) => {
  (async () => {
    const config = getDbConfig();
    if (!config) {
      return res.status(500).json({ ok: false, error: 'Gym DB env is not configured' });
    }
    try {
      const pool = await new sql.ConnectionPool(config).connect();
      await ensureGymControllerSettings(pool);
      const r = await pool.request().query(
        `SELECT TOP 1 EnableAutoOrganize, EnableManagerAllSessionAccess, GraceBeforeMin, GraceAfterMin, WorkerIntervalMs FROM dbo.gym_controller_settings WHERE Id = 1`
      );
      await pool.close();
      const row = Array.isArray(r?.recordset) && r.recordset.length > 0 ? r.recordset[0] : null;
      const settings = row
        ? {
            enable_auto_organize: row.EnableAutoOrganize ? true : false,
            enable_manager_all_session_access: row.EnableManagerAllSessionAccess ? true : false,
            grace_before_min: Number(row.GraceBeforeMin ?? 0) || 0,
            grace_after_min: Number(row.GraceAfterMin ?? 0) || 0,
            worker_interval_ms: Number(row.WorkerIntervalMs ?? 60000) || 60000,
          }
        : {
            enable_auto_organize: false,
            enable_manager_all_session_access: false,
            grace_before_min: 0,
            grace_after_min: 0,
            worker_interval_ms: 60000,
          };
      return res.json({ ok: true, settings });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  })();
});

router.post('/gym-controller/settings', (req, res) => {
  (async () => {
    const config = getDbConfig();
    if (!config) {
      return res.status(500).json({ ok: false, error: 'Gym DB env is not configured' });
    }
    const b = req.body || {};
    const toBool = (v) => {
      const s = String(v ?? '').trim().toLowerCase();
      return ['1', 'true', 'yes', 'y'].includes(s);
    };
    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
    const enableAutoOrganize = b.EnableAutoOrganize != null ? toBool(b.EnableAutoOrganize) : undefined;
    const enableManagerAllSessionAccess = b.EnableManagerAllSessionAccess != null ? toBool(b.EnableManagerAllSessionAccess) : undefined;
    const graceBeforeMin = b.GraceBeforeMin != null ? clamp(Number(b.GraceBeforeMin) || 0, 0, 24 * 60) : undefined;
    const graceAfterMin = b.GraceAfterMin != null ? clamp(Number(b.GraceAfterMin) || 0, 0, 24 * 60) : undefined;
    const workerIntervalMs = b.WorkerIntervalMs != null ? clamp(Number(b.WorkerIntervalMs) || 60000, 5000, 60 * 60 * 1000) : undefined;

    try {
      const pool = await new sql.ConnectionPool(config).connect();
      await ensureGymControllerSettings(pool);
      const req1 = pool.request();
      req1.input('Id', sql.Int, 1);
      if (enableAutoOrganize !== undefined) req1.input('EnableAutoOrganize', sql.Bit, enableAutoOrganize ? 1 : 0);
      if (enableManagerAllSessionAccess !== undefined) req1.input('EnableManagerAllSessionAccess', sql.Bit, enableManagerAllSessionAccess ? 1 : 0);
      if (graceBeforeMin !== undefined) req1.input('GraceBeforeMin', sql.Int, graceBeforeMin);
      if (graceAfterMin !== undefined) req1.input('GraceAfterMin', sql.Int, graceAfterMin);
      if (workerIntervalMs !== undefined) req1.input('WorkerIntervalMs', sql.Int, workerIntervalMs);

      const sets = [];
      if (enableAutoOrganize !== undefined) sets.push('EnableAutoOrganize = @EnableAutoOrganize');
      if (enableManagerAllSessionAccess !== undefined) sets.push('EnableManagerAllSessionAccess = @EnableManagerAllSessionAccess');
      if (graceBeforeMin !== undefined) sets.push('GraceBeforeMin = @GraceBeforeMin');
      if (graceAfterMin !== undefined) sets.push('GraceAfterMin = @GraceAfterMin');
      if (workerIntervalMs !== undefined) sets.push('WorkerIntervalMs = @WorkerIntervalMs');
      sets.push('UpdatedAt = GETDATE()');

      const setSql = sets.join(', ');
      const sqlText =
        `IF EXISTS (SELECT 1 FROM dbo.gym_controller_settings WHERE Id = @Id)
         UPDATE dbo.gym_controller_settings SET ${setSql} WHERE Id = @Id
         ELSE
         INSERT INTO dbo.gym_controller_settings (Id${enableAutoOrganize !== undefined ? ', EnableAutoOrganize' : ''}${enableManagerAllSessionAccess !== undefined ? ', EnableManagerAllSessionAccess' : ''}${graceBeforeMin !== undefined ? ', GraceBeforeMin' : ''}${graceAfterMin !== undefined ? ', GraceAfterMin' : ''}${workerIntervalMs !== undefined ? ', WorkerIntervalMs' : ''})
         VALUES (@Id${enableAutoOrganize !== undefined ? ', @EnableAutoOrganize' : ''}${enableManagerAllSessionAccess !== undefined ? ', @EnableManagerAllSessionAccess' : ''}${graceBeforeMin !== undefined ? ', @GraceBeforeMin' : ''}${graceAfterMin !== undefined ? ', @GraceAfterMin' : ''}${workerIntervalMs !== undefined ? ', @WorkerIntervalMs' : ''})`;

      await req1.query(sqlText);
      await pool.close();
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  })();
});

export default router;
