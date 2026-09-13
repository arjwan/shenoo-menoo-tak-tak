const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
  createVerificationToken,
  deliverOtp,
  inspectOtp,
  issueOtp,
  maskDestination,
  otpPolicy,
  readVerificationToken,
  registrationOtpRequired
} = require('../services/registration-otp');

const router = express.Router();
const loginAttempts = new Map();
const signupAttempts = new Map();
const LOGIN_WINDOW_MS = 5 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const SIGNUP_WINDOW_MS = 60 * 60 * 1000;
const SIGNUP_MAX_ATTEMPTS = 5;

function rateLimit(store, key, windowMs, maximum) {
  const now = Date.now();
  const current = store.get(key);
  if (!current || now - current.startedAt > windowMs) {
    store.set(key, { startedAt: now, attempts: 0 });
    return null;
  }
  if (current.attempts >= maximum) return Math.max(1, Math.ceil((windowMs - (now - current.startedAt)) / 1000));
  return null;
}
function recordAttempt(store, key) {
  const current = store.get(key) || { startedAt: Date.now(), attempts: 0 };
  current.attempts += 1;
  store.set(key, current);
}
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
  const iso = year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  const parsed = new Date(iso + 'T00:00:00.000Z');
  const valid = !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso && parsed <= new Date();
  return { valid, value: valid ? parsed : null };
}
function requestIp(req) { return req.ip || req.socket.remoteAddress || 'unknown'; }

router.post('/signup', async (req, res) => {
  const ip = requestIp(req);
  const retryAfter = rateLimit(signupAttempts, ip, SIGNUP_WINDOW_MS, SIGNUP_MAX_ATTEMPTS);
  if (retryAfter) {
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({ ok: false, message: 'طلبات إنشاء الحساب كثيرة من هذا الجهاز. حاول لاحقاً.' });
  }
  recordAttempt(signupAttempts, ip);

  try {
    const { fullName, username, phone, email, birthDate, gender, password, confirmPassword, termsAccepted, privacyAccepted } = req.body;
    const normalizedPhone = normalizePhone(phone);
    const normalizedEmail = normalizeEmail(email);
    const normalizedBirthDate = normalizeBirthDate(birthDate);

    if (!fullName || !username || !password) return res.status(400).json({ ok: false, message: 'الاسم واسم المستخدم وكلمة المرور حقول إلزامية' });
    if (!validPhone(normalizedPhone)) return res.status(400).json({ ok: false, message: 'رقم الهاتف العراقي يجب أن يبدأ بـ 07 ويتكون من 11 رقماً' });
    if (!validEmail(normalizedEmail)) return res.status(400).json({ ok: false, message: 'البريد الإلكتروني الصحيح مطلوب لإرسال رمز التأكيد' });
    if (!normalizedBirthDate.valid) return res.status(400).json({ ok: false, message: 'تاريخ الميلاد غير صحيح' });
    if (password !== confirmPassword) return res.status(400).json({ ok: false, message: 'كلمتا المرور غير متطابقتين' });
    if (password.length < 8) return res.status(400).json({ ok: false, message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });
    if (termsAccepted !== true || privacyAccepted !== true) return res.status(400).json({ ok: false, message: 'يجب قراءة اتفاقية الخصوصية والموافقة عليها قبل إنشاء الحساب' });

    const normalizedUsername = String(username).trim().toLowerCase();
    if (!/^[\p{L}\p{M}0-9_.]{3,30}$/u.test(normalizedUsername)) {
      return res.status(400).json({ ok: false, message: 'اسم المستخدم غير صالح' });
    }
    const existing = await User.findOne({ $or: [
      { username: normalizedUsername }, { contact: normalizedEmail },
      { phone: normalizedPhone }, { email: normalizedEmail }
    ] });
    if (existing) return res.status(409).json({ ok: false, message: 'اسم المستخدم أو رقم الهاتف أو البريد مستخدم مسبقاً' });

    const user = new User({
      fullName: String(fullName).trim(),
      username: normalizedUsername,
      phone: normalizedPhone,
      email: normalizedEmail,
      contact: normalizedEmail,
      contactType: 'email',
      contactVerified: false,
      notificationPreferences: { inApp: true, phone: true, email: true },
      birthDate: normalizedBirthDate.value,
      gender: gender || 'other',
      passwordHash: await bcrypt.hash(password, 12),
      termsAccepted: true,
      privacyAccepted: true,
      privacyAcceptedAt: new Date(),
      privacyVersion: '2026-09-12',
      role: 'user',
      status: registrationOtpRequired() ? 'pending' : 'active',
      approvalSource: registrationOtpRequired() ? 'pending' : 'automatic',
      reviewedAt: registrationOtpRequired() ? null : new Date()
    });

    if (!registrationOtpRequired()) {
      await user.save();
      return res.status(201).json({
        ok: true,
        status: 'active',
        verificationRequired: false,
        message: 'تم إنشاء الحساب وتفعيله. يمكنك تسجيل الدخول الآن.'
      });
    }

    const code = issueOtp(user);
    try {
      await deliverOtp(user, code);
    } catch (deliveryError) {
      console.error('OTP delivery failed:', deliveryError.message);
      return res.status(503).json({ ok: false, message: 'تعذر إرسال رمز التأكيد الآن. لم يُنشأ الحساب؛ حاول لاحقاً.' });
    }
    await user.save();
    const response = {
      ok: true,
      status: 'pending_verification',
      verificationRequired: true,
      verificationToken: createVerificationToken(user),
      destination: maskDestination(user.email, 'email'),
      expiresInSeconds: Math.floor(otpPolicy().ttlMs / 1000),
      message: 'أرسلنا رمز تأكيد من 6 أرقام إلى بريدك الإلكتروني.'
    };
    if (process.env.NODE_ENV === 'test' && process.env.OTP_DELIVERY_MODE === 'test') response.testCode = code;
    return res.status(201).json(response);
  } catch (error) {
    if (error && error.code === 11000) return res.status(409).json({ ok: false, message: 'اسم المستخدم أو رقم الهاتف أو البريد مستخدم مسبقاً' });
    console.error('Signup failed:', error.message);
    return res.status(500).json({ ok: false, message: 'حدث خطأ في الخادم' });
  }
});

