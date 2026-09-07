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

function publicState(room) {
  const profiles = new Map((room.playerProfiles || []).map((user) => [String(user._id), user]));
  const person = (id) => {
    const user = profiles.get(String(id));
    return user ? { id: user._id, name: user.displayName || user.fullName, username: user.username, avatarUrl: user.profile?.avatarUrl || '' } : { id };
  };
  return {
    id: room._id,
    name: room.name,
    owner: person(room.owner),
    players: room.players.map(person),
    spectators: room.spectators.map(person),
    spectatorsPolicy: room.spectatorsPolicy,
    voiceEnabled: room.voiceEnabled,
    voicePolicy: room.voicePolicy,
    gameState: {
      status: room.gameState.status,
      turn: room.gameState.turn ? person(room.gameState.turn) : null,
      scores: Object.fromEntries(room.gameState.scores || []),
      board: room.gameState.board,
      moveCount: room.gameState.moveCount,
      updatedAt: room.gameState.updatedAt
    }
  };
}

async function decorate(room) {
  room.playerProfiles = await User.find({ _id: { $in: [...room.players, ...room.spectators, room.owner] } }).select('fullName displayName username profile');
  return room;
}

async function loadRoom(id) {
  return mongoose.isValidObjectId(id) ? GameRoom.findById(id) : null;
}
async function canSpectate(user, room) {
  if (String(room.owner) === String(user._id) || room.players.some((id) => String(id) === String(user._id))) return true;
  const playerUsers = await User.find({ _id: { $in: room.players } }).select('blockedUsers privacy');
  if (playerUsers.some((player) => blocked(user, player) || (user.blockedUsers || []).some((id) => String(id) === String(player._id)))) return false;
  for (const player of playerUsers) {
    const policy = player.privacy?.get('gameSpectating') || 'friends';
    if (policy === 'nobody' || (policy === 'friends' && !(await friends(user._id, player._id)))) return false;
  }
  if (room.spectatorsPolicy === 'none') return false;
  if (room.spectatorsPolicy === 'public') return true;
  for (const player of room.players) if (await friends(user._id, player)) return true;
  return false;
}
async function canVoice(user, room) {
  if (!room.voiceEnabled) return false;
  const playerUsers = await User.find({ _id: { $in: room.players } }).select('blockedUsers privacy');
  if (playerUsers.some((player) => blocked(user, player) || (user.blockedUsers || []).some((id) => String(id) === String(player._id)))) return false;
  for (const player of playerUsers) {
    if (String(player._id) === String(user._id)) continue;
    const policy = player.privacy?.get('gameVoice') || 'friends';
    if (policy === 'nobody' || (policy === 'friends' && !(await friends(user._id, player._id)))) return false;
  }
  if (room.players.some((id) => String(id) === String(user._id)) || String(room.owner) === String(user._id)) return true;
  if (room.voicePolicy === 'players_only') return false;
  if (room.voicePolicy === 'open') return true;
  for (const player of room.players) if (await friends(user._id, player)) return true;
  return false;
}

router.post('/', async (req, res) => {
  const room = await GameRoom.create({
    name: String(req.body.name || 'مباراة دومنة').trim(),
    owner: req.user._id,
    players: [req.user._id],
    spectatorsPolicy: ['public', 'friends', 'none'].includes(req.body.spectatorsPolicy) ? req.body.spectatorsPolicy : 'friends',
    voicePolicy: ['open', 'players_friends', 'players_only'].includes(req.body.voicePolicy) ? req.body.voicePolicy : 'players_friends'
  });
  res.status(201).json({ ok: true, room: publicState(await decorate(room)) });
});

router.get('/:id', async (req, res) => {
  const room = await loadRoom(req.params.id);
  if (!room) return res.status(404).json({ ok: false, message: 'الغرفة غير موجودة' });
  if (!(await canSpectate(req.user, room))) return res.status(403).json({ ok: false, message: 'لا تملك صلاحية مشاهدة هذه الغرفة' });
  res.json({ ok: true, room: publicState(await decorate(room)) });
});

