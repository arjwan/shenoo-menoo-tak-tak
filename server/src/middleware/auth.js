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


// Signed, short-lived Cloudflare developer identity. This is accepted only
// when the Pages proxy and the Node origin share a separately configured secret.
async function resolveSchoolDeveloperBridge(req) {
  const secret = process.env.SCHOOL_DEVELOPER_BRIDGE_SECRET;
  if (!secret || secret.length < 32) return null;
  const value = req.headers['x-school-developer-bridge'];
  if (typeof value !== 'string' || value.length > 1500) return null;
  const parts = value.split('.');
  if (parts.length !== 2) return null;
  const crypto = require('node:crypto');
  const expected = crypto.createHmac('sha256', secret).update(parts[0]).digest('base64url');
  const received = Buffer.from(parts[1], 'base64url');
  const signature = Buffer.from(expected, 'base64url');
  if (received.length !== signature.length || !crypto.timingSafeEqual(received, signature)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); } catch { return null; }
  if (payload.aud !== 'sumer-school-developer' || payload.role !== 'developer' ||
      typeof payload.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(payload.id) ||
      !Number.isSafeInteger(payload.iat) || Math.abs(Date.now() - payload.iat) > 30000) return null;
  // The bridge does not issue MongoDB tokens or persist developer identities.
  const syntheticId = crypto.createHash('sha256').update('sumer-developer:'+payload.id).digest('hex').slice(0,24);
  return { id: syntheticId, _id: syntheticId, role: 'developer', status: 'active',
    username: payload.username || 'developer', fullName: payload.username || 'developer' };
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';

    const bridge = await resolveSchoolDeveloperBridge(req);
    if (bridge) { req.user = bridge; return next(); }
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
