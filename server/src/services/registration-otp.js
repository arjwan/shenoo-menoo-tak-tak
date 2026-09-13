const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const DEFAULT_TTL_MINUTES = 10;
const DEFAULT_RESEND_SECONDS = 60;
const DEFAULT_MAX_ATTEMPTS = 5;

function integerEnv(name, fallback, minimum, maximum) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= minimum && value <= maximum ? value : fallback;
}

function otpPolicy() {
  return {
    ttlMs: integerEnv('OTP_TTL_MINUTES', DEFAULT_TTL_MINUTES, 2, 30) * 60 * 1000,
    resendMs: integerEnv('OTP_RESEND_SECONDS', DEFAULT_RESEND_SECONDS, 30, 600) * 1000,
    maxAttempts: integerEnv('OTP_MAX_ATTEMPTS', DEFAULT_MAX_ATTEMPTS, 3, 10)
  };
}

function otpSecret() {
  const secret = process.env.OTP_PEPPER || process.env.JWT_SECRET;
  if (!secret || secret.length < 24) throw new Error('OTP_PEPPER or JWT_SECRET must contain at least 24 characters');
  return secret;
}

function generateOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function hashOtp(userId, code) {
  return crypto.createHmac('sha256', otpSecret()).update(String(userId) + ':' + String(code)).digest('hex');
}

function matchesOtp(userId, code, expectedHash) {
  if (!/^\d{6}$/.test(String(code || '')) || !/^[a-f0-9]{64}$/.test(String(expectedHash || ''))) return false;
  const actual = Buffer.from(hashOtp(userId, code), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function inspectOtp(user, code, now = new Date()) {
  const policy = otpPolicy();
  if (user.contactVerified) return { ok: false, reason: 'verified' };
  if (!user.verificationCodeHash || !user.verificationCodeExpiresAt) return { ok: false, reason: 'missing' };
  if (new Date(user.verificationCodeExpiresAt).getTime() <= now.getTime()) return { ok: false, reason: 'expired' };
  if (Number(user.verificationAttempts || 0) >= policy.maxAttempts) return { ok: false, reason: 'locked' };
  return matchesOtp(user._id, code, user.verificationCodeHash)
    ? { ok: true, reason: 'valid' }
    : { ok: false, reason: 'mismatch' };
}

function createVerificationToken(user) {
  return jwt.sign(
    { userId: String(user._id), scope: 'registration-verification' },
    process.env.JWT_SECRET,
    { expiresIn: '20m' }
  );
}

function readVerificationToken(token) {
  const payload = jwt.verify(String(token || ''), process.env.JWT_SECRET);
  if (payload.scope !== 'registration-verification' || !payload.userId) throw new Error('Invalid verification scope');
  return payload;
}

function maskDestination(value, type) {
  const text = String(value || '');
  if (type === 'email') {
    const at = text.indexOf('@');
    if (at < 1) return '***';
    return text.slice(0, 2) + '***' + text.slice(at);
  }
  return text.length > 4 ? text.slice(0, 3) + '****' + text.slice(-4) : '***';
}

function emailHtml(code) {
  return '<div dir="rtl" style="font-family:Arial,sans-serif"><h2>تأكيد حساب شنو منو اتصال</h2><p>رمز التأكيد هو:</p><p style="font-size:30px;font-weight:bold;letter-spacing:8px">' + code + '</p><p>ينتهي الرمز خلال دقائق. لا تشاركه مع أي شخص.</p></div>';
}

function senderIdentity() {
  const email = String(process.env.OTP_FROM_EMAIL || '').trim();
  const name = String(process.env.OTP_FROM_NAME || 'شنو منو اتصال').trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('OTP sender email is not configured');
  return { email, name };
}

async function sendEmailOtp(email, code) {
  const brevoKey = process.env.BREVO_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const sender = senderIdentity();
  let response;

  if (brevoKey) {
    response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': brevoKey, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender,
        to: [{ email }],
        subject: 'رمز تأكيد حساب شنو منو اتصال',
        htmlContent: emailHtml(code)
      })
    });
  } else if (resendKey) {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + resendKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: sender.name + ' <' + sender.email + '>',
        to: [email],
        subject: 'رمز تأكيد حساب شنو منو اتصال',
        html: emailHtml(code)
      })
    });
  } else {
    throw new Error('Free email OTP provider is not configured');
  }

  if (!response.ok) throw new Error('Email OTP provider rejected the request');
}

async function deliverOtp(user, code) {
  const mode = String(process.env.OTP_DELIVERY_MODE || 'email').toLowerCase();
  if (process.env.NODE_ENV === 'test' && mode === 'test') return { mode: 'test' };
  if (mode !== 'email') throw new Error('Only email OTP delivery is enabled; SMS is intentionally disabled');
  await sendEmailOtp(user.email || user.contact, code);
  return { mode: 'email' };
}

function issueOtp(user, now = new Date()) {
  const code = generateOtp();
  user.verificationCodeHash = hashOtp(user._id, code);
  user.verificationCodeExpiresAt = new Date(now.getTime() + otpPolicy().ttlMs);
  user.verificationAttempts = 0;
  user.verificationLastSentAt = now;
  return code;
}

module.exports = {
  createVerificationToken,
  deliverOtp,
  generateOtp,
  hashOtp,
  inspectOtp,
  issueOtp,
  maskDestination,
  matchesOtp,
  otpPolicy,
  readVerificationToken
};
