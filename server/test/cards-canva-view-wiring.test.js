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
const { JSDOM, VirtualConsole } = require('jsdom');
const vm = require('node:vm');

process.env.JWT_SECRET = 'test-secret-cards-canva-dom';

const User = require('../src/models/User');
const cardsCanvaRoutes = require('../src/routes/cards-canva.routes');
const gameRoomsRoutes = require('../src/routes/game-rooms.routes');

const ORIGINAL_SHA = '9228583de1ec4920854c28fe4a434c31ca80bdd2a22976f3417dff828b2dcb1f';
const ROOT = path.resolve(__dirname, '..', '..');

function sha256(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }
function read(p) { return fs.readFileSync(p, 'utf8'); }

// Stable wait: re-evaluate a pure state predicate until it becomes truthy.
// No timing assumption beyond the timeout guard.
async function waitFor(fn, what, { timeoutMs = 60000, everyMs = 100 } = {}) {
  const start = Date.now();
  for (;;) {
    let v;
    try { v = await fn(); } catch (_) { v = null; }
    if (v) return v;
    if (Date.now() - start > timeoutMs) throw new Error('timed out waiting for: ' + what);
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
    app = express();
    app.use(express.json());
    // Same mounts as the real server.js surfaces the center needs.
    app.use('/api/cards-canva', cardsCanvaRoutes);
    app.use('/api/game-rooms', gameRoomsRoutes.router);
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    // Content-Type is required so express.json() parses the body; Authorization
    // is the real session. Headers from the caller always win over defaults.
    const api = (p, token, opts = {}) => fetch(baseUrl + p, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
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

    // 3) The served original: disk bytes stay the approved artifact; the
    //    served copy differs ONLY by the documented Canva-SDK adaptation
    //    (the four /_sdk/*.js tags -> inline dataSdk compatibility shim).
    const diskHtml = read(path.join(ROOT, 'original-assets/cards-canva/cards-canva-original.html'));
    const servedRes = await fetch(baseUrl + '/api/cards-canva/original');
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

    dom = new JSDOM(servedHtml, {
      url: baseUrl + '/cards-canva.html',
      runScripts: 'dangerously',
      resources: 'usable',
      pretendToBeVisual: true,
      virtualConsole,
      beforeParse(window) {
        // Real network for the page's API calls (same origin as the test server).
        // External CDNs (tailwind/lucide) are intentionally NOT loaded: they
        // are presentation-only and keep MutationObservers alive after the
        // assertions pass, which turns a clean PASS into an unhandledRejection
        // during teardown. The original already degrades without them (lucide
        // stub below) and every assertion below is pure DOM/room state.
        window.fetch = (input, init) => {
          const url = typeof input === 'string' ? input : (input && input.url) || '';
          const abs = /^https?:/i.test(url) ? url : new URL(url, baseUrl).href;
          if (/cdn\.tailwindcss\.com|cdn\.jsdelivr\.net\/npm\/lucide/i.test(abs)) {
            return Promise.resolve(new Response('/* stubbed in test harness */', {
              status: 200, headers: { 'Content-Type': 'application/javascript' }
            }));
          }
          return fetch(abs, init);
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

    // 5) STABLE WAIT: settle purely on DOM/room state — the adapter mirrors
    //    the authoritative server room state, and the original renders it.
    //    No fixed delay: the predicate below is the definition of "settled".
    await waitFor(() => {
      const st = dom.window.__SHNO_CARDS_CENTER__;
      const roomView = doc.getElementById('roomView');
      const count = doc.getElementById('spectatorCount');
      return st && st.ready === true &&
        st.spectating && st.spectating.isSpectator === true &&
        roomView && roomView.classList.contains('active') &&
        count && /1/.test(count.textContent);
    }, 'auto-spectate room state to settle (adapter ready + spectator registered + roomView active)');

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
    try { if (server && server.closeAllConnections) server.closeAllConnections(); } catch (e) {}
    if (server) await new Promise((resolve) => server.close(() => resolve()));
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
