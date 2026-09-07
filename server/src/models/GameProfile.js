const mongoose = require('mongoose');

const gameStatsSchema = new mongoose.Schema({
  played: { type: Number, default: 0, min: 0 },
  wins: { type: Number, default: 0, min: 0 },
  losses: { type: Number, default: 0, min: 0 },
  draws: { type: Number, default: 0, min: 0 }
}, { _id: false });

const gameProfileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  points: { type: Number, default: 0, min: 0, index: true },
  xp: { type: Number, default: 0, min: 0 },
  level: { type: Number, default: 1, min: 1 },
  streak: { type: Number, default: 0, min: 0 },
  bestStreak: { type: Number, default: 0, min: 0 },
  chess: { type: gameStatsSchema, default: () => ({}) },
  domino: { type: gameStatsSchema, default: () => ({}) },
  tawla: { type: gameStatsSchema, default: () => ({}) },
  cards: { type: gameStatsSchema, default: () => ({}) }
}, { timestamps: true });

gameProfileSchema.index({ points: -1, updatedAt: -1 });

module.exports = mongoose.model('GameProfile', gameProfileSchema);
