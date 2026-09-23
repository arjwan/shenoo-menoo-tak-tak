#!/usr/bin/env node
/*
 * REAL CLASSROOM V1 — client-side checks that need no browser:
 *  1) school-live-core.js pure helpers against the REAL curriculum catalogue
 *     (cascade, pupil matching, star reconciliation, consent-driven device
 *     buttons, honest empty states).
 *  2) Privacy and engine contracts:
 *     devices OFF at entry, no MediaRecorder, no face detection, socket and
 *     signaling event names consistent with the server.
 *  3) Server-side statics: routes mounted, socket handlers registered, model
 *     never seeded with demo participants.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const core = require(path.join(root, 'school-live-core.js'));
const catalog = require(path.join(root, 'server/src/data/iraqi-curriculum-catalog'));

let passed = 0;
function check(name, fn) {
  try { fn(); passed += 1; console.log('ok - ' + name); } catch (e) { console.log('not ok - ' + name + '\n  ' + (e && e.message)); process.exitCode = 1; }
}

// ---------------------------------------------------------------- 1) core
check('codes: normalised, look-alike safe, taken from the URL', () => {
  assert.equal(core.normalizeCode(' ab12cd '), 'AB12CD');
  assert.equal(core.normalizeCode('ab'), '');
  assert.equal(core.normalizeCode('../etc'), '');
  assert.equal(core.codeFromSearch('?x=1&code=q7k2m9#top'), 'Q7K2M9');
  assert.equal(core.codeFromSearch(''), '');
});

check('cascade follows the real catalogue: stage -> grade -> subject', () => {
  const c0 = core.cascade(catalog.items, {});
  assert.deepEqual(c0.stages, ['ابتدائي', 'متوسط', 'إعدادي']);
  assert.deepEqual(c0.grades, []);
  const c1 = core.cascade(catalog.items, { stage: 'متوسط' });
  assert.deepEqual(c1.grades, ['الأول متوسط', 'الثاني متوسط', 'الثالث متوسط']);
  assert.deepEqual(c1.subjects, []);
  const c2 = core.cascade(catalog.items, { stage: 'ابتدائي', grade: 'الأول ابتدائي' });
  assert.ok(c2.subjects.includes('القراءة') && c2.subjects.includes('الرياضيات'));
  assert.ok(!c2.subjects.includes('الفيزياء'), 'no subject from another stage');
});

check('attendee options: only REAL pupils of the classroom grade + the account itself — nothing invented', () => {
  const students = [
    { _id: 'p1', name: 'زياد كريم', stage: 'ابتدائي', grade: 'الأول ابتدائي', learningPermissions: { camera: true, voice: false } },
    { _id: 'p2', name: 'ليان كريم', stage: 'متوسط', grade: 'الأول متوسط' },
    { _id: 'p3', name: 'محذوف', stage: 'ابتدائي', grade: 'الأول ابتدائي', active: false }
  ];
  const classroom = { stage: 'ابتدائي', grade: 'الأول ابتدائي' };
  assert.deepEqual(core.pupilsFor(students, classroom).map((s) => s.name), ['زياد كريم']);
  const opts = core.attendeeOptions(students, classroom, 'أبو زياد');
  assert.equal(opts.length, 2);
  assert.equal(opts[0].value, 'p1');
  assert.deepEqual(opts[0].permissions, { camera: true, voice: false });
  assert.equal(opts[1].value, '');
  assert.match(opts[1].label, /أنا بنفسي \(أبو زياد\)/);
  const none = core.attendeeOptions([], classroom, 'حساب');
  assert.equal(none.length, 1, 'zero pupils => only the account itself, no placeholder pupil');
});

check('teacher grid + counts + honest empty state text', () => {
  const classroom = {
    code: 'ABCDEF', status: 'live', teacherName: 'أستاذ حسن', teacherOnline: true, teacherId: 't1',
    participants: [
      { userId: 't1', role: 'teacher', name: 'أستاذ حسن', online: true, present: true, media: { camera: true, mic: false } },
      { userId: 's1', role: 'student', name: 'سارة', online: false, present: true, handRaised: false, media: {} },
      { userId: 's2', role: 'student', name: 'زياد كريم', online: true, present: true, handRaised: true, handRaisedAt: '2026-09-21T08:10:00Z', media: { camera: true, mic: true } },
      { userId: 's3', role: 'student', name: 'أحمد', online: true, present: true, handRaised: true, handRaisedAt: '2026-09-21T08:05:00Z', media: {} },
      { userId: 's4', role: 'student', name: 'غادر', online: false, present: false, media: {} }
    ]
  };
  const tiles = core.studentTiles(classroom);
  assert.deepEqual(tiles.map((t) => t.userId), ['s3', 's2', 's1'], 'online first, oldest raised hand first, left students hidden');
  assert.deepEqual(core.counts(classroom), { present: 3, online: 2, hands: 2 });
  assert.match(core.statusText(classroom, { role: 'teacher' }), /الحاضرون: 3 · المتصلون الآن: 2 · ✋ 2/);
  assert.match(core.statusText({ code: 'ABCDEF', status: 'live', participants: [] }, { role: 'teacher' }), /لا يوجد طلاب حاضرون بعد — شارك رمز الحصة ABCDEF/);
  assert.match(core.statusText(classroom, { role: 'student' }), /المعلم متصل — أستاذ حسن/);
  assert.match(core.statusText(Object.assign({}, classroom, { teacherOnline: false }), { role: 'student' }), /بانتظار اتصال المعلم/);
  assert.equal(core.statusText(Object.assign({}, classroom, { status: 'ended' }), { role: 'teacher' }), 'انتهت الحصة');
  assert.equal(core.teacherOf(classroom).userId, 't1');
  assert.equal(core.classroomTitle({ subject: 'القراءة', grade: 'الأول ابتدائي', stage: 'ابتدائي', lesson: 'الحروف' }), 'القراءة — الأول ابتدائي (ابتدائي) · الحروف');
});

check('star reconciliation: offer to online students only, close the rest', () => {
  const classroom = { participants: [
    { userId: 't1', role: 'teacher', present: true, online: true },
    { userId: 'a', role: 'student', present: true, online: true },
    { userId: 'b', role: 'student', present: true, online: false },
    { userId: 'c', role: 'student', present: false, online: false }
  ] };
  assert.deepEqual(core.reconcilePeers(classroom, ['b', 'c', 'x']), { offer: ['a'], close: ['b', 'c', 'x'] });
  assert.deepEqual(core.reconcilePeers(classroom, ['a']), { offer: [], close: [] });
});

check('device buttons obey guardian consent and teacher mute (server-side truth)', () => {
  const noCam = core.deviceState({ permissions: { camera: false, voice: true } }, 'camera', false);
  assert.equal(noCam.disabled, true);
  assert.match(noCam.reason, /ولي الأمر لم يفعّل الكاميرا/);
  const cam = core.deviceState({ permissions: { camera: true, voice: true } }, 'camera', true);
  assert.deepEqual(cam, { disabled: false, active: true, label: '📷 إيقاف الكاميرا', reason: '' });
  const noVoice = core.deviceState({ permissions: { camera: true, voice: false } }, 'mic', false);
  assert.equal(noVoice.disabled, true);
  const muted = core.deviceState({ permissions: { camera: true, voice: true }, mutedByTeacher: true }, 'mic', false);
  assert.equal(muted.disabled, true);
  assert.match(muted.label, /كتم المعلم/);
  const mic = core.deviceState({ permissions: { camera: true, voice: true } }, 'mic', false);
  assert.equal(mic.label, '🎙️ تشغيل المايك');
});

check('userIdFromToken reads the JWT payload without trusting anything else', () => {
  const payload = Buffer.from(JSON.stringify({ userId: '64f000000000000000000001', role: 'user' })).toString('base64url');
  assert.equal(core.userIdFromToken('h.' + payload + '.s'), '64f000000000000000000001');
  assert.equal(core.userIdFromToken('garbage'), '');
});

// ------------------------------------------------------- 2) live engine contracts & privacy
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');

check('socket + REST vocabulary matches the server', () => {
  const socketServer = read('server/src/socket-school.js');
  for (const ev of ['school:classroom:join', 'school:classroom:leave', 'school:classroom:media', 'school:classroom:signal']) {
    assert.ok(socketServer.includes(`socket.on('${ev}'`), 'server handles ' + ev);
  }
  const routes = read('server/src/routes/school-live.routes.js');
  for (const p of ['/classrooms', '/classrooms/live', '/classrooms/mine', '/classrooms/:code', '/classrooms/:code/join', '/classrooms/:code/leave', '/classrooms/:code/hand', '/classrooms/:code/mute', '/classrooms/:code/kick', '/classrooms/:code/end', '/classrooms/:code/attendance']) {
    assert.ok(routes.includes(`'${p}'`), 'route ' + p);
  }
  assert.match(routes, /router\.use\(requireAuth\)/, 'every live classroom route is authenticated');
});

check('server can only force devices OFF and the client honours it', () => {
  const srv = read('server/src/services/school-live-classroom.js');
  assert.match(srv, /forced\.push\('camera'\)/);
  assert.match(srv, /forced\.push\('mic'\)/);
});

check('honest empty states — no demo students, no fake teacher', () => {
  const model = stripComments(read('server/src/models/SchoolClassroom.js'));
  assert.doesNotMatch(model, /seed|demo|sample|placeholder/i, 'no seeded participants in the model');
  const routes = stripComments(read('server/src/routes/school-live.routes.js'));
  assert.doesNotMatch(routes, /seed|demo|sample|placeholder/i, 'no seeded participants in the routes');
  const server = read('server/src/server.js');
  assert.match(server, /app\.use\('\/api\/school', schoolLiveRoutes\)/);
  assert.ok(server.indexOf("app.use('/api/school', schoolCanvaRoutes)") < server.indexOf("app.use('/api/school', schoolLiveRoutes)"));
  assert.ok(server.indexOf("app.use('/api/school', schoolLiveRoutes)") < server.indexOf("app.use('/api/school', schoolSyncRoutes)"));
});

// -------------------------------------------- 4) Canva adapter binding (pure)
const adapterCore = require(path.join(root, 'school-canva-adapter-core.js'));
const liveRooms = [
  { code: 'Q7K2M9', status: 'live', teacherName: 'أستاذ حسن علي', stage: 'ابتدائي', grade: 'الأول ابتدائي', subject: 'الرياضيات', lesson: 'الكسور', presentCount: 2 },
  { code: 'ZZZZ22', status: 'live', teacherName: 'أستاذة نور', stage: 'متوسط', grade: 'الأول متوسط', subject: 'الرياضيات', lesson: '' },
  { code: 'ENDED1', status: 'ended', teacherName: 'انتهت', stage: 'ابتدائي', grade: 'الأول ابتدائي', subject: 'الرياضيات' }
];
const directory = [{ id: 'teacher-19', name: 'نور السندباد', stage: 'ابتدائي', subject: 'الرياضيات', grades: ['الأول ابتدائي'] }];

check('Canva classroom page: live classrooms appear as real teacher rows (classroom:<CODE>) next to the directory', () => {
  const rows = adapterCore.classroomOptions(catalog.items, [], directory, { 'room-stage': 'primary', 'room-grade': 'الأول ابتدائي' }, liveRooms);
  const teachers = rows.filter((r) => r.type === 'teacher');
  assert.deepEqual(teachers.map((r) => r.id), ['classroom:Q7K2M9', 'teacher-19'], 'live room of this grade first, ended/other-grade rooms excluded, directory kept');
  assert.match(teachers[0].name, /أستاذ حسن علي — حصة مباشرة الآن: الرياضيات \/ الكسور/);
  assert.equal(adapterCore.classroomOptions(catalog.items, [], directory, { 'room-stage': 'primary', 'room-grade': 'الأول ابتدائي', 'room-subject': 'العلوم' }, liveRooms).filter((r) => r.id.startsWith('classroom:')).length, 0, 'subject filter applies to live rooms');
  const none = adapterCore.classroomOptions(catalog.items, [], directory, { 'room-stage': 'primary', 'room-grade': 'الأول ابتدائي' }, []);
  assert.deepEqual(none.filter((r) => r.type === 'teacher').map((r) => r.id), ['teacher-19'], 'no live classroom -> unchanged directory rows (no placeholder)');
});

check('Canva classroom page: selected live classroom -> honest pointer (code + page), never fake lesson text', () => {
  const pack = [{ id: 'k1', stage: 'ابتدائي', grade: 'الأول ابتدائي', subject: 'الرياضيات', lesson: 'الكسور والعشرات', content: 'محتوى حقيقي' }];
  const withContent = adapterCore.classroomOptions(catalog.items, pack, directory, { 'room-stage': 'primary', 'room-grade': 'الأول ابتدائي', 'room-subject': 'الرياضيات', 'room-lesson': 'knowledge:k1', 'room-teacher': 'classroom:Q7K2M9' }, liveRooms);
  const content = withContent.find((r) => typeof r.content === 'string');
  assert.ok(content.content.startsWith('محتوى حقيقي'), 'real lesson text first');
  assert.ok(content.content.includes('رمز الحصة Q7K2M9'), 'pointer appended');
  assert.ok(!withContent.some((r) => r.type === 'teacher'), 'chosen live classroom is not re-sent (select keeps its value)');
  const noContent = adapterCore.classroomOptions(catalog.items, [], directory, { 'room-stage': 'primary', 'room-grade': 'الأول ابتدائي', 'room-subject': 'الرياضيات', 'room-teacher': 'classroom:Q7K2M9' }, liveRooms);
  const pointer = noContent.find((r) => typeof r.content === 'string');
  assert.equal(pointer.type, 'live-classroom');
  assert.match(pointer.content, /حصة مباشرة الآن مع أستاذ حسن علي/);
  const stale = adapterCore.classroomOptions(catalog.items, [], directory, { 'room-stage': 'primary', 'room-grade': 'الأول ابتدائي', 'room-teacher': 'classroom:ENDED1' }, liveRooms);
  assert.ok(!stale.some((r) => typeof r.content === 'string'), 'an ended classroom gets no pointer');
  assert.ok(stale.some((r) => r.id === 'teacher-19'), 'stale selection -> teacher rows re-sent');
  assert.equal(adapterCore.liveCode('classroom:q7k2m9'), 'Q7K2M9');
  assert.equal(adapterCore.liveCode('teacher-19'), '');
  assert.equal(adapterCore.liveCode('classroom:../x'), '');
});

check('Canva classroom actions on a live classroom: join real pupil / hand / end via the live engine; nothing fabricated', () => {
  const base = { items: catalog.items, packItems: [], students: [], session: null };
  const payload = { 'room-stage': 'primary', 'room-grade': 'الأول ابتدائي', 'room-subject': 'الرياضيات', 'room-lesson': 'book:x', 'room-teacher': 'classroom:Q7K2M9' };
  const noPupil = adapterCore.classroomActionPlan({ ...base, payload: { ...payload, action: 'attendance' } });
  assert.equal(noPupil.kind, 'refuse');
  assert.match(noPupil.message, /لا يُنشأ طالب تلقائياً/);
  const students = [{ _id: 's1', name: 'زياد كريم', stage: 'ابتدائي', grade: 'الأول ابتدائي' }, { _id: 's2', name: 'ليان', stage: 'متوسط', grade: 'الأول متوسط' }];
  const join = adapterCore.classroomActionPlan({ ...base, students, payload: { ...payload, action: 'attendance' } });
  assert.deepEqual(join, { kind: 'live.join', code: 'Q7K2M9', body: { studentId: 's1' } }, 'attendance joins the real pupil of that grade');
  assert.deepEqual(adapterCore.classroomActionPlan({ ...base, students, payload: { ...payload, action: 'hand' } }), { kind: 'live.hand', code: 'Q7K2M9', body: { raised: true } });
  assert.deepEqual(adapterCore.classroomActionPlan({ ...base, payload: { action: 'end', 'room-teacher': 'classroom:Q7K2M9' } }), { kind: 'live.end', code: 'Q7K2M9' }, 'end goes to the live engine (server decides the role)');
  assert.equal(adapterCore.classroomActionPlan({ ...base, students, payload: { ...payload, action: 'participation' } }).kind, 'note', 'participation unchanged (real note)');
  assert.equal(adapterCore.classroomActionPlan({ ...base, students, payload: { ...payload, action: 'question' } }).kind, 'refuse', 'question still refused');
  assert.equal(adapterCore.classroomActionPlan({ ...base, students, payload: { ...payload, 'room-teacher': 'teacher-19', action: 'attendance' } }).kind, 'session.start', 'directory teacher keeps the previous session flow');
  const metrics = adapterCore.dashboardMetrics({ students: [], teachers: [], libraryRows: [], session: null, schedules: [], liveClassrooms: liveRooms });
  assert.equal(metrics.find((m) => m.label === 'حصص مباشرة الآن').value, 2, 'only live classrooms are counted');
});

console.log(`\n${passed} checks passed${process.exitCode ? ' (with failures)' : ''}`);
