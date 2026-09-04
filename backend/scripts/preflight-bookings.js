/**
 * Pre-flight check booking gym: deteksi masalah SEBELUM sesi dimulai.
 *
 * Memeriksa tiap booking hari itu terhadap penyebab "sudah booking tapi tidak bisa
 * tapping" yang pernah terjadi:
 *   - CardNo di booking tidak cocok dengan kartu aktif pemiliknya (kartu orang lain)
 *   - kartu tidak ada / INACTIVE / BLOCKED di CardDB
 *   - PinCardNo panjangnya bukan kelipatan 4 (Vault crash Base64, grant tak pernah mendarat)
 *   - karyawan sedang kena ban
 *
 * Usage: node backend/scripts/preflight-bookings.js [yyyy-MM-dd]
 */
import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const day = process.argv[2] || new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
const cfg = {
  server: process.env.DB_SERVER, port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_DATABASE, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  options: { encrypt: process.env.DB_ENCRYPT === 'true', trustServerCertificate: true },
};

const run = async () => {
  const p = await new sql.ConnectionPool(cfg).connect();
  const r = await p.request().input('d', sql.Date, new Date(day)).query(`
    SELECT gb.BookingID, gb.EmployeeID, gb.EmployeeName, gb.CardNo AS booking_card,
      gb.SessionName, gb.Status,
      cd.CardNo AS actual_card, cd.[Status] AS card_active, cd.[Block] AS card_block,
      cd.PinCardNo, LEN(cd.PinCardNo) AS pinlen,
      ban.BannedUntil
    FROM dbo.gym_booking gb
    OUTER APPLY (
      SELECT TOP 1 c.CardNo, c.[Status], c.[Block], c.PinCardNo
      FROM DataDBEnt.dbo.CardDB c
      WHERE c.StaffNo = gb.EmployeeID AND (c.del_state = 0 OR c.del_state IS NULL)
      ORDER BY CASE WHEN c.[Status] = 1 THEN 0 ELSE 1 END
    ) cd
    OUTER APPLY (
      SELECT TOP 1 b.BannedUntil FROM dbo.gym_booking_ban b
      WHERE b.EmployeeID = gb.EmployeeID AND b.BannedUntil >= @d
    ) ban
    WHERE gb.BookingDate = @d AND gb.Status IN ('BOOKED','CHECKIN')
    ORDER BY gb.SessionName, gb.EmployeeID`);

  const rows = r.recordset || [];
  const problems = [];
  for (const x of rows) {
    const issues = [];
    if (!x.actual_card) issues.push('TIDAK PUNYA KARTU di CardDB');
    else {
      if (!x.card_active) issues.push('kartu INACTIVE');
      if (x.card_block) issues.push('kartu BLOCKED');
      if (x.booking_card && String(x.booking_card) !== String(x.actual_card)) {
        issues.push(`CardNo booking SALAH (booking=${x.booking_card} vs asli=${x.actual_card})`);
      }
      if (x.pinlen != null && x.pinlen % 4 !== 0) issues.push(`PIN invalid (len ${x.pinlen}) -> grant Vault akan CRASH`);
    }
    if (x.BannedUntil) issues.push('sedang KENA BAN');
    if (issues.length) problems.push({ ...x, issues });
  }

  console.log(`=== PRE-FLIGHT ${day} | ${rows.length} booking aktif ===`);
  if (!problems.length) {
    console.log('BERSIH: tidak ada masalah data yang akan memblokir tapping.');
  } else {
    console.log(`DITEMUKAN ${problems.length} booking bermasalah:\n`);
    for (const x of problems) {
      console.log(`  GYMBOOK${x.BookingID} | ${x.EmployeeID} ${x.EmployeeName} | ${x.SessionName}`);
      for (const i of x.issues) console.log(`     -> ${i}`);
    }
  }
  await p.close();
};
run().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
