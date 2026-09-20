'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const file = path.resolve(__dirname, '../original-assets/school-canva/school-canva-update-20260920.html');
const bytes = fs.readFileSync(file);
const html = bytes.toString('utf8');

assert.equal(bytes.length, 62607, 'Canva school update byte count changed');
assert.equal(
  crypto.createHash('sha256').update(bytes).digest('hex'),
  '8f48c78b68d2143b5324a4a152137508d7235cb25f5f166d17de0b2e15f8a59a',
  'Canva school update SHA-256 changed'
);
for (const marker of [
  '<title>شنو منو مدرسة</title>',
  'id="structure-list"',
  'id="teacher-grid"',
  'id="catalog-list"',
  'id="library-search"',
  'id="class-view"',
  'id="exam-view"',
  'id="report-view"',
  'id="consent-view"',
  'id="settings-view"',
  'window.dataSdk.create',
  'window.dataSdk.update',
  'window.dataSdk.delete'
]) assert(html.includes(marker), `missing update marker: ${marker}`);

const canvaRoutes = fs.readFileSync(path.resolve(__dirname, '../server/src/routes/school-canva.routes.js'), 'utf8');
assert(canvaRoutes.includes('school-canva-update-20260920.html'), 'update export path is registered');
assert(canvaRoutes.includes("router.get('/update'"), 'update is served on /api/school-canva/update');
assert(canvaRoutes.includes('school-canva-original.html'), 'immutable original remains on /original');
const adapter = fs.readFileSync(path.resolve(__dirname, '../school-canva-adapter.js'), 'utf8');
assert(adapter.includes('function bootUpdatedCanva()'), 'new Canva school update must use the Shno Mano data bridge');
assert(adapter.includes("window.eval('init()')"), 'updated Canva lexical init must be restarted after installing the data bridge');
const loader = fs.readFileSync(path.resolve(__dirname, '../school-canva.html'), 'utf8');
assert(loader.includes('school-canva-adapter.js?v=20260920-update-2'), 'loader must cache-bust the updated data bridge');
assert(loader.includes('/api/school-canva/update'), 'loader fetches the update export');

console.log('PASS: school Canva update preserved exactly (62607 bytes)');
