'use strict';

// Additive upgrade for an existing IQ Hosting database. This intentionally does
// not adopt, recreate or mark the application baseline migration as applied.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const database = require('./database');
const definitions = {
  developer_sessions: {
    columns: { token_hash: ['char', 64], user_id: ['varchar', 24], expires_at: ['datetime'], created_at: ['datetime'] },
    primary: 'token_hash'
  },
  developer_login_attempts: {
    columns: { bucket: ['char', 64], attempts: ['int'], window_start: ['datetime'] },
    primary: 'bucket'
  }
};
function failure(message) { return Object.assign(new Error(message), { code: 'AUTH_SCHEMA_INCOMPATIBLE' }); }
async function inspect(connection, name) {
  const [columns] = await connection.execute(`SELECT COLUMN_NAME AS name, DATA_TYPE AS type,
    CHARACTER_MAXIMUM_LENGTH AS length, IS_NULLABLE AS nullable, COLUMN_TYPE AS columnType,
    COLLATION_NAME AS collation FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`, [name]);
  return columns;
}
async function verify(connection, name) {
  const columns = await inspect(connection, name);
  if (!columns.length) return false;
  const spec = definitions[name];
  for (const [field, [type, length]] of Object.entries(spec.columns)) {
    const column = columns.find(c => c.name === field);
    if (!column || column.type !== type || (length && Number(column.length) !== length) || column.nullable !== 'NO') {
      throw failure('Existing authentication table has incompatible columns: ' + name);
    }
    if (['token_hash', 'user_id', 'bucket'].includes(field) && column.collation !== 'ascii_bin') throw failure('Authentication key collation differs: ' + name);
    if (field === 'attempts' && !column.columnType.includes('unsigned')) throw failure('Login attempt counter must be unsigned');
  }
  const [indexes] = await connection.execute(`SELECT COLUMN_NAME AS name FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = 'PRIMARY' ORDER BY SEQ_IN_INDEX`, [name]);
  if (indexes.length !== 1 || indexes[0].name !== spec.primary) throw failure('Authentication primary key differs: ' + name);
  if (name === 'developer_sessions') {
    const [keys] = await connection.query(`SELECT k.COLUMN_NAME AS name, k.REFERENCED_TABLE_NAME AS target,
      k.REFERENCED_COLUMN_NAME AS targetColumn, r.DELETE_RULE AS deleteRule
      FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r
      ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
      WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME = 'developer_sessions'`);
    if (!keys.some(k => k.name === 'user_id' && k.target === 'users' && k.targetColumn === '_id' && k.deleteRule === 'CASCADE')) throw failure('Developer session user relationship differs');
  }
  return true;
}
async function ensureDeveloperAuthSchema() {
  const pool = await database.connect();
  const connection = await pool.getConnection();
  let lock;
  try {
    const [[{ name }]] = await connection.query('SELECT DATABASE() AS name');
    lock = 'native_migrations_' + crypto.createHash('sha256').update(name).digest('hex').slice(0, 40);
    const [[{ acquired }]] = await connection.execute('SELECT GET_LOCK(?, 10) AS acquired', [lock]);
    if (Number(acquired) !== 1) throw failure('Another database migration is running');
    const userColumns = await inspect(connection, 'users');
    const required = ['_id', 'fullName', 'username', 'contact', 'contactType', 'phone', 'email', 'passwordHash', 'role', 'status', 'displayName', 'createdAt', 'updatedAt'];
    if (!required.every(name => userColumns.some(c => c.name === name))) throw failure('The existing users table is not compatible; no account tables were changed');
    const id = userColumns.find(c => c.name === '_id');
    if (id.type !== 'varchar' || Number(id.length) !== 24 || id.collation !== 'ascii_bin') throw failure('Existing user identifier type is incompatible');
    // Validate all existing auth tables before executing any DDL.
    const existing = {};
    for (const name of Object.keys(definitions)) existing[name] = await verify(connection, name);
    const sql = fs.readFileSync(path.join(__dirname, 'migrations/002_developer_sessions.sql'), 'utf8');
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map(s => s.trim()).filter(Boolean);
    if (statements.length !== 2) throw failure('Unexpected authentication migration layout');
    const created = [];
    for (const statement of statements) {
      const name = statement.match(/^CREATE TABLE (\w+)\s*\(/)?.[1];
      if (!Object.hasOwn(definitions, name)) throw failure('Unexpected authentication migration statement');
      if (!existing[name]) { await connection.query(statement); created.push(name); }
    }
    for (const name of Object.keys(definitions)) await verify(connection, name);
    return { created, verified: Object.keys(definitions), applicationTablesChanged: false };
  } finally {
    if (lock) await connection.execute('SELECT RELEASE_LOCK(?)', [lock]).catch(() => {});
    connection.release();
  }
}
if (require.main === module) {
  require('dotenv').config({ quiet: true });
  ensureDeveloperAuthSchema().then(result => console.log(JSON.stringify(result)))
    .catch(error => { console.error('Authentication schema upgrade failed: ' + (error.code || 'AUTH_SCHEMA_ERROR') + '. No existing account table was replaced.'); process.exitCode = 1; })
    .finally(() => database.close());
}
module.exports = { ensureDeveloperAuthSchema };
