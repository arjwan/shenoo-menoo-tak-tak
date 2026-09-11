const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { requireAuth, requireRole } = require('../middleware/auth');
const User = require('../models/User');
const Store = require('../models/Store');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const FriendRequest = require('../models/FriendRequest');
const GameRoom = require('../models/GameRoom');
const Group = require('../models/Group');
const GroupReport = require('../models/GroupReport');
const AuditLog = require('../models/AuditLog');

const router = express.Router();

const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;

function loginRateLimit(ip) {
  const now = Date.now();
  const current = loginAttempts.get(ip);
  if (!current || now - current.startedAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { startedAt: now, attempts: 0 });
    return false;
  }
  return current.attempts >= LOGIN_MAX_ATTEMPTS;
}

function recordLoginFailure(ip) {
  const current = loginAttempts.get(ip) || { startedAt: Date.now(), attempts: 0 };
  current.attempts += 1;
  loginAttempts.set(ip, current);
}

router.post('/login', async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (loginRateLimit(ip)) {
    return res.status(429).json({ ok: false, message: 'محاولات تسجيل الدخول كثيرة، حاول لاحقًا' });
  }

  try {
    const identifier = String(req.body.identifier || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!identifier || !password) {
      return res.status(400).json({ ok: false, message: 'أدخل اسم المستخدم وكلمة المرور' });
    }

    const user = await User.findOne({
      role: 'developer',
      status: 'active',
      $or: [{ username: identifier }, { contact: identifier }]
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      recordLoginFailure(ip);
      return res.status(401).json({ ok: false, message: 'بيانات دخول المطور غير صحيحة' });
    }

    loginAttempts.delete(ip);
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    return res.json({ ok: true, message: 'تم تسجيل دخول المطور', token, user: safeUser(user) });
  } catch (error) {
    console.error('Developer login failed:', error.message);
    return res.status(500).json({ ok: false, message: 'تعذر تسجيل دخول المطور' });
  }
});

router.use(requireAuth);
router.use(requireRole('developer'));

const safeUser = (user) => ({
  id: user._id,
  fullName: user.fullName,
  displayName: user.displayName || user.fullName,
  username: user.username,
  contact: user.contact,
  contactType: user.contactType,
  phone: user.phone || (user.contactType === 'phone' ? user.contact : ''),
  email: user.email || (user.contactType === 'email' ? user.contact : ''),
  birthDate: user.birthDate,
  gender: user.gender,
  role: user.role,
  status: user.status,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

function contactType(contact) {
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return 'email';
  if (/^07\d{9}$/.test(contact)) return 'phone';
  return null;
}

async function writeAudit(actor, action, target, details = '') {
  await AuditLog.create({ actor: actor._id, action, target: target?._id || null, details });
}

async function countOptionalCollection(names) {
  const collections = await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray();
  const available = new Set(collections.map((collection) => collection.name));
  const collectionName = names.find((name) => available.has(name));
  return collectionName ? mongoose.connection.db.collection(collectionName).countDocuments() : 0;
}

async function getDashboardStats() {
  const [
    users,
    pendingUsers,
    pendingStores,
    online,
    rooms,
    conversations,
    stores,
    ads,
    subscriptions,
    reports,
    roomReports,
    muted,
    blocked
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ status: 'pending' }),
    Store.countDocuments({ status: 'pending' }),
    User.countDocuments({ status: 'active', 'profile.online': true }),
    GameRoom.countDocuments({ 'gameState.status': { $in: ['waiting', 'active'] } }),
    Conversation.countDocuments(),
    Store.countDocuments(),
    countOptionalCollection(['ads', 'advertisements']),
    countOptionalCollection(['subscriptions']),
    countOptionalCollection(['reports', 'userreports']),
    GroupReport.countDocuments({ status: { $in: ['open', 'reviewing'] } }),
    countOptionalCollection(['mutes', 'mutedusers']),
    User.countDocuments({ 'blockedUsers.0': { $exists: true } })
  ]);

  return {
    users,
    pending: pendingUsers + pendingStores,
    pendingUsers,
    pendingStores,
    online,
    rooms,
    conversations,
    stores,
    ads,
    subscriptions,
    reports: reports + roomReports,
    muted,
    blocked,
    activeChats: conversations
  };
}

