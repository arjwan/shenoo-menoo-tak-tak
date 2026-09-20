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
  'id="class-view"',
  'id="exam-view"',
  'id="report-view"',
  'id="consent-view"',
  'id="settings-view"',
  'window.dataSdk.create',
  'window.dataSdk.update',
  'window.dataSdk.delete'
]) assert(html.includes(marker), `missing update marker: ${marker}`);

console.log('PASS: school Canva update preserved exactly (62607 bytes)');
