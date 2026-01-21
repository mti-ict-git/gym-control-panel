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

export default router;
