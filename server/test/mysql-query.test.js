'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSchema } = require('../src/mysql/schema');
const { compileFilter } = require('../src/mysql/filter');
const { applyUpdate } = require('../src/mysql/data');
const { project, projection } = require('../src/mysql/model');
const schema = buildSchema();
const table = name => schema.tables.find(t => t.name === name);

test('every model loads in MySQL mode and keeps exported constants without opening MongoDB', () => {
  const { execFileSync } = require('node:child_process');
  const output = execFileSync(process.execPath, ['-e', "const s=require('./server/src/mysql/schema').buildSchema();const r=require('./server/src/mysql/model').registry;if(r.size!==60)throw Error('Missing models');if(!require('./server/src/models/GuardianConsent').CONSENT_TYPES)throw Error('Missing constants');console.log(s.models,require('mongoose').connection.readyState)"], { cwd: require('node:path').resolve(__dirname, '../..'), env: { ...process.env, DB_CLIENT: 'mysql' }, encoding: 'utf8' });
  assert.equal(output.trim(), '60 0');
});

test('filters keep user input in parameters and preserve nested authorization scopes', () => {
  const malicious = "x' OR 1=1 --";
  const result = compileFilter(schema, table('users'), { status: 'active', $or: [{ username: malicious }, { phone: '07700000000' }] });
  assert.ok(!result.sql.includes(malicious));
  assert.deepEqual(result.values, ['active', malicious, '07700000000']);
  assert.match(result.sql, /AND/); assert.match(result.sql, /OR/);
});
test('array membership and exact conversation size use normalized child tables', () => {
  const result = compileFilter(schema, table('conversations'), { participants: { $all: ['a', 'b'] }, $expr: { $eq: [{ $size: '$participants' }, 2] } });
  assert.match(result.sql, /conversations__participants/);
  assert.match(result.sql, /COUNT\(\*\)/);
  assert.deepEqual(result.values, ['a', 'b', 2]);
});
test('nested elemMatch requires the same participant row', () => {
  const result = compileFilter(schema, table('schoolclassrooms'), { participants: { $elemMatch: { user: 'a', role: 'student', leftAt: null } } });
  assert.equal((result.sql.match(/EXISTS/g) || []).length, 1);
  assert.deepEqual(result.values, ['a', 'student']);
});
test('unknown fields/operators fail closed and cannot remove a scope condition', () => {
  assert.throws(() => compileFilter(schema, table('users'), { status: 'active', $where: 'evil' }), /Unsupported/);
  assert.throws(() => compileFilter(schema, table('users'), { invented: 'x' }), /Unknown/);
  assert.throws(() => compileFilter(schema, table('users'), { phone: { $exists: true } }), /Unsupported/);
});
test('projections exclude password hashes and id-only projections remain id-only', () => {
  const user = { _id: 'id', fullName: 'name', passwordHash: 'secret', profile: { bio: 'bio', online: true } };
  assert.deepEqual(project(user, '_id'), { _id: 'id' });
  assert.deepEqual(project(user, 'profile.bio'), { _id: 'id', profile: { bio: 'bio' } });
  assert.equal(project(user, '-passwordHash').passwordHash, undefined);
  const User = require('../src/models/User');
  const id = new (require('mongoose').Types.ObjectId)();
  const hydrated = User.hydrate({ _id: id, displayName: 'name' }, projection('displayName'));
  assert.equal(String(hydrated._id), String(id));
});
test('atomic update operations preserve distinct list elements and reject unsafe writes', () => {
  const result = applyUpdate({ ids: ['a', 'b'], progress: { score: 2 } }, { $pull: { ids: 'a' }, $addToSet: { ids: { $each: ['b', 'c'] } }, $inc: { 'progress.score': 3 } });
  assert.deepEqual(result, { ids: ['b', 'c'], progress: { score: 5 } });
  assert.throws(() => applyUpdate({}, { $set: { '__proto__.x': true } }), /Unsafe/);
  assert.throws(() => applyUpdate({ _id: 'a' }, { $set: { _id: 'b' } }), /Cannot change/);
});
