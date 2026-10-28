'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');

test('real application operations run on MySQL without a MongoDB connection', {
  skip: process.env.MYSQL_INTEGRATION_TEST !== '1', timeout: 240000
}, async t => {
  assert.equal(process.env.MYSQL_DATABASE, 'shinomino_runtime_test');
  assert.ok(['127.0.0.1', 'localhost'].includes(process.env.MYSQL_HOST));
  Object.assign(process.env, { DB_CLIENT: 'mysql', MYSQL_RUNTIME_EXPERIMENTAL: 'true', NODE_ENV: 'test', OTP_DELIVERY_MODE: 'test', REGISTRATION_OTP_REQUIRED: 'true', JWT_SECRET: 'isolated-runtime-test-jwt-secret', OTP_PEPPER: 'isolated-runtime-test-otp-pepper' });
  const mysql = require('mysql2/promise');
  const admin = await mysql.createConnection({ host: process.env.MYSQL_HOST, user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, port: Number(process.env.MYSQL_PORT || 3306) });
  // An existing destination deliberately fails; this test never drops data.
  try { await admin.query('CREATE DATABASE shinomino_runtime_test CHARACTER SET utf8mb4 COLLATE utf8mb4_bin'); } finally { await admin.end(); }
  const mongoose = require('mongoose');
  mongoose.connect = () => { throw new Error('MongoDB fallback is forbidden in this test'); };
  const { buildSchema, applySchema } = require('../src/mysql/migrate');
  const { openConnection } = require('../src/mysql/connection');
  const schema = buildSchema();
  const setup = await openConnection();
  try { await applySchema(setup.connection, schema); } finally { setup.connection.release(); await setup.pool.end(); }
  const runtime = require('../src/mysql/runtime');
  await require('../src/config/db')();
  const User = require('../src/models/User');
  const FriendRequest = require('../src/models/FriendRequest');
  const Conversation = require('../src/models/Conversation');
  const Message = require('../src/models/Message');
  const Post = require('../src/models/Post');
  const Teacher = require('../src/models/SchoolTeacher');
  const Student = require('../src/models/SchoolStudent');
  const Classroom = require('../src/models/SchoolClassroom');
  const GameRoom = require('../src/models/GameRoom');
  const express = require('express');
  const app = express(); app.use(express.json());
  app.use('/auth', require('../src/routes/auth.routes'));
  app.use('/conversations', require('../src/routes/conversations.routes'));
  const { requireAuth, requireRole } = require('../src/middleware/auth');
  app.get('/private', requireAuth, (req, res) => res.json({ id: req.user._id, username: req.user.username }));
  app.get('/admin', requireAuth, requireRole('developer'), (_req, res) => res.json({ ok: true }));
  app.use((error, _req, res, _next) => { console.error(error); res.status(500).json({ error: error.message }); });
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const io = require('../src/socket').attachSocket(server); app.set('io', io);
  require('../src/socket-school').attachSchoolSocket(io);
  const base = 'http://127.0.0.1:' + server.address().port;
  async function request(path, body, token, method = body ? 'POST' : 'GET') {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  }
  const password = 'runtime-password-123';
  let first, second, token, secondToken;
  try {
    await t.test('signup, OTP, passwords, duplicate accounts and role checks use real HTTP routes', async () => {
      for (let i = 1; i <= 2; i++) {
        const signup = await request('/auth/signup', { fullName: 'محمد اختبار ' + i, username: 'runtime' + i, phone: '0771234500' + i, email: 'runtime' + i + '@example.test', password, confirmPassword: password, termsAccepted: true, privacyAccepted: true });
        assert.equal(signup.status, 201, JSON.stringify(signup));
        assert.equal((await request('/auth/signin', { identifier: 'runtime' + i, password })).status, 403);
        const verify = await request('/auth/verify-registration', { verificationToken: signup.body.verificationToken, code: signup.body.testCode });
        assert.equal(verify.status, 200, JSON.stringify(verify));
      }
      const signIn = await request('/auth/signin', { identifier: 'runtime1', password });
      assert.equal(signIn.status, 200, JSON.stringify(signIn)); token = signIn.body.token;
      assert.ok(!JSON.stringify(signIn.body).includes('passwordHash'));
      secondToken = (await request('/auth/signin', { identifier: 'runtime2', password })).body.token;
      assert.equal((await request('/auth/signin', { identifier: 'runtime1', password: 'incorrect' })).status, 401);
      assert.equal((await request('/private')).status, 401);
      assert.equal((await request('/private', null, token)).status, 200);
      assert.equal((await request('/admin', null, token)).status, 403);
      first = await User.findOne({ username: 'runtime1' }); second = await User.findOne({ username: 'runtime2' });
      assert.notEqual(first.passwordHash, password);
      assert.equal(first.contactVerified, true);
      await assert.rejects(User.create({ fullName: 'Duplicate', username: first.username, contact: 'duplicate@example.test', contactType: 'email', passwordHash: 'unused', termsAccepted: true }), e => e.code === 11000);
      assert.equal(mongoose.connection.readyState, 0);
      assert.equal((await User.find({ username: /runtime/iu })).length, 2);
      assert.equal((await User.find({ 'privacy.messaging': 'friends' })).length, 2);
    });
    assert.ok(first && second, 'Account setup must succeed before other scenarios');
    await t.test('projections, map defaults, validation, and stale saves preserve account data', async () => {
      const partial = await User.findById(first._id).select('displayName');
      assert.equal(partial.passwordHash, undefined);
      partial.displayName = 'محمد'; await partial.save();
      assert.equal((await User.findById(first._id)).phone, '07712345001');
      const a = await User.findById(first._id), b = await User.findById(first._id);
      a.profile.bio = 'الأول'; await a.save();
      b.profile.bio = 'قديم'; await assert.rejects(b.save(), e => e.name === 'VersionError');
      const saved = await User.findById(first._id).lean();
      assert.equal(saved.profile.bio, 'الأول');
      assert.equal((await User.findById(first._id)).privacy.get('messaging'), 'friends');
      const independentA = await User.findById(first._id), independentB = await User.findById(first._id);
      independentA.profile.city = 'بغداد'; await independentA.save();
      independentB.profile.profession = 'محاسب'; await independentB.save();
      assert.equal((await User.findById(first._id)).profile.city, 'بغداد');
      assert.deepEqual(Object.keys(await User.findById(first._id).select('_id').lean()), ['_id']);
      await assert.rejects(User.updateOne({ _id: first._id }, { $set: { phone: 'bad' } }), /validation/i);
    });
    await t.test('friendship hooks, population and real message routes preserve authorization', async () => {
      const friendship = await FriendRequest.create({ sender: first._id, receiver: second._id, status: 'accepted' });
      assert.equal(friendship.pairKey, [String(first._id), String(second._id)].sort().join(':'));
      await assert.rejects(FriendRequest.create({ sender: second._id, receiver: first._id }), e => e.code === 11000);
      const created = await request('/conversations/' + second._id, {}, token);
      assert.equal(created.status, 201, JSON.stringify(created));
      const id = created.body.conversation.id;
      const outsider = await User.create({ fullName: 'خارج المحادثة', username: 'outsider', contact: 'outsider@example.test', contactType: 'email', passwordHash: 'unused', termsAccepted: true, status: 'active' });
      const outsiderToken = require('jsonwebtoken').sign({ userId: outsider._id, role: 'user' }, process.env.JWT_SECRET);
      assert.equal((await request('/conversations/' + id + '/messages', null, outsiderToken)).status, 404);
      assert.equal((await request('/conversations/' + second._id, {}, token)).body.conversation.id, id);
      const sent = await request('/conversations/' + id + '/messages', { text: 'رسالة محفوظة في MySQL' }, token);
      assert.equal(sent.status, 201, JSON.stringify(sent));
      const messages = await request('/conversations/' + id + '/messages', null, secondToken);
      assert.equal(messages.status, 200, JSON.stringify(messages)); assert.equal(messages.body.messages.length, 1);
      assert.equal((await request('/conversations/' + id + '/read', {}, secondToken, 'PATCH')).status, 200);
      assert.ok((await Message.findOne({ conversation: id })).readAt instanceof Date);
      const populated = await Conversation.findById(id).populate('participants', 'username fullName');
      assert.equal(populated.participants[0].username, first.username);
      assert.equal(populated.participants[0].passwordHash, undefined);
      const summary = await request('/conversations', null, token);
      assert.equal(summary.status, 200, JSON.stringify(summary));
      assert.equal(summary.body.conversations[0].lastMessage.text, 'رسالة محفوظة في MySQL');
    });
    await t.test('nested school relationships and ordered attendance survive save/load', async () => {
      const teacher = await Teacher.create({ user: first._id, name: 'المعلم', subjects: ['رياضيات'], stages: ['ابتدائي'], grades: ['الأول'] });
      const student = await Student.create({ guardian: second._id, name: 'الطالب', stage: 'ابتدائي', grade: 'الأول', assignedTeachers: [{ teacher: teacher._id, subject: 'رياضيات' }] });
      const loaded = await Student.findById(student._id).populate('assignedTeachers.teacher', 'name subjects');
      assert.equal(loaded.assignedTeachers[0].teacher.name, 'المعلم');
      const classroom = await Classroom.create({ code: 'MYSQL001', teacher: first._id, teacherName: 'المعلم', stage: 'ابتدائي', grade: 'الأول', subject: 'رياضيات', participants: [{ user: second._id, name: 'الطالب', role: 'student', student: student._id, attendance: [{ joinedAt: new Date() }] }] });
      const active = await Classroom.findOne({ participants: { $elemMatch: { user: second._id, role: 'student', leftAt: null } } });
      assert.equal(String(active._id), String(classroom._id));
      active.participants[0].attendance.push({ joinedAt: new Date(), leftAt: new Date() }); await active.save();
      const stored = await Classroom.findById(classroom._id).lean();
      assert.equal(stored.participants[0].attendance.length, 2);
      assert.ok(stored.participants[0].attendance[0].joinedAt instanceof Date);
      assert.equal((await Teacher.find({ subjects: { $in: ['رياضيات'] } })).length, 1);
    });
    await t.test('atomic increments, list updates, pagination and transaction rollback work', async () => {
      const Contact = require('../src/models/PhoneContact');
      const operation = { updateOne: { filter: { owner: first._id, phone: '07788880001' }, update: { $set: { name: 'جهة اتصال' } }, upsert: true } };
      assert.equal((await Contact.bulkWrite([operation])).upsertedCount, 1);
      assert.equal((await Contact.bulkWrite([operation])).matchedCount, 1);
      assert.equal(await Contact.countDocuments({ owner: first._id }), 1);
      assert.equal(await Contact.countDocuments({ owner: second._id }), 0);
      const contact = await Contact.findOneAndDelete({ owner: first._id, phone: '07788880001' });
      assert.equal(contact.name, 'جهة اتصال');
      assert.equal(await Contact.countDocuments({ owner: first._id }), 0);
      const post = await Post.create({ author: first._id, text: 'منشور', likes: [first._id] });
      await Promise.all(Array.from({ length: 8 }, () => Post.updateOne({ _id: post._id }, { $inc: { sharesCount: 1 } })));
      assert.equal((await Post.findById(post._id)).sharesCount, 8);
      await Post.updateOne({ _id: post._id }, { $addToSet: { likes: second._id } });
      await Post.updateOne({ _id: post._id }, { $pull: { likes: first._id } });
      assert.deepEqual((await Post.findById(post._id).lean()).likes.map(String), [String(second._id)]);
      assert.equal((await Post.find({ author: first._id }).sort({ createdAt: -1 }).skip(0).limit(1)).length, 1);
      await assert.rejects(Post.create({ author: first._id, text: 'rollback-marker', likes: [new mongoose.Types.ObjectId()] }), e => e.code === 'ER_NO_REFERENCED_ROW_2');
      assert.equal(await Post.countDocuments({ text: 'rollback-marker' }), 0);
    });
    await t.test('authenticated Socket.IO presence and private typing use MySQL accounts and membership', async () => {
      const client = require('socket.io-client').io;
      const event = (socket, name) => new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Socket event timed out: ' + name)), 5000);
        socket.once(name, value => { clearTimeout(timeout); resolve(value); });
      });
      const a = client(base, { autoConnect: false, auth: { token }, transports: ['websocket'], reconnection: false });
      const b = client(base, { autoConnect: false, auth: { token: secondToken }, transports: ['websocket'], reconnection: false });
      const invalid = client(base, { autoConnect: false, auth: { token: 'invalid' }, transports: ['websocket'], reconnection: false });
      try {
        const rejected = event(invalid, 'connect_error'); invalid.connect();
        assert.match((await rejected).message, /unauthorized/);
        const aReady = event(a, 'connect'), bReady = event(b, 'connect'); a.connect(); b.connect();
        await Promise.all([aReady, bReady]);
        const conversation = await Conversation.findOne({ participants: { $all: [first._id, second._id] } });
        const typing = event(b, 'private:typing'); a.emit('private:typing', { conversationId: String(conversation._id), active: true });
        assert.equal((await typing).active, true);
        const heartbeat = await new Promise(resolve => a.emit('school:heartbeat', {}, resolve));
        assert.equal(heartbeat.ok, true);
      } finally { a.disconnect(); b.disconnect(); invalid.disconnect(); }
      for (let i = 0; i < 30; i++) {
        if (!(await User.findById(first._id)).profile.online && !(await User.findById(second._id)).profile.online) break;
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      assert.equal((await User.findById(first._id)).profile.online, false);
    });
    await t.test('game state JSON, maps and mixed arrays persist across runtime restart', async () => {
      const room = await GameRoom.create({ owner: first._id, players: [first._id, second._id], gameState: { status: 'active', board: [{ a: 1, b: 2 }], engineState: { seed: 7, ready: true } } });
      room.gameState.scores.set(String(first._id), 3); await room.save();
      await runtime.stop(); await runtime.start();
      const reloaded = await GameRoom.findById(room._id);
      assert.equal(reloaded.gameState.engineState.seed, 7);
      assert.equal(reloaded.gameState.scores.get(String(first._id)), 3);
      assert.deepEqual(reloaded.gameState.board[0], { a: 1, b: 2 });
      assert.ok(await GameRoom.findOne({ 'gameState.engineState.seed': 7, 'gameState.engineState.ready': true }));
      assert.equal(await runtime.countOptional(['missing_optional_table']), 0);
      assert.equal(mongoose.connection.readyState, 0);
    });
  } finally {
    await new Promise(resolve => io.close(resolve));
    await runtime.stop();
  }
});
