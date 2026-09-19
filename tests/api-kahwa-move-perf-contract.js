const fs = require('fs');
const domino = require('../server/src/games/domino-engine.js');
const tawla = require('../server/src/games/tawla-engine.js');
const chess = require('../server/src/games/chess-engine.js');
const cards = require('../server/src/games/cards-engine.js');
const pipe = require('../server/src/games/action-pipeline.js');

function read(p) { return fs.readFileSync(p, 'utf8'); }
function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function domState(o) {
  return Object.assign({
    engine: 'domino', version: 1, status: 'active', turn: 'pA',
    players: ['pA', 'pB'], hands: { pA: [], pB: [] }, stock: [], chain: [],
    openingDouble: null, finished: false, winner: null, moveCount: 0, scores: {}, roundNumber: 1
  }, o);
}

async function main() {
  console.log('1) domino: legal placement applies and flips turn');
  let g = domState({ chain: [{ a: 1, b: 6, id: '1-6' }], hands: { pA: [{ a: 6, b: 6, id: '6-6' }, { a: 0, b: 1, id: '0-1' }], pB: [{ a: 1, b: 1, id: '1-1' }] } });
  let r = domino.applyAction(g, 'pA', { type: 'place', tile: { id: '6-6' }, direction: 'right' });
  assert(r.ok && g.chain.length === 2 && g.turn === 'pB' && g.hands.pA.length === 1, 'legal place works');

  console.log('2) domino: illegal placements rejected before any state change');
  g = domState({ chain: [{ a: 1, b: 6, id: '1-6' }], hands: { pA: [{ a: 0, b: 0, id: '0-0' }], pB: [] } });
  const snap = JSON.stringify(g);
  assert(domino.applyAction(g, 'pA', { type: 'place', tile: { id: '9-9' }, direction: 'left' }).error, 'tile not in hand');
  assert(domino.applyAction(g, 'pA', { type: 'place', tile: { id: '0-0' }, direction: 'left' }).error, 'end mismatch');
  assert(domino.applyAction(g, 'pA', { type: 'place', direction: 'left' }).error, 'missing tile object');
  assert(domino.applyAction(g, 'pB', { type: 'place', tile: { id: '0-0' }, direction: 'left' }).error, 'wrong turn');
  assert(JSON.stringify(g) === snap, 'rejected moves change nothing');

  console.log('3) domino: opening double enforced');
  g = domState({ chain: [], openingDouble: 6, hands: { pA: [{ a: 6, b: 6, id: '6-6' }, { a: 0, b: 1, id: '0-1' }], pB: [] } });
  assert(domino.applyAction(g, 'pA', { type: 'place', tile: { id: '0-1' }, direction: 'right' }).error, 'non-opening rejected');
  assert(domino.applyAction(g, 'pA', { type: 'place', tile: { id: '6-6' }, direction: 'right' }).ok, 'opening double accepted');

  console.log('4) domino: draw only when nothing is playable (illegal draw rejected)');
  g = domState({ chain: [{ a: 1, b: 6, id: '1-6' }], hands: { pA: [{ a: 6, b: 5, id: '6-5' }], pB: [] }, stock: [{ a: 2, b: 2, id: '2-2' }] });
  const before = JSON.stringify(g);
  assert(domino.applyAction(g, 'pA', { type: 'draw' }).error, 'draw with playable tile rejected');
  assert(JSON.stringify(g) === before, 'illegal draw changes nothing');
  g = domState({ chain: [{ a: 1, b: 6, id: '1-6' }], hands: { pA: [{ a: 0, b: 0, id: '0-0' }], pB: [] }, stock: [{ a: 2, b: 2, id: '2-2' }] });
  assert(domino.applyAction(g, 'pA', { type: 'draw' }).ok, 'legit draw works');
  assert(g.hands.pA.length === 2 && g.stock.length === 0 && g.turn === 'pA', 'draw keeps turn');

  console.log('5) domino: pass only with empty stock and no placement (illegal pass rejected)');
  g = domState({ chain: [{ a: 1, b: 6, id: '1-6' }], hands: { pA: [{ a: 6, b: 5, id: '6-5' }], pB: [] }, stock: [] });
  assert(domino.applyAction(g, 'pA', { type: 'pass' }).error, 'pass with playable tile rejected');
  assert(g.turn === 'pA', 'illegal pass keeps turn');
  g = domState({ chain: [{ a: 1, b: 6, id: '1-6' }], hands: { pA: [{ a: 0, b: 0, id: '0-0' }], pB: [] }, stock: [{ a: 2, b: 2, id: '2-2' }] });
  assert(domino.applyAction(g, 'pA', { type: 'pass' }).error, 'pass with stock rejected');
  g = domState({ chain: [{ a: 1, b: 6, id: '1-6' }], hands: { pA: [{ a: 0, b: 0, id: '0-0' }], pB: [{ a: 1, b: 1, id: '1-1' }] }, stock: [] });
  assert(domino.applyAction(g, 'pA', { type: 'pass' }).ok, 'legit pass works');
  assert(g.turn === 'pB', 'pass flips turn');

  console.log('6) tawla: roll/move legality and turn enforcement');
  const t = tawla.createGame({ playerIds: ['w', 'b'] });
  t.status = 'active'; t.opening = { resolved: true, rolls: {}, winner: 'w' }; t.turn = 'w';
  assert(tawla.applyAction(t, 'w', { type: 'move', from: 23, to: 22, die: 1 }).error, 'move before roll rejected');
  assert(tawla.applyAction(t, 'b', { type: 'roll' }).error, 'roll off-turn rejected');
  assert(tawla.applyAction(t, 'w', { type: 'roll' }).ok, 'roll works');
  assert(tawla.applyAction(t, 'w', { type: 'roll' }).error, 'second roll rejected');
  assert(tawla.applyAction(t, 'w', { type: 'move', from: 23, to: 16, die: 7 }).error, 'impossible die rejected');

  console.log('7) chess/cards: illegal actions and off-turn rejected');
  const c = chess.createGame({ playerIds: ['w', 'b'] });
  c.status = 'active';
  assert(chess.applyAction(c, 'b', { type: 'move', from: 'e7', to: 'e5' }).error, 'black cannot open');
  assert(chess.applyAction(c, 'w', { type: 'move', from: 'e2', to: 'e5' }).error, 'illegal pawn jump rejected');
  assert(chess.applyAction(c, 'w', { type: 'move', from: 'e2', to: 'e4' }).ok, 'legal pawn move works');
  const k = cards.createGame({ playerIds: ['a', 'b'] });
  k.status = 'active';
  assert(cards.applyAction(k, 'b', { type: 'draw', source: 'stock' }).error, 'off-turn draw rejected');
  assert(cards.applyAction(k, 'a', { type: 'draw', source: 'stock' }).ok, 'draw works');
  assert(cards.applyAction(k, 'a', { type: 'draw', source: 'stock' }).error, 'second draw rejected');
  assert(cards.applyAction(k, 'a', { type: 'meld', cardIds: [] }).error, 'empty meld rejected');

  console.log('8) two-player sync: mover loses actions, opponent gains them, stale replay rejected');
  g = domState({
    chain: [{ a: 1, b: 6, id: '1-6' }],
    hands: { pA: [{ a: 6, b: 6, id: '6-6' }, { a: 0, b: 2, id: '0-2' }], pB: [{ a: 1, b: 1, id: '1-1' }] },
    stock: []
  });
  const applied = pipe.applyRoomAction(domino, g, 'pA', { type: 'place', tile: { id: '6-6' }, direction: 'right', moveId: 'sync-1' });
  assert(applied.ok && g.turn === 'pB', 'move applied, turn flipped');
  assert(domino.getLegalActions(g, 'pA').length === 0, 'mover has no actions after move');
  assert(domino.getLegalActions(g, 'pB').length > 0, 'opponent to move');
  const chainBefore = JSON.stringify(g.chain);
  const stale = domino.applyAction(g, 'pA', { type: 'place', tile: { id: '6-6' }, direction: 'right' });
  assert(stale.error && g.turn === 'pB' && JSON.stringify(g.chain) === chainBefore, 'stale replay changes nothing');

  console.log('9) pipeline: same moveId applied at most once (duplicate changes nothing)');
  g = domState({ chain: [{ a: 1, b: 6, id: '1-6' }], hands: { pA: [{ a: 6, b: 6, id: '6-6' }, { a: 0, b: 3, id: '0-3' }], pB: [{ a: 1, b: 2, id: '1-2' }] }, stock: [] });
  const first = pipe.applyRoomAction(domino, g, 'pA', { type: 'place', tile: { id: '6-6' }, direction: 'right', moveId: 'dup-1' });
  assert(first.ok && !first.duplicate, 'first apply succeeds');
  const mc = g.moveCount, cl = g.chain.length;
  const second = pipe.applyRoomAction(domino, g, 'pA', { type: 'place', tile: { id: '6-6' }, direction: 'right', moveId: 'dup-1' });
  assert(second.ok && second.duplicate === true, 'duplicate acknowledged without error');
  assert(g.moveCount === mc && g.chain.length === cl && g.turn === 'pB', 'duplicate changes nothing');
  assert(g.appliedMoveIds.includes('dup-1'), 'moveId recorded on state');
  const noId = pipe.applyRoomAction(domino, domState({ chain: [], openingDouble: null, hands: { pA: [{ a: 0, b: 1, id: '0-1' }], pB: [] }, stock: [] }), 'pA', { type: 'place', tile: { id: '0-1' }, direction: 'right' });
  assert(noId.ok, 'actions without moveId still apply (backward compatible)');

  console.log('10) pipeline: per-room lock serializes overlapping moves, rooms stay independent');
  const order = [];
  await Promise.all([
    pipe.withRoomLock('room-A', async () => { await sleep(30); order.push('first'); }),
    pipe.withRoomLock('room-A', async () => { order.push('second'); })
  ]);
  assert(order.join(',') === 'first,second', 'same-room moves run in order');
  const order2 = [];
  await Promise.all([
    pipe.withRoomLock('room-X', async () => { await sleep(50); order2.push('X'); }),
    pipe.withRoomLock('room-Y', async () => { order2.push('Y'); })
  ]);
  assert(order2[0] === 'Y', 'different rooms do not block each other');

  console.log('11) no artificial delay may gate an /action POST on the move path');
  for (const f of ['kahwa-domino-ui.js', 'kahwa-tawla-v2.js', 'kahwa-chess-canva.js', 'kahwa-cards-canva.js', 'game-room.js']) {
    const parts = read(f).split('setTimeout');
    for (let i = 1; i < parts.length; i++) {
      assert(!parts[i].slice(0, 400).includes('/action'), f + ': setTimeout must never delay an /action POST');
    }
  }
  assert(!read('kahwa-tawla-v2.js').includes('setTimeout'), 'tawla: no timers left in the move path');

  console.log('12) every adapter single-flights, stamps moveId, and renders from the POST response');
  for (const f of ['kahwa-domino-ui.js', 'kahwa-tawla-v2.js', 'kahwa-chess-canva.js', 'kahwa-cards-canva.js']) {
    const src = read(f);
    assert(/busy\s*=\s*true/.test(src), f + ': single-flight busy guard present');
    assert(src.includes('moveId'), f + ': moveId stamped on actions');
    assert(src.includes('kahwaApplyActionResponse'), f + ': renders from POST response without refetch');
  }

  console.log('13) both server move paths use the shared authoritative pipeline');
  assert(read('server/src/routes/game-rooms.routes.js').includes('applyRoomAction'), 'REST /action uses pipeline');
  assert(read('server/src/socket.js').includes('applyRoomAction'), 'socket game:move uses pipeline');
  assert(read('game-room.js').includes('__kahwaLastSnap'), 'client skips redundant remounts');
}

main().then(
  () => console.log('ALL KAHWA MOVE-PERF CONTRACT TESTS PASS'),
  (e) => { console.error(e && e.message ? e.message : e); process.exit(1); }
);
