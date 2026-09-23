'use strict';

const mongoose = require('mongoose');

const submissionAttachmentSchema = new mongoose.Schema({
  name: { type: String, trim: true, default: '' },
  url: { type: String, trim: true, default: '' },
  fileType: { type: String, trim: true, default: '' },
  size: { type: Number, default: 0 }
}, { _id: false });

const submissionSchema = new mongoose.Schema({
  assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolAssignment', required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolStudent', required: true, index: true },
  studentUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  content: { type: String, default: '', trim: true, maxlength: 10000 },
  attachments: [submissionAttachmentSchema],
  submittedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['submitted', 'late', 'resubmitted', 'graded'], default: 'submitted', index: true },
  score: { type: Number, default: null, min: 0 },
  maxScore: { type: Number, default: null },
  teacherFeedback: { type: String, default: '', trim: true, maxlength: 2000 },
  gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  gradedAt: { type: Date, default: null },
  gradeRecord: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolGradeRecord', default: null },
  resubmissionCount: { type: Number, default: 0 }
}, { timestamps: true });

submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });
submissionSchema.index({ student: 1, status: 1 });

module.exports = mongoose.model('SchoolAssignmentSubmission', submissionSchema);
