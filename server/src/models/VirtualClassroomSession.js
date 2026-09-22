'use strict';

// VirtualClassroomSession: DB model for an interactive AI-guided classroom session.
// Hosted by a real authorized user (teacher/admin/developer/guardian).
// Guided by an AI Virtual Teacher persona (never a fake human teacher).
// Bound to real Iraqi curriculum textbook sources (never fake curriculum content).
// Real students only: attendance, participation, hands, media states.
const mongoose = require('mongoose');

const virtualParticipantSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolStudent', default: null },
  role: { type: String, enum: ['host', 'student'], default: 'student' },
  permissions: {
    camera: { type: Boolean, default: true },
    voice: { type: Boolean, default: true }
  },
  joinedAt: { type: Date, default: Date.now },
  leftAt: { type: Date, default: null },
  online: { type: Boolean, default: false },
  handRaised: { type: Boolean, default: false },
  handRaisedAt: { type: Date, default: null },
  media: {
    camera: { type: Boolean, default: false },
    mic: { type: Boolean, default: false }
  },
  attendance: [{ joinedAt: Date, leftAt: { type: Date, default: null } }]
}, { _id: false });

const whiteboardSlideSchema = new mongoose.Schema({
  title: { type: String, default: '', trim: true },
  subtitle: { type: String, default: '', trim: true },
  leftColumn: {
    title: { type: String, default: '' },
    items: [{ type: String }]
  },
  rightColumn: {
    title: { type: String, default: '' },
    items: [{ type: String }],
    diagram: { type: String, default: '' } // type of diagram: 'number_line', 'fractions_bar', 'diagram', ''
  },
  example: { type: String, default: '' },
  note: { type: String, default: '' },
  drawing: { type: String, default: '' } // JSON string of canvas drawing strokes
}, { _id: false });

const virtualClassroomSessionSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  hostUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  hostName: { type: String, required: true, trim: true, maxlength: 100 },
  hostRole: { type: String, default: 'teacher' },
  virtualTeacher: {
    profileId: { type: String, required: true, default: 'sarah-smart' },
    name: { type: String, required: true, default: 'أ. سارة الذكية' },
    label: { type: String, default: 'معلم افتراضي / AI' },
    title: { type: String, default: 'معلم رياضيات وعلوم افتراضي' },
    avatar: { type: String, default: '' },
    dialect: { type: String, enum: ['ar-standard', 'ar-iraqi', 'en'], default: 'ar-standard' },
    voiceEnabled: { type: Boolean, default: true }
  },
  // Real curriculum binding:
  stage: { type: String, enum: ['ابتدائي', 'متوسط', 'إعدادي'], required: true, index: true },
  grade: { type: String, required: true, trim: true, index: true },
  subject: { type: String, required: true, trim: true, index: true },
  lesson: { type: String, required: true, trim: true, maxlength: 160 },
  sourceTitle: { type: String, required: true, trim: true }, // e.g. "كتاب الرياضيات — السادس الإبتدائي"
  sourceBookName: { type: String, default: '', trim: true },
  sourceCatalogId: { type: String, default: '' },
  sourcePage: { type: String, default: '' },
  lessonContent: { type: String, default: '' },
  whiteboardData: {
    slides: [whiteboardSlideSchema],
    currentSlide: { type: Number, default: 0 }
  },
  participants: [virtualParticipantSchema],
  status: { type: String, enum: ['active', 'ended'], default: 'active', index: true },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date, default: null }
}, { timestamps: true });

virtualClassroomSessionSchema.index({ status: 1, stage: 1, grade: 1, subject: 1 });

module.exports = mongoose.model('VirtualClassroomSession', virtualClassroomSessionSchema);
