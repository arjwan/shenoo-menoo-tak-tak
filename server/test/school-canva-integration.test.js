'use strict';

// School Canva original integration — contract + logic + live socket tests.
// Runs without MongoDB (node --test server/test/*.test.js):
//   - immutable original verified by SHA-256
//   - existing school pages and Kahwa Azzawi assets pinned (unchanged)
//   - static contracts for loader/adapter/core/server wiring
//   - pure-logic tests for the classroom registry, record mapper and core
//   - live Socket.IO round-trip (auth, join/leave, isolation, webrtc relay,
//     reconnect idempotency) against an in-memory user registry

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { Server: SocketIOServer } = require('socket.io');
const { io: ioClient } = require('socket.io-client');

const root = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex');

const APPROVED_ORIGINAL_SHA = '0c8b92caace910cc272f98d921ee4a736c2c87cf84d8fe75324361d3d24e6857';

// Files that must stay byte-identical after this integration.
const FROZEN = {
  'original-assets/school-canva/school-canva-original.html': APPROVED_ORIGINAL_SHA,
  'canva-originals/cards/index.html': 'ddf7152d6ee8d2a2005cd9215dd2a73910851c267fbd29a1af54959db9657e4e',
  'original-assets/chess/chess-original.html': 'eb1d70b28431467dbcf2d176f17a18bcd35ba8f9e04902f27e480b0693022609',
  'school.html': '5f9d40b5022d10c38131194f1882b718610b77e2a47152b109a333d9b6516d61',
  'school.js': '3550b0a79fc91af4b484aba7794356278e7ad33365ab04bc9d649493e3c64752',
  'school-offline-ai.js': '96f6d6a32248bd6b099fa2a1dfd551f6d5b7f12e6fba9627e768549c946884db',
  'school-integration.js': 'be4f5467cedabdfb873edc86f4dcb0b033746915878aaab05b3acbe251eeebda',
  'kahwa-cards-canva.js': '78bcc85d4a6593b6a0282f7772d5120e9c5b397d99a86a768b1fdb9fd3e5c62b',
  'kahwa-chess-canva.js': 'bec79dc637b347c526a51170be142d8d7723c80a563ad0f2f208f15db5da88b7',
  'kahwa-tawla-v2.js': 'f48e47a6ef679a0a1092673190b7341dad756199612dc6a4f5129a391d14797f',
  'server/src/routes/school.routes.js': '02ec484ee02ba70df8c8b7c0af71436e07e8b828d6e9e85317a44e34aeef5e22',
  'server/src/routes/school-sync.routes.js': 'e62bea1cb9e939c8ce7046474fa7bcce6d7b96c25ba8bb99c1bddd0dbedf579a',
  'server/src/socket.js': 'cc059537fcc22f462aed34f852cfe30bab4bd147e7be9051e8c6ba84822d9348'
};

const NO_SECRETS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /gh[pousr]_[A-Za-z0-9]{30,}/,
  /sk-[A-Za-z0-9_-]{30,}/,
  /xkeysib-[A-Za-z0-9_-]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /mongodb(?:\+srv)?:\/\/[^\s:/]+:[^\s@/]+@/i,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/
];
const assertNoSecrets = (p) => {
  const content = read(p);
  for (const rule of NO_SECRETS) assert.doesNotMatch(content, rule, `${p} must not contain secrets`);
};

test('school Canva original is byte-identical to the approved SHA-256', () => {
  assert.equal(sha('original-assets/school-canva/school-canva-original.html'), APPROVED_ORIGINAL_SHA);
});

test('existing school pages, Kahwa Azzawi and game originals are untouched', () => {
  for (const [file, expected] of Object.entries(FROZEN)) assert.equal(sha(file), expected, file);
});

test('original exposes the integration hooks the adapter relies on (sanity)', () => {
  const html = read('original-assets/school-canva/school-canva-original.html');
  for (const hook of [
    'configureIntegration', 'window.ExternalAdapter', 'handleSignal',
    'restApiUrl', 'websocketUrl', 'stunUrl', 'turnServers', 'environment',
    'requestTimeoutMs', 'schemaVersion',
    'joinRoom', 'leaveRoom', 'heartbeat', 'iceCandidate', '"offer"', '"answer"',
    'operations', 'health', 'Idempotency-Key', 'dataSdk',
    'موافق عليه', 'getUserMedia',
    'shno-mno-integration', 'shno-mno-integrated-v10',
    'localStorage', 'indexedDB', 'external-event', 'external-media',
    'joinVirtualClass', 'startAudioSession', 'startVideoSession'
  ]) assert.ok(html.includes(hook), `original must contain ${hook}`);
});

