'use strict';

const mongoose = require('mongoose');

const attendanceRecordSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolStudent', required: true, index: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  scheduleEvent: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolEventSchedule', default: null, index: true },
  stage: { type: String, default: '' },
  grade: { type: String, default: '' },
  section: { type: String, default: '' },
  subject: { type: String, default: '' },
  date: { type: Date, default: Date.now, index: true },
  status: { type: String, enum: ['present', 'absent', 'late', 'excused'], required: true },
  notes: { type: String, default: '', trim: true, maxlength: 500 }
}, { timestamps: true });

attendanceRecordSchema.index({ student: 1, date: -1 });

module.exports = mongoose.model('SchoolAttendanceRecord', attendanceRecordSchema);
