'use strict';
const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  requestedRole: { type: String, enum: ['student', 'teacher'], required: true, index: true },
  guardian: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  studentName: { type: String, trim: true, maxlength: 100, default: '' },
  studentUsername: { type: String, trim: true, lowercase: true, maxlength: 30, default: '' },
  guardianPhone: { type: String, trim: true, default: '' },
  relationship: { type: String, enum: ['أب', 'أم', 'ولي أمر', 'أخرى'], default: 'ولي أمر' },
  consents: [{
    consentType: { type: String, trim: true },
    granted: { type: Boolean, default: false },
    decidedAt: { type: Date, default: Date.now }
  }],
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  stage: { type: String, enum: ['ابتدائي', 'متوسط', 'إعدادي'], default: 'ابتدائي' },
  grade: { type: String, trim: true, default: '' },
  subjects: [{ type: String, trim: true }],
  note: { type: String, trim: true, maxlength: 1000, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  rejectionReason: { type: String, trim: true, maxlength: 1000, default: '' }
}, { timestamps: true });
schema.index({ user: 1, requestedRole: 1 }, { unique: true, partialFilterExpression: { guardian: null } });
schema.index({ guardian: 1, studentUsername: 1 }, { unique: true, partialFilterExpression: { guardian: { $type: 'objectId' }, studentUsername: { $type: 'string', $gt: '' } } });
module.exports = mongoose.model('SchoolEnrollmentRequest', schema);
