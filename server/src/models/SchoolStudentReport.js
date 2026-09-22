'use strict';
const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolStudent', required: true, index: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolTeacher', required: true, index: true },
  subject: { type: String, trim: true, default: '' },
  level: { type: String, enum: ['excellent', 'good', 'needs_support'], default: 'good' },
  participation: { type: String, trim: true, maxlength: 1000, default: '' },
  homework: { type: String, trim: true, maxlength: 1000, default: '' },
  learningBehavior: { type: String, trim: true, maxlength: 1000, default: '' },
  recommendations: { type: String, trim: true, maxlength: 2000, default: '' },
  visibleToGuardian: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });
module.exports = mongoose.model('SchoolStudentReport', schema);
