/**
 * Diagnostic: Check booking & tap history for a specific date
 * Usage: node backend/scripts/check-booking-date.js 5945 2026-04-04
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import { envTrim, envBool } from '../lib/env.js';
import fs from 'fs';
dotenv.config();

const bookingId = Number(process.argv[2] || '5945');
const targetDate = process.argv[3] || '2026-04-04';
const lines = [];
const log = (msg) => { lines.push(msg); };

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
  log(`=== DIAGNOSE BOOKING ${bookingId} (GYMBOOK${bookingId}) pada tanggal ${targetDate} ===`);
  log('');

  const gymPool = await new sql.ConnectionPool(gymDbConfig).connect();

  // 1. Get the original booking
  log('[1] DATA BOOKING GYMBOOK' + bookingId);
  const bookingRes = await gymPool.request()
    .input('id', sql.Int, bookingId)
    .query(`
      SELECT 
        gb.BookingID, gb.EmployeeID, gb.CardNo, gb.EmployeeName,
        gb.Department, gb.Gender, gb.SessionName, gb.ScheduleID,
        CONVERT(varchar(10), gb.BookingDate, 23) AS BookingDate,
        gb.Status, gb.ApprovalStatus, gb.CreatedAt,
        CONVERT(varchar(5), s.StartTime, 108) AS SessionStart,
        CONVERT(varchar(5), s.EndTime, 108) AS SessionEnd,
        s.Session AS ScheduleSessionName,
        s.Quota, s.IsActive AS ScheduleIsActive
      FROM dbo.gym_booking gb
      LEFT JOIN dbo.gym_schedule s ON s.ScheduleID = gb.ScheduleID
      WHERE gb.BookingID = @id
    `);
  const booking = bookingRes?.recordset?.[0];
  if (!booking) {
    log('  BOOKING NOT FOUND!');
    fs.writeFileSync('backend/_diag_result.txt', lines.join('\n'), 'utf-8');
    await gymPool.close();
    process.exit(1);
  }
  log(`  Employee ID  : ${booking.EmployeeID}`);
  log(`  Employee Name: ${booking.EmployeeName}`);
  log(`  Card No      : ${booking.CardNo || '(KOSONG)'}`);
  log(`  Department   : ${booking.Department}`);
  log(`  Session      : ${booking.SessionName} (${booking.SessionStart} - ${booking.SessionEnd})`);
  log(`  Booking Date : ${booking.BookingDate}`);
  log(`  Status       : ${booking.Status}`);
  log(`  Approval     : ${booking.ApprovalStatus}`);
  log(`  Created At   : ${booking.CreatedAt}`);

  if (booking.BookingDate !== targetDate) {
    log(`  ** PERHATIAN: Booking ini untuk tanggal ${booking.BookingDate}, BUKAN ${targetDate}!`);
  }
  log('');

  // 2. Check ALL bookings for this employee on target date
  log(`[2] SEMUA BOOKING untuk ${booking.EmployeeID} pada ${targetDate}`);
  const allBookingsRes = await gymPool.request()
    .input('empId', sql.VarChar(20), booking.EmployeeID)
    .input('targetDate', sql.VarChar(10), targetDate)
    .query(`
      SELECT 
        gb.BookingID, gb.EmployeeID, gb.CardNo, gb.EmployeeName,
        gb.SessionName, gb.ScheduleID,
        CONVERT(varchar(10), gb.BookingDate, 23) AS BookingDate,
        gb.Status, gb.ApprovalStatus, gb.CreatedAt,
        CONVERT(varchar(5), s.StartTime, 108) AS SessionStart,
        CONVERT(varchar(5), s.EndTime, 108) AS SessionEnd
      FROM dbo.gym_booking gb
      LEFT JOIN dbo.gym_schedule s ON s.ScheduleID = gb.ScheduleID
      WHERE gb.EmployeeID = @empId 
        AND CONVERT(varchar(10), gb.BookingDate, 23) = @targetDate
      ORDER BY gb.BookingID
    `);
  const allBookings = allBookingsRes?.recordset || [];
  if (allBookings.length === 0) {
    log(`  TIDAK ADA BOOKING untuk ${booking.EmployeeID} pada ${targetDate}!`);
    log(`  --> INI MUNGKIN PENYEBABNYA: Karyawan tidak punya booking pada tanggal tersebut,`);
    log(`      sehingga worker TIDAK memberikan akses (grant) ke controller.`);
  } else {
    log(`  Ditemukan ${allBookings.length} booking(s):`);
    for (const b of allBookings) {
      log(`    BookingID: ${b.BookingID}, Session: ${b.SessionName} (${b.SessionStart}-${b.SessionEnd}), Status: ${b.Status}, Approval: ${b.ApprovalStatus}, CardNo: ${b.CardNo || '(kosong)'}`);
    }
  }
  log('');

  // 3. Check controller settings
  log('[3] CONTROLLER SETTINGS');
  const settingsRes = await gymPool.request().query(
    `SELECT TOP 1 EnableAutoOrganize, EnableManagerAllSessionAccess, GraceBeforeMin, GraceAfterMin, WorkerIntervalMs FROM dbo.gym_controller_settings WHERE Id = 1`
  );
  const settings = settingsRes?.recordset?.[0];
  if (settings) {
    log(`  AutoOrganize   : ${settings.EnableAutoOrganize ? 'ON' : 'OFF'}`);
    log(`  ManagerAllAccess: ${settings.EnableManagerAllSessionAccess ? 'ON' : 'OFF'}`);
    log(`  GraceBefore    : ${settings.GraceBeforeMin} min`);
    log(`  GraceAfter     : ${settings.GraceAfterMin} min`);
    log(`  WorkerInterval : ${settings.WorkerIntervalMs} ms`);
  }
  log('');

  // 4. Check controller access override
  log('[4] CONTROLLER ACCESS OVERRIDE');
  const unitNo = process.env.GYM_CONTROLLER_UNIT_NO || '0031';
  const overrideRes = await gymPool.request()
    .input('empId', sql.VarChar(20), booking.EmployeeID)
    .input('unit', sql.VarChar(20), unitNo)
    .query(`SELECT EmployeeID, UnitNo, CustomAccessTZ, Source, UpdatedAt FROM dbo.gym_controller_access_override WHERE EmployeeID = @empId AND UnitNo = @unit`);
  const override = overrideRes?.recordset?.[0];
  if (override) {
    const tzAllow = process.env.GYM_ACCESS_TZ_ALLOW || '01';
    log(`  AccessTZ : ${override.CustomAccessTZ} (${override.CustomAccessTZ === tzAllow ? 'ALLOWED' : 'DENIED'})`);
    log(`  Source   : ${override.Source}`);
    log(`  UpdatedAt: ${override.UpdatedAt}`);
    log(`  ** Note: Ini status SEKARANG, bukan status pada tgl ${targetDate}`);
  } else {
    log(`  Tidak ada override record`);
  }
  log('');

  // 5. Check CardDB
  log('[6] CARD DATABASE (DataDBEnt) - Status kartu');
  try {
    const cardPool = await new sql.ConnectionPool(cardDbConfig).connect();
    const cardRes = await cardPool.request()
      .input('empId', sql.VarChar(50), booking.EmployeeID)
      .query(`
        SELECT TOP 5 CardNo, StaffNo, department, [Status], [Block], del_state
        FROM dbo.CardDB 
        WHERE StaffNo = @empId OR CardNo = @empId
        ORDER BY CASE WHEN del_state = 1 AND [Block] = 0 AND [Status] = 1 THEN 0 ELSE 1 END
      `);
    const cards = cardRes?.recordset || [];
    if (cards.length === 0) {
      log(`  TIDAK ADA KARTU untuk ${booking.EmployeeID}`);
    } else {
      for (const c of cards) {
        log(`  CardNo: ${c.CardNo}, StaffNo: ${c.StaffNo}, Status: ${c.Status === 1 ? 'Active' : 'INACTIVE'}, Block: ${c.Block === 1 ? 'BLOCKED' : 'OK'}, del_state: ${c.del_state}, Dept: ${c.department}`);
      }
    }

    // 6. Check transaction logs on the target date
    log('');
    log(`[7] TRANSACTION LOG pada ${targetDate} untuk ${booking.EmployeeID} / Card ${booking.CardNo}`);
    
    // Try tblTransaction first
    const txTable = process.env.CARD_DB_TX_TABLE || 'tblTransaction';
    const txSchema = process.env.CARD_DB_TX_SCHEMA || 'dbo';
    
    // Discover columns
    const colsRes = await cardPool.request()
      .input('table', sql.VarChar(128), txTable)
      .input('schema', sql.VarChar(128), txSchema)
      .query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @table AND TABLE_SCHEMA = @schema`);
    const colNames = (colsRes?.recordset || []).map(r => String(r.COLUMN_NAME));
    log(`  Table: ${txSchema}.${txTable}, Columns: ${colNames.length > 0 ? colNames.join(', ') : 'N/A'}`);

    if (colNames.length > 0) {
      // Find relevant columns
      const findCol = (candidates) => {
        for (const c of candidates) {
          const found = colNames.find(cn => cn.toLowerCase() === c.toLowerCase());
          if (found) return found;
        }
        return null;
      };
      
      const timeCol = findCol(['TransactionDate', 'DateTime', 'datetime', 'Time', 'time', 'LogDate', 'log_date', 'EventTime']);
      const cardCol = findCol(['CardNo', 'cardno', 'card_no', 'CardNumber']);
      const staffCol = findCol(['StaffNo', 'staffno', 'staff_no', 'EmployeeID', 'employee_id']);
      const eventCol = findCol(['EventDescription', 'Event', 'event', 'EventType', 'event_type', 'Description']);
      const unitCol = findCol(['UnitNo', 'unitno', 'unit_no', 'Unit']);

      log(`  Mapped: time=${timeCol}, card=${cardCol}, staff=${staffCol}, event=${eventCol}, unit=${unitCol}`);

      if (timeCol) {
        const whereConditions = [];
        const req = cardPool.request();
        req.input('dateStart', sql.VarChar(20), targetDate + ' 00:00:00');
        req.input('dateEnd', sql.VarChar(20), targetDate + ' 23:59:59');
        whereConditions.push(`[${timeCol}] >= @dateStart AND [${timeCol}] <= @dateEnd`);

        if (cardCol && booking.CardNo) {
          req.input('cardNo', sql.VarChar(50), booking.CardNo);
          whereConditions.push(`([${cardCol}] = @cardNo${staffCol ? ` OR [${staffCol}] = @empId` : ''})`);
          if (staffCol) req.input('empId', sql.VarChar(50), booking.EmployeeID);
        } else if (staffCol) {
          req.input('empId', sql.VarChar(50), booking.EmployeeID);
          whereConditions.push(`[${staffCol}] = @empId`);
        }

        const selectCols = [timeCol, cardCol, staffCol, eventCol, unitCol].filter(Boolean).map(c => `[${c}]`).join(', ');
        const q = `SELECT TOP 20 ${selectCols} FROM [${txSchema}].[${txTable}] WHERE ${whereConditions.join(' AND ')} ORDER BY [${timeCol}] DESC`;
        
        try {
          const txRes = await req.query(q);
          const txRows = txRes?.recordset || [];
          if (txRows.length === 0) {
            log(`  TIDAK ADA TRANSAKSI tap untuk employee/card ini pada ${targetDate}`);
            log(`  --> Kemungkinan karyawan memang tidak pernah tap, atau tap ditolak di level hardware`);
          } else {
            log(`  Ditemukan ${txRows.length} transaksi:`);
            for (const tx of txRows) {
              const cols = Object.entries(tx).map(([k,v]) => `${k}=${v}`).join(', ');
              log(`    ${cols}`);
            }
          }
        } catch (e) {
          log(`  Query error: ${e.message}`);
        }
      }
    }

    await cardPool.close();
  } catch (e) {
    log(`  CardDB connection error: ${e.message}`);
  }

  // 7. Check gym_reports for that date
  log('');
  log(`[8] GYM REPORTS untuk ${booking.EmployeeID} pada ${targetDate}`);
  try {
    const reportsRes = await gymPool.request()
      .input('empId', sql.VarChar(20), booking.EmployeeID)
      .input('targetDate', sql.VarChar(10), targetDate)
      .query(`
        SELECT TOP 5 ReportID, BookingID, EmployeeID, CardNo, Name, Department, SessionName,
          CONVERT(varchar(10), BookingDate, 23) AS BookingDate, TimeStart, TimeEnd
        FROM dbo.gym_reports 
        WHERE EmployeeID = @empId AND CONVERT(varchar(10), BookingDate, 23) = @targetDate
        ORDER BY ReportID DESC
      `);
    const reports = reportsRes?.recordset || [];
    if (reports.length === 0) {
      log(`  Tidak ada entry di gym_reports`);
    } else {
      for (const r of reports) {
        log(`  ReportID: ${r.ReportID}, BookingID: ${r.BookingID}, Session: ${r.SessionName}, Date: ${r.BookingDate}, Time: ${r.TimeStart}-${r.TimeEnd}`);
      }
    }
  } catch (e) {
    log(`  Reports query error: ${e.message}`);
  }

  await gymPool.close();

  // Summary
  log('');
  log('=== RINGKASAN ANALISIS ===');
  
  if (allBookings.length === 0) {
    log(`PENYEBAB UTAMA: Karyawan ${booking.EmployeeID} (${booking.EmployeeName}) TIDAK PUNYA BOOKING pada ${targetDate}.`);
    log(`Booking GYMBOOK${bookingId} adalah untuk tanggal ${booking.BookingDate}, BUKAN ${targetDate}.`);
    log(`Karena tidak ada booking pada ${targetDate}, worker tidak memberikan grant akses ke controller, sehingga tap ditolak.`);
  } else {
    // Check each booking for issues
    for (const b of allBookings) {
      const issues = [];
      if (b.Status === 'CANCELLED' || b.Status === 'EXPIRED') {
        issues.push(`Status = ${b.Status}`);
      }
      if (b.ApprovalStatus === 'REJECTED') {
        issues.push(`Approval = REJECTED`);
      }
      if (!b.CardNo) {
        issues.push(`CardNo KOSONG`);
      }
      if (issues.length > 0) {
        log(`Booking ${b.BookingID}: ${issues.join(', ')}`);
      } else {
        log(`Booking ${b.BookingID}: Data booking OK. Cek status kartu dan log transaksi di atas.`);
      }
    }
  }

  log('');
  fs.writeFileSync('backend/_diag_result.txt', lines.join('\n'), 'utf-8');
  console.log(lines.join('\n'));
}

run().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
