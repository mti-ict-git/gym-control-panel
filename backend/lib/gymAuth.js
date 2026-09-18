import jwt from 'jsonwebtoken';
import { envTrim } from './env.js';
import { recordAudit } from './audit.js';

export function getJwtSecret() {
  const s = envTrim(process.env.JWT_SECRET);
  if (!s) throw new Error('Missing JWT_SECRET');
  return s;
}

// gym_account.Role (DB spelling) <-> JWT/UI role. One mapping for auth.js and the account
// routes: a DB role missing here used to fall through to 'committee' without a word.
const DB_TO_UI = { KingAdmin: 'kingadmin', SuperAdmin: 'superadmin', Admin: 'admin' };
const UI_TO_DB = { kingadmin: 'KingAdmin', superadmin: 'SuperAdmin', admin: 'Admin' };
export const DB_ROLES = ['KingAdmin', 'SuperAdmin', 'Admin', 'Staff'];

export function uiRoleFromDb(role) {
  return DB_TO_UI[role != null ? String(role) : ''] || 'committee';
}

export function dbRoleFromUi(role) {
  return UI_TO_DB[String(role || '').trim().toLowerCase()] || 'Staff';
}

export function isKingAdmin(user) {
  return String(user?.role || '').toLowerCase() === 'kingadmin';
}

// The name written into operational "who did it" columns (Ban List "Action By"). King Admin
// is invisible to every other role, so its actions show as 'System'; the real account is
// kept in gym_audit_log, which only King Admin can read.
export function actorLabel(user) {
  if (!user) return null;
  const role = String(user.role || '').toLowerCase();
  if (role === 'kingadmin' || role === 'system') return 'System';
  return String(user.username || user.email || '').trim() || null;
}

// Every logged-in panel account passes: gym_account roles map to kingadmin / superadmin /
// admin / committee (Staff), and the auto-organize worker signs its own 'system' token.
const ADMIN_ROLES = ['kingadmin', 'superadmin', 'admin', 'committee', 'system'];

function requireRoles(roles) {
  return (req, res, next) => {
    const auth = req.headers.authorization || '';
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) return res.status(401).json({ ok: false, error: 'Missing bearer token' });
    let payload;
    try { payload = jwt.verify(m[1], getJwtSecret()); }
    catch (e) { return res.status(401).json({ ok: false, error: 'Invalid token' }); }
    const role = String(payload?.role || '').toLowerCase();
    if (!roles.includes(role)) {
      // A valid login reaching for something above its role. Expired tokens (401 above)
      // are routine and not worth a row; this is not.
      recordAudit({
        req,
        actor: payload,
        action: 'ACCESS_DENIED',
        result: 'FAIL',
        details: { method: req.method, path: req.originalUrl || req.url },
      });
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }
    req.authUser = payload;
    next();
  };
}

export const requireGymAdmin = requireRoles(ADMIN_ROLES);

// Account management. Staff accounts pass requireGymAdmin, so without this a Staff login
// could create a SuperAdmin and hand itself every permission the panel has. The sidebar
// already shows Management Account to superadmins only; this makes the server agree.
export const requireGymSuperAdmin = requireRoles(['kingadmin', 'superadmin']);

// The audit log itself.
export const requireKingAdmin = requireRoles(['kingadmin']);
