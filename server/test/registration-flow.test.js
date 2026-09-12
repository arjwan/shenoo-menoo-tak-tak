const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'integration-jwt-secret-long-enough-2026';
process.env.OTP_PEPPER = 'integration-otp-pepper-long-enough-2026';
process.env.OTP_DELIVERY_MODE = 'email';

const realOtp = require('../src/services/registration-otp');
let deliveredCode = '';
const users = [];

function valueMatches(user, condition) {
  return Object.entries(condition).every(([key, value]) => String(user[key] ?? '') === String(value));
}
function queryMatches(user, query) {
  if (query.$or && !query.$or.some((condition) => valueMatches(user, condition))) return false;
  return Object.entries(query)
    .filter(([key]) => key !== '$or')
    .every(([key, value]) => String(user[key] ?? '') === String(value));
}

class FakeUser {
  constructor(fields) {
    Object.assign(this, fields);
    this._id = 'user-' + (users.length + 1);
    this.isNew = true;
  }
  async save() {
    if (this.isNew) {
      users.push(this);
      this.isNew = false;
    }
    return this;
  }
  static async findOne(query) {
    return users.find((user) => queryMatches(user, query)) || null;
  }
}

const userModule = require.resolve('../src/models/User');
const otpModule = require.resolve('../src/services/registration-otp');
require.cache[userModule] = { id: userModule, filename: userModule, loaded: true, exports: FakeUser };
require.cache[otpModule] = {
  id: otpModule,
  filename: otpModule,
  loaded: true,
  exports: {
    ...realOtp,
    async deliverOtp(_user, code) { deliveredCode = code; return { mode: 'mock-email' }; }
  }
};
delete require.cache[require.resolve('../src/routes/auth.routes')];
const authRouter = require('../src/routes/auth.routes');

async function post(baseUrl, path, body) {
  const response = await fetch(baseUrl + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { response, data: await response.json() };
}

test('registration stays disabled until a valid OTP then permits sign in', async (t) => {
  users.length = 0;
  deliveredCode = '';
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port;

  const credentials = {
    fullName: 'مستخدم اختبار',
    username: 'otp_user',
    phone: '07801234567',
    email: 'otp@example.com',
    birthDate: '1990-01-01',
    gender: 'other',
    password: 'StrongPass123!',
    confirmPassword: 'StrongPass123!',
    termsAccepted: true,
    privacyAccepted: true
  };

  const signup = await post(baseUrl, '/api/auth/signup', credentials);
  assert.equal(signup.response.status, 201);
  assert.equal(signup.data.status, 'pending_verification');
  assert.equal(signup.data.verificationRequired, true);
  assert.ok(signup.data.verificationToken);
  assert.match(deliveredCode, /^\d{6}$/);
  assert.equal(users.length, 1);
  assert.equal(users[0].status, 'pending');
  assert.equal(users[0].contactVerified, false);
  assert.notEqual(users[0].verificationCodeHash, deliveredCode);
  assert.equal(Object.hasOwn(signup.data, 'testCode'), false);

  const earlySignin = await post(baseUrl, '/api/auth/signin', {
    identifier: credentials.username,
    password: credentials.password
  });
  assert.equal(earlySignin.response.status, 403);
  assert.equal(earlySignin.data.status, 'pending_verification');

  const wrong = await post(baseUrl, '/api/auth/verify-registration', {
    verificationToken: signup.data.verificationToken,
    code: '000000'
  });
  assert.equal(wrong.response.status, 400);
  assert.equal(users[0].verificationAttempts, 1);

  const resendTooSoon = await post(baseUrl, '/api/auth/resend-verification', {
    verificationToken: signup.data.verificationToken
  });
  assert.equal(resendTooSoon.response.status, 429);

  const verify = await post(baseUrl, '/api/auth/verify-registration', {
    verificationToken: signup.data.verificationToken,
    code: deliveredCode
  });
  assert.equal(verify.response.status, 200);
  assert.equal(verify.data.status, 'active');
  assert.equal(users[0].status, 'active');
  assert.equal(users[0].contactVerified, true);
  assert.equal(users[0].verificationCodeHash, '');

  const signin = await post(baseUrl, '/api/auth/signin', {
    identifier: credentials.email,
    password: credentials.password
  });
  assert.equal(signin.response.status, 200);
  assert.equal(signin.data.ok, true);
  assert.ok(signin.data.token);
});
