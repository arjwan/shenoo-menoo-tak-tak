const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-otp';
process.env.OTP_PEPPER = 'independent-test-pepper-long-enough';
process.env.OTP_MAX_ATTEMPTS = '5';

const {
  createVerificationToken,
  generateOtp,
  hashOtp,
  inspectOtp,
  maskDestination,
  matchesOtp,
  readVerificationToken
} = require('../src/services/registration-otp');

test('OTP is always a six digit random value', () => {
  for (let index = 0; index < 100; index += 1) assert.match(generateOtp(), /^\d{6}$/);
});

test('OTP hash validates without storing plaintext', () => {
  const userId = '507f1f77bcf86cd799439011';
  const code = '042731';
  const digest = hashOtp(userId, code);
  assert.equal(digest.length, 64);
  assert.equal(digest.includes(code), false);
  assert.equal(matchesOtp(userId, code, digest), true);
  assert.equal(matchesOtp(userId, '042732', digest), false);
});

test('OTP inspection enforces expiry and attempt lockout', () => {
  const now = new Date('2026-09-12T12:00:00.000Z');
  const user = {
    _id: '507f1f77bcf86cd799439011',
    contactVerified: false,
    verificationCodeHash: hashOtp('507f1f77bcf86cd799439011', '123456'),
    verificationCodeExpiresAt: new Date(now.getTime() + 60000),
    verificationAttempts: 0
  };
  assert.deepEqual(inspectOtp(user, '123456', now), { ok: true, reason: 'valid' });
  assert.deepEqual(inspectOtp(user, '000000', now), { ok: false, reason: 'mismatch' });
  user.verificationAttempts = 5;
  assert.deepEqual(inspectOtp(user, '123456', now), { ok: false, reason: 'locked' });
  user.verificationAttempts = 0;
  assert.deepEqual(inspectOtp(user, '123456', new Date(now.getTime() + 61000)), { ok: false, reason: 'expired' });
});

test('verification token has a restricted registration scope', () => {
  const token = createVerificationToken({ _id: '507f1f77bcf86cd799439011' });
  const payload = readVerificationToken(token);
  assert.equal(payload.userId, '507f1f77bcf86cd799439011');
  assert.equal(payload.scope, 'registration-verification');
});

test('OTP destination is masked before returning it', () => {
  assert.equal(maskDestination('person@example.com', 'email'), 'pe***@example.com');
  assert.equal(maskDestination('07801234567', 'phone'), '078****4567');
});
