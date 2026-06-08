/**
 * Set a card's PinCardNo in Vault CardDB. Prints the OLD value first (for rollback).
 * Vault appears to Base64-decode this field, so its length must be a multiple of 4
 * (blank / 4 / 8 ...). A 6-digit PIN like "123456" makes UploadCardByDoorUnitNo throw
 * "Invalid length for a Base-64 char array or string" and the gym grant never lands.
 *
 * Usage: node backend/scripts/set-card-pin.js <CardNo> <NewPin>
 *   rollback example: node backend/scripts/set-card-pin.js 1453472210 123456
 */
import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();
const card = process.argv[2], newPin = process.argv[3];
if (!card || newPin === undefined) { console.error('usage: set-card-pin.js <CardNo> <NewPin>'); process.exit(1); }
const cfg = { server: process.env.CARDDB_SERVER, port: Number(process.env.CARDDB_PORT||1433), database: process.env.CARDDB_NAME, user: process.env.CARDDB_USER, password: process.env.CARDDB_PASSWORD, options: { encrypt:false, trustServerCertificate:true } };
const run = async () => {
  const p = await new sql.ConnectionPool(cfg).connect();
  const before = await p.request().input('c', sql.VarChar(50), card).query(`SELECT CardNo, StaffNo, Name, PinCardNo, LEN(PinCardNo) AS len FROM dbo.CardDB WHERE CardNo=@c`);
  if (!before.recordset.length) { console.log('Card not found'); await p.close(); return; }
  console.log('BEFORE:', JSON.stringify(before.recordset[0]));
  const u = await p.request().input('c', sql.VarChar(50), card).input('pin', sql.VarChar(50), String(newPin)).query(`UPDATE dbo.CardDB SET PinCardNo=@pin WHERE CardNo=@c`);
  const after = await p.request().input('c', sql.VarChar(50), card).query(`SELECT CardNo, PinCardNo, LEN(PinCardNo) AS len FROM dbo.CardDB WHERE CardNo=@c`);
  console.log(`Updated ${u.rowsAffected[0]} row -> PinCardNo="${newPin}" (len ${String(newPin).length})`);
  console.log('AFTER :', JSON.stringify(after.recordset[0]));
  await p.close();
};
run().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
