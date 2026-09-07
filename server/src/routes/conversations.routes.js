const express = require('express');
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const { friends, blocked } = require('./friends.routes');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const upload = require('../middleware/upload');
const router = express.Router();
router.use(requireAuth);
const safeUser = (u) => ({ id: u._id, username: u.username, fullName: u.displayName || u.fullName, avatarUrl: u.profile?.avatarUrl || '', online: Boolean(u.profile?.online), lastSeen: u.profile?.lastSeen || null });
async function getConversation(id, userId) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Conversation.findOne({ _id: id, participants: userId }).populate('participants', 'username fullName displayName profile');
}
function serializeMessage(message, userId) {
  const value = message.toObject();
  value.senderId = message.sender;
  value.mine = String(message.sender) === String(userId);
  value.currentUserId = userId;
  return value;
}
router.get('/', async (req, res) => {
  const rows = await Conversation.find({ participants: req.user._id }).populate('participants', 'username fullName displayName profile').populate('lastMessage').sort({ updatedAt: -1 });
  res.json({ ok: true, conversations: rows.map((c) => ({ id: c._id, otherUser: safeUser(c.participants.find((u) => String(u._id) !== String(req.user._id))), lastMessage: c.lastMessage, updatedAt: c.updatedAt, unreadCount: c.unread?.get(String(req.user._id)) || 0 })) });
});
router.post('/:userId', async (req, res) => {
  const target = await User.findById(req.params.userId);
  if (!target || target.status !== 'active' || blocked(req.user, target)) return res.status(403).json({ ok: false, message: 'لا يمكن بدء هذه المحادثة' });
  const isFriend = await friends(req.user._id, target._id);
  const messagingPrivacy = target.privacy?.get('messaging') || 'friends';
  if (String(target._id) === String(req.user._id) || messagingPrivacy === 'nobody' || (messagingPrivacy === 'friends' && !isFriend)) return res.status(403).json({ ok: false, message: 'المراسلة غير متاحة لهذا المستخدم' });
  let conversation = await Conversation.findOne({ participants: { $all: [req.user._id, target._id] }, $expr: { $eq: [{ $size: '$participants' }, 2] } }).populate('participants', 'username fullName displayName profile');
  if (!conversation) conversation = await Conversation.create({ participants: [req.user._id, target._id] });
  res.status(201).json({ ok: true, conversation: { id: conversation._id, otherUser: safeUser(conversation.participants?.find((u) => String(u._id) !== String(req.user._id)) || target) } });
});
router.get('/:id/messages', async (req, res) => {
  const conversation = await getConversation(req.params.id, req.user._id);
  if (!conversation) return res.status(404).json({ ok: false, message: 'المحادثة غير موجودة' });
  const page = Math.max(1, Number(req.query.page) || 1), limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const messages = await Message.find({ conversation: conversation._id, deletedFor: { $ne: req.user._id } }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
  const other = conversation.participants.find((u) => String(u._id) !== String(req.user._id));
  res.json({ ok: true, conversation: { id: conversation._id, otherUser: safeUser(other) }, messages: messages.reverse().map((m) => ({ ...m.toObject(), senderId: m.sender, mine: String(m.sender) === String(req.user._id), currentUserId: req.user._id })) });
});
router.post('/:id/messages', upload.single('attachment'), async (req, res) => {
  const conversation = await getConversation(req.params.id, req.user._id);
  if (!conversation) return res.status(404).json({ ok: false, message: 'المحادثة غير موجودة' });
  const other = conversation.participants.find((p) => String(p._id) !== String(req.user._id));
  if (!other || blocked(req.user, other)) return res.status(403).json({ ok: false, message: 'لا يمكن إرسال الرسائل إلى هذا المستخدم' });
  const inferredType = req.file?.mimetype.startsWith('image/') ? 'image' : req.file?.mimetype.startsWith('video/') ? 'video' : req.file?.mimetype.startsWith('audio/') ? 'audio' : 'file';
  const type = ['text', 'image', 'video', 'file', 'audio'].includes(req.body.type) ? req.body.type : (req.file ? inferredType : 'text');
  const text = String(req.body.text || '').trim();
  if (!text && !req.file) return res.status(400).json({ ok: false, message: 'الرسالة فارغة' });
  if (type === 'text' && text.length > 5000) return res.status(400).json({ ok: false, message: 'الرسالة طويلة جداً' });
  const replyTo = req.body.replyTo && mongoose.isValidObjectId(req.body.replyTo)
    ? await Message.exists({ _id: req.body.replyTo, conversation: conversation._id })
    : null;
  const message = await Message.create({ conversation: conversation._id, sender: req.user._id, type, text, replyTo: replyTo ? req.body.replyTo : null, deliveredAt: new Date(), attachment: req.file ? { url: `/uploads/${req.file.filename}`, name: req.file.originalname, mimeType: req.file.mimetype, size: req.file.size } : null });
  conversation.lastMessage = message._id;
  conversation.unread.set(String(other._id), (conversation.unread.get(String(other._id)) || 0) + 1);
  await conversation.save();
  const serialized = serializeMessage(message, req.user._id);
  const io = req.app.get('io');
  if (io) io.to(`conversation:${conversation._id}`).emit('private:message', { conversationId: String(conversation._id), message: serialized, senderId: String(req.user._id) });
  res.status(201).json({ ok: true, message: serialized });
});
router.patch('/:id/read', async (req, res) => {
  const conversation = await getConversation(req.params.id, req.user._id);
  if (!conversation) return res.status(404).json({ ok: false, message: 'المحادثة غير موجودة' });
  conversation.unread.set(String(req.user._id), 0); await conversation.save();
  await Message.updateMany({ conversation: conversation._id, sender: { $ne: req.user._id }, readAt: null }, { $set: { readAt: new Date() } });
  const io = req.app.get('io');
  if (io) io.to(`conversation:${conversation._id}`).emit('private:read', { conversationId: String(conversation._id), userId: String(req.user._id) });
  res.json({ ok: true });
});
router.patch('/:id/messages/:messageId/read', async (req, res) => {
  const conversation = await getConversation(req.params.id, req.user._id);
  if (!conversation) return res.status(404).json({ ok: false, message: 'المحادثة غير موجودة' });
  const message = await Message.findOneAndUpdate({ _id: req.params.messageId, conversation: conversation._id, sender: { $ne: req.user._id } }, { deliveredAt: new Date(), readAt: new Date() }, { new: true });
  if (!message) return res.status(404).json({ ok: false, message: 'الرسالة غير موجودة' });
  res.json({ ok: true, message: serializeMessage(message, req.user._id) });
});
router.delete('/:id/messages/:messageId', async (req, res) => {
  const conversation = await getConversation(req.params.id, req.user._id);
  if (!conversation) return res.status(404).json({ ok: false, message: 'المحادثة غير موجودة' });
  const message = await Message.findOne({ _id: req.params.messageId, conversation: conversation._id });
  if (!message) return res.status(404).json({ ok: false, message: 'الرسالة غير موجودة' });
  if (String(message.sender) === String(req.user._id) && Date.now() - message.createdAt.getTime() <= 15 * 60 * 1000 && req.query.everyone === 'true') {
    message.deletedForEveryone = true;
  } else {
    if (!message.deletedFor.some((id) => String(id) === String(req.user._id))) message.deletedFor.push(req.user._id);
  }
  await message.save();
  const io = req.app.get('io');
  if (io) io.to(`conversation:${conversation._id}`).emit('private:message', { conversationId: String(conversation._id), deletedMessageId: String(message._id), deletedForEveryone: message.deletedForEveryone });
  res.json({ ok: true, deletedForEveryone: message.deletedForEveryone });
});
module.exports = router;
