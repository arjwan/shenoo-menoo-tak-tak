'use strict';

// REAL CLASSROOM V1 — pure state rules for a live classroom document.
// Shared by the REST routes (school-live.routes.js) and the Socket.IO layer
// (socket-school.js); no I/O here so every rule is unit-testable.
//
// Roles: the account that created the classroom is its teacher; every other
// account that joins is a student. Only the teacher may mute, kick, lower
// other hands or end the classroom. The server can only ever switch a
// participant's camera/microphone OFF (mute) — it never turns them on: a
// device starts only from the participant's own click in the browser, after
// the browser permission prompt.

const crypto = require('crypto');

const STAGES = ['ابتدائي', 'متوسط', 'إعدادي'];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 look-alikes
// 'ready' = a student's (re)connected page asking the teacher for a fresh offer (no SDP).
const SIGNAL_TYPES = new Set(['offer', 'answer', 'ice', 'ready']);

const str = (v, max) => String(v === undefined || v === null ? '' : v).trim().slice(0, max || 200);
const idOf = (v) => String(v && v._id ? v._id : v || '');

function generateCode(length = 6) {
  let out = '';
  for (let i = 0; i < length; i += 1) out += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  return out;
}

function normalizeCode(value) {
  const code = str(value, 12).toUpperCase();
  return /^[A-Z0-9]{4,12}$/.test(code) ? code : '';
}

function accountName(user) {
  return str(user && (user.displayName || user.fullName || user.username), 100) || 'حساب شنو منو';
}

/** Room name on the Socket.IO server for this classroom. */
function roomName(classroom) {
  return `live:${idOf(classroom)}`;
}

/**
 * Validate teacher input against the REAL Iraqi curriculum catalogue: the
 * stage must exist, the grade must be a grade of that stage and the subject a
 * subject taught in that grade. The lesson is free text (a book/unit title).
 */
function validateClassroomInput(input, catalogItems) {
  input = input || {};
  const items = Array.isArray(catalogItems) ? catalogItems : [];
  const stage = str(input.stage, 40);
  const grade = str(input.grade, 80);
  const subject = str(input.subject, 120);
  const lesson = str(input.lesson, 160);
  if (!STAGES.includes(stage)) return { ok: false, error: 'اختر المرحلة من المنهج العراقي' };
  const stageItems = items.filter((it) => it.stage === stage);
  if (!grade || !stageItems.some((it) => it.grade === grade)) return { ok: false, error: 'اختر صفاً حقيقياً من صفوف هذه المرحلة' };
  if (!subject || !stageItems.some((it) => it.grade === grade && it.subject === subject)) return { ok: false, error: 'اختر مادة مقررة لهذا الصف' };
  return { ok: true, value: { stage, grade, subject, lesson } };
}

function findParticipant(classroom, userId) {
  const key = idOf(userId);
  return (classroom.participants || []).find((p) => idOf(p.user) === key) || null;
}

function isTeacher(classroom, userId) {
  return idOf(classroom.teacher) === idOf(userId);
}

function isPresent(participant) {
  return Boolean(participant && !participant.kicked && !participant.leftAt);
}

function publicParticipant(p) {
  return {
    userId: idOf(p.user),
    name: p.name,
    role: p.role,
    studentId: p.student ? idOf(p.student) : null,
    permissions: { camera: p.permissions ? p.permissions.camera !== false : true, voice: p.permissions ? p.permissions.voice !== false : true },
    online: Boolean(p.online),
    present: isPresent(p),
    handRaised: Boolean(p.handRaised),
    handRaisedAt: p.handRaisedAt ? new Date(p.handRaisedAt).toISOString() : null,
    mutedByTeacher: Boolean(p.mutedByTeacher),
    media: { camera: Boolean(p.media && p.media.camera), mic: Boolean(p.media && p.media.mic) },
    kicked: Boolean(p.kicked),
    joinedAt: p.joinedAt ? new Date(p.joinedAt).toISOString() : null,
    leftAt: p.leftAt ? new Date(p.leftAt).toISOString() : null
  };
}

