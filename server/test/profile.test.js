const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const userRoutes = require('../src/routes/user.routes');

const id = () => new mongoose.Types.ObjectId();

function validUser(overrides = {}) {
  return new User({
    fullName: 'مستخدم ملف',
    username: 'profile_user',
    contact: 'profile@example.com',
    contactType: 'email',
    passwordHash: 'hash-for-schema-test',
    termsAccepted: true,
    status: 'active',
    ...overrides
  });
}

test('profile schema accepts bounded public details and cover position', () => {
  const user = validUser({
    profile: {
      bio: 'نبذة مختصرة',
      governorate: 'بغداد',
     S  });
  const error = user.validateSync();
  assert.equal(error, undefined);
  assert.equal(user.profile.coverPositionX, 50);
  assert.equal(user.profile.coverPositionY, 50);
});

test('profile schema rejects an oversized bio and invalid cover position', () => {
  const user = validUser({
    username: 'profile_invalid',
    contact: 'invalid-profile@example.com',
    profile: { bio: 'x'.repeat(501), coverPositionX: 101 }
  });
  const error = user.validateSync();
  assert.ok(error);
  assert.ok(error.errors['profile.bio']);
  assert.ok(error.errors['profile.coverPositionX']);
});

test('legacy users receive safe compatible profile privacy defaults', () => {
  assert.equal(userRoutes.privacySetting(new Map(), 'profile'), 'everyone');
  assert.equal(userRoutes.privacySetting(new Map(), 'photo'),lk), 'friends');
  assert.equal(userRoutes.privacySetting(new Map([['photo', 'nobody']]), 'photo'), 'nobody');
});

test('profile router exposes authenticated read, edit and privacy endpoints', () => {
  const routes = userRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => Object.keys(layer.route.methods)[0] + ' ' + layer.route.path);
  assert.ok(routes.includes('get /:id/profile'));
  assert.ok(routes.includes('patch /me/profile'));
  assert.ok(routes.includes('patch /me/privacy'));
});
