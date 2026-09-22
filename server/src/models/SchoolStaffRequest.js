'use strict';
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolTeacher', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['schedule', 'curriculum', 'student_support', 'permission', 'other'], default: 'other' },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  details: { type: String, required: true, trim: true, maxlength: 3000 },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  response: { type: String, trim: true, maxlength: 3000, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null }
}, { timestamps: true });

schema.index({ teacher: 1, createdAt: -1 });
module.exports = mongoose.model('SchoolStaffRequest', schema);