router.post('/verify-registration', async (req, res) => {
  try {
    const payload = readVerificationToken(req.body.verificationToken);
    const user = await User.findOne({ _id: payload.userId, role: 'user', status: 'pending' });
    if (!user) return res.status(400).json({ ok: false, message: 'طلب التحقق غير صالح أو مكتمل سابقاً' });

    const result = inspectOtp(user, req.body.code);
    if (!result.ok) {
      if (result.reason === 'mismatch') {
        user.verificationAttempts = Number(user.verificationAttempts || 0) + 1;
        await user.save();
      }
      const messages = {
        expired: 'انتهت صلاحية الرمز. اطلب رمزاً جديداً.',
        locked: 'تم تجاوز عدد المحاولات. اطلب رمزاً جديداً.',
        missing: 'لا يوجد رمز صالح. اطلب رمزاً جديداً.',
        mismatch: 'رمز التأكيد غير صحيح.',
        verified: 'تم تأكيد الحساب سابقاً.'
      };
      return res.status(result.reason === 'mismatch' ? 400 : 409).json({ ok: false, message: messages[result.reason] || 'تعذر التحقق من الرمز' });
    }

    user.contactVerified = true;
    user.contactVerifiedAt = new Date();
    user.verificationCodeHash = '';
    user.verificationCodeExpiresAt = null;
    user.verificationAttempts = 0;
    user.status = 'active';
    user.approvalSource = 'automatic';
    user.reviewedAt = new Date();
    await user.save();
    return res.json({ ok: true, status: 'active', message: 'تم تأكيد البريد وتفعيل الحساب. يمكنك تسجيل الدخول الآن.' });
  } catch {
    return res.status(401).json({ ok: false, message: 'جلسة التحقق غير صالحة أو منتهية' });
  }
});

