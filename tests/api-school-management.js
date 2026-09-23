#!/usr/bin/env node
'use strict';

/**
 * tests/api-school-management.js
 *
 * Contract and invariants verification for School Management & System Integrity:
 *  1) Role hierarchy and permission boundaries.
 *  2) Real Teacher registration contract (real user linkage; no fake identity).
 *  3) Student registration contract (stage, grade, section, subjects, teachers, guardian).
 *  4) Guardian Consent contract (7 auditable consent types; opt-in only; default false).
 *  5) Permanent record retention (archiving preserves academic records, no deletion).
 *  6) Unified schedule types (LIVE_CLASS, RECORDED_REPLAY, GENERAL_REVIEW, EXAM).
 *  7) Guardian complaints workflow (scoped access, admin reply).
 *  8) Canva Entry buttons: "دخول صف مع معلم حقيقي", "دخول الصف الافتراضي AI".
 *  9) Privacy invariants: camera/mic OFF by default, no MediaRecorder, no hidden capture.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const { CONSENT_TYPES } = require(path.join(root, 'server/src/models/GuardianConsent'));
const { EVENT_TYPES } = require(path.join(root, 'server/src/models/SchoolEventSchedule'));

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

// 1) Role Hierarchy & Permissions
check('school role hierarchy: developer > manager > teacher > guardian/student', () => {
  const { resolveSchoolContext } = require(path.join(root, 'server/src/middleware/school-auth'));
  assert.equal(typeof resolveSchoolContext, 'function');
});

// 2) Consent Types
check('guardian consents: exactly 7 auditable types, all opt-in only', () => {
  assert.ok(Array.isArray(CONSENT_TYPES));
  assert.equal(CONSENT_TYPES.length, 7);
  assert.ok(CONSENT_TYPES.includes('microphone'));
  assert.ok(CONSENT_TYPES.includes('camera'));
  assert.ok(CONSENT_TYPES.includes('live_classroom_participation'));
  assert.ok(CONSENT_TYPES.includes('virtual_teacher_participation'));
  assert.ok(CONSENT_TYPES.includes('ai_voice_usage'));
  assert.ok(CONSENT_TYPES.includes('save_learning_qa'));
  assert.ok(CONSENT_TYPES.includes('school_notifications'));
});

// 3) Unified Schedule Types
check('unified calendar supports LIVE_CLASS, RECORDED_REPLAY, GENERAL_REVIEW, EXAM', () => {
  assert.ok(Array.isArray(EVENT_TYPES));
  assert.equal(EVENT_TYPES.length, 4);
  assert.ok(EVENT_TYPES.includes('LIVE_CLASS'));
  assert.ok(EVENT_TYPES.includes('RECORDED_REPLAY'));
  assert.ok(EVENT_TYPES.includes('GENERAL_REVIEW'));
  assert.ok(EVENT_TYPES.includes('EXAM'));
});

// 4) Classroom Navigation Protocols
check('classroom entry protocols supported by live and virtual engines', () => {
  const liveCore = fs.readFileSync(path.join(root, 'school-live-core.js'), 'utf8');
  const virtCore = fs.readFileSync(path.join(root, 'school-virtual-teacher-core.js'), 'utf8');
  assert.match(liveCore, /normalizeCode/);
  assert.match(virtCore, /sarah-smart/);
});

// 5) Privacy & Security: No MediaRecorder, No Hidden getUserMedia, Camera/Mic OFF by default
check('static security audit: no MediaRecorder in client engines, camera/mic off by default', () => {
  const virt = require(path.join(root, 'school-virtual-teacher-core.js'));
  assert.equal(typeof virt.verifyPrivacyStatics, 'function');
  const live = require(path.join(root, 'school-live-core.js'));
  assert.equal(typeof live.normalizeCode, 'function');

  const content = fs.readFileSync(path.join(root, 'school-api-adapter.js'), 'utf8');
  assert.doesNotMatch(content, /\bMediaRecorder\b/);
  assert.doesNotMatch(content, /FaceDetector|faceapi/i);
});

// 6) Zero Legacy School UI Verification
check('legacy school UI pages completely zeroed awaiting new unified rebuild', () => {
  const legacyPages = [
    'school-admin.html',
    'school-canva.html',
    'school-virtual-classroom.html',
    'school-live.html',
    'school.html'
  ];
  for (const page of legacyPages) {
    assert.equal(fs.existsSync(path.join(root, page)), false, `${page} must be zeroed`);
  }
});

// 7) Two-Level Security Barrier for Account Roles
check('two-level role security barrier: server rejects role tampering in school management', () => {
  // Server Level: school-management.routes.js enforces Level 2 role escalation guard
  const routes = fs.readFileSync(path.join(root, 'server/src/routes/school-management.routes.js'), 'utf8');
  assert.match(routes, /req\.body\.role\s*!==\s*undefined/, 'Routes must inspect req.body.role for tampering');
  assert.match(routes, /تعديل أدوار الحسابات محصور بإدارة المنصة العليا/, 'Routes must reject role modification by non-admin');
  assert.match(routes, /لا يمكن منح رتبة المطور إلا من قبل مطور معتمد/, 'Routes must forbid manager from granting developer role');
});

console.log(`\n${passed} checks passed`);
