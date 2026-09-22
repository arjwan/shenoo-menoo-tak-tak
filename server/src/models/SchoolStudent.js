'use strict';
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  guardian: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  // Leave this field absent for guardian-managed children. A null default would
  // still participate in MongoDB's unique index and reject the second child.
  studentUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, sparse: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  stage: { type: String, enum: ['ابتدائي', 'متوسط', 'إعدادي'], required: true },
  grade: { type: String, required: true, trim: true },
  section: { type: String, trim: true, default: 'أ' },
  subjects: [{ type: String, trim: true }],
  assignedTeachers: [{ teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolTeacher' }, subject: { type: String, trim: true } }],
  assignedVirtualTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'VirtualTeacherProfile', default: null },
  subscription: {
    plan: { type: String, default: 'مدرسة سومر' },
    status: { type: String, enum: ['pending', 'active', 'paused'], default: 'pending' },
    expiresAt: { type: Date, default: null }
  },
  status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },
  registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  registrationDate: { type: Date, default: Date.now },
  parentApproved: { type: Boolean, default: true },
  active: { type: Boolean, default: true },
  learningPermissions: { voice: { type: Boolean, default: false }, camera: { type: Boolean, default: false }, updatedAt: { type: Date, default: null } },
  progress: { average: { type: Number, default: 0 }, sessions: { type: Number, default: 0 }, answered: { type: Number, default: 0 } },
  notes: [{ text: { type: String, maxlength: 1000 }, subject: String, createdAt: { type: Date, default: Date.now } }],
  scores: [{ subject: String, lesson: String, score: Number, maxScore: { type: Number, default: 10 }, createdAt: { type: Date, default: Date.now } }]
}, { timestamps: true });

module.exports = mongoose.model('SchoolStudent', schema);
