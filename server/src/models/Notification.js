const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['post','story','reel'], required: true, index: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  href: { type: String, required: true, trim: true },
  text: { type: String, trim: true, maxlength: 300, default: '' },
  readAt: { type: Date, default: null, index: true },
  groupKey: { type: String, trim: true, default: '', index: true }
}, { timestamps: true });

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, groupKey: 1, createdAt: -1 });
module.exports = mongoose.model('Notification', notificationSchema);
