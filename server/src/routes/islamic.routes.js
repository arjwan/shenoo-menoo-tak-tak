const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const IslamicPost = require('../models/IslamicPost');
const Post = require('../models/Post');

const router = express.Router();
const uploadDir = path.resolve(__dirname, '../../../uploads/islamic');
fs.mkdirSync(uploadDir, { recursive: true });

const allowed = new Map([
  ['image/jpeg', { ext: '.jpg', type: 'image' }],
  ['image/png', { ext: '.png', type: 'image' }],
  ['image/webp', { ext: '.webp', type: 'image' }],
  ['video/mp4', { ext: '.mp4', type: 'video' }],
  ['video/x-m4v', { ext: '.m4v', type: 'video' }],
  ['video/webm', { ext: '.webm', type: 'video' }],
  ['video/quicktime', { ext: '.mov', type: 'video' }],
  ['video/ogg', { ext: '.ogv', type: 'video' }],
  ['video/3gpp', { ext: '.3gp', type: 'video' }],
  ['video/3gpp2', { ext: '.3g2', type: 'video' }],
  ['video/x-matroska', { ext: '.mkv', type: 'video' }],
  ['video/x-msvideo', { ext: '.avi', type: 'video' }],
  ['audio/mpeg', { ext: '.mp3', type: 'audio' }],
  ['audio/mp4', { ext: '.m4a', type: 'audio' }],
  ['audio/ogg', { ext: '.ogg', type: 'audio' }],
  ['application/pdf', { ext: '.pdf', type: 'document' }]
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const spec = allowed.get(file.mimetype);
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${spec?.ext || ''}`);
    }
  }),
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => allowed.has(file.mimetype) ? cb(null, true) : cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname))
});

router.use(requireAuth);

function userView(user) {
  if (!user) return null;
  return {
    id: user._id,
    fullName: user.displayName || user.fullName,
    username: user.username,
    avatarUrl: user.profile?.avatarUrl || ''
  };
}

function mediaFromFile(file) {
  if (!file) return [];
  const spec = allowed.get(file.mimetype);
  return [{
    url: `/uploads/islamic/${file.filename}`,
    type: spec.type,
    mimeType: file.mimetype,
    size: file.size,
    originalName: file.originalname
  }];
}

function postView(post, user) {
  return {
    id: post._id,
    author: userView(post.author),
    category: post.category,
    title: post.title,
    text: post.text,
    media: post.media,
    likesCount: post.likes.length,
    liked: post.likes.some((id) => String(id) === String(user._id)),
    commentsCount: post.comments.length,
    comments: post.comments.map((c) => ({
      id: c._id,
      text: c.text,
      createdAt: c.createdAt,
      author: userView(c.author)
    })),
    sharedToGeneral: post.sharedToGeneral,
    generalPostId: post.generalPostId,
    createdAt: post.createdAt
  };
}

router.get('/posts', async (req, res) => {
  const category = String(req.query.category || '').trim();
  const query = { active: true };
  if (['dua', 'ziyarat', 'books', 'lecture', 'quran', 'general'].includes(category)) query.category = category;
  const posts = await IslamicPost.find(query)
    .populate('author', 'fullName displayName username profile')
    .populate('comments.author', 'fullName displayName username profile')
    .sort({ createdAt: -1 })
    .limit(50);
  res.json({ ok: true, posts: posts.map((post) => postView(post, req.user)) });
});

router.post('/posts', upload.single('media'), async (req, res) => {
  const title = String(req.body.title || '').trim();
  const text = String(req.body.text || '').trim();
  const category = ['dua', 'ziyarat', 'books', 'lecture', 'quran', 'general'].includes(req.body.category) ? req.body.category : 'general';
  if (!title && !text && !req.file) return res.status(400).json({ ok: false, message: 'أضف عنواناً أو نصاً أو ملفاً' });
  if (title.length > 180 || text.length > 10000) return res.status(400).json({ ok: false, message: 'المحتوى أطول من الحد المسموح' });
  const post = await IslamicPost.create({ author: req.user._id, category, title, text, media: mediaFromFile(req.file) });
  await post.populate('author', 'fullName displayName username profile');
  res.status(201).json({ ok: true, post: postView(post, req.user) });
});

router.post('/posts/:id/like', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ ok: false, message: 'منشور غير صالح' });
  const post = await IslamicPost.findOne({ _id: req.params.id, active: true });
  if (!post) return res.status(404).json({ ok: false, message: 'المنشور غير موجود' });
  const index = post.likes.findIndex((id) => String(id) === String(req.user._id));
  if (index >= 0) post.likes.splice(index, 1); else post.likes.push(req.user._id);
  await post.save();
  res.json({ ok: true, liked: index < 0, likesCount: post.likes.length });
});

router.post('/posts/:id/comments', async (req, res) => {
  const text = String(req.body.text || '').trim();
  if (!text || text.length > 2000) return res.status(400).json({ ok: false, message: 'التعليق غير صالح' });
  const post = await IslamicPost.findOne({ _id: req.params.id, active: true });
  if (!post) return res.status(404).json({ ok: false, message: 'المنشور غير موجود' });
  post.comments.push({ author: req.user._id, text });
  await post.save();
  await post.populate('comments.author', 'fullName displayName username profile');
  const comment = post.comments[post.comments.length - 1];
  res.status(201).json({ ok: true, commentsCount: post.comments.length, comment: { id: comment._id, text: comment.text, createdAt: comment.createdAt, author: userView(comment.author) } });
});

router.post('/posts/:id/share-general', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ ok: false, message: 'منشور غير صالح' });
  const source = await IslamicPost.findOne({ _id: req.params.id, active: true });
  if (!source) return res.status(404).json({ ok: false, message: 'المنشور غير موجود' });
  if (source.sharedToGeneral && source.generalPostId) return res.json({ ok: true, alreadyShared: true, postId: source.generalPostId });
  const media = (source.media || []).filter((m) => ['image', 'video'].includes(m.type)).map((m) => ({ url: m.url, type: m.type, mimeType: m.mimeType, size: m.size }));
  const general = await Post.create({
    author: req.user._id,
    text: [source.title, source.text].filter(Boolean).join('\n\n'),
    media,
    type: 'post',
    visibility: 'everyone'
  });
  source.sharedToGeneral = true;
  source.generalPostId = general._id;
  await source.save();
  res.status(201).json({ ok: true, postId: general._id });
});

module.exports = router;
