'use strict';

// Live contract against the real Express mounts + in-memory MongoDB:
// dashboard/structure/books/reader/classroom options+actions, and the honesty
// rule that catalogue rows without file.url are NOT "available".

const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server-core');

process.env.JWT_SECRET = 'test-secret-school-classroom-contract';

const User = require('../server/src/models/User');
const Student = require('../server/src/models/SchoolStudent');
const Knowledge = require('../server/src/models/SchoolKnowledgeSource');
const schoolRoutes = require('../server/src/routes/school.routes');
const schoolCanvaRoutes = require('../server/src/routes/school-canva.routes');
const schoolClassroomRoutes = require('../server/src/routes/school-classroom.routes');
const catalog = require('../server/src/data/iraqi-curriculum-catalog');

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { args: ['--wiredTigerCacheSizeGB', '0.25'] } });
  let server;
  try {
    await mongoose.connect(mongod.getUri('school-classroom-contract'));
    const guardian = await User.create({
      fullName: 'ولي أمر الاختبار', username: 'school-guardian', contact: 'school-g@example.com',
      contactType: 'email', passwordHash: 'x', termsAccepted: true, status: 'active'
    });
    const token = jwt.sign({ userId: guardian._id, role: guardian.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const student = await Student.create({
      guardian: guardian._id, name: 'زياد', stage: 'ابتدائي', grade: 'الأول ابتدائي',
      section: 'أ', subjects: ['الرياضيات'], parentApproved: true
    });
    const verified = await Knowledge.create({
      title: 'كتاب رياضيات تجريبي موثّق', sourceType: 'official_textbook',
      stage: 'ابتدائي', grade: 'الأول ابتدائي', subject: 'الرياضيات',
      content: 'محتوى درس حقيقي', verified: true, uploadedBy: guardian._id,
      file: { url: '/uploads/school-curriculum/demo-math.pdf', originalName: 'demo-math.pdf', mimeType: 'application/pdf', size: 2048 },
      sourceUrl: '/uploads/school-curriculum/demo-math.pdf'
    });

    const app = express();
    app.use(express.json());
    app.use('/api/school', schoolCanvaRoutes);
    app.use('/api/school-canva', schoolCanvaRoutes);
    app.use('/api/school', schoolRoutes);
    app.use('/api/school', schoolClassroomRoutes);
    server = app.listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const api = (p, opts = {}) => fetch(base + p, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
        ...(opts.headers || {})
      }
    });

    // dashboard
    const dash = await (await api('/api/school/dashboard')).json();
    assert.equal(dash.ok, true);
    assert.equal(dash.stats.students, 1);
    assert.equal(dash.stats.catalogBooks, catalog.items.length);
    assert.ok(dash.stats.availablePdfs === 0 || Number.isFinite(dash.stats.availablePdfs));

    // structure
    const structure = await (await api('/api/school/structure')).json();
    assert.equal(structure.ok, true);
    assert.ok(structure.tree.length >= 3, 'three stages');
    assert.ok(structure.totalBooks >= 100);

    // books: verified knowledge is available; bare catalogue rows are not
    const books = await (await api('/api/school/books')).json();
    assert.equal(books.ok, true);
    assert.ok(books.total >= 1);
    const available = books.items.filter((x) => x.availability === 'available' && x.file && x.file.url);
    assert.ok(available.some((x) => String(x.id) === String(verified._id)), 'verified upload is available');
    const pendingCat = books.items.filter((x) => String(x.id || '').startsWith('iq-'));
    assert.ok(pendingCat.length > 0, 'catalogue rows present');
    assert.ok(pendingCat.every((x) => x.availability !== 'available' || (x.file && x.file.url)),
      'catalogue rows must not pretend to be loaded without a file url');

    // reader: verified book is readable
    const reader = await (await api('/api/school/books/' + verified._id + '/reader')).json();
    assert.equal(reader.ok, true);
    assert.equal(reader.readable, true);
    assert.equal(reader.book.file.url, '/uploads/school-curriculum/demo-math.pdf');

    // reader: bare catalogue id is not readable
    const catId = catalog.items[0].id;
    const catReader = await (await api('/api/school/books/' + encodeURIComponent(catId) + '/reader')).json();
    assert.equal(catReader.ok, true);
    assert.equal(catReader.readable, false, 'catalogue-only row is not readable');
    assert.ok(['source_pending', 'verified_metadata', 'remote_ok'].includes(catReader.book.availability));

    // classroom options + start/end
    const opts = await (await api('/api/school/classroom/options')).json();
    assert.equal(opts.ok, true);
    assert.equal(opts.students.length, 1);
    assert.ok((opts.stages || []).includes('ابتدائي'));

    const started = await (await api('/api/school/classroom/actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'start', studentId: student._id, subject: 'الرياضيات', lesson: 'الكسور' })
    })).json();
    assert.equal(started.ok, true, 'start classroom');
    assert.equal(started.session.subject, 'الرياضيات');
    assert.equal(started.studyLocked, true);

    const ended = await (await api('/api/school/classroom/actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'end', sessionId: started.session._id })
    })).json();
    assert.equal(ended.ok, true);
    assert.equal(ended.studyLocked, false);

    // latest export is served
    const latest = await fetch(base + '/api/school-canva/latest');
    assert.equal(latest.status, 200);
    const latestHtml = await latest.text();
    assert.ok(latestHtml.includes('id="library-search"'));

    console.log('PASS: api-school-classroom-contract');
  } finally {
    if (server) await new Promise((r) => server.close(() => r()));
    try { await mongoose.disconnect(); } catch (e) {}
    try {
      await Promise.race([
        mongod.stop({ doCleanup: true, force: true }),
        new Promise((r) => setTimeout(r, 2000))
      ]);
    } catch (e) {}
  }
}

main().catch((e) => { console.error('FAIL:', e); process.exit(1); });
