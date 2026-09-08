const express = require('express');
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const Group = require('../models/Group');
const GroupMessage = require('../models/GroupMessage');
const GroupReport = require('../models/GroupReport');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const upload = require('../middleware/upload');

const router = express.Router();
router.use(requireAuth);

function id(v) { return String(v && (v._id || v)); }
function member(group, userId) { return group.members.some(x => id(x) === id(userId)); }
function admin(group, userId) { return id(group.owner) === id(userId) || group.admins.some(x => id(x) === id(userId)); }
function manager(group, user) { return user?.role === 'developer' || admin(group, user); }
function moderator(group, user) { return manager(group, user) || group.moderators.some(x => id(x) === id(user)); }
async function audit(user, action, group, details='') { await AuditLog.create({ actor: user._id, action, details: `room:${group._id} ${details}`.slice(0, 500) }); }
function attachment(file) {
  if (!file) return undefined;
  const type = file.mimetype.startsWith('image/') ? 'image' : file.mimetype.startsWith('video/') ? 'video' : file.mimetype.startsWith('audio/') ? 'audio' : 'file';
  return { url: `/uploads/${file.filename}`, type, mimeType: file.mimetype, originalName: file.originalname, size: file.size };
}
function messageView(message, me) {
  return { id: message._id, text: message.text, attachment: message.attachment, createdAt: message.createdAt, mine: id(message.sender) === id(me), sender: { id: message.sender?._id, fullName: message.sender?.displayName || message.sender?.fullName, username: message.sender?.username, avatarUrl: message.sender?.profile?.avatarUrl || '' } };
}
async function requireMessagePermission(req, res, next) {
  const group = await Group.findById(req.params.id).catch(() => null);
  if (!group || !member(group, req.user._id)) return res.status(403).json({ ok: false, message: 'انضم إلى الغرفة أولاً' });
  if (group.mutedMembers.some(x => id(x) === id(req.user._id))) return res.status(403).json({ ok: false, message: 'تم كتمك في هذه الغرفة' });
  req.group = group;
  next();
}
function view(group, me) {
  return {
    id: group._id, name: group.name, description: group.description, privacy: group.privacy, roomType: group.roomType,
    isOfficial: group.isOfficial, isLive: group.isLive, isLocked: group.isLocked,
    allowMemberAudio: group.allowMemberAudio, allowMemberVideo: group.allowMemberVideo, maxSpeakers: group.maxSpeakers,
    coverUrl: group.coverUrl || '', owner: group.owner, admins: group.admins, moderators: group.moderators,
    memberCount: group.members.length, pendingCount: manager(group, me) ? group.pendingMembers.length : undefined,
    joined: member(group, me), isAdmin: manager(group, me), isModerator: moderator(group, me),
    pending: group.pendingMembers.some(x => id(x) === id(me)), createdAt: group.createdAt
  };
}

router.get('/', async (req, res) => {
  const groups = await Group.find({ isActive: true, $or: [{ privacy: 'public' }, { members: req.user._id }, { owner: req.user._id }] }).sort({ updatedAt: -1 }).limit(100);
  res.json({ ok: true, groups: groups.map(g => view(g, req.user)) });
});

router.post('/', async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (name.length < 3) return res.status(400).json({ ok: false, message: 'اسم المجموعة قصير' });
  if (req.body.communityConsent !== 'accepted') return res.status(400).json({ ok: false, message: 'يجب الموافقة على قواعد المجتمع والبث' });
  const roomType = ['text', 'voice', 'challenge'].includes(req.body.roomType) ? req.body.roomType : 'text';
  const group = await Group.create({ name, description: String(req.body.description || '').trim(), privacy: req.body.privacy === 'private' ? 'private' : 'public', roomType, maxSpeakers: roomType === 'challenge' ? 2 : 8, isOfficial: ['admin','developer'].includes(req.user.role) && req.body.isOfficial === true, owner: req.user._id, admins: [req.user._id], members: [req.user._id] });
  await audit(req.user, 'room.created', group, name);
  res.status(201).json({ ok: true, group: view(group, req.user) });
});

