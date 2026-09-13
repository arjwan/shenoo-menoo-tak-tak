const mongoose = require('mongoose');

const astrologyProviderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  displayTitle: { type: String, required: true, trim: true, maxlength: 120 },
  bio: { type: String, required: true, trim: true, maxlength: 1200 },
  skills: [{ type: String, enum: ['horoscope','palm','tarot','coffee'] }],
  revealIdentity: { type: Boolean, default: false },
  serviceType: { type: String, enum: ['free','paid'], default: 'free' },
  fee: { type: Number, min: 0, default: 0 },
  currency: { type: String, default: 'IQD' },
  status: { type: String, enum: ['pending','approved','rejected','suspended'], default: 'pending', index: true },
  rejectionReason: { type: String, trim: true, maxlength: 400, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('AstrologyProvider', astrologyProviderSchema);
