// طبقة الربط لنوع اللعبة "cards".
// مهمتها: توجيه الطلبات إلى قاعدة اللعب (ruleset) المختارة، وتنظيف الحالة
// العامة بشكل قاطع حتى لا تتسرب أوراق أي لاعب إلى الخصوم أو المشاهدين.
// محرك Rummy الحالي يُستهلك كما هو (cards-engine.js) ولا يُستبدل.
const rulesRegistry = require('./cards-rules-registry');

// حقول أوراق لا يجوز أن تظهر في الحالة العامة أو في أي بث جماعي.
// ملاحظة: مفاتيح الغلاف مثل engineState/private مسموحة في رسائل اللعبة، لكن
// قيمة private يجب أن تبقى null أو غائبة في أي بث جماعي (يتحقق منه assertNoBroadcastLeak).
const HIDDEN_KEYS = ['hands', 'hand', 'stock', 'deck', 'drawPile', 'secrets'];

function normalizeId(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'object') {
    if (value._id !== undefined) return String(value._id);
    if (value.id !== undefined) return String(value.id);
  }
  return String(value);
}

// تحويل المفاتيح والمعرّفات إلى نصوص: حالة Mixed تعود من Mongo بقيم قد تكون
// كائنات ObjectId، وهذا يكسر مقارنات الدور (turn) لو لم تُوحَّد.
function normalizeState(state) {
  if (!state || typeof state !== 'object') return state;
  if (Array.isArray(state.players)) state.players = state.players.map(normalizeId);
  if (state.turn !== null && state.turn !== undefined) state.turn = normalizeId(state.turn);
  if (state.hands && typeof state.hands === 'object' && !Array.isArray(state.hands)) {
    const hands = {};
    for (const [key, value] of Object.entries(state.hands)) hands[normalizeId(key)] = value;
    state.hands = hands;
  }
  if (state.scores && typeof state.scores === 'object' && !Array.isArray(state.scores)) {
    const scores = {};
    for (const [key, value] of Object.entries(state.scores)) scores[normalizeId(key)] = value;
    state.scores = scores;
  }
  if (Array.isArray(state.melds)) {
    state.melds = state.melds.map((meld) => (meld && typeof meld === 'object' ? { ...meld, playerId: normalizeId(meld.playerId) } : meld));
  }
  return state;
}

function sanitizePublic(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const players = Array.isArray(raw.players)
    ? raw.players.map((player) => {
        if (player && typeof player === 'object') {
          return { id: normalizeId(player.id), name: player.name, handCount: Number(player.handCount || 0), score: Number(player.score || 0), team: player.team };
        }
        return { id: normalizeId(player), handCount: 0, score: 0 };
      })
    : [];
  const publicState = {
    engine: 'cards',
    rulesetId: raw.rulesetId || rulesRegistry.defaultRulesetId,
    rulesetName: raw.rulesetName || '',
    version: raw.version,
    status: raw.status,
    players,
    turn: normalizeId(raw.turn),
    phase: raw.phase,
    stockCount: Number(raw.stockCount || 0),
    discardTop: raw.discardTop || null,
    discardCount: Number(raw.discardCount || 0),
    melds: Array.isArray(raw.melds) ? raw.melds : [],
    scores: raw.scores || {},
    finished: Boolean(raw.finished),
    winner: normalizeId(raw.winner),
    finishReason: raw.finishReason || '',
    moveCount: Number(raw.moveCount || 0),
    roundNumber: raw.roundNumber,
    lastRound: raw.lastRound || null,
    uiHints: raw.uiHints || null
  };
  for (const key of HIDDEN_KEYS) delete publicState[key];
  return publicState;
}

// حارس تسريب: يُستخدم في الاختبارات وفي أي مسار يبني حالة عامة يدوياً.
function assertNoHiddenCards(view) {
  const serialized = JSON.stringify(view === undefined ? null : view) || '';
  for (const key of HIDDEN_KEYS) {
    if (new RegExp('"' + key + '"\\s*:').test(serialized)) {
      throw new Error('LEAK: hidden card field "' + key + '" was exposed in a public payload');
    }
  }
  return true;
}

// حارس البث الجماعي: أي رسالة تذهب لكل من في الغرفة يجب ألا تحمل يد أي لاعب.
function assertNoBroadcastLeak(payload) {
  assertNoHiddenCards(payload);
  const serialized = JSON.stringify(payload === undefined ? null : payload) || '';
  if (/"private"\s*:\s*\{(?!\s*\})/.test(serialized) || /"private"\s*:\s*\[(?!\s*\])/.test(serialized)) {
    throw new Error('LEAK: a private hand was placed in a broadcast payload');
  }
  return true;
}

