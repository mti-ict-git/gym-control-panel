import express from 'express';
import fs from 'fs';
import path from 'path';

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

router.get('/app-settings/support-contact', (_req, res) => {
  const settings = readSettings();
  const name = typeof settings.support_contact_name === 'string' ? settings.support_contact_name : 'Gym Coordinator';
  const phone = typeof settings.support_contact_phone === 'string' ? settings.support_contact_phone : '+6281275000560';
  return res.json({ ok: true, name, phone });
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

  const current = readSettings();
  const next = { ...current, support_contact_name: name, support_contact_phone: digits };
  try {
    writeSettings(next);
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'Failed to persist settings' });
  }
  return res.json({ ok: true });
});

export default router;

