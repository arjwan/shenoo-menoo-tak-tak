#!/usr/bin/env node
/*
 * window.ShnoManoIntegrationAdapter — contract test for the 2026-09-21 Canva
 * school page (`const api = () => window.ShnoManoIntegrationAdapter || …`).
 *
 * 1) The candidate function names are EXTRACTED from the page itself (the
 *    literal `invoke([...])` / `has([...])` lists plus the dynamic
 *    `"search"+info.kind` triples) — never guessed. The repo-root
 *    school-canva.html is used when it is that export; otherwise the
 *    byte-identical fixture of the deployed page
 *    (tests/fixtures/school-canva-integration-page.html).
 * 2) The adapter must expose the object SYNCHRONOUSLY at script evaluation
 *    (the page's DOMContentLoaded runs refreshConnection() right after the
 *    adapter <script> tags), must not touch the page DOM, and must expose no
 *    CSV import function (the backend has no such endpoint).
 * 3) Pure hierarchy/library/reader/classroom logic is checked against the
 *    REAL catalogue + manifest data modules: stage -> grade -> subject ->
 *    unit -> book, the page's own stage ids / local grade labels, 108 rows
 *    for an account with zero students, a reader url only for a readable
 *    manifest PDF, and no student ever fabricated by classroom actions.
 * 4) The adapter's own fetch plumbing is exercised offline with the real data
 *    modules standing in for the two static endpoints (catalogue, manifest)
 *    and an EMPTY offline-pack (exactly what a zero-student account gets):
 *    only real /api/school endpoints, Bearer token, AbortSignal forwarded.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(p, 'utf8');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const FIXTURE = path.join(ROOT, 'tests', 'fixtures', 'school-canva-integration-page.html');
const FIXTURE_SHA = '15c8a41092794e19530161ffda485c512565a6307608007033598dc64848f426';

const core = require(path.join(ROOT, 'school-canva-adapter-core.js'));
const catalogModule = require(path.join(ROOT, 'server/src/data/iraqi-curriculum-catalog.js'));
const filesModule = JSON.parse(read(path.join(ROOT, 'server/src/data/iraqi-curriculum-files.json')));
const catalogItems = catalogModule.items;
const manifestFiles = filesModule.files.map((f) => ({ ...f, url: `/uploads/school-curriculum/${f.fileName}` }));

let passed = 0;
function check(name, fn) {
  try { fn(); passed += 1; console.log('PASS', name); } catch (e) { console.error('FAIL', name); throw e; }
}

// ---------------------------------------------------------------- 1) page
const rootPage = read(path.join(ROOT, 'school-canva.html'));
const pageIsNewExport = rootPage.includes('window.ShnoManoIntegrationAdapter');
const pageHtml = pageIsNewExport ? rootPage : read(FIXTURE);
const pageLabel = pageIsNewExport ? 'school-canva.html (repo root)' : 'tests/fixtures/school-canva-integration-page.html';
check('page under test is the ShnoManoIntegrationAdapter export: ' + pageLabel, () => {
  assert.ok(pageHtml.includes('window.ShnoManoIntegrationAdapter || window.apiClient'), 'page discovers window.ShnoManoIntegrationAdapter');
  if (!pageIsNewExport) assert.equal(sha(pageHtml), FIXTURE_SHA, 'fixture is the byte-identical deployed page');
});

function extractContract(html) {
  const lists = [];
  const re = /\[\s*"((?:get|list|search|dashboard|classroom|record|import)\w*)"((?:\s*,\s*"\w+")*)\s*\]/g;
  let m;
  while ((m = re.exec(html))) lists.push([m[1]].concat((m[2].match(/"(\w+)"/g) || []).map((x) => x.replace(/"/g, ''))));
  const kinds = Array.from(new Set((html.match(/kind:"(\w+)"/g) || []).map((x) => x.replace(/kind:"|"/g, ''))));
  kinds.forEach((kind) => lists.push(['search' + kind, 'list' + kind, 'get' + kind]));
  const key = (l) => l.join('|');
  const unique = []; const seen = new Set();
  lists.forEach((l) => { if (!seen.has(key(l))) { seen.add(key(l)); unique.push(l); } });
  return { lists: unique, kinds };
}
const contract = extractContract(pageHtml);
check('candidate lists extracted from the page (not guessed)', () => {
  assert.ok(contract.lists.length >= 12, 'found the page candidate lists: ' + contract.lists.length);
  assert.deepEqual(contract.kinds.sort(), ['Curriculum', 'Structure', 'Students', 'Teachers']);
  assert.ok(contract.lists.some((l) => l[0] === 'getDashboard'));
  assert.ok(contract.lists.some((l) => l[0] === 'importTeachersCsv'));
});

// ------------------------------------------------ 2) synchronous install
const coreSrc = read(path.join(ROOT, 'school-canva-adapter-core.js'));
const adapterSrc = read(path.join(ROOT, 'school-canva-adapter.js'));
function bootAdapter(fetchImpl) {
  // Minimal DOM carrying the new page's landmark ids (the page markup itself
  // is not needed to prove the object exists; the E2E lives in
  // server/test/school-canva-view-wiring.test.js).
  const dom = new JSDOM('<!doctype html><html><body><span id="connection-chip"></span><form id="filter-form"></form><div id="dashboard-results"></div></body></html>',
    { url: 'https://shino-mino-tak-tak.duckdns.org/school-canva.html', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.localStorage.setItem('token', 'test-token');
  window.fetch = fetchImpl;
  const bodyBefore = window.document.body.innerHTML;
  window.eval(coreSrc);
  window.eval(adapterSrc);
  return { window, bodyBefore };
}
const offline = bootAdapter(() => Promise.reject(new Error('offline')));
check('typeof window.ShnoManoIntegrationAdapter === "object" synchronously after the adapter script', () => {
  assert.equal(typeof offline.window.ShnoManoIntegrationAdapter, 'object');
  assert.ok(offline.window.ShnoManoIntegrationAdapter !== null);
});
const adapterFns = Object.keys(offline.window.ShnoManoIntegrationAdapter).filter((k) => typeof offline.window.ShnoManoIntegrationAdapter[k] === 'function');
check('every candidate list the page invokes is satisfied by a real function (import lists intentionally not)', () => {
  contract.lists.forEach((list) => {
    const hit = list.find((n) => adapterFns.includes(n));
    if (list.some((n) => /^import/.test(n))) {
      assert.equal(hit, undefined, 'no CSV import function is advertised (no backend endpoint): ' + list.join('|'));
    } else {
      assert.ok(hit, 'page candidates ' + list.join('|') + ' -> adapter function');
    }
  });
});
check('function names exposed (report)', () => {
  console.log('   ShnoManoIntegrationAdapter functions:', adapterFns.join(', '));
  assert.ok(adapterFns.length >= 12);
});
check('adapter leaves the new page DOM untouched (no legacy bar / patching)', () => {
  assert.equal(offline.window.document.body.innerHTML, offline.bodyBefore);
});

// ------------------------------------------------ 3) pure logic on real data
const libraryRows = core.packLibrary(catalogItems, manifestFiles);
check('library = catalogue ⋈ manifest (independent of students): ' + libraryRows.length + ' rows', () => {
  assert.equal(catalogItems.length, 108);
  assert.equal(libraryRows.length, 108);
  assert.equal(core.curriculumRows(libraryRows, catalogItems, {}).length, 108, 'no filter -> full catalogue');
  const readable = libraryRows.filter((r) => r.readable).length;
  const pending = libraryRows.filter((r) => !r.readable).length;
  console.log('   readable(real PDF on server):', readable, '| pending:', pending);
  assert.equal(readable + pending, 108);
});
check('hierarchy: stage -> grade -> subject -> unit -> book with the page\'s own stage ids', () => {
  const grades = core.structureOptions(catalogItems, [], { stage: 'primary' });
  assert.ok(grades.length >= 6 && grades.every((r) => r.type === 'grade'));
  assert.deepEqual(grades.map((r) => r.name), core.matchGrades('', catalogItems, 'ابتدائي'));
  const subjects = core.structureOptions(catalogItems, [], { stage: 'primary', grade: grades[0].id }).filter((r) => r.type === 'subject');
  const realSubjects = Array.from(new Set(catalogItems.filter((i) => i.stage === 'ابتدائي' && i.grade === grades[0].id).map((i) => i.subject)));
  assert.deepEqual(subjects.map((r) => r.name), realSubjects);
  const units = core.structureOptions(catalogItems, [], { stage: 'primary', grade: grades[0].id, subject: realSubjects[0] }).filter((r) => r.type === 'unit');
  const realChapters = catalogItems.filter((i) => i.stage === 'ابتدائي' && i.grade === grades[0].id && i.subject === realSubjects[0] && i.chapter).length;
  assert.equal(units.length, realChapters, 'units only from real chapter data');
  const books = core.structureRows(catalogItems, { stage: 'primary', grade: grades[0].id, subject: realSubjects[0] });
  assert.ok(books.length >= 1 && books.every((b) => b.type === 'book' && b.stage === 'ابتدائي' && b.subject === realSubjects[0]));
  assert.equal(core.structureOptions(catalogItems, [], { stage: 'primary' }).filter((r) => r.type === 'section').length, 0, 'no sections exist in the backend -> none invented');
  assert.equal(core.structureOptions(catalogItems, [], { stage: 'nowhere' }).length, 0, 'unknown stage -> nothing');
});
check('page-local grade labels are tolerated until real rows replace them', () => {
  assert.deepEqual(core.matchGrades('الأول', catalogItems, 'ابتدائي'), ['الأول ابتدائي']);
  assert.deepEqual(core.matchGrades('الأول المتوسط', catalogItems, 'متوسط'), ['الأول متوسط']);
  assert.deepEqual(core.matchGrades('الرابع الإعدادي', catalogItems, 'إعدادي').sort(), ['الرابع الأدبي', 'الرابع العلمي']);
  assert.deepEqual(core.matchGrades('السادس العلمي', catalogItems, 'إعدادي'), ['السادس العلمي']);
  const rows = core.curriculumRows(libraryRows, catalogItems, { stage: 'preparatory', grade: 'الرابع الإعدادي', subject: 'الرياضيات' });
  assert.ok(rows.length >= 1 && rows.every((r) => r.stage === 'إعدادي' && /^الرابع/.test(r.grade) && r.subject === 'الرياضيات'));
});
check('curriculum rows: fileId/url only for readable PDFs; source_pending has none', () => {
  const rows = core.curriculumRows(libraryRows, catalogItems, {});
  rows.forEach((r) => {
    assert.ok(r.id && r.title, 'row has id/title');
    if (r.readable) {
      assert.ok(r.fileId && /^\/uploads\/school-curriculum\//.test(r.curriculum_file_url), 'readable -> real /uploads url');
    } else {
      assert.equal(r.fileId, undefined, 'pending -> no fileId (page shows no reader link)');
      assert.equal(r.curriculum_file_url, '');
      assert.ok(/بانتظار/.test(r.indexingStatus));
    }
    assert.ok(!/تجريبي|demo|Demo|نموذج/.test(JSON.stringify(r)), 'no demo wording');
  });
});
check('reader: url only for a real readable manifest PDF', () => {
  const pending = libraryRows.find((r) => !r.readable);
  if (pending) {
    const res = core.readerResult(libraryRows, pending.id);
    assert.equal(res.ok, false);
    assert.ok(/بانتظار النسخة الرسمية/.test(res.message));
  }
  assert.equal(core.readerResult(libraryRows, 'no-such-book').ok, false);
  // Test double for the join result of a readable book (shape produced by core.packLibrary).
  const readableRow = { id: 'x-book', name: 'كتاب اختبار', readable: true, url: '/uploads/school-curriculum/x.pdf', pages: 12 };
  const ok = core.readerResult([readableRow], 'x-book');
  assert.equal(ok.ok, true);
  assert.equal(ok.url, '/uploads/school-curriculum/x.pdf');
  assert.equal(ok.canDownload, true);
  assert.equal(ok.pageCount, 12);
  assert.equal(core.readerResult([{ id: 'y', name: 'y', readable: true, url: '' }], 'y').ok, false, 'readable flag without url -> no reader');
});
check('classroom plan never fabricates a student', () => {
  const base = { items: catalogItems, packItems: [], students: [], session: null };
  ['attendance', 'participation', 'hand'].forEach((action) => {
    const plan = core.classroomActionPlan({ ...base, payload: { action, 'room-stage': 'primary', 'room-grade': 'الأول ابتدائي', 'room-subject': 'الرياضيات', 'room-lesson': 'book:x' } });
    assert.equal(plan.kind, 'refuse', action + ' refused with zero students');
    assert.ok(/لا يوجد طالب/.test(plan.message));
  });
  assert.equal(core.classroomActionPlan({ ...base, payload: { action: 'end' } }).kind, 'refuse', 'end without active session refused');
  assert.equal(core.classroomActionPlan({ ...base, payload: { action: 'question', 'room-stage': 'primary' }, students: [{ _id: 's1', name: 'طالب', stage: 'ابتدائي', grade: 'الأول ابتدائي' }] }).kind, 'refuse', 'question needs text the page cannot supply');
  const student = { _id: '507f1f77bcf86cd799439011', name: 'اسم حقيقي', stage: 'ابتدائي', grade: 'الأول ابتدائي' };
  const withStudent = { ...base, students: [student] };
  const start = core.classroomActionPlan({ ...withStudent, payload: { action: 'attendance', 'room-stage': 'primary', 'room-grade': 'الأول', 'room-subject': 'الرياضيات', 'room-lesson': 'book:' + catalogItems[0].id } });
  assert.deepEqual(start, { kind: 'session.start', body: { studentId: student._id, subject: 'الرياضيات', lesson: catalogItems[0].title } });
  const hand = core.classroomActionPlan({ ...withStudent, payload: { action: 'hand', 'room-stage': 'primary', 'room-grade': 'الأول ابتدائي', 'room-subject': 'الرياضيات', 'room-lesson': 'book:' + catalogItems[0].id, at: '2026-09-21T10:00:00.000Z' } });
  assert.equal(hand.kind, 'operation');
  assert.equal(hand.record.student_name, student.name, 'operation carries the REAL student name (applyPlan matches, never creates)');
  assert.equal(hand.record.stage, 'ابتدائي');
  assert.equal(hand.record.grade, 'الأول ابتدائي');
  assert.equal(hand.record.answer_type, 'رفع يد');
  const mismatch = core.classroomActionPlan({ ...withStudent, payload: { action: 'hand', 'room-stage': 'middle', 'room-grade': 'الأول متوسط', 'room-lesson': 'x' } });
  assert.equal(mismatch.kind, 'refuse', 'student of another stage/grade is never borrowed');
  const end = core.classroomActionPlan({ ...withStudent, session: { _id: 'abc' }, payload: { action: 'end' } });
  assert.equal(end.kind, 'session.complete');
  assert.equal(end.sessionId, 'abc');
  assert.deepEqual([end.body.score, end.body.maxScore], [0, 0], 'no invented marks');
});
check('classroom options: lessons from verified pack when present, else catalogue books; content only from real Knowledge text', () => {
  const noPack = core.classroomOptions(catalogItems, [], [], { 'room-stage': 'primary', 'room-grade': 'الأول ابتدائي', 'room-subject': 'الرياضيات' });
  const lessons = noPack.filter((r) => r.type === 'lesson');
  assert.ok(lessons.length >= 1 && lessons.every((r) => /^book:/.test(r.id) && !r.content));
  const pack = [{ id: 'k1', stage: 'ابتدائي', grade: 'الأول ابتدائي', subject: 'الرياضيات', lesson: 'درس حقيقي', content: 'نص الدرس الحقيقي' }];
  const withPack = core.classroomOptions(catalogItems, pack, [], { 'room-stage': 'primary', 'room-grade': 'الأول ابتدائي', 'room-subject': 'الرياضيات' });
  assert.deepEqual(withPack.filter((r) => r.type === 'lesson').map((r) => r.name), ['درس حقيقي']);
  const chosen = core.classroomOptions(catalogItems, pack, [], { 'room-stage': 'primary', 'room-grade': 'الأول ابتدائي', 'room-subject': 'الرياضيات', 'room-lesson': 'knowledge:k1' });
  assert.equal(chosen.find((r) => typeof r.content === 'string').content, 'نص الدرس الحقيقي');
  assert.equal(core.classroomOptions(catalogItems, [], [], {}).length, 0, 'nothing before a stage');
  // The page rebuilds every select present in the reply: chosen levels are not re-sent (their value would be lost).
  const afterGrade = core.classroomOptions(catalogItems, [], [], { 'room-stage': 'primary', 'room-grade': 'الأول ابتدائي' });
  assert.ok(!afterGrade.some((r) => r.type === 'grade') && afterGrade.some((r) => r.type === 'subject'), 'valid grade kept, subjects offered');
  assert.ok(!chosen.some((r) => r.type === 'grade' || r.type === 'subject' || r.type === 'lesson'), 'chosen grade/subject/lesson not re-sent');
  const staleGrade = core.classroomOptions(catalogItems, [], [], { 'room-stage': 'middle', 'room-grade': 'الأول ابتدائي' });
  assert.ok(staleGrade.every((r) => r.type === 'grade') && staleGrade.length === 3, 'grade from another stage -> real grades of the new stage re-sent');
});
check('dashboard metrics are computed from real payload sizes only', () => {
  const metrics = core.dashboardMetrics({ students: [], teachers: [], libraryRows, session: null, schedules: [] });
  const byLabel = Object.fromEntries(metrics.map((m) => [m.label, m.value]));
  assert.equal(byLabel['الطلاب في حسابك'], 0);
  assert.equal(byLabel['كتب الكتالوج العراقي'], 108);
  assert.equal(byLabel['الحصة الحالية'], 'لا توجد حصة نشطة');
});

// ------------------------------------------------ 4) offline plumbing check
(async () => {
  const calls = [];
  const payloads = {
    '/api/school/curriculum/catalog': { ok: true, items: catalogItems },
    '/api/school/curriculum/files': { ok: true, files: manifestFiles },
    '/api/school/curriculum/offline-pack': { ok: true, items: [] } // zero students
  };
  const booted = bootAdapter((url, init) => {
    calls.push({ url: String(url), init: init || {} });
    const body = payloads[String(url)];
    if (!body) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ ok: false, message: 'unexpected endpoint in offline test: ' + url }) });
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
  });
  const A = booted.window.ShnoManoIntegrationAdapter;
  const ctrl = new booted.window.AbortController();
  const lib = await A.searchCurriculum({ query: '', stage: '', grade: '', subject: '', unit: '', signal: ctrl.signal });
  check('adapter.searchCurriculum -> 108 real rows for an account with an empty offline-pack', () => {
    assert.equal(lib.items.length, 108);
    assert.ok(lib.items.every((r) => r.title && r.stage && r.grade && r.subject));
  });
  const grades = await A.getGrades({ query: '', stage: 'primary', grade: '', section: '', subject: '', unit: '', signal: ctrl.signal });
  const deps = await A.getDependentOptions({ stage: 'primary', grade: grades.items[0].id, section: '', subject: '', unit: '', signal: ctrl.signal });
  const stages = await A.getStages({ signal: ctrl.signal });
  const subjects = await A.getSubjects({ signal: ctrl.signal });
  const structure = await A.searchStructure({ query: '', stage: '', grade: '', section: '', subject: '', unit: '', signal: ctrl.signal });
  check('adapter cascade/diagnostics answer from the real catalogue', () => {
    assert.ok(grades.items.length >= 6 && grades.items.every((r) => r.type === 'grade'));
    assert.ok(deps.items.some((r) => r.type === 'subject'));
    assert.deepEqual(stages.items.map((r) => r.name), ['ابتدائي', 'متوسط', 'إعدادي']);
    assert.ok(subjects.items.length >= 5 && subjects.items.every((r) => r.type === 'subject'));
    assert.deepEqual(structure.items.map((r) => r.name), ['ابتدائي', 'متوسط', 'إعدادي']);
  });
  let readerError = null;
  const pendingRow = lib.items.find((r) => !r.readable);
  if (pendingRow) {
    try { await A.getReaderUrl({ fileId: pendingRow.id, signal: ctrl.signal }); } catch (e) { readerError = e; }
  }
  check('adapter.getReaderUrl rejects source_pending books (no fake url)', () => {
    if (!pendingRow) return;
    assert.ok(readerError && /بانتظار النسخة الرسمية/.test(readerError.message), String(readerError && readerError.message));
  });
  check('only real /api/school endpoints were called, with Bearer; live calls carry the page AbortSignal; reference data is memoised', () => {
    assert.ok(calls.length >= 3);
    calls.forEach((c) => {
      assert.ok(payloads[c.url], 'real endpoint: ' + c.url);
      // The adapter's own fetch wrapper normalises headers into a Headers instance.
      const h = c.init.headers || {};
      const auth = typeof h.get === 'function' ? h.get('Authorization') : h.Authorization;
      assert.equal(auth, 'Bearer test-token');
    });
    const urls = new Set(calls.map((c) => c.url));
    assert.ok(urls.has('/api/school/curriculum/catalog') && urls.has('/api/school/curriculum/files'));
    assert.equal(calls.filter((c) => c.url === '/api/school/curriculum/catalog').length, 1, 'catalogue fetched once per page session (memoised, never aborted)');
    const live = calls.filter((c) => c.url === '/api/school/curriculum/offline-pack');
    assert.ok(live.length >= 1 && live.every((c) => c.init.signal === ctrl.signal), 'per-account calls forward the page signal');
  });
  // The page aborts the previous request of a bucket before re-invoking: an
  // aborted invocation must reject with AbortError even when every input is
  // already cached (otherwise stale rows would be written into the selects).
  const aborted = new booted.window.AbortController();
  aborted.abort();
  let abortOutcome = null;
  try { await A.searchCurriculum({ signal: aborted.signal }); abortOutcome = 'resolved'; } catch (e) { abortOutcome = e && e.name; }
  check('aborted invocation rejects with AbortError (never resolves stale rows)', () => {
    assert.equal(abortOutcome, 'AbortError');
  });
  console.log('\nOK', passed, 'checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
