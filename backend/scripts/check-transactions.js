import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const cardNo = process.argv[2] || '1483133250';
const empId = process.argv[3] || 'MTI240456';
const date = process.argv[4] || '2026-04-04';

async function run() {
  const p = await new sql.ConnectionPool({
    server: process.env.CARDDB_SERVER,
    port: Number(process.env.CARDDB_PORT || 1433),
    database: process.env.CARDDB_NAME,
    user: process.env.CARDDB_USER,
    password: process.env.CARDDB_PASSWORD,
    options: { encrypt: false, trustServerCertificate: true },
    pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
  }).connect();

  console.log(`=== Transaction Log for Card ${cardNo} / Emp ${empId} on ${date} ===\n`);

  // Query by CardNo
  const res = await p.request()
    .input('card', sql.VarChar(50), cardNo)
    .input('dateVal', sql.VarChar(10), date)
    .query(`SELECT TOP 20 TrDateTime, TrDate, TrTime, CardNo, UnitNo, [Transaction], TrCode 
            FROM dbo.tblTransaction 
            WHERE CardNo = @card AND CONVERT(varchar(10), TrDate, 23) = @dateVal
            ORDER BY ID DESC`);

  const rows = res?.recordset || [];
  console.log(`Found ${rows.length} transaction(s) for CardNo ${cardNo}:`);
  for (const r of rows) {
    console.log(JSON.stringify(r));
  }

  // Also check around the date for context
  console.log(`\n=== Recent transactions (3-day window) ===\n`);
  const res2 = await p.request()
    .input('card', sql.VarChar(50), cardNo)
    .input('dateStart', sql.VarChar(10), '2026-04-03')
    .input('dateEnd', sql.VarChar(10), '2026-04-06')
    .query(`SELECT TOP 30 TrDateTime, TrDate, TrTime, CardNo, UnitNo, [Transaction], TrCode 
            FROM dbo.tblTransaction 
            WHERE CardNo = @card AND CONVERT(varchar(10), TrDate, 23) >= @dateStart AND CONVERT(varchar(10), TrDate, 23) <= @dateEnd
            ORDER BY ID DESC`);
  
  const rows2 = res2?.recordset || [];
  console.log(`Found ${rows2.length} transaction(s) in 3-day window:`);
  for (const r of rows2) {
    console.log(JSON.stringify(r));
  }

  // Check unit filter
  const unitNo = process.env.GYM_UNIT_FILTER || '0031';
  console.log(`\n=== Gym-specific (Unit ${unitNo}) transactions ===\n`);
  const res3 = await p.request()
    .input('card', sql.VarChar(50), cardNo)
    .input('unit', sql.VarChar(20), unitNo)
    .input('dateStart', sql.VarChar(10), '2026-04-03')
    .input('dateEnd', sql.VarChar(10), '2026-04-06')
    .query(`SELECT TOP 20 TrDateTime, TrDate, TrTime, CardNo, UnitNo, [Transaction], TrCode 
            FROM dbo.tblTransaction 
            WHERE CardNo = @card AND UnitNo = @unit AND CONVERT(varchar(10), TrDate, 23) >= @dateStart AND CONVERT(varchar(10), TrDate, 23) <= @dateEnd
            ORDER BY ID DESC`);
  
  const rows3 = res3?.recordset || [];
  console.log(`Found ${rows3.length} gym transaction(s):`);
  for (const r of rows3) {
    console.log(JSON.stringify(r));
  }

  await p.close();
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
