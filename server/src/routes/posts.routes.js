const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const FriendRequest = require('../models/FriendRequest');
const Post = require('../models/Post');
const PostComment = require('../models/PostComment');

const router = express.Router();
const uploadDir = path.resolve(__dirname, '../../../uploads/posts');
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
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => allowed.has(file.mimetype) ? cb(null, true) : cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname))
});

router.use(requireAuth);

function userView(user) {
  return {
    id: user._id,
    fullName: user.displayName || user.fullName,
    username: user.username,
    avatarUrl: user.profile?.avatarUrl || ''
  };
}

async function friendIds(userId) {
  const rows = await FriendRequest.find({
    $or: [{ sender: userId }, { receiver: userId }], status: 'accepted'
  }).select('sender receiver');
  return rows.map((r) => String(r.sender) === String(userId) ? r.receiver : r.sender);
}

router.get('/', async (req, res) => {
  const friends = await friendIds(req.user._id);
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 15));
  const query = {
    active: true,
    $or: [
      { visibility: 'everyone' },
      { author: req.user._id },
      { visibility: 'friends', author: { $in: friends } }
    ]
  };
  const posts = await Post.find(query)
    .populate('author', 'fullName displayName username profile')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  res.json({ ok: true, posts: posts.map((post) => ({
    id: post._id,
    author: userView(post.author),
    text: post.text,
    media: post.media,
    type: post.type,
    visibility: post.visibility,
    likesCount: post.likes.length,
    liked: post.likes.some((id) => String(id) === String(req.user._id)),
    commentsCount: post.commentsCount,
    createdAt: post.createdAt
  })) });
});

router.post('/', upload.single('media'), async (req, res) => {
  const text = String(req.body.text || '').trim();
  if (!text && !req.file) return res.status(400).json({ ok: false, message: 'اكتب منشوراً أو أرفق صورة/فيديو' });
  if (text.length > 5000) return res.status(400).json({ ok: false, message: 'المنشور طويل جداً' });
  const requestedType = req.body.type === 'ad' ? 'ad' : 'post';
  if (requestedType === 'ad' && !['admin', 'developer'].includes(req.user.role)) return res.status(403).json({ ok: false, message: 'نشر الإعلانات متاح للإدارة فقط' });
  const visibility = req.body.visibility === 'friends' ? 'friends' : 'everyone';
  const media = req.file ? [{
    url: `/uploads/posts/${req.file.filename}`,
    type: req.file.mimetype.startsWith('video/') ? 'video' : 'image',
    mimeType: req.file.mimetype,
    size: req.file.size
  }] : [];
  const post = await Post.create({ author: req.user._id, text, media, type: requestedType, visibility });
  await post.populate('author', 'fullName displayName username profile');
  res.status(201).json({ ok: true, post: {
    id: post._id, author: userView(post.author), text: post.text, media: post.media,
    type: post.type, visibility: post.visibility, likesCount: 0, liked: false, commentsCount: 0, createdAt: post.createdAt
  }});
});

router.post('/:id/like', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ ok: false, message: 'منشور غير صالح' });
  const post = await Post.findOne({ _id: req.params.id, active: true });
  if (!post) return res.status(404).json({ ok: false, message: 'المنشور غير موجود' });
  const index = post.likes.findIndex((id) => String(id) === String(req.user._id));
  if (index >= 0) post.likes.splice(index, 1); else post.likes.push(req.user._id);
  await post.save();
  res.json({ ok: true, liked: index < 0, likesCount: post.likes.length });
});

router.get('/:id/comments', async (req, res) => {
  const comments = await PostComment.find({ post: req.params.id })
    .populate('author', 'fullName displayName username profile')
    .sort({ createdAt: 1 }).limit(100);
  res.json({ ok: true, comments: comments.map((comment) => ({
    id: comment._id, text: comment.text, author: userView(comment.author), createdAt: comment.createdAt
  })) });
});

router.post('/:id/comments', async (req, res) => {
  const text = String(req.body.text || '').trim();
  if (!text || text.length > 2000) return res.status(400).json({ ok: false, message: 'التعليق غير صالح' });
  const post = await Post.findOne({ _id: req.params.id, active: true });
  if (!post) return res.status(404).json({ ok: false, message: 'المنشور غير موجود' });
  const comment = await PostComment.create({ post: post._id, author: req.user._id, text });
  post.commentsCount += 1;
  await post.save();
  await comment.populate('author', 'fullName displayName username profile');
  res.status(201).json({ ok: true, comment: { id: comment._id, text: comment.text, author: userView(comment.author), createdAt: comment.createdAt }, commentsCount: post.commentsCount });
});

module.exports = router;
