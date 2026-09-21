'use strict';

// DOM end-to-end test for the school Canva view wiring.
// Loads the IMMUTABLE original (byte-exact from disk) into a real DOM (jsdom)
// with the real external adapter, exactly the way school-canva.html injects
// it, against a real Express server (real routes + real JWT + real Mongoose
// models on in-memory MongoDB). Proves that every Canva page shows the
// guardian's REAL account data — not the demo — without a single byte of
// the original being modified:
//   home (real statistics), path (real student stage/grade/subject),
//   teachers (real directory + real teacher for the student),
//   class (real teacher name, real curriculum board, real seats),
//   exam (real question, real model answer, real recorded scores),
//   report (real student name + real progress + real platform log),
//   consent (real learningPermissions), library (real curriculum catalog),
//   settings (real integration status).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const { JSDOM, VirtualConsole, requestInterceptor } = require('jsdom');
const vm = require('node:vm');

process.env.JWT_SECRET = 'test-secret-school-canva-dom';

const User = require('../src/models/User');
const Student = require('../src/models/SchoolStudent');
const Knowledge = require('../src/models/SchoolKnowledgeSource');
const SyncOperation = require('../src/models/SchoolSyncOperation');
const LearningRecord = require('../src/models/SchoolLearningRecord');
const Session = require('../src/models/SchoolSession');
// Pure library join (catalogue ⋈ manifest) — the same code the adapter injects.
const core = require('../../school-canva-adapter-core.js');
const schoolCanvaRoutes = require('../src/routes/school-canva.routes');
const schoolSyncRoutes = require('../src/routes/school-sync.routes');
const schoolRoutes = require('../src/routes/school.routes');
// REAL CLASSROOM V1 (live classrooms) — mounted like server.js, between the
// Canva surface and the existing school routers.
const schoolLiveRoutes = require('../src/routes/school-live.routes');
const Classroom = require('../src/models/SchoolClassroom');

const ORIGINAL_SHA = '0c8b92caace910cc272f98d921ee4a736c2c87cf84d8fe75324361d3d24e6857';
const ROOT = path.resolve(__dirname, '..', '..');

function sha256(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }
function read(p) { return fs.readFileSync(p, 'utf8'); }

async function poll(fn, { timeoutMs = 45000, everyMs = 250 } = {}) {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - start > timeoutMs) throw new Error('poll timeout: ' + fn);
    await new Promise((r) => setTimeout(r, everyMs));
  }
}

