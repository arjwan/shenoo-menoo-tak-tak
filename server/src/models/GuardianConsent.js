'use strict';

const mongoose = require('mongoose');

const CONSENT_TYPES = [
  'microphone',
  'camera',
  'live_classroom_participation',
  'virtual_teacher_participation',
  'ai_voice_usage',
  'save_learning_qa',
  'school_notifications'
];

const consentSchema = new mongoose.Schema({
  guardian: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolStudent', required: true, index: true },
  consentType: { type: String, enum: CONSENT_TYPES, required: true },
  granted: { type: Boolean, required: true, default: false }, // Explicit opt-in only. Never true by default!
  version: { type: String, required: true, default: '2026-09-21-v1' },
  text: { type: String, required: true, trim: true },
  decidedAt: { type: Date, default: Date.now }
}, { timestamps: true });

consentSchema.index({ guardian: 1, student: 1, consentType: 1 }, { unique: true });

module.exports = mongoose.model('GuardianConsent', consentSchema);
module.exports.CONSENT_TYPES = CONSENT_TYPES;
