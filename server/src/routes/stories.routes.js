const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const Story = require('../models/Story');
const router = express.Router();

const uploadDir = path.resolve(__dirname, '../../../uploads/stories');
fs.mkdirSync(uploadDir, { recursive: true });

const allowed = new Map([
  ['image/jpeg', '.jpg'], ['image/png', '.png'], ['image/webp', '.webp'], ['image/gif', '.gif'],
  ['video/mp4', '.mp4'], ['video/webm', '.webm'], ['video/quicktime', '.mov']
]);
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${allowed.get(file.mimetype) || ''}`)
  }),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => allowed.has(file.mimetype) ? cb(null, true) : cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname))
});

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const friends = (await require('../models/FriendRequest').find({ $or: [{ sender: req.user._id }, { receiver: req.user._id }], status: 'accepted' }).select('sender receiver')).map(r => String(r.sender) === String(req.user._id) ? r.receiver : r.sender);
    const userIds = [String(req.user._id), ...friends];
    const stories = await Story.find({ author: { $in: userIds }, active: true, expiresAt: { $gt: new Date() } })
      .populate('author', 'fullName displayName username profile').sort({ createdAt: -1 }).limit(30);
    res.json({ ok: true, stories: stories.map(s => ({ id: s._id, author: s.author ? { id: s.author._id, fullName: s.author.displayName || s.author.fullName, username: s.author.username, avatarUrl: s.author.profile?.avatarUrl || '' } : null, text: s.text, media: s.media, createdAt: s.createdAt, expiresAt: s.expiresAt })) });
  } catch (e) { res.status(500).json({ ok: false, message: e.message }); }
});

router.get('/me', async (req, res) => {
  try {
    const stories = await Story.find({ author: req.user._id, active: true, expiresAt: { $gt: new Date() } }).populate('author', 'fullName displayName username profile').sort({ createdAt: -1 });
    res.json({ ok: true, stories: stories.map(s => ({ id: s._id, author: s.author ? { id: s.author._id, fullName: s.author.displayName || s.author.fullName, username: s.author.username, avatarUrl: s.author.profile?.avatarUrl || '' } : null, text: s.text, media: s.media, createdAt: s.createdAt, expiresAt: s.expiresAt })) });
  } catch (e) { res.status(500).json({ ok: false, message: e.message }); }
});

router.post('/', upload.single('media'), async (req, res) => {
  try {
    const text = String(req.body.text || '').trim();
    if (!text && !req.file) return res.status(400).json({ ok: false, message: 'أضف نصاً أو وسائط' });
    const media = req.file ? [{ url: `/uploads/stories/${req.file.filename}`, type: req.file.mimetype.startsWith('video/') ? 'video' : 'image', mimeType: req.file.mimetype, size: req.file.size }] : [];
    const story = await Story.create({ author: req.user._id, text, media, expiresAt: new Date(Date.now() + 24*60*60*1000) });
    await story.populate('author', 'fullName displayName username profile');
    res.status(201).json({ ok: true, story: { id: story._id, author: story.author ? { id: story.author._id, fullName: story.author.displayName || story.author.fullName, username: story.author.username, avatarUrl: story.author.profile?.avatarUrl || '' } : null, text: story.text, media: story.media, createdAt: story.createdAt, expiresAt: story.expiresAt } });
  } catch (e) { res.status(500).json({ ok: false, message: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const story = await Story.findOne({ _id: req.params.id, author: req.user._id });
    if (!story) return res.status(404).json({ ok: false, message: 'القصة غير موجودة' });
    if (story.media && story.media.length) { for (const item of story.media) { if (item.url && item.url.startsWith('/uploads/stories/')) { fs.unlink(path.join(uploadDir, path.basename(item.url)), () => {}); } } }
    await Story.deleteOne({ _id: req.params.id });
    res.json({ ok: true, message: 'تم حذف القصة' });
  } catch (e) { res.status(500).json({ ok: false, message: e.message }); }
});

module.exports = router;
