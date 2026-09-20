'use strict';

// Contract for the seven standalone school pages + the /latest Canva export.
// The failure Cline last saw was:
//   school-curriculum.html: missing screen element library-search
// This file asserts that element (and the rest of the page shell) without
// weakening the check.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));

const PAGES = [
  'school-index.html',
  'school-structure.html',
  'school-teachers.html',
  'school-students.html',
  'school-curriculum.html',
  'school-reader.html',
  'school-classroom.html'
];

for (const page of PAGES) {
  assert.equal(exists(page), true, `missing page file: ${page}`);
  const html = read(page);
  assert.match(html, /school-api-adapter\.js/, `${page} must load school-api-adapter.js`);
  assert.match(html, /school-canva-ui\.js/, `${page} must load school-canva-ui.js`);
  assert.match(html, /school-app\.css/, `${page} must load school-app.css`);
  assert.ok(html.trim().length > 500, `${page} must not be an empty shell`);
}

// The specific Cline regression: library-search must be a real element on the
// curriculum page screen (not a comment, not a JS-only string).
const curriculum = read('school-curriculum.html');
assert.match(curriculum, /id=["']library-search["']/, 'school-curriculum.html: missing screen element library-search');
assert.match(curriculum, /id=["']catalog-list["']/, 'school-curriculum.html: missing catalog-list');
assert.match(curriculum, /data-screen=["']curriculum["']/, 'school-curriculum.html: curriculum screen marker');

const dom = new JSDOM(curriculum);
const doc = dom.window.document;
const search = doc.getElementById('library-search');
assert.ok(search, 'school-curriculum.html: missing screen element library-search');
assert.equal(search.tagName.toLowerCase(), 'input', 'library-search must be an input');
assert.ok(doc.getElementById('catalog-list'), 'catalog-list element must exist');
assert.ok(doc.querySelector('[data-screen="curriculum"]'), 'curriculum screen container must exist');

// Shared client + UI helpers exist and expose the real API surface.
for (const f of ['school-api-adapter.js', 'school-canva-ui.js', 'school-app.css']) {
  assert.equal(exists(f), true, `missing ${f}`);
  assert.ok(read(f).length > 200, `${f} must not be empty`);
}
const adapter = read('school-api-adapter.js');
for (const marker of [
  '/api/school/dashboard',
  '/api/school/structure',
  '/api/school/books',
  '/api/school/classroom/options',
  '/api/school/classroom/actions',
  'SchoolAPI'
]) assert.ok(adapter.includes(marker), `school-api-adapter missing ${marker}`);

// Backend wiring: classroom routes file + server mount + latest export route.
const classroomRoutes = read('server/src/routes/school-classroom.routes.js');
for (const marker of [
  "router.get('/dashboard'",
  "router.get('/structure'",
  "router.get('/books'",
  "router.get('/books/:id/reader'",
  "router.get('/classroom/options'",
  "router.post('/classroom/actions'"
]) assert.ok(classroomRoutes.includes(marker), `school-classroom.routes missing ${marker}`);

const server = read('server/src/server.js');
assert.ok(server.includes("require('./routes/school-classroom.routes')"), 'server must require school-classroom.routes');
assert.ok(server.includes("app.use('/api/school', schoolClassroomRoutes)"), 'server must mount schoolClassroomRoutes last on /api/school');
// Cards center mount must remain intact (do not regress the finished work).
assert.ok(server.includes("app.use('/api/cards-canva', cardsCanvaRoutes)"), 'cards-canva mount must stay');

const canvaRoutes = read('server/src/routes/school-canva.routes.js');
assert.ok(canvaRoutes.includes("router.get('/latest'"), 'school-canva routes must expose /latest');
assert.ok(canvaRoutes.includes('school-canva-latest-20260920.html'), '/latest must point at the latest export');

const latestPath = path.join(root, 'original-assets/school-canva/school-canva-latest-20260920.html');
assert.equal(fs.existsSync(latestPath), true, 'latest Canva export file must exist');
const latest = fs.readFileSync(latestPath, 'utf8');
assert.ok(latest.includes('id="library-search"'), 'latest export itself contains library-search');
assert.ok(latest.includes('id="structure-list"'), 'latest export contains structure-list');
assert.ok(latest.includes('id="catalog-list"'), 'latest export contains catalog-list');
assert.ok(latest.length > 10000, 'latest export is a full Canva page, not a stub');

// Availability honesty: catalogue rows must not be silently treated as loaded.
const catalog = require('../server/src/data/iraqi-curriculum-catalog');
assert.equal(catalog.items.length, 108, 'catalogue still has 108 rows');
const pending = catalog.items.filter((x) => x.verified !== true || !x.file || !x.file.url);
assert.ok(pending.length > 0, 'sanity: most catalogue rows are not downloadable books');
assert.ok(classroomRoutes.includes("availability") && classroomRoutes.includes('source_pending'),
  'classroom routes must distinguish availability');

console.log('PASS: api-school-canva-latest (7 pages + library-search + /latest + mounts)');
