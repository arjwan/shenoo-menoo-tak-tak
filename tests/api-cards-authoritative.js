// عقد الورق الحقيقي: الخادم مرجعي، واليد خاصة، ولا يتسرب أي شيء للمشاهدين.
const cards = require('../server/src/games/cards-engine.js');
const adapter = require('../server/src/games/cards-adapter.js');
const rules = require('../server/src/games/cards-rules-registry.js');
const gameView = require('../server/src/games/game-view.js');

function assert(value, message) { if (!value) throw new Error('FAIL: ' + message); }
function noLeak(value, label) { adapter.assertNoHiddenCards(value); assert(true, label); }

// 1) المحرك الأصلي (Rummy) ما زال يعمل كما هو.
const legacy = cards.createGame({ playerIds: ['a', 'b', 'c', 'd'] });
legacy.status = 'active';
assert(legacy.players.length === 4, 'four players');
assert(legacy.players.every((id) => legacy.hands[id].length === 7), 'seven cards each');
assert(cards.getPublicState(legacy).players.every((p) => typeof p.handCount === 'number'), 'public counts only');
assert(!cards.getPublicState(legacy).hands, 'legacy public has no hands');

// 2) طبقة الربط تُستهلك من نفس مدخل registry.
const registry = require('../server/src/games/game-engine-registry.js');
const state = registry.createGame('cards', { playerIds: ['a', 'b', 'c', 'd'] });
state.status = 'active';
assert(state.engine === 'cards', 'engine id stays cards');
assert(state.rulesetId === 'rummy', 'default ruleset is the preserved rummy engine');

// 3) لا تسريب في الحالة العامة أو الملخّص.
const pub = adapter.getPublicState(state);
noLeak(pub, 'public state has no hidden cards');
assert(!JSON.stringify(pub).includes('"hands"'), 'public has no hands key');
assert(!JSON.stringify(pub).includes('"stock"'), 'public has no stock pile');
assert(adapter.assertNoHiddenCards(adapter.serialize(state)) === true, 'serialize is safe');

// 4) اليد الخاصة لكل لاعب وحده.
const handA = adapter.getPrivateState(state, 'a').hand.map((c) => c.id);
const handB = adapter.getPrivateState(state, 'b').hand.map((c) => c.id);
assert(handA.length === 7 && handB.length === 7, 'both hands 7 cards');
assert(!handA.some((id) => handB.includes(id)), 'no overlapping cards between hands');
assert(adapter.getLegalActions(state, 'b').length === 0, 'legal actions only for the player on turn');

// 5) دور كامل عبر الخادم: سحب ثم تخلّص ثم انتقال الدور.
const firstPlayer = String(state.turn);
const draw = adapter.applyAction(state, firstPlayer, { type: 'draw', source: 'stock' });
assert(draw.ok, 'draw accepted');
assert(state.hands[firstPlayer].length === 8, 'drawn card added to private hand');
const discardCard = state.hands[firstPlayer][0].id;
const discard = adapter.applyAction(state, firstPlayer, { type: 'discard', cardId: discardCard });
assert(discard.ok, 'discard accepted');
assert(String(state.turn) !== firstPlayer, 'turn moved to the next player from the server');
assert(adapter.applyAction(state, firstPlayer, { type: 'draw', source: 'stock' }).error, 'out of turn draw rejected');
assert(adapter.applyAction(state, 'stranger', { type: 'draw', source: 'stock' }).error, 'non player rejected');

// 6) المجموعات غير القانونية مرفوضة من الخادم.
const actor = String(state.turn);
adapter.applyAction(state, actor, { type: 'draw', source: 'stock' });
const before = state.hands[actor].length;
const badMeld = adapter.applyAction(state, actor, { type: 'meld', cardIds: state.hands[actor].slice(0, 2).map((c) => c.id) });
assert(badMeld.error, 'two-card meld rejected by the server');
assert(state.hands[actor].length === before, 'hand untouched after a rejected meld');

// 7) reconnect: الحالة تُحفظ وتُقرأ من جديد كما يفعل Mongo Mixed.
const revived = JSON.parse(JSON.stringify(state));
assert(adapter.getPrivateState(revived, 'c').hand.length > 0, 'private hand restored after reload');
assert(adapter.getPublicState(revived).players.length === 4, 'public state restored after reload');
adapter.assertNoHiddenCards(adapter.getPublicState(revived));

// 8) المشاهد والزائر لا يستلمان يدًا أو حركات.
const room = { gameType: 'cards', owner: 'a', players: ['a', 'b', 'c', 'd'], spectators: ['spec'], gameState: { engineState: state } };
const spectator = gameView.engineViewFor(room, 'spec');
assert(spectator.private === null, 'spectator receives no private hand');
assert(spectator.legalActions.length === 0, 'spectator receives no legal actions');
assert(spectator.spectator === true, 'spectator flagged');
adapter.assertNoHiddenCards(spectator.public);
const visitor = gameView.engineViewFor(room, 'not-a-member');
assert(visitor.private === null && visitor.spectator === true, 'visitor receives public state only');
const playerView = gameView.engineViewFor(room, 'a');
assert(playerView.private.hand.length > 0, 'player still receives their own hand');
adapter.assertNoBroadcastLeak(gameView.stateEventPayload({ id: 'r1', players: ['a', 'b', 'c', 'd'] }, gameView.publicEngineView(room)));

// 9) سجل القواعد: Rummy متاح، وأصل Canva مسجّل كمنتظر وغير قابل للعب.
const manifest = rules.listRulesets();
assert(manifest.defaultRulesetId === 'rummy', 'rummy remains the default ruleset');
assert(manifest.available.some((r) => r.id === 'rummy'), 'rummy is available');
const canva = manifest.pending.find((r) => r.id === 'canva-cards');
assert(canva && canva.status === 'awaiting-original', 'canva original listed as awaiting upload');
assert(rules.isAvailable('canva-cards') === false, 'canva ruleset cannot be started before the original is uploaded');
assert(adapter.resolveRulesetId('canva-cards') === 'rummy', 'unknown ruleset falls back to the preserved rummy engine');

console.log('ALL CARDS AUTHORITATIVE TESTS PASS');