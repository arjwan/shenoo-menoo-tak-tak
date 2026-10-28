'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSchema, identifier, literal, name } = require('../src/mysql/schema');
const { connectionOptions } = require('../src/mysql/connection');
const { applySchema, JOURNAL } = require('../src/mysql/migrate');
const schema = buildSchema();

test('every current model has a relational table and deterministic DDL', () => {
  assert.equal(schema.models, 60);
  assert.equal(schema.tables.filter(t => !t.parent).length, 60);
  assert.equal(schema.tables.length, 137);
  assert.equal(schema.relations.length, 231);
  assert.deepEqual(buildSchema().statements, schema.statements);
  assert.equal(new Set(schema.tables.map(t => t.name)).size, schema.tables.length);
  for (const table of schema.tables) {
    assert.ok(table.name.length <= 64);
    const columns = [...table.columns, ...table.generated].map(c => c.name);
    assert.equal(new Set(columns).size, columns.length);
    for (const ix of table.indexes) {
      assert.ok(ix.name.length <= 64);
      assert.ok(ix.columns.every(c => columns.includes(c)));
    }
  }
});

test('reference arrays retain their order and have real foreign keys', () => {
  const participants = schema.tables.find(t => t.name === 'conversations__participants');
  assert.ok(participants.columns.some(c => c.name === 'position'));
  assert.ok(participants.indexes.some(i => i.unique && i.columns.join(',') === 'parent_id,position'));
  assert.ok(schema.relations.some(r => r.table === participants.name && r.column === 'value' && r.target === 'users'));
  assert.ok(schema.relations.some(r => r.table === participants.name && r.column === 'parent_id' && r.target === 'conversations' && r.onDelete === 'CASCADE'));
});

test('partial unique constraints exclude blank contacts and unlinked students', () => {
  const users = schema.tables.find(t => t.name === 'users');
  const phone = users.generated.find(c => c.expression.includes('`phone`'));
  assert.match(phone.expression, /CASE WHEN.*IS NOT NULL.*CONVERT\(X'' USING utf8mb4\).*ELSE NULL END/);
  assert.ok(users.indexes.some(i => i.unique && i.columns.includes(phone.name)));
  const students = schema.tables.find(t => t.name === 'schoolstudents');
  assert.ok(students.generated.some(c => c.expression.includes('`studentUser` IS NOT NULL')));
});

test('long text remains long text in full-text indexes', () => {
  const knowledge = schema.tables.find(t => t.name === 'schoolknowledgesources');
  assert.equal(knowledge.columns.find(c => c.name === 'content').type, 'LONGTEXT');
  assert.ok(knowledge.indexes.some(i => i.fulltext && i.columns.includes('content')));
  assert.ok(schema.notes.some(n => n.includes('UNION')));
  const keywords = schema.tables.find(t => t.name === 'schoolknowledgesources__keywords');
  assert.ok(keywords.indexes.some(i => i.fulltext && i.columns.includes('value')));
});

test('compound lookup indexes fit MySQL byte limits without weakening unique indexes', () => {
  for (const table of schema.tables) for (const ix of table.indexes) {
    if (ix.fulltext) continue;
    let bytes = 0;
    for (const field of ix.columns) {
      const c = [...table.columns, ...table.generated].find(c => c.name === field);
      const match = c.type.match(/(?:VAR)?CHAR\((\d+)\)/);
      if (/TEXT$/.test(c.type)) assert.ok(ix.prefixes?.[field], `Missing TEXT prefix ${table.name}.${field}`);
      bytes += match ? Number(ix.prefixes?.[field] || match[1]) * (c.type.includes('ascii') ? 1 : 4) : 8;
    }
    assert.ok(bytes <= 3072, `${table.name}.${ix.name}: ${bytes}`);
    if (ix.unique) assert.equal(ix.prefixes, undefined);
  }
});

test('SQL identifiers and literals remain data even with hostile input', () => {
  assert.equal(identifier('a`b'), '`a``b`');
  assert.throws(() => identifier('x\0y'));
  assert.ok(!literal("'; DROP TABLE users; --").includes('DROP TABLE'));
  assert.ok(name('x'.repeat(100)).length <= 64);
});

const env = { MYSQL_HOST: 'localhost', MYSQL_USER: 'test', MYSQL_PASSWORD: 'secret', MYSQL_DATABASE: 'test' };
test('connection config validates settings, uses TLS verification and disables multi-statements', () => {
  const opts = connectionOptions(env);
  assert.equal(opts.ssl.rejectUnauthorized, true);
  assert.equal(opts.multipleStatements, false);
  assert.equal(opts.timezone, 'Z');
  assert.throws(() => connectionOptions({ ...env, MYSQL_PORT: '3306;DROP' }), /Invalid MYSQL_PORT/);
  assert.throws(() => connectionOptions({ ...env, MYSQL_PASSWORD: '' }), /Missing MYSQL_PASSWORD/);
  assert.throws(() => connectionOptions({ ...env, MYSQL_SSL_MODE: 'unverified' }), /MYSQL_SSL_MODE/);
});

test('migration refuses a nonempty destination and releases the lock', async () => {
  const calls = [];
  const connection = {
    async query(sql) { calls.push(sql); return [[{ databaseName: 'test' }]]; },
    async execute(sql) {
      calls.push(sql);
      if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }]];
      if (sql.includes('information_schema.TABLES')) return [[{ name: 'existing_live_data' }]];
      return [[]];
    }
  };
  await assert.rejects(applySchema(connection, schema), /not empty/);
  assert.ok(calls.at(-1).includes('RELEASE_LOCK'));
  assert.ok(!calls.some(sql => sql.startsWith('CREATE')));
});

test('migration records each DDL step and a failure without dropping data', async () => {
  const calls = [];
  const mini = { tables: [{ name: 'one' }], statements: ['CREATE TABLE one (_id INT)', 'INVALID DDL'] };
  const connection = {
    async query(sql) {
      calls.push(sql);
      if (sql.startsWith('SELECT DATABASE')) return [[{ databaseName: 'test' }]];
      if (sql === 'INVALID DDL') { const e = new Error('syntax'); e.code = 'ER_PARSE_ERROR'; throw e; }
      return [[]];
    },
    async execute(sql, values) {
      calls.push([sql, values]);
      if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }]];
      return [[]];
    }
  };
  await assert.rejects(applySchema(connection, mini), /statement 2/);
  assert.ok(calls.some(c => Array.isArray(c) && c[0].includes('completed_steps') && c[1][0] === 1));
  assert.ok(calls.some(c => Array.isArray(c) && c[0].includes(JOURNAL) && c[1]?.[0] === 'failed'));
  assert.ok(!calls.some(c => String(c).includes('DROP TABLE')));
});

test('runtime refuses MySQL until services are ported, without a MongoDB fallback', async () => {
  const old = process.env.DB_CLIENT;
  process.env.DB_CLIENT = 'mysql';
  try { await assert.rejects(require('../src/config/db')(), /services are not yet migrated/); }
  finally { if (old === undefined) delete process.env.DB_CLIENT; else process.env.DB_CLIENT = old; }
});
