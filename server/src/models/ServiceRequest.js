const mongoose = require('mongoose');

const serviceRequestSchema = new mongoose.Schema({
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  provider: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceProvider', required: true, index: true },
  providerOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  kind: { type: String, enum: ['profession','transport'], required: true, index: true },
  requestType: { type: String, trim: true, maxlength: 120, default: '' },
  description: { type: String, trim: true, maxlength: 1800, required: true },
  pickupAddress: { type: String, trim: true, maxlength: 300, default: '' },
  destination: { type: String, trim: true, maxlength: 300, default: '' },
  phone: { type: String, trim: true, maxlength: 40, required: true },
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null },
  status: { type: String, enum: ['pending','accepted','rejected','on_the_way','in_progress','completed','cancelled'], default: 'pending', index: true },
  providerNote: { type: String, trim: true, maxlength: 600, default: '' },
  acceptedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null }
}, { timestamps: true });

serviceRequestSchema.index({ providerOwner: 1, status: 1, createdAt: -1 });
serviceRequestSchema.index({ requester: 1, createdAt: -1 });

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);