router.get('/me', (req, res) => res.json({ ok: true, user: safeUser(req.user) }));

router.get('/stats', async (req, res) => {
  try {
    return res.json({ ok: true, stats: await getDashboardStats() });
  } catch (error) {
    console.error('Developer stats failed:', error.message);
    return res.status(500).json({ ok: false, message: 'تعذر تحميل إحصاءات لوحة المطور' });
  }
});

router.get('/dashboard', async (req, res) => {
  try {
    const [stats, recentRequests] = await Promise.all([
      getDashboardStats(),
      User.find({ status: 'pending' }).select('fullName username contact createdAt').sort({ createdAt: -1 }).limit(10).lean()
    ]);

    return res.json({
      ok: true,
      stats,
      services: { api: 'online', database: 'online', socket: 'online' },
      recentRequests
    });
  } catch (error) {
    console.error('Developer dashboard failed:', error.message);
    return res.status(500).json({ ok: false, message: 'تعذر تحميل لوحة المطور' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || '').trim();
    const filter = { role: 'user' };
    if (['pending', 'active', 'rejected', 'blocked'].includes(status)) filter.status = status;
    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(escaped, 'iu');
      filter.$or = [{ fullName: rx }, { username: rx }, { phone: rx }, { email: rx }, { contact: rx }];
    }
    const users = await User.find(filter).select('-passwordHash -blockedUsers -phoneVisibleTo').sort({ createdAt: -1 }).limit(500);
    return res.json({ ok: true, users: users.map(safeUser) });
  } catch (error) {
    console.error('Developer users failed:', error.message);
    return res.status(500).json({ ok: false, message: 'تعذر تحميل المستخدمين' });
  }
});

router.post('/users', async (req, res) => {
  try {
    const fullName=String(req.body.fullName||'').trim(),username=String(req.body.username||'').trim().toLowerCase();
    const phone=String(req.body.phone||'').replace(/\s+/g,''),email=String(req.body.email||'').trim().toLowerCase(),password=String(req.body.password||'');
    if(!fullName||!/^[a-z0-9_]{3,30}$/.test(username)) return res.status(400).json({ok:false,message:'الاسم أو اسم المستخدم غير صالح'});
    if(!/^07\d{9}$/.test(phone)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ok:false,message:'الهاتف والبريد الإلكتروني الصحيحان مطلوبان'});
    if(password.length<8)return res.status(400).json({ok:false,message:'كلمة المرور يجب أن تكون 8 أحرف على الأقل'});
    if(await User.exists({$or:[{username},{phone},{email},{contact:phone},{contact:email}]}))return res.status(409).json({ok:false,message:'اسم المستخدم أو الهاتف أو البريد مستخدم مسبقاً'});
    const user=await User.create({fullName,username,phone,email,contact:phone,contactType:'phone',passwordHash:await bcrypt.hash(password,12),termsAccepted:true,privacyAccepted:true,privacyAcceptedAt:new Date(),privacyVersion:'2026-09-11',contactVerified:true,contactVerifiedAt:new Date(),contactVerifiedBy:req.user._id,notificationPreferences:{inApp:true,phone:true,email:true},role:'user',status:'active'});
    await writeAudit(req.user,'user.created',user,`أنشأ حساب ${user.username}`);
    return res.status(201).json({ok:true,message:'تم إنشاء الحساب وتفعيله',user:safeUser(user)});
  } catch(error){console.error('Developer create user failed:',error.message);return res.status(500).json({ok:false,message:'تعذر إنشاء الحساب'});}
});

