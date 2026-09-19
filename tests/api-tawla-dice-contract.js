// Kahwa tawla dice + sum-move + sound contract.
// 1-4:   server-only crypto dice (single roll, duplicate no-op, no bias, natural doubles)
// 5-10:  dice-sum moves (direct 7, both orders, rejection, consumption, doubles, bar/hit/bear-off)
// 11:    shared sound layer: exactly one sound per event, never duplicated
// 12:    no artificial send-delaying timers in the game frontends
// 13:    engine-public spectator mirror exposes dice/turn state for every game
const fs = require('fs');
const crypto = require('crypto');
const tawla = require('../server/src/games/tawla-engine.js');
const chess = require('../server/src/games/chess-engine.js');
const domino = require('../server/src/games/domino-engine.js');
const cards = require('../server/src/games/cards-engine.js');
const { flattenPublicEngine } = require('../server/src/games/action-pipeline.js');
const { soundEventsFor } = require('../kahwa-sound-layer.js');

function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
function eq(a, b, msg) { assert(JSON.stringify(a) === JSON.stringify(b), msg + ' (got ' + JSON.stringify(a) + ')'); }

const realRandomInt = crypto.randomInt;
function rollStubbed(s, userId, faces) {
  const seq = faces.map(f => f - 1); // crypto dice are 1+randomInt(0,6)
  crypto.randomInt = () => { const v = seq.shift(); return v === undefined ? 0 : v; };
  try { return tawla.applyAction(s, userId, { type: 'roll' }); }
  finally { crypto.randomInt = realRandomInt; }
}
function activeGame(starter) {
  const s = tawla.createGame({ playerIds: ['pA', 'pB'], preferredStarter: starter || 'pA' });
  s.status = 'active';
  return s;
}
function craftState(white, black, bar) {
  const s = activeGame();
  s.board = Array.from({ length: 24 }, () => ({ white: 0, black: 0 }));
  for (const [i, n] of Object.entries(white || {})) s.board[Number(i)].white = n;
  for (const [i, n] of Object.entries(black || {})) s.board[Number(i)].black = n;
  if (bar) s.bar = { white: bar.white || 0, black: bar.black || 0 };
  s.moveCount = 1;
  return s;
}
function snap(s) {
  return JSON.stringify({ dice: s.dice, rm: s.remainingMoves, rolled: s.rolled, mc: s.moveCount,
    turn: s.turn, status: s.status, board: s.board, bar: s.bar, home: s.home });
}
function sorted(a) { return [...a].sort((x, y) => x - y); }

// 1) single click = single roll: stubbed crypto dice land exactly once
console.log('1) single roll sets server dice once');
{
  const s = activeGame();
  const res = rollStubbed(s, 'pA', [5, 2]);
  assert(res && !res.error, 'roll ok');
  eq(s.dice, [5, 2], 'dice follow the crypto stub exactly');
  eq(sorted(s.remainingMoves), [2, 5], 'both dice consumable');
  assert(s.rolled === true, 'rolled flag set');
  const acts = tawla.getLegalActions(s, 'pA');
  assert(acts.length > 0 && acts.every(a => a.type === 'move'), 'moves listed after roll');
}

// 2) duplicate roll (double click / resend) is a no-op: error + byte-identical state
console.log('2) duplicate roll is rejected and changes nothing');
{
  const s = activeGame();
  rollStubbed(s, 'pA', [5, 2]);
  const before = snap(s);
  const dup = rollStubbed(s, 'pA', [1, 1]); // attacker resends with "better" dice
  assert(dup && dup.error === 'تم رمي الزهر بالفعل', 'duplicate roll rejected');
  assert(snap(s) === before, 'state byte-identical after duplicate roll');
  eq(s.dice, [5, 2], 'original dice kept, resend ignored');
}

