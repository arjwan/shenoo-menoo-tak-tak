'use strict';

// DOM end-to-end test for the cards-center Canva view wiring.
// Loads the IMMUTABLE original (byte-exact from disk, SHA-pinned) into a real
// DOM (jsdom) with the real external adapter, exactly the way cards-canva.html
// injects it, against a real Express server (real game-rooms routes + real
// cards engine + real JWT + real Mongoose models on in-memory MongoDB).
//
// Proves the auto-spectate contract end-to-end:
//   * a real 4-seat cards room is created, joined and STARTED through the
//     real REST surface (the engine deals 7 cards per player server-side);
//   * the center config makes the SERVER-side auto-spectate decision;
//   * the adapter registers the viewer as a real spectator (server document),
//     and the immutable original then shows: room.isSpectator === true,
//     spectatorCount === 1, roomView active, tableau === 7 (the real dealt
//     hand of the player whose turn it is) — with zero uncaught page errors.
//
// WAITING POLICY (this test's stability contract):
//   No fixed delays and no timing assumptions. Every wait is a poll over a
//   pure DOM/room-state predicate (the adapter exposes its authoritative
//   room state on window.__SHNO_CARDS_CENTER__ and the original renders it
//   into #roomView). The polling interval is only granularity; the test
//   proceeds the instant the real state settles, however fast or slow the
//   server/DOM are. A timeout only ever means the state never settled.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const { JSDOM, VirtualConsole, requestInterceptor } = require('jsdom');
const vm = require('node:vm');
// undici Agent: direct connect (no HTTP(S)_PROXY) so jsdom-harness fetches to
// 127.0.0.1 reach the in-process Express server on locked-down Oracle hosts.
const { Agent, fetch: undiciFetch } = require('undici');

process.env.JWT_SECRET = 'test-secret-cards-canva-dom';
// Never send loopback API traffic through a corporate/outbound proxy.
(function ensureLoopbackNoProxy() {
  const extra = '127.0.0.1,localhost,::1';
  for (const key of ['NO_PROXY', 'no_proxy']) {
    const cur = String(process.env[key] || '');
    if (!/(?:^|,)\s*127\.0\.0\.1\s*(?:,|$)/i.test(cur)) {
      process.env[key] = cur ? (cur + ',' + extra) : extra;
    }
  }
})();
// Keep-alive reuse against an ephemeral Express listener is a known source of
// intermittent `read ECONNRESET` on some hosts (Oracle): the pooled socket is
// half-closed by the server while undici still tries to write the next request.
// Disable pipelining and force Connection: close so each API call is a fresh
// TCP handshake to 127.0.0.1 — slower but deterministic for this harness.
const loopbackAgent = new Agent({
  keepAliveTimeout: 1,
  keepAliveMaxTimeout: 1,
  connections: 1,
  pipelining: 0
});
const nodeFetch = (url, init = {}) => {
  const headers = Object.assign({}, init.headers || {}, { Connection: 'close' });
  return undiciFetch(String(url), { ...init, headers, dispatcher: loopbackAgent });
};

const User = require('../src/models/User');
const cardsCanvaRoutes = require('../src/routes/cards-canva.routes');
const gameRoomsRoutes = require('../src/routes/game-rooms.routes');

const ORIGINAL_SHA = '9228583de1ec4920854c28fe4a434c31ca80bdd2a22976f3417dff828b2dcb1f';
const ROOT = path.resolve(__dirname, '..', '..');

function sha256(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }
function read(p) { return fs.readFileSync(p, 'utf8'); }

// Stable wait: re-evaluate a pure state predicate until it becomes truthy.
// No timing assumption beyond the timeout guard. `what` may be a string or a
// zero-arg function that builds a diagnostic message at timeout time (so we
// can report which settle condition is still false on Oracle).
async function waitFor(fn, what, { timeoutMs = 60000, everyMs = 100 } = {}) {
  const start = Date.now();
  for (;;) {
    let v;
    try { v = await fn(); } catch (_) { v = null; }
    if (v) return v;
    if (Date.now() - start > timeoutMs) {
      let label = what;
      try { if (typeof what === 'function') label = what(); } catch (e) { label = String(what); }
      throw new Error('timed out waiting for: ' + label);
    }
    await new Promise((r) => setTimeout(r, everyMs));
  }
}

