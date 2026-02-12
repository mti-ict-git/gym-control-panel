import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { createAuthRouter } from '../routes/authRoutes.js';
import { createMasterRouter } from '../routes/masterRoutes.js';
import { createSettingsRouter } from '../routes/settingsRoutes.js';
import { createTesterRouter } from '../routes/testerRoutes.js';
import systemRouter from '../routes/systemRoutes.js';
import { envTrim, envBool, envInt, startOfDayUtcDateForOffsetMinutes } from '../lib/env.js';

const makeApp = (router) => {
  const app = express();
  app.use(express.json());
  app.use(router);
  return app;
};

const makeSqlStub = (queryHandler) => {
  const pool = {
    request() {
      const inputs = {};
      return {
        input(name, _type, value) {
          inputs[name] = value;
          return this;
        },
        async query(q) {
          return queryHandler(q, inputs);
        },
      };
    },
    async close() {},
    connected: true,
  };

  class ConnectionPool {
    constructor(config) {
      this.config = config;
    }
    async connect() {
      return pool;
    }
  }

  const type = (name) => (length) => ({ name, length });

  return {
    ConnectionPool,
    connect: async () => pool,
    VarChar: type('VarChar'),
    Int: type('Int'),
    Bit: type('Bit'),
  };
};

const makeAuthRouter = ({
  userRow,
  bcryptMatch = true,
  jwtVerifyThrows = false,
  jwtPayload,
  hasColumnMap,
  lastSignInValue,
  refreshRow,
  passwordRow,
  envOverrides,
} = {}) => {
  const columnMap = {
    LastSignIn: true,
    LastSignInAt: true,
    ...(hasColumnMap || {}),
  };

  const sqlStub = makeSqlStub((q, inputs) => {
    if (q.includes('INFORMATION_SCHEMA.COLUMNS')) {
      const col = inputs?.Column ? String(inputs.Column) : '';
      return { recordset: columnMap[col] ? [{ ok: 1 }] : [] };
    }
    if (q.includes('SELECT TOP 1 AccountID') && q.includes('WHERE Email = @Email')) {
      return { recordset: userRow ? [userRow] : [] };
    }
    if (q.includes('SELECT TOP 1 AccountID') && q.includes('WHERE Username = @Username')) {
      return { recordset: userRow ? [userRow] : [] };
    }
    if (q.includes('SELECT TOP 1 PasswordHash')) {
      return { recordset: passwordRow === null ? [] : [passwordRow || { PasswordHash: 'hash' }] };
    }
    if (q.includes('AS last')) {
      return { recordset: [{ last: lastSignInValue ?? new Date() }] };
    }
    if (q.includes('FROM dbo.gym_account WHERE AccountID = @Id')) {
      const row = refreshRow === undefined ? userRow : refreshRow;
      return { recordset: row ? [row] : [] };
    }
    return { recordset: [] };
  });

  const jwtImpl = {
    sign: () => 'signed-token',
    verify: () => {
      if (jwtVerifyThrows) throw new Error('invalid');
      return jwtPayload || { account_id: 1, username: 'u', email: 'e', role: 'Admin' };
    },
  };

  const bcryptImpl = {
    compare: async () => bcryptMatch,
    hash: async () => 'newhash',
  };

  const env = {
    DB_SERVER: 'srv',
    DB_DATABASE: 'db',
    DB_USER: 'user',
    DB_PASSWORD: 'pass',
    JWT_SECRET: 'secret',
    ...(envOverrides || {}),
  };

  return createAuthRouter({ sqlImpl: sqlStub, bcryptImpl, jwtImpl, env });
};

test('testerRoutes handles validation and success', async () => {
  const sqlStub = makeSqlStub(() => ({ recordset: [{ ok: 1 }] }));
  const app = makeApp(createTesterRouter({ sqlImpl: sqlStub }));

  await request(app).post('/test').expect(400);
  await request(app).post('/test').send({}).expect(400);
  await request(app)
    .post('/test')
    .send({ host: 'h', database: 'd', user: 'u', password: 'p', type: 'mysql' })
    .expect(400);

  const res = await request(app)
    .post('/test')
    .send({ host: 'h', database: 'd', user: 'u', password: 'p' })
    .expect(200);
  assert.equal(res.body.success, true);

  const resWithPort = await request(app)
    .post('/test')
    .send({ host: 'h', database: 'd', user: 'u', password: 'p', port: 1444 })
    .expect(200);
  assert.equal(resWithPort.body.success, true);
});

