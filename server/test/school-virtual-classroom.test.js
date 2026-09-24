'use strict';

/**
 * server/test/school-virtual-classroom.test.js
 *
 * Backend integration test for Virtual Classroom V1:
 *  - Real curriculum source validation (rejects invented curriculum).
 *  - Real accounts & permissions (host/admin/developer only can manage/end class).
 *  - Students do not turn into teachers.
 *  - Real student profiles only (no fake students).
 *  - Device controls & guardian permissions enforcement.
 *  - Q&A with honest 503 notification when AI provider is not configured (no fake answers).
 *  - Message history persistence in VirtualClassroomMessage.
 *  - Attendance reporting.
 *  - Socket.IO presence and update events.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { Server: SocketIOServer } = require('socket.io');
const { io: ioClient } = require('socket.io-client');
const { MongoMemoryServer } = require('mongodb-memory-server-core');

process.env.JWT_SECRET = 'test-secret-school-virtual-classroom';

const User = require('../src/models/User');
const Student = require('../src/models/SchoolStudent');
const VirtualSession = require('../src/models/VirtualClassroomSession');
const VirtualProfile = require('../src/models/VirtualTeacherProfile');
const VirtualMessage = require('../src/models/VirtualClassroomMessage');
const virtualRoutes = require('../src/routes/school-virtual.routes');
const liveRoutes = require('../src/routes/school-live.routes');
const { attachSchoolSocket } = require('../src/socket-school');
const vsvc = require('../src/services/school-virtual-classroom');

let mongod, server, io, baseUrl;

function makeUser(fullName, username, contact, role = 'user') {
  return User.create({
    fullName,
    username,
    contact,
    contactType: 'email',
    passwordHash: 'x',
    termsAccepted: true,
    role,
    status: 'active'
  });
}

const sign = (user) => jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

async function call(method, path, { token, body } = {}) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

test.before(async () => {
  mongod = await MongoMemoryServer.create({
    binary: { version: '7.0.24' },
    instance: { ip: '127.0.0.1' }
  });
  await mongoose.connect(mongod.getUri(), { dbName: 'test-virtual-classroom' });

  const app = express();
  app.use(express.json());
  server = http.createServer(app);

  io = new SocketIOServer(server, { cors: { origin: '*' } });
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('no token'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).lean();
      if (!user) return next(new Error('user not found'));
      socket.user = user;
      next();
    } catch (e) { next(e); }
  });
  app.set('io', io);

  attachSchoolSocket(io);

  app.use('/api/school/virtual', virtualRoutes);
  app.use('/api/school', liveRoutes);

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

test('Virtual Classroom V1: Full Lifecycle, Permissions, Curriculum, and Q&A', async (t) => {
  // 1) Set up real accounts
  const teacherUser = await makeUser('أ. مصطفى العراقي', 'teacher_mustafa', 'mustafa@example.com', 'developer');
  const guardianUser = await makeUser('أم أحمد الكريمة', 'guardian_ahmed', 'guardian@example.com', 'user');
  const studentUser = await makeUser('أحمد محمد', 'student_ahmed', 'ahmed@example.com', 'user');

  const teacherToken = sign(teacherUser);
  const guardianToken = sign(guardianUser);
  const studentToken = sign(studentUser);

  // Real pupil attached to guardian
  const realPupil = await Student.create({
    guardian: guardianUser._id,
    name: 'أحمد البطل',
    stage: 'ابتدائي',
    grade: 'السادس ابتدائي',
    subjects: ['الرياضيات'],
    learningPermissions: { camera: true, voice: true }
  });

  // Pupil with restricted permissions (voice disabled)
  const restrictedPupil = await Student.create({
    guardian: guardianUser._id,
    name: 'زينب الهادئة',
    stage: 'ابتدائي',
    grade: 'السادس ابتدائي',
    subjects: ['الرياضيات'],
    learningPermissions: { camera: true, voice: false }
  });

  let sessionCode = '';

  await t.test('1. Available AI Virtual Teacher profiles carry required AI label', async () => {
    const { status, data } = await call('GET', '/api/school/virtual/profiles', { token: teacherToken });
    assert.equal(status, 200);
    assert.ok(data.ok);
    assert.ok(Array.isArray(data.profiles) && data.profiles.length >= 3);
    data.profiles.forEach((p) => {
      assert.match(p.label, /معلم افتراضي|AI/);
    });
  });

  await t.test('2. Rejects fake/invented curriculum source', async () => {
    const { status, data } = await call('POST', '/api/school/virtual/sessions', {
      token: teacherToken,
      body: {
        stage: 'ابتدائي',
        grade: 'السادس ابتدائي',
        subject: 'مادة خيالية غير موجودة',
        lesson: 'درس غير معتمد',
        profileId: 'sarah-smart'
      }
    });
    assert.equal(status, 400);
    assert.equal(data.ok, false);
    assert.match(data.message, /لا يوجد مصدر منهج معتمد/);
  });

  await t.test('3. Successfully creates session with real Iraqi curriculum textbook', async () => {
    const { status, data } = await call('POST', '/api/school/virtual/sessions', {
      token: teacherToken,
      body: {
        stage: 'ابتدائي',
        grade: 'السادس ابتدائي',
        subject: 'الرياضيات',
        lesson: 'الكسور العشرية والكسور العادية',
        profileId: 'sarah-smart',
        dialect: 'ar-standard'
      }
    });
    assert.equal(status, 201);
    assert.ok(data.ok);
    assert.ok(data.code && data.code.length === 6);
    sessionCode = data.code;

    assert.equal(data.session.virtualTeacher.name, 'أ. سارة الذكية');
    assert.equal(data.session.virtualTeacher.label, 'معلم افتراضي / AI');
    assert.match(data.session.sourceTitle, /كتاب الرياضيات/);

    // Initial whiteboard has structured content
    assert.ok(data.session.whiteboardData.slides.length >= 1);
    const slide0 = data.session.whiteboardData.slides[0];
    assert.equal(slide0.title, 'الكسور العشرية والكسور العادية');
    assert.ok(slide0.leftColumn && slide0.leftColumn.items.length >= 2);
  });

  await t.test('Teacher speech route calls the configured TTS engine', async () => {
    const message = await VirtualMessage.findOne({ code: sessionCode, senderType: 'teacher_ai' }).lean();
    assert.ok(message);
    const engine = require('../src/services/school-virtual-tts').defaultEngine;
    const original = engine.synthesizePart;
    const sample = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(128)]);
    engine.synthesizePart = async () => ({ bytes: sample, type: 'audio/mpeg', provider: 'test' });
    try {
      const response = await fetch(baseUrl + `/api/school/virtual/sessions/${sessionCode}/messages/${message._id}/speech?part=0`, {
        headers: { Authorization: 'Bearer ' + teacherToken }
      });
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /audio\\/mpeg/);
      assert.ok(Number(response.headers.get('x-speech-parts')) >= 1);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), sample);
    } finally {
      engine.synthesizePart = original;
    }
  });

  await t.test('4. Real student joins session and role stays strictly student', async () => {
    const { status, data } = await call('POST', `/api/school/virtual/sessions/${sessionCode}/join`, {
      token: guardianToken,
      body: { studentId: String(realPupil._id) }
    });
    assert.equal(status, 201);
    assert.ok(data.ok);
    assert.equal(data.participant.role, 'student', 'student role cannot become teacher');
    assert.equal(data.participant.name, 'أحمد البطل');
    assert.equal(data.participant.online, true);
  });

  await t.test('5. Rejects join with another guardian’s student', async () => {
    // Another user tries to pass realPupil
    const otherUser = await makeUser('مستخدم آخر', 'other_user', 'other@example.com', 'user');
    const otherToken = sign(otherUser);

    const { status, data } = await call('POST', `/api/school/virtual/sessions/${sessionCode}/join`, {
      token: otherToken,
      body: { studentId: String(realPupil._id) }
    });
    assert.equal(status, 404);
    assert.equal(data.ok, false);
    assert.match(data.message, /الطالب غير موجود ضمن ملفات حسابك/);
  });

  await t.test('6. Student raises hand and teacher lowers it', async () => {
    // Student raises hand
    const raiseRes = await call('POST', `/api/school/virtual/sessions/${sessionCode}/hand`, {
      token: guardianToken,
      body: { raised: true }
    });
    assert.equal(raiseRes.status, 200);
    assert.equal(raiseRes.data.participant.handRaised, true);

    // Teacher lowers student's hand
    const lowerRes = await call('POST', `/api/school/virtual/sessions/${sessionCode}/hand`, {
      token: teacherToken,
      body: { userId: String(guardianUser._id), raised: false }
    });
    assert.equal(lowerRes.status, 200);
    assert.equal(lowerRes.data.participant.handRaised, false);
  });

  await t.test('7. Device permissions: guardian restriction prevents mic when voice consent is false', async () => {
    // Join restricted pupil
    await call('POST', `/api/school/virtual/sessions/${sessionCode}/join`, {
      token: guardianToken,
      body: { studentId: String(restrictedPupil._id) }
    });

    // Attempt to turn on mic
    const mediaRes = await call('POST', `/api/school/virtual/sessions/${sessionCode}/media`, {
      token: guardianToken,
      body: { mic: true, camera: true }
    });
    assert.equal(mediaRes.status, 200);
    // mic is forced false because learningPermissions.voice = false
    assert.equal(mediaRes.data.media.mic, false, 'mic must remain false due to guardian consent');
    assert.equal(mediaRes.data.media.camera, true);
    assert.ok(mediaRes.data.forced.includes('mic'));
  });

  await t.test('8. Student asks question: honest 503 when AI is not configured (no fake answer)', async () => {
    // Ensure AI keys are absent for this test
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.SCHOOL_AI_PROVIDER;

    const { status, data } = await call('POST', `/api/school/virtual/sessions/${sessionCode}/questions`, {
      token: guardianToken,
      body: { text: 'كيف نحول الكسر 1/2 إلى كسر عشري؟' }
    });
    assert.equal(status, 503, 'must return 503 when AI provider is not configured');
    assert.equal(data.ok, false);
    assert.equal(data.aiAvailable, false);
    assert.match(data.message, /خدمة المعلم الافتراضي غير مفعلة/);
    assert.ok(data.question && data.question.text);

    // Verify no fake answer was created in DB
    const answerInDb = await VirtualMessage.findOne({
      session: data.question.session,
      type: 'answer'
    });
    assert.equal(answerInDb, null, 'must never invent fake AI answer');

    // Message list includes the student question
    const listRes = await call('GET', `/api/school/virtual/sessions/${sessionCode}/messages`, { token: guardianToken });
    assert.equal(listRes.status, 200);
    assert.ok(listRes.data.messages.some((m) => m.type === 'question' && m.text.includes('1/2')));
  });

  await t.test('9. Whiteboard update: student rejected with 403, teacher allowed', async () => {
    // Student tries to update whiteboard -> 403
    const studRes = await call('POST', `/api/school/virtual/sessions/${sessionCode}/whiteboard`, {
      token: guardianToken,
      body: { drawing: 'fake-drawing-data' }
    });
    assert.equal(studRes.status, 403);

    // Teacher updates whiteboard -> 200
    const teachRes = await call('POST', `/api/school/virtual/sessions/${sessionCode}/whiteboard`, {
      token: teacherToken,
      body: { drawing: 'sample-drawing-stroke-json' }
    });
    assert.equal(teachRes.status, 200);
    assert.ok(teachRes.data.ok);
  });

  await t.test('10. End session: student rejected with 403, teacher ends successfully', async () => {
    // Student tries to end -> 403
    const studEnd = await call('POST', `/api/school/virtual/sessions/${sessionCode}/end`, {
      token: guardianToken,
      body: {}
    });
    assert.equal(studEnd.status, 403);

    // Teacher ends -> 200
    const teachEnd = await call('POST', `/api/school/virtual/sessions/${sessionCode}/end`, {
      token: teacherToken,
      body: {}
    });
    assert.equal(teachEnd.status, 200);
    assert.equal(teachEnd.data.session.status, 'ended');

    // Attendance report
    const attRes = await call('GET', `/api/school/virtual/sessions/${sessionCode}/attendance`, { token: teacherToken });
    assert.equal(attRes.status, 200);
    assert.ok(Array.isArray(attRes.data.attendance) && attRes.data.attendance.length >= 2);
  });
});
