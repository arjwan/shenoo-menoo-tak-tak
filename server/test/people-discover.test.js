const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const userRoutes = require('../src/routes/user.routes');

test('discover handler no longer calls a nonexistent user.privacySetting method', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/routes/user.routes.js'), 'utf8');
  assert.equal(source.includes('u.privacySetting('), false);
});

test('privacySetting reads Map and plain-object privacy from lean documents', () => {
  assert.equal(userRoutes.privacySetting(new Map([['profile', 'nobody']]), 'profile'), 'nobody');
  assert.equal(userRoutes.privacySetting({ profile: 'nobody' }, 'profile'), 'nobody');
  assert.equal(userRoutes.privacySetting(undefined, 'profile'), 'everyone');
});
