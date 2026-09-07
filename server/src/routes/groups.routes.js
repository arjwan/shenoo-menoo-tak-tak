const express = require('express');
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const Group = require('../models/Group');

const router = express.Router();
router.use(requireAuth);

function id(v) { return String(v && (v._id || v)); }
function member(group, userId) { return group.members.some(x => id(x) === id(userId)); }
function admin(group, userId) { return id(group.owner) === id(userId) || group.admins.some(x => id(x) === id(userId)); }
function view(group, me) {
  return {
    id: group._id, name: group.name, description: group.description, privacy: group.privacy,
    coverUrl: group.coverUrl || '', owner: group.owner, admins: group.admins,
    memberCount: group.members.length, pendingCount: admin(group, me) ? group.pendingMembers.length : undefined,
    joined: member(group, me), isAdmin: admin(group, me),
    pending: group.pendingMembers.some(x => id(x) === id(me)), createdAt: group.createdAt
  };
}

router.get('/', async (req, res) => {
  const groups = await Group.find({ isActive: true, $or: [{ privacy: 'public' }, { members: req.user._id }, { owner: req.user._id }] }).sort({ updatedAt: -1 }).limit(100);
  res.json({ ok: true, groups: groups.map(g => view(g, req.user._id)) });
});

router.post('/', async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (name.length < 3) return res.status(400).json({ ok: false, message: 'اسم المجموعة قصير' });
  const group = await Group.create({ name, description: String(req.body.description || '').trim(), privacy: req.body.privacy === 'private' ? 'private' : 'public', owner: req.user._id, admins: [req.user._id], members: [req.user._id] });
  res.status(201).json({ ok: true, group: view(group, req.user._id) });
});

router.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ ok: false, message: 'المجموعة غير موجودة' });
  const group = await Group.findOne({ _id: req.params.id, isActive: true });
  if (!group) return res.status(404).json({ ok: false, message: 'المجموعة غير موجودة' });
  if (group.privacy === 'private' && !member(group, req.user._id) && !admin(group, req.user._id)) return res.status(403).json({ ok: false, message: 'هذه مجموعة خاصة' });
  res.json({ ok: true, group: view(group, req.user._id) });
});

router.post('/:id/join', async (req, res) => {
  const group = await Group.findById(req.params.id);
  if (!group || !group.isActive) return res.status(404).json({ ok: false, message: 'المجموعة غير موجودة' });
  if (member(group, req.user._id)) return res.json({ ok: true, group: view(group, req.user._id) });
  if (group.privacy === 'private') {
    if (!group.pendingMembers.some(x => id(x) === id(req.user._id))) group.pendingMembers.push(req.user._id);
  } else group.members.push(req.user._id);
  await group.save();
  res.json({ ok: true, group: view(group, req.user._id), message: group.privacy === 'private' ? 'تم إرسال طلب الانضمام' : 'تم الانضمام' });
});

router.patch('/:id/requests/:userId/:action', async (req, res) => {
  const group = await Group.findById(req.params.id);
  if (!group || !admin(group, req.user._id)) return res.status(403).json({ ok: false, message: 'صلاحية مدير المجموعة مطلوبة' });
  const userId = req.params.userId;
  if (!group.pendingMembers.some(x => id(x) === id(userId))) return res.status(404).json({ ok: false, message: 'الطلب غير موجود' });
  group.pendingMembers = group.pendingMembers.filter(x => id(x) !== id(userId));
  if (req.params.action === 'accept' && !member(group, userId)) group.members.push(userId);
  else if (req.params.action !== 'reject') return res.status(400).json({ ok: false, message: 'إجراء غير صالح' });
  await group.save();
  res.json({ ok: true });
});

router.delete('/:id/join', async (req, res) => {
  const group = await Group.findById(req.params.id);
  if (!group) return res.status(404).json({ ok: false, message: 'المجموعة غير موجودة' });
  if (id(group.owner) === id(req.user._id)) return res.status(400).json({ ok: false, message: 'مالك المجموعة لا يستطيع المغادرة قبل نقل الملكية' });
  group.members = group.members.filter(x => id(x) !== id(req.user._id));
  group.admins = group.admins.filter(x => id(x) !== id(req.user._id));
  await group.save();
  res.json({ ok: true });
});

module.exports = router;
