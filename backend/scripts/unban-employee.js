/**
 * Ops tool: lift a gym ban for an employee (e.g. a false NO_SHOW_3X caused by the
 * "Wrong Time Zone" access-grant bug). Shows before/after.
 *
 * Usage:
 *   node backend/scripts/unban-employee.js MTI240576
 *   node backend/scripts/unban-employee.js MTI240576 --void
 *
 * Without --void the unban will be REVERTED by the proactive scanner within ~6h
 * (her past bookings still look like no-shows on the un-patched server). Use --void
 * to also cancel her past false-no-show bookings (last 7 days, still BOOKED/CHECKIN)
 * so the unban holds — OR deploy the app.js no-show fix first.
 */
import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const emp = (process.argv[2] || '').trim();
const doVoid = process.argv.includes('--void');
if (!emp) { console.error('EmployeeID required'); process.exit(1); }

const cfg = {
  server: process.env.DB_SERVER, port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_DATABASE, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  options: { encrypt: process.env.DB_ENCRYPT === 'true', trustServerCertificate: true },
  pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
};

const run = async () => {
  const p = await new sql.ConnectionPool(cfg).connect();

  console.log(`=== BEFORE: ban status ${emp} ===`);
  const before = await p.request().input('e', sql.VarChar(20), emp)
    .query(`SELECT EmployeeID, CONVERT(varchar(10),BannedUntil,23) AS BannedUntil, Reason, ConsecutiveNoShow, UnbanRemark FROM dbo.gym_booking_ban WHERE EmployeeID=@e`);
  console.table(before.recordset);

  // Lift the ban (set BannedUntil to yesterday so scanner no longer treats as active)
  const upd = await p.request().input('e', sql.VarChar(20), emp)
    .query(`UPDATE dbo.gym_booking_ban
            SET BannedUntil = DATEADD(day,-1, CONVERT(date, DATEADD(hour,8,GETUTCDATE()))),
                ConsecutiveNoShow = 0,
                UnbanRemark = 'Manual unban: false NO_SHOW_3X from gym access grant failure (Wrong Time Zone)',
                UnbanAt = GETDATE(),
                ActionBy = 'itsupport-diagnosis',
                UpdatedAt = GETDATE()
            WHERE EmployeeID=@e`);
  console.log(`\nBan lifted. Rows updated: ${upd.rowsAffected[0]}`);

  if (doVoid) {
    const v = await p.request().input('e', sql.VarChar(20), emp)
      .query(`UPDATE dbo.gym_booking
              SET Status='CANCELLED',
                  RejectedReason='Voided: gym access not granted (Wrong Time Zone) - false no-show'
              WHERE EmployeeID=@e
                AND Status IN ('BOOKED','CHECKIN')
                AND BookingDate < CONVERT(date, DATEADD(hour,8,GETUTCDATE()))
                AND BookingDate >= DATEADD(day,-7, CONVERT(date, DATEADD(hour,8,GETUTCDATE())))`);
    console.log(`Past false-no-show bookings voided: ${v.rowsAffected[0]}`);
  } else {
    console.log(`(no --void) NOTE: scanner may re-ban within ~6h unless the no-show fix is deployed.`);
  }

  console.log(`\n=== AFTER: ban status ${emp} ===`);
  const after = await p.request().input('e', sql.VarChar(20), emp)
    .query(`SELECT EmployeeID, CONVERT(varchar(10),BannedUntil,23) AS BannedUntil, Reason, ConsecutiveNoShow, UnbanRemark FROM dbo.gym_booking_ban WHERE EmployeeID=@e`);
  console.table(after.recordset);

  await p.close();
};
run().catch(e => { console.error('FATAL', e.message); process.exit(1); });