test('testerRoutes handles db errors', async () => {
  const sqlError = {
    connect: async () => {
      throw new Error('db down');
    },
  };
  const appError = makeApp(createTesterRouter({ sqlImpl: sqlError }));
  const resError = await request(appError)
    .post('/test')
    .send({ host: 'h', database: 'd', user: 'u', password: 'p' })
    .expect(200);
  assert.equal(resError.body.success, false);

  const sqlErrorString = {
    connect: async () => {
      throw 'down';
    },
  };
  const appErrorString = makeApp(createTesterRouter({ sqlImpl: sqlErrorString }));
  const resErrorString = await request(appErrorString)
    .post('/test')
    .send({ host: 'h', database: 'd', user: 'u', password: 'p' })
    .expect(200);
  assert.equal(resErrorString.body.success, false);
});

test('masterRoutes returns employees and employee core', async () => {
  const sqlStub = makeSqlStub((q) => {
    if (q.includes('FROM employee_core') && q.includes('employee_id LIKE')) {
      return { recordset: [{ employee_id: 'E1' }] };
    }
    if (q.includes('FROM employee_core') && q.includes('WHERE employee_id IN')) {
      return { recordset: [{ employee_id: 'E1', name: 'Name', department: 'Dept', card_no: '1', gender: 'M' }] };
    }
    if (q.includes('FROM employee_core') && q.includes('name LIKE')) {
      return { recordset: [{ employee_id: 'E2', name: 'Other', department: 'Dept2', card_no: '2', gender: 'F' }] };
    }
    if (q.includes('FROM employee_core') && !q.includes('WHERE')) {
      return { recordset: [{ employee_id: 'E3', name: null, department: null, card_no: null, gender: null }] };
    }
    return { recordset: [] };
  });
  const env = {
    MASTER_DB_SERVER: 'srv',
    MASTER_DB_DATABASE: 'db',
    MASTER_DB_USER: 'user',
    MASTER_DB_PASSWORD: 'pass',
  };
  const app = makeApp(createMasterRouter({ sqlImpl: sqlStub, env }));

  const employees = await request(app).get('/employees?q=E').expect(200);
  assert.equal(employees.body.success, true);
  assert.equal(employees.body.employees.length, 1);

  const employeesAll = await request(app).get('/employees').expect(200);
  assert.equal(employeesAll.body.success, true);

  const core = await request(app).get('/employee-core?ids=E1&limit=10').expect(200);
  assert.equal(core.body.ok, true);
  assert.equal(core.body.employees.length, 1);

  const coreQuery = await request(app).get('/employee-core?q=Name').expect(200);
  assert.equal(coreQuery.body.ok, true);
  assert.equal(coreQuery.body.employees.length, 1);

  const coreAll = await request(app).get('/employee-core').expect(200);
  assert.equal(coreAll.body.ok, true);
  assert.equal(coreAll.body.employees.length, 1);

  const coreBadLimit = await request(app).get('/employee-core?limit=bad').expect(200);
  assert.equal(coreBadLimit.body.ok, true);
});

test('masterRoutes filters blank employee ids', async () => {
  const sqlStub = makeSqlStub((q) => {
    if (q.includes('FROM employee_core')) {
      return { recordset: [{ employee_id: '   ', name: 'Name', department: 'Dept', card_no: '1', gender: 'M' }] };
    }
    return { recordset: [] };
  });
  const env = {
    MASTER_DB_SERVER: 'srv',
    MASTER_DB_DATABASE: 'db',
    MASTER_DB_USER: 'user',
    MASTER_DB_PASSWORD: 'pass',
  };
  const app = makeApp(createMasterRouter({ sqlImpl: sqlStub, env }));
  const res = await request(app).get('/employee-core').expect(200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.employees.length, 0);
});

test('masterRoutes handles missing env and db errors', async () => {
  const sqlStub = makeSqlStub(() => ({ recordset: [] }));
  const appMissing = makeApp(createMasterRouter({ sqlImpl: sqlStub, env: {} }));
  await request(appMissing).get('/employees').expect(500);
  await request(appMissing).get('/employee-core').expect(500);

  const sqlThrow = makeSqlStub(() => {
    throw new Error('db down');
  });
  const env = {
    MASTER_DB_SERVER: 'srv',
    MASTER_DB_DATABASE: 'db',
    MASTER_DB_USER: 'user',
    MASTER_DB_PASSWORD: 'pass',
  };
  const appThrow = makeApp(createMasterRouter({ sqlImpl: sqlThrow, env }));
  const res = await request(appThrow).get('/employees').expect(200);
  assert.equal(res.body.success, false);
  const resCore = await request(appThrow).get('/employee-core').expect(200);
  assert.equal(resCore.body.ok, false);

  const sqlThrowString = makeSqlStub(() => {
    throw 'db down';
  });
  const appThrowString = makeApp(createMasterRouter({ sqlImpl: sqlThrowString, env }));
  const resString = await request(appThrowString).get('/employee-core').expect(200);
  assert.equal(resString.body.ok, false);
});

