const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

function assert(value, message) {
  if (!value) throw new Error('FAIL: ' + message);
}

const originalPath = path.join(__dirname, '..', 'canva-originals', 'cards', 'index.html');
const original = fs.readFileSync(originalPath);
const sha256 = crypto.createHash('sha256').update(original).digest('hex');

assert(original.length === 54245, 'Canva cards original byte size changed');
assert(sha256 === 'ddf7152d6ee8d2a2005cd9215dd2a73910851c267fbd29a1af54959db9657e4e', 'Canva cards original checksum changed');

const html = original.toString('utf8');
assert(html.includes('مكتبة ألعاب الورق'), 'cards library marker');
assert(html.includes('c.rank==="8"'), 'free-eight rule marker');
assert(html.includes('suit-choice'), 'suit chooser marker');
assert(html.includes('وضع المتفرج'), 'spectator marker');

const chess = require('../server/src/games/chess-engine');
const state = chess.createGame({ playerIds: ['player-a', 'player-b'] });
state.status = 'active';
assert(state.turn === 'white', 'chess engine keeps color turn internally');
assert(chess.applyAction(state, 'player-a', { type: 'move', from: 'e2', to: 'e4' }).ok, 'authoritative chess move accepted');
assert(state.turn === 'black', 'chess engine advances color turn');

console.log('ALL KAHWA INTEGRATION CONTRACT TESTS PASS');
