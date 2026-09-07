const express = require('express');
const User = require('../models/User');
const SupportRequest = require('../models/SupportRequest');
const { requireAuth, requireRole } = require('../middleware/auth');
const router = express.Router();

function optionalUser(req) {
  return req.user && req.user._id ? req.user._id : null;
}

router.post('/public', async (req, res) => {
  const type = ['technical', 'privacy', 'unban'].includes(req.body.type) ? req.body.type : 'technical';
  const identity = String(req.body.identity || '').trim().slice(0, 160);
  const subject = String(req.body.subject || '').trim().slice(0, 180);
  const message = String(req.body.message || '').trim().slice(0, 5000);
  if (!identity || !subject || !message) return res.status(400).json({ ok: false, message: 'يرجى إكمال بيانات الطلب' });

  let user = null;
  if (type === 'unban') {
    user = await User.findOne({ $or: [{ username: identity.toLowerCase() }, { phone: identity }, { email: identity.toLowerCase() }, { contact: identity.toLowerCase() }] });
  }
  const request = await SupportRequest.create({ type, user: user?._id || null, identity, subject, message });
  res.status(201).json({ ok: true, requestId: request._id, message: 'تم استلام طلبك وسيتم مراجعته من الإدارة' });
});

router.use(requireAuth);

router.post('/', async (req, res) => {
  const type = ['technical', 'privacy', 'unban'].includes(req.body.type) ? req.body.type : 'technical';
  const subject = String(req.body.subject || '').trim().slice(0, 180);
  const message = String(req.body.message || '').trim().slice(0, 5000);
  if (!subject || !message) return res.status(400).json({ ok: false, message: 'يرجى كتابة عنوان الطلب والتفاصيل' });
  const request = await SupportRequest.create({ type, user: optionalUser(req), identity: req.user.username || req.user.phone || req.user.email || '', subject, message });
  res.status(201).json({ ok: true, request });
});

router.get('/mine', async (req, res) => {
  const requests = await SupportRequest.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100);
  res.json({ ok: true, requests });
});

router.get('/admin', requireRole('admin', 'developer', 'moderator'), async (req, res) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  const requests = await SupportRequest.find(filter).populate('user', 'username fullName displayName status phone email').sort({ createdAt: -1 }).limit(300);
  res.json({ ok: true, requests });
});

router.patch('/admin/:id', requireRole('admin', 'developer', 'moderator'), async (req, res) => {
  const status = ['open', 'in_review', 'resolved', 'rejected'].includes(req.body.status) ? req.body.status : 'in_review';
  const request = await SupportRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ ok: false, message: 'الطلب غير موجود' });
  request.status = status;
  request.adminReply = String(req.body.adminReply || '').trim().slice(0, 5000);
  request.reviewedBy = req.user._id;
  request.reviewedAt = new Date();
  await request.save();
  res.json({ ok: true, request });
});

module.exports = router;
