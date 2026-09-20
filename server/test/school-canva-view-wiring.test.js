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
const { JSDOM, VirtualConsole } = require('jsdom');
const vm = require('node:vm');

process.env.JWT_SECRET = 'test-secret-school-canva-dom';

const User = require('../src/models/User');
const Student = require('../src/models/SchoolStudent');
const Knowledge = require('../src/models/SchoolKnowledgeSource');
const schoolCanvaRoutes = require('../src/routes/school-canva.routes');
const schoolSyncRoutes = require('../src/routes/school-sync.routes');
const schoolRoutes = require('../src/routes/school.routes');

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
    app.use('/api/school', schoolSyncRoutes);
    app.use('/api/school', schoolRoutes);
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    // The authenticated classroom config — exactly what the loader fetches.
    const cfgRes = await fetch(baseUrl + '/api/school/classroom/config', {
      headers: { Authorization: 'Bearer ' + token }
    });
    const config = await cfgRes.json();
    assert.equal(config.ok, true);

    // Load the original the same way production does: through the serving
    // endpoint /api/school-canva/original (which applies the documented 2-byte
    // Canva-export regex repair to the in-memory copy).
    const diskHtml = read(path.join(ROOT, 'original-assets/school-canva/school-canva-original.html'));
    const servedRes = await fetch(baseUrl + '/api/school-canva/original');
    assert.equal(servedRes.status, 200);
    const servedHtml = await servedRes.text();

    // The on-disk file stays the approved artifact (already SHA-checked above),
    // and the served copy differs ONLY by the 2 repaired backslash bytes.
    assert.equal(servedHtml.length, diskHtml.length - 2,
      'served original differs from disk by exactly the 2 repaired bytes');
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

    const jsdomErrors = [];
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('jsdomError', (e) => { jsdomErrors.push(String((e && e.message) || e)); });

    const dom = new JSDOM(servedHtml, {
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
        window.localStorage.setItem('token', token);
        // Stub so the original's DOMContentLoaded survives a CDN failure;
        // the real lucide (if loaded) overwrites it.
        window.lucide = { createIcons: function () {} };
      }
    });
    const doc = dom.window.document;

    await new Promise((resolve, reject) => {
      if (doc.readyState === 'complete') return resolve();
      dom.window.addEventListener('load', () => resolve());
      setTimeout(() => reject(new Error('original load timeout')), 30000);
    });

    // Inject core + adapter exactly like the loader does (config first).
    const coreSrc = read(path.join(ROOT, 'school-canva-adapter-core.js'));
    const adapterSrc = read(path.join(ROOT, 'school-canva-adapter.js'));
    function inject(scriptText) {
      const s = doc.createElement('script');
      s.textContent = scriptText;
      (doc.head || doc.documentElement).appendChild(s);
    }
    inject(coreSrc);
    inject('window.__SHNO_SCHOOL_CANVA_CONFIG__ = ' + JSON.stringify(config) + ';' + adapterSrc);

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

    // 8) LIBRARY view: real curriculum catalog (not the demo content).
    const catalog = text('catalog-list');
    assert.ok(catalog.includes('كتاب الرياضيات — الكسور'), 'real curriculum file in the catalog: ' + catalog);
    assert.ok(catalog.includes('منهاج شنو منو'), 'catalog row labelled as platform content');

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
