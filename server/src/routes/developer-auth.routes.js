'use strict';
const express = require('express');
const auth = require('../mariadb/developer-auth');
const accounts = require('../mariadb/developer-accounts');
const { safeUser } = accounts;
const router = express.Router();
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.post('/login', async (req, res) => {
  try {
    const result = await auth.login(req.body?.identifier, req.body?.password, req.ip || req.socket.remoteAddress);
    if (result.status !== 200) {
      if (result.retryAfter) res.set('Retry-After', String(result.retryAfter));
      return res.status(result.status).json({ ok: false, message: result.status === 429 ? 'محاولات كثيرة، حاول لاحقاً' : 'بيانات دخول المطور غير صحيحة' });
    }
    const { status, ...body } = result;
    return res.json({ ok: true, ...body });
  } catch { return res.status(503).json({ ok: false, message: 'تعذر تسجيل الدخول. تحقق من إعداد MariaDB وترحيلات قاعدة البيانات.' }); }
});
const token = req => String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
router.get('/session', async (req, res) => {
  try { return res.json({ ok: true, user: safeUser(await auth.authenticate(token(req))) }); }
  catch { return res.status(401).json({ ok: false, message: 'جلسة غير صالحة أو منتهية' }); }
});
router.post('/logout', async (req, res) => {
  try { await auth.logout(token(req)); return res.json({ ok: true }); }
  catch { return res.status(401).json({ ok: false, message: 'جلسة غير صالحة أو منتهية' }); }
});
router.get('/me', async (req, res) => {
  let user;
  try { user = await auth.authenticate(token(req)); }
  catch { return res.status(401).json({ ok: false, message: 'جلسة غير صالحة أو منتهية' }); }
  try { return res.json({ ok: true, user: safeUser(user), security: await accounts.securitySummary(user._id) }); }
  catch { return res.status(503).json({ ok: false, message: 'تعذر قراءة بيانات الحساب' }); }
});
router.patch('/me', async (req, res) => {
  let user;
  try { user = await auth.authenticate(token(req)); }
  catch { return res.status(401).json({ ok: false, message: 'جلسة غير صالحة أو منتهية' }); }
  try { return res.json({ ok: true, user: safeUser(await accounts.updateProfile(user._id, req.body)) }); }
  catch (error) { return res.status(error.status || (error.code === 'ER_DUP_ENTRY' ? 409 : 503)).json({ ok: false, message: 'تعذر تحديث الحساب. تحقق من صحة البيانات وعدم تكرارها.' }); }
});
module.exports = router;
