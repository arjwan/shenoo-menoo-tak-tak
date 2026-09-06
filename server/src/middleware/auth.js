const jwt = require('jsonwebtoken');
const User = require('../models/User');

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
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(payload.userId);

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
  requireAuth,
  requireRole
};
