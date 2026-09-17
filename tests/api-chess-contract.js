const chess = require('../server/src/games/chess-engine.js');
function assert(value, message) { if (!value) throw new Error('FAIL: ' + message); }

const state = chess.createGame({ playerIds: ['white-user', 'black-user'] });
state.status = 'active';
assert(state.board.length === 64, '64-square board');
assert(chess.getLegalActions(state, 'white-user').some(a => a.from === 'g1' && a.to === 'f3'), 'knight legal move');

assert(chess.applyAction(state, 'white-user', { type: 'move', from: 'e2', to: 'e4' }).ok, 'white pawn');
assert(chess.applyAction(state, 'black-user', { type: 'move', from: 'd7', to: 'd5' }).ok, 'black pawn');
assert(chess.applyAction(state, 'white-user', { type: 'move', from: 'e4', to: 'd5' }).ok, 'capture');
assert(state.history[2].captured === 'p', 'captured piece recorded');
assert(state.history[2].san === 'exd5', 'SAN recorded');

const persisted = JSON.parse(chess.serialize(state));
assert(!persisted.ch, 'no class instance persisted');
assert(chess.getLegalActions(persisted, 'black-user').length > 0, 'legal actions survive persistence');

const resigned = chess.applyAction(persisted, 'black-user', { type: 'resign' });
assert(resigned.ok && persisted.winner === 'white' && persisted.finishReason === 'resignation', 'resignation');
console.log('ALL CHESS CONTRACT TESTS PASS');
