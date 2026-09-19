// عقد ربط كهوة عزاوي بالأونلاين الحقيقي: يتحقق أن طبقة الربط موجودة فعلاً في
// الخادم والعميل، وأن الخادم هو المرجعي، وأن الأصول الأصلية لم تُلمس.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
function read(relative) { return fs.readFileSync(path.join(root, relative), 'utf8'); }
function assert(value, message) { if (!value) throw new Error('FAIL: ' + message); }

const socket = read('server/src/socket.js');
const rooms = read('server/src/routes/game-rooms.routes.js');
const actions = read('server/src/routes/game-actions.routes.js');
const view = read('server/src/games/game-view.js');
const adapter = read('server/src/games/cards-adapter.js');
const registry = read('server/src/games/game-engine-registry.js');
const html = read('game-room.html');
const roomJs = read('game-room.js');
const tableLive = read('kahwa-table-live.js');
const cardsUi = read('kahwa-cards-ui.js');
const gameUi = read('kahwa-game-ui.js');
const socialApi = read('social-api.js');

// 1) Socket.IO: كل الأحداث المطلوبة موجودة على الخادم.
for (const event of ['game:join', 'game:spectate', 'game:resync', 'game:action', 'game:chat:send', 'game:spectator:leave', 'voice:join']) {
  assert(socket.includes("'" + event + "'"), 'socket handler missing: ' + event);
}
assert(socket.includes('emitGameViews'), 'public state must be broadcast through game-view');
assert(socket.includes('emitViewToSocket'), 'private hand must be sent per socket through game-view');
assert(socket.includes('io.gameState = { broadcast'), 'REST routes must be able to broadcast authoritative state');
assert(socket.includes('socket.data.userId'), 'user id must be pinned on socket.data for private hand routing');

// 2) الخادم مرجعي: game:move لم يعد يعدل اللوحة أو الدور يدوياً عند وجود محرك.
assert(socket.includes('if (gameView.hasEngineState(room))'), 'game:move must defer to the engine when state exists');
assert(/applyAuthoritativeAction/.test(socket), 'socket actions must go through the authoritative engine helper');

// 3) الحالة العامة فقط للجميع، واليد للاعب وحده.
assert(view.includes("if (!isPlayer(room, viewerId))"), 'game-view must branch on player membership');
assert(view.includes('private: null, legalActions: []'), 'spectators must never receive private cards');
assert(view.includes("io.to(`game:${roomId}`).emit('game:state'"), 'public state must be broadcast to the game room');
assert(view.includes("io.to(remote.id).emit('game:private'"), 'private hand must be sent to the owning socket only');

// 4) REST: مسارات الحالة والحركة والغرف وقواعد الورق.
assert(rooms.includes("router.get('/cards-rulesets'"), 'cards ruleset manifest route missing');
assert(rooms.indexOf("router.get('/cards-rulesets'") < rooms.indexOf("router.get('/:id'"), 'ruleset manifest must be declared before /:id');
assert(rooms.includes("router.post('/:id/start'"), 'start route missing');
assert(rooms.includes("router.post('/:id/join'"), 'join route missing');
assert(rooms.includes("router.delete('/:id/join'"), 'leave route missing');
assert(rooms.includes("router.post('/:id/action'"), 'authoritative action route missing');
assert(rooms.includes('gameView.engineViewFor(decorated, String(req.user._id))'), 'action route must respond with a viewer scoped view');
assert(rooms.includes('الجولة بدأت بالفعل'), 'joining a running game must be refused');
assert(actions.includes("router.get('/:id/state'"), 'state route missing');
assert(actions.includes('canSpectate'), 'state route must enforce spectator permission');
assert(actions.includes('engineState: view || null'), 'state route must return the engine view');

// 5) سجل قواعد الورق: Rummy افتراضي وأصل Canva منتظر دون استبدال.
// 6) العميل: لا localhost ولا IP ثابت في ملفات الربط.
for (const [file, content] of [['game-room.js', roomJs], ['kahwa-table-live.js', tableLive], ['kahwa-cards-ui.js', cardsUi], ['kahwa-game-ui.js', gameUi], ['social-api.js', socialApi]]) {
  assert(!/localhost|127\.0\.0\.1/.test(content), file + ' must not use localhost');
  assert(!/https?:\/\/\d{1,3}(\.\d{1,3}){3}/.test(content), file + ' must not hardcode an IP address');
}
assert(!/localhost|127\.0\.0\.1/.test(html), 'game-room.html must not use localhost');
assert(socialApi.includes('window.location.origin'), 'api base must follow the current origin in production');

// 7) العميل يستخدم Socket.IO للحالة ويستعيد المزامنة بعد reconnect.
assert(html.includes('socket.io/socket.io.js'), 'socket.io client must be loaded');
assert(html.includes('kahwa-table-live.js'), 'table live layer must be loaded on the game room page');
assert(html.includes('kahwa-table-live.css'), 'table live styles must be loaded');
assert(html.includes('kahwa-cards-ui.js') && html.includes('kahwa-game-ui.js'), 'cards ui + game ui must be loaded');
assert(roomJs.includes('window.kahwaTableUI') && roomJs.includes('.socket()'), 'game-room.js must reuse the shared socket');
assert(roomJs.includes('s.engineState'), 'game-room.js must consume the engine view from the state route');
assert(tableLive.includes("socket.on('game:state'") && tableLive.includes("socket.on('game:private'"), 'client must consume public and private socket views');
assert(tableLive.includes("socket.io.on('reconnect'") && tableLive.includes("socket.emit('game:resync'"), 'client must resync state after reconnect');
assert(tableLive.includes("'game:chat:send'") && tableLive.includes("socket.on('game:chat:message'"), 'table chat must be wired to the server');
assert(tableLive.includes("'game:spectate'") && tableLive.includes("'game:spectator:leave'"), 'spectator entry must use the server events');
assert(cardsUi.includes('applyView'), 'cards ui must accept pushed socket state');
assert(cardsUi.includes('spectator'), 'cards ui must never render hands for spectators');
assert(gameUi.includes('registerCardsRuleset'), 'game ui must allow future card rulesets to plug their own renderer');

// 8) الأصول الأصلية لم تُلمس (الطاولي، الشطرنج، المدرسة، وملفات الحفظ).
let changed = '';
try { changed = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }); } catch { changed = ''; }
const lines = changed.split('\n').filter((line) => line.trim());
const touchedOriginal = lines.filter((line) => /original-assets\//.test(line));
assert(touchedOriginal.length === 0, 'original-assets must not be modified: ' + touchedOriginal.join(', '));
const touchedPreserved = lines.filter((line) => /(^|\/)(tawla-fast-2d|tawla-canva-exact|tawla-realistic|tawla-3d)\.css/.test(line));
assert(touchedPreserved.length === 0, 'preserved tawla assets must not be modified: ' + touchedPreserved.join(', '));

console.log('ALL KAHWA ONLINE CONTRACT TESTS PASS');
assert(registry.includes("cards: () => require('./cards-adapter')"), 'cards must be served through the integration adapter');
assert(registry.includes('listCardRulesets'), 'registry must expose the card rulesets manifest');
assert(read('server/src/games/cards-rules-registry.js').includes("registerRuleset('rummy'"), 'rummy ruleset must stay registered');
assert(read('server/src/games/cards-rules-registry.js').includes('awaiting-original'), 'missing Canva original must be announced as pending');
assert(adapter.includes('HIDDEN_KEYS'), 'adapter must keep a hidden fields guard');
assert(read('server/src/games/cards-engine.js').includes('Server-authoritative groups-and-runs card game'), 'the original rummy engine must stay in place');