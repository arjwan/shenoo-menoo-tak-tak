'use strict';

// End-to-end REST runtime test for the school Canva adapter surface.
// Real Express routers + real JWT auth middleware + real Mongoose models on
// an in-memory MongoDB (mongodb-memory-server-core). Proves:
//   - /health public, /classroom/config authenticated (JWT, no new login)
//   - /operations maps Canva records to real Student/Session/Scores/
//     learningPermissions/Knowledge documents
//   - clientOpId idempotency: retries after reconnect never duplicate work
//   - the shared SchoolSyncOperation store also de-duplicates against
//     POST /api/school/sync (the existing offline sync endpoint)
//   - user isolation: two guardians with the same clientOpId stay separate
//   - invalid records fail soft (400 + failed op recorded, item stays queued)

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server-core');

process.env.JWT_SECRET = 'test-secret-school-canva-runtime';

const User = require('../src/models/User');
const Student = require('../src/models/SchoolStudent');
const Session = require('../src/models/SchoolSession');
const Knowledge = require('../src/models/SchoolKnowledgeSource');
const SyncOperation = require('../src/models/SchoolSyncOperation');
const schoolCanvaRoutes = require('../src/routes/school-canva.routes');
const schoolSyncRoutes = require('../src/routes/school-sync.routes');
const schoolRoutes = require('../src/routes/school.routes');

let mongod, server, app, baseUrl;
const tokens = {};

function makeUser(fullName, username, contact) {
  return User.create({ fullName, username, contact, contactType: 'email', passwordHash: 'x', termsAccepted: true, status: 'active' });
}

