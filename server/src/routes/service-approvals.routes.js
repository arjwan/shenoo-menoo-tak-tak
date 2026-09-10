const express = require('express');
const mongoose = require('mongoose');
const { requireAuth, requireRole } = require('../middleware/auth');
const ConsultationProvider = require('../models/ConsultationProvider');
const AstrologyProvider = require('../models/AstrologyProvider');
const Post = require('../models/Post');

const router = express.Router();
router.use(requireAuth);
router.use(requireRole('developer'));

function applicant(user) {
  return {
    applicant: user?.displayName || user?.fullName || user?.username || 'مستخدم',
    username: user?.username || '',
    contact: user?.contact || user?.phone || user?.email || ''
  };
}

router.get('/', async (_req, res) => {
  try {
    const [consultants, astrology, ads] = await Promise.all([
      ConsultationProvider.find({ status: 'pending' })
        .populate('user', 'fullName displayName username contact phone email')
        .sort({ createdAt: -1 })
        .lean(),
      AstrologyProvider.find({ status: 'pending' })
        .populate('user', 'fullName displayName username contact phone email')
        .sort({ createdAt: -1 })
        .lean(),
      Post.find({ active: true, type: 'ad', adStatus: 'pending' })
        .populate('author', 'fullName displayName username contact phone email')
        .sort({ createdAt: -1 })
        .lean()
    ]);

    const approvals = [
      ...consultants.map((p) => ({
        id: p._id,
        ...applicant(p.user),
        type: 'consultation',
        typeLabel: 'مستشار',
        details: `${p.title || ''} — ${p.specialty || ''} — ${p.serviceType === 'paid' ? `مدفوع ${p.fee || 0} ${p.currency || 'IQD'}` : 'مجاني'}`,
        createdAt: p.createdAt,
        status: p.status
      })),
      ...astrology.map((p) => ({
        id: p._id,
        ...applicant(p.user),
        type: 'astrology',
        typeLabel: 'مزود خدمة',
        details: `ركن أم عباس — ${p.displayTitle || ''} — ${p.serviceType === 'paid' ? `مدفوع ${p.fee || 0} ${p.currency || 'IQD'}` : 'مجاني'}`,
        createdAt: p.createdAt,
        status: p.status
      })),
      ...ads.map((p) => ({
        id: p._id,
        ...applicant(p.author),
        type: 'advertisement',
        typeLabel: 'إعلان',
        details: `${p.adTitle || 'إعلان'}${p.adCategory ? ` — ${p.adCategory}` : ''}${p.adContact ? ` — ${p.adContact}` : ''}`,
        createdAt: p.createdAt,
        status: p.adStatus
      }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.json({ ok: true, approvals });
  } catch (error) {
    console.error('Service approvals load failed:', error.message);
    return res.status(500).json({ ok: false, message: 'تعذر تحميل طلبات الخدمات والإعلانات' });
  }
});

router.patch('/:type/:id/:decision', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ ok: false, message: 'معرف الطلب غير صالح' });
    if (!['approve', 'reject'].includes(req.params.decision)) return res.status(400).json({ ok: false, message: 'قرار المراجعة غير صالح' });
    const approve = req.params.decision === 'approve';
    const reason = String(req.body.reason || '').trim();
    if (!approve && !reason) return res.status(400).json({ ok: false, message: 'سبب الرفض مطلوب' });

    if (req.params.type === 'consultation') {
      const item = await ConsultationProvider.findOne({ _id: req.params.id, status: 'pending' });
      if (!item) return res.status(404).json({ ok: false, message: 'طلب الاستشارة غير موجود أو تمت مراجعته' });
      item.status = approve ? 'approved' : 'rejected';
      item.rejectionReason = approve ? '' : reason;
      await item.save();
      return res.json({ ok: true, message: approve ? 'تم اعتماد مقدم الاستشارة' : 'تم رفض مقدم الاستشارة' });
    }

    if (req.params.type === 'astrology') {
      const item = await AstrologyProvider.findOne({ _id: req.params.id, status: 'pending' });
      if (!item) return res.status(404).json({ ok: false, message: 'طلب أم عباس غير موجود أو تمت مراجعته' });
      item.status = approve ? 'approved' : 'rejected';
      item.rejectionReason = approve ? '' : reason;
      await item.save();
      return res.json({ ok: true, message: approve ? 'تم اعتماد مقدم خدمة أم عباس' : 'تم رفض مقدم خدمة أم عباس' });
    }

    if (req.params.type === 'advertisement') {
      const item = await Post.findOne({ _id: req.params.id, active: true, type: 'ad', adStatus: 'pending' });
      if (!item) return res.status(404).json({ ok: false, message: 'الإعلان غير موجود أو تمت مراجعته' });
      item.adStatus = approve ? 'approved' : 'rejected';
      item.adReviewedBy = req.user._id;
      item.adReviewedAt = new Date();
      item.adReviewNote = approve ? '' : reason;
      await item.save();
      return res.json({ ok: true, message: approve ? 'تمت الموافقة على الإعلان ونشره' : 'تم رفض الإعلان' });
    }

    return res.status(400).json({ ok: false, message: 'نوع الطلب غير مدعوم' });
  } catch (error) {
    console.error('Service approval decision failed:', error.message);
    return res.status(500).json({ ok: false, message: 'تعذر تنفيذ قرار الموافقة' });
  }
});

module.exports = router;
