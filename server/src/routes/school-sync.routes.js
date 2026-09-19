const router = require('express').Router();
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const Student = require('../models/SchoolStudent');
const Schedule = require('../models/SchoolSchedule');
const Session = require('../models/SchoolSession');
const SyncOperation = require('../models/SchoolSyncOperation');

const clean = (v) => String(v || '').trim();
const isObjectId = (v) => mongoose.Types.ObjectId.isValid(String(v || ''));

router.use(requireAuth);

async function ownStudent(id, user, localMap) {
  let resolved = localMap.get(String(id || '')) || id;
  if (!isObjectId(resolved)) {
    const prior = await SyncOperation.findOne({ guardian: user._id, localId: String(id || ''), status: 'applied' }).lean();
    resolved = prior?.result?.studentId || prior?.result?.id || resolved;
  }
  if (!isObjectId(resolved)) return null;
  return Student.findOne({ _id: resolved, guardian: user._id, active: true });
}

function opResult(type, result, localId) {
  return { type, localId: localId || '', result: result || {} };
}

async function applyOperation(op, req, localMap) {
  const type = clean(op.type);
  const payload = op.payload && typeof op.payload === 'object' ? op.payload : {};
  const localId = clean(op.localId || payload.localId || payload._id || '');

  if (type === 'student.create') {
    const name = clean(payload.name).slice(0, 100);
    const stage = clean(payload.stage);
    const grade = clean(payload.grade).slice(0, 80);
    const subjects = Array.isArray(payload.subjects) ? payload.subjects.map(clean).filter(Boolean).slice(0, 30) : [];
    if (!name || !stage || !grade) throw Object.assign(new Error('بيانات الطالب غير مكتملة'), { status: 400 });
    const student = await Student.create({ guardian: req.user._id, name, stage, grade, subjects, parentApproved: true });
    if (localId) localMap.set(localId, String(student._id));
    return opResult(type, { studentId: String(student._id), student }, localId);
  }

  if (type === 'student.permissions') {
    const student = await ownStudent(payload.studentId || payload.studentRef || op.studentId, req.user, localMap);
    if (!student) throw Object.assign(new Error('الطالب غير موجود'), { status: 404 });
    student.learningPermissions = { voice: payload.voice === true, camera: payload.camera === true, updatedAt: new Date() };
    await student.save();
    return opResult(type, { studentId: String(student._id), student }, localId);
  }

  if (type === 'schedule.create') {
    const student = await ownStudent(payload.studentId || payload.studentRef, req.user, localMap);
    if (!student) throw Object.assign(new Error('الطالب غير موجود'), { status: 404 });
    const subject = clean(payload.subject).slice(0, 120);
    const when = new Date(payload.scheduledAt);
    if (!subject || Number.isNaN(when.getTime())) throw Object.assign(new Error('بيانات الموعد غير صحيحة'), { status: 400 });
    const durationMinutes = Math.max(10, Math.min(240, Number(payload.durationMinutes) || 45));
    const reminderMinutes = Math.max(0, Math.min(1440, Number(payload.reminderMinutes) || 15));
    const schedule = await Schedule.create({ guardian: req.user._id, student: student._id, subject, title: clean(payload.title) || 'وقت الدراسة', scheduledAt: when, durationMinutes, reminderMinutes });
    return opResult(type, { scheduleId: String(schedule._id), schedule }, localId);
  }

  if (type === 'session.complete') {
    const student = await ownStudent(payload.studentId || payload.studentRef, req.user, localMap);
    if (!student) throw Object.assign(new Error('الطالب غير موجود'), { status: 404 });
    const score = Number(payload.score || 0), maxScore = Number(payload.maxScore || 0), responses = Number(payload.responses || 0), unanswered = Number(payload.unanswered || 0), activeMinutes = Number(payload.activeMinutes || 0);
    if ([score, maxScore, responses, unanswered, activeMinutes].some((x) => !Number.isFinite(x) || x < 0) || (maxScore > 0 && score > maxScore)) throw Object.assign(new Error('بيانات تقييم الحصة غير صحيحة'), { status: 400 });
    const session = await Session.create({ guardian: req.user._id, student: student._id, mode: payload.mode === 'group' ? 'group' : 'individual', subject: clean(payload.subject).slice(0, 120), lesson: clean(payload.lesson).slice(0, 160), status: 'completed', startedAt: payload.startedAt ? new Date(payload.startedAt) : new Date(Date.now() - Math.max(1, activeMinutes) * 60000), endedAt: new Date(), score, maxScore, teacherNote: clean(payload.teacherNote).slice(0, 2000), attention: { responses, unanswered, activeMinutes } });
    await Student.updateOne({ _id: student._id, guardian: req.user._id }, { $inc: { 'progress.sessions': 1 } });
    return opResult(type, { sessionId: String(session._id), session }, localId);
  }

  throw Object.assign(new Error('نوع مزامنة غير معروف'), { status: 400 });
}

router.post('/sync', async (req, res, next) => {
  try {
    const operations = Array.isArray(req.body.operations) ? req.body.operations.slice(0, 100) : [];
    const localMap = new Map();
    const results = [];
    for (const op of operations) {
      const clientOpId = clean(op.clientOpId).slice(0, 160);
      if (!clientOpId) {
        results.push({ ok: false, message: 'clientOpId مطلوب' });
        continue;
      }
      const existing = await SyncOperation.findOne({ guardian: req.user._id, clientOpId }).lean();
      if (existing) {
        if (existing.localId && existing.result?.studentId) localMap.set(existing.localId, String(existing.result.studentId));
        results.push({ ok: existing.status === 'applied', clientOpId, duplicate: true, localId: existing.localId, result: existing.result, message: existing.error || '' });
        continue;
      }
      try {
        const applied = await applyOperation(op, req, localMap);
        await SyncOperation.create({ guardian: req.user._id, clientOpId, type: clean(op.type), localId: applied.localId, status: 'applied', result: applied.result });
        results.push({ ok: true, clientOpId, type: applied.type, localId: applied.localId, result: applied.result });
      } catch (error) {
        const message = error.message || 'تعذرت المزامنة';
        await SyncOperation.create({ guardian: req.user._id, clientOpId, type: clean(op.type), localId: clean(op.localId || op.payload?.localId || ''), status: 'failed', error: message }).catch(() => {});
        results.push({ ok: false, clientOpId, type: clean(op.type), message });
      }
    }
    res.json({ ok: true, results, synced: results.filter((r) => r.ok).length });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
