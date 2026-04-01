import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sql from 'mssql';

dotenv.config();

function sha256(text) {
  return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');
}

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  return {
    help: args.has('--help') || args.has('-h'),
    dryRun: args.has('--dry-run') || args.has('--dryrun'),
  };
}

function listMigrationFiles(dir) {
  const abs = path.resolve(dir);
  const files = fs
    .readdirSync(abs, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.toLowerCase().endsWith('.sql'))
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, 'en'));
  return files.map((name) => ({ id: name, filePath: path.join(abs, name) }));
}

function getDbConfig() {
  const { DB_SERVER, DB_PORT, DB_DATABASE, DB_USER, DB_PASSWORD, DB_ENCRYPT, DB_TRUST_SERVER_CERTIFICATE } = process.env;
  if (!DB_SERVER || !DB_DATABASE || !DB_USER || !DB_PASSWORD) return null;
  return {
    server: DB_SERVER,
    port: Number(DB_PORT || 1433),
    database: DB_DATABASE,
    user: DB_USER,
    password: DB_PASSWORD,
    options: {
      encrypt: String(DB_ENCRYPT || 'false').toLowerCase() === 'true',
      trustServerCertificate: String(DB_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() === 'true',
    },
    pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
  };
}

async function ensureMigrationsTable(pool) {
  await pool.request().query(
    `IF OBJECT_ID('dbo.gym_migrations','U') IS NULL
     BEGIN
       CREATE TABLE dbo.gym_migrations (
         Id NVARCHAR(200) NOT NULL CONSTRAINT PK_gym_migrations PRIMARY KEY,
         Checksum CHAR(64) NOT NULL,
         AppliedAt DATETIME NOT NULL CONSTRAINT DF_gym_migrations_AppliedAt DEFAULT GETDATE()
       );
     END;
     IF COL_LENGTH('dbo.gym_migrations','Checksum') IS NULL
     BEGIN
       ALTER TABLE dbo.gym_migrations ADD Checksum CHAR(64) NOT NULL CONSTRAINT DF_gym_migrations_Checksum DEFAULT REPLICATE('0', 64);
     END;
     IF COL_LENGTH('dbo.gym_migrations','AppliedAt') IS NULL
     BEGIN
       ALTER TABLE dbo.gym_migrations ADD AppliedAt DATETIME NOT NULL CONSTRAINT DF_gym_migrations_AppliedAt2 DEFAULT GETDATE();
     END;`
  );
}

async function loadApplied(pool) {
  await ensureMigrationsTable(pool);
  const r = await pool.request().query('SELECT Id, Checksum FROM dbo.gym_migrations ORDER BY AppliedAt ASC, Id ASC');
  const rows = Array.isArray(r?.recordset) ? r.recordset : [];
  const map = new Map();
  for (const row of rows) {
    const id = row?.Id != null ? String(row.Id) : '';
    const checksum = row?.Checksum != null ? String(row.Checksum) : '';
    if (id) map.set(id, checksum);
  }
  return map;
}

async function applyOne(pool, migration, { dryRun }) {
  const sqlText = fs.readFileSync(migration.filePath, 'utf8');
  const checksum = sha256(sqlText);
  if (!/^[0-9a-f]{64}$/i.test(checksum)) {
    throw new Error(`Invalid checksum: ${migration.id}`);
  }

  const existing = await pool
    .request()
    .input('Id', sql.NVarChar(200), migration.id)
    .query('SELECT TOP 1 Id, Checksum FROM dbo.gym_migrations WHERE Id = @Id');
  const row = existing?.recordset?.[0] || null;
  if (row?.Id) {
    const prev = row?.Checksum != null ? String(row.Checksum) : '';
    if (prev && prev !== checksum) {
      throw new Error(`Migration checksum mismatch: ${migration.id}`);
    }
    return { id: migration.id, status: 'skipped' };
  }

  if (dryRun) return { id: migration.id, status: 'pending' };

  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const req = new sql.Request(tx);
    await req.batch(sqlText);
    await req.input('Id', sql.NVarChar(200), migration.id).query(
      `INSERT INTO dbo.gym_migrations (Id, Checksum) VALUES (@Id, '${checksum.toLowerCase()}')`
    );
    await tx.commit();
    return { id: migration.id, status: 'applied' };
  } catch (e) {
    try {
      await tx.rollback();
    } catch (_) {}
    throw e;
  }
}

async function run() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(
      JSON.stringify({
        ok: true,
        usage: 'node backend/scripts/db-migrate.js [--dry-run]',
      })
    );
    return;
  }

  const migrationsDir = path.resolve(process.cwd(), 'backend', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.error(JSON.stringify({ ok: false, error: 'Missing migrations directory', dir: migrationsDir }));
    process.exit(2);
  }

  const dbConfig = getDbConfig();
  if (!dbConfig) {
    console.error(JSON.stringify({ ok: false, error: 'Gym DB env is not configured' }));
    process.exit(1);
  }

  const migrations = listMigrationFiles(migrationsDir);
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const applied = await loadApplied(pool);

    const results = [];
    for (const m of migrations) {
      const res = await applyOne(pool, m, { dryRun: args.dryRun });
      if (res.status === 'skipped' && !applied.has(m.id)) {
        applied.set(m.id, '');
      }
      results.push(res);
    }

    const pending = results.filter((r) => r.status === 'pending').map((r) => r.id);
    const appliedNow = results.filter((r) => r.status === 'applied').map((r) => r.id);

    console.log(
      JSON.stringify({
        ok: true,
        dry_run: args.dryRun,
        applied: appliedNow,
        pending,
        total: migrations.length,
      })
    );
  } catch (e) {
    console.error(JSON.stringify({ ok: false, error: e?.message || String(e) }));
    process.exit(3);
  } finally {
    try {
      if (pool) await pool.close();
    } catch {}
  }
}

run();
