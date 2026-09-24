'use strict';

/**
 * server/test/school-phase7-student.test.js
 *
 * Full lifecycle integration test for Sumer Phase 7 Real Student Workspace:
 *  1) Student Authentication & Context Resolution with trialInfo & assignedTeachers
 *  2) Scoped Permanent Record Access (Self allowed, Other Student 403 Forbidden)
 *  3) Student Attendance History & Rate Calculation (/attendance)
 *  4) Student Grades History & Subject-by-Subject Averages (/grades)
 *  5) Student Learning Progress & Activities Breakdown (/progress)
 *  6) Dual Reader OCR Page Lookup (/books/:id/page/:page)
 *  7) Curriculum Search Indexed Hit Retrieval (/curriculum/search)
 *  8) Assignment Lifecycle: Submission, Resubmission, Grading & Locked State
 *  9) AI Virtual Teacher Official Profiles (/virtual/profiles - strictly Sarah, Ali, Mariam)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server-core');

process.env.JWT_SECRET = 'test-secret-school-phase7';

const User = require('../src/models/User');
const AuditLog = require('../src/models/AuditLog');
const SchoolStudent = require('../src/models/SchoolStudent');
const SchoolTeacher = require('../src/models/SchoolTeacher');
const SchoolAttendanceRecord = require('../src/models/SchoolAttendanceRecord');
const SchoolGradeRecord = require('../src/models/SchoolGradeRecord');
const SchoolLearningRecord = require('../src/models/SchoolLearningRecord');
const SchoolAssignment = require('../src/models/SchoolAssignment');
const SchoolAssignmentSubmission = require('../src/models/SchoolAssignmentSubmission');
const VirtualTeacherProfile = require('../src/models/VirtualTeacherProfile');

const managementRoutes = require('../src/routes/school-management.routes');
const assignmentRoutes = require('../src/routes/school-assignment.routes');
const classroomRoutes = require('../src/routes/school-classroom.routes');
const virtualRoutes = require('../src/routes/school-virtual.routes');

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

function requestJson(server, method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders = { ...headers };
    if (payload) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request(
      {
        host: '127.0.0.1',
        port: addr.port,
        path,
        method,
        headers: reqHeaders
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let data = null;
          try {
            data = raw ? JSON.parse(raw) : null;
          } catch (_) {
            data = raw;
          }
          resolve({ status: res.statusCode, headers: res.headers, data });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

test('Sumer Phase 7: Real Student Workspace Full Integration Test', async (t) => {
  let mongoServer;
  let app;
  let server;

  let teacherUser, teacherProfile;
  let guardianUser;
  let student1User, student1Profile;
  let student2User, student2Profile;

  let teacherToken, student1Token, student2Token;

  t.before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    app = express();
    app.use(express.json());

    // Mount management, assignment, classroom and virtual routes
    app.use('/api/school/management', managementRoutes);
    app.use('/api/school/assignments', assignmentRoutes);
    app.use('/api/school', classroomRoutes);
    app.use('/api/school/virtual', virtualRoutes);

    app.use((err, req, res, next) => {
      res.status(err.status || 500).json({ ok: false, message: err.message });
    });

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

    // 1. Create real users and profiles
    teacherUser = await makeUser('أ. علي حسين', 'teacher_ali', 'ali@sumer.iq', 'user');
    teacherToken = userToken(teacherUser);

    teacherProfile = await SchoolTeacher.create({
      user: teacherUser._id,
      name: teacherUser.fullName,
      specialty: 'الرياضيات',
      stages: ['متوسط'],
      subjects: ['الرياضيات'],
      classes: ['الثاني متوسط'],
      active: true
    });

    guardianUser = await makeUser('حيدر العراقي', 'guardian_haider', 'haider@sumer.iq', 'user');

    student1User = await makeUser('يوسف العراقي', 'student_yousif', 'yousif@sumer.iq', 'user');
    student1Token = userToken(student1User);

    student1Profile = await SchoolStudent.create({
      name: student1User.fullName,
      studentUser: student1User._id,
      guardian: guardianUser._id,
      stage: 'متوسط',
      grade: 'الثاني متوسط',
      section: 'أ',
      subjects: ['الرياضيات', 'العلوم', 'اللغة العربية'],
      assignedTeachers: [{ teacher: teacherProfile._id, subject: 'الرياضيات' }],
      trialStatus: 'active',
      trialExpiresAt: new Date(Date.now() + 28 * 86400000),
      active: true
    });

    student2User = await makeUser('فاطمة أحمد', 'student_fatima', 'fatima@sumer.iq', 'user');
    student2Token = userToken(student2User);

    student2Profile = await SchoolStudent.create({
      name: student2User.fullName,
      studentUser: student2User._id,
      guardian: guardianUser._id,
      stage: 'متوسط',
      grade: 'الثاني متوسط',
      section: 'ب',
      subjects: ['الرياضيات', 'العلوم'],
      trialStatus: 'active',
      trialExpiresAt: new Date(Date.now() + 20 * 86400000),
      active: true
    });

    // Seed Attendance records for student1
    await SchoolAttendanceRecord.create([
      { student: student1Profile._id, stage: 'متوسط', grade: 'الثاني متوسط', section: 'أ', subject: 'الرياضيات', status: 'present', teacher: teacherUser._id, date: new Date() },
      { student: student1Profile._id, stage: 'متوسط', grade: 'الثاني متوسط', section: 'أ', subject: 'العلوم', status: 'present', teacher: teacherUser._id, date: new Date(Date.now() - 86400000) },
      { student: student1Profile._id, stage: 'متوسط', grade: 'الثاني متوسط', section: 'أ', subject: 'اللغة العربية', status: 'late', teacher: teacherUser._id, date: new Date(Date.now() - 2 * 86400000) }
    ]);

    // Seed Grade records for student1
    await SchoolGradeRecord.create([
      { title: 'اختبار الشهر الأول', student: student1Profile._id, stage: 'متوسط', grade: 'الثاني متوسط', subject: 'الرياضيات', type: 'quiz', score: 90, maxScore: 100, teacher: teacherUser._id, feedback: 'ممتاز جداً' },
      { title: 'واجب المعادلات', student: student1Profile._id, stage: 'متوسط', grade: 'الثاني متوسط', subject: 'العلوم', type: 'homework', score: 80, maxScore: 100, teacher: teacherUser._id, feedback: 'حل متكامل' }
    ]);

    // Seed Learning records for student1
    await SchoolLearningRecord.create([
      { guardian: guardianUser._id, student: student1Profile._id, subject: 'الرياضيات', question: 'ما هو تعريف المعادلة الخطية؟', answer: 'معادلة من الدرجة الأولى', correct: true },
      { guardian: guardianUser._id, student: student1Profile._id, subject: 'العلوم', question: 'ما هي حالات المادة الأساسية؟', answer: 'صلبة وسائلة وغازية', correct: true }
    ]);

    // Seed virtual profiles
    await VirtualTeacherProfile.deleteMany({});
    await VirtualTeacherProfile.create([
      { profileId: 'sarah-smart', name: 'أ. سارة الذكية', label: 'معلم افتراضي / AI', title: 'معلمة ذكاء اصطناعي متخصصة في العلوم والرياضيات', specialties: ['الرياضيات', 'العلوم'], active: true },
      { profileId: 'ali-wise', name: 'أ. علي الحكيم', label: 'معلم افتراضي / AI', title: 'معلم ذكاء اصطناعي متخصص في اللغة العربية', specialties: ['اللغة العربية'], active: true },
      { profileId: 'mariam-nour', name: 'أ. مريم النور', label: 'معلمة افتراضية / AI', title: 'معلمة ذكاء اصطناعي متخصصة في الاجتماعيات', specialties: ['الاجتماعيات'], active: true }
    ]);
  });

  t.after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  await t.test('1. Student Permanent Record Scoping (/students/:id/record)', async () => {
    // Student 1 accesses own record via 'me'
    const resMe = await requestJson(server, 'GET', '/api/school/management/students/me/record', {
      Authorization: `Bearer ${student1Token}`
    });
    assert.equal(resMe.status, 200);
    assert.equal(resMe.data.ok, true);
    assert.equal(resMe.data.record.student.name, 'يوسف العراقي');
    assert.equal(resMe.data.record.attendanceRecords.length, 3);
    assert.equal(resMe.data.record.gradeRecords.length, 2);

    // Student 1 accesses own record via student1Profile._id
    const resOwn = await requestJson(server, 'GET', `/api/school/management/students/${student1Profile._id}/record`, {
      Authorization: `Bearer ${student1Token}`
    });
    assert.equal(resOwn.status, 200);

    // Student 1 attempts to access Student 2 record (403 Forbidden)
    const resForbidden = await requestJson(server, 'GET', `/api/school/management/students/${student2Profile._id}/record`, {
      Authorization: `Bearer ${student1Token}`
    });
    assert.equal(resForbidden.status, 403);
    assert.equal(resForbidden.data.ok, false);
    assert.ok(resForbidden.data.message.includes('لا يمكنك الاطلاع إلا على سجلك الأكاديمي الخاص فقط'));
  });

  await t.test('2. Student Attendance History & Rate (/students/:id/attendance)', async () => {
    const resAtt = await requestJson(server, 'GET', '/api/school/management/students/me/attendance', {
      Authorization: `Bearer ${student1Token}`
    });
    assert.equal(resAtt.status, 200);
    assert.equal(resAtt.data.ok, true);
    assert.equal(resAtt.data.records.length, 3);
    assert.equal(resAtt.data.summary.total, 3);
    assert.equal(resAtt.data.summary.present, 2);
    assert.equal(resAtt.data.summary.late, 1);
    assert.equal(resAtt.data.summary.absent, 0);
    assert.equal(resAtt.data.summary.attendanceRate, 100);

    // ZERO attendance records MUST NOT return 100% (Zero Fake Attendance)
    const resAttZero = await requestJson(server, 'GET', '/api/school/management/students/me/attendance', {
      Authorization: `Bearer ${student2Token}`
    });
    assert.equal(resAttZero.status, 200);
    assert.equal(resAttZero.data.records.length, 0);
    assert.equal(resAttZero.data.summary.total, 0);
    assert.equal(resAttZero.data.summary.attendanceRate, null, 'صفر سجلات حضور لا يجوز أن ينتج نسبة 100%');

    // Cross-student access forbidden
    const resForbidden = await requestJson(server, 'GET', `/api/school/management/students/${student2Profile._id}/attendance`, {
      Authorization: `Bearer ${student1Token}`
    });
    assert.equal(resForbidden.status, 403);
  });

  await t.test('3. Student Grades History & Averages (/students/:id/grades)', async () => {
    const resGrades = await requestJson(server, 'GET', '/api/school/management/students/me/grades', {
      Authorization: `Bearer ${student1Token}`
    });
    assert.equal(resGrades.status, 200);
    assert.equal(resGrades.data.ok, true);
    assert.equal(resGrades.data.records.length, 2);
    assert.equal(resGrades.data.summary.totalAssessments, 2);
    assert.equal(resGrades.data.summary.averageScore, 85);
    assert.ok(resGrades.data.summary.bySubject['الرياضيات']);
    assert.equal(resGrades.data.summary.bySubject['الرياضيات'].average, 90);

    // ZERO grade records MUST NOT return fabricated average
    const resGradesZero = await requestJson(server, 'GET', '/api/school/management/students/me/grades', {
      Authorization: `Bearer ${student2Token}`
    });
    assert.equal(resGradesZero.status, 200);
    assert.equal(resGradesZero.data.records.length, 0);
    assert.equal(resGradesZero.data.summary.totalAssessments, 0);
    assert.equal(resGradesZero.data.summary.averageScore, null, 'صفر تقييمات لا يجوز أن ينتج معدلاً وهمياً');

    // Cross-student access forbidden
    const resForbidden = await requestJson(server, 'GET', `/api/school/management/students/${student2Profile._id}/grades`, {
      Authorization: `Bearer ${student1Token}`
    });
    assert.equal(resForbidden.status, 403);
  });

  await t.test('4. Student Learning Progress Breakdown (/students/:id/progress)', async () => {
    const resProg = await requestJson(server, 'GET', '/api/school/management/students/me/progress', {
      Authorization: `Bearer ${student1Token}`
    });
    assert.equal(resProg.status, 200);
    assert.equal(resProg.data.ok, true);
    assert.equal(resProg.data.studentName, 'يوسف العراقي');
    assert.ok(Array.isArray(resProg.data.learningRecords));
    assert.ok(Array.isArray(resProg.data.subjectProgress));
  });

  await t.test('5. Dual Reader OCR Page Lookup & Search (/books/:id/page/:page & /curriculum/search)', async () => {
    // Search curriculum
    const resSearch = await requestJson(server, 'GET', `/api/school/curriculum/search?q=${encodeURIComponent('العراق')}&limit=5`, {
      Authorization: `Bearer ${student1Token}`
    });
    assert.equal(resSearch.status, 200);
    assert.equal(resSearch.data.ok, true);
    assert.ok(Array.isArray(resSearch.data.results));
    assert.ok(resSearch.data.results.length > 0);

    const hit = resSearch.data.results[0];
    assert.ok(hit.bookId);
    assert.ok(hit.page);

    // Page lookup by bookId and pageNum
    const resPage = await requestJson(server, 'GET', `/api/school/books/${encodeURIComponent(hit.bookId)}/page/${hit.page}`, {
      Authorization: `Bearer ${student1Token}`
    });
    assert.equal(resPage.status, 200);
    assert.equal(resPage.data.ok, true);
    assert.equal(resPage.data.page, hit.page);
    assert.ok(resPage.data.pageData);
    assert.ok(resPage.data.pageData.content.length > 0);
  });

  await t.test('6. Assignment Lifecycle: Submit, Resubmit, Grade, Locked State', async () => {
    // Teacher creates an assignment
    const resCreate = await requestJson(server, 'POST', '/api/school/assignments', {
      Authorization: `Bearer ${teacherToken}`
    }, {
      title: 'حل تمارين المعادلات الخطية',
      description: 'حل التمارين من 1 إلى 5 في الصفحة 42 من كتاب الرياضيات',
      stage: 'متوسط',
      grade: 'الثاني متوسط',
      subject: 'الرياضيات',
      maxScore: 100,
      dueAt: new Date(Date.now() + 3 * 86400000).toISOString()
    });
    assert.equal(resCreate.status, 201);
    const assignmentId = resCreate.data.assignment._id;

    // Student 1 lists assignments
    const resList = await requestJson(server, 'GET', `/api/school/assignments?stage=${encodeURIComponent('متوسط')}&grade=${encodeURIComponent('الثاني متوسط')}`, {
      Authorization: `Bearer ${student1Token}`
    });
    assert.equal(resList.status, 200);
    assert.ok(resList.data.assignments.some(a => a._id === assignmentId));

    // Student 1 submits answer
    const resSub1 = await requestJson(server, 'POST', `/api/school/assignments/${assignmentId}/submit`, {
      Authorization: `Bearer ${student1Token}`
    }, {
      content: 'الحل: x = 5, y = 10'
    });
    assert.equal(resSub1.status, 201);
    assert.equal(resSub1.data.ok, true);
    assert.equal(resSub1.data.submission.status, 'submitted');

    // Student 1 resubmits (allowed before grading)
    const resSub2 = await requestJson(server, 'POST', `/api/school/assignments/${assignmentId}/submit`, {
      Authorization: `Bearer ${student1Token}`
    }, {
      content: 'الحل المنقح: x = 5, y = 12 مع التحقق الكامل'
    });
    assert.ok([200, 201].includes(resSub2.status));
    assert.equal(resSub2.data.submission.resubmissionCount, 1);
    assert.equal(resSub2.data.submission.content, 'الحل المنقح: x = 5, y = 12 مع التحقق الكامل');

    // Teacher grades submission
    const resGrade = await requestJson(server, 'PATCH', `/api/school/assignments/${assignmentId}/grade`, {
      Authorization: `Bearer ${teacherToken}`
    }, {
      submissionId: resSub2.data.submission._id,
      score: 95,
      teacherFeedback: 'إجابة ممتازة وخطوات رياضية دقيقة'
    });
    assert.equal(resGrade.status, 200);
    assert.equal(resGrade.data.submission.status, 'graded');
    assert.equal(resGrade.data.submission.score, 95);

    // Student 1 attempts to resubmit after grading (Locked -> 400 Bad Request)
    const resSubLocked = await requestJson(server, 'POST', `/api/school/assignments/${assignmentId}/submit`, {
      Authorization: `Bearer ${student1Token}`
    }, {
      content: 'محاولة تعديل بعد التصحيح'
    });
    assert.equal(resSubLocked.status, 400);
    assert.ok(resSubLocked.data.message.includes('تم تصحيح هذا الواجب بالفعل ورصد الدرجة'));
  });

  await t.test('7. AI Virtual Teacher Official Profiles (/virtual/profiles)', async () => {
    const resProfiles = await requestJson(server, 'GET', '/api/school/virtual/profiles', {
      Authorization: `Bearer ${student1Token}`
    });
    assert.equal(resProfiles.status, 200);
    assert.equal(resProfiles.data.ok, true);
    assert.equal(resProfiles.data.profiles.length, 3);
    const profileNames = resProfiles.data.profiles.map(p => p.name);
    assert.ok(profileNames.includes('أ. سارة الذكية'));
    assert.ok(profileNames.includes('أ. ليلى الحكيمة'));
    assert.ok(profileNames.includes('أ. مريم النور'));
  });
});
