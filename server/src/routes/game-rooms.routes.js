const express = require('express');
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const GameRoom = require('../models/GameRoom');
const GameSpectatorInvite = require('../models/GameSpectatorInvite');
const User = require('../models/User');
const { friends, blocked } = require('./friends.routes');

const router = express.Router();
router.use(requireAuth);
const inviteWindows = new Map();
const GAME_TYPES = ['chess', 'domino', 'tawla', 'cards'];
const GAME_NAMES = { chess: 'شطرنج', domino: 'دومنة', tawla: 'طاولي', cards: 'ورق' };
const GAME_ICONS = { chess: '♟', domino: '🁫', tawla: '🎲', cards: '🃏' };

function cleanReservations(room) {
  const now = Date.now();
  room.reservations = (room.reservations || []).filter((r) => new Date(r.expiresAt).getTime() > now);
}
function makeCode() { return String(Math.floor(100000 + Math.random() * 900000)); }
function personFrom(profiles, id) {
  const user = profiles.get(String(id));
  return user ? { id: user._id, name: user.displayName || user.fullName, username: user.username, avatarUrl: user.profile?.avatarUrl || '' } : { id };
}
function publicState(room) {
  const profiles = new Map((room.playerProfiles || []).map((user) => [String(user._id), user]));
  const person = (id) => personFrom(profiles, id);
  return {
    id: room._id,
    roomCode: room.roomCode || String(room._id).slice(-6),
    name: room.name,
    gameType: room.gameType || 'domino',
    gameName: GAME_NAMES[room.gameType || 'domino'],
    gameIcon: GAME_ICONS[room.gameType || 'domino'],
    visibility: room.visibility || 'public',
    maxPlayers: room.maxPlayers || 2,
    liveEnabled: room.liveEnabled !== false,
    owner: person(room.owner),
    players: (room.players || []).map(person),
    reservations: (room.reservations || []).map((r) => ({ user: person(r.user), seatIndex: r.seatIndex, expiresAt: r.expiresAt })),
    spectators: (room.spectators || []).map(person),
    spectatorsPolicy: room.spectatorsPolicy,
    voiceEnabled: room.voiceEnabled,
    voicePolicy: room.voicePolicy,
    isPaid: Boolean(room.isPaid),
    price: Number(room.price || 0),
    currency: room.currency || 'IQD',
    isActive: room.isActive !== false,
    gameState: {
      status: room.gameState?.status || 'waiting',
      turn: room.gameState?.turn ? person(room.gameState.turn) : null,
      scores: Object.fromEntries(room.gameState?.scores || []),
      board: room.gameState?.board || [],
      moveCount: room.gameState?.moveCount || 0,
      updatedAt: room.gameState?.updatedAt
    }
  };
}

async function decorate(room) {
  cleanReservations(room);
  const ids = [...(room.players || []), ...(room.spectators || []), room.owner, ...(room.reservations || []).map((r) => r.user)].filter(Boolean);
  room.playerProfiles = await User.find({ _id: { $in: ids } }).select('fullName displayName username profile');
  return room;
}
async function loadRoom(id) {
  if (mongoose.isValidObjectId(id)) return GameRoom.findById(id);
  return GameRoom.findOne({ roomCode: String(id), isActive: { $ne: false } });
}
async function canEnterLobbyRoom(user, room) {
  if (String(room.owner) === String(user._id) || (room.players || []).some((id) => String(id) === String(user._id))) return true;
  if ((room.visibility || 'public') === 'public') return true;
  if (room.visibility === 'private') return false;
  return friends(user._id, room.owner);
}
async function canSpectate(user, room) {
  if (!(await canEnterLobbyRoom(user, room))) return false;
  if (String(room.owner) === String(user._id) || room.players.some((id) => String(id) === String(user._id))) return true;
  const playerUsers = await User.find({ _id: { $in: room.players } }).select('blockedUsers privacy');
  if (playerUsers.some((player) => blocked(user, player) || (user.blockedUsers || []).some((id) => String(id) === String(player._id)))) return false;
  if (room.spectatorsPolicy === 'none') return false;
  if (room.spectatorsPolicy === 'public') return true;
  for (const player of room.players) if (await friends(user._id, player)) return true;
  return false;
}
async function canVoice(user, room) {
  if (!room.voiceEnabled || !(await canEnterLobbyRoom(user, room))) return false;
  const playerUsers = await User.find({ _id: { $in: room.players } }).select('blockedUsers privacy');
  if (playerUsers.some((player) => blocked(user, player) || (user.blockedUsers || []).some((id) => String(id) === String(player._id)))) return false;
  if (room.players.some((id) => String(id) === String(user._id)) || String(room.owner) === String(user._id)) return true;
  if (room.voicePolicy === 'players_only') return false;
  if (room.voicePolicy === 'open') return true;
  for (const player of room.players) if (await friends(user._id, player)) return true;
  return false;
}
function emitRoom(req, room, event = 'game:room-updated') {
  const io = req.app.get('io');
  if (io) io.emit(event, { roomId: String(room._id), roomCode: room.roomCode });
}

