const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  url: { type: String, required: true },
  type: { type: String, enum: ['image', 'video', 'audio'], required: true },
  mimeType: { type: String, default: '' },
  size: { type: Number, default: 0 }
}, { _id: false });

const postSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  text: { type: String, trim: true, maxlength: 5000, default: '' },
  media: { type: [mediaSchema], default: [] },
  type: { type: String, enum: ['post', 'ad'], default: 'post', index: true },
  visibility: { type: String, enum: ['everyone', 'friends'], default: 'everyone', index: true },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  commentsCount: { type: Number, default: 0 },
  active: { type: Boolean, default: true, index: true }
}, { timestamps: true });

postSchema.index({ createdAt: -1 });
module.exports = mongoose.model('Post', postSchema);