// 3) dice are server-sourced: crypto path only, no frontend simulation
console.log('3) server-sourced dice, no frontend simulation');
{
  const s = activeGame();
  const res = rollStubbed(s, 'pA', [3, 6]);
  assert(res && !res.error, 'roll ok');
  eq(s.dice, [3, 6], 'second stub sequence lands exactly (crypto.randomInt is the only source)');
  const twin = fs.readFileSync('kahwa-tawla-v2.js', 'utf8');
  assert(!twin.includes('rollDie') && !twin.includes('rollPair'), 'twin has no dice roller');
  assert(!twin.includes('Math.floor'), 'twin has no Math.floor dice math');
  const rnd = twin.split('Math.random').length - 1;
  assert(rnd === 1, 'twin Math.random occurs exactly once (got ' + rnd + ')');
  const rndLine = twin.split('\n').find(l => l.includes('Math.random'));
  assert(rndLine && rndLine.includes('moveId'), 'the single Math.random is the moveId dedupe stamp, not a result');
  const layer = fs.readFileSync('kahwa-sound-layer.js', 'utf8');
  assert(!layer.includes('Math.random'), 'sound layer has no randomness');
}

// 4) fair dice: full faces for both colors, natural doubles, unpredictable pairs
console.log('4) no color bias, natural doubles, unpredictable');
{
  assert(crypto.randomInt === realRandomInt, 'real crypto restored before fairness sampling');
  for (const [starter, who] of [['pA', 'pA'], ['pB', 'pB']]) {
    const faces = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    let pairs = new Set(), doubles = 0, n = 0;
    for (let i = 0; i < 240; i++) {
      const s = activeGame(starter);
      const res = tawla.applyAction(s, who, { type: 'roll' });
      assert(res && !res.error, 'real roll ok');
      if (s.dice[0] === 0) continue; // unplayable roll auto-passes: not a result
      n++;
      faces[s.dice[0]]++;
      pairs.add(s.dice.join(','));
      if (s.dice[0] === s.dice[1]) doubles++;
    }
    for (let f = 1; f <= 6; f++) {
      assert(faces[f] >= 1, 'starter ' + starter + ' can roll face ' + f);
      assert(faces[f] >= 20 && faces[f] <= 60, 'face ' + f + ' near uniform for ' + starter + ' (got ' + faces[f] + '/~' + n + ')');
    }
    assert(doubles >= 1, 'natural doubles occur for ' + starter + ' (got ' + doubles + ')');
    assert(pairs.size > 2, 'pairs unpredictable for ' + starter);
  }
}

// 5) 5+2 allows the direct 7 (both via orders offered), consuming both dice
console.log('5) 5+2 direct-7 allowed via either order');
{
  for (const [dice, via] of [[[5, 2], 5], [[2, 5], undefined]]) {
    const s = craftState({ 10: 1 });
    const res = rollStubbed(s, 'pA', [5, 2]);
    assert(res && !res.error, 'roll ok');
    const acts = tawla.getLegalActions(s, 'pA');
    eq(acts.length, 4, '2 singles + 2 composite orders');
    const want = { type: 'move', from: 10, to: 3, dice };
    if (via !== undefined) want.via = via;
    const applied = tawla.applyAction(s, 'pA', want);
    assert(applied && !applied.error, 'direct-7 composite accepted (dice ' + dice + ')');
    assert(s.board[10].white === 0 && s.board[3].white === 1, 'checker moved 10->3');
    eq(s.remainingMoves, [], 'both dice consumed');
    assert(String(s.turn) === 'pB' && s.rolled === false, 'turn passes after both dice consumed');
  }
}

