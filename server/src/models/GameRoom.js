const mongoose = require('mongoose');

const gameRoomSchema = new mongoose.Schema({
  name: { type: String, trim: true, maxlength: 100, default: 'غرفة تحدي' },
  gameType: { type: String, enum: ['chess', 'domino', 'tawla', 'cards'], default: 'domino', index: true },
  maxPlayers: { type: Number, min: 2, max: 4, default: 2 },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  spectators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  spectatorsPolicy: { type: String, enum: ['public', 'friends', 'none'], default: 'friends' },
  voiceEnabled: { type: Boolean, default: true },
  voicePolicy: { type: String, enum: ['open', 'players_friends', 'players_only'], default: 'players_friends' },
  liveEnabled: { type: Boolean, default: true },
  gameState: {
    status: { type: String, enum: ['waiting', 'active', 'finished'], default: 'waiting' },
    turn: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    scores: { type: Map, of: Number, default: {} },
    board: { type: [mongoose.Schema.Types.Mixed], default: [] },
    moveCount: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now }
  }
}, { timestamps: true });

gameRoomSchema.index({ gameType: 1, 'gameState.status': 1, updatedAt: -1 });
module.exports = mongoose.model('GameRoom', gameRoomSchema);
