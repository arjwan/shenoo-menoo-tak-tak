'use strict';

const router = require('express').Router();
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const { attachSchoolContext } = require('../middleware/school-auth');
const Student = require('../models/SchoolStudent');
const Schedule = require('../models/SchoolEventSchedule');
const Assignment = require('../models/SchoolAssignment');
const Submission = require('../models/SchoolAssignmentSubmission');
const Attendance = require('../models/SchoolAttendanceRecord');
const Grade = require('../models/SchoolGradeRecord');
const Report = require('../models/SchoolStudentReport');
const Classroom = require('../models/SchoolClassroom');
const management = require('../services/school-management');

router.use(requireAuth, attachSchoolContext, (req, res, next) => {
  if (!req.schoolContext.isTeacher || !req.schoolContext.teacher || req.schoolContext.isManager || req.schoolContext.isDeveloper) {
    return res.status(403).json({ ok: false, message: 'مساحة العمل للمعلم المعتمد فقط' });
  }
  next();
});

const id = (value) => mongoose.isValidObjectId(value);
async function ownStudent(req, res) {
  if (!id(req.params.studentId)) { res.status(400).json({ ok: false, message: 'معرف الطالب غير صالح' }); return null; }
  const student = await Student.findOne({ _id: req.params.studentId, status: 'active', 'assignedTeachers.teacher': req.schoolContext.teacher._id }).lean();
  if (!student) { res.status(403).json({ ok: false, message: 'الطالب غير مرتبط بهذا المعلم' }); return null; }
  return student;
}
function fail(res, error) { return res.status(error.status && error.status < 500 ? error.status : 500).json({ ok: false, message: error.status ? error.message : 'تعذر إتمام العملية' }); }

router.get('/overview', async (req, res, next) => {
  try {
    const teacher = req.schoolContext.teacher;
    const [students, schedules, assignments, classrooms, reports] = await Promise.all([
      Student.find({ status: 'active', 'assignedTeachers.teacher': teacher._id }).select('name stage grade section subjects assignedTeachers').sort({ name: 1 }).lean(),
      Schedule.find({ teacher: req.user._id }).sort({ scheduledAt: 1 }).limit(100).lean(),
      Assignment.find({ teacher: req.user._id, status: { $ne: 'archived' } }).sort({ createdAt: -1 }).limit(100).lean(),
      Classroom.find({ teacher: req.user._id }).sort({ startedAt: -1 }).limit(30).lean(),
      Report.find({ teacher: teacher._id }).sort({ createdAt: -1 }).limit(50).lean()
    ]);
    const assignmentIds = assignments.map((row) => row._id);
    const submissions = assignmentIds.length ? await Submission.find({ assignment: { $in: assignmentIds } }).populate('student', 'name').sort({ submittedAt: -1 }).limit(150).lean() : [];
    res.json({ ok: true, teacher: { _id: teacher._id, name: teacher.name, subjects: teacher.subjects, stages: teacher.stages, grades: teacher.grades, sections: teacher.sections, scheduleSlots: teacher.scheduleSlots }, students, schedules, assignments, submissions, classrooms, reports });
  } catch (error) { next(error); }
});

router.get('/students/:studentId/record', async (req, res, next) => {
  try {
    const student = await ownStudent(req, res); if (!student) return;
    const [attendance, grades, reports] = await Promise.all([
      Attendance.find({ student: student._id, teacher: req.user._id }).sort({ date: -1 }).limit(100).lean(),
      Grade.find({ student: student._id, teacher: req.user._id }).sort({ recordedAt: -1 }).limit(100).lean(),
      Report.find({ student: student._id, teacher: req.schoolContext.teacher._id }).sort({ createdAt: -1 }).limit(50).lean()
    ]);
    res.json({ ok: true, student: { _id: student._id, name: student.name, stage: student.stage, grade: student.grade, section: student.section, subjects: student.subjects }, attendance, grades, reports });
  } catch (error) { next(error); }
});

router.post('/students/:studentId/attendance', async (req, res) => {
  try {
    const student = await ownStudent(req, res); if (!student) return;
    const status = String(req.body.status || '');
    if (!['present', 'absent', 'late', 'excused'].includes(status)) return res.status(400).json({ ok: false, message: 'حالة الحضور غير صالحة' });
    const record = await management.recordAttendance(req.user, req.schoolContext, { studentId: student._id, status, notes: req.body.notes });
    return res.status(201).json({ ok: true, record });
  } catch (error) { return fail(res, error); }
});

router.post('/students/:studentId/grades', async (req, res) => {
  try {
    const student = await ownStudent(req, res); if (!student) return;
    const subject = String(req.body.subject || '').trim();
    if (!student.assignedTeachers.some((entry) => String(entry.teacher) === String(req.schoolContext.teacher._id) && entry.subject === subject)) return res.status(403).json({ ok: false, message: 'المادة خارج تكليفك لهذا الطالب' });
    const grade = await management.recordGrade(req.user, req.schoolContext, { ...req.body, studentId: student._id });
    return res.status(201).json({ ok: true, grade });
  } catch (error) { return fail(res, error); }
});

router.post('/students/:studentId/reports', async (req, res, next) => {
  try {
    const student = await ownStudent(req, res); if (!student) return;
    const subject = String(req.body.subject || '').trim();
    if (!student.assignedTeachers.some((entry) => String(entry.teacher) === String(req.schoolContext.teacher._id) && entry.subject === subject)) return res.status(403).json({ ok: false, message: 'المادة خارج تكليفك لهذا الطالب' });
    const report = await Report.create({ student: student._id, teacher: req.schoolContext.teacher._id, createdBy: req.user._id, subject, level: req.body.level, participation: req.body.participation, homework: req.body.homework, learningBehavior: req.body.learningBehavior, recommendations: req.body.recommendations, visibleToGuardian: req.body.visibleToGuardian !== false });
    res.status(201).json({ ok: true, report });
  } catch (error) { next(error); }
});

module.exports = router;
