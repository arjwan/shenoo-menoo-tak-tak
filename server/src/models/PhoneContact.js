const mongoose = require('mongoose');

const phoneContactSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, trim: true, maxlength: 100, default: 'جهة اتصال' },
  phone: { type: String, required: true, trim: true, match: /^07\d{9}$/ }
}, { timestamps: true });

phoneContactSchema.index({ owner: 1, phone: 1 }, { unique: true });

module.exports = mongoose.model('PhoneContact', phoneContactSchema);
