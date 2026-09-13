const express = require('express');
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const { requireAuth } = require('../middleware/auth');
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const {
  canonicalPair,
  createFriendCode,
  createFriendQrToken,
  outcomeMessage,
  readFriendQrToken,
  relationDecision
} = require('../services/friendship');

const router = express.Router();
router.use(requireAuth);

const view = (user) => ({
  id: user._id,
  username: user.username,
  fullName: user.displayName || user.fullName,
  bio: user.profile?.bio || '',
  avatarUrl: user.profile?.avatarUrl || '',
  online: Boolean(user.profile?.online),
  status: user.status
});
const blocked = (first, second) =>
  (first.blockedUsers || []).some((id) => String(id) === String(second._id)) ||
  (second.blockedUsers || []).some((id) => String(id) === String(first._id));
async function friends(first, second) {
  return Boolean(await FriendRequest.exists({
    $or: [{ sender: first, receiver: second }, { sender: second, receiver: first }],
    status: 'accepted'
  }));
}
function privacyValue(user, key) {
  return user.privacy instanceof Map ? user.privacy.get(key) : user.privacy?.[key];
}
async function ensureFriendCode(user) {
  if (user.friendCode) return user.friendCode;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    user.friendCode = createFriendCode();
    try {
      await user.save();
      return user.friendCode;
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }
  throw new Error('Could not allocate friend code');
}
async function findRelation(first, second) {
  return FriendRequest.findOne({
    $or: [{ sender: first, receiver: second }, { sender: second, receiver: first }]
  });
}
async function requestFriend(actor, target, source = 'direct') {
  if (String(actor._id) === String(target._id)) {
    return { httpStatus: 400, ok: false, message: 'لا يمكنك إضافة نفسك' };
  }
  if (blocked(actor, target)) {
    return { httpStatus: 403, ok: false, message: 'لا يمكن التواصل مع هذا المستخدم' };
  }
  const friendRequestPrivacy = privacyValue(target, 'friendRequests');
  if (friendRequestPrivacy && friendRequestPrivacy !== 'everyone') {
    return { httpStatus: 403, ok: false, message: 'هذا المستخدم لا يستقبل طلبات صداقة حالياً' };
  }

  let relation = await findRelation(actor._id, target._id);
  const decision = relationDecision(relation, actor._id, target._id);
  if (decision.action === 'none') {
    return {
      httpStatus: 200,
      ok: true,
      status: decision.status,
      outcome: decision.outcome,
      requestId: relation._id,
      message: outcomeMessage(decision.outcome)
    };
  }

  if (!relation) relation = new FriendRequest();
  if (decision.action === 'create' || decision.action === 'reset') {
    relation.sender = actor._id;
    relation.receiver = target._id;
    relation.status = 'pending';
  } else {
    relation.status = 'accepted';
  }
  relation.pairKey = canonicalPair(actor._id, target._id);
  relation.source = source;
  try {
    await relation.save();
  } catch (error) {
    if (error?.code !== 11000) throw error;
    relation = await FriendRequest.findOne({ pairKey: canonicalPair(actor._id, target._id) });
    if (!relation) throw error;
    const raced = relationDecision(relation, actor._id, target._id);
    return {
      httpStatus: 200,
      ok: true,
      status: raced.status,
      outcome: raced.outcome,
      requestId: relation._id,
      message: outcomeMessage(raced.outcome)
    };
  }
  return {
    httpStatus: decision.action === 'create' ? 201 : 200,
    ok: true,
    status: relation.status,
    outcome: decision.outcome,
    requestId: relation._id,
    message: outcomeMessage(decision.outcome)
  };
}

router.get('/', async (req, res) => {
  try {
    const rows = await FriendRequest.find({
      $or: [{ sender: req.user._id }, { receiver: req.user._id }],
      status: 'accepted'
    }).populate('sender receiver', 'username fullName displayName profile status');
    const seen = new Set();
    const users = [];
    for (const row of rows) {
      const user = String(row.sender._id) === String(req.user._id) ? row.receiver : row.sender;
      if (!user || seen.has(String(user._id))) continue;
      seen.add(String(user._id));
      users.push(view(user));
    }
    return res.json({ ok: true, friends: users, users });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'تعذر تحميل الأصدقاء' });
  }
});

router.get('/requests', async (req, res) => {
  try {
    const incoming = req.query.type !== 'sent';
    const query = incoming
      ? { receiver: req.user._id, status: 'pending' }
      : { sender: req.user._id, status: 'pending' };
    const rows = await FriendRequest.find(query)
      .populate('sender receiver', 'username fullName displayName profile status')
      .sort({ createdAt: -1 });
    return res.json({
      ok: true,
      direction: incoming ? 'incoming' : 'outgoing',
      requests: rows.map((row) => ({
        id: row._id,
        user: view(incoming ? row.sender : row.receiver),
        sender: view(row.sender),
        receiver: view(row.receiver),
        status: row.status,
        source: row.source || 'direct'
      }))
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'تعذر تحميل طلبات الصداقة' });
  }
});

