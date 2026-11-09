const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = filename => fs.readFileSync(path.join(root,filename), 'utf8');

test('mobile feed uses document scrolling instead of nested fixed fullscreen layer', () => {
  const css = read('taktak-layout.css');
  assert.match(css, /Mobile WebView: let the document own vertical scrolling/);
  assert.match(css, /html\.home-colors-scope \.home-grid\{\s*position:relative!important/);
  assert.match(css, /html\.home-colors-scope,html\.home-colors-scope body\{\s*height:auto!important/);
  assert.match(css, /html\.home-colors-scope \.feed\{[\s\S]*?overflow:visible!important/);
});
test('mobile chat hides unselected empty second pane despite generic viewport overrides', () => {
  const css = read('taktak-mobile-fixes.css');
  assert.match(css, /\.chat-window:has\(> \.chat-empty\)\{\s*display:none!important/);
  assert.match(css, /\.chat-shell:has\(> \.chat-window \.chat-header\) > \.conversation-list\{\s*display:none!important/);
  assert.match(css, /\.chat-shell:has\(> \.chat-window \.chat-header\) > \.chat-window\{\s*display:flex!important/);
  const html = read('messages.html');
  assert.match(html, /class="chat-window" data-chat-window/);
  assert.match(html, /class="chat-empty"/);
  assert.match(read('private-messages.js'), /class=\\"chat-header/);
});
test('contact empty state is content-sized, without changing contact actions', () => {
  const css = read('calls.css');
  assert.match(css, /\.calls-list > \.social-empty\{\s*min-height:0!important/);
  const js = read('calls.js');
  assert.match(js, /data-call-pick-contacts-dynamic/);
  assert.match(js, /await savePermanent\(\)/);
});
test('CSS stays scoped to mobile widths and does not change site theme colors', () => {
  for(const filename of ['taktak-layout.css','taktak-mobile-fixes.css','calls.css']){
    const css = read(filename);
    assert.match(css, /@media\s*\(max-width:(650|760|850)px\)/);
  }
  const page = read('taktak.html');
  assert.match(page, /taktak-layout\.css/);
  assert.match(page, /taktak-mobile-fixes\.css/);
});
