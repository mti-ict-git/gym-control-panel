// Who is exempt from gym bans, and who is banned right now - as SQL, so every place that
// decides it asks the same question: /gym-booking-create, the proactive scanner, the door
// worker, and the guards on /gym-controller-access and /gym-booking-status.
//
// These used to be three different rules (a grade list in /gym-booking-create, a job_title
// LIKE in the worker's always-allow, a grade-or-job_title LIKE in the scanner), so one
// path banned people another path then ignored, or kept opening the door for.
//
// Aliases bb/cm/em are used inside; don't reuse them in the calling query.

// Manager by grade: the rule /gym-booking-create has always applied (GM, MANAGER,
// SR/SENIOR MANAGER), plus 'GENERAL MANAGER', which it missed although it accepted 'GM'.
export function gradeManagerSql(a) {
  return `(
    UPPER(LTRIM(RTRIM(ISNULL(${a}.grade, '')))) IN ('GM', 'GENERAL MANAGER', 'MANAGER', 'SR MANAGER', 'SR. MANAGER', 'SENIOR MANAGER')
    OR (
      UPPER(ISNULL(${a}.grade, '')) LIKE '%MANAGER%'
      AND (UPPER(ISNULL(${a}.grade, '')) LIKE '%SENIOR%' OR UPPER(ISNULL(${a}.grade, '')) LIKE '%SR%')
    )
  )`;
}

// Manager by job title: the rule behind "manager all-session access", i.e. who the door
// worker lets in around the clock without a booking (job title mentions MANAGER or GM,
// supervisors excluded). The worker builds that list from this same SQL.
export function titleManagerSql(a) {
  return `(
    (UPPER(ISNULL(${a}.job_title, '')) LIKE '%MANAGER%' OR UPPER(ISNULL(${a}.job_title, '')) LIKE '%GM%')
    AND UPPER(ISNULL(${a}.grade, '')) NOT LIKE '%SUPERVISOR%'
  )`;
}

// Exempt from bans = manager by grade OR by job title. Including the title arm means
// everyone the door already admits 24/7 is exempt - otherwise they could be "banned" while
// the door kept letting them in, and the ban would only stop bookings they don't need.
export function managerExemptSql(empExpr) {
  return `EXISTS (
    SELECT 1 FROM MTIMasterEmployeeDB.dbo.employee_employment em
    WHERE em.employee_id = ${empExpr}
      AND (${gradeManagerSql('em')} OR ${titleManagerSql('em')})
  )`;
}

export function committeeExemptSql(empExpr, unitExpr) {
  return `EXISTS (
    SELECT 1 FROM dbo.gym_access_committee cm
    WHERE cm.EmployeeID = ${empExpr} AND cm.UnitNo = ${unitExpr} AND cm.IsActive = 1
  )`;
}

// A ban in force on `refDateExpr` that is actually enforced. Pass the WITA date - never
// GETDATE(), SQL Server here runs on UTC+7. For a booking, pass the booking's own date,
// so a booking dated after the ban ends is left alone.
//
// withManagerExemption=false drops the MTIMasterEmployeeDB lookup, for a fallback when
// that database is unavailable: callers must then not act on the answer as if exact.
export function enforcedBanExistsSql(empExpr, refDateExpr, unitExpr, { withManagerExemption = true } = {}) {
  return `EXISTS (
    SELECT 1 FROM dbo.gym_booking_ban bb
    WHERE bb.EmployeeID = ${empExpr}
      AND bb.BannedUntil >= ${refDateExpr}
      AND NOT ${committeeExemptSql('bb.EmployeeID', unitExpr)}
      ${withManagerExemption ? `AND NOT ${managerExemptSql('bb.EmployeeID')}` : ''}
  )`;
}
