const mongoose = require('mongoose');

const accountChangeRequestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['name', 'password'], required: true, index: true },
  requestedName: { type: String, trim: true, maxlength: 100, default: '' },
  passwordHash: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  rejectionReason: { type: String, trim: true, maxlength: 400, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null }
}, { timestamps: true });

accountChangeRequestSchema.index({ user: 1, type: 1, status: 1 });
module.exports = mongoose.model('AccountChangeRequest', accountChangeRequestSchema);
