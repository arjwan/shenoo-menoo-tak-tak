// Domino engine (Double Six) - server authoritative
function buildDeck() {
  const deck = [];
  for (let a = 0; a <= 6; a++) {
    for (let b = a; b <= 6; b++) deck.push({ a, b, id: `${a}-${b}` });
  }
  return deck;
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function totalPips(tiles) {
  return tiles.reduce((s, t) => s + t.a + t.b, 0);
}
function cloneState(s) { return JSON.parse(JSON.stringify(s)); }

function createGame(params = {}) {
  const suppliedIds = Array.isArray(params.playerIds) ? params.playerIds.map(String).filter(Boolean) : [];
  const playersCount = Math.min(4, Math.max(2, suppliedIds.length || Number(params.players) || 2));
  const playerIds = suppliedIds.length ? suppliedIds.slice(0, playersCount) : Array.from({ length: playersCount }, (_, i) => 'p' + i);
  let deck, hands, openingPlayer = params.preferredStarter && playerIds.includes(String(params.preferredStarter)) ? String(params.preferredStarter) : null;
  let openingDouble = null;
  do {
    deck = shuffle(buildDeck()); hands = {};
    for (let i = 0; i < playersCount; i++) hands[playerIds[i]] = deck.splice(0, 7);
    if (!openingPlayer) {
      for (let value = 6; value >= 0 && !openingPlayer; value--) {
        for (const player of playerIds) if (hands[player].some(t => t.a === value && t.b === value)) { openingPlayer = player; openingDouble = value; break; }
      }
    }
  } while (!openingPlayer);
  const stock = deck;
  const chain = [];
  return {
    engine: 'domino',
    version: 1,
    status: 'waiting',
    turn: openingPlayer,
    openingTileId: null,
    openingDouble,
    players: playerIds,
    maxPlayers: playersCount,
    hands: hands,
    stock: stock.map(t => ({ a: t.a, b: t.b, id: t.id })),
    chain: chain.map(t => ({ a: t.a, b: t.b, id: t.id, left: true, right: true })),
    finished: false,
    winner: null,
    moveCount: 0,
    scores: params.scores && typeof params.scores === 'object' ? { ...params.scores } : {},
    roundNumber: Math.max(1, Number(params.roundNumber) || 1),
    lastRound: params.lastRound || null,
    createdAt: new Date()
  };
}

// MANDATORY INVARIANT: every two adjacent tiles must touch on equal pips
// (chain[i].b === chain[i+1].a for all i). Open ends are ALWAYS derived from
// the oriented chain itself (never cached, never assumed): with a valid
// chain, the true open ends are chain[0].a (left) and chain[last].b (right).
// Any divergence means corruption, never a rule.
function validateChain(chain) {
  const out = { valid: false, left: null, right: null };
  if (!Array.isArray(chain)) return out;
  for (let i = 0; i < chain.length; i++) {
    const t = chain[i];
    if (!t || !Number.isInteger(t.a) || !Number.isInteger(t.b)) return out;
    if (t.a < 0 || t.a > 6 || t.b < 0 || t.b > 6) return out;
    if (i + 1 < chain.length && t.b !== chain[i + 1].a) return out;
  }
  out.valid = true;
  if (chain.length) { out.left = chain[0].a; out.right = chain[chain.length - 1].b; }
  return out;
}
function openEnds(chain) {
  const v = validateChain(chain);
  return v.left === null ? null : { left: v.left, right: v.right };
}
// Every placement the player could legally make RIGHT NOW (draw/pass excluded).
// Used both to offer UI actions and to re-verify draw/pass on apply: a player
// holding a playable tile may neither draw nor pass.
function placementsFor(state, userId) {
  const hand = (state.hands && state.hands[userId]) || [];
  const chain = Array.isArray(state.chain) ? state.chain : [];
  const out = [];
  if (!chain.length) {
    for (const tile of hand) if (state.openingDouble == null || (tile.a === state.openingDouble && tile.b === state.openingDouble)) out.push({ type: 'place', tile: { ...tile }, direction: 'right' });
    return out;
  }
  const ends = validateChain(chain);
  if (!ends.valid) return out;
  for (const tile of hand) {
    if (tile.a === ends.left || tile.b === ends.left) out.push({ type: 'place', tile: { ...tile }, direction: 'left' });
    if (tile.a === ends.right || tile.b === ends.right) out.push({ type: 'place', tile: { ...tile }, direction: 'right' });
  }
  return out;
}

function legalActions(state, userId) {
  if (state.status !== 'active' && state.status !== 'waiting') return [];
  if (state.turn !== userId) return [];
  const actions = placementsFor(state, userId);
  if (actions.length === 0 && state.stock && state.stock.length > 0) {
    actions.push({ type: 'draw' });
  }
  if (actions.length === 0 && (!state.stock || state.stock.length === 0)) {
    actions.push({ type: 'pass' });
  }
  return actions;
}

function applyAction(state, userId, action = {}) {action = (action && typeof action === 'object') ? action : {};
  if (state.status !== 'active' && state.status !== 'waiting') return { error: 'not active' };
  if (state.turn !== userId) return { error: 'not your turn' };
  if (action.type === 'draw') {
    if (!state.stock || state.stock.length === 0) return { error: 'no stock' };
    if (!Array.isArray(state.hands[userId])) return { error: 'not in game' };
    if (placementsFor(state, userId).length > 0) return { error: 'لديك حجر صالح للعب — ضعه بدل السحب' };
    const drawn = state.stock.splice(0, 1)[0];
    state.hands[userId].push(drawn);
    state.moveCount += 1;
    // The same player keeps drawing until a playable tile appears or stock is empty.
    state.turn = userId;
    return { ok: true };
  }
  if (action.type === 'pass') {
    if (state.stock && state.stock.length > 0) return { error: 'cannot pass with stock' };
    if (placementsFor(state, userId).length > 0) return { error: 'لديك حجر صالح للعب — لا يمكن المرور' };
    state.turn = state.players[(state.players.indexOf(userId) + 1) % state.players.length];
    state.moveCount += 1;
    if ((!state.stock || state.stock.length === 0) && state.players.every(p => placementsFor(state, p).length === 0)) {
      const scores = {};
      for (const pl of state.players) scores[pl] = totalPips(state.hands[pl] || []);
      let lowest = state.players[0];
      for (const pl of state.players) if (scores[pl] < scores[lowest]) lowest = pl;
      const points = state.players.filter(pl => pl !== lowest).reduce((sum, pl) => sum + totalPips(state.hands[pl] || []), 0);
      state.scores = state.scores || {};
      state.scores[lowest] = Number(state.scores[lowest] || 0) + points;
      state.lastRound = { winner: lowest, points, roundNumber: state.roundNumber || 1, blocked: true, remaining: state.players.filter(pl => pl !== lowest).map(pl => ({ player: pl, points: totalPips(state.hands[pl] || []) })) };
      state.status = 'finished'; state.winner = lowest; state.finished = true;
    }
    return { ok: true };
  }
  if (action.type === 'place') {
    if (!Array.isArray(state.hands[userId])) return { error: 'not in game' };
    const tile = state.hands[userId].find(t => t.id === (action.tile && action.tile.id));
    if (!tile) return { error: 'tile not in hand' };
    if (!state.chain.length) {
      if (state.openingDouble != null && (tile.a !== state.openingDouble || tile.b !== state.openingDouble)) return { error: 'opening double required' };
      state.chain.push({ ...tile }); state.openingDouble = null; state.openingTileId = tile.id;
    } else {
    if (action.direction !== 'left' && action.direction !== 'right') return { error: 'illegal placement' };
    const ends = validateChain(state.chain);
    if (!ends.valid) return { error: 'illegal placement' };
    let placed = null;
    if (action.direction === 'left') {
      if (tile.b === ends.left) placed = { ...tile };
      else if (tile.a === ends.left) placed = { a: tile.b, b: tile.a, id: tile.id };
      else return { error: 'illegal placement' };
      const candidate = [placed].concat(state.chain);
      if (!validateChain(candidate).valid) return { error: 'illegal placement' };
      state.chain.unshift(placed);
    } else {
      if (tile.a === ends.right) placed = { ...tile };
      else if (tile.b === ends.right) placed = { a: tile.b, b: tile.a, id: tile.id };
      else return { error: 'illegal placement' };
      const candidate = state.chain.concat([placed]);
      if (!validateChain(candidate).valid) return { error: 'illegal placement' };
      state.chain.push(placed);
    }
    }
    state.hands[userId] = state.hands[userId].filter(t => t.id !== tile.id);
    state.moveCount += 1;
    // Handle double rotation: if double placed at end, rotate for visual
    if (tile.a === tile.b) {
      // Visual rotation handled by UI; server just keeps data
    }
    // Check winning
    if (state.hands[userId].length === 0) {
      const points = state.players.filter(p => p !== userId).reduce((sum, p) => sum + totalPips(state.hands[p] || []), 0);
      state.scores = state.scores || {};
      state.scores[userId] = Number(state.scores[userId] || 0) + points;
      state.lastRound = { winner: userId, points, roundNumber: state.roundNumber || 1, remaining: state.players.filter(p => p !== userId).map(p => ({ player: p, points: totalPips(state.hands[p] || []) })) };
      state.status = 'finished'; state.winner = userId; state.finished = true;
    }
    else {
      state.turn = state.players[(state.players.indexOf(userId) + 1) % state.players.length];
    }
    return { ok: true };
  }
  return { error: 'unknown action' };
}

function isFinished(state) { return state.finished || state.status === 'finished'; }
function getWinner(state) { return state.winner || null; }
function getPublicState(state) {
  return {
    status: state.status,
    turn: state.turn,
    players: state.players.map(id => ({ id, handCount: (state.hands[id] || []).length })),
    chain: (state.chain || []).map(tile => ({ a: tile.a, b: tile.b, id: tile.id })),
    chainLength: (state.chain || []).length,
    openingTileId: state.openingTileId || null,
    stockCount: (state.stock || []).length,
    moveCount: state.moveCount,
    finished: state.finished,
    winner: state.winner,
    scores: state.scores || {},
    roundNumber: state.roundNumber || 1,
    lastRound: state.lastRound || null
  };
}
function getPrivateState(state, userId) {
  return {
    hand: state.hands[userId] || [],
    turn: state.turn === userId,
    status: state.status,
    chain: state.chain,
    stockCount: (state.stock || []).length
  };
}
function serialize(state) { return JSON.stringify({ engine: 'domino', version: 1, status: state.status, turn: state.turn, players: state.players, handCounts: state.players.map(id => (state.hands[id] || []).length), chain: state.chain, stockLength: (state.stock || []).length, finished: state.finished, winner: state.winner, moveCount: state.moveCount, createdAt: state.createdAt }); }

module.exports = { createGame: (params) => { const s = createGame(params); s.engine = 'domino'; return s; }, getPublicState, getPrivateState, getLegalActions: legalActions, applyAction, isFinished, getWinner, serialize, validateChain, openEnds, placementsFor };
