const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'friendship-test-secret-long-enough-2026';

const {
  canonicalPair,
  createFriendCode,
  createFriendQrToken,
  readFriendQrToken,
  relationDecision
} = require('../src/services/friendship');

test('friend pair key is identical in both directions', () => {
  assert.equal(canonicalPair('user-b', 'user-a'), canonicalPair('user-a', 'user-b'));
  assert.equal(canonicalPair('user-b', 'user-a'), 'user-a:user-b');
});

test('friend QR contains only an opaque friend code and restricted scope', () => {
  const friendCode = createFriendCode();
  assert.match(friendCode, /^[A-Za-z0-9_-]{20,40}$/);
  const token = createFriendQrToken(friendCode);
  const decoded = jwt.decode(token);
  assert.equal(decoded.scope, 'friend-qr');
  assert.equal(decoded.friendCode, friendCode);
  assert.equal(Object.hasOwn(decoded, 'userId'), false);
  assert.equal(readFriendQrToken(token).friendCode, friendCode);
});

test('same-direction duplicate remains one pending request', () => {
  const relation = { sender: 'a', receiver: 'b', status: 'pending' };
  assert.deepEqual(relationDecision(relation, 'a', 'b'), {
    action: 'none', status: 'pending', outcome: 'already_pending'
  });
});

test('reverse pending request becomes accepted instead of duplicating', () => {
  const relation = { sender: 'a', receiver: 'b', status: 'pending' };
  assert.deepEqual(relationDecision(relation, 'b', 'a'), {
    action: 'accept', status: 'accepted', outcome: 'mutual_accept'
  });
});

test('cancelled or rejected relation can be requested again', () => {
  assert.deepEqual(relationDecision({ sender: 'a', receiver: 'b', status: 'cancelled' }, 'a', 'b'), {
    action: 'reset', status: 'pending', outcome: 'request_sent'
  });
});
