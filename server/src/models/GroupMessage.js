const mongoose = require('mongoose');

const GroupMessageSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  text: { type: String, trim: true, maxlength: 5000, default: '' },
  attachment: {
    url: { type: String, default: '' },
    type: { type: String, enum: ['', 'image', 'video', 'audio', 'file'], default: '' },
    mimeType: { type: String, default: '' },
    originalName: { type: String, default: '' },
    size: { type: Number, default: 0 }
  }
}, { timestamps: true });

GroupMessageSchema.index({ group: 1, createdAt: -1 });
module.exports = mongoose.model('GroupMessage', GroupMessageSchema);
