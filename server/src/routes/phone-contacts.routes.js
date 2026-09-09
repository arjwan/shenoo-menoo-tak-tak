const express = require('express');
const { requireAuth } = require('../middleware/auth');
const PhoneContact = require('../models/PhoneContact');

const router = express.Router();

function normalizePhone(value) {
  let phone = String(value || '').replace(/[^\d+]/g, '');
  if (phone.startsWith('+964')) phone = `0${phone.slice(4)}`;
  else if (phone.startsWith('00964')) phone = `0${phone.slice(5)}`;
  else if (phone.startsWith('964')) phone = `0${phone.slice(3)}`;
  return /^07\d{9}$/.test(phone) ? phone : '';
}

function safeName(value) {
  const name = String(value || 'جهة اتصال').trim().slice(0, 100);
  return name || 'جهة اتصال';
}

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const contacts = await PhoneContact.find({ owner: req.user._id })
      .sort({ name: 1, updatedAt: -1 })
      .lean();
    return res.json({
      ok: true,
      contacts: contacts.map(contact => ({
        id: contact._id,
        name: contact.name,
        phone: contact.phone,
        updatedAt: contact.updatedAt
      }))
    });
  } catch (error) {
    console.error('Phone contacts load failed:', error.message);
    return res.status(500).json({ ok: false, message: 'تعذر تحميل جهات الاتصال المحفوظة' });
  }
});

router.put('/', async (req, res) => {
  try {
    const incoming = Array.isArray(req.body.contacts) ? req.body.contacts.slice(0, 200) : [];
    const unique = new Map();
    for (const item of incoming) {
      const phone = normalizePhone(item && item.phone);
      if (!phone) continue;
      unique.set(phone, { name: safeName(item && item.name), phone });
    }

    if (unique.size) {
      await PhoneContact.bulkWrite(Array.from(unique.values()).map(contact => ({
        updateOne: {
          filter: { owner: req.user._id, phone: contact.phone },
          update: { $set: { name: contact.name } },
          upsert: true
        }
      })), { ordered: false });
    }

    const contacts = await PhoneContact.find({ owner: req.user._id })
      .sort({ name: 1, updatedAt: -1 })
      .lean();
    return res.json({
      ok: true,
      contacts: contacts.map(contact => ({ id: contact._id, name: contact.name, phone: contact.phone, updatedAt: contact.updatedAt })),
      message: 'تم حفظ جهات الاتصال بشكل دائم'
    });
  } catch (error) {
    console.error('Phone contacts save failed:', error.message);
    return res.status(500).json({ ok: false, message: 'تعذر حفظ جهات الاتصال' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await PhoneContact.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!deleted) return res.status(404).json({ ok: false, message: 'جهة الاتصال غير موجودة' });
    return res.json({ ok: true, message: 'تم حذف جهة الاتصال' });
  } catch (error) {
    return res.status(400).json({ ok: false, message: 'تعذر حذف جهة الاتصال' });
  }
});

module.exports = router;
