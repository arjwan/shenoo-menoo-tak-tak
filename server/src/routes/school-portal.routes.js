'use strict';

const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { attachSchoolContext, requireSchoolManager, requireSchoolStaff } = require('../middleware/school-auth');
const User = require('../models/User');
const Student = require('../models/SchoolStudent');
const Teacher = require('../models/SchoolTeacher');
const Guardian = require('../models/SchoolGuardian');
const Enrollment = require('../models/SchoolEnrollmentRequest');
const Announcement = require('../models/SchoolAnnouncement');
const StudentReport = require('../models/SchoolStudentReport');
const Grade = require('../models/SchoolGradeRecord');
const Attendance = require('../models/SchoolAttendanceRecord');
const Event = require('../models/SchoolEventSchedule');
const StaffRequest = require('../models/SchoolStaffRequest');
const VirtualTeacher = require('../models/VirtualTeacherProfile');

router.use(requireAuth, attachSchoolContext);
const clean = (value) => String(value == null ? '' : value).trim();
const ids = (rows) => rows.map((row) => row._id);

async function visibleStudents(req) {
  const context = req.schoolContext || {};
  if (context.isManager || context.isDeveloper) return Student.find({ active: true }).sort({ name: 1 }).lean();
  if (context.isTeacher && context.teacher) return Student.find({ _id: { $in: context.teacher.assignedStudents || [] }, active: true }).sort({ name: 1 }).lean();
  if (context.isStudent && context.studentProfile) return [context.studentProfile];
  if (context.isGuardian) return Student.find({ $or: [{ guardian: req.user._id }, { _id: { $in: context.guardian?.students || [] } }], active: true }).sort({ name: 1 }).lean();
  return [];
}

router.get('/bootstrap', async (req, res, next) => {
  try {
    const students = await visibleStudents(req);
    const studentIds = ids(students);
    const role = req.schoolContext.role;
    const audience = role === 'manager' || role === 'developer' ? ['all', 'student', 'teacher', 'guardian'] : ['all', role];
    const now = new Date();
    const eventScope = req.schoolContext.isTeacher
      ? { teacher: req.user._id }
      : (req.schoolContext.isManager || req.schoolContext.isDeveloper)
        ? {}
        : { $or: [{ students: { $in: studentIds } }, ...students.map((s) => ({ stage: s.stage, grade: s.grade }))] };
    const reportScope = (req.schoolContext.isManager || req.schoolContext.isDeveloper)
      ? {}
      : req.schoolContext.isTeacher && req.schoolContext.teacher
        ? { teacher: req.schoolContext.teacher._id }
        : { student: { $in: studentIds }, ...(role === 'guardian' ? { visibleToGuardian: true } : {}) };
    const staffRequestScope = (req.schoolContext.isManager || req.schoolContext.isDeveloper)
      ? {}
      : req.schoolContext.isTeacher && req.schoolContext.teacher
        ? { teacher: req.schoolContext.teacher._id }
        : { _id: null };
    const [teachers, virtualTeacherRows, announcements, schedules, grades, attendance, reports, enrollment, pendingRequests, staffRequests] = await Promise.all([
      Teacher.find({ status: 'active', ...(req.schoolContext.isTeacher ? { _id: req.schoolContext.teacher._id } : {}) }).populate('user', 'fullName username profile.avatarUrl').sort({ name: 1 }).lean(),
      VirtualTeacher.find({ active: true }).sort({ name: 1 }).lean(),
      Announcement.find({ active: true, audience: { $in: audience } }).populate('publishedBy', 'fullName').sort({ publishedAt: -1 }).limit(20).lean(),
      Event.find({ ...eventScope, scheduledAt: { $gte: new Date(now.getTime() - 6 * 60 * 60 * 1000) } }).sort({ scheduledAt: 1 }).limit(40).lean(),
      studentIds.length ? Grade.find({ student: { $in: studentIds } }).sort({ recordedAt: -1 }).limit(80).lean() : [],
      studentIds.length ? Attendance.find({ student: { $in: studentIds } }).sort({ date: -1 }).limit(80).lean() : [],
      StudentReport.find(reportScope).populate('student', 'name stage grade').populate({ path: 'teacher', select: 'name subjects user', populate: { path: 'user', select: 'profile.avatarUrl' } }).sort({ createdAt: -1 }).limit(60).lean(),
      Enrollment.findOne({ user: req.user._id }).sort({ createdAt: -1 }).lean(),
      (req.schoolContext.isManager || req.schoolContext.isDeveloper) ? Enrollment.find({ status: 'pending' }).populate('user', 'fullName username phone email profile.avatarUrl').sort({ createdAt: 1 }).lean() : [],
      StaffRequest.find(staffRequestScope).populate('teacher', 'name subjects').populate('reviewedBy', 'fullName').sort({ createdAt: -1 }).limit(80).lean()
    ]);
    const builtinVirtualTeachers = VirtualTeacher.getBuiltinProfiles();
    // Phase 7 exposes only the three approved personas. Older database rows
    // remain stored but cannot silently reappear in the public teacher list.
    const virtualTeachers = builtinVirtualTeachers;
    res.json({
      ok: true,
      user: { id: req.user._id, fullName: req.user.fullName, username: req.user.username, role: req.user.role, avatarUrl: req.user.profile?.avatarUrl || '' },
      schoolContext: { role, isManager: Boolean(req.schoolContext.isManager), isTeacher: Boolean(req.schoolContext.isTeacher), isGuardian: Boolean(req.schoolContext.isGuardian), isStudent: Boolean(req.schoolContext.isStudent) },
      profile: req.schoolContext.teacher || req.schoolContext.guardian || req.schoolContext.studentProfile || null,
      students, teachers, virtualTeachers, announcements, schedules, grades, attendance, reports, enrollment, pendingRequests, staffRequests,
      links: { liveClass: '/school-live.html', virtualClassroom: '/school-virtual-classroom.html', reader: '/school-reader.html', curriculum: '/school-curriculum.html', messages: '/messages.html' }
    });
  } catch (error) { next(error); }
});

