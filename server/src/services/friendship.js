const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const QR_TTL = '10m';

function canonicalPair(first, second) {
  return [String(first), String(second)].sort().join(':');
}

function createFriendCode() {
  return crypto.randomBytes(18).toString('base64url');
}

function createFriendQrToken(friendCode) {
  if (!friendCode) throw new Error('Friend code is required');
  return jwt.sign({ friendCode: String(friendCode), scope: 'friend-qr' }, process.env.JWT_SECRET, { expiresIn: QR_TTL });
}

function readFriendQrToken(token) {
  const payload = jwt.verify(String(token || ''), process.env.JWT_SECRET);
  if (payload.scope !== 'friend-qr' || !/^[A-Za-z0-9_-]{20,40}$/.test(String(payload.friendCode || ''))) {
    throw new Error('Invalid friend QR token');
  }
  return payload;
}

function relationDecision(relation, actorId, targetId) {
  if (!relation) return { action: 'create', status: 'pending', outcome: 'request_sent' };
  if (relation.status === 'accepted') return { action: 'none', status: 'accepted', outcome: 'already_friends' };
  if (relation.status === 'pending') {
    if (String(relation.sender) === String(actorId)) {
      return { action: 'none', status: 'pending', outcome: 'already_pending' };
    }
    return { action: 'accept', status: 'accepted', outcome: 'mutual_accept' };
  }
  return { action: 'reset', status: 'pending', outcome: 'request_sent' };
}

function outcomeMessage(outcome) {
  return {
    request_sent: 'تم إرسال طلب الصداقة',
    already_pending: 'طلب الصداقة مرسل مسبقاً',
    mutual_accept: 'تم قبول الطلب المتبادل وأصبحتما صديقين',
    already_friends: 'أنتما صديقان بالفعل'
  }[outcome] || 'تم تحديث الصداقة';
}

module.exports = {
  canonicalPair,
  createFriendCode,
  createFriendQrToken,
  outcomeMessage,
  readFriendQrToken,
  relationDecision
};
