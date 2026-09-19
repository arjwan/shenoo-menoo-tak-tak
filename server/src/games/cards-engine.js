// Server-authoritative groups-and-runs card game (Rummy style).
const SUITS = ['s', 'h', 'd', 'c'];
const LABELS = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
function points(value) { return value > 10 ? 10 : value; }
function makeDeck() {
  const deck = [];
  for (const suit of SUITS) for (let value = 1; value <= 13; value++) deck.push({ id: suit + value, suit, value, rank: LABELS[value] || String(value), points: points(value) });
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return deck;
}
function normalize(state) {
  state.players = (state.players || []).map(String); state.hands = state.hands || {}; state.melds = state.melds || []; state.scores = state.scores || {};
  state.phase = state.phase || 'draw'; state.stock = state.stock || []; state.discard = state.discard || [];
  return state;
}
function createGame(params = {}) {
  const players = (params.playerIds || ['p1', 'p2']).map(String).slice(0, 4), stock = makeDeck(), hands = {}, scores = {};
  players.forEach(id => { hands[id] = []; scores[id] = 0; });
  for (let n = 0; n < 7; n++) players.forEach(id => hands[id].push(stock.pop()));
  const discard = [stock.pop()];
  return { engine: 'cards', version: 2, status: 'waiting', players, turn: players[0], phase: 'draw', hands, stock, discard, melds: [], scores, finished: false, winner: null, finishReason: '', moveCount: 0, createdAt: new Date() };
}
function cardIds(cards) { return new Set((cards || []).map(card => card.id)); }
function selectedCards(state, userId, ids) {
  const wanted = new Set((ids || []).map(String)), cards = (state.hands[userId] || []).filter(card => wanted.has(String(card.id)));
  return cards.length === wanted.size ? cards : null;
}
function validMeld(cards) {
  if (!cards || cards.length < 3) return false;
  const sameRank = cards.every(card => card.value === cards[0].value) && new Set(cards.map(card => card.suit)).size === cards.length;
  const ordered = [...cards].sort((a, b) => a.value - b.value), sameSuit = ordered.every(card => card.suit === ordered[0].suit);
  const sequence = sameSuit && ordered.every((card, index) => index === 0 || card.value === ordered[index - 1].value + 1);
  return sameRank || sequence;
}
function nextTurn(state) { const index = state.players.indexOf(String(state.turn)); state.turn = state.players[(index + 1) % state.players.length]; state.phase = 'draw'; }
function finish(state, userId) { state.finished = true; state.status = 'finished'; state.winner = String(userId); state.finishReason = 'empty_hand'; }
function getPublicState(state) {
  normalize(state);
  return { engine: state.engine, version: state.version, status: state.status, players: state.players.map(id => ({ id, handCount: (state.hands[id] || []).length, score: Number(state.scores[id] || 0) })), turn: state.turn, phase: state.phase, stockCount: state.stock.length, discardTop: state.discard[state.discard.length - 1] || null, discardCount: state.discard.length, melds: state.melds, scores: state.scores, finished: state.finished, winner: state.winner, finishReason: state.finishReason, moveCount: state.moveCount || 0 };
}
function getPrivateState(state, userId) { normalize(state); userId = String(userId); return { hand: state.hands[userId] || [], turn: state.turn === userId, phase: state.phase }; }
function getLegalActions(state, userId) {
  normalize(state); userId = String(userId); if (!['active', 'waiting'].includes(state.status) || state.finished || state.turn !== userId) return [];
  if (state.phase === 'draw') { const out = []; if (state.stock.length) out.push({ type: 'draw', source: 'stock' }); if (state.discard.length) out.push({ type: 'draw', source: 'discard' }); return out; }
  return [{ type: 'meld' }, { type: 'discard' }];
}
function applyAction(state, userId, action = {}) {action = (action && typeof action === 'object') ? action : {};
  normalize(state); userId = String(userId);
  if (!['active', 'waiting'].includes(state.status) || state.finished) return { error: 'اللعبة غير نشطة' };
  if (!state.players.includes(userId)) return { error: 'أنت لست لاعبًا' };
  if (state.turn !== userId) return { error: 'ليس دورك' };
  if (action.type === 'draw') {
    if (state.phase !== 'draw') return { error: 'لقد سحبت ورقة في هذا الدور' };
    let card;
    if (action.source === 'discard') card = state.discard.pop();
    else card = state.stock.pop();
    if (!card) return { error: 'الكومة فارغة' };
    state.hands[userId].push(card); state.phase = 'play'; state.status = 'active'; state.moveCount += 1; return { ok: true, state };
  }
  if (state.phase !== 'play') return { error: 'اسحب ورقة أولًا' };
  if (action.type === 'meld') {
    const cards = selectedCards(state, userId, action.cardIds); if (!validMeld(cards)) return { error: 'المجموعة غير صالحة' };
    const ids = cardIds(cards); state.hands[userId] = state.hands[userId].filter(card => !ids.has(card.id));
    const earned = cards.reduce((sum, card) => sum + card.points, 0); state.scores[userId] = Number(state.scores[userId] || 0) + earned;
    state.melds.push({ playerId: userId, cards, points: earned }); state.moveCount += 1; if (!state.hands[userId].length) finish(state, userId); return { ok: true, state };
  }
  if (action.type === 'discard') {
    const index = state.hands[userId].findIndex(card => String(card.id) === String(action.cardId)); if (index < 0) return { error: 'الورقة ليست في يدك' };
    state.discard.push(state.hands[userId].splice(index, 1)[0]); state.moveCount += 1;
    if (!state.hands[userId].length) finish(state, userId); else nextTurn(state); return { ok: true, state };
  }
  return { error: 'حركة غير معروفة' };
}
function isFinished(state) { return !!state.finished; }
function getWinner(state) { return state.winner || null; }
function serialize(state) { normalize(state); return JSON.stringify(state); }
module.exports = { createGame, getPublicState, getPrivateState, getLegalActions, applyAction, isFinished, getWinner, serialize, validMeld };
