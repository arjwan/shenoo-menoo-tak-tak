// Kahwa exhaustive logic audit: domino / tawla / chess / cards.
// Engine-level truth: every legal move accepted, every illegal move rejected,
// invariants verified after every action. Includes the explicit 1|3 domino
// regression (both faces x both ends x both directions x both chain sides).
const fs = require('fs');
const crypto = require('crypto');
const domino = require('../server/src/games/domino-engine.js');
const tawla = require('../server/src/games/tawla-engine.js');
const chess = require('../server/src/games/chess-engine.js');
const cards = require('../server/src/games/cards-engine.js');
const pipe = require('../server/src/games/action-pipeline.js');
const vm = require('vm');
const domUI = require('../kahwa-domino-ui.js');

const cases = { domino: 0, tawla: 0, chess: 0, cards: 0, shared: 0 };
function T(game) { cases[game]++; }
function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
function eq(a, b, msg) { assert(JSON.stringify(a) === JSON.stringify(b), msg + ' (got ' + JSON.stringify(a) + ')'); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function hasCount(str, sub, n, msg) {
  const c = str.split(sub).length - 1;
  assert(c === n, msg + ' (found ' + c + 'x, want ' + n + 'x: ' + sub.slice(0, 50) + ')');
}

// ================= D. DOMINO =================
function domState(o) {
  return Object.assign({ engine: 'domino', version: 1, status: 'active', turn: 'a',
    players: ['a', 'b'], maxPlayers: 2, hands: { a: [], b: [] }, stock: [], chain: [],
    openingDouble: null, finished: false, winner: null, moveCount: 0, scores: {},
    roundNumber: 1, lastRound: null }, o || {});
}
// Chain with exact open ends L (left) / R (right); invariant-valid by construction.
function chainFor(L, R) {
  if (L === R) return [{ a: L, b: R, id: L + '-' + R + 'c' }];
  return [{ a: L, b: L, id: L + '-' + L + 'c' }, { a: L, b: R, id: Math.min(L, R) + '-' + Math.max(L, R) + 'c' }];
}
function allTiles() {
  const out = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) out.push({ a, b, id: a + '-' + b });
  return out;
}

console.log('D1) domino exhaustive: 28 tiles x 49 end pairs x both directions');
{
  const tiles = allTiles();
  eq(tiles.length, 28, 'double-six has 28 tiles');
  let cells = 0;
  for (let L = 0; L <= 6; L++) for (let R = 0; R <= 6; R++) {
    for (const t of tiles) {
      const s = domState({ chain: chainFor(L, R),
        hands: { a: [clone(t)], b: [{ a: 0, b: 1, id: 'f1' }, { a: 2, b: 3, id: 'f2' }] } });
      assert(domino.validateChain(s.chain).valid, 'crafted chain valid');
      const ends = domino.openEnds(s.chain);
      eq([ends.left, ends.right], [L, R], 'ends derived from the chain itself');
      const wantL = (t.a === L || t.b === L), wantR = (t.a === R || t.b === R);
      const offers = domino.getLegalActions(s, 'a').filter(x => x.type === 'place');
      eq(offers.filter(x => x.direction === 'left').length, wantL ? 1 : 0, 'tile ' + t.id + ' left vs L=' + L);
      eq(offers.filter(x => x.direction === 'right').length, wantR ? 1 : 0, 'tile ' + t.id + ' right vs R=' + R);
      for (const o of offers) {
        const c = domState(clone(s));
        const r = domino.applyAction(c, 'a', { type: 'place', tile: { id: t.id }, direction: o.direction });
        assert(r && !r.error, 'offered placement applies: ' + t.id + ' ' + o.direction);
        assert(domino.validateChain(c.chain).valid, 'chain invariant holds after placement');
        const ne = domino.openEnds(c.chain);
        const matchedEnd = o.direction === 'left' ? L : R;
        const expectedNew = (t.a === t.b) ? matchedEnd : (t.a === matchedEnd ? t.b : t.a);
        eq(o.direction === 'left' ? ne.left : ne.right, expectedNew, 'played side exposes the non-matching face (auto-flip)');
        eq(o.direction === 'left' ? ne.right : ne.left, o.direction === 'left' ? R : L, 'far end unchanged');
        const placedT = o.direction === 'left' ? c.chain[0] : c.chain[c.chain.length - 1];
        assert([placedT.a, placedT.b].sort().join() === [t.a, t.b].sort().join(), 'placed tile keeps its numbers (no value mutation)');
        assert(c.winner === 'a' && c.scores.a === 6, 'empty hand wins, points = opponent pips (1+5)');
      }
      if (!wantL && !wantR) {
        for (const dir of ['left', 'right']) {
          const c = domState(clone(s));
          const r = domino.applyAction(c, 'a', { type: 'place', tile: { id: t.id }, direction: dir });
          assert(r && r.error, 'non-matching tile rejected: ' + t.id + ' ' + dir);
        }
        eq(domino.getLegalActions(s, 'a').map(x => x.type), ['pass'], 'no match + empty stock offers pass only');
      }
      cells++; T('domino');
    }
  }
  { // unknown / missing / wrong-end directions rejected on a non-empty chain
    const s = domState({ chain: chainFor(1, 5), hands: { a: [{ a: 1, b: 3, id: '1-3' }], b: [] } });
    assert(domino.applyAction(domState(clone(s)), 'a', { type: 'place', tile: { id: '1-3' }, direction: 'middle' }).error, 'unknown direction rejected');
    assert(domino.applyAction(domState(clone(s)), 'a', { type: 'place', tile: { id: '1-3' } }).error, 'missing direction rejected');
    assert(domino.applyAction(domState(clone(s)), 'a', { type: 'place', tile: { id: '1-3' }, direction: 'right' }).error, 'tile rejected at the end it does not match');
    T('domino'); T('domino'); T('domino');
  }
  { // validateChain shape + corrupt-chain fail-safe + opening-tile anchor
    const v = domino.validateChain([{ a: 1, b: 3, id: 'x1' }, { a: 3, b: 5, id: 'x2' }]);
    assert(v.valid && v.left === 1 && v.right === 5, 'validateChain returns ends from the oriented chain');
    assert(!domino.validateChain([{ a: 1, b: 2 }, { a: 4, b: 5 }]).valid, 'validateChain flags mismatched joints');
    assert(!domino.validateChain([{ a: 1, b: 'x' }]).valid, 'validateChain flags malformed tiles');
    const corrupt = domState({ chain: [{ a: 1, b: 2 }, { a: 4, b: 5 }], hands: { a: [{ a: 2, b: 2, id: '2-2' }], b: [] } });
    assert(domino.placementsFor(corrupt, 'a').length === 0, 'placements fail-safe: no offers on a corrupt chain');
    assert(domino.openEnds(corrupt.chain) === null, 'openEnds fail-safe: null on a corrupt chain');
    assert(domino.applyAction(corrupt, 'a', { type: 'place', tile: { id: '2-2' }, direction: 'right' }).error, 'place fail-safe: rejected on a corrupt chain');
    const op = domino.createGame({ playerIds: ['a', 'b'], preferredStarter: 'a' }); op.status = 'active';
    domino.applyAction(op, 'a', clone(domino.getLegalActions(op, 'a')[0]));
    assert(op.openingTileId === op.chain[0].id, 'opening tile recorded for the snake anchor');
    assert(domino.getPublicState(op).openingTileId === op.chain[0].id, 'public state carries the snake anchor');
    for (let i = 0; i < 8; i++) T('domino');
  }
  console.log('   matrix cells:', cells);
}

console.log('D2) REGRESSION: tile 1|3 vs open ends 1 and 3 (orders x ends x directions x sides)');
{
  let n = 0;
  for (const [a, b] of [[1, 3], [3, 1]]) {
    for (const [L, R] of [[1, 5], [5, 1], [3, 5], [5, 3], [1, 3], [3, 1], [1, 1], [3, 3]]) {
      const t = { a, b, id: a + '-' + b + 'r' };
      const s = domState({ chain: chainFor(L, R), hands: { a: [t, { a: 6, b: 6, id: 'zz' }], b: [] } });
      const offers = domino.getLegalActions(s, 'a')
        .filter(x => x.type === 'place' && x.tile.id === t.id).map(x => x.direction).sort();
      const want = [].concat((a === L || b === L) ? ['left'] : [], (a === R || b === R) ? ['right'] : []).sort();
      eq(offers, want, '1|3 orders/ends offer exactly the matching sides (L=' + L + ' R=' + R + ' tile=' + a + '|' + b + ')');
      for (const dir of want) {
        const c = domState(clone(s));
        const r = domino.applyAction(c, 'a', { type: 'place', tile: { id: t.id }, direction: dir });
        assert(r && !r.error, 'regression placement applies: ' + a + '|' + b + ' ' + dir);
        assert(domino.validateChain(c.chain).valid, 'invariant after regression placement');
        assert(String(c.turn) === 'b', 'turn flips after placement');
      }
      n++; T('domino');
    }
  }
  console.log('   regression cells:', n);
}

