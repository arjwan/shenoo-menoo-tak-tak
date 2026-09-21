'use strict';

/*
 * School Canva "latest" integration contract (plain assert, no frameworks).
 *
 * Proves that the approved Canva export handed over with the task was imported
 * byte-exact, that the seven standalone pages it declares itself
 * (school-index / school-structure / school-teachers / school-students /
 *  school-curriculum / school-reader / school-classroom) were generated from
 * that export while keeping its design, and that they are wired to the real
 * School API — without touching any earlier school artefact.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const bytesOf = (p) => fs.readFileSync(path.join(ROOT, p));
const sha = (p) => crypto.createHash('sha256').update(bytesOf(p)).digest('hex');
const hasFile = (p) => fs.existsSync(path.join(ROOT, p));

const ARTIFACT = 'original-assets/school-canva/school-canva-latest-20260920.html';
const APPROVED = { bytes: 51694, sha256: '4e158ece50846f1b16471553f2f4da65e7beb3e290fa0b8e9a64da9d0e793bda' };
const PAGES = [
  { file: 'school-index.html', page: 'index', screen: 'screen-index', title: 'الرئيسية', owns: ['dashboard-results', 'home-state', 'dashboard-retry', 'connection-chip'] },
  { file: 'school-structure.html', page: 'structure', screen: 'screen-collection', title: 'الهيكل الدراسي', owns: ['screen-collection', 'filter-form', 'collection-results', 'detail-results', 'search-button'] },
  { file: 'school-teachers.html', page: 'teachers', screen: 'screen-collection', title: 'المعلمون والمعلمات', owns: ['filter-form', 'csv-input', 'csv-label', 'collection-results'] },
  { file: 'school-students.html', page: 'students', screen: 'screen-collection', title: 'الطلاب والطالبات', owns: ['filter-form', 'collection-results', 'detail-results'] },
  { file: 'school-curriculum.html', page: 'curriculum', screen: 'screen-collection', title: 'مكتبة المناهج', owns: ['filter-form', 'collection-results', 'catalog-images'] },
  { file: 'school-reader.html', page: 'reader', screen: 'screen-reader', title: 'قارئ الكتاب', owns: ['reader-meta', 'pdf-reader', 'reader-download', 'reader-retry', 'reader-fullscreen'] },
  { file: 'school-classroom.html', page: 'classroom', screen: 'screen-classroom', title: 'الصف والحصة', owns: ['classroom-form', 'classroom-status', 'lesson-content', 'class-actions', 'speech-play', 'speech-pause', 'speech-stop'] }
];

// 1) The approved export is imported byte-exact and still declares the same
//    seven modules, screens and integration surface.
assert.equal(bytesOf(ARTIFACT).length, APPROVED.bytes, 'approved Canva export byte count changed');
assert.equal(sha(ARTIFACT), APPROVED.sha256, 'approved Canva export SHA-256 changed');
const canva = read(ARTIFACT);
for (const marker of ['<title>شنو منو مدرسة</title>', 'id="screen-index"', 'id="screen-collection"', 'id="screen-reader"', 'id="screen-classroom"', 'id="dashboard-results"', 'id="pdf-reader"', 'id="classroom-form"', 'id="filter-form"', 'window.ShnoManoIntegrationAdapter']) {
  assert.ok(canva.includes(marker), 'approved export lost marker: ' + marker);
}
for (const spec of PAGES) assert.ok(canva.includes(spec.file), 'approved export no longer declares ' + spec.file);

// 2) The export's own inline script must compile from the stored bytes: this is
//    what makes the imported interface usable at all.
const scriptStart = canva.lastIndexOf('<script>');
const scriptEnd = canva.indexOf('</script>', scriptStart);
new vm.Script(canva.slice(scriptStart + 8, scriptEnd), { filename: 'canva-latest-inline.js' });

// 3) Earlier artefacts stay in the repository untouched (no work deleted).
assert.equal(sha('original-assets/school-canva/school-canva-original.html'), '0c8b92caace910cc272f98d921ee4a736c2c87cf84d8fe75324361d3d24e6857');
assert.equal(sha('original-assets/school-canva/school-canva-update-20260920.html'), '8f48c78b68d2143b5324a4a152137508d7235cb25f5f166d17de0b2e15f8a59a');

// 4) The server exposes the latest interface and the new backend surface.
const canvaRoutes = read('server/src/routes/school-canva.routes.js');
assert.ok(canvaRoutes.includes("router.get('/latest'"), 'the latest Canva interface must be served');
assert.ok(canvaRoutes.includes('school-canva-latest-20260920.html'), 'the served file must be the approved export');
const server = read('server/src/server.js');
assert.ok(server.includes("app.use('/api/school', schoolClassroomRoutes)"), 'standalone school backend must be mounted');
assert.ok(server.indexOf("app.use('/api/school', schoolRoutes)") < server.indexOf("app.use('/api/school', schoolClassroomRoutes)"), 'it must mount after the existing school routes');
assert.ok(server.includes("require('./routes/school-classroom.routes')"));


// 5) Each standalone page carries its own screen verbatim, is never blank
//    (its screen is visible without JS), and loads only the shared layers.
const UI_PAGES = PAGES.map((spec) => (spec.page === 'curriculum' ? Object.assign({}, spec, { owns: ['filter-form', 'collection-results', 'detail-results', 'curriculum-hero-image', 'library-search'] }) : spec));
for (const spec of UI_PAGES) {
  const html = read(spec.file);
  assert.ok(html.includes('id="' + spec.screen + '"'), spec.file + ' must contain its own screen ' + spec.screen);
  assert.ok(!new RegExp('id="' + spec.screen + '"[^>]*hidden').test(html), spec.file + ': its own screen must not start hidden (blank page)');
  assert.ok(html.includes('id="breadcrumb-current">' + spec.title), spec.file + ': breadcrumb must name the page');
  assert.ok(html.includes('<title>' + spec.title + ' | شنو منو مدرسة</title>'), spec.file + ': page title missing');
  for (const id of spec.owns) assert.ok(html.includes('id="' + id + '"') || html.includes('data-template-id="' + id + '"'), spec.file + ': missing screen element ' + id);
  for (const shared of ['school-app.css', 'school-api-adapter.js', 'school-canva-ui.js', 'auth-guard.js', 'id="connection-chip"', 'id="mobile-drawer"', 'id="report-modal"', 'id="toast"']) {
    assert.ok(html.includes(shared), spec.file + ': missing shared layer ' + shared);
  }
  assert.ok(html.includes('window.__SHNO_SCHOOL_PAGE__=' + JSON.stringify(spec.page)), spec.file + ': page identity missing');
  assert.ok(!html.includes('/_sdk/'), spec.file + ': Canva-only runtime SDK must not be shipped (console hygiene)');
  const scripts = html.match(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g) || [];
  scripts.forEach((block, index) => {
    const body = block.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
    if (!body.trim()) return;
    new vm.Script(body, { filename: spec.file + '#inline-' + index });
  });
  const footer = html.slice(html.indexOf('school-standalone-footer'));
  for (const match of footer.matchAll(/href="([^"#]+\.html)"/g)) {
    assert.ok(hasFile(match[1]), spec.file + ': broken footer link ' + match[1]);
  }
}

// 6) The design system is the approved Canva CSS verbatim + documented extras.
const css = read('school-app.css');
for (const token of ['--ink:#183a3c', '--teal:#146c70', '--mint:#e3f0eb', '--paper:#fff8ed', '--sun:#f7c75d', '--line:#cce1db', '--muted:#53706f', '--danger:#93452e']) {
  assert.ok(css.includes(token), 'Canva design token changed: ' + token);
}
for (const rule of ['.soft-card', '.field', '.nav-link', '.state-box', '.status-chip', '.reader-frame', '.record', '.school-shell', '.screen[hidden]']) {
  assert.ok(css.includes(rule), 'Canva design rule missing: ' + rule);
}
assert.ok(css.includes('it is the Canva export CSS verbatim'), 'the verbatim boundary must stay documented');
assert.ok(css.includes('.school-standalone-footer'), 'standalone additions missing');

// 7) The shared UI layer keeps the approved screens and only talks to the
//    adapter; it never carries demo content of its own.
const ui = read('school-canva-ui.js');
for (const spec of PAGES) assert.ok(ui.includes(spec.file), 'UI navigation map is missing ' + spec.file);
for (const name of ['messageFor', 'setStatus', 'loading', 'toast', 'loadDashboard', 'buildCollection', 'loadCollection', 'loadReader', 'buildClassroom', 'loadRoomOptions', 'classAction', 'diagnostic', 'report']) {
  assert.ok(ui.includes('function ' + name), 'approved UI behaviour missing: ' + name);
}
assert.ok(ui.includes('window.ShnoManoIntegrationAdapter || window.apiClient'), 'the UI must keep the approved adapter discovery');
assert.ok(/1,248|ليان أحمد/.test(ui) === false, 'the UI must not ship the old Canva demo values');
for (const wording of ['يحتاج إعداد API', 'قارئ الكتاب', 'الصف والحصة', 'الهيكل الدراسي', 'المعلمون والمعلمات', 'الطلاب والطالبات', 'مكتبة المناهج']) {
  assert.ok(ui.includes(wording), 'approved wording missing: ' + wording);
}

// 8) The adapter is the real School API client: required method contract,
//    Bearer session, no secrets and no fake payloads.
const adapter = read('school-api-adapter.js');
for (const method of ['getDashboard', 'searchStructure', 'getStages', 'getGrades', 'getSubjects', 'getLessons', 'getDependentOptions', 'searchTeachers', 'searchStudents', 'searchCurriculum', 'getReaderUrl', 'getClassroomOptions', 'classroomAction', 'getSessions']) {
  assert.ok(adapter.includes(method + ':'), 'adapter must expose ' + method);
}
for (const endpoint of ['/dashboard', '/structure', '/teachers', '/students', '/books', '/classroom/options', '/classroom/actions', '/sessions/active']) {
  assert.ok(adapter.includes(endpoint), 'adapter must call ' + endpoint);
}
assert.ok(adapter.includes('localStorage.getItem("token") || sessionStorage.getItem("token")'), 'the session token must come from the platform storage keys');
assert.ok(adapter.includes('Authorization'), 'the session JWT must be sent as a Bearer header');
assert.ok(adapter.includes('window.ShnoManoIntegrationAdapter = adapter'), 'the adapter must be exposed to the approved UI');
assert.doesNotMatch(adapter, /API_KEY|SECRET|OPENAI|AIza|sk-|xkeysib/i, 'the frontend adapter must not contain secrets');
assert.ok(!/1,248|ليان أحمد/.test(adapter), 'the adapter must not ship demo values');

console.log('PASS: school Canva latest is imported byte-exact and the 7 standalone pages are wired to the real School API');
