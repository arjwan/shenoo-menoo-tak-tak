'use strict';

// VirtualClassroomMessage: stores Q&A, chat, and AI virtual teacher answers
// within a VirtualClassroomSession.
// When an AI question is asked, question + answer are recorded.
// No fake answers: if AI provider is unavailable, no simulated answer is saved.
const mongoose = require('mongoose');

const virtualClassroomMessageSchema = new mongoose.Schema({
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'VirtualClassroomSession', required: true, index: true },
  code: { type: String, required: true, uppercase: true, trim: true, index: true },
  senderType: {
    type: String,
    enum: ['student', 'teacher_ai', 'host', 'system'],
    required: true
  },
  senderUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  senderStudent: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolStudent', default: null },
  senderName: { type: String, required: true, trim: true, maxlength: 100 },
  type: {
    type: String,
    enum: ['question', 'answer', 'chat', 'speech_bubble', 'system'],
    default: 'chat'
  },
  text: { type: String, required: true, trim: true, maxlength: 4000 },
  isVoiceQuestion: { type: Boolean, default: false },
  aiProvider: { type: String, default: '', trim: true },
  aiModel: { type: String, default: '', trim: true },
  sourceRefs: [{
    title: { type: String, default: '' },
    page: { type: String, default: '' }
  }],
  timestamp: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

virtualClassroomMessageSchema.index({ code: 1, timestamp: 1 });

module.exports = mongoose.model('VirtualClassroomMessage', virtualClassroomMessageSchema);
