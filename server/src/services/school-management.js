'use strict';

const mongoose = require('mongoose');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const SchoolStudent = require('../models/SchoolStudent');
const SchoolTeacher = require('../models/SchoolTeacher');
const SchoolGuardian = require('../models/SchoolGuardian');
const GuardianConsent = require('../models/GuardianConsent');
const SchoolEventSchedule = require('../models/SchoolEventSchedule');
const SchoolGradeRecord = require('../models/SchoolGradeRecord');
const SchoolAttendanceRecord = require('../models/SchoolAttendanceRecord');
const GuardianComplaint = require('../models/GuardianComplaint');
const VirtualTeacherProfile = require('../models/VirtualTeacherProfile');
const SchoolSession = require('../models/SchoolSession');
const SchoolClassroom = require('../models/SchoolClassroom');
const VirtualClassroomSession = require('../models/VirtualClassroomSession');

const { CONSENT_TYPES } = require('../models/GuardianConsent');

async function logAudit(actorId, action, targetId = null, details = '') {
  try {
    await AuditLog.create({
      actor: actorId,
      action: String(action).slice(0, 80),
      target: targetId && mongoose.isValidObjectId(targetId) ? targetId : null,
      details: String(details).slice(0, 500)
    });
  } catch (err) {
    console.error('AuditLog write error:', err.message);
  }
}

// --------------------------------------------------------------------------
// 1. Search Real Users (Never create fake users!)
// --------------------------------------------------------------------------
async function searchRealUsers(query, limit = 20) {
  const q = String(query || '').trim();
  if (!q) return [];
  const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return User.find({
    status: 'active',
    $or: [{ username: regex }, { fullName: regex }, { phone: regex }, { friendCode: regex }]
  })
    .select('_id fullName username phone email gender role friendCode profile.avatarUrl')
    .limit(limit)
    .lean();
}

// --------------------------------------------------------------------------
// 2. Real Teachers Management
// --------------------------------------------------------------------------
async function listRealTeachers(filters = {}) {
  const query = {};
  if (filters.status) query.status = filters.status;
  if (filters.stage) query.stages = filters.stage;
  if (filters.grade) query.grades = filters.grade;
  if (filters.subject) query.subjects = filters.subject;

  return SchoolTeacher.find(query)
    .populate('user', 'fullName username phone email gender role friendCode profile.avatarUrl')
    .sort({ createdAt: -1 })
    .lean();
}

async function listVirtualTeachers() {
  const list = await VirtualTeacherProfile.find({ active: true }).sort({ sortOrder: 1 }).lean();
  return list.map((t) => ({
    ...t,
    isVirtual: true,
    badgeText: 'معلم افتراضي / AI'
  }));
}

async function registerTeacher(actorUser, data) {
  const { userId, name, gender, phone, subjects, stages, grades, sections, scheduleSlots } = data;
  if (!userId || !name) {
    const err = new Error('معرف الحساب والاسم مطلوبان لتسجيل المعلم');
    err.status = 400;
    throw err;
  }

  const user = await User.findById(userId);
  if (!user || user.status !== 'active') {
    const err = new Error('الحساب المرتبط غير موجود أو غير مفعّل في شنو منو');
    err.status = 404;
    throw err;
  }

  const existing = await SchoolTeacher.findOne({ user: user._id, status: 'active' });
  if (existing) {
    const err = new Error('هذا الحساب مسجل كمعلم مسبقاً');
    err.status = 409;
    throw err;
  }

  const teacher = await SchoolTeacher.create({
    user: user._id,
    name: String(name).trim(),
    gender: gender || (user.gender === 'female' ? 'أنثى' : 'ذكر'),
    phone: String(phone || user.phone || '').trim(),
    subjects: Array.isArray(subjects) ? subjects.filter(Boolean) : [],
    stages: Array.isArray(stages) ? stages.filter(Boolean) : [],
    grades: Array.isArray(grades) ? grades.filter(Boolean) : [],
    sections: Array.isArray(sections) ? sections.filter(Boolean) : ['أ'],
    scheduleSlots: Array.isArray(scheduleSlots) ? scheduleSlots : [],
    registeredBy: actorUser._id
  });

  await logAudit(actorUser._id, 'TEACHER_REGISTERED', user._id, `تم تسجيل المعلم: ${teacher.name}`);
  await teacher.populate('user', 'fullName username phone email gender role');
  return teacher;
}

