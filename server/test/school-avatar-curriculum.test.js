'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const Session = require('../src/models/VirtualClassroomSession');
const Knowledge = require('../src/models/SchoolKnowledgeSource');
const curriculumDb = require('../src/config/curriculum-db');
const avatarRoutes = require('../src/routes/school-avatar.routes');

const code = 'ABC234';
const studentId = '507f1f77bcf86cd799439011';
const strangerId = '507f1f77bcf86cd799439012';
const hostId = '507f1f77bcf86cd799439013';
const original = {
  userFind: User.findById,
  sessionFind: Session.findOne,
  connection: curriculumDb.getCurriculumConnection,
  secret: process.env.JWT_SECRET,
  enabled: process.env.SCHOOL_AVATAR_ENABLED,
  provider: process.env.SCHOOL_AVATAR_PROVIDER,
  apiKey: process.env.SCHOOL_AVATAR_API_KEY
};
let server;
let base;
let sourceLookup;
let session;
let source;

function fakeQuery(value) { return { lean: async () => value }; }
function sign(id) { return jwt.sign({ userId: id, role: 'user' }, process.env.JWT_SECRET); }
async function call(method, path, token, body) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: response.status, data: await response.json() };
}

test.before(async () => {
  process.env.JWT_SECRET = 'test-only-avatar-secret';
  process.env.SCHOOL_AVATAR_ENABLED = 'false';
  delete process.env.SCHOOL_AVATAR_PROVIDER;
  delete process.env.SCHOOL_AVATAR_API_KEY;
  User.findById = async id => ({
    _id: String(id), role: 'user', status: 'active'
  });
  session = {
    code, status: 'active', hostUser: hostId,
    participants: [{ user: studentId, leftAt: null }],
    stage: 'ابتدائي', grade: 'السادس الابتدائي',
    subject: 'الرياضيات', lesson: 'الكسور',
    sourceTitle: 'كتاب الرياضيات', sourcePage: '15',
    virtualTeacher: { name: 'أ. سارة', dialect: 'ar-iraqi' }
  };
  source = {
    _id: '507f1f77bcf86cd799439014',
    title: 'كتاب الرياضيات', page: '15',
    content: 'محتوى درس الكسور الموثق',
    verified: true
  };
  Session.findOne = () => fakeQuery(session);
  sourceLookup = {
    find() {
      return {
        select() { return this; },
        limit() { return this; },
        async lean() { return [source]; }
      };
    }
  };
  // Replace the connection before calling the context service: the module
  // destructures getCurriculumConnection, so patch its export and reload it.
  curriculumDb.getCurriculumConnection = async () => ({
    models: { SchoolKnowledgeSource: sourceLookup }
  });
  delete require.cache[require.resolve('../src/services/school-curriculum-context')];
  delete require.cache[require.resolve('../src/routes/school-avatar.routes')];
  const router = require('../src/routes/school-avatar.routes');
  const app = express();
  app.use(express.json());
  app.use('/api/school/avatar', router);
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
});

test.after(async () => {
  await new Promise(resolve => server?.close(resolve));
  User.findById = original.userFind;
  Session.findOne = original.sessionFind;
  curriculumDb.getCurriculumConnection = original.connection;
  for (const [key, value] of [
    ['JWT_SECRET', original.secret],
    ['SCHOOL_AVATAR_ENABLED', original.enabled],
    ['SCHOOL_AVATAR_PROVIDER', original.provider],
    ['SCHOOL_AVATAR_API_KEY', original.apiKey]
  ]) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('401: missing authentication', async () => {
  const res = await call('GET', '/api/school/avatar/context?sessionCode=' + code);
  assert.equal(res.status, 401);
});
test('403: authenticated non-participant', async () => {
  const res = await call('GET', '/api/school/avatar/context?sessionCode=' + code, sign(strangerId));
  assert.equal(res.status, 403);
  assert.equal(res.data.code, 'UNAUTHORIZED_CLASSROOM_ACCESS');
});
test('200: authorized student receives verified curriculum (isolated fixture)', async () => {
  const res = await call('GET', '/api/school/avatar/context?sessionCode=' + code, sign(studentId));
  assert.equal(res.status, 200);
  assert.equal(res.data.data.curriculum.verifiedContent, source.content);
  assert.equal(res.data.data.sessionCode, code);
});
test('503: disabled avatar does not issue fake token', async () => {
  const res = await call('POST', '/api/school/avatar/session', sign(studentId), { sessionCode: code });
  assert.equal(res.status, 503);
  assert.equal(res.data.code, 'AVATAR_SERVICE_UNAVAILABLE');
  assert.equal(res.data.webrtcToken, undefined);
});
test('403: student who left classroom is denied', async () => {
  session.participants[0].leftAt = new Date();
  try {
    const res = await call('GET', '/api/school/avatar/context?sessionCode=' + code, sign(studentId));
    assert.equal(res.status, 403);
  } finally { session.participants[0].leftAt = null; }
});
test('404: unverified source is never served', async () => {
  const saved = sourceLookup.find;
  sourceLookup.find = () => ({
    select() { return this; },
    limit() { return this; },
    async lean() { return []; }
  });
  try {
    const res = await call('GET', '/api/school/avatar/context?sessionCode=' + code, sign(studentId));
    assert.equal(res.status, 404);
    assert.equal(res.data.code, 'VERIFIED_CURRICULUM_SOURCE_NOT_FOUND');
  } finally { sourceLookup.find = saved; }
});
