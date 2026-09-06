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
