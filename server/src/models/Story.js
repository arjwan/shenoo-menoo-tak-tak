const mongoose = require('mongoose');
const mediaSchema = new mongoose.Schema({ url: String, type: { type: String, enum: ['image','video'] }, mimeType: String, size: Number }, { _id: false });
const overlaySchema = new mongoose.Schema({
  kind: { type: String, enum: ['text','emoji'], required: true },
  value: { type: String, trim: true, maxlength: 300, required: true },
  x: { type: Number, min: 0, max: 100, default: 50 },
  y: { type: Number, min: 0, max: 100, default: 50 },
  size: { type: Number, min: 12, max: 96, default: 32 }
}, { _id: false });
const musicSchema = new mongoose.Schema({
  url: { type: String, default: '' },
  mimeType: { type: String, default: '' },
  size: { type: Number, default: 0 },
  name: { type: String, trim: true, maxlength: 180, default: '' }
}, { _id: false });
const storySchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  media: [mediaSchema],
  text: { type: String, trim: true, maxlength: 1000, default: '' },
  overlays: { type: [overlaySchema], default: [] },
  music: { type: musicSchema, default: () => ({}) },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24*60*60*1000), index: true },
  active: { type: Boolean, default: true, index: true }
}, { timestamps: true });
storySchema.index({ author: 1, createdAt: -1 });
module.exports = mongoose.model('Story', storySchema);