/**
 * Public projection. `roster: true` includes participants (members/teacher
 * only — callers decide); the summary always carries the live head-count.
 */
function publicClassroom(classroom, options) {
  options = options || {};
  const participants = (classroom.participants || []).map(publicParticipant);
  const students = participants.filter((p) => p.role === 'student');
  const teacher = participants.find((p) => p.role === 'teacher') || null;
  const out = {
    id: idOf(classroom),
    code: classroom.code,
    room: roomName(classroom),
    teacherId: idOf(classroom.teacher),
    teacherName: classroom.teacherName,
    teacherOnline: Boolean(teacher && teacher.online),
    stage: classroom.stage,
    grade: classroom.grade,
    subject: classroom.subject,
    lesson: classroom.lesson || '',
    status: classroom.status,
    startedAt: classroom.startedAt ? new Date(classroom.startedAt).toISOString() : null,
    endedAt: classroom.endedAt ? new Date(classroom.endedAt).toISOString() : null,
    presentCount: students.filter((p) => p.present).length,
    onlineCount: students.filter((p) => p.online).length,
    handsRaised: students.filter((p) => p.present && p.handRaised).length,
    answeringStudent: classroom.answeringStudent ? idOf(classroom.answeringStudent) : null,
    studentMayWrite: Boolean(classroom.studentMayWrite)
  };
  if (options.roster) out.participants = participants;
  return out;
}

function fail(error, status) {
  return { ok: false, error, status: status || 400 };
}

/** Teacher entry, created with the classroom. */
function teacherParticipant(user, at) {
  return {
    user: user._id,
    name: accountName(user),
    role: 'teacher',
    student: null,
    permissions: { camera: true, voice: true },
    joinedAt: at || new Date(),
    leftAt: null,
    online: false,
    handRaised: false,
    handRaisedAt: null,
    mutedByTeacher: false,
    media: { camera: false, mic: false },
    kicked: false,
    attendance: [{ joinedAt: at || new Date(), leftAt: null }]
  };
}

/**
 * Register a participant (REST join). `student` is one of the joining
 * guardian's OWN SchoolStudent docs (already ownership-checked by the route)
 * or null when the account attends as itself.
 */
function joinParticipant(classroom, input) {
  const { user, student } = input;
  const at = input.at || new Date();
  if (classroom.status !== 'live') return fail('انتهت هذه الحصة', 410);
  if (isTeacher(classroom, user._id)) {
    const teacher = findParticipant(classroom, user._id);
    return { ok: true, participant: teacher, changed: false, role: 'teacher' };
  }
  let participant = findParticipant(classroom, user._id);
  if (participant && participant.kicked) return fail('أخرجك المعلم من هذه الحصة', 403);
  const name = student ? str(student.name, 100) : accountName(user);
  const permissions = student
    ? { camera: Boolean(student.learningPermissions && student.learningPermissions.camera), voice: Boolean(student.learningPermissions && student.learningPermissions.voice) }
    : { camera: true, voice: true };
  if (!participant) {
    participant = {
      user: user._id,
      name,
      role: 'student',
      student: student ? student._id : null,
      permissions,
      joinedAt: at,
      leftAt: null,
      online: false,
      handRaised: false,
      handRaisedAt: null,
      mutedByTeacher: false,
      media: { camera: false, mic: false },
      kicked: false,
      attendance: [{ joinedAt: at, leftAt: null }]
    };
    classroom.participants.push(participant);
    return { ok: true, participant: findParticipant(classroom, user._id), changed: true, role: 'student', rejoined: false };
  }
  // Re-join (after leaving): keep the record, open a new attendance interval.
  participant.name = name;
  participant.student = student ? student._id : null;
  participant.permissions = permissions;
  const rejoined = Boolean(participant.leftAt);
  if (rejoined) {
    participant.leftAt = null;
    participant.attendance.push({ joinedAt: at, leftAt: null });
  }
  return { ok: true, participant, changed: true, role: 'student', rejoined };
}

