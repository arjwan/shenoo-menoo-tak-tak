'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require('dotenv');
const { ensureAuthEnvironment } = require('../src/scripts/configureAuthEnvironment');
const work = path.resolve(__dirname, '../../work');
fs.mkdirSync(work, { recursive: true });
function directory() { return fs.mkdtempSync(path.join(work, 'auth-environment-test-')); }
test('missing JWT secret is generated privately and remains unchanged on repeated setup', () => {
  const dir = directory(), file = path.join(dir, '.env');
  fs.writeFileSync(file, 'EXISTING_SETTING=preserve');
  assert.equal(ensureAuthEnvironment(dir, {}).jwtSecret, 'created');
  const first = fs.readFileSync(file, 'utf8');
  const key = dotenv.parse(first).JWT_SECRET;
  assert.ok(Buffer.byteLength(key) >= 32);
  assert.ok(first.startsWith('EXISTING_SETTING=preserve\n'));
  assert.equal(ensureAuthEnvironment(dir, {}).jwtSecret, 'already-configured');
  assert.ok(fs.readFileSync(file, 'utf8') === first, 'Existing configuration must remain byte-identical');
  if (process.platform !== 'win32') assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.equal(fs.existsSync(path.join(dir, '.auth-environment.lock')), false);
});
test('an existing platform key is never copied to disk or replaced', () => {
  const dir = directory();
  assert.deepEqual(ensureAuthEnvironment(dir, { JWT_SECRET: crypto.randomBytes(48).toString('hex') }), { jwtSecret: 'already-configured', source: 'environment' });
  assert.equal(fs.existsSync(path.join(dir, '.env')), false);
});
test('invalid configured keys fail closed without overwriting the private file', () => {
  const dir = directory(), file = path.join(dir, '.env');
  const content = 'EXISTING_SETTING=keep\nJWT_SECRET=change-this-to-a-long-random-secret\n';
  fs.writeFileSync(file, content);
  assert.throws(() => ensureAuthEnvironment(dir, {}), { code: 'AUTH_SECRET_INVALID' });
  assert.ok(fs.readFileSync(file, 'utf8') === content);
  assert.throws(() => ensureAuthEnvironment(dir, { JWT_SECRET: 'short' }), { code: 'AUTH_SECRET_INVALID' });
});
test('an existing setup lock is respected', () => {
  const dir = directory();
  fs.writeFileSync(path.join(dir, '.auth-environment.lock'), 'owned-by-another-run');
  assert.throws(() => ensureAuthEnvironment(dir, {}), { code: 'EEXIST' });
  assert.equal(fs.readFileSync(path.join(dir, '.auth-environment.lock'), 'utf8'), 'owned-by-another-run');
  assert.equal(fs.existsSync(path.join(dir, '.env')), false);
});
