'use strict';

const mongoose = require('mongoose');

const guardianSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  relationship: { type: String, enum: ['أب', 'أم', 'ولي أمر', 'أخرى'], default: 'ولي أمر' },
  contactPhone: { type: String, trim: true, default: '' },
  contactMethod: { type: String, enum: ['phone', 'inApp', 'email'], default: 'inApp' },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SchoolStudent' }],
  status: { type: String, enum: ['active', 'archived'], default: 'active', index: true }
}, { timestamps: true });

module.exports = mongoose.model('SchoolGuardian', guardianSchema);
