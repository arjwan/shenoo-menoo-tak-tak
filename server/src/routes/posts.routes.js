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
  ['video/mp4', '.mp4'], ['video/webm', '.webm'], ['video/quicktime', '.mov'],
  ['audio/mpeg', '.mp3'], ['audio/mp3', '.mp3']
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
function canManagePost(post, user) { return String(post.author?._id || post.author) === String(user._id) || ['admin', 'developer'].includes(user.role); }
function mediaFromFile(file) {
  if (!file) return [];
  const type = file.mimetype.startsWith('video/') ? 'video' : file.mimetype.startsWith('audio/') ? 'audio' : 'image';
  return [{ url: `/uploads/posts/${file.filename}`, type, mimeType: file.mimetype, size: file.size }];
}
function deleteStoredMedia(media) {
  for (const item of media || []) {
    if (!item?.url || !item.url.startsWith('/uploads/posts/')) continue;
    fs.unlink(path.join(uploadDir, path.basename(item.url)), () => {});
  }
}
function postView(post, user) {
  return {
    id: post._id,
    author: userView(post.author),
    text: post.text,
    media: post.media,
    type: post.type,
    visibility: post.visibility,
    adStatus: post.adStatus,
    adTitle: post.adTitle || '',
    adContact: post.adContact || '',
    adCategory: post.adCategory || '',
    adReviewNote: post.adReviewNote || '',
    likesCount: post.likes.length,
    liked: post.likes.some((id) => String(id) === String(user._id)),
    commentsCount: post.commentsCount,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    canEdit: canManagePost(post, user),
    canDelete: canManagePost(post, user)
  };
}
async function friendIds(userId) {
  const rows = await FriendRequest.find({ $or: [{ sender: userId }, { receiver: userId }], status: 'accepted' }).select('sender receiver');
  return rows.map((r) => String(r.sender) === String(userId) ? r.receiver : r.sender);
}

router.get('/', async (req, res) => {
  const friends = await friendIds(req.user._id);
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 15));
  const query = {
    active: true,
    $and: [
      { $or: [{ type: 'post' }, { type: 'ad', adStatus: 'approved' }] },
      { $or: [{ visibility: 'everyone' }, { author: req.user._id }, { visibility: 'friends', author: { $in: friends } }] }
    ]
  };
  const posts = await Post.find(query).populate('author', 'fullName displayName username profile').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
  res.json({ ok: true, posts: posts.map((post) => postView(post, req.user)) });
});

router.get('/ads', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 20));
  const ads = await Post.find({ active: true, type: 'ad', adStatus: 'approved' })
    .populate('author', 'fullName displayName username profile')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  res.json({ ok: true, ads: ads.map((post) => postView(post, req.user)) });
});

router.get('/ads/mine', async (req, res) => {
  const ads = await Post.find({ active: true, type: 'ad', author: req.user._id })
    .populate('author', 'fullName displayName username profile')
    .sort({ createdAt: -1 });
  res.json({ ok: true, ads: ads.map((post) => postView(post, req.user)) });
});

router.get('/ads/pending', async (req, res) => {
  if (!['admin', 'developer'].includes(req.user.role)) return res.status(403).json({ ok: false, message: 'هذه الصفحة للمطور والإدارة فقط' });
  const ads = await Post.find({ active: true, type: 'ad', adStatus: 'pending' })
    .populate('author', 'fullName displayName username profile')
    .sort({ createdAt: 1 });
  res.json({ ok: true, ads: ads.map((post) => postView(post, req.user)) });
});

router.post('/', upload.single('media'), async (req, res) => {
  const text = String(req.body.text || '').trim();
  if (!text && !req.file) return res.status(400).json({ ok: false, message: 'اكتب منشوراً أو أرفق صورة/فيديو/صوت' });
  if (text.length > 5000) return res.status(400).json({ ok: false, message: 'المنشور طويل جداً' });
  const requestedType = req.body.type === 'ad' ? 'ad' : 'post';
  const visibility = req.body.visibility === 'friends' ? 'friends' : 'everyone';
  const isModerator = ['admin', 'developer'].includes(req.user.role);
  const adTitle = String(req.body.adTitle || '').trim();
  const adContact = String(req.body.adContact || '').trim();
  const adCategory = String(req.body.adCategory || '').trim();
  if (requestedType === 'ad' && !adTitle) return res.status(400).json({ ok: false, message: 'أدخل عنوان الإعلان' });
  const post = await Post.create({
    author: req.user._id,
    text,
    media: mediaFromFile(req.file),
    type: requestedType,
    visibility: requestedType === 'ad' ? 'everyone' : visibility,
    adStatus: requestedType === 'ad' ? (isModerator ? 'approved' : 'pending') : 'not_ad',
    adTitle: requestedType === 'ad' ? adTitle : '',
    adContact: requestedType === 'ad' ? adContact : '',
    adCategory: requestedType === 'ad' ? adCategory : '',
    adReviewedBy: requestedType === 'ad' && isModerator ? req.user._id : null,
    adReviewedAt: requestedType === 'ad' && isModerator ? new Date() : null
  });
  await post.populate('author', 'fullName displayName username profile');
  res.status(201).json({
    ok: true,
    message: requestedType === 'ad' && !isModerator ? 'تم إرسال الإعلان إلى المطور للمراجعة قبل النشر' : 'تم النشر',
    post: postView(post, req.user)
  });
});

