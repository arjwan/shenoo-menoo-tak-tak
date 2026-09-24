'use strict';

const mongoose = require('mongoose');

const SchoolGuardianNotificationSchema = new mongoose.Schema({
  guardian: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolStudent', required: true, index: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  type: { type: String, enum: ['THREE_CONSECUTIVE_ABSENCES','EXAM_REVIEW','SYSTEM'], required: true, index: true },
  subject: { type: String, default: '' },
  title: { type: String, required: true },
  message: { type: String, required: true, maxlength: 2000 },
  readAt: { type: Date, default: null },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('SchoolGuardianNotification', SchoolGuardianNotificationSchema);
