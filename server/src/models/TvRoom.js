const mongoose = require('mongoose');

const tvRoomSchema = new mongoose.Schema({
  name: { type: String, trim: true, maxlength: 120, default: 'غرفة مشاهدة' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  mode: { type: String, enum: ['solo', 'shared'], default: 'shared', index: true },
  visibility: { type: String, enum: ['public', 'friends', 'private'], default: 'friends', index: true },
  sourceType: { type: String, enum: ['live', 'recorded'], default: 'live' },
  sourceUrl: { type: String, trim: true, maxlength: 1000, default: '' },
  title: { type: String, trim: true, maxlength: 180, default: '' },
  viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  invitedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  voiceEnabled: { type: Boolean, default: true },
  chatEnabled: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true, index: true }
}, { timestamps: true });

tvRoomSchema.index({ isActive: 1, updatedAt: -1 });
module.exports = mongoose.model('TvRoom', tvRoomSchema);
