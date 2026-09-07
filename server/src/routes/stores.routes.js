const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Store = require('../models/Store');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const uploadDir = path.resolve(__dirname, '../../../uploads/stores');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? ext : '.jpg';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2,10)}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 2 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(png|jpe?g|webp)$/.test(file.mimetype || '')) return cb(new Error('نوع الصورة غير مدعوم'));
    cb(null, true);
  }
});

router.post('/', requireAuth, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), async (req, res) => {
  try {
    const { name, category, description, governorate, area, phone, socialLinks, plan } = req.body;
    if (!name || !category || !description || !governorate || !area || !phone || !plan) {
      return res.status(400).json({ ok: false, message: 'أكمل الحقول المطلوبة لإنشاء المتجر' });
    }
    if (!['basic', 'plus', 'featured'].includes(plan)) {
      return res.status(400).json({ ok: false, message: 'الباقة المختارة غير صالحة' });
    }

    const files = req.files || {};
    const logoUrl = files.logo?.[0] ? `/uploads/stores/${files.logo[0].filename}` : '';
    const coverUrl = files.cover?.[0] ? `/uploads/stores/${files.cover[0].filename}` : '';

    const store = await Store.create({
      owner: req.user._id,
      name: String(name).trim(),
      category: String(category).trim(),
      description: String(description).trim(),
      governorate: String(governorate).trim(),
      area: String(area).trim(),
      phone: String(phone).trim(),
      socialLinks: String(socialLinks || '').trim(),
      plan,
      logoUrl,
      coverUrl,
      status: 'pending'
    });

    return res.status(201).json({
      ok: true,
      message: 'تم استلام طلب إنشاء المتجر وهو بانتظار موافقة الإدارة',
      store: { id: store._id, name: store.name, status: store.status }
    });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ ok: false, message: 'لديك متجر بهذا الاسم بالفعل' });
    console.error('Store create failed:', error.message);
    return res.status(500).json({ ok: false, message: 'تعذر إنشاء المتجر' });
  }
});

router.get('/mine', requireAuth, async (req, res) => {
  const stores = await Store.find({ owner: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json({ ok: true, stores: stores.map(s => ({ id: s._id, name: s.name, category: s.category, plan: s.plan, status: s.status, createdAt: s.createdAt })) });
});

module.exports = router;
