import express from 'express';
import sql from 'mssql';
import { envInt } from '../lib/env.js';
import { requireKingAdmin } from '../lib/gymAuth.js';
import { getAuditPool } from '../lib/audit.js';

const router = express.Router();

// Rows are stored in UTC; the panel works in gym time (WITA). A "from"/"to" date is a WITA
// calendar day, so the window is shifted by the offset before it is compared.
function witaDayToUtc(ymd, offsetMinutes, endOfDay) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
  if (!m) return null;
  const startUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - offsetMinutes * 60_000;
  return new Date(endOfDay ? startUtc + 24 * 60 * 60_000 : startUtc);
}

router.get('/gym-audit-log', requireKingAdmin, async (req, res) => {
  const offset = envInt(process.env.GYM_TZ_OFFSET_MINUTES, 8 * 60);
  const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(String(req.query.limit || '50'), 10) || 50));
  const from = witaDayToUtc(req.query.from, offset, false);
  const to = witaDayToUtc(req.query.to, offset, true);
  const action = String(req.query.action || '').trim();
  const actor = String(req.query.actor || '').trim();
  const result = String(req.query.result || '').trim().toUpperCase();
  const q = String(req.query.q || '').trim();

  try {
    const pool = await getAuditPool();
    const where = [];
    const bind = (r) => {
      if (from) r.input('from', sql.DateTime2, from);
      if (to) r.input('to', sql.DateTime2, to);
      if (action) r.input('action', sql.VarChar(60), action);
      if (actor) r.input('actor', sql.VarChar(110), `%${actor}%`);
      if (result === 'OK' || result === 'FAIL') r.input('result', sql.VarChar(10), result);
      if (q) r.input('q', sql.NVarChar(210), `%${q}%`);
      return r;
    };
    if (from) where.push('a.CreatedAt >= @from');
    if (to) where.push('a.CreatedAt < @to');
    if (action) where.push('a.Action = @action');
    if (actor) where.push('a.ActorName LIKE @actor');
    if (result === 'OK' || result === 'FAIL') where.push('a.Result = @result');
    if (q) {
      where.push(`(a.TargetID LIKE @q OR a.Details LIKE @q OR a.ActorName LIKE @q
                   OR bk.EmployeeID LIKE @q OR bk.EmployeeName LIKE @q OR emp.EmployeeName LIKE @q)`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    // A row stores only an ID; put a name next to it so the log reads without lookups.
    // (A deleted booking is gone from gym_booking; BOOKING_DELETE keeps a copy in Details.)
    const fromSql = `
      FROM dbo.gym_audit_log a
      OUTER APPLY (
        SELECT TOP 1 gb.EmployeeID, gb.EmployeeName, gb.BookingDate
        FROM dbo.gym_booking gb
        WHERE a.TargetType = 'BOOKING' AND gb.BookingID = TRY_CAST(a.TargetID AS INT)
      ) bk
      OUTER APPLY (
        SELECT TOP 1 gb2.EmployeeName
        FROM dbo.gym_booking gb2
        WHERE a.TargetType = 'EMPLOYEE' AND gb2.EmployeeID = a.TargetID
        ORDER BY gb2.BookingDate DESC
      ) emp
      OUTER APPLY (
        SELECT TOP 1 ga.Username
        FROM dbo.gym_account ga
        WHERE a.TargetType = 'ACCOUNT' AND ga.AccountID = TRY_CAST(a.TargetID AS INT)
      ) acc`;

    const countRes = await bind(pool.request()).query(`SELECT COUNT(1) AS total ${fromSql} ${whereSql}`);
    const dataRes = await bind(pool.request())
      .input('offset', sql.Int, (page - 1) * limit)
      .input('limit', sql.Int, limit)
      .query(`
        SELECT a.AuditID, a.CreatedAt, a.ActorAccountID, a.ActorName, a.ActorRole, a.Action, a.TargetType,
               a.TargetID, a.Result, a.Details, a.IpAddress,
               bk.EmployeeID AS BookingEmployeeID, bk.EmployeeName AS BookingEmployeeName,
               CONVERT(varchar(10), bk.BookingDate, 23) AS BookingDate,
               emp.EmployeeName AS TargetEmployeeName,
               acc.Username AS TargetUsername
        ${fromSql}
        ${whereSql}
        ORDER BY a.CreatedAt DESC, a.AuditID DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`);
    // Filter choices come from what has actually been recorded, so a new action type
    // shows up in the dropdown without a frontend change.
    const actionsRes = await pool.request().query('SELECT DISTINCT Action FROM dbo.gym_audit_log ORDER BY Action');

    const rows = (dataRes?.recordset || []).map((r) => {
      let details = null;
      if (r.Details) {
        try { details = JSON.parse(r.Details); } catch (_) { details = { raw: String(r.Details) }; }
      }
      let targetLabel = null;
      if (r.BookingEmployeeID) {
        targetLabel = `${String(r.BookingEmployeeID).trim()}${r.BookingEmployeeName ? ` - ${String(r.BookingEmployeeName).trim()}` : ''}${r.BookingDate ? ` (${r.BookingDate})` : ''}`;
      } else if (r.TargetEmployeeName) {
        targetLabel = String(r.TargetEmployeeName).trim();
      } else if (r.TargetUsername) {
        targetLabel = String(r.TargetUsername).trim();
      }
      return {
        id: Number(r.AuditID),
        target_label: targetLabel,
        created_at: r.CreatedAt instanceof Date ? r.CreatedAt.toISOString() : String(r.CreatedAt || ''),
        actor_account_id: r.ActorAccountID != null ? Number(r.ActorAccountID) : null,
        actor_name: r.ActorName != null ? String(r.ActorName) : null,
        actor_role: r.ActorRole != null ? String(r.ActorRole) : null,
        action: String(r.Action || ''),
        target_type: r.TargetType != null ? String(r.TargetType) : null,
        target_id: r.TargetID != null ? String(r.TargetID) : null,
        result: String(r.Result || 'OK'),
        details,
        ip: r.IpAddress != null ? String(r.IpAddress) : null,
      };
    });
    return res.json({
      ok: true,
      page,
      limit,
      total: Number(countRes?.recordset?.[0]?.total || 0),
      actions: (actionsRes?.recordset || []).map((r) => String(r.Action)),
      rows,
    });
  } catch (error) {
    return res.status(200).json({ ok: false, error: error?.message || String(error), rows: [] });
  }
});

export default router;
