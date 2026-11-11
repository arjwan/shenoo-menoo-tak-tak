'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const connectDB = require('../src/config/db');

function withSettings(values, run) {
  const keys = ['DB_CLIENT', 'MONGODB_URI', 'MONGODB_DB_NAME', 'MYSQL_RUNTIME_EXPERIMENTAL'];
  const previous = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  for (const key of keys) {
    if (Object.hasOwn(values, key)) {
      if (values[key] == null) delete process.env[key];
      else process.env[key] = values[key];
    }
  }
  return Promise.resolve().then(run).finally(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
}

test('MongoDB mode refuses an absent URI before any connection', async () => {
  await withSettings({ DB_CLIENT: 'mongodb', MONGODB_URI: null, MONGODB_DB_NAME: 'shino_mino_tak_tak' }, async () =>
    assert.rejects(connectDB(), /MONGODB_URI/));
});

test('MongoDB mode refuses implicit database selection', async () => {
  await withSettings({ DB_CLIENT: 'mongodb', MONGODB_URI: 'mongodb://localhost:27017/', MONGODB_DB_NAME: null }, async () =>
    assert.rejects(connectDB(), /MONGODB_DB_NAME/));
});

test('unsupported database setting never falls back to another database', async () => {
  await withSettings({ DB_CLIENT: 'auto' }, async () =>
    assert.rejects(connectDB(), /automatic fallback is disabled/));
});

test('the original MariaDB runtime remains behind its explicit safety guard', async () => {
  await withSettings({ DB_CLIENT: 'mysql', MYSQL_RUNTIME_EXPERIMENTAL: null }, async () =>
    assert.rejects(connectDB(), /experimental/));
});
