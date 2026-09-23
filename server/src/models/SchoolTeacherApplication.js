'use strict';

const mongoose = require('mongoose');

const teacherApplicationSchema = new mongoose.Schema({
  applicant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  fullName: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, trim: true, default: '' },
  email: { type: String, trim: true, lowercase: true, default: '' },
  subjects: [{ type: String, trim: true }],
  specialties: [{ type: String, trim: true }],
  stages: [{ type: String, enum: ['ابتدائي', 'متوسط', 'إعدادي'] }],
  grades: [{ type: String, trim: true }],
  sections: [{ type: String, trim: true }],
  qualifications: { type: String, trim: true, maxlength: 2000, default: '' },
  experience: { type: String, trim: true, maxlength: 2000, default: '' },
  experienceYears: { type: Number, default: 0, min: 0 },
  bio: { type: String, trim: true, maxlength: 2000, default: '' },
  notes: { type: String, trim: true, maxlength: 2000, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  rejectionReason: { type: String, trim: true, maxlength: 1000, default: '' },
  approvedTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolTeacher', default: null }
}, { timestamps: true });

teacherApplicationSchema.index({ applicant: 1, status: 1 });
teacherApplicationSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('SchoolTeacherApplication', teacherApplicationSchema);
