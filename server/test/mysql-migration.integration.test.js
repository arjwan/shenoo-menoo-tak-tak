'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSchema, applySchema, verifySchema } = require('../src/mysql/migrate');
const { identifier } = require('../src/mysql/schema');
const { openConnection } = require('../src/mysql/connection');
const crypto = require('node:crypto');

test('MySQL 8 applies all tables and enforces relationships and partial uniqueness', {
  skip: process.env.MYSQL_INTEGRATION_TEST !== '1', timeout: 180000
}, async () => {
  // Never run this test against the hosting database or a remote destination.
  assert.equal(process.env.MYSQL_DATABASE, 'shinomino_migration_test');
  assert.ok(['127.0.0.1', 'localhost'].includes(process.env.MYSQL_HOST));
  const { pool, connection } = await openConnection();
  const schema = buildSchema();
  const objectId = () => crypto.randomBytes(12).toString('hex');
  async function insert(tableName, overrides = {}) {
    const table = schema.tables.find(t => t.name === tableName);
    const data = {};
    for (const c of table.columns) {
      if (c.nullable || Object.hasOwn(overrides, c.name)) continue;
      data[c.name] = c.kind === 'ObjectId' ? objectId() : c.kind === 'Date' ? new Date() : ['Number', 'Boolean'].includes(c.kind) ? 1 : 'test';
    }
    Object.assign(data, overrides);
    const fields = Object.keys(data);
    await connection.execute(`INSERT INTO ${identifier(tableName)} (${fields.map(identifier).join(',')}) VALUES (${fields.map(() => '?').join(',')})`, Object.values(data));
    return data._id;
  }
  try {
    await applySchema(connection, schema);
    assert.deepEqual(await verifySchema(connection, schema), []);
    assert.equal((await applySchema(connection, schema)).applied, 0);
    const first = await insert('users', { username: 'one', contact: 'one@example.test', phone: '', email: '' });
    const second = await insert('users', { username: 'two', contact: 'two@example.test', phone: '', email: '' });
    await assert.rejects(insert('users', { username: 'one', contact: 'another@example.test' }), e => e.code === 'ER_DUP_ENTRY');
    await connection.execute('UPDATE users SET phone = ? WHERE _id = ?', ['07700000000', first]);
    await assert.rejects(connection.execute('UPDATE users SET phone = ? WHERE _id = ?', ['07700000000', second]), e => e.code === 'ER_DUP_ENTRY');
    const conversation = await insert('conversations');
    await connection.execute('INSERT INTO conversations__participants (_row_id, parent_id, position, value) VALUES (?, ?, ?, ?)', [objectId(), conversation, 0, first]);
    await assert.rejects(connection.execute('INSERT INTO conversations__participants (_row_id, parent_id, position, value) VALUES (?, ?, ?, ?)', [objectId(), conversation, 1, objectId()]), e => e.code === 'ER_NO_REFERENCED_ROW_2');
    await assert.rejects(connection.execute('DELETE FROM users WHERE _id = ?', [first]), e => e.code === 'ER_ROW_IS_REFERENCED_2');
    await connection.execute('DELETE FROM conversations WHERE _id = ?', [conversation]);
    const [[{ count }]] = await connection.query('SELECT COUNT(*) AS count FROM conversations__participants');
    assert.equal(Number(count), 0);
  } finally { connection.release(); await pool.end(); }
});
