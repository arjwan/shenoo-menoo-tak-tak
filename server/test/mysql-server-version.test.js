'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isSupportedServerVersion } = require('../src/mysql/connection');

test('accepts IQ Hosting MariaDB 10.11 and newer', () => {
  assert.equal(isSupportedServerVersion('10.11.19-MariaDB'), true);
  assert.equal(isSupportedServerVersion('10.11.0-MariaDB'), true);
  assert.equal(isSupportedServerVersion('11.4.2-MariaDB'), true);
});

test('rejects older MariaDB and unsupported MySQL versions', () => {
  assert.equal(isSupportedServerVersion('10.6.22-MariaDB'), false);
  assert.equal(isSupportedServerVersion('5.7.44'), false);
  assert.equal(isSupportedServerVersion('8.0.36'), true);
  assert.equal(isSupportedServerVersion('9.1.0'), true);
  assert.equal(isSupportedServerVersion('unknown'), false);
});
