/**
 * Find (and optionally fix) cards whose PinCardNo has an invalid Base-64 length
 * (len % 4 != 0) and who book the gym — these fail UploadCardByDoorUnitNo with
 * "Invalid length for a Base-64 char array or string" so their gym grant never lands.
 *
 * Fix = blank the PIN (len 0 is a valid Base-64 length and is how most cards already are).
 * Also lifts any currently-active NO_SHOW_3X ban among them (false bans) and voids the
 * false no-show bookings.
 *
 * DRY-RUN by default. Pass --apply to write. Scope: gym bookers in the last N days.
 *   node backend/scripts/fix-gym-pin-issues.js [days=30] [--apply]
 */
import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();
const days = Number(process.argv.find(a => /^\d+$/.test(a)) || 30);
const apply = process.argv.includes('--apply');
const gym = { server: process.env.DB_SERVER, port: Number(process.env.DB_PORT||1433), database: process.env.DB_DATABASE, user: process.env.DB_USER, password: process.env.DB_PASSWORD, options:{encrypt:process.env.DB_ENCRYPT==='true',trustServerCertificate:true} };
const T = `CONVERT(date, DATEADD(hour,8,GETUTCDATE()))`;
const run = async () => {
  const p = await new sql.ConnectionPool(gym).connect();
  console.log(`MODE: ${apply ? 'APPLY (writing)' : 'DRY-RUN (read-only)'} | scope: gym bookers last ${days} days\n`);

  // affected = gym bookers with invalid-length PIN
  const aff = await p.request().input('d', sql.Int, days).query(`
    SELECT DISTINCT c.CardNo, c.StaffNo, c.Name, c.PinCardNo, LEN(c.PinCardNo) AS pinlen
    FROM dbo.gym_booking gb JOIN DataDBEnt.dbo.CardDB c ON c.StaffNo=gb.EmployeeID
    WHERE (LEN(c.PinCardNo)%4)<>0 AND gb.BookingDate >= DATEADD(day,-@d, ${T})
    ORDER BY c.StaffNo`);
  console.log(`[1] Kartu terdampak (PIN invalid + booker gym): ${aff.recordset.length}`);
  console.table(aff.recordset);

  // currently false-banned among affected
  const ban = await p.request().input('d', sql.Int, days).query(`
    SELECT DISTINCT b.EmployeeID, c.Name, CONVERT(varchar(10),b.BannedUntil,23) AS BannedUntil
    FROM dbo.gym_booking_ban b JOIN DataDBEnt.dbo.CardDB c ON c.StaffNo=b.EmployeeID
    WHERE b.Reason='NO_SHOW_3X' AND b.BannedUntil >= ${T} AND (LEN(c.PinCardNo)%4)<>0`);
  console.log(`\n[2] Sedang ke-ban palsu (NO_SHOW_3X + PIN invalid): ${ban.recordset.length}`);
  console.table(ban.recordset);

  if (!apply) { console.log('\n(DRY-RUN — tidak ada perubahan. Tambah --apply untuk eksekusi.)'); await p.close(); return; }

  // FIX 1: blank invalid PINs for affected cards
  const f1 = await p.request().input('d', sql.Int, days).query(`
    UPDATE c SET c.PinCardNo=''
    FROM DataDBEnt.dbo.CardDB c
    WHERE (LEN(c.PinCardNo)%4)<>0
      AND c.StaffNo IN (SELECT DISTINCT gb.EmployeeID FROM dbo.gym_booking gb WHERE gb.BookingDate >= DATEADD(day,-@d, ${T}))`);
  console.log(`\n[FIX] PIN dikosongkan: ${f1.rowsAffected[0]} kartu`);

  // FIX 2: lift false NO_SHOW_3X bans among affected + void their false no-show bookings
  const f2 = await p.request().input('d', sql.Int, days).query(`
    UPDATE b SET b.BannedUntil=DATEADD(day,-1,${T}), b.ConsecutiveNoShow=0,
      b.UnbanRemark='Auto-unban: false NO_SHOW_3X from invalid-PIN gym grant failure', b.UnbanAt=GETDATE(), b.ActionBy='itsupport-bulkfix', b.UpdatedAt=GETDATE()
    FROM dbo.gym_booking_ban b JOIN DataDBEnt.dbo.CardDB c ON c.StaffNo=b.EmployeeID
    WHERE b.Reason='NO_SHOW_3X' AND b.BannedUntil >= ${T} AND (LEN(c.PinCardNo)%4)<>0`);
  console.log(`[FIX] Ban palsu diangkat: ${f2.rowsAffected[0]}`);

  const f3 = await p.request().input('d', sql.Int, days).query(`
    UPDATE gb SET gb.Status='CANCELLED', gb.RejectedReason='Voided: invalid-PIN gym grant failure - false no-show'
    FROM dbo.gym_booking gb
    WHERE gb.Status IN ('BOOKED','CHECKIN') AND gb.BookingDate < ${T} AND gb.BookingDate >= DATEADD(day,-7,${T})
      AND gb.EmployeeID IN (
        SELECT b.EmployeeID FROM dbo.gym_booking_ban b JOIN DataDBEnt.dbo.CardDB c ON c.StaffNo=b.EmployeeID
        WHERE (LEN(c.PinCardNo)%4)<>0 AND b.UnbanRemark LIKE 'Auto-unban: false NO_SHOW_3X%')`);
  console.log(`[FIX] Booking no-show palsu di-void: ${f3.rowsAffected[0]}`);
  console.log('\nSelesai. Worker akan grant mereka otomatis pada sesi booking berikutnya (PIN sudah valid).');
  await p.close();
};
run().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
