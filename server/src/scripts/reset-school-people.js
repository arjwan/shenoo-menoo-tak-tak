'use strict';

/**
 * DESTRUCTIVE school reset.
 * Deletes Sumer School people/data and all non-developer User accounts.
 * Developer accounts are the only User records preserved.
 *
 * Safety:
 *   SCHOOL_RESET_CONFIRM=DELETE_ALL_EXCEPT_DEVELOPER node src/scripts/reset-school-people.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const CONFIRM = 'DELETE_ALL_EXCEPT_DEVELOPER';
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

    const result = { preservedDevelopers: developers.map(x => x.username), deleted: {} };

    // Remove dependent school records first to avoid orphaned academic/person records.
    for (const name of MODEL_MODULES) {
      const Model = require('../models/' + name);
      const r = await Model.deleteMany({});
      result.deleted[name] = r.deletedCount || 0;
    }

    // Preserve platform developer account(s) only, exactly as requested.
    const users = await User.deleteMany({ role: { $ne: 'developer' } });
    result.deleted.User = users.deletedCount || 0;

    console.log(JSON.stringify({ ok:true, operation:'school-full-reset', ...result }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
})().catch(err => { console.error(err); process.exit(1); });
