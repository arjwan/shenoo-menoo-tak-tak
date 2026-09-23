'use strict';

// REST surface for the immutable Canva cards-center original (external adapter).
// Surface:
//   GET    /original                    -> the approved original (public asset,
//                                           served with the documented serve-time
//                                           Canva-SDK adaptation, see below)
//   GET    /center/config  (auth)       -> real account + auto-spectate decision
//   POST   /rooms/:id/spectate (auth)   -> server-authoritative spectate registration
//   DELETE /rooms/:id/spectate (auth)   -> leave as spectator
//
// Room creation/joining/moves deliberately reuse the real /api/game-rooms
// surface (game-rooms.routes) — the cards center never simulates rooms
// locally; every seat, spectator and card count comes from the authoritative
// GameRoom documents.

const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const GameRoom = require('../models/GameRoom');
const gameRooms = require('./game-rooms.routes');

async function loadRoom(id) {
  if (mongoose.isValidObjectId(id)) return GameRoom.findById(id);
  return GameRoom.findOne({ roomCode: String(id), isActive: { $ne: false } });
}

function nameOf(person) {
  return (person && (person.name || person.username)) || 'لاعب';
}

// The auto-spectate decision is made ONLY here, server-side: pick the most
// recently updated active cards room whose game is running and where the
// viewer is not a player/owner but is allowed to spectate. Clients never
// decide whether they may watch — they only receive the decision.
async function pickAutoSpectateRoom(user) {
  const rooms = await GameRoom.find({ gameType: 'cards', isActive: { $ne: false }, 'gameState.status': 'active' })
    .sort({ updatedAt: -1 })
    .limit(20);
  for (const room of rooms) {
    const userId = String(user._id);
    if (String(room.owner) === userId) continue;
    if ((room.players || []).some((id) => String(id) === userId)) continue;
    if (await gameRooms.canSpectate(user, room)) {
      return { roomId: String(room._id), roomCode: room.roomCode, name: room.name, reason: 'game-in-progress' };
    }
  }
  return null;
}

router.get('/center/config', requireAuth, async (req, res) => {
  try {
    const rooms = await GameRoom.find({ gameType: 'cards', isActive: { $ne: false } }).sort({ updatedAt: -1 }).limit(20);
    const list = [];
    for (const room of rooms) {
      if (await gameRooms.canSpectate(req.user, room)) list.push(gameRooms.publicState(await gameRooms.decorate(room)));
    }
    const autoSpectate = await pickAutoSpectateRoom(req.user);
    res.json({
      ok: true,
      mode: 'real',
      user: { id: String(req.user._id), name: req.user.displayName || req.user.fullName, username: req.user.username },
      restApiUrl: '/api/cards-canva',
      gameRoomsApi: '/api/game-rooms',
      rooms: list,
      autoSpectate
    });
  } catch (e) { res.status(500).json({ ok: false, message: e.message }); }
});

// Server-authoritative spectate registration. Idempotent: registering twice
// keeps exactly one spectator entry. Players/owners are told they are
// players, never silently turned into spectators.
async function spectateChange(req, res, join) {
  const room = await loadRoom(req.params.id);
  if (!room || room.isActive === false) return res.status(404).json({ ok: false, message: 'الغرفة غير موجودة' });
  const userId = String(req.user._id);
  const isPlayer = room.players.some((id) => String(id) === userId) || String(room.owner) === userId;
  if (join && isPlayer) {
    const decorated = await gameRooms.decorate(room);
    return res.json({ ok: true, spectating: false, isSpectator: false, isPlayer: true, spectatorCount: room.spectators.length, room: gameRooms.publicState(decorated) });
  }
  if (!(await gameRooms.canSpectate(req.user, room))) return res.status(403).json({ ok: false, message: 'لا تملك صلاحية مشاهدة هذه الغرفة' });
  if (join) {
    if (!room.spectators.some((id) => String(id) === userId)) room.spectators.push(req.user._id);
  } else {
    room.spectators = room.spectators.filter((id) => String(id) !== userId);
  }
  await room.save();
  const io = req.app.get('io');
  if (io) io.emit('game:room-updated', { roomId: String(room._id), roomCode: room.roomCode });
  const decorated = await gameRooms.decorate(room);
  res.json({
    ok: true,
    spectating: join,
    isSpectator: join,
    spectatorCount: room.spectators.length,
    spectators: decorated.spectators.map(nameOf),
    room: gameRooms.publicState(decorated)
  });
}
// Express 4 does not catch async rejections from bare handlers; an unhandled
// rejection during spectateChange aborts the socket (client sees ECONNRESET)
// instead of a JSON 500. Always forward errors through next().
function spectateHandler(join) {
  return (req, res, next) => {
    Promise.resolve(spectateChange(req, res, join)).catch(next);
  };
}
router.post('/rooms/:id/spectate', requireAuth, spectateHandler(true));
router.delete('/rooms/:id/spectate', requireAuth, spectateHandler(false));

