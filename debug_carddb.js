import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true }
};

(async () => {
  try {
    await sql.connect(config);
    console.log('Connected to DB');

    const r1 = await sql.query("SELECT TOP 5 * FROM DataDBEnt.dbo.CardDB WHERE StaffNo LIKE '%240369%'");
    console.log('Matches:', JSON.stringify(r1.recordset, null, 2));

    const r2 = await sql.query("SELECT TOP 1 * FROM DataDBEnt.dbo.CardDB");
    console.log('Sample Row:', JSON.stringify(r2.recordset[0], null, 2));
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await sql.close();
  }
})();