console.log('D3) domino first tile: opening double enforced, free open otherwise');
{
  const s = domState({ chain: [], openingDouble: 5, hands: { a: [{ a: 5, b: 5, id: '5-5' }, { a: 1, b: 3, id: '1-3' }], b: [] } });
  const offers = domino.getLegalActions(s, 'a');
  eq(offers.length, 1, 'only the opening double offered');
  eq(offers[0].tile.id, '5-5', 'opening tile is 5|5');
  assert(domino.applyAction(domState(clone(s)), 'a', { type: 'place', tile: { id: '1-3' }, direction: 'right' }).error, 'non-double opener rejected');
  const c = domState(clone(s));
  assert(!domino.applyAction(c, 'a', { type: 'place', tile: { id: '5-5' }, direction: 'right' }).error, 'double opens');
  assert(c.openingDouble === null && c.chain.length === 1, 'opening rule consumed after first tile');
  const free = domino.createGame({ playerIds: ['a', 'b'], preferredStarter: 'a' });
  free.status = 'active';
  assert(free.openingDouble === null, 'preferred starter skips the double rule');
  eq(domino.getLegalActions(free, 'a').length, 7, 'free open offers the whole hand');
  T('domino'); T('domino'); T('domino');
}

console.log('D4) domino doubles mid-chain, both-ends match, 0-tiles');
{
  const s = domState({ chain: chainFor(3, 6), hands: { a: [{ a: 3, b: 3, id: '3-3' }], b: [] } });
  eq(domino.getLegalActions(s, 'a').map(x => x.direction), ['left'], '3|3 matches end 3 only');
  const c = domState(clone(s));
  domino.applyAction(c, 'a', { type: 'place', tile: { id: '3-3' }, direction: 'left' });
  eq(domino.openEnds(c.chain).left, 3, 'double keeps its value exposed');
  const both = domState({ chain: chainFor(1, 3), hands: { a: [{ a: 1, b: 3, id: '1-3' }], b: [] } });
  eq(domino.getLegalActions(both, 'a').map(x => x.direction).sort(), ['left', 'right'], 'tile matching both ends offered on both');
  const same = domState({ chain: chainFor(2, 2), hands: { a: [{ a: 0, b: 2, id: '0-2' }], b: [] } });
  eq(domino.getLegalActions(same, 'a').map(x => x.direction).sort(), ['left', 'right'], 'equal ends offer both sides');
  const zero = domState({ chain: chainFor(0, 4), hands: { a: [{ a: 0, b: 0, id: '0-0' }, { a: 0, b: 6, id: '0-6' }], b: [] } });
  const zo = domino.getLegalActions(zero, 'a').filter(x => x.type === 'place');
  eq(zo.length, 2, '0 is a real value: both 0-tiles match end 0');
  const zc = domState(clone(zero));
  domino.applyAction(zc, 'a', { type: 'place', tile: { id: '0-6' }, direction: 'left' });
  eq(domino.openEnds(zc.chain).left, 6, '0|6 flips to expose 6');
  assert(domino.validateChain(zc.chain).valid, 'invariant with 0-tiles');
  for (let i = 0; i < 6; i++) T('domino');
}

console.log('D5) domino draw/pass rules');
{
  const stuck = domState({ chain: chainFor(0, 0), stock: [{ a: 1, b: 1, id: 's1' }],
    hands: { a: [{ a: 1, b: 3, id: '1-3' }], b: [] } });
  eq(domino.getLegalActions(stuck, 'a').map(x => x.type), ['draw'], 'stuck + stock offers draw');
  const d = domState(clone(stuck));
  assert(!domino.applyAction(d, 'a', { type: 'draw' }).error, 'draw applies');
  eq([d.hands.a.length, d.stock.length, d.turn, d.moveCount], [2, 0, 'a', 1], 'draw adds a tile and keeps the turn');
  const free = domState({ chain: chainFor(1, 5), stock: [{ a: 1, b: 1, id: 's1' }],
    hands: { a: [{ a: 1, b: 3, id: '1-3' }], b: [] } });
  eq(domino.applyAction(domState(clone(free)), 'a', { type: 'draw' }).error, 'لديك حجر صالح للعب — ضعه بدل السحب', 'draw rejected while a placement exists');
  eq(domino.applyAction(domState(clone(free)), 'a', { type: 'pass' }).error, 'cannot pass with stock', 'pass rejected while stock remains');
  const stuckEmpty = domState({ chain: chainFor(0, 0), stock: [], hands: { a: [{ a: 1, b: 3, id: '1-3' }], b: [{ a: 0, b: 2, id: '0-2' }] } });
  eq(domino.getLegalActions(stuckEmpty, 'a').map(x => x.type), ['pass'], 'stuck + empty stock offers pass');
  eq(domino.applyAction(domState(clone(stuckEmpty)), 'a', { type: 'draw' }).error, 'no stock', 'draw from empty stock rejected');
  const p = domState(clone(stuckEmpty));
  assert(!domino.applyAction(p, 'a', { type: 'pass' }).error, 'pass applies');
  assert(!p.finished && String(p.turn) === 'b', 'pass flips turn; game continues (opponent can play)');
  for (let i = 0; i < 8; i++) T('domino');
}

console.log('D6) domino blocked finish: lowest pips win, multi-player pass-through');
{
  const s = domState({ chain: chainFor(0, 0), stock: [],
    hands: { a: [{ a: 1, b: 5, id: '1-5' }], b: [{ a: 2, b: 4, id: '2-4' }, { a: 6, b: 6, id: '6-6' }] } });
  const c = domState(clone(s));
  assert(!domino.applyAction(c, 'a', { type: 'pass' }).error, 'final pass applies');
  assert(c.finished && c.status === 'finished', 'blocked game ends (no infinite pass loop)');
  eq([c.winner, c.lastRound.blocked], ['a', true], 'lowest pips (6 < 18) win the block');
  eq([c.scores.a, c.lastRound.points], [18, 18], 'blocked points = sum of others pips');
  const s3 = domState({ chain: chainFor(0, 0), stock: [], players: ['a', 'b', 'c'], maxPlayers: 3,
    hands: { a: [{ a: 1, b: 5, id: '1-5' }], b: [{ a: 0, b: 2, id: '0-2' }], c: [{ a: 1, b: 2, id: '1-2' }] } });
  const c3 = domState(clone(s3));
  assert(!domino.applyAction(c3, 'a', { type: 'pass' }).error, 'pass applies');
  assert(!c3.finished && String(c3.turn) === 'b', 'game continues when another player can move');
  for (let i = 0; i < 4; i++) T('domino');
}

console.log('D7) domino status/turn gates');
{
  const s = domState({ chain: chainFor(1, 2), hands: { a: [{ a: 1, b: 3, id: '1-3' }], b: [] } });
  eq(domino.getLegalActions(s, 'b'), [], 'opponent gets no actions on my turn');
  eq(domino.getLegalActions(s, 'zzz'), [], 'non-member gets no actions');
  assert(domino.applyAction(domState(clone(s)), 'b', { type: 'pass' }).error, 'out-of-turn rejected');
  const fin = domState(clone(s)); fin.status = 'finished'; fin.finished = true;
  eq(domino.getLegalActions(fin, 'a'), [], 'finished game offers nothing');
  assert(domino.applyAction(fin, 'a', { type: 'pass' }).error, 'finished game rejects actions');
  for (let i = 0; i < 5; i++) T('domino');
}

console.log('D8) domino duplicate delivery: same moveId applies once');
{
  const s = domState({ chain: chainFor(1, 5), hands: { a: [{ a: 1, b: 3, id: '1-3' }, { a: 6, b: 6, id: '6-6' }], b: [] } });
  const act = { type: 'place', tile: { id: '1-3' }, direction: 'left', moveId: 'dup-dom-1' };
  const first = pipe.applyRoomAction(domino, s, 'a', clone(act));
  assert(first && first.ok && !first.duplicate, 'first delivery applies');
  const snap = JSON.stringify({ chain: s.chain, hands: s.hands, turn: s.turn, mc: s.moveCount });
  const second = pipe.applyRoomAction(domino, s, 'a', clone(act));
  assert(second && second.ok && second.duplicate, 'second delivery is a duplicate no-op');
  eq(JSON.stringify({ chain: s.chain, hands: s.hands, turn: s.turn, mc: s.moveCount }), snap, 'duplicate changes nothing');
  const fresh = pipe.applyRoomAction(domino, s, 'a', { type: 'place', tile: { id: '6-6' }, direction: 'left', moveId: 'other-id' });
  assert(fresh && fresh.error, 'same content under a new moveId is still turn-gated');
  for (let i = 0; i < 3; i++) T('domino');
}

console.log('D9) domino restore: ends recomputed from the chain, never trusted');
{
  const s = domino.createGame({ playerIds: ['a', 'b'] });
  s.status = 'active';
  for (let i = 0; i < 30 && !domino.isFinished(s); i++) {
    const acts = domino.getLegalActions(s, s.turn);
    domino.applyAction(s, s.turn, clone(acts[Math.floor(Math.random() * acts.length) % acts.length]));
  }
  const before = { ends: domino.openEnds(s.chain), offers: domino.getLegalActions(s, s.turn) };
  const restored = JSON.parse(JSON.stringify(s)); // DB / reconnect round-trip
  assert(domino.validateChain(restored.chain).valid, 'restored chain verifies');
  eq(domino.openEnds(restored.chain), before.ends, 'recomputed ends equal pre-restore ends');
  eq(domino.getLegalActions(restored, restored.turn), before.offers, 'offers recomputed identically after restore');
  for (let i = 0; i < 3; i++) T('domino');
}

