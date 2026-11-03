'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const retiredHost = /shino-mino-tak-tak\.duckdns\.org/i;
const publicEntrypoints = [
  'taktak-feed.js',
  'taktak-calls-dock.js',
  'social-api.js',
  'presence-client.js',
  'home-notifications.js',
  'my-service-requests.js',
  'school-live.html',
  'reels-v2.js',
  'profile-posts.js',
  'profile.js',
  'communication-dock.js',
  'developer-services.js',
  'developer-rooms.js',
  'developer-school-requests.js',
  'developer.html',
  'server/src/socket.js'
];

for (const entrypoint of publicEntrypoints) {
  test(entrypoint + ' does not call the retired DuckDNS backend', () => {
    const source = fs.readFileSync(path.join(root, entrypoint), 'utf8');
    assert.doesNotMatch(source, retiredHost);
  });
}

test('TakTak no longer intercepts local composer uploads through R2 signing', () => {
  const source = fs.readFileSync(path.join(root, 'taktak-direct-upload.js'), 'utf8');
  assert.doesNotMatch(source, /media-direct\/sign|cloudflarestorage\.com|duckdns\.org/i);
});

test('developer and authentication backend remain on this repository', () => {
  const source = fs.readFileSync(path.join(root, 'server/src/middleware/auth.js'), 'utf8');
  assert.match(source, /developer-auth/);
  assert.match(source, /authenticate\(token\)/);
});