function resolveRulesetId(requested) {
  const wanted = String(requested || '').trim();
  if (wanted && rulesRegistry.isAvailable(wanted)) return wanted;
  return rulesRegistry.defaultRulesetId;
}

function rulesetFor(state, params) {
  const requested = params && params.rulesetId ? params.rulesetId : state && state.rulesetId;
  return rulesRegistry.getRuleset(resolveRulesetId(requested));
}

function createGame(params = {}) {
  const rulesetId = resolveRulesetId(params.rulesetId);
  const ruleset = rulesRegistry.getRuleset(rulesetId);
  if (!ruleset) throw new Error('قواعد ألعاب الورق المطلوبة غير متوفرة: ' + rulesetId);
  const state = normalizeState(ruleset.engine.createGame({ ...params, rulesetId }));
  state.engine = 'cards';
  state.rulesetId = ruleset.id;
  state.rulesetName = ruleset.label;
  return state;
}

function getPublicState(state) {
  const ruleset = rulesetFor(state);
  if (!ruleset) return sanitizePublic({ rulesetId: state && state.rulesetId, status: state && state.status });
  const raw = ruleset.engine.getPublicState ? ruleset.engine.getPublicState(normalizeState(state)) : null;
  return sanitizePublic({ ...(raw || {}), rulesetId: state.rulesetId, rulesetName: state.rulesetName || ruleset.label });
}

function getPrivateState(state, userId) {
  const ruleset = rulesetFor(state);
  const viewerId = normalizeId(userId);
  if (!ruleset || !viewerId) return { hand: [], turn: false, phase: state && state.phase };
  normalizeState(state);
  if (!(state.players || []).includes(viewerId)) return { hand: [], turn: false, phase: state.phase, spectator: true };
  const raw = ruleset.engine.getPrivateState ? ruleset.engine.getPrivateState(state, viewerId) : {};
  return {
    hand: Array.isArray(raw && raw.hand) ? raw.hand : [],
    turn: Boolean(raw && raw.turn),
    phase: raw && raw.phase !== undefined ? raw.phase : state.phase,
    rulesetId: state.rulesetId
  };
}

function getLegalActions(state, userId) {
  const ruleset = rulesetFor(state);
  const viewerId = normalizeId(userId);
  if (!ruleset || !viewerId) return [];
  normalizeState(state);
  if (!(state.players || []).includes(viewerId)) return [];
  const actions = ruleset.engine.getLegalActions ? ruleset.engine.getLegalActions(state, viewerId) : [];
  return Array.isArray(actions) ? actions : [];
}

function applyAction(state, userId, action = {}) {
  const ruleset = rulesetFor(state);
  const actorId = normalizeId(userId);
  if (!ruleset) return { error: 'قواعد ألعاب الورق غير متوفرة' };
  normalizeState(state);
  if (!actorId || !(state.players || []).includes(actorId)) return { error: 'أنت لست لاعبًا' };
  const result = ruleset.engine.applyAction(state, actorId, action) || {};
  if (result.state) normalizeState(result.state);
  return result;
}

function isFinished(state) {
  const ruleset = rulesetFor(state);
  if (!ruleset || !ruleset.engine.isFinished) return Boolean(state && state.finished);
  return Boolean(ruleset.engine.isFinished(state));
}

function getWinner(state) {
  const ruleset = rulesetFor(state);
  if (!ruleset || !ruleset.engine.getWinner) return (state && state.winner) || null;
  return ruleset.engine.getWinner(state) || null;
}

// ملخص آمن فقط: لا يُسمح بإرجاع الحالة الكاملة لأنها تحتوي أوراق اللاعبين.
function serialize(state) {
  return JSON.stringify({ engine: 'cards', rulesetId: state && state.rulesetId, public: getPublicState(state) });
}

function validMeld(cards) {
  const ruleset = rulesRegistry.getRuleset(rulesRegistry.defaultRulesetId);
  return Boolean(ruleset && ruleset.engine.validMeld && ruleset.engine.validMeld(cards));
}

module.exports = {
  createGame,
  getPublicState,
  getPrivateState,
  getLegalActions,
  applyAction,
  isFinished,
  getWinner,
  serialize,
  validMeld,
  sanitizePublic,
  assertNoHiddenCards,
  assertNoBroadcastLeak,
  normalizeState,
  resolveRulesetId,
  listRulesets: rulesRegistry.listRulesets,
  HIDDEN_KEYS
};