'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

test('additive auth upgrade preserves an existing hosting database', { skip: process.env.MARIADB_NATIVE_TEST !== '1', timeout: 120000 }, async t => {
  assert.equal(process.env.MYSQL_HOST, '127.0.0.1');
  assert.match(process.env.MYSQL_DATABASE, /^shinomino_native_test_\d+$/);
  const mysql = require('mysql2/promise');
  const bcrypt = require('bcryptjs');
  const database = require('../src/mariadb/database');
  const { ensureDeveloperAuthSchema } = require('../src/mariadb/auth-schema');
  const auth = require('../src/mariadb/developer-auth');
  const base = process.env.MYSQL_DATABASE.replace('shinomino_native_test_', 'shinomino_auth_upgrade_test_');
  const root = { host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT), user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD };
  const sql = fs.readFileSync(path.join(__dirname, '../src/mariadb/migrations/001_application.sql'), 'utf8');
  const usersSql = sql.split(/;\s*(?:\r?\n|$)/).map(x => x.trim()).find(x => x.startsWith('CREATE TABLE `users`'));
  assert.ok(usersSql);
  let pool;
  async function prepare(suffix, withUsers = true) {
    await database.close();
    process.env.MYSQL_DATABASE = base + '_' + suffix;
    assert.match(process.env.MYSQL_DATABASE, /^shinomino_auth_upgrade_test_\d+_[a-z]+$/);
    const admin = await mysql.createConnection(root);
    try { await admin.query('CREATE DATABASE `' + process.env.MYSQL_DATABASE + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin'); }
    finally { await admin.end(); }
    pool = await database.connect();
    if (withUsers) await pool.query(usersSql);
    await pool.query('CREATE TABLE _shinomino_mysql_migrations (sentinel INT NOT NULL) ENGINE=InnoDB');
    await pool.query('INSERT INTO _shinomino_mysql_migrations VALUES (7)');
  }
  async function names() {
    const [rows] = await pool.query('SHOW TABLES'); return rows.map(row => Object.values(row)[0]).sort();
  }
  const id = crypto.randomBytes(12).toString('hex'), password = crypto.randomBytes(20).toString('hex');
  let snapshot;
  async function accountDigest() {
    const [rows] = await pool.query('SELECT _id, username, contact, passwordHash, role, status FROM users ORDER BY _id');
    return crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  }
  try {
    await prepare('existing');
    await pool.execute(`INSERT INTO users (_id, fullName, username, contact, contactType, passwordHash, termsAccepted, role, status)
      VALUES (?, 'Existing Developer', 'existing_developer', 'existing@example.test', 'email', ?, TRUE, 'developer', 'active')`, [id, await bcrypt.hash(password, 12)]);
    snapshot = await accountDigest();
    await t.test('adds only the two missing auth tables and can run repeatedly', async () => {
      assert.deepEqual((await ensureDeveloperAuthSchema()).created.sort(), ['developer_login_attempts', 'developer_sessions']);
      assert.deepEqual((await ensureDeveloperAuthSchema()).created, []);
      assert.deepEqual(await names(), ['_shinomino_mysql_migrations', 'developer_login_attempts', 'developer_sessions', 'users']);
      assert.equal(await accountDigest(), snapshot);
      const [[row]] = await pool.query('SELECT sentinel FROM _shinomino_mysql_migrations'); assert.equal(row.sentinel, 7);
    });
    await t.test('existing developer password, session and logout work after the additive upgrade', async () => {
      const result = await auth.login('existing_developer', password, 'upgrade-fixture');
      assert.equal(result.status, 200); assert.equal((await auth.authenticate(result.token))._id, id);
      await auth.logout(result.token); await assert.rejects(auth.authenticate(result.token));
      assert.equal(await accountDigest(), snapshot);
    });
    await t.test('incompatible auth tables are rejected before further DDL', async () => {
      await prepare('incompatible');
      await pool.query('CREATE TABLE developer_sessions (token_hash VARCHAR(8) NOT NULL PRIMARY KEY) ENGINE=InnoDB');
      await assert.rejects(ensureDeveloperAuthSchema(), { code: 'AUTH_SCHEMA_INCOMPATIBLE' });
      assert.deepEqual(await names(), ['_shinomino_mysql_migrations', 'developer_sessions', 'users']);
    });
    await t.test('missing users table is not replaced or synthesized', async () => {
      await prepare('missing', false);
      await assert.rejects(ensureDeveloperAuthSchema(), { code: 'AUTH_SCHEMA_INCOMPATIBLE' });
      assert.deepEqual(await names(), ['_shinomino_mysql_migrations']);
    });
  } finally { await database.close(); }
});
