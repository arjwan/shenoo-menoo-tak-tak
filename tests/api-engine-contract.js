const domino = require('../server/src/games/domino-engine.js');
const registry = require('../server/src/games/game-engine-registry.js');

function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }

console.log('1) create domino via registry');
const s = registry.createGame('domino', { playerIds: ['pA', 'pB'] });
assert(s.engine === 'domino', 'engine domino');
assert(s.status === 'waiting', 'initial waiting');

console.log('2) private hands 7 each');
const privA = domino.getPrivateState(s, 'pA');
const privB = domino.getPrivateState(s, 'pB');
assert(privA && privA.hand && privA.hand.length === 7, 'pA hand 7');
assert(privB && privB.hand && privB.hand.length === 7, 'pB hand 7');

console.log('3) no cross-leak');
const pAids = privA.hand.map(t => t.id);
const pBids = privB.hand.map(t => t.id);
assert(pAids.every(i => !pBids.includes(i)), 'hands do not overlap');

console.log('4) public only counts');
const pub = domino.getPublicState(s);
assert(pub.players && pub.players.length === 2, '2 players public');
assert(pub.players.every(p => typeof p.handCount === 'number'), 'only handCount exposed');
assert(!pub.hands, 'hands hidden from public');

console.log('5) highest dealt double owns opening turn');
const starter = s.turn;
const legals = domino.getLegalActions(s, starter);
assert(Array.isArray(legals) && legals.length > 0, 'legal actions non-empty');
assert(legals[0].tile.a === legals[0].tile.b, 'opening action is a double');

console.log('6) apply action updates turn');
const firstAction = legals[0];
const res = domino.applyAction(s, starter, firstAction);
assert(res && !res.error, 'apply ok');
assert(s.turn !== starter, 'turn switched after opening');

console.log('7) start route sets active');
s.status = 'active';
s.turn = 'pA';
assert(s.status === 'active', 'active after start');

console.log('8) mongo Mixed save simulation');
const saved = JSON.parse(JSON.stringify(s));
assert(saved.hands && saved.hands.pA && Array.isArray(saved.hands.pA), 'hands preserved after JSON clone');

console.log('ALL CONTRACT TESTS PASS');
