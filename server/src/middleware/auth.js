const jwt = require('jsonwebtoken');
async function resolveToken(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  if (payload.scope) throw new Error('Temporary token cannot authorize API access');
  if (payload.aud === 'developer') return require('../mariadb/developer-auth').authenticate(token);
  if (payload.role === 'developer') throw new Error('A native developer session is required');
  const user = await require('../models/User').findById(payload.userId);
  if (!user || user.status !== 'active' || user.role === 'developer') throw new Error('Account unavailable or developer session required');
  return user;
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';

    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({
        ok: false,
        message: 'غير مصرح'
      });
    }

    const token = header.slice(7);
    const user = await resolveToken(token);

    if (!user || user.status !== 'active') {
      return res.status(401).json({
        ok: false,
        message: 'الحساب غير متاح'
      });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({
      ok: false,
      message: 'جلسة الدخول غير صالحة'
    });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        ok: false,
        message: 'ليس لديك صلاحية لتنفيذ هذا الإجراء'
      });
    }

    next();
  };
}

module.exports = {
  resolveToken,
  requireAuth,
  requireRole
};
