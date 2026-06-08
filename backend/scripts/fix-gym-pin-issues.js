/**
 * Find (and optionally fix) gym access problems caused by invalid-length PINs:
 *  1) Blank PinCardNo where LEN % 4 != 0 for gym bookers (Vault's UploadCardByDoorUnitNo
 *     Base64-decodes the PIN and throws on invalid length, so the gym grant never lands).
 *  2) Lift false NO_SHOW_3X bans + void the false no-show bookings. False bans are
 *     identified by a REJECTED gym tap ("Wrong Time Zone", TrCode CJ at unit 0031) —
 *     i.e. the person physically showed up but the broken grant blocked them. This is
 *     PIN-independent, so it still works after step 1 has already normalised the PIN.
 *
 * DRY-RUN by default. Pass --apply to write. Scope: gym bookers in the last N days.
 *   node backend/scripts/fix-gym-pin-issues.js [days=30] [--apply]
 */
import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();
const days = Number(process.argv.find(a => /^\d+$/.test(a)) || 30);
const apply = process.argv.includes('--apply');
const gymUnit = process.env.GYM_CONTROLLER_UNIT_NO || '0031';
const gym = { server: process.env.DB_SERVER, port: Number(process.env.DB_PORT||1433), database: process.env.DB_DATABASE, user: process.env.DB_USER, password: process.env.DB_PASSWORD, options:{encrypt:process.env.DB_ENCRYPT==='true',trustServerCertificate:true} };
const T = `CONVERT(date, DATEADD(hour,8,GETUTCDATE()))`;
// false-ban victims: NO_SHOW_3X banned AND have a rejected gym tap (showed up, blocked) in the last 30 days
const VICTIMS = `b.Reason='NO_SHOW_3X' AND b.BannedUntil >= ${T} AND EXISTS (
  SELECT 1 FROM DataDBEnt.dbo.tblTransaction tx JOIN DataDBEnt.dbo.CardDB c ON c.CardNo=tx.CardNo
  WHERE c.StaffNo=b.EmployeeID AND tx.UnitNo='${gymUnit}' AND tx.TrCode='CJ' AND tx.TrDateTime >= DATEADD(day,-30,${T}))`;
const run = async () => {
  const p = await new sql.ConnectionPool(gym).connect();
  console.log(`MODE: ${apply ? 'APPLY (writing)' : 'DRY-RUN (read-only)'} | scope: gym bookers last ${days} days | gym unit ${gymUnit}\n`);

  const aff = await p.request().input('d', sql.Int, days).query(`
    SELECT DISTINCT c.CardNo, c.StaffNo, c.Name, c.PinCardNo, LEN(c.PinCardNo) AS pinlen
    FROM dbo.gym_booking gb JOIN DataDBEnt.dbo.CardDB c ON c.StaffNo=gb.EmployeeID
    WHERE (LEN(c.PinCardNo)%4)<>0 AND gb.BookingDate >= DATEADD(day,-@d, ${T})
    ORDER BY c.StaffNo`);
  console.log(`[1] Kartu terdampak (PIN invalid + booker gym): ${aff.recordset.length}`);
  console.table(aff.recordset);

  const ban = await p.request().query(`
    SELECT DISTINCT b.EmployeeID, CONVERT(varchar(10),b.BannedUntil,23) AS BannedUntil
    FROM dbo.gym_booking_ban b WHERE ${VICTIMS}`);
  console.log(`\n[2] Ban palsu (NO_SHOW_3X + ada tap ditolak di gym): ${ban.recordset.length}`);
  console.table(ban.recordset);

  if (!apply) { console.log('\n(DRY-RUN — tidak ada perubahan. Tambah --apply untuk eksekusi.)'); await p.close(); return; }

  // FIX 1: blank invalid PINs for affected gym-booker cards
  const f1 = await p.request().input('d', sql.Int, days).query(`
    UPDATE c SET c.PinCardNo=''
    FROM DataDBEnt.dbo.CardDB c
    WHERE (LEN(c.PinCardNo)%4)<>0
      AND c.StaffNo IN (SELECT DISTINCT gb.EmployeeID FROM dbo.gym_booking gb WHERE gb.BookingDate >= DATEADD(day,-@d, ${T}))`);
  console.log(`\n[FIX] PIN dikosongkan: ${f1.rowsAffected[0]} kartu`);

  // FIX 2: lift false NO_SHOW_3X bans (identified by rejected gym taps; PIN-independent)
  const f2 = await p.request().query(`
    UPDATE b SET b.BannedUntil=DATEADD(day,-1,${T}), b.ConsecutiveNoShow=0,
      b.UnbanRemark='Auto-unban: false NO_SHOW_3X from gym grant failure (Wrong Time Zone)', b.UnbanAt=GETDATE(), b.ActionBy='itsupport-bulkfix', b.UpdatedAt=GETDATE()
    FROM dbo.gym_booking_ban b WHERE ${VICTIMS}`);
  console.log(`[FIX] Ban palsu diangkat: ${f2.rowsAffected[0]}`);

  // FIX 3: void the false no-show bookings of the people we just unbanned
  const f3 = await p.request().query(`
    UPDATE gb SET gb.Status='CANCELLED', gb.RejectedReason='Voided: gym grant failure (Wrong Time Zone) - false no-show'
    FROM dbo.gym_booking gb
    WHERE gb.Status IN ('BOOKED','CHECKIN') AND gb.BookingDate < ${T} AND gb.BookingDate >= DATEADD(day,-7,${T})
      AND gb.EmployeeID IN (SELECT b.EmployeeID FROM dbo.gym_booking_ban b
        WHERE b.UnbanRemark='Auto-unban: false NO_SHOW_3X from gym grant failure (Wrong Time Zone)'
          AND b.UnbanAt >= DATEADD(minute,-5,GETDATE()))`);
  console.log(`[FIX] Booking no-show palsu di-void: ${f3.rowsAffected[0]}`);
  console.log('\nSelesai. Worker akan grant mereka otomatis pada sesi booking berikutnya (PIN sudah valid).');
  await p.close();
};
run().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
