'use strict';

const mongoose = require('mongoose');

const SchoolTeacherStudentRequestSchema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolTeacher', required: true, index: true },
  teacherUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolStudent', required: true, index: true },
  guardian: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  kind: { type: String, enum: ['ADD','REMOVE'], required: true },
  requestedBy: { type: String, enum: ['TEACHER','STUDENT'], required: true },
  stage: { type: String, required: true },
  grade: { type: String, required: true },
  section: { type: String, default: 'أ' },
  subjects: [{ type: String, trim: true }],
  status: { type: String, enum: ['PENDING','APPROVED','REJECTED','CANCELLED'], default: 'PENDING', index: true },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  decidedAt: { type: Date, default: null },
  note: { type: String, default: '', maxlength: 1000 }
}, { timestamps: true });

SchoolTeacherStudentRequestSchema.index({ teacher: 1, student: 1, kind: 1, status: 1 });
module.exports = mongoose.model('SchoolTeacherStudentRequest', SchoolTeacherStudentRequestSchema);
