const mongoose = require('mongoose');
const mediaSchema = new mongoose.Schema({ url: String, type: { type: String, enum: ['image','video'] }, mimeType: String, size: Number }, { _id: false });
const storySchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  media: [mediaSchema],
  text: { type: String, trim: true, default: '' },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24*60*60*1000), index: true },
  active: { type: Boolean, default: true, index: true }
}, { timestamps: true });
storySchema.index({ author: 1, createdAt: -1 });
module.exports = mongoose.model('Story', storySchema);
