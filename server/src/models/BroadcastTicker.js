const mongoose = require('mongoose');

const broadcastTickerSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true, maxlength: 500 },
  type: { type: String, enum: ['notice', 'guidance', 'ad'], default: 'notice', index: true },
  priority: { type: Number, min: 0, max: 100, default: 50, index: true },
  enabled: { type: Boolean, default: true, index: true },
  startsAt: { type: Date, default: null, index: true },
  endsAt: { type: Date, default: null, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

broadcastTickerSchema.index({ enabled: 1, priority: -1, createdAt: -1 });

module.exports = mongoose.models.BroadcastTicker || mongoose.model('BroadcastTicker', broadcastTickerSchema);
