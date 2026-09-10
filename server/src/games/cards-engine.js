// Generic cards engine (52 deck, deal private, turn-based)
function shuffleDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  const deck = [];
  for (const s of suits) for (const r of ranks) deck.push({ suit: s, rank: r, id: s + r });
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return deck;
}
function createGame(params = {}) {
  const players = params.playerIds || ['p1', 'p2'];
  const deck = shuffleDeck();
  const handSize = players.length === 2 ? 26 : Math.floor(52 / players.length);
  const hands = {};
  for (let i = 0; i < players.length; i++) {
    hands[players[i]] = deck.splice(0, handSize);
  }
  return {
    engine: 'cards', version: 1, status: 'waiting', turn: players[0],
    players, maxPlayers: players.length,
    hands, stock: deck, discard: [], table: [],
    finished: false, winner: null, createdAt: new Date()
  };
}
function getPublicState(s) {
  return { engine: s.engine, version: s.version, status: s.status, turn: s.turn, finished: s.finished, winner: s.winner, players: s.players, table: s.table, discardCount: s.discard ? s.discard.length : 0, stockCount: s.stock ? s.stock.length : 0, createdAt: s.createdAt };
}
function getPrivateState(s, userId) {
  return { ...getPublicState(s), hand: s.hands[userId] || [], turn: s.turn === userId };
}
function getLegalActions(s, userId) {
  if (s.status !== 'active' && s.status !== 'waiting') return [];
  if (s.turn !== userId) return [];
  const actions = [{ type: 'draw' }];
  // Simple discard option if has cards
  if ((s.hands[userId] || []).length > 0) actions.push({ type: 'discard', cardId: (s.hands[userId] || [])[0].id });
  return actions;
}
function applyAction(s, userId, action) {
  if (s.status !== 'active' && s.status !== 'waiting') return { error: 'not active' };
  if (s.turn !== userId) return { error: 'not your turn' };
  if (action.type === 'draw') {
    if (s.stock.length === 0) return { error: 'empty stock' };
    const card = s.stock.splice(0, 1)[0];
    s.hands[userId].push(card);
    s.turn = s.players[(s.players.indexOf(s.turn) + 1) % s.players.length];
    return { ok: true };
  }
  if (action.type === 'discard') {
    const idx = (s.hands[userId] || []).findIndex(c => c.id === action.cardId);
    if (idx < 0) return { error: 'card not in hand' };
    const card = s.hands[userId].splice(idx, 1)[0];
    s.discard.push(card);
    s.turn = s.players[(s.players.indexOf(s.turn) + 1) % s.players.length];
    return { ok: true };
  }
  return { error: 'unknown action' };
}
function isFinished(s) { return s.finished; }
function getWinner(s) { return s.winner || null; }
function serialize(s) { return JSON.stringify({ engine: 'cards', version: 1, status: s.status, turn: s.turn, players: s.players, finished: s.finished, winner: s.winner, createdAt: s.createdAt }); }
module.exports = { createGame: (p) => { const s = createGame(p); s.engine = 'cards'; return s; }, getPublicState, getPrivateState, getLegalActions, applyAction, isFinished, getWinner, serialize };
