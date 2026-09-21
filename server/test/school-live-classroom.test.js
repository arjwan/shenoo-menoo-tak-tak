'use strict';

// REAL CLASSROOM V1 — end-to-end backend test on the real models, the real
// requireAuth middleware and the real Socket.IO handlers (JWT middleware
// mirrors server/src/socket.js). In-memory MongoDB; no demo data: every
// participant is a real User document created by the test itself.
//
// Covers (task list): teacher creates session, student joins, unauthorized
// join rejected, signaling room isolation, raise hand, mute, leave, kick,
// end session, disconnect cleanup.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { Server: SocketIOServer } = require('socket.io');
const { io: ioClient } = require('socket.io-client');
const { MongoMemoryServer } = require('mongodb-memory-server-core');

process.env.JWT_SECRET = 'test-secret-school-live-classroom';
delete process.env.SCHOOL_TURN_URIS;

const User = require('../src/models/User');
const Student = require('../src/models/SchoolStudent');
const Classroom = require('../src/models/SchoolClassroom');
const liveRoutes = require('../src/routes/school-live.routes');
const { attachSchoolSocket } = require('../src/socket-school');
const live = require('../src/services/school-live-classroom');

let mongod, server, io, baseUrl;

function makeUser(fullName, username, contact) {
  return User.create({ fullName, username, contact, contactType: 'email', passwordHash: 'x', termsAccepted: true, status: 'active' });
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

function connect(token) {
  return ioClient(baseUrl, { transports: ['websocket'], auth: { token }, reconnection: false, timeout: 4000 });
}
function connected(socket) {
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve('connected'));
    socket.once('connect_error', (e) => reject(new Error('connect_error: ' + e.message)));
  });
}
function rejected(socket) {
  return new Promise((resolve) => {
    socket.once('connect', () => resolve('connected'));
    socket.once('connect_error', () => resolve('rejected'));
    setTimeout(() => resolve('timeout'), 4000);
  });
}
function waitFor(socket, event, predicate, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(event, handler); reject(new Error(`timeout waiting for ${event}`)); }, timeoutMs);
    function handler(data) {
      if (predicate && !predicate(data)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(data);
    }
    socket.on(event, handler);
  });
}
function notReceived(socket, event, ms = 400) {
  return new Promise((resolve) => {
    let got = null;
    const handler = (data) => { got = data; };
    socket.on(event, handler);
    setTimeout(() => { socket.off(event, handler); resolve(got); }, ms);
  });
}
function acked(socket, event, payload, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`ack timeout for ${event}`)), timeoutMs);
    socket.emit(event, payload, (res) => { clearTimeout(timer); resolve(res); });
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('real classroom v1: REST + Socket.IO lifecycle on real accounts', { timeout: 180000 }, async (t) => {
  mongod = await MongoMemoryServer.create({ instance: { args: ['--wiredTigerCacheSizeGB', '0.25'] } });
  await mongoose.connect(mongod.getUri('shno-school-live-test'));

  const teacher = await makeUser('أستاذ حسن علي', 'teacher-hasan', 'hasan@example.com');
  const guardian = await makeUser('أبو زياد', 'guardian-ziad', 'ziad@example.com');
  const sara = await makeUser('سارة محمد', 'sara-m', 'sara@example.com');
  const eve = await makeUser('حساب غريب', 'eve-x', 'eve@example.com');
  const ziad = await Student.create({ guardian: guardian._id, name: 'زياد كريم', stage: 'ابتدائي', grade: 'الأول ابتدائي', subjects: ['القراءة'], learningPermissions: { camera: true, voice: false } });
  const otherGradePupil = await Student.create({ guardian: guardian._id, name: 'ليان كريم', stage: 'متوسط', grade: 'الأول متوسط', subjects: ['الرياضيات'] });
  const evesPupil = await Student.create({ guardian: eve._id, name: 'طالب حساب آخر', stage: 'ابتدائي', grade: 'الأول ابتدائي' });
  const tok = { teacher: sign(teacher), guardian: sign(guardian), sara: sign(sara), eve: sign(eve) };

  const app = express();
  app.use(express.json());
  app.use('/api/school', liveRoutes);
  server = http.createServer(app);
  io = new SocketIOServer(server, { serveClient: false });
  io.use(async (socket, next) => {
    try {
      const token = (socket.handshake.auth && socket.handshake.auth.token) || '';
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.userId);
      if (!user || user.status !== 'active') return next(new Error('unauthorized'));
      socket.user = user;
      next();
    } catch (e) { next(new Error('unauthorized')); }
  });
  app.set('io', io);
  attachSchoolSocket(io);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const sockets = [];
  const open = (token) => { const s = connect(token); sockets.push(s); return s; };

  try {
    // ---- create --------------------------------------------------------
    assert.equal((await call('POST', '/api/school/classrooms', { body: { stage: 'ابتدائي', grade: 'الأول ابتدائي', subject: 'القراءة' } })).status, 401, 'anonymous cannot create');
    const bad = await call('POST', '/api/school/classrooms', { token: tok.teacher, body: { stage: 'ابتدائي', grade: 'الصف الوهمي', subject: 'القراءة', lesson: 'x' } });
    assert.equal(bad.status, 400, 'grade must be a real catalogue grade');
    const created = await call('POST', '/api/school/classrooms', { token: tok.teacher, body: { stage: 'ابتدائي', grade: 'الأول ابتدائي', subject: 'القراءة', lesson: 'الوحدة الأولى: الحروف' } });
    assert.equal(created.status, 201, JSON.stringify(created.data));
    const code = created.data.classroom.code;
    assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/, 'real 6-char code without look-alikes');
    assert.equal(created.data.room, `live:${created.data.classroom.id}`);
    assert.equal(created.data.classroom.status, 'live');
    assert.equal(created.data.classroom.teacherName, 'أستاذ حسن علي');
    assert.equal(created.data.classroom.participants.length, 1, 'teacher is the only participant at creation — no fake students');
    assert.equal(created.data.classroom.presentCount, 0);
    assert.deepEqual(created.data.iceServers[0], { urls: 'stun:stun.l.google.com:19302' });
    const again = await call('POST', '/api/school/classrooms', { token: tok.teacher, body: { stage: 'ابتدائي', grade: 'الأول ابتدائي', subject: 'القراءة' } });
    assert.equal(again.status, 409, 'one live classroom per teacher');
    assert.equal(again.data.classroom.code, code);

    const listed = await call('GET', '/api/school/classrooms/live?stage=ابتدائي&grade=الأول ابتدائي', { token: tok.guardian });
    assert.equal(listed.status, 200);
    assert.equal(listed.data.classrooms.length, 1);
    assert.equal(listed.data.classrooms[0].code, code);
    assert.equal(listed.data.classrooms[0].participants, undefined, 'roster is not public');
    const other = await call('GET', '/api/school/classrooms/live?stage=متوسط', { token: tok.guardian });
    assert.equal(other.data.classrooms.length, 0);

    // ---- join: authorization ------------------------------------------
    assert.equal((await call('POST', `/api/school/classrooms/${code}/join`, { body: {} })).status, 401, 'anonymous join rejected');
    assert.equal((await call('POST', '/api/school/classrooms/ZZZZ99/join', { token: tok.guardian, body: {} })).status, 404, 'unknown code');
    const notMine = await call('POST', `/api/school/classrooms/${code}/join`, { token: tok.guardian, body: { studentId: String(evesPupil._id) } });
    assert.equal(notMine.status, 403, 'cannot attend as somebody else\'s pupil');
    const wrongGrade = await call('POST', `/api/school/classrooms/${code}/join`, { token: tok.guardian, body: { studentId: String(otherGradePupil._id) } });
    assert.equal(wrongGrade.status, 409, 'pupil of another grade cannot join this grade\'s classroom');
    const peek = await call('GET', `/api/school/classrooms/${code}`, { token: tok.eve });
    assert.equal(peek.status, 200);
    assert.equal(peek.data.classroom.participants, undefined, 'non-members do not see the roster');
    assert.equal(peek.data.room, undefined);

    // ---- join: real pupil and real account ------------------------------
    const joinZiad = await call('POST', `/api/school/classrooms/${code}/join`, { token: tok.guardian, body: { studentId: String(ziad._id) } });
    assert.equal(joinZiad.status, 201, JSON.stringify(joinZiad.data));
    assert.equal(joinZiad.data.role, 'student');
    assert.equal(joinZiad.data.you.name, 'زياد كريم', 'real pupil name from the guardian\'s SchoolStudent');
    assert.deepEqual(joinZiad.data.you.permissions, { camera: true, voice: false }, 'guardian consent copied from learningPermissions');
    assert.deepEqual(joinZiad.data.you.media, { camera: false, mic: false }, 'devices start OFF');
    const joinSara = await call('POST', `/api/school/classrooms/${code}/join`, { token: tok.sara, body: {} });
    assert.equal(joinSara.status, 201);
    assert.equal(joinSara.data.you.name, 'سارة محمد');
    assert.deepEqual(joinSara.data.you.permissions, { camera: true, voice: true });
    assert.equal(joinSara.data.classroom.presentCount, 2);
    const mine = await call('GET', '/api/school/classrooms/mine', { token: tok.sara });
    assert.equal(mine.data.attending.code, code);
    assert.equal(mine.data.hosting, null);
    const teacherMine = await call('GET', '/api/school/classrooms/mine', { token: tok.teacher });
    assert.equal(teacherMine.data.hosting.code, code);

    // ---- sockets: auth + presence --------------------------------------
    assert.equal(await rejected(open('not-a-jwt')), 'rejected', 'invalid JWT never connects');
    const sT = open(tok.teacher); const sG = open(tok.guardian); const sS = open(tok.sara); const sE = open(tok.eve);
    await Promise.all([sT, sG, sS, sE].map(connected));

    const eveJoin = await acked(sE, 'school:classroom:join', { code });
    assert.equal(eveJoin.ok, false, 'a non-participant cannot enter the signaling room');
    assert.equal(eveJoin.status, 403);

    const tJoin = await acked(sT, 'school:classroom:join', { code });
    assert.equal(tJoin.ok, true, JSON.stringify(tJoin));
    assert.equal(tJoin.you.role, 'teacher');
    assert.equal(tJoin.room, `live:${created.data.classroom.id}`);
    assert.ok(Array.isArray(tJoin.iceServers) && tJoin.iceServers.length >= 1);

    const peerPromise = waitFor(sT, 'school:classroom:peer', (p) => p.online === true && p.userId === String(guardian._id));
    const gJoin = await acked(sG, 'school:classroom:join', { code });
    assert.equal(gJoin.ok, true);
    const peer = await peerPromise;
    assert.equal(peer.name, 'زياد كريم', 'teacher learns the real pupil name');
    assert.equal(peer.role, 'student');
    const sJoin = await acked(sS, 'school:classroom:join', { code });
    assert.equal(sJoin.ok, true);
    assert.equal(sJoin.classroom.onlineCount, 2);
    assert.equal(sJoin.classroom.teacherOnline, true);

    // ---- signaling: star topology + room isolation ----------------------
    const s2s = await acked(sG, 'school:classroom:signal', { code, to: String(sara._id), type: 'offer', data: { sdp: 'x' } });
    assert.equal(s2s.ok, false, 'student<->student signaling is rejected');
    const eveSignal = await acked(sE, 'school:classroom:signal', { code, to: String(teacher._id), type: 'offer', data: { sdp: 'x' } });
    assert.equal(eveSignal.ok, false, 'outsider cannot signal into the room');
    const saraGot = notReceived(sS, 'school:classroom:signal');
    const eveGot = notReceived(sE, 'school:classroom:signal');
    const gSignal = waitFor(sG, 'school:classroom:signal');
    const t2g = await acked(sT, 'school:classroom:signal', { code, to: String(guardian._id), type: 'offer', data: { type: 'offer', sdp: 'v=0 teacher' } });
    assert.equal(t2g.ok, true, JSON.stringify(t2g));
    assert.equal(t2g.delivered, 1);
    const offer = await gSignal;
    assert.equal(offer.from, String(teacher._id));
    assert.equal(offer.type, 'offer');
    assert.equal(offer.data.sdp, 'v=0 teacher');
    assert.equal(await saraGot, null, 'signal delivered only to its target');
    assert.equal(await eveGot, null);
    const tGot = waitFor(sT, 'school:classroom:signal', (m) => m.type === 'answer');
    const g2t = await acked(sG, 'school:classroom:signal', { code, to: String(teacher._id), type: 'answer', data: { type: 'answer', sdp: 'v=0 ziad' } });
    assert.equal(g2t.ok, true);
    assert.equal((await tGot).from, String(guardian._id));
    const badType = await acked(sT, 'school:classroom:signal', { code, to: String(guardian._id), type: 'bye', data: {} });
    assert.equal(badType.ok, false, 'unknown signal types are dropped');

    // Second classroom hosted by eve: names/rooms are isolated per code.
    const eveRoom = await call('POST', '/api/school/classrooms', { token: tok.eve, body: { stage: 'ابتدائي', grade: 'الأول ابتدائي', subject: 'الرياضيات' } });
    assert.equal(eveRoom.status, 201);
    const codeB = eveRoom.data.classroom.code;
    assert.notEqual(codeB, code);
    const eB = await acked(sE, 'school:classroom:join', { code: codeB });
    assert.equal(eB.ok, true);
    const cross = await acked(sT, 'school:classroom:signal', { code: codeB, to: String(guardian._id), type: 'ice', data: { candidate: 'x' } });
    assert.equal(cross.ok, false, 'a member of classroom A cannot signal through classroom B');
    const crossB = await acked(sE, 'school:classroom:signal', { code: codeB, to: String(guardian._id), type: 'offer', data: { sdp: 'x' } });
    assert.equal(crossB.ok, false, 'host of B cannot reach a student of A');
    const gCross = await acked(sG, 'school:classroom:join', { code: codeB });
    assert.equal(gCross.ok, false, 'joining B requires a REST join of B first');

    // ---- media state: server can only force OFF -------------------------
    const gMedia = await acked(sG, 'school:classroom:media', { code, camera: true, mic: true });
    assert.equal(gMedia.ok, true);
    assert.deepEqual(gMedia.media, { camera: true, mic: false }, 'no voice consent for زياد -> mic forced off');
    assert.deepEqual(gMedia.forced, ['mic']);
    const sMedia = await acked(sS, 'school:classroom:media', { code, camera: false, mic: true });
    assert.deepEqual(sMedia.media, { camera: false, mic: true });
    const eMedia = await acked(sE, 'school:classroom:media', { code, camera: true, mic: true });
    assert.equal(eMedia.ok, false, 'outsider cannot report media into the room');

    // ---- raise hand -----------------------------------------------------
    const handEvt = waitFor(sT, 'school:classroom:hand', (h) => h.userId === String(sara._id));
    const hand = await call('POST', `/api/school/classrooms/${code}/hand`, { token: tok.sara, body: { raised: true } });
    assert.equal(hand.status, 200);
    assert.equal(hand.data.participant.handRaised, true);
    assert.equal((await handEvt).raised, true);
    assert.equal(hand.data.classroom.handsRaised, 1);
    const lowerByPeer = await call('POST', `/api/school/classrooms/${code}/hand`, { token: tok.guardian, body: { userId: String(sara._id), raised: false } });
    assert.equal(lowerByPeer.status, 403, 'a student cannot lower another student\'s hand');
    const lowerByTeacher = await call('POST', `/api/school/classrooms/${code}/hand`, { token: tok.teacher, body: { userId: String(sara._id), raised: false } });
    assert.equal(lowerByTeacher.status, 200);
    assert.equal(lowerByTeacher.data.participant.handRaised, false);
    const teacherHand = await call('POST', `/api/school/classrooms/${code}/hand`, { token: tok.teacher, body: { raised: true } });
    assert.equal(teacherHand.status, 400, 'teacher does not raise a hand');

    // ---- mute -----------------------------------------------------------
    const muteByPeer = await call('POST', `/api/school/classrooms/${code}/mute`, { token: tok.guardian, body: { userId: String(sara._id), muted: true } });
    assert.equal(muteByPeer.status, 403);
    const muteEvt = waitFor(sS, 'school:classroom:mute');
    const mute = await call('POST', `/api/school/classrooms/${code}/mute`, { token: tok.teacher, body: { userId: String(sara._id), muted: true } });
    assert.equal(mute.status, 200);
    assert.equal(mute.data.participant.mutedByTeacher, true);
    assert.equal(mute.data.participant.media.mic, false, 'mute forces the mic state off');
    assert.equal((await muteEvt).muted, true);
    const whileMuted = await acked(sS, 'school:classroom:media', { code, camera: false, mic: true });
    assert.deepEqual(whileMuted.media, { camera: false, mic: false });
    assert.deepEqual(whileMuted.forced, ['mic']);
    const unmute = await call('POST', `/api/school/classrooms/${code}/mute`, { token: tok.teacher, body: { userId: String(sara._id), muted: false } });
    assert.equal(unmute.data.participant.mutedByTeacher, false);
    assert.equal(unmute.data.participant.media.mic, false, 'unmute never switches a mic on by itself');

    // ---- leave ----------------------------------------------------------
    const leaveUpdate = waitFor(sT, 'school:classroom:update', (u) => u.classroom.presentCount === 1);
    const leave = await call('POST', `/api/school/classrooms/${code}/leave`, { token: tok.guardian, body: {} });
    assert.equal(leave.status, 200);
    const afterLeave = await leaveUpdate;
    const ziadRow = afterLeave.classroom.participants.find((p) => p.userId === String(guardian._id));
    assert.equal(ziadRow.present, false);
    assert.equal(ziadRow.online, false);
    const staleSignal = await acked(sG, 'school:classroom:signal', { code, to: String(teacher._id), type: 'ice', data: { candidate: 'x' } });
    assert.equal(staleSignal.ok, false, 'a participant who left cannot keep signaling');
    assert.equal((await call('POST', `/api/school/classrooms/${code}/leave`, { token: tok.teacher, body: {} })).status, 400, 'teacher ends instead of leaving');

    // ---- kick -----------------------------------------------------------
    const kickedEvt = waitFor(sS, 'school:classroom:kicked');
    const kickByPeer = await call('POST', `/api/school/classrooms/${code}/kick`, { token: tok.sara, body: { userId: String(guardian._id) } });
    assert.equal(kickByPeer.status, 403);
    const kick = await call('POST', `/api/school/classrooms/${code}/kick`, { token: tok.teacher, body: { userId: String(sara._id) } });
    assert.equal(kick.status, 200);
    assert.equal((await kickedEvt).code, code);
    assert.equal((await call('POST', `/api/school/classrooms/${code}/join`, { token: tok.sara, body: {} })).status, 403, 'kicked account cannot re-join');
    const kickedSocket = await acked(sS, 'school:classroom:join', { code });
    assert.equal(kickedSocket.ok, false);
    const kickedSignal = await acked(sT, 'school:classroom:signal', { code, to: String(sara._id), type: 'offer', data: { sdp: 'x' } });
    assert.equal(kickedSignal.ok, false, 'no signaling to a kicked student');

    // ---- rejoin + disconnect cleanup -----------------------------------
    const rejoin = await call('POST', `/api/school/classrooms/${code}/join`, { token: tok.guardian, body: { studentId: String(ziad._id) } });
    assert.equal(rejoin.status, 200, 'rejoin reopens the same participant record');
    const gJoin2 = await acked(sG, 'school:classroom:join', { code });
    assert.equal(gJoin2.ok, true);
    const offlineEvt = waitFor(sT, 'school:classroom:peer', (p) => p.userId === String(guardian._id) && p.online === false);
    sG.disconnect();
    await offlineEvt;
    await sleep(50);
    const persisted = await Classroom.findOne({ code });
    const ziadDb = live.findParticipant(persisted, guardian._id);
    assert.equal(ziadDb.online, false, 'disconnect persists offline');
    assert.deepEqual({ camera: ziadDb.media.camera, mic: ziadDb.media.mic }, { camera: false, mic: false });
    assert.equal(io.__schoolLivePresence.isMember(live.roomName(persisted), String(guardian._id)), false, 'presence registry cleaned up');
    assert.equal(ziadDb.leftAt, null, 'a dropped connection is not a leave — the pupil may reconnect');

    // ---- end ------------------------------------------------------------
    const endByStudent = await call('POST', `/api/school/classrooms/${code}/end`, { token: tok.sara, body: {} });
    assert.equal(endByStudent.status, 403, 'only the teacher ends the classroom');
    assert.equal((await call('GET', `/api/school/classrooms/${code}/attendance`, { token: tok.guardian })).status, 403);
    const endedEvt = waitFor(sT, 'school:classroom:ended');
    const end = await call('POST', `/api/school/classrooms/${code}/end`, { token: tok.teacher, body: {} });
    assert.equal(end.status, 200);
    assert.equal(end.data.classroom.status, 'ended');
    assert.equal((await endedEvt).code, code);
    const names = end.data.attendance.map((a) => a.name).sort();
    assert.deepEqual(names, ['زياد كريم', 'سارة محمد']);
    const ziadReport = end.data.attendance.find((a) => a.name === 'زياد كريم');
    assert.equal(ziadReport.intervals.length, 2, 'join, leave, rejoin => two real attendance intervals');
    assert.ok(ziadReport.intervals.every((i) => i.leftAt), 'ending closes every open interval');
    const report = await call('GET', `/api/school/classrooms/${code}/attendance`, { token: tok.teacher });
    assert.equal(report.status, 200);
    assert.equal(report.data.status, 'ended');
    assert.equal((await call('POST', `/api/school/classrooms/${code}/join`, { token: tok.guardian, body: { studentId: String(ziad._id) } })).status, 410, 'no joining an ended classroom');
    const afterEnd = await acked(sT, 'school:classroom:join', { code });
    assert.equal(afterEnd.ok, false);
    assert.equal(afterEnd.status, 410);
    const liveNow = await call('GET', '/api/school/classrooms/live', { token: tok.teacher });
    assert.deepEqual(liveNow.data.classrooms.map((c) => c.code), [codeB], 'ended classroom disappears from the live list');
    const createAgain = await call('POST', '/api/school/classrooms', { token: tok.teacher, body: { stage: 'متوسط', grade: 'الأول متوسط', subject: 'الرياضيات', lesson: 'الأعداد النسبية' } });
    assert.equal(createAgain.status, 201, 'teacher may host a new classroom after ending the previous one');
    assert.equal((await call('GET', `/api/school/classrooms/${code}`, { token: tok.eve })).data.classroom.status, 'ended');
  } finally {
    for (const s of sockets) { try { s.disconnect(); } catch (e) { /* ignore */ } }
    await new Promise((resolve) => io.close(() => resolve()));
    await new Promise((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
    await mongod.stop();
  }
});