router.patch('/users/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ ok: false, message: 'معرف المستخدم غير صالح' });
    const user = await User.findOne({ _id: req.params.id, role: 'user' });
    if (!user) return res.status(404).json({ ok: false, message: 'المستخدم غير موجود' });
    const fullName = String(req.body.fullName ?? user.fullName).trim();
    const username = String(req.body.username ?? user.username).trim().toLowerCase();
    const phone = String(req.body.phone ?? user.phone ?? '').replace(/\s+/g, '');
    const email = String(req.body.email ?? user.email ?? '').trim().toLowerCase();
    const gender = String(req.body.gender ?? user.gender ?? 'other');
    const status = String(req.body.status ?? user.status);
    if (!fullName || !/^[\p{L}\p{M}][\p{L}\p{M} .'-]{1,99}$/u.test(fullName)) return res.status(400).json({ ok: false, message: 'الاسم الكامل غير صالح' });
    if (!/^[\p{L}\p{M}0-9_.]{3,30}$/u.test(username)) return res.status(400).json({ ok: false, message: 'اسم المستخدم غير صالح' });
    if (!/^07\d{9}$/.test(phone)) return res.status(400).json({ ok: false, message: 'رقم الهاتف غير صالح' });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ ok: false, message: 'البريد الإلكتروني غير صالح' });
    if (!['male', 'female', 'other'].includes(gender)) return res.status(400).json({ ok: false, message: 'الجنس غير صالح' });
    if (!['pending', 'active', 'rejected', 'blocked'].includes(status)) return res.status(400).json({ ok: false, message: 'حالة الحساب غير صالحة' });
    const duplicate = await User.findOne({ _id: { $ne: user._id }, $or: [{ username }, { phone }, { contact: phone }, ...(email ? [{ email }, { contact: email }] : [])] });
    if (duplicate) return res.status(409).json({ ok: false, message: 'اسم المستخدم أو الهاتف أو البريد مستخدم مسبقاً' });
    let birthDate = user.birthDate;
    if (req.body.birthDate !== undefined) {
      birthDate = req.body.birthDate ? new Date(`${String(req.body.birthDate).slice(0, 10)}T00:00:00.000Z`) : null;
      if (birthDate && Number.isNaN(birthDate.getTime())) return res.status(400).json({ ok: false, message: 'تاريخ الميلاد غير صالح' });
    }
    Object.assign(user, { fullName, username, phone, email, contact: phone, contactType: 'phone', birthDate, gender, status });
    if (req.body.password) {
      const password = String(req.body.password);
      if (password.length < 8) return res.status(400).json({ ok: false, message: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل' });
      user.passwordHash = await bcrypt.hash(password, 12);
    }
    if (status !== 'rejected') user.rejectionReason = '';
    await user.save();
    await writeAudit(req.user, 'developer.user.updated', user, `تعديل حساب ${username} — ${status}`);
    return res.json({ ok: true, message: 'تم تحديث معلومات المستخدم', user: safeUser(user) });
  } catch (error) {
    console.error('Developer user update failed:', error.message);
    return res.status(500).json({ ok: false, message: 'تعذر تحديث المستخدم' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ ok: false, message: 'معرف المستخدم غير صالح' });
    const user = await User.findOne({ _id: req.params.id, role: 'user' });
    if (!user) return res.status(404).json({ ok: false, message: 'المستخدم غير موجود' });
    await writeAudit(req.user, 'developer.user.deleted', user, `حذف حساب ${user.username}`);
    const conversations = await Conversation.find({ participants: user._id }).select('_id').lean();
    const conversationIds = conversations.map((item) => item._id);
    await Promise.all([
      Message.deleteMany({ $or: [{ sender: user._id }, { conversation: { $in: conversationIds } }] }),
      Conversation.deleteMany({ _id: { $in: conversationIds } }),
      FriendRequest.deleteMany({ $or: [{ sender: user._id }, { receiver: user._id }] }),
      Group.updateMany({}, { $pull: { members: user._id, admins: user._id, moderators: user._id, pendingMembers: user._id, bannedMembers: user._id } }),
      User.updateMany({ blockedUsers: user._id }, { $pull: { blockedUsers: user._id } })
    ]);
    await User.deleteOne({ _id: user._id });
    return res.json({ ok: true, message: 'تم حذف المستخدم وبيانات محادثاته' });
  } catch (error) {
    console.error('Developer user delete failed:', error.message);
    return res.status(500).json({ ok: false, message: 'تعذر حذف المستخدم' });
  }
});

