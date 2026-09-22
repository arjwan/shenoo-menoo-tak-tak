'use strict';

const mongoose = require('mongoose');

const scheduleSlotSchema = new mongoose.Schema({
  day: { type: String, enum: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'], required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  stage: { type: String, required: true },
  grade: { type: String, required: true },
  section: { type: String, default: 'أ' },
  subject: { type: String, required: true }
}, { _id: false });

const teacherSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  gender: { type: String, enum: ['ذكر', 'أنثى', 'other'], default: 'ذكر' },
  phone: { type: String, trim: true, default: '' },
  subjects: [{ type: String, trim: true }],
  stages: [{ type: String, enum: ['ابتدائي', 'متوسط', 'إعدادي'] }],
  grades: [{ type: String, trim: true }],
  sections: [{ type: String, trim: true }],
  status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },
  scheduleSlots: [scheduleSlotSchema],
  assignedStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SchoolStudent' }],
  registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

teacherSchema.index({ subjects: 1 });
teacherSchema.index({ stages: 1 });

module.exports = mongoose.model('SchoolTeacher', teacherSchema);
