'use strict';
const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  requestedRole: { type: String, enum: ['student', 'teacher'], required: true, index: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  stage: { type: String, enum: ['ابتدائي', 'متوسط', 'إعدادي'], default: 'ابتدائي' },
  grade: { type: String, trim: true, default: '' },
  subjects: [{ type: String, trim: true }],
  note: { type: String, trim: true, maxlength: 1000, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  rejectionReason: { type: String, trim: true, maxlength: 1000, default: '' }
}, { timestamps: true });
schema.index({ user: 1, requestedRole: 1 }, { unique: true });
module.exports = mongoose.model('SchoolEnrollmentRequest', schema);