router.post('/enrollment', async (req, res, next) => {
  try {
    const requestedRole = clean(req.body.requestedRole);
    if (!['student', 'teacher'].includes(requestedRole)) return res.status(400).json({ ok: false, message: 'يمكن طلب حساب طالب أو معلم فقط' });
    const request = await Enrollment.findOneAndUpdate(
      { user: req.user._id, requestedRole },
      { $setOnInsert: { user: req.user._id, requestedRole }, $set: { stage: req.body.stage || 'ابتدائي', grade: clean(req.body.grade), subjects: Array.isArray(req.body.subjects) ? req.body.subjects.map(clean).filter(Boolean).slice(0, 20) : [], note: clean(req.body.note).slice(0, 1000), status: 'pending', reviewedBy: null, reviewedAt: null, rejectionReason: '' } },
      { upsert: true, new: true, runValidators: true }
    );
    res.status(201).json({ ok: true, request, message: 'تم إرسال الطلب إلى إدارة مدرسة سومر' });
  } catch (error) { next(error); }
});

router.get('/enrollment/teacher-requests', requireSchoolManager, async (req, res, next) => {
  try {
    const requests = await Enrollment.find({ requestedRole: 'teacher', status: 'pending' })
      .populate('user', 'fullName username phone email profile.avatarUrl')
      .sort({ createdAt: 1 }).lean();
    res.json({ ok: true, requests });
  } catch (error) { next(error); }
});

router.patch('/enrollment/:id/review', requireSchoolManager, async (req, res, next) => {
  try {
    const decision = clean(req.body.decision);
    if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ ok: false, message: 'قرار المراجعة غير صالح' });
    const request = await Enrollment.findById(req.params.id).populate('user');
    if (!request || request.status !== 'pending') return res.status(404).json({ ok: false, message: 'الطلب غير موجود أو تمت مراجعته' });
    if (decision === 'approved' && request.requestedRole === 'teacher') {
      await Teacher.findOneAndUpdate({ user: request.user._id }, { user: request.user._id, name: request.user.fullName, phone: request.user.phone || '', subjects: request.subjects, stages: [request.stage], grades: request.grade ? [request.grade] : [], status: 'active', registeredBy: req.user._id }, { upsert: true, new: true, runValidators: true });
    }
    if (decision === 'approved' && request.requestedRole === 'student') {
      await Student.findOneAndUpdate({ studentUser: request.user._id }, { studentUser: request.user._id, name: request.user.fullName, stage: request.stage, grade: request.grade || 'غير محدد', subjects: request.subjects, active: true, 'subscription.status': 'active' }, { upsert: true, new: true, runValidators: true });
    }
    request.status = decision;
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    request.rejectionReason = decision === 'rejected' ? clean(req.body.reason).slice(0, 1000) : '';
    await request.save();
    res.json({ ok: true, request, message: decision === 'approved' ? 'تمت الموافقة وربط الحساب بمدرسة سومر' : 'تم رفض الطلب' });
  } catch (error) { next(error); }
});

