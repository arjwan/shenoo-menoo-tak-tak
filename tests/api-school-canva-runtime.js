/* School Canva original — runtime wiring contract (Kahwa-style).
 * Plain assert, no frameworks, runs in `npm run test:kahwa` after the game
 * contracts. Verifies the external adapter binds the immutable Canva
 * original to the real /api/school REST + authenticated Socket.IO classroom
 * without touching the original or the existing school page.
 */
const fs = require('fs');
const crypto = require('crypto');
function read(p) { return fs.readFileSync(p, 'utf8'); }
function sha(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }
function assert(value, message) { if (!value) throw new Error('FAIL: ' + message); }
function hasIdent(haystack, name) {
  return new RegExp('(?<![A-Za-z0-9_$])' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z0-9_$])').test(haystack);
}

const ORIGINAL_SHA = '0c8b92caace910cc272f98d921ee4a736c2c87cf84d8fe75324361d3d24e6857';

const orig = read('original-assets/school-canva/school-canva-original.html');
const adapter = read('school-canva-adapter.js');
const core = read('school-canva-adapter-core.js');
const loader = read('school-canva.html');
const serverSrc = read('server/src/server.js');
const canvaRoutes = read('server/src/routes/school-canva.routes.js');
const socketSchool = read('server/src/socket-school.js');
const recordLib = read('server/src/lib/school-canva-record.js');
const registry = read('server/src/services/school-classroom.js');
const oldSchoolHtml = read('school.html');

// 1) The immutable original keeps its approved fingerprint.
assert(sha('original-assets/school-canva/school-canva-original.html') === ORIGINAL_SHA,
  'original-assets/school-canva/school-canva-original.html SHA-256 changed');

// 2) The original's integration surface is exactly what the adapter drives.
const HOOKS = ['configureIntegration', 'ExternalAdapter', 'handleSignal', 'joinVirtualClass',
  'leaveVirtualClass', 'startAudioSession', 'startVideoSession', 'stopMediaSession',
  'sendEvent', 'joinRoom', 'leaveRoom', 'iceCandidate', 'requestMedia'];
for (const h of HOOKS) assert(hasIdent(orig, h) || orig.includes(h), 'sanity: original exposes ' + h);
// The original's own media gate must stay intact (consent before getUserMedia).
assert(/consent\s*!==\s*"موافق عليه"\)\s*throw new Error\("تحتاج إلى موافقة ولي الأمر أولاً"/.test(orig),
  'original consent gate before getUserMedia must remain');
// Its sync endpoint and idempotency header must remain what the server serves.
assert(orig.includes('"operations"') && orig.includes('Idempotency-Key'),
  'original sync uses /operations with Idempotency-Key');
// Demo fallback must remain (localStorage + IndexedDB queue + dataSdk path).
assert(orig.includes('shno-mno-integrated-v10') && orig.includes('shno-mno-integration') &&
  orig.includes('dataSdk') && orig.includes('navigator.onLine'),
  'original demo/offline fallback (localStorage + IndexedDB + online handlers) intact');
// The original never sends auth itself — the adapter must add it.
assert(!/Authorization/.test(orig), 'original must stay auth-free (adapter adds Bearer)');

// 3) Loader: auth first, then config -> original -> socket.io -> core -> adapter.
assert(/auth-guard\.js/.test(loader), 'loader keeps the existing auth guard');
const order = (s) => loader.indexOf(s);
assert(order('/api/school/classroom/config') > order('auth-guard.js'), 'config after auth');
assert(order('/api/school-canva/original') > order('/api/school/classroom/config'), 'original after config');
assert(order('/socket.io/socket.io.js') < order('school-canva-adapter-core.js'), 'socket.io client before core');
assert(order('school-canva-adapter-core.js') < order('school-canva-adapter.js'), 'core before adapter');
assert(order('school-canva-adapter.js') > order('frame.srcdoc = html'), 'adapter injected into the original document');
assert(!/token=/.test(loader) && !/token=/.test(adapter), 'JWT never travels in a URL');

