'use strict';
const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 180 },
  body: { type: String, required: true, trim: true, maxlength: 5000 },
  audience: { type: String, enum: ['all', 'student', 'teacher', 'guardian'], default: 'all', index: true },
  stage: { type: String, trim: true, default: '' },
  grade: { type: String, trim: true, default: '' },
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  publishedAt: { type: Date, default: Date.now, index: true },
  active: { type: Boolean, default: true, index: true }
}, { timestamps: true });
module.exports = mongoose.model('SchoolAnnouncement', schema);
