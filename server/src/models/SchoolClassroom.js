'use strict';

// Real live classroom (REAL CLASSROOM V1): one document per session hosted by
// a real Shno Mano account (the teacher). Participants are real accounts; a
// guardian account may attend on behalf of one of ITS OWN SchoolStudent
// profiles (real pupil name + the guardian's camera/voice consent). Nothing
// here is ever auto-created for demo purposes.
//
// No media is stored: WebRTC streams stay peer-to-peer (signaling only goes
// through Socket.IO) and V1 records nothing.
const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  role: { type: String, enum: ['teacher', 'student'], required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolStudent', default: null },
  // Guardian consent copied from SchoolStudent.learningPermissions at join
  // time (an account attending as itself decides for itself -> true).
  permissions: {
    camera: { type: Boolean, default: true },
    voice: { type: Boolean, default: true }
  },
  joinedAt: { type: Date, default: Date.now },
  leftAt: { type: Date, default: null },
  online: { type: Boolean, default: false },
  handRaised: { type: Boolean, default: false },
  handRaisedAt: { type: Date, default: null },
  mutedByTeacher: { type: Boolean, default: false },
  // Self-reported device state (the server can only ever turn these OFF).
  media: {
    camera: { type: Boolean, default: false },
    mic: { type: Boolean, default: false }
  },
  kicked: { type: Boolean, default: false },
  attendance: [{ joinedAt: Date, leftAt: { type: Date, default: null } }]
}, { _id: false });

const classroomSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  teacherName: { type: String, required: true, trim: true, maxlength: 100 },
  stage: { type: String, enum: ['ابتدائي', 'متوسط', 'إعدادي'], required: true },
  grade: { type: String, required: true, trim: true, maxlength: 80 },
  subject: { type: String, required: true, trim: true, maxlength: 120 },
  lesson: { type: String, default: '', trim: true, maxlength: 160 },
  status: { type: String, enum: ['live', 'ended'], default: 'live', index: true },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date, default: null },
  whiteboard: {
    drawing: { type: String, default: '', maxlength: 500000 },
    updatedAt: { type: Date, default: null }
  },
  answeringStudent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  studentMayWrite: { type: Boolean, default: false },
  participants: [participantSchema]
}, { timestamps: true });

classroomSchema.index({ status: 1, stage: 1, grade: 1, subject: 1 });

module.exports = mongoose.model('SchoolClassroom', classroomSchema);