// The immutable original is a public design asset (no secrets inside); the
// loader fetches it through the API so Oracle's root-only static publishing
// keeps working. Served with no-store so the approved bytes always match.
//
// The file on disk is NEVER modified (its SHA-256 stays the approved value
// and is pinned by the test-suite). The Canva export of this file references
// four Canva-hosted SDK scripts by relative URL:
//     /_sdk/<hash>.telemetry_sdk.js, /_sdk/<hash>.data_sdk.js,
//     /_sdk/<hash>.editing_sdk.js,   /_sdk/<hash>.resizing_sdk.js
// Those URLs only resolve on canva.com; anywhere else they 404 and the
// original's own unguarded `window.dataSdk.init(...)` call (inside its
// DOMContentLoaded) throws. This external serving layer therefore swaps each
// of those four script tags for a small inline compatibility shim defining
// `window.dataSdk` (in-memory records, isOk:true) plus no-op
// telemetry/editing/resizing globals. The swap is mechanical: it matches the
// `/_sdk/<hash>.<name>_sdk.js` src pattern and nothing else; markup, CSS,
// the app script and both CDN scripts (tailwind/lucide) are served exactly
// as stored. If the file is ever re-exported without those references, the
// adaptation is a no-op.
const SDK_TAG = /<script src="\/_sdk\/[0-9a-f]+\.(telemetry|data|editing|resizing)_sdk\.js"[^>]*><\/script>/g;
const SDK_SHIM = '<script>(function(){if(!window.dataSdk){var records=[];window.dataSdk={init:function(h){setTimeout(function(){try{if(h&&h.onDataChanged)h.onDataChanged(records.slice())}catch(e){}},0);return Promise.resolve({isOk:true})},create:function(r){records.push(r);return Promise.resolve({isOk:true,record:r})},update:function(){return Promise.resolve({isOk:true})},delete:function(){return Promise.resolve({isOk:true})},list:function(){return Promise.resolve({isOk:true,records:records.slice()})}}}window.telemetrySdk=window.telemetrySdk||{track:function(){}};window.editingSdk=window.editingSdk||{};window.resizingSdk=window.resizingSdk||{requestResize:function(){return Promise.resolve({isOk:true})}}})();</script>';
function adaptCanvaSdk(html) {
  return String(html || '').replace(SDK_TAG, SDK_SHIM);
}
router.get('/original', (_req, res) => {
  res.type('html');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const file = path.resolve(__dirname, '../../../original-assets/cards-canva/cards-canva-original.html');
  fs.readFile(file, (err, buf) => {
    if (err) return res.status(500).json({ ok: false, message: 'فشل تحميل الأصل' });
    res.end(adaptCanvaSdk(buf.toString('utf8')));
  });
});

module.exports = router;
module.exports.adaptCanvaSdk = adaptCanvaSdk;
module.exports.pickAutoSpectateRoom = pickAutoSpectateRoom;
