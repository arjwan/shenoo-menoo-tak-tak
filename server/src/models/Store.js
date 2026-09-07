const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  category: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 1000 },
  governorate: { type: String, required: true, trim: true, maxlength: 80 },
  area: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  socialLinks: { type: String, trim: true, maxlength: 300, default: '' },
  plan: { type: String, enum: ['basic', 'plus', 'featured'], required: true },
  logoUrl: { type: String, default: '' },
  coverUrl: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'suspended'], default: 'pending', index: true },
  rejectionReason: { type: String, default: '' },
  delegates: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, default: 'sales' },
    addedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

storeSchema.index({ owner: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Store', storeSchema);
