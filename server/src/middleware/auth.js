const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function resolveToken(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  if (payload.scope) throw new Error('Temporary token cannot authorize API access');
  const user = await User.findById(payload.userId);
  if (!user || user.status !== 'active') throw new Error('Account unavailable');
  if (payload.role && payload.role !== user.role) throw new Error('Role mismatch');
  return user;
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return res.status(401).json({ ok: false, message: 'غير مصرح' });
    const user = await resolveToken(header.slice(7));
    if (!user || user.status !== 'active') return res.status(401).json({ ok: false, message: 'الحساب غير متاح' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ ok: false, message: 'جلسة الدخول غير صالحة' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ ok: false, message: 'ليس لديك صلاحية لتنفيذ هذا الإجراء' });
    next();
  };
}
module.exports = { resolveToken, requireAuth, requireRole };
