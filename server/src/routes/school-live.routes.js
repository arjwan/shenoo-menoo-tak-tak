'use strict';

// REAL CLASSROOM V1 — REST surface (mounted under /api/school, path-disjoint
// from the existing school routers):
//   POST /classrooms                  teacher creates a live classroom (real code + id)
//   GET  /classrooms/live             live classrooms (filter stage/grade/subject)
//   GET  /classrooms/mine             my hosted live classroom + the one I attend
//   GET  /classrooms/:code            classroom (roster only for members/teacher)
//   POST /classrooms/:code/join       attend (optionally as one of MY SchoolStudent pupils)
//   POST /classrooms/:code/leave
//   POST /classrooms/:code/hand       { raised, userId? }  (teacher may lower others)
//   POST /classrooms/:code/mute       { userId, muted }    teacher only
//   POST /classrooms/:code/kick       { userId }           teacher only
//   POST /classrooms/:code/end                             teacher only
//   GET  /classrooms/:code/attendance                      teacher only
// Every mutation is persisted, then fanned out on Socket.IO (see
// services/school-live-events.js). No media touches the server.
const router = require('express').Router();
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const Classroom = require('../models/SchoolClassroom');
const Student = require('../models/SchoolStudent');
const catalog = require('../data/iraqi-curriculum-catalog');
const live = require('../services/school-live-classroom');
const events = require('../services/school-live-events');
const { iceServers } = require('../services/school-live-ice');

const isObjectId = (v) => mongoose.Types.ObjectId.isValid(String(v || ''));

function io(req) {
  return req.app.get('io') || null;
}

function reply(res, result) {
  return res.status(result.status || 400).json({ ok: false, message: result.error });
}

async function loadByCode(req, res) {
  const code = live.normalizeCode(req.params.code);
  if (!code) { res.status(404).json({ ok: false, message: 'رمز الحصة غير صالح' }); return null; }
  const classroom = await Classroom.findOne({ code });
  if (!classroom) { res.status(404).json({ ok: false, message: 'لا توجد حصة بهذا الرمز' }); return null; }
  return classroom;
}

function canSeeRoster(classroom, user) {
  return live.isTeacher(classroom, user._id) || Boolean(live.findParticipant(classroom, user._id));
}

async function uniqueCode() {
  for (let i = 0; i < 8; i += 1) {
    const code = live.generateCode();
    // eslint-disable-next-line no-await-in-loop
    if (!(await Classroom.exists({ code }))) return code;
  }
  throw new Error('تعذر توليد رمز حصة فريد');
}

router.use(requireAuth);

router.post('/classrooms', async (req, res, next) => {
  try {
    const existing = await Classroom.findOne({ teacher: req.user._id, status: 'live' });
    if (existing) {
      return res.status(409).json({ ok: false, message: 'لديك حصة مباشرة جارية بالفعل', classroom: live.publicClassroom(existing, { roster: true }), room: live.roomName(existing), iceServers: iceServers() });
    }
    const valid = live.validateClassroomInput(req.body, catalog.items);
    if (!valid.ok) return res.status(400).json({ ok: false, message: valid.error });
    const now = new Date();
    const classroom = await Classroom.create({
      code: await uniqueCode(),
      teacher: req.user._id,
      teacherName: live.accountName(req.user),
      ...valid.value,
      status: 'live',
      startedAt: now,
      participants: [live.teacherParticipant(req.user, now)]
    });
    res.status(201).json({ ok: true, classroom: live.publicClassroom(classroom, { roster: true }), room: live.roomName(classroom), iceServers: iceServers() });
  } catch (e) { next(e); }
});

router.get('/classrooms/live', async (req, res, next) => {
  try {
    const q = { status: 'live' };
    const stage = String(req.query.stage || '').trim();
    const grade = String(req.query.grade || '').trim();
    const subject = String(req.query.subject || '').trim();
    if (stage) q.stage = stage;
    if (grade) q.grade = grade;
    if (subject) q.subject = subject;
    const rooms = await Classroom.find(q).sort({ startedAt: -1 }).limit(100);
    res.json({ ok: true, classrooms: rooms.map((c) => live.publicClassroom(c)) });
  } catch (e) { next(e); }
});

router.get('/classrooms/mine', async (req, res, next) => {
  try {
    const hosting = await Classroom.findOne({ teacher: req.user._id, status: 'live' });
    const attending = await Classroom.findOne({ status: 'live', participants: { $elemMatch: { user: req.user._id, role: 'student', leftAt: null, kicked: false } } });
    res.json({
      ok: true,
      hosting: hosting ? live.publicClassroom(hosting, { roster: true }) : null,
      attending: attending ? live.publicClassroom(attending, { roster: true }) : null,
      iceServers: iceServers()
    });
  } catch (e) { next(e); }
});

router.get('/classrooms/:code', async (req, res, next) => {
  try {
    const classroom = await loadByCode(req, res);
    if (!classroom) return;
    const roster = canSeeRoster(classroom, req.user);
    const you = live.findParticipant(classroom, req.user._id);
    res.json({ ok: true, classroom: live.publicClassroom(classroom, { roster }), you: you ? live.publicParticipant(you) : null, room: roster ? live.roomName(classroom) : undefined, iceServers: roster ? iceServers() : undefined });
  } catch (e) { next(e); }
});

