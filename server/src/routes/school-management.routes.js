'use strict';

const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const {
  attachSchoolContext,
  requireSchoolManager,
  requireSchoolStaff
} = require('../middleware/school-auth');
const managementService = require('../services/school-management');

// All school management endpoints require authenticated user
router.use(requireAuth);
router.use(attachSchoolContext);

// --------------------------------------------------------------------------
// Level 2 Security Barrier: Prevent Role Tampering & Privilege Escalation
// --------------------------------------------------------------------------
// Platform account roles ('role') are strictly immutable via school management.
// Any attempt to modify or inject 'role' via school management endpoints
// is rejected with 403 unless the actor is a platform admin or developer,
// and developer role cannot be granted except by a developer.
router.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && req.body.role !== undefined) {
    const isPlatformPrivileged = req.user && (req.user.role === 'developer' || req.user.role === 'admin');
    if (!isPlatformPrivileged) {
      return res.status(403).json({
        ok: false,
        message: 'تعديل أدوار الحسابات محصور بإدارة المنصة العليا (admin/developer) فقط لمنع تصعيد الصلاحيات'
      });
    }
    if (req.body.role === 'developer' && req.user.role !== 'developer') {
      return res.status(403).json({
        ok: false,
        message: 'لا يمكن منح رتبة المطور إلا من قبل مطور معتمد'
      });
    }
  }
  next();
});

// --------------------------------------------------------------------------
// Current User & Context
// --------------------------------------------------------------------------
router.get('/me', (req, res) => {
  res.json({
    ok: true,
    user: {
      id: String(req.user._id),
      fullName: req.user.fullName,
      username: req.user.username,
      role: req.user.role,
      phone: req.user.phone
    },
    schoolContext: req.schoolContext
  });
});