router.post('/announcements', requireSchoolManager, async (req, res, next) => {
  try {
    const title = clean(req.body.title), body = clean(req.body.body);
    if (!title || !body) return res.status(400).json({ ok: false, message: 'عنوان التعميم ونصه مطلوبان' });
    const announcement = await Announcement.create({ title, body, audience: ['all', 'student', 'teacher', 'guardian'].includes(req.body.audience) ? req.body.audience : 'all', stage: clean(req.body.stage), grade: clean(req.body.grade), publishedBy: req.user._id });
    res.status(201).json({ ok: true, announcement, message: 'تم نشر تعميم الإدارة' });
  } catch (error) { next(error); }
});

router.post('/reports', requireSchoolStaff, async (req, res, next) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user._id, status: 'active' });
    if (!teacher) return res.status(403).json({ ok: false, message: 'كتابة التقارير مخصصة لحساب معلم معتمد' });
    const student = await Student.findOne({ _id: req.body.studentId, active: true });
    if (!student) return res.status(404).json({ ok: false, message: 'الطالب غير موجود' });
    if (teacher && !(teacher.assignedStudents || []).some((id) => String(id) === String(student._id))) return res.status(403).json({ ok: false, message: 'الطالب غير مرتبط بهذا المعلم' });
    const report = await StudentReport.create({ student: student._id, teacher: teacher._id, subject: clean(req.body.subject), level: ['excellent', 'good', 'needs_support'].includes(req.body.level) ? req.body.level : 'good', participation: clean(req.body.participation), homework: clean(req.body.homework), learningBehavior: clean(req.body.learningBehavior), recommendations: clean(req.body.recommendations), visibleToGuardian: req.body.visibleToGuardian !== false, createdBy: req.user._id });
    res.status(201).json({ ok: true, report, message: 'تم حفظ تقرير المعلم' });
  } catch (error) { next(error); }
});

router.post('/staff-requests', requireSchoolStaff, async (req, res, next) => {
  try {
    if (!req.schoolContext.isTeacher || !req.schoolContext.teacher) return res.status(403).json({ ok: false, message: 'إرسال الطلبات مخصص لحساب المعلم المعتمد' });
    const title = clean(req.body.title), details = clean(req.body.details);
    if (!title || !details) return res.status(400).json({ ok: false, message: 'عنوان الطلب وتفاصيله مطلوبان' });
    const type = ['schedule', 'curriculum', 'student_support', 'permission', 'other'].includes(req.body.type) ? req.body.type : 'other';
    const request = await StaffRequest.create({ teacher: req.schoolContext.teacher._id, createdBy: req.user._id, type, title, details });
    res.status(201).json({ ok: true, request, message: 'تم إرسال الطلب إلى الإدارة' });
  } catch (error) { next(error); }
});

router.patch('/staff-requests/:id/review', requireSchoolManager, async (req, res, next) => {
  try {
    const decision = clean(req.body.decision);
    if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ ok: false, message: 'قرار المراجعة غير صالح' });
    const request = await StaffRequest.findById(req.params.id);
    if (!request || request.status !== 'pending') return res.status(404).json({ ok: false, message: 'الطلب غير موجود أو تمت مراجعته' });
    request.status = decision;
    request.response = clean(req.body.response).slice(0, 3000);
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    await request.save();
    res.json({ ok: true, request, message: decision === 'approved' ? 'تمت الموافقة على طلب المعلم' : 'تم رفض طلب المعلم' });
  } catch (error) { next(error); }
});

router.get('/directory', async (req, res, next) => {
  try {
    const students = await visibleStudents(req);
    const teachers = await Teacher.find({ status: 'active', ...(req.schoolContext.isTeacher ? { _id: req.schoolContext.teacher._id } : {}) }).populate('user', 'fullName username profile.avatarUrl').select('name subjects stages grades sections assignedStudents user').lean();
    res.json({ ok: true, students, teachers });
  } catch (error) { next(error); }
});

module.exports = router;
