'use strict';

// REAL CLASSROOM V1 — DOM end-to-end of the real page code (school-live.html
// + school-live-core.js + school-live.js) in jsdom against the real Express
// routes, real JWT auth, real Socket.IO handlers and real Mongoose models.
// jsdom has no WebRTC/media: RTCPeerConnection, MediaStream and
// navigator.mediaDevices are replaced by tiny fakes that only RECORD what the
// page asked for, which lets us prove the signaling flow (student "ready" ->
// teacher offer -> student answer), the click-only device policy and the
// cleanup on kick / end without any camera or microphone.
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

process.env.JWT_SECRET = 'test-secret-school-live-page';
delete process.env.SCHOOL_TURN_URIS;

const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const User = require('../src/models/User');
const Student = require('../src/models/SchoolStudent');
const Classroom = require('../src/models/SchoolClassroom');
const liveRoutes = require('../src/routes/school-live.routes');
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

const makeUser = (fullName, username, contact) => User.create({ fullName, username, contact, contactType: 'email', passwordHash: 'x', termsAccepted: true, status: 'active' });
const sign = (user) => jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

function installFakes(window, tag) {
  const pcs = [];
  class FakePC {
    constructor(cfg) { this.cfg = cfg; this.tag = tag; this.transceivers = []; this.localDescription = null; this.remoteDescription = null; this.candidates = []; this.connectionState = 'new'; this.closed = false; pcs.push(this); }
    addTransceiver(kind, init) { const t = { kind, direction: (init && init.direction) || 'sendrecv', receiver: { track: { kind } }, sender: { track: null, replaceTrack(track) { this.track = track; return Promise.resolve(); } } }; this.transceivers.push(t); return t; }
    getTransceivers() { return this.transceivers; }
    createOffer() { return Promise.resolve({ type: 'offer', sdp: 'v=0 offer ' + tag }); }
    createAnswer() { return Promise.resolve({ type: 'answer', sdp: 'v=0 answer ' + tag }); }
    setLocalDescription(d) { this.localDescription = d; return Promise.resolve(); }
    setRemoteDescription(d) { this.remoteDescription = d; if (d.type === 'offer' && !this.transceivers.length) { this.addTransceiver('audio', { direction: 'recvonly' }); this.addTransceiver('video', { direction: 'recvonly' }); } return Promise.resolve(); }
    addIceCandidate(c) { this.candidates.push(c); return Promise.resolve(); }
    close() { this.closed = true; this.connectionState = 'closed'; }
  }
  class FakeStream { constructor() { this.tracks = []; } addTrack(t) { this.tracks.push(t); } removeTrack(t) { this.tracks = this.tracks.filter((x) => x !== t); } getTracks() { return this.tracks; } getVideoTracks() { return this.tracks.filter((t) => t.kind === 'video'); } getAudioTracks() { return this.tracks.filter((t) => t.kind === 'audio'); } }
  const media = { calls: [], tracks: [] };
  window.RTCPeerConnection = FakePC;
  window.RTCSessionDescription = function (d) { return d; };
  window.RTCIceCandidate = function (c) { return c; };
  window.MediaStream = FakeStream;
  window.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  window.HTMLMediaElement.prototype.pause = function () {};
  Object.defineProperty(window.navigator, 'mediaDevices', { value: { getUserMedia: async (constraints) => {
    media.calls.push(constraints);
    const s = new FakeStream();
    const kind = constraints.video ? 'video' : 'audio';
    const track = { kind, stopped: false, onended: null, stop() { this.stopped = true; } };
    media.tracks.push(track);
    s.addTrack(track);
    return s;
  } }, configurable: true });
  window.confirm = () => true;
  return { pcs, media };
}