// 6) each order is validated on its own intermediate point
console.log('6) one blocked order still leaves the other');
{
  const s = craftState({ 10: 1 }, { 5: 2 }); // via-5 blocked, via-8 open
  rollStubbed(s, 'pA', [5, 2]);
  const acts = tawla.getLegalActions(s, 'pA');
  eq(acts.length, 2, '1 single + 1 composite');
  const comp = acts.find(a => Array.isArray(a.dice) && a.dice.length === 2);
  assert(comp && comp.from === 10 && comp.to === 3 && comp.via === 8, 'only the via-8 order survives');
  const m = craftState({ 10: 1 }, { 8: 2 }); // mirror: via-8 blocked, via-5 open
  rollStubbed(m, 'pA', [5, 2]);
  const macts = tawla.getLegalActions(m, 'pA');
  eq(macts.length, 2, 'mirror: 1 single + 1 composite');
  const mcomp = macts.find(a => Array.isArray(a.dice) && a.dice.length === 2);
  assert(mcomp && mcomp.from === 10 && mcomp.to === 3 && mcomp.via === 5, 'only the via-5 order survives');
}

// 7) 7 rejected when both paths illegal; fully-blocked roll auto-passes (no stuck turn)
console.log('7) direct-7 rejected when both paths illegal');
{
  const s = craftState({ 10: 1 }, { 5: 2, 8: 2 });
  s.dice = [5, 2]; s.remainingMoves = [5, 2]; s.rolled = true; // validator test, bypass roller
  eq(tawla.getLegalActions(s, 'pA').length, 0, 'no legal actions at all');
  const before = snap(s);
  for (const bad of [{ from: 10, to: 3, dice: [5, 2] }, { from: 10, to: 3, dice: [2, 5], via: 5 }]) {
    const r = tawla.applyAction(s, 'pA', Object.assign({ type: 'move' }, bad));
    assert(r && r.error === 'هذه الحركة لا تطابق الزهر', 'illegal composite rejected');
  }
  assert(snap(s) === before, 'rejected move changes nothing (turn/state intact)');
  const t = craftState({ 10: 1 }, { 5: 2, 8: 2 });
  const res = rollStubbed(t, 'pA', [5, 2]);
  assert(res && !res.error, 'blocked roll still ok');
  assert(String(t.turn) === 'pB' && t.rolled === false, 'fully-blocked roll auto-passes, turn never stuck');
}

// 8) composite hits blots on the intermediate AND the landing point
console.log('8) composite hits mid and final blots');
{
  const s = craftState({ 10: 1 }, { 5: 1 });
  rollStubbed(s, 'pA', [5, 2]);
  const r = tawla.applyAction(s, 'pA', { type: 'move', from: 10, to: 3, dice: [5, 2], via: 5 });
  assert(r && !r.error, 'via-blot composite accepted');
  assert(s.bar.black === 1 && s.board[5].black === 0, 'mid blot hit to the bar');
  assert(s.board[3].white === 1, 'checker lands on 3');
  const t = craftState({ 10: 1 }, { 3: 1 });
  rollStubbed(t, 'pA', [5, 2]);
  const r2 = tawla.applyAction(t, 'pA', { type: 'move', from: 10, to: 3, dice: [2, 5], via: 8 });
  assert(r2 && !r2.error, 'final-blot composite accepted');
  assert(t.bar.black === 1 && t.board[3].black === 0 && t.board[3].white === 1, 'final blot hit');
}

// 9) doubles stay a 4-dice turn: one sum-8 pair + single-die play intact
console.log('9) doubles: 4 dice, one sum pair, turn stays until all consumed');
{
  const s = craftState({ 20: 1 });
  const res = rollStubbed(s, 'pA', [4, 4]);
  assert(res && !res.error, 'doubles roll ok');
  eq(s.dice, [4, 4], 'display pair stays a pair');
  eq(s.remainingMoves, [4, 4, 4, 4], 'doubles grant 4 dice');
  const acts = tawla.getLegalActions(s, 'pA');
  eq(acts.length, 2, '1 single + exactly 1 sum-8 pair');
  const comp = acts.find(a => Array.isArray(a.dice) && a.dice.length === 2);
  eq([comp.from, comp.to, comp.via], [20, 12, 16], 'sum-8 pair 20->12 via 16');
  assert(!tawla.applyAction(s, 'pA', { type: 'move', from: 20, to: 12, dice: [4, 4] }).error, 'sum-8 consumes 2 dice');
  eq(s.remainingMoves, [4, 4], '2 dice remain');
  assert(String(s.turn) === 'pA' && s.rolled === true, 'turn stays with dice remaining');
  assert(!tawla.applyAction(s, 'pA', { type: 'move', from: 12, to: 8, die: 4 }).error, 'single 1');
  assert(!tawla.applyAction(s, 'pA', { type: 'move', from: 8, to: 4, die: 4 }).error, 'single 2');
  eq(s.remainingMoves, [], 'all 4 dice consumed');
  assert(String(s.turn) === 'pB', 'turn passes after the 4th die');
}

