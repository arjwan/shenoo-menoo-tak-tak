const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ServiceProvider = require('../models/ServiceProvider');
const ServiceRequest = require('../models/ServiceRequest');
const { requireAuth, requireRole } = require('../middleware/auth');

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
    id: p._id, kind: p.kind, category: p.category, name: p.name, description: p.description,
    governorate: p.governorate, area: p.area, address: p.address, phone: p.phone, whatsapp: p.whatsapp,
    latitude: p.latitude, longitude: p.longitude, imageUrl: p.imageUrl, vehicleType: p.vehicleType,
    vehicleModel: p.vehicleModel, availableForWork: Boolean(p.availableForWork), online,
    ratingAverage: p.ratingAverage || 0, ratingCount: p.ratingCount || 0,
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
      owner: req.user._id, kind, category: clean(req.body.category, 120), name: clean(req.body.name, 120),
      description: clean(req.body.description, 1200), governorate: clean(req.body.governorate, 80), area: clean(req.body.area, 100),
      address: clean(req.body.address, 240), phone: clean(req.body.phone, 30), whatsapp: clean(req.body.whatsapp, 30),
      latitude: num(req.body.latitude), longitude: num(req.body.longitude),
      imageUrl: req.file ? `/uploads/service-providers/${req.file.filename}` : '', vehicleType: clean(req.body.vehicleType, 80),
      vehicleModel: clean(req.body.vehicleModel, 80), availableForWork: bool(req.body.availableForWork, true), status: 'pending'
    });
    return res.status(201).json({ ok:true, message:'تم استلام طلبك وهو بانتظار موافقة الإدارة', provider:{ id:provider._id, status:provider.status } });
  } catch (error) {
    console.error('Service provider create failed:', error.message);
    return res.status(500).json({ ok:false, message:'تعذر حفظ الطلب' });
  }
});

router.get('/admin/pending', requireAuth, requireRole('developer','admin'), async (req,res) => {
  const providers = await ServiceProvider.find({ status:'pending' }).populate('owner','fullName displayName username phone profile').sort({createdAt:1}).lean();
  res.json({ok:true,providers});
});

router.patch('/admin/:id/status', requireAuth, requireRole('developer','admin'), async (req,res) => {
  const next = clean(req.body.status, 20);
  if (!['approved','rejected'].includes(next)) return res.status(400).json({ok:false,message:'الحالة غير صالحة'});
  const provider = await ServiceProvider.findById(req.params.id).catch(()=>null);
  if (!provider) return res.status(404).json({ok:false,message:'الطلب غير موجود'});
  provider.status = next;
  await provider.save();
  res.json({ok:true,message:next==='approved'?'تمت الموافقة على مقدم الخدمة':'تم رفض الطلب',provider:{id:provider._id,status:provider.status}});
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
  } catch (error) { res.status(500).json({ ok:false, message:'تعذر تحميل الخدمات' }); }
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

router.post('/:id/requests', requireAuth, async (req,res) => {
  const provider = await ServiceProvider.findOne({_id:req.params.id,status:'approved'}).catch(()=>null);
  if (!provider) return res.status(404).json({ok:false,message:'مقدم الخدمة غير موجود'});
  if (!provider.availableForWork) return res.status(409).json({ok:false,message:'مقدم الخدمة غير متاح للعمل حاليًا'});
  if (String(provider.owner) === String(req.user._id)) return res.status(400).json({ok:false,message:'لا يمكنك إرسال طلب لنفسك'});
  const description = clean(req.body.description,1800), phone = clean(req.body.phone,40);
  if (!description || !phone) return res.status(400).json({ok:false,message:'أدخل وصف الطلب ورقم التواصل'});
  const request = await ServiceRequest.create({
    requester:req.user._id, provider:provider._id, providerOwner:provider.owner, kind:provider.kind,
    requestType:clean(req.body.requestType,120), description, pickupAddress:clean(req.body.pickupAddress,300),
    destination:clean(req.body.destination,300), phone, latitude:num(req.body.latitude), longitude:num(req.body.longitude)
  });
  const payload={id:request._id,kind:request.kind,requestType:request.requestType,description:request.description,pickupAddress:request.pickupAddress,destination:request.destination,phone:request.phone,status:request.status,createdAt:request.createdAt};
  req.app.get('io')?.to(`user:${provider.owner}`).emit('service-request:new',payload);
  res.status(201).json({ok:true,message:'تم إرسال الطلب إلى مقدم الخدمة',request:payload});
});

router.get('/requests/incoming', requireAuth, async (req,res) => {
  const list=await ServiceRequest.find({providerOwner:req.user._id}).populate('requester','fullName displayName username profile').populate('provider','name category kind').sort({createdAt:-1}).limit(200).lean();
  res.json({ok:true,requests:list});
});

router.get('/requests/mine', requireAuth, async (req,res) => {
  const list=await ServiceRequest.find({requester:req.user._id}).populate('provider','name category kind phone whatsapp').sort({createdAt:-1}).limit(200).lean();
  res.json({ok:true,requests:list});
});

router.patch('/requests/:requestId/status', requireAuth, async (req,res) => {
  const request=await ServiceRequest.findOne({_id:req.params.requestId,providerOwner:req.user._id}).catch(()=>null);
  if (!request) return res.status(404).json({ok:false,message:'الطلب غير موجود'});
  const next=clean(req.body.status,30);
  const allowed={pending:['accepted','rejected'],accepted:['on_the_way','in_progress','completed'],on_the_way:['in_progress','completed'],in_progress:['completed']};
  if (!(allowed[request.status]||[]).includes(next)) return res.status(409).json({ok:false,message:'لا يمكن الانتقال إلى هذه الحالة'});
  request.status=next;
  request.providerNote=clean(req.body.providerNote,600);
  if(next==='accepted') request.acceptedAt=new Date();
  if(next==='completed') request.completedAt=new Date();
  await request.save();
  req.app.get('io')?.to(`user:${request.requester}`).emit('service-request:status',{id:request._id,status:request.status,providerNote:request.providerNote});
  res.json({ok:true,message:'تم تحديث حالة الطلب',request:{id:request._id,status:request.status}});
});

router.patch('/requests/:requestId/cancel', requireAuth, async (req,res) => {
  const request=await ServiceRequest.findOne({_id:req.params.requestId,requester:req.user._id}).catch(()=>null);
  if(!request) return res.status(404).json({ok:false,message:'الطلب غير موجود'});
  if(!['pending','accepted'].includes(request.status)) return res.status(409).json({ok:false,message:'لا يمكن إلغاء الطلب في مرحلته الحالية'});
  request.status='cancelled'; await request.save();
  req.app.get('io')?.to(`user:${request.providerOwner}`).emit('service-request:status',{id:request._id,status:'cancelled'});
  res.json({ok:true,message:'تم إلغاء الطلب'});
});

module.exports = router;