test('active school page loads auth before the adapter; legacy loader keeps its iframe contract', () => {
  const loader = read('school-canva.html');
  assert.match(loader, /src="\/?auth-guard\.js/, 'active page loads the auth guard');
  assert.match(loader, /school-canva-adapter-core\.js/);
  assert.match(loader, /school-canva-adapter\.js/);
  assert.ok(loader.indexOf('auth-guard.js') < loader.indexOf('school-canva-adapter-core.js'), 'auth loads before the data bridge');
  assert.ok(loader.indexOf('school-canva-adapter-core.js') < loader.indexOf('school-canva-adapter.js'), 'core loads before adapter');
  if (/frame\.srcdoc\s*=\s*html/.test(loader)) {
    assert.match(loader, /\/api\/school\/classroom\/config/, 'legacy loader fetches authenticated config');
    assert.match(loader, /\/api\/school-canva\/original/, 'legacy loader fetches immutable original');
    assert.match(loader, /\/socket\.io\/socket\.io\.js/, 'legacy loader loads Socket.IO');
  } else {
    assert.match(loader, /window\.ShnoManoIntegrationAdapter\s*\|\|\s*window\.apiClient/, 'active page uses the school API bridge');
  }
  assert.ok(!/token=/.test(loader), 'token must never be placed in a URL');
  assertNoSecrets('school-canva.html');
});

test('adapter keeps secrets out of the frontend and never requests media itself', () => {
  const adapter = read('school-canva-adapter.js');
  assertNoSecrets('school-canva-adapter.js');
  assertNoSecrets('school-canva-adapter-core.js');
  assert.doesNotMatch(adapter, /navigator\.mediaDevices\.getUserMedia/, 'adapter must not call getUserMedia; the original consent-gated buttons are the only media trigger');
  assert.doesNotMatch(adapter, /new WebSocket\(/, 'adapter must not open raw WebSockets; all sockets go through the bridge');
  assert.match(adapter, /auth:\s*\{\s*token:\s*token\(\)\s*\}/, 'JWT goes in the Socket.IO handshake auth, not the URL');
  assert.match(adapter, /localStorage\.getItem\('token'\)/, 'session token comes from the existing Shenoo Menoo storage');
  assert.ok(!/token=/.test(adapter), 'no token in any URL query');
  assert.doesNotMatch(adapter, /credential\s*[:=]\s*['"]/, 'no hard-coded TURN credential');
  assert.match(adapter, /window\.configureIntegration/, 'configures the original through its own hook');
  assert.match(adapter, /window\.dataSdk/, 'dataSdk stub keeps the original sync path alive');
  for (const endpoint of [
    '/api/school/teachers', '/api/school/students', '/api/school/sessions/active',
    '/api/school/schedules', '/api/school/ai/status', '/api/school/teacher/ask'
  ]) assert.ok(adapter.includes(endpoint), `adapter uses real endpoint ${endpoint}`);
  assert.match(adapter, /shno-school:\/\//, 'bridges only the marker websocket URL');
});

test('core is pure (no network, no storage) and secret-free', () => {
  const core = read('school-canva-adapter-core.js');
  assertNoSecrets('school-canva-adapter-core.js');
  assert.doesNotMatch(core, /fetch\(|XMLHttpRequest|window\.io|localStorage|indexedDB/, 'core must stay pure for reuse in Node tests');
});

test('server: canva routes mounted before existing school routers and school socket attached', () => {
  const server = read('server/src/server.js');
  assert.match(server, /schoolCanvaRoutes/);
  assert.match(server, /attachSchoolSocket/);
  const canvaMount = server.indexOf("app.use('/api/school', schoolCanvaRoutes)");
  const syncMount = server.indexOf("app.use('/api/school', schoolSyncRoutes)");
  const schoolMount = server.indexOf("app.use('/api/school', schoolRoutes)");
  assert.ok(canvaMount !== -1 && syncMount !== -1 && schoolMount !== -1);
  assert.ok(canvaMount < syncMount && syncMount < schoolMount, 'canva adapter surface mounts before existing school routes');
  assert.match(server, /attachSchoolSocket\(io\)/);
});

test('server: /health public, /operations and /classroom/config authenticated, idempotent, env-only TURN', () => {
  const route = read('server/src/routes/school-canva.routes.js');
  assertNoSecrets('server/src/routes/school-canva.routes.js');
  const healthLine = route.split('\n').find((l) => l.includes("router.get('/health'"));
  assert.ok(healthLine, 'health route exists');
  assert.doesNotMatch(healthLine, /requireAuth/, 'health must stay public (original healthCheck sends no auth header)');
  const configLine = route.split('\n').find((l) => l.includes("router.get('/classroom/config'"));
  assert.ok(configLine && configLine.includes('requireAuth'), 'classroom config requires auth');
  assert.match(route, /router\.post\('\/operations',\s*requireAuth/, 'operations require auth');
  assert.match(route, /findOne\(\{\s*guardian:\s*req\.user\._id,\s*clientOpId\s*\}\)/, 'idempotency by guardian+clientOpId (same store as /api/school/sync)');
  assert.match(route, /env\.SCHOOL_TURN_URIS/, 'TURN configured from environment');
  assert.doesNotMatch(route, /credential\s*[:=]\s*['"][^'"]+['"]/, 'no hard-coded TURN credential value');
  assert.match(route, /stun:stun\.l\.google\.com:19302/, 'project STUN default');
  assert.match(route, /no-store/, 'original served with no-store so bytes always match the approved file');
  assert.doesNotMatch(route, /req\.body\.userId|payload\.userId|guardian:\s*req\.body/, 'client-sent userId must not decide ownership');
});

test('server: socket-school registers classroom events with membership checks only', () => {
  const sock = read('server/src/socket-school.js');
  for (const event of [
    "socket.on('school:join'", "socket.on('school:leave'", "socket.on('school:heartbeat'",
    "socket.on('school:live'", "socket.on('school:webrtc:offer'",
    "socket.on('school:webrtc:answer'", "socket.on('school:webrtc:ice'",
    "socket.on('disconnect'"
  ]) assert.ok(sock.includes(event), `socket-school must handle ${event}`);
  assert.match(sock, /classrooms\.isMember\(roomId,\s*user\._id\)/, 'relay requires room membership of the authenticated user');
  assert.doesNotMatch(sock, /payload\.userId|payload\?\.userId/, 'server must never trust client-sent user ids');
});

// ---------------------------------------------------------------------------
// Pure logic: classroom registry
// ---------------------------------------------------------------------------
const { createClassroomRegistry } = require('../src/services/school-classroom');
const alice = { _id: 'u-alice', displayName: 'Alice' };
const bob = { _id: 'u-bob', displayName: 'Bob' };
const eve = { _id: 'u-eve', displayName: 'Eve' };

test('classroom registry: join/leave lifecycle with idempotent rejoin', () => {
  const reg = createClassroomRegistry();
  const first = reg.join('room-1', alice, 's1');
  assert.equal(first.ok, true);
  assert.equal(first.joined, true);
  assert.deepEqual(first.participants.map((p) => p.id), ['u-alice']);

  // Second socket of the same user: no duplicate member.
  const second = reg.join('room-1', alice, 's2');
  assert.equal(second.joined, false);
  assert.equal(second.participants.length, 1);
  assert.equal(second.participant.sockets, 2);

  reg.join('room-1', bob, 's3');
  // Reconnect of bob: idempotent, participants stay at 2 (no duplication).
  const rejoin = reg.join('room-1', bob, 's4');
  assert.equal(rejoin.joined, false);
  assert.equal(rejoin.participants.length, 2);

  // Leaving one socket keeps the member (other device still connected).
  const leavePartial = reg.leave('room-1', bob._id, 's3');
  assert.equal(leavePartial.removed, false);
  assert.equal(reg.participants('room-1').length, 2);
  const leaveFull = reg.leave('room-1', bob._id, 's4');
  assert.equal(leaveFull.removed, true);
  assert.equal(reg.participants('room-1').length, 1);

  // Invalid room ids are rejected.
  for (const bad of ['', '   ', 'x', 'room id', 'a b:1', 'a'.repeat(81), 'أحد']) {
    assert.equal(reg.join(bad, alice, 's9').ok, false, `invalid room id accepted: ${JSON.stringify(bad)}`);
  }
  assert.equal(reg.isMember('room-1', eve), false, 'user isolation: eve never in room-1');
});

test('classroom registry: disconnect cleanup and room eviction', () => {
  const reg = createClassroomRegistry();
  reg.join('room-a', alice, 's1');
  reg.join('room-a', bob, 's2');
  reg.join('room-b', bob, 's3');
  const affected = reg.removeSocket(bob._id, 's2');
  assert.deepEqual(affected, ['room-a']);
  assert.equal(reg.participants('room-a').length, 1);
  assert.equal(reg.participants('room-b').length, 1, 'other room of the same user stays until its sockets leave');
  reg.removeSocket(bob._id, 's3');
  assert.equal(reg.roomCount(), 1);
  reg.removeSocket(alice._id, 's1');
  assert.equal(reg.roomCount(), 0, 'empty rooms are evicted');
});

test('classroom registry: live kind allowlist', () => {
  const reg = createClassroomRegistry();
  assert.ok(reg.isLiveKind('raise-hand'));
  assert.ok(reg.isLiveKind('question'));
  assert.equal(reg.isLiveKind('hack'), false);
  assert.equal(reg.isLiveKind(''), false);
});

// ---------------------------------------------------------------------------
// Pure logic: Canva record -> real school operation plan
// ---------------------------------------------------------------------------
const { planRecord, extractClientOpId } = require('../src/lib/school-canva-record');

test('record mapper: exam record produces student + score + completed session', () => {
  const plan = planRecord({
    student_name: 'ليان أحمد', stage: 'ابتدائي', grade: 'الأول ابتدائي',
    subject: 'الرياضيات', answer_type: 'اختبار', score: 8, max_score: 10,
    question_text: 'اكتب: I ___ a student.', answer_text: 'am', grade_approved: false
  });
  assert.equal(plan.ok, true);
  const kinds = plan.actions.map((a) => a.kind);
  assert.deepEqual(kinds, ['student.ensure', 'score', 'session.complete']);
  const score = plan.actions.find((a) => a.kind === 'score');
  assert.equal(score.score, 8);
  assert.equal(score.approved, false);
});

test('record mapper: consent buttons map to real learningPermissions booleans', () => {
  const plan = planRecord({
    student_name: 'ليان', stage: 'متوسط', grade: 'الأول متوسط',
    answer_type: 'موافقة ولي الأمر', camera_consent: 'موافق عليه', mic_consent: 'مرفوض'
  });
  assert.equal(plan.ok, true);
  const consent = plan.actions.find((a) => a.kind === 'consent');
  assert.deepEqual({ camera: consent.camera, voice: consent.voice }, { camera: true, voice: false });
});

test('record mapper: curriculum file, written answer, report notes', () => {
  const cur = planRecord({
    student_name: 'س', stage: 'إعدادي', grade: 'الرابع إعدادي',
    answer_type: 'ملف منهج', curriculum_file_name: 'الفيزياء-الوحدة1.pdf',
    curriculum_subject: 'الفيزياء', curriculum_chapter: 'الوحدة 1'
  });
  assert.equal(cur.ok, true);
  assert.deepEqual(cur.actions.map((a) => a.kind), ['student.ensure', 'knowledge']);

  const ans = planRecord({
    student_name: 'س', stage: 'إعدادي', grade: 'الرابع إعدادي', subject: 'الفيزياء',
    answer_type: 'إجابة كتابية', answer_text: 'الخلية', question_text: 'ما وحدة بناء الكائن الحي؟'
  });
  assert.deepEqual(ans.actions.map((a) => a.kind), ['student.ensure', 'learning.record']);

  const report = planRecord({
    student_name: 'س', stage: 'إعدادي', grade: 'الرابع إعدادي',
    answer_type: 'مسودة تقرير', report_status: 'مسودة'
  });
  assert.deepEqual(report.actions.map((a) => a.kind), ['student.ensure', 'note']);

  const grade = planRecord({
    student_name: 'س', stage: 'إعدادي', grade: 'الرابع إعدادي',
    answer_type: 'اعتماد درجة', score: 9, max_score: 10
  });
  assert.deepEqual(grade.actions.map((a) => a.kind), ['student.ensure', 'note']);
});

test('record mapper: missing stage is rejected (stays in the client queue as failed)', () => {
  const plan = planRecord({ student_name: 'س', stage: '', grade: 'الأول', answer_type: 'اختبار', score: 5 });
  assert.equal(plan.ok, false);
  assert.match(plan.error, /المرحلة/);
  const bad = planRecord(null);
  assert.equal(bad.ok, false);
});

test('record mapper: idempotency key extraction (header first, body fallback)', () => {
  assert.equal(extractClientOpId({ 'Idempotency-Key': 'q-123' }, {}), 'q-123');
  assert.equal(extractClientOpId({ 'idempotency-key': 'q-456' }, {}), 'q-456');
  assert.equal(extractClientOpId({}, { id: 'q-789' }), 'q-789');
  assert.equal(extractClientOpId({}, {}), '');
  assert.equal(extractClientOpId({ 'Idempotency-Key': 'x'.repeat(300) }, {}).length, 160);
});

// ---------------------------------------------------------------------------
// Pure logic: adapter core mappings
// ---------------------------------------------------------------------------
const core = require('../../school-canva-adapter-core.js');

test('core: outbound envelope -> authenticated socket commands', () => {
  assert.deepEqual(core.toSocketCommand({ type: 'joinRoom', payload: { roomId: 'r1' } }), {
    event: 'school:join', args: [{ roomId: 'r1' }]
  });
  assert.deepEqual(core.toSocketCommand({ type: 'leaveRoom', payload: { roomId: 'r1' } }), {
    event: 'school:leave', args: [{ roomId: 'r1' }]
  });
  assert.deepEqual(core.toSocketCommand({ type: 'heartbeat', payload: {} }).event, 'school:heartbeat');
  assert.deepEqual(core.toSocketCommand({ type: 'offer', payload: { roomId: 'r1', offer: { sdp: 'x' } } }), {
    event: 'school:webrtc:offer', args: [{ roomId: 'r1', offer: { sdp: 'x' } }]
  });
  assert.deepEqual(core.toSocketCommand({ type: 'answer', payload: { roomId: 'r1', answer: { sdp: 'y' } } }).event, 'school:webrtc:answer');
  assert.deepEqual(core.toSocketCommand({ type: 'iceCandidate', payload: { roomId: 'r1', candidate: { candidate: 'z' } } }), {
    event: 'school:webrtc:ice', args: [{ roomId: 'r1', candidate: { candidate: 'z' } }]
  });
  assert.equal(core.toSocketCommand({ type: 'unknown-event', payload: {} }), null, 'unknown types stay no-ops');
});

test('core: inbound socket events -> original envelopes (handleSignal contract)', () => {
  assert.deepEqual(core.fromSocketEvent('school:webrtc:offer', { roomId: 'r1', offer: { sdp: 'x' }, from: 'u2' }), {
    type: 'offer', roomId: 'r1', offer: { sdp: 'x' }, from: 'u2'
  });
  assert.deepEqual(core.fromSocketEvent('school:webrtc:answer', { roomId: 'r1', answer: { sdp: 'y' } }), {
    type: 'answer', roomId: 'r1', answer: { sdp: 'y' }, from: ''
  });
  assert.deepEqual(core.fromSocketEvent('school:webrtc:ice', { roomId: 'r1', candidate: { candidate: 'z' } }), {
    type: 'iceCandidate', roomId: 'r1', candidate: { candidate: 'z' }, from: ''
  });
  const participants = core.fromSocketEvent('school:participants', { roomId: 'r1', participants: [{ id: 'u1', name: 'A' }] });
  assert.equal(participants.type, 'participants');
  assert.equal(participants.participants.length, 1);
  assert.equal(core.fromSocketEvent('unrelated:event', {}), null);
});

test('core: ICE servers from config (STUN default, env TURN optional, no invented creds)', () => {
  assert.deepEqual(core.buildIceServers({ stunUrl: 'stun:stun.l.google.com:19302' }), [{ urls: 'stun:stun.l.google.com:19302' }]);
  assert.deepEqual(core.buildIceServers({}), []);
  const withTurn = core.buildIceServers({
    stunUrl: 'stun:stun.l.google.com:19302',
    turnServers: [{ urls: 'turn:turn.example:3478', username: 'u', credential: 'c' }]
  });
  assert.equal(withTurn.length, 2);
  assert.deepEqual(withTurn[1], { urls: 'turn:turn.example:3478', username: 'u', credential: 'c' });
  const turnNoCreds = core.buildIceServers({ turnServers: [{ urls: ['turn:a:3478', 'turns:a:443'] }] });
  assert.deepEqual(turnNoCreds, [{ urls: ['turn:a:3478', 'turns:a:443'] }]);
});

test('core: demo rule, consent mapping (never auto-grant), stable room id', () => {
  assert.equal(core.isDemoConfig({}), true);
  assert.equal(core.isDemoConfig({ restApiUrl: '/api/school', websocketUrl: 'shno-school://classroom' }), false);

  assert.deepEqual(core.mapConsents({ voice: true, camera: false }), {
    camera: 'مرفوض', mic: 'موافق عليه', recording: 'بانتظار الموافقة'
  });
  assert.deepEqual(core.mapConsents(undefined).mic, 'بانتظار الموافقة', 'missing permission must not grant media');
  assert.equal(core.consentAllowsMedia(core.mapConsents({ voice: true }), 'audio'), true);
  assert.equal(core.consentAllowsMedia(core.mapConsents({}), 'audio'), false);
  assert.equal(core.consentAllowsMedia(core.mapConsents({ camera: true }), 'video'), true);

  const id1 = core.stableRoomId(['ابتدائي', 'الأول ابتدائي', 'الرياضيات', 'ليان']);
  const id2 = core.stableRoomId(['ابتدائي', 'الأول ابتدائي', 'الرياضيات', 'ليان']);
  const id3 = core.stableRoomId(['متوسط', 'الأول متوسط', 'العلوم', 'ليان']);
  assert.equal(id1, id2, 'stable across reloads/reconnects');
  assert.notEqual(id1, id3, 'different contexts get different rooms');
  assert.match(id1, /^canva-[a-z0-9]+-[a-z0-9-]+$/i);
  assert.ok(id1.length >= 4 && id1.length <= 80, 'room id fits the server pattern');
  assert.ok(/^[A-Za-z0-9][A-Za-z0-9:_-]{3,79}$/.test(id1), 'room id accepted by the server registry');
  assert.equal(core.isMarkerUrl('shno-school://classroom'), true);
  assert.equal(core.isMarkerUrl('wss://other'), false);
});

// ---------------------------------------------------------------------------
// Pure logic: view-wiring mappers (feed the original's data globals with
// the guardian's real account data).
// ---------------------------------------------------------------------------
test('core: offline-pack item selection prefers subject+stage+grade', () => {
  const items = [
    { subject: 'الرياضيات', stage: 'ابتدائي', grade: 'الأول ابتدائي', title: 'A1' },
    { subject: 'الرياضيات', stage: 'ابتدائي', grade: 'الثاني ابتدائي', title: 'A2' },
    { subject: 'الرياضيات', stage: 'متوسط', grade: 'الأول متوسط', title: 'A3' },
    { subject: 'العلوم', stage: 'ابتدائي', grade: 'الأول ابتدائي', title: 'B1' }
  ];
  assert.equal(core.pickPackItem(items, 'الرياضيات', 'ابتدائي', 'الثاني ابتدائي').title, 'A2');
  assert.equal(core.pickPackItem(items, 'الرياضيات', 'ابتدائي', 'غير موجود').title, 'A1', 'falls back to stage match');
  assert.equal(core.pickPackItem(items, 'الرياضيات', '', '').title, 'A1', 'falls back to first subject match');
  assert.equal(core.pickPackItem(items, 'الكيمياء', 'ابتدائي', ''), null, 'unknown subject -> null (demo lesson stays)');
});

test('core: packLesson builds the original board/exam entry from real data', () => {
  const fallback = { unit: 'u0', lesson: 'l0', points: 'p0', question: 'q0', exam: 'e0', keys: ['k0'] };
  const full = core.packLesson({
    chapter: 'الفصل الأول', lesson: 'الكسور', title: 'كسور 1',
    content: 'محتوى حقيقي', question: 'ما ناتج 1/2 + 1/4؟', modelAnswer: '3/4'
  }, fallback);
  assert.equal(full.unit, 'الفصل الأول');
  assert.equal(full.lesson, 'الكسور');
  assert.equal(full.points, 'محتوى حقيقي');
  assert.equal(full.question, 'ما ناتج 1/2 + 1/4؟');
  assert.equal(full.exam, 'ما ناتج 1/2 + 1/4؟', 'real question doubles as the exam prompt');
  assert.deepEqual(full.keys, ['3/4'], 'real model answer becomes the grading key');

  const partial = core.packLesson({ title: 'درس بلا تفاصيل' }, fallback);
  assert.equal(partial.unit, 'u0', 'missing chapter falls back to the demo unit (no empty board)');
  assert.equal(partial.lesson, 'درس بلا تفاصيل', 'title is used as the lesson name');
  assert.equal(partial.points, 'p0', 'missing content falls back to the demo points');
  assert.deepEqual(partial.keys, ['k0'], 'missing model answer keeps the demo keys');
  assert.equal(core.packLesson({ title: 'درس' }).unit, 'وحدة المنهاج', 'no demo at all -> neutral unit');
});

test('core: packLibrary produces catalog rows for the original library', () => {
  const rows = core.packLibrary([
    { title: 'كتاب الرياضيات', stage: 'ابتدائي', grade: 'الأول ابتدائي', subject: 'الرياضيات', chapter: 'الفصل الأول', lesson: 'الجمع' },
    { title: 'ورقة أسئلة', verified: false, subject: 'العلوم' }
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, 'كتاب الرياضيات');
  assert.equal(rows[0].chapter, 'ابتدائي ← الأول ابتدائي ← الرياضيات ← الفصل الأول ← الجمع');
  assert.equal(rows[0].status, 'منهاج شنو منو');
  assert.equal(rows[1].status, 'مرفوع — بانتظار الاعتماد', 'unverified uploads are labelled as pending');
  assert.equal(rows[0].readable, false, 'no manifest -> nothing is readable');
  assert.equal(rows[0].url, '', 'no manifest -> no open url');
  assert.deepEqual(core.packLibrary([]), []);
});

test('core: packLibrary joins catalogue to the PDF manifest by real ids and stays full with zero students', () => {
  // Real field names of the two endpoints: catalog item {id,title,stage,grade,
  // subject,verified,availability,file:{url,originalName}} and manifest entry
  // {fileName,url,catalogId,bytes,pages}. Match by originalName↔fileName,
  // file.url↔url or id↔catalogId — never by guessed fields.
  const files = [
    { fileName: 'a.pdf', url: '/uploads/school-curriculum/a.pdf', catalogId: null, bytes: 2 * 1048576, pages: 40 },
    { fileName: 'b.pdf', url: '/uploads/school-curriculum/b.pdf', catalogId: 'iq-b', bytes: 1048576, pages: 10 },
    { fileName: 'c.pdf', url: '/uploads/school-curriculum/c.pdf', catalogId: null, bytes: 1, pages: 1 },
    { fileName: 'no-url.pdf', url: '', catalogId: 'iq-d', bytes: 1, pages: 1 }
  ];
  const catalog = [
    { id: 'iq-a', title: 'كتاب أ', stage: 'ابتدائي', grade: 'الأول ابتدائي', subject: 'القراءة', verified: true, availability: 'available',
      file: { url: '/uploads/school-curriculum/a.pdf', originalName: 'a.pdf' } },
    { id: 'iq-b', title: 'كتاب ب', stage: 'ابتدائي', grade: 'الثاني ابتدائي', subject: 'العلوم', verified: true, availability: 'available',
      file: { url: '', originalName: '' } },
    { id: 'iq-c', title: 'كتاب ج', stage: 'متوسط', grade: 'الأول متوسط', subject: 'الرياضيات', verified: false, availability: 'source_pending',
      file: { url: '', originalName: '' } },
    { id: 'iq-d', title: 'كتاب د', stage: 'إعدادي', grade: 'السادس علمي', subject: 'الفيزياء', verified: false, availability: 'source_pending',
      file: { url: '', originalName: '' } }
  ];
  const rows = core.packLibrary(catalog, files);
  assert.equal(rows.length, 4, 'one row per catalogue book');
  assert.deepEqual(rows.map((r) => r.readable), [true, true, false, false]);
  assert.equal(rows[0].url, '/uploads/school-curriculum/a.pdf', 'joined by file.originalName/file.url');
  assert.equal(rows[1].url, '/uploads/school-curriculum/b.pdf', 'joined by id↔catalogId');
  assert.equal(rows[0].status, 'منهاج شنو منو — متاح للقراءة');
  assert.equal(rows[0].pages, 40);
  assert.equal(rows[2].status, 'مفهرس — بانتظار النسخة الرسمية', 'source_pending stays pending');
  assert.equal(rows[2].url, '', 'source_pending never gets an open url');
  assert.equal(rows[3].url, '', 'manifest entry without url can never make a book readable');
  assert.equal(rows[2].chapter, 'متوسط ← الأول متوسط ← الرياضيات', 'stage ← grade ← subject hierarchy');

  // Zero students: no offline-pack items at all -> library is still the full catalogue.
  const zeroStudents = core.packLibrary(catalog.concat([]), files);
  assert.equal(zeroStudents.length, catalog.length, 'library never depends on students/offline-pack');

  // The real shipped data: every catalogue row present, readable rows only with
  // manifest urls, pending rows without any url (counts derived from the data,
  // never hard-coded).
  const realCatalog = require(path.join(root, 'server/src/data/iraqi-curriculum-catalog.js')).items;
  const realManifest = require(path.join(root, 'server/src/data/iraqi-curriculum-files.json'));
  const realFiles = realManifest.files.map((f) => ({ ...f, url: `/uploads/school-curriculum/${f.fileName}` }));
  const realRows = core.packLibrary(realCatalog, realFiles);
  const manifestUrls = new Set(realFiles.map((f) => f.url));
  assert.equal(realRows.length, realCatalog.length, 'one library row per real catalogue book');
  const readable = realRows.filter((r) => r.readable);
  const pending = realRows.filter((r) => !r.readable);
  assert.equal(readable.length + pending.length, realCatalog.length);
  assert.ok(readable.every((r) => manifestUrls.has(r.url)), 'every open url comes from the real manifest');
  assert.ok(pending.every((r) => r.url === '' && !/متاح للقراءة/.test(r.status)), 'pending rows expose no url');
  assert.equal(readable.length, realCatalog.filter((it) => core.packLibrary([it], realFiles)[0].readable).length);
});

test('core: homeStats maps the real account into the seven home numbers', () => {
  const stats = core.homeStats({
    studentCount: 2, teacherCount: 36,
    grades: ['الأول ابتدائي', 'الأول ابتدائي', 'الثاني متوسط'],
    subjects: ['الرياضيات', 'العلوم', 'الرياضيات'],
    lessonCount: 12, examCount: 3, reportCount: 1
  });
  assert.deepEqual(stats, [2, 36, 2, 2, 12, 3, 1]);
  assert.equal(core.formatCount(1248), '1,248');
  assert.deepEqual(core.homeStats({}), [0, 0, 0, 0, 0, 0, 0], 'no data -> zeros, still real');
});

test('core: studentPath picks stage/grade/subject and a matching real teacher', () => {
  const teachers = [
    { id: 'teacher-1', stage: 'ابتدائي', subject: 'الرياضيات', grades: ['الأول ابتدائي', 'الثاني ابتدائي'] },
    { id: 'teacher-2', stage: 'ابتدائي', subject: 'العلوم', grades: ['الأول ابتدائي'] },
    { id: 'teacher-3', stage: 'متوسط', subject: 'الرياضيات', grades: ['الأول متوسط'] }
  ];
  const p = core.studentPath({
    stage: 'ابتدائي', grade: 'الأول ابتدائي', subjects: ['العلوم', 'الرياضيات']
  }, teachers);
  assert.equal(p.stage, 'ابتدائي');
  assert.equal(p.grade, 'الأول ابتدائي');
  assert.equal(p.subject, 'العلوم', 'first listed subject wins');
  assert.equal(p.teacherId, 'teacher-2', 'teacher matched by stage+subject+grade');
  const p2 = core.studentPath({ stage: 'ابتدائي', grade: 'الثالث ابتدائي', subjects: ['الرياضيات'] }, teachers);
  assert.equal(p2.teacherId, 'teacher-1', 'grade mismatch still matches stage+subject');
  const p3 = core.studentPath({ stage: 'إعدادي', grade: 'الرابع إعدادي', subjects: ['الفيزياء'] }, teachers);
  assert.equal(p3.teacherId, '', 'no matching teacher -> empty (honest, no invented teacher)');
});

test('core: reportPatches replace only the original hard-coded demo values', () => {
  const patches = core.reportPatches({ studentName: 'زياد كريم', sessions: 5, average: 78.4 });
  assert.deepEqual(patches, [
    { from: 'ليان أحمد', to: 'زياد كريم' },
    { from: 'مدة التعلم: 25 دقيقة (تجريبي)', to: 'الحصص المكتملة: 5 (شنو منو)' },
    { from: 'نسبة التقدم: 70%', to: 'متوسط الدرجات: 78% (شنو منو)' }
  ]);
  assert.equal(core.reportPatches({}).length, 0, 'no real data -> no patches (demo stays)');
  assert.equal(core.reportPatches({ studentName: 'زياد كريم', sessions: 0, average: 0 }).length, 1, 'zero sessions/average are not shown');
});

test('core: consentLogText and seatCards', () => {
  const log = core.consentLogText({ camera: 'موافق عليه', mic: 'بانتظار الموافقة', recording: 'بانتظار الموافقة' });
  assert.ok(log.includes('الكاميرا: موافق عليه'), log);
  assert.ok(log.includes('الميكروفون: بانتظار الموافقة'), log);
  assert.ok(log.includes('من ملف الطالب في شنو منو'), log);

  assert.deepEqual(core.seatCards('زياد', []), [{ name: 'زياد', status: 'طالبك (حقيقي)' }]);
  const withLive = core.seatCards('زياد', [{ id: 'u1', name: 'زياد' }, { id: 'u2', name: 'أبو زياد' }]);
  assert.deepEqual(withLive, [
    { name: 'زياد', status: 'طالبك (حقيقي)' },
    { name: 'أبو زياد', status: 'متصل الآن' }
  ], 'the real student is not duplicated by a same-named live participant');
  assert.deepEqual(core.seatCards('', []), [{ name: 'بانتظار الطلاب', status: '—' }]);
});

// ---------------------------------------------------------------------------
// Live Socket.IO round-trip: auth, join/leave, isolation, webrtc relay,
// reconnect without duplicates (in-memory users, no MongoDB).
// ---------------------------------------------------------------------------
const { attachSchoolSocket } = require('../src/socket-school');

function startTestServer() {
  const users = new Map([
    ['tok-alice', { _id: 'u-alice', displayName: 'Alice', fullName: 'Ali', username: 'alice' }],
    ['tok-bob', { _id: 'u-bob', displayName: 'Bob', fullName: 'Bob', username: 'bob' }],
    ['tok-eve', { _id: 'u-eve', displayName: 'Eve', fullName: 'Eve', username: 'eve' }]
  ]);
  const server = http.createServer();
  const io = new SocketIOServer(server, { serveClient: false });
  io.use((socket, next) => {
    const token = (socket.handshake.auth && socket.handshake.auth.token) || '';
    const user = users.get(token);
    if (!user) return next(new Error('unauthorized'));
    socket.user = user;
    next();
  });
  attachSchoolSocket(io);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, io, port: server.address().port, base: `http://127.0.0.1:${server.address().port}` }));
  });
}

function connect(base, token) {
  return ioClient(base, {
    transports: ['websocket'],
    auth: { token },
    reconnection: false,
    timeout: 4000
  });
}

function waitFor(socket, event, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    socket.once(event, (data) => { clearTimeout(timer); resolve(data); });
  });
}

function acked(socket, event, payload, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`ack timeout for ${event}`)), timeoutMs);
    socket.emit(event, payload, (res) => { clearTimeout(timer); resolve(res); });
  });
}