test('settingsRoutes supports file fallback and db paths', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-settings-'));
  const appFile = makeApp(createSettingsRouter({ env: {}, baseDir: tmpDir }));

  const initial = await request(appFile).get('/app-settings/support-contact').expect(200);
  assert.equal(initial.body.ok, true);

  await request(appFile)
    .post('/app-settings/support-contact')
    .send({ name: 'Support', phone: '+12345678' })
    .expect(200);

  const updated = await request(appFile).get('/app-settings/support-contact').expect(200);
  assert.equal(updated.body.name, 'Support');

  const sqlStub = makeSqlStub((q) => {
    if (q.includes('SupportContactName')) {
      return { recordset: [{ name: 'DbName', phone: '+987' }] };
    }
    if (q.includes('gym_controller_settings') && q.includes('SELECT TOP 1')) {
      return {
        recordset: [
          {
            EnableAutoOrganize: true,
            EnableManagerAllSessionAccess: false,
            GraceBeforeMin: 5,
            GraceAfterMin: 6,
            WorkerIntervalMs: 60000,
          },
        ],
      };
    }
    return { recordset: [] };
  });
  const env = {
    DB_SERVER: 'srv',
    DB_DATABASE: 'db',
    DB_USER: 'user',
    DB_PASSWORD: 'pass',
  };
  const appDb = makeApp(createSettingsRouter({ sqlImpl: sqlStub, env, baseDir: tmpDir }));

  const dbGet = await request(appDb).get('/app-settings/support-contact').expect(200);
  assert.equal(dbGet.body.name, 'DbName');

  await request(appDb)
    .post('/app-settings/support-contact')
    .send({ name: 'DbSupport', phone: '+111111' })
    .expect(200);

  const controllerGet = await request(appDb).get('/gym-controller/settings').expect(200);
  assert.equal(controllerGet.body.ok, true);

  await request(appDb)
    .post('/gym-controller/settings')
    .send({ EnableAutoOrganize: true, GraceBeforeMin: 1, GraceAfterMin: 2 })
    .expect(200);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('settingsRoutes validates inputs and handles failures', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-settings-'));
  const appFile = makeApp(createSettingsRouter({ env: {}, baseDir: tmpDir }));

  await request(appFile)
    .post('/app-settings/support-contact')
    .send({ name: '', phone: '+12345678' })
    .expect(400);
  await request(appFile)
    .post('/app-settings/support-contact')
    .send({ name: 'a'.repeat(101), phone: '+12345678' })
    .expect(400);
  await request(appFile)
    .post('/app-settings/support-contact')
    .send({ name: 'Support', phone: '123' })
    .expect(400);
  await request(appFile)
    .post('/app-settings/support-contact')
    .send({ name: 'Support', phone: '+123456789012345678901' })
    .expect(400);
  await request(appFile)
    .post('/app-settings/support-contact')
    .send({ name: 'Support', phone: '++12a3456' })
    .expect(400);
  await request(appFile)
    .post('/app-settings/support-contact')
    .send({ name: 'Support', phone: '' })
    .expect(400);

  await request(appFile)
    .post('/app-settings/support-contact')
    .send({ name: 'Support', phone: '+12 345-678' })
    .expect(200);

  const fsFail = {
    ...fs,
    writeFileSync: () => {
      throw new Error('write fail');
    },
  };
  const appFailWrite = makeApp(createSettingsRouter({ env: {}, baseDir: tmpDir, fsImpl: fsFail }));
  await request(appFailWrite)
    .post('/app-settings/support-contact')
    .send({ name: 'Support', phone: '+12345678' })
    .expect(500);

  const sqlThrow = {
    ConnectionPool: class {
      async connect() {
        throw new Error('db fail');
      }
    },
    Int: (v) => v,
    VarChar: (v) => v,
    Bit: (v) => v,
  };
  const env = {
    DB_SERVER: 'srv',
    DB_DATABASE: 'db',
    DB_USER: 'user',
    DB_PASSWORD: 'pass',
  };
  const appDbError = makeApp(createSettingsRouter({ sqlImpl: sqlThrow, env, baseDir: tmpDir }));
  const dbFallback = await request(appDbError).get('/app-settings/support-contact').expect(200);
  assert.equal(dbFallback.body.ok, true);

  await request(appDbError)
    .post('/app-settings/support-contact')
    .send({ name: 'DbSupport', phone: '+111111' })
    .expect(500);

  await request(appFile).get('/gym-controller/settings').expect(500);
  await request(appFile).post('/gym-controller/settings').send({}).expect(500);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('settingsRoutes handles file parsing variations', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-settings-parse-'));
  const baseDir = tmpDir;
  const dataDir = path.join(baseDir, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'app-settings.json'), 'null', 'utf8');
  const appNull = makeApp(createSettingsRouter({ env: {}, baseDir }));
  const resNull = await request(appNull).get('/app-settings/support-contact').expect(200);
  assert.equal(resNull.body.ok, true);

  fs.writeFileSync(path.join(dataDir, 'app-settings.json'), '{', 'utf8');
  const resInvalid = await request(appNull).get('/app-settings/support-contact').expect(200);
  assert.equal(resInvalid.body.ok, true);

  fs.writeFileSync(
    path.join(dataDir, 'app-settings.json'),
    JSON.stringify({ support_contact_name: 123, support_contact_phone: 456 }),
    'utf8'
  );
  const resNonString = await request(appNull).get('/app-settings/support-contact').expect(200);
  assert.equal(resNonString.body.ok, true);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('settingsRoutes handles db defaults for support contact', async () => {
  const sqlStub = makeSqlStub((q) => {
    if (q.includes('SupportContactName')) {
      return { recordset: [] };
    }
    return { recordset: [] };
  });
  const env = {
    DB_SERVER: 'srv',
    DB_DATABASE: 'db',
    DB_USER: 'user',
    DB_PASSWORD: 'pass',
  };
  const app = makeApp(createSettingsRouter({ sqlImpl: sqlStub, env }));
  const res = await request(app).get('/app-settings/support-contact').expect(200);
  assert.equal(res.body.ok, true);
});

test('settingsRoutes uses file settings when db fails', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-settings-fallback-'));
  const dataDir = path.join(tmpDir, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataDir, 'app-settings.json'),
    JSON.stringify({ support_contact_name: 'File Name', support_contact_phone: '+777' }),
    'utf8'
  );

  const sqlThrow = {
    ConnectionPool: class {
      async connect() {
        throw new Error('db fail');
      }
    },
    Int: (v) => v,
    VarChar: (v) => v,
    Bit: (v) => v,
  };
  const env = {
    DB_SERVER: 'srv',
    DB_DATABASE: 'db',
    DB_USER: 'user',
    DB_PASSWORD: 'pass',
  };
  const app = makeApp(createSettingsRouter({ sqlImpl: sqlThrow, env, baseDir: tmpDir }));
  const res = await request(app).get('/app-settings/support-contact').expect(200);
  assert.equal(res.body.name, 'File Name');
  assert.equal(res.body.phone, '+777');

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('settingsRoutes handles mkdir failures', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-settings-mkdir-'));
  const fsFail = {
    ...fs,
    mkdirSync: () => {
      throw new Error('mkdir fail');
    },
    writeFileSync: () => {},
  };
  const app = makeApp(createSettingsRouter({ env: {}, baseDir: tmpDir, fsImpl: fsFail }));
  await request(app)
    .post('/app-settings/support-contact')
    .send({ name: 'Support', phone: '+12345678' })
    .expect(200);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('settingsRoutes uses defaults when db fails and file has invalid types', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-settings-fallback-2-'));
  const dataDir = path.join(tmpDir, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataDir, 'app-settings.json'),
    JSON.stringify({ support_contact_name: 123, support_contact_phone: 456 }),
    'utf8'
  );

  const sqlThrow = {
    ConnectionPool: class {
      async connect() {
        throw new Error('db fail');
      }
    },
    Int: (v) => v,
    VarChar: (v) => v,
    Bit: (v) => v,
  };
  const env = {
    DB_SERVER: 'srv',
    DB_DATABASE: 'db',
    DB_USER: 'user',
    DB_PASSWORD: 'pass',
  };
  const app = makeApp(createSettingsRouter({ sqlImpl: sqlThrow, env, baseDir: tmpDir }));
  const res = await request(app).get('/app-settings/support-contact').expect(200);
  assert.equal(res.body.name, 'Gym Coordinator');
  assert.equal(res.body.phone, '+6281275000560');

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('settingsRoutes handles controller settings branches', async () => {
  const sqlStub = makeSqlStub((q) => {
    if (q.includes('gym_controller_settings') && q.includes('SELECT TOP 1')) {
      return { recordset: [] };
    }
    return { recordset: [] };
  });
  const env = {
    DB_SERVER: 'srv',
    DB_DATABASE: 'db',
    DB_USER: 'user',
    DB_PASSWORD: 'pass',
  };
  const app = makeApp(createSettingsRouter({ sqlImpl: sqlStub, env }));

  const getDefaults = await request(app).get('/gym-controller/settings').expect(200);
  assert.equal(getDefaults.body.ok, true);
  assert.equal(getDefaults.body.settings.enable_auto_organize, false);

  await request(app)
    .post('/gym-controller/settings')
    .send({ EnableAutoOrganize: 'y', EnableManagerAllSessionAccess: 'no', GraceBeforeMin: -10, GraceAfterMin: 2000, WorkerIntervalMs: 5000 })
    .expect(200);

  await request(app)
    .post('/gym-controller/settings')
    .send({})
    .expect(200);
});

test('settingsRoutes handles controller settings defaults from row', async () => {
  const sqlStub = makeSqlStub((q) => {
    if (q.includes('gym_controller_settings') && q.includes('SELECT TOP 1')) {
      return {
        recordset: [
          {
            EnableAutoOrganize: false,
            EnableManagerAllSessionAccess: true,
            GraceBeforeMin: 0,
            GraceAfterMin: 0,
            WorkerIntervalMs: 0,
          },
        ],
      };
    }
    return { recordset: [] };
  });
  const env = {
    DB_SERVER: 'srv',
    DB_DATABASE: 'db',
    DB_USER: 'user',
    DB_PASSWORD: 'pass',
  };
  const app = makeApp(createSettingsRouter({ sqlImpl: sqlStub, env }));
  const res = await request(app).get('/gym-controller/settings').expect(200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.settings.worker_interval_ms, 60000);
});

test('settingsRoutes handles controller errors', async () => {
  const sqlThrow = {
    ConnectionPool: class {
      async connect() {
        throw new Error('db fail');
      }
    },
    Int: (v) => v,
    VarChar: (v) => v,
    Bit: (v) => v,
  };
  const env = {
    DB_SERVER: 'srv',
    DB_DATABASE: 'db',
    DB_USER: 'user',
    DB_PASSWORD: 'pass',
  };
  const app = makeApp(createSettingsRouter({ sqlImpl: sqlThrow, env }));
  await request(app).get('/gym-controller/settings').expect(500);
  await request(app).post('/gym-controller/settings').send({ EnableAutoOrganize: true }).expect(500);

  const sqlThrowString = {
    ConnectionPool: class {
      async connect() {
        throw 'db fail';
      }
    },
    Int: (v) => v,
    VarChar: (v) => v,
    Bit: (v) => v,
  };
  const appString = makeApp(createSettingsRouter({ sqlImpl: sqlThrowString, env }));
  await request(appString).get('/gym-controller/settings').expect(500);
});

test('authRoutes handles auth flows', async () => {
  const userRow = {
    AccountID: 1,
    Username: 'user',
    Email: 'user@example.com',
    Role: 'Admin',
    IsActive: true,
    PasswordHash: 'hash',
    PasswordResetRequired: 0,
  };
  const appOk = makeApp(makeAuthRouter({ userRow }));

  await request(appOk).post('/auth/login').send({}).expect(400);

  const login = await request(appOk)
    .post('/auth/login')
    .send({ email: 'user@example.com', password: 'pass' })
    .expect(200);
  assert.equal(login.body.ok, true);

  await request(appOk).get('/auth/me').expect(401);
  const me = await request(appOk).get('/auth/me').set('Authorization', 'Bearer ok').expect(200);
  assert.equal(me.body.ok, true);

  await request(appOk).post('/auth/change-password').send({}).expect(401);
  await request(appOk)
    .post('/auth/change-password')
    .set('Authorization', 'Bearer ok')
    .send({})
    .expect(400);
  const change = await request(appOk)
    .post('/auth/change-password')
    .set('Authorization', 'Bearer ok')
    .send({ old_password: 'pass', new_password: 'pass2' })
    .expect(200);
  assert.equal(change.body.ok, true);

  const refresh = await request(appOk)
    .post('/auth/refresh')
    .set('Authorization', 'Bearer ok')
    .send({})
    .expect(200);
  assert.equal(refresh.body.ok, true);

  const appInactive = makeApp(makeAuthRouter({ userRow: { ...userRow, IsActive: false } }));
  const inactive = await request(appInactive)
    .post('/auth/login')
    .send({ email: 'user@example.com', password: 'pass' })
    .expect(200);
  assert.equal(inactive.body.ok, false);

  const appInvalid = makeApp(makeAuthRouter({ userRow, bcryptMatch: false }));
  const invalid = await request(appInvalid)
    .post('/auth/login')
    .send({ email: 'user@example.com', password: 'pass' })
    .expect(200);
  assert.equal(invalid.body.ok, false);

  const appBadToken = makeApp(makeAuthRouter({ userRow, jwtVerifyThrows: true }));
  await request(appBadToken).get('/auth/me').set('Authorization', 'Bearer bad').expect(401);

  const appNotFound = makeApp(makeAuthRouter({ userRow: null }));
  const notFound = await request(appNotFound)
    .post('/auth/login')
    .send({ email: 'user@example.com', password: 'pass' })
    .expect(200);
  assert.equal(notFound.body.ok, false);

  const appOldMismatch = makeApp(makeAuthRouter({ userRow, bcryptMatch: false }));
  const oldMismatch = await request(appOldMismatch)
    .post('/auth/change-password')
    .set('Authorization', 'Bearer ok')
    .send({ old_password: 'bad', new_password: 'pass2' })
    .expect(200);
  assert.equal(oldMismatch.body.ok, false);

  const appInvalidToken = makeApp(makeAuthRouter({ userRow, jwtPayload: { account_id: 0 } }));
  await request(appInvalidToken)
    .post('/auth/refresh')
    .set('Authorization', 'Bearer ok')
    .send({})
    .expect(401);

  const appInactiveRefresh = makeApp(makeAuthRouter({ userRow: { ...userRow, IsActive: false } }));
  const inactiveRefresh = await request(appInactiveRefresh)
    .post('/auth/refresh')
    .set('Authorization', 'Bearer ok')
    .send({})
    .expect(200);
  assert.equal(inactiveRefresh.body.ok, false);
});

test('authRoutes covers additional branches', async () => {
  const userRow = {
    AccountID: 2,
    Username: 'user2',
    Email: 'user2@example.com',
    Role: 'SuperAdmin',
    IsActive: true,
    PasswordHash: 'hash',
    PasswordResetRequired: 1,
    LastSignInAt: new Date(Date.now() - 1000 * 60 * 60),
  };
  const appUser = makeApp(makeAuthRouter({ userRow }));
  const loginByUsername = await request(appUser)
    .post('/auth/login')
    .send({ username: 'user2', password: 'pass' })
    .expect(200);
  assert.equal(loginByUsername.body.ok, true);
  assert.equal(loginByUsername.body.password_reset_required, true);
  assert.equal(loginByUsername.body.user.role, 'superadmin');

  const appDefaultRole = makeApp(makeAuthRouter({ userRow: { ...userRow, Role: 'Other' } }));
  const loginDefault = await request(appDefaultRole)
    .post('/auth/login')
    .send({ username: 'user2', password: 'pass' })
    .expect(200);
  assert.equal(loginDefault.body.user.role, 'committee');

  const appNoJwt = makeApp(makeAuthRouter({ userRow, envOverrides: { JWT_SECRET: '' } }));
  const noJwt = await request(appNoJwt)
    .post('/auth/login')
    .send({ email: 'user2@example.com', password: 'pass' })
    .expect(200);
  assert.equal(noJwt.body.ok, false);

  const appNoDb = makeApp(makeAuthRouter({ userRow, envOverrides: { DB_SERVER: '' } }));
  const noDb = await request(appNoDb)
    .post('/auth/login')
    .send({ email: 'user2@example.com', password: 'pass' })
    .expect(200);
  assert.equal(noDb.body.ok, false);

  const appMeNoAccount = makeApp(makeAuthRouter({ userRow, jwtPayload: { account_id: 0 } }));
  const meNoAccount = await request(appMeNoAccount)
    .get('/auth/me')
    .set('Authorization', 'Bearer ok')
    .expect(200);
  assert.equal(meNoAccount.body.ok, true);

  const appMissingToken = makeApp(makeAuthRouter({ userRow }));
  await request(appMissingToken).post('/auth/refresh').send({}).expect(401);

  const appRefreshMissing = makeApp(makeAuthRouter({ userRow, refreshRow: null }));
  const refreshMissing = await request(appRefreshMissing)
    .post('/auth/refresh')
    .set('Authorization', 'Bearer ok')
    .send({})
    .expect(200);
  assert.equal(refreshMissing.body.ok, false);

  const appChangeMissing = makeApp(makeAuthRouter({ userRow, passwordRow: null }));
  const changeMissing = await request(appChangeMissing)
    .post('/auth/change-password')
    .set('Authorization', 'Bearer ok')
    .send({ old_password: 'pass', new_password: 'next' })
    .expect(200);
  assert.equal(changeMissing.body.ok, false);

  const appChangeInvalidToken = makeApp(makeAuthRouter({ userRow, jwtPayload: { account_id: 0 } }));
  await request(appChangeInvalidToken)
    .post('/auth/change-password')
    .set('Authorization', 'Bearer ok')
    .send({ old_password: 'pass', new_password: 'next' })
    .expect(401);

  const appRefreshOld = makeApp(makeAuthRouter({
    userRow,
    hasColumnMap: { LastSignIn: false, LastSignInAt: true },
    lastSignInValue: new Date(Date.now() - 1000 * 60 * 60),
  }));
  const refreshOld = await request(appRefreshOld)
    .post('/auth/refresh')
    .set('Authorization', 'Bearer ok')
    .send({})
    .expect(200);
  assert.equal(refreshOld.body.ok, true);

  const appMeUpdate = makeApp(makeAuthRouter({
    userRow,
    hasColumnMap: { LastSignIn: true, LastSignInAt: false },
    lastSignInValue: new Date(Date.now() - 1000 * 60 * 60),
  }));
  const meUpdate = await request(appMeUpdate)
    .get('/auth/me')
    .set('Authorization', 'Bearer ok')
    .expect(200);
  assert.equal(meUpdate.body.ok, true);

  const appMeNoColumns = makeApp(makeAuthRouter({
    userRow,
    hasColumnMap: { LastSignIn: false, LastSignInAt: false },
    lastSignInValue: 'invalid-date',
  }));
  const meNoColumns = await request(appMeNoColumns)
    .get('/auth/me')
    .set('Authorization', 'Bearer ok')
    .expect(200);
  assert.equal(meNoColumns.body.ok, true);

  const appMeBothColumns = makeApp(makeAuthRouter({
    userRow,
    hasColumnMap: { LastSignIn: true, LastSignInAt: true },
    lastSignInValue: new Date(),
  }));
  const meBothColumns = await request(appMeBothColumns)
    .get('/auth/me')
    .set('Authorization', 'Bearer ok')
    .expect(200);
  assert.equal(meBothColumns.body.ok, true);

  const appRefreshRecent = makeApp(makeAuthRouter({
    userRow,
    hasColumnMap: { LastSignIn: true, LastSignInAt: false },
    lastSignInValue: new Date(),
  }));
  const refreshRecent = await request(appRefreshRecent)
    .post('/auth/refresh')
    .set('Authorization', 'Bearer ok')
    .send({})
    .expect(200);
  assert.equal(refreshRecent.body.ok, true);

  const appRefreshCatch = makeApp(makeAuthRouter({ userRow, jwtVerifyThrows: true }));
  const refreshCatch = await request(appRefreshCatch)
    .post('/auth/refresh')
    .set('Authorization', 'Bearer ok')
    .send({})
    .expect(200);
  assert.equal(refreshCatch.body.ok, false);

  const appRefreshNoColumns = makeApp(makeAuthRouter({
    userRow,
    hasColumnMap: { LastSignIn: false, LastSignInAt: false },
    lastSignInValue: undefined,
  }));
  const refreshNoColumns = await request(appRefreshNoColumns)
    .post('/auth/refresh')
    .set('Authorization', 'Bearer ok')
    .send({})
    .expect(200);
  assert.equal(refreshNoColumns.body.ok, true);

  const appMeStringDate = makeApp(makeAuthRouter({
    userRow,
    hasColumnMap: { LastSignIn: false, LastSignInAt: true },
    lastSignInValue: new Date().toISOString(),
  }));
  const meStringDate = await request(appMeStringDate)
    .get('/auth/me')
    .set('Authorization', 'Bearer ok')
    .expect(200);
  assert.equal(meStringDate.body.ok, true);

  const appRefreshNullPayload = makeApp(makeAuthRouter({
    userRow,
    refreshRow: { ...userRow, Username: null, Email: null, Role: 'Admin' },
  }));
  const refreshNullPayload = await request(appRefreshNullPayload)
    .post('/auth/refresh')
    .set('Authorization', 'Bearer ok')
    .send({})
    .expect(200);
  assert.equal(refreshNullPayload.body.ok, true);

  const sqlFailChange = {
    ConnectionPool: class {
      async connect() {
        throw new Error('db fail');
      }
    },
    VarChar: (v) => v,
    Int: (v) => v,
  };
  const env = {
    DB_SERVER: 'srv',
    DB_DATABASE: 'db',
    DB_USER: 'user',
    DB_PASSWORD: 'pass',
    JWT_SECRET: 'secret',
  };
  const appChangeCatch = makeApp(createAuthRouter({ sqlImpl: sqlFailChange, jwtImpl: { sign: () => 't', verify: () => ({ account_id: 1 }) }, bcryptImpl: { compare: async () => true, hash: async () => 'h' }, env }));
  const changeCatch = await request(appChangeCatch)
    .post('/auth/change-password')
    .set('Authorization', 'Bearer ok')
    .send({ old_password: 'pass', new_password: 'next' })
    .expect(200);
  assert.equal(changeCatch.body.ok, false);

  const appBothInputs = makeApp(makeAuthRouter({ userRow: { ...userRow, Username: null, Email: null, Role: null } }));
  const loginBoth = await request(appBothInputs)
    .post('/auth/login')
    .send({ email: 'user2@example.com', username: 'user2', password: 'pass' })
    .expect(200);
  assert.equal(loginBoth.body.ok, true);

  const appPasswordEmpty = makeApp(makeAuthRouter({ userRow, passwordRow: { PasswordHash: '' } }));
  const changeEmpty = await request(appPasswordEmpty)
    .post('/auth/change-password')
    .set('Authorization', 'Bearer ok')
    .send({ old_password: 'pass', new_password: 'next' })
    .expect(200);
  assert.equal(changeEmpty.body.ok, true);

  const sqlFailChangeString = {
    ConnectionPool: class {
      async connect() {
        throw 'db fail';
      }
    },
    VarChar: (v) => v,
    Int: (v) => v,
  };
  const appChangeCatchString = makeApp(createAuthRouter({ sqlImpl: sqlFailChangeString, jwtImpl: { sign: () => 't', verify: () => ({ account_id: 1 }) }, bcryptImpl: { compare: async () => true, hash: async () => 'h' }, env }));
  const changeCatchString = await request(appChangeCatchString)
    .post('/auth/change-password')
    .set('Authorization', 'Bearer ok')
    .send({ old_password: 'pass', new_password: 'next' })
    .expect(200);
  assert.equal(changeCatchString.body.ok, false);

  const sqlLoginFail = {
    ConnectionPool: class {
      async connect() {
        throw new Error('db fail');
      }
    },
    VarChar: (v) => v,
    Int: (v) => v,
  };
  const appLoginFail = makeApp(createAuthRouter({
    sqlImpl: sqlLoginFail,
    jwtImpl: { sign: () => 't', verify: () => ({ account_id: 1 }) },
    bcryptImpl: { compare: async () => true, hash: async () => 'h' },
    env,
  }));
  const loginFail = await request(appLoginFail)
    .post('/auth/login')
    .send({ email: 'user2@example.com', password: 'pass' })
    .expect(200);
  assert.equal(loginFail.body.ok, false);
});

test('systemRoutes health and access log', async () => {
  const app = makeApp(systemRouter);
  const push = systemRouter.locals?.pushAccessEvent;
  if (typeof push === 'function') {
    push({ t: new Date().toISOString(), type: 'test' });
  }
  const health = await request(app).get('/health').expect(200);
  assert.equal(health.body.ok, true);

  const apiHealth = await request(app).get('/api/health').expect(200);
  assert.equal(apiHealth.body.ok, true);

  const log = await request(app).get('/gym-access-log').expect(200);
  assert.equal(log.body.ok, true);
  assert.ok(Array.isArray(log.body.events));

  const apiLog = await request(app).get('/api/gym-access-log').expect(200);
  assert.equal(apiLog.body.ok, true);

  const live = await request(app).get('/api/gym-live-status').expect(200);
  assert.equal(live.body.ok, true);

  const invokeStream = (pathValue) => {
    const layer = systemRouter.stack.find((l) => l.route && l.route.path === pathValue);
    const handler = layer?.route?.stack?.[0]?.handle;
    let closeHandler = null;
    const req = {
      on: (event, cb) => {
        if (event === 'close') closeHandler = cb;
      },
    };
    const res = {
      setHeader() {},
      flushHeaders() {},
      write() {},
    };
    handler(req, res);
    if (typeof push === 'function') {
      push({ t: new Date().toISOString(), type: 'broadcast' });
    }
    if (typeof closeHandler === 'function') closeHandler();
  };

  invokeStream('/gym-access-stream');
  invokeStream('/api/gym-access-stream');

  if (typeof push === 'function') {
    for (let i = 0; i < 510; i += 1) {
      push({ t: new Date().toISOString(), type: 'bulk', i });
    }
  }

  const layer = systemRouter.stack.find((l) => l.route && l.route.path === '/gym-access-stream');
  const handler = layer?.route?.stack?.[0]?.handle;
  let closeHandler = null;
  const req = {
    on: (event, cb) => {
      if (event === 'close') closeHandler = cb;
    },
  };
  const res = {
    setHeader() {},
    flushHeaders() {},
    write() {},
  };
  if (handler) {
    handler(req, res);
  }
  if (typeof push === 'function') {
    res.write = () => {
      throw new Error('write fail');
    };
    push({ t: new Date().toISOString(), type: 'throw' });
  }
  const originalDelete = Set.prototype.delete;
  Set.prototype.delete = () => {
    throw new Error('delete fail');
  };
  if (typeof closeHandler === 'function') {
    closeHandler();
  }
  Set.prototype.delete = originalDelete;

  const apiLayer = systemRouter.stack.find((l) => l.route && l.route.path === '/api/gym-access-stream');
  const apiHandler = apiLayer?.route?.stack?.[0]?.handle;
  let apiClose = null;
  const apiReq = {
    on: (event, cb) => {
      if (event === 'close') apiClose = cb;
    },
  };
  const apiRes = {
    setHeader() {},
    flushHeaders() {},
    write() {},
  };
  if (apiHandler) {
    apiHandler(apiReq, apiRes);
  }
  Set.prototype.delete = () => {
    throw new Error('delete fail');
  };
  if (typeof apiClose === 'function') {
    apiClose();
  }
  Set.prototype.delete = originalDelete;
});

test('env helpers behave as expected', () => {
  assert.equal(envTrim('  hi  '), 'hi');
  assert.equal(envTrim('   '), '');
  assert.equal(envBool('true', false), true);
  assert.equal(envBool('0', true), false);
  assert.equal(envBool(undefined, true), true);
  assert.equal(envInt('42', 0), 42);
  assert.equal(envInt('bad', 7), 7);
  const d = startOfDayUtcDateForOffsetMinutes(0);
  assert.ok(d instanceof Date);
});
