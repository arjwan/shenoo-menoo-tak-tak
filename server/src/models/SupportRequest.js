const mongoose = require('mongoose');

const SupportRequestSchema = new mongoose.Schema({
  type: { type: String, enum: ['technical', 'privacy', 'unban'], required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  identity: { type: String, trim: true, maxlength: 160, default: '' },
  subject: { type: String, trim: true, maxlength: 180, required: true },
  message: { type: String, trim: true, maxlength: 5000, required: true },
  status: { type: String, enum: ['open', 'in_review', 'resolved', 'rejected'], default: 'open', index: true },
  adminReply: { type: String, trim: true, maxlength: 5000, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('SupportRequest', SupportRequestSchema);
