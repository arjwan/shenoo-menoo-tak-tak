const fs = require('fs');
function read(p) { return fs.readFileSync(p, 'utf8'); }
function assert(value, message) { if (!value) throw new Error('FAIL: ' + message); }

// 1. The runtime JS file is the preserved original plus EXACTLY the pinned
// move-path performance patch (instant roll send instead of the 520ms gate,
// moveId dedupe stamp, render from POST response) plus the sound-layer
// migration (twin tone/moveSound/diceSound removed; the shared sound layer
// plays dice/move/hit exactly once per state transition). Any other deviation —
// including an old or rewritten tawla UI — fails this equality.
// The preserved file itself is never modified (pinned by 1b).
const MOVE_PATH_PATCHES = [
  ["function id(x){return String(x&&x.id||x&&x._id||x||'')}",
   "function id(x){return String(x&&x.id||x&&x._id||x||'')}\nfunction moveId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,10)}"],
  ["async function act(a){if(busy)return;busy=true;try{await SocialAPI.request('/api/game-rooms/'+ctx.roomId+'/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(a)});if(a.type==='move')moveSound();drag=null;if(window.reloadKahwaRoom)await window.reloadKahwaRoom()}catch(e){notice(e.message||'تعذرت الحركة',true)}finally{busy=false}}",
   "async function act(a){if(busy)return;busy=true;try{a.moveId=a.moveId||moveId();var d=await SocialAPI.request('/api/game-rooms/'+ctx.roomId+'/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(a)});if(a.type==='move')moveSound();drag=null;if(d&&d.room&&window.kahwaApplyActionResponse)window.kahwaApplyActionResponse(d.room);else if(window.reloadKahwaRoom)await window.reloadKahwaRoom()}catch(e){notice(e.message||'تعذرت الحركة',true)}finally{busy=false}}"],
  ["setTimeout(()=>act({type:openingRoll?'opening-roll':'roll'}),520)",
   "act({type:openingRoll?'opening-roll':'roll'})"],
  ["function tone(freq,end,duration,volume,delay){try{var A=window.AudioContext||window.webkitAudioContext,a=tone.a||(tone.a=new A()),t=a.currentTime+(delay||0),o=a.createOscillator(),g=a.createGain();a.resume();o.type='triangle';o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(end,t+duration);g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(a.destination);o.start(t);o.stop(t+duration+.01)}catch(e){}}\nfunction moveSound(){tone(210,92,.09,.18,0)}\nfunction diceSound(){for(var i=0;i<5;i++)tone(150+i*17,70,.045,.09,i*.055)}\n",
   ""],
  ["if(a.type==='move')moveSound();",
   ""],
  ["if(canRoll&&!busy){diceSound();",
   "if(canRoll&&!busy){"]
];
let expectedRuntime = read('original-assets/tawla/kahwa-tawla-v2.js');
for (const [from, to] of MOVE_PATH_PATCHES) {
  const hits = expectedRuntime.split(from).length - 1;
  assert(hits === 1, 'patch anchor must occur exactly once in preserved original: ' + from.slice(0, 60));
  expectedRuntime = expectedRuntime.replace(from, to);
}
assert(
  read('kahwa-tawla-v2.js') === expectedRuntime,
  'kahwa-tawla-v2.js must be the preserved original + exactly the pinned move-path patch'
);

// 1b. The preserved original is untouched: it still carries the pre-fix line.
assert(
  read('original-assets/tawla/kahwa-tawla-v2.js').includes("setTimeout(()=>act({type:openingRoll?'opening-roll':'roll'}),520)"),
  'preserved original must keep its 520ms line (only the runtime twin is patched)'
);

// 2. The two runtime stylesheets reconstruct the preserved original CSS
// byte-for-byte (root tawla-fast-2d.css = original lines 1-455,
// root tawla-canva-exact.css = original lines 456-471).
assert(
  read('tawla-fast-2d.css') + read('tawla-canva-exact.css') ===
    read('original-assets/tawla/tawla-fast-2d.css'),
  'tawla-fast-2d.css + tawla-canva-exact.css must equal the preserved original CSS exactly'
);

