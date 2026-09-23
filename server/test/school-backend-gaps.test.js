'use strict';

/**
 * server/test/school-backend-gaps.test.js
 *
 * Comprehensive integration test suite for:
 *  A) Teacher Application Lifecycle & Security Barriers
 *  B) 30-Day Student Trial Logic & Server Enforcement
 *  C) School Assignments Creation, Scoping & Role Permissions
 *  D) Student Submissions, Resubmission Policy & Deadlines
 *  E) Teacher Review, Grading & Idempotent SchoolGradeRecord Sync
 *  F) Administrative Audit Log Verification
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server-core');

process.env.JWT_SECRET = 'test-secret-school-gaps';

const User = require('../src/models/User');
const AuditLog = require('../src/models/AuditLog');
const SchoolStudent = require('../src/models/SchoolStudent');
const SchoolTeacher = require('../src/models/SchoolTeacher');
const SchoolGuardian = require('../src/models/SchoolGuardian');
const SchoolGradeRecord = require('../src/models/SchoolGradeRecord');
const SchoolTeacherApplication = require('../src/models/SchoolTeacherApplication');
const SchoolAssignment = require('../src/models/SchoolAssignment');
const SchoolAssignmentSubmission = require('../src/models/SchoolAssignmentSubmission');

const managementRoutes = require('../src/routes/school-management.routes');
const assignmentRoutes = require('../src/routes/school-assignment.routes');
const schoolRoutes = require('../src/routes/school.routes');

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
  await mongoose.connect(mongod.getUri(), { dbName: 'test-school-backend-gaps' });

  const app = express();
  app.use(express.json());
  app.use('/api/school/management', managementRoutes);
  app.use('/api/school/assignments', assignmentRoutes);
  app.use('/api/school/management/assignments', assignmentRoutes);
  app.use('/api/school/teachers/apply', require('../src/routes/school-teacher-apply.routes'));
  app.use('/api/school', schoolRoutes);

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

test('School Backend Gaps: Applications, 30-Day Trial, Assignments, Submissions & Grading', async (t) => {
  let devUser, managerUser, teacherUser1, teacherUser2, guardianUser1, guardianUser2;
  let studentUser1, studentUser2, applicantUser, otherApplicantUser;
  let pupil1, pupil2, teacherDoc1, teacherDoc2;
  let assignment1, assignmentLate, assignmentClosed;
  let submission1Id;

  await t.test('1. Setup initial accounts, teachers and students', async () => {
    devUser = await makeUser('مهندس المنصة', 'dev_gap', 'dev_gap@example.iq', 'developer');
    managerUser = await makeUser('مدير المدرسة', 'manager_gap', 'manager_gap@example.iq', 'admin');
    teacherUser1 = await makeUser('أحمد المعلم', 'teacher1_gap', 'teacher1_gap@example.iq', 'user');
    teacherUser2 = await makeUser('خالد المعلم', 'teacher2_gap', 'teacher2_gap@example.iq', 'user');
    guardianUser1 = await makeUser('أبو علي', 'guardian1_gap', 'guardian1_gap@example.iq', 'user');
    guardianUser2 = await makeUser('أم محمد', 'guardian2_gap', 'guardian2_gap@example.iq', 'user');
    studentUser1 = await makeUser('علي الطالب', 'student1_gap', 'student1_gap@example.iq', 'user');
    studentUser2 = await makeUser('سارة الطالبة', 'student2_gap', 'student2_gap@example.iq', 'user');
    applicantUser = await makeUser('حسين المتقدم', 'applicant_gap', 'applicant_gap@example.iq', 'user');
    otherApplicantUser = await makeUser('زينب المتقدمة', 'applicant2_gap', 'applicant2_gap@example.iq', 'user');

    // Register Teacher 1 (Math, الابتدائي)
    teacherDoc1 = await SchoolTeacher.create({
      user: teacherUser1._id,
      name: teacherUser1.fullName,
      gender: 'ذكر',
      subjects: ['الرياضيات'],
      stages: ['ابتدائي'],
      grades: ['الرابع ابتدائي'],
      sections: ['أ', 'ب'],
      status: 'active',
      registeredBy: managerUser._id
    });

    // Register Teacher 2 (Science, المتوسط)
    teacherDoc2 = await SchoolTeacher.create({
      user: teacherUser2._id,
      name: teacherUser2.fullName,
      gender: 'ذكر',
      subjects: ['العلوم'],
      stages: ['متوسط'],
      grades: ['الأول متوسط'],
      sections: ['أ'],
      status: 'active',
      registeredBy: managerUser._id
    });

    // Register Pupil 1 with 30-Day trial
    const now = new Date();
    pupil1 = await SchoolStudent.create({
      guardian: guardianUser1._id,
      studentUser: studentUser1._id,
      name: 'علي أبو علي',
      stage: 'ابتدائي',
      grade: 'الرابع ابتدائي',
      section: 'أ',
      subjects: ['الرياضيات', 'العلوم'],
      assignedTeachers: [{ teacher: teacherDoc1._id, subject: 'الرياضيات' }],
      trialStartedAt: now,
      trialEndsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      trialStatus: 'active',
      status: 'active'
    });

    // Register Pupil 2 with 30-Day trial
    pupil2 = await SchoolStudent.create({
      guardian: guardianUser1._id,
      studentUser: studentUser2._id,
      name: 'سارة أبو علي',
      stage: 'ابتدائي',
      grade: 'الرابع ابتدائي',
      section: 'أ',
      subjects: ['الرياضيات'],
      assignedTeachers: [{ teacher: teacherDoc1._id, subject: 'الرياضيات' }],
      trialStartedAt: now,
      trialEndsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      trialStatus: 'active',
      status: 'active'
    });

    await SchoolGuardian.create({
      user: guardianUser1._id,
      name: guardianUser1.fullName,
      students: [pupil1._id, pupil2._id]
    });

    assert.ok(pupil1._id);
    assert.ok(teacherDoc1._id);
  });

  await t.test('2. Teacher Application: Submit, Duplicate prevention, List, View & Security', async () => {
    // A) Non-teacher user submits application
    const appPayload = {
      fullName: 'حسين علي التدريسي',
      phone: '07701112233',
      email: 'applicant_gap@example.iq',
      subjects: ['اللغة الإنكليزية'],
      stages: ['ابتدائي', 'متوسط'],
      grades: ['الخامس ابتدائي', 'الأول متوسط'],
      qualifications: 'بكالوريوس آداب لغة إنكليزية',
      experienceYears: 5
    };

    const resSubmit = await request('POST', '/api/school/teachers/apply', appPayload, userToken(applicantUser));
    assert.equal(resSubmit.status, 201);
    assert.equal(resSubmit.data.ok, true);
    assert.equal(resSubmit.data.application.status, 'pending');
    assert.equal(resSubmit.data.application.fullName, appPayload.fullName);
    const appId = resSubmit.data.application._id;

    // B) Duplicate pending submission rejected with 409
    const resDup = await request('POST', '/api/school/teachers/apply', appPayload, userToken(applicantUser));
    assert.equal(resDup.status, 409);

    // C) Active teacher attempting to apply rejected with 409
    const resTeacherApply = await request('POST', '/api/school/teachers/apply', { fullName: 'أحمد', subjects: ['الرياضيات'] }, userToken(teacherUser1));
    assert.equal(resTeacherApply.status, 409);

    // D) Non-staff cannot list applications
    const resListForbidden = await request('GET', '/api/school/management/teacher-applications', null, userToken(guardianUser1));
    assert.equal(resListForbidden.status, 403);

    // E) Manager can list applications
    const resListManager = await request('GET', '/api/school/management/teacher-applications', null, userToken(managerUser));
    assert.equal(resListManager.status, 200);
    assert.ok(resListManager.data.applications.length >= 1);

    // F) Applicant can view own application details
    const resViewSelf = await request('GET', `/api/school/management/teacher-applications/${appId}`, null, userToken(applicantUser));
    assert.equal(resViewSelf.status, 200);
    assert.equal(resViewSelf.data.application._id, appId);

    // G) Unrelated user cannot view another's application
    const resViewOther = await request('GET', `/api/school/management/teacher-applications/${appId}`, null, userToken(guardianUser1));
    assert.equal(resViewOther.status, 403);

    // H) Self-approval prevention: Applicant CANNOT self-approve even if trying
    const resSelfApprove = await request('POST', `/api/school/management/teacher-applications/${appId}/approve`, {}, userToken(applicantUser));
    assert.equal(resSelfApprove.status, 403);

    // I) Manager approves application
    const resApprove = await request('POST', `/api/school/management/teacher-applications/${appId}/approve`, { notes: 'مستوفٍ للشروط' }, userToken(managerUser));
    assert.equal(resApprove.status, 200);
    assert.equal(resApprove.data.ok, true);
    assert.equal(resApprove.data.application.status, 'approved');
    assert.ok(resApprove.data.teacher);
    assert.equal(resApprove.data.teacher.name, appPayload.fullName);

    // Verify applicant User platform role was NOT elevated
    const refreshedApplicant = await User.findById(applicantUser._id);
    assert.equal(refreshedApplicant.role, 'user');

    // J) Idempotent approval: approving again succeeds safely
    const resApproveAgain = await request('POST', `/api/school/management/teacher-applications/${appId}/approve`, {}, userToken(managerUser));
    assert.equal(resApproveAgain.status, 200);
    assert.equal(resApproveAgain.data.alreadyApproved, true);

    // K) Rejection flow on second applicant
    const resSub2 = await request('POST', '/api/school/management/teachers/apply', {
      fullName: 'زينب التدريسية',
      subjects: ['التربية الفنية'],
      stages: ['ابتدائي']
    }, userToken(otherApplicantUser));
    assert.equal(resSub2.status, 201);
    const app2Id = resSub2.data.application._id;

    const resReject = await request('POST', `/api/school/management/teacher-applications/${app2Id}/reject`, { reason: 'عدم توفر شاغر' }, userToken(managerUser));
    assert.equal(resReject.status, 200);
    assert.equal(resReject.data.application.status, 'rejected');
    assert.equal(resReject.data.application.rejectionReason, 'عدم توفر شاغر');
  });

  await t.test('3. 30-Day Student Trial: Calculation, Expiration & Conversion', async () => {
    // A) Active trial calculation for pupil1
    const resTrial = await request('GET', `/api/school/management/students/${pupil1._id}/trial`, null, userToken(studentUser1));
    assert.equal(resTrial.status, 200);
    assert.equal(resTrial.data.ok, true);
    assert.equal(resTrial.data.trialInfo.isTrialActive, true);
    assert.equal(resTrial.data.trialInfo.trialStatus, 'active');
    assert.ok(resTrial.data.trialInfo.daysRemaining >= 29);

    // B) Server-side expired trial test
    const expiredStartedAt = new Date(Date.now() - 32 * 24 * 60 * 60 * 1000);
    const expiredEndsAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const expiredPupil = await SchoolStudent.create({
      guardian: guardianUser2._id,
      name: 'طالب منتهي التجربة',
      stage: 'متوسط',
      grade: 'الأول متوسط',
      trialStartedAt: expiredStartedAt,
      trialEndsAt: expiredEndsAt,
      trialStatus: 'active',
      status: 'active'
    });

    const trialInfoExpired = expiredPupil.getTrialInfo();
    assert.equal(trialInfoExpired.isTrialActive, false);
    assert.equal(trialInfoExpired.isExpired, true);
    assert.equal(trialInfoExpired.daysRemaining, 0);

    // C) Backward compatibility: Student without explicit trial fields computes trial from registrationDate
    const legacyStudent = await SchoolStudent.create({
      guardian: guardianUser2._id,
      name: 'طالب قديم',
      stage: 'ابتدائي',
      grade: 'الثالث ابتدائي',
      registrationDate: new Date(),
      status: 'active'
    });
    const legacyTrial = legacyStudent.getTrialInfo();
    assert.equal(legacyTrial.isTrialActive, true);
    assert.ok(legacyTrial.daysRemaining >= 29);

    // D) Manager converts trial to full enrollment
    const resConvert = await request('POST', `/api/school/management/students/${pupil1._id}/convert-trial`, {}, userToken(managerUser));
    assert.equal(resConvert.status, 200);
    assert.equal(resConvert.data.student.trialStatus, 'converted');
    assert.equal(resConvert.data.trialInfo.isConverted, true);
    assert.equal(resConvert.data.trialInfo.isTrialActive, false);

    // Non-manager cannot convert trial
    const resConvertForbidden = await request('POST', `/api/school/management/students/${pupil2._id}/convert-trial`, {}, userToken(studentUser1));
    assert.equal(resConvertForbidden.status, 403);
  });

  await t.test('4. Assignments: Creation, Scoping, Student List & Permissions', async () => {
    // A) Student CANNOT create assignment
    const resStudentCreate = await request('POST', '/api/school/assignments', {
      title: 'واجب ممنوع',
      stage: 'ابتدائي',
      grade: 'الرابع ابتدائي',
      subject: 'الرياضيات',
      dueAt: new Date(Date.now() + 86400000)
    }, userToken(studentUser1));
    assert.equal(resStudentCreate.status, 403);

    // B) Guardian CANNOT create assignment
    const resGuardianCreate = await request('POST', '/api/school/assignments', {
      title: 'واجب ممنوع',
      stage: 'ابتدائي',
      grade: 'الرابع ابتدائي',
      subject: 'الرياضيات',
      dueAt: new Date(Date.now() + 86400000)
    }, userToken(guardianUser1));
    assert.equal(resGuardianCreate.status, 403);

    // C) Teacher 1 (Math, الابتدائي) creates valid assignment
    const dueTomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const resCreate = await request('POST', '/api/school/assignments', {
      title: 'حل تمارين الكسور العشرية',
      description: 'حل تمارين صفحة 45 من كتاب الرياضيات',
      stage: 'ابتدائي',
      grade: 'الرابع ابتدائي',
      section: 'أ',
      subject: 'الرياضيات',
      dueAt: dueTomorrow,
      maxScore: 100,
      allowLateSubmission: true
    }, userToken(teacherUser1));

    assert.equal(resCreate.status, 201);
    assert.equal(resCreate.data.ok, true);
    assert.equal(resCreate.data.assignment.title, 'حل تمارين الكسور العشرية');
    assignment1 = resCreate.data.assignment;

    // D) Teacher 1 attempts out-of-scope creation: Stage 'إعدادي'
    const resOutOfStage = await request('POST', '/api/school/assignments', {
      title: 'واجب خارج المرحلة',
      stage: 'إعدادي',
      grade: 'الرابع إعدادي',
      subject: 'الرياضيات',
      dueAt: dueTomorrow
    }, userToken(teacherUser1));
    assert.equal(resOutOfStage.status, 403);

    // E) Teacher 1 attempts out-of-scope creation: Subject 'الفيزياء'
    const resOutOfSubject = await request('POST', '/api/school/assignments', {
      title: 'واجب خارج المادة',
      stage: 'ابتدائي',
      grade: 'الرابع ابتدائي',
      subject: 'الفيزياء',
      dueAt: dueTomorrow
    }, userToken(teacherUser1));
    assert.equal(resOutOfSubject.status, 403);

    // F) Student lists assigned assignments
    const resStudentList = await request('GET', '/api/school/assignments', null, userToken(studentUser1));
    assert.equal(resStudentList.status, 200);
    assert.ok(resStudentList.data.assignments.length >= 1);
    const myAssigned = resStudentList.data.assignments.find((a) => String(a._id) === String(assignment1._id));
    assert.ok(myAssigned);
    assert.equal(myAssigned.mySubmission, null);

    // G) Teacher updates assignment
    const resUpdate = await request('PUT', `/api/school/assignments/${assignment1._id}`, {
      description: 'حل تمارين صفحة 45 وصفحة 46'
    }, userToken(teacherUser1));
    assert.equal(resUpdate.status, 200);
    assert.equal(resUpdate.data.assignment.description, 'حل تمارين صفحة 45 وصفحة 46');

    // H) Student CANNOT update assignment
    const resStudentUpdate = await request('PUT', `/api/school/assignments/${assignment1._id}`, {
      description: 'محاولة تعديل من طالب'
    }, userToken(studentUser1));
    assert.equal(resStudentUpdate.status, 403);
  });

  await t.test('5. Student Submissions, Resubmission Policy & Deadlines', async () => {
    // A) Guardian CANNOT submit as student
    const resGuardSub = await request('POST', `/api/school/assignments/${assignment1._id}/submit`, {
      content: 'تسليم من ولي الأمر'
    }, userToken(guardianUser1));
    assert.equal(resGuardSub.status, 403);

    // B) Student 1 CANNOT submit as Student 2
    const resImpersonate = await request('POST', `/api/school/assignments/${assignment1._id}/submit`, {
      studentId: pupil2._id,
      content: 'محاولة انتحال هوية طالب آخر'
    }, userToken(studentUser1));
    assert.equal(resImpersonate.status, 403);

    // C) Student 1 submits valid answer
    const resSub1 = await request('POST', `/api/school/assignments/${assignment1._id}/submit`, {
      content: 'إجابة السؤال الأول: 0.75، إجابة السؤال الثاني: 1.25',
      attachments: [{ name: 'solution.pdf', url: '/uploads/solution.pdf', fileType: 'pdf', size: 1024 }]
    }, userToken(studentUser1));

    assert.equal(resSub1.status, 201);
    assert.equal(resSub1.data.ok, true);
    assert.equal(resSub1.data.submission.status, 'submitted');
    submission1Id = resSub1.data.submission._id;

    // D) Resubmission before grading: updates submission and increments count
    const resResub = await request('POST', `/api/school/assignments/${assignment1._id}/submit`, {
      content: 'تصحيح إجابة السؤال الثاني: 1.50',
      attachments: [{ name: 'solution-v2.pdf', url: '/uploads/solution-v2.pdf', fileType: 'pdf', size: 1048 }]
    }, userToken(studentUser1));

    assert.equal(resResub.status, 201);
    assert.equal(resResub.data.submission.status, 'resubmitted');
    assert.equal(resResub.data.submission.resubmissionCount, 1);
    assert.equal(resResub.data.submission.content, 'تصحيح إجابة السؤال الثاني: 1.50');

    // E) Student 2 submits own answer
    const resSub2 = await request('POST', `/api/school/assignments/${assignment1._id}/submit`, {
      content: 'حل سارة للكسور'
    }, userToken(studentUser2));
    assert.equal(resSub2.status, 201);

    // F) Student 1 cannot view Student 2 submission
    const sub2Id = resSub2.data.submission._id;
    const resStudentPeek = await request('GET', `/api/school/assignments/${assignment1._id}/submissions/${sub2Id}`, null, userToken(studentUser1));
    assert.equal(resStudentPeek.status, 403);

    // G) Unrelated teacher (Teacher 2) cannot list submissions for Teacher 1 assignment
    const resUnrelatedList = await request('GET', `/api/school/assignments/${assignment1._id}/submissions`, null, userToken(teacherUser2));
    assert.equal(resUnrelatedList.status, 403);

    // H) Teacher 1 can list submissions
    const resTeacherList = await request('GET', `/api/school/assignments/${assignment1._id}/submissions`, null, userToken(teacherUser1));
    assert.equal(resTeacherList.status, 200);
    assert.equal(resTeacherList.data.submissions.length, 2);

    // I) Deadline enforcement: Strict deadline (allowLateSubmission: false)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const resStrictAssn = await request('POST', '/api/school/assignments', {
      title: 'واجب صارم الموعد',
      stage: 'ابتدائي',
      grade: 'الرابع ابتدائي',
      subject: 'الرياضيات',
      dueAt: yesterday,
      allowLateSubmission: false
    }, userToken(teacherUser1));
    assert.equal(resStrictAssn.status, 201);
    assignmentLate = resStrictAssn.data.assignment;

    const resLateReject = await request('POST', `/api/school/assignments/${assignmentLate._id}/submit`, {
      content: 'تسليم بعد انتهاء الوقت'
    }, userToken(studentUser1));
    assert.equal(resLateReject.status, 400);

    // J) Deadline enforcement: Late allowed (allowLateSubmission: true) -> status becomes 'late'
    const resLateAssn = await request('POST', '/api/school/assignments', {
      title: 'واجب يقبل التسليم المتأخر',
      stage: 'ابتدائي',
      grade: 'الرابع ابتدائي',
      subject: 'الرياضيات',
      dueAt: yesterday,
      allowLateSubmission: true
    }, userToken(teacherUser1));
    assert.equal(resLateAssn.status, 201);

    const resLateAccept = await request('POST', `/api/school/assignments/${resLateAssn.data.assignment._id}/submit`, {
      content: 'تسليم متأخر مقبول'
    }, userToken(studentUser1));
    assert.equal(resLateAccept.status, 201);
    assert.equal(resLateAccept.data.submission.status, 'late');

    // K) Closed / Archived assignment rejects submissions
    const resArchivedAssn = await request('POST', '/api/school/assignments', {
      title: 'واجب سيتم أرشفته',
      stage: 'ابتدائي',
      grade: 'الرابع ابتدائي',
      subject: 'الرياضيات',
      dueAt: new Date(Date.now() + 86400000)
    }, userToken(teacherUser1));
    assignmentClosed = resArchivedAssn.data.assignment;

    // Archive it
    const resArchive = await request('POST', `/api/school/assignments/${assignmentClosed._id}/archive`, {}, userToken(teacherUser1));
    assert.equal(resArchive.status, 200);
    assert.equal(resArchive.data.assignment.status, 'archived');

    // Attempt submit on archived assignment
    const resSubArchived = await request('POST', `/api/school/assignments/${assignmentClosed._id}/submit`, {
      content: 'تسليم على واجب مؤرشف'
    }, userToken(studentUser1));
    assert.equal(resSubArchived.status, 400);
  });

  await t.test('6. Teacher Review, Grading & Idempotent SchoolGradeRecord Sync', async () => {
    // A) Unrelated teacher (Teacher 2) CANNOT grade Teacher 1 assignment
    const resUnrelatedGrade = await request('PATCH', `/api/school/assignments/${assignment1._id}/grade`, {
      submissionId: submission1Id,
      score: 90
    }, userToken(teacherUser2));
    assert.equal(resUnrelatedGrade.status, 403);

    // B) Grade cannot exceed maxScore (105 > 100)
    const resExceed = await request('PATCH', `/api/school/assignments/${assignment1._id}/grade`, {
      submissionId: submission1Id,
      score: 105
    }, userToken(teacherUser1));
    assert.equal(resExceed.status, 400);

    // C) Grade cannot be negative (-5 < 0)
    const resNegative = await request('PATCH', `/api/school/assignments/${assignment1._id}/grade`, {
      submissionId: submission1Id,
      score: -5
    }, userToken(teacherUser1));
    assert.equal(resNegative.status, 400);

    // D) Teacher 1 grades Student 1 submission
    const resGrade = await request('PATCH', `/api/school/assignments/${assignment1._id}/grade`, {
      submissionId: submission1Id,
      score: 95,
      feedback: 'إجابة نموذجية وممتازة'
    }, userToken(teacherUser1));

    assert.equal(resGrade.status, 200);
    assert.equal(resGrade.data.ok, true);
    assert.equal(resGrade.data.submission.status, 'graded');
    assert.equal(resGrade.data.submission.score, 95);
    assert.equal(resGrade.data.submission.teacherFeedback, 'إجابة نموذجية وممتازة');
    assert.ok(resGrade.data.gradeRecord);
    assert.equal(resGrade.data.gradeRecord.gradeType, 'homework');
    assert.equal(resGrade.data.gradeRecord.score, 95);

    // Verify SchoolGradeRecord in database
    const gradeRecordsBefore = await SchoolGradeRecord.find({ student: pupil1._id });
    assert.equal(gradeRecordsBefore.length, 1);
    assert.equal(gradeRecordsBefore[0].score, 95);

    // Verify student progress update
    const pupilAfterGrade = await SchoolStudent.findById(pupil1._id);
    assert.equal(pupilAfterGrade.scores.length, 1);
    assert.equal(pupilAfterGrade.scores[0].score, 95);
    assert.equal(pupilAfterGrade.progress.average, 95);

    // E) Student CANNOT resubmit after being graded
    const resResubGraded = await request('POST', `/api/school/assignments/${assignment1._id}/submit`, {
      content: 'محاولة إعادة تسليم بعد التصحيح'
    }, userToken(studentUser1));
    assert.equal(resResubGraded.status, 400);

    // F) Idempotent Re-grading: Teacher updates grade to 98
    const resRegrade = await request('PATCH', `/api/school/assignments/${assignment1._id}/grade`, {
      submissionId: submission1Id,
      score: 98,
      feedback: 'تعديل الدرجة بعد مراجعة الملاحظة'
    }, userToken(teacherUser1));

    assert.equal(resRegrade.status, 200);
    assert.equal(resRegrade.data.submission.score, 98);

    // Check database records count: NO duplicate SchoolGradeRecord!
    const gradeRecordsAfter = await SchoolGradeRecord.find({ student: pupil1._id });
    assert.equal(gradeRecordsAfter.length, 1, 'SchoolGradeRecord must remain exactly 1 (no duplicates!)');
    assert.equal(gradeRecordsAfter[0].score, 98);

    // Check student scores count: NO duplicate entry!
    const pupilAfterRegrade = await SchoolStudent.findById(pupil1._id);
    assert.equal(pupilAfterRegrade.scores.length, 1, 'Student scores array must remain length 1');
    assert.equal(pupilAfterRegrade.scores[0].score, 98);
    assert.equal(pupilAfterRegrade.progress.average, 98);

    // G) Student permanent record reflects the graded submission and grade record
    const resRecord = await request('GET', `/api/school/management/students/${pupil1._id}/record`, null, userToken(guardianUser1));
    assert.equal(resRecord.status, 200);
    assert.equal(resRecord.data.record.gradeRecords.length, 1);
    assert.equal(resRecord.data.record.submissions.length, 2);
    const gradedSub = resRecord.data.record.submissions.find(s => String(s.assignment?._id || s.assignment) === String(assignment1._id));
    assert.ok(gradedSub);
    assert.equal(gradedSub.status, 'graded');
  });

  await t.test('7. Audit Trail: All Actions Timestamped with Actors', async () => {
    const resAudit = await request('GET', '/api/school/management/audit-logs', null, userToken(managerUser));
    assert.equal(resAudit.status, 200);
    const logs = resAudit.data.logs;
    assert.ok(Array.isArray(logs));
    const actions = logs.map((l) => l.action);

    assert.ok(actions.includes('TEACHER_APPLICATION_SUBMITTED'), 'AuditLog must record TEACHER_APPLICATION_SUBMITTED');
    assert.ok(actions.includes('TEACHER_APPLICATION_APPROVED'), 'AuditLog must record TEACHER_APPLICATION_APPROVED');
    assert.ok(actions.includes('STUDENT_TRIAL_CONVERTED'), 'AuditLog must record STUDENT_TRIAL_CONVERTED');
    assert.ok(actions.includes('ASSIGNMENT_CREATED'), 'AuditLog must record ASSIGNMENT_CREATED');
    assert.ok(actions.includes('ASSIGNMENT_SUBMITTED'), 'AuditLog must record ASSIGNMENT_SUBMITTED');
    assert.ok(actions.includes('ASSIGNMENT_GRADED'), 'AuditLog must record ASSIGNMENT_GRADED');
  });
});