router.post('/:id/join', async (req, res) => {
  const room = await loadRoom(req.params.id);
  if (!room) return res.status(404).json({ ok: false, message: 'الغرفة غير موجودة' });
  if (room.players.some((id) => String(id) === String(req.user._id))) return res.json({ ok: true, room: publicState(await decorate(room)) });
  if (room.players.length >= 2) return res.status(409).json({ ok: false, message: 'الغرفة مكتملة' });
  const playerUsers = await User.find({ _id: { $in: room.players } }).select('blockedUsers');
  if (playerUsers.some((player) => blocked(req.user, player))) return res.status(403).json({ ok: false, message: 'لا يمكنك الانضمام لهذه الغرفة' });
  room.players.push(req.user._id);
  if (!room.gameState.turn) room.gameState.turn = room.players[0];
  await room.save();
  res.json({ ok: true, room: publicState(await decorate(room)) });
});

router.delete('/:id/join', async (req, res) => {
  const room = await loadRoom(req.params.id);
  if (!room || String(room.owner) === String(req.user._id)) return res.status(400).json({ ok: false, message: 'مالك الغرفة لا يغادرها بهذه الطريقة' });
  room.players = room.players.filter((id) => String(id) !== String(req.user._id));
  room.spectators = room.spectators.filter((id) => String(id) !== String(req.user._id));
  await room.save();
  res.json({ ok: true });
});

router.patch('/:id/settings', async (req, res) => {
  const room = await loadRoom(req.params.id);
  if (!room || String(room.owner) !== String(req.user._id)) return res.status(403).json({ ok: false, message: 'صلاحية مالك الغرفة مطلوبة' });
  if (req.body.spectatorsPolicy !== undefined) {
    if (!['public', 'friends', 'none'].includes(req.body.spectatorsPolicy)) return res.status(400).json({ ok: false, message: 'سياسة المشاهدة غير صالحة' });
    room.spectatorsPolicy = req.body.spectatorsPolicy;
  }
  if (req.body.voicePolicy !== undefined) {
    if (!['open', 'players_friends', 'players_only'].includes(req.body.voicePolicy)) return res.status(400).json({ ok: false, message: 'سياسة الصوت غير صالحة' });
    room.voicePolicy = req.body.voicePolicy;
  }
  if (req.body.voiceEnabled !== undefined) room.voiceEnabled = Boolean(req.body.voiceEnabled);
  await room.save();
  res.json({ ok: true, room: publicState(await decorate(room)) });
});

router.post('/:id/spectator-invites', async (req, res) => {
  const now = Date.now();
  const recent = (inviteWindows.get(String(req.user._id)) || []).filter((time) => now - time < 60 * 1000);
  if (recent.length >= 10) return res.status(429).json({ ok: false, message: 'محاولات الدعوة كثيرة، حاول لاحقاً' });
  recent.push(now);
  inviteWindows.set(String(req.user._id), recent);
  const room = await loadRoom(req.params.id);
  if (!room || !room.players.some((id) => String(id) === String(req.user._id))) return res.status(403).json({ ok: false, message: 'اللاعبون فقط يستطيعون إرسال الدعوات' });
  const invitee = await User.findById(req.body.userId).select('_id fullName username blockedUsers');
  if (!invitee || String(invitee._id) === String(req.user._id) || blocked(req.user, invitee) || !(await friends(req.user._id, invitee._id))) return res.status(400).json({ ok: false, message: 'يمكن دعوة الأصدقاء فقط' });
  const invite = await GameSpectatorInvite.findOneAndUpdate(
    { room: room._id, inviter: req.user._id, invitee: invitee._id },
    { $set: { status: 'pending' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.status(201).json({ ok: true, invite: { id: invite._id, roomId: room._id, invitee: invitee._id, message: `${req.user.displayName || req.user.fullName} دعاك لمشاهدة مباراة دومنة` } });
});

router.get('/invites/incoming', async (req, res) => {
  const invites = await GameSpectatorInvite.find({ invitee: req.user._id, status: 'pending' }).populate('room inviter', 'name fullName displayName username');
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

module.exports = { router, publicState, canSpectate, canVoice, decorate };