test('real classroom v1: pure rules (service) — permissions, star signaling, attendance', () => {
  const teacher = { _id: 't1', displayName: 'أستاذ حسن' };
  const guardian = { _id: 'g1', fullName: 'أبو زياد', username: 'ziad' };
  const pupil = { _id: 'st1', name: 'زياد كريم', learningPermissions: { camera: false, voice: false } };
  const classroom = { _id: 'c1', code: 'ABCDEF', teacher: 't1', teacherName: 'أستاذ حسن', stage: 'ابتدائي', grade: 'الأول ابتدائي', subject: 'القراءة', lesson: '', status: 'live', startedAt: new Date('2026-09-21T08:00:00Z'), participants: [live.teacherParticipant(teacher, new Date('2026-09-21T08:00:00Z'))] };

  assert.equal(live.roomName(classroom), 'live:c1');
  assert.match(live.generateCode(), /^[A-HJ-NP-Z2-9]{6}$/);
  assert.equal(live.normalizeCode(' abcdef '), 'ABCDEF');
  assert.equal(live.normalizeCode('../x'), '');

  const t0 = new Date('2026-09-21T08:05:00Z');
  const joined = live.joinParticipant(classroom, { user: guardian, student: pupil, at: t0 });
  assert.equal(joined.ok, true);
  assert.equal(joined.participant.name, 'زياد كريم');
  assert.deepEqual(joined.participant.permissions, { camera: false, voice: false });
  const media = live.setMedia(classroom, 'g1', { camera: true, mic: true });
  assert.deepEqual(media.media, { camera: false, mic: false }, 'no consent -> both forced off');
  assert.deepEqual(media.forced, ['camera', 'mic']);

  const self = { _id: 's1', displayName: 'سارة' };
  live.joinParticipant(classroom, { user: self, student: null, at: t0 });
  assert.equal(live.canSignal(classroom, 't1', 's1', 'offer'), false, 'offline peers cannot be signaled');
  live.setOnline(classroom, 't1', true); live.setOnline(classroom, 's1', true); live.setOnline(classroom, 'g1', true);
  assert.equal(live.canSignal(classroom, 't1', 's1', 'offer'), true);
  assert.equal(live.canSignal(classroom, 's1', 't1', 'answer'), true);
  assert.equal(live.canSignal(classroom, 's1', 'g1', 'ice'), false, 'student<->student never');
  assert.equal(live.canSignal(classroom, 't1', 't1', 'ice'), false);
  assert.equal(live.canSignal(classroom, 't1', 's1', 'hangup'), false);

  assert.equal(live.setHand(classroom, 's1', 's1', true).ok, true);
  assert.equal(live.setHand(classroom, 'g1', 's1', false).status, 403);
  assert.equal(live.setHand(classroom, 't1', 's1', false).ok, true);
  assert.equal(live.setMute(classroom, 's1', 'g1', true).status, 403);
  assert.equal(live.setMute(classroom, 't1', 's1', true).ok, true);
  assert.deepEqual(live.setMedia(classroom, 's1', { mic: true }).media, { camera: false, mic: false });
  assert.equal(live.kickParticipant(classroom, 's1', 'g1', t0).status, 403);
  assert.equal(live.kickParticipant(classroom, 't1', 't1', t0).status, 404, 'teacher cannot kick self');

  const t1 = new Date('2026-09-21T08:20:00Z');
  assert.equal(live.leaveParticipant(classroom, 'g1', t1).ok, true);
  assert.equal(live.canSignal(classroom, 't1', 'g1', 'ice'), false, 'left students drop out of signaling');
  const t2 = new Date('2026-09-21T08:30:00Z');
  assert.equal(live.joinParticipant(classroom, { user: guardian, student: pupil, at: t2 }).rejoined, true);
  assert.equal(live.endClassroom(classroom, 's1').status, 403);
  const t3 = new Date('2026-09-21T08:45:00Z');
  assert.equal(live.endClassroom(classroom, 't1', t3).ok, true);
  assert.equal(classroom.status, 'ended');
  const report = live.attendanceReport(classroom, t3);
  const ziad = report.find((r) => r.name === 'زياد كريم');
  assert.equal(ziad.minutes, 30, '15 + 15 real minutes');
  assert.equal(ziad.intervals.length, 2);
  assert.equal(live.joinParticipant(classroom, { user: self, student: null }).status, 410);
  const pub = live.publicClassroom(classroom, { roster: true });
  assert.equal(pub.presentCount, 0);
  assert.equal(pub.participants.length, 3);
  assert.equal(live.publicClassroom(classroom).participants, undefined);

  const catalog = require('../src/data/iraqi-curriculum-catalog');
  assert.equal(live.validateClassroomInput({ stage: 'ابتدائي', grade: 'الأول ابتدائي', subject: 'القراءة' }, catalog.items).ok, true);
  assert.equal(live.validateClassroomInput({ stage: 'ابتدائي', grade: 'الأول متوسط', subject: 'الرياضيات' }, catalog.items).ok, false, 'grade must belong to the stage');
  assert.equal(live.validateClassroomInput({ stage: 'ابتدائي', grade: 'الأول ابتدائي', subject: 'الفيزياء' }, catalog.items).ok, false, 'subject must be taught in that grade');
  assert.equal(live.validateClassroomInput({ stage: 'جامعي', grade: 'x', subject: 'y' }, catalog.items).ok, false);
});
