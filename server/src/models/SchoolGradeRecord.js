'use strict';

const mongoose = require('mongoose');

const gradeRecordSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolStudent', required: true, index: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  scheduleEvent: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolEventSchedule', default: null, index: true },
  subject: { type: String, required: true, trim: true, maxlength: 120 },
  gradeType: { type: String, enum: ['exam', 'quiz', 'homework', 'participation', 'review'], default: 'exam' },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  score: { type: Number, required: true, min: 0 },
  maxScore: { type: Number, required: true, min: 1, default: 100 },
  notes: { type: String, default: '', trim: true, maxlength: 1000 },
  recordedAt: { type: Date, default: Date.now }
}, { timestamps: true });

gradeRecordSchema.index({ student: 1, subject: 1, recordedAt: -1 });

module.exports = mongoose.model('SchoolGradeRecord', gradeRecordSchema);