async function bootPage(baseUrl, token, tag) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(String((e && e.message) || e)));
  const html = read('school-live.html').replace(/<script src="[^"]*"><\/script>/g, '');
  const dom = new JSDOM(html, { url: baseUrl + '/school-live.html', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(window) {
      window.fetch = (input, init) => fetch(/^https?:/i.test(String(input)) ? String(input) : new URL(String(input), baseUrl).href, init);
      window.localStorage.setItem('token', token);
    } });
  const { window } = dom;
  const fakes = installFakes(window, tag);
  window.io = (url, opts) => ioClient(url, Object.assign({}, opts, { transports: ['websocket'], reconnection: false }));
  window.eval(read('social-api.js'));
  window.eval(read('school-live-core.js'));
  window.eval(read('school-live.js'));
  const $ = (id) => window.document.getElementById(id);
  const text = (id) => ($(id) || { textContent: '' }).textContent.trim();
  const fire = (el, type) => el.dispatchEvent(new window.Event(type, { bubbles: true, cancelable: true }));
  const choose = (id, value) => { const el = $(id); el.value = value; assert.equal(el.value, value, id + ' accepts ' + value); fire(el, 'change'); };
  const visible = (id) => Boolean($(id)) && !$(id).hidden;
  return { dom, window, errors, fakes, $, text, fire, choose, visible };
}