function closeInterval(participant, at) {
  const open = (participant.attendance || []).find((a) => !a.leftAt);
  if (open) open.leftAt = at;
}

function leaveParticipant(classroom, userId, at) {
  at = at || new Date();
  const participant = findParticipant(classroom, userId);
  if (!participant) return fail('لست مشاركاً في هذه الحصة', 404);
  if (participant.role === 'teacher') return fail('المعلم ينهي الحصة بدلاً من مغادرتها', 400);
  if (participant.leftAt) return { ok: true, participant, changed: false };
  participant.leftAt = at;
  participant.online = false;
  participant.handRaised = false;
  participant.handRaisedAt = null;
  participant.media = { camera: false, mic: false };
  closeInterval(participant, at);
  return { ok: true, participant, changed: true };
}

/** Socket presence. Going offline switches the self-reported devices off. */
function setOnline(classroom, userId, online, at) {
  const participant = findParticipant(classroom, userId);
  if (!participant) return fail('لست مشاركاً في هذه الحصة', 403);
  if (classroom.status !== 'live') return fail('انتهت هذه الحصة', 410);
  if (participant.kicked) return fail('أخرجك المعلم من هذه الحصة', 403);
  if (participant.leftAt && online) return fail('انضم إلى الحصة أولاً', 403);
  const changed = Boolean(participant.online) !== Boolean(online);
  participant.online = Boolean(online);
  if (!online) participant.media = { camera: false, mic: false };
  return { ok: true, participant, changed };
}

function setHand(classroom, actorId, targetId, raised, at) {
  if (classroom.status !== 'live') return fail('انتهت هذه الحصة', 410);
  const actor = findParticipant(classroom, actorId);
  if (!actor || !isPresent(actor)) return fail('انضم إلى الحصة أولاً', 403);
  const target = findParticipant(classroom, targetId || actorId);
  if (!target) return fail('المشارك غير موجود', 404);
  const self = idOf(target.user) === idOf(actorId);
  if (!self && !(isTeacher(classroom, actorId) && raised === false)) return fail('يمكن للمعلم فقط إنزال يد طالب آخر', 403);
  if (target.role === 'teacher') return fail('المعلم لا يرفع يده', 400);
  if (!isPresent(target)) return fail('الطالب غادر الحصة', 409);
  const changed = Boolean(target.handRaised) !== Boolean(raised);
  target.handRaised = Boolean(raised);
  target.handRaisedAt = raised ? (at || new Date()) : null;
  return { ok: true, participant: target, changed };
}

/** Teacher-only. Muting forces the student's mic state off; unmuting only lifts the lock. */
function setMute(classroom, actorId, targetId, muted) {
  if (classroom.status !== 'live') return fail('انتهت هذه الحصة', 410);
  if (!isTeacher(classroom, actorId)) return fail('كتم الطلاب من صلاحية المعلم فقط', 403);
  const target = findParticipant(classroom, targetId);
  if (!target || target.role === 'teacher') return fail('الطالب غير موجود في الحصة', 404);
  const changed = Boolean(target.mutedByTeacher) !== Boolean(muted);
  target.mutedByTeacher = Boolean(muted);
  if (muted) target.media = { camera: Boolean(target.media && target.media.camera), mic: false };
  return { ok: true, participant: target, changed };
}

/**
 * Self-reported device state. The server never grants: camera requires the
 * guardian's consent, the microphone requires consent AND no teacher mute;
 * anything else is forced to false and reported back (`forced`).
 */