router.get('/qr', async (req, res) => {
  try {
    const friendCode = await ensureFriendCode(req.user);
    const token = createFriendQrToken(friendCode);
    const payload = 'shnomano://friend?token=' + encodeURIComponent(token);
    const imageDataUrl = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 640,
      color: { dark: '#070910', light: '#ffffff' }
    });
    return res.json({
      ok: true,
      payload,
      imageDataUrl,
      expiresInSeconds: 600,
      message: 'تم إنشاء QR آمن صالح لعشر دقائق'
    });
  } catch (error) {
    console.error('Friend QR creation failed:', error.message);
    return res.status(500).json({ ok: false, message: 'تعذر إنشاء QR الآن' });
  }
});

router.post('/qr/request', async (req, res) => {
  try {
    const payload = readFriendQrToken(req.body.token);
    const target = await User.findOne({ friendCode: payload.friendCode, status: 'active' });
    if (!target) return res.status(404).json({ ok: false, message: 'انتهى QR أو لم يعد الحساب متاحاً' });
    const result = await requestFriend(req.user, target, 'qr');
    return res.status(result.httpStatus).json(result);
  } catch (error) {
    if (/expired/i.test(error.message || '')) return res.status(410).json({ ok: false, message: 'انتهت صلاحية QR؛ اطلب رمزاً جديداً' });
    return res.status(400).json({ ok: false, message: 'QR غير صالح أو تم تغييره' });
  }
});

router.post('/request/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ ok: false, message: 'طلب صداقة غير صالح' });
    const target = await User.findById(req.params.id);
    if (!target || target.status !== 'active') return res.status(404).json({ ok: false, message: 'المستخدم غير موجود' });
    const result = await requestFriend(req.user, target, 'direct');
    return res.status(result.httpStatus).json(result);
  } catch (error) {
    console.error('Friend request failed:', error.message);
    return res.status(500).json({ ok: false, message: 'تعذر إرسال طلب الصداقة' });
  }
});

router.patch('/requests/:id/:action', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ ok: false, message: 'معرف الطلب غير صالح' });
    if (!['accept', 'reject', 'cancel'].includes(req.params.action)) return res.status(400).json({ ok: false, message: 'إجراء غير صالح' });
    const query = req.params.action === 'cancel'
      ? { _id: req.params.id, sender: req.user._id, status: 'pending' }
      : { _id: req.params.id, receiver: req.user._id, status: 'pending' };
    const request = await FriendRequest.findOne(query);
    if (!request) return res.status(404).json({ ok: false, message: 'الطلب غير موجود أو عولج سابقاً' });
    request.status = req.params.action === 'accept' ? 'accepted' : req.params.action === 'reject' ? 'rejected' : 'cancelled';
    request.pairKey = canonicalPair(request.sender, request.receiver);
    await request.save();
    return res.json({ ok: true, status: request.status, requestId: request._id });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'تعذر تحديث طلب الصداقة' });
  }
});

router.post('/requests/:id/accept', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ ok: false, message: 'معرف الطلب غير صالح' });
    const request = await FriendRequest.findOne({ _id: req.params.id, receiver: req.user._id, status: 'pending' });
    if (!request) return res.status(404).json({ ok: false, message: 'الطلب غير موجود أو عولج سابقاً' });
    request.status = 'accepted';
    request.pairKey = canonicalPair(request.sender, request.receiver);
    await request.save();
    return res.json({ ok: true, status: request.status, requestId: request._id });
  } catch {
    return res.status(500).json({ ok: false, message: 'تعذر قبول الطلب' });
  }
});
router.post('/requests/:id/reject', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ ok: false, message: 'معرف الطلب غير صالح' });
    const request = await FriendRequest.findOne({ _id: req.params.id, receiver: req.user._id, status: 'pending' });
    if (!request) return res.status(404).json({ ok: false, message: 'الطلب غير موجود أو عولج سابقاً' });
    request.status = 'rejected';
    request.pairKey = canonicalPair(request.sender, request.receiver);
    await request.save();
    return res.json({ ok: true, status: request.status, requestId: request._id });
  } catch {
    return res.status(500).json({ ok: false, message: 'تعذر رفض الطلب' });
  }
});

router.get('/status/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ ok: false, message: 'معرف المستخدم غير صالح' });
    const target = await User.findById(req.params.id).select('blockedUsers');
    if (!target || blocked(req.user, target)) return res.status(404).json({ ok: false, message: 'المستخدم غير موجود' });
    const relation = await findRelation(req.user._id, req.params.id);
    const direction = !relation ? 'none' : String(relation.sender) === String(req.user._id) ? 'outgoing' : 'incoming';
    return res.json({
      ok: true,
      friends: relation?.status === 'accepted',
      status: relation?.status || 'none',
      direction,
      requestId: relation?._id || null
    });
  } catch {
    return res.status(500).json({ ok: false, message: 'تعذر تحميل حالة الصداقة' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ ok: false, message: 'معرف المستخدم غير صالح' });
    const relation = await FriendRequest.findOne({
      $or: [{ sender: req.user._id, receiver: req.params.id }, { sender: req.params.id, receiver: req.user._id }],
      status: 'accepted'
    });
    if (relation) {
      relation.status = 'cancelled';
      relation.pairKey = canonicalPair(relation.sender, relation.receiver);
      await relation.save();
    }
    return res.json({ ok: true, message: relation ? 'تمت إزالة الصديق' : 'لا توجد صداقة قائمة' });
  } catch {
    return res.status(500).json({ ok: false, message: 'تعذر إزالة الصديق' });
  }
});

module.exports = { router, friends, blocked, requestFriend };
