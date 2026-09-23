'use strict';

const mongoose = require('mongoose');

const TRIAL_DURATION_DAYS = 30;

function computeTrialInfo(student, now = new Date()) {
  if (!student) return null;
  const currentTime = now instanceof Date ? now.getTime() : new Date(now).getTime();

  const startedAt = student.trialStartedAt
    ? new Date(student.trialStartedAt)
    : (student.registrationDate
        ? new Date(student.registrationDate)
        : (student.createdAt ? new Date(student.createdAt) : new Date(currentTime)));

  const endsAt = student.trialEndsAt
    ? new Date(student.trialEndsAt)
    : new Date(startedAt.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);

  if (student.trialStatus === 'converted') {
    return {
      status: 'converted',
      trialStatus: 'converted',
      isTrialActive: false,
      isConverted: true,
      isExpired: false,
      trialStartedAt: startedAt,
      trialEndsAt: endsAt,
      daysRemaining: 0,
      hoursRemaining: 0
    };
  }

  const msRemaining = endsAt.getTime() - currentTime;
  const isTrialActive = msRemaining > 0 && student.trialStatus !== 'expired';
  const daysRemaining = isTrialActive ? Math.ceil(msRemaining / (1000 * 60 * 60 * 24)) : 0;
  const hoursRemaining = isTrialActive ? Math.ceil(msRemaining / (1000 * 60 * 60)) : 0;
  const computedStatus = isTrialActive ? 'active' : 'expired';

  return {
    status: student.trialStatus === 'expired' ? 'expired' : computedStatus,
    trialStatus: student.trialStatus === 'expired' ? 'expired' : computedStatus,
    isTrialActive,
    isConverted: false,
    isExpired: !isTrialActive,
    trialStartedAt: startedAt,
    trialEndsAt: endsAt,
    daysRemaining,
    hoursRemaining
  };
}

const schema = new mongoose.Schema({
  guardian: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  stage: { type: String, enum: ['ابتدائي', 'متوسط', 'إعدادي'], required: true },
  grade: { type: String, required: true, trim: true },
  section: { type: String, trim: true, default: 'أ' },
  studentUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  subjects: [{ type: String, trim: true }],
  assignedTeachers: [{
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolTeacher' },
    subject: { type: String, trim: true }
  }],
  assignedVirtualTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'VirtualTeacherProfile', default: null },
  status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },
  registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  registrationDate: { type: Date, default: Date.now },
  parentApproved: { type: Boolean, default: true },
  active: { type: Boolean, default: true },
  learningPermissions: { voice: { type: Boolean, default: false }, camera: { type: Boolean, default: false }, updatedAt: { type: Date, default: null } },
  progress: { average: { type: Number, default: 0 }, sessions: { type: Number, default: 0 }, answered: { type: Number, default: 0 } },
  notes: [{ text: { type: String, maxlength: 1000 }, subject: String, createdAt: { type: Date, default: Date.now } }],
  scores: [{ subject: String, lesson: String, score: Number, maxScore: { type: Number, default: 10 }, createdAt: { type: Date, default: Date.now } }],
  trialStartedAt: { type: Date, default: null },
  trialEndsAt: { type: Date, default: null },
  trialStatus: { type: String, enum: ['active', 'expired', 'converted'], default: 'active', index: true }
}, { timestamps: true });

schema.methods.getTrialInfo = function(now) {
  return computeTrialInfo(this, now);
};

schema.statics.computeTrialInfo = computeTrialInfo;

module.exports = mongoose.model('SchoolStudent', schema);