test('school canva views show the real account data (DOM E2E, original untouched)', { timeout: 180000 }, async () => {
  // 0) The immutable original must still be the approved artifact.
  assert.equal(sha256(path.join(ROOT, 'original-assets/school-canva/school-canva-original.html')), ORIGINAL_SHA,
    'original SHA-256 changed — stop, the original must stay immutable');

  // /tmp is a small tmpfs in CI sandboxes: shrink WiredTiger's cache so the
  // in-memory instance fits (default ~480M cache would overflow it).
  const mongod = await MongoMemoryServer.create({
    instance: { args: ['--wiredTigerCacheSizeGB', '0.25'] }
  });
  let server, app, baseUrl;
  try {
    await mongoose.connect(mongod.getUri('shno-school-canva-dom'));
    const guardian = await User.create({
      fullName: 'أبو زياد', username: 'guardian-dom', contact: 'dom@example.com',
      contactType: 'email', passwordHash: 'x', termsAccepted: true, status: 'active'
    });
    const token = jwt.sign({ userId: guardian._id, role: guardian.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Real student with permissions, a recorded score and a teacher note.
    const student = await Student.create({
      guardian: guardian._id, name: 'زياد كريم', stage: 'ابتدائي', grade: 'الأول ابتدائي',
      subjects: ['الرياضيات', 'العلوم'], parentApproved: true,
      learningPermissions: { camera: true, voice: true },
      scores: [{ subject: 'الرياضيات', lesson: 'الكسور', score: 7, maxScore: 10 }],
      notes: [{ text: 'يشارك بنشاط في الدرس', subject: 'الرياضيات' }]
    });
    student.progress.sessions = 3;
    student.progress.average = 70;
    await student.save();

    // Real verified curriculum item for the student's stage/grade/subject.
    await Knowledge.create({
      title: 'كتاب الرياضيات — الكسور', sourceType: 'official_textbook',
      stage: 'ابتدائي', grade: 'الأول ابتدائي', subject: 'الرياضيات',
      chapter: 'الفصل الأول: الأعداد والعمليات', lesson: 'الكسور والعشرات', year: 2025,
      question: 'ما ناتج 1/2 + 1/4؟', modelAnswer: '3/4',
      content: 'محتوى درس رياضيات حقيقي: الكسور أجزاء من كل، نتعلم المقارنة والجمع.',
      verified: true, uploadedBy: guardian._id,
      file: { url: '/uploads/school-curriculum/dom.pdf', originalName: 'math.pdf', mimeType: 'application/pdf', size: 123 }
    });

    app = express();
    app.use(express.json());
    // Same mounts as the real server.js (the loader fetches /original from
    // the /api/school-canva surface).
    app.use('/api/school', schoolCanvaRoutes);
    app.use('/api/school-canva', schoolCanvaRoutes);
    app.use('/api/school', schoolLiveRoutes);
    app.use('/api/school', schoolSyncRoutes);
    app.use('/api/school', schoolRoutes);
    // Production serves the repo root statically; the 2026-09-21 page loads
    // the adapter by <script src="/school-canva-adapter(-core).js">.
    app.get(['/school-canva-adapter-core.js', '/school-canva-adapter.js'], (req, res) => res.type('application/javascript').send(read(path.join(ROOT, req.path.slice(1)))));
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    // The authenticated classroom config — exactly what the loader fetches.
    const cfgRes = await fetch(baseUrl + '/api/school/classroom/config', {
      headers: { Authorization: 'Bearer ' + token }
    });
    const config = await cfgRes.json();
    assert.equal(config.ok, true);

    // Production serves /api/school-canva/original from the ACTIVE export
    // (since "School: activate Canva update" that is school-canva-update-20260920.html),
    // passed through the documented Canva-export regex repair. Prove the served
    // bytes are exactly repair(disk) — nothing else is ever injected server-side.
    const activeExportPath = path.join(ROOT, 'original-assets/school-canva/school-canva-update-20260920.html');
    const activeDiskHtml = read(activeExportPath);
    const servedRes = await fetch(baseUrl + '/api/school-canva/original');
    assert.equal(servedRes.status, 200);
    const servedUpdateHtml = await servedRes.text();
    assert.equal(servedUpdateHtml, schoolCanvaRoutes.repairCanvaExport(activeDiskHtml),
      'served active export is exactly repair(disk) of school-canva-update-20260920.html');
    assert.ok(servedUpdateHtml.includes('id="structure-list"') && servedUpdateHtml.includes('id="catalog-list"'),
      'active export exposes the data-bridge hooks the adapter relies on');

    // The immutable 2026-09-20 original is still shipped and the adapter still
    // hydrates it (state.library / renderLibrary path). Run its DOM E2E on the
    // same repaired HTML production produced when it was the served file.
    const diskHtml = read(path.join(ROOT, 'original-assets/school-canva/school-canva-original.html'));
    const servedHtml = schoolCanvaRoutes.repairCanvaExport(diskHtml);

    // The on-disk file stays the approved artifact (already SHA-checked above),
    // and the repaired copy differs ONLY by the 2 repaired backslash bytes.
    assert.equal(servedHtml.length, diskHtml.length - 2,
      'repaired original differs from disk by exactly the 2 repaired bytes');
    assert.ok(!servedHtml.includes('/\\\\/$/'), 'served copy has no corrupted /\\/$/ regex');
    assert.ok(!servedHtml.includes('/^\\\\//'), 'served copy has no corrupted /^\\// regex');

    // Prove the served inline script now actually compiles (the root-cause
    // check: the broken export made V8 reject the whole app script).
    const sIdx = servedHtml.lastIndexOf('<script>');
    const eIdx = servedHtml.indexOf('</script>', sIdx);
    const servedScript = servedHtml.slice(sIdx + 8, eIdx);
    try { new vm.Script(servedScript, { filename: 'served-original.js' }); }
    catch (e) { throw new Error('served original script still fails to compile: ' + e.message); }
    // (sanity: the un-repaired disk script must be the one that cannot compile)
    const dIdx = diskHtml.lastIndexOf('<script>');
    let diskCompiles = true;
    try { new vm.Script(diskHtml.slice(dIdx + 8, diskHtml.indexOf('</script>', dIdx))); }
    catch (e) { diskCompiles = /Invalid regular expression flags/.test(e.message); }
    assert.ok(diskCompiles, 'the unrepaired on-disk script is the corrupted one (documents the repair)');

    // Boot a Canva export in jsdom exactly the way school-canva.html does:
    // page first, then core, then config + adapter injected as inline scripts.
    const coreSrc = read(path.join(ROOT, 'school-canva-adapter-core.js'));
    const adapterSrc = read(path.join(ROOT, 'school-canva-adapter.js'));
    async function bootExport(html, bearer) {
      const errors = [];
      const virtualConsole = new VirtualConsole();
      virtualConsole.on('jsdomError', (e) => { errors.push(String((e && e.message) || e)); });
      const dom = new JSDOM(html, {
        url: baseUrl + '/school-canva.html',
        runScripts: 'dangerously',
        resources: 'usable',
        pretendToBeVisual: true,
        virtualConsole,
        beforeParse(window) {
          // Real network for the page's API calls (same origin as the test server).
          window.fetch = (input, init) => {
            const url = typeof input === 'string' ? input : (input && input.url) || '';
            const abs = /^https?:/i.test(url) ? url : new URL(url, baseUrl).href;
            return fetch(abs, init);
          };
          window.Headers = Headers;
          window.localStorage.setItem('token', bearer);
          // Stub so the original's DOMContentLoaded survives a CDN failure;
          // the real lucide (if loaded) overwrites it.
          window.lucide = { createIcons: function () {} };
        }
      });
      const document = dom.window.document;
      await new Promise((resolve, reject) => {
        if (document.readyState === 'complete') return resolve();
        dom.window.addEventListener('load', () => resolve());
        setTimeout(() => reject(new Error('original load timeout')), 30000);
      });
      function inject(scriptText) {
        const s = document.createElement('script');
        s.textContent = scriptText;
        (document.head || document.documentElement).appendChild(s);
      }
      inject(coreSrc);
      inject('window.__SHNO_SCHOOL_CANVA_CONFIG__ = ' + JSON.stringify(config) + ';' + adapterSrc);
      return { dom, doc: document, errors };
    }

    const booted = await bootExport(servedHtml, token);
    const dom = booted.dom;
    const doc = booted.doc;
    const jsdomErrors = booted.errors;

    // Wait for the adapter's hydration to patch the home statistics.
    await poll(async () => doc.getElementById('statistics-title') &&
      doc.getElementById('statistics-title').textContent.includes('شنو منو'), { timeoutMs: 60000 });

    const text = (id) => { const n = doc.getElementById(id); return n ? n.textContent.trim() : null; };

    // 1) HOME: real statistics (1 student, 36 platform teachers, real counts)
    //    + real title/tagline. Original markup untouched (7 stat cards still there).
    const statSection = doc.querySelector('#home-view section[aria-labelledby="statistics-title"]');
    assert.ok(statSection, 'home statistics section exists');
    const statNumbers = Array.from(statSection.querySelectorAll('article'))
      .map((a) => a.querySelectorAll('p')[0].textContent.trim());
    assert.equal(statNumbers.length, 7);
    assert.equal(statNumbers[0], '1', 'real student count (not the demo 1,248)');
    assert.equal(statNumbers[1], '36', 'real platform teacher directory count');
    assert.equal(statNumbers[2], '1', 'distinct real grades');
    assert.equal(statNumbers[3], '2', 'distinct real subjects');
    assert.equal(statNumbers[4], '1', 'real curriculum lesson count');
    assert.equal(statNumbers[5], '1', 'real recorded exam count');
    assert.equal(statNumbers[6], '1', 'real report/note count');
    assert.equal(text('statistics-title'), 'نظرة سريعة على حسابك (شنو منو)');
    assert.ok(doc.querySelector('[data-template-id="app-tagline"]').textContent.includes('مربوطة بحساب شنو منو'));

    // 2) PATH: preselected from the real student (stage/grade/subject).
    assert.equal(doc.getElementById('stage-select').value, 'ابتدائي');
    assert.equal(doc.getElementById('grade-select').value, 'الأول ابتدائي');
    assert.equal(doc.getElementById('subject-select').value, 'الرياضيات');
    // Real teacher matched for the student's stage+subject+grade:
    // نور السندباد (teacher-19, رياضيات/ابتدائي/الأول ابتدائي).
    assert.ok(text('teacher-select').includes('نور السندباد'), 'real teacher in the path select: ' + text('teacher-select'));

    // 3) TEACHERS view: real directory (via the real API) + patched wording.
    const teacherGrid = text('teacher-grid');
    assert.ok(teacherGrid.includes('نور السندباد'), 'real teacher rendered in the grid');
    assert.ok(text('teacher-count').includes('دليل شنو منو'), text('teacher-count'));
    assert.ok(doc.querySelector('#teachers-view [data-template-id="teachers-kicker"]').textContent.includes('شنو منو'));

    // 4) CLASS view: real teacher name + real curriculum board content.
    assert.equal(text('class-teacher-name'), 'نور السندباد', 'class shows the real matched teacher');
    assert.equal(text('board-title'), 'الكسور والعشرات', 'board lesson is the real curriculum lesson');
    assert.ok(text('board-unit').includes('الفصل الأول: الأعداد والعمليات'), text('board-unit'));
    assert.ok(text('board-writing').includes('محتوى درس رياضيات حقيقي'), 'board points come from the real curriculum content');
    assert.ok(text('lesson-question').includes('ما ناتج 1/2 + 1/4؟'), 'lesson question is the real curriculum question');
    // Real student seat replaces the demo seats.
    const seatsTitle = doc.querySelector('h2[data-template-id="students-title"]');
    const seatsGrid = seatsTitle ? seatsTitle.nextElementSibling : null;
    assert.ok(seatsGrid, 'seats grid exists');
    assert.ok(seatsGrid.textContent.includes('زياد كريم'), 'real student in the seats: ' + seatsGrid.textContent);
    assert.ok(!seatsGrid.textContent.includes('حسن'), 'demo seats are gone');

    // 5) EXAM view: real question + real recorded scores panel.
    assert.ok(text('exam-question').includes('ما ناتج 1/2 + 1/4؟'), 'exam question is the real curriculum question');
    const past = text('shno-past-scores');
    assert.ok(past, 'past scores panel exists');
    assert.ok(past.includes('7/10'), 'real recorded score shown: ' + past);

    // 6) REPORT view: real student name + real progress + real platform log.
    const reportContent = text('report-content');
    assert.ok(reportContent.includes('زياد كريم'), 'report shows the real student: ' + reportContent);
    assert.ok(!reportContent.includes('ليان أحمد'), 'demo student name removed from the report');
    assert.ok(reportContent.includes('الحصص المكتملة: 3 (شنو منو)'), 'real completed sessions: ' + reportContent);
    assert.ok(reportContent.includes('متوسط الدرجات: 70% (شنو منو)'), 'real average: ' + reportContent);
    const reportReal = text('shno-report-real');
    assert.ok(reportReal, 'real platform activity panel exists');
    assert.ok(reportReal.includes('يشارك بنشاط في الدرس'), 'real teacher note shown: ' + reportReal);
    assert.ok(reportReal.includes('7/10'), 'real score shown in the platform log');

    // 7) CONSENT view: real learningPermissions drive the original consent
    //    gate (camera/voice granted explicitly by the guardian).
    const consentGrid = text('consent-grid');
    assert.ok(consentGrid.includes('موافق عليه'), 'real granted consent visible: ' + consentGrid);
    assert.ok(text('consent-log').includes('من ملف الطالب في شنو منو'), text('consent-log'));
    assert.ok(text('consent-log').includes('الكاميرا: موافق عليه'), 'camera consent reflects the real permission');

    // 8) LIBRARY view: primary source is GET /api/school/curriculum/catalog
    //    joined to GET /api/school/curriculum/files (real ids only); the
    //    guardian's verified offline-pack item is appended, never required.
    const catalog = text('catalog-list');
    assert.ok(catalog.includes('كتاب الرياضيات — الكسور'), 'real curriculum file in the catalog: ' + catalog);
    assert.ok(catalog.includes('منهاج شنو منو'), 'catalog row labelled as platform content');
    const [catalogRes, filesRes] = await Promise.all([
      fetch(baseUrl + '/api/school/curriculum/catalog', { headers: { Authorization: 'Bearer ' + token } }),
      fetch(baseUrl + '/api/school/curriculum/files', { headers: { Authorization: 'Bearer ' + token } })
    ]);
    const catalogJson = await catalogRes.json();
    const filesJson = await filesRes.json();
    assert.equal(catalogJson.ok, true);
    assert.ok(Array.isArray(catalogJson.items) && catalogJson.items.length > 0, 'catalog endpoint returns the real books');
    assert.ok(Array.isArray(filesJson.files) && filesJson.files.length > 0, 'files endpoint returns the real PDF manifest');
    const expectedRows = core.packLibrary(catalogJson.items, filesJson.files);
    const manifestUrls = new Set(filesJson.files.map((f) => f.url));
    // Same contract for both shipped exports (old original + active update).
    function assertRealLibrary(document, label) {
      const listText = document.getElementById('catalog-list').textContent;
      assert.ok(!listText.includes('محتوى تجريبي'), label + ': no demo curriculum rows once real data is available');
      const cards = Array.from(document.querySelectorAll('#catalog-list article'));
      assert.ok(cards.length >= expectedRows.length,
        `${label}: library shows every catalogue book (${cards.length} cards for ${expectedRows.length} catalogue rows)`);
      for (const item of catalogJson.items.slice(0, 5)) {
        assert.ok(listText.includes(item.title), label + ': real catalogue title rendered: ' + item.title);
      }
      // Open/read link ONLY for books joined to a real manifest url; source_pending rows get none.
      const links = Array.from(document.querySelectorAll('#catalog-list a[data-curriculum-pdf]'));
      assert.equal(links.length, expectedRows.filter((r) => r.readable).length, label + ': one PDF link per readable book');
      assert.ok(links.every((a) => manifestUrls.has(a.getAttribute('href'))), label + ': every PDF link href is a real manifest url');
      const pendingCards = cards.filter((c) => c.getAttribute('data-availability') === 'source_pending');
      assert.equal(pendingCards.length, cards.length - expectedRows.filter((r) => r.readable).length, label + ': pending rows are marked as such');
      assert.ok(pendingCards.every((c) => !c.querySelector('a')), label + ': source_pending rows have no open link');
      return { cards: cards.length, links: links.length, pending: pendingCards.length };
    }
    assertRealLibrary(doc, 'original');
    // Zero-student independence: the catalogue/manifest endpoints never look at students.
    const noStudentGuardian = await User.create({
      fullName: 'ولي بلا طلاب', username: 'guardian-empty', contact: 'empty@example.com',
      contactType: 'email', passwordHash: 'x', termsAccepted: true, status: 'active'
    });
    const emptyToken = jwt.sign({ userId: noStudentGuardian._id, role: noStudentGuardian.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const [emptyCatalog, emptyPack] = await Promise.all([
      fetch(baseUrl + '/api/school/curriculum/catalog', { headers: { Authorization: 'Bearer ' + emptyToken } }).then((r) => r.json()),
      fetch(baseUrl + '/api/school/curriculum/offline-pack', { headers: { Authorization: 'Bearer ' + emptyToken } }).then((r) => r.json())
    ]);
    assert.equal(emptyPack.items.length, 0, 'offline-pack is empty for an account with zero students');
    assert.equal(emptyCatalog.items.length, catalogJson.items.length, 'catalogue is complete for an account with zero students');
    assert.equal(core.packLibrary(emptyCatalog.items, filesJson.files).length, expectedRows.length,
      'library rows for zero students == full catalogue');

    // 8b) ACTIVE export (what /api/school-canva/original serves today) booted
    //     with the ZERO-student account through the adapter's data bridge: the
    //     library must still be the full catalogue with real PDF links only.
    const active = await bootExport(servedUpdateHtml, emptyToken);
    await poll(async () => active.doc.querySelectorAll('#catalog-list article').length >= expectedRows.length, { timeoutMs: 60000 });
    const activeCounts = assertRealLibrary(active.doc, 'active export / zero students');
    assert.equal(activeCounts.cards, expectedRows.length, 'active export: exactly one card per catalogue book for a zero-student account');
    // The export's own search re-render keeps the real links (adapter wraps renderLibrary + listens to input).
    const activeSearch = active.doc.getElementById('library-search');
    activeSearch.value = catalogJson.items[0].title;
    activeSearch.dispatchEvent(new active.dom.window.Event('input', { bubbles: true }));
    const filtered = Array.from(active.doc.querySelectorAll('#catalog-list article'));
    assert.ok(filtered.length >= 1 && filtered.length < expectedRows.length, 'search over real titles narrows the catalogue');
    assert.ok(filtered.every((c) => c.textContent.includes(catalogJson.items[0].title)), 'search results are the real matching book(s)');
    const activeUncaught = active.errors.filter((e) => /Uncaught/.test(e));
    assert.deepEqual(activeUncaught, [], 'active export: no uncaught page errors: ' + active.errors.join(' | '));
    // (Windows are left to the process exit like the original run: closing a
    //  jsdom window while the export's CDN runtime still observes it rejects.)

    // 8c) 2026-09-21 Canva page (root school-canva.html contract:
    //     `window.ShnoManoIntegrationAdapter`, invoke()/has()). The page is
    //     booted AS IS from its own <script src> tags (no injection) against
    //     the real API with the ZERO-student account. Hermetic resource
    //     loader: only this test server's origin is fetched (the Canva _sdk
    //     and CDN tags are skipped, as when they are unreachable).
    const rootPage = read(path.join(ROOT, 'school-canva.html'));
    const integrationHtml = rootPage.includes('window.ShnoManoIntegrationAdapter')
      ? rootPage
      : read(path.join(ROOT, 'tests', 'fixtures', 'school-canva-integration-page.html'));
    assert.ok(integrationHtml.includes('window.ShnoManoIntegrationAdapter || window.apiClient'), 'page discovers the integration adapter');
    // Off-origin sub-resources (Canva _sdk is same-origin but absent here ->
    // 404; CDNs) are answered with an empty script instead of leaving the
    // sandbox, exactly as an unreachable CDN would degrade in production.
    const sameOriginOnly = requestInterceptor((request) => {
      if (request.url.startsWith(baseUrl)) return undefined;
      return new Response('', { headers: { 'Content-Type': 'application/javascript' } });
    });
    async function bootIntegrationPage(bearer) {
      const errors = [];
      const vc = new VirtualConsole();
      vc.on('jsdomError', (e) => { errors.push(String((e && e.message) || e)); });
      const dom = new JSDOM(integrationHtml, {
        url: baseUrl + '/school-canva.html',
        runScripts: 'dangerously',
        resources: { interceptors: [sameOriginOnly] },
        pretendToBeVisual: true,
        virtualConsole: vc,
        beforeParse(window) {
          window.fetch = (input, init) => {
            const url = typeof input === 'string' ? input : (input && input.url) || '';
            return fetch(/^https?:/i.test(url) ? url : new URL(url, baseUrl).href, init);
          };
          window.Headers = Headers;
          window.localStorage.setItem('token', bearer);
        }
      });
      await new Promise((resolve, reject) => {
        if (dom.window.document.readyState === 'complete') return resolve();
        dom.window.addEventListener('load', () => resolve());
        setTimeout(() => reject(new Error('integration page load timeout')), 30000);
      });
      return { dom, errors };
    }
    const emptyRun = await bootIntegrationPage(emptyToken);
    const pageErrors = emptyRun.errors;
    const pageDom = emptyRun.dom;
    const pwin = pageDom.window;
    const pdoc = pwin.document;
    assert.equal(typeof pwin.ShnoManoIntegrationAdapter, 'object', 'window.ShnoManoIntegrationAdapter is installed by the adapter script');
    const ptext = (id) => (pdoc.getElementById(id) || { textContent: '' }).textContent.trim();
    const fire = (el, type) => el.dispatchEvent(new pwin.Event(type, { bubbles: true, cancelable: true }));
    const nav = (pageId) => pdoc.querySelector('[data-page="' + pageId + '"]').click();
    const submitFilters = () => fire(pdoc.getElementById('filter-form'), 'submit');
    const records = () => Array.from(pdoc.querySelectorAll('#collection-results article.record'));
    const titles = () => records().map((c) => c.firstChild.textContent);
    const choose = (id, value) => { const el = pdoc.getElementById(id); el.value = value; assert.equal(el.value, value, id + ' accepts ' + value); fire(el, 'change'); };
    const optionValues = (id) => Array.from(pdoc.getElementById(id).options).map((o) => o.value).filter(Boolean);
    const teachersJson = await fetch(baseUrl + '/api/school/teachers', { headers: { Authorization: 'Bearer ' + emptyToken } }).then((r) => r.json());
    assert.ok(Array.isArray(teachersJson.teachers) && teachersJson.teachers.length > 0, 'real teacher directory');

    // Connection + dashboard from the page's own DOMContentLoaded flow.
    await poll(async () => ptext('connection-label') === 'طبقة التكامل جاهزة' && pdoc.querySelectorAll('#dashboard-results article').length >= 5, { timeoutMs: 60000 });
    const metric = (label) => { const card = Array.from(pdoc.querySelectorAll('#dashboard-results article')).find((a) => a.firstChild.textContent === label); return card ? card.lastChild.textContent : undefined; };
    assert.equal(metric('الطلاب في حسابك'), '0');
    assert.equal(metric('كتب الكتالوج العراقي'), String(expectedRows.length));
    assert.equal(metric('كتب PDF متاحة للقراءة'), String(expectedRows.filter((r) => r.readable).length));
    assert.equal(metric('معلمو شنو منو (شخصيات تعليمية)'), String(teachersJson.teachers.length));
    assert.equal(metric('الحصة الحالية'), 'لا توجد حصة نشطة');
    assert.ok(ptext('home-state').includes('اكتمل الطلب'), 'no invented role: ' + ptext('home-state'));

    // Curriculum: no filters -> the complete real catalogue for a zero-student account.
    nav('curriculum');
    submitFilters();
    await poll(async () => records().length >= expectedRows.length, { timeoutMs: 60000 });
    assert.equal(records().length, expectedRows.length, 'one record per catalogue book');
    const shownTitles = titles();
    expectedRows.forEach((r) => assert.ok(shownTitles.includes(r.name), 'real title shown: ' + r.name));
    assert.ok(!/تجريبي|demo|Demo/.test(pdoc.getElementById('collection-results').textContent), 'no demo wording');
    // Cascade in sequence: stage -> grade -> subject -> unit, real vocabulary replacing the page's local labels.
    const primaryGrades = Array.from(new Set(catalogJson.items.filter((i) => i.stage === 'ابتدائي').map((i) => i.grade)));
    choose('stage', 'primary');
    await poll(async () => optionValues('grade').includes(primaryGrades[0]));
    assert.deepEqual(optionValues('grade'), primaryGrades, 'grade select = real catalogue grades of the stage');
    assert.ok(pdoc.getElementById('subject').disabled, 'subject waits for a grade');
    choose('grade', primaryGrades[0]);
    await poll(async () => !pdoc.getElementById('subject').disabled);
    const realSubjects = Array.from(new Set(catalogJson.items.filter((i) => i.stage === 'ابتدائي' && i.grade === primaryGrades[0]).map((i) => i.subject)));
    assert.deepEqual(optionValues('subject'), realSubjects, 'subject select = real subjects of stage+grade');
    choose('subject', realSubjects[0]);
    await poll(async () => pdoc.getElementById('unit').options[0].textContent !== 'جارٍ تحميل الخيارات المؤكدة…');
    const realChapters = catalogJson.items.filter((i) => i.stage === 'ابتدائي' && i.grade === primaryGrades[0] && i.subject === realSubjects[0] && i.chapter).length;
    assert.equal(optionValues('unit').length, realChapters, 'units only from real chapter data (none invented)');
    submitFilters();
    const expectedBooks = expectedRows.filter((r) => r.stage === 'ابتدائي' && r.grade === primaryGrades[0] && r.subject === realSubjects[0]);
    await poll(async () => records().length === expectedBooks.length && records().every((c) => c.textContent.includes(realSubjects[0])));
    assert.deepEqual(titles().sort(), expectedBooks.map((r) => r.name).sort(), 'filtered books = real books of that branch');
    // Details -> reader: a source_pending book gets no reader url / iframe; a readable one gets the real /uploads url.
    const pendingBook = expectedBooks.find((r) => !r.readable) || expectedRows.find((r) => !r.readable);
    const readableBook = expectedRows.find((r) => r.readable);
    async function openReaderFor(book) {
      nav('curriculum'); // fresh, unfiltered form
      submitFilters();
      await poll(async () => records().length >= expectedRows.length);
      const card = records().find((c) => c.firstChild.textContent === book.name);
      assert.ok(card, 'card for ' + book.name);
      card.click();
      assert.ok(ptext('detail-results').includes('حالة الفهرسة'), 'details show the indexing status');
      nav('reader');
      await poll(async () => !ptext('reader-meta').includes('جارٍ'));
      return { meta: ptext('reader-meta'), frame: pdoc.querySelector('#pdf-reader iframe'), download: pdoc.getElementById('reader-download').disabled };
    }
    if (pendingBook) {
      const r = await openReaderFor(pendingBook);
      assert.equal(r.frame, null, 'source_pending: no iframe / no fake url');
      assert.ok(r.meta.includes('بانتظار النسخة الرسمية'), 'source_pending reader message: ' + r.meta);
      assert.equal(r.download, true, 'source_pending: download stays disabled');
    }
    if (readableBook) {
      const r = await openReaderFor(readableBook);
      assert.ok(r.frame && r.frame.getAttribute('src').startsWith('/uploads/school-curriculum/'), 'readable: iframe on the real /uploads url');
      assert.equal(r.download, false, 'readable: download enabled');
    }
    console.log('    integration page reader checked: pending=' + Boolean(pendingBook) + ' readable=' + Boolean(readableBook));

    // Teachers: the real directory, flagged honestly as the platform's AI teaching personas.
    nav('teachers');
    submitFilters();
    await poll(async () => records().length >= teachersJson.teachers.length);
    assert.equal(records().length, teachersJson.teachers.length);
    const teacherTitles = titles();
    teachersJson.teachers.forEach((t) => assert.ok(teacherTitles.includes(t.name), 'real teacher shown: ' + t.name));
    assert.ok(records().every((c) => c.textContent.includes('شخصية تعليمية افتراضية')), 'AI personas are not presented as human staff');
    // Stage + gender filters narrow to the real directory subset.
    choose('stage', 'middle');
    await poll(async () => optionValues('grade').some((g) => /متوسط/.test(g)));
    choose('gender', 'female');
    submitFilters();
    const middleFemale = teachersJson.teachers.filter((t) => t.stage === 'متوسط' && t.gender === 'أنثى');
    await poll(async () => records().length === middleFemale.length && records().length > 0);
    assert.deepEqual(titles().sort(), middleFemale.map((t) => t.name).sort(), 'teacher filters -> the real subset');

    // Students: zero -> the page's truthful empty state (no invented pupils).
    nav('students');
    submitFilters();
    await poll(async () => ptext('collection-results').includes('لا توجد نتائج بعد نجاح رد المصدر.'));

    // Classroom: real hierarchy; actions never fabricate a student/session.
    const studentsBefore = await Student.countDocuments({ guardian: noStudentGuardian._id });
    const opsBefore = await SyncOperation.countDocuments({});
    const sessionsBefore = await Session.countDocuments({});
    nav('classroom');
    choose('room-stage', 'primary');
    await poll(async () => optionValues('room-grade').includes(primaryGrades[0]));
    choose('room-grade', primaryGrades[0]);
    await poll(async () => !pdoc.getElementById('room-subject').disabled && !pdoc.getElementById('room-teacher').disabled);
    assert.deepEqual(optionValues('room-subject'), realSubjects);
    const roomTeachers = teachersJson.teachers.filter((t) => t.stage === 'ابتدائي' && t.grades.includes(primaryGrades[0]));
    assert.deepEqual(optionValues('room-teacher').sort(), roomTeachers.map((t) => t.id).sort(), 'classroom teachers = real directory for stage+grade');
    choose('room-subject', realSubjects[0]);
    await poll(async () => !pdoc.getElementById('room-lesson').disabled);
    assert.deepEqual(optionValues('room-lesson').sort(), expectedBooks.map((r) => 'book:' + r.id).sort(), 'lessons = the real books (no verified pack for a zero-student account)');
    const chosenLesson = optionValues('room-lesson')[0];
    pdoc.getElementById('classroom-status').textContent = '';
    choose('room-lesson', chosenLesson);
    // Both are the page's own SUCCESS outcomes (rows / no further rows after a successful reply).
    await poll(async () => /تم تحديث الخيارات من المصدر|لا توجد خيارات بعد نجاح رد المصدر/.test(ptext('classroom-status')));
    assert.equal(pdoc.getElementById('room-lesson').value, chosenLesson, 'chosen lesson survives the reply (no select reset)');
    assert.equal(pdoc.getElementById('room-grade').value, primaryGrades[0], 'chosen grade survives the cascade');
    assert.equal(pdoc.getElementById('room-subject').value, realSubjects[0], 'chosen subject survives the cascade');
    assert.ok(ptext('lesson-content').includes('اختر الدرس'), 'no lesson text is invented: ' + ptext('lesson-content'));
    const actionButton = (label) => Array.from(pdoc.querySelectorAll('#class-actions button')).find((b) => b.textContent === label);
    for (const label of ['تسجيل الحضور', 'تسجيل المشاركة', 'رفع اليد']) {
      pdoc.getElementById('classroom-status').textContent = '';
      actionButton(label).click();
      await poll(async () => ptext('classroom-status') !== '');
      assert.ok(ptext('classroom-status').includes('لا يوجد طالب مسجل'), label + ' -> ' + ptext('classroom-status'));
    }
    pdoc.getElementById('classroom-status').textContent = '';
    actionButton('إنهاء الحصة').click();
    await poll(async () => ptext('classroom-status') !== '');
    assert.ok(ptext('classroom-status').includes('لا توجد حصة نشطة'), 'end -> ' + ptext('classroom-status'));
    assert.equal(await Student.countDocuments({ guardian: noStudentGuardian._id }), studentsBefore, 'no student auto-created');
    assert.equal(await SyncOperation.countDocuments({}), opsBefore, 'no operation recorded without a real student');
    assert.equal(await Session.countDocuments({}), sessionsBefore, 'no session fabricated');

    // Diagnostics: the page's own probes all get real answers; no CSV import is advertised.
    pdoc.getElementById('diagnostic-button').click();
    await poll(async () => (ptext('report-content').match(/PASS — /g) || []).length >= 6, { timeoutMs: 60000 });
    const report = ptext('report-content');
    assert.ok(!/FAIL — |SKIP — /.test(report), 'all diagnostics PASS: ' + report);
    assert.ok(report.includes('الكتب') && report.includes(String(expectedRows.length)), 'report counts the real books');
    assert.ok(!/importTeachers/.test(report), 'no import function advertised (backend has no import endpoint)');
    const pageUncaught = pageErrors.filter((e) => /Uncaught/.test(e));
    assert.deepEqual(pageUncaught, [], 'integration page: no uncaught errors: ' + pageErrors.join(' | '));

    // 8d) Same page, the guardian WITH a real student: lesson text comes from
    //     the verified Knowledge item, and the classroom actions hit the real
    //     endpoints for that existing student only (session / note / learning
    //     record) — no student is ever created.
    const own = await bootIntegrationPage(token);
    const odoc = own.dom.window.document;
    const otext = (id) => (odoc.getElementById(id) || { textContent: '' }).textContent.trim();
    const ofire = (el, type) => el.dispatchEvent(new own.dom.window.Event(type, { bubbles: true, cancelable: true }));
    const ochoose = (id, value) => { const el = odoc.getElementById(id); el.value = value; assert.equal(el.value, value, id + ' accepts ' + value); ofire(el, 'change'); };
    const ovalues = (id) => Array.from(odoc.getElementById(id).options).map((o) => o.value).filter(Boolean);
    const ostatusSettled = () => /تم تحديث الخيارات من المصدر|لا توجد خيارات بعد نجاح رد المصدر/.test(otext('classroom-status'));
    await poll(async () => otext('connection-label') === 'طبقة التكامل جاهزة' && odoc.querySelectorAll('#dashboard-results article').length >= 5, { timeoutMs: 60000 });
    const ometric = (label) => { const card = Array.from(odoc.querySelectorAll('#dashboard-results article')).find((a) => a.firstChild.textContent === label); return card ? card.lastChild.textContent : undefined; };
    assert.equal(ometric('الطلاب في حسابك'), '1');
    assert.equal(ometric('كتب الكتالوج العراقي'), String(expectedRows.length), 'library size does not depend on the students');
    // Students collection: the real pupil, real progress — nothing else.
    odoc.querySelector('[data-page="students"]').click();
    ofire(odoc.getElementById('filter-form'), 'submit');
    await poll(async () => odoc.querySelectorAll('#collection-results article.record').length === 1);
    const pupil = odoc.querySelector('#collection-results article.record');
    assert.equal(pupil.firstChild.textContent, 'زياد كريم');
    pupil.click();
    assert.ok(otext('detail-results').includes('التقدم: 70%') && otext('detail-results').includes('الحصص: 3'), 'real progress shown: ' + otext('detail-results'));
    // Structure units come from the verified chapter of this account's pack.
    odoc.querySelector('[data-page="structure"]').click();
    ochoose('stage', 'primary');
    await poll(async () => ovalues('grade').includes('الأول ابتدائي'));
    ochoose('grade', 'الأول ابتدائي');
    await poll(async () => !odoc.getElementById('subject').disabled);
    ochoose('subject', 'الرياضيات');
    await poll(async () => ovalues('unit').length > 0);
    assert.deepEqual(ovalues('unit'), ['الفصل الأول: الأعداد والعمليات'], 'unit = the real verified chapter');
    // Classroom: verified lesson + its real text.
    odoc.querySelector('[data-page="classroom"]').click();
    ochoose('room-stage', 'primary');
    await poll(async () => ovalues('room-grade').includes('الأول ابتدائي'));
    ochoose('room-grade', 'الأول ابتدائي');
    await poll(async () => !odoc.getElementById('room-subject').disabled);
    ochoose('room-subject', 'الرياضيات');
    await poll(async () => !odoc.getElementById('room-lesson').disabled);
    assert.deepEqual(Array.from(odoc.getElementById('room-lesson').options).map((o) => o.textContent).filter((t, i) => i > 0), ['الكسور والعشرات'], 'lessons = verified pack lessons of this account');
    odoc.getElementById('classroom-status').textContent = '';
    ochoose('room-lesson', ovalues('room-lesson')[0]);
    await poll(async () => ostatusSettled());
    assert.ok(otext('lesson-content').includes('محتوى درس رياضيات حقيقي'), 'lesson text = the real Knowledge content: ' + otext('lesson-content'));
    const oButton = (label) => Array.from(odoc.querySelectorAll('#class-actions button')).find((b) => b.textContent === label);
    const ownStudentsBefore = await Student.countDocuments({ guardian: guardian._id });
    const ownSessionsBefore = await Session.countDocuments({ guardian: guardian._id });
    const ownRecordsBefore = await LearningRecord.countDocuments({ guardian: guardian._id });
    async function act(label) {
      odoc.getElementById('classroom-status').textContent = '';
      oButton(label).click();
      await poll(async () => otext('classroom-status') !== '');
      return otext('classroom-status');
    }
    assert.equal(await act('تسجيل الحضور'), 'أكد الخادم الإجراء بنجاح.', 'attendance = real session start');
    const started = await Session.findOne({ guardian: guardian._id, status: 'active' }).lean();
    assert.ok(started && String(started.student) === String(student._id) && started.subject === 'الرياضيات' && started.lesson === 'الكسور والعشرات', 'session for the real student/subject/lesson');
    assert.equal(await act('تسجيل المشاركة'), 'أكد الخادم الإجراء بنجاح.', 'participation = real note');
    const noted = await Student.findById(student._id).lean();
    assert.ok(noted.notes.some((n) => /مشاركة في الحصة/.test(n.text) && n.subject === 'الرياضيات'), 'note stored on the real student');
    assert.equal(await act('رفع اليد'), 'أكد الخادم الإجراء بنجاح.', 'hand = real learning record via /operations');
    assert.equal(await LearningRecord.countDocuments({ guardian: guardian._id }), ownRecordsBefore + 1);
    const handRecord = await LearningRecord.findOne({ guardian: guardian._id }).sort({ createdAt: -1 }).lean();
    assert.equal(String(handRecord.student), String(student._id), 'learning record belongs to the existing student');
    const questionOutcome = await act('إرسال سؤال');
    assert.ok(questionOutcome.includes('نص السؤال'), 'question needs text the page cannot supply: ' + questionOutcome);
    assert.equal(await act('إنهاء الحصة'), 'أكد الخادم الإجراء بنجاح.', 'end = real session completion');
    const ended = await Session.findById(started._id).lean();
    assert.equal(ended.status, 'completed');
    assert.equal(await Session.countDocuments({ guardian: guardian._id }), ownSessionsBefore + 1, 'exactly one real session');
    assert.equal(await Student.countDocuments({ guardian: guardian._id }), ownStudentsBefore, 'no student fabricated by any action');
    assert.equal(await Student.countDocuments({ name: 'طالب Canva' }), 0, 'the /operations default pupil never appears');
    const ownUncaught = own.errors.filter((e) => /Uncaught/.test(e));
    assert.deepEqual(ownUncaught, [], 'integration page (own student): no uncaught errors: ' + own.errors.join(' | '));

    // 8e) REAL CLASSROOM V1 through the same Canva page: a REAL teacher
    //     account opens a live classroom (REST), the guardian's page lists it
    //     as a teacher row (classroom:<CODE>) next to the directory, attendance
    //     joins the REAL pupil, hand raises on the server, and "end" is
    //     refused for a non-teacher — the Canva markup is untouched.
    const teacherUser = await User.create({
      fullName: 'أستاذ حسن علي', username: 'teacher-dom', contact: 'teacher-dom@example.com',
      contactType: 'email', passwordHash: 'x', termsAccepted: true, status: 'active'
    });
    const teacherToken = jwt.sign({ userId: teacherUser._id, role: teacherUser.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const createdLive = await fetch(baseUrl + '/api/school/classrooms', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + teacherToken },
      body: JSON.stringify({ stage: 'ابتدائي', grade: 'الأول ابتدائي', subject: 'الرياضيات', lesson: 'الكسور والعشرات' })
    }).then((r) => r.json());
    assert.equal(createdLive.ok, true, JSON.stringify(createdLive));
    const liveCode = createdLive.classroom.code;
    const liveRun = await bootIntegrationPage(token);
    const ldoc = liveRun.dom.window.document;
    const ltext = (id) => (ldoc.getElementById(id) || { textContent: '' }).textContent.trim();
    const lfire = (el, type) => el.dispatchEvent(new liveRun.dom.window.Event(type, { bubbles: true, cancelable: true }));
    const lchoose = (id, value) => { const el = ldoc.getElementById(id); el.value = value; assert.equal(el.value, value, id + ' accepts ' + value); lfire(el, 'change'); };
    const lvalues = (id) => Array.from(ldoc.getElementById(id).options).map((o) => o.value).filter(Boolean);
    const lsettled = () => /تم تحديث الخيارات من المصدر|لا توجد خيارات بعد نجاح رد المصدر/.test(ltext('classroom-status'));
    await poll(async () => ltext('connection-label') === 'طبقة التكامل جاهزة' && ldoc.querySelectorAll('#dashboard-results article').length >= 5, { timeoutMs: 60000 });
    const lmetric = (label) => { const card = Array.from(ldoc.querySelectorAll('#dashboard-results article')).find((a) => a.firstChild.textContent === label); return card ? card.lastChild.textContent : undefined; };
    assert.equal(lmetric('حصص مباشرة الآن'), '1', 'dashboard counts the real live classroom');
    ldoc.querySelector('[data-page="classroom"]').click();
    lchoose('room-stage', 'primary');
    await poll(async () => lvalues('room-grade').includes('الأول ابتدائي'));
    lchoose('room-grade', 'الأول ابتدائي');
    await poll(async () => !ldoc.getElementById('room-teacher').disabled && lvalues('room-teacher').includes('classroom:' + liveCode));
    const liveTeacherOption = Array.from(ldoc.getElementById('room-teacher').options).find((o) => o.value === 'classroom:' + liveCode);
    assert.ok(/أستاذ حسن علي/.test(liveTeacherOption.textContent) && /حصة مباشرة/.test(liveTeacherOption.textContent), 'live row shows the real teacher account name: ' + liveTeacherOption.textContent);
    const directoryIds = teachersJson.teachers.filter((t) => t.stage === 'ابتدائي' && t.grades.includes('الأول ابتدائي')).map((t) => t.id);
    directoryIds.forEach((id) => assert.ok(lvalues('room-teacher').includes(id), 'directory teacher still listed: ' + id));
    assert.equal(lvalues('room-teacher').filter((v) => v.startsWith('classroom:')).length, 1, 'exactly the one real live classroom — nothing invented');
    lchoose('room-subject', 'الرياضيات');
    await poll(async () => !ldoc.getElementById('room-lesson').disabled);
    ldoc.getElementById('room-teacher').value = 'classroom:' + liveCode;
    ldoc.getElementById('classroom-status').textContent = '';
    lchoose('room-lesson', lvalues('room-lesson')[0]);
    await poll(async () => lsettled());
    assert.ok(ltext('lesson-content').includes('محتوى درس رياضيات حقيقي'), 'real lesson text still first');
    assert.ok(ltext('lesson-content').includes('school-live.html?code=' + liveCode), 'honest pointer to the live classroom page: ' + ltext('lesson-content'));
    assert.equal(ldoc.getElementById('room-teacher').value, 'classroom:' + liveCode, 'selected live classroom survives the reply');
    const lButton = (label) => Array.from(ldoc.querySelectorAll('#class-actions button')).find((b) => b.textContent === label);
    async function lact(label) {
      ldoc.getElementById('classroom-status').textContent = '';
      lButton(label).click();
      await poll(async () => ltext('classroom-status') !== '');
      return ltext('classroom-status');
    }
    const liveStudentsBefore = await Student.countDocuments({});
    const liveSessionsBefore = await Session.countDocuments({ guardian: guardian._id });
    assert.equal(await lact('تسجيل الحضور'), 'أكد الخادم الإجراء بنجاح.', 'attendance = real join of the live classroom');
    let liveDoc = await Classroom.findOne({ code: liveCode }).lean();
    const pupilRow = liveDoc.participants.find((p) => p.role === 'student');
    assert.ok(pupilRow && String(pupilRow.user) === String(guardian._id) && String(pupilRow.student) === String(student._id) && pupilRow.name === 'زياد كريم', 'the REAL pupil joined under the real name');
    assert.deepEqual({ camera: pupilRow.permissions.camera, voice: pupilRow.permissions.voice }, { camera: true, voice: true }, 'guardian consent copied from learningPermissions');
    assert.equal(await lact('رفع اليد'), 'أكد الخادم الإجراء بنجاح.', 'hand = real live classroom hand');
    liveDoc = await Classroom.findOne({ code: liveCode }).lean();
    assert.equal(liveDoc.participants.find((p) => p.role === 'student').handRaised, true, 'hand raised on the server');
    assert.equal(await lact('إنهاء الحصة'), 'لا تملك الصلاحية المطلوبة لهذا الإجراء.', 'a non-teacher cannot end the live classroom (server 403)');
    liveDoc = await Classroom.findOne({ code: liveCode }).lean();
    assert.equal(liveDoc.status, 'live');
    assert.ok((await lact('إرسال سؤال')).includes('نص السؤال'), 'question still refused honestly');
    assert.equal(await Student.countDocuments({}), liveStudentsBefore, 'no student fabricated by the live binding');
    assert.equal(await Session.countDocuments({ guardian: guardian._id }), liveSessionsBefore, 'live attendance does not fabricate an AI session');
    // The teacher ends the classroom for real; the page's next refresh lists no live rows.
    const endedLive = await fetch(baseUrl + '/api/school/classrooms/' + liveCode + '/end', { method: 'POST', headers: { Authorization: 'Bearer ' + teacherToken } }).then((r) => r.json());
    assert.equal(endedLive.classroom.status, 'ended');
    assert.deepEqual(endedLive.attendance.map((a) => a.name), ['زياد كريم'], 'attendance report = the real pupil only');
    ldoc.getElementById('classroom-status').textContent = '';
    lchoose('room-subject', 'الرياضيات');
    await poll(async () => lsettled() && !lvalues('room-teacher').some((v) => v.startsWith('classroom:')));
    const mathDirectoryIds = teachersJson.teachers.filter((t) => t.stage === 'ابتدائي' && t.grades.includes('الأول ابتدائي') && t.subject === 'الرياضيات').map((t) => t.id);
    assert.deepEqual(lvalues('room-teacher').sort(), mathDirectoryIds.sort(), 'after the real end only the directory (stage+grade+subject subset) remains');
    const liveUncaught = liveRun.errors.filter((e) => /Uncaught/.test(e));
    assert.deepEqual(liveUncaught, [], 'integration page (live classroom): no uncaught errors: ' + liveRun.errors.join(' | '));

    // 9) SETTINGS: real integration status line.
    const statusLine = text('shno-integration-status');
    assert.ok(statusLine.includes('حقيقي'), 'integration status is real mode: ' + statusLine);
    assert.ok(statusLine.includes('stun:stun.l.google.com:19302'), 'STUN default present: ' + statusLine);

    // 10) The original's demo/offline fallback machinery is intact: its own
    //     localStorage persistence now holds the REAL learning path.
    const stateBlob = doc.defaultView.localStorage.getItem('shno-mno-integrated-v10');
    assert.ok(stateBlob && stateBlob.includes('ابتدائي') && stateBlob.includes('الأول ابتدائي'),
      'original localStorage state holds the real stage/grade: ' + stateBlob);
    assert.ok(stateBlob.includes('الرياضيات'), 'original localStorage state holds the real subject');
    assert.ok(doc.getElementById('sync-now'), 'original sync button still present');
    assert.ok(doc.getElementById('open-queue'), 'original queue button still present');

    // 11) No uncaught exceptions from original or adapter (CDN 404s allowed).
    const uncaught = jsdomErrors.filter((e) => /Uncaught/.test(e));
    assert.deepEqual(uncaught, [], 'no uncaught page errors: ' + jsdomErrors.join(' | '));
  } finally {
    try { if (server && server.closeAllConnections) server.closeAllConnections(); } catch (e) {}
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongod.stop();
  }
});
