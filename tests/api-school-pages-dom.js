'use strict';

// DOM smoke: every standalone page parses, exposes its primary screen roots,
// and school-curriculum.html exposes library-search as a live element.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const pages = {
  'school-index.html': ['dash-stats', 'dash-students'],
  'school-structure.html': ['structure-tree'],
  'school-teachers.html': ['teacher-grid', 'teacher-search'],
  'school-students.html': ['students-grid', 'student-form'],
  'school-curriculum.html': ['library-search', 'catalog-list', 'curriculum-screen'],
  'school-reader.html': ['reader-frame', 'reader-title'],
  'school-classroom.html': ['class-form', 'class-student', 'class-subject']
};

for (const [file, ids] of Object.entries(pages)) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  for (const id of ids) {
    assert.ok(doc.getElementById(id), `${file}: missing #${id}`);
  }
  // pages must not be blank bodies
  assert.ok((doc.body.textContent || '').replace(/\s+/g, ' ').trim().length > 40, `${file} body too empty`);
}

const curriculum = new JSDOM(fs.readFileSync(path.join(root, 'school-curriculum.html'), 'utf8'));
const search = curriculum.window.document.getElementById('library-search');
assert.ok(search, 'school-curriculum.html: missing screen element library-search');
assert.equal(search.getAttribute('placeholder') || '', 'بحث بالمناهج');

console.log('PASS: api-school-pages-dom (7 pages primary elements)');
