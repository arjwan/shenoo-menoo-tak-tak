const express = require('express');
const bcrypt = require('bcryptjs');
const { requireAuth } = require('../middleware/auth');
const AccountChangeRequest = require('../models/AccountChangeRequest');

const router = express.Router();
router.use(requireAuth);

router.patch('/me', async (req, res, next) => {
  try {
    if (req.body.fullName === undefined) return next();
    const requestedName = String(req.body.fullName || '').trim();
    if (!requestedName || requestedName.length > 100) return res.status(400).json({ ok: false, message: 'الاسم غير صالح' });
    const existing = await AccountChangeRequest.findOne({ user: req.user._id, type: 'name', status: 'pending' });
    if (existing) {
      existing.requestedName = requestedName;
      existing.createdAt = new Date();
      await existing.save();
    } else {
      await AccountChangeRequest.create({ user: req.user._id, type: 'name', requestedName });
    }
    return res.json({ ok: true, pendingApproval: true, message: 'تم إرسال طلب تغيير الاسم إلى المطور للموافقة' });
  } catch (error) {
    console.error('Name change request failed:', error.message);
    return res.status(500).json({ ok: false, message: 'تعذر إرسال طلب تغيير الاسم' });
  }
});

router.patch('/me/password', async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword !== confirmPassword) return res.status(400).json({ ok: false, message: 'تحقق من كلمات المرور' });
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) return res.status(400).json({ ok: false, message: 'كلمة المرور يجب أن تكون 8 أحرف وتحتوي حرفاً ورقماً' });
    if (!(await bcrypt.compare(currentPassword, req.user.passwordHash))) return res.status(401).json({ ok: false, message: 'كلمة المرور الحالية غير صحيحة' });
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const existing = await AccountChangeRequest.findOne({ user: req.user._id, type: 'password', status: 'pending' });
    if (existing) {
      existing.passwordHash = passwordHash;
      existing.createdAt = new Date();
      await existing.save();
    } else {
      await AccountChangeRequest.create({ user: req.user._id, type: 'password', passwordHash });
    }
    return res.json({ ok: true, pendingApproval: true, message: 'تم إرسال طلب تغيير كلمة المرور إلى المطور للموافقة' });
  } catch (error) {
    console.error('Password change request failed:', error.message);
    return res.status(500).json({ ok: false, message: 'تعذر إرسال طلب تغيير كلمة المرور' });
  }
});

module.exports = router;
