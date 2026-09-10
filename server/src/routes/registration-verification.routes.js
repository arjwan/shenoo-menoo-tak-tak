const express = require('express');
const mongoose = require('mongoose');
const { requireAuth, requireRole } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();
router.use(requireAuth);
router.use(requireRole('developer'));

router.get('/', async (_req, res) => {
  try {
    const users = await User.find({ role: 'user', status: 'pending' })
      .select('fullName displayName username contact contactType contactVerified contactVerifiedAt createdAt')
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ ok: true, users: users.map((u) => ({
      id: u._id,
      applicant: u.displayName || u.fullName || u.username,
      username: u.username,
      contact: u.contact,
      contactType: u.contactType,
      contactVerified: Boolean(u.contactVerified),
      contactVerifiedAt: u.contactVerifiedAt,
      createdAt: u.createdAt
    })) });
  } catch (error) {
    console.error('Registration verification list failed:', error.message);
    return res.status(500).json({ ok: false, message: 'تعذر تحميل حالة تأكيد التسجيلات' });
  }
});

router.patch('/:id/verify', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ ok: false, message: 'معرف المستخدم غير صالح' });
    const user = await User.findOne({ _id: req.params.id, role: 'user', status: 'pending' });
    if (!user) return res.status(404).json({ ok: false, message: 'طلب التسجيل غير موجود أو تمت مراجعته' });
    user.contactVerified = true;
    user.contactVerifiedAt = new Date();
    user.contactVerifiedBy = req.user._id;
    user.verificationCodeHash = '';
    user.verificationCodeExpiresAt = null;
    user.verificationAttempts = 0;
    await user.save();
    return res.json({ ok: true, message: `تم تأكيد ${user.contactType === 'email' ? 'البريد الإلكتروني' : 'رقم الهاتف'} ويمكن الآن الموافقة على الحساب` });
  } catch (error) {
    console.error('Manual contact verification failed:', error.message);
    return res.status(500).json({ ok: false, message: 'تعذر تأكيد وسيلة الاتصال' });
  }
});

router.patch('/:id/unverify', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ ok: false, message: 'معرف المستخدم غير صالح' });
    const user = await User.findOne({ _id: req.params.id, role: 'user', status: 'pending' });
    if (!user) return res.status(404).json({ ok: false, message: 'طلب التسجيل غير موجود' });
    user.contactVerified = false;
    user.contactVerifiedAt = null;
    user.contactVerifiedBy = null;
    await user.save();
    return res.json({ ok: true, message: 'تم إلغاء تأكيد وسيلة الاتصال' });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'تعذر إلغاء التأكيد' });
  }
});

module.exports = router;
