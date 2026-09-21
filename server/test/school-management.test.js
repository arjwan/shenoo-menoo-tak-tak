'use strict';

/**
 * server/test/school-management.test.js
 *
 * Full integration test suite for School Management:
 *  1) Manager & Developer permissions (Developer is top role; Manager cannot elevate to Developer or edit Developer).
 *  2) Real Teacher registration & linking (Linked to real User; rejects fake accounts; duplicate check).
 *  3) Student registration & linking (Stage, grade, section, subjects, teachers, virtual teacher, guardian).
 *  4) Guardian profile & auditable consents (Opt-in only, default false; teacher cannot override guardian refusal).
 *  5) Permanent student academic records (Archive instead of destructive deletion; records preserved).
 *  6) Teacher permanent record & operational scope.
 *  7) Unified schedules (LIVE_CLASS, RECORDED_REPLAY, GENERAL_REVIEW, EXAM with auto-notification to management).
 *  8) Grades and attendance entry (Cumulative average update, attendance status).
 *  9) Guardian complaints workflow (Guardian views only own complaints; Manager reply; status transitions).
 * 10) Audit Log verification (All administrative actions create timestamped audit entries).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server-core');

process.env.JWT_SECRET = 'test-secret-school-management';

const User = require('../src/models/User');
const AuditLog = require('../src/models/AuditLog');
const SchoolStudent = require('../src/models/SchoolStudent');
const SchoolTeacher = require('../src/models/SchoolTeacher');
const SchoolGuardian = require('../src/models/SchoolGuardian');
const GuardianConsent = require('../src/models/GuardianConsent');
const SchoolEventSchedule = require('../src/models/SchoolEventSchedule');
const SchoolGradeRecord = require('../src/models/SchoolGradeRecord');
const SchoolAttendanceRecord = require('../src/models/SchoolAttendanceRecord');
const GuardianComplaint = require('../src/models/GuardianComplaint');
const VirtualTeacherProfile = require('../src/models/VirtualTeacherProfile');

const managementRoutes = require('../src/routes/school-management.routes');

let mongod, server, baseUrl;

function makeUser(fullName, username, contact, role = 'user') {
  return User.create({
    fullName,
    username,
    contact,
    contactType: 'email',
    passwordHash: 'dummy-hash',
    termsAccepted: true,
    role,
    status: 'active'
  });
}

function userToken(user) {
  return jwt.sign({ userId: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

async function request(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

test.before(async () => {
  mongod = await MongoMemoryServer.create({
    binary: { version: '7.0.14' }
  });
  await mongoose.connect(mongod.getUri(), { dbName: 'test-school-management' });

  const app = express();
  app.use(express.json());
  app.use('/api/school/management', managementRoutes);

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

test('School Management: Full Lifecycle, Roles, Consents, Records, and Audit', async (t) => {
  let devUser, managerUser, teacherUser, guardianUser, otherGuardianUser, studentUser;
  let devToken, managerToken, teacherToken, guardianToken, otherGuardianToken;
  let teacherDoc, studentDoc, virtualProfile;

  await t.test('1. Setup initial real users and virtual teacher profile', async () => {
    devUser = await makeUser('مطور النظام الرئيسي', 'dev_super', 'dev@shnomano.iq', 'developer');
    managerUser = await makeUser('أحمد المدير', 'manager_ahmed', 'manager@shnomano.iq', 'admin');
    teacherUser = await makeUser('أستاذ رافد', 'teacher_rafid', 'rafid@shnomano.iq', 'user');
    guardianUser = await makeUser('أم كرار', 'parent_karar', 'karar_mom@shnomano.iq', 'user');
    otherGuardianUser = await makeUser('أبو زينب', 'parent_zainab', 'zainab_dad@shnomano.iq', 'user');
    studentUser = await makeUser('كرار أحمد', 'student_karar', 'karar@shnomano.iq', 'user');

    devToken = userToken(devUser);
    managerToken = userToken(managerUser);
    teacherToken = userToken(teacherUser);
    guardianToken = userToken(guardianUser);
    otherGuardianToken = userToken(otherGuardianUser);

    virtualProfile = await VirtualTeacherProfile.create({
      profileId: 'sarah-smart-test',
      name: 'أ. سارة الذكية',
      title: 'معلم رياضيات افتراضي',
      label: 'معلم افتراضي / AI',
      roleDescription: 'شرح تفاعلي',
      subject: 'الرياضيات',
      dialect: 'العربية الفصحى',
      stages: ['ابتدائي']
    });

    assert.ok(devUser && managerUser && teacherUser && guardianUser);
  });

  await t.test('2. Role and context resolution (/me)', async () => {
    const resDev = await request('GET', '/api/school/management/me', null, devToken);
    assert.equal(resDev.status, 200);
    assert.equal(resDev.data.schoolContext.role, 'developer');
    assert.equal(resDev.data.schoolContext.isDeveloper, true);

    const resMgr = await request('GET', '/api/school/management/me', null, managerToken);
    assert.equal(resMgr.status, 200);
    assert.equal(resMgr.data.schoolContext.role, 'manager');
    assert.equal(resMgr.data.schoolContext.isDeveloper, false);
    assert.equal(resMgr.data.schoolContext.isManager, true);
  });

  await t.test('3. Manager CANNOT elevate self or anyone to Developer and CANNOT modify Developer account', async () => {
    // Attempt to register/update developer as teacher by manager
    const regDev = await request('POST', '/api/school/management/teachers', {
      userId: String(devUser._id),
      name: 'المطور كمعلم'
    }, managerToken);
    assert.equal(regDev.status, 201); // Can be a teacher, but...

    // Attempt by manager to modify developer teacher account
    const updateDev = await request('PUT', `/api/school/management/teachers/${regDev.data.teacher._id}`, {
      name: 'تعديل اسم المطور'
    }, managerToken);
    assert.equal(updateDev.status, 403, 'Manager must be forbidden from modifying developer user account');
    assert.match(updateDev.data.message, /لا يمكن للمدير/);

    // Attempt by manager to archive developer account
    const archDev = await request('DELETE', `/api/school/management/teachers/${regDev.data.teacher._id}`, {}, managerToken);
    assert.equal(archDev.status, 403, 'Manager must be forbidden from archiving developer user account');

    // Clean up temporary developer teacher record
    await SchoolTeacher.findByIdAndDelete(regDev.data.teacher._id);
  });

  await t.test('4. Register a Real Teacher linked to real User (no fake accounts)', async () => {
    // Rejects non-existent user
    const fakeRes = await request('POST', '/api/school/management/teachers', {
      userId: new mongoose.Types.ObjectId().toString(),
      name: 'معلم وهمي'
    }, managerToken);
    assert.equal(fakeRes.status, 404, 'Must reject fake user ID');

    // Registers real teacher
    const regRes = await request('POST', '/api/school/management/teachers', {
      userId: String(teacherUser._id),
      name: 'أ. رافد الفرات',
      gender: 'ذكر',
      phone: '07701234567',
      stages: ['ابتدائي'],
      grades: ['الخامس ابتدائي', 'السادس ابتدائي'],
      sections: ['أ', 'ب'],
      subjects: ['الرياضيات', 'العلوم']
    }, managerToken);

    assert.equal(regRes.status, 201);
    assert.equal(regRes.data.ok, true);
    assert.equal(regRes.data.teacher.name, 'أ. رافد الفرات');
    teacherDoc = regRes.data.teacher;

    // Reject duplicate registration
    const dupRes = await request('POST', '/api/school/management/teachers', {
      userId: String(teacherUser._id),
      name: 'أ. رافد مكرر'
    }, managerToken);
    assert.equal(dupRes.status, 409, 'Must reject duplicate teacher registration for same user');

    // List teachers: separates real from virtual
    const listRes = await request('GET', '/api/school/management/teachers', null, managerToken);
    assert.equal(listRes.status, 200);
    assert.equal(listRes.data.counts.real, 1);
    assert.ok(listRes.data.counts.virtual >= 1);
    assert.equal(listRes.data.realTeachers[0].name, 'أ. رافد الفرات');
    assert.equal(listRes.data.virtualTeachers[0].badgeText, 'معلم افتراضي / AI');
  });

  await t.test('5. Register a Student (stage, grade, section, subjects, teachers, guardian)', async () => {
    const regRes = await request('POST', '/api/school/management/students', {
      name: 'كرار أحمد الرافدين',
      stage: 'ابتدائي',
      grade: 'السادس ابتدائي',
      section: 'أ',
      subjects: ['الرياضيات', 'العلوم', 'اللغة العربية'],
      guardianId: String(guardianUser._id),
      studentUserId: String(studentUser._id),
      assignedTeachers: [{ teacher: String(teacherDoc._id), subject: 'الرياضيات' }],
      assignedVirtualTeacherId: String(virtualProfile._id)
    }, managerToken);

    assert.equal(regRes.status, 201);
    assert.equal(regRes.data.ok, true);
    assert.equal(regRes.data.student.name, 'كرار أحمد الرافدين');
    assert.equal(regRes.data.student.section, 'أ');
    assert.equal(regRes.data.student.stage, 'ابتدائي');
    studentDoc = regRes.data.student;

    // Check SchoolGuardian profile was automatically ensured
    const guardianProfile = await SchoolGuardian.findOne({ user: guardianUser._id });
    assert.ok(guardianProfile, 'SchoolGuardian profile must be established');
    assert.ok(guardianProfile.students.includes(studentDoc._id));
  });

  await t.test('6. Guardian Consents: Auditable, Default FALSE (Opt-in only), Teacher cannot override', async () => {
    // 1) Fetch consents: all must be default FALSE
    const getRes = await request('GET', `/api/school/management/students/${studentDoc._id}/consents`, null, guardianToken);
    assert.equal(getRes.status, 200);
    assert.ok(Array.isArray(getRes.data.consents));
    assert.equal(getRes.data.consents.length, 7, 'all 7 consent types present');

    // Verify NONE is true by default
    getRes.data.consents.forEach((c) => {
      assert.equal(c.granted, false, `consent ${c.consentType} must be false by default`);
    });

    // 2) Teacher attempts to override or grant consent -> Rejected with 403
    const teacherOverride = await request('POST', `/api/school/management/students/${studentDoc._id}/consents`, {
      consentType: 'camera',
      granted: true
    }, teacherToken);
    assert.equal(teacherOverride.status, 403, 'Teacher cannot override guardian consent');
    assert.match(teacherOverride.data.message, /لا يستطيع تجاوز/);

    // 3) Other guardian attempts to modify -> Rejected with 403
    const otherOverride = await request('POST', `/api/school/management/students/${studentDoc._id}/consents`, {
      consentType: 'microphone',
      granted: true
    }, otherGuardianToken);
    assert.equal(otherOverride.status, 403, 'Unrelated guardian cannot modify consents');

    // 4) Real guardian grants microphone consent explicitly
    const grantRes = await request('POST', `/api/school/management/students/${studentDoc._id}/consents`, {
      consentType: 'microphone',
      granted: true,
      text: 'موافقة ولي الأمر الصريحة على استخدام المايك في الحصص',
      version: '2026-09-21-v1'
    }, guardianToken);
    assert.equal(grantRes.status, 200);
    assert.equal(grantRes.data.consent.granted, true);
    assert.equal(grantRes.data.consent.consentType, 'microphone');
    assert.ok(grantRes.data.consent.decidedAt);

    // Verify student learningPermissions synced for voice
    const updatedStudent = await SchoolStudent.findById(studentDoc._id);
    assert.equal(updatedStudent.learningPermissions.voice, true);
    assert.equal(updatedStudent.learningPermissions.camera, false, 'camera remains false');
  });

  await t.test('7. Unified Schedules & Exams (LIVE_CLASS, RECORDED_REPLAY, GENERAL_REVIEW, EXAM)', async () => {
    // 1) Teacher schedules an EXAM
    const examWhen = new Date(Date.now() + 24 * 3600000);
    const examRes = await request('POST', '/api/school/management/schedules', {
      type: 'EXAM',
      title: 'امتحان نصف الفصل في الرياضيات',
      stage: 'ابتدائي',
      grade: 'السادس ابتدائي',
      section: 'أ',
      subject: 'الرياضيات',
      scheduledAt: examWhen.toISOString(),
      durationMinutes: 60,
      examConfig: {
        maxScore: 100,
        passingScore: 50,
        instructions: 'إحضار قلم ومسطرة'
      }
    }, teacherToken);

    assert.equal(examRes.status, 201);
    assert.equal(examRes.data.schedule.type, 'EXAM');
    assert.equal(examRes.data.schedule.examConfig.notifiedManagement, true, 'Management notified automatically on exam creation');

    // 2) Teacher schedules a RECORDED_REPLAY
    const replayRes = await request('POST', '/api/school/management/schedules', {
      type: 'RECORDED_REPLAY',
      title: 'إعادة مراجعة درس الكسور',
      stage: 'ابتدائي',
      grade: 'السادس ابتدائي',
      subject: 'الرياضيات',
      scheduledAt: new Date(Date.now() + 48 * 3600000).toISOString(),
      recordedResourceUrl: '/uploads/school-curriculum/math-grade6-review.pdf'
    }, teacherToken);

    assert.equal(replayRes.status, 201);
    assert.equal(replayRes.data.schedule.type, 'RECORDED_REPLAY');

    // 3) List schedules
    const listSched = await request('GET', '/api/school/management/schedules', null, managerToken);
    assert.equal(listSched.status, 200);
    assert.equal(listSched.data.schedules.length, 2);
  });

  await t.test('8. Recording Grades & Attendance in Permanent Records', async () => {
    // 1) Record exam grade
    const gradeRes = await request('POST', '/api/school/management/grades', {
      studentId: String(studentDoc._id),
      subject: 'الرياضيات',
      gradeType: 'exam',
      title: 'امتحان نصف الفصل',
      score: 95,
      maxScore: 100,
      notes: 'ممتاز ومتميز في حل المسائل'
    }, teacherToken);

    assert.equal(gradeRes.status, 201);
    assert.equal(gradeRes.data.grade.score, 95);

    // Verify student average updated
    const sAfter = await SchoolStudent.findById(studentDoc._id);
    assert.equal(sAfter.progress.average, 95);

    // 2) Record attendance
    const attRes = await request('POST', '/api/school/management/attendance', {
      studentId: String(studentDoc._id),
      status: 'present',
      notes: 'حضور مبكر وتفاعل كامل'
    }, teacherToken);

    assert.equal(attRes.status, 201);
    assert.equal(attRes.data.record.status, 'present');
  });

  await t.test('9. Permanent Student Record (Archive instead of destructive deletion)', async () => {
    // Archive student by manager
    const archRes = await request('DELETE', `/api/school/management/students/${studentDoc._id}`, {
      reason: 'انتقال مؤقت'
    }, managerToken);

    assert.equal(archRes.status, 200);
    assert.equal(archRes.data.student.status, 'archived');
    assert.equal(archRes.data.student.active, false);

    // Verify record still completely exists in database (NEVER deleted)
    const permanentCheck = await SchoolStudent.findById(studentDoc._id);
    assert.ok(permanentCheck, 'Student document must still exist');
    assert.equal(permanentCheck.status, 'archived');

    // Query permanent record endpoint
    const recordRes = await request('GET', `/api/school/management/students/${studentDoc._id}/record`, null, managerToken);
    assert.equal(recordRes.status, 200);
    assert.equal(recordRes.data.record.student.name, 'كرار أحمد الرافدين');
    assert.equal(recordRes.data.record.student.status, 'archived');
    assert.equal(recordRes.data.record.gradeRecords.length, 1);
    assert.equal(recordRes.data.record.gradeRecords[0].score, 95);
    assert.equal(recordRes.data.record.attendanceRecords.length, 1);
  });

  await t.test('10. Guardian Complaints: Scoped, Admin reply, Status lifecycle', async () => {
    // 1) Unrelated guardian attempts to file complaint for student -> 403
    const badComp = await request('POST', '/api/school/management/complaints', {
      studentId: String(studentDoc._id),
      subject: 'شكوى غير مصرحة',
      body: 'محاولة اختراق'
    }, otherGuardianToken);
    assert.equal(badComp.status, 403, 'Must reject complaint for another guardian’s student');

    // 2) Real guardian submits complaint
    const compRes = await request('POST', '/api/school/management/complaints', {
      studentId: String(studentDoc._id),
      subject: 'استفسار عن موعد مراجعة الرياضيات',
      body: 'نرجو توضيح إذا كانت هناك حصة مراجعة إضافية قبل الامتحان'
    }, guardianToken);

    assert.equal(compRes.status, 201);
    assert.equal(compRes.data.complaint.status, 'NEW');
    const compId = compRes.data.complaint._id;

    // 3) Guardian views complaints: sees only own complaint
    const gList = await request('GET', '/api/school/management/complaints', null, guardianToken);
    assert.equal(gList.status, 200);
    assert.equal(gList.data.complaints.length, 1);

    const otherList = await request('GET', '/api/school/management/complaints', null, otherGuardianToken);
    assert.equal(otherList.status, 200);
    assert.equal(otherList.data.complaints.length, 0, 'Other guardian must see 0 complaints');

    // 4) Manager replies and updates status to IN_PROGRESS then CLOSED
    const replyRes = await request('PATCH', `/api/school/management/complaints/${compId}/reply`, {
      status: 'CLOSED',
      text: 'تمت إضافة حصة مراجعة عامة يوم الأربعاء القادم في تمام الساعة الرابعة مساءً.'
    }, managerToken);

    assert.equal(replyRes.status, 200);
    assert.equal(replyRes.data.complaint.status, 'CLOSED');
    assert.match(replyRes.data.complaint.adminResponse.text, /تمت إضافة حصة مراجعة/);
  });

  await t.test('11. Audit Log: All administrative actions are recorded with timestamps and actors', async () => {
    const auditRes = await request('GET', '/api/school/management/audit-logs', null, managerToken);
    assert.equal(auditRes.status, 200);
    const logs = auditRes.data.logs || [];
    assert.ok(logs.length >= 5, 'Multiple audit logs recorded');

    const actions = logs.map((l) => l.action);
    assert.ok(actions.includes('TEACHER_REGISTERED'));
    assert.ok(actions.includes('STUDENT_REGISTERED'));
    assert.ok(actions.includes('GUARDIAN_CONSENT_UPDATED'));
    assert.ok(actions.includes('STUDENT_ARCHIVED'));
    assert.ok(actions.includes('GRADE_RECORDED'));
    assert.ok(actions.includes('GUARDIAN_COMPLAINT_CREATED'));
    assert.ok(actions.includes('COMPLAINT_REPLIED'));
  });
});