// 10) bar entry, blocks, and bearing-off intact (incl. off-board composite leg)
console.log('10) bar/block/bear-off rules intact');
{
  const s = craftState({}, {}, { white: 1 });
  rollStubbed(s, 'pA', [3, 1]);
  const acts = tawla.getLegalActions(s, 'pA');
  eq(acts.length, 4, '2 bar singles + 2 bar composite orders');
  assert(acts.every(a => a.from === 'bar'), 'everything plays from the bar');
  const blocked = craftState({}, { 21: 2 }, { white: 1 });
  rollStubbed(blocked, 'pA', [3, 1]);
  eq(tawla.getLegalActions(blocked, 'pA').length, 2, 'blocked entry leaves 1 single + 1 composite');
  assert(!tawla.applyAction(blocked, 'pA', { type: 'move', from: 'bar', to: 20, dice: [1, 3] }).error, 'bar composite accepted');
  assert(blocked.bar.white === 0 && blocked.board[20].white === 1, 'bar checker enters via composite');

  const b = craftState({ 1: 1, 3: 1 });
  rollStubbed(b, 'pA', [2, 1]);
  const bacts = tawla.getLegalActions(b, 'pA');
  eq(bacts.length, 6, '4 singles + 2 composites (overshoot leg correctly rejected)');
  assert(bacts.some(a => a.from === 1 && a.to === 'home' && a.die === 2), 'exact bear-off single offered');
  assert(!tawla.applyAction(b, 'pA', { type: 'move', from: 1, to: 'home', die: 2 }).error, 'bear-off accepted');
  assert(b.home.white === 1 && sorted(b.remainingMoves).join() === '1', 'bear-off consumes its die');

  const c = craftState({ 4: 1 });
  rollStubbed(c, 'pA', [2, 5]);
  const cacts = tawla.getLegalActions(c, 'pA');
  eq(cacts.length, 3, '2 singles + off-board composite leg');
  assert(cacts.some(a => a.from === 4 && a.to === 'home' && a.via === 2), 'composite bears off via 2');
  assert(!tawla.applyAction(c, 'pA', { type: 'move', from: 4, to: 'home', dice: [2, 5], via: 2 }).error, 'off-board composite accepted');
  assert(c.home.white === 1 && c.remainingMoves.length === 0, 'off-board composite consumes both dice');
}