test('socket classroom: full lifecycle with isolation and reconnect idempotency', async (t) => {
  const env = await startTestServer();
  const { base } = env;
  let alice, bob, eve, bad;

  try {
    // Authentication: a bad token never connects.
    bad = connect(base, 'tok-wrong');
    const authResult = await new Promise((resolve, reject) => {
      bad.once('connect', () => reject(new Error('unauthorized socket connected')));
      bad.once('connect_error', () => resolve('rejected'));
      setTimeout(() => resolve('timeout'), 4000);
    });
    assert.equal(authResult, 'rejected', 'unauthorized socket must be rejected');
    bad.close();

    alice = await new Promise((resolve, reject) => {
      const s = connect(base, 'tok-alice');
      s.once('connect', () => resolve(s));
      s.once('connect_error', reject);
    });
    bob = await new Promise((resolve, reject) => {
      const s = connect(base, 'tok-bob');
      s.once('connect', () => resolve(s));
      s.once('connect_error', reject);
    });

    // Join + participants broadcast.
    const aliceJoin = await acked(alice, 'school:join', { roomId: 'class-1' });
    assert.equal(aliceJoin.ok, true);
    assert.equal(aliceJoin.joined, true);
    const bobSeesJoin = waitFor(bob, 'school:participants');
    const bobJoin = await acked(bob, 'school:join', { roomId: 'class-1' });
    assert.equal(bobJoin.ok, true);
    assert.equal(bobJoin.participants.length, 2);
    const aliceSawBob = await bobSeesJoin;
    assert.equal(aliceSawBob.participants.length, 2);

    // Heartbeat.
    const beat = await acked(alice, 'school:heartbeat', {});
    assert.equal(beat.ok, true);
    assert.ok(beat.serverTime);

    // Live event (raise hand) reaches the other member only.
    const bobLive = waitFor(bob, 'school:live');
    const liveAck = await acked(alice, 'school:live', { roomId: 'class-1', kind: 'raise-hand' });
    assert.equal(liveAck.ok, true);
    const live = await bobLive;
    assert.equal(live.kind, 'raise-hand');
    assert.equal(live.from, 'u-alice');
    assert.equal(live.name, 'Alice');
    // Invalid kind is rejected.
    const badLive = await acked(alice, 'school:live', { roomId: 'class-1', kind: 'hack' });
    assert.equal(badLive.ok, false);

    // WebRTC signaling relay with the exact payload fields the original
    // handleSignal() expects (through the core envelope mapping).
    const bobOffer = waitFor(bob, 'school:webrtc:offer');
    const offerAck = await acked(alice, 'school:webrtc:offer', { roomId: 'class-1', offer: { type: 'offer', sdp: 'v=0 alice' } });
    assert.equal(offerAck.ok, true);
    const offer = await bobOffer;
    assert.deepEqual(core.fromSocketEvent('school:webrtc:offer', offer), {
      type: 'offer', roomId: 'class-1', offer: { type: 'offer', sdp: 'v=0 alice' }, from: 'u-alice'
    });

    const aliceAnswer = waitFor(alice, 'school:webrtc:answer');
    const answerAck = await acked(bob, 'school:webrtc:answer', { roomId: 'class-1', answer: { type: 'answer', sdp: 'v=0 bob' } });
    assert.equal(answerAck.ok, true);
    const answer = await aliceAnswer;
    assert.equal(answer.answer.sdp, 'v=0 bob');
    assert.equal(answer.from, 'u-bob');

    const aliceIce = waitFor(alice, 'school:webrtc:ice');
    const iceAck = await acked(bob, 'school:webrtc:ice', { roomId: 'class-1', candidate: { candidate: 'candidate:1 1 udp 2122260223 10.0.0.2 54321 typ host' } });
    assert.equal(iceAck.ok, true);
    const ice = await aliceIce;
    assert.equal(ice.candidate.candidate.length > 0, true);
    assert.deepEqual(core.fromSocketEvent('school:webrtc:ice', ice).type, 'iceCandidate');

    // Room isolation: signaling to a room you never joined is forbidden and
    // nothing leaks to other rooms.
    const aliceInOther = waitFor(alice, 'school:webrtc:offer').then(() => { throw new Error('leak into other room'); }).catch((e) => e.message);
    const crossAck = await acked(bob, 'school:webrtc:offer', { roomId: 'class-2', offer: { sdp: 'x' } });
    assert.equal(crossAck.ok, false, 'cross-room offer must be forbidden');
    const aliceOther = await aliceInOther;
    assert.equal(aliceOther, 'timeout waiting for school:webrtc:offer', 'no signal may leak between classrooms');

    // User isolation: the server derives identity from the authenticated
    // socket, never from the payload. Eve joins and her offer carries her
    // real id even if she tries to impersonate alice.
    eve = await new Promise((resolve, reject) => {
      const s = connect(base, 'tok-eve');
      s.once('connect', () => resolve(s));
      s.once('connect_error', reject);
    });
    const eveJoin = await acked(eve, 'school:join', { roomId: 'class-1' });
    assert.equal(eveJoin.ok, true);
    assert.equal(eveJoin.participants.length, 3);
    const aliceEveOffer = waitFor(alice, 'school:webrtc:offer');
    await acked(eve, 'school:webrtc:offer', { roomId: 'class-1', offer: { sdp: 'eve' }, userId: 'u-alice' });
    const eveOffer = await aliceEveOffer;
    assert.equal(eveOffer.from, 'u-eve', 'payload userId must be ignored');

    // Leave via explicit event.
    const alicePart = waitFor(alice, 'school:participants');
    const eveLeave = await acked(eve, 'school:leave', { roomId: 'class-1' });
    assert.equal(eveLeave.ok, true);
    const afterLeave = await alicePart;
    assert.equal(afterLeave.left, 'u-eve');
    assert.equal(afterLeave.participants.length, 2);

    // Reconnect: bob drops (client side), alice sees him leave; bob
    // reconnects and rejoins the SAME room -> idempotent (no duplicate
    // member, no duplicated operations after reconnect).
    const aliceBobLeft = waitFor(alice, 'school:participants');
    bob.disconnect();
    const leftEvt = await aliceBobLeft;
    assert.equal(leftEvt.left, 'u-bob');
    assert.equal(leftEvt.participants.length, 1);

    const bob2 = await new Promise((resolve, reject) => {
      const s = connect(base, 'tok-bob');
      s.once('connect', () => resolve(s));
      s.once('connect_error', reject);
    });
    const aliceRejoin = waitFor(alice, 'school:participants');
    const rejoinAck = await acked(bob2, 'school:join', { roomId: 'class-1' });
    assert.equal(rejoinAck.ok, true);
    assert.equal(rejoinAck.participants.length, 2, 'reconnect must not duplicate members');
    const rejoinEvt = await aliceRejoin;
    assert.equal(rejoinEvt.participants.length, 2);
    // The registry handle confirms exactly one member per user.
    const registry = env.io.__schoolClassrooms;
    assert.equal(registry.participants('class-1').filter((p) => p.id === 'u-bob').length, 1);
    bob2.disconnect();

    // The disconnect cleanup broadcast is asynchronous; consume it before
    // the final leave so no stale event races the last assertions.
    const afterBob2 = await waitFor(alice, 'school:participants');
    assert.equal(afterBob2.left, 'u-bob');
    assert.equal(afterBob2.participants.length, 1, 'only alice remains before the final leave');

    // Explicit leave: the ack reports the post-removal state deterministically
    // (the leaver's own socket has already left the room, so no self-broadcast).
    const finalAck = await acked(alice, 'school:leave', { roomId: 'class-1' });
    assert.equal(finalAck.ok, true);
    assert.equal(finalAck.participants.length, 0, 'leaver ack reports an empty room');
    assert.equal(registry.roomCount(), 0, 'evacuated rooms are evicted');
  } finally {
    for (const s of [alice, bob, eve, bad]) { if (s) s.disconnect(); }
    env.io.close();
    env.server.close();
  }
});
