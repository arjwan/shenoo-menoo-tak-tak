const mongoose = require('mongoose');

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, default: '', trim: true, maxlength: 3000 },
  privacy: { type: String, enum: ['public', 'private'], default: 'public', index: true },
  roomType: { type: String, enum: ['text', 'voice', 'challenge'], default: 'text', index: true },
  isOfficial: { type: Boolean, default: false, index: true },
  isLive: { type: Boolean, default: false, index: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  moderators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  pendingMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  mutedMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  bannedMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isLocked: { type: Boolean, default: false },
  allowMemberAudio: { type: Boolean, default: true },
  allowMemberVideo: { type: Boolean, default: false },
  maxSpeakers: { type: Number, min: 2, max: 24, default: 8 },
  coverUrl: { type: String, default: '' },
  isActive: { type: Boolean, default: true, index: true }
}, { timestamps: true });

GroupSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Group', GroupSchema);
