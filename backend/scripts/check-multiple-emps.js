/**
 * Investigasi Tap Karyawan (Multiple IDs)
 * Cek status kartu, latest booking, dan history tap mereka
 */
import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const empIds = ['MTI230195', 'MTI250114', 'MTI230123'];

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

async function run() {
  console.log(`=== PENGECEKAN KARTU & TAP KARYAWAN ===\n`);

  const gymPool = await new sql.ConnectionPool(gymDbConfig).connect();
  let cardPool = null;
  try {
    cardPool = await new sql.ConnectionPool(cardDbConfig).connect();
  } catch (e) {
    console.log(`[!] Gagal connect CardDB: ${e.message}`);
  }

  for (const emp of empIds) {
    console.log(`\n========================================`);
    console.log(` KARYAWAN: ${emp}`);
    console.log(`========================================`);

    // 1. Cek Data Kartu (CardDB)
    let cardNo = null;
    let isActive = false;
    if (cardPool) {
      console.log(`[1] STATUS KARTU (CardDB)`);
      const cardRes = await cardPool.request()
        .input('empId', sql.VarChar(50), emp)
        .query(`
          SELECT TOP 1 CardNo, Name, Status, Block, del_state, Department
          FROM dbo.CardDB 
          WHERE StaffNo = @empId
          ORDER BY CASE WHEN del_state = 1 AND [Block] = 0 AND [Status] = 1 THEN 0 ELSE 1 END
        `);
      const card = cardRes?.recordset?.[0];
      if (card) {
        cardNo = card.CardNo;
        isActive = card.Status === 1 && card.Block !== 1 && card.del_state === 1;
        console.log(`  Name      : ${card.Name}`);
        console.log(`  Card No   : ${card.CardNo}`);
        console.log(`  Status    : ${card.Status === 1 ? 'ACTIVE' : 'INACTIVE'} (Block=${card.Block}, del_state=${card.del_state}) - ${isActive ? '✅ BISA TAP' : '❌ AKAN DITOLAK MESIN'}`);
        console.log(`  Department: ${card.Department}`);
      } else {
        console.log(`  ❌ TIDAK ADA KARTU untuk ${emp} di CardDB`);
      }
    } else {
      console.log(`[1] STATUS KARTU: Skipped (CardDB offline)`);
    }

    // 2. Cek Booking Terakhir (GymDB)
    console.log(`\n[2] 5 BOOKING TERAKHIR (GymDB)`);
    const bkRes = await gymPool.request()
      .input('empId', sql.VarChar(20), emp)
      .query(`
        SELECT TOP 5 BookingID, CONVERT(varchar(10), BookingDate, 23) AS BookingDate, 
          SessionName, Status, ApprovalStatus, CardNo
        FROM dbo.gym_booking
        WHERE EmployeeID = @empId
        ORDER BY BookingDate DESC, BookingID DESC
      `);
    const bookings = bkRes?.recordset || [];
    if (bookings.length === 0) {
      console.log(`  TIDAK ADA BOOKING sama sekali`);
    } else {
      for (const b of bookings) {
        console.log(`  - GYMBOOK${b.BookingID} | Date: ${b.BookingDate} | Status: ${b.Status} | Approval: ${b.ApprovalStatus} | CardNo: ${b.CardNo}`);
      }
    }

    // 3. Cek transaksi tap Live Taps (yg di-sync oleh sistem)
    console.log(`\n[3] RECORD TAP DI GYM (gym_live_taps, 5 terakhir)`);
    const tapsRes = await gymPool.request()
      .input('empId', sql.VarChar(20), emp)
      .query(`
        SELECT TOP 5 ID, EmployeeID, CardNo, [Transaction], 
          CONVERT(varchar(19), TxnTime, 120) AS TxnTime
        FROM dbo.gym_live_taps 
        WHERE EmployeeID = @empId
        ORDER BY TxnTime DESC
      `);
    const taps = tapsRes?.recordset || [];
    if (taps.length === 0) {
      console.log(`  ❌ TIDAK PERNAH TAP / TIDAK TERDATA KE SYSTEM GYM_LIVE_TAPS`);
    } else {
      for (const t of taps) {
        console.log(`  - Waktu: ${t.TxnTime} | Jenis: ${t.Transaction} | Entry: ${t.IsEntry}`);
      }
    }

    // 4. Jika tidak ada tap di GymDB, cek di CardDB (barangkali nge-tap tapi error/kartu nolak)
    if (cardPool && cardNo) {
      console.log(`\n[4] RAW HARDWARE LOG (CardDB tblTransaction - 5 terakhir jika ada)`);
      try {
        const rawTaps = await cardPool.request()
          .input('cardNo', sql.VarChar(50), cardNo)
          .query(`
            SELECT TOP 5 TrDateTime, UnitNo, [Transaction], TrCode
            FROM dbo.tblTransaction
            WHERE CardNo = @cardNo
            ORDER BY ID DESC
          `);
        const raws = rawTaps?.recordset || [];
        if (raws.length === 0) {
          console.log(`  TIDAK ADA DATA LOG HARDWARE UNTUK KARTU INI SAMA SEKALI`);
        } else {
          for (const r of raws) {
            console.log(`  - Waktu: ${r.TrDateTime.toISOString()} | Mesin: ${r.UnitNo} | Ket: ${r.Transaction} | Code: ${r.TrCode}`);
          }
        }
      } catch(e) {
        console.log(`  Table Transaction query error: ${e.message}`);
      }
    }
  }

  await gymPool.close();
  if (cardPool) await cardPool.close();
}

run().catch(e => console.error('FATAL ERROR:', e));
