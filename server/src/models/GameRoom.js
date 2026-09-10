const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  seatIndex: { type: Number, min: 0, max: 5, required: true },
  expiresAt: { type: Date, required: true }
}, { _id: false });

const gameRoomSchema = new mongoose.Schema({
  roomCode: { type: String, trim: true, index: true },
  name: { type: String, trim: true, maxlength: 100, default: 'غرفة تحدي' },
  gameType: { type: String, enum: ['chess', 'domino', 'tawla', 'cards'], default: 'domino', index: true },
  visibility: { type: String, enum: ['public', 'friends', 'private'], default: 'public', index: true },
  maxPlayers: { type: Number, min: 2, max: 6, default: 2 },
  teamMode: { type: String, enum: ['solo', '2v2'], default: 'solo' },
  scoreTarget: { type: Number, min: 25, max: 500, default: 100 },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  reservations: { type: [reservationSchema], default: [] },
  spectators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  spectatorsPolicy: { type: String, enum: ['public', 'friends', 'none'], default: 'friends' },
  voiceEnabled: { type: Boolean, default: true },
  voicePolicy: { type: String, enum: ['open', 'players_friends', 'players_only'], default: 'players_friends' },
  liveEnabled: { type: Boolean, default: true },
  isPaid: { type: Boolean, default: false, index: true },
  price: { type: Number, min: 0, default: 0 },
  currency: { type: String, trim: true, maxlength: 8, default: 'IQD' },
  isActive: { type: Boolean, default: true, index: true },
  lastOpenedAt: { type: Date, default: Date.now, index: true },
  abandonedAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null, index: true },
  savedAt: { type: Date, default: null },
  gameState: {
    status: { type: String, enum: ['waiting', 'ready', 'active', 'finished'], default: 'waiting' },
    turn: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    scores: { type: Map, of: Number, default: {} },
    teamScores: { type: Map, of: Number, default: { A: 0, B: 0 } },
    board: { type: [mongoose.Schema.Types.Mixed], default: [] },
    moveCount: { type: Number, default: 0 },
    engineState: { type: mongoose.Schema.Types.Mixed, default: null },
    updatedAt: { type: Date, default: Date.now }
  }
}, { timestamps: true });

gameRoomSchema.index({ gameType: 1, visibility: 1, 'gameState.status': 1, updatedAt: -1 });
gameRoomSchema.index({ roomCode: 1, isActive: 1 });
module.exports = mongoose.model('GameRoom', gameRoomSchema);
