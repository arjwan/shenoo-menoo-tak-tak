'use strict';

/**
 * DESTRUCTIVE school reset.
 * Deletes Sumer School profiles/data only.
 * NEVER deletes platform User accounts.
 *
 * Safety:
 *   SCHOOL_RESET_CONFIRM=DELETE_SCHOOL_DATA_ONLY node src/scripts/reset-school-people.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const CONFIRM = 'DELETE_SCHOOL_DATA_ONLY';
const mongo = process.env.MONGODB_URI || process.env.MONGO_URI;

const MODEL_MODULES = [
  'GuardianComplaint','GuardianConsent','SchoolAnnouncement','SchoolAssignment',
  'SchoolAssignmentSubmission','SchoolAttendanceRecord','SchoolClassroom',
  'SchoolEnrollmentRequest','SchoolEventSchedule','SchoolGradeRecord','SchoolGuardian',
  'SchoolGuardianNotification','SchoolGuardianRequest','SchoolLearningRecord',
  'SchoolSchedule','SchoolSession','SchoolStaffRequest','SchoolStudent','SchoolStudentReport',
  'SchoolSyncOperation','SchoolTeacher','SchoolTeacherApplication',
  'SchoolTeacherStudentRequest','SchoolWhiteboard'
];

(async () => {
  if (process.env.SCHOOL_RESET_CONFIRM !== CONFIRM) {
    throw new Error('Refusing destructive reset: set SCHOOL_RESET_CONFIRM=' + CONFIRM);
  }
  if (!mongo) throw new Error('MONGODB_URI/MONGO_URI is required');
  await mongoose.connect(mongo);
  try {
    const developers = await User.find({ role: 'developer' }).select('_id username role').lean();
    if (!developers.length) throw new Error('Safety stop: no developer account found; nothing deleted');

    const platformUsersBefore = await User.countDocuments({});
    const result = { preservedDevelopers: developers.map(x => x.username), platformUsersPreserved: platformUsersBefore, deleted: {} };

    // Remove dependent school records first to avoid orphaned academic/person records.
    for (const name of MODEL_MODULES) {
      const Model = require('../models/' + name);
      const r = await Model.deleteMany({});
      result.deleted[name] = r.deletedCount || 0;
    }

    // Platform identity is outside the scope of a school reset. Never delete User records here.
    const platformUsersAfter = await User.countDocuments({});
    if (platformUsersAfter !== platformUsersBefore) {
      throw new Error('Safety invariant failed: platform User count changed during school reset');
    }
    result.deleted.User = 0;

    console.log(JSON.stringify({ ok:true, operation:'school-data-only-reset', ...result }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
})().catch(err => { console.error(err); process.exit(1); });
