'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Sumer School ships independent responsive role pages', () => {
  for (const file of ['index.html', 'dashboard.html', 'academics.html', 'people.html', 'communication.html', 'management.html']) {
    const html = read('sumer-school/' + file);
    assert.match(html, /dir="rtl"/);
    assert.match(html, /styles\.css/);
  }
  const login = read('sumer-school/index.html');
  assert.match(login, /data-tab="student"/);
  assert.match(login, /data-tab="teacher"/);
  assert.doesNotMatch(login, /data-tab="admin"|schoolRole" value="admin"/);
  assert.match(read('sumer-school/styles.css'), /@media\(max-width:600px\)/);
});

test('Sumer School client uses authenticated real APIs and existing classroom tools', () => {
  const app = read('sumer-school/app.js');
  assert.match(app, /\/api\/school\/portal\/bootstrap/);
  assert.match(app, /\/school-live\.html/);
  assert.match(app, /\/school-virtual-classroom\.html/);
  assert.match(app, /\/school-curriculum\.html/);
  assert.match(app, /staff-requests/);
  assert.match(app, /teacher-avatar/);
  assert.doesNotMatch(app, /demo|lorem|بيان الرافدين|رائد دجلة/i);
});

test('virtual teachers expose the three approved personas with visible AI labels', () => {
  const profiles = read('server/src/models/VirtualTeacherProfile.js');
  for (const name of ['أ. سارة الذكية', 'أ. ليلى الحكيمة', 'أ. مريم النور']) assert.match(profiles, new RegExp(name.replace('.', '\\.')));
  assert.match(profiles, /معلم افتراضي \/ AI/);
  assert.equal((profiles.match(/profileId: '/g) || []).length, 3);
});

test('school service worker never caches API, messages, grades, attendance, or records', () => {
  const sw = read('sumer-school/school-sw.js');
  for (const marker of ['/api/', 'messages', 'record', 'grades', 'attendance']) assert.match(sw, new RegExp(marker.replaceAll('/', '\\/')));
  assert.match(sw, /uploads\/school-curriculum/);
  assert.match(sw, /request\.method!==['"]GET['"]/);
});

test('server mounts namespaced role, management and virtual-classroom routes', () => {
  const server = read('server/src/server.js');
  assert.match(server, /\/api\/school\/portal/);
  assert.match(server, /\/api\/school\/manage/);
  assert.match(server, /\/api\/school\/virtual/);
  const auth = read('server/src/routes/auth.routes.js');
  assert.match(auth, /\['student', 'teacher'\]\.includes/);
  assert.doesNotMatch(auth, /\['student', 'teacher', 'admin'\]/);
});

test('Oracle workflow preserves the nested PWA and its service-worker scope', () => {
  const workflow = read('.github/workflows/deploy-oracle.yml');
  assert.match(workflow, /webroot\/sumer-school/);
  assert.match(workflow, /find sumer-school -type d/);
  assert.match(workflow, /find sumer-school -type f/);
});