// --------------------------------------------------------------------------
// Real Users Search (Never invent fake accounts!)
// --------------------------------------------------------------------------
router.get('/users/search', async (req, res, next) => {
  try {
    const results = await managementService.searchRealUsers(req.query.q);
    res.json({ ok: true, users: results });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------------------
// Real & Virtual Teachers
// --------------------------------------------------------------------------
router.get('/teachers', async (req, res, next) => {
  try {
    const [realTeachers, virtualTeachers] = await Promise.all([
      managementService.listRealTeachers(req.query),
      managementService.listVirtualTeachers()
    ]);
    res.json({
      ok: true,
      realTeachers,
      virtualTeachers,
      counts: {
        real: realTeachers.length,
        virtual: virtualTeachers.length
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/teachers', requireSchoolManager, async (req, res, next) => {
  try {
    const teacher = await managementService.registerTeacher(req.user, req.body);
    res.status(201).json({ ok: true, teacher, message: 'تم تسجيل المعلم الحقيقي بنجاح' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
    next(err);
  }
});

router.put('/teachers/:id', requireSchoolManager, async (req, res, next) => {
  try {
    const teacher = await managementService.updateTeacher(req.user, req.schoolContext, req.params.id, req.body);
    res.json({ ok: true, teacher, message: 'تم تحديث بيانات المعلم بنجاح' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
    next(err);
  }
});

router.delete('/teachers/:id', requireSchoolManager, async (req, res, next) => {
  try {
    const result = await managementService.archiveTeacher(
      req.user,
      req.schoolContext,
      req.params.id,
      req.body.reason
    );
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
    next(err);
  }
});

router.get('/teachers/:id/record', async (req, res, next) => {
  try {
    const record = await managementService.getTeacherRecord(req.user, req.schoolContext, req.params.id);
    res.json({ ok: true, record });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
    next(err);
  }
});

// --------------------------------------------------------------------------
// Students & Permanent Records
// --------------------------------------------------------------------------
router.get('/students', async (req, res, next) => {
  try {
    const students = await managementService.listStudents(req.user, req.schoolContext, req.query);
    res.json({ ok: true, students, count: students.length });
  } catch (err) {
    next(err);
  }
});

router.post('/students', requireSchoolStaff, async (req, res, next) => {
  try {
    const student = await managementService.registerStudent(req.user, req.schoolContext, req.body);
    res.status(201).json({ ok: true, student, message: 'تم تسجيل الطالب بنجاح' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
    next(err);
  }
});

router.put('/students/:id', requireSchoolStaff, async (req, res, next) => {
  try {
    const student = await managementService.updateStudent(req.user, req.schoolContext, req.params.id, req.body);
    res.json({ ok: true, student, message: 'تم تحديث بيانات الطالب' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
    next(err);
  }
});

router.delete('/students/:id', requireSchoolManager, async (req, res, next) => {
  try {
    const result = await managementService.archiveStudent(
      req.user,
      req.schoolContext,
      req.params.id,
      req.body.reason
    );
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
    next(err);
  }
});

router.get('/students/:id/record', async (req, res, next) => {
  try {
    const record = await managementService.getStudentPermanentRecord(req.user, req.schoolContext, req.params.id);
    res.json({ ok: true, record });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
    next(err);
  }
});

// --------------------------------------------------------------------------
// Guardians & Consents (Auditable Opt-in)
// --------------------------------------------------------------------------
router.get('/guardians', async (req, res, next) => {
  try {
    const guardians = await managementService.listGuardians(req.user, req.schoolContext);
    res.json({ ok: true, guardians });
  } catch (err) {
    next(err);
  }
});

router.get('/students/:id/consents', async (req, res, next) => {
  try {
    const result = await managementService.getStudentConsents(req.user, req.schoolContext, req.params.id);
    res.json({ ok: true, ...result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
    next(err);
  }
});

router.post('/students/:id/consents', async (req, res, next) => {
  try {
    const consent = await managementService.updateGuardianConsent(
      req.user,
      req.schoolContext,
      req.params.id,
      req.body
    );
    res.json({ ok: true, consent, message: 'تم تسجيل قرار الموافقة بنجاح' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
    next(err);
  }
});

// --------------------------------------------------------------------------
// Unified Schedules & Calendar (LIVE_CLASS, RECORDED_REPLAY, GENERAL_REVIEW, EXAM)
// --------------------------------------------------------------------------
router.get('/schedules', async (req, res, next) => {
  try {
    const schedules = await managementService.listSchedules(req.user, req.schoolContext, req.query);
    res.json({ ok: true, schedules });
  } catch (err) {
    next(err);
  }
});

router.post('/schedules', requireSchoolStaff, async (req, res, next) => {
  try {
    const schedule = await managementService.createScheduleEvent(req.user, req.schoolContext, req.body);
    res.status(201).json({
      ok: true,
      schedule,
      message: schedule.type === 'EXAM' ? 'تم تحديد موعد الاختبار وإبلاغ الإدارة والطلاب' : 'تمت جدولة الموعد بنجاح'
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
    next(err);
  }
});

// --------------------------------------------------------------------------
// Grades & Attendance
// --------------------------------------------------------------------------
router.post('/grades', requireSchoolStaff, async (req, res, next) => {
  try {
    const grade = await managementService.recordGrade(req.user, req.schoolContext, req.body);
    res.status(201).json({ ok: true, grade, message: 'تم رصد الدرجة وحفظها في السجل الأكاديمي' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
    next(err);
  }
});

router.post('/attendance', requireSchoolStaff, async (req, res, next) => {
  try {
    const record = await managementService.recordAttendance(req.user, req.schoolContext, req.body);
    res.status(201).json({ ok: true, record, message: 'تم تسجيل الحضور في السجل الأكاديمي' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
    next(err);
  }
});

// --------------------------------------------------------------------------
// Guardian Complaints
// --------------------------------------------------------------------------
router.get('/complaints', async (req, res, next) => {
  try {
    const complaints = await managementService.listComplaints(req.user, req.schoolContext);
    res.json({ ok: true, complaints });
  } catch (err) {
    next(err);
  }
});

router.post('/complaints', async (req, res, next) => {
  try {
    const complaint = await managementService.createComplaint(req.user, req.body);
    res.status(201).json({ ok: true, complaint, message: 'تم إرسال الشكوى إلى إدارة المدرسة' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
    next(err);
  }
});

router.patch('/complaints/:id/reply', requireSchoolManager, async (req, res, next) => {
  try {
    const complaint = await managementService.replyToComplaint(
      req.user,
      req.schoolContext,
      req.params.id,
      req.body
    );
    res.json({ ok: true, complaint, message: 'تم تسجيل رد الإدارة وتحديث حالة الشكوى' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
    next(err);
  }
});

// --------------------------------------------------------------------------
// Audit Log Query
// --------------------------------------------------------------------------
router.get('/audit-logs', requireSchoolManager, async (req, res, next) => {
  try {
    const logs = await managementService.listAuditLogs(req.schoolContext, Number(req.query.limit) || 100);
    res.json({ ok: true, logs });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
    next(err);
  }
});

module.exports = router;
