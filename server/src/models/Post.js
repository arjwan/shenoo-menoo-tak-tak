const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  url: { type: String, required: true },
  fallbackUrl: { type: String, default: '' },
  storageKey: { type: String, default: '' },
  storage: { type: String, enum: ['local','r2'], default: 'local' },
  type: { type: String, enum: ['image', 'video', 'audio'], required: true },
  mimeType: { type: String, default: '' },
  size: { type: Number, default: 0 }
}, { _id: false });

const postSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  text: { type: String, trim: true, maxlength: 5000, default: '' },
  media: { type: [mediaSchema], default: [] },
  type: { type: String, enum: ['post', 'ad'], default: 'post', index: true },
  visibility: { type: String, enum: ['everyone', 'friends', 'followers', 'friends_followers'], default: 'everyone', index: true },
  adStatus: { type: String, enum: ['not_ad', 'pending', 'approved', 'rejected'], default: 'not_ad', index: true },
  adTitle: { type: String, trim: true, maxlength: 120, default: '' },
  adContact: { type: String, trim: true, maxlength: 160, default: '' },
  adCategory: { type: String, trim: true, maxlength: 80, default: '' },
  adReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  adReviewedAt: { type: Date, default: null },
  adReviewNote: { type: String, trim: true, maxlength: 500, default: '' },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  commentsCount: { type: Number, default: 0 },
  active: { type: Boolean, default: true, index: true }
}, { timestamps: true });

postSchema.index({ createdAt: -1 });
postSchema.index({ type: 1, adStatus: 1, createdAt: -1 });
module.exports = mongoose.model('Post', postSchema);
