const express = require('express');
const mongoose = require('mongoose');
const { requireAuth, requireRole } = require('../middleware/auth');
const BroadcastTicker = require('../models/BroadcastTicker');

const router = express.Router();

function serializePublic(item) {
  return {
    id: item._id,
    text: item.text,
    type: item.type,
    priority: item.priority,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

function activeQuery(now = new Date()) {
  return {
    enabled: true,
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] }
    ]
  };
}

function emitUpdate(req) {
  const io = req.app.get('io');
  if (io) io.emit('broadcast-ticker:update', { at: new Date().toISOString() });
}

router.get('/active', async (_req, res) => {
  try {
    const items = await BroadcastTicker.find(activeQuery()).sort({ priority: -1, createdAt: -1 }).limit(30).lean();
    return res.json({ ok: true, items: items.map(serializePublic) });
  } catch (error) {
    console.error('Broadcast ticker active failed:', error.message);
    return res.status(500).json({ ok: false, message: 'تعذر تحميل الشريط المتحرك' });
  }
});

router.use('/manage', requireAuth, requireRole('developer'));

router.get('/manage', async (_req, res) => {
  try {
    const items = await BroadcastTicker.find({}).sort({ createdAt: -1 }).limit(200).lean();
    return res.json({ ok: true, items: items.map((item) => ({ ...serializePublic(item), enabled: item.enabled })) });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'تعذر تحميل رسائل الشريط' });
  }
});

router.post('/manage', async (req, res) => {
  try {
    const text = String(req.body.text || '').trim();
    const type = String(req.body.type || 'notice');
    const priority = Number(req.body.priority ?? 50);
    const startsAt = req.body.startsAt ? new Date(req.body.startsAt) : null;
    const endsAt = req.body.endsAt ? new Date(req.body.endsAt) : null;
    if (!text) return res.status(400).json({ ok: false, message: 'نص الرسالة مطلوب' });
    if (!['notice', 'guidance', 'ad'].includes(type)) return res.status(400).json({ ok: false, message: 'نوع الرسالة غير صالح' });
    if (!Number.isFinite(priority) || priority < 0 || priority > 100) return res.status(400).json({ ok: false, message: 'الأولوية من 0 إلى 100' });
    if (startsAt && Number.isNaN(startsAt.getTime())) return res.status(400).json({ ok: false, message: 'وقت البداية غير صالح' });
    if (endsAt && Number.isNaN(endsAt.getTime())) return res.status(400).json({ ok: false, message: 'وقت النهاية غير صالح' });
    if (startsAt && endsAt && endsAt <= startsAt) return res.status(400).json({ ok: false, message: 'وقت النهاية يجب أن يكون بعد البداية' });
    const item = await BroadcastTicker.create({ text, type, priority, startsAt, endsAt, enabled: req.body.enabled !== false, createdBy: req.user._id });
    emitUpdate(req);
    return res.status(201).json({ ok: true, message: 'تم نشر الرسالة على الشريط', item: { ...serializePublic(item), enabled: item.enabled } });
  } catch (error) {
    console.error('Broadcast ticker create failed:', error.message);
    return res.status(500).json({ ok: false, message: 'تعذر إنشاء الرسالة' });
  }
});

router.patch('/manage/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ ok: false, message: 'معرف الرسالة غير صالح' });
    const item = await BroadcastTicker.findById(req.params.id);
    if (!item) return res.status(404).json({ ok: false, message: 'الرسالة غير موجودة' });
    if (req.body.text !== undefined) item.text = String(req.body.text || '').trim();
    if (req.body.type !== undefined && ['notice', 'guidance', 'ad'].includes(String(req.body.type))) item.type = String(req.body.type);
    if (req.body.priority !== undefined) item.priority = Math.max(0, Math.min(100, Number(req.body.priority) || 0));
    if (req.body.enabled !== undefined) item.enabled = Boolean(req.body.enabled);
    if (req.body.startsAt !== undefined) item.startsAt = req.body.startsAt ? new Date(req.body.startsAt) : null;
    if (req.body.endsAt !== undefined) item.endsAt = req.body.endsAt ? new Date(req.body.endsAt) : null;
    if (!item.text) return res.status(400).json({ ok: false, message: 'نص الرسالة مطلوب' });
    if (item.startsAt && item.endsAt && item.endsAt <= item.startsAt) return res.status(400).json({ ok: false, message: 'وقت النهاية يجب أن يكون بعد البداية' });
    await item.save();
    emitUpdate(req);
    return res.json({ ok: true, message: 'تم تحديث الرسالة', item: { ...serializePublic(item), enabled: item.enabled } });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'تعذر تحديث الرسالة' });
  }
});

router.delete('/manage/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ ok: false, message: 'معرف الرسالة غير صالح' });
    const item = await BroadcastTicker.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ ok: false, message: 'الرسالة غير موجودة' });
    emitUpdate(req);
    return res.json({ ok: true, message: 'تم حذف الرسالة' });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'تعذر حذف الرسالة' });
  }
});

module.exports = router;