async function updateTeacher(actorUser, schoolContext, teacherId, updates) {
  const teacher = await SchoolTeacher.findById(teacherId).populate('user');
  if (!teacher) {
    const err = new Error('المعلم غير موجود');
    err.status = 404;
    throw err;
  }

  // Developer protection constraint:
  // "المدير لا يستطيع رفع نفسه إلى Developer ولا تعديل حساب Developer."
  if (teacher.user && teacher.user.role === 'developer' && !schoolContext.isDeveloper) {
    const err = new Error('لا يمكن للمدير تعديل حساب المطور');
    err.status = 403;
    throw err;
  }

  const allowedFields = ['name', 'gender', 'phone', 'subjects', 'stages', 'grades', 'sections', 'scheduleSlots'];
  for (const f of allowedFields) {
    if (updates[f] !== undefined) teacher[f] = updates[f];
  }

  await teacher.save();
  await logAudit(actorUser._id, 'TEACHER_UPDATED', teacher.user?._id || teacher._id, `تحديث بيانات المعلم: ${teacher.name}`);
  return teacher;
}

async function archiveTeacher(actorUser, schoolContext, teacherId, reason = '') {
  const teacher = await SchoolTeacher.findById(teacherId).populate('user');
  if (!teacher) {
    const err = new Error('المعلم غير موجود');
    err.status = 404;
    throw err;
  }

  if (teacher.user && teacher.user.role === 'developer' && !schoolContext.isDeveloper) {
    const err = new Error('لا يمكن للمدير أرشفة حساب المطور');
    err.status = 403;
    throw err;
  }

  // Archive instead of destructive deletion: preserves permanent academic history
  teacher.status = 'archived';
  await teacher.save();

  await logAudit(actorUser._id, 'TEACHER_ARCHIVED', teacher.user?._id || teacher._id, `أرشفة المعلم: ${teacher.name} — السبب: ${reason || 'لا يوجد'}`);
  return { ok: true, message: 'تمت أرشفة المعلم بنجاح مع الاحتفاظ بسجلاته الدائمة', teacher };
}

async function getTeacherRecord(actorUser, schoolContext, teacherId) {
  const teacher = await SchoolTeacher.findById(teacherId)
    .populate('user', 'fullName username phone email gender role friendCode profile')
    .lean();
  if (!teacher) {
    const err = new Error('المعلم غير موجود');
    err.status = 404;
    throw err;
  }

  const [assignedStudents, schedules, liveClassrooms, gradeRecords, attendanceRecords, auditLogs] = await Promise.all([
    SchoolStudent.find({
      $or: [{ 'assignedTeachers.teacher': teacher._id }, { _id: { $in: teacher.assignedStudents || [] } }],
      status: { $ne: 'archived' }
    })
      .select('name stage grade section subjects progress')
      .lean(),
    SchoolEventSchedule.find({ teacher: teacher.user._id }).sort({ scheduledAt: -1 }).limit(50).lean(),
    SchoolClassroom.find({ teacher: teacher.user._id }).sort({ createdAt: -1 }).limit(30).lean(),
    SchoolGradeRecord.find({ teacher: teacher.user._id }).sort({ recordedAt: -1 }).limit(50).lean(),
    SchoolAttendanceRecord.find({ teacher: teacher.user._id }).sort({ date: -1 }).limit(50).lean(),
    AuditLog.find({ $or: [{ actor: teacher.user._id }, { target: teacher.user._id }] }).sort({ createdAt: -1 }).limit(30).lean()
  ]);

  return {
    teacher,
    assignedStudents,
    schedules,
    liveClassrooms,
    gradeRecords,
    attendanceRecords,
    auditLogs
  };
}

