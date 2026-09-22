'use strict';

const mongoose = require('mongoose');

const EVENT_TYPES = ['LIVE_CLASS', 'RECORDED_REPLAY', 'GENERAL_REVIEW', 'EXAM'];

const eventScheduleSchema = new mongoose.Schema({
  type: { type: String, enum: EVENT_TYPES, required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  description: { type: String, default: '', trim: true, maxlength: 1000 },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  teacherName: { type: String, required: true, trim: true, maxlength: 100 },
  stage: { type: String, enum: ['ابتدائي', 'متوسط', 'إعدادي'], required: true },
  grade: { type: String, required: true, trim: true, maxlength: 80 },
  section: { type: String, default: '', trim: true, maxlength: 40 },
  subject: { type: String, required: true, trim: true, maxlength: 120 },
  lesson: { type: String, default: '', trim: true, maxlength: 160 },
  scheduledAt: { type: Date, required: true, index: true },
  durationMinutes: { type: Number, default: 45, min: 10, max: 240 },
  status: { type: String, enum: ['scheduled', 'active', 'completed', 'cancelled'], default: 'scheduled', index: true },
  // RECORDED_REPLAY is strictly a pointer to an existing, pre-approved curriculum or recorded session.
  // No hidden automatic recording of camera or microphone is ever created or stored.
  recordedResourceUrl: { type: String, default: '', trim: true },
  examConfig: {
    maxScore: { type: Number, default: 100 },
    passingScore: { type: Number, default: 50 },
    instructions: { type: String, default: '' },
    notifiedManagement: { type: Boolean, default: true }
  },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SchoolStudent' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

eventScheduleSchema.index({ scheduledAt: 1, stage: 1, grade: 1, status: 1 });

module.exports = mongoose.model('SchoolEventSchedule', eventScheduleSchema);
module.exports.EVENT_TYPES = EVENT_TYPES;