router.post('/classrooms/:code/join', async (req, res, next) => {
  try {
    const classroom = await loadByCode(req, res);
    if (!classroom) return;
    let student = null;
    if (req.body && req.body.studentId) {
      if (!isObjectId(req.body.studentId)) return res.status(400).json({ ok: false, message: 'معرّف الطالب غير صالح' });
      student = await Student.findOne({ _id: req.body.studentId, guardian: req.user._id, active: true });
      if (!student) return res.status(403).json({ ok: false, message: 'هذا الطالب ليس من طلاب حسابك' });
      if (student.stage !== classroom.stage || student.grade !== classroom.grade) {
        return res.status(409).json({ ok: false, message: `هذه الحصة للصف ${classroom.grade} (${classroom.stage}) وليست لصف ${student.name}` });
      }
    }
    const result = live.joinParticipant(classroom, { user: req.user, student, at: new Date() });
    if (!result.ok) return reply(res, result);
    if (result.changed) {
      await classroom.save();
      events.emitUpdate(io(req), classroom);
    }
    res.status(result.rejoined === false ? 201 : 200).json({
      ok: true,
      role: result.role,
      you: live.publicParticipant(result.participant),
      classroom: live.publicClassroom(classroom, { roster: true }),
      room: live.roomName(classroom),
      iceServers: iceServers()
    });
  } catch (e) { next(e); }
});

router.post('/classrooms/:code/leave', async (req, res, next) => {
  try {
    const classroom = await loadByCode(req, res);
    if (!classroom) return;
    const result = live.leaveParticipant(classroom, req.user._id, new Date());
    if (!result.ok) return reply(res, result);
    if (result.changed) {
      await classroom.save();
      await events.evictUser(io(req), classroom, req.user._id);
      events.emitToRoom(io(req), classroom, 'school:classroom:peer', { userId: String(req.user._id), role: 'student', name: result.participant.name, online: false, left: true });
      events.emitUpdate(io(req), classroom);
    }
    res.json({ ok: true, classroom: live.publicClassroom(classroom) });
  } catch (e) { next(e); }
});

router.post('/classrooms/:code/hand', async (req, res, next) => {
  try {
    const classroom = await loadByCode(req, res);
    if (!classroom) return;
    const targetId = req.body && req.body.userId ? String(req.body.userId) : String(req.user._id);
    const result = live.setHand(classroom, req.user._id, targetId, req.body ? req.body.raised !== false : true, new Date());
    if (!result.ok) return reply(res, result);
    if (result.changed) {
      await classroom.save();
      events.emitToRoom(io(req), classroom, 'school:classroom:hand', { userId: targetId, name: result.participant.name, raised: Boolean(result.participant.handRaised) });
      events.emitUpdate(io(req), classroom);
    }
    res.json({ ok: true, participant: live.publicParticipant(result.participant), classroom: live.publicClassroom(classroom, { roster: true }) });
  } catch (e) { next(e); }
});

router.post('/classrooms/:code/mute', async (req, res, next) => {
  try {
    const classroom = await loadByCode(req, res);
    if (!classroom) return;
    const targetId = String((req.body && req.body.userId) || '');
    const result = live.setMute(classroom, req.user._id, targetId, Boolean(req.body && req.body.muted !== false));
    if (!result.ok) return reply(res, result);
    if (result.changed) {
      await classroom.save();
      events.emitToRoom(io(req), classroom, 'school:classroom:mute', { userId: targetId, muted: Boolean(result.participant.mutedByTeacher) });
      events.emitUpdate(io(req), classroom);
    }
    res.json({ ok: true, participant: live.publicParticipant(result.participant) });
  } catch (e) { next(e); }
});

router.post('/classrooms/:code/kick', async (req, res, next) => {
  try {
    const classroom = await loadByCode(req, res);
    if (!classroom) return;
    const targetId = String((req.body && req.body.userId) || '');
    const result = live.kickParticipant(classroom, req.user._id, targetId, new Date());
    if (!result.ok) return reply(res, result);
    await classroom.save();
    events.emitToUser(io(req), targetId, 'school:classroom:kicked', { code: classroom.code });
    await events.evictUser(io(req), classroom, targetId);
    events.emitToRoom(io(req), classroom, 'school:classroom:peer', { userId: targetId, role: 'student', name: result.participant.name, online: false, left: true, kicked: true });
    events.emitUpdate(io(req), classroom);
    res.json({ ok: true, participant: live.publicParticipant(result.participant), classroom: live.publicClassroom(classroom, { roster: true }) });
  } catch (e) { next(e); }
});

router.post('/classrooms/:code/end', async (req, res, next) => {
  try {
    const classroom = await loadByCode(req, res);
    if (!classroom) return;
    const result = live.endClassroom(classroom, req.user._id, new Date());
    if (!result.ok) return reply(res, result);
    if (result.changed) {
      await classroom.save();
      events.emitToRoom(io(req), classroom, 'school:classroom:ended', { endedAt: classroom.endedAt.toISOString() });
      events.emitUpdate(io(req), classroom);
      const sockets = io(req) ? await io(req).in(live.roomName(classroom)).fetchSockets() : [];
      for (const s of sockets) s.leave(live.roomName(classroom));
    }
    res.json({ ok: true, classroom: live.publicClassroom(classroom, { roster: true }), attendance: live.attendanceReport(classroom) });
  } catch (e) { next(e); }
});

router.get('/classrooms/:code/attendance', async (req, res, next) => {
  try {
    const classroom = await loadByCode(req, res);
    if (!classroom) return;
    if (!live.isTeacher(classroom, req.user._id)) return res.status(403).json({ ok: false, message: 'قائمة الحضور للمعلم فقط' });
    res.json({ ok: true, code: classroom.code, status: classroom.status, attendance: live.attendanceReport(classroom) });
  } catch (e) { next(e); }
});

module.exports = router;