// --------------------------------------------------------------------------
// 3. Students Management & Permanent Academic Record
// --------------------------------------------------------------------------
async function listStudents(actorUser, schoolContext, filters = {}) {
  const query = {};
  if (filters.status) query.status = filters.status;
  else if (!filters.includeArchived) query.status = { $ne: 'archived' };

  if (filters.stage) query.stage = filters.stage;
  if (filters.grade) query.grade = filters.grade;
  if (filters.section) query.section = filters.section;

  // Role scoping:
  if (schoolContext.isGuardian) {
    query.guardian = actorUser._id;
  } else if (schoolContext.isTeacher) {
    query.$or = [
      { 'assignedTeachers.teacher': schoolContext.teacher._id },
      { stage: { $in: schoolContext.teacher.stages || [] }, grade: { $in: schoolContext.teacher.grades || [] } }
    ];
  } else if (schoolContext.isStudent) {
    query.studentUser = actorUser._id;
  }

  return SchoolStudent.find(query)
    .populate('guardian', 'fullName username phone email')
    .populate('studentUser', 'fullName username phone email')
    .populate('assignedTeachers.teacher', 'name subjects')
    .populate('assignedVirtualTeacher', 'name subject avatarUrl')
    .sort({ createdAt: -1 })
    .lean();
}

async function registerStudent(actorUser, schoolContext, data) {
  const { name, stage, grade, section, subjects, guardianId, studentUserId, assignedTeachers, assignedVirtualTeacherId } = data;

  if (!name || !stage || !grade || !guardianId) {
    const err = new Error('اسم الطالب والمرحلة والصف وولي الأمر مطلوبة');
    err.status = 400;
    throw err;
  }

  const guardian = await User.findById(guardianId);
  if (!guardian) {
    const err = new Error('حساب ولي الأمر غير موجود في شنو منو');
    err.status = 404;
    throw err;
  }

  let studentUser = null;
  if (studentUserId) {
    studentUser = await User.findById(studentUserId);
    if (!studentUser) {
      const err = new Error('حساب الطالب المحدد غير موجود');
      err.status = 404;
      throw err;
    }
  }

  // Teacher scoping constraint:
  if (schoolContext.isTeacher) {
    const t = schoolContext.teacher;
    if (t.stages.length && !t.stages.includes(stage)) {
      const err = new Error('لا تملك صلاحية إضافة طالب خارج مرحلتك الدراسية');
      err.status = 403;
      throw err;
    }
  }

  let virtualTeacher = null;
  if (assignedVirtualTeacherId && mongoose.isValidObjectId(assignedVirtualTeacherId)) {
    virtualTeacher = await VirtualTeacherProfile.findById(assignedVirtualTeacherId);
  }

  const student = await SchoolStudent.create({
    guardian: guardian._id,
    studentUser: studentUser ? studentUser._id : null,
    name: String(name).trim(),
    stage,
    grade: String(grade).trim(),
    section: String(section || 'أ').trim(),
    subjects: Array.isArray(subjects) ? subjects.filter(Boolean) : [],
    assignedTeachers: Array.isArray(assignedTeachers) ? assignedTeachers : [],
    assignedVirtualTeacher: virtualTeacher ? virtualTeacher._id : null,
    registeredBy: actorUser._id,
    registrationDate: new Date(),
    status: 'active',
    parentApproved: true
  });

  // Ensure SchoolGuardian profile exists and links this student
  let guardianProfile = await SchoolGuardian.findOne({ user: guardian._id });
  if (!guardianProfile) {
    guardianProfile = await SchoolGuardian.create({
      user: guardian._id,
      name: guardian.fullName || guardian.username,
      contactPhone: guardian.phone || '',
      students: [student._id]
    });
  } else {
    if (!guardianProfile.students.includes(student._id)) {
      guardianProfile.students.push(student._id);
      await guardianProfile.save();
    }
  }

  await logAudit(actorUser._id, 'STUDENT_REGISTERED', guardian._id, `تسجيل طالب جديد: ${student.name} (الصف: ${student.grade} - الشعبة: ${student.section})`);

  await student.populate([
    { path: 'guardian', select: 'fullName username phone email' },
    { path: 'assignedTeachers.teacher', select: 'name subjects' },
    { path: 'assignedVirtualTeacher', select: 'name subject avatarUrl' }
  ]);
  return student;
}

