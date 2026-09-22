'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const manifest = require('../server/src/data/iraqi-curriculum-files.json');
const index = require('../server/src/data/iraqi-curriculum-index.json');
const catalog = require('../server/src/data/iraqi-curriculum-catalog');

assert.equal(index.schemaVersion, 1);
assert.equal(index.catalogVersion, catalog.version);
assert.equal(index.stats.filesTotal, manifest.fileCount);
assert.equal(index.files.length, manifest.fileCount);

const manifestByName = new Map(manifest.files.map(f => [f.fileName, f]));
const seen = new Set();
for (const f of index.files) {
  seen.add(f.fileName);
  const m = manifestByName.get(f.fileName);
  assert(m, `index references unknown file ${f.fileName}`);
  assert.equal(f.sha256, m.sha256, `sha256 drift for ${f.fileName}`);
  assert.equal(f.driveId, m.driveId);
  assert(['text', 'scanned'].includes(f.classification), `bad classification for ${f.fileName}`);
  assert(f.pages > 0, `no page count for ${f.fileName}`);
  assert(f.title && f.title.length > 3, `no scraped title for ${f.fileName}`);
  assert(['text_done', 'ocr_done', 'ocr_failed', 'ocr_pending', 'ocr_running'].includes(f.status));
  if (f.textAvailable) {
    assert(f.textPath, 'textAvailable without textPath');
    const abs = path.resolve(__dirname, '..', f.textPath);
    assert(fs.existsSync(abs), `missing text file ${f.textPath}`);
    assert(fs.statSync(abs).size > 0, `empty text file ${f.textPath}`);
  }
  if (f.status === 'ocr_done') assert(f.textChars > 0, `ocr_done without chars for ${f.fileName}`);
}
assert.equal(seen.size, manifest.fileCount, 'index must cover every manifest file');

assert.equal(index.stats.textNative + index.stats.scanned, index.stats.filesTotal);
assert.equal(index.stats.catalogCovered + index.stats.catalogPending, catalog.items.length);
assert.equal(index.catalogPending.length, index.stats.catalogPending);
assert.equal(index.extraFiles.length, index.stats.extraFiles);
assert(index.stats.textAvailable > 0, 'no readable books indexed');

console.log(`IRAQI CURRICULUM INDEX PASS (${index.stats.filesTotal} files: ${index.stats.textNative} text + ${index.stats.scanned} scanned, ocr ${index.stats.ocrDone}/${index.stats.scanned}, catalog coverage ${index.stats.catalogCovered}/${catalog.items.length}, source_pending ${index.stats.catalogPending})`);
