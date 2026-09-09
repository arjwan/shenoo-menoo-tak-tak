const mongoose = require('mongoose');

const serviceProviderSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  kind: { type: String, enum: ['profession','transport'], required: true, index: true },
  category: { type: String, required: true, trim: true, maxlength: 120, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 1200, default: '' },
  governorate: { type: String, required: true, trim: true, maxlength: 80, index: true },
  area: { type: String, required: true, trim: true, maxlength: 100 },
  address: { type: String, required: true, trim: true, maxlength: 240 },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  whatsapp: { type: String, trim: true, maxlength: 30, default: '' },
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null },
  imageUrl: { type: String, default: '' },
  vehicleType: { type: String, trim: true, maxlength: 80, default: '' },
  vehicleModel: { type: String, trim: true, maxlength: 80, default: '' },
  availableForWork: { type: Boolean, default: true, index: true },
  status: { type: String, enum: ['pending','approved','rejected','suspended'], default: 'pending', index: true },
  ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
  ratingCount: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

serviceProviderSchema.index({ kind: 1, category: 1, governorate: 1, status: 1 });

module.exports = mongoose.model('ServiceProvider', serviceProviderSchema);
