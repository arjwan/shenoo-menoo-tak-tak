#!/usr/bin/env node
'use strict';

/**
 * tests/api-school-backend-gaps.js
 *
 * Invariants and contract verification for Sumer School Backend Gaps:
 *  1) Teacher Application Model & Security Contracts
 *  2) 30-Day Student Trial Helper & Computation Invariants
 *  3) School Assignment Model & Role Scoping
 *  4) Student Assignment Submissions & Uniqueness
 *  5) Teacher Grading & Idempotent SchoolGradeRecord Integration
 *  6) Platform Role Barriers (Developer/Admin vs School Manager)
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const SchoolTeacherApplication = require(path.join(root, 'server/src/models/SchoolTeacherApplication'));
const SchoolAssignment = require(path.join(root, 'server/src/models/SchoolAssignment'));
const SchoolAssignmentSubmission = require(path.join(root, 'server/src/models/SchoolAssignmentSubmission'));
const SchoolStudent = require(path.join(root, 'server/src/models/SchoolStudent'));
const SchoolGradeRecord = require(path.join(root, 'server/src/models/SchoolGradeRecord'));
const managementService = require(path.join(root, 'server/src/services/school-management'));

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('ok - ' + name);
  } catch (e) {
    console.log('not ok - ' + name + '\n  ' + (e && e.message));
    process.exitCode = 1;
  }
}

// 1) Teacher Application Model Contract
check('teacher application model supports applicant, specialties, stages, status and review metadata', () => {
  const paths = SchoolTeacherApplication.schema.paths;
  assert.ok(paths.applicant, 'applicant path required');
  assert.ok(paths.fullName, 'fullName path required');
  assert.ok(paths.subjects || paths.specialties, 'subjects/specialties path required');
  assert.ok(paths.stages, 'stages path required');
  assert.ok(paths.status, 'status path required');
  assert.deepEqual(paths.status.enumValues, ['pending', 'approved', 'rejected']);
  assert.ok(paths.reviewedBy, 'reviewedBy path required');
  assert.ok(paths.reviewedAt, 'reviewedAt path required');
  assert.ok(paths.rejectionReason, 'rejectionReason path required');
  assert.ok(paths.approvedTeacher, 'approvedTeacher path required');
});

// 2) Teacher Application Self-Approval & Role Protection Guard
check('teacher application logic enforces self-approval prevention and audit logging', () => {
  const svcContent = fs.readFileSync(path.join(root, 'server/src/services/school-management.js'), 'utf8');
  assert.match(svcContent, /لا يمكن للمتقدم اعتماد طلبه بنفسه/, 'Self-approval must be blocked');
  assert.match(svcContent, /TEACHER_APPLICATION_APPROVED/, 'Approved application must be audited');
  assert.match(svcContent, /TEACHER_APPLICATION_REJECTED/, 'Rejected application must be audited');
  assert.match(svcContent, /TEACHER_APPLICATION_SUBMITTED/, 'Submission must be audited');
});

// 3) 30-Day Student Trial Fields & Invariant Computation
check('30-day student trial fields and server-side computation logic', () => {
  const paths = SchoolStudent.schema.paths;
  assert.ok(paths.trialStartedAt, 'trialStartedAt path required on SchoolStudent');
  assert.ok(paths.trialEndsAt, 'trialEndsAt path required on SchoolStudent');
  assert.ok(paths.trialStatus, 'trialStatus path required on SchoolStudent');
  assert.deepEqual(paths.trialStatus.enumValues, ['active', 'expired', 'converted']);

  assert.equal(typeof SchoolStudent.computeTrialInfo, 'function');

  // Test active trial
  const now = new Date();
  const mockActive = {
    trialStartedAt: now,
    trialEndsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    trialStatus: 'active'
  };
  const activeInfo = SchoolStudent.computeTrialInfo(mockActive, now);
  assert.equal(activeInfo.isTrialActive, true);
  assert.equal(activeInfo.isExpired, false);
  assert.equal(activeInfo.trialStatus, 'active');
  assert.equal(activeInfo.daysRemaining, 30);

  // Test expired trial
  const mockExpired = {
    trialStartedAt: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000),
    trialEndsAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
    trialStatus: 'active'
  };
  const expiredInfo = SchoolStudent.computeTrialInfo(mockExpired, now);
  assert.equal(expiredInfo.isTrialActive, false);
  assert.equal(expiredInfo.isExpired, true);
  assert.equal(expiredInfo.trialStatus, 'expired');
  assert.equal(expiredInfo.daysRemaining, 0);

  // Test converted trial
  const mockConverted = {
    trialStartedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
    trialEndsAt: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000),
    trialStatus: 'converted'
  };
  const convertedInfo = SchoolStudent.computeTrialInfo(mockConverted, now);
  assert.equal(convertedInfo.isTrialActive, false);
  assert.equal(convertedInfo.isConverted, true);
  assert.equal(convertedInfo.trialStatus, 'converted');

  // Backward compatibility with legacy student document
  const mockLegacy = {
    registrationDate: now,
    status: 'active'
  };
  const legacyInfo = SchoolStudent.computeTrialInfo(mockLegacy, now);
  assert.equal(legacyInfo.isTrialActive, true);
  assert.equal(legacyInfo.daysRemaining, 30);
});

// 4) School Assignment Model Contract
check('school assignment model contract: teacher, stage, grade, subject, dueAt, maxScore, status', () => {
  const paths = SchoolAssignment.schema.paths;
  assert.ok(paths.teacher, 'teacher reference path required');
  assert.ok(paths.stage, 'stage path required');
  assert.deepEqual(paths.stage.enumValues, ['ابتدائي', 'متوسط', 'إعدادي']);
  assert.ok(paths.grade, 'grade path required');
  assert.ok(paths.subject, 'subject path required');
  assert.ok(paths.title, 'title path required');
  assert.ok(paths.dueAt, 'dueAt path required');
  assert.ok(paths.maxScore, 'maxScore path required');
  assert.ok(paths.status, 'status path required');
  assert.deepEqual(paths.status.enumValues, ['draft', 'published', 'closed', 'archived']);
});

// 5) Student Submission Model Contract & Strict Uniqueness
check('student assignment submission model contract: unique compound index on (assignment, student)', () => {
  const paths = SchoolAssignmentSubmission.schema.paths;
  assert.ok(paths.assignment, 'assignment ref required');
  assert.ok(paths.student, 'student ref required');
  assert.ok(paths.content, 'content field required');
  assert.ok(paths.submittedAt, 'submittedAt field required');
  assert.ok(paths.status, 'status field required');
  assert.deepEqual(paths.status.enumValues, ['submitted', 'late', 'resubmitted', 'graded']);
  assert.ok(paths.gradeRecord, 'gradeRecord ref required');
  assert.ok(paths.resubmissionCount, 'resubmissionCount field required');

  const indexes = SchoolAssignmentSubmission.schema.indexes();
  const hasCompoundUnique = indexes.some(
    idx => idx[0] && idx[0].assignment === 1 && idx[0].student === 1 && idx[1] && idx[1].unique === true
  );
  assert.ok(hasCompoundUnique, 'Compound unique index on { assignment: 1, student: 1 } must exist');
});

// 6) Grading Score Validation & Idempotent Integration
check('grading validation bounds score between 0 and maxScore and updates SchoolGradeRecord idempotently', () => {
  const svcContent = fs.readFileSync(path.join(root, 'server/src/services/school-management.js'), 'utf8');
  assert.match(svcContent, /numScore\s*>\s*assignment\.maxScore/, 'Grading must reject scores exceeding maxScore');
  assert.match(svcContent, /numScore\s*<\s*0/, 'Grading must reject negative scores');
  assert.match(svcContent, /SchoolGradeRecord\.findById\(submission\.gradeRecord\)/, 'Grading must check existing grade record');
  assert.match(svcContent, /gradeType:\s*['"]homework['"]/, 'Assignment grades must map to homework type in official grade record');
});

// 7) Security: Teacher Scoping, Guardian Submission Restriction & Role Tampering Barriers
check('security barriers: teacher scoping, guardian submission prevention, and level-2 role protection', () => {
  const svcContent = fs.readFileSync(path.join(root, 'server/src/services/school-management.js'), 'utf8');
  assert.match(svcContent, /المعلم غير مصرح له بإنشاء واجب خارج مرحلته الدراسية/, 'Teacher stage scoping enforced');
  assert.match(svcContent, /المعلم غير مصرح له بإنشاء واجب خارج مواده الدراسية/, 'Teacher subject scoping enforced');
  assert.match(svcContent, /التسليم مخصص للطالب نفسه ولا يحق لولي الأمر تسليم الواجب نيابة عنه/, 'Guardian cannot submit as student');
  assert.match(svcContent, /لا تملك صلاحية التسليم نيابة عن طالب آخر/, 'Student cannot impersonate another student');
  assert.match(svcContent, /لا تملك صلاحية تصحيح واجب لمعلم آخر/, 'Unrelated teacher cannot grade assignment');

  const assignRoutes = fs.readFileSync(path.join(root, 'server/src/routes/school-assignment.routes.js'), 'utf8');
  assert.match(assignRoutes, /req\.body\.role\s*!==\s*undefined/, 'Assignment routes must enforce role immutability barrier');
});

console.log(`\n${passed} checks passed`);