router.post('/resend-verification', async (req, res) => {
  try {
    let user;
    let token = req.body.verificationToken;
    if (token) {
      const payload = readVerificationToken(token);
      user = await User.findOne({ _id: payload.userId, role: 'user', status: 'pending' });
    } else {
      const identifier = String(req.body.identifier || '').trim().toLowerCase();
      const password = String(req.body.password || '');
      user = await User.findOne({ role: 'user', status: 'pending', $or: [
        { username: identifier }, { phone: normalizePhone(identifier) }, { email: normalizeEmail(identifier) }
      ] });
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) user = null;
    }
    if (!user) return res.status(401).json({ ok: false, message: 'تعذر التحقق من طلب إعادة الإرسال' });
    if (user.contactVerified) return res.status(409).json({ ok: false, message: 'الحساب مؤكد بالفعل' });

    const elapsed = Date.now() - new Date(user.verificationLastSentAt || 0).getTime();
    if (elapsed < otpPolicy().resendMs) {
      const retryAfter = Math.ceil((otpPolicy().resendMs - elapsed) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ ok: false, retryAfter, message: 'انتظر قليلاً قبل طلب رمز جديد.' });
    }

    const code = issueOtp(user);
    await deliverOtp(user, code);
    await user.save();
    token = createVerificationToken(user);
    const response = {
      ok: true,
      verificationToken: token,
      destination: maskDestination(user.email, 'email'),
      expiresInSeconds: Math.floor(otpPolicy().ttlMs / 1000),
      message: 'تم إرسال رمز تأكيد جديد.'
    };
    if (process.env.NODE_ENV === 'test' && process.env.OTP_DELIVERY_MODE === 'test') response.testCode = code;
    return res.json(response);
  } catch (error) {
    console.error('OTP resend failed:', error.message);
    return res.status(503).json({ ok: false, message: 'تعذر إرسال رمز جديد الآن' });
  }
});

router.post('/signin', async (req, res) => {
  try {
    const ip = requestIp(req);
    const identifier = String(req.body.identifier || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!identifier || !password) return res.status(400).json({ ok: false, message: 'أدخل اسم المستخدم أو الهاتف أو البريد وكلمة المرور' });

    const attemptKey = ip + ':' + identifier;
    const retryAfter = rateLimit(loginAttempts, attemptKey, LOGIN_WINDOW_MS, LOGIN_MAX_ATTEMPTS);
    if (retryAfter) {
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ ok: false, message: 'محاولات تسجيل الدخول كثيرة لهذا الحساب، حاول لاحقاً' });
    }

    const user = await User.findOne({ $or: [
      { username: identifier }, { phone: normalizePhone(identifier) },
      { email: normalizeEmail(identifier) }, { contact: identifier }
    ] });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      recordAttempt(loginAttempts, attemptKey);
      return res.status(401).json({ ok: false, message: 'بيانات تسجيل الدخول غير صحيحة' });
    }
    if (user.status === 'pending') {
      return res.status(403).json({
        ok: false,
        status: 'pending_verification',
        contactVerified: Boolean(user.contactVerified),
        message: user.contactVerified ? 'الحساب بانتظار التفعيل' : 'يجب تأكيد البريد الإلكتروني أولاً'
      });
    }
    if (user.status === 'rejected') return res.status(403).json({ ok: false, status: 'rejected', message: user.rejectionReason ? 'تم رفض التسجيل: ' + user.rejectionReason : 'تم رفض طلب التسجيل' });
    if (user.status === 'blocked') return res.status(403).json({ ok: false, status: 'blocked', message: 'الحساب محظور' });
    if (user.status !== 'active') return res.status(403).json({ ok: false, message: 'الحساب غير فعال' });

    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    loginAttempts.delete(attemptKey);
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
