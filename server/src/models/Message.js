const mongoose = require('mongoose');
const attachmentSchema = new mongoose.Schema({
  url: { type: String, required: true },
  name: { type: String, required: true, maxlength: 255 },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true, max: 10 * 1024 * 1024 }
}, { _id: false });
const messageSchema = new mongoose.Schema({
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['text', 'image', 'video', 'file', 'audio'], default: 'text' },
  text: { type: String, trim: true, maxlength: 5000, default: '' },
  attachment: { type: attachmentSchema, default: null },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  deliveredAt: { type: Date, default: null },
  readAt: { type: Date, default: null },
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  deletedForEveryone: { type: Boolean, default: false }
}, { timestamps: true });
messageSchema.index({ conversation: 1, createdAt: -1 });
module.exports = mongoose.model('Message', messageSchema);
