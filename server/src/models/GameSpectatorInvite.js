const mongoose = require('mongoose');

const inviteSchema = new mongoose.Schema({
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'GameRoom', required: true, index: true },
  inviter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  invitee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' }
}, { timestamps: true });

inviteSchema.index({ room: 1, inviter: 1, invitee: 1 }, { unique: true });
module.exports = mongoose.model('GameSpectatorInvite', inviteSchema);
