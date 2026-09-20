/*
 * cards-canva-adapter.js — external adapter for the immutable Canva
 * "مركز ألعاب الورق" original (original-assets/cards-canva/cards-canva-original.html).
 *
 * The loader (cards-canva.html) injects this file into the original's
 * document AFTER setting window.__SHNO_CARDS_CANVA_CONFIG__ with the real,
 * authenticated center config fetched from /api/cards-canva/center/config.
 *
 * Architecture (same contract as school-canva-adapter.js):
 *   - The original on disk is never modified; this adapter only hydrates it.
 *   - Rooms are 100% server-authoritative: seats, players, spectators and
 *     dealt-card counts come from the real GameRoom documents through
 *     /api/cards-canva and /api/game-rooms. No local room simulation.
 *   - The original's own top-level state (`room`) and renderers
 *     (renderRoom/showView) are reused as-is: the adapter writes REAL data
 *     into them, so the immutable markup renders real platform state.
 *   - Auto-spectate is a SERVER decision: config.autoSpectate names the
 *     running cards room the viewer may watch; the adapter registers the
 *     spectator via POST /rooms/:id/spectate and then mirrors the result.
 */
(function () {
  'use strict';

  var cfg = (window.__SHNO_CARDS_CANVA_CONFIG__ && typeof window.__SHNO_CARDS_CANVA_CONFIG__ === 'object')
    ? window.__SHNO_CARDS_CANVA_CONFIG__ : {};
  var api = cfg.restApiUrl || '/api/cards-canva';
  var gameRoomsApi = cfg.gameRoomsApi || '/api/game-rooms';

  function token() {
    try { return localStorage.getItem('token') || sessionStorage.getItem('token') || ''; } catch (e) { return ''; }
  }
  function authHeaders(extra) {
    var h = { 'Content-Type': 'application/json' };
    if (token()) h.Authorization = 'Bearer ' + token();
    if (extra) Object.keys(extra).forEach(function (k) { h[k] = extra[k]; });
    return h;
  }
  function getJson(path) {
    return window.fetch(path, { headers: authHeaders() })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, d: d }; }); });
  }
  function postJson(path, body, method) {
    return window.fetch(path, { method: method || 'POST', headers: authHeaders(), body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, d: d }; }); });
  }

  // The original declares `room`, `settings`, renderRoom(), showView() and
  // toast() at the top level of its classic inline script, so they live in
  // the page's global lexical environment and are reachable from this file.
  function originalRoom() { return (typeof room !== 'undefined') ? room : null; }
  function callRenderRoom() { try { if (typeof renderRoom === 'function') renderRoom(); } catch (e) {} }
  function callShowView(id) { try { if (typeof showView === 'function') showView(id); } catch (e) {} }

  // Observable adapter state (DOM/room-state source for the wiring tests):
  // every field is filled ONLY from server responses, never from a local
  // simulation. `tableau` is the real dealt-hand size of the player whose
  // turn it is in the spectated room (7 after the engine's opening deal).
  var state = {
    mode: cfg.mode === 'real' ? 'real' : 'offline',
    ready: false,
    spectating: null,   // { roomId, roomCode, isSpectator, spectatorCount }
    room: null,         // last authoritative public room state
    tableau: 0,
    error: null
  };
  window.__SHNO_CARDS_CENTER__ = state;

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el && text != null) el.textContent = text;
  }

  // Replace an element with a listener-clean clone: the original bound its
  // local-demo handlers with addEventListener, so stripping them requires
  // swapping the node (cloneNode never copies listeners). Ids are preserved,
  // so the original's $("id") lookups keep resolving to the live node.
  function retarget(id) {
    var el = document.getElementById(id);
    if (!el || !el.parentNode) return el;
    var clone = el.cloneNode(true);
    el.parentNode.replaceChild(clone, el);
    return clone;
  }

  function personNames(people) {
    return (people || []).map(function (p) {
      if (typeof p === 'string') return p;
      return (p && (p.name || p.username)) || 'لاعب';
    });
  }

  function hydrateRoomView(publicRoom, asSpectator) {
    var r = originalRoom();
    state.room = publicRoom;
    if (r && publicRoom) {
      r.code = publicRoom.roomCode || '';
      r.seats = publicRoom.maxPlayers || 4;
      r.players = personNames(publicRoom.players);
      r.spectators = personNames(publicRoom.spectators);
      r.isSpectator = !!asSpectator;
      callRenderRoom();
    }
    var badge = document.querySelector('[data-template-id="demo-mode-badge"]');
    if (badge) badge.textContent = publicRoom ? 'متصل — غرفة حقيقية من شنو منو' : 'متصل — شنو منو';
  }

  function readTableau(roomId) {
    return getJson(gameRoomsApi + '/' + roomId).then(function (out) {
      var pub = out.d && out.d.room;
      if (!pub) return 0;
      state.room = pub;
      var gs = pub.gameState || {};
      var players = Array.isArray(gs.players) ? gs.players : [];
      var turnId = gs.engineTurn != null ? String(gs.engineTurn) : '';
      var turnPlayer = null;
      players.forEach(function (p) { if (p && String(p.id) === turnId) turnPlayer = p; });
      if (!turnPlayer && players.length) turnPlayer = players[0];
      return turnPlayer ? (Number(turnPlayer.handCount) || 0) : 0;
    }).catch(function () { return 0; });
  }

  function autoSpectate(choice) {
    return postJson(api + '/rooms/' + choice.roomId + '/spectate', {}).then(function (out) {
      if (!out.d || out.d.ok !== true) throw new Error((out.d && out.d.message) || 'spectate ' + out.status);
      var pub = out.d.room;
      hydrateRoomView(pub, true);
      state.spectating = {
        roomId: choice.roomId,
        roomCode: pub.roomCode || choice.roomCode,
        isSpectator: out.d.isSpectator === true,
        spectatorCount: out.d.spectatorCount
      };
      callShowView('roomView');
      return readTableau(choice.roomId).then(function (handCount) {
        state.tableau = handCount;
        setText('statusMessage', 'أنت الآن تشاهد غرفة «' + (pub.name || '') + '» مباشرة من شنو منو — المشاهدة فقط دون نقلات.');
        return state;
      });
    });
  }

  function hydrateConnection() {
    setText('connectionBadge', 'متصل — شنو منو');
    var user = cfg.user || {};
    setText('statusMessage', 'مرحباً ' + (user.name || '') + ' — الغرف والنتائج حقيقية من خادم شنو منو.');
  }

  function refreshConfig() {
    return getJson(api + '/center/config').then(function (out) {
      if (out.status === 401) { setText('statusMessage', 'انتهت جلسة الدخول — سجّل الدخول أولاً.'); return null; }
      if (!out.d || out.d.ok !== true) return null;
      cfg = out.d;
      return out.d;
    });
  }

  function afterRoomChange(out, asSpectator) {
    if (!out.d || out.d.ok !== true) {
      setText('statusMessage', (out.d && out.d.message) || 'تعذر تنفيذ الطلب على الخادم.');
      return null;
    }
    var pub = out.d.room;
    hydrateRoomView(pub, asSpectator);
    callShowView('roomView');
    state.spectating = asSpectator ? {
      roomId: pub.id, roomCode: pub.roomCode, isSpectator: true, spectatorCount: out.d.spectatorCount
    } : state.spectating;
    return pub;
  }

  function wireRealRoomControls() {
    // Create: the original's roomForm submit was a local demo; retarget it
    // to the real /api/game-rooms surface (cards engine, server seats).
    var form = retarget('roomForm');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var nickname = (document.getElementById('nickname').value || '').trim();
      var seats = Number((document.getElementById('seats') || {}).value || 4);
      postJson(gameRoomsApi, { gameType: 'cards', name: nickname ? ('غرفة ' + nickname) : '', maxPlayers: seats, visibility: 'public' })
        .then(function (out) {
          var pub = afterRoomChange(out, false);
          if (pub) setText('statusMessage', 'أُنشئت غرفة حقيقية برمز ' + pub.roomCode + ' — شارك الرمز مع أصدقائك.');
        });
    });

    // Join by code: real /api/game-rooms/:code/join (the server resolves
    // 6-digit codes and enforces seats/blocks/visibility).
    var joinBtn = retarget('joinRoom');
    if (joinBtn) joinBtn.addEventListener('click', function () {
      var code = ((document.getElementById('joinCode') || {}).value || '').trim();
      if (code.length < 4) { setText('statusMessage', 'أدخل رمز غرفة صالحاً أولاً.'); return; }
      postJson(gameRoomsApi + '/' + encodeURIComponent(code) + '/join', {}).then(function (out) {
        var pub = afterRoomChange(out, false);
        if (pub) setText('statusMessage', 'انضممت إلى غرفة حقيقية برمز ' + pub.roomCode + '.');
      });
    });

    // Watch: real server-side spectator registration for the room in view.
    var watchBtn = retarget('watchButton');
    if (watchBtn) watchBtn.addEventListener('click', function () {
      var target = (state.room && state.room.id) || (cfg.autoSpectate && cfg.autoSpectate.roomId)
        || ((cfg.rooms || [])[0] || {}).id;
      if (!target) { setText('statusMessage', 'لا توجد غرفة متاحة للمشاهدة الآن.'); return; }
      autoSpectate({ roomId: target });
    });

    // Leave: server-authoritative leave (spectator or player), then refresh.
    var leaveBtn = retarget('leaveRoom');
    if (leaveBtn) leaveBtn.addEventListener('click', function () {
      var current = state.spectating || (state.room ? { roomId: state.room.id, isSpectator: false } : null);
      var chain = Promise.resolve();
      if (current && current.roomId) {
        chain = current.isSpectator
          ? postJson(api + '/rooms/' + current.roomId + '/spectate', {}, 'DELETE')
          : postJson(gameRoomsApi + '/' + current.roomId + '/join', {}, 'DELETE');
      }
      chain.then(function () {
        var r = originalRoom();
        if (r) { r.code = ''; r.players = []; r.spectators = []; r.isSpectator = false; callRenderRoom(); }
        state.spectating = null; state.room = null; state.tableau = 0;
        return refreshConfig().then(function (fresh) {
          if (fresh && fresh.autoSpectate) return autoSpectate(fresh.autoSpectate);
          setText('statusMessage', 'خرجت من الغرفة — يمكنك إنشاء غرفة جديدة أو مشاهدة غرفة جارية.');
          return null;
        });
      });
    });
  }

  function boot() {
    hydrateConnection();
    wireRealRoomControls();
    var target = cfg.autoSpectate;
    // Expose the in-flight boot promise so wiring tests (and loaders) can
    // synchronize on real settlement instead of guessing delays. ready=true
    // is set only after auto-spectate resolves or definitively fails.
    var done = target ? autoSpectate(target).catch(function (e) {
      state.error = String(e && e.message || e);
      setText('statusMessage', 'تعذر فتح المشاهدة التلقائية: ' + state.error);
      return null;
    }) : Promise.resolve(null);
    state.boot = done.then(function () {
      state.ready = true;
      return state;
    });
    return state.boot;
  }

  // Always kick boot once the document is interactive. Prefer DOMContentLoaded
  // when still loading; otherwise start immediately (loader injects us after
  // the original's scripts have already run).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { boot(); });
  } else {
    boot();
  }
  // Observable handle for harnesses: same promise as state.boot once boot runs.
  Object.defineProperty(window, '__SHNO_CARDS_CENTER_BOOT__', {
    configurable: true,
    get: function () { return state.boot || Promise.resolve(state); }
  });
})();
