// عرض حالة اللعبة بشكل آمن ومشترك بين REST و Socket.IO.
// القاعدة: الحالة العامة للجميع، ويد اللاعب خاصة به فقط، والمشاهد لا يستلم أي يد.
const registry = require('./game-engine-registry');

function engineFor(gameType) {
  try {
    return registry.getEngine(String(gameType || '')) || null;
  } catch {
    return null;
  }
}

function hasEngineState(room) {
  return Boolean(room && room.gameState && room.gameState.engineState);
}

function publicEngineView(room) {
  if (!hasEngineState(room)) return null;
  const engine = engineFor(room.gameType);
  if (!engine || typeof engine.getPublicState !== 'function') return null;
  try {
    return engine.getPublicState(room.gameState.engineState);
  } catch {
    return null;
  }
}

function isPlayer(room, userId) {
  const id = String(userId || '');
  return Boolean(id && room && (room.players || []).some((player) => String(player) === id));
}

function isSpectator(room, userId) {
  const id = String(userId || '');
  return Boolean(id && room && (room.spectators || []).some((player) => String(player) === id));
}

function viewerRole(room, userId) {
  const id = String(userId || '');
  if (!id || !room) return 'guest';
  if (isPlayer(room, id)) return 'player';
  if (String(room.owner || '') === id) return 'owner';
  if (isSpectator(room, id)) return 'spectator';
  return 'visitor';
}

// view موحّد لأي مستخدم: المشاهد/الزائر لا يحصل أبداً على private أو legalActions.
function engineViewFor(room, userId) {
  const publicView = publicEngineView(room);
  if (!publicView) return null;
  const viewerId = String(userId || '');
  const role = viewerRole(room, viewerId);
  if (!isPlayer(room, viewerId)) {
    return { public: publicView, private: null, legalActions: [], spectator: true, viewerRole: role };
  }
  const engine = engineFor(room.gameType);
  const privateState = engine && typeof engine.getPrivateState === 'function' ? engine.getPrivateState(room.gameState.engineState, viewerId) : null;
  const legalActions = engine && typeof engine.getLegalActions === 'function' ? engine.getLegalActions(room.gameState.engineState, viewerId) : [];
  return { public: publicView, private: privateState, legalActions: legalActions || [], spectator: false, viewerRole: role };
}

function stateEventPayload(basePublic, enginePublic) {
  return { ...(basePublic || {}), engineState: enginePublic ? { public: enginePublic } : null };
}

function privateEventPayload(roomId, view) {
  return {
    roomId: String(roomId),
    engineState: { public: view.public, private: view.private, legalActions: view.legalActions, spectator: false }
  };
}

function emitViewToSocket(socket, roomId, basePublic, room) {
  if (!socket) return;
  const publicView = publicEngineView(room);
  socket.emit('game:state', stateEventPayload(basePublic, publicView));
  const userId = String((socket.user && socket.user._id) || (socket.data && socket.data.userId) || '');
  if (!publicView || !isPlayer(room, userId)) return;
  socket.emit('game:private', privateEventPayload(roomId, engineViewFor(room, userId)));
}

// بث جماعي: الحالة العامة للغرفة كلها، ويد كل لاعب على سوكتاته الخاصة داخل الغرفة فقط.
async function emitGameViews(io, roomId, basePublic, room) {
  if (!io) return;
  const publicView = publicEngineView(room);
  io.to(`game:${roomId}`).emit('game:state', stateEventPayload(basePublic, publicView));
  if (!publicView) return;
  const sockets = await io.in(`game:${roomId}`).fetchSockets().catch(() => []);
  for (const remote of sockets) {
    const userId = String((remote.data && remote.data.userId) || '');
    if (!userId || !isPlayer(room, userId)) continue;
    io.to(remote.id).emit('game:private', privateEventPayload(roomId, engineViewFor(room, userId)));
  }
}

module.exports = { engineFor, hasEngineState, publicEngineView, engineViewFor, isPlayer, isSpectator, viewerRole, stateEventPayload, privateEventPayload, emitViewToSocket, emitGameViews };
