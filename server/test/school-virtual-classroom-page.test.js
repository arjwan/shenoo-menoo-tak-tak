'use strict';

/**
 * server/test/school-virtual-classroom-page.test.js
 *
 * DOM end-to-end test of school-virtual-classroom.html + school-virtual-classroom.js
 * in jsdom against real Express routes, real JWT auth, and real Mongoose models.
 *
 * Covers:
 *  - Real curriculum cascade in lobby (stage -> grade -> subject -> lesson).
 *  - Classroom creation with AI persona ("معلم افتراضي / AI") and real textbook source.
 *  - Interactive whiteboard: structured layout, canvas, zoom, pagination.
 *  - Device privacy & consent: mic/camera OFF by default, getUserMedia ONLY on click.
 *  - Honest empty states when students or messages are absent.
 *  - Q&A flow: honest 503 banner when AI provider is not configured (no fake answers).
 *  - Host ending the session cleanly.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const http = require('http');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { Server: SocketIOServer } = require('socket.io');
const { io: ioClient } = require('socket.io-client');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const { JSDOM, VirtualConsole } = require('jsdom');

process.env.JWT_SECRET = 'test-secret-school-virtual-classroom-page';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const User = require('../src/models/User');
const Student = require('../src/models/SchoolStudent');
const virtualRoutes = require('../src/routes/school-virtual.routes');
const schoolRoutes = require('../src/routes/school.routes');
const { attachSchoolSocket } = require('../src/socket-school');

async function poll(fn, { timeoutMs = 15000, everyMs = 100 } = {}) {
  const start = Date.now();
  for (;;) {
    const out = await fn();
    if (out) return out;
    if (Date.now() - start > timeoutMs) throw new Error('poll timeout: ' + fn.toString().slice(0, 140));
    await new Promise((r) => setTimeout(r, everyMs));
  }
}

const makeUser = (fullName, username, contact, role = 'user') =>
  User.create({ fullName, username, contact, contactType: 'email', passwordHash: 'x', termsAccepted: true, role, status: 'active' });
const sign = (user) => jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

function installMediaFakes(window) {
  class FakeStream {
    constructor() { this.tracks = []; }
    addTrack(t) { this.tracks.push(t); }
    removeTrack(t) { this.tracks = this.tracks.filter((x) => x !== t); }
    getTracks() { return this.tracks; }
    getVideoTracks() { return this.tracks.filter((t) => t.kind === 'video'); }
    getAudioTracks() { return this.tracks.filter((t) => t.kind === 'audio'); }
  }

  const media = { calls: [], tracks: [] };
  window.MediaStream = FakeStream;
  if (!window.HTMLMediaElement.prototype.play) {
    window.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  }

  Object.defineProperty(window.navigator, 'mediaDevices', {
    value: {
      getUserMedia: async (constraints) => {
        media.calls.push(constraints);
        const s = new FakeStream();
        const kind = constraints.video ? 'video' : 'audio';
        const track = { kind, stopped: false, stop() { this.stopped = true; } };
        media.tracks.push(track);
        s.addTrack(track);
        return s;
      }
    },
    configurable: true
  });

  return media;
}

async function bootPage(baseUrl, token) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(String((e && e.message) || e)));

  const html = read('school-virtual-classroom.html').replace(/<script src="[^"]*"><\/script>/g, '');
  const dom = new JSDOM(html, {
    url: baseUrl + '/school-virtual-classroom.html',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      window.fetch = (input, init) =>
        fetch(/^https?:/i.test(String(input)) ? String(input) : new URL(String(input), baseUrl).href, init);
      window.localStorage.setItem('token', token);
    }
  });

  const { window } = dom;
  const mediaFakes = installMediaFakes(window);
  window.io = (url, opts) => {
    if (typeof url === 'object' && !opts) { opts = url; url = baseUrl; }
    return ioClient(url || baseUrl, Object.assign({}, opts, { transports: ['websocket'], reconnection: false }));
  };

  window.eval(read('social-api.js'));
  window.eval(read('school-virtual-teacher-core.js'));
  window.eval(read('school-virtual-classroom.js'));

  const $ = (id) => window.document.getElementById(id);
  const text = (id) => ($(id) || { textContent: '' }).textContent.trim();
  const fire = (el, type) => el.dispatchEvent(new window.Event(type, { bubbles: true, cancelable: true }));
  const choose = (id, value) => {
    const el = $(id);
    el.value = value;
    fire(el, 'change');
  };
  const visible = (id) => Boolean($(id)) && !$(id).hidden;

  return { dom, window, errors, mediaFakes, $, text, fire, choose, visible };
}

test('Virtual Classroom V1 Page: DOM End-to-End', { timeout: 120000 }, async () => {
  const mongod = await MongoMemoryServer.create({
    binary: { version: '7.0.24' },
    instance: { ip: '127.0.0.1' }
  });
  await mongoose.connect(mongod.getUri('shno-virtual-classroom-page'));

  const teacher = await makeUser('أستاذ رافد', 'teacher-page-vc', 'rafid@example.com', 'developer');
  const guardian = await makeUser('أم علي', 'guardian-page-vc', 'um_ali@example.com', 'user');
  const pupil = await Student.create({
    guardian: guardian._id,
    name: 'علي رافد',
    stage: 'ابتدائي',
    grade: 'السادس ابتدائي',
    subjects: ['الرياضيات'],
    learningPermissions: { camera: true, voice: true }
  });

  const app = express();
  app.use(express.json());
  app.use('/api/school/virtual', virtualRoutes);
  app.use('/api/school', schoolRoutes);

  const server = http.createServer(app);
  const io = new SocketIOServer(server, { serveClient: false });
  io.use(async (socket, next) => {
    try {
      const payload = jwt.verify((socket.handshake.auth && socket.handshake.auth.token) || '', process.env.JWT_SECRET);
      const user = await User.findById(payload.userId);
      if (!user || user.status !== 'active') return next(new Error('unauthorized'));
      socket.user = user;
      next();
    } catch (e) { next(new Error('unauthorized')); }
  });
  app.set('io', io);
  attachSchoolSocket(io);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const page = await bootPage(baseUrl, sign(teacher));

    // 1) Lobby is visible on initial load without code
    await poll(() => page.visible('virtualLobby'));
    assert.equal(page.visible('virtualRoom'), false);

    // 2) Real catalog cascade populates Stage -> Grade -> Subject
    await poll(() => page.$('createStage').options.length > 1);
    page.choose('createStage', 'ابتدائي');

    await poll(() => page.$('createGrade').options.length > 1);
    // Find grade with السادس
    const gradeOpt = Array.from(page.$('createGrade').options).find((o) => o.value.includes('السادس'));
    assert.ok(gradeOpt, 'السادس ابتدائي exists in cascade');
    page.choose('createGrade', gradeOpt.value);

    await poll(() => page.$('createSubject').options.length > 1);
    const subOpt = Array.from(page.$('createSubject').options).find((o) => o.value === 'الرياضيات');
    assert.ok(subOpt, 'الرياضيات exists in cascade');
    page.choose('createSubject', subOpt.value);

    page.$('createLesson').value = 'الكسور العشرية والكسور العادية';

    // 3) Submit creation form -> transitions to active room
    page.fire(page.$('createVirtualForm'), 'submit');

    await poll(() => page.visible('virtualRoom'));
    assert.equal(page.visible('virtualLobby'), false);

    // 4) Metadata and Virtual Teacher persona verified in DOM
    assert.match(page.text('metaLesson'), /الكسور العشرية والكسور العادية/);
    assert.match(page.text('metaSubject'), /الرياضيات/);
    assert.match(page.text('metaSource'), /كتاب الرياضيات/);

    assert.equal(page.text('teacherDisplayName'), 'ست زهراء');
    assert.ok(page.window.document.querySelector('.teacher-ai-badge').textContent.includes('معلم افتراضي / AI'));

    // 5) Whiteboard verified in DOM
    assert.equal(page.text('boardLessonTitle'), 'الكسور العشرية والكسور العادية');
    assert.ok(page.$('whiteboardCanvas'));
    assert.equal(page.text('slideIndicator'), '1 / 1');
    assert.equal(page.text('zoomLabel'), '100%');

    // Zoom in
    page.fire(page.$('zoomInBtn'), 'click');
    assert.equal(page.text('zoomLabel'), '115%');

    // 6) Honest empty state for participants initially
    assert.equal(page.visible('studentsEmptyState'), true);
    assert.equal(page.text('studentsEmptyState'), 'لا يوجد طلاب مسجلون أو حاضرون في هذا الصف بعد');

    // 7) Device privacy: Camera & Mic are OFF at entry
    assert.equal(page.mediaFakes.calls.length, 0, 'no getUserMedia on page load');
    assert.equal(page.visible('localVideoContainer'), false, 'local video preview hidden');

    // Clicking mic button calls getUserMedia({ audio: true })
    page.fire(page.$('micBtn'), 'click');
    await poll(() => page.mediaFakes.calls.length === 1);
    assert.equal(Boolean(page.mediaFakes.calls[0].audio), true);
    assert.equal(page.text('micLabel'), 'إيقاف المايك');

    // Clicking camera button calls getUserMedia({ video: true })
    page.fire(page.$('camBtn'), 'click');
    await poll(() => page.mediaFakes.calls.length === 2);
    assert.equal(Boolean(page.mediaFakes.calls[1].video), true);
    assert.equal(page.text('camLabel'), 'إيقاف الكاميرا');
    assert.equal(page.visible('localVideoContainer'), true, 'local preview container visible');

    // Stopping camera
    page.fire(page.$('camBtn'), 'click');
    assert.equal(page.visible('localVideoContainer'), false);
    assert.equal(page.text('camLabel'), 'تشغيل الكاميرا');

    // Stopping mic
    page.fire(page.$('micBtn'), 'click');
    assert.equal(page.text('micLabel'), 'تشغيل المايك');

    // 8) Switch to chat tab & Q&A
    page.fire(page.$('tabBtnChat'), 'click');
    await poll(() => page.window.document.querySelector('.chat-bubble.teacher-msg'));
    assert.match(page.text('chatMessagesBox'), /سارة الذكية|أهلاً بكم/);

    page.$('questionInput').value = 'ما الفرق بين الكسر العشري والدوري؟';
    page.fire(page.$('questionForm'), 'submit');

    // AI is unconfigured -> banner shown honestly, question displayed, no simulated fake answer
    await poll(() => page.visible('aiUnavailableBanner'));
    assert.match(page.text('aiUnavailableBanner'), /خدمة المعلم الافتراضي غير مفعلة/);
    assert.ok(page.window.document.querySelector('.chat-bubble.student-msg'));

    // 9) Host ends session
    await poll(() => page.visible('endClassBtn'));
    // Stub confirm dialog
    page.window.confirm = () => true;
    page.fire(page.$('endClassBtn'), 'click');

    // Returns to lobby
    await poll(() => page.visible('virtualLobby'));
    assert.equal(page.visible('virtualRoom'), false);

  } finally {
    try { page.window.dispatchEvent(new page.window.Event('pagehide')); } catch (e) {}
    try {
      if (io && io.sockets && io.sockets.sockets) {
        for (const s of io.sockets.sockets.values()) s.disconnect(true);
      }
    } catch (e) {}
    await new Promise((resolve) => io.close(() => resolve()));
    await new Promise((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
    await mongod.stop();
  }
});
