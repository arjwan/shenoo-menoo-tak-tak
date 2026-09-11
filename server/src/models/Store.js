const mongoose = require('mongoose');

const delegateSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  name: { type: String, trim: true, maxlength: 120, default: '' },
  phone: { type: String, trim: true, maxlength: 30, default: '' },
  role: { type: String, enum: ['sales'], default: 'sales' },
  addedAt: { type: Date, default: Date.now }
}, { _id: true });

const storeSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  category: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 1000 },
  governorate: { type: String, required: true, trim: true, maxlength: 80 },
  area: { type: String, required: true, trim: true, maxlength: 100 },
  address: { type: String, required: true, trim: true, maxlength: 240 },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  whatsapp: { type: String, trim: true, maxlength: 30, default: '' },
  facebook: { type: String, trim: true, maxlength: 220, default: '' },
  instagram: { type: String, trim: true, maxlength: 220, default: '' },
  website: { type: String, trim: true, maxlength: 220, default: '' },
  plan: { type: String, enum: ['basic', 'plus', 'featured'], required: true },
  template: { type: String, enum: ['elegant', 'tech', 'market'], default: 'elegant' },
  spaceSize: { type: String, enum: ['small', 'medium', 'large'], default: 'small' },
  logoUrl: { type: String, default: '' },
  coverUrl: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'suspended'], default: 'pending', index: true },
  rejectionReason: { type: String, default: '' },
  delegates: { type: [delegateSchema], validate: [v => v.length <= 2, 'الحد الأقصى مندوبان'] }
}, { timestamps: true });

storeSchema.index({ owner: 1, name: 1 }, { unique: true });
module.exports = mongoose.model('Store', storeSchema);
