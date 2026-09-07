const express = require('express');
const bcrypt = require('bcryptjs');
const { requireAuth } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();
const PRIVACY_KEYS = [
  'profile', 'photo', 'cover', 'lastSeen', 'online', 'birthDate', 'about',
  'friendsList', 'phone', 'email', 'friendRequests', 'messaging',
  'audioCalls', 'videoCalls', 'posts', 'comments', 'mentions'
];
const SAFE_PROFILE_FIELDS = [
  'displayName', 'bio', 'birthDate', 'gender', 'governorate', 'city',
  'profession', 'workplace', 'education', 'website', 'socialLinks'
];

function publicUser(user) {
  return {
    id: user._id,
    username: user.username,
    fullName: user.fullName,
    displayName: user.displayName || user.fullName,
    contact: user.privacy?.get('phone') === 'everyone' ? user.contact : undefined,
    contactType: user.contactType,
    profile: user.profile,
    privacy: Object.fromEntries(user.privacy || []),
    status: user.status
  };
}

function validatePrivacy(input) {
  return Object.keys(input || {}).every((key) => PRIVACY_KEYS.includes(key) &&
    ['everyone', 'friends', 'nobody'].includes(input[key]));
}

router.use(requireAuth);

router.get('/me', (req, res) => res.json({ ok: true, user: publicUser(req.user) }));

router.patch('/me', async (req, res) => {
  try {
    const allowed = ['fullName', 'username', 'birthDate', 'gender'];
    const updates = {};
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) updates[key] = String(req.body[key]).trim();
    });
    if (updates.fullName && updates.fullName.length > 100) return res.status(400).json({ ok: false, message: 'الاسم طويل جداً' });
    if (updates.username) {
      if (!/^[a-z0-9_]{3,30}$/i.test(updates.username)) return res.status(400).json({ ok: false, message: 'اسم المستخدم غير صالح' });
      updates.username = updates.username.toLowerCase();
      const duplicate = await User.findOne({ username: updates.username, _id: { $ne: req.user._id } });
      if (duplicate) return res.status(409).json({ ok: false, message: 'اسم المستخدم مستخدم مسبقاً' });
    }
    Object.assign(req.user, updates);
    await req.user.save();
    return res.json({ ok: true, user: publicUser(req.user), message: 'تم حفظ معلومات الحساب' });
  } catch (error) {
    console.error('User update failed:', error.message);
    return res.status(500).json({ ok: false, message: 'تعذر حفظ معلومات الحساب' });
  }
});

router.patch('/me/profile', async (req, res) => {
  try {
    SAFE_PROFILE_FIELDS.forEach((key) => {
      if (req.body[key] !== undefined) {
        if (key === 'bio' && String(req.body[key]).length > 500) throw new Error('النبذة طويلة جداً');
        req.user.profile[key] = req.body[key];
      }
    });
    await req.user.save();
    return res.json({ ok: true, user: publicUser(req.user), message: 'تم حفظ الملف الشخصي' });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error.message || 'تعذر حفظ الملف الشخصي' });
  }
});

router.patch('/me/privacy', async (req, res) => {
  if (!validatePrivacy(req.body)) return res.status(400).json({ ok: false, message: 'إعدادات الخصوصية غير صالحة' });
  Object.entries(req.body).forEach(([key, value]) => req.user.privacy.set(key, value));
  await req.user.save();
  return res.json({ ok: true, privacy: Object.fromEntries(req.user.privacy), message: 'تم حفظ إعدادات الخصوصية' });
});

router.patch('/me/password', async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword !== confirmPassword) return res.status(400).json({ ok: false, message: 'تحقق من كلمات المرور' });
  if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) return res.status(400).json({ ok: false, message: 'كلمة المرور يجب أن تكون 8 أحرف وتحتوي حرفاً ورقماً' });
  if (!(await bcrypt.compare(currentPassword, req.user.passwordHash))) return res.status(401).json({ ok: false, message: 'كلمة المرور الحالية غير صحيحة' });
  req.user.passwordHash = await bcrypt.hash(newPassword, 12);
  await req.user.save();
  return res.json({ ok: true, message: 'تم تغيير كلمة المرور' });
});

router.patch('/me/email', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ ok: false, message: 'البريد الإلكتروني غير صالح' });
  const duplicate = await User.findOne({ contact: email, _id: { $ne: req.user._id } });
  if (duplicate) return res.status(409).json({ ok: false, message: 'البريد مستخدم بحساب آخر' });
  req.user.contact = email;
  req.user.contactType = 'email';
  await req.user.save();
  return res.json({ ok: true, message: 'تم تحديث البريد وسيحتاج التحقق عند توفره' });
});

router.patch('/me/phone', async (req, res) => {
  const phone = String(req.body.phone || '').trim();
  if (!/^07\d{9}$/.test(phone)) return res.status(400).json({ ok: false, message: 'رقم الهاتف العراقي غير صالح' });
  const duplicate = await User.findOne({ contact: phone, _id: { $ne: req.user._id } });
  if (duplicate) return res.status(409).json({ ok: false, message: 'الهاتف مستخدم بحساب آخر' });
  req.user.contact = phone;
  req.user.contactType = 'phone';
  await req.user.save();
  return res.json({ ok: true, message: 'تم تحديث الهاتف وسيحتاج التحقق عند توفره' });
});

router.get('/me/blocked', async (req, res) => {
  const users = await User.find({ _id: { $in: req.user.blockedUsers || [] } }).select('fullName username profile');
  return res.json({ ok: true, users });
});

router.post('/:id/block', async (req, res) => {
  if (String(req.user._id) === req.params.id) return res.status(400).json({ ok: false, message: 'لا يمكنك حظر نفسك' });
  const target = await User.findById(req.params.id).select('_id');
  if (!target) return res.status(404).json({ ok: false, message: 'المستخدم غير موجود' });
  const blockedUsers = req.user.blockedUsers || [];
  if (!blockedUsers.some((id) => String(id) === req.params.id)) blockedUsers.push(target._id);
  req.user.blockedUsers = blockedUsers;
  await req.user.save();
  return res.json({ ok: true, message: 'تم حظر المستخدم' });
});

router.delete('/:id/block', async (req, res) => {
  req.user.blockedUsers = (req.user.blockedUsers || []).filter((id) => String(id) !== req.params.id);
  await req.user.save();
  return res.json({ ok: true, message: 'تم فك الحظر' });
});

module.exports = router;
