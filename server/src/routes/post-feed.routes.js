const express = require('express');
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const FriendRequest = require('../models/FriendRequest');
const Post = require('../models/Post');

const router = express.Router();
const OWN_HOME_WINDOW_MS = 2 * 60 * 60 * 1000;

router.use(requireAuth);

function userView(user) {
  return {
    id: user._id,
    fullName: user.displayName || user.fullName,
    username: user.username,
    avatarUrl: user.profile?.avatarUrl || ''
  };
}

function postView(post, user) {
  const authorId = post.author?._id || post.author;
  const canManage = String(authorId) === String(user._id) || ['admin', 'developer'].includes(user.role);
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
    canEdit: canManage,
    canDelete: canManage
  };
}

async function friendIds(userId) {
  const rows = await FriendRequest.find({
    $or: [{ sender: userId }, { receiver: userId }],
    status: 'accepted'
  }).select('sender receiver');
  return rows.map((row) => String(row.sender) === String(userId) ? row.receiver : row.sender);
}

async function areFriends(a, b) {
  return !!await FriendRequest.exists({
    $or: [{ sender: a, receiver: b }, { sender: b, receiver: a }],
    status: 'accepted'
  });
}

router.get('/', async (req, res) => {
  const friends = await friendIds(req.user._id);
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 15));
  const freshSince = new Date(Date.now() - OWN_HOME_WINDOW_MS);

  const query = {
    active: true,
    $and: [
      { $or: [{ type: 'post' }, { type: 'ad', adStatus: 'approved' }] },
      { $or: [
        { visibility: 'everyone' },
        { author: req.user._id },
        { visibility: 'friends', author: { $in: friends } }
      ] },
      { $or: [
        { author: { $ne: req.user._id } },
        { author: req.user._id, type: 'post', createdAt: { $gte: freshSince } },
        { author: req.user._id, type: 'ad', adStatus: 'approved' }
      ] }
    ]
  };

  const posts = await Post.find(query)
    .populate('author', 'fullName displayName username profile')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  res.json({
    ok: true,
    posts: posts.map((post) => postView(post, req.user)),
    ownHomeWindowMinutes: OWN_HOME_WINDOW_MS / 60000
  });
});

router.get('/user/:id', async (req, res) => {
  if (req.params.id !== 'me' && !mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ ok: false, message: 'مستخدم غير صالح' });
  }

  const targetId = req.params.id === 'me' ? req.user._id : req.params.id;
  const self = String(targetId) === String(req.user._id);
  const friend = self ? true : await areFriends(req.user._id, targetId);
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 20));

  const visibility = self
    ? {}
    : { $or: [{ visibility: 'everyone' }, ...(friend ? [{ visibility: 'friends' }] : [])] };

  const query = {
    active: true,
    author: targetId,
    type: 'post',
    ...visibility
  };

  const [posts, total] = await Promise.all([
    Post.find(query)
      .populate('author', 'fullName displayName username profile')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Post.countDocuments(query)
  ]);

  res.json({
    ok: true,
    posts: posts.map((post) => postView(post, req.user)),
    total,
    page
  });
});

module.exports = router;
