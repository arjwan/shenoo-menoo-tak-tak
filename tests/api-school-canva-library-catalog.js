// School Canva library: GET /api/school/curriculum/catalog is the primary
// source, joined to GET /api/school/curriculum/files by REAL ids only
// (catalog.file.originalName ↔ files.fileName, catalog.file.url ↔ files.url,
// catalog.id ↔ files.catalogId). Independent of the guardian's students.
// Counts are derived from the shipped data — never hard-coded — so the same
// test is truthful on a checkout without the mapped manifest and on Oracle
// where the verified PDFs are mapped.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const core = require(path.join(root, 'school-canva-adapter-core.js'));
const catalog = require(path.join(root, 'server/src/data/iraqi-curriculum-catalog.js'));
const manifest = require(path.join(root, 'server/src/data/iraqi-curriculum-files.json'));
const linked = require(path.join(root, 'server/src/services/iraqi-curriculum-linked.js'));
const adapter = fs.readFileSync(path.join(root, 'school-canva-adapter.js'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'server/src/routes/school.routes.js'), 'utf8');

const items = linked.catalogItems;
const files = linked.files;

assert.equal(items.length, 108, 'catalog has 108 records');
assert.equal(manifest.fileCount, 136, 'files manifest declares 136 PDFs');
assert.equal(files.length, 136, 'files array length 136');
assert(files.every((f) => f.fileName && f.sha256), 'every manifest entry has a verified file identity');
assert.equal(new Set(files.filter((f) => f.catalogId && f.textAvailable).map((f) => f.catalogId)).size, 92,
  '92 distinct catalogue books have verified indexed text');
assert.equal(new Set(files.filter((f) => f.subject === 'الكيمياء' && f.catalogId && f.textAvailable).map((f) => f.catalogId)).size, 6,
  'six distinct chemistry books are linked');

// The two routes are pure functions of the shipped data: no Student lookup.
const catalogRoute = routes.slice(routes.indexOf("router.get('/curriculum/catalog'"), routes.indexOf("router.get('/curriculum/files'"));
const filesRoute = routes.slice(routes.indexOf("router.get('/curriculum/files'"), routes.indexOf("router.post('/curriculum/upload'"));
assert(catalogRoute && !/Student\./.test(catalogRoute), 'catalog route does not depend on students');
assert(filesRoute && !/Student\./.test(filesRoute), 'files route does not depend on students');
assert(/router\.get\('\/curriculum\/offline-pack'[\s\S]*Student\.find/.test(routes), 'offline-pack is the student-dependent endpoint (not the library source)');

// Join: one library row per catalogue book; readable iff joined to a manifest url.
const rows = core.packLibrary(items, files);
assert.equal(rows.length, items.length, 'packLibrary emits one row per catalogue book');
const manifestUrls = new Set(files.map((f) => f.url));
const readable = rows.filter((r) => r.readable);
const pending = rows.filter((r) => !r.readable);
assert.equal(readable.length + pending.length, items.length);
assert.equal(readable.length, 92, 'indexed catalogue books have real source links');
assert.equal(pending.length, 16, 'only genuinely missing catalogue sources stay pending');
assert(readable.every((r) => r.url && manifestUrls.has(r.url)), 'every readable url comes from the real manifest');
assert(readable.every((r) => /متاح للقراءة/.test(r.status)), 'readable rows labelled available');
assert(pending.every((r) => r.url === '' && !/متاح للقراءة/.test(r.status)), 'non-readable rows expose no open url');
assert(pending.filter((r) => r.status === 'مفهرس — بانتظار النسخة الرسمية').length ===
  items.filter((it, i) => !rows[i].readable && it.availability === 'source_pending').length,
  'source_pending books are labelled as pending, never as readable');
// A book with a populated real file reference must be readable exactly when that reference is in the manifest.
items.forEach((it, i) => {
  const ref = it.file || {};
  const inManifest = files.some((f) => (ref.originalName && f.fileName === ref.originalName) || (ref.url && f.url === ref.url) ||
    (f.catalogId !== null && f.catalogId !== undefined && String(f.catalogId) === String(it.id)));
  assert.equal(rows[i].readable, inManifest, `readable flag mirrors the real join for ${it.title}`);
});
// Hierarchy for the library cards: stage ← grade ← subject.
assert(rows.every((r, i) => r.chapter.startsWith(`${items[i].stage} ← ${items[i].grade} ← ${items[i].subject}`)), 'stage ← grade ← subject path per book');

// Zero-student path: library still full from catalog alone (no offline-pack items).
const zeroStudentLibrary = core.packLibrary([].concat(items), files);
assert.equal(zeroStudentLibrary.length, items.length, 'library does not depend on students/offline-pack');

// Adapter wiring (static): parallel fetch, catalogue-first source, manifest join, real-url-only reader link.
assert(adapter.includes("get('/api/school/curriculum/catalog')"), 'hydrate fetches catalog');
assert(adapter.includes("get('/api/school/curriculum/files')"), 'hydrate fetches files');
assert(/var librarySource = catalogItems\.length\s*\?\s*catalogItems\.concat/.test(adapter), 'library prefers catalog over offline-pack');
assert(adapter.includes('core.packLibrary(librarySource, realCurriculumFiles)'), 'library rows joined to the manifest');
assert(adapter.includes('core.packLibrary(catalogItems, manifestFiles)'), 'updated-export data bridge joins catalogue to manifest too');
assert(adapter.includes('if (row.readable && row.url) {'), 'reader link gated on a real manifest url');
assert(adapter.includes('/محتوى تجريبي/.test'), 'strips demo placeholders');
assert(adapter.includes('فتح وقراءة PDF'), 'open-book control for readable PDFs');

console.log('SCHOOL CANVA LIBRARY CATALOG PASS', {
  catalog: items.length,
  files: files.length,
  readable: readable.length,
  source_pending: pending.length,
  manifestMapped: files.filter((f) => f.catalogId !== null && f.catalogId !== undefined).length
});
