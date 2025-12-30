import express from 'express';
import sql from 'mssql';

const router = express.Router();

router.post('/test', async (req, res) => {
  const { host, port = 1433, database, user, password, type = 'sqlserver' } = req.body || {};
  if (!host || !database || !user || !password) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }
  if (String(type).toLowerCase() !== 'sqlserver') {
    return res.status(400).json({ success: false, error: 'Only SQL Server is supported by tester' });
  }

  const config = {
    server: host,
    port: Number(port),
    database,
    user,
    password,
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
    pool: { max: 1, min: 0, idleTimeoutMillis: 3000 },
  };

  try {
    const pool = await sql.connect(config);
    await pool.request().query('SELECT 1 AS ok');
    await pool.close();
    return res.json({ success: true });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(200).json({ success: false, error: message });
  }
});

export default router;