async function updateStudent(actorUser, schoolContext, studentId, updates) {
  const student = await SchoolStudent.findById(studentId);
  if (!student) {
    const err = new Error('الطالب غير موجود');
    err.status = 404;
    throw err;
  }

  // Teacher scoping
  if (schoolContext.isTeacher) {
    const isAssigned = student.assignedTeachers?.some(
      (at) => String(at.teacher) === String(schoolContext.teacher._id)
    );
    if (!isAssigned && (!schoolContext.teacher.grades.includes(student.grade) || !schoolContext.teacher.stages.includes(student.stage))) {
      const err = new Error('ليس لديك صلاحية تعديل بيانات هذا الطالب');
      err.status = 403;
      throw err;
    }
  }

  const allowedFields = ['name', 'stage', 'grade', 'section', 'subjects', 'assignedTeachers', 'assignedVirtualTeacher'];
  for (const f of allowedFields) {
    if (updates[f] !== undefined) student[f] = updates[f];
  }

  await student.save();
  await logAudit(actorUser._id, 'STUDENT_UPDATED', student.guardian, `تحديث بيانات الطالب: ${student.name}`);
  return student;
}

async function archiveStudent(actorUser, schoolContext, studentId, reason = '') {
  const student = await SchoolStudent.findById(studentId);
  if (!student) {
    const err = new Error('الطالب غير موجود');
    err.status = 404;
    throw err;
  }

  if (!schoolContext.isManager && !schoolContext.isDeveloper) {
    const err = new Error('أرشفة الطالب تتطلب صلاحية مدير المدرسة أو المطور');
    err.status = 403;
    throw err;
  }

  // Never delete academic record: archive with audit log
  student.status = 'archived';
  student.active = false;
  await student.save();

  await logAudit(actorUser._id, 'STUDENT_ARCHIVED', student.guardian, `أرشفة الطالب: ${student.name} — السبب: ${reason || 'لا يوجد'}`);
  return { ok: true, message: 'تمت أرشفة الطالب بنجاح مع الاحتفاظ بكامل سجله الأكاديمي', student };
}

async function getStudentPermanentRecord(actorUser, schoolContext, studentId) {
  const student = await SchoolStudent.findById(studentId)
    .populate('guardian', 'fullName username phone email')
    .populate('studentUser', 'fullName username phone email')
    .populate('assignedTeachers.teacher', 'name subjects phone')
    .populate('assignedVirtualTeacher', 'name subject avatarUrl')
    .lean();

  if (!student) {
    const err = new Error('الطالب غير موجود');
    err.status = 404;
    throw err;
  }

  // Guardian scoping: guardian can only see own student
  if (schoolContext.isGuardian && String(student.guardian?._id) !== String(actorUser._id)) {
    const err = new Error('لا يمكنك الاطلاع إلا على سجلات طلابك فقط');
    err.status = 403;
    throw err;
  }

  const [
    attendanceRecords,
    gradeRecords,
    schedules,
    sessions,
    virtualSessions,
    complaints,
    consents
  ] = await Promise.all([
    SchoolAttendanceRecord.find({ student: student._id }).populate('teacher', 'fullName username').sort({ date: -1 }).lean(),
    SchoolGradeRecord.find({ student: student._id }).populate('teacher', 'fullName username').sort({ recordedAt: -1 }).lean(),
    SchoolEventSchedule.find({
      $or: [{ students: student._id }, { stage: student.stage, grade: student.grade }]
    }).sort({ scheduledAt: -1 }).limit(30).lean(),
    SchoolSession.find({ student: student._id }).sort({ startedAt: -1 }).limit(30).lean(),
    VirtualClassroomSession.find({ student: student._id }).sort({ createdAt: -1 }).limit(30).lean(),
    GuardianComplaint.find({ student: student._id }).sort({ createdAt: -1 }).lean(),
    GuardianConsent.find({ student: student._id }).lean()
  ]);

  return {
    student,
    attendanceRecords,
    gradeRecords,
    schedules,
    sessions,
    virtualSessions,
    complaints,
    consents,
    notes: student.notes || [],
    scores: student.scores || []
  };
}

