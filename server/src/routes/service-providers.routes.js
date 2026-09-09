const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ServiceProvider = require('../models/ServiceProvider');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const uploadDir = path.resolve(__dirname, '../../../uploads/service-providers');
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safe = ['.png','.jpg','.jpeg','.webp'].includes(ext) ? ext : '.jpg';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2,10)}${safe}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => /^image\/(png|jpe?g|webp)$/.test(file.mimetype || '') ? cb(null, true) : cb(new Error('نوع الصورة غير مدعوم'))
});
const clean = (v, max = 300) => String(v || '').trim().slice(0, max);
const bool = (v, fallback = true) => v === undefined ? fallback : ['1','true','yes','on'].includes(String(v).toLowerCase());
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

function publicProvider(doc, req) {
  const p = doc.toObject ? doc.toObject() : doc;
  const owner = p.owner || {};
  const ownerId = String(owner._id || owner || '');
  const io = req.app.get('io');
  const online = Boolean(io?.sockets?.adapter?.rooms?.get(`user:${ownerId}`)?.size);
  return {
    id: p._id,
    kind: p.kind,
    category: p.category,
    name: p.name,
    description: p.description,
    governorate: p.governorate,
    area: p.area,
    address: p.address,
    phone: p.phone,
    whatsapp: p.whatsapp,
    latitude: p.latitude,
    longitude: p.longitude,
    imageUrl: p.imageUrl,
    vehicleType: p.vehicleType,
    vehicleModel: p.vehicleModel,
    availableForWork: Boolean(p.availableForWork),
    online,
    ratingAverage: p.ratingAverage || 0,
    ratingCount: p.ratingCount || 0,
    owner: ownerId ? { id: ownerId, fullName: owner.fullName || owner.displayName || '', username: owner.username || '', avatarUrl: owner.profile?.avatarUrl || '' } : null
  };
}

router.post('/', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const kind = clean(req.body.kind, 20);
    if (!['profession','transport'].includes(kind)) return res.status(400).json({ ok:false, message:'نوع الخدمة غير صالح' });
    const required = ['category','name','governorate','area','address','phone'];
    if (required.some(k => !clean(req.body[k]))) return res.status(400).json({ ok:false, message:'أكمل الحقول المطلوبة' });
    const provider = await ServiceProvider.create({
      owner: req.user._id,
      kind,
      category: clean(req.body.category, 120),
      name: clean(req.body.name, 120),
      description: clean(req.body.description, 1200),
      governorate: clean(req.body.governorate, 80),
      area: clean(req.body.area, 100),
      address: clean(req.body.address, 240),
      phone: clean(req.body.phone, 30),
      whatsapp: clean(req.body.whatsapp, 30),
      latitude: num(req.body.latitude),
      longitude: num(req.body.longitude),
      imageUrl: req.file ? `/uploads/service-providers/${req.file.filename}` : '',
      vehicleType: clean(req.body.vehicleType, 80),
      vehicleModel: clean(req.body.vehicleModel, 80),
      availableForWork: bool(req.body.availableForWork, true),
      status: 'pending'
    });
    return res.status(201).json({ ok:true, message:'تم استلام طلبك وهو بانتظار موافقة الإدارة', provider:{ id:provider._id, status:provider.status } });
  } catch (error) {
    console.error('Service provider create failed:', error.message);
    return res.status(500).json({ ok:false, message:'تعذر حفظ الطلب' });
  }
});

router.get('/', async (req, res) => {
  try {
    const filter = { status:'approved' };
    if (['profession','transport'].includes(req.query.kind)) filter.kind = req.query.kind;
    if (clean(req.query.category)) filter.category = clean(req.query.category,120);
    if (clean(req.query.governorate)) filter.governorate = clean(req.query.governorate,80);
    if (String(req.query.available || '') === '1') filter.availableForWork = true;
    const q = clean(req.query.q, 100);
    if (q) filter.$or = [
      { name:{ $regex:q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), $options:'i' } },
      { category:{ $regex:q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), $options:'i' } },
      { area:{ $regex:q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), $options:'i' } }
    ];
    const list = await ServiceProvider.find(filter).populate('owner','fullName displayName username profile').sort({ availableForWork:-1, createdAt:-1 }).limit(200);
    res.json({ ok:true, providers:list.map(p => publicProvider(p, req)) });
  } catch (error) {
    res.status(500).json({ ok:false, message:'تعذر تحميل الخدمات' });
  }
});

router.get('/mine', requireAuth, async (req, res) => {
  const list = await ServiceProvider.find({ owner:req.user._id }).sort({ createdAt:-1 }).lean();
  res.json({ ok:true, providers:list });
});

router.patch('/:id/availability', requireAuth, async (req, res) => {
  const provider = await ServiceProvider.findOne({ _id:req.params.id, owner:req.user._id }).catch(() => null);
  if (!provider) return res.status(404).json({ ok:false, message:'الخدمة غير موجودة' });
  provider.availableForWork = Boolean(req.body.availableForWork);
  await provider.save();
  res.json({ ok:true, availableForWork:provider.availableForWork });
});

module.exports = router;
