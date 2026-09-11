const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();
const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 5 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

function checkLoginRateLimit(key) {
  const now = Date.now();
  const current = loginAttempts.get(key);
  if (!current || now - current.startedAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { startedAt: now, attempts: 0 });
    return null;
  }
  if (current.attempts >= LOGIN_MAX_ATTEMPTS) return Math.ceil((LOGIN_WINDOW_MS - (now - current.startedAt)) / 1000);
  return null;
}
function recordLoginFailure(key) {
  const current = loginAttempts.get(key) || { startedAt: Date.now(), attempts: 0 };
  current.attempts += 1;
  loginAttempts.set(key, current);
}
function clearLoginAttempts(key) { loginAttempts.delete(key); }
function normalizePhone(value) { return String(value || '').replace(/\s+/g, '').trim(); }
function validPhone(value) { return /^07\d{9}$/.test(normalizePhone(value)); }
function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value)); }
function normalizeBirthDate(value) {
  if (!value) return { valid: true, value: null };
  const input = String(value).trim();
  let year; let month; let day;
  let match = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) [, year, month, day] = match;
  else {
    match = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) [, day, month, year] = match;
  }
  if (!match) return { valid: false, value: null };
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  const valid = !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso && parsed <= new Date();
  return { valid, value: valid ? parsed : null };
}

router.post('/signup', async (req, res) => {
  try {
    const { fullName, username, phone, email, birthDate, gender, password, confirmPassword, termsAccepted, privacyAccepted } = req.body;
    const normalizedPhone = normalizePhone(phone);
    const normalizedEmail = normalizeEmail(email);
    const hasPhone = validPhone(normalizedPhone);
    const hasEmail = validEmail(normalizedEmail);
    const normalizedBirthDate = normalizeBirthDate(birthDate);

    if (!fullName || !username || !password) {
      return res.status(400).json({ ok: false, message: 'الاسم واسم المستخدم وكلمة المرور حقول إلزامية' });
    }
    if (!hasPhone || !hasEmail) {
      return res.status(400).json({ ok: false, message: 'رقم الهاتف العراقي والبريد الإلكتروني كلاهما مطلوبان لتسجيل الحساب واستلام الإشعارات' });
    }
    if (normalizedPhone && !hasPhone) return res.status(400).json({ ok: false, message: 'رقم الهاتف العراقي يجب أن يبدأ بـ 07 ويتكون من 11 رقماً' });
    if (normalizedEmail && !hasEmail) return res.status(400).json({ ok: false, message: 'البريد الإلكتروني غير صالح' });
    if (!normalizedBirthDate.valid) return res.status(400).json({ ok: false, message: 'تاريخ الميلاد غير صحيح' });
    if (password !== confirmPassword) return res.status(400).json({ ok: false, message: 'كلمتا المرور غير متطابقتين' });
    if (password.length < 8) return res.status(400).json({ ok: false, message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });
    if (termsAccepted !== true || privacyAccepted !== true) return res.status(400).json({ ok: false, message: 'يجب قراءة اتفاقية الخصوصية والموافقة عليها قبل إنشاء الحساب' });

    const normalizedUsername = String(username).trim().toLowerCase();
    const contactType = 'phone';
    const contact = normalizedPhone;
    const duplicateChecks = [{ username: normalizedUsername }, { contact }];
    if (hasPhone) duplicateChecks.push({ phone: normalizedPhone });
    if (hasEmail) duplicateChecks.push({ email: normalizedEmail });
    const existing = await User.findOne({ $or: duplicateChecks });
    if (existing) return res.status(409).json({ ok: false, message: 'اسم المستخدم أو رقم الهاتف أو البريد مستخدم مسبقاً' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      fullName: String(fullName).trim(),
      username: normalizedUsername,
      phone: hasPhone ? normalizedPhone : '',
      email: hasEmail ? normalizedEmail : '',
      contact,
      contactType,
      contactVerified: false,
      contactVerifiedAt: null,
      notificationPreferences: { inApp: true, phone: true, email: true },
      birthDate: normalizedBirthDate.value,
      gender: gender || 'other',
      passwordHash,
      termsAccepted: true,
      privacyAccepted: true,
      privacyAcceptedAt: new Date(),
      privacyVersion: '2026-09-10',
      role: 'user',
      status: 'active',
      approvalSource: 'automatic',
      reviewedAt: new Date()
    });

    return res.status(201).json({
      ok: true,
      status: 'active',
      contactType,
      contact,
      contactVerified: false,
      message: 'تم إنشاء الحساب وقبوله تلقائياً بعد اجتياز شروط التسجيل. يمكنك تسجيل الدخول الآن.',
      userId: user._id
    });
  } catch (error) {
    console.error('Signup failed:', error.message);
    return res.status(500).json({ ok: false, message: 'حدث خطأ في الخادم' });
  }
});

