'use strict';

const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  guardian: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolStudent', required: true, index: true },
  subject: { type: String, required: true, trim: true, maxlength: 200 },
  body: { type: String, required: true, trim: true, maxlength: 4000 },
  status: { type: String, enum: ['NEW', 'IN_PROGRESS', 'CLOSED'], default: 'NEW', index: true },
  adminResponse: {
    text: { type: String, default: '', maxlength: 4000 },
    respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    respondedAt: { type: Date, default: null }
  },
  attachments: [{
    url: { type: String, trim: true },
    originalName: { type: String, trim: true }
  }]
}, { timestamps: true });

complaintSchema.index({ guardian: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('GuardianComplaint', complaintSchema);
