'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const storage = require('../src/services/media-storage');
const keys = ['MEDIA_STORAGE_PROVIDER', 'R2_ACCOUNT_ID', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'MEDIA_CDN_BASE_URL'];
const credentials = { R2_ACCOUNT_ID: 'account', R2_BUCKET: 'bucket', R2_ACCESS_KEY_ID: 'access', R2_SECRET_ACCESS_KEY: 'secret', MEDIA_CDN_BASE_URL: 'https://media.example.test' };
async function withEnv(values, work) {
  const old = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) {
      if (Object.hasOwn(values, key)) process.env[key] = values[key];
      else delete process.env[key];
    }
    return await work();
  } finally {
    for (const key of keys) {
      if (old[key] === undefined) delete process.env[key];
      else process.env[key] = old[key];
    }
  }
}
test('local provider disables old R2 credentials', async () => {
  await withEnv({ ...credentials, MEDIA_STORAGE_PROVIDER: 'local' }, async () => {
    assert.equal(storage.configured(), false);
  });
});
test('local publishing returns upload path without contacting R2', async () => {
  await withEnv({ ...credentials, MEDIA_STORAGE_PROVIDER: 'local' }, async () => {
    const published = await storage.publishFile(__filename, { category: 'posts', fallbackUrl: '/uploads/posts/example.mp4' });
    assert.equal(published.url, '/uploads/posts/example.mp4');
    assert.equal(published.storage, 'local');
    assert.equal(published.storageKey, '');
  });
});
test('explicit R2 mode preserves existing behaviour', async () => {
  await withEnv({ ...credentials, MEDIA_STORAGE_PROVIDER: 'r2' }, async () => {
    assert.equal(storage.configured(), true);
  });
});
