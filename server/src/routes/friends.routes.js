const express = require('express');
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const router = express.Router();
router.use(requireAuth);

const view = (u) => ({ id: u._id, username: u.username, fullName: u.displayName || u.fullName, bio: u.profile?.bio || '', avatarUrl: u.profile?.avatarUrl || '', status: u.status });
const blocked = (a, b) => (a.blockedUsers || []).some((id) => String(id) === String(b._id)) || (b.blockedUsers || []).some((id) => String(id) === String(a._id));
async function friends(a, b) { return !!await FriendRequest.exists({ $or: [{ sender: a, receiver: b }, { sender: b, receiver: a }], status: 'accepted' }); }

router.get('/', async (req, res) => {
  const rows = await FriendRequest.find({ $or: [{ sender: req.user._id }, { receiver: req.user._id }], status: 'accepted' }).populate('sender receiver', 'username fullName displayName profile status');
  const users = rows.map((r) => view(String(r.sender._id) === String(req.user._id) ? r.receiver : r.sender));
  res.json({ ok: true, friends: users, users });
});
router.get('/requests', async (req, res) => {
  const incoming = req.query.type === 'sent' ? false : true;
  const query = incoming ? { receiver: req.user._id, status: 'pending' } : { sender: req.user._id, status: 'pending' };
  const rows = await FriendRequest.find(query).populate('sender receiver', 'username fullName displayName profile status');
  res.json({ ok: true, requests: rows.map((r) => ({ id: r._id, user: view(incoming ? r.sender : r.receiver), sender: view(r.sender), receiver: view(r.receiver), status: r.status })) });
});
router.post('/request/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id) || String(req.user._id) === req.params.id) return res.status(400).json({ ok: false, message: 'طلب صداقة غير صالح' });
  const target = await User.findById(req.params.id);
  if (!target || target.status !== 'active') return res.status(404).json({ ok: false, message: 'المستخدم غير موجود' });
  if (blocked(req.user, target)) return res.status(403).json({ ok: false, message: 'لا يمكن التواصل مع هذا المستخدم' });
  if (await friends(req.user._id, target._id)) return res.status(409).json({ ok: false, message: 'أنتم أصدقاء بالفعل' });
  const existing = await FriendRequest.findOne({ $or: [{ sender: req.user._id, receiver: target._id }, { sender: target._id, receiver: req.user._id }] });
  if (existing && existing.status === 'pending') return res.status(409).json({ ok: false, message: 'يوجد طلب قائم' });
  const request = existing || new FriendRequest({ sender: req.user._id, receiver: target._id });
  request.sender = req.user._id; request.receiver = target._id; request.status = 'pending'; await request.save();
  res.status(201).json({ ok: true, request: { id: request._id } });
});
router.patch('/requests/:id/:action', async (req, res) => {
  if (!['accept', 'reject', 'cancel'].includes(req.params.action)) return res.status(400).json({ ok: false, message: 'إجراء غير صالح' });
  const query = req.params.action === 'cancel' ? { _id: req.params.id, sender: req.user._id, status: 'pending' } : { _id: req.params.id, receiver: req.user._id, status: 'pending' };
  const request = await FriendRequest.findOne(query);
  if (!request) return res.status(404).json({ ok: false, message: 'الطلب غير موجود' });
  request.status = req.params.action === 'accept' ? 'accepted' : req.params.action === 'reject' ? 'rejected' : 'cancelled'; await request.save();
  res.json({ ok: true, status: request.status });
});
router.post('/requests/:id/accept', async (req, res) => {
  const request = await FriendRequest.findOne({ _id: req.params.id, receiver: req.user._id, status: 'pending' });
  if (!request) return res.status(404).json({ ok: false, message: 'الطلب غير موجود' });
  request.status = 'accepted'; await request.save(); res.json({ ok: true, status: request.status });
});
router.post('/requests/:id/reject', async (req, res) => {
  const request = await FriendRequest.findOneAndUpdate({ _id: req.params.id, receiver: req.user._id, status: 'pending' }, { status: 'rejected' }, { new: true });
  if (!request) return res.status(404).json({ ok: false, message: 'الطلب غير موجود' });
  res.json({ ok: true, status: request.status });
});
router.get('/status/:id', async (req, res) => {
  const target = await User.findById(req.params.id).select('blockedUsers');
  if (!target || blocked(req.user, target)) return res.status(404).json({ ok: false, message: 'المستخدم غير موجود' });
  const relation = await FriendRequest.findOne({ $or: [{ sender: req.user._id, receiver: req.params.id }, { sender: req.params.id, receiver: req.user._id }] }).sort({ updatedAt: -1 });
  res.json({ ok: true, friends: !!(relation && relation.status === 'accepted'), status: relation?.status || 'none' });
});
router.delete('/:id', async (req, res) => {
  const relation = await FriendRequest.findOne({
    $or: [{ sender: req.user._id, receiver: req.params.id }, { sender: req.params.id, receiver: req.user._id }],
    status: { $in: ['accepted', 'pending'] }
  });
  if (relation && relation.status === 'pending' && String(relation.sender) === String(req.user._id)) {
    relation.status = 'cancelled';
    await relation.save();
  } else if (relation && relation.status === 'accepted') {
    await FriendRequest.deleteOne({ _id: relation._id });
  }
  res.json({ ok: true });
});
module.exports = { router, friends, blocked };
