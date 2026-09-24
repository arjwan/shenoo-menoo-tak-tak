'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const User = require('../src/models/User');
const Teacher = require('../src/models/SchoolTeacher');
const Student = require('../src/models/SchoolStudent');
const Report = require('../src/models/SchoolStudentReport');
const Workspace = require('../src/routes/school-teacher-workspace.routes');
const Management = require('../src/routes/school-management.routes');
const Assignments = require('../src/routes/school-assignment.routes');
process.env.JWT_SECRET = 'phase8-teacher-test-secret';
let mongo, server, base;
async function user(username, role = 'user') { return User.create({ fullName: username, username, contact: username + '@test.local', contactType: 'email', passwordHash: 'dummy-hash', termsAccepted: true, role, status: 'active' }); }
function token(account) { return jwt.sign({ userId: String(account._id) }, process.env.JWT_SECRET); }
async function call(method, route, account, body) {
  const res = await fetch(base + route, { method, headers: { Authorization: 'Bearer ' + token(account), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json() };
}
test('Phase 8: teacher access is limited to assigned students and subjects; administration stays separate', async (t) => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const app = express(); app.use(express.json());
  app.use('/api/school/teacher', Workspace);
  app.use('/api/school/management', Management);
  app.use('/api/school/assignments', Assignments);
  app.use((err, req, res, next) => res.status(err.status || 500).json({ ok: false, message: err.message }));
  server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); await mongoose.disconnect(); await mongo.stop(); });
  const [a, b, admin, guardian] = await Promise.all([user('teacher_a'), user('teacher_b'), user('admin_a', 'admin'), user('guardian_a')]);
  const [ta, tb] = await Promise.all([Teacher.create({ user: a._id, name: 'معلم أ', subjects: ['رياضيات'], stages: ['متوسط'], grades: ['الأول متوسط'] }), Teacher.create({ user: b._id, name: 'معلم ب', subjects: ['علوم'], stages: ['متوسط'], grades: ['الأول متوسط'] })]);
  const [mine, other] = await Promise.all([Student.create({ guardian: guardian._id, name: 'طالب أ', stage: 'متوسط', grade: 'الأول متوسط', assignedTeachers: [{ teacher: ta._id, subject: 'رياضيات' }] }), Student.create({ guardian: guardian._id, name: 'طالب ب', stage: 'متوسط', grade: 'الأول متوسط', assignedTeachers: [{ teacher: tb._id, subject: 'علوم' }] })]);
  let r = await call('GET', '/api/school/teacher/overview', a); assert.equal(r.status, 200); assert.deepEqual(r.data.students.map((s) => String(s._id)), [String(mine._id)]);
  assert.equal((await call('GET', '/api/school/teacher/overview', admin)).status, 403);
  assert.equal((await call('GET', '/api/school/teacher/students/' + other._id + '/record', a)).status, 403);
  assert.equal((await call('POST', '/api/school/teacher/students/' + other._id + '/attendance', a, { status: 'present' })).status, 403);
  assert.equal((await call('POST', '/api/school/teacher/students/' + mine._id + '/grades', a, { subject: 'علوم', title: 'اختبار', score: 10 })).status, 403);
  assert.equal((await call('POST', '/api/school/teacher/students/' + mine._id + '/grades', a, { subject: 'رياضيات', title: 'اختبار', score: 10 })).status, 201);
  assert.equal((await call('POST', '/api/school/teacher/students/' + mine._id + '/attendance', a, { status: 'present' })).status, 201);
  assert.equal((await call('POST', '/api/school/teacher/students/' + mine._id + '/reports', a, { subject: 'رياضيات', level: 'good', recommendations: 'مراجعة' })).status, 201);
  assert.equal(await Report.countDocuments({ teacher: ta._id }), 1);
  const dueAt = new Date(Date.now() + 86400000).toISOString();
  const assignment = { stage: 'متوسط', grade: 'الأول متوسط', subject: 'رياضيات', title: 'واجب ١', dueAt, assignedStudents: [other._id] };
  assert.equal((await call('POST', '/api/school/assignments', a, assignment)).status, 403);
  assignment.assignedStudents = [mine._id]; r = await call('POST', '/api/school/assignments', a, assignment); assert.equal(r.status, 201);
  assert.equal((await call('POST', '/api/school/management/teachers', a, { name: 'غير مصرح' })).status, 403);
  assert.equal((await call('POST', '/api/school/management/students', a, { name: 'غير مصرح' })).status, 403);
});
