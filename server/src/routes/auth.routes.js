const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();
const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;

function checkLoginRateLimit(ip) {
  const now = Date.now();
  const current = loginAttempts.get(ip);
  if (!current || now - current.startedAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { startedAt: now, attempts: 0 });
    return null;
  }
  if (current.attempts >= LOGIN_MAX_ATTEMPTS) return Math.ceil((LOGIN_WINDOW_MS - (now - current.startedAt)) / 1000);
  return null;
}
function recordLoginFailure(ip) {
  const current = loginAttempts.get(ip) || { startedAt: Date.now(), attempts: 0 };
  current.attempts += 1;
  loginAttempts.set(ip, current);
}
function clearLoginAttempts(ip) { loginAttempts.delete(ip); }
function normalizePhone(value) { return String(value || '').replace(/\s+/g, '').trim(); }
function validPhone(value) { return /^07\d{9}$/.test(normalizePhone(value)); }
function validEmail(value) { return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim().toLowerCase()); }

router.post('/signup', async (req, res) => {
  try {
    const { fullName, username, phone, email, contact, birthDate, gender, password, confirmPassword, termsAccepted, privacyAccepted } = req.body;
    const normalizedPhone = normalizePhone(phone || contact);
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!fullName || !username || !normalizedPhone || !password) {
      return res.status(400).json({ ok: false, message: 'الاسم واسم المستخدم ورقم الهاتف وكلمة المرور حقول إلزامية' });
    }
    if (!validPhone(normalizedPhone)) return res.status(400).json({ ok: false, message: 'رقم الهاتف العراقي يجب أن يبدأ بـ 07 ويتكون من 11 رقماً' });
    if (!validEmail(normalizedEmail)) return res.status(400).json({ ok: false, message: 'البريد الإلكتروني غير صالح' });
    if (password !== confirmPassword) return res.status(400).json({ ok: false, message: 'كلمتا المرور غير متطابقتين' });
    if (password.length < 8) return res.status(400).json({ ok: false, message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });
    if (termsAccepted !== true || privacyAccepted !== true) return res.status(400).json({ ok: false, message: 'يجب قراءة اتفاقية الخصوصية والموافقة عليها قبل إنشاء الحساب' });

    const normalizedUsername = username.trim().toLowerCase();
    const duplicateChecks = [{ username: normalizedUsername }, { phone: normalizedPhone }, { contact: normalizedPhone }];
    if (normalizedEmail) duplicateChecks.push({ email: normalizedEmail }, { contact: normalizedEmail });
    const existing = await User.findOne({ $or: duplicateChecks });
    if (existing) return res.status(409).json({ ok: false, message: 'اسم المستخدم أو رقم الهاتف أو البريد مستخدم مسبقاً' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      fullName: fullName.trim(), username: normalizedUsername,
      phone: normalizedPhone, email: normalizedEmail || '',
      contact: normalizedPhone, contactType: 'phone',
      birthDate: birthDate || null, gender: gender || 'other', passwordHash,
      termsAccepted: true, privacyAccepted: true, privacyAcceptedAt: new Date(), privacyVersion: '2026-09-07',
      role: 'user', status: 'pending'
    });
    return res.status(201).json({ ok: true, status: 'pending', message: 'تم استلام طلب التسجيل وهو بانتظار مراجعة الإدارة', userId: user._id });
  } catch (error) {
    console.error('Signup failed:', error.message);
    return res.status(500).json({ ok: false, message: 'حدث خطأ في الخادم' });
  }
});

router.post('/signin', async (req, res) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const retryAfter = checkLoginRateLimit(ip);
    if (retryAfter) { res.set('Retry-After', String(retryAfter)); return res.status(429).json({ ok: false, message: 'محاولات تسجيل الدخول كثيرة، حاول لاحقاً' }); }
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ ok: false, message: 'أدخل بيانات تسجيل الدخول' });
    const normalized = identifier.trim().toLowerCase();
    const user = await User.findOne({ $or: [{ username: normalized }, { contact: normalized }, { phone: normalized }, { email: normalized }] });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      recordLoginFailure(ip);
      return res.status(401).json({ ok: false, message: 'بيانات تسجيل الدخول غير صحيحة' });
    }
    if (user.status === 'pending') return res.status(403).json({ ok: false, status: 'pending', message: 'طلب التسجيل ما زال بانتظار موافقة الإدارة' });
    if (user.status === 'rejected') return res.status(403).json({ ok: false, status: 'rejected', message: user.rejectionReason ? `تم رفض التسجيل: ${user.rejectionReason}` : 'تم رفض طلب التسجيل' });
    if (user.status === 'blocked') return res.status(403).json({ ok: false, status: 'blocked', message: 'الحساب محظور' });
    if (user.status !== 'active') return res.status(403).json({ ok: false, message: 'الحساب غير فعال' });

    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    clearLoginAttempts(ip);
    return res.json({ ok: true, message: 'تم تسجيل الدخول', token, user: { id: user._id, fullName: user.fullName, username: user.username, role: user.role } });
  } catch (error) {
    console.error('Signin failed:', error.message);
    return res.status(500).json({ ok: false, message: 'حدث خطأ في الخادم' });
  }
});

module.exports = router;
