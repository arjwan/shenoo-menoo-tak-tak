'use strict';

const mongoose = require('mongoose');

const assignmentAttachmentSchema = new mongoose.Schema({
  name: { type: String, trim: true, default: '' },
  url: { type: String, trim: true, default: '' },
  fileType: { type: String, trim: true, default: '' },
  size: { type: Number, default: 0 }
}, { _id: false });

const assignmentSchema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  teacherProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolTeacher', default: null, index: true },
  stage: { type: String, enum: ['ابتدائي', 'متوسط', 'إعدادي'], required: true, index: true },
  grade: { type: String, required: true, trim: true, index: true },
  section: { type: String, trim: true, default: '' },
  classroom: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolClassroom', default: null },
  subject: { type: String, required: true, trim: true, maxlength: 120, index: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, default: '', trim: true, maxlength: 5000 },
  attachments: [assignmentAttachmentSchema],
  assignedStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SchoolStudent' }],
  dueAt: { type: Date, required: true, index: true },
  maxScore: { type: Number, required: true, min: 1, default: 100 },
  allowLateSubmission: { type: Boolean, default: true },
  status: { type: String, enum: ['draft', 'published', 'closed', 'archived'], default: 'published', index: true }
}, { timestamps: true });

assignmentSchema.index({ stage: 1, grade: 1, subject: 1 });
assignmentSchema.index({ teacher: 1, status: 1 });

module.exports = mongoose.model('SchoolAssignment', assignmentSchema);