console.log('D10) domino long-chain fuzz: invariant + conservation + agreement every move');
{
  let games = 0, moves = 0;
  for (let g = 0; g < 200; g++) {
    const s = domino.createGame({ playerIds: ['a', 'b'] });
    s.status = 'active';
    let guard = 0;
    while (!domino.isFinished(s) && guard++ < 400) {
      assert(domino.validateChain(s.chain).valid, 'invariant holds');
      const ids = [];
      for (const p of s.players) for (const t of s.hands[p]) ids.push(t.id);
      for (const t of s.stock) ids.push(t.id);
      for (const t of s.chain) ids.push(t.id);
      eq(ids.length, 28, '28 tiles conserved');
      eq(new Set(ids).size, 28, 'no duplicated tile');
      const turn = s.turn;
      for (const a of domino.getLegalActions(s, turn).filter(x => x.type === 'place')) {
        const c = clone(s);
        assert(!domino.applyAction(c, turn, clone(a)).error, 'every offer applies');
      }
      const acts = domino.getLegalActions(s, turn);
      assert(acts.length > 0, 'turn never stuck without an action');
      assert(!domino.applyAction(s, turn, clone(acts[acts.length - 1])).error, 'action applies');
      moves++;
    }
    assert(domino.isFinished(s), 'every game ends');
    assert(s.winner && typeof s.scores[s.winner] === 'number', 'winner scored');
    games++;
  }
  console.log('   fuzz games:', games, 'moves:', moves);
  T('domino');
}

console.log('D11) domino UI: taps and drops send the exact tapped direction');
function domCtx(s, me) {
  return { roomId: 'r1', me: me,
    room: { players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], owner: 'a', scoreTarget: 100 },
    state: { public: domino.getPublicState(s), private: domino.getPrivateState(s, me), legalActions: domino.getLegalActions(s, me) } };
}
function dominoUIHarness() {
  const src = fs.readFileSync('kahwa-domino-ui.js', 'utf8');
  const sent = [], listeners = [];
  const statusEl = { textContent: '', className: '' };
  const sideBar = { hidden: true, innerHTML: '', onclick: null };
  const handStubs = [];
  const dropStubs = [{ dataset: { drop: 'left' } }, { dataset: { drop: 'right' } }];
  const toolStubs = {};
  const toolsEl = { hidden: true, onclick: null, querySelector: (sel) => (toolStubs[sel] || (toolStubs[sel] = { hidden: true })) };
  const stockBtn = { disabled: true, onclick: null };
  const chainEl = { innerHTML: '', clientWidth: 420,
    classList: { add() {}, remove() {} }, getBoundingClientRect: () => ({ top: 300, width: 420 }) };
  const selfEl = { getBoundingClientRect: () => ({ top: 540 }) };
  const container = { clientWidth: 460, classList: { add() {}, remove() {} },
    querySelectorAll: (sel) => (sel === '.hand-tile' ? handStubs : (sel === '[data-drop]' ? dropStubs : [])),
    querySelector: (sel) => {
      if (sel === '#dom-chain') return chainEl;
      if (sel === '[data-stock]') return stockBtn;
      if (sel === '.dom-tools') return toolsEl;
      if (sel === '#dom-menu') return { onclick: null };
      if (sel === '.dom-self') return selfEl;
      return null;
    } };
  let htmlWrites = 0;
  Object.defineProperty(container, 'innerHTML', { configurable: true,
    get() { return this._html; }, set(v) { this._html = v; htmlWrites++; } });
  const windowStub = { innerWidth: 460, innerHeight: 700,
    addEventListener: (t, f) => { listeners.push([t, f]); },
    removeEventListener: (t, f) => { const i = listeners.findIndex(l => l[0] === t && l[1] === f); if (i >= 0) listeners.splice(i, 1); } };
  const documentStub = { body: { classList: { add() {}, remove() {}, toggle() {} } },
    getElementById: (getId) => (getId === 'dom-side-choice' ? sideBar : (getId === 'domino-status' ? statusEl : null)) };
  const sandbox = { window: windowStub, document: documentStub,
    SocialAPI: { request: (url, opts) => { sent.push({ url, body: JSON.parse(opts.body) }); return Promise.resolve({ room: null }); } },
    setTimeout, clearTimeout };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'kahwa-domino-ui.js' });
  const ui = sandbox.window.kahwaDominoUI;
  return { ui, sent, listeners, statusEl, sideBar, handStubs, dropStubs, chainEl, container,
    writes: () => htmlWrites,
    renderCtx(ctx) {
      handStubs.length = 0;
      for (const t of ((ctx.state.private || {}).hand || [])) handStubs.push({ dataset: { id: t.id }, onclick: null, ondragstart: null, ondragend: null });
      sideBar.hidden = true; sideBar.onclick = null;
      ui.render(container, ctx);
    } };
}
{
  const single = domState({ chain: chainFor(1, 5), hands: { a: [{ a: 1, b: 3, id: '1-3' }, { a: 4, b: 4, id: '4-4' }], b: [{ a: 0, b: 1, id: 'f1' }] } });
  const H1 = dominoUIHarness();
  H1.renderCtx(domCtx(single, 'a'));
  assert(H1.chainEl.innerHTML.includes('dom-snake-board'), 'chain renders as a snake board');
  eq((H1.chainEl.innerHTML.match(/dom-tile/g) || []).length, 2, 'board shows every chain tile');
  H1.handStubs.find(e => e.dataset.id === '1-3').onclick();
  eq(H1.sent.length, 1, 'single-offer tap sends exactly once');
  eq(H1.sent[0].body.direction, 'left', 'tap sends the matching end (left)');
  eq(H1.sent[0].body.tile.id, '1-3', 'tap sends the tapped tile');
  assert(H1.sent[0].url.includes('/api/game-rooms/r1/action') && H1.sent[0].body.moveId, 'POST action URL + moveId stamped');
  T('domino'); T('domino');
  const both = domState({ chain: chainFor(1, 3), hands: { a: [{ a: 1, b: 3, id: '1-3' }], b: [] } });
  const H2 = dominoUIHarness();
  H2.renderCtx(domCtx(both, 'a'));
  H2.handStubs.find(e => e.dataset.id === '1-3').onclick();
  eq(H2.sent.length, 0, 'dual-offer tap waits for the side choice');
  assert(H2.sideBar.hidden === false, 'side choice bar appears');
  H2.sideBar.onclick({ target: { dataset: { side: 'right' } } });
  eq(H2.sent.length, 1, 'side choice sends once');
  eq(H2.sent[0].body.direction, 'right', 'right-end choice sends direction right');
  const H3 = dominoUIHarness();
  H3.renderCtx(domCtx(both, 'a'));
  H3.handStubs.find(e => e.dataset.id === '1-3').onclick();
  H3.sideBar.onclick({ target: { dataset: { side: 'left' } } });
  eq(H3.sent[0].body.direction, 'left', 'left-end choice sends direction left');
  T('domino'); T('domino');
  for (const [pad, want] of [[0, 'left'], [1, null]]) {
    const H = dominoUIHarness();
    H.renderCtx(domCtx(single, 'a'));
    H.dropStubs[pad].ondrop({ preventDefault() {}, dataTransfer: { getData: () => '1-3' } });
    if (want) { eq(H.sent.length, 1, 'drop on the matching pad sends'); eq(H.sent[0].body.direction, want, 'drop sends the pad end (left)'); }
    else { eq(H.sent.length, 0, 'drop on the wrong pad sends nothing'); eq(H.statusEl.textContent, 'لا يمكن وضع الحجر في هذا الطرف', 'wrong-pad drop explains itself'); }
    T('domino');
  }
  const H5 = dominoUIHarness();
  H5.renderCtx(domCtx(single, 'a'));
  H5.handStubs.find(e => e.dataset.id === '4-4').onclick();
  eq(H5.sent.length, 0, 'non-matching tap sends nothing');
  eq(H5.statusEl.textContent, 'هذا الحجر لا يطابق طرف السلسلة', 'non-matching tap explains itself');
  T('domino');
  const H6 = dominoUIHarness();
  const waited = domCtx(single, 'a');
  waited.state.private = { hand: [{ a: 1, b: 3, id: '1-3' }], turn: false };
  waited.state.legalActions = [];
  H6.renderCtx(waited);
  H6.handStubs.find(e => e.dataset.id === '1-3').onclick();
  eq(H6.sent.length, 0, 'out-of-turn tap sends nothing');
  eq(H6.statusEl.textContent, 'انتظر دورك', 'out-of-turn tap explains itself');
  T('domino');
  const H7 = dominoUIHarness();
  H7.renderCtx(domCtx(single, 'a'));
  const tap = H7.handStubs.find(e => e.dataset.id === '1-3').onclick;
  tap(); tap();
  eq(H7.sent.length, 1, 'rapid double tap single-flights (busy guard)');
  T('domino');
  const H8 = dominoUIHarness(), ctx8 = domCtx(single, 'a');
  H8.renderCtx(ctx8); H8.renderCtx(ctx8);
  eq(H8.listeners.filter(l => l[0] === 'resize').length, 1, 'resize listener bound exactly once');
  const w0 = H8.writes();
  H8.listeners.find(l => l[0] === 'resize')[1]();
  assert(H8.writes() > w0, 'resize re-renders the snake');
  H8.ui.destroy();
  eq(H8.listeners.length, 0, 'destroy removes the resize listener');
  const w1 = H8.writes();
  H8.ui.render(H8.container, ctx8);
  assert(H8.writes() > w1, 'render works again after destroy');
  T('domino'); T('domino');
  const H9 = dominoUIHarness();
  H9.renderCtx(domCtx(domState({ chain: [], hands: { a: [{ a: 5, b: 5, id: '5-5' }], b: [] } }), 'a'));
  assert(H9.chainEl.innerHTML.includes('dom-empty'), 'empty chain keeps its prompt');
  T('domino');
}

