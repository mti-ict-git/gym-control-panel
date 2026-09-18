import sql from 'mssql';
import { envTrim, envBool } from './env.js';

// dbo.gym_audit_log: who did what, from where, and whether it worked. Read only by King
// Admin (GET /gym-audit-log). Rows hold the REAL actor, King Admin included; the "System"
// mask applies to the operational columns other roles see, never to this table.
//
// Writing is best-effort by design: an audit insert that fails (DB blip, table missing)
// is logged to the console and dropped. It must never fail or delay the action it records.

let poolPromise = null;
let tableReady = null;

function dbConfig() {
  const server = envTrim(process.env.DB_SERVER);
  const database = envTrim(process.env.DB_DATABASE);
  const user = envTrim(process.env.DB_USER);
  const password = envTrim(process.env.DB_PASSWORD);
  if (!server || !database || !user || !password) return null;
  return {
    server,
    port: Number(envTrim(process.env.DB_PORT) || '1433'),
    database,
    user,
    password,
    options: {
      encrypt: envBool(process.env.DB_ENCRYPT, false),
      trustServerCertificate: envBool(process.env.DB_TRUST_SERVER_CERTIFICATE, true),
    },
    pool: { max: 2, min: 0, idleTimeoutMillis: 30000 },
  };
}

// One long-lived pool for audit writes instead of a connect/close per row: a busy minute
// of door grants should not open a connection each.
export async function getAuditPool() {
  if (!poolPromise) {
    const cfg = dbConfig();
    if (!cfg) throw new Error('Gym DB env is not configured');
    const pool = new sql.ConnectionPool(cfg);
    pool.on('error', () => {
      poolPromise = null;
      tableReady = null;
    });
    poolPromise = pool.connect().catch((e) => {
      poolPromise = null;
      throw e;
    });
  }
  const pool = await poolPromise;
  if (!tableReady) {
    tableReady = ensureAuditTable(pool).catch((e) => {
      tableReady = null;
      throw e;
    });
  }
  await tableReady;
  return pool;
}

export async function ensureAuditTable(pool) {
  await pool.request().query(`
    IF OBJECT_ID('dbo.gym_audit_log','U') IS NULL
    BEGIN
      CREATE TABLE dbo.gym_audit_log (
        AuditID BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_gym_audit_log PRIMARY KEY,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_gym_audit_log_CreatedAt DEFAULT SYSUTCDATETIME(),
        ActorAccountID INT NULL,
        ActorName VARCHAR(100) NULL,
        ActorRole VARCHAR(30) NULL,
        Action VARCHAR(60) NOT NULL,
        TargetType VARCHAR(40) NULL,
        TargetID VARCHAR(100) NULL,
        Result VARCHAR(10) NOT NULL CONSTRAINT DF_gym_audit_log_Result DEFAULT 'OK',
        Details NVARCHAR(4000) NULL,
        IpAddress VARCHAR(64) NULL
      );
      CREATE INDEX IX_gym_audit_log_CreatedAt ON dbo.gym_audit_log (CreatedAt DESC);
      CREATE INDEX IX_gym_audit_log_Action ON dbo.gym_audit_log (Action, CreatedAt DESC);
    END`);
}

const SECRET_KEY = /pass|secret|token|pwd|hash/i;

// Request bodies go into Details; passwords and tokens never do.
function redact(value, depth = 0) {
  if (value == null || depth > 4) return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SECRET_KEY.test(k) ? (v == null || v === '' ? v : '[redacted]') : redact(v, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string' && value.length > 300) return `${value.slice(0, 300)}…`;
  return value;
}

function clientIp(req) {
  if (!req) return null;
  const fwd = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = fwd || req.socket?.remoteAddress || '';
  return ip ? ip.replace(/^::ffff:/, '').slice(0, 64) : null;
}

const cut = (v, n) => (v == null || v === '' ? null : String(v).slice(0, n));

/**
 * Record one audit row. Never throws, never needs awaiting.
 * actor: a JWT payload ({ account_id, username, email, role }); defaults to req.authUser,
 * and to "System" when neither is present (the ban scanner, the booking path's auto-ban).
 */
export function recordAudit({ req = null, actor = null, action, targetType = null, targetId = null, result = 'OK', details = null } = {}) {
  const a = actor || req?.authUser || null;
  const role = a ? String(a.role || '').toLowerCase() : 'system';
  const isSystem = !a || role === 'system';
  const row = {
    actorId: !isSystem && Number(a.account_id) > 0 ? Number(a.account_id) : null,
    actorName: isSystem ? 'System' : cut(a.username || a.email || a.name, 100),
    actorRole: cut(role || null, 30),
    action: cut(action, 60) || 'UNKNOWN',
    targetType: cut(targetType, 40),
    targetId: cut(targetId, 100),
    result: result === 'FAIL' ? 'FAIL' : 'OK',
    details: null,
    ip: clientIp(req),
  };
  if (details && typeof details === 'object' && Object.keys(details).length > 0) {
    try {
      const json = JSON.stringify(redact(details));
      row.details = json.length > 4000 ? `${json.slice(0, 3990)}…` : json;
    } catch (_) {}
  }
  return (async () => {
    try {
      const pool = await getAuditPool();
      await pool
        .request()
        .input('ActorAccountID', sql.Int, row.actorId)
        .input('ActorName', sql.VarChar(100), row.actorName)
        .input('ActorRole', sql.VarChar(30), row.actorRole)
        .input('Action', sql.VarChar(60), row.action)
        .input('TargetType', sql.VarChar(40), row.targetType)
        .input('TargetID', sql.VarChar(100), row.targetId)
        .input('Result', sql.VarChar(10), row.result)
        .input('Details', sql.NVarChar(4000), row.details)
        .input('IpAddress', sql.VarChar(64), row.ip)
        .query(`INSERT INTO dbo.gym_audit_log
                  (ActorAccountID, ActorName, ActorRole, Action, TargetType, TargetID, Result, Details, IpAddress)
                VALUES (@ActorAccountID, @ActorName, @ActorRole, @Action, @TargetType, @TargetID, @Result, @Details, @IpAddress)`);
    } catch (e) {
      console.warn('[audit] write failed:', row.action, e?.message || String(e));
    }
  })();
}

/**
 * Route middleware: audit the request once the response has been sent. Mount it after
 * the auth middleware so req.authUser is set. `describe(req, body)` returns
 * { targetType, targetId, details, action } for the row, or null to skip this request
 * (the door worker's own calls). The handler can add to the row through res.locals.audit.
 * Outcome: FAIL for a 4xx/5xx or a { ok: false } body, OK otherwise.
 */
export function auditAction(action, describe) {
  return (req, res, next) => {
    let body;
    const origJson = res.json.bind(res);
    res.json = (b) => {
      body = b;
      return origJson(b);
    };
    res.on('finish', () => {
      let info = {};
      try {
        info = describe ? describe(req, body) : {};
      } catch (_) {
        info = {};
      }
      if (info === null) return;
      const ok = res.statusCode < 400 && !(body && body.ok === false);
      const details = { ...(info.details || {}), ...(res.locals.audit || {}) };
      if (!ok && body?.error) details.error = String(body.error).slice(0, 300);
      recordAudit({
        req,
        action: info.action || action,
        targetType: info.targetType ?? null,
        targetId: info.targetId ?? null,
        result: ok ? 'OK' : 'FAIL',
        details,
      });
    });
    next();
  };
}
