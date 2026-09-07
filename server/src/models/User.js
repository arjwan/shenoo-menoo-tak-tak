const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },

  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },

  contact: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },

  contactType: {
    type: String,
    enum: ['email', 'phone'],
    required: true
  },

  birthDate: {
    type: Date,
    default: null
  },

  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    default: 'other'
  },

  passwordHash: {
    type: String,
    required: true
  },

  termsAccepted: {
    type: Boolean,
    required: true
  },

  role: {
    type: String,
    enum: ['user', 'moderator', 'admin', 'developer'],
    default: 'user'
  },

  status: {
    type: String,
    enum: ['pending', 'active', 'rejected', 'blocked'],
    default: 'pending'
  },

  rejectionReason: {
    type: String,
    default: ''
  },

  displayName: {
    type: String,
    trim: true,
    maxlength: 100,
    default: ''
  },

  profile: {
    bio: { type: String, maxlength: 500, default: '' },
    avatarUrl: { type: String, default: '' },
    coverUrl: { type: String, default: '' },
    online: { type: Boolean, default: false },
    lastSeen: { type: Date, default: null },
    governorate: { type: String, maxlength: 80, default: '' },
    city: { type: String, maxlength: 80, default: '' },
    profession: { type: String, maxlength: 120, default: '' },
    workplace: { type: String, maxlength: 120, default: '' },
    education: { type: String, maxlength: 120, default: '' },
    website: { type: String, maxlength: 240, default: '' },
    socialLinks: { type: [String], default: [] }
  },

  privacy: {
    type: Map,
    of: { type: String, enum: ['everyone', 'friends', 'nobody'] },
    default: {
      profile: 'everyone',
      photo: 'everyone',
      cover: 'everyone',
      lastSeen: 'friends',
      online: 'friends',
      birthDate: 'nobody',
      about: 'everyone',
      friendsList: 'friends',
      phone: 'nobody',
      email: 'nobody',
      friendRequests: 'everyone',
      messaging: 'friends',
      audioCalls: 'friends',
      videoCalls: 'friends',
      posts: 'everyone',
      comments: 'everyone',
      mentions: 'friends'
    }
  },

  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  reviewedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
