/* ==========================================================================
 * Kahwa Azzawi — Original UI runtime link (integration layer)
 * Version: 20260919-original-link-1
 *
 * Links the preserved original surfaces to the live game-room runtime:
 * - tawla : verifies the preserved Canva build 6 surface (.canva-tawla-app
 *   from original-assets/tawla/kahwa-tawla-v2.js) is the one mounted for
 *   gameType=tawla, and tags the stage so CSS + tests can prove it.
 * - chess : keeps window.kahwaChessUI (server-authoritative: SocialAPI +
 *   /api/game-rooms/:id/action + socket rooms/turn/moves) and maps the
 *   preserved realistic-chess visual language onto it (banner + classes).
 * - cards : keeps window.kahwaCardsUI (server-authoritative rummy engine)
 *   and maps the preserved card-library felt/wood language onto it.
 * - domino: passthrough — never wrapped, never restyled, never broken.
 *
 * This file adds NO local simulation, NO offline AI, NO local rooms.
 * Every move still travels through SocialAPI.request('/api/game-rooms/...')
 * and the existing socket channels; this layer only tags + decorates.
 * ========================================================================== */
(function () {
  'use strict';

  var VERSION = '20260919-original-link-1';

  function stage() { return document.getElementById('kahwa-game-stage'); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function tagStage(gameType) {
    var c = stage();
    if (!c) return;
    c.setAttribute('data-original-ui', gameType);
    c.classList.toggle('chess-original-linked', gameType === 'chess');
    c.classList.toggle('cards-original-linked', gameType === 'cards');
    if (gameType !== 'chess') c.removeAttribute('data-original-chess');
    if (gameType !== 'cards') c.removeAttribute('data-original-cards');
    if (gameType !== 'tawla') c.removeAttribute('data-original-tawla');
    document.body.classList.toggle('kahwa-original-active', gameType !== 'domino');
  }

  function ensureChessBanner(c) {
    if (!c || c.querySelector('[data-original-banner="chess"]')) return;
    var host = c.querySelector('.chess-table');
    if (!host) return;
    var banner = document.createElement('div');
    banner.className = 'kahwa-original-banner chess-original-banner';
    banner.setAttribute('data-original-banner', 'chess');
    banner.innerHTML =
      '<span class="brand-mark">♞</span>' +
      '<div><small>لعبة استراتيجية عربية</small><strong>شطرنج واقعي</strong></div>' +
      '<span class="badge">الرقعة جاهزة · المحرك الحقيقي</span>';
    host.insertBefore(banner, host.firstChild);
    c.setAttribute('data-original-chess', 'realistic');
  }

  function ensureCardsBanner(c, ctx) {
    if (!c || c.querySelector('[data-original-banner="cards"]')) return;
    var host = c.querySelector('.rummy-table');
    if (!host) return;
    var count = 0;
    try {
      var pub = ctx && ctx.state && ctx.state.public;
      count = pub && pub.players ? pub.players.length : 0;
    } catch (_) { count = 0; }
    var banner = document.createElement('div');
    banner.className = 'kahwa-original-banner cards-original-banner';
    banner.setAttribute('data-original-banner', 'cards');
    banner.innerHTML =
      '<span class="brand-mark">🃏</span>' +
      '<div><small>طاولة عربية · ' + esc(count || '—') + ' لاعبين بالمحرّك الحقيقي</small>' +
      '<strong>مكتبة ألعاب الورق</strong></div>' +
      '<span class="badge">واجهة أصلية + خادم شنو منو</span>';
    host.insertBefore(banner, host.firstChild);
    c.setAttribute('data-original-cards', 'last-card-library');
  }

  function enhance(gameType, ctx) {
    var c = stage();
    if (!c) return { gameType: gameType, linked: false };
    tagStage(gameType);
    if (gameType === 'tawla') {
      var original = !!c.querySelector('.canva-tawla-app');
      var framed = !!c.querySelector('.canva-board-frame');
      if (original) c.setAttribute('data-original-tawla', framed ? 'canva-build-6' : 'canva');
      return { gameType: gameType, linked: original, framed: framed };
    }
    if (gameType === 'chess') {
      ensureChessBanner(c);
      return { gameType: gameType, linked: !!c.querySelector('.chess-board') };
    }
    if (gameType === 'cards') {
      ensureCardsBanner(c, ctx);
      return { gameType: gameType, linked: !!c.querySelector('.rummy-table') };
    }
    // domino passthrough: tagged only, never wrapped or restyled.
    return { gameType: gameType, linked: true, passthrough: true };
  }

  function patchGameUI() {
    if (!window.kahwaGameUI || window.kahwaGameUI.__originalLinked) return false;
    var ui = window.kahwaGameUI;
    var rawMount = ui.mount && ui.mount.bind(ui);
    var rawRender = ui.render && ui.render.bind(ui);
    var rawDestroy = ui.destroy && ui.destroy.bind(ui);
    var lastGameType = 'domino';

    ui.mount = function (container, context) {
      lastGameType = (context && context.gameType) || 'domino';
      var out = rawMount ? rawMount(container, context) : undefined;
      try { enhance(lastGameType, context); } catch (e) { /* never break runtime */ }
      return out;
    };
    ui.render = function (container, state) {
      var out = rawRender ? rawRender(container, state) : undefined;
      try {
        var ctx = { gameType: lastGameType, state: state };
        var c = container || stage();
        if (c && lastGameType === 'chess') { tagStage('chess'); ensureChessBanner(c); }
        else if (c && lastGameType === 'cards') { tagStage('cards'); ensureCardsBanner(c, ctx); }
        else if (c && lastGameType === 'tawla') { tagStage('tawla'); if (c.querySelector('.canva-tawla-app')) c.setAttribute('data-original-tawla', c.querySelector('.canva-board-frame') ? 'canva-build-6' : 'canva'); }
      } catch (e) { /* never break runtime */ }
      return out;
    };
    ui.destroy = function () {
      var out = rawDestroy ? rawDestroy() : undefined;
      try {
        var c = stage();
        if (c) {
          c.removeAttribute('data-original-ui');
          c.removeAttribute('data-original-tawla');
          c.removeAttribute('data-original-chess');
          c.removeAttribute('data-original-cards');
          c.classList.remove('chess-original-linked', 'cards-original-linked');
        }
        document.body.classList.remove('kahwa-original-active');
        lastGameType = 'domino';
      } catch (e) { /* never break runtime */ }
      return out;
    };
    ui.__originalLinked = VERSION;
    ui.__lastOriginalGame = function () { return lastGameType; };
    return true;
  }

  // Patch now (this script loads after kahwa-game-ui.js) and re-patch on
  // DOMContentLoaded in case of deferred parsing.
  try { patchGameUI(); } catch (e) { /* never break runtime */ }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { try { patchGameUI(); } catch (e) {} });
  }

  window.kahwaOriginalUI = {
    version: VERSION,
    games: { tawla: 'canva-build-6', chess: 'realistic', cards: 'last-card-library', domino: 'passthrough' },
    enhance: enhance,
    isOriginalActive: function (gameType) {
      var c = stage();
      if (!c) return false;
      if (gameType === 'tawla') return !!c.querySelector('.canva-tawla-app');
      if (gameType === 'chess') return c.classList.contains('chess-original-linked');
      if (gameType === 'cards') return c.classList.contains('cards-original-linked');
      if (gameType === 'domino') return c.getAttribute('data-original-ui') === 'domino-passthrough' || c.getAttribute('data-original-ui') === 'domino';
      return c.getAttribute('data-original-ui') === String(gameType);
    }
  };
})();
