const fs = require('fs');
function read(p) { return fs.readFileSync(p, 'utf8'); }
function assert(value, message) { if (!value) throw new Error('FAIL: ' + message); }
// Identifier-boundary match: 'renderBoard' must not match 'paintBoard', etc.
function hasIdent(haystack, name) {
  return new RegExp('(?<![A-Za-z0-9_$])' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z0-9_$])').test(haystack);
}
// Decode the adapter's escaped template literal back to raw markup.
function decodeTemplate(adapterSrc) {
  const open = 'var TEMPLATE = `';
  const t0 = adapterSrc.indexOf(open);
  assert(t0 !== -1, 'adapter embeds var TEMPLATE');
  const t1 = adapterSrc.indexOf('`;', t0 + open.length);
  assert(t1 !== -1, 'adapter template literal is terminated');
  const raw = adapterSrc.slice(t0 + open.length, t1);
  return raw.replace(/\\\\|\\`|\\\$\{/g, s => (s === '\\\\' ? '\\' : s === '\\`' ? '`' : '${'));
}
function adapterBody(adapterSrc) {
  const open = 'var TEMPLATE = `';
  const t0 = adapterSrc.indexOf(open);
  const t1 = adapterSrc.indexOf('`;', t0 + open.length);
  return adapterSrc.slice(0, t0) + adapterSrc.slice(t1 + 2);
}

const orig = read('original-assets/chess/chess-original.html');
const adapter = read('kahwa-chess-canva.js');
const tpl = decodeTemplate(adapter);
const body = adapterBody(adapter);

// Local-simulation identifiers, every one verified present in the preserved
// original's <script> (minimax engine + local state + local rendering).
const SIM_MARKERS = ['minimax', 'aiPlay', 'chooseAiMove', 'boardScore', 'renderBoard',
  'renderHistory', 'renderAudience', 'openSpectators', 'closeSpectators', 'openPromotion',
  'showMessage', 'selectSquare', 'legalMoves', 'startTimer', 'runChessLogicTests',
  'simulate', 'snapshot', 'localStorage'];
for (const m of SIM_MARKERS) {
  if (m === 'localStorage') continue;
  assert(hasIdent(orig, m), 'sanity: original really contains sim marker ' + m);
}

// 1. The transplant is byte-identical original structure: it starts at the
// original's <div class="app-shell"> and runs exactly up to its <script> block.
// A rewritten "look-alike" UI can never satisfy byte-identity, even if it
// copies every original class, id or data-attribute.
const shellAt = orig.indexOf('<div class="app-shell">');
assert(shellAt !== -1, 'original contains <div class="app-shell">');
assert(tpl.startsWith('<div class="app-shell">'), 'transplant starts at original app-shell');
const scriptAt = orig.indexOf('<script', shellAt);
assert(scriptAt !== -1, 'original has a <script> after app-shell');
const expected = orig.slice(shellAt, scriptAt).replace(/\s+$/, '') + '\n';
assert(tpl === expected, 'transplant is byte-identical to the original app-shell slice');
assert(tpl.length > 10000, 'transplant is the full board surface, not a stub (' + tpl.length + ' chars)');

// 2. The transplant is structure-only: no script, no JS definitions, none of
// the local-simulation identifiers, no inline handlers.
assert(!tpl.includes('<script'), 'transplant contains no <script>');
assert(!tpl.includes('function '), 'transplant contains no function definitions');
assert(!tpl.includes('onclick'), 'transplant contains no inline handlers');
for (const m of SIM_MARKERS) {
  assert(!hasIdent(tpl, m), 'transplant must not contain sim marker ' + m);
}
// ...but it does contain the original surface structure.
for (const s of ['app-shell', 'board', 'history-panel', 'promotion', 'audience', 'clock']) {
  assert(tpl.includes(s), 'transplant keeps original structure: ' + s);
}

// 3. The preserved original is untouched: its local-sim <script> is still there
// (identity above was achieved by transplanting, not by gutting the original).
assert(orig.includes('<script'), 'original keeps its <script> block');

// 4. The adapter body (outside the transplant) wires the real engine and only
// the real engine: actions POST to /api/game-rooms/:id/action via SocialAPI,
// and the file exposes the full kahwaGameUI interface. No sim markers.
assert(body.includes('/api/game-rooms/') && body.includes('/action'),
  'adapter POSTs moves to real engine /action');
assert(body.includes('SocialAPI'), 'adapter uses SocialAPI (room session/auth)');
assert(/window\.kahwaChessCanvaUI\s*=/.test(body), 'adapter exposes window.kahwaChessCanvaUI');
for (const m of ['mount', 'render', 'bindActions', 'setLegalActions', 'setLoading',
  'showSuccess', 'showError', 'destroy']) {
  assert(body.includes(m + ':') || body.includes(m + ' :') || new RegExp(m + '\\s*[:=]\\s*function').test(body),
    'adapter interface includes ' + m);
}
for (const m of SIM_MARKERS) {
  assert(!hasIdent(body, m), 'adapter body must not contain sim marker ' + m);
}

// 5. game-room.html mounts the original-based adapter (+ its scoped CSS) and
// no longer loads the old hand-written chess UI.
const html = read('game-room.html');
assert(html.includes('kahwa-chess-canva.js'), 'game-room.html loads kahwa-chess-canva.js');
assert(html.includes('kahwa-chess-canva.css'), 'game-room.html loads kahwa-chess-canva.css');
assert(!html.includes('kahwa-chess-ui.js'), 'game-room.html must not load old kahwa-chess-ui.js');
assert(!html.includes('kahwa-original-ui'), 'game-room.html must not reference kahwa-original-ui');

// 6. The router mounts the original-based adapter for chess rooms.
assert(/chess:\s*window\.kahwaChessCanvaUI/.test(read('kahwa-game-ui.js')),
  'kahwa-game-ui.js must map chess to window.kahwaChessCanvaUI');

// 7. The chess stylesheet is the original <style> mechanically scoped: every
// selector carries body.chess-active (at-rules and keyframe steps excepted),
// the original board selectors are present verbatim, and the rule count
// covers the full original set (59) plus scoped utility fallbacks.
const css = read('kahwa-chess-canva.css');
const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
const chunks = noComments.split('{');
for (let i = 1; i < chunks.length; i++) {
  const sel = chunks[i - 1].includes('}')
    ? chunks[i - 1].slice(chunks[i - 1].lastIndexOf('}') + 1)
    : (i === 1 ? chunks[0] : chunks[i - 1]);
  for (const partRaw of sel.split(/(?<!\\),/)) { // ignore escaped commas in arbitrary values
    const part = partRaw.trim();
    if (!part) continue;
    const ok = part.startsWith('@') ||
      /^(from|to|\d+%)$/.test(part) ||
      part.includes('body.chess-active');
    assert(ok, 'unscoped chess selector: ' + part.slice(0, 80));
  }
}
for (const s of ['body.chess-active #kahwa-game-stage .app-shell',
  'body.chess-active #kahwa-game-stage .board',
  'body.chess-active #kahwa-game-stage .paper']) {
  assert(css.includes(s), 'scoped original selector present: ' + s);
}
assert(css.includes('--gold') && css.includes('#efc96f'), 'original :root palette transplanted');
assert((css.match(/body\.chess-active/g) || []).length >= 59, 'rule count covers the full original set');

// 8. Negative control: the old chess UI on disk lacks the original structure,
// so this test provably fails on the old UI.
assert(!read('kahwa-chess-ui.js').includes('app-shell'),
  'negative control: old kahwa-chess-ui.js lacks the original app-shell');

console.log('ALL CHESS CANVA RUNTIME TESTS PASS');
