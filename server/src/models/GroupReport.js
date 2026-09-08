const mongoose = require('mongoose');
const GroupReportSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  message: { type: mongoose.Schema.Types.ObjectId, ref: 'GroupMessage', default: null },
  reason: { type: String, required: true, trim: true, maxlength: 500 },
  status: { type: String, enum: ['open', 'reviewing', 'resolved', 'dismissed'], default: 'open', index: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolution: { type: String, trim: true, maxlength: 500, default: '' }
}, { timestamps: true });
GroupReportSchema.index({ group: 1, reporter: 1, createdAt: -1 });
module.exports = mongoose.model('GroupReport', GroupReportSchema);