// 3. game-room.html loads the original runtime files, and no other tawla UI.
const html = read('game-room.html');
assert(html.includes('kahwa-tawla-v2.js'), 'game-room.html loads kahwa-tawla-v2.js');
assert(html.includes('tawla-fast-2d.css'), 'game-room.html loads tawla-fast-2d.css');
assert(html.includes('tawla-canva-exact.css'), 'game-room.html loads tawla-canva-exact.css');
const tawlaScripts = (html.match(/<script[^>]*src="([^"?]+)/gi) || [])
  .map(s => s.split('src="')[1].toLowerCase()).filter(s => s.includes('tawla'));
assert(
  tawlaScripts.length === 1 && tawlaScripts[0].includes('kahwa-tawla-v2.js'),
  'exactly one tawla script may load: kahwa-tawla-v2.js (found: ' + tawlaScripts.join(',') + ')'
);

// 4. The router mounts the original UI object for tawla rooms.
assert(
  /tawla:\s*window\.kahwaTawlaUI/.test(read('kahwa-game-ui.js')),
  'kahwa-game-ui.js must map tawla to window.kahwaTawlaUI'
);

// 5. The mounted structure is the original Canva surface: header, match grid,
// board with 24 points (12 top + 12 bottom), dice zone, bars, homes, notice.
const js = read('kahwa-tawla-v2.js');
for (const s of ['canva-tawla-app', 'canva-game-grid', 'canva-board-frame', 'tawla-board',
  'data-point', 'tawla-dice-zone', 'dice-pair', 'tawla-die', 'data-bar', 'data-home',
  'tawla-notice', 'canva-side-panel']) {
  assert(js.includes(s), 'original structure embeds ' + s);
}
assert(js.includes('for(var i=12;i<24;i++)'), 'renders top 12 points (12..23)');
assert(js.includes('for(var j=11;j>=0;j--)'), 'renders bottom 12 points (11..0)');

// 6. Engine wiring: every move/start goes to the real server engine; the file
// exposes the mount/render interface and contains no local-simulation markers.
assert(js.includes('/api/game-rooms/') && js.includes('/action'), 'moves POST to real engine /action');
assert(js.includes('/start'), 'auto-start POSTs to real engine /start');
assert(
  /window\.kahwaTawlaUI=\{mount:render,render:render,bindActions:/.test(js),
  'exposes window.kahwaTawlaUI mount/render/bindActions interface'
);
// Math.random is allowed ONLY inside the moveId() dedupe-stamp helper (dice and
// all game state still come from the server engine, never from local randoms).
const jsNoMoveId = js.replace(/function moveId\(\)\{[^}]*\}/, '');
assert(/function moveId\(\)\{[^}]*Math\.random[^}]*\}/.test(js), 'moveId helper present');
for (const m of ['minimax', 'aiPlay', 'Math.random', 'localStorage', 'rollDie', 'rollPair']) {
  assert(!jsNoMoveId.includes(m), 'no local-simulation marker: ' + m);
}

// 7. kahwa-games.css must not distort the original board: no .tawla-*/.canva-*
// board rules may live there (old overrides are what broke the board before).
// Only voice/chat dock positioning remains.
const games = read('kahwa-games.css');
for (const sel of ['.tawla-board', '.tawla-point', '.tawla-row', '.tawla-table', '.tawla-bar',
  '.tawla-dice', '.tawla-home', '.tawla-players', '.tawla-notice', '.tawla-main-action',
  '.tawla-die', '.tawla-drag-ghost', '.tawla-color-choice', '.canva-']) {
  assert(!games.includes(sel), 'kahwa-games.css must not override ' + sel);
}
assert(games.includes('body.tawla-active .game-voice'), 'voice dock positioning kept');
assert(games.includes('body.tawla-active .chat-popup'), 'chat dock positioning kept');

// 8. The superseded non-original layer is gone from disk and unreferenced.
assert(!fs.existsSync('kahwa-original-ui.js') && !fs.existsSync('kahwa-original-ui.css'),
  'kahwa-original-ui.* must be deleted');
assert(!html.includes('kahwa-original-ui'), 'game-room.html must not reference kahwa-original-ui');

console.log('ALL TAWLA CANVA RUNTIME TESTS PASS');
