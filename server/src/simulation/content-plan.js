'use strict';
const crypto = require('node:crypto');
const catalog = require('./content-catalog.json');
const BATCH = 'social-content-20261005-v1';
function id(type, key) { return crypto.createHash('sha256').update(BATCH + ':' + type + ':' + key).digest('hex').slice(0,24); }
function buildContent(users, now = new Date()) {
  if (users.length < 4 || users.some(u => u.isSynthetic !== true || u.status !== 'active')) throw Error('At least four active synthetic accounts are required');
  if (new Set(catalog.map(x => x.text)).size !== catalog.length) throw Error('Duplicate content');
  const base = '/uploads/simulation/' + BATCH;
  const data = { Post: [], Reel: [], Story: [] };
  const add = (type, key, author, doc) => data[type].push({
    _id: id(type, key), author, ...doc, isSynthetic: true, syntheticBatch: BATCH,
    simulationKey: key, visibility: 'everyone', active: true, createdAt: now, updatedAt: now
  });
  catalog.forEach((entry, i) => add('Post', entry.key, users[i % users.length]._id, {
    text: entry.text, type: 'post', likes: [], commentsCount: 0, sharesCount: 0,
    media: i % 3 === 0 ? [] : [{ url: base + '/card-' + i + '.svg', type: 'image', mimeType: 'image/svg+xml', storage: 'local' }]
  }));
  for (let i = 0; i < 12; i++) {
    const entry = catalog[i * 3 + 2];
    add('Reel', String(i), users[(i * 3 + 2) % users.length]._id, {
      text: entry.title + ' — ' + entry.text, likes: [], comments: [], savedBy: [],
      media: [{ url: base + '/reel-' + i + '.mp4', type: 'video', mimeType: 'video/mp4', storage: 'local' }]
    });
  }
  for (let i = 0; i < 16; i++) {
    const entry = catalog[(i * 7 + 1) % catalog.length];
    add('Story', String(i), users[(i * 7 + 1) % users.length]._id, {
      text: entry.title, expiresAt: new Date(+now + 86400000),
      media: [{ url: base + '/card-' + ((i * 7 + 1) % catalog.length) + '.svg', type: 'image', mimeType: 'image/svg+xml', storage: 'local' }]
    });
  }
  return { batch: BATCH, data };
}
module.exports = { BATCH, catalog, id, buildContent };
