const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  guardian: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  clientOpId: { type: String, required: true, trim: true },
  type: { type: String, required: true, trim: true },
  localId: { type: String, default: '', trim: true, index: true },
  status: { type: String, enum: ['applied', 'failed'], default: 'applied', index: true },
  result: { type: mongoose.Schema.Types.Mixed, default: {} },
  error: { type: String, default: '' }
}, { timestamps: true });

schema.index({ guardian: 1, clientOpId: 1 }, { unique: true });
schema.index({ guardian: 1, localId: 1 });

module.exports = mongoose.model('SchoolSyncOperation', schema);
