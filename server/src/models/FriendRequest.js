const mongoose = require('mongoose');

const friendRequestSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pairKey: { type: String, trim: true, default: '' },
  source: { type: String, enum: ['direct', 'qr', 'contacts'], default: 'direct' },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'cancelled'], default: 'pending' }
}, { timestamps: true });

friendRequestSchema.pre('validate', function setPairKey(next) {
  if (this.sender && this.receiver) this.pairKey = [String(this.sender), String(this.receiver)].sort().join(':');
  next();
});
friendRequestSchema.index({ sender: 1, receiver: 1 }, { unique: true });
friendRequestSchema.index(
  { pairKey: 1 },
  { unique: true, partialFilterExpression: { pairKey: { $type: 'string', $gt: '' } } }
);
friendRequestSchema.index({ receiver: 1, status: 1 });

module.exports = mongoose.model('FriendRequest', friendRequestSchema);