function sign(user) {
  return jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

async function call(method, path, { token, body, headers } = {}) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(headers || {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

test('school canva REST: full runtime lifecycle on real models', { timeout: 120000 }, async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('shno-school-canva-test'));
  const alice = await makeUser('أبو ليان', 'guardian-a', 'a@example.com');
  const bob = await makeUser('أبو كريم', 'guardian-b', 'b@example.com');
  tokens.a = sign(alice);
  tokens.b = sign(bob);

  app = express();
  app.use(express.json());
  // Same mount order as server.js.
  app.use('/api/school', schoolCanvaRoutes);
  app.use('/api/school', schoolSyncRoutes);
  app.use('/api/school', schoolRoutes);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    // 1) Health is public (the original's healthCheck sends no auth header).
    const health = await call('GET', '/api/school/health');
    assert.equal(health.status, 200);
    assert.equal(health.data.ok, true);
    assert.equal(health.data.mode, 'real');

    // 2) Classroom config requires the existing Shenoo Menoo JWT (no new login).
    const noAuth = await call('GET', '/api/school/classroom/config');
    assert.equal(noAuth.status, 401);
    const config = await call('GET', '/api/school/classroom/config', { token: tokens.a });
    assert.equal(config.status, 200);
    assert.equal(config.data.restApiUrl, '/api/school');
    assert.equal(config.data.websocketUrl, 'shno-school://classroom');
    assert.equal(config.data.stunUrl, 'stun:stun.l.google.com:19302');
    assert.deepEqual(config.data.turnServers, [], 'TURN must be empty unless the server env configures it');

    // TURN becomes available only through server environment.
    process.env.SCHOOL_TURN_URIS = 'turn:turn.example:3478';
    process.env.SCHOOL_TURN_USERNAME = 'canva-turn';
    process.env.SCHOOL_TURN_CREDENTIAL = 'turn-only-value';
    const configTurn = await call('GET', '/api/school/classroom/config', { token: tokens.a });
    assert.deepEqual(configTurn.data.turnServers, [{ urls: 'turn:turn.example:3478', username: 'canva-turn', credential: 'turn-only-value' }]);
    delete process.env.SCHOOL_TURN_URIS;
    delete process.env.SCHOOL_TURN_USERNAME;
    delete process.env.SCHOOL_TURN_CREDENTIAL;

    // 3) Exam record -> real student + score + completed session.
    const examRecord = {
      student_name: 'ليان أحمد', stage: 'ابتدائي', grade: 'الأول ابتدائي',
      subject: 'الرياضيات', answer_type: 'اختبار', score: 8, max_score: 10,
      question_text: 'أكمل: I ___ a student.', answer_text: 'am', grade_approved: false
    };
    const first = await call('POST', '/api/school/operations', {
      token: tokens.a, body: examRecord, headers: { 'Idempotency-Key': 'op-exam-1' }
    });
    assert.equal(first.status, 200);
    assert.equal(first.data.isOk, true);
    assert.equal(first.data.duplicate, false);
    const studentId = first.data.result.studentId;
    assert.ok(studentId);

    let student = await Student.findById(studentId);
    assert.equal(student.name, 'ليان أحمد');
    assert.equal(student.guardian.toString(), alice._id.toString());
    assert.equal(student.scores.length, 1);
    assert.equal(student.scores[0].score, 8);
    assert.equal(student.progress.answered, 1);
    let sessions = await Session.find({ student: student._id });
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].status, 'completed');
    assert.equal(sessions[0].score, 8);

    // 4) Retry with the SAME clientOpId (e.g. after reconnect): idempotent,
    //    nothing duplicated.
    const retry = await call('POST', '/api/school/operations', {
      token: tokens.a, body: examRecord, headers: { 'Idempotency-Key': 'op-exam-1' }
    });
    assert.equal(retry.status, 200);
    assert.equal(retry.data.duplicate, true);
    student = await Student.findById(studentId);
    assert.equal(student.scores.length, 1, 'no duplicate score after retry');
    assert.equal(await Student.countDocuments({ guardian: alice._id }), 1, 'no duplicate student after retry');
    assert.equal(await Session.countDocuments({ student: student._id }), 1, 'no duplicate session after retry');
    assert.equal(await SyncOperation.countDocuments({ guardian: alice._id, clientOpId: 'op-exam-1' }), 1);

    // 5) Consent record -> real guardian learningPermissions on the student.
    const consent = await call('POST', '/api/school/operations', {
      token: tokens.a,
      body: {
        student_name: 'ليان أحمد', stage: 'ابتدائي', grade: 'الأول ابتدائي',
        answer_type: 'موافقة ولي الأمر', camera_consent: 'موافق عليه', mic_consent: 'مرفوض'
      },
      headers: { 'Idempotency-Key': 'op-consent-1' }
    });
    assert.equal(consent.status, 200);
    student = await Student.findById(studentId);
    assert.equal(student.learningPermissions.camera, true);
    assert.equal(student.learningPermissions.voice, false);

    // 6) Cross-endpoint duplicate protection: the existing offline sync
    //    endpoint (/api/school/sync) shares the op store, so the same
    //    clientOpId coming from the old school page is de-duplicated too.
    const cross = await call('POST', '/api/school/sync', {
      token: tokens.a,
      body: { operations: [{ clientOpId: 'op-exam-1', type: 'student.create', payload: { name: 'ليان أحمد', stage: 'ابتدائي', grade: 'الأول ابتدائي' } }] }
    });
    assert.equal(cross.status, 200);
    assert.equal(cross.data.ok, true);
    assert.equal(cross.data.results[0].duplicate, true, 'same clientOpId via /sync must not apply twice');
    assert.equal(await Student.countDocuments({ guardian: alice._id }), 1);

    // 7) A NEW op through the legacy endpoint still works (no regression).
    const legacy = await call('POST', '/api/school/sync', {
      token: tokens.a,
      body: { operations: [{ clientOpId: 'op-legacy-1', type: 'student.create', payload: { name: 'نور', stage: 'متوسط', grade: 'الأول متوسط' } }] }
    });
    assert.equal(legacy.status, 200);
    assert.equal(legacy.data.results[0].ok, true);
    assert.equal(await Student.countDocuments({ guardian: alice._id }), 2);

    // 8) User isolation: guardian B using the same clientOpId gets their own
    //    scope — no cross-guardian leak, no interference with A's data.
    const bobSame = await call('POST', '/api/school/operations', {
      token: tokens.b, body: examRecord, headers: { 'Idempotency-Key': 'op-exam-1' }
    });
    assert.equal(bobSame.status, 200);
    assert.equal(bobSame.data.duplicate, false, 'op scope is per guardian');
    assert.notEqual(bobSame.data.result.studentId, studentId);
    const bobStudent = await Student.findById(bobSame.data.result.studentId);
    assert.equal(bobStudent.guardian.toString(), bob._id.toString());
    assert.equal(await Student.countDocuments({ guardian: alice._id }), 2, 'guardian A untouched by guardian B');
    // B cannot read A's students through the real REST endpoint.
    const bobList = await call('GET', '/api/school/students', { token: tokens.b });
    assert.equal(bobList.status, 200);
    assert.equal(bobList.data.students.length, 1);
    assert.equal(bobList.data.students[0].name, 'ليان أحمد');

    // 9) The real /api/school/students endpoint reflects the synced state
    //    (permissions included) — the old school page sees the same data.
    const aliceList = await call('GET', '/api/school/students', { token: tokens.a });
    assert.equal(aliceList.data.students.length, 2);
    const lian = aliceList.data.students.find((s) => s.name === 'ليان أحمد');
    assert.equal(lian.learningPermissions.camera, true);

    // 10) Curriculum record -> real (unverified) knowledge source.
    const curriculum = await call('POST', '/api/school/operations', {
      token: tokens.a,
      body: {
        student_name: 'ليان أحمد', stage: 'ابتدائي', grade: 'الأول ابتدائي',
        answer_type: 'ملف منهج', curriculum_file_name: 'الرياضيات-الوحدة1.pdf',
        curriculum_subject: 'الرياضيات', curriculum_chapter: 'الوحدة 1'
      },
      headers: { 'Idempotency-Key': 'op-cur-1' }
    });
    assert.equal(curriculum.status, 200);
    assert.equal(await Knowledge.countDocuments({ uploadedBy: alice._id, title: 'الرياضيات-الوحدة1.pdf' }), 1);

    // 11) Invalid record (missing stage) -> 400, failed op recorded, the
    //     client keeps the item in its queue (demo fallback semantics).
    const invalid = await call('POST', '/api/school/operations', {
      token: tokens.a,
      body: { student_name: 'ليان أحمد', stage: '', grade: 'الأول ابتدائي', answer_type: 'اختبار', score: 5 },
      headers: { 'Idempotency-Key': 'op-bad-1' }
    });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.data.isOk, false);
    const failedOp = await SyncOperation.findOne({ guardian: alice._id, clientOpId: 'op-bad-1' });
    assert.equal(failedOp.status, 'failed');
    // A retried invalid op stays failed without side effects.
    const invalidRetry = await call('POST', '/api/school/operations', {
      token: tokens.a,
      body: { student_name: 'ليان أحمد', stage: '', grade: 'الأول ابتدائي', answer_type: 'اختبار', score: 5 },
      headers: { 'Idempotency-Key': 'op-bad-1' }
    });
    assert.equal(invalidRetry.data.duplicate, true);
    assert.equal(invalidRetry.data.status, 'failed');

    // 12) Missing Idempotency-Key is rejected (queue integrity).
    const noKey = await call('POST', '/api/school/operations', { token: tokens.a, body: examRecord });
    assert.equal(noKey.status, 400);
  } finally {
    // undici (global fetch) holds keep-alive sockets; close them explicitly
    // or server.close() never completes and the test process hangs.
    try { if (server.closeAllConnections) server.closeAllConnections(); } catch (e) {}
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongod.stop();
  }
});