router.patch('/ads/:id/review', async (req, res) => {
  if (!['admin', 'developer'].includes(req.user.role)) return res.status(403).json({ ok: false, message: 'هذه العملية للمطور والإدارة فقط' });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ ok: false, message: 'إعلان غير صالح' });
  const decision = String(req.body.decision || '').toLowerCase();
  if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ ok: false, message: 'قرار المراجعة غير صالح' });
  const post = await Post.findOne({ _id: req.params.id, active: true, type: 'ad' });
  if (!post) return res.status(404).json({ ok: false, message: 'الإعلان غير موجود' });
  post.adStatus = decision;
  post.adReviewedBy = req.user._id;
  post.adReviewedAt = new Date();
  post.adReviewNote = String(req.body.note || '').trim().slice(0, 500);
  await post.save();
  await post.populate('author', 'fullName displayName username profile');
  res.json({ ok: true, message: decision === 'approved' ? 'تمت الموافقة على الإعلان ونشره' : 'تم رفض الإعلان', post: postView(post, req.user) });
});

router.patch('/:id', upload.single('media'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ ok: false, message: 'منشور غير صالح' });
  const post = await Post.findOne({ _id: req.params.id, active: true });
  if (!post) return res.status(404).json({ ok: false, message: 'المنشور غير موجود' });
  if (!canManagePost(post, req.user)) return res.status(403).json({ ok: false, message: 'لا يمكنك تعديل هذا المنشور' });
  if (req.body.text !== undefined) { const text = String(req.body.text || '').trim(); if (text.length > 5000) return res.status(400).json({ ok: false, message: 'المنشور طويل جداً' }); post.text = text; }
  if (req.body.visibility !== undefined && post.type !== 'ad') post.visibility = req.body.visibility === 'friends' ? 'friends' : 'everyone';
  if (post.type === 'ad') {
    if (req.body.adTitle !== undefined) post.adTitle = String(req.body.adTitle || '').trim().slice(0, 120);
    if (req.body.adContact !== undefined) post.adContact = String(req.body.adContact || '').trim().slice(0, 160);
    if (req.body.adCategory !== undefined) post.adCategory = String(req.body.adCategory || '').trim().slice(0, 80);
    if (!['admin', 'developer'].includes(req.user.role)) {
      post.adStatus = 'pending';
      post.adReviewedBy = null;
      post.adReviewedAt = null;
      post.adReviewNote = '';
    }
  }
  if (req.file) { deleteStoredMedia(post.media); post.media = mediaFromFile(req.file); }
  else if (String(req.body.removeMedia || '').toLowerCase() === 'true') { deleteStoredMedia(post.media); post.media = []; }
  if (!post.text && (!post.media || !post.media.length)) return res.status(400).json({ ok: false, message: 'لا يمكن حفظ منشور فارغ' });
  await post.save(); await post.populate('author', 'fullName displayName username profile');
  return res.json({ ok: true, message: post.type === 'ad' && post.adStatus === 'pending' ? 'تم حفظ التعديل وإعادة الإعلان للمراجعة' : 'تم تعديل المنشور', post: postView(post, req.user) });
});

router.delete('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ ok: false, message: 'منشور غير صالح' });
  const post = await Post.findOne({ _id: req.params.id, active: true });
  if (!post) return res.status(404).json({ ok: false, message: 'المنشور غير موجود' });
  if (!canManagePost(post, req.user)) return res.status(403).json({ ok: false, message: 'لا يمكنك حذف هذا المنشور' });
  deleteStoredMedia(post.media); await PostComment.deleteMany({ post: post._id }); await Post.deleteOne({ _id: post._id });
  return res.json({ ok: true, message: 'تم حذف المنشور' });
});
router.post('/:id/like', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ ok: false, message: 'منشور غير صالح' });
  const post = await Post.findOne({ _id: req.params.id, active: true }); if (!post) return res.status(404).json({ ok: false, message: 'المنشور غير موجود' });
  const index = post.likes.findIndex((id) => String(id) === String(req.user._id)); if (index >= 0) post.likes.splice(index, 1); else post.likes.push(req.user._id); await post.save();
  res.json({ ok: true, liked: index < 0, likesCount: post.likes.length });
});
router.get('/:id/comments', async (req, res) => {
  const comments = await PostComment.find({ post: req.params.id }).populate('author', 'fullName displayName username profile').sort({ createdAt: 1 }).limit(100);
  res.json({ ok: true, comments: comments.map((comment) => ({ id: comment._id, text: comment.text, author: userView(comment.author), createdAt: comment.createdAt })) });
});
router.post('/:id/comments', async (req, res) => {
  const text = String(req.body.text || '').trim(); if (!text || text.length > 2000) return res.status(400).json({ ok: false, message: 'التعليق غير صالح' });
  const post = await Post.findOne({ _id: req.params.id, active: true }); if (!post) return res.status(404).json({ ok: false, message: 'المنشور غير موجود' });
  const comment = await PostComment.create({ post: post._id, author: req.user._id, text }); post.commentsCount += 1; await post.save(); await comment.populate('author', 'fullName displayName username profile');
  res.status(201).json({ ok: true, comment: { id: comment._id, text: comment.text, author: userView(comment.author), createdAt: comment.createdAt }, commentsCount: post.commentsCount });
});
module.exports = router;