console.log('L1) domino snake layout: bounds, no overlap, continuity, anchor');
{
  function eulerChain() {
    const adj = Array.from({ length: 7 }, () => []);
    for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) { adj[a].push(b); adj[b].push(a); }
    const used = new Set(), vs = [0], circuit = [];
    while (vs.length) {
      const v = vs[vs.length - 1];
      let nx = null;
      while (adj[v].length) {
        const to = adj[v].pop(), key = Math.min(v, to) + '-' + Math.max(v, to);
        if (!used.has(key)) { used.add(key); nx = to; break; }
      }
      if (nx === null) circuit.push(vs.pop()); else vs.push(nx);
    }
    circuit.reverse();
    const chain = [];
    for (let i = 0; i + 1 < circuit.length; i++) {
      const a = circuit[i], b = circuit[i + 1];
      chain.push({ a, b, id: Math.min(a, b) + '-' + Math.max(a, b) });
    }
    return chain;
  }
  function adjacent(c1, c2) {
    const r1 = c1.corner ? [c1.r1, c1.r2] : [c1.cy];
    const r2 = c2.corner ? [c2.r1, c2.r2] : [c2.cy];
    return Math.abs(c1.cx - c2.cx) === 1 && r1.some(r => r2.includes(r));
  }
  function overlaps(p, q) {
    return Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x) > 0.01 &&
           Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y) > 0.01;
  }
  const chain28 = eulerChain();
  eq(chain28.length, 28, 'euler trail uses all 28 tiles');
  eq(new Set(chain28.map(t => t.id)).size, 28, 'trail tiles unique');
  assert(domino.validateChain(chain28).valid, 'trail joints match');
  const before = JSON.stringify(chain28), endsBefore = domino.openEnds(chain28);
  eq(domUI.snakeTileSize(820).w, 86, 'desktop keeps the exact current tile size');
  eq(domUI.snakeTileSize(820).h, 43, 'desktop uses true 2:1 domino half-row height');
  eq(domUI.snakeTileSize(100).w, 40, 'tiny widths floor the tile size');
  assert(domUI.snakeTileSize(360).w < 86, 'narrow screens shrink chain tiles');
  eq(domUI.snakeScale(100, 100, 500, 500), 1, 'fitting board needs no scale');
  eq(domUI.snakeScale(100, 400, 500, 200), 0.5, 'tall board scales to the region');
  eq(domUI.snakeScale(0, 0, 0, 0), 1, 'scale guards degenerate input');
  T('domino'); T('domino');
  for (const W of [340, 700, 1100]) {
    for (const len of [1, 2, 7, 13, 28]) {
      const sub = chain28.slice(0, len);
      const useAnchor = len % 2 === 1;
      const anchorId = useAnchor ? sub[Math.floor(len / 3)].id : 'no-such-tile';
      const ts = domUI.snakeTileSize(W);
      const lay = domUI.snakeLayout(sub, W, ts.w, ts.h, 5, anchorId);
      eq(lay.rects.length, len, 'W=' + W + ' len=' + len + ': every tile placed');
      eq(lay.anchorIndex, useAnchor ? Math.floor(len / 3) : Math.floor(len / 2), 'W=' + W + ' len=' + len + ': anchor honored, fallback centered');
      assert(lay.cols >= 3 && lay.rows >= 1 && lay.boardW <= W + 0.01, 'W=' + W + ' len=' + len + ': board fits the measured width');
      for (let i = 0; i < len; i++) {
        const r = lay.rects[i];
        eq(r.id, sub[i].id, 'W=' + W + ' len=' + len + ': layout never reorders the chain');
        assert(r.x >= -0.01 && r.y >= -0.01 && r.x + r.w <= lay.boardW + 0.01 && r.y + r.h <= lay.boardH + 0.01, 'W=' + W + ' len=' + len + ': tile ' + i + ' in bounds');
        if (r.corner) assert(Math.abs(r.rot) === 90, 'W=' + W + ' len=' + len + ': tile ' + i + ' (corner) rotates ±90');
        else if (sub[i].a === sub[i].b) eq(r.rot, 0, 'W=' + W + ' len=' + len + ': double ' + i + ' never rotates');
        else assert(r.rot === 0 || r.rot === 180, 'W=' + W + ' len=' + len + ': single ' + i + ' lies 0/180 by run direction');
        if (!r.corner) {
          if (sub[i].a === sub[i].b) assert(r.w < r.h, 'W=' + W + ' len=' + len + ': double ' + i + ' stands tall');
          else assert(r.w > r.h, 'W=' + W + ' len=' + len + ': single ' + i + ' lies flat');
        }
        for (let j = i + 1; j < len; j++) assert(!overlaps(r, lay.rects[j]), 'W=' + W + ' len=' + len + ': tiles ' + i + '/' + j + ' never overlap');
        if (i + 1 < len) {
          assert(adjacent(lay.cells[i], lay.cells[i + 1]), 'W=' + W + ' len=' + len + ': tiles ' + i + '/' + (i + 1) + ' stay cell-adjacent');
          const nr = lay.rects[i + 1];
          if (lay.cells[i + 1].cx > lay.cells[i].cx) eq(Math.round((r.x + r.w - nr.x) * 1000) / 1000, 0, 'W=' + W + ' len=' + len + ': tiles ' + i + '/' + (i + 1) + ' touch with no right-side gap');
          else eq(Math.round((nr.x + nr.w - r.x) * 1000) / 1000, 0, 'W=' + W + ' len=' + len + ': tiles ' + i + '/' + (i + 1) + ' touch with no left-side gap');
        }
      }
      { // REGRESSION (production screenshot): touching halves show equal pips
        const halves = (idx) => {
          const r = lay.rects[idx], t = sub[idx];
          if (r.rot === 0) return { L: t.a, R: t.b };
          if (r.rot === 180) return { L: t.b, R: t.a };
          if (r.rot === 90) return { U: t.a, D: t.b };
          return { U: t.b, D: t.a };
        };
        for (let i = 0; i + 1 < len; i++) {
          const A = lay.cells[i], B = lay.cells[i + 1], ha = halves(i), hb = halves(i + 1);
          const joint = sub[i].b;
          eq(sub[i + 1].a, joint, 'W=' + W + ' len=' + len + ': chain joint consistent');
          assert(!(A.corner && B.corner), 'W=' + W + ' len=' + len + ': corners never adjacent');
          let fa, fb;
          if (!A.corner && !B.corner) {
            eq(A.cy, B.cy, 'W=' + W + ' len=' + len + ': data pair shares a row');
            if (A.cx + 1 === B.cx) { fa = ha.R; fb = hb.L; }
            else { eq(B.cx + 1, A.cx, 'W=' + W + ' len=' + len + ': data pair side by side'); fa = ha.L; fb = hb.R; }
          } else if (A.corner) {
            eq(B.cy === A.r1 || B.cy === A.r2, true, 'W=' + W + ' len=' + len + ': data meets corner inside its span');
            eq(Math.abs(B.cx - A.cx), 1, 'W=' + W + ' len=' + len + ': data beside corner');
            fb = (B.cx > A.cx) ? hb.L : hb.R;
            fa = (B.cy === A.r1) ? ha.U : ha.D;
          } else {
            eq(A.cy === B.r1 || A.cy === B.r2, true, 'W=' + W + ' len=' + len + ': data meets corner inside its span');
            eq(Math.abs(A.cx - B.cx), 1, 'W=' + W + ' len=' + len + ': data beside corner');
            fa = (A.cx > B.cx) ? ha.L : ha.R;
            fb = (A.cy === B.r1) ? hb.U : hb.D;
          }
          eq(fa, joint, 'W=' + W + ' len=' + len + ': tile ' + i + ' faces the joint value');
          eq(fb, joint, 'W=' + W + ' len=' + len + ': tile ' + (i + 1) + ' faces the joint value');
        }
        if (len > 1) {
          const ends = domino.openEnds(sub);
          const freeVal = (idx, other) => {
            const C = lay.cells[idx], O = lay.cells[other], h = halves(idx);
            if (!C.corner) return (O.cx > C.cx) ? h.L : h.R;
            const orow = O.corner ? O.r1 : O.cy;
            return (orow === C.r1) ? h.D : h.U;
          };
          eq(freeVal(0, 1), ends.left, 'W=' + W + ' len=' + len + ': chain-start free half shows the logical left end');
          eq(freeVal(len - 1, len - 2), ends.right, 'W=' + W + ' len=' + len + ': chain-end free half shows the logical right end');
        } else eq(lay.rects[0].rot, 0, 'W=' + W + ' len=' + len + ': lone tile never rotates');
      }
      T('domino');
    }
  }
  eq(JSON.stringify(chain28), before, 'layout never mutates the logical chain');
  eq(domino.openEnds(chain28), endsBefore, 'open ends still come from logic, untouched by layout');
  T('domino');
}

// ================= T. TAWLA =================
const realRandomInt = crypto.randomInt;
function tawlaActive(starter) {
  const s = tawla.createGame({ playerIds: ['pA', 'pB'], preferredStarter: starter || 'pA' });
  s.status = 'active';
  return s;
}
function tawlaCraft(white, black, bar) {
  const s = tawlaActive();
  s.board = Array.from({ length: 24 }, () => ({ white: 0, black: 0 }));
  for (const [i, n] of Object.entries(white || {})) s.board[Number(i)].white = n;
  for (const [i, n] of Object.entries(black || {})) s.board[Number(i)].black = n;
  if (bar) s.bar = { white: bar.white || 0, black: bar.black || 0 };
  s.moveCount = 1;
  return s;
}
function tawlaRoll(s, userId, faces) {
  const seq = faces.map(f => f - 1);
  crypto.randomInt = () => (seq.length ? seq.shift() : 0);
  try { return tawla.applyAction(s, userId, { type: 'roll' }); }
  finally { crypto.randomInt = realRandomInt; }
}
function tawlaTotal(s) {
  let n = s.bar.white + s.bar.black + s.home.white + s.home.black;
  for (const p of s.board) n += p.white + p.black;
  return n;
}

