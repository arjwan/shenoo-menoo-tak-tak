const cards = require('../server/src/games/cards-engine.js');
function assert(value, message) { if (!value) throw new Error('FAIL: ' + message); }

const state = cards.createGame({ playerIds: ['a', 'b', 'c', 'd'] });
state.status = 'active';
assert(state.players.length === 4, 'four players');
assert(state.players.every(id => state.hands[id].length === 7), 'seven cards each');
assert(cards.getPrivateState(state, 'a').hand.length === 7, 'private hand visible');
assert(!cards.getPublicState(state).hands, 'hands not leaked publicly');
assert(cards.getLegalActions(state, 'a').some(a => a.type === 'draw'), 'draw first');

const stockBefore = state.stock.length;
assert(cards.applyAction(state, 'a', { type: 'draw', source: 'stock' }).ok, 'draw succeeds');
assert(state.stock.length === stockBefore - 1 && state.hands.a.length === 8, 'draw changes counts');
assert(cards.applyAction(state, 'a', { type: 'discard', cardId: state.hands.a[0].id }).ok, 'discard succeeds');
assert(state.turn === 'b' && state.phase === 'draw', 'turn advances after discard');

assert(cards.validMeld([{ value: 7, suit: 's' }, { value: 7, suit: 'h' }, { value: 7, suit: 'd' }]), 'same rank meld');
assert(cards.validMeld([{ value: 4, suit: 'c' }, { value: 5, suit: 'c' }, { value: 6, suit: 'c' }]), 'same suit run');
assert(!cards.validMeld([{ value: 4, suit: 'c' }, { value: 6, suit: 'c' }, { value: 7, suit: 'c' }]), 'gapped run rejected');
console.log('ALL CARDS CONTRACT TESTS PASS');
