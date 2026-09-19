const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

function assert(value, message) {
  if (!value) throw new Error('FAIL: ' + message);
}

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

console.log('1) game-room runtime loads the original-UI integration layer');
const roomHtml = read('game-room.html');
assert(
  roomHtml.includes('kahwa-original-ui.css?v=20260919-original-link-1'),
  'game-room.html must load kahwa-original-ui.css with version query'
);
assert(
  roomHtml.includes('kahwa-original-ui.js?v=20260919-original-link-1'),
  'game-room.html must load kahwa-original-ui.js with version query'
);

console.log('2) integration layer order: CSS last, JS between game-ui and room binding');
const cssIdx = roomHtml.indexOf('kahwa-original-ui.css');
const canvaCssIdx = roomHtml.indexOf('tawla-canva-exact.css');
const dominoCssIdx = roomHtml.indexOf('kahwa-games.css');
assert(cssIdx > canvaCssIdx && cssIdx > dominoCssIdx, 'original CSS must load after live game CSS');
const jsIdx = roomHtml.indexOf('kahwa-original-ui.js');
const gameUiIdx = roomHtml.indexOf('kahwa-game-ui.js');
const roomJsIdx = roomHtml.indexOf('game-room.js?v=');
assert(jsIdx > gameUiIdx && jsIdx < roomJsIdx, 'original JS must patch kahwaGameUI before game-room binding');

console.log('3) tawla priority: original Canva build 6 surface is linked');
const css = read('kahwa-original-ui.css');
assert(css.includes('.canva-tawla-app'), 'integration CSS must carry .canva-tawla-app');
assert(css.includes('.canva-board-frame'), 'integration CSS must carry .canva-board-frame');
assert(css.includes('body.tawla-active'), 'integration CSS must scope tawla-active');
const js = read('kahwa-original-ui.js');
assert(js.includes('kahwaOriginalUI'), 'integration JS must expose kahwaOriginalUI');
assert(js.includes('canva-tawla-app'), 'integration JS must verify canva-tawla-app');
assert(js.includes('canva-build-6'), 'integration JS must tag canva-build-6');
const liveTawla = read('kahwa-tawla-v2.js');
assert(liveTawla.includes('canva-tawla-app'), 'live tawla renderer must emit the original surface');

console.log('4) chess + cards use original visual language on the real engine');
assert(css.includes('chess-original-linked'), 'integration CSS must style chess-original-linked');
assert(css.includes('--light-square') && css.includes('--dark-square'), 'chess palette must come from preserved original');
assert(css.includes('cards-original-linked'), 'integration CSS must style cards-original-linked');
assert(js.includes('chess-original-linked') && js.includes('cards-original-linked'), 'integration JS must tag chess/cards stages');
assert(js.includes('شطرنج واقعي'), 'chess original title marker must be linked');
assert(js.includes('مكتبة ألعاب الورق'), 'cards original library marker must be linked');
assert(js.includes('/api/game-rooms') && js.includes('SocialAPI'), 'integration must keep the authoritative API path');
assert(!js.includes('localroom') && !js.includes('ai-mode') && !js.includes('createRoom()'), 'integration must not introduce local simulation logic');

console.log('5) domino passthrough: not wrapped, not restyled, still live');
assert(roomHtml.includes('kahwa-domino-ui.js'), 'domino renderer must stay loaded');
assert(read('kahwa-domino-ui.js').includes('kahwaDominoUI'), 'domino renderer must stay intact');
assert(js.includes("domino") && js.includes('passthrough'), 'integration must mark domino as passthrough');
assert(!/\.domino-table[^{]*\{[^}]*display\s*:\s*none/.test(css), 'integration CSS must not hide domino');

console.log('6) preserved originals untouched and separate from integration');
const cardsOriginal = fs.readFileSync(path.join(__dirname, '..', 'canva-originals', 'cards', 'index.html'));
assert(cardsOriginal.length === 54245, 'Canva cards original byte size changed');
assert(
  crypto.createHash('sha256').update(cardsOriginal).digest('hex') ===
    'ddf7152d6ee8d2a2005cd9215dd2a73910851c267fbd29a1af54959db9657e4e',
  'Canva cards original checksum changed'
);
assert(read('original-assets/tawla/kahwa-tawla-v2.js').includes('canva-tawla-app'), 'preserved tawla original marker');
assert(read('original-assets/chess/chess-original.html').includes('شطرنج واقعي'), 'preserved chess original marker');
assert(fs.existsSync(path.join(__dirname, '..', 'original-assets', 'school', 'school.js')), 'preserved school original present');
assert(
  fs.realpathSync(path.join(__dirname, '..', 'kahwa-original-ui.js')) !==
    fs.realpathSync(path.join(__dirname, '..', 'original-assets', 'tawla', 'kahwa-tawla-v2.js')),
  'integration layer must be a separate file, not the preserved original'
);

console.log('ALL KAHWA ORIGINAL UI CONTRACT TESTS PASS');
