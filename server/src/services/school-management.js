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
const SchoolLearningRecord = require('../models/SchoolLearningRecord');
const SchoolClassroom = require('../models/SchoolClassroom');
const VirtualClassroomSession = require('../models/VirtualClassroomSession');
const SchoolTeacherApplication = require('../models/SchoolTeacherApplication');
const SchoolAssignment = require('../models/SchoolAssignment');
const SchoolAssignmentSubmission = require('../models/SchoolAssignmentSubmission');
const SchoolTeacherStudentRequest = require('../models/SchoolTeacherStudentRequest');
const SchoolGuardianNotification = require('../models/SchoolGuardianNotification');

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
  const approved = VirtualTeacherProfile.getBuiltinProfiles();
  return approved.map((t) => ({
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

  const students = await SchoolStudent.find(query)
    .populate('guardian', 'fullName username phone email')
    .populate('studentUser', 'fullName username phone email')
    .populate('assignedTeachers.teacher', 'name subjects')
    .populate('assignedVirtualTeacher', 'name subject avatarUrl')
    .sort({ createdAt: -1 })
    .lean();

  return students.map(s => ({
    ...s,
    trialInfo: SchoolStudent.computeTrialInfo(s)
  }));
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

  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

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
    registrationDate: now,
    trialStartedAt: now,
    trialEndsAt: trialEndsAt,
    trialStatus: 'active',
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
  let resolvedId = studentId;
  if (studentId === 'me' && schoolContext.studentProfile) {
    resolvedId = schoolContext.studentProfile._id;
  }

  const student = await SchoolStudent.findById(resolvedId)
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

  const isManagerOrDev = schoolContext.isManager || schoolContext.isDeveloper;
  const isTeacher = schoolContext.isTeacher;
  const isGuardianOwner = schoolContext.isGuardian && String(student.guardian?._id || student.guardian) === String(actorUser._id);
  const isStudentOwner = schoolContext.isStudent && (
    String(student.studentUser?._id || student.studentUser) === String(actorUser._id) ||
    (schoolContext.studentProfile && String(schoolContext.studentProfile._id) === String(student._id))
  );

  // Guardian scoping: guardian can only see own student
  if (schoolContext.isGuardian && !isGuardianOwner) {
    const err = new Error('لا يمكنك الاطلاع إلا على سجلات طلابك فقط');
    err.status = 403;
    throw err;
  }

  // Student scoping: student can only see own record
  if (schoolContext.isStudent && !isStudentOwner) {
    const err = new Error('لا يمكنك الاطلاع إلا على سجلك الأكاديمي الخاص فقط');
    err.status = 403;
    throw err;
  }

  if (!isManagerOrDev && !isTeacher && !isGuardianOwner && !isStudentOwner) {
    const err = new Error('غير مصرح لك بالاطلاع على هذا السجل الأكاديمي');
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
    consents,
    submissions
  ] = await Promise.all([
    SchoolAttendanceRecord.find({ student: student._id }).populate('teacher', 'fullName username').sort({ date: -1 }).lean(),
    SchoolGradeRecord.find({ student: student._id }).populate('teacher', 'fullName username').sort({ recordedAt: -1 }).lean(),
    SchoolEventSchedule.find({
      $or: [{ students: student._id }, { stage: student.stage, grade: student.grade }]
    }).sort({ scheduledAt: -1 }).limit(30).lean(),
    SchoolSession.find({ student: student._id }).sort({ startedAt: -1 }).limit(30).lean(),
    VirtualClassroomSession.find({ student: student._id }).sort({ createdAt: -1 }).limit(30).lean(),
    // Privacy: Students should not see guardian complaints or confidential complaints
    schoolContext.isStudent ? Promise.resolve([]) : GuardianComplaint.find({ student: student._id }).sort({ createdAt: -1 }).lean(),
    schoolContext.isStudent ? Promise.resolve([]) : GuardianConsent.find({ student: student._id }).lean(),
    SchoolAssignmentSubmission.find({ student: student._id }).populate('assignment', 'title subject dueAt maxScore').sort({ submittedAt: -1 }).lean()
  ]);

  student.trialInfo = SchoolStudent.computeTrialInfo(student);

  return {
    student,
    attendanceRecords,
    gradeRecords,
    schedules,
    sessions,
    virtualSessions,
    complaints: complaints || [],
    consents: consents || [],
    submissions,
    notes: student.notes || [],
    scores: student.scores || []
  };
}

/**
 * Get Student Attendance History (Strict Ownership Scoped)
 */
async function getStudentAttendanceHistory(actorUser, schoolContext, studentId) {
  let resolvedId = studentId;
  if (studentId === 'me') {
    if (!schoolContext.studentProfile) {
      const err = new Error('حسابك غير مرتبط بملف طالب نشط');
      err.status = 403;
      throw err;
    }
    resolvedId = schoolContext.studentProfile._id;
  }

  const student = await SchoolStudent.findById(resolvedId).lean();
  if (!student) {
    const err = new Error('الطالب غير موجود');
    err.status = 404;
    throw err;
  }

  const isManagerOrDev = schoolContext.isManager || schoolContext.isDeveloper;
  const isTeacher = schoolContext.isTeacher;
  const isGuardianOwner = schoolContext.isGuardian && String(student.guardian?._id || student.guardian) === String(actorUser._id);
  const isStudentOwner = schoolContext.isStudent && (
    String(student.studentUser?._id || student.studentUser) === String(actorUser._id) ||
    (schoolContext.studentProfile && String(schoolContext.studentProfile._id) === String(student._id))
  );

  if (!isManagerOrDev && !isTeacher && !isGuardianOwner && !isStudentOwner) {
    const err = new Error('غير مصرح لك بالاطلاع على سجل حضور هذا الطالب');
    err.status = 403;
    throw err;
  }

  const records = await SchoolAttendanceRecord.find({ student: student._id })
    .populate('teacher', 'fullName username')
    .sort({ date: -1 })
    .lean();

  const total = records.length;
  let present = 0;
  let absent = 0;
  let late = 0;
  let excused = 0;

  for (const r of records) {
    if (r.status === 'present') present++;
    else if (r.status === 'absent') absent++;
    else if (r.status === 'late') late++;
    else if (r.status === 'excused') excused++;
  }

  const attendanceRate = total > 0 ? Math.round(((present + late + excused) / total) * 100) : null;

  return {
    studentId: student._id,
    studentName: student.name,
    records,
    summary: {
      total,
      present,
      absent,
      late,
      excused,
      attendanceRate
    }
  };
}

/**
 * Get Student Grades History (Strict Ownership Scoped)
 */
async function getStudentGradesHistory(actorUser, schoolContext, studentId) {
  let resolvedId = studentId;
  if (studentId === 'me') {
    if (!schoolContext.studentProfile) {
      const err = new Error('حسابك غير مرتبط بملف طالب نشط');
      err.status = 403;
      throw err;
    }
    resolvedId = schoolContext.studentProfile._id;
  }

  const student = await SchoolStudent.findById(resolvedId).lean();
  if (!student) {
    const err = new Error('الطالب غير موجود');
    err.status = 404;
    throw err;
  }

  const isManagerOrDev = schoolContext.isManager || schoolContext.isDeveloper;
  const isTeacher = schoolContext.isTeacher;
  const isGuardianOwner = schoolContext.isGuardian && String(student.guardian?._id || student.guardian) === String(actorUser._id);
  const isStudentOwner = schoolContext.isStudent && (
    String(student.studentUser?._id || student.studentUser) === String(actorUser._id) ||
    (schoolContext.studentProfile && String(schoolContext.studentProfile._id) === String(student._id))
  );

  if (!isManagerOrDev && !isTeacher && !isGuardianOwner && !isStudentOwner) {
    const err = new Error('غير مصرح لك بالاطلاع على درجات هذا الطالب');
    err.status = 403;
    throw err;
  }

  const records = await SchoolGradeRecord.find({ student: student._id })
    .populate('teacher', 'fullName username')
    .sort({ recordedAt: -1 })
    .lean();

  let totalScorePercentage = 0;
  const bySubject = {};

  for (const r of records) {
    const pct = r.maxScore > 0 ? (r.score / r.maxScore) * 100 : 0;
    totalScorePercentage += pct;

    if (!bySubject[r.subject]) {
      bySubject[r.subject] = { count: 0, totalPct: 0, average: 0, items: [] };
    }
    bySubject[r.subject].count++;
    bySubject[r.subject].totalPct += pct;
    bySubject[r.subject].average = Math.round(bySubject[r.subject].totalPct / bySubject[r.subject].count);
    bySubject[r.subject].items.push(r);
  }

  const totalAssessments = records.length;
  const averageScore = totalAssessments > 0 ? Math.round(totalScorePercentage / totalAssessments) : null;

  return {
    studentId: student._id,
    studentName: student.name,
    records,
    summary: {
      totalAssessments,
      averageScore,
      bySubject
    }
  };
}

/**
 * Get Student Academic Progress & Activity (Strict Ownership Scoped)
 */
async function getStudentProgress(actorUser, schoolContext, studentId) {
  let resolvedId = studentId;
  if (studentId === 'me') {
    if (!schoolContext.studentProfile) {
      const err = new Error('حسابك غير مرتبط بملف طالب نشط');
      err.status = 403;
      throw err;
    }
    resolvedId = schoolContext.studentProfile._id;
  }

  const student = await SchoolStudent.findById(resolvedId).lean();
  if (!student) {
    const err = new Error('الطالب غير موجود');
    err.status = 404;
    throw err;
  }

  const isManagerOrDev = schoolContext.isManager || schoolContext.isDeveloper;
  const isTeacher = schoolContext.isTeacher;
  const isGuardianOwner = schoolContext.isGuardian && String(student.guardian?._id || student.guardian) === String(actorUser._id);
  const isStudentOwner = schoolContext.isStudent && (
    String(student.studentUser?._id || student.studentUser) === String(actorUser._id) ||
    (schoolContext.studentProfile && String(schoolContext.studentProfile._id) === String(student._id))
  );

  if (!isManagerOrDev && !isTeacher && !isGuardianOwner && !isStudentOwner) {
    const err = new Error('غير مصرح لك بالاطلاع على مسار تقدم هذا الطالب');
    err.status = 403;
    throw err;
  }

  const [learningRecords, gradeRecords, sessions] = await Promise.all([
    SchoolLearningRecord.find({ student: student._id }).sort({ createdAt: -1 }).limit(50).lean(),
    SchoolGradeRecord.find({ student: student._id }).sort({ recordedAt: -1 }).lean(),
    SchoolSession.find({ student: student._id, status: 'completed' }).sort({ endedAt: -1 }).limit(30).lean()
  ]);

  const subjectProgress = {};
  for (const s of (student.subjects || [])) {
    subjectProgress[s] = {
      subject: s,
      learningQuestions: 0,
      gradesCount: 0,
      averageGrade: null,
      completedSessions: 0
    };
  }

  for (const lr of learningRecords) {
    const subj = lr.subject || 'عام';
    if (!subjectProgress[subj]) {
      subjectProgress[subj] = { subject: subj, learningQuestions: 0, gradesCount: 0, averageGrade: null, completedSessions: 0 };
    }
    subjectProgress[subj].learningQuestions++;
  }

  for (const gr of gradeRecords) {
    const subj = gr.subject;
    if (!subjectProgress[subj]) {
      subjectProgress[subj] = { subject: subj, learningQuestions: 0, gradesCount: 0, averageGrade: null, completedSessions: 0 };
    }
    subjectProgress[subj].gradesCount++;
  }

  for (const sess of sessions) {
    const subj = sess.subject || 'عام';
    if (!subjectProgress[subj]) {
      subjectProgress[subj] = { subject: subj, learningQuestions: 0, gradesCount: 0, averageGrade: null, completedSessions: 0 };
    }
    subjectProgress[subj].completedSessions++;
  }

  return {
    studentId: student._id,
    studentName: student.name,
    stage: student.stage,
    grade: student.grade,
    section: student.section,
    progress: student.progress || { average: 0, sessions: 0, answered: 0 },
    scores: student.scores || [],
    learningRecords,
    gradeRecords,
    completedSessionsCount: sessions.length,
    subjectProgress: Object.values(subjectProgress)
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

  if (schoolContext.isTeacher) {
    const linked=student.assignedTeachers?.some(x=>String(x.teacher)===String(schoolContext.teacher._id) && (!x.subject || x.subject===subject));
    if (!linked) { const e=new Error('لا يمكنك رصد درجة إلا لطالب مرتبط بك في هذه المادة'); e.status=403; throw e; }
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

  if (schoolContext.isTeacher) {
    const linked=student.assignedTeachers?.some(x=>String(x.teacher)===String(schoolContext.teacher._id));
    if (!linked) { const e=new Error('لا يمكنك تسجيل حضور طالب غير مرتبط بك'); e.status=403; throw e; }
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

  if (status === 'absent') {
    const recent=await SchoolAttendanceRecord.find({student:student._id,teacher:actorUser._id}).sort({date:-1}).limit(3).lean();
    if (recent.length===3 && recent.every(x=>x.status==='absent')) {
      const exists=await SchoolGuardianNotification.findOne({guardian:student.guardian,student:student._id,teacher:actorUser._id,type:'THREE_CONSECUTIVE_ABSENCES','meta.thirdAttendanceId':String(recent[0]._id)});
      if (!exists) await SchoolGuardianNotification.create({guardian:student.guardian,student:student._id,teacher:actorUser._id,type:'THREE_CONSECUTIVE_ABSENCES',title:'تنبيه غياب ثلاث محاضرات متتالية',message:`غاب الطالب ${student.name} عن ثلاث محاضرات متتالية. يرجى المتابعة مع المعلم.`,meta:{thirdAttendanceId:String(recent[0]._id)}});
    }
  }

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


// --------------------------------------------------------------------------
// 9. Teacher Applications Workflow
// --------------------------------------------------------------------------
async function submitTeacherApplication(applicantUser, data) {
  if (!applicantUser || applicantUser.status !== 'active') {
    const err = new Error('يجب تسجيل الدخول بحساب مفعّل لتقديم طلب التدريس');
    err.status = 401;
    throw err;
  }

  const existingTeacher = await SchoolTeacher.findOne({ user: applicantUser._id, status: 'active' });
  if (existingTeacher) {
    const err = new Error('حسابك مسجل بالفعل كمعلم نشط في المدرسة');
    err.status = 409;
    throw err;
  }

  const pendingApp = await SchoolTeacherApplication.findOne({ applicant: applicantUser._id, status: 'pending' });
  if (pendingApp) {
    const err = new Error('لديك طلب انضمام معلق قيد المراجعة بالفعل');
    err.status = 409;
    throw err;
  }

  const fullName = String(data.fullName || applicantUser.fullName || '').trim();
  if (!fullName) {
    const err = new Error('الاسم الكامل مطلوب لتقديم الطلب');
    err.status = 400;
    throw err;
  }

  const subjects = Array.isArray(data.subjects)
    ? data.subjects.filter(Boolean)
    : (Array.isArray(data.specialties) ? data.specialties.filter(Boolean) : (data.subject ? [String(data.subject).trim()] : []));

  if (!subjects.length) {
    const err = new Error('يجب تحديد مادة أو تخصص تدريسي واحد على الأقل');
    err.status = 400;
    throw err;
  }

  const application = await SchoolTeacherApplication.create({
    applicant: applicantUser._id,
    fullName,
    phone: String(data.phone || applicantUser.phone || '').trim(),
    email: String(data.email || applicantUser.email || '').trim().toLowerCase(),
    subjects,
    specialties: subjects,
    stages: Array.isArray(data.stages) ? data.stages.filter(Boolean) : (data.stage ? [data.stage] : []),
    grades: Array.isArray(data.grades) ? data.grades.filter(Boolean) : (data.grade ? [data.grade] : []),
    sections: Array.isArray(data.sections) ? data.sections.filter(Boolean) : ['أ'],
    qualifications: String(data.qualifications || '').trim(),
    experience: String(data.experience || '').trim(),
    experienceYears: Number(data.experienceYears || 0),
    bio: String(data.bio || '').trim(),
    notes: String(data.notes || '').trim(),
    status: 'pending'
  });

  await logAudit(
    applicantUser._id,
    'TEACHER_APPLICATION_SUBMITTED',
    null,
    `تقديم طلب انضمام كمعلم: ${application.fullName} (${subjects.join('، ')})`
  );

  await application.populate('applicant', 'fullName username phone email gender role');
  return application;
}

async function listTeacherApplications(actorUser, schoolContext, filters = {}) {
  if (!schoolContext.isManager && !schoolContext.isDeveloper) {
    const err = new Error('عرض طلبات المعلمين مخصص للإدارة أو المطور فقط');
    err.status = 403;
    throw err;
  }

  const query = {};
  if (filters.status) query.status = filters.status;
  if (filters.stage) query.stages = filters.stage;
  if (filters.subject) {
    query.$or = [{ subjects: filters.subject }, { specialties: filters.subject }];
  }

  return SchoolTeacherApplication.find(query)
    .populate('applicant', 'fullName username phone email gender role')
    .populate('reviewedBy', 'fullName username')
    .populate('approvedTeacher', 'name subjects stages')
    .sort({ createdAt: -1 })
    .lean();
}

async function getTeacherApplication(actorUser, schoolContext, applicationId) {
  const application = await SchoolTeacherApplication.findById(applicationId)
    .populate('applicant', 'fullName username phone email gender role')
    .populate('reviewedBy', 'fullName username')
    .populate('approvedTeacher', 'name subjects stages')
    .lean();

  if (!application) {
    const err = new Error('طلب التقديم غير موجود');
    err.status = 404;
    throw err;
  }

  // Permitted: Admin/Developer or applicant themselves
  const isApplicant = String(application.applicant?._id || application.applicant) === String(actorUser._id);
  if (!isApplicant && !schoolContext.isManager && !schoolContext.isDeveloper) {
    const err = new Error('لا تملك صلاحية الاطلاع على هذا الطلب');
    err.status = 403;
    throw err;
  }

  return application;
}

async function approveTeacherApplication(actorUser, schoolContext, applicationId, reviewNotes = '') {
  if (!schoolContext.isManager && !schoolContext.isDeveloper) {
    const err = new Error('اعتماد طلبات المعلمين مخصص للإدارة أو المطور فقط');
    err.status = 403;
    throw err;
  }

  const application = await SchoolTeacherApplication.findById(applicationId);
  if (!application) {
    const err = new Error('طلب التقديم غير موجود');
    err.status = 404;
    throw err;
  }

  // Prevent applicant self-approval:
  if (String(application.applicant) === String(actorUser._id)) {
    const err = new Error('لا يمكن للمتقدم اعتماد طلبه بنفسه');
    err.status = 403;
    throw err;
  }

  // Idempotent: if already approved, return existing teacher and application
  if (application.status === 'approved' && application.approvedTeacher) {
    const existingTeacher = await SchoolTeacher.findById(application.approvedTeacher).populate('user', 'fullName username phone email gender role');
    return { application, teacher: existingTeacher, alreadyApproved: true };
  }

  const applicantUser = await User.findById(application.applicant);
  if (!applicantUser) {
    const err = new Error('حساب المتقدم غير موجود');
    err.status = 404;
    throw err;
  }

  // Important: Platform role barrier. Approving a teacher does NOT elevate User.role to admin or developer.
  // The User account stays as is (or user role), and a SchoolTeacher profile is created / linked.
  let teacher = await SchoolTeacher.findOne({ user: applicantUser._id });
  if (!teacher) {
    teacher = await SchoolTeacher.create({
      user: applicantUser._id,
      name: application.fullName || applicantUser.fullName,
      gender: applicantUser.gender === 'female' ? 'أنثى' : 'ذكر',
      phone: application.phone || applicantUser.phone || '',
      subjects: application.subjects && application.subjects.length ? application.subjects : (application.specialties || []),
      stages: application.stages || [],
      grades: application.grades || [],
      sections: application.sections || ['أ'],
      status: 'active',
      registeredBy: actorUser._id
    });
  } else {
    teacher.status = 'active';
    teacher.name = application.fullName || teacher.name;
    if (application.subjects?.length) teacher.subjects = application.subjects;
    else if (application.specialties?.length) teacher.subjects = application.specialties;
    if (application.stages?.length) teacher.stages = application.stages;
    if (application.grades?.length) teacher.grades = application.grades;
    if (application.sections?.length) teacher.sections = application.sections;
    await teacher.save();
  }

  application.status = 'approved';
  application.reviewedBy = actorUser._id;
  application.reviewedAt = new Date();
  application.approvedTeacher = teacher._id;
  if (reviewNotes) application.notes = reviewNotes;
  await application.save();

  await logAudit(
    actorUser._id,
    'TEACHER_APPLICATION_APPROVED',
    applicantUser._id,
    `تم اعتماد طلب المعلم: ${teacher.name} لتدريس (${(teacher.subjects || []).join('، ')})`
  );

  await teacher.populate('user', 'fullName username phone email gender role');
  await application.populate('applicant', 'fullName username phone email gender role');
  await application.populate('reviewedBy', 'fullName username');

  return { application, teacher };
}

async function rejectTeacherApplication(actorUser, schoolContext, applicationId, reason = '') {
  if (!schoolContext.isManager && !schoolContext.isDeveloper) {
    const err = new Error('رفض طلبات المعلمين مخصص للإدارة أو المطور فقط');
    err.status = 403;
    throw err;
  }

  const application = await SchoolTeacherApplication.findById(applicationId);
  if (!application) {
    const err = new Error('طلب التقديم غير موجود');
    err.status = 404;
    throw err;
  }

  if (String(application.applicant) === String(actorUser._id)) {
    const err = new Error('لا يمكن للمتقدم رفض طلبه كإجراء إداري');
    err.status = 403;
    throw err;
  }

  application.status = 'rejected';
  application.rejectionReason = String(reason || 'لم يستوفِ الشروط المطلوبة').trim();
  application.reviewedBy = actorUser._id;
  application.reviewedAt = new Date();
  await application.save();

  await logAudit(
    actorUser._id,
    'TEACHER_APPLICATION_REJECTED',
    application.applicant,
    `تم رفض طلب التقديم للمعلم: ${application.fullName}. السبب: ${application.rejectionReason}`
  );

  await application.populate('applicant', 'fullName username phone email gender role');
  await application.populate('reviewedBy', 'fullName username');

  return application;
}

// --------------------------------------------------------------------------
// 10. Student Trial Operations
// --------------------------------------------------------------------------
async function convertStudentTrial(actorUser, schoolContext, studentId) {
  if (!schoolContext.isManager && !schoolContext.isDeveloper) {
    const err = new Error('تحويل حالة التجربة مخصص لإدارة المدرسة أو المطور فقط');
    err.status = 403;
    throw err;
  }

  const student = await SchoolStudent.findById(studentId);
  if (!student) {
    const err = new Error('الطالب غير موجود');
    err.status = 404;
    throw err;
  }

  student.trialStatus = 'converted';
  await student.save();

  await logAudit(
    actorUser._id,
    'STUDENT_TRIAL_CONVERTED',
    student._id,
    `تحويل الطالب ${student.name} من الفترة التجريبية إلى الاشتراك الكامل`
  );

  return {
    student,
    trialInfo: student.getTrialInfo()
  };
}

async function getStudentTrial(actorUser, schoolContext, studentId) {
  const student = await SchoolStudent.findById(studentId);
  if (!student) {
    const err = new Error('الطالب غير موجود');
    err.status = 404;
    throw err;
  }

  const isGuardianOfStudent = schoolContext.isGuardian && String(student.guardian) === String(actorUser._id);
  const isStudentSelf = schoolContext.isStudent && String(student.studentUser) === String(actorUser._id);
  const isStaff = schoolContext.isTeacher || schoolContext.isManager || schoolContext.isDeveloper;

  if (!isGuardianOfStudent && !isStudentSelf && !isStaff) {
    const err = new Error('لا تملك صلاحية الاطلاع على تفاصيل التجربة لهذا الطالب');
    err.status = 403;
    throw err;
  }

  return {
    studentId: student._id,
    studentName: student.name,
    trialInfo: student.getTrialInfo()
  };
}

// --------------------------------------------------------------------------
// 11. Assignments, Submissions & Grading Management
// --------------------------------------------------------------------------
async function createAssignment(actorUser, schoolContext, data) {
  if (!schoolContext.isTeacher && !schoolContext.isManager && !schoolContext.isDeveloper) {
    const err = new Error('إنشاء الواجبات مخصص للطاقم التعليمي والإدارة فقط');
    err.status = 403;
    throw err;
  }

  const { stage, grade, section, subject, title, description, attachments, assignedStudents, dueAt, maxScore, allowLateSubmission, classroomId } = data;

  if (!stage || !grade || !subject || !title || !dueAt) {
    const err = new Error('المرحلة والصف والمادة وعنوان الواجب وموعد التسليم حقول مطلوبة');
    err.status = 400;
    throw err;
  }

  const dueDate = new Date(dueAt);
  if (isNaN(dueDate.getTime())) {
    const err = new Error('موعد التسليم غير صالح');
    err.status = 400;
    throw err;
  }

  // Teacher scope check:
  if (schoolContext.isTeacher && !schoolContext.isManager && !schoolContext.isDeveloper) {
    const t = schoolContext.teacher;
    if (t) {
      if (t.stages && t.stages.length > 0 && !t.stages.includes(stage)) {
        const err = new Error('المعلم غير مصرح له بإنشاء واجب خارج مرحلته الدراسية');
        err.status = 403;
        throw err;
      }
      if (t.subjects && t.subjects.length > 0 && !t.subjects.includes(subject)) {
        const err = new Error('المعلم غير مصرح له بإنشاء واجب خارج مواده الدراسية');
        err.status = 403;
        throw err;
      }
    }
  }

  const numMaxScore = Number(maxScore || 100);
  if (isNaN(numMaxScore) || numMaxScore <= 0) {
    const err = new Error('الدرجة القصوى للواجب يجب أن تكون رقماً موجباً أكبر من صفر');
    err.status = 400;
    throw err;
  }

  const assignment = await SchoolAssignment.create({
    teacher: actorUser._id,
    teacherProfile: schoolContext.teacher?._id || null,
    stage,
    grade: String(grade).trim(),
    section: String(section || '').trim(),
    classroom: classroomId && mongoose.isValidObjectId(classroomId) ? classroomId : null,
    subject: String(subject).trim(),
    title: String(title).trim(),
    description: String(description || '').trim(),
    attachments: Array.isArray(attachments) ? attachments : [],
    assignedStudents: Array.isArray(assignedStudents) ? assignedStudents.filter(Boolean) : [],
    dueAt: dueDate,
    maxScore: numMaxScore,
    allowLateSubmission: allowLateSubmission !== false,
    status: data.status === 'draft' ? 'draft' : 'published'
  });

  await logAudit(
    actorUser._id,
    'ASSIGNMENT_CREATED',
    null,
    `إنشاء واجب جديد: "${assignment.title}" في مادة ${assignment.subject} (الصف: ${assignment.grade})`
  );

  await assignment.populate('teacher', 'fullName username');
  return assignment;
}

async function listAssignments(actorUser, schoolContext, filters = {}) {
  const query = {};
  if (filters.status) query.status = filters.status;
  else if (!filters.includeArchived) query.status = { $ne: 'archived' };

  if (filters.stage) query.stage = filters.stage;
  if (filters.grade) query.grade = filters.grade;
  if (filters.section) query.section = filters.section;
  if (filters.subject) query.subject = filters.subject;

  // Role scoping:
  if (schoolContext.isStudent && schoolContext.studentProfile) {
    const sp = schoolContext.studentProfile;
    query.stage = sp.stage;
    query.grade = sp.grade;
    query.status = 'published';
    query.$or = [
      { section: '' },
      { section: sp.section },
      { section: { $exists: false } },
      { assignedStudents: sp._id }
    ];
  } else if (schoolContext.isGuardian && schoolContext.students?.length) {
    const studentStages = [...new Set(schoolContext.students.map(s => s.stage))];
    const studentGrades = [...new Set(schoolContext.students.map(s => s.grade))];
    query.stage = { $in: studentStages };
    query.grade = { $in: studentGrades };
    query.status = 'published';
  } else if (schoolContext.isTeacher && !schoolContext.isManager && !schoolContext.isDeveloper) {
    if (!filters.allTeachers) {
      query.teacher = actorUser._id;
    }
  }

  const assignments = await SchoolAssignment.find(query)
    .populate('teacher', 'fullName username')
    .sort({ dueAt: 1, createdAt: -1 })
    .lean();

  if (schoolContext.isStudent && schoolContext.studentProfile) {
    const studentId = schoolContext.studentProfile._id;
    const assignmentIds = assignments.map(a => a._id);
    const submissions = await SchoolAssignmentSubmission.find({
      assignment: { $in: assignmentIds },
      student: studentId
    }).lean();

    const subMap = new Map();
    submissions.forEach(sub => subMap.set(String(sub.assignment), sub));

    return assignments.map(a => {
      const mySub = subMap.get(String(a._id));
      return {
        ...a,
        mySubmission: mySub ? {
          _id: mySub._id,
          status: mySub.status,
          score: mySub.score,
          maxScore: mySub.maxScore,
          submittedAt: mySub.submittedAt,
          teacherFeedback: mySub.teacherFeedback
        } : null
      };
    });
  }

  return assignments;
}

async function getAssignment(actorUser, schoolContext, assignmentId) {
  const assignment = await SchoolAssignment.findById(assignmentId)
    .populate('teacher', 'fullName username')
    .lean();

  if (!assignment) {
    const err = new Error('الواجب غير موجود');
    err.status = 404;
    throw err;
  }

  if (schoolContext.isStudent && schoolContext.studentProfile) {
    const mySub = await SchoolAssignmentSubmission.findOne({
      assignment: assignment._id,
      student: schoolContext.studentProfile._id
    }).lean();
    return { ...assignment, mySubmission: mySub || null };
  }

  if (schoolContext.isTeacher || schoolContext.isManager || schoolContext.isDeveloper) {
    const totalSubmissions = await SchoolAssignmentSubmission.countDocuments({ assignment: assignment._id });
    const gradedSubmissions = await SchoolAssignmentSubmission.countDocuments({ assignment: assignment._id, status: 'graded' });
    return {
      ...assignment,
      stats: {
        totalSubmissions,
        gradedSubmissions,
        pendingSubmissions: totalSubmissions - gradedSubmissions
      }
    };
  }

  return assignment;
}

async function updateAssignment(actorUser, schoolContext, assignmentId, updates) {
  const assignment = await SchoolAssignment.findById(assignmentId);
  if (!assignment) {
    const err = new Error('الواجب غير موجود');
    err.status = 404;
    throw err;
  }

  const isCreator = String(assignment.teacher) === String(actorUser._id);
  if (!isCreator && !schoolContext.isManager && !schoolContext.isDeveloper) {
    const err = new Error('لا تملك صلاحية تعديل هذا الواجب');
    err.status = 403;
    throw err;
  }

  const allowedFields = ['title', 'description', 'dueAt', 'maxScore', 'allowLateSubmission', 'status', 'attachments', 'assignedStudents', 'subject', 'stage', 'grade', 'section'];
  for (const f of allowedFields) {
    if (updates[f] !== undefined) {
      if (f === 'dueAt') assignment.dueAt = new Date(updates.dueAt);
      else if (f === 'maxScore') assignment.maxScore = Number(updates.maxScore);
      else assignment[f] = updates[f];
    }
  }

  await assignment.save();
  await logAudit(
    actorUser._id,
    'ASSIGNMENT_UPDATED',
    null,
    `تعديل واجب: "${assignment.title}"`
  );

  return assignment;
}

async function archiveAssignment(actorUser, schoolContext, assignmentId) {
  const assignment = await SchoolAssignment.findById(assignmentId);
  if (!assignment) {
    const err = new Error('الواجب غير موجود');
    err.status = 404;
    throw err;
  }

  const isCreator = String(assignment.teacher) === String(actorUser._id);
  if (!isCreator && !schoolContext.isManager && !schoolContext.isDeveloper) {
    const err = new Error('لا تملك صلاحية أرشفة هذا الواجب');
    err.status = 403;
    throw err;
  }

  assignment.status = 'archived';
  await assignment.save();

  await logAudit(
    actorUser._id,
    'ASSIGNMENT_ARCHIVED',
    null,
    `أرشفة واجب: "${assignment.title}"`
  );

  return assignment;
}

async function submitAssignment(actorUser, schoolContext, assignmentId, data) {
  // Security rule: "guardian cannot submit as student"
  if (schoolContext.isGuardian && !schoolContext.isStudent) {
    const err = new Error('التسليم مخصص للطالب نفسه ولا يحق لولي الأمر تسليم الواجب نيابة عنه');
    err.status = 403;
    throw err;
  }

  let studentProfile = schoolContext.studentProfile;
  if (!studentProfile) {
    studentProfile = await SchoolStudent.findOne({ studentUser: actorUser._id, status: { $ne: 'archived' } });
  }

  if (!studentProfile) {
    const err = new Error('حسابك غير مرتبط بملف طالب نشط لتسليم الواجب');
    err.status = 403;
    throw err;
  }

  // Security rule: "student A cannot read/submit as student B"
  if (data.studentId && String(data.studentId) !== String(studentProfile._id)) {
    const err = new Error('لا تملك صلاحية التسليم نيابة عن طالب آخر');
    err.status = 403;
    throw err;
  }

  const assignment = await SchoolAssignment.findById(assignmentId);
  if (!assignment) {
    const err = new Error('الواجب غير موجود');
    err.status = 404;
    throw err;
  }

  if (assignment.status === 'archived' || assignment.status === 'closed') {
    const err = new Error('هذا الواجب مغلق أو مؤرشف ولا يقبل تسليمات جديدة');
    err.status = 400;
    throw err;
  }

  const now = new Date();
  const isPastDue = now > new Date(assignment.dueAt);

  if (isPastDue && !assignment.allowLateSubmission) {
    const err = new Error('انتهى الموعد النهائي لتسليم هذا الواجب ولا يُقبل التسليم المتأخر');
    err.status = 400;
    throw err;
  }

  const content = String(data.content || data.text || '').trim();
  const attachments = Array.isArray(data.attachments) ? data.attachments : [];

  if (!content && !attachments.length) {
    const err = new Error('يجب كتابة نص الإجابة أو إرفاق ملف على الأقل');
    err.status = 400;
    throw err;
  }

  let submission = await SchoolAssignmentSubmission.findOne({
    assignment: assignment._id,
    student: studentProfile._id
  });

  if (submission) {
    if (submission.status === 'graded') {
      const err = new Error('تم تصحيح هذا الواجب بالفعل ورصد الدرجة، لا يمكن إعادة التسليم');
      err.status = 400;
      throw err;
    }

    submission.content = content;
    if (attachments.length) submission.attachments = attachments;
    submission.submittedAt = now;
    submission.status = isPastDue ? 'late' : 'resubmitted';
    submission.resubmissionCount = (submission.resubmissionCount || 0) + 1;
    await submission.save();

    await logAudit(
      actorUser._id,
      'ASSIGNMENT_RESUBMITTED',
      studentProfile._id,
      `إعادة تسليم واجب "${assignment.title}" للطالب ${studentProfile.name}`
    );
  } else {
    submission = await SchoolAssignmentSubmission.create({
      assignment: assignment._id,
      student: studentProfile._id,
      studentUser: actorUser._id,
      content,
      attachments,
      submittedAt: now,
      status: isPastDue ? 'late' : 'submitted',
      resubmissionCount: 0
    });

    await logAudit(
      actorUser._id,
      'ASSIGNMENT_SUBMITTED',
      studentProfile._id,
      `تسليم واجب "${assignment.title}" للطالب ${studentProfile.name}`
    );
  }

  await submission.populate('student', 'name grade section');
  return submission;
}

async function listSubmissions(actorUser, schoolContext, assignmentId) {
  const assignment = await SchoolAssignment.findById(assignmentId);
  if (!assignment) {
    const err = new Error('الواجب غير موجود');
    err.status = 404;
    throw err;
  }

  if (schoolContext.isStudent && schoolContext.studentProfile) {
    const mySub = await SchoolAssignmentSubmission.find({
      assignment: assignment._id,
      student: schoolContext.studentProfile._id
    }).populate('student', 'name grade section').lean();
    return mySub;
  }

  const isTeacherOwner = String(assignment.teacher) === String(actorUser._id);
  if (schoolContext.isTeacher && !isTeacherOwner && !schoolContext.isManager && !schoolContext.isDeveloper) {
    const err = new Error('لا تملك صلاحية عرض تسليمات واجب لمعلم آخر');
    err.status = 403;
    throw err;
  }

  return SchoolAssignmentSubmission.find({ assignment: assignment._id })
    .populate('student', 'name grade section')
    .populate('studentUser', 'fullName username')
    .populate('gradedBy', 'fullName username')
    .sort({ submittedAt: -1 })
    .lean();
}

async function getSubmission(actorUser, schoolContext, assignmentId, submissionId) {
  const submission = await SchoolAssignmentSubmission.findById(submissionId)
    .populate('assignment')
    .populate('student', 'name grade section')
    .populate('studentUser', 'fullName username')
    .populate('gradedBy', 'fullName username')
    .lean();

  if (!submission || String(submission.assignment?._id || submission.assignment) !== String(assignmentId)) {
    const err = new Error('التسليم غير موجود أو لا ينتمي لهذا الواجب');
    err.status = 404;
    throw err;
  }

  if (schoolContext.isStudent && schoolContext.studentProfile) {
    if (String(submission.student?._id || submission.student) !== String(schoolContext.studentProfile._id)) {
      const err = new Error('لا يمكنك الاطلاع على تسليم طالب آخر');
      err.status = 403;
      throw err;
    }
  } else if (schoolContext.isTeacher && !schoolContext.isManager && !schoolContext.isDeveloper) {
    if (String(submission.assignment?.teacher) !== String(actorUser._id)) {
      const err = new Error('لا تملك صلاحية الاطلاع على تسليم واجب لمعلم آخر');
      err.status = 403;
      throw err;
    }
  }

  return submission;
}

async function gradeSubmission(actorUser, schoolContext, assignmentId, submissionIdOrData, gradeData = {}) {
  let submissionId = typeof submissionIdOrData === 'string' ? submissionIdOrData : (submissionIdOrData.submissionId || submissionIdOrData.id);
  const data = typeof submissionIdOrData === 'object' && !Array.isArray(submissionIdOrData) ? { ...submissionIdOrData, ...gradeData } : gradeData;
  const numScore = Number(data.score !== undefined ? data.score : gradeData.score);
  const feedback = String(data.feedback !== undefined ? data.feedback : (data.teacherFeedback || gradeData.feedback || '')).trim();

  const assignment = await SchoolAssignment.findById(assignmentId);
  if (!assignment) {
    const err = new Error('الواجب غير موجود');
    err.status = 404;
    throw err;
  }

  const isOwner = String(assignment.teacher) === String(actorUser._id);
  if (!isOwner && !schoolContext.isManager && !schoolContext.isDeveloper) {
    const err = new Error('لا تملك صلاحية تصحيح واجب لمعلم آخر');
    err.status = 403;
    throw err;
  }

  let submission = null;
  if (submissionId && mongoose.isValidObjectId(submissionId)) {
    submission = await SchoolAssignmentSubmission.findById(submissionId);
  } else if (data.studentId && mongoose.isValidObjectId(data.studentId)) {
    submission = await SchoolAssignmentSubmission.findOne({ assignment: assignment._id, student: data.studentId });
  }

  if (!submission) {
    const err = new Error('التسليم المراد تصحيحه غير موجود');
    err.status = 404;
    throw err;
  }

  if (isNaN(numScore) || numScore < 0 || numScore > assignment.maxScore) {
    const err = new Error(`الدرجة غير صحيحة أو أكبر من الدرجة القصوى (${assignment.maxScore})`);
    err.status = 400;
    throw err;
  }

  let gradeRecord = null;
  if (submission.gradeRecord) {
    gradeRecord = await SchoolGradeRecord.findById(submission.gradeRecord);
  }

  const gradeTitle = `واجب: ${assignment.title}`;

  if (!gradeRecord) {
    gradeRecord = await SchoolGradeRecord.findOne({
      student: submission.student,
      subject: assignment.subject,
      title: gradeTitle
    });
  }

  const student = await SchoolStudent.findById(submission.student);
  if (!student) {
    const err = new Error('الطالب المرتبط بالتسليم غير موجود');
    err.status = 404;
    throw err;
  }

  student.scores = student.scores || [];
  const existingScoreIdx = student.scores.findIndex(
    s => s.subject === assignment.subject && s.lesson === gradeTitle
  );

  if (gradeRecord) {
    gradeRecord.score = numScore;
    gradeRecord.maxScore = assignment.maxScore;
    gradeRecord.notes = feedback || gradeRecord.notes;
    gradeRecord.teacher = actorUser._id;
    gradeRecord.recordedAt = new Date();
    await gradeRecord.save();

    if (existingScoreIdx >= 0) {
      student.scores[existingScoreIdx].score = numScore;
      student.scores[existingScoreIdx].maxScore = assignment.maxScore;
      student.scores[existingScoreIdx].createdAt = new Date();
    } else {
      student.scores.push({
        subject: assignment.subject,
        lesson: gradeTitle,
        score: numScore,
        maxScore: assignment.maxScore,
        createdAt: new Date()
      });
      student.progress = student.progress || { average: 0, sessions: 0, answered: 0 };
      student.progress.answered += 1;
    }
  } else {
    gradeRecord = await SchoolGradeRecord.create({
      student: student._id,
      teacher: actorUser._id,
      subject: assignment.subject,
      gradeType: 'homework',
      title: gradeTitle,
      score: numScore,
      maxScore: assignment.maxScore,
      notes: feedback,
      recordedAt: new Date()
    });

    if (existingScoreIdx >= 0) {
      student.scores[existingScoreIdx].score = numScore;
      student.scores[existingScoreIdx].maxScore = assignment.maxScore;
      student.scores[existingScoreIdx].createdAt = new Date();
    } else {
      student.scores.push({
        subject: assignment.subject,
        lesson: gradeTitle,
        score: numScore,
        maxScore: assignment.maxScore,
        createdAt: new Date()
      });
      student.progress = student.progress || { average: 0, sessions: 0, answered: 0 };
      student.progress.answered += 1;
    }
  }

  student.progress.average = student.scores.reduce((a, x) => a + (x.score / x.maxScore) * 100, 0) / student.scores.length;
  await student.save();

  submission.score = numScore;
  submission.maxScore = assignment.maxScore;
  submission.teacherFeedback = feedback;
  submission.gradedBy = actorUser._id;
  submission.gradedAt = new Date();
  submission.status = 'graded';
  submission.gradeRecord = gradeRecord._id;
  await submission.save();

  await logAudit(
    actorUser._id,
    'ASSIGNMENT_GRADED',
    student._id,
    `تصحيح واجب "${assignment.title}" للطالب ${student.name}: ${numScore}/${assignment.maxScore}`
  );

  await submission.populate('student', 'name grade section');
  await submission.populate('gradedBy', 'fullName username');

  return { submission, gradeRecord };
}

// --------------------------------------------------------------------------
// 12. Phase 9 — Teacher/student links, guardian approval and alerts
// --------------------------------------------------------------------------
function assertTeacherContext(schoolContext) {
  if (!schoolContext.isTeacher || !schoolContext.teacher) {
    const err = new Error('هذه العملية مخصصة للمعلم المعتمد');
    err.status = 403;
    throw err;
  }
}
async function createTeacherStudentRequest(actorUser, schoolContext, data) {
  assertTeacherContext(schoolContext);
  const student = await SchoolStudent.findById(data.studentId);
  if (!student || student.status === 'archived') { const e=new Error('الطالب غير موجود'); e.status=404; throw e; }
  const t=schoolContext.teacher;
  const subjects=(Array.isArray(data.subjects)?data.subjects:[data.subject]).filter(Boolean).map(String);
  if (!subjects.length) { const e=new Error('يجب تحديد المادة'); e.status=400; throw e; }
  if (t.stages?.length && !t.stages.includes(student.stage)) { const e=new Error('الطالب خارج المراحل المكلف بها المعلم'); e.status=403; throw e; }
  if (t.grades?.length && !t.grades.includes(student.grade)) { const e=new Error('الطالب خارج الصفوف المكلف بها المعلم'); e.status=403; throw e; }
  if (t.subjects?.length && subjects.some(x=>!t.subjects.includes(x))) { const e=new Error('المادة خارج تكليف المعلم'); e.status=403; throw e; }
  const pending=await SchoolTeacherStudentRequest.findOne({teacher:t._id,student:student._id,kind:'ADD',status:'PENDING'});
  if (pending) { const e=new Error('يوجد طلب إضافة معلق لهذا الطالب'); e.status=409; throw e; }
  const request=await SchoolTeacherStudentRequest.create({teacher:t._id,teacherUser:actorUser._id,student:student._id,guardian:student.guardian,kind:'ADD',requestedBy:'TEACHER',stage:student.stage,grade:student.grade,section:student.section||'أ',subjects,status:'PENDING',note:String(data.note||'')});
  await logAudit(actorUser._id,'TEACHER_STUDENT_ADD_REQUESTED',student._id,\`طلب إضافة \${student.name}: \${subjects.join('، ')}\`);
  return request.populate('student','name stage grade section');
}
async function requestStudentRemoval(actorUser, schoolContext, studentId, data={}) {
  assertTeacherContext(schoolContext);
  const student=await SchoolStudent.findById(studentId);
  if (!student) { const e=new Error('الطالب غير موجود'); e.status=404; throw e; }
  const linked=student.assignedTeachers?.some(x=>String(x.teacher)===String(schoolContext.teacher._id));
  if (!linked) { const e=new Error('الطالب غير مرتبط بهذا المعلم'); e.status=409; throw e; }
  const pending=await SchoolTeacherStudentRequest.findOne({teacher:schoolContext.teacher._id,student:student._id,kind:'REMOVE',status:'PENDING'});
  if (pending) return pending;
  const subjects=(Array.isArray(data.subjects)?data.subjects:[]).filter(Boolean);
  const request=await SchoolTeacherStudentRequest.create({teacher:schoolContext.teacher._id,teacherUser:actorUser._id,student:student._id,guardian:student.guardian,kind:'REMOVE',requestedBy:'TEACHER',stage:student.stage,grade:student.grade,section:student.section||'أ',subjects,status:'PENDING',note:String(data.note||'')});
  await logAudit(actorUser._id,'TEACHER_STUDENT_REMOVE_REQUESTED',student._id,'طلب فك ارتباط؛ ينتظر موافقة ولي الأمر');
  return request;
}
async function listTeacherStudentRequests(actorUser, schoolContext) {
  let q={};
  if (schoolContext.isTeacher) q.teacher=schoolContext.teacher._id;
  else if (schoolContext.isGuardian) q.guardian=actorUser._id;
  else if (!schoolContext.isManager && !schoolContext.isDeveloper) { const e=new Error('غير مصرح'); e.status=403; throw e; }
  return SchoolTeacherStudentRequest.find(q).populate('student','name stage grade section').populate('teacher','name subjects').sort({createdAt:-1}).lean();
}
async function decideTeacherStudentRequest(actorUser, schoolContext, requestId, approve) {
  const request=await SchoolTeacherStudentRequest.findById(requestId);
  if (!request) { const e=new Error('الطلب غير موجود'); e.status=404; throw e; }
  if (!schoolContext.isDeveloper && String(request.guardian)!==String(actorUser._id)) { const e=new Error('الموافقة أو الرفض لولي أمر الطالب فقط'); e.status=403; throw e; }
  if (request.status!=='PENDING') { const e=new Error('تم البت في هذا الطلب مسبقاً'); e.status=409; throw e; }
  request.status=approve?'APPROVED':'REJECTED'; request.decidedBy=actorUser._id; request.decidedAt=new Date(); await request.save();
  if (approve) {
    const student=await SchoolStudent.findById(request.student);
    if (request.kind==='ADD') {
      const existingSubjects=new Set((student.assignedTeachers||[]).filter(x=>String(x.teacher)===String(request.teacher)).map(x=>x.subject).filter(Boolean));
      request.subjects.forEach(subject=>{ if(!existingSubjects.has(subject)) student.assignedTeachers.push({teacher:request.teacher,subject}); });
      const teacher=await SchoolTeacher.findById(request.teacher);
      if (teacher && !teacher.assignedStudents.some(x=>String(x)===String(student._id))) teacher.assignedStudents.push(student._id), await teacher.save();
    } else {
      student.assignedTeachers=(student.assignedTeachers||[]).filter(x=>String(x.teacher)!==String(request.teacher));
      await SchoolTeacher.updateOne({_id:request.teacher},{$pull:{assignedStudents:student._id}});
    }
    await student.save();
  }
  await logAudit(actorUser._id,approve?'TEACHER_STUDENT_REQUEST_APPROVED':'TEACHER_STUDENT_REQUEST_REJECTED',request.student,\`\${request.kind} \${request._id}\`);
  return request;
}
async function listGuardianNotifications(actorUser, schoolContext) {
  let q={};
  if (schoolContext.isGuardian) q.guardian=actorUser._id;
  else if (!schoolContext.isManager && !schoolContext.isDeveloper) { const e=new Error('التنبيهات لولي الأمر أو الإدارة'); e.status=403; throw e; }
  return SchoolGuardianNotification.find(q).populate('student','name stage grade section').sort({createdAt:-1}).limit(100).lean();
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
  getStudentAttendanceHistory,
  getStudentGradesHistory,
  getStudentProgress,
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
  listAuditLogs,
  // Teacher Applications
  submitTeacherApplication,
  listTeacherApplications,
  getTeacherApplication,
  approveTeacherApplication,
  rejectTeacherApplication,
  // 30-Day Student Trial
  computeStudentTrialInfo: SchoolStudent.computeTrialInfo,
  convertStudentTrial,
  getStudentTrial,
  // Assignments, Submissions & Grading
  createAssignment,
  listAssignments,
  getAssignment,
  updateAssignment,
  archiveAssignment,
  submitAssignment,
  listSubmissions,
  getSubmission,
  gradeSubmission,
  createTeacherStudentRequest,
  requestStudentRemoval,
  listTeacherStudentRequests,
  decideTeacherStudentRequest,
  listGuardianNotifications
};