// --------------------------------------------------------------------------
// 4. Guardians & Consents (Auditable Opt-In Only)
// --------------------------------------------------------------------------
async function listGuardians(actorUser, schoolContext) {
  if (schoolContext.isGuardian) {
    return SchoolGuardian.find({ user: actorUser._id })
      .populate('user', 'fullName username phone email')
      .populate('students', 'name stage grade section status')
      .lean();
  }
  return SchoolGuardian.find({ status: { $ne: 'archived' } })
    .populate('user', 'fullName username phone email')
    .populate('students', 'name stage grade section status')
    .sort({ createdAt: -1 })
    .lean();
}

async function getStudentConsents(actorUser, schoolContext, studentId) {
  const student = await SchoolStudent.findById(studentId);
  if (!student) {
    const err = new Error('الطالب غير موجود');
    err.status = 404;
    throw err;
  }

  if (schoolContext.isGuardian && String(student.guardian) !== String(actorUser._id)) {
    const err = new Error('غير مصرح لك بالاطلاع على موافقات هذا الطالب');
    err.status = 403;
    throw err;
  }

  const existingConsents = await GuardianConsent.find({ student: student._id }).lean();
  const consentMap = new Map(existingConsents.map((c) => [c.consentType, c]));

  // Default: NONE of the options are granted by default. Explicit opt-in only!
  const allConsents = CONSENT_TYPES.map((type) => {
    const existing = consentMap.get(type);
    return {
      consentType: type,
      granted: existing ? existing.granted : false, // Default false
      version: existing ? existing.version : '2026-09-21-v1',
      text: existing ? existing.text : `الموافقة على ${type} للطالب ${student.name}`,
      decidedAt: existing ? existing.decidedAt : null,
      guardian: existing ? existing.guardian : student.guardian
    };
  });

  return { studentId: String(student._id), studentName: student.name, consents: allConsents };
}

