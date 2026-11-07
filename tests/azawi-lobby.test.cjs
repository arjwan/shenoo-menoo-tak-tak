const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('game-room.html', 'utf8');
const js = fs.readFileSync('game-room.js', 'utf8');
const ambient = fs.readFileSync('azawi-ambient.js', 'utf8');
test('Azawi client scripts parse', () => { new vm.Script(js); new vm.Script(ambient); });
test('All four games support selection and opening a table', () => {
  for (const game of ['domino','tawla','cards','chess']) {
    assert.ok(html.includes('data-open-game="'+game+'"'));
    assert.ok(html.includes('data-game="'+game+'"'));
    assert.ok(html.includes('value="'+game+'"'));
  }
  assert.ok(js.includes("$('#createModal').hidden=false"));
  assert.ok(js.includes('/api/game-rooms'));
});
test('Same-host websocket and visible lobby errors', () => {
  assert.ok(html.includes('src="/socket.io/socket.io.js"'));
  assert.ok(!html.includes('shino-mino-tak-tak.duckdns.org'));
  assert.ok(js.includes('تعذر تحميل الطاولات'));
  assert.ok(js.includes('Array.isArray(d.rooms)'));
});
test('Ambient audio is opt-in, quiet, and stoppable', () => {
  assert.ok(html.includes('azawiAmbientToggle'));
  assert.ok(html.includes('azawiAmbientStop'));
  assert.ok(ambient.includes('audio.volume=.12'));
  assert.ok(ambient.includes('audio.pause()'));
  assert.ok(!ambient.includes('autoplay'));
});
