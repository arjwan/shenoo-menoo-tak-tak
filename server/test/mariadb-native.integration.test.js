'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const Module = require('node:module');

test('native MariaDB migrations and developer authentication', { skip: process.env.MARIADB_NATIVE_TEST !== '1', timeout: 300000 }, async t => {
  assert.equal(process.env.MYSQL_HOST, '127.0.0.1');
  assert.match(process.env.MYSQL_DATABASE, /^shinomino_native_test_\d+$/);
  const mysql = require('mysql2/promise');
  const config = { host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT), user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD };
  const admin = await mysql.createConnection(config);
  try { await admin.query('CREATE DATABASE `' + process.env.MYSQL_DATABASE + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin'); }
  finally { await admin.end(); }
  // Native auth must not even load the legacy model stack, including indirectly.
  const originalLoad = Module._load;
  Module._load = function(name, ...args) {
    if (/^(mongoose|mongodb)(\/|$)/.test(name)) throw new Error('Legacy database dependency forbidden in native auth');
    return originalLoad.call(this, name, ...args);
  };
  const database = require('../src/mariadb/database');
  const accounts = require('../src/mariadb/developer-accounts');
  const auth = require('../src/mariadb/developer-auth');
  const { migrate } = require('../src/mariadb/migrate');
  const express = require('express');
  const jwt = require('jsonwebtoken');
  const bcrypt = require('bcryptjs');
  const { requireAuth, requireRole } = require('../src/middleware/auth');
  let server, pool, developer;
  const password = crypto.randomBytes(20).toString('hex');
  const setup = { DEVELOPER_USERNAME: 'native_developer', DEVELOPER_CONTACT: 'native@example.test', DEVELOPER_PASSWORD: password, DEVELOPER_BOOTSTRAP: 'allow-new-developer' };
  const app = express(); app.use(express.json());
  app.use('/developer', require('../src/routes/developer-auth.routes'));
  app.get('/protected', requireAuth, requireRole('developer'), (req, res) => res.json({ id: req.user._id }));
  async function request(route, body, token) {
    const response = await fetch('http://127.0.0.1:' + server.address().port + route, {
      method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    return { status: response.status, body: await response.json(), retryAfter: response.headers.get('retry-after') };
  }
  try {
    await t.test('empty schema, foreign keys and repeatable checked migrations', async () => {
      const result = await migrate(); assert.equal(result.length, 2);
      assert.ok(result[0].applied > 137);
      assert.deepEqual((await migrate()).map(x => x.applied), [0, 0]);
      pool = await database.connect();
      const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()');
      assert.equal(Number(total), 140);
      const settings = await Promise.all(Array.from({ length: 4 }, () => database.execute('SELECT @@session.time_zone AS zone, @@session.sql_mode AS mode')));
      for (const [[row]] of settings) { assert.equal(row.zone, '+00:00'); assert.match(row.mode, /STRICT_TRANS_TABLES/); }
      await assert.rejects(pool.execute('INSERT INTO developer_sessions (token_hash, user_id, expires_at) VALUES (?, ?, NOW())', ['a'.repeat(64), '0'.repeat(24)]), { code: 'ER_NO_REFERENCED_ROW_2' });
    });
    await t.test('explicit bootstrap, repeatability, no identity-based privilege escalation', async () => {
      await assert.rejects(accounts.provision({ ...setup, DEVELOPER_BOOTSTRAP: '' }), /Explicit/);
      developer = await accounts.provision(setup);
      assert.equal(developer.action, 'created');
      assert.deepEqual(await accounts.provision(setup), { id: developer.id, action: 'unchanged' });
      await pool.execute(`INSERT INTO users (_id, fullName, username, contact, contactType, passwordHash, termsAccepted, role, status)
        VALUES (?, 'Ordinary', 'ordinary', 'ordinary@example.test', 'email', ?, TRUE, 'user', 'active')`, ['1'.repeat(24), await bcrypt.hash(password, 12)]);
      await assert.rejects(accounts.provision({ ...setup, DEVELOPER_USERNAME: 'ordinary', DEVELOPER_CONTACT: 'ordinary@example.test' }), /collision/);
      assert.equal((await accounts.byId('1'.repeat(24))).role, 'user');
      await assert.rejects(accounts.provision({ ...setup, DEVELOPER_CONTACT: 'ordinary@example.test' }, true), /collision/);
    });
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    let token;
    await t.test('real HTTP password login, role guard and logout revocation', async () => {
      assert.equal((await request('/protected')).status, 401);
      assert.equal((await request('/developer/login', { identifier: setup.DEVELOPER_USERNAME, password: 'incorrect' })).status, 401);
      const login = await request('/developer/login', { identifier: setup.DEVELOPER_USERNAME, password });
      assert.equal(login.status, 200); token = login.body.token;
      assert.equal(login.body.expiresIn, 900); assert.equal(login.body.preAuthToken, undefined);
      assert.equal(login.body.mfa.temporarilyDisabled, true);
      assert.ok(!JSON.stringify(login.body.user).includes('passwordHash'));
      assert.equal((await request('/protected', null, token)).status, 200);
      assert.equal((await request('/developer/session', null, token)).status, 200);
      assert.equal((await request('/developer/logout', {}, token)).status, 200);
      assert.equal((await request('/protected', null, token)).status, 401);
    });
    await t.test('ordinary and blocked accounts rejected, JWT expiry and forged scopes rejected', async () => {
      assert.equal((await auth.login('ordinary', password, 'ordinary-test')).status, 401);
      await pool.execute("UPDATE users SET status = 'blocked' WHERE _id = ?", [developer.id]);
      assert.equal((await auth.login(setup.DEVELOPER_USERNAME, password, 'blocked-test')).status, 401);
      await pool.execute("UPDATE users SET status = 'active' WHERE _id = ?", [developer.id]);
      token = (await auth.login(setup.DEVELOPER_USERNAME, password, 'expiry-test')).token;
      const payload = jwt.decode(token);
      const expired = jwt.sign({ userId: developer.id, role: 'developer', jti: payload.jti }, process.env.JWT_SECRET,
        { issuer: payload.iss, audience: payload.aud, expiresIn: -1 });
      assert.equal((await request('/protected', null, expired)).status, 401);
      const oldMfa = jwt.sign({ userId: developer.id, role: 'developer', scope: 'developer-mfa' }, process.env.JWT_SECRET);
      assert.equal((await request('/protected', null, oldMfa)).status, 401);
      const oldToken = jwt.sign({ userId: developer.id, role: 'developer' }, process.env.JWT_SECRET);
      assert.equal((await request('/protected', null, oldToken)).status, 401);
      await pool.execute('UPDATE developer_sessions SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE user_id = ?', [developer.id]);
      assert.equal((await request('/protected', null, token)).status, 401);
    });
    await t.test('persisted rate limit and bound input prevent injection', async () => {
      for (let index = 0; index < 5; index++) assert.equal((await auth.login("' OR 1=1 --", password, 'injection-test')).status, 401);
      const limited = await auth.login(setup.DEVELOPER_USERNAME, password, 'injection-test');
      assert.equal(limited.status, 429); assert.ok(limited.retryAfter > 0);
      const [[{ count }]] = await pool.query('SELECT COUNT(*) AS count FROM users'); assert.equal(Number(count), 2);
    });
    await t.test('recovery requires exact active developer ID, revokes sessions and preserves MFA data', async () => {
      token = (await auth.login(setup.DEVELOPER_USERNAME, password, 'recovery-test')).token;
      await pool.execute('INSERT INTO developermfas (_id, user, pairedPhone, phoneSecretHash) VALUES (?, ?, ?, ?)', ['2'.repeat(24), developer.id, '07712345678', 'preserved-test-enrollment']);
      await pool.execute('INSERT INTO developermfas__credentials (_row_id, parent_id, position, id, publicKey) VALUES (?, ?, 0, ?, ?)', ['3'.repeat(24), '2'.repeat(24), 'preserved-key', 'test-public-key']);
      const [[{ count: before }]] = await pool.query('SELECT COUNT(*) AS count FROM developermfas');
      await assert.rejects(accounts.provision(setup, true), /exact/);
      const replacement = crypto.randomBytes(20).toString('hex');
      const input = { ...setup, DEVELOPER_PASSWORD: replacement, DEVELOPER_RECOVERY_USER_ID: developer.id };
      assert.equal((await accounts.provision(input, true)).action, 'recovered');
      assert.equal((await accounts.provision(input, true)).action, 'recovered');
      await assert.rejects(auth.authenticate(token));
      assert.equal((await auth.login(setup.DEVELOPER_USERNAME, password, 'old-password-test')).status, 401);
      assert.equal((await auth.login(setup.DEVELOPER_USERNAME, replacement, 'new-password-test')).status, 200);
      const [[{ count: after }]] = await pool.query('SELECT COUNT(*) AS count FROM developermfas'); assert.equal(before, after);
      assert.deepEqual(await accounts.securitySummary(developer.id), { temporarilyDisabled: true, phonePaired: true, fidoKeys: 1, pairedPhone: '07712345678' });
      assert.equal((await accounts.byId('1'.repeat(24))).role, 'user');
    });
    await t.test('native profile validation, uniqueness and audit commit together', async () => {
      await assert.rejects(accounts.updateProfile(developer.id, { fullName: 'Native', phone: 'bad', email: 'native@example.test' }), { status: 400 });
      const user = await accounts.updateProfile(developer.id, { fullName: 'Native Updated', phone: '07712345678', email: 'native-updated@example.test' });
      assert.equal(user.fullName, 'Native Updated'); assert.equal(user.contact, '07712345678');
      const [[{ count }]] = await pool.execute("SELECT COUNT(*) AS count FROM auditlogs WHERE actor = ? AND action = 'developer.profile.updated'", [developer.id]);
      assert.equal(Number(count), 1);
      await assert.rejects(accounts.updateProfile(developer.id, { fullName: 'Native', phone: '07712345679', email: 'ordinary@example.test' }), { status: 409 });
      assert.equal((await accounts.byId(developer.id)).fullName, 'Native Updated');
    });
    await t.test('connection failure is explicit, sanitized and has no fallback', async () => {
      const { execFileSync } = require('node:child_process');
      const code = `const assert=require('node:assert/strict');const db=require('./server/src/mariadb/database');db.connect({...process.env,MYSQL_PORT:'1'}).then(()=>process.exitCode=1).catch(e=>{assert.match(e.message,/MariaDB connection failed/);assert.ok(!e.message.includes(process.env.MYSQL_PASSWORD));console.log('SANITIZED_CONNECTION_FAILURE_PASS')});`;
      const output = execFileSync(process.execPath, ['-e', code], { cwd: require('node:path').resolve(__dirname, '../..'), env: process.env, encoding: 'utf8', timeout: 20000 });
      assert.match(output, /SANITIZED_CONNECTION_FAILURE_PASS/);
      for (const client of ['mongodb', undefined]) {
        const previous = process.env.DB_CLIENT;
        if (client === undefined) delete process.env.DB_CLIENT; else process.env.DB_CLIENT = client;
        try { await assert.rejects(require('../src/config/db')(), /Only MariaDB is supported/); }
        finally { if (previous === undefined) delete process.env.DB_CLIENT; else process.env.DB_CLIENT = previous; }
      }
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await database.close(); Module._load = originalLoad;
  }
});