router.get('/', async (req, res) => {
  try {
    const query = { isActive: { $ne: false } };
    if (GAME_TYPES.includes(req.query.gameType)) query.gameType = req.query.gameType;
    if (['public', 'friends', 'private'].includes(req.query.visibility)) query.visibility = req.query.visibility;
    if (req.query.status && ['waiting', 'ready', 'active', 'finished'].includes(req.query.status)) query['gameState.status'] = req.query.status;
    const rooms = await GameRoom.find(query).sort({ updatedAt: -1 }).limit(100);
    const result = [];
    for (const room of rooms) {
      if (!(await canEnterLobbyRoom(req.user, room))) continue;
      cleanReservations(room);
      result.push(publicState(await decorate(room)));
    }
    res.json({ ok: true, rooms: result, maxListed: 100, gameTypes: GAME_TYPES.map((id) => ({ id, name: GAME_NAMES[id], icon: GAME_ICONS[id] })) });
  } catch (e) { res.status(500).json({ ok: false, message: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const gameType = GAME_TYPES.includes(req.body.gameType) ? req.body.gameType : 'domino';
    const visibility = ['public', 'friends', 'private'].includes(req.body.visibility) ? req.body.visibility : 'public';
    const maxPlayers = gameType === 'cards' ? Math.min(6, Math.max(2, Number(req.body.maxPlayers) || 4)) : gameType === 'domino' ? ([2, 4].includes(Number(req.body.maxPlayers)) ? Number(req.body.maxPlayers) : 2) : 2;
    let roomCode = makeCode();
    while (await GameRoom.exists({ roomCode, isActive: { $ne: false } })) roomCode = makeCode();
    const room = await GameRoom.create({
      roomCode,
      name: String(req.body.name || `غرفة ${GAME_NAMES[gameType]} ${roomCode}`).trim().slice(0, 100),
      gameType,
      visibility,
      maxPlayers,
      owner: req.user._id,
      players: [req.user._id],
      spectatorsPolicy: visibility === 'public' ? 'public' : 'friends',
      voicePolicy: visibility === 'public' ? 'open' : 'players_friends',
      voiceEnabled: req.body.voiceEnabled !== false,
      liveEnabled: req.body.liveEnabled !== false,
      isPaid: false,
      price: 0
    });
    emitRoom(req, room, 'game:room-created');
    res.status(201).json({ ok: true, room: publicState(await decorate(room)) });
  } catch (e) { res.status(500).json({ ok: false, message: e.message }); }
});

router.get('/invites/incoming', async (req, res) => {
  const invites = await GameSpectatorInvite.find({ invitee: req.user._id, status: 'pending' }).populate('room inviter', 'name gameType roomCode fullName displayName username');
  res.json({ ok: true, invites });
});
router.post('/invites/:id/:action', async (req, res) => {
  if (!['accept', 'reject'].includes(req.params.action)) return res.status(400).json({ ok: false, message: 'إجراء غير صالح' });
  const invite = await GameSpectatorInvite.findOne({ _id: req.params.id, invitee: req.user._id, status: 'pending' });
  if (!invite) return res.status(404).json({ ok: false, message: 'الدعوة غير موجودة' });
  invite.status = req.params.action === 'accept' ? 'accepted' : 'rejected';
  await invite.save();
  res.json({ ok: true, status: invite.status, roomId: invite.room });
});

router.get('/:id', async (req, res) => {
  const room = await loadRoom(req.params.id);
  if (!room || room.isActive === false) return res.status(404).json({ ok: false, message: 'الغرفة غير موجودة' });
  if (!(await canSpectate(req.user, room))) return res.status(403).json({ ok: false, message: 'لا تملك صلاحية مشاهدة هذه الغرفة' });
  const decorated = await decorate(room);
  const base = publicState(decorated);
  const isPlayer = room.players && room.players.some((id) => String(id) === String(req.user._id));
  let extra = {};
  if (isPlayer && decorated.gameState && decorated.gameState.engineState) {
    const reg = require('../games/game-engine-registry');
    const engine = reg.getEngine(room.gameType || 'domino');
    const engineState = decorated.gameState.engineState;
    const privateState = (engine && engine.getPrivateState) ? engine.getPrivateState(engineState, String(req.user._id)) : null;
    const legalActions = (engine && engine.getLegalActions) ? engine.getLegalActions(engineState, String(req.user._id)) : [];
    const publicEngine = (engine && engine.getPublicState) ? engine.getPublicState(engineState) : (engineState && engineState.public ? engineState.public : engineState);
    extra.engineState = { public: publicEngine && publicEngine.public ? publicEngine.public : publicEngine, private: privateState, legalActions: legalActions || [] };
  }
  res.json({ ok: true, room: { ...base, ...extra } });
});

router.post('/:id/reserve', async (req, res) => {
  const room = await loadRoom(req.params.id);
  if (!room || room.isActive === false) return res.status(404).json({ ok: false, message: 'الغرفة غير موجودة' });
  if (!(await canEnterLobbyRoom(req.user, room))) return res.status(403).json({ ok: false, message: 'هذه الغرفة ليست متاحة لك' });
  cleanReservations(room);
  if (room.players.some((id) => String(id) === String(req.user._id))) return res.status(409).json({ ok: false, message: 'أنت لاعب داخل الغرفة بالفعل' });
  room.reservations = room.reservations.filter((r) => String(r.user) !== String(req.user._id));
  const occupied = new Set(room.reservations.map((r) => r.seatIndex));
  for (let i = 0; i < room.players.length; i += 1) occupied.add(i);
  let seatIndex = Number.isInteger(Number(req.body.seatIndex)) ? Number(req.body.seatIndex) : -1;
  if (seatIndex < 0 || seatIndex >= room.maxPlayers || occupied.has(seatIndex)) {
    seatIndex = Array.from({ length: room.maxPlayers }, (_, i) => i).find((i) => !occupied.has(i));
  }
  if (seatIndex === undefined) return res.status(409).json({ ok: false, message: 'لا يوجد مقعد متاح للحجز' });
  room.reservations.push({ user: req.user._id, seatIndex, expiresAt: new Date(Date.now() + 5 * 60 * 1000) });
  await room.save();
  emitRoom(req, room);
  res.json({ ok: true, room: publicState(await decorate(room)), reservationMinutes: 5 });
});

router.delete('/:id/reserve', async (req, res) => {
  const room = await loadRoom(req.params.id);
  if (!room) return res.status(404).json({ ok: false, message: 'الغرفة غير موجودة' });
  room.reservations = (room.reservations || []).filter((r) => String(r.user) !== String(req.user._id));
  await room.save(); emitRoom(req, room); res.json({ ok: true });
});

router.post('/:id/join', async (req, res) => {
  const room = await loadRoom(req.params.id);
  if (!room || room.isActive === false) return res.status(404).json({ ok: false, message: 'الغرفة غير موجودة' });
  if (!(await canEnterLobbyRoom(req.user, room))) return res.status(403).json({ ok: false, message: 'هذه الغرفة ليست متاحة لك' });
  if (room.players.some((id) => String(id) === String(req.user._id))) return res.json({ ok: true, room: publicState(await decorate(room)) });
  cleanReservations(room);
  const mine = room.reservations.find((r) => String(r.user) === String(req.user._id));
  const reservedByOthers = room.reservations.filter((r) => String(r.user) !== String(req.user._id)).length;
  if (room.players.length + reservedByOthers >= (room.maxPlayers || 2) && !mine) return res.status(409).json({ ok: false, message: 'المقاعد المتبقية محجوزة' });
  const playerUsers = await User.find({ _id: { $in: room.players } }).select('blockedUsers');
  if (playerUsers.some((player) => blocked(req.user, player))) return res.status(403).json({ ok: false, message: 'لا يمكنك الانضمام لهذه الغرفة' });
  room.reservations = room.reservations.filter((r) => String(r.user) !== String(req.user._id));
  room.players.push(req.user._id);
  room.gameState.status = room.players.length >= room.maxPlayers ? 'ready' : 'waiting';
  if (!room.gameState.turn) room.gameState.turn = room.players[0];
  room.gameState.updatedAt = new Date();
  await room.save(); emitRoom(req, room);
  res.json({ ok: true, room: publicState(await decorate(room)) });
});

router.delete('/:id/join', async (req, res) => {
  const room = await loadRoom(req.params.id);
  if (!room || String(room.owner) === String(req.user._id)) return res.status(400).json({ ok: false, message: 'مالك الغرفة يغلق الغرفة أو يبدّل اللاعب من الإدارة' });
  room.players = room.players.filter((id) => String(id) !== String(req.user._id));
  room.spectators = room.spectators.filter((id) => String(id) !== String(req.user._id));
  room.gameState.status = room.players.length >= room.maxPlayers ? 'ready' : 'waiting';
  await room.save(); emitRoom(req, room); res.json({ ok: true });
});

router.post('/:id/start', async (req, res) => {
  const room = await loadRoom(req.params.id);
  if (!room || String(room.owner) !== String(req.user._id)) return res.status(403).json({ ok: false, message: 'مالك الغرفة فقط يستطيع بدء اللعبة' });
  if (room.players.length < 2) return res.status(409).json({ ok: false, message: 'تحتاج لاعبين على الأقل' });
  const gameType = room.gameType || 'domino';
  const supported = ['domino', 'tawla', 'chess', 'cards'];
  if (supported.includes(gameType)) {
    const reg = require('../games/game-engine-registry');
    const engine = reg.getEngine(gameType);
    if (engine && engine.createGame) {
      const state = engine.createGame({ playerIds: room.players.map(String) });
      room.gameState.engineState = state;
      room.gameState.board = state.board || [];
      room.gameState.moveCount = state.moveCount || 0;
      room.gameState.status = 'active';
      room.gameState.turn = room.players[0];
      room.gameState.updatedAt = new Date();
    }
  } else {
    room.gameState.status = 'active'; room.gameState.turn = room.players[0]; room.gameState.updatedAt = new Date();
  }
  await room.save(); emitRoom(req, room); res.json({ ok: true, room: publicState(await decorate(room)) });
});

router.post('/:id/replace-player', async (req, res) => {
  const room = await loadRoom(req.params.id);
  if (!room || String(room.owner) !== String(req.user._id)) return res.status(403).json({ ok: false, message: 'مالك الغرفة فقط يستطيع تغيير لاعب' });
  const oldId = String(req.body.oldUserId || '');
  const newUser = await User.findById(req.body.newUserId).select('_id blockedUsers');
  const index = room.players.findIndex((id) => String(id) === oldId);
  if (index < 0 || index === 0 || !newUser) return res.status(400).json({ ok: false, message: 'بيانات تغيير اللاعب غير صالحة' });
  if (!(await friends(req.user._id, newUser._id))) return res.status(403).json({ ok: false, message: 'يمكن إضافة صديق فقط بهذه الطريقة' });
  if (room.players.some((id) => String(id) === String(newUser._id))) return res.status(409).json({ ok: false, message: 'اللاعب موجود بالفعل' });
  room.players[index] = newUser._id; room.gameState.status = room.players.length >= room.maxPlayers ? 'ready' : 'waiting'; await room.save(); emitRoom(req, room); res.json({ ok: true, room: publicState(await decorate(room)) });
});

router.patch('/:id/settings', async (req, res) => {
  const room = await loadRoom(req.params.id);
  if (!room || String(room.owner) !== String(req.user._id)) return res.status(403).json({ ok: false, message: 'صلاحية مالك الغرفة مطلوبة' });
  if (['public', 'friends', 'private'].includes(req.body.visibility)) room.visibility = req.body.visibility;
  if (['public', 'friends', 'none'].includes(req.body.spectatorsPolicy)) room.spectatorsPolicy = req.body.spectatorsPolicy;
  if (['open', 'players_friends', 'players_only'].includes(req.body.voicePolicy)) room.voicePolicy = req.body.voicePolicy;
  if (req.body.voiceEnabled !== undefined) room.voiceEnabled = Boolean(req.body.voiceEnabled);
  if (req.body.liveEnabled !== undefined) room.liveEnabled = Boolean(req.body.liveEnabled);
  await room.save(); emitRoom(req, room); res.json({ ok: true, room: publicState(await decorate(room)) });
});

router.delete('/:id', async (req, res) => {
  const room = await loadRoom(req.params.id);
  if (!room || String(room.owner) !== String(req.user._id)) return res.status(403).json({ ok: false, message: 'مالك الغرفة فقط يستطيع إغلاقها' });
  room.isActive = false; room.gameState.status = 'finished'; room.gameState.updatedAt = new Date(); await room.save(); emitRoom(req, room, 'game:room-closed'); res.json({ ok: true });
});

router.post('/:id/spectator-invites', async (req, res) => {
  const now = Date.now();
  const recent = (inviteWindows.get(String(req.user._id)) || []).filter((time) => now - time < 60 * 1000);
  if (recent.length >= 10) return res.status(429).json({ ok: false, message: 'محاولات الدعوة كثيرة، حاول لاحقاً' });
  recent.push(now); inviteWindows.set(String(req.user._id), recent);
  const room = await loadRoom(req.params.id);
  if (!room || !room.players.some((id) => String(id) === String(req.user._id))) return res.status(403).json({ ok: false, message: 'اللاعبون فقط يستطيعون إرسال الدعوات' });
  const invitee = await User.findById(req.body.userId).select('_id fullName username blockedUsers');
  if (!invitee || String(invitee._id) === String(req.user._id) || blocked(req.user, invitee) || !(await friends(req.user._id, invitee._id))) return res.status(400).json({ ok: false, message: 'يمكن دعوة الأصدقاء فقط' });
  const invite = await GameSpectatorInvite.findOneAndUpdate({ room: room._id, inviter: req.user._id, invitee: invitee._id }, { $set: { status: 'pending' } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  res.status(201).json({ ok: true, invite: { id: invite._id, roomId: room._id, invitee: invitee._id, message: `${req.user.displayName || req.user.fullName} دعاك لمشاهدة تحدي ${GAME_NAMES[room.gameType || 'domino']}` } });
});


router.post('/:id/action', async (req, res) => {
  const room = await loadRoom(req.params.id);
  if (!room || room.isActive === false) return res.status(404).json({ ok: false, message: 'الغرفة غير موجودة' });
  if (!room.players.some((id) => String(id) === String(req.user._id))) return res.status(403).json({ ok: false, message: 'ليس أنت لاعباً في هذه الغرفة' });
  const gameType = room.gameType || 'domino';
  const supported = ['domino', 'tawla', 'chess', 'cards'];
  if (!supported.includes(gameType)) return res.status(400).json({ ok: false, message: 'نوع اللعبة غير مدعوم' });
  const reg = require('../games/game-engine-registry');
  const engine = reg.getEngine(gameType);
  if (!engine || !engine.applyAction) return res.status(500).json({ ok: false, message: 'محرك اللعبة غير متاح' });
  const engineState = room.gameState && room.gameState.engineState ? room.gameState.engineState : null;
  if (!engineState) return res.status(409).json({ ok: false, message: 'لم تبدأ اللعبة بعد' });
  try {
    const result = engine.applyAction(engineState, String(req.user._id), req.body || {});
    if (result && result.error) return res.status(400).json({ ok: false, message: result.error, error: result.error });
    room.gameState.engineState = result && result.state ? result.state : engineState;
    if (result && result.state) {
      room.gameState.board = result.state.board || engineState.board || [];
      room.gameState.moveCount = (result.state.moveCount || engineState.moveCount || 0);
      room.gameState.status = result.state.status || engineState.status || 'active';
      if (result.state.turn) room.gameState.turn = result.state.turn;
    }
    room.gameState.updatedAt = new Date();
    await room.save();
    const decorated = await decorate(room);
    const base = publicState(decorated);
    const privateState = (engine && engine.getPrivateState) ? engine.getPrivateState(room.gameState.engineState, String(req.user._id)) : null;
    const legalActions = (engine && engine.getLegalActions) ? engine.getLegalActions(room.gameState.engineState, String(req.user._id)) : [];
    const publicEngine = (engine && engine.getPublicState) ? engine.getPublicState(room.gameState.engineState) : (room.gameState.engineState && room.gameState.engineState.public ? room.gameState.engineState.public : room.gameState.engineState);
    emitRoom(req, room);
    res.json({ ok: true, room: { ...base, engineState: { public: publicEngine && publicEngine.public ? publicEngine.public : publicEngine, private: privateState, legalActions: legalActions || [] } } });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message || 'خطأ في تنفيذ الحركة' });
  }
});

module.exports = { router, publicState, canSpectate, canVoice, decorate };