// 11) sound layer: exactly one sound per state transition, repeats stay silent
console.log('11) one sound per event, never duplicated');
{
  const t = (g, p, n, want, msg) => eq(soundEventsFor(g, p, n), want, msg);
  t('domino', { chain: [{ a: 1, b: 2 }], stockCount: 5 }, { chain: [{ a: 1, b: 2 }, { a: 2, b: 3 }], stockCount: 5 }, ['place'], 'domino placement knocks');
  t('domino', { chain: [{ a: 1, b: 2 }], stockCount: 5 }, { chain: [{ a: 1, b: 2 }], stockCount: 4 }, ['draw'], 'domino draw blips');
  t('domino', { chain: [{ a: 1, b: 2 }], stockCount: 4 }, { chain: [{ a: 1, b: 2 }], stockCount: 4 }, [], 'domino re-render silent');
  t('tawla', { rolled: false, moveCount: 0, bar: {}, opening: { rolls: {} } },
             { rolled: true, moveCount: 0, bar: {}, opening: { rolls: {} } }, ['dice'], 'roll rattles dice');
  t('tawla', { rolled: false, moveCount: 0, bar: {}, opening: { rolls: {} } },
             { rolled: true, moveCount: 0, bar: {}, opening: { rolls: {} } }, ['dice'], 'other side hears the same roll');
  t('tawla', { rolled: true, moveCount: 2, bar: { white: 0, black: 0 } },
             { rolled: true, moveCount: 3, bar: { white: 0, black: 0 } }, ['stone'], 'stone knocks for local and remote moves');
  t('tawla', { rolled: true, moveCount: 2, bar: { white: 0, black: 0 } },
             { rolled: true, moveCount: 3, bar: { white: 1, black: 0 } }, ['stone', 'hit'], 'hit move knocks then thuds');
  t('tawla', { rolled: false, moveCount: 0, bar: {}, opening: { rolls: {} } },
             { rolled: false, moveCount: 0, bar: {}, opening: { rolls: { pA: [3, 4] } } }, ['dice'], 'opening roll rattles');
  t('tawla', { rolled: true, moveCount: 1 }, { rolled: false, moveCount: 1 }, [], 'turn pass stays silent');
  t('tawla', { rolled: true, moveCount: 3, bar: { white: 1, black: 0 } },
             { rolled: true, moveCount: 3, bar: { white: 1, black: 0 } }, [], 'socket echo of same snapshot silent');
  {
    // A full turn rendered twice per snapshot (POST response + socket echo)
    // still sounds every event exactly once: identity is the state
    // transition itself, not a flag.
    const seq = [
      { rolled: false, moveCount: 0, bar: { white: 0, black: 0 }, opening: { rolls: {} } },
      { rolled: true, moveCount: 0, bar: { white: 0, black: 0 }, opening: { rolls: {} } },
      { rolled: true, moveCount: 1, bar: { white: 0, black: 0 }, opening: { rolls: {} } },
      { rolled: true, moveCount: 2, bar: { white: 1, black: 0 }, opening: { rolls: {} } },
      { rolled: false, moveCount: 2, bar: { white: 1, black: 0 }, opening: { rolls: {} } },
      { rolled: true, moveCount: 2, bar: { white: 1, black: 0 }, opening: { rolls: {} } },
    ];
    let prev = null;
    const heard = [];
    for (const s of seq) {
      heard.push(...soundEventsFor('tawla', prev, s));
      heard.push(...soundEventsFor('tawla', s, s));
      prev = s;
    }
    eq(heard, ['dice', 'stone', 'stone', 'hit', 'dice'], 'full turn sounds once per event across POST+echo renders');
  }
  {
    // Single-source audit: the live tawla/chess/domino/cards runtimes hold
    // no audio of their own, so no event can sound twice.
    const twin = fs.readFileSync('kahwa-tawla-v2.js', 'utf8');
    assert(!twin.includes('tone') && !twin.includes('moveSound') && !twin.includes('diceSound'), 'tawla twin fully silent');
    for (const f of ['kahwa-chess-canva.js', 'kahwa-domino-ui.js', 'kahwa-cards-canva.js']) {
      const s = fs.readFileSync(f, 'utf8');
      assert(!s.includes('AudioContext') && !s.includes('Oscillator') && !s.includes('new Audio'), f + ' holds no audio (layer is the only source)');
    }
    const layer = fs.readFileSync('kahwa-sound-layer.js', 'utf8');
    assert(layer.includes('.catch('), 'layer catches audio/autoplay failures so games never break');
  }
  t('chess', { moveCount: 5, moveHistory: [] }, { moveCount: 6, moveHistory: [{ captured: null }] }, ['move'], 'chess move clicks');
  t('chess', { moveCount: 5, moveHistory: [] }, { moveCount: 6, moveHistory: [{ captured: 'p' }] }, ['capture'], 'chess capture thuds');
  t('chess', { moveCount: 6, moveHistory: [{ captured: 'p' }] }, { moveCount: 6, moveHistory: [{ captured: 'p' }] }, [], 'chess echo silent');
  t('cards', { melds: [], discardCount: 2, stockCount: 10 }, { melds: [{}], discardCount: 2, stockCount: 10 }, ['meld'], 'cards meld chimes');
  t('cards', { melds: [], discardCount: 2, stockCount: 10 }, { melds: [], discardCount: 3, stockCount: 10 }, ['discard'], 'cards discard blips');
  t('cards', { melds: [], discardCount: 2, stockCount: 10 }, { melds: [], discardCount: 2, stockCount: 9 }, ['draw'], 'cards draw blips');
  t('cards', { melds: [], discardCount: 2, stockCount: 9 }, { melds: [], discardCount: 2, stockCount: 9 }, [], 'cards echo silent');
  for (const g of ['domino', 'tawla', 'chess', 'cards']) t(g, null, {}, [], g + ' first paint silent');
  t('tawla', {}, null, [], 'missing snapshot never throws');
  t('unknown', {}, {}, [], 'unknown game silent');
}

