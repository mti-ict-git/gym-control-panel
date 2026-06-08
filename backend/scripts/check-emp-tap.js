/**
 * Diagnostic: kenapa seorang karyawan tidak bisa tapping?
 * Mereplikasi LOGIKA WORKER (app.js) untuk memutuskan apakah akses diberikan SEKARANG.
 * Usage: node backend/scripts/check-emp-tap.js MTI240576
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const empId = String(process.argv[2] || 'MTI240576').trim();
const lines = [];
const log = (m) => { lines.push(m); console.log(m); };

const gymDbConfig = {
  server: process.env.DB_SERVER,
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: process.env.DB_ENCRYPT === 'true', trustServerCertificate: true },
  pool: { max: 3, min: 0, idleTimeoutMillis: 5000 },
};
const cardDbConfig = {
  server: process.env.CARDDB_SERVER,
  port: Number(process.env.CARDDB_PORT || 1433),
  database: process.env.CARDDB_NAME,
  user: process.env.CARDDB_USER,
  password: process.env.CARDDB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true },
  pool: { max: 3, min: 0, idleTimeoutMillis: 5000 },
};

// ---- replikasi logika tanggal/waktu worker (app.js) ----
const tzOffsetMinutes = Number(process.env.GYM_TZ_OFFSET_MINUTES || 8 * 60);
const nowUtcMs = Date.now();
const nowInTz = new Date(nowUtcMs + tzOffsetMinutes * 60_000);
const pad2 = (n) => String(n).padStart(2, '0');
const todayStr = `${nowInTz.getUTCFullYear()}-${pad2(nowInTz.getUTCMonth() + 1)}-${pad2(nowInTz.getUTCDate())}`;
const yestInTz = new Date(nowInTz.getTime() - 24 * 60 * 60 * 1000);
const yesterdayStr = `${yestInTz.getUTCFullYear()}-${pad2(yestInTz.getUTCMonth() + 1)}-${pad2(yestInTz.getUTCDate())}`;
const parseHHMM = (s) => { const m = /^(\d{2}):(\d{2})$/.exec(String(s || '').trim()); return m ? { hh: +m[1], mm: +m[2] } : null; };
const parseYmdToUtcDate = (ymd) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim()); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0)) : null; };
const toUtcMsForTzDateTime = (d, hh, mm) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hh, mm, 0, 0) - tzOffsetMinutes * 60_000;
const fmt = (ms) => new Date(ms + tzOffsetMinutes * 60_000).toISOString().slice(0, 16).replace('T', ' ') + ' GMT+8';

async function run() {
  log(`=== DIAGNOSA TAP: ${empId} ===`);
  log(`Sekarang: ${fmt(nowUtcMs)} | today=${todayStr} yesterday=${yesterdayStr}`);
  log('');

  const gymPool = await new sql.ConnectionPool(gymDbConfig).connect();

  // settings
  const sres = await gymPool.request().query(
    `SELECT TOP 1 EnableAutoOrganize, EnableManagerAllSessionAccess, GraceBeforeMin, GraceAfterMin, WorkerIntervalMs FROM dbo.gym_controller_settings WHERE Id=1`
  );
  const st = sres?.recordset?.[0] || {};
  const enabled = !!st.EnableAutoOrganize;
  const graceBefore = Number(st.GraceBeforeMin || 0);
  const graceAfter = Number(st.GraceAfterMin || 0);
  log(`[SETTINGS] AutoOrganize=${enabled ? 'ON' : 'OFF'} GraceBefore=${graceBefore}m GraceAfter=${graceAfter}m ManagerAllAccess=${st.EnableManagerAllSessionAccess ? 'ON' : 'OFF'} Interval=${st.WorkerIntervalMs}ms`);
  if (!enabled) log(`  !! AutoOrganize OFF -> worker tidak grant/prune akses berbasis booking.`);
  log('');

  // bookings (recent + today/yesterday focus)
  log(`[BOOKING] 8 terakhir`);
  const bk = await gymPool.request().input('e', sql.VarChar(20), empId).query(
    `SELECT TOP 8 gb.BookingID, CONVERT(varchar(10), gb.BookingDate, 23) AS d, gb.SessionName, gb.Status, gb.ApprovalStatus, gb.CardNo,
       CONVERT(varchar(5), s.StartTime, 108) AS ts, CONVERT(varchar(5), s.EndTime, 108) AS te, gb.CreatedAt
     FROM dbo.gym_booking gb LEFT JOIN dbo.gym_schedule s ON s.ScheduleID=gb.ScheduleID
     WHERE gb.EmployeeID=@e ORDER BY gb.BookingDate DESC, gb.BookingID DESC`);
  const bookings = bk?.recordset || [];
  if (!bookings.length) log(`  TIDAK ADA BOOKING sama sekali untuk ${empId}.`);
  for (const b of bookings) {
    const created = b.CreatedAt ? new Date(b.CreatedAt.getTime?.() ? b.CreatedAt : b.CreatedAt) : null;
    log(`  GYMBOOK${b.BookingID} | tgl=${b.d} | ${b.SessionName} (${b.ts || '?'}-${b.te || '?'}) | ${b.Status}/${b.ApprovalStatus} | Card=${b.CardNo || '(kosong)'} | dibuat=${created ? created.toISOString().slice(0,16).replace('T',' ') : '?'}`);
  }
  log('');

  // worker grant simulation for today/yesterday bookings (the ones worker loads)
  log(`[SIMULASI WORKER] booking yg diproses worker (tgl IN today/yesterday, status BOOKED/CHECKIN/COMPLETED)`);
  const wbk = bookings.filter(b => (b.d === todayStr || b.d === yesterdayStr) && ['BOOKED', 'CHECKIN', 'COMPLETED'].includes(b.Status));
  if (!wbk.length) {
    log(`  TIDAK ADA booking ${empId} bertanggal ${todayStr} atau ${yesterdayStr} dgn status aktif.`);
    log(`  -> Worker tidak punya basis untuk grant akses. INI BIASANYA PENYEBABNYA.`);
  }
  let anyInRange = false;
  for (const b of wbk) {
    const start = parseHHMM(b.ts);
    if (!start) { log(`  GYMBOOK${b.BookingID}: jadwal/StartTime tidak valid -> dilewati worker`); continue; }
    const end = parseHHMM(b.te);
    const base = parseYmdToUtcDate(b.d);
    const startRaw = toUtcMsForTzDateTime(base, start.hh, start.mm);
    let endRaw = end ? toUtcMsForTzDateTime(base, end.hh, end.mm) : startRaw + 3600_000;
    if (endRaw <= startRaw) endRaw += 24 * 3600_000;
    const winStart = startRaw - graceBefore * 60_000;
    const winEnd = endRaw + graceAfter * 60_000;
    const inRange = nowUtcMs >= winStart && nowUtcMs <= winEnd;
    if (inRange) anyInRange = true;
    log(`  GYMBOOK${b.BookingID} (tgl ${b.d}): window akses ${fmt(winStart)} s/d ${fmt(winEnd)} -> ${inRange ? '✅ DALAM WINDOW (grant)' : '❌ DI LUAR WINDOW (tidak grant)'}`);
  }
  log(`  => Worker akan memberi akses SEKARANG? ${anyInRange ? 'YA' : 'TIDAK'}`);
  log('');

  // current override (actual door state)
  const unitNo = process.env.GYM_CONTROLLER_UNIT_NO || (process.env.GYM_UNIT_FILTER || '0031').split(',')[0].trim();
  const tzAllow = process.env.GYM_ACCESS_TZ_ALLOW || '01';
  log(`[STATUS PINTU SEKARANG] override unit ${unitNo}`);
  const ov = await gymPool.request().input('e', sql.VarChar(20), empId).input('u', sql.VarChar(20), unitNo)
    .query(`SELECT CustomAccessTZ, Source, UpdatedAt FROM dbo.gym_controller_access_override WHERE EmployeeID=@e AND UnitNo=@u`);
  const o = ov?.recordset?.[0];
  if (o) log(`  TZ=${o.CustomAccessTZ} -> ${o.CustomAccessTZ === tzAllow ? '✅ ALLOWED' : '❌ DENIED'} | Source=${o.Source} | Updated=${o.UpdatedAt ? new Date(o.UpdatedAt).toISOString().slice(0,16).replace('T',' ') : '?'}`);
  else log(`  Tidak ada record override -> pintu DENY (default) untuk ${empId}.`);
  log('');

  // committee
  const cm = await gymPool.request().input('e', sql.VarChar(20), empId).input('u', sql.VarChar(20), unitNo)
    .query(`SELECT IsActive FROM dbo.gym_access_committee WHERE EmployeeID=@e AND UnitNo=@u`);
  log(`[COMMITTEE] ${cm?.recordset?.[0]?.IsActive ? 'YA (always-allow)' : 'bukan committee'}`);

  // ban
  const ban = await gymPool.request().input('e', sql.VarChar(20), empId)
    .query(`SELECT BannedUntil, Reason, ConsecutiveNoShow FROM dbo.gym_booking_ban WHERE EmployeeID=@e`);
  const bn = ban?.recordset?.[0];
  if (bn) {
    const until = bn.BannedUntil ? new Date(bn.BannedUntil).toISOString().slice(0, 10) : 'N/A';
    log(`[BAN] until=${until} (${until >= todayStr ? '❌ AKTIF' : 'expired'}) reason=${bn.Reason || '-'} noShow=${bn.ConsecutiveNoShow}`);
  } else log(`[BAN] tidak ada`);

  // live taps
  const lt = await gymPool.request().input('e', sql.VarChar(20), empId)
    .query(`SELECT TOP 5 [Transaction], CONVERT(varchar(19), TxnTime, 120) AS t, CardNo FROM dbo.gym_live_taps WHERE EmployeeID=@e ORDER BY TxnTime DESC`);
  log('');
  log(`[GYM_LIVE_TAPS] 5 terakhir`);
  const taps = lt?.recordset || [];
  if (!taps.length) log(`  tidak ada tap tercatat`);
  for (const t of taps) log(`  ${t.t} | ${t.Transaction} | Card=${t.CardNo}`);
  log('');

  // CardDB status
  log(`[CARDDB] status kartu fisik`);
  try {
    const cardPool = await new sql.ConnectionPool(cardDbConfig).connect();
    const cr = await cardPool.request().input('e', sql.VarChar(50), empId).query(
      `SELECT TOP 5 CardNo, StaffNo, Name, department, [Status], [Block], del_state FROM dbo.CardDB WHERE StaffNo=@e OR CardNo=@e
       ORDER BY CASE WHEN del_state=1 AND [Block]=0 AND [Status]=1 THEN 0 ELSE 1 END`);
    const cards = cr?.recordset || [];
    if (!cards.length) log(`  ❌ TIDAK ADA KARTU untuk ${empId} di CardDB`);
    for (const c of cards) {
      // NB: BIT columns come back from mssql as JS booleans (true/false), not 1/0 — compare truthiness.
      // del_state is intentionally NOT part of "healthy": cards with del_state=0 tap fine at other doors.
      const active = !!c.Status;
      const blocked = !!c.Block;
      const ok = active && !blocked;
      log(`  Card=${c.CardNo} Staff=${c.StaffNo} Name=${c.Name} Status=${active ? 'Active' : 'INACTIVE'} Block=${blocked ? 'BLOCKED' : 'OK'} del_state=${c.del_state} -> ${ok ? '✅ kartu sehat (level CardDB)' : '❌ kartu bermasalah'}`);
    }
    await cardPool.close();
  } catch (e) { log(`  CardDB error: ${e.message}`); }

  await gymPool.close();

  // verdict
  log('');
  log(`=== KESIMPULAN ===`);
  if (!wbk.length) {
    log(`PENYEBAB UTAMA: ${empId} tidak punya booking untuk HARI INI (${todayStr}).`);
    log(`Booking yg ada bertanggal lain (lihat daftar di atas). Worker hanya grant akses untuk booking bertanggal hari ini, di dalam jam sesi.`);
    log(`Booking kemarin TIDAK berlaku untuk tap hari ini -- harus booking ulang untuk tanggal ${todayStr}.`);
  } else if (!anyInRange) {
    log(`${empId} punya booking aktif tapi waktu sekarang DI LUAR window sesi (lihat simulasi). Tap hanya diizinkan di dalam window jam sesi.`);
  } else if (o && o.CustomAccessTZ === tzAllow) {
    log(`Akses SUDAH allowed di controller. Jika tap masih gagal, masalah di sisi kartu/hardware (cek CardDB & raw log).`);
  } else {
    log(`Worker SEHARUSNYA grant tapi override pintu belum allow. Cek apakah worker jalan, AutoOrganize ON, dan tidak ada error grant.`);
  }
  fs.writeFileSync('backend/_diag_emp.txt', lines.join('\n'), 'utf-8');
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