router.get('/approvals', async (req, res) => {
  try {
    const [users, stores] = await Promise.all([
      User.find({ status: 'pending' })
        .select('fullName displayName username contact createdAt status')
        .sort({ createdAt: -1 })
        .lean(),
      Store.find({ status: 'pending' })
        .populate('owner', 'fullName displayName username contact')
        .sort({ createdAt: -1 })
        .lean()
    ]);

    const userApprovals = users.map((user) => ({
      id: user._id,
      applicant: user.fullName || user.displayName || user.username,
      username: user.username,
      contact: user.contact,
      type: 'user',
      typeLabel: 'تسجيل مستخدم',
      details: 'طلب تسجيل حساب جديد',
      createdAt: user.createdAt,
      status: user.status
    }));

    const storeApprovals = stores.map((store) => ({
      id: store._id,
      applicant: store.owner?.fullName || store.owner?.displayName || store.owner?.username || store.name,
      username: store.owner?.username || store.name,
      contact: store.owner?.contact || store.phone || '',
      type: 'store',
      typeLabel: 'متجر',
      details: `${store.name} — ${store.category} — ${store.governorate}/${store.area} — الباقة: ${store.plan}`,
      createdAt: store.createdAt,
      status: store.status
    }));

    const approvals = [...userApprovals, ...storeApprovals].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.json({
      ok: true,
      approvals,
      users: userApprovals,
      stores: storeApprovals,
      consultants: [],
      serviceProviders: [],
      advertisements: [],
      businessAccounts: []
    });
  } catch (error) {
    console.error('Developer approvals failed:', error.message);
    return res.status(500).json({ ok: false, message: 'تعذر تحميل طلبات الموافقة' });
  }
});

router.patch('/approvals/:id/:decision', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ ok: false, message: 'معرف الطلب غير صالح' });
    }
    if (!['approve', 'reject'].includes(req.params.decision)) {
      return res.status(400).json({ ok: false, message: 'قرار المراجعة غير صالح' });
    }

    const reason = String(req.body.reason || '').trim();
    if (req.params.decision === 'reject' && !reason) {
      return res.status(400).json({ ok: false, message: 'سبب الرفض مطلوب' });
    }

    const user = await User.findOne({ _id: req.params.id, status: 'pending' });
    if (user) {
      user.status = req.params.decision === 'approve' ? 'active' : 'rejected';
      user.rejectionReason = req.params.decision === 'reject' ? reason : '';
      user.reviewedBy = req.user._id;
      user.reviewedAt = new Date();
      await user.save();
      await writeAudit(req.user, `approval.user.${req.params.decision}`, user, reason || `تم ${req.params.decision === 'approve' ? 'قبول' : 'رفض'} تسجيل ${user.username}`);
      return res.json({
        ok: true,
        message: req.params.decision === 'approve' ? 'تم قبول طلب التسجيل' : 'تم رفض طلب التسجيل',
        approval: { id: user._id, type: 'user', status: user.status }
      });
    }

    const store = await Store.findOne({ _id: req.params.id, status: 'pending' });
    if (store) {
      store.status = req.params.decision === 'approve' ? 'approved' : 'rejected';
      store.rejectionReason = req.params.decision === 'reject' ? reason : '';
      await store.save();
      await writeAudit(req.user, `approval.store.${req.params.decision}`, null, reason || `تم ${req.params.decision === 'approve' ? 'قبول' : 'رفض'} متجر ${store.name}`);
      return res.json({
        ok: true,
        message: req.params.decision === 'approve' ? 'تم قبول المتجر وتفعيله' : 'تم رفض طلب المتجر',
        approval: { id: store._id, type: 'store', status: store.status }
      });
    }

    return res.status(404).json({ ok: false, message: 'الطلب غير موجود أو تمت مراجعته مسبقًا' });
  } catch (error) {
    console.error('Developer approval decision failed:', error.message);
    return res.status(500).json({ ok: false, message: 'تعذر تنفيذ قرار الموافقة' });
  }
});