router.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ ok: false, message: 'المجموعة غير موجودة' });
  const group = await Group.findOne({ _id: req.params.id, isActive: true });
  if (!group) return res.status(404).json({ ok: false, message: 'المجموعة غير موجودة' });
  if (group.privacy === 'private' && !member(group, req.user._id) && !manager(group, req.user)) return res.status(403).json({ ok: false, message: 'هذه مجموعة خاصة' });
  res.json({ ok: true, group: view(group, req.user) });
});

router.post('/:id/join', async (req, res) => {
  const group = await Group.findById(req.params.id);
  if (!group || !group.isActive) return res.status(404).json({ ok: false, message: 'المجموعة غير موجودة' });
  if (group.bannedMembers.some(x => id(x) === id(req.user._id))) return res.status(403).json({ ok: false, message: 'أنت محظور من هذه الغرفة' });
  if (group.isLocked && !manager(group, req.user)) return res.status(423).json({ ok: false, message: 'الغرفة مقفلة حالياً' });
  if (member(group, req.user._id)) return res.json({ ok: true, group: view(group, req.user) });
  if (group.privacy === 'private') {
    if (!group.pendingMembers.some(x => id(x) === id(req.user._id))) group.pendingMembers.push(req.user._id);
  } else group.members.push(req.user._id);
  await group.save();
  res.json({ ok: true, group: view(group, req.user), message: group.privacy === 'private' ? 'تم إرسال طلب الانضمام' : 'تم الانضمام' });
});

router.patch('/:id/requests/:userId/:action', async (req, res) => {
  const group = await Group.findById(req.params.id);
  if (!group || !manager(group, req.user)) return res.status(403).json({ ok: false, message: 'صلاحية مدير المجموعة مطلوبة' });
  const userId = req.params.userId;
  if (!group.pendingMembers.some(x => id(x) === id(userId))) return res.status(404).json({ ok: false, message: 'الطلب غير موجود' });
  group.pendingMembers = group.pendingMembers.filter(x => id(x) !== id(userId));
  if (req.params.action === 'accept' && !member(group, userId)) group.members.push(userId);
  else if (req.params.action !== 'reject') return res.status(400).json({ ok: false, message: 'إجراء غير صالح' });
  await group.save();
  await audit(req.user, `room.request.${req.params.action}`, group, userId);
  res.json({ ok: true });
});

router.patch('/:id/live', async (req, res) => {
  const group = await Group.findById(req.params.id);
  if (!group || !manager(group, req.user)) return res.status(403).json({ ok: false, message: 'صلاحية مدير الغرفة مطلوبة' });
  group.isLive = Boolean(req.body.live); await group.save();
  req.app.get('io')?.to(`group:${group._id}`).emit('group:state', { groupId: String(group._id), isLive: group.isLive });
  await audit(req.user, group.isLive ? 'room.started' : 'room.ended', group);
  res.json({ ok: true, group: view(group, req.user) });
});

router.patch('/:id/admins/:userId', async (req, res) => {
  const group = await Group.findById(req.params.id);
  if (!group || (id(group.owner) !== id(req.user._id) && req.user.role !== 'developer')) return res.status(403).json({ ok: false, message: 'مالك الغرفة أو المطور فقط يستطيع تعيين المسؤولين' });
  if (!member(group, req.params.userId)) return res.status(400).json({ ok: false, message: 'المسؤول يجب أن يكون عضواً في الغرفة' });
  if (req.body.admin === false) group.admins = group.admins.filter(x => id(x) !== id(req.params.userId));
  else if (!group.admins.some(x => id(x) === id(req.params.userId))) group.admins.push(req.params.userId);
  await group.save(); await audit(req.user, req.body.admin === false ? 'room.admin.removed' : 'room.admin.added', group, req.params.userId); res.json({ ok: true, group: view(group, req.user) });
});

