const mongoose = require('mongoose');

const DataSyncRecordSchema = new mongoose.Schema({
  entityType: { type: String, required: true, index: true, trim: true },
  entityId: { type: String, required: true, index: true, trim: true },
  source: { type: String, enum: ['oracle', 'mongo', 'cloudflare'], required: true, index: true },
  target: { type: String, enum: ['oracle', 'mongo', 'cloudflare'], required: true, index: true },
  operation: { type: String, enum: ['upsert', 'delete'], default: 'upsert' },
  version: { type: Number, default: 1 },
  status: { type: String, enum: ['pending', 'syncing', 'synced', 'failed'], default: 'pending', index: true },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now, index: true },
  lastError: { type: String, default: '' },
  syncedAt: { type: Date, default: null },
}, { timestamps: true });

DataSyncRecordSchema.index({ entityType: 1, entityId: 1, target: 1, status: 1 });

module.exports = mongoose.model('DataSyncRecord', DataSyncRecordSchema);