async function updateGuardianConsent(actorUser, schoolContext, studentId, consentData) {
  const { consentType, granted, text, version } = consentData;

  if (!CONSENT_TYPES.includes(consentType)) {
    const err = new Error(`نوع الموافقة غير صالح: ${consentType}`);
    err.status = 400;
    throw err;
  }

  const student = await SchoolStudent.findById(studentId);
  if (!student) {
    const err = new Error('الطالب غير موجود');
    err.status = 404;
    throw err;
  }

  // Teacher cannot override guardian rejection!
  // Only the actual guardian (or Developer in emergency) can grant/revoke consent.
  if (!schoolContext.isDeveloper && String(student.guardian) !== String(actorUser._id)) {
    const err = new Error('المعلم أو الإدارة لا يستطيع تجاوز موافقة أو رفض ولي الأمر');
    err.status = 403;
    throw err;
  }

  const isGranted = granted === true;
  const policyVersion = String(version || '2026-09-21-v1').trim();
  const policyText = String(text || `موافقة ولي الأمر على ${consentType}`).trim();

  const record = await GuardianConsent.findOneAndUpdate(
    { guardian: student.guardian, student: student._id, consentType },
    {
      granted: isGranted,
      version: policyVersion,
      text: policyText,
      decidedAt: new Date()
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Sync with student's learningPermissions if mic/camera
  if (consentType === 'microphone') {
    student.learningPermissions = student.learningPermissions || {};
    student.learningPermissions.voice = isGranted;
    student.learningPermissions.updatedAt = new Date();
    await student.save();
  } else if (consentType === 'camera') {
    student.learningPermissions = student.learningPermissions || {};
    student.learningPermissions.camera = isGranted;
    student.learningPermissions.updatedAt = new Date();
    await student.save();
  }

  await logAudit(
    actorUser._id,
    'GUARDIAN_CONSENT_UPDATED',
    student.guardian,
    `تحديث موافقة ${consentType} للطالب ${student.name}: ${isGranted ? 'موافقة (GRANTED)' : 'رفض (DENIED)'}`
  );

  return record;
}

// --------------------------------------------------------------------------
// 5. Unified Schedules & Calendar (LIVE_CLASS, RECORDED_REPLAY, GENERAL_REVIEW, EXAM)
// --------------------------------------------------------------------------
async function listSchedules(actorUser, schoolContext, filters = {}) {
  const query = {};
  if (filters.type) query.type = filters.type;
  if (filters.status) query.status = filters.status;
  if (filters.stage) query.stage = filters.stage;
  if (filters.grade) query.grade = filters.grade;
  if (filters.subject) query.subject = filters.subject;

  if (schoolContext.isTeacher) {
    query.$or = [{ teacher: actorUser._id }, { stage: { $in: schoolContext.teacher.stages || [] } }];
  } else if (schoolContext.isGuardian) {
    const studentGrades = (schoolContext.students || []).map((s) => s.grade);
    const studentStages = (schoolContext.students || []).map((s) => s.stage);
    query.stage = { $in: studentStages };
    query.grade = { $in: studentGrades };
  } else if (schoolContext.isStudent) {
    query.stage = schoolContext.studentProfile?.stage;
    query.grade = schoolContext.studentProfile?.grade;
  }

  return SchoolEventSchedule.find(query)
    .populate('teacher', 'fullName username phone')
    .sort({ scheduledAt: 1 })
    .lean();
}

async function createScheduleEvent(actorUser, schoolContext, data) {
  const { type, title, description, stage, grade, section, subject, lesson, scheduledAt, durationMinutes, examConfig, recordedResourceUrl, studentIds } = data;

  if (!type || !title || !stage || !grade || !subject || !scheduledAt) {
    const err = new Error('النوع، العنوان، المرحلة، الصف، المادة، والموعد حقول مطلوبة');
    err.status = 400;
    throw err;
  }

  const when = new Date(scheduledAt);
  if (Number.isNaN(when.getTime())) {
    const err = new Error('موعد الحصة أو الاختبار غير صحيح');
    err.status = 400;
    throw err;
  }

  // Teacher scoping
  if (schoolContext.isTeacher) {
    const t = schoolContext.teacher;
    if (t.stages.length && !t.stages.includes(stage)) {
      const err = new Error('لا تملك صلاحية جدولة أحداث خارج مرحلتك الدراسية');
      err.status = 403;
      throw err;
    }
  }

  const event = await SchoolEventSchedule.create({
    type,
    title: String(title).trim(),
    description: String(description || '').trim(),
    teacher: actorUser._id,
    teacherName: actorUser.fullName || actorUser.username,
    stage,
    grade: String(grade).trim(),
    section: String(section || '').trim(),
    subject: String(subject).trim(),
    lesson: String(lesson || '').trim(),
    scheduledAt: when,
    durationMinutes: Math.max(10, Math.min(240, Number(durationMinutes) || 45)),
    recordedResourceUrl: String(recordedResourceUrl || '').trim(),
    examConfig: {
      maxScore: Number(examConfig?.maxScore) || 100,
      passingScore: Number(examConfig?.passingScore) || 50,
      instructions: String(examConfig?.instructions || ''),
      notifiedManagement: true // Automatic notification to management upon exam creation
    },
    students: Array.isArray(studentIds) ? studentIds : [],
    createdBy: actorUser._id
  });

  await logAudit(
    actorUser._id,
    `SCHEDULE_${type}_CREATED`,
    actorUser._id,
    `جدولة ${type}: ${event.title} لمادة ${event.subject} في ${when.toISOString()}`
  );

  return event;
}

// --------------------------------------------------------------------------
// 6. Grades & Attendance Entry
// --------------------------------------------------------------------------
async function recordGrade(actorUser, schoolContext, data) {
  const { studentId, subject, gradeType, title, score, maxScore, notes, scheduleEventId } = data;

  if (!studentId || !subject || !title || score === undefined) {
    const err = new Error('الطالب والمادة والعنوان والدرجة حقول مطلوبة');
    err.status = 400;
    throw err;
  }

  const student = await SchoolStudent.findById(studentId);
  if (!student || student.status === 'archived') {
    const err = new Error('الطالب غير موجود أو تم أرشفته');
    err.status = 404;
    throw err;
  }

  const numScore = Number(score);
  const numMax = Number(maxScore || 100);
  if (Number.isNaN(numScore) || Number.isNaN(numMax) || numScore < 0 || numScore > numMax || numMax <= 0) {
    const err = new Error('الدرجة غير صحيحة أو أكبر من الدرجة القصوى');
    err.status = 400;
    throw err;
  }

  const gradeRecord = await SchoolGradeRecord.create({
    student: student._id,
    teacher: actorUser._id,
    scheduleEvent: scheduleEventId && mongoose.isValidObjectId(scheduleEventId) ? scheduleEventId : null,
    subject: String(subject).trim(),
    gradeType: gradeType || 'exam',
    title: String(title).trim(),
    score: numScore,
    maxScore: numMax,
    notes: String(notes || '').trim(),
    recordedAt: new Date()
  });

  // Sync to student scores array and recalculate average
  student.scores = student.scores || [];
  student.scores.push({
    subject: gradeRecord.subject,
    lesson: gradeRecord.title,
    score: gradeRecord.score,
    maxScore: gradeRecord.maxScore,
    createdAt: gradeRecord.recordedAt
  });
  student.progress = student.progress || { average: 0, sessions: 0, answered: 0 };
  student.progress.answered += 1;
  student.progress.average = student.scores.reduce((a, x) => a + (x.score / x.maxScore) * 100, 0) / student.scores.length;
  await student.save();

  await logAudit(
    actorUser._id,
    'GRADE_RECORDED',
    student.guardian,
    `تسجيل درجة للطالب ${student.name}: ${numScore}/${numMax} في ${gradeRecord.subject} (${gradeRecord.title})`
  );

  return gradeRecord;
}

async function recordAttendance(actorUser, schoolContext, data) {
  const { studentId, status, notes, scheduleEventId } = data;

  if (!studentId || !status) {
    const err = new Error('الطالب وحالة الحضور مطلوبة');
    err.status = 400;
    throw err;
  }

  const student = await SchoolStudent.findById(studentId);
  if (!student) {
    const err = new Error('الطالب غير موجود');
    err.status = 404;
    throw err;
  }

  const attendance = await SchoolAttendanceRecord.create({
    student: student._id,
    teacher: actorUser._id,
    scheduleEvent: scheduleEventId && mongoose.isValidObjectId(scheduleEventId) ? scheduleEventId : null,
    stage: student.stage,
    grade: student.grade,
    section: student.section,
    status,
    notes: String(notes || '').trim(),
    date: new Date()
  });

  await logAudit(
    actorUser._id,
    'ATTENDANCE_RECORDED',
    student.guardian,
    `تسجيل حضور للطالب ${student.name}: ${status}`
  );

  return attendance;
}

// --------------------------------------------------------------------------
// 7. Guardian Complaints
// --------------------------------------------------------------------------
async function createComplaint(actorUser, data) {
  const { studentId, subject, body, attachments } = data;

  if (!studentId || !subject || !body) {
    const err = new Error('الطالب والموضوع ونص الشكوى مطلوبة');
    err.status = 400;
    throw err;
  }

  const student = await SchoolStudent.findOne({ _id: studentId, guardian: actorUser._id });
  if (!student) {
    const err = new Error('لا يمكنك تقديم شكوى إلا بخصوص طلابك المرتبطين بحسابك فقط');
    err.status = 403;
    throw err;
  }

  const complaint = await GuardianComplaint.create({
    guardian: actorUser._id,
    student: student._id,
    subject: String(subject).trim().slice(0, 200),
    body: String(body).trim().slice(0, 4000),
    status: 'NEW',
    attachments: Array.isArray(attachments) ? attachments : []
  });

  await logAudit(actorUser._id, 'GUARDIAN_COMPLAINT_CREATED', student._id, `تقديم شكوى ولي أمر: ${complaint.subject}`);
  return complaint;
}

async function listComplaints(actorUser, schoolContext) {
  // Guardian constraint:
  // "لا يرى ولي الأمر إلا شكاواه وطلابه المرتبطين به."
  // Only Managers and Developers can see all school complaints.
  if (!schoolContext.isManager && !schoolContext.isDeveloper) {
    return GuardianComplaint.find({ guardian: actorUser._id })
      .populate('student', 'name stage grade section')
      .populate('adminResponse.respondedBy', 'fullName username')
      .sort({ createdAt: -1 })
      .lean();
  }

  return GuardianComplaint.find({})
    .populate('guardian', 'fullName username phone email')
    .populate('student', 'name stage grade section')
    .populate('adminResponse.respondedBy', 'fullName username')
    .sort({ createdAt: -1 })
    .lean();
}

async function replyToComplaint(actorUser, schoolContext, complaintId, replyData) {
  if (!schoolContext.isManager && !schoolContext.isDeveloper) {
    const err = new Error('الرد على الشكاوى مخصص لإدارة المدرسة والمطور فقط');
    err.status = 403;
    throw err;
  }

  const complaint = await GuardianComplaint.findById(complaintId);
  if (!complaint) {
    const err = new Error('الشكوى غير موجودة');
    err.status = 404;
    throw err;
  }

  const text = String(replyData.text || '').trim();
  const status = ['NEW', 'IN_PROGRESS', 'CLOSED'].includes(replyData.status) ? replyData.status : 'IN_PROGRESS';

  complaint.status = status;
  if (text) {
    complaint.adminResponse = {
      text,
      respondedBy: actorUser._id,
      respondedAt: new Date()
    };
  }

  await complaint.save();
  await logAudit(
    actorUser._id,
    'COMPLAINT_REPLIED',
    complaint.guardian,
    `الرد على شكوى ولي الأمر: ${complaint.subject} (الحالة: ${complaint.status})`
  );

  await complaint.populate('adminResponse.respondedBy', 'fullName username');
  return complaint;
}

// --------------------------------------------------------------------------
// 8. Audit Logs Query
// --------------------------------------------------------------------------
async function listAuditLogs(schoolContext, limit = 100) {
  if (!schoolContext.isManager && !schoolContext.isDeveloper) {
    const err = new Error('الاطلاع على سجل العمليات مخصص للإدارة والمطور فقط');
    err.status = 403;
    throw err;
  }

  return AuditLog.find({})
    .populate('actor', 'fullName username role')
    .populate('target', 'fullName username role')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

module.exports = {
  logAudit,
  searchRealUsers,
  listRealTeachers,
  listVirtualTeachers,
  registerTeacher,
  updateTeacher,
  archiveTeacher,
  getTeacherRecord,
  listStudents,
  registerStudent,
  updateStudent,
  archiveStudent,
  getStudentPermanentRecord,
  listGuardians,
  getStudentConsents,
  updateGuardianConsent,
  listSchedules,
  createScheduleEvent,
  recordGrade,
  recordAttendance,
  createComplaint,
  listComplaints,
  replyToComplaint,
  listAuditLogs
};
