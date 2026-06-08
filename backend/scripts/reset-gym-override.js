/**
 * Reset (delete) an employee's gym controller access override row so the auto-organize
 * worker manages their access again (grant during booked session, prune after).
 * Useful to clear a stuck MANUAL_LOCK. Prints before/after.
 *
 * Usage: node backend/scripts/reset-gym-override.js MTI240576 [UnitNo]
 */
import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();
const emp = (process.argv[2] || '').trim();
const unit = process.argv[3] || (process.env.GYM_CONTROLLER_UNIT_NO || '0031');
if (!emp) { console.error('EmployeeID required'); process.exit(1); }
const cfg = { server: process.env.DB_SERVER, port: Number(process.env.DB_PORT||1433), database: process.env.DB_DATABASE, user: process.env.DB_USER, password: process.env.DB_PASSWORD, options:{encrypt:process.env.DB_ENCRYPT==='true',trustServerCertificate:true} };
const run = async () => {
  const p = await new sql.ConnectionPool(cfg).connect();
  const before = await p.request().input('e', sql.VarChar(20), emp).input('u', sql.VarChar(20), unit)
    .query(`SELECT EmployeeID, UnitNo, CustomAccessTZ, Source, CONVERT(varchar(19),UpdatedAt,120) UpdatedAt FROM dbo.gym_controller_access_override WHERE EmployeeID=@e AND UnitNo=@u`);
  console.log('BEFORE:', JSON.stringify(before.recordset));
  const d = await p.request().input('e', sql.VarChar(20), emp).input('u', sql.VarChar(20), unit)
    .query(`DELETE FROM dbo.gym_controller_access_override WHERE EmployeeID=@e AND UnitNo=@u`);
  console.log(`Deleted ${d.rowsAffected[0]} override row -> worker will re-manage ${emp} on next booked session.`);
  await p.close();
};
run().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
