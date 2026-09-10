const mongoose = require('mongoose');
const mediaSchema = new mongoose.Schema({ url: String, type: { type: String, enum: ['video'] }, mimeType: String, size: Number }, { _id: false });
const reelSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  media: { type: [mediaSchema], default: [] },
  text: { type: String, trim: true, default: '' },
  visibility: { type: String, enum: ['everyone','friends','followers','friends_followers'], default: 'everyone', index: true },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  active: { type: Boolean, default: true, index: true }
}, { timestamps: true });
reelSchema.index({ createdAt: -1 });
module.exports = mongoose.model('Reel', reelSchema);