router.get('/admins', async (req, res) => {
  const admins = await User.find({ role: { $in: ['admin', 'developer'] } }).select('-passwordHash').sort({ role: 1, createdAt: -1 }).lean();
  res.json({ ok: true, admins: admins.map(safeUser) });
});

router.post('/admins', async (req, res) => {
  try {
    const fullName = String(req.body.fullName || '').trim();
    const username = String(req.body.username || '').trim().toLowerCase();
    const contact = String(req.body.contact || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!fullName || !/^[a-z0-9_]{3,30}$/.test(username) || !contactType(contact) || password.length < 8) {
      return res.status(400).json({ ok: false, message: 'أدخل اسمًا واسم مستخدم ووسيلة اتصال وكلمة مرور صحيحة' });
    }
    if (await User.exists({ $or: [{ username }, { contact }] })) {
      return res.status(409).json({ ok: false, message: 'اسم المستخدم أو وسيلة الاتصال مستخدمة مسبقًا' });
    }
    const admin = await User.create({
      fullName, username, contact, contactType: contactType(contact),
      passwordHash: await bcrypt.hash(password, 12), termsAccepted: true,
      role: 'admin', status: 'active'
    });
    await writeAudit(req.user, 'admin.created', admin, `أنشأ ${admin.username}`);
    return res.status(201).json({ ok: true, admin: safeUser(admin) });
  } catch (error) {
    console.error('Create admin failed:', error.message);
    return res.status(500).json({ ok: false, message: 'تعذر إنشاء المسؤول' });
  }
});

router.patch('/admins/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ ok: false, message: 'معرف المسؤول غير صالح' });
    const admin = await User.findOne({ _id: req.params.id, role: 'admin' });
    if (!admin) return res.status(404).json({ ok: false, message: 'المسؤول غير موجود' });
    const allowed = ['fullName', 'username', 'contact', 'status'];
    const updates = {};
    allowed.forEach((key) => { if (req.body[key] !== undefined) updates[key] = String(req.body[key]).trim(); });
    if (updates.username && !/^[a-z0-9_]{3,30}$/.test(updates.username.toLowerCase())) return res.status(400).json({ ok: false, message: 'اسم المستخدم غير صالح' });
    if (updates.contact && !contactType(updates.contact.toLowerCase())) return res.status(400).json({ ok: false, message: 'وسيلة الاتصال غير صالحة' });
    if (updates.status && !['active', 'blocked'].includes(updates.status)) return res.status(400).json({ ok: false, message: 'حالة المسؤول غير صالحة' });
    if (updates.username) updates.username = updates.username.toLowerCase();
    if (updates.contact) { updates.contact = updates.contact.toLowerCase(); updates.contactType = contactType(updates.contact); }
    if (req.body.password !== undefined) {
      if (String(req.body.password).length < 8) return res.status(400).json({ ok: false, message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });
      updates.passwordHash = await bcrypt.hash(String(req.body.password), 12);
    }
    const duplicateChecks = [];
    if (updates.username) duplicateChecks.push({ username: updates.username });
    if (updates.contact) duplicateChecks.push({ contact: updates.contact });
    if (duplicateChecks.length && await User.findOne({ $or: duplicateChecks, _id: { $ne: admin._id } })) {
      return res.status(409).json({ ok: false, message: 'اسم المستخدم أو وسيلة الاتصال مستخدمة مسبقًا' });
    }
    Object.assign(admin, updates);
    await admin.save();
    await writeAudit(req.user, 'admin.updated', admin, `حدّث ${admin.username}`);
    return res.json({ ok: true, admin: safeUser(admin) });
  } catch (error) {
    console.error('Update admin failed:', error.message);
    return res.status(500).json({ ok: false, message: 'تعذر تحديث المسؤول' });
  }
});

