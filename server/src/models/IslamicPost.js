const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  url: { type: String, required: true },
  type: { type: String, enum: ['image', 'video', 'audio', 'document'], required: true },
  mimeType: { type: String, default: '' },
  size: { type: Number, default: 0 },
  originalName: { type: String, default: '' }
}, { _id: false });

const commentSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, trim: true, maxlength: 2000, required: true }
}, { timestamps: true });

const islamicPostSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  category: { type: String, enum: ['dua', 'ziyarat', 'books', 'lecture', 'quran', 'general'], default: 'general', index: true },
  title: { type: String, trim: true, maxlength: 180, default: '' },
  text: { type: String, trim: true, maxlength: 10000, default: '' },
  media: { type: [mediaSchema], default: [] },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: { type: [commentSchema], default: [] },
  active: { type: Boolean, default: true, index: true },
  sharedToGeneral: { type: Boolean, default: false },
  generalPostId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null }
}, { timestamps: true });

islamicPostSchema.index({ category: 1, createdAt: -1 });
module.exports = mongoose.model('IslamicPost', islamicPostSchema);
