const fs = require('fs');
function read(p) { return fs.readFileSync(p, 'utf8'); }
function assert(value, message) { if (!value) throw new Error('FAIL: ' + message); }
// Identifier-boundary match: 'toast(' must not match 'showToast(', etc.
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

const orig = read('canva-originals/cards/index.html');
const adapter = read('kahwa-cards-canva.js');
const tpl = decodeTemplate(adapter);
const body = adapterBody(adapter);

// Local-simulation identifiers, every one verified present in the preserved
// original's <script> (bot engine + local deck/state + local rendering).
const SIM_MARKERS = ['drawCard', 'playCard', 'botTurn', 'cardEl', 'renderCenter',
  'renderHand', 'renderActions', 'renderGame', 'shuffle', 'toast(', 'showScreen',
  'openModal', 'closeModal', 'startGame', 'setupRound', 'nextTurn', 'chooseSuit',
  'leaveGame', 'openRules', 'localStorage'];
for (const m of SIM_MARKERS) {
  if (m === 'localStorage') continue;
  assert(hasIdent(orig, m), 'sanity: original really contains sim marker ' + m);
}

// 1. The transplant is byte-identical original structure: the game-screen
// section plus the toast node, running exactly up to the card <template>,
// minus only the suit-modal chooser block (the engine has no wild-suit flow).
// A rewritten "look-alike" UI can never satisfy byte-identity, even if it
// copies every original class, id or data-attribute.
const gs = orig.indexOf('<section id="game-screen"');
const tmplAt = orig.indexOf('<template id="game-card-template">');
const suitAt = orig.indexOf('<div id="suit-modal"');
const toastAt = orig.indexOf('<div id="toast"');
assert(gs !== -1 && tmplAt !== -1 && suitAt !== -1 && toastAt !== -1,
  'original anchors present (game-screen/template/suit-modal/toast)');
assert(gs < suitAt && suitAt < toastAt && toastAt < tmplAt, 'original anchors in expected order');
const expected = (orig.slice(gs, suitAt) + orig.slice(toastAt, tmplAt)).replace(/\s+$/, '') + '\n';
assert(tpl === expected, 'transplant is byte-identical to the original slice (minus suit-modal)');
assert(tpl.startsWith('<section id="game-screen"'), 'transplant starts at original game-screen');
assert(tpl.length > 7000, 'transplant is the full card table, not a stub (' + tpl.length + ' chars)');

// 2. The transplant is structure-only: no template/script smuggled in, no JS
// definitions, no local-sim screens, no suit chooser.
assert(!tpl.includes('<script'), 'transplant contains no <script>');
assert(!tpl.includes('<template'), 'transplant contains no <template>');
assert(!tpl.includes('function '), 'transplant contains no function definitions');
for (const s of ['id="suit-modal"', 'id="library-screen"', 'id="setup-screen"', 'id="room-screen"']) {
  assert(!tpl.includes(s), 'transplant excludes ' + s);
}
// ...but it does contain the original table structure.
for (const s of ['game-screen', 'results-screen', 'rules-modal', 'settings-modal',
  'id="toast"', 'players-area', 'hand-area', 'event-log', 'chat-list', 'center-area',
  'action-area', 'turn-banner', 'game-title', 'simulation-badge']) {
  assert(tpl.includes(s), 'transplant keeps original structure: ' + s);
}

// 3. The preserved original is untouched: its local-sim <script> is still there
// (identity above was achieved by transplanting, not by gutting the original).
assert(orig.includes('<script'), 'original keeps its <script> block');

// 4. The adapter body (outside the transplant) wires the real engine and only
// the real engine: actions POST to /api/game-rooms/:id/action via SocialAPI,
// the file exposes the full kahwaGameUI interface, original inline handlers
// are stripped, and no sim markers remain.
assert(body.includes('/api/game-rooms/') && body.includes('/action'),
  'adapter POSTs moves to real engine /action');
assert(body.includes('SocialAPI'), 'adapter uses SocialAPI (room session/auth)');
assert(/window\.kahwaCardsCanvaUI\s*=/.test(body), 'adapter exposes window.kahwaCardsCanvaUI');
for (const m of ['mount', 'render', 'bindActions', 'setLegalActions', 'setLoading',
  'showSuccess', 'showError', 'destroy']) {
  assert(body.includes(m + ':') || new RegExp(m + '\\s*[:=]\\s*function').test(body),
    'adapter interface includes ' + m);
}
assert(body.includes('[onclick]') && body.includes('removeAttribute'),
  'adapter strips original inline handlers before wiring engine actions');
for (const m of SIM_MARKERS) {
  assert(!hasIdent(body, m), 'adapter body must not contain sim marker ' + m);
}

// 5. game-room.html mounts the original-based adapter (+ its scoped CSS) and
// no longer loads the old hand-written cards UI.
const html = read('game-room.html');
assert(html.includes('kahwa-cards-canva.js'), 'game-room.html loads kahwa-cards-canva.js');
assert(html.includes('kahwa-cards-canva.css'), 'game-room.html loads kahwa-cards-canva.css');
assert(!html.includes('kahwa-cards-ui.js'), 'game-room.html must not load old kahwa-cards-ui.js');
assert(!html.includes('kahwa-original-ui'), 'game-room.html must not reference kahwa-original-ui');

// 6. The router mounts the original-based adapter for cards rooms.
assert(/cards:\s*window\.kahwaCardsCanvaUI/.test(read('kahwa-game-ui.js')),
  'kahwa-game-ui.js must map cards to window.kahwaCardsCanvaUI');

// 7. The cards stylesheet is the original <style> mechanically scoped: every
// selector carries body.cards-active (at-rules and keyframe steps excepted),
// the original card-table selectors are present verbatim, and the rule count
// covers the full original set (32) plus scoped utility fallbacks.
const css = read('kahwa-cards-canva.css');
const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
const chunks = noComments.split('{');
for (let i = 1; i < chunks.length; i++) {
  const prev = chunks[i - 1];
  const sel = prev.includes('}') ? prev.slice(prev.lastIndexOf('}') + 1) : (i === 1 ? prev : prev);
  for (const partRaw of sel.split(/(?<!\\),/)) { // ignore escaped commas in arbitrary values
    const part = partRaw.trim();
    if (!part) continue;
    const ok = part.startsWith('@') ||
      /^(from|to|\d+%)$/.test(part) ||
      part.includes('body.cards-active');
    assert(ok, 'unscoped cards selector: ' + part.slice(0, 80));
  }
}
for (const s of ['body.cards-active #kahwa-game-stage .playing-card',
  'body.cards-active #kahwa-game-stage .felt',
  'body.cards-active #kahwa-game-stage .screen.active']) {
  assert(css.includes(s), 'scoped original selector present: ' + s);
}
assert(css.includes('@keyframes rise'), 'original keyframes transplanted');
assert((css.match(/body\.cards-active/g) || []).length >= 32, 'rule count covers the full original set');

// 8. Negative control: the old cards UI on disk lacks the original structure,
// so this test provably fails on the old UI.
assert(!read('kahwa-cards-ui.js').includes('<section id="game-screen"'),
  'negative control: old kahwa-cards-ui.js lacks the original game-screen');

console.log('ALL CARDS CANVA RUNTIME TESTS PASS');
