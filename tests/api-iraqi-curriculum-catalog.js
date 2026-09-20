'use strict';
const assert = require('node:assert/strict');
const catalog = require('../server/src/data/iraqi-curriculum-catalog');

assert.match(catalog.version, /^\d{4}\.\d{2}\.\d{2}$/);
assert(catalog.items.length >= 100, 'complete catalogue must cover at least 100 grade/subject books');
for (const stage of ['ابتدائي', 'متوسط', 'إعدادي']) assert(catalog.items.some(x => x.stage === stage));
for (const item of catalog.items) {
  assert(item.id && item.title && item.stage && item.grade && item.subject);
  assert.equal(item.sourceType, 'official_textbook');
}
const requiredGrades = ['الأول ابتدائي', 'السادس ابتدائي', 'الأول متوسط', 'الثالث متوسط', 'الرابع العلمي', 'الرابع الأدبي', 'السادس العلمي', 'السادس الأدبي'];
for (const grade of requiredGrades) assert(catalog.items.some(x => x.grade === grade), `missing ${grade}`);
assert.equal(new Set(catalog.items.map(x => x.id)).size, catalog.items.length, 'catalogue ids are unique');
console.log(`IRAQI CURRICULUM CATALOG PASS (${catalog.items.length} books)`);
