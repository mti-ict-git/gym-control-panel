/**
 * Diagnostic script: Check why a booking can't tap
 * Usage: node backend/scripts/check-booking.js 5945
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import { envTrim, envBool } from '../lib/env.js';
import fs from 'fs';
dotenv.config();

const bookingId = Number(process.argv[2] || '5945');
const lines = [];
const log = (msg) => { lines.push(msg); console.log(msg); };

function classifyEmployeeIdKind(employeeId) {
  const id = String(employeeId ?? '').trim();
  if (!id) return 'UNKNOWN';
  if (/^MTI/i.test(id)) return 'MTI';
  if (/^5/.test(id)) return 'MMS';
  return 'VENDOR';
}

function formatMin(m) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
}

async function run() {
  log(`\n=== DIAGNOSE BOOKING ID: ${bookingId} (GYMBOOK${bookingId}) ===\n`);

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

  // STEP 1: Booking Data
  log(`[1] BOOKING DATA`);
  const gymPool = await new sql.ConnectionPool(gymDbConfig).connect();
  
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
    log(`  [FAIL] BOOKING NOT FOUND! BookingID ${bookingId} does not exist.`);
    await gymPool.close();
    fs.writeFileSync('backend/_diag_result.txt', lines.join('\n'), 'utf-8');
    process.exit(1);
  }
  
  log(`  Employee ID  : ${booking.EmployeeID}`);
  log(`  Employee Name: ${booking.EmployeeName}`);
  log(`  Card No      : ${booking.CardNo || '(EMPTY!)'}`);
  log(`  Department   : ${booking.Department}`);
  log(`  Gender       : ${booking.Gender}`);
  log(`  Session      : ${booking.SessionName} (Schedule: ${booking.ScheduleSessionName})`);
  log(`  Time         : ${booking.SessionStart} - ${booking.SessionEnd}`);
  log(`  Booking Date : ${booking.BookingDate}`);
  log(`  Status       : ${booking.Status}`);
  log(`  Approval     : ${booking.ApprovalStatus}`);
  log(`  Created At   : ${booking.CreatedAt}`);
  log(`  Schedule Active: ${booking.ScheduleIsActive}`);
  log(`  Schedule Quota : ${booking.Quota}`);
  log('');

  // STEP 2: Issue Analysis
  log(`[2] ISSUE ANALYSIS`);
  const issues = [];
  
  if (booking.Status !== 'BOOKED' && booking.Status !== 'CHECKIN') {
    issues.push(`[FAIL] STATUS = "${booking.Status}" -- harus "BOOKED" atau "CHECKIN"`);
  } else {
    log(`  [OK] Status: ${booking.Status}`);
  }
  
  const empKind = classifyEmployeeIdKind(booking.EmployeeID);
  const deptUpper = (booking.Department || '').toUpperCase();
  if (['MMS', 'VENDOR'].includes(empKind) || deptUpper === 'MMS' || deptUpper === 'VISITOR') {
    if (booking.ApprovalStatus !== 'APPROVED') {
      issues.push(`[FAIL] APPROVAL = "${booking.ApprovalStatus}" -- Dept "${booking.Department}" (${empKind}) HARUS "APPROVED" untuk worker grant akses`);
    } else {
      log(`  [OK] Approval for ${empKind}: ${booking.ApprovalStatus}`);
    }
  } else {
    log(`  [OK] Approval: ${booking.ApprovalStatus} (non-MMS/VISITOR)`);
  }
  
  if (!booking.CardNo || String(booking.CardNo).trim() === '') {
    issues.push(`[FAIL] CARD NO KOSONG -- Worker tidak bisa kirim akses ke controller tanpa CardNo`);
  } else {
    log(`  [OK] Card No: ${booking.CardNo}`);
  }
  
  const now = new Date();
  const nowGmt8 = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const todayStr = `${nowGmt8.getUTCFullYear()}-${String(nowGmt8.getUTCMonth() + 1).padStart(2, '0')}-${String(nowGmt8.getUTCDate()).padStart(2, '0')}`;
  
  if (booking.BookingDate !== todayStr) {
    issues.push(`[WARN] BOOKING DATE = "${booking.BookingDate}" tapi HARI INI = "${todayStr}" -- Worker hanya proses booking hari ini dan kemarin`);
  } else {
    log(`  [OK] Booking Date = today: ${todayStr}`);
  }
  
  if (booking.SessionStart && booking.SessionEnd) {
    const [sh, sm] = booking.SessionStart.split(':').map(Number);
    const [eh, em] = booking.SessionEnd.split(':').map(Number);
    const nowHH = nowGmt8.getUTCHours();
    const nowMM = nowGmt8.getUTCMinutes();
    const nowMin = nowHH * 60 + nowMM;
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    
    const graceRes = await gymPool.request().query(
      `SELECT TOP 1 GraceBeforeMin, GraceAfterMin, EnableAutoOrganize, WorkerIntervalMs FROM dbo.gym_controller_settings WHERE Id = 1`
    );
    const settings = graceRes?.recordset?.[0];
    const graceBefore = Number(settings?.GraceBeforeMin || 0);
    const graceAfter = Number(settings?.GraceAfterMin || 0);
    const autoOrganize = settings?.EnableAutoOrganize ? true : false;
    
    log(`  [INFO] Controller Settings: AutoOrganize=${autoOrganize}, GraceBefore=${graceBefore}min, GraceAfter=${graceAfter}min, Interval=${settings?.WorkerIntervalMs}ms`);
    
    const effectiveStartMin = startMin - graceBefore;
    const effectiveEndMin = endMin + graceAfter;
    
    if (nowMin < effectiveStartMin || nowMin > effectiveEndMin) {
      issues.push(`[FAIL] WAKTU (${String(nowHH).padStart(2,'0')}:${String(nowMM).padStart(2,'0')}) di LUAR range sesi ${booking.SessionStart}-${booking.SessionEnd} (effective: ${formatMin(effectiveStartMin)}-${formatMin(effectiveEndMin)})`);
    } else {
      log(`  [OK] Waktu (${String(nowHH).padStart(2,'0')}:${String(nowMM).padStart(2,'0')}) dalam range ${booking.SessionStart}-${booking.SessionEnd} (effective: ${formatMin(effectiveStartMin)}-${formatMin(effectiveEndMin)})`);
    }
    
    if (!autoOrganize) {
      issues.push(`[WARN] AUTO ORGANIZE DISABLED! Worker tidak auto grant/deny.`);
    }
  }
  
  // STEP 3: Controller Override
  log('');
  log(`[3] CONTROLLER ACCESS OVERRIDE`);
  const unitNo = process.env.GYM_CONTROLLER_UNIT_NO || process.env.GYM_UNIT_FILTER || '0031';
  const overrideRes = await gymPool.request()
    .input('empId', sql.VarChar(20), booking.EmployeeID)
    .input('unit', sql.VarChar(20), unitNo)
    .query(`SELECT EmployeeID, UnitNo, CustomAccessTZ, Source, UpdatedAt FROM dbo.gym_controller_access_override WHERE EmployeeID = @empId AND UnitNo = @unit`);
  
  const override = overrideRes?.recordset?.[0];
  if (override) {
    const tzAllow = process.env.GYM_ACCESS_TZ_ALLOW || '01';
    const tzDeny = process.env.GYM_ACCESS_TZ_DENY || '00';
    const isAllowed = override.CustomAccessTZ === tzAllow;
    log(`  Override found:`);
    log(`    AccessTZ : ${override.CustomAccessTZ} (${isAllowed ? 'ALLOWED' : 'DENIED'}) [Allow=${tzAllow}, Deny=${tzDeny}]`);
    log(`    Source   : ${override.Source}`);
    log(`    UpdatedAt: ${override.UpdatedAt}`);
    if (!isAllowed) {
      issues.push(`[FAIL] CONTROLLER ACCESS = DENIED (TZ=${override.CustomAccessTZ}) Source: ${override.Source}`);
    }
  } else {
    log(`  [WARN] No override record for ${booking.EmployeeID} @ unit ${unitNo}`);
    issues.push(`[WARN] No override in gym_controller_access_override for unit ${unitNo}`);
  }
  
  // STEP 4: Committee
  log('');
  log(`[4] COMMITTEE / ALWAYS-ALLOW`);
  const committeeRes = await gymPool.request()
    .input('empId', sql.VarChar(20), booking.EmployeeID)
    .input('unit', sql.VarChar(20), unitNo)
    .query(`SELECT EmployeeID, IsActive FROM dbo.gym_access_committee WHERE EmployeeID = @empId AND UnitNo = @unit`);
  
  const committee = committeeRes?.recordset?.[0];
  if (committee && committee.IsActive) {
    log(`  [OK] Employee is COMMITTEE (always-allow)`);
  } else {
    log(`  [INFO] Not a committee member`);
  }
  
  // STEP 5: Ban
  log('');
  log(`[5] BAN STATUS`);
  const banRes = await gymPool.request()
    .input('empId', sql.VarChar(20), booking.EmployeeID)
    .query(`SELECT EmployeeID, BannedUntil, Reason, ConsecutiveNoShow FROM dbo.gym_booking_ban WHERE EmployeeID = @empId`);
  
  const ban = banRes?.recordset?.[0];
  if (ban) {
    const bannedUntil = ban.BannedUntil ? new Date(ban.BannedUntil).toISOString().slice(0, 10) : 'N/A';
    const isBanned = bannedUntil >= todayStr;
    log(`  Ban record: Until ${bannedUntil}, Reason: ${ban.Reason || 'N/A'}, NoShow: ${ban.ConsecutiveNoShow} ${isBanned ? '[ACTIVE BAN]' : '[EXPIRED]'}`);
    if (isBanned) {
      issues.push(`[FAIL] EMPLOYEE BANNED until ${bannedUntil}! Reason: ${ban.Reason || 'N/A'}`);
    }
  } else {
    log(`  [OK] No ban record`);
  }

  // STEP 6: CardDB
  log('');
  log(`[6] CARD DATABASE (DataDBEnt)`);
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
      log(`  [FAIL] No card found for Employee ${booking.EmployeeID}`);
      issues.push(`[FAIL] No card in CardDB for ${booking.EmployeeID}`);
    } else {
      log(`  Found ${cards.length} card(s):`);
      for (const c of cards) {
        const status = c.Status === 1 ? 'Active' : 'Inactive';
        const blocked = c.Block === 1 ? 'BLOCKED' : 'OK';
        const deleted = c.del_state === 1 ? 'OK' : 'del_state!=1';
        log(`    CardNo: ${c.CardNo}, StaffNo: ${c.StaffNo}, Status: ${status}, Block: ${blocked}, DelState: ${deleted}, Dept: ${c.department}`);
        
        if (c.Block === 1) {
          issues.push(`[FAIL] Card ${c.CardNo} is BLOCKED in CardDB`);
        }
        if (c.Status !== 1) {
          issues.push(`[WARN] Card ${c.CardNo} Status INACTIVE in CardDB`);
        }
      }
      
      if (booking.CardNo) {
        const matchesActive = cards.some(c => String(c.CardNo).trim() === String(booking.CardNo).trim() && c.Status === 1 && c.Block !== 1);
        if (!matchesActive) {
          issues.push(`[FAIL] CardNo in booking (${booking.CardNo}) does NOT match any active card in CardDB`);
        } else {
          log(`  [OK] CardNo in booking matches active card in CardDB`);
        }
      }
    }
    
    await cardPool.close();
  } catch (e) {
    log(`  [WARN] Failed to connect to CardDB: ${e.message}`);
  }

  await gymPool.close();

  // SUMMARY
  log('');
  log(`=== SUMMARY: ${issues.length} issue(s) found ===`);
  if (issues.length === 0) {
    log(`  All checks OK. Issue might be on hardware/controller side.`);
  } else {
    for (const issue of issues) {
      log(`  ${issue}`);
    }
  }
  log('');

  // Write to file for easy reading
  fs.writeFileSync('backend/_diag_result.txt', lines.join('\n'), 'utf-8');
  log('Result saved to backend/_diag_result.txt');
}

run().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
