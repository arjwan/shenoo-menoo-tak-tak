const DataSyncRecord = require('../models/DataSyncRecord');

const VALID_TARGETS = new Set(['oracle', 'cloudflare']);

function shouldMirror(entityType, payload = {}) {
  const always = new Set(['user', 'post', 'reel', 'story', 'friendship', 'notification']);
  if (always.has(String(entityType))) return true;
  if (payload && payload.syncImportant === true) return true;
  return false;
}

async function queueSync({ entityType, entityId, source = 'mongo', target, operation = 'upsert', payload = {}, version = 1 }) {
  if (!VALID_TARGETS.has(target)) throw new Error('جهة المزامنة غير مدعومة');
  return DataSyncRecord.create({ entityType, entityId: String(entityId), source, target, operation, payload, version });
}

async function distribute({ entityType, entityId, source = 'mongo', payload = {}, version = 1, targets = ['oracle', 'cloudflare'] }) {
  if (!shouldMirror(entityType, payload)) return [];
  const jobs = [];
  for (const target of targets) {
    if (!VALID_TARGETS.has(target) || target === source) continue;
    jobs.push(await queueSync({ entityType, entityId, source, target, payload, version }));
  }
  return jobs;
}

async function markSynced(job, result = {}) {
  job.status = 'synced';
  job.syncedAt = new Date();
  job.lastError = '';
  job.payload = { ...(job.payload || {}), syncResult: result };
  await job.save();
  return job;
}

async function markFailed(job, error) {
  job.status = 'failed';
  job.attempts += 1;
  job.lastError = String(error?.message || error || 'sync failed').slice(0, 1000);
  const delayMinutes = Math.min(60, 2 ** Math.min(job.attempts, 6));
  job.nextAttemptAt = new Date(Date.now() + delayMinutes * 60 * 1000);
  await job.save();
  return job;
}

module.exports = { shouldMirror, queueSync, distribute, markSynced, markFailed };
