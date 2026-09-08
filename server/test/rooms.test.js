const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Group = require('../src/models/Group');
const GroupMessage = require('../src/models/GroupMessage');
const GroupReport = require('../src/models/GroupReport');

const userId = () => new mongoose.Types.ObjectId();

test('room defaults are safe and bounded', () => {
  const owner = userId();
  const room = new Group({ name: 'غرفة اختبار', owner, members: [owner], admins: [owner] });
  assert.equal(room.privacy, 'public');
  assert.equal(room.allowMemberVideo, false);
  assert.equal(room.maxSpeakers, 8);
  assert.equal(room.isLocked, false);
  assert.equal(room.validateSync(), undefined);
});

test('speaker limit rejects values outside 2..24', () => {
  const room = new Group({ name: 'غرفة اختبار', owner: userId(), maxSpeakers: 25 });
  assert.ok(room.validateSync()?.errors.maxSpeakers);
});

test('room message can contain an attachment without text', () => {
  const message = new GroupMessage({
    group: userId(), sender: userId(),
    attachment: { url: '/uploads/test.webp', type: 'image', mimeType: 'image/webp', size: 12 }
  });
  assert.equal(message.validateSync(), undefined);
});

test('room report requires a reason', () => {
  const report = new GroupReport({ group: userId(), reporter: userId() });
  assert.ok(report.validateSync()?.errors.reason);
});