router.post('/signin', async (req, res) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const identifier = String(req.body.identifier || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!identifier || !password) return res.status(400).json({ ok: false, message: 'أدخل اسم المستخدم أو الهاتف أو البريد وكلمة المرور' });

    const isPhone = validPhone(identifier);
    const isEmail = validEmail(identifier);
    const isUsername = /^[\p{L}\p{N}_.]{3,30}$/u.test(identifier);
    if (!isPhone && !isEmail && !isUsername) return res.status(400).json({ ok: false, message: 'استخدم اسم المستخدم أو رقم الهاتف أو البريد المسجل بالحساب' });

    const attemptKey = `${ip}:${identifier}`;
    const retryAfter = checkLoginRateLimit(attemptKey);
    if (retryAfter) {
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ ok: false, message: `محاولات تسجيل الدخول كثيرة لهذا الحساب، حاول بعد ${Math.ceil(retryAfter / 60)} دقيقة` });
    }

    const user = await User.findOne(isPhone
      ? { $or: [{ contact: normalizePhone(identifier), contactType: 'phone' }, { phone: normalizePhone(identifier) }] }
      : isEmail ? { $or: [{ contact: normalizeEmail(identifier), contactType: 'email' }, { email: normalizeEmail(identifier) }] }
      : { username: identifier });

    if (!user) {
      recordLoginFailure(attemptKey);
      return res.status(401).json({ ok: false, message: 'الحساب غير موجود باسم المستخدم أو الهاتف أو البريد المدخل' });
    }
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      recordLoginFailure(attemptKey);
      return res.status(401).json({ ok: false, message: 'كلمة المرور غير صحيحة' });
    }

    if (user.status === 'pending') {
      return res.status(403).json({
        ok: false,
        status: 'pending',
        contactVerified: Boolean(user.contactVerified),
        message: user.contactVerified ? 'وسيلة الاتصال مؤكدة، والحساب بانتظار موافقة المطور' : 'يجب تأكيد رقم الهاتف أو البريد أولاً، ثم ينتظر الحساب موافقة المطور'
      });
    }
    if (user.status === 'rejected') return res.status(403).json({ ok: false, status: 'rejected', message: user.rejectionReason ? `تم رفض التسجيل: ${user.rejectionReason}` : 'تم رفض طلب التسجيل' });
    if (user.status === 'blocked') return res.status(403).json({ ok: false, status: 'blocked', message: 'الحساب محظور' });
    if (user.status !== 'active') return res.status(403).json({ ok: false, message: 'الحساب غير فعال' });

    /* Existing active accounts stay usable during migration. New accounts cannot become active until contactVerified=true. */
    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    clearLoginAttempts(attemptKey);
    return res.json({
      ok: true,
      message: 'تم تسجيل الدخول',
      token,
      user: { id: user._id, fullName: user.fullName, username: user.username, role: user.role, contactType: user.contactType }
    });
  } catch (error) {
    console.error('Signin failed:', error.message);
    return res.status(500).json({ ok: false, message: 'حدث خطأ في الخادم' });
  }
});

module.exports = router;