// 12) no artificial send-delaying timers anywhere in the game frontends
console.log('12) no artificial delays in the move path');
{
  const timers = src => (src.match(/setTimeout|setInterval/g) || []).length;
  const twin = fs.readFileSync('kahwa-tawla-v2.js', 'utf8');
  eq(timers(twin), 0, 'tawla twin has no timers at all');
  const layer = fs.readFileSync('kahwa-sound-layer.js', 'utf8');
  eq(timers(layer), 0, 'sound layer plays instantly, no timers');
  assert(!layer.includes('requestAnimationFrame'), 'sound layer has no animation-frame deferral');
  eq(timers(fs.readFileSync('kahwa-chess-canva.js', 'utf8')), 0, 'chess has no timers');
  const domSrc = fs.readFileSync('kahwa-domino-ui.js', 'utf8');
  eq(timers(domSrc), 1, 'domino keeps exactly one timer');
  const domLine = domSrc.split('\n').find(l => l.includes('setTimeout'));
  assert(domLine.includes('/start') && !domLine.includes('/action'), 'domino timer is post-game rematch only, never a move delay');
  const cardSrc = fs.readFileSync('kahwa-cards-canva.js', 'utf8');
  eq(timers(cardSrc), 1, 'cards keeps exactly one timer');
  assert(cardSrc.split('\n').find(l => l.includes('setTimeout')).includes("classList.remove('show')"), 'cards timer is toast fade only (display)');
}

// 13) spectator mirror: engine-public fields (dice/turn/chain) flattened for every game
console.log('13) engine-public mirror exposes dice and turn state');
{
  const s = craftState({ 10: 1 });
  rollStubbed(s, 'pA', [5, 2]);
  const flat = flattenPublicEngine('tawla', s);
  eq(flat.dice, [5, 2], 'spectators see the same dice');
  eq(sorted(flat.remainingMoves), [2, 5], 'spectators see remaining dice');
  assert(flat.rolled === true && flat.engineTurn === 'pA', 'spectators see rolled/turn');
  assert(!('engine' in flat) && !('version' in flat) && !('createdAt' in flat), 'envelope keys excluded');
  const cf = flattenPublicEngine('chess', chess.createGame({ playerIds: ['w', 'b'] }));
  assert(cf.engineTurn === 'white' && Array.isArray(cf.moveHistory), 'chess engineTurn mirrored');
  const df = flattenPublicEngine('domino', domino.createGame({ playerIds: ['p0', 'p1'] }));
  assert(Array.isArray(df.chain) && typeof df.stockCount === 'number', 'domino chain/stock mirrored');
  const kf = flattenPublicEngine('cards', cards.createGame({ playerIds: ['p0', 'p1'] }));
  assert(typeof kf.stockCount === 'number' && typeof kf.discardCount === 'number' && Array.isArray(kf.melds), 'cards stock/discard/melds mirrored');
}

assert(crypto.randomInt === realRandomInt, 'crypto stub never leaks');
console.log('ALL TAWLA DICE CONTRACT TESTS PASS');
