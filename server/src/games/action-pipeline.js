// Shared server-authoritative move pipeline for Kahwa games.
//
// BOTH entry points (REST POST /api/game-rooms/:id/action and the socket.io
// `game:move` event) MUST go through applyRoomAction so that:
//   1. moves for one room are serialized (per-room mutex): overlapping
//      requests (double tap, retry, two devices) can no longer read the same
//      base state and overwrite each other (lost update / turn corruption);
//   2. every user gesture carries a client-generated moveId and the server
//      applies each moveId at most once (duplicate-safe even across retries);
//   3. legality is decided ONLY by the authoritative engine against the latest
//      persisted state: illegal moves are rejected BEFORE any turn/state
//      change, and duplicates change nothing.
//
// The mutex is in-memory (correct for the single-process deployment). The
// appliedMoveIds list is persisted inside engineState, so duplicate
// protection additionally survives restarts and rejects replays.

function noop() {}

function newChain() {
  let tail = Promise.resolve();
  return function run(fn) {
    const head = tail.then(fn, fn);
    tail = head.then(noop, noop);
    return head;
  };
}

const roomChains = new Map();
function withRoomLock(roomId, fn) {
  const key = String(roomId);
  let run = roomChains.get(key);
  if (!run) {
    run = newChain();
    if (roomChains.size > 5000) roomChains.clear();
    roomChains.set(key, run);
  }
  return run(fn);
}

function appliedList(state) {
  if (!Array.isArray(state.appliedMoveIds)) state.appliedMoveIds = [];
  return state.appliedMoveIds;
}

function applyRoomAction(engine, engineState, userId, action) {
  const uid = String(userId);
  const act = action && typeof action === 'object' ? action : {};
  const moveId = act.moveId != null ? String(act.moveId).slice(0, 80) : '';
  if (moveId && appliedList(engineState).includes(moveId)) {
    return { ok: true, duplicate: true, state: engineState };
  }
  const result = engine.applyAction(engineState, uid, act);
  if (!result || result.error || result.ok === false) return result;
  const next = result.state || engineState;
  if (moveId) {
    const list = appliedList(next);
    list.push(moveId);
    if (list.length > 50) list.splice(0, list.length - 50);
  }
  result.state = next;
  return result;
}

module.exports = { withRoomLock, applyRoomAction };
