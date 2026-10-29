'use strict';

const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const database = require('./database');
const fields = '_id, fullName, username, contact, contactType, phone, email, passwordHash, role, status, displayName, createdAt, updatedAt';
function validateSetup(env) {
  const username = String(env.DEVELOPER_USERNAME || '').trim().toLowerCase();
  const contact = String(env.DEVELOPER_CONTACT || '').trim().toLowerCase();
  const fullName = String(env.DEVELOPER_NAME || 'Platform Developer').trim();
  const password = String(env.DEVELOPER_PASSWORD || '');
  if (!/^[\p{L}\p{M}0-9_.]{3,30}$/u.test(username) || !fullName || fullName.length > 100 ||
      !(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) || /^07\d{9}$/.test(contact)) || contact.length > 255 ||
      Buffer.byteLength(password) < 12 || Buffer.byteLength(password) > 72 || /^(CHANGE_ME_NOW|password.*)$/i.test(password)) {
    throw new Error('Invalid developer setup. Supply a valid identity and a unique password of 12–72 UTF-8 bytes.');
  }
  return { username, contact, fullName, password };
}
async function byIdentity(identifier) {
  const [rows] = await database.execute(`SELECT ${fields} FROM users WHERE username = ? OR contact = ? LIMIT 2`, [identifier, identifier]);
  return rows.length === 1 ? rows[0] : null;
}
async function byId(id) {
  const [rows] = await database.execute(`SELECT ${fields} FROM users WHERE _id = ?`, [id]);
  return rows[0] || null;
}
async function provision(env = process.env, recover = false) {
  const input = validateSetup(env);
  const passwordHash = await bcrypt.hash(input.password, 12);
  return database.transaction(async connection => {
    // Serialize privileged account provisioning across processes, including an
    // empty users table, so identity collisions never promote an ordinary user.
    const [[{ acquired }]] = await connection.execute("SELECT GET_LOCK('native_developer_provision', 10) AS acquired");
    if (Number(acquired) !== 1) throw new Error('Developer provisioning is already running');
    try {
      const [rows] = await connection.execute(`SELECT ${fields} FROM users WHERE username = ? OR contact = ? FOR UPDATE`, [input.username, input.contact]);
      if (rows.length > 1 || (rows[0] && (rows[0].username !== input.username || rows[0].contact !== input.contact || rows[0].role !== 'developer'))) {
        throw new Error('Identity collision. Existing accounts are never promoted or renamed by this command.');
      }
      if (rows[0]) {
        const user = rows[0];
        if (!recover) return { id: user._id, action: 'unchanged' };
        if (env.DEVELOPER_RECOVERY_USER_ID !== user._id || user.status !== 'active') {
          throw new Error('Recovery requires the exact existing active developer ID.');
        }
        await connection.execute('UPDATE users SET passwordHash = ?, updatedAt = CURRENT_TIMESTAMP(3), __v = COALESCE(__v, 0) + 1 WHERE _id = ? AND role = ? AND status = ?', [passwordHash, user._id, 'developer', 'active']);
        await connection.execute('DELETE FROM developer_sessions WHERE user_id = ?', [user._id]);
        return { id: user._id, action: 'recovered' };
      }
      if (recover || env.DEVELOPER_BOOTSTRAP !== 'allow-new-developer') throw new Error('Explicit DEVELOPER_BOOTSTRAP=allow-new-developer is required for a new privileged account.');
      const id = crypto.randomBytes(12).toString('hex');
      await connection.execute(`INSERT INTO users
        (_id, fullName, username, contact, contactType, passwordHash, termsAccepted, role, status, createdAt, updatedAt, __v)
        VALUES (?, ?, ?, ?, ?, ?, TRUE, 'developer', 'active', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3), 0)`,
      [id, input.fullName, input.username, input.contact, input.contact.includes('@') ? 'email' : 'phone', passwordHash]);
      return { id, action: 'created' };
    } finally { await connection.query("SELECT RELEASE_LOCK('native_developer_provision')"); }
  });
}
function safeUser(user) {
  return { id: user._id, fullName: user.fullName, displayName: user.displayName || user.fullName, username: user.username,
    contact: user.contact, contactType: user.contactType, phone: user.phone || '', email: user.email || '', role: user.role, status: user.status };
}
async function updateProfile(id, body) {
  const fullName = String(body.fullName || '').trim();
  const phone = String(body.phone || '').replace(/\s+/g, '');
  const email = String(body.email || '').trim().toLowerCase();
  if (!fullName || fullName.length > 100 || !/^07\d{9}$/.test(phone) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
    const error = new Error('Invalid profile'); error.status = 400; throw error;
  }
  let passwordHash;
  if (body.password) {
    const length = Buffer.byteLength(String(body.password));
    if (length < 12 || length > 72) { const error = new Error('Password must be 12–72 UTF-8 bytes'); error.status = 400; throw error; }
    passwordHash = await bcrypt.hash(String(body.password), 12);
  }
  await database.transaction(async c => {
    const [[user]] = await c.execute('SELECT role, status FROM users WHERE _id = ? FOR UPDATE', [id]);
    if (user?.role !== 'developer' || user.status !== 'active') throw new Error('Developer unavailable');
    const [duplicates] = await c.execute('SELECT _id FROM users WHERE _id <> ? AND (phone = ? OR email = ? OR contact = ? OR contact = ?) LIMIT 1', [id, phone, email, phone, email]);
    if (duplicates.length) { const error = new Error('Identity already in use'); error.status = 409; throw error; }
    await c.execute(`UPDATE users SET fullName = ?, phone = ?, email = ?, contact = ?, contactType = 'phone', updatedAt = CURRENT_TIMESTAMP(3), __v = COALESCE(__v, 0) + 1${passwordHash ? ', passwordHash = ?' : ''} WHERE _id = ?`,
      [fullName, phone, email, phone, ...(passwordHash ? [passwordHash] : []), id]);
    if (passwordHash) await c.execute('DELETE FROM developer_sessions WHERE user_id = ?', [id]);
    await c.execute(`INSERT INTO auditlogs (_id, actor, action, target, details, createdAt, updatedAt) VALUES (?, ?, 'developer.profile.updated', ?, 'Developer updated own profile', NOW(3), NOW(3))`, [crypto.randomBytes(12).toString('hex'), id, id]);
  });
  return byId(id);
}
async function securitySummary(id) {
  const [rows] = await database.execute(`SELECT m.pairedPhone, m.phoneSecretHash,
    (SELECT COUNT(*) FROM developermfas__credentials c WHERE c.parent_id = m._id) AS keysCount
    FROM developermfas m WHERE m.user = ? LIMIT 1`, [id]);
  return { temporarilyDisabled: true, phonePaired: Boolean(rows[0]?.phoneSecretHash), fidoKeys: Number(rows[0]?.keysCount || 0), pairedPhone: rows[0]?.pairedPhone || '' };
}
module.exports = { byIdentity, byId, provision, safeUser, validateSetup, updateProfile, securitySummary };
