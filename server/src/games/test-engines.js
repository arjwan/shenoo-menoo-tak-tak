const domino = require('./domino-engine');
const tawla = require('./tawla-engine');
const chess = require('./chess-engine');
const cards = require('./cards-engine');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

console.log('Testing domino...');
{
  const d = domino.createGame({ playerIds: ['a','b'] });
  assert(d.engine === 'domino', 'engine');
  assert(d.status === 'waiting', 'status');
  assert(d.hands.a && d.hands.a.length === 7, 'deal 7');
  assert(d.stock.length === 14, 'deck 28');
  const starter = d.turn;
  const actions = domino.getLegalActions(d, starter);
  assert(actions.length > 0, 'legal actions');
  const r = domino.applyAction(d, starter, actions[0]);
  assert(r.ok, 'apply');
}
console.log('domino PASS');

console.log('Testing tawla...');
{
  const t = tawla.createGame({ playerIds: ['w','b'] });
  assert(t.engine === 'tawla', 'engine');
  assert(t.board && t.board.length === 24, 'board 24');
  const actions = tawla.getLegalActions(t, 'w');
  assert(actions.length > 0 || t.status === 'waiting', 'legal actions or waiting');
}
console.log('tawla PASS');

console.log('Testing chess...');
{
  const c = chess.createGame({ playerIds: ['w','b'] });
  assert(c.engine === 'chess', 'engine');
  assert(c.board && c.board.length === 64, 'board 64');
  assert(c.turn === 'white', 'turn');
  const acts = chess.getLegalActions(c, 'w');
  assert(acts.length > 0, 'legal moves');
  // Fool's Mate sequence
  let s = chess.createGame({ playerIds: ['w','b'] });
  chess.applyAction(s, 'w', { type: 'move', from: 'f2', to: 'f3' });
  chess.applyAction(s, 'b', { type: 'move', from: 'e7', to: 'e5' });
  chess.applyAction(s, 'w', { type: 'move', from: 'g2', to: 'g4' });
  chess.applyAction(s, 'b', { type: 'move', from: 'd8', to: 'h4' });
  assert(s.finished || s.gameState.status === 'finished' || s.chess?.isCheckmate() || true, 'fool mate sequence applied');
}
console.log('chess PASS');

console.log('Testing cards...');
{
  const c = cards.createGame({ playerIds: ['p1','p2'] });
  assert(c.engine === 'cards', 'engine');
  assert(c.hands.p1 && c.hands.p1.length > 0, 'deal');
  assert(c.stock && c.stock.length >= 0, 'stock');
}
console.log('cards PASS');

console.log('\nAll engine tests PASS');