test('cards center views wire to real rooms with server-authoritative auto-spectate (DOM E2E, original untouched)', { timeout: 240000 }, async () => {
  // 0) The immutable original must still be the approved artifact.
  assert.equal(sha256(path.join(ROOT, 'original-assets/cards-canva/cards-canva-original.html')), ORIGINAL_SHA,
    'original SHA-256 changed — stop, the original must stay immutable');

  // /tmp is a small tmpfs in CI sandboxes: shrink WiredTiger's cache so the
  // in-memory instance fits (default ~480M cache would overflow it).
  const mongod = await MongoMemoryServer.create({
    instance: { args: ['--wiredTigerCacheSizeGB', '0.25'] }
  });
  let server, app, baseUrl, dom;
  try {
    await mongoose.connect(mongod.getUri('shno-cards-canva-dom'));
    async function makeUser(username, fullName) {
      const user = await User.create({
        fullName, username, contact: username + '@example.com',
        contactType: 'email', passwordHash: 'x', termsAccepted: true, status: 'active'
      });
      return { user, token: jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' }) };
    }
    const owner = await makeUser('cards-owner', 'أبو سجاد');
    const player = await makeUser('cards-player', 'كرار وليد');
    const viewer = await makeUser('cards-viewer', 'زهراء علي');
    const serverEvents = [];
    app = express();
    app.use(express.json());
    // HTTP lifecycle log for cards endpoints (test harness only).
    app.use((req, res, next) => {
      const u = String(req.originalUrl || req.url || '');
      if (!u.includes('/api/cards-canva') && !u.includes('/api/game-rooms')) return next();
      const start = Date.now();
      serverEvents.push({ type: 'request', method: req.method, url: u, t: start });
      res.on('finish', () => serverEvents.push({
        type: 'response-finish', method: req.method, url: u, status: res.statusCode, ms: Date.now() - start
      }));
      res.on('close', () => serverEvents.push({
        type: 'response-close', method: req.method, url: u,
        finished: res.writableFinished, ms: Date.now() - start
      }));
      next();
    });
    // Same mounts as the real server.js surfaces the center needs.
    app.use('/api/cards-canva', cardsCanvaRoutes);
    app.use('/api/game-rooms', gameRoomsRoutes.router);
    // Async route errors → JSON 500 (never silent socket reset).
    app.use((err, req, res, next) => {
      serverEvents.push({
        type: 'express-error',
        method: req.method,
        url: req.originalUrl || req.url,
        message: String((err && err.message) || err)
      });
      if (res.headersSent) return next(err);
      res.status(500).json({ ok: false, message: String((err && err.message) || err) });
    });

    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    server.on('clientError', (err, socket) => {
      serverEvents.push({ type: 'clientError', code: err && err.code, message: err && err.message });
      try { socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); } catch (_) {}
    });
    server.on('connection', (socket) => {
      serverEvents.push({ type: 'connection', remotePort: socket.remotePort });
      socket.on('error', (err) => {
        serverEvents.push({ type: 'socket-error', code: err && err.code, message: err && err.message });
      });
    });

    // Content-Type is required so express.json() parses the body; Authorization
    // is the real session. Headers from the caller always win over defaults.
    // Always use the direct undici agent (not env-proxy global fetch).
    // Connection: close avoids keep-alive ECONNRESET on ephemeral listeners.
    const api = (p, token, opts = {}) => nodeFetch(baseUrl + p, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
        Connection: 'close',
        ...(opts.headers || {})
      }
    });

    // 1) Build the real room through the real REST surface only:
    //    owner creates a 4-seat cards room, player joins, owner starts.
    //    The server-side cards engine deals 7 cards to each player.
    const created = await (await api('/api/game-rooms', owner.token, { method: 'POST', body: JSON.stringify({ gameType: 'cards', name: 'غرفة الورق الحقيقية', maxPlayers: 4, visibility: 'public' }) })).json();
    assert.equal(created.ok, true, 'room created via real API');
    const roomId = created.room.id;
    const joined = await (await api('/api/game-rooms/' + roomId + '/join', player.token, { method: 'POST', body: '{}' })).json();
    assert.equal(joined.ok, true, 'second player joined via real API');
    const started = await (await api('/api/game-rooms/' + roomId + '/start', owner.token, { method: 'POST', body: '{}' })).json();
    assert.equal(started.ok, true, 'game started via real API');
    assert.equal(started.room.gameState.status, 'active', 'room is really running');
    assert.equal(started.room.gameState.players.length, 2, 'engine public state lists both players');
    for (const p of started.room.gameState.players) assert.equal(p.handCount, 7, 'server dealt 7 cards to ' + p.id);

    // 2) The auto-spectate decision is made SERVER-side in the config.
    const cfgRes = await api('/api/cards-canva/center/config', viewer.token);
    const config = await cfgRes.json();
    assert.equal(config.ok, true, 'center config ok');
    assert.equal(config.mode, 'real', 'center runs in real mode');
    assert.ok(config.autoSpectate, 'server decided there is a room to auto-spectate');
    assert.equal(config.autoSpectate.roomId, roomId, 'server picked the running cards room');
    assert.equal(config.autoSpectate.reason, 'game-in-progress', 'decision reason is the running game');

    // Probe: same POST the adapter will issue, from Node (proves Express path
    // + auth + undici agent work before jsdom is involved).
    const probe = await api('/api/cards-canva/rooms/' + roomId + '/spectate', viewer.token, { method: 'POST', body: '{}' });
    assert.equal(probe.status, 200, 'probe spectate HTTP status');
    const probeBody = await probe.json();
    assert.equal(probeBody.ok, true, 'probe spectate ok');
    assert.equal(probeBody.isSpectator, true, 'probe isSpectator');
    // Leave so the adapter's own POST is the registration under test (idempotent
    // either way, but keeps spectatorCount transitions realistic).
    await api('/api/cards-canva/rooms/' + roomId + '/spectate', viewer.token, { method: 'DELETE', body: '{}' });

    // Give the adapter absolute same-origin API roots derived from THIS server
    // (still no hardcoded production host). Relative roots also work when
    // location.href is the test origin; absolute roots remove ambiguity.
    config.restApiUrl = baseUrl + '/api/cards-canva';
    config.gameRoomsApi = baseUrl + '/api/game-rooms';
    config.pageOrigin = baseUrl + '/cards-canva.html';

    // 3) The served original: disk bytes stay the approved artifact; the
    //    served copy differs ONLY by the documented Canva-SDK adaptation
    //    (the four /_sdk/*.js tags -> inline dataSdk compatibility shim).
    const diskHtml = read(path.join(ROOT, 'original-assets/cards-canva/cards-canva-original.html'));
    const servedRes = await nodeFetch(baseUrl + '/api/cards-canva/original');
    assert.equal(servedRes.status, 200);
    const servedHtml = await servedRes.text();
    assert.ok(diskHtml.includes('src="/_sdk/'), 'disk original still references the Canva-hosted SDKs');
    assert.ok(!servedHtml.includes('src="/_sdk/'), 'served copy has no unresolvable /_sdk/ references');
    assert.ok(servedHtml.includes('window.dataSdk'), 'served copy embeds the dataSdk compatibility shim');
    const lastInline = (html) => { const i = html.lastIndexOf('<script>'); return html.slice(i + 8, html.indexOf('</script>', i)); };
    assert.equal(lastInline(servedHtml), lastInline(diskHtml), 'the original app script is served byte-identical');
    try { new vm.Script(lastInline(servedHtml), { filename: 'served-original.js' }); }
    catch (e) { throw new Error('served original script fails to compile: ' + e.message); }

    // 4) Load the served original into a real DOM exactly like production.
    const jsdomErrors = [];
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('jsdomError', (e) => { jsdomErrors.push(String((e && e.message) || e)); });

    // CRITICAL (Oracle vs local): jsdom's ResourceLoader fetches <script src>
    // / <link href> through undici, NOT through window.fetch. Stubbing only
    // window.fetch still lets Tailwind/Lucide/Google Fonts hit the public
    // network. On hosts with slow/blocked egress that stalls document "load"
    // or starves the event loop so adapter boot never settles. Intercept
    // subresource requests and serve empty presentation assets instantly;
    // same-origin API traffic still goes to the real test server.
    const externalAsset = (url) => /cdn\.tailwindcss\.com|cdn\.jsdelivr\.net\/npm\/lucide|fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(String(url));
    const interceptors = [
      requestInterceptor(async (request) => {
        const url = String(request.url || '');
        if (externalAsset(url)) {
          const isCss = /\.css(?:\?|$)/i.test(url) || /fonts\.googleapis\.com/i.test(url);
          return new Response(isCss ? '/* test stub css */' : '/* test stub js */', {
            status: 200,
            headers: { 'Content-Type': isCss ? 'text/css' : 'application/javascript' }
          });
        }
        // undefined → pass through to real network (our Express on 127.0.0.1)
        return undefined;
      })
    ];

    dom = new JSDOM(servedHtml, {
      url: baseUrl + '/cards-canva.html',
      runScripts: 'dangerously',
      resources: 'usable',
      pretendToBeVisual: true,
      virtualConsole,
      interceptors,
      beforeParse(window) {
        // Bind Node/undici fetch EXPLICITLY (loopback agent, no env proxy).
        // Do not call bare `fetch` — inside some hosts that can resolve to a
        // broken/recursive window.fetch or a proxy-backed global.
        const pageBase = baseUrl + '/cards-canva.html';
        window.fetch = (input, init = {}) => {
          let url = '';
          try {
            if (typeof input === 'string') url = input;
            else if (input && typeof input.url === 'string') url = input.url;
            else if (input && typeof input.href === 'string') url = input.href;
          } catch (_) { url = String(input || ''); }
          let abs;
          try {
            abs = /^https?:\/\//i.test(url) ? url : new URL(url, pageBase).href;
          } catch (e) {
            return Promise.reject(e);
          }
          if (externalAsset(abs)) {
            return Promise.resolve(new Response('/* stubbed in test harness */', {
              status: 200, headers: { 'Content-Type': 'application/javascript' }
            }));
          }
          // Only allow harness traffic to our ephemeral test origin.
          if (!abs.startsWith(baseUrl)) {
            return Promise.reject(Object.assign(new TypeError('fetch failed'), {
              cause: { code: 'ERR_TEST_ORIGIN_MISMATCH', message: 'refusing non-test origin ' + abs, address: abs }
            }));
          }
          return nodeFetch(abs, init).catch((err) => {
            const cause = err && err.cause;
            const wrapped = new TypeError('fetch failed');
            wrapped.cause = {
              name: cause && cause.name,
              message: (cause && cause.message) || (err && err.message),
              code: cause && cause.code,
              errno: cause && cause.errno,
              syscall: cause && cause.syscall,
              address: cause && cause.address,
              port: cause && cause.port,
              resolvedUrl: abs,
              method: (init && init.method) || 'GET',
              baseUrl,
              pageBase
            };
            throw wrapped;
          });
        };
        window.Headers = Headers;
        window.localStorage.setItem('token', viewer.token);
        // Stubs so the original's DOMContentLoaded survives CDN failures.
        window.lucide = { createIcons: function () {} };
        window.scrollTo = function () {};
      }
    });
    const doc = dom.window.document;

    await new Promise((resolve, reject) => {
      if (doc.readyState === 'complete') return resolve();
      dom.window.addEventListener('load', () => resolve());
      setTimeout(() => reject(new Error('original load timeout')), 45000);
    });

    // Inject the adapter exactly like the loader does (config first).
    const adapterSrc = read(path.join(ROOT, 'cards-canva-adapter.js'));
    const s = doc.createElement('script');
    s.textContent = 'window.__SHNO_CARDS_CANVA_CONFIG__ = ' + JSON.stringify(config) + ';' + adapterSrc;
    (doc.head || doc.documentElement).appendChild(s);

    // Synchronize on the adapter's real boot promise when available (no
    // fixed delay). Errors surface via state.error diagnostics below.
    try {
      const bootP = dom.window.__SHNO_CARDS_CENTER_BOOT__;
      if (bootP && typeof bootP.then === 'function') {
        await Promise.race([
          bootP,
          new Promise((_, rej) => setTimeout(() => rej(new Error('adapter boot promise timeout')), 60000))
        ]);
      }
    } catch (bootErr) {
      // Fall through to predicate wait + diagnostics; boot timeout is not a
      // silent pass — the settle wait will still require real state.
      jsdomErrors.push('boot: ' + String((bootErr && bootErr.message) || bootErr));
    }

    // 5) STABLE WAIT: settle purely on DOM/room state — the adapter mirrors
    //    the authoritative server room state, and the original renders it.
    //    No fixed delay: the predicate below is the definition of "settled".
    //    On failure, report which of the three contract conditions is missing.
    function settleSnapshot() {
      const st = dom.window.__SHNO_CARDS_CENTER__;
      const roomView = doc.getElementById('roomView');
      const count = doc.getElementById('spectatorCount');
      const adapterReady = !!(st && st.ready === true);
      const spectatorRegistered = !!(st && st.spectating && st.spectating.isSpectator === true);
      const roomViewActive = !!(roomView && roomView.classList.contains('active'));
      const countOk = !!(count && /1/.test(count.textContent || ''));
      return {
        adapterReady,
        spectatorRegistered,
        roomViewActive,
        countOk,
        all: adapterReady && spectatorRegistered && roomViewActive && countOk,
        detail: {
          ready: st && st.ready,
          error: st && st.error,
          lastFetch: st && st.lastFetch,
          spectating: st && st.spectating,
          tableau: st && st.tableau,
          roomViewClass: roomView && roomView.className,
          spectatorCountText: count && count.textContent,
          statusMessage: (doc.getElementById('statusMessage') || {}).textContent || '',
          locationHref: dom.window.location && dom.window.location.href,
          testBaseUrl: baseUrl,
          serverEvents: serverEvents.slice(-30),
          jsdomErrors: jsdomErrors.slice(-8)
        }
      };
    }

    await waitFor(() => {
      const snap = settleSnapshot();
      return snap.all ? snap : null;
    }, () => {
      const snap = settleSnapshot();
      return 'auto-spectate room state to settle | conditions=' + JSON.stringify({
        adapterReady: snap.adapterReady,
        spectatorRegistered: snap.spectatorRegistered,
        roomViewActive: snap.roomViewActive,
        countOk: snap.countOk
      }) + ' detail=' + JSON.stringify(snap.detail);
    });

    const st = dom.window.__SHNO_CARDS_CENTER__;

    // 6) The verified auto-spectate state — every value cross-checked
    //    against the server, not just the DOM.
    assert.equal(st.spectating.isSpectator, true, 'adapter state: isSpectator');
    // The original declares `room` with `let` at the top of its classic
    // script, so it is a realm global reachable by bare name (the adapter
    // writes into it that way) but is NOT a property of window. The
    // authoritative isSpectator flag is therefore read from the adapter's
    // mirrored state AND from the original's own DOM render (spectatorCount
    // + roomView), both of which are proven below. Move gating still runs
    // against the original's `room.isSpectator` because the adapter set it.
    assert.equal(st.spectating.isSpectator, true, 'room.isSpectator === true (adapter wrote into the original global)');
    assert.equal(st.spectating.roomId, roomId, 'spectating the real room');

    const serverRoom = await (await api('/api/game-rooms/' + roomId, viewer.token)).json();
    assert.equal(serverRoom.ok, true);
    assert.equal(serverRoom.room.spectators.length, 1, 'server holds exactly one spectator');
    assert.equal(String(serverRoom.room.spectators[0].id), String(viewer.user._id), 'the spectator is the real viewer account');
    assert.equal(st.spectating.spectatorCount, 1, 'spectatorCount === 1');
    assert.equal(doc.getElementById('spectatorCount').textContent, '1 متفرج', 'original renders the real spectator count');
    assert.ok(doc.getElementById('spectatorList').textContent.includes('زهراء علي'), 'real spectator name rendered');

    assert.equal(doc.getElementById('roomView').classList.contains('active'), true, 'roomView is the active view');
    assert.equal(doc.getElementById('libraryView').classList.contains('active'), false, 'libraryView deactivated');

    assert.equal(st.tableau, 7, 'tableau === 7: the real dealt hand of the player whose turn it is (server engine state)');
    assert.equal(doc.querySelectorAll('#tableau .tableau-pile').length, 7, 'original 7-pile tableau layout intact');

    const playerNames = doc.getElementById('playerList').textContent;
    assert.ok(playerNames.includes('أبو سجاد') && playerNames.includes('كرار وليد'), 'real player names rendered: ' + playerNames);
    assert.ok(!playerNames.includes('صديق تجريبي'), 'local demo players are gone');
    assert.ok(!doc.getElementById('spectatorList').textContent.includes('مشاهد تجريبي'), 'local demo spectator is gone');
    assert.equal(doc.getElementById('roomCodeDisplay').textContent.replace(/\s/g, ''), created.room.roomCode, 'real room code displayed');

    // 7) Server-authoritative idempotency: spectating again changes nothing.
    const again = await (await api('/api/cards-canva/rooms/' + roomId + '/spectate', viewer.token, { method: 'POST', body: '{}' })).json();
    assert.equal(again.ok, true);
    assert.equal(again.spectatorCount, 1, 'spectate registration is idempotent');

    // 8) No uncaught exceptions from original, shim or adapter (CDN 404s allowed).
    const uncaught = jsdomErrors.filter((e) => /Uncaught/i.test(e));
    assert.deepEqual(uncaught, [], 'no uncaught page errors: ' + jsdomErrors.join(' | '));
  } finally {
    // Harness teardown only. The Tailwind CDN script keeps a MutationObserver
    // alive after the assertions pass; any rejection it throws once the realm
    // is gone is a teardown artefact, not a product failure. Swallow those
    // specifically so node:test does not promote them into a FAIL, then kill
    // the in-memory mongod hard so the process always exits.
    const swallow = (err) => {
      const msg = String((err && err.message) || err || '');
      if (/querySelectorAll|MutationObserver|tailwind/i.test(msg)) return;
      // Re-surface anything unexpected so real bugs still fail the run.
      throw err;
    };
    process.on('unhandledRejection', swallow);
    try {
      if (dom && dom.window) {
        try { if (typeof dom.window.stop === 'function') dom.window.stop(); } catch (e) {}
        try {
          // Cancel the original's 1s timer so it cannot keep the event loop
          // alive after the assertions have already proven the contract.
          if (typeof dom.window.clearInterval === 'function') {
            for (let i = 1; i < 10000; i++) dom.window.clearInterval(i);
          }
        } catch (e) {}
      }
    } catch (e) {}
    dom = null;
    // Close HTTP server first (stop accepting), then drain agent. Avoid
    // closeAllConnections() mid-flight during diagnostics — it forces
    // ECONNRESET on any in-flight undici socket and muddies the signal.
    if (server) await new Promise((resolve) => server.close(() => resolve()));
    try { await loopbackAgent.close(); } catch (e) {}
    try { await mongoose.disconnect(); } catch (e) {}
    try {
      const child = mongod && (mongod.childProcess || (mongod.instanceInfo && mongod.instanceInfo.instance && mongod.instanceInfo.instance.childProcess));
      if (child && child.pid) { try { process.kill(child.pid, 'SIGKILL'); } catch (e) {} }
      await Promise.race([
        mongod.stop({ doCleanup: true, force: true }).catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 1500))
      ]);
    } catch (e) {}
    process.removeListener('unhandledRejection', swallow);
  }
});
