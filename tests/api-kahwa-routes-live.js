// تحقق حقيقي من جدول مسارات Express المستخدم في الإنتاج (بدون قاعدة بيانات):
// يبني تطبيق express فعلياً من نفس الراوترات، ويفحص ترتيب المسارات، وينفّذ
// معالج manifest قواعد الورق الحقيقي.
const express = require('express');
const rooms = require('../server/src/routes/game-rooms.routes');
const actions = require('../server/src/routes/game-actions.routes');

function assert(value, message) { if (!value) throw new Error('FAIL: ' + message); }

const app = express();
app.use(express.json());
app.use('/api/game-rooms', rooms.router);
app.use('/api/game-actions', actions);

function collect(prefix, layers, out) {
  for (const layer of layers) {
    if (layer.route) {
      out.push({ path: prefix + layer.route.path, methods: Object.keys(layer.route.methods), handle: layer.route.stack[0].handle });
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      collect(prefix, layer.handle.stack, out);
    }
  }
  return out;
}
const stack = (app.router && app.router.stack) || app._router.stack;
const routes = collect('', stack, []);
const paths = routes.map((r) => r.methods[0].toUpperCase() + ' ' + r.path);

// 1) المسارات الأساسية للغرف موجودة فعلاً في التطبيق الحقيقي.
for (const expected of [
  'POST /api/game-rooms', 'GET /api/game-rooms',
  'POST /api/game-rooms/:id/join', 'DELETE /api/game-rooms/:id/join',
  'POST /api/game-rooms/:id/start', 'DELETE /api/game-rooms/:id',
  'POST /api/game-rooms/:id/action', 'GET /api/game-rooms/:id',
  'GET /api/game-rooms/cards-rulesets',
  'GET /api/game-actions/:id/state'
]) {
  assert(paths.includes(expected), 'missing route: ' + expected + ' | got: ' + paths.join(' , '));
}

// 2) مسار قواعد الورق مُسجَّل قبل /:id حتى لا يُقرأ كمعرّف غرفة.
const rulesetIndex = paths.indexOf('GET /api/game-rooms/cards-rulesets');
const byIdIndex = paths.indexOf('GET /api/game-rooms/:id');
assert(rulesetIndex > -1 && byIdIndex > -1, 'both routes must exist');
assert(rulesetIndex < byIdIndex, 'cards-rulesets must be registered before /:id');

// 3) معالج manifest الحقيقي يعيد Rummy متاحاً وأصل Canva كمنتظر.
const rulesetRoute = routes.find((r) => r.methods[0] === 'get' && r.path === '/api/game-rooms/cards-rulesets');
let manifest = null;
rulesetRoute.handle({ user: { _id: 'probe' } }, { json: (payload) => { manifest = payload; }, status: () => ({ json: (payload) => { manifest = payload; } }) });
assert(manifest && manifest.ok === true, 'manifest handler must answer ok');
assert(manifest.serverAuthoritative === true, 'manifest must declare server authoritative play');
assert(manifest.privateHands === 'server-only', 'manifest must declare private hands are server only');
assert(manifest.defaultRulesetId === 'rummy', 'default ruleset must be the preserved rummy engine');
assert(manifest.rulesets.some((r) => r.id === 'rummy'), 'rummy must be listed as available');
const pending = manifest.pendingOriginals.find((r) => r.id === 'canva-cards');
assert(pending && pending.status === 'awaiting-original', 'the Canva original must be listed as awaiting upload');

console.log('ALL KAHWA ROUTE TABLE TESTS PASS');