function setMedia(classroom, userId, media) {
  if (classroom.status !== 'live') return fail('انتهت هذه الحصة', 410);
  const participant = findParticipant(classroom, userId);
  if (!participant || !isPresent(participant)) return fail('انضم إلى الحصة أولاً', 403);
  media = media || {};
  const forced = [];
  let camera = Boolean(media.camera);
  let mic = Boolean(media.mic);
  if (camera && participant.permissions && participant.permissions.camera === false) { camera = false; forced.push('camera'); }
  if (mic && participant.permissions && participant.permissions.voice === false) { mic = false; forced.push('mic'); }
  if (mic && participant.mutedByTeacher) { mic = false; forced.push('mic'); }
  const changed = Boolean(participant.media && participant.media.camera) !== camera || Boolean(participant.media && participant.media.mic) !== mic;
  participant.media = { camera, mic };
  return { ok: true, participant, changed, forced, media: { camera, mic } };
}

function kickParticipant(classroom, actorId, targetId, at) {
  if (classroom.status !== 'live') return fail('انتهت هذه الحصة', 410);
  if (!isTeacher(classroom, actorId)) return fail('إخراج الطلاب من صلاحية المعلم فقط', 403);
  const target = findParticipant(classroom, targetId);
  if (!target || target.role === 'teacher') return fail('الطالب غير موجود في الحصة', 404);
  at = at || new Date();
  target.kicked = true;
  target.online = false;
  target.handRaised = false;
  target.handRaisedAt = null;
  target.media = { camera: false, mic: false };
  if (!target.leftAt) { target.leftAt = at; closeInterval(target, at); }
  return { ok: true, participant: target, changed: true };
}

function endClassroom(classroom, actorId, at) {
  if (!isTeacher(classroom, actorId)) return fail('إنهاء الحصة من صلاحية المعلم فقط', 403);
  if (classroom.status !== 'live') return { ok: true, changed: false };
  at = at || new Date();
  classroom.status = 'ended';
  classroom.endedAt = at;
  for (const p of classroom.participants || []) {
    p.online = false;
    p.handRaised = false;
    p.handRaisedAt = null;
    p.media = { camera: false, mic: false };
    if (!p.leftAt) { p.leftAt = at; closeInterval(p, at); }
  }
  return { ok: true, changed: true };
}

/** Attendance report: real intervals per participant, minutes rounded. */
function attendanceReport(classroom, now) {
  now = now || new Date();
  return (classroom.participants || []).filter((p) => p.role === 'student').map((p) => {
    const intervals = (p.attendance || []).map((a) => {
      const from = new Date(a.joinedAt);
      const to = a.leftAt ? new Date(a.leftAt) : now;
      return { joinedAt: from.toISOString(), leftAt: a.leftAt ? to.toISOString() : null, minutes: Math.max(0, Math.round((to - from) / 60000)) };
    });
    return {
      userId: idOf(p.user),
      name: p.name,
      studentId: p.student ? idOf(p.student) : null,
      present: isPresent(p),
      online: Boolean(p.online),
      kicked: Boolean(p.kicked),
      intervals,
      minutes: intervals.reduce((sum, i) => sum + i.minutes, 0)
    };
  });
}

/**
 * Signaling policy (star topology): a signal may only travel between a
 * present teacher and a present student of the SAME live classroom.
 */
function canSignal(classroom, fromId, toId, type) {
  if (!classroom || classroom.status !== 'live') return false;
  if (!SIGNAL_TYPES.has(String(type || ''))) return false;
  if (idOf(fromId) === idOf(toId)) return false;
  const from = findParticipant(classroom, fromId);
  const to = findParticipant(classroom, toId);
  if (!isPresent(from) || !isPresent(to)) return false;
  if (!from.online || !to.online) return false;
  return from.role === 'teacher' ? to.role === 'student' : to.role === 'teacher';
}

module.exports = {
  STAGES,
  SIGNAL_TYPES: Array.from(SIGNAL_TYPES),
  generateCode,
  normalizeCode,
  accountName,
  roomName,
  validateClassroomInput,
  findParticipant,
  isTeacher,
  isPresent,
  publicParticipant,
  publicClassroom,
  teacherParticipant,
  joinParticipant,
  leaveParticipant,
  setOnline,
  setHand,
  setMute,
  setMedia,
  kickParticipant,
  endClassroom,
  attendanceReport,
  canSignal
};
