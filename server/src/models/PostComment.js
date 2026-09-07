const mongoose = require('mongoose');

const postCommentSchema = new mongoose.Schema({
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  text: { type: String, required: true, trim: true, maxlength: 2000 }
}, { timestamps: true });

postCommentSchema.index({ post: 1, createdAt: 1 });
module.exports = mongoose.model('PostComment', postCommentSchema);
