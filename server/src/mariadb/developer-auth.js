'use strict';
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const database = require('./database');
const accounts = require('./developer-accounts');
const ISSUER = 'shenoo-menoo-api', AUDIENCE = 'developer', TTL_SECONDS = 900;
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
let dummy;
function secret() {
  const value = process.env.JWT_SECRET || '';
  if (Buffer.byteLength(value) < 32 || /change-this|replace-with/i.test(value)) throw new Error('A strong JWT_SECRET is required');
  return value;
}
async function reserveAttempt(ip) {
  const bucket = crypto.createHmac('sha256', secret()).update(String(ip)).digest('hex');
  return database.transaction(async c => {
    await c.execute('INSERT IGNORE INTO developer_login_attempts (bucket, attempts, window_start) VALUES (?, 0, CURRENT_TIMESTAMP(3))', [bucket]);
    const [[row]] = await c.execute('SELECT attempts, TIMESTAMPDIFF(SECOND, window_start, CURRENT_TIMESTAMP(3)) AS elapsed FROM developer_login_attempts WHERE bucket = ? FOR UPDATE', [bucket]);
    if (Number(row.elapsed) >= TTL_SECONDS) await c.execute('UPDATE developer_login_attempts SET attempts = 1, window_start = CURRENT_TIMESTAMP(3) WHERE bucket = ?', [bucket]);
    else {
      if (Number(row.attempts) >= 5) return { limited: true, retryAfter: Math.max(1, TTL_SECONDS - Number(row.elapsed)) };
      await c.execute('UPDATE developer_login_attempts SET attempts = attempts + 1 WHERE bucket = ?', [bucket]);
    }
    return { bucket, limited: false };
  });
}
async function login(identifier, password, ip) {
  secret();
  if (typeof identifier !== 'string' || typeof password !== 'string' || !identifier.trim() || identifier.length > 255 || !password || Buffer.byteLength(password) > 72) return { status: 400 };
  const attempt = await reserveAttempt(ip);
  if (attempt.limited) return { status: 429, retryAfter: attempt.retryAfter };
  const user = await accounts.byIdentity(identifier.trim().toLowerCase());
  dummy ||= bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
  const valid = await bcrypt.compare(password, user?.passwordHash || await dummy);
  if (!valid || user?.role !== 'developer' || user?.status !== 'active') return { status: 401 };
  const jti = crypto.randomBytes(32).toString('base64url');
  const token = jwt.sign({ userId: user._id, role: 'developer' }, secret(), { algorithm: 'HS256', issuer: ISSUER, audience: AUDIENCE, jwtid: jti, expiresIn: TTL_SECONDS });
  await database.transaction(async c => {
    const [[current]] = await c.execute('SELECT role, status, passwordHash FROM users WHERE _id = ? FOR UPDATE', [user._id]);
    if (!current || current.role !== 'developer' || current.status !== 'active' || current.passwordHash !== user.passwordHash) throw new Error('Account changed during authentication');
    await c.execute('DELETE FROM developer_sessions WHERE expires_at <= CURRENT_TIMESTAMP(3)');
    await c.execute('INSERT INTO developer_sessions (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL 900 SECOND))', [digest(jti), user._id]);
    await c.execute('DELETE FROM developer_login_attempts WHERE bucket = ?', [attempt.bucket]);
  });
  return { status: 200, token, expiresIn: TTL_SECONDS, user: accounts.safeUser(user), mfa: { temporarilyDisabled: true } };
}
async function authenticate(token) {
  const payload = jwt.verify(token, secret(), { algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE });
  if (payload.scope || !/^[a-f0-9]{24}$/.test(payload.userId) || typeof payload.jti !== 'string' || payload.role !== 'developer') throw new Error('Invalid developer session');
  const [rows] = await database.execute(`SELECT u._id, u.fullName, u.displayName, u.username, u.contact, u.contactType, u.phone, u.email, u.role, u.status
    FROM developer_sessions s JOIN users u ON u._id = s.user_id
    WHERE s.token_hash = ? AND s.user_id = ? AND s.expires_at > CURRENT_TIMESTAMP(3) AND u.role = 'developer' AND u.status = 'active'`, [digest(payload.jti), payload.userId]);
  if (!rows[0]) throw new Error('Developer session expired or revoked');
  return rows[0];
}
async function logout(token) {
  const payload = jwt.verify(token, secret(), { algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE });
  if (typeof payload.jti !== 'string') throw new Error('Invalid developer session');
  await database.execute('DELETE FROM developer_sessions WHERE token_hash = ? AND user_id = ?', [digest(payload.jti), payload.userId]);
}
module.exports = { login, authenticate, logout, TTL_SECONDS };
