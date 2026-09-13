const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('feed exposes like, comment, share and message actions', () => {
  const source = read('taktak-feed.js');
  for (const action of ['like', 'comments', 'share', 'message']) {
    assert.match(source, new RegExp(`data-action=["']${action}["']`));
  }
  assert.match(source, /p\.liked/);
});

test('post sharing has a persisted counter API', () => {
  assert.match(read('server/src/models/Post.js'), /sharesCount/);
  assert.match(read('server/src/routes/posts.routes.js'), /\/:id\/share/);
  assert.match(read('server/src/routes/post-feed.routes.js'), /sharesCount/);
});

test('home reel viewer exposes all requested actions', () => {
  const source = read('taktak-viewers.js');
  for (const action of ['like', 'comment', 'share', 'save']) {
    assert.match(source, new RegExp(`data-viewer-reel-action=["']${action}["']`));
  }
});

test('reel actions are forced visible in the light and dark interfaces', () => {
  const css = read('social-actions-fix.css');
  assert.match(css, /\.reels \.actions\{display:grid!important;visibility:visible!important/);
  assert.match(css, /\.viewer-reel-actions/);
});

test('story cards use a swipeable stacked deck', () => {
  const js = read('stories-deck.js');
  const css = read('social-actions-fix.css');
  assert.match(js, /pointerdown/);
  assert.match(js, /pointerup/);
  assert.match(css, /data-deck-position/);
});

test('communication launcher toggles and calls page remains reachable', () => {
  const source = read('communication-dock.js');
  assert.match(source, /launcher\.onclick=function\(\)\{if\(!rail\.hidden\)\{conceal\(\)/);
  assert.match(source, /href="calls\.html" data-comm-page/);
});

test('new Shno Mano messaging workspace replaces the old service grid', () => {
  const page = read('taal-nsolf.html');
  assert.match(page, /شنو منو مراسلات/);
  assert.match(page, /messages-layout/);
  for (const obsolete of ['دعوة أصدقاء', 'إضافة أصدقاء']) assert.doesNotMatch(page, new RegExp(obsolete));
});