router.get('/:id/messages', async (req, res) => {
  const group = await Group.findById(req.params.id);
  if (!group || (group.privacy === 'private' && !member(group, req.user._id) && !manager(group, req.user))) return res.status(403).json({ ok: false, message: 'لا يمكنك دخول هذه الغرفة' });
  const messages = await GroupMessage.find({ group: group._id }).populate('sender', 'fullName displayName username profile').sort({ createdAt: -1 }).limit(100).lean();
  res.json({ ok: true, group: view(group, req.user), messages: messages.reverse().map(m => messageView(m, req.user._id)) });
});

router.post('/:id/messages', requireMessagePermission, upload.single('attachment'), async (req, res) => {
  const group = req.group;
  const text = String(req.body.text || '').trim();
  if ((!text && !req.file) || text.length > 5000) return res.status(400).json({ ok: false, message: 'أضف نصاً أو ملفاً صالحاً' });
  const message = await GroupMessage.create({ group: group._id, sender: req.user._id, text, attachment: attachment(req.file) });
  const payload = messageView({ ...message.toObject(), sender: req.user }, req.user._id);
  req.app.get('io')?.to(`group:${group._id}`).emit('group:message', { groupId: String(group._id), message: payload });
  res.status(201).json({ ok: true, message: { ...payload, mine: true } });
});

router.get('/:id/members', async (req, res) => {
  const group = await Group.findById(req.params.id).populate('members pendingMembers bannedMembers', 'fullName displayName username profile status');
  if (!group || (!member(group, req.user._id) && !manager(group, req.user))) return res.status(403).json({ ok: false, message: 'لا يمكنك عرض أعضاء الغرفة' });
  const role = user => id(group.owner) === id(user) ? 'owner' : group.admins.some(x => id(x) === id(user)) ? 'admin' : group.moderators.some(x => id(x) === id(user)) ? 'moderator' : 'member';
  const safe = user => ({ id: user._id, fullName: user.displayName || user.fullName, username: user.username, avatarUrl: user.profile?.avatarUrl || '', role: role(user), muted: group.mutedMembers.some(x => id(x) === id(user)) });
  res.json({ ok: true, members: group.members.map(safe), pending: manager(group, req.user) ? group.pendingMembers.map(safe) : [], banned: manager(group, req.user) ? group.bannedMembers.map(safe) : [] });
});

router.patch('/:id/settings', async (req, res) => {
  const group = await Group.findById(req.params.id);
  if (!group || !manager(group, req.user)) return res.status(403).json({ ok: false, message: 'صلاحية مدير الغرفة مطلوبة' });
  if (req.body.name !== undefined) { const name = String(req.body.name).trim(); if (name.length < 3 || name.length > 120) return res.status(400).json({ ok: false, message: 'اسم الغرفة غير صالح' }); group.name = name; }
  if (req.body.description !== undefined) group.description = String(req.body.description).trim().slice(0, 3000);
  if (req.body.isLocked !== undefined) group.isLocked = Boolean(req.body.isLocked);
  if (req.body.allowMemberAudio !== undefined) group.allowMemberAudio = Boolean(req.body.allowMemberAudio);
  if (req.body.allowMemberVideo !== undefined) group.allowMemberVideo = Boolean(req.body.allowMemberVideo);
  if (req.body.maxSpeakers !== undefined) group.maxSpeakers = Math.min(24, Math.max(2, Number(req.body.maxSpeakers) || 8));
  await group.save(); await audit(req.user, 'room.settings.updated', group);
  req.app.get('io')?.to(`group:${group._id}`).emit('group:state', { groupId: String(group._id), group: view(group, req.user) });
  res.json({ ok: true, group: view(group, req.user) });
});

