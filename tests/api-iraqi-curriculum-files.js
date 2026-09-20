'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const manifest = require('../server/src/data/iraqi-curriculum-files.json');

assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.fileCount, 136);
assert.equal(manifest.files.length, manifest.fileCount);
assert(manifest.totalBytes > 1_000_000_000);
assert(manifest.totalPages > 10_000);
assert.equal(new Set(manifest.files.map(item => item.driveId)).size, manifest.fileCount);
for (const item of manifest.files) {
  assert.equal(item.status, 'ok');
  assert.match(item.sha256, /^[a-f0-9]{64}$/);
  assert(item.bytes > 1000 && item.pages > 0);
  assert.equal(item.fileName, `${item.driveId}.pdf`);
  assert.match(item.sourcePage, /^https:\/\/.+\.haltaelam\.com\/$/);
}
const routes = fs.readFileSync(path.resolve(__dirname, '../server/src/routes/school.routes.js'), 'utf8');
assert(routes.includes("router.get('/curriculum/files'"));
assert(routes.includes('/uploads/school-curriculum/${item.fileName}'));
console.log(`IRAQI CURRICULUM FILES PASS (${manifest.fileCount} PDFs / ${manifest.totalPages} pages)`);
