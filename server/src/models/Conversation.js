const mongoose = require('mongoose');
const conversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  unread: { type: Map, of: Number, default: {} }
}, { timestamps: true });
conversationSchema.index({ participants: 1 });
module.exports = require('../mysql/model').wrap(mongoose.model('Conversation', conversationSchema));