router.patch('/:id/members/:userId/:action', async (req, res) => {
  const group = await Group.findById(req.params.id);
  if (!group || !moderator(group, req.user)) return res.status(403).json({ ok: false, message: 'صلاحية مراقب الغرفة مطلوبة' });
  const targetId = req.params.userId, action = req.params.action;
  const isBannedTarget = group.bannedMembers.some(x => id(x) === id(targetId));
  if (!mongoose.isValidObjectId(targetId) || (action === 'unban' ? !isBannedTarget : !member(group, targetId))) return res.status(404).json({ ok: false, message: 'عضو الغرفة غير موجود' });
  if (id(group.owner) === id(targetId)) return res.status(403).json({ ok: false, message: 'انقل ملكية الغرفة قبل اتخاذ إجراء على المالك' });
  const targetPrivileged = group.admins.some(x => id(x) === id(targetId)) || group.moderators.some(x => id(x) === id(targetId));
  if (targetPrivileged && !manager(group, req.user)) return res.status(403).json({ ok: false, message: 'المراقب لا يستطيع اتخاذ إجراء على مسؤول آخر' });
  if (action === 'mute') { if (!group.mutedMembers.some(x => id(x) === id(targetId))) group.mutedMembers.push(targetId); }
  else if (action === 'unmute') group.mutedMembers = group.mutedMembers.filter(x => id(x) !== id(targetId));
  else if (action === 'kick') { group.members = group.members.filter(x => id(x) !== id(targetId)); group.admins = group.admins.filter(x => id(x) !== id(targetId)); group.moderators = group.moderators.filter(x => id(x) !== id(targetId)); }
  else if (action === 'ban') { group.members = group.members.filter(x => id(x) !== id(targetId)); group.admins = group.admins.filter(x => id(x) !== id(targetId)); group.moderators = group.moderators.filter(x => id(x) !== id(targetId)); group.pendingMembers = group.pendingMembers.filter(x => id(x) !== id(targetId)); if (!group.bannedMembers.some(x => id(x) === id(targetId))) group.bannedMembers.push(targetId); }
  else if (action === 'unban') group.bannedMembers = group.bannedMembers.filter(x => id(x) !== id(targetId));
  else if (action === 'moderator' && manager(group, req.user)) { if (!group.moderators.some(x => id(x) === id(targetId))) group.moderators.push(targetId); }
  else if (action === 'unmoderator' && manager(group, req.user)) group.moderators = group.moderators.filter(x => id(x) !== id(targetId));
  else return res.status(400).json({ ok: false, message: 'إجراء غير صالح أو غير مسموح' });
  await group.save(); await audit(req.user, `room.member.${action}`, group, targetId);
  req.app.get('io')?.to(`user:${targetId}`).emit('group:moderation', { groupId: String(group._id), action });
  res.json({ ok: true });
});

router.post('/:id/reports', async (req, res) => {
  const group = await Group.findById(req.params.id);
  if (!group || !member(group, req.user._id)) return res.status(403).json({ ok: false, message: 'أعضاء الغرفة فقط يستطيعون التبليغ' });
  const reason = String(req.body.reason || '').trim();
  if (reason.length < 5) return res.status(400).json({ ok: false, message: 'اكتب سبباً واضحاً للتبليغ' });
  const report = await GroupReport.create({ group: group._id, reporter: req.user._id, targetUser: mongoose.isValidObjectId(req.body.targetUserId) ? req.body.targetUserId : null, message: mongoose.isValidObjectId(req.body.messageId) ? req.body.messageId : null, reason });
  res.status(201).json({ ok: true, report: { id: report._id }, message: 'تم إرسال البلاغ للمراجعة' });
});

router.delete('/:id/messages/:messageId', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.messageId)) return res.status(404).json({ ok: false, message: 'الرسالة غير موجودة' });
  const group = await Group.findById(req.params.id);
  const message = group && await GroupMessage.findOne({ _id: req.params.messageId, group: group._id });
  if (!message || (!moderator(group, req.user) && id(message.sender) !== id(req.user._id))) return res.status(403).json({ ok: false, message: 'لا يمكنك حذف هذه الرسالة' });
  await message.deleteOne(); await audit(req.user, 'room.message.deleted', group, req.params.messageId);
  req.app.get('io')?.to(`group:${group._id}`).emit('group:message-deleted', { groupId: String(group._id), messageId: req.params.messageId });
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