// 4) Adapter: binds the original's surface to the real platform.
assert(hasIdent(adapter, 'configureIntegration'), 'adapter calls the original configureIntegration hook');
assert(adapter.includes("auth: { token: token() }") || /auth:\s*\{\s*token:\s*token\(\)\s*\}/.test(adapter),
  'JWT delivered through Socket.IO handshake auth only');
assert(!/navigator\.mediaDevices\.getUserMedia/.test(adapter),
  'adapter never requests camera/mic itself (original buttons + consent gate only)');
assert(!/new WebSocket\(/.test(adapter), 'adapter never opens raw WebSockets');
assert(adapter.includes('shno-school://'), 'only the marker websocket URL is bridged to Socket.IO');
// Real endpoints used by the adapter (request/response transformation layer).
for (const ep of ['/api/school/teachers', '/api/school/students', '/api/school/sessions/active',
  '/api/school/schedules', '/api/school/ai/status', '/api/school/teacher/ask']) {
  assert(adapter.includes(ep), 'adapter uses real endpoint ' + ep);
}
// Adapter rewrites queue records to the guardian's real student (external
// transformation; original bytes untouched).
assert(/record\.student_name\s*=\s*realStudent\.name/.test(adapter), 'adapter maps demo student to the real guardian student');
// Media starts only through the original's own consent-gated functions.
assert(hasIdent(adapter, 'startAudioSession') && hasIdent(adapter, 'startVideoSession') &&
  hasIdent(adapter, 'joinVirtualClass'), 'adapter drives the original media/classroom API');
// No auto-start: media functions appear only inside click handlers.
const clickCount = (adapter.match(/addEventListener\('click'/g) || []).length;
assert(clickCount >= 3, 'classroom UI is button-driven (no automatic media start)');

// 4b) View wiring: every Canva page is fed with the real account data.
assert(adapter.includes('/api/school/curriculum/offline-pack'),
  'adapter uses the real curriculum offline-pack (board + library + exam key)');
assert(adapter.includes('/api/school/curriculum/catalog'),
  'adapter loads the versioned Iraqi curriculum catalogue');
assert(adapter.includes('/api/school/curriculum/files'),
  'adapter loads the verified 136-file Iraqi curriculum manifest');
assert(adapter.includes('فتح وقراءة PDF'),
  'adapter renders a direct PDF reader link for each published book');
// Library contract: catalogue is the primary source (joined to the manifest by
// real ids in core.packLibrary), independent of the guardian's students;
// offline-pack keeps feeding board/exam only; a reader link exists only for a
// real manifest url; no demo rows survive once real books exist.
assert(adapter.includes("get('/api/school/curriculum/catalog').catch") && adapter.includes("get('/api/school/curriculum/files')"),
  'hydrate fetches catalogue + manifest in parallel with the other school GETs');
assert(/var librarySource = catalogItems\.length\s*\?\s*catalogItems\.concat/.test(adapter),
  'library source is the full catalogue first, never the offline-pack');
assert(adapter.includes('core.packLibrary(librarySource, realCurriculumFiles)'),
  'library rows are the catalogue joined to the real PDF manifest');
assert(adapter.includes('core.packLibrary(catalogItems, manifestFiles)'),
  'data bridge (updated export) builds curriculum records from catalogue ⋈ manifest');
assert(adapter.includes('if (row.readable && row.url) {') && adapter.includes("link.setAttribute('data-curriculum-pdf', '1')"),
  'reader link only for a book joined to a real manifest url');
assert(adapter.includes("card.setAttribute('data-availability', row.readable ? 'available' : 'source_pending')"),
  'source_pending rows are marked and stay without a reader link');
assert(adapter.includes('/محتوى تجريبي/.test'), 'demo placeholders are dropped once real books exist');
assert(adapter.includes('lessonCount: downloaded.length'), 'home lesson count = real verified lessons, not catalogue rows');
assert(/wrapRender\('renderLibrary', patchCurriculumFiles\)/.test(adapter),
  'library patch re-applied after every original renderLibrary (both exports)');
assert(adapter.includes('/api/school/students/'), 'adapter fetches the real per-student report');
for (const fn of ['populatePath', 'renderTeachers', 'renderConsent', 'renderReport', 'renderLibrary', 'renderQueue']) {
  assert(adapter.includes(fn), 'adapter drives the original render function ' + fn);
}
for (const fn of ['renderTeachers', 'selectTeacher', 'renderReport', 'renderConsent']) {
  assert(new RegExp("wrapRender\\('" + fn + "'").test(adapter),
    'adapter re-applies its ' + fn + ' DOM patch after every original render');
}
assert(adapter.includes('statistics-title') && adapter.includes('data-template-id="app-tagline"'),
  'home statistics + tagline are patched to the real account (DOM only)');
assert(adapter.includes('data-template-id="students-title"'), 'class seats show the real student + live participants');
assert(adapter.includes('shno-past-scores'), 'exam view lists the real recorded scores');
assert(adapter.includes('realExamKeys'), 'exam review shows the real model answer from the curriculum');
assert(adapter.includes('shno-report-real'), 'report view shows the real platform activity log');
assert(adapter.includes('state.consents = core.mapConsents'), 'real learningPermissions drive the original consent gate');
assert(adapter.includes('state.teacherId = p.teacherId'), 'learning path preselected from the real student');
assert(adapter.includes('stages[p.stage].push') || adapter.includes("stages[p.stage].push(p.grade)"),
  'real student grade registered in the original stage lists when missing');
assert(adapter.includes("lessons[sub] = core.packLesson"), 'board/exam content replaced by the real curriculum per subject');
assert(adapter.includes('state.library = rows.concat(local)'), 'library catalog = real curriculum + local files');
const C2 = require('../school-canva-adapter-core.js');
for (const fn of ['pickPackItem', 'packLesson', 'packLibrary', 'homeStats', 'formatCount',
  'studentPath', 'reportPatches', 'consentLogText', 'seatCards']) {
  assert(typeof C2[fn] === 'function', 'core exports the view mapper ' + fn);
}

// 4c) The Canva export corrupted two regex literals in the original's inline
// script (a V8 "Invalid regular expression flags" syntax error that killed the
// whole app script in every browser). The on-disk file stays byte-identical
// (SHA gate above); the 2-byte repair is applied in the external serving
// layer only (GET /api/school-canva/original).
assert(canvaRoutes.includes('repairCanvaExport') && canvaRoutes.includes('CANVA_EXPORT_REPAIR'),
  'serving layer carries the documented Canva-export regex repair');

// 5) Core: bidirectional mapping between the original envelope and the
//    authenticated Socket.IO classroom events.
const C = require('../school-canva-adapter-core.js');
assert(C.toSocketCommand({ type: 'joinRoom', payload: { roomId: 'r' } }).event === 'school:join', 'joinRoom -> school:join');
assert(C.toSocketCommand({ type: 'iceCandidate', payload: { roomId: 'r', candidate: {} } }).event === 'school:webrtc:ice', 'iceCandidate -> school:webrtc:ice');
assert(C.fromSocketEvent('school:webrtc:ice', { roomId: 'r', candidate: { x: 1 } }).type === 'iceCandidate', 'server ice -> original iceCandidate');
assert(C.fromSocketEvent('school:webrtc:offer', { roomId: 'r', offer: {} }).type === 'offer', 'server offer -> original offer');
assert(C.fromSocketEvent('school:webrtc:answer', { roomId: 'r', answer: {} }).type === 'answer', 'server answer -> original answer');
assert(C.buildIceServers({ stunUrl: 'stun:stun.l.google.com:19302' })[0].urls === 'stun:stun.l.google.com:19302', 'STUN is the project default');
assert(C.buildIceServers({ turnServers: [] }).length === 0, 'no invented TURN when the server configured none');
assert(C.mapConsents({}).mic === 'بانتظار الموافقة', 'consent is never auto-granted');
assert(/^[A-Za-z0-9][A-Za-z0-9:_-]{3,79}$/.test(C.stableRoomId(['أ', 'ب'])), 'stable room ids fit the server pattern');

// 6) Server: routes and socket events are the real integration surface.
assert(canvaRoutes.includes("router.get('/health'"), 'GET /api/school/health for the original healthCheck');
assert(canvaRoutes.includes("router.post('/operations', requireAuth"), 'POST /api/school/operations authenticated');
assert(canvaRoutes.includes("router.get('/classroom/config', requireAuth"), 'GET /api/school/classroom/config authenticated');
assert(/findOne\(\{\s*guardian:\s*req\.user\._id,\s*clientOpId\s*\}\)/.test(canvaRoutes),
  'operations idempotent by guardian+clientOpId (shared SchoolSyncOperation store with /api/school/sync)');
assert(canvaRoutes.includes('SchoolSyncOperation'), 'uses the existing sync operation store');
assert(/SCHOOL_TURN_URIS/.test(canvaRoutes) && !/credential\s*[:=]\s*['"][^'"]/.test(canvaRoutes),
  'TURN only from environment, no hard-coded credential');
assert(serverSrc.includes("app.use('/api/school', schoolCanvaRoutes)"), 'canva surface mounted under /api/school');
assert(serverSrc.indexOf("app.use('/api/school', schoolCanvaRoutes)") <
  serverSrc.indexOf("app.use('/api/school', schoolSyncRoutes)"), 'mounted before existing school routers');
assert(serverSrc.includes('attachSchoolSocket(io)'), 'school classroom socket attached to the authenticated io');
for (const ev of ['school:join', 'school:leave', 'school:heartbeat', 'school:live',
  'school:webrtc:offer', 'school:webrtc:answer', 'school:webrtc:ice']) {
  assert(socketSchool.includes("'" + ev + "'"), 'socket-school handles ' + ev);
}
assert(socketSchool.includes('classrooms.isMember(roomId, user._id)'), 'relay requires authenticated membership');
assert(!/payload\.userId/.test(socketSchool), 'server never trusts client-sent user ids');
assert(registry.includes('ROOM_ID_PATTERN') && registry.includes('members: new Map()'), 'registry enforces room ids and per-room membership');
assert(recordLib.includes('planRecord') && recordLib.includes('student.ensure'), 'record mapper plans real operations');
assert(!/mongoose|require\('.\/models/.test(recordLib), 'record mapper stays pure (models live in the route)');

// 7) The existing (old) school page and its offline stack stay intact.
assert(oldSchoolHtml.includes('school-integration.js?v=20260919-1') && oldSchoolHtml.includes('school.js?v=20260911-5'),
  'existing school page still loads its preserved runtime + integration layer');
assert(sha('school.js') === '3550b0a79fc91af4b484aba7794356278e7ad33365ab04bc9d649493e3c64752', 'existing school.js unchanged');
assert(sha('school-offline-ai.js') === '96f6d6a32248bd6b099fa2a1dfd551f6d5b7f12e6fba9627e768549c946884db', 'existing offline AI layer unchanged');
assert(sha('school-integration.js') === 'be4f5467cedabdfb873edc86f4dcb0b033746915878aaab05b3acbe251eeebda', 'existing offline queue integration unchanged');
assert(sha('kahwa-cards-canva.js') === '78bcc85d4a6593b6a0282f7772d5120e9c5b397d99a86a768b1fdb9fd3e5c62b', 'Kahwa Azzawi cards adapter unchanged');
assert(sha('kahwa-chess-canva.js') === 'bec79dc637b347c526a51170be142d8d7723c80a563ad0f2f208f15db5da88b7', 'Kahwa Azzawi chess adapter unchanged');
assert(sha('kahwa-tawla-v2.js') === 'f48e47a6ef679a0a1092673190b7341dad756199612dc6a4f5129a391d14797f', 'Kahwa Azzawi tawla runtime unchanged');

console.log('PASS: api-school-canva-runtime (school Canva external wiring contract)');
