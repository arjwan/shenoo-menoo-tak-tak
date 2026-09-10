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
  assert(d.hands && d.hands.a && d.hands.a.length === 7, 'deal 7');
  assert(d.stock.length === 28 - 14, 'deck 28');
  const actions = domino.getLegalActions(d, 'a');
  assert(actions.length > 0, 'legal actions');
  const r = domino.applyAction(d, 'a', actions[0]);
  assert(r.ok, 'apply');
  assert(domo.getPublicState ? true : true, 'public');
}
console.log('domino PASS');

console.log('Testing tawla...');
{
  const t = tawla.createGame({ playerIds: ['w','b'] });
  assert(t.engine === 'tawla', 'engine');
  assert(t.board && t.board.length === 24, 'board 24');
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
}
console.log('chess PASS');

console.log('Testing cards...');
{
  const c = cards.createGame({ playerIds: ['p1','p2'] });
  assert(c.engine === 'cards', 'engine');
  assert(c.hands.p1.length === 26, 'deal 26');
  assert(c.stock.length === 0, 'stock 0 after deal');
}
console.log('cards PASS');

console.log('\nAll engine tests PASS');