router.get('/audit', async (req, res) => {
  const entries = await AuditLog.find().populate('actor', 'fullName username role').populate('target', 'fullName username role').sort({ createdAt: -1 }).limit(100).lean();
  res.json({
    ok: true,
    audit: entries.map((entry) => ({
      id: entry._id, action: entry.action, details: entry.details, createdAt: entry.createdAt,
      actor: entry.actor ? { id: entry.actor._id, fullName: entry.actor.fullName, username: entry.actor.username, role: entry.actor.role } : null,
      target: entry.target ? { id: entry.target._id, fullName: entry.target.fullName, username: entry.target.username, role: entry.target.role } : null
    }))
  });
});

router.get('/rooms', async (req, res) => {
  const rooms = await Group.find().populate('owner', 'fullName displayName username').sort({ updatedAt: -1 }).limit(200).lean();
  res.json({ ok: true, rooms: rooms.map(room => ({ id: room._id, name: room.name, roomType: room.roomType, privacy: room.privacy, isOfficial: room.isOfficial, isLive: room.isLive, isLocked: room.isLocked, isActive: room.isActive, memberCount: room.members?.length || 0, owner: room.owner ? { id: room.owner._id, fullName: room.owner.displayName || room.owner.fullName, username: room.owner.username } : null })) });
});

router.patch('/rooms/:id', async (req, res) => {
  const room = await Group.findById(req.params.id);
  if (!room) return res.status(404).json({ ok: false, message: 'الغرفة غير موجودة' });
  if (req.body.isActive !== undefined) room.isActive = Boolean(req.body.isActive);
  if (req.body.isLocked !== undefined) room.isLocked = Boolean(req.body.isLocked);
  if (req.body.isOfficial !== undefined) room.isOfficial = Boolean(req.body.isOfficial);
  if (req.body.ownerId !== undefined) {
    const owner = await User.findOne({ _id: req.body.ownerId, status: 'active' });
    if (!owner) return res.status(400).json({ ok: false, message: 'المالك الجديد غير صالح' });
    room.owner = owner._id;
    if (!room.members.some(id => String(id) === String(owner._id))) room.members.push(owner._id);
    if (!room.admins.some(id => String(id) === String(owner._id))) room.admins.push(owner._id);
  }
  await room.save(); await writeAudit(req.user, 'developer.room.updated', null, `room:${room._id}`);
  res.json({ ok: true, room: { id: room._id, isActive: room.isActive, isLocked: room.isLocked, isOfficial: room.isOfficial, owner: room.owner } });
});

router.get('/room-reports', async (req, res) => {
  const reports = await GroupReport.find().populate('group', 'name roomType').populate('reporter targetUser', 'fullName displayName username').sort({ createdAt: -1 }).limit(200).lean();
  res.json({ ok: true, reports });
});

router.patch('/room-reports/:id', async (req, res) => {
  const status = String(req.body.status || '');
  if (!['reviewing', 'resolved', 'dismissed'].includes(status)) return res.status(400).json({ ok: false, message: 'حالة البلاغ غير صالحة' });
  const report = await GroupReport.findByIdAndUpdate(req.params.id, { status, reviewedBy: req.user._id, resolution: String(req.body.resolution || '').trim().slice(0, 500) }, { new: true });
  if (!report) return res.status(404).json({ ok: false, message: 'البلاغ غير موجود' });
  await writeAudit(req.user, `room.report.${status}`, report.targetUser ? { _id: report.targetUser } : null, `report:${report._id}`);
  res.json({ ok: true, report });
});

module.exports = router;