test('real classroom v1 page: teacher + real pupil end-to-end in the DOM (signaling, devices, hand, mute, kick, end)', { timeout: 180000 }, async () => {
  const mongod = await MongoMemoryServer.create({ instance: { args: ['--wiredTigerCacheSizeGB', '0.25'] } });
  await mongoose.connect(mongod.getUri('shno-school-live-page'));
  const teacher = await makeUser('أستاذ حسن علي', 'teacher-page', 'tp@example.com');
  const guardian = await makeUser('أبو زياد', 'guardian-page', 'gp@example.com');
  const ziad = await Student.create({ guardian: guardian._id, name: 'زياد كريم', stage: 'ابتدائي', grade: 'الأول ابتدائي', subjects: ['القراءة'], learningPermissions: { camera: true, voice: false } });

  const app = express();
  app.use(express.json());
  app.use('/api/school', liveRoutes);
  app.use('/api/school', schoolRoutes);
  const server = http.createServer(app);
  const io = new SocketIOServer(server, { serveClient: false });
  io.use(async (socket, next) => {
    try {
      const payload = jwt.verify((socket.handshake.auth && socket.handshake.auth.token) || '', process.env.JWT_SECRET);
      const user = await User.findById(payload.userId);
      if (!user || user.status !== 'active') return next(new Error('unauthorized'));
      socket.user = user; next();
    } catch (e) { next(new Error('unauthorized')); }
  });
  app.set('io', io);
  attachSchoolSocket(io);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const pages = [];
  try {
    // ---- no token: honest sign-in state, nothing else boots -------------
    const anon = await bootPage(baseUrl, '', 'anon'); pages.push(anon);
    assert.equal(anon.visible('authPanel'), true);
    assert.equal(anon.visible('lobby'), false);
    assert.equal(anon.visible('room'), false);
    assert.ok(anon.window.document.querySelector('#authPanel a[href="signin.html"]'));

    // ---- teacher creates a classroom from the real catalogue --------------
    const T = await bootPage(baseUrl, sign(teacher), 'teacher'); pages.push(T);
    await poll(async () => T.visible('lobby') && T.$('createStage').options.length > 1);
    assert.deepEqual(Array.from(T.$('createStage').options).map((o) => o.value).filter(Boolean), ['ابتدائي', 'متوسط', 'إعدادي']);
    assert.equal(T.$('createGrade').disabled, true);
    T.choose('createStage', 'ابتدائي');
    assert.ok(Array.from(T.$('createGrade').options).some((o) => o.value === 'الأول ابتدائي'), 'real grades of the stage');
    T.choose('createGrade', 'الأول ابتدائي');
    assert.ok(Array.from(T.$('createSubject').options).some((o) => o.value === 'القراءة'), 'real subjects of the grade');
    T.choose('createSubject', 'القراءة');
    T.$('createLesson').value = 'الوحدة الأولى: الحروف';
    await poll(async () => /لا توجد حصص مباشرة الآن/.test(T.text('liveList')));
    assert.match(T.text('liveList'), /لا توجد حصص مباشرة الآن/, 'honest empty list before any classroom exists');
    T.fire(T.$('createForm'), 'submit');
    await poll(async () => T.visible('room') && /^[A-Z2-9]{6}$/.test(T.text('roomCode')));
    const code = T.text('roomCode');
    assert.equal(T.visible('teacherPanel'), true);
    assert.equal(T.visible('endBtn'), true);
    assert.equal(T.visible('handBtn'), false, 'teacher has no hand button');
    assert.equal(T.visible('leaveBtn'), false, 'teacher ends instead of leaving');
    assert.match(T.text('roomTitle'), /القراءة — الأول ابتدائي \(ابتدائي\) · الوحدة الأولى: الحروف/);
    assert.equal(T.text('selfName'), 'أستاذ حسن علي (المعلم)');
    assert.equal(T.visible('gridEmpty'), true);
    assert.match(T.text('gridEmpty'), /لا يوجد طلاب حاضرون بعد — شارك الرمز/);
    await poll(async () => /لا يوجد طلاب حاضرون بعد — شارك رمز الحصة/.test(T.text('roomStatus')), { timeoutMs: 10000 });
    assert.equal(T.visible('cameraIndicator'), false, 'camera OFF on entry');
    assert.equal(T.fakes.media.calls.length, 0, 'no getUserMedia without a click');
    assert.equal(T.window.location.search, '?code=' + code);
    assert.equal((await Classroom.findOne({ code })).participants.length, 1, 'only the teacher — no seeded students');

    // ---- guardian joins as the REAL pupil ------------------------------
    const S = await bootPage(baseUrl, sign(guardian), 'student'); pages.push(S);
    await poll(async () => S.visible('lobby') && S.$('joinAs').options.length >= 2);
    const pupilOption = Array.from(S.$('joinAs').options).find((o) => o.value === String(ziad._id));
    assert.ok(pupilOption && /زياد كريم — الأول ابتدائي/.test(pupilOption.textContent), 'real pupil offered by name');
    assert.equal(Array.from(S.$('joinAs').options).filter((o) => o.value).length, 1, 'exactly the real pupils of the account');
    S.choose('joinAs', String(ziad._id));
    const joinButton = await poll(async () => S.window.document.querySelector('#liveList [data-join="' + code + '"]'));
    assert.match(S.text('liveList'), /أستاذ حسن علي/);
    joinButton.click();
    await poll(async () => S.visible('room'));
    assert.equal(S.text('selfName'), 'زياد كريم', 'the pupil name, not the guardian account');
    assert.equal(S.visible('handBtn'), true);
    assert.equal(S.visible('leaveBtn'), true);
    assert.equal(S.visible('endBtn'), false);
    assert.equal(S.visible('teacherPanel'), false);
    assert.equal(S.$('camBtn').disabled, false, 'camera consented by the guardian');
    assert.equal(S.$('micBtn').disabled, true, 'voice not consented -> mic button disabled');
    assert.match(S.text('controlHint'), /ولي الأمر لم يفعّل الصوت/);
    assert.match(S.text('teacherName'), /أستاذ حسن علي/);
    await poll(async () => /زياد كريم/.test(T.text('studentGrid')) && /🟢 متصل/.test(T.text('studentGrid')));
    assert.equal(T.visible('gridEmpty'), false);
    assert.match(T.text('roomCount'), /الحاضرون 1 · متصل 1/);

    // ---- signaling through the page code: ready -> offer -> answer ------
    await poll(async () => T.fakes.pcs.length >= 1 && T.fakes.pcs[T.fakes.pcs.length - 1].remoteDescription && T.fakes.pcs[T.fakes.pcs.length - 1].remoteDescription.type === 'answer');
    const tpc = T.fakes.pcs[T.fakes.pcs.length - 1];
    assert.deepEqual(tpc.transceivers.map((t) => t.kind + ':' + t.direction), ['audio:sendrecv', 'video:sendrecv'], 'teacher created both transceivers up front');
    assert.equal(tpc.localDescription.type, 'offer');
    assert.match(tpc.remoteDescription.sdp, /answer student/);
    assert.deepEqual(tpc.cfg.iceServers[0], { urls: 'stun:stun.l.google.com:19302' }, 'ICE servers from the server config');
    const spc = await poll(async () => S.fakes.pcs.find((pc) => pc.remoteDescription && pc.remoteDescription.type === 'offer'));
    assert.match(spc.remoteDescription.sdp, /offer teacher/);
    assert.equal(spc.localDescription.type, 'answer');
    assert.ok(spc.transceivers.every((t) => t.direction === 'sendrecv'), 'student answers sendrecv so replaceTrack works later');
    assert.equal(S.fakes.media.calls.length, 0, 'still no device access without a click');

    // ---- hand -------------------------------------------------------------
    S.$('handBtn').click();
    await poll(async () => /رافع يده/.test(T.text('studentGrid')));
    assert.match(S.text('handBtn'), /إنزال اليد/);

    // ---- teacher mutes -> the pupil's mic button is locked --------------
    const tile = T.window.document.querySelector('#studentGrid figure[data-user="' + String(guardian._id) + '"]');
    assert.ok(tile, 'tile keyed by the real account id');
    assert.equal(tile.querySelector('.name').textContent, 'زياد كريم');
    tile.querySelector('[data-act="mute"]').click();
    await poll(async () => /مكتوم/.test(tile.textContent));
    assert.equal(tile.querySelector('[data-act="mute"]').textContent, 'رفع الكتم');
    assert.equal(tile.querySelector('video').muted, true, 'teacher-side playback muted too');

    // ---- camera: click -> permission prompt -> indicator -> track -----
    S.$('camBtn').click();
    await poll(async () => S.visible('cameraIndicator'));
    assert.equal(S.fakes.media.calls.length, 1);
    assert.equal(S.fakes.media.calls[0].audio, false, 'camera click never asks for the microphone');
    assert.match(S.text('cameraIndicator'), /الكاميرا تعمل/);
    assert.equal(spc.transceivers.find((t) => t.kind === 'video').sender.track, S.fakes.media.tracks[0], 'track attached by replaceTrack (no renegotiation)');
    await poll(async () => /📷/.test(tile.textContent), { timeoutMs: 10000 });
    S.$('camBtn').click();
    await poll(async () => !S.visible('cameraIndicator'));
    assert.equal(S.fakes.media.tracks[0].stopped, true, 'camera track really stopped');
    assert.equal(spc.transceivers.find((t) => t.kind === 'video').sender.track, null);

    // ---- kick: pupil page returns to the lobby, teacher grid empties ----
    tile.querySelector('[data-act="kick"]').click();
    await poll(async () => S.visible('lobby') && /أخرجك المعلم من الحصة/.test(S.text('liveMessage')));
    assert.ok(spc.closed, 'pupil peer connection closed on kick');
    await poll(async () => T.visible('gridEmpty'));
    assert.ok(tpc.closed, 'teacher closed the peer of the kicked pupil');
    const afterKick = await Classroom.findOne({ code }).lean();
    assert.equal(afterKick.participants.find((p) => p.role === 'student').kicked, true);

    // ---- end: teacher back to lobby, classroom ended -------------------
    T.$('endBtn').click();
    await poll(async () => T.visible('lobby'));
    assert.match(T.text('liveMessage'), /انتهت الحصة/);
    assert.equal((await Classroom.findOne({ code })).status, 'ended');
    assert.equal(T.window.location.search, '');
    const uncaught = [...T.errors, ...S.errors, ...anon.errors].filter((e) => /Uncaught/.test(e));
    assert.deepEqual(uncaught, [], 'no uncaught page errors: ' + [...T.errors, ...S.errors].join(' | '));
  } finally {
    for (const p of pages) { try { p.window.dispatchEvent(new p.window.Event('pagehide')); } catch (e) { /* ignore */ } }
    await new Promise((resolve) => io.close(() => resolve()));
    await new Promise((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
    await mongod.stop();
  }
});