console.log('T1) tawla exhaustive: all 36 dice combos + invariants');
{
  let cells = 0;
  for (let d1 = 1; d1 <= 6; d1++) for (let d2 = 1; d2 <= 6; d2++) {
    const s = tawlaActive();
    const r = tawlaRoll(s, 'pA', [d1, d2]);
    assert(r && !r.error, 'roll applies');
    eq(s.dice, [d1, d2], 'dice follow the stub (server crypto path)');
    const want = (d1 === d2) ? [d1, d1, d1, d1] : [d1, d2];
    eq([...s.remainingMoves].sort((x, y) => x - y), [...want].sort((x, y) => x - y), 'remaining dice correct');
    eq(tawlaTotal(s), 30, '30 checkers conserved');
    assert(s.rolled === true && String(s.turn) === 'pA', 'opening roll never auto-passes');
    assert(tawla.getLegalActions(s, 'pA').length > 0, 'opening roll always offers moves');
    JSON.stringify(tawla.getPublicState(s));
    assert(!('myColor' in tawla.getPublicState(s)), 'public leaks nothing private');
    cells++; T('tawla');
  }
  console.log('   dice cells:', cells);
}

console.log('T2) tawla forced-max: larger die only when a single die can play');
{
  const s = tawlaCraft({ 3: 1 });
  tawlaRoll(s, 'pA', [6, 4]);
  const acts = tawla.getLegalActions(s, 'pA');
  eq(acts.length, 1, 'single checker: exactly one legal move');
  eq([acts[0].from, acts[0].to, acts[0].die], [3, 'home', 6], 'the larger die (6) must be played');
  const c = tawlaCraft({ 3: 1 });
  tawlaRoll(c, 'pA', [6, 4]);
  assert(tawla.applyAction(c, 'pA', { type: 'move', from: 3, to: 'home', die: 4 }).error, 'smaller die rejected when both cannot play');
  const both = tawlaCraft({ 3: 1, 1: 1 });
  tawlaRoll(both, 'pA', [6, 4]);
  const dice = tawla.getLegalActions(both, 'pA').map(a => a.die).sort();
  eq(dice, [4, 6], 'both dice offered when a 6-then-4 sequence exists');
  for (let i = 0; i < 3; i++) T('tawla');
}

console.log('T3) tawla direction: white descends, black ascends');
{
  const w = tawlaCraft({ 10: 1 });
  tawlaRoll(w, 'pA', [5, 2]);
  for (const m of tawla.getLegalActions(w, 'pA')) {
    if (typeof m.from === 'number' && typeof m.to === 'number') assert(m.to < m.from, 'white moves down');
  }
  const b = tawlaActive('pB');
  b.board = Array.from({ length: 24 }, () => ({ white: 0, black: 0 }));
  b.board[10].black = 1; b.moveCount = 1;
  tawlaRoll(b, 'pB', [5, 2]);
  assert(tawla.getLegalActions(b, 'pB').length > 0, 'black has moves');
  for (const m of tawla.getLegalActions(b, 'pB')) {
    if (typeof m.from === 'number' && typeof m.to === 'number') assert(m.to > m.from, 'black moves up');
  }
  T('tawla'); T('tawla');
}

console.log('T4) tawla blocks: 2+ checkers close singles, vias and landings');
{
  const s = tawlaCraft({ 10: 1 }, { 3: 2 });
  tawlaRoll(s, 'pA', [5, 2]);
  const acts = tawla.getLegalActions(s, 'pA');
  assert(!acts.some(a => Array.isArray(a.dice) && a.dice.length === 2), 'no composite onto a closed final point');
  eq(acts.length, 1, 'one checker left: forced-max keeps a single move');
  eq(acts[0].die, 5, 'the survivor is the larger die');
  const c = tawlaCraft({ 10: 1 }, { 3: 2 });
  tawlaRoll(c, 'pA', [5, 2]);
  assert(tawla.applyAction(c, 'pA', { type: 'move', from: 10, to: 3, dice: [5, 2], via: 5 }).error, 'closed landing rejected');
  T('tawla'); T('tawla');
}

console.log('T5) tawla bar entry is mandatory; side moves rejected');
{
  const s = tawlaCraft({ 10: 1 }, {}, { white: 1 });
  tawlaRoll(s, 'pA', [5, 2]);
  const acts = tawla.getLegalActions(s, 'pA');
  assert(acts.length > 0, 'bar offers moves');
  assert(acts.every(a => a.from === 'bar'), 'everything plays from the bar first');
  const c = tawlaCraft({ 10: 1 }, {}, { white: 1 });
  tawlaRoll(c, 'pA', [5, 2]);
  assert(tawla.applyAction(c, 'pA', { type: 'move', from: 10, to: 5, die: 5 }).error, 'side checker frozen while bar occupied');
  T('tawla'); T('tawla');
}

console.log('T6) tawla overshoot: highest checker only');
{
  const bad = tawlaCraft({ 4: 1, 2: 1 });
  tawlaRoll(bad, 'pA', [5, 2]);
  assert(!tawla.getLegalActions(bad, 'pA').some(a => a.from === 2 && a.to === 'home' && a.die === 5), 'overshoot from a lower checker rejected');
  const good = tawlaCraft({ 2: 1 });
  tawlaRoll(good, 'pA', [5, 1]);
  assert(tawla.getLegalActions(good, 'pA').some(a => a.from === 2 && a.to === 'home' && a.die === 5), 'overshoot from the highest checker allowed');
  assert(!tawla.applyAction(good, 'pA', { type: 'move', from: 2, to: 'home', die: 5 }).error, 'overshoot bear-off applies');
  T('tawla'); T('tawla'); T('tawla');
}

console.log('T7) tawla fuzz: conservation + agreement + clean finish');
{
  let games = 0, moves = 0;
  for (let g = 0; g < 60; g++) {
    const s = tawlaActive();
    assert(crypto.randomInt === realRandomInt, 'fuzz uses real crypto dice');
    let guard = 0;
    while (!tawla.isFinished(s) && guard++ < 1500) {
      eq(tawlaTotal(s), 30, '30 checkers conserved');
      const turn = String(s.turn);
      if (!s.rolled) {
        assert(!tawla.applyAction(s, turn, { type: 'roll' }).error, 'roll applies');
        continue;
      }
      const acts = tawla.getLegalActions(s, turn).filter(a => a.type === 'move');
      if (!acts.length) { assert(false, 'rolled turn offers no move (engine must auto-pass)'); }
      const before = JSON.stringify(s.remainingMoves);
      const pick = acts[Math.floor(Math.random() * acts.length)];
      assert(!tawla.applyAction(s, turn, clone(pick)).error, 'offered move applies');
      assert(JSON.stringify(s.remainingMoves).length <= before.length, 'dice only consumed, never reused');
      moves++;
    }
    assert(tawla.isFinished(s), 'every game ends');
    assert(s.winner && typeof s.scores[s.winner] === 'number' && s.scores[s.winner] >= 1, 'winner scored');
    games++;
  }
  console.log('   fuzz games:', games, 'moves:', moves);
  T('tawla');
}

console.log('T8) tawla finish scoring: gammon bonus and plain win');
{
  const g = tawlaCraft({ 0: 1 });
  g.home.white = 14;
  tawlaRoll(g, 'pA', [1, 2]);
  assert(!tawla.applyAction(g, 'pA', { type: 'move', from: 0, to: 'home', die: 2 }).error, 'final bear-off plays the larger die');
  assert(g.finished && String(g.winner) === 'pA', 'game ends on 15 home');
  eq(g.scores.pA, 2, 'opponent with 0 home concedes a double (gammon)');
  const p = tawlaCraft({ 0: 1 });
  p.home.white = 14; p.home.black = 3;
  tawlaRoll(p, 'pA', [1, 2]);
  tawla.applyAction(p, 'pA', { type: 'move', from: 0, to: 'home', die: 2 });
  eq(p.scores.pA, 1, 'plain win scores a single point');
  T('tawla'); T('tawla');
}

// ================= C. CHESS =================
function chessActive() {
  const s = chess.createGame({ playerIds: ['w', 'b'] });
  s.status = 'active';
  return s;
}
function chessFEN(fen, turn) {
  const s = chessActive();
  s.fen = fen; s.turn = turn; s.history = [];
  return s;
}
function chessSeq(moves) {
  const s = chessActive();
  for (const [u, from, to, promo] of moves) {
    const r = chess.applyAction(s, u, promo ? { type: 'move', from, to, promotion: promo } : { type: 'move', from, to });
    assert(r && !r.error, 'sequence move applies: ' + from + to);
  }
  return s;
}
function offeredFen(fen, turn) {
  return chess.getLegalActions(chessFEN(fen, turn), turn === 'white' ? 'w' : 'b')
    .map(a => a.from + a.to + (a.promotion || ''));
}

console.log("C1) chess scholar's mate: checkmate ends the game");
{
  const s = chessSeq([['w', 'e2', 'e4'], ['b', 'e7', 'e5'], ['w', 'f1', 'c4'], ['b', 'b8', 'c6'], ['w', 'd1', 'h5'], ['b', 'g8', 'f6'], ['w', 'h5', 'f7']]);
  assert(s.finished && s.status === 'finished', 'mate finishes the game');
  eq([s.winner, s.finishReason], ['white', 'checkmate'], 'winner + reason recorded');
  assert(chess.applyAction(s, 'b', { type: 'move', from: 'a7', to: 'a6' }).error, 'finished game rejects moves');
  assert(chess.getPublicState(s).check === true, 'mated king is in check');
  T('chess'); T('chess');
}

