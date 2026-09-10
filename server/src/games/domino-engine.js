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
  const playersCount = Math.min(4, Math.max(2, Number(params.players) || 2));
  const playerIds = params.playerIds || Array.from({ length: playersCount }, (_, i) => 'p' + i);
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
    openingDouble,
    players: playerIds,
    maxPlayers: playersCount,
    hands: hands,
    stock: stock.map(t => ({ a: t.a, b: t.b, id: t.id })),
    chain: chain.map(t => ({ a: t.a, b: t.b, id: t.id, left: true, right: true })),
    finished: false,
    winner: null,
    moveCount: 0,
    createdAt: new Date()
  };
}

function legalActions(state, userId) {
  if (state.status !== 'active' && state.status !== 'waiting') return [];
  if (state.turn !== userId) return [];
  const hand = state.hands[userId] || [];
  const actions = [];
  if (!state.chain.length) {
    for (const tile of hand) if (state.openingDouble == null || (tile.a === state.openingDouble && tile.b === state.openingDouble)) actions.push({ type: 'place', tile: { ...tile }, direction: 'right' });
    return actions;
  }
  const leftEnd = state.chain[0];
  const rightEnd = state.chain[state.chain.length - 1];
  for (const tile of hand) {
    if (tile.a === leftEnd.a || tile.b === leftEnd.a) actions.push({ type: 'place', tile: { ...tile }, direction: 'left' });
    if (tile.a === rightEnd.b || tile.b === rightEnd.b) actions.push({ type: 'place', tile: { ...tile }, direction: 'right' });
  }
  if (actions.length === 0 && state.stock && state.stock.length > 0) {
    actions.push({ type: 'draw' });
  }
  if (actions.length === 0 && (!state.stock || state.stock.length === 0)) {
    actions.push({ type: 'pass' });
  }
  return actions;
}

function applyAction(state, userId, action) {
  if (state.status !== 'active' && state.status !== 'waiting') return { error: 'not active' };
  if (state.turn !== userId) return { error: 'not your turn' };
  if (action.type === 'draw') {
    if (!state.stock || state.stock.length === 0) return { error: 'no stock' };
    const drawn = state.stock.splice(0, 1)[0];
    state.hands[userId].push(drawn);
    state.moveCount += 1;
    state.turn = state.players[(state.players.indexOf(userId) + 1) % state.players.length];
    return { ok: true };
  }
  if (action.type === 'pass') {
    if (state.stock && state.stock.length > 0) return { error: 'cannot pass with stock' };
    // Check if any legal play exists; if not, pass allowed
    state.turn = state.players[(state.players.indexOf(userId) + 1) % state.players.length];
    state.moveCount += 1;
    return { ok: true };
  }
  if (action.type === 'place') {
    const tile = state.hands[userId].find(t => t.id === action.tile.id);
    if (!tile) return { error: 'tile not in hand' };
    if (!state.chain.length) {
      if (state.openingDouble != null && (tile.a !== state.openingDouble || tile.b !== state.openingDouble)) return { error: 'opening double required' };
      state.chain.push({ ...tile }); state.openingDouble = null;
    } else {
    const leftEnd = state.chain[0];
    const rightEnd = state.chain[state.chain.length - 1];
    if (action.direction === 'left') {
      if (tile.b === leftEnd.a) state.chain.unshift({ ...tile });
      else if (tile.a === leftEnd.a) state.chain.unshift({ a: tile.b, b: tile.a, id: tile.id });
      else return { error: 'illegal placement' };
    } else {
      if (tile.a === rightEnd.b) state.chain.push({ ...tile });
      else if (tile.b === rightEnd.b) state.chain.push({ a: tile.b, b: tile.a, id: tile.id });
      else return { error: 'illegal placement' };
    }
    }
    state.hands[userId] = state.hands[userId].filter(t => t.id !== tile.id);
    state.moveCount += 1;
    // Handle double rotation: if double placed at end, rotate for visual
    if (tile.a === tile.b) {
      // Visual rotation handled by UI; server just keeps data
    }
    // Check winning
    if (state.hands[userId].length === 0) { state.status = 'finished'; state.winner = userId; state.finished = true; }
    else {
      // Check if blocked for next player
      const next = state.turn = state.players[(state.players.indexOf(userId) + 1) % state.players.length];
      const nextHand = state.hands[next] || [];
      const nextLegal = legalActions(state, next);
      if (nextLegal.length === 0 && (!state.stock || state.stock.length === 0)) {
        // Blocked: check lowest pips
        const scores = {};
        for (const p of state.players) scores[p] = totalPips(state.hands[p] || []);
        let lowest = state.players[0];
        for (const p of state.players) if (scores[p] < scores[lowest]) lowest = p;
        state.status = 'finished'; state.winner = lowest; state.finished = true;
      } else {
        state.turn = next;
      }
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
    chainLength: state.chain.length,
    stockCount: (state.stock || []).length,
    moveCount: state.moveCount,
    finished: state.finished,
    winner: state.winner
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

module.exports = { createGame: (params) => { const s = createGame(params); s.engine = 'domino'; return s; }, getPublicState, getPrivateState, getLegalActions: legalActions, applyAction, isFinished, getWinner, serialize };
