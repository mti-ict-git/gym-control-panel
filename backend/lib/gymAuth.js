import jwt from 'jsonwebtoken';
import { envTrim } from './env.js';

export function getJwtSecret() {
  const s = envTrim(process.env.JWT_SECRET);
  if (!s) throw new Error('Missing JWT_SECRET');
  return s;
}

// Every logged-in panel account passes: gym_account roles map to superadmin / admin /
// committee (Staff), and the auto-organize worker signs its own 'system' token.
const ADMIN_ROLES = ['superadmin', 'admin', 'committee', 'system'];

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
export const requireGymSuperAdmin = requireRoles(['superadmin']);