console.log('C2) chess stalemate position is a draw');
{
  const s = chessFEN('7k/5Q2/8/5K2/8/8/8/8 w - - 0 1', 'white');
  assert(!chess.applyAction(s, 'w', { type: 'move', from: 'f5', to: 'g6' }).error, 'Kg6 applies');
  assert(s.finished, 'stalemate finishes the game');
  eq([s.winner, s.finishReason], ['draw', 'stalemate'], 'stalemate is a draw');
  T('chess');
}

console.log('C3) chess en passant removes the bypassing pawn');
{
  const s = chessSeq([['w', 'e2', 'e4'], ['b', 'a7', 'a6'], ['w', 'e4', 'e5'], ['b', 'd7', 'd5'], ['w', 'e5', 'd6']]);
  const sq = {};
  for (const cell of s.board) if (cell) sq['abcdefgh'[cell.file] + (cell.rank + 1)] = cell.type + cell.color;
  eq(sq['d6'], 'pwhite', 'pawn lands on d6');
  assert(!sq['d5'], 'bypassed pawn removed');
  T('chess');
}

console.log('C4) chess castling: rights honored, transit squares protected');
{
  eq(offeredFen('r3k2r/8/8/8/8/8/8/R3K2R w Kk - 0 1', 'white').includes('e1g1'), true, 'kingside offered with K right');
  eq(offeredFen('r3k2r/8/8/8/8/8/8/R3K2R w Kk - 0 1', 'white').includes('e1c1'), false, 'queenside withheld without Q right');
  eq(offeredFen('r3k2r/8/8/8/8/7b/8/R3K2R w KQkq - 0 1', 'white').includes('e1g1'), false, 'castling through an attacked square rejected');
  eq(offeredFen('r3k2r/8/8/8/8/7b/8/R3K2R w KQkq - 0 1', 'white').includes('e1c1'), true, 'safe side still castles');
  const s = chessFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'white');
  assert(!chess.applyAction(s, 'w', { type: 'move', from: 'e1', to: 'g1' }).error, 'O-O applies');
  const sq = {};
  for (const cell of s.board) if (cell) sq['abcdefgh'[cell.file] + (cell.rank + 1)] = cell.type;
  eq([sq['g1'], sq['f1']], ['k', 'r'], 'king and rook land correctly');
  for (let i = 0; i < 5; i++) T('chess');
}

console.log('C5) chess promotion: explicit choice honored, queen by default');
{
  const q = chessFEN('8/2P5/8/8/8/8/k6K/8 w - - 0 1', 'white');
  assert(!chess.applyAction(q, 'w', { type: 'move', from: 'c7', to: 'c8' }).error, 'promotion without a choice applies');
  eq(q.history[q.history.length - 1].promotion, 'q', 'default promotion is a queen');
  const n = chessFEN('8/2P5/8/8/8/8/k6K/8 w - - 0 1', 'white');
  assert(!chess.applyAction(n, 'w', { type: 'move', from: 'c7', to: 'c8', promotion: 'n' }).error, 'underpromotion applies');
  eq(n.history[n.history.length - 1].promotion, 'n', 'explicit knight honored');
  const bad = chessFEN('8/2P5/8/8/8/8/k6K/8 w - - 0 1', 'white');
  assert(chess.applyAction(bad, 'w', { type: 'move', from: 'c7', to: 'c8', promotion: 'k' }).error, 'king promotion rejected');
  for (let i = 0; i < 3; i++) T('chess');
}

console.log('C6) chess pinned piece: on-file moves only');
{
  const off = offeredFen('4r1k1/8/8/8/8/8/4Q3/4K3 w - - 0 1', 'white');
  eq(off.includes('e2e4'), true, 'pinned queen slides on the file');
  eq(off.includes('e2a6'), false, 'pinned queen cannot leave the file');
  const s = chessFEN('4r1k1/8/8/8/8/8/4Q3/4K3 w - - 0 1', 'white');
  assert(chess.applyAction(s, 'w', { type: 'move', from: 'e2', to: 'a6' }).error, 'off-file pin break rejected');
  for (let i = 0; i < 3; i++) T('chess');
}

console.log('C7) chess self-check rejected; safe king moves kept');
{
  const off = offeredFen('4r1k1/8/8/8/8/8/8/4K3 w - - 0 1', 'white');
  eq(off.includes('e1e2'), false, 'king cannot walk into a rook ray');
  eq(off.includes('e1d1'), true, 'safe king step kept');
  T('chess'); T('chess');
}

console.log('C8) chess king is never captured like a piece');
{
  const off = offeredFen('6k1/8/8/8/8/8/8/3QK3 w - - 0 1', 'white');
  eq(off.includes('d1d8'), true, 'checking move offered');
  eq(off.includes('d1g8'), false, 'king-capture never offered');
  const s = chessFEN('6k1/8/8/8/8/8/8/3QK3 w - - 0 1', 'white');
  assert(chess.applyAction(s, 'w', { type: 'move', from: 'd1', to: 'g8' }).error, 'king-capture rejected');
  T('chess'); T('chess');
}

console.log('C9) chess discovered check flagged with +');
{
  const s = chessFEN('7k/8/8/8/8/2N5/1B6/4K3 w - - 0 1', 'white');
  assert(!chess.applyAction(s, 'w', { type: 'move', from: 'c3', to: 'd5' }).error, 'unblocking move applies');
  assert(/\+/.test(s.history[s.history.length - 1].san), 'SAN carries check');
  assert(chess.getPublicState(s).check === true, 'position flagged in check');
  T('chess'); T('chess');
}

console.log('C10) chess turn discipline, players, resignation');
{
  const s = chessActive();
  assert(chess.applyAction(clone(s), 'b', { type: 'move', from: 'e7', to: 'e5' }).error, 'black cannot open');
  assert(chess.applyAction(clone(s), 'zzz', { type: 'move', from: 'e2', to: 'e4' }).error, 'non-player rejected');
  eq(chess.getLegalActions(s, 'zzz'), [], 'non-player gets no actions');
  assert(!chess.applyAction(s, 'w', { type: 'move', from: 'e2', to: 'e4' }).error, 'e4 applies');
  eq([s.turn, s.moveCount], ['black', 1], 'turn flips exactly once');
  assert(chess.applyAction(s, 'w', { type: 'move', from: 'd2', to: 'd4' }).error, 'no double move');
  const r = chessActive();
  assert(!chess.applyAction(r, 'w', { type: 'resign' }).error, 'resignation applies');
  eq([r.winner, r.finishReason, r.finished], ['black', 'resignation', true], 'resignation recorded');
  for (let i = 0; i < 6; i++) T('chess');
}

console.log('C11) chess draw rules: material, fifty moves, threefold repetition');
{
  const m = chessFEN('8/8/8/8/8/8/k6K/8 w - - 0 1', 'white');
  assert(!chess.applyAction(m, 'w', { type: 'move', from: 'h2', to: 'h3' }).error, 'king step applies');
  eq([m.winner, m.finishReason], ['draw', 'insufficient_material'], 'bare kings drawn');
  const f = chessFEN('7k/5Q2/8/8/8/8/8/K7 w - - 100 80', 'white');
  assert(!chess.applyAction(f, 'w', { type: 'move', from: 'f7', to: 'e8' }).error, 'quiet move applies');
  eq([f.winner, f.finishReason], ['draw', 'fifty_move_rule'], 'fifty-move clock honored from FEN');
  const t = chessSeq([['w', 'g1', 'f3'], ['b', 'g8', 'f6'], ['w', 'f3', 'g1'], ['b', 'f6', 'g8'],
    ['w', 'g1', 'f3'], ['b', 'g8', 'f6'], ['w', 'f3', 'g1'], ['b', 'f6', 'g8']]);
  eq([t.winner, t.finishReason], ['draw', 'threefold_repetition'], 'repetition detected across the full game');
  for (let i = 0; i < 3; i++) T('chess');
}

console.log('C12) chess corrupt state fails safe, never resets the board');
{
  const s = chessActive();
  s.fen = 'garbage!!';
  eq(chess.applyAction(s, 'w', { type: 'move', from: 'e2', to: 'e4' }).error, 'حالة الشطرنج غير صالحة', 'corrupt FEN rejected, not reset');
  eq(chess.getLegalActions(s, 'w'), [], 'corrupt FEN offers nothing');
  const pub = chess.getPublicState(s);
  assert(Array.isArray(pub.board) && pub.check === false, 'public snapshot degrades honestly');
  JSON.stringify(chess.serialize(s));
  for (let i = 0; i < 4; i++) T('chess');
}

console.log('C13) chess fuzz: alternation, two kings forever, agreement');
{
  let moves = 0;
  for (let g = 0; g < 40; g++) {
    const s = chessActive();
    let expect = 'w', guard = 0;
    while (!chess.isFinished(s) && guard++ < 120) {
      const me = s.turn === 'white' ? 'w' : 'b';
      eq(me, expect, 'turns alternate');
      const kings = s.board.filter(c => c && c.type === 'k').length;
      eq(kings, 2, 'both kings always on the board');
      const acts = chess.getLegalActions(s, me);
      if (!acts.length) break;
      const pick = acts[Math.floor(Math.random() * acts.length)];
      const before = s.moveCount;
      assert(!chess.applyAction(s, me, { type: 'move', from: pick.from, to: pick.to, promotion: pick.promotion || undefined }).error, 'offered move applies');
      eq(s.moveCount, before + 1, 'moveCount advances once');
      expect = expect === 'w' ? 'b' : 'w';
      moves++;
    }
  }
  console.log('   fuzz moves:', moves);
  T('chess');
}

// ================= K. CARDS =================
function cardsActive(n) {
  const ids = ['p0', 'p1', 'p2', 'p3'].slice(0, n || 2);
  const s = cards.createGame({ playerIds: ids });
  s.status = 'active';
  return s;
}
function cardIds(list) { return (list || []).map(c => c.id).sort(); }
function cardsTotal(s) {
  const ids = [];
  for (const p of s.players) for (const c of (s.hands[p] || [])) ids.push(c.id);
  for (const c of (s.stock || [])) ids.push(c.id);
  for (const c of (s.discard || [])) ids.push(c.id);
  for (const m of (s.melds || [])) for (const c of (m.cards || [])) ids.push(c.id);
  return ids;
}
function craftHand(s, userId, specs) {
  // specs: [[suit, value], ...] e.g. [['h',5],['s',5],['d',5]]
  s.hands[userId] = specs.map(([suit, value]) => ({ id: suit + value + 'k', suit, value,
    rank: { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[value] || String(value), points: value > 10 ? 10 : value }));
}

console.log('K1) cards deal: counts, phases, first turn');
{
  for (const n of [2, 3, 4]) {
    const s = cardsActive(n);
    assert(s.hands && s.players.length === n, 'player count');
    for (const p of s.players) eq(s.hands[p].length, 7, '7 cards each');
    eq(s.stock.length, 52 - 7 * n - 1, 'stock holds the rest minus one discard');
    eq(s.discard.length, 1, 'one discard starts the pile');
    eq([s.turn, s.phase], [s.players[0], 'draw'], 'first player draws first');
    eq(new Set(cardsTotal(s)).size, 52, 'full unique deck conserved');
    T('cards');
  }
}

console.log('K2) cards draw: stock or discard, turn kept, phase advances');
{
  const s = cardsActive();
  const top = s.discard[s.discard.length - 1].id;
  assert(!cards.applyAction(s, 'p0', { type: 'draw', source: 'stock' }).error, 'stock draw applies');
  eq([s.hands.p0.length, s.phase, s.turn, s.moveCount], [8, 'play', 'p0', 1], 'draw grows hand, keeps turn, advances phase');
  const d = cardsActive();
  const dtop = d.discard[d.discard.length - 1].id;
  assert(!cards.applyAction(d, 'p0', { type: 'draw', source: 'discard' }).error, 'discard draw applies');
  assert(cardIds(d.hands.p0).includes(dtop), 'discard top taken');
  assert(cards.applyAction(d, 'p0', { type: 'draw', source: 'stock' }).error, 'second draw rejected');
  for (let i = 0; i < 3; i++) T('cards');
}

console.log('K3) cards melds: every valid shape accepted, every invalid one refused');
{
  const valid = [
    [['s', 5], ['h', 5], ['d', 5]],
    [['s', 5], ['h', 5], ['d', 5], ['c', 5]],
    [['h', 4], ['h', 5], ['h', 6]],
    [['c', 9], ['c', 10], ['c', 11], ['c', 12]],
    [['h', 1], ['h', 2], ['h', 3]],
  ];
  for (const shape of valid) {
    const s = cardsActive();
    craftHand(s, 'p0', shape.concat([['s', 1], ['s', 2]]));
    cards.applyAction(s, 'p0', { type: 'draw', source: 'stock' });
    const ids = cardIds(s.hands.p0).filter(id => shape.some(([su, v]) => id === su + v + 'k'));
    assert(!cards.applyAction(s, 'p0', { type: 'meld', cardIds: ids }).error, 'valid meld accepted: ' + JSON.stringify(shape));
    eq(s.melds.length, 1, 'meld recorded');
    T('cards');
  }
  const invalid = [
    [['s', 5], ['h', 5]],
    [['s', 5], ['h', 5], ['h', 6]],
    [['h', 4], ['h', 5], ['h', 7]],
    [['h', 4], ['h', 5], ['d', 6]],
    [['c', 12], ['c', 13], ['c', 1]],
    [['s', 9], ['s', 9], ['h', 9]],
  ];
  for (const shape of invalid) {
    const s = cardsActive();
    craftHand(s, 'p0', shape.concat([['d', 1], ['d', 2]]));
    cards.applyAction(s, 'p0', { type: 'draw', source: 'stock' });
    const ids = cardIds(s.hands.p0).filter(id => shape.some(([su, v]) => id === su + v + 'k'));
    const r = cards.applyAction(s, 'p0', { type: 'meld', cardIds: ids.length >= 3 ? ids.slice(0, 3) : ids });
    assert(r && r.error, 'invalid meld refused: ' + JSON.stringify(shape));
    T('cards');
  }
  const ghost = cardsActive();
  craftHand(ghost, 'p0', [['s', 5], ['h', 5], ['d', 5], ['c', 1], ['c', 2]]);
  cards.applyAction(ghost, 'p0', { type: 'draw', source: 'stock' });
  assert(cards.applyAction(ghost, 'p0', { type: 'meld', cardIds: ['s5k', 'h5k', 'nope'] }).error, 'meld with a foreign card refused');
  assert(cards.applyAction(ghost, 'p0', { type: 'meld', cardIds: [] }).error, 'empty meld refused');
  T('cards'); T('cards');
}

console.log('K4) cards meld keeps the turn; discard ends it');
{
  const s = cardsActive();
  craftHand(s, 'p0', [['s', 5], ['h', 5], ['d', 5], ['c', 7], ['c', 8], ['c', 9], ['s', 1]]);
  cards.applyAction(s, 'p0', { type: 'draw', source: 'stock' });
  assert(!cards.applyAction(s, 'p0', { type: 'meld', cardIds: ['s5k', 'h5k', 'd5k'] }).error, 'meld applies');
  eq([s.turn, s.phase], ['p0', 'play'], 'turn stays after a meld');
  assert(!cards.applyAction(s, 'p0', { type: 'meld', cardIds: ['c7k', 'c8k', 'c9k'] }).error, 'second meld applies');
  const discardId = s.hands.p0[0].id;
  assert(!cards.applyAction(s, 'p0', { type: 'discard', cardId: discardId }).error, 'discard applies');
  eq([s.turn, s.phase], ['p1', 'draw'], 'discard passes a fresh draw phase');
  T('cards'); T('cards'); T('cards');
}

console.log('K5) cards finish: empty hand wins by meld or by discard');
{
  const m = cardsActive();
  craftHand(m, 'p0', [['s', 5], ['h', 5], ['d', 5]]);
  cards.applyAction(m, 'p0', { type: 'draw', source: 'stock' });
  const drawn = m.hands.p0[m.hands.p0.length - 1];
  m.hands.p0 = m.hands.p0.filter(c => c.id !== drawn.id);
  m.discard.push(drawn);
  assert(!cards.applyAction(m, 'p0', { type: 'meld', cardIds: ['s5k', 'h5k', 'd5k'] }).error, 'final meld applies');
  assert(m.finished && String(m.winner) === 'p0' && m.finishReason === 'empty_hand', 'meld-out wins');
  eq(m.scores.p0, 15, 'meld points scored (5+5+5)');
  const d = cardsActive();
  craftHand(d, 'p0', [['c', 9]]);
  cards.applyAction(d, 'p0', { type: 'draw', source: 'stock' });
  const last = d.hands.p0.find(c => c.id === 'c9k').id;
  const other = d.hands.p0.find(c => c.id !== 'c9k').id;
  d.hands.p0 = d.hands.p0.filter(c => c.id !== other);
  d.discard.push({ id: other, suit: 'x', value: 0, rank: '?', points: 0 });
  assert(!cards.applyAction(d, 'p0', { type: 'discard', cardId: last }).error, 'final discard applies');
  assert(d.finished && String(d.winner) === 'p0', 'discard-out wins');
  T('cards'); T('cards');
}

console.log('K6) cards secrecy: public hides hands, private shows only mine');
{
  const s = cardsActive();
  craftHand(s, 'p0', [['s', 5], ['h', 5], ['d', 5], ['c', 7], ['c', 8], ['c', 9], ['s', 1]]);
  const pub = cards.getPublicState(s);
  assert(!('hands' in pub) && !('hand' in pub), 'public carries no hands');
  const pubStr = JSON.stringify(pub);
  for (const c of s.hands.p0) assert(!pubStr.includes(c.id), 'hand card hidden from public: ' + c.id);
  const mine = cards.getPrivateState(s, 'p0');
  eq(cardIds(mine.hand), cardIds(s.hands.p0), 'I see exactly my hand');
  const spec = cards.getPrivateState(s, 'spectator-1');
  eq(spec.hand, [], 'spectators get no hand');
  assert(spec.turn === false, 'spectators never hold the turn');
  for (let i = 0; i < 4; i++) T('cards');
}

console.log('K7) cards fuzz: phases, conservation, clean finish');
{
  let games = 0, moves = 0;
  for (let g = 0; g < 20; g++) {
    const s = cardsActive();
    let guard = 0;
    while (!cards.isFinished(s) && guard++ < 600) {
      eq(new Set(cardsTotal(s)).size, cardsTotal(s).length, 'no card duplicated or lost');
      const me = String(s.turn);
      const acts = cards.getLegalActions(s, me);
      assert(acts.length > 0, 'turn never stuck');
      let act;
      if (s.phase === 'draw') {
        act = acts[Math.floor(Math.random() * acts.length)];
      } else {
        const ids = cardIds(s.hands[me]);
        act = { type: 'discard', cardId: ids[Math.floor(Math.random() * ids.length)] };
      }
      assert(!cards.applyAction(s, me, clone(act)).error, 'action applies');
      moves++;
    }
    games++;
  }
  console.log('   fuzz games:', games, 'moves:', moves);
  T('cards');
}

// ================= S. SHARED =================
console.log('S1) shared: turn, membership and malformed actions rejected per game');
{
  const ds = domState({ chain: chainFor(1, 2), hands: { a: [{ a: 1, b: 3, id: '1-3' }], b: [] } });
  assert(domino.applyAction(domState(clone(ds)), 'b', { type: 'pass' }).error, 'domino out-of-turn rejected');
  assert(domino.applyAction(domState(clone(ds)), 'zzz', { type: 'pass' }).error, 'domino non-member rejected');
  assert(domino.applyAction(domState(clone(ds)), 'a', null).error, 'domino null rejected');
  assert(domino.applyAction(domState(clone(ds)), 'a', 'place').error, 'domino string rejected');
  assert(domino.applyAction(domState(clone(ds)), 'a', { type: 'bogus' }).error, 'domino unknown type rejected');
  const ts = tawlaActive();
  assert(tawla.applyAction(ts, 'pB', { type: 'roll' }).error, 'tawla out-of-turn rejected');
  assert(tawla.applyAction(ts, 'zzz', { type: 'roll' }).error, 'tawla non-member rejected');
  assert(tawla.applyAction(ts, 'pA', null).error, 'tawla null rejected');
  assert(tawla.applyAction(ts, 'pA', { type: 'bogus' }).error, 'tawla unknown type rejected');
  const cs = chessActive();
  assert(chess.applyAction(cs, 'b', { type: 'move', from: 'e7', to: 'e5' }).error, 'chess out-of-turn rejected');
  assert(chess.applyAction(cs, 'zzz', { type: 'move', from: 'e2', to: 'e4' }).error, 'chess non-player rejected');
  assert(chess.applyAction(cs, 'w', null).error, 'chess null rejected');
  assert(chess.applyAction(cs, 'w', { type: 'move' }).error, 'chess missing squares rejected');
  const ks = cardsActive();
  assert(cards.applyAction(ks, 'p1', { type: 'draw', source: 'stock' }).error, 'cards out-of-turn rejected');
  assert(cards.applyAction(ks, 'zzz', { type: 'draw', source: 'stock' }).error, 'cards non-member rejected');
  assert(cards.applyAction(ks, 'p0', null).error, 'cards null rejected');
  const kd = cardsActive();
  const kdBefore = kd.stock.length;
  assert(!cards.applyAction(kd, 'p0', { type: 'draw' }).error && kd.stock.length === kdBefore - 1, 'cards sourceless draw defaults to stock (documented leniency)');
  for (let i = 0; i < 17; i++) T('shared');
}

console.log('S2) shared: duplicate moveId is a no-op returning the same state');
{
  const ds = domState({ chain: chainFor(1, 5), hands: { a: [{ a: 1, b: 3, id: '1-3' }, { a: 6, b: 6, id: '6-6' }], b: [] } });
  const dAct = { type: 'place', tile: { id: '1-3' }, direction: 'left', moveId: 'sh-dom' };
  assert(pipe.applyRoomAction(domino, ds, 'a', clone(dAct)).ok, 'domino applies');
  const dSnap = JSON.stringify(ds);
  const dDup = pipe.applyRoomAction(domino, ds, 'a', clone(dAct));
  assert(dDup.ok && dDup.duplicate && JSON.stringify(dDup.state) === dSnap, 'domino duplicate returns identical state');
  const ts = tawlaActive();
  const tAct = { type: 'roll', moveId: 'sh-taw' };
  assert(pipe.applyRoomAction(tawla, ts, 'pA', clone(tAct)).ok, 'tawla roll applies');
  const tSnap = JSON.stringify(ts);
  const tDup = pipe.applyRoomAction(tawla, ts, 'pA', clone(tAct));
  assert(tDup.ok && tDup.duplicate && JSON.stringify(tDup.state) === tSnap, 'tawla duplicate beats the already-rolled error');
  const cs = chessActive();
  const cAct = { type: 'move', from: 'e2', to: 'e4', moveId: 'sh-che' };
  assert(pipe.applyRoomAction(chess, cs, 'w', clone(cAct)).ok, 'chess applies');
  const cSnap = JSON.stringify(cs);
  const cDup = pipe.applyRoomAction(chess, cs, 'w', clone(cAct));
  assert(cDup.ok && cDup.duplicate && JSON.stringify(cDup.state) === cSnap, 'chess duplicate returns identical state');
  const ks = cardsActive();
  const kAct = { type: 'draw', source: 'stock', moveId: 'sh-car' };
  assert(pipe.applyRoomAction(cards, ks, 'p0', clone(kAct)).ok, 'cards draw applies');
  const kSnap = JSON.stringify(ks);
  const kDup = pipe.applyRoomAction(cards, ks, 'p0', clone(kAct));
  assert(kDup.ok && kDup.duplicate && JSON.stringify(kDup.state) === kSnap, 'cards duplicate returns identical state');
  for (let i = 0; i < 8; i++) T('shared');
}

console.log('S3) shared: simultaneous same-moveId deliveries apply exactly once');
{
  const s = tawlaActive();
  const act = { type: 'roll', moveId: 'sh-race-1' };
  return Promise.all(Array.from({ length: 10 }, () =>
    pipe.withRoomLock('race-room', () => pipe.applyRoomAction(tawla, s, 'pA', clone(act)))
  )).then(results => {
    eq(results.filter(r => r && r.ok && !r.duplicate).length, 1, 'exactly one delivery applies');
    eq(results.filter(r => r && r.duplicate).length, 9, 'nine deliveries deduplicated');
    assert(s.rolled === true && s.dice[0] >= 1 && s.dice[1] <= 6, 'single roll stands');
    T('shared'); T('shared'); T('shared');
    sharedStatic();
  });
}

function sharedStatic() {
console.log('S4) shared: REST and Socket converge on one pipeline');
{
  const route = fs.readFileSync('server/src/routes/game-rooms.routes.js', 'utf8');
  const sock = fs.readFileSync('server/src/socket.js', 'utf8');
  assert(route.includes('pipe.applyRoomAction') || route.includes('applyRoomAction'), 'REST applies via the pipeline');
  assert(sock.includes('applyRoomAction'), 'Socket applies via the pipeline');
  assert(sock.includes('withRoomLock'), 'Socket serializes per room');
  assert(sock.includes('المشاهد لا يستطيع اللعب'), 'Socket refuses spectators');
  for (let i = 0; i < 4; i++) T('shared');
}

console.log('S5) shared: room refresh is read-only');
{
  const route = fs.readFileSync('server/src/routes/game-rooms.routes.js', 'utf8');
  const getBlock = route.slice(route.indexOf("router.get('/:id'"), route.indexOf("router.post('/:id/reserve'"));
  assert(!getBlock.includes('applyRoomAction') && !getBlock.includes('.applyAction('), 'GET room never applies actions');
  for (let i = 0; i < 2; i++) T('shared');
}

console.log('S6) shared: clients render server legality, never invent it');
{
  for (const f of ['kahwa-domino-ui.js', 'kahwa-tawla-v2.js', 'kahwa-chess-canva.js', 'kahwa-cards-canva.js']) {
    const src = fs.readFileSync(f, 'utf8');
    assert(src.includes('legalActions'), f + ' reads server legalActions');
    assert(/busy\s*=\s*true/.test(src), f + ' single-flights sends');
    assert(src.includes('moveId'), f + ' stamps moveId');
    assert(src.includes('kahwaApplyActionResponse'), f + ' renders the POST response');
    T('shared');
  }
}

console.log('S7) shared: no move-path timers, sounds fire once per event');
{
  const domSrc = fs.readFileSync('kahwa-domino-ui.js', 'utf8');
  hasCount(domSrc, 'setTimeout', 1, 'domino keeps exactly its rematch timer');
  assert(domSrc.split('\n').find(l => l.includes('setTimeout')).includes('/start'), 'domino timer is post-game rematch only');
  for (const f of ['kahwa-tawla-v2.js', 'kahwa-chess-canva.js', 'kahwa-sound-layer.js']) {
    hasCount(fs.readFileSync(f, 'utf8'), 'setTimeout', 0, f + ' has no timers');
  }
  const cardSrc = fs.readFileSync('kahwa-cards-canva.js', 'utf8');
  hasCount(cardSrc, 'setTimeout', 1, 'cards keeps exactly its toast fade');
  const layer = fs.readFileSync('kahwa-sound-layer.js', 'utf8');
  assert(layer.includes('soundEventsFor') && layer.includes('.catch('), 'sound layer diffs transitions and swallows audio failures');
  for (let i = 0; i < 7; i++) T('shared');
}

console.log('S8) shared: cards runtime is the preserved original transplant');
{
  const html = fs.readFileSync('game-room.html', 'utf8');
  assert(html.includes('kahwa-cards-canva.js'), 'room loads the transplant adapter');
  assert(!html.includes('kahwa-cards-ui.js'), 'room never loads the old hand-written UI');
  const adapter = fs.readFileSync('kahwa-cards-canva.js', 'utf8');
  assert(adapter.includes('<section id="game-screen"'), 'adapter embeds the original game-screen');
  assert(!adapter.includes('العب مجموعة') && !adapter.includes('تخلص من المحددة'), 'no alternative labels');
  for (let i = 0; i < 4; i++) T('shared');
}

console.log('CASES PER GAME:', JSON.stringify(cases));
assert(crypto.randomInt === realRandomInt, 'crypto stub never leaks');
console.log('ALL KAHWA LOGIC EXHAUSTIVE TESTS PASS');
}
