/* ==========================================================================
 * Kahwa chess — preserved Canva original mounted as the runtime board.
 * Version: 20260919-canva-runtime-1
 * Original (read-only, never edited): original-assets/chess/chess-original.html
 *
 * TEMPLATE below is the original <body> transplanted VERBATIM (everything
 * except the trailing local-simulation <script>): same .app-shell header,
 * clocks, .chess-frame>#board.board, turn card, status, history, players,
 * help, spectator drawer and promotion modal. A contract test diffs the
 * transplant skeleton against the original file on every run.
 *
 * What the adapter does (and does NOT do):
 * - Board squares/pieces/coords/history/audience/promotion use the ORIGINAL
 *   component markup (.square/.piece/.coord/.promotion-option/.spectator-row).
 * - Every position/turn/legal/highlight comes from the authoritative engine
 *   state (public/private/legalActions); every click sends a REAL action via
 *   SocialAPI to /api/game-rooms/:id/action. No move generation, no local search,
 *   no AI, no local game, no timers that affect play (clocks show the side
 *   to move; 05:00 stays static because the engine has no time control).
 * - Local-only original controls are transplanted but hidden at runtime:
 *   #ai-mode, #local-mode, #controls-panel (new/undo/redo), #settings-open,
 *   #settings-modal, offline banner, #spectator-toggle. The drawer instead
 *   lists REAL room spectators; the promotion modal makes REAL choices.
 * - Resign has no original control and is intentionally not added (room
 *   toolbar keeps owner close/leave). Engine resign stays API-available.
 * ========================================================================== */
(function () {
'use strict';
var TEMPLATE = `<div class="app-shell">
   <header class="max-w-[1450px] mx-auto flex flex-wrap items-center justify-between gap-3 mb-5">
    <div class="flex items-center gap-3">
     <div class="brand-mark" aria-hidden="true"><i data-lucide="crown" width="25"></i>
     </div>
     <div>
      <p data-template-id="brand-kicker" class="canva-text small-title m-0" style="color: rgb(139, 81, 51); font-weight: 700; font-style: normal; font-size: 12px;">لعبة استراتيجية عربية</p>
      <h1 data-template-id="app-title" class="canva-text font-bold m-0" style="color: rgb(50, 23, 11); font-weight: 700; font-style: normal; font-size: 32px;">شطرنج واقعي</h1>
     </div><span data-template-id="live-badge" class="canva-tag badge" style="background: rgb(37, 79, 56); color: rgb(255, 240, 202); font-weight: 700; font-style: normal; font-size: 16px;">الرقعة جاهزة</span>
    </div>
    <nav aria-label="أنماط وأدوات الشطرنج" class="flex flex-wrap gap-2">
     <button id="ai-mode" data-template-id="ai-mode-button" class="canva-button btn btn-blue" type="button" style="background: rgb(28, 113, 157); color: rgb(244, 251, 255); font-weight: 700;"><i data-lucide="bot" width="17" aria-hidden="true"></i><span data-template-id="ai-mode-label" class="canva-text" style="font-weight: 700; font-style: normal; font-size: 16px;">ضد الذكاء الاصطناعي</span></button> <button id="local-mode" data-template-id="local-mode-button" class="canva-button btn btn-gold" type="button" style="background: rgb(240, 208, 148); color: rgb(75, 38, 18); font-weight: 700;"><i data-lucide="users-round" width="17" aria-hidden="true"></i><span data-template-id="local-mode-label" class="canva-text" style="font-weight: 700; font-style: normal; font-size: 16px;">لاعبان محلياً</span></button> <button id="spectators-open" data-template-id="spectators-button" class="canva-button btn btn-gold" type="button" style="background: rgb(240, 208, 148); color: rgb(75, 38, 18); font-weight: 700;"><i data-lucide="eye" width="17" aria-hidden="true"></i><span data-template-id="spectators-label" class="canva-text" style="font-weight: 700; font-style: normal; font-size: 16px;">المتفرجون</span></button> <button id="settings-open" data-template-id="settings-button" class="canva-button btn btn-muted" type="button" style="background: rgb(232, 219, 194); color: rgb(91, 71, 56); font-weight: 700;"><i data-lucide="sliders-horizontal" width="17" aria-hidden="true"></i><span data-template-id="settings-label" class="canva-text" style="font-weight: 700; font-style: normal; font-size: 16px;">الإعدادات</span></button>
    </nav>
   </header>
   <main class="max-w-[1450px] mx-auto">
    <section class="flex flex-wrap items-center justify-between gap-3 mb-4" aria-label="حالة المباراة">
     <div>
      <p data-template-id="game-kicker" class="canva-text small-title m-0" style="color: rgb(139, 81, 51); font-weight: 700; font-style: normal; font-size: 12px;">مباراة مباشرة</p>
      <h2 data-template-id="game-title" class="canva-text font-bold m-0" style="color: rgb(50, 23, 11); font-weight: 700; font-style: normal; font-size: 24px;">رقعة الشطرنج</h2>
     </div>
     <div data-template-id="turn-card" class="canva-panel paper px-4 py-3" style="background: rgb(255, 248, 233);">
      <p id="turn-title" class="font-bold m-0" aria-live="polite"></p>
      <p id="turn-detail" class="text-xs text-[#704126] mt-1 mb-0"></p>
     </div>
    </section>
    <div id="spectator-banner" data-template-id="spectator-banner" class="canva-banner hidden mb-3 rounded-xl p-3 font-bold" aria-live="polite" style="background: rgb(223, 241, 246); color: rgb(22, 81, 110); font-weight: 700;"></div>
    <div class="grid xl:grid-cols-[minmax(0,1fr)_305px] gap-5 items-start">
     <section class="min-w-0">
      <div class="flex gap-3 justify-center mb-3">
       <div id="black-clock" class="clock">
        <p data-template-id="black-clock-label" class="canva-text text-xs font-bold m-0" style="color: rgb(255, 242, 210); font-weight: 700; font-style: normal; font-size: 16px;">الأسود</p>
        <p id="black-time" class="clock-time m-0">05:00</p>
       </div>
       <div id="white-clock" class="clock">
        <p data-template-id="white-clock-label" class="canva-text text-xs font-bold m-0" style="color: rgb(255, 242, 210); font-weight: 700; font-style: normal; font-size: 16px;">الأبيض</p>
        <p id="white-time" class="clock-time m-0">05:00</p>
       </div>
      </div>
      <div class="chess-frame">
       <div id="board" class="board" role="grid" aria-label="رقعة شطرنج تفاعلية"></div>
      </div>
      <p data-template-id="board-caption" class="canva-text text-center text-sm font-bold mt-3 mb-0" style="color: rgb(112, 64, 33); font-weight: 700; font-style: normal; font-size: 12px;">اضغط القطعة ثم اختر مربعاً قانونياً مضاءً. تعمل الرقعة باللمس ولوحة المفاتيح.</p>
      <div id="status-message" class="status mt-4" aria-live="polite"></div>
      <div data-template-id="controls-panel" class="canva-panel paper mt-4 p-3 flex flex-wrap justify-center gap-2" style="background: rgb(255, 248, 233);">
       <button id="new-game" data-template-id="new-game-button" class="canva-button btn btn-primary" type="button" style="background: rgb(128, 53, 31); color: rgb(255, 245, 220); font-weight: 700;"><i data-lucide="plus" width="16" aria-hidden="true"></i><span data-template-id="new-game-label" class="canva-text" style="font-weight: 700; font-style: normal; font-size: 16px;">مباراة جديدة</span></button> <button id="undo-button" data-template-id="undo-button" class="canva-button btn btn-gold" type="button" style="background: rgb(240, 208, 148); color: rgb(75, 38, 18); font-weight: 700;"><i data-lucide="undo-2" width="16" aria-hidden="true"></i><span data-template-id="undo-label" class="canva-text" style="font-weight: 700; font-style: normal; font-size: 16px;">تراجع</span></button> <button id="redo-button" data-template-id="redo-button" class="canva-button btn btn-muted" type="button" style="background: rgb(232, 219, 194); color: rgb(91, 71, 56); font-weight: 700;"><i data-lucide="redo-2" width="16" aria-hidden="true"></i><span data-template-id="redo-label" class="canva-text" style="font-weight: 700; font-style: normal; font-size: 16px;">إعادة</span></button>
      </div>
     </section>
     <aside class="space-y-4">
      <section data-template-id="players-panel" class="canva-panel paper p-4" style="background: rgb(255, 248, 233);">
       <h3 data-template-id="players-title" class="canva-text font-bold mb-3" style="color: rgb(61, 29, 15); font-weight: 700; font-style: normal; font-size: 19px;">اللاعبون</h3>
       <div class="space-y-3">
        <div class="flex justify-between items-center"><span id="white-player" class="font-bold"></span><span>♔</span>
        </div>
        <div class="border-t border-dashed border-[#d9c4a1]"></div>
        <div class="flex justify-between items-center"><span id="black-player" class="font-bold"></span><span>♚</span>
        </div>
       </div>
      </section>
      <section data-template-id="history-panel" class="canva-panel paper p-4" style="background: rgb(255, 248, 233);">
       <h3 data-template-id="history-title" class="canva-text font-bold mb-2" style="color: rgb(61, 29, 15); font-weight: 700; font-style: normal; font-size: 19px;">سجل النقلات</h3>
       <ol id="history" class="history list-none m-0 p-0"></ol>
      </section>
      <section data-template-id="help-panel" class="canva-panel paper p-4" style="background: rgb(244, 226, 186);">
       <h3 data-template-id="help-title" class="canva-text font-bold mb-2" style="color: rgb(61, 29, 15); font-weight: 700; font-style: normal; font-size: 19px;">قواعد مفعلة</h3>
       <p data-template-id="help-copy" class="canva-text text-sm leading-7 m-0" style="color: rgb(112, 65, 38); font-weight: 400; font-style: normal; font-size: 16px;">النقلات القانونية، الكش، الكش مات، التبييت، الأخذ بالتجاوز وترقية البيدق مفعلة داخل الرقعة.</p>
      </section>
     </aside>
    </div>
   </main>
  </div>
  <div id="drawer-backdrop" class="backdrop"></div>
  <aside id="spectator-drawer" class="drawer" aria-hidden="true" aria-label="لوحة المتفرجين">
   <div class="flex justify-between items-center gap-3 mb-4">
    <div>
     <p data-template-id="spectator-kicker" class="canva-text small-title m-0" style="color: rgb(139, 81, 51); font-weight: 700; font-style: normal; font-size: 12px;">لوحة المباراة</p>
     <h2 data-template-id="spectator-title" class="canva-text font-bold m-0" style="color: rgb(50, 23, 11); font-weight: 700; font-style: normal; font-size: 24px;">وضع المتفرجين</h2>
    </div><button id="drawer-close" class="btn btn-muted p-2" type="button" aria-label="إغلاق لوحة المتفرجين"><i data-lucide="x" width="18"></i></button>
   </div>
   <div data-template-id="offline-banner" class="canva-banner rounded-xl p-3 text-sm font-bold mb-4" style="background: rgb(223, 241, 246); color: rgb(22, 81, 110); font-weight: 700; font-style: normal; font-size: 16px;">أوفلاين — قائمة عرض تجريبية محلية</div>
   <section data-template-id="spectator-panel" class="canva-panel paper p-4" style="background: rgb(255, 248, 233);">
    <p data-template-id="spectator-copy" class="canva-text text-sm leading-7 mt-0" style="color: rgb(112, 65, 38); font-weight: 400; font-style: normal; font-size: 16px;">يمكن للمتفرج متابعة الرقعة وحالة المباراة فقط. لا يسمح له بتحريك القطع.</p><button id="spectator-toggle" data-template-id="spectator-toggle-button" class="canva-button btn btn-primary w-full mt-2" type="button" style="background: rgb(128, 53, 31); color: rgb(255, 245, 220); font-weight: 700; font-style: normal; font-size: 16px;">الدخول كمتفرج</button>
   </section>
   <section data-template-id="audience-panel" class="canva-panel paper p-4 mt-4" style="background: rgb(255, 248, 233);">
    <div class="flex justify-between items-center">
     <h3 data-template-id="audience-title" class="canva-text font-bold m-0" style="color: rgb(61, 29, 15); font-weight: 700; font-style: normal; font-size: 19px;">المتفرجون التجريبيون</h3><span id="audience-count" class="text-sm font-bold text-[#80502e]"></span>
    </div>
    <div id="audience-list" class="mt-2"></div>
   </section>
  </aside>
  <div id="settings-modal" class="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
   <form id="settings-form" data-template-id="settings-panel" class="canva-panel modal-card paper p-6" style="background: rgb(255, 248, 233);">
    <div class="flex justify-between items-center gap-3">
     <h2 id="settings-title" data-template-id="settings-title" class="canva-text font-bold m-0" style="color: rgb(61, 29, 15); font-weight: 700; font-style: normal; font-size: 24px;">إعدادات المباراة</h2><button id="settings-close" class="btn btn-muted p-2" type="button" aria-label="إغلاق الإعدادات"><i data-lucide="x" width="18"></i></button>
    </div>
    <p data-template-id="settings-copy" class="canva-text text-sm leading-7 mt-3" style="color: rgb(112, 65, 38); font-weight: 400; font-style: normal; font-size: 16px;">اختر مستوى الذكاء وثيم الرقعة ولون القطع والوقت. تطبيق الإعدادات يبدأ مباراة جديدة.</p>
    <div class="grid sm:grid-cols-2 gap-4 mt-4">
     <div>
      <label data-template-id="ai-level-label" class="canva-text font-bold block mb-1" for="ai-level" style="color: rgb(61, 29, 15); font-weight: 700; font-style: normal; font-size: 16px;">مستوى الذكاء الاصطناعي</label> <select id="ai-level" class="field"> <option value="1">مبتدئ</option> <option value="2">سهل</option> <option value="3" selected="">متوسط</option> <option value="4">صعب</option> </select>
     </div>
     <div>
      <label data-template-id="time-label" class="canva-text font-bold block mb-1" for="time-control" style="color: rgb(61, 29, 15); font-weight: 700; font-style: normal; font-size: 16px;">المؤقت لكل لاعب</label> <select id="time-control" class="field"> <option value="60">1 دقيقة</option> <option value="180">3 دقائق</option> <option value="300" selected="">5 دقائق</option> <option value="600">10 دقائق</option> </select>
     </div>
     <div>
      <label data-template-id="theme-label" class="canva-text font-bold block mb-1" for="board-theme" style="color: rgb(61, 29, 15); font-weight: 700; font-style: normal; font-size: 16px;">ثيم ألوان الرقعة</label> <select id="board-theme" class="field"> <option value="walnut">جوز دافئ</option> <option value="midnight">ليلي داكن</option> <option value="ivory">عاجي</option> <option value="forest">غابة</option> </select>
     </div>
     <div>
      <label data-template-id="piece-style-label" class="canva-text font-bold block mb-1" for="piece-style" style="color: rgb(61, 29, 15); font-weight: 700; font-style: normal; font-size: 16px;">لون القطع</label> <select id="piece-style" class="field"> <option value="classic">كلاسيكي</option> <option value="ivory">عاجي وأسود</option> <option value="gold">ذهبي وفحمي</option> </select>
     </div>
    </div><button data-template-id="settings-save-button" class="canva-button btn btn-primary w-full mt-5" type="submit" style="background: rgb(128, 53, 31); color: rgb(255, 245, 220); font-weight: 700; font-style: normal; font-size: 16px;">حفظ وتطبيق</button>
   </form>
  </div>
  <div id="promotion-modal" class="modal" role="dialog" aria-modal="true" aria-labelledby="promotion-title">
   <section data-template-id="promotion-panel" class="canva-panel modal-card paper p-6 text-center" style="background: rgb(255, 248, 233);">
    <h2 id="promotion-title" data-template-id="promotion-title" class="canva-text font-bold mb-2" style="color: rgb(61, 29, 15); font-weight: 700; font-style: normal; font-size: 24px;">ترقية البيدق</h2>
    <p data-template-id="promotion-copy" class="canva-text mb-4" style="color: rgb(112, 65, 38); font-weight: 400; font-style: normal; font-size: 16px;">اختر القطعة الجديدة للبيدق.</p>
    <div id="promotion-options" class="flex justify-center gap-3"></div>
   </section>
  </div>
`;
var SYMBOLS = { wp:'\u2659', wn:'\u2658', wb:'\u2657', wr:'\u2656', wq:'\u2655', wk:'\u2654', bp:'\u265F', bn:'\u265E', bb:'\u265D', br:'\u265C', bq:'\u265B', bk:'\u265A' };
var NAMES = { p:'\u0628\u064A\u062F\u0642', n:'\u062D\u0635\u0627\u0646', b:'\u0641\u064A\u0644', r:'\u0631\u062E', q:'\u0648\u0632\u064A\u0631', k:'\u0645\u0644\u0643' };
var FILES = 'abcdefgh';
var ctx = null, selected = null, busy = false;
function moveId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }

function id(x) { return String((x && (x.id || x._id)) || x || ''); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function stage() { return document.getElementById('kahwa-game-stage'); }
function qs(c, s) { return c ? c.querySelector(s) : null; }
function nameOf(u) { return (u && (u.name || u.fullName || u.displayName || u.username)) || 'لاعب'; }
function legal() { return (ctx && ctx.state && ctx.state.legalActions) || []; }
function sqName(file, rankIdx) { return FILES[file] + String(rankIdx + 1); }
function isSpectator() {
  var room = (ctx && ctx.room) || {}, players = room.players || [], me = String((ctx && ctx.me) || '');
  if (!me) return true;
  return !players.some(function (p) { return id(p) === me; });
}
function setStatus(c, text, type) {
  var box = qs(c, '#status-message');
  if (!box) return;
  box.textContent = text;
  box.className = 'status mt-4 ' + (type || '');
}
function lastMoveSquares() {
  var hist = (ctx && ctx.state && ctx.state.public && ctx.state.public.moveHistory) || [];
  if (!hist.length) return {};
  var m = hist[hist.length - 1], out = {};
  if (m && m.from) out[m.from] = 'last';
  if (m && m.to) out[m.to] = 'last';
  return out;
}
function paintBoard(c) {
  var board = qs(c, '#board');
  if (!board) return;
  var pub = (ctx && ctx.state && ctx.state.public) || {};
  var priv = (ctx && ctx.state && ctx.state.private) || {};
  var cells = pub.board || [];
  var flip = priv.myColor === 'black';
  var last = lastMoveSquares();
  var targets = {};
  if (selected) legal().forEach(function (a) {
    if (a && a.type === 'move' && a.from === selected) targets[a.to] = a;
  });
  board.innerHTML = '';
  for (var dr = 0; dr < 8; dr++) for (var dc = 0; dc < 8; dc++) {
    var r = flip ? 7 - dr : dr, file = flip ? 7 - dc : dc;
    var rankIdx = 7 - r, sq = sqName(file, rankIdx);
    var piece = cells[r * 8 + file] || null;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'square ' + (((file + rankIdx) % 2) ? 'dark' : 'light');
    btn.setAttribute('role', 'gridcell');
    btn.setAttribute('aria-label', sq + ' ' + (piece ? (NAMES[piece.type] || '') + ' ' + (piece.color === 'white' ? 'أبيض' : 'أسود') : 'فارغ'));
    if (last[sq]) btn.classList.add('last');
    if (selected === sq) btn.classList.add('selected');
    if (targets[sq]) btn.classList.add(piece ? 'capture' : 'legal');
    if (piece) {
      var key = (piece.color === 'white' ? 'w' : 'b') + piece.type;
      btn.innerHTML = '<span class="piece ' + (piece.color === 'white' ? 'white' : 'black') + '">' + (SYMBOLS[key] || '') + '</span>';
    }
    if (dr === 7) btn.innerHTML += '<span class="coord file">' + FILES[file] + '</span>';
    if (dc === 0) btn.innerHTML += '<span class="coord rank">' + String(rankIdx + 1) + '</span>';
    (function (rr, cc, ss) { btn.addEventListener('click', function () { pick(c, ss); }); })(r, file, sq);
    board.appendChild(btn);
  }
}
function paintHistory(c) {
  var list = qs(c, '#history');
  if (!list) return;
  var hist = (ctx && ctx.state && ctx.state.public && ctx.state.public.moveHistory) || [];
  if (!hist.length) { list.innerHTML = '<li>لم تبدأ النقلات بعد.</li>'; return; }
  var html = '';
  hist.forEach(function (m, i) {
    var label = esc((m && (m.san || ((m.from || '') + '-' + (m.to || '')))) || '');
    if (i % 2 === 0) html += '<li><b>' + (Math.floor(i / 2) + 1) + '.</b> ' + label;
    else html += ' &nbsp; ' + label + '</li>';
  });
  if (hist.length % 2) html += '</li>';
  list.innerHTML = html;
}
function paintPanels(c) {
  var pub = (ctx && ctx.state && ctx.state.public) || {};
  var priv = (ctx && ctx.state && ctx.state.private) || {};
  var room = (ctx && ctx.room) || {}, players = room.players || [];
  var me = String((ctx && ctx.me) || '');
  var turnColor = pub.turn === 'black' ? 'black' : 'white';
  var turnAr = turnColor === 'white' ? 'الأبيض' : 'الأسود';
  var title = qs(c, '#turn-title'), detail = qs(c, '#turn-detail');
  if (title) {
    if (pub.finished) title.textContent = pub.winner === 'draw' ? 'تعادل' : ('فاز ' + (pub.winner === 'white' ? 'الأبيض' : 'الأسود'));
    else title.textContent = 'دور ' + turnAr + (pub.check ? ' — كش!' : '');
  }
  if (detail) {
    var n = ((pub.moveHistory) || []).length;
    detail.textContent = 'غرفة شنو منو · ' + n + ' نقلة' + (isSpectator() ? ' · تشاهد فقط' : (priv.turn ? ' · دورك' : ''));
  }
  var wp = qs(c, '#white-player'), bp = qs(c, '#black-player');
  var p0 = players[0], p1 = players[1];
  if (wp) wp.textContent = nameOf(p0) + (p0 && id(p0) === me ? ' (أنت)' : '');
  if (bp) bp.textContent = nameOf(p1) + (p1 && id(p1) === me ? ' (أنت)' : '');
  ['w', 'b'].forEach(function (color) {
    var clock = qs(c, '#' + (color === 'w' ? 'white' : 'black') + '-clock');
    var time = qs(c, '#' + (color === 'w' ? 'white' : 'black') + '-time');
    if (clock) clock.classList.toggle('active', !pub.finished && ((turnColor === 'white') === (color === 'w')));
    if (time) time.textContent = '05:00';
  });
  var badge = qs(c, '[data-template-id="live-badge"]');
  if (badge) badge.textContent = pub.finished ? (pub.winner === 'draw' ? 'تعادل' : 'انتهت المباراة') : (pub.check ? 'كش!' : 'الرقعة جاهزة');
  var banner = qs(c, '#spectator-banner');
  if (banner) banner.classList.toggle('hidden', !isSpectator());
  if (!pub.finished) {
    if (isSpectator()) setStatus(c, 'وضع المتفرج نشط: يمكنك مشاهدة المباراة فقط ولا يمكنك تحريك القطع.', '');
    else if (priv.turn) setStatus(c, pub.check ? 'كش — دورك.' : 'دورك: اختر قطعة ثم مربعاً مضاءً.', pub.check ? 'warning' : 'good');
    else setStatus(c, 'دور اللاعب الآخر' + (pub.check ? ' — كش.' : '.'), '');
  } else {
    var reason = pub.finishReason === 'resignation' ? 'بالاستسلام' : pub.finishReason === 'checkmate' || pub.finishReason === 'كش مات' ? 'كش مات' : '';
    setStatus(c, pub.winner === 'draw' ? 'انتهت المباراة بالتعادل.' : ('فاز ' + (pub.winner === 'white' ? 'الأبيض' : 'الأسود') + (reason ? ' ' + reason + '.' : '.')), 'good');
  }
}
function paintAudience(c) {
  var room = (ctx && ctx.room) || {};
  var list = (room.spectators || []).map(function (s) { return { name: nameOf(s), status: 'يشاهد الآن' }; });
  var count = qs(c, '#audience-count'), box = qs(c, '#audience-list');
  if (count) count.textContent = list.length + ' متفرجين';
  if (box) box.innerHTML = list.length ? list.map(function (p) {
    return '<div class="spectator-row"><span class="avatar">' + esc(p.name[0] || 'م') + '</span><div><b>' + esc(p.name) + '</b><p class="text-xs text-[#80502e] m-0">' + esc(p.status) + '</p></div></div>';
  }).join('') : '<div class="spectator-row"><span class="avatar">–</span><div><b>لا يوجد متفرجون</b><p class="text-xs text-[#80502e] m-0">الغرفة مفتوحة للمشاهدة حسب الإعدادات</p></div></div>';
}
function showDrawer(c) {
  var d = qs(c, '#spectator-drawer'), b = qs(c, '#drawer-backdrop');
  if (d) { d.classList.add('open'); d.setAttribute('aria-hidden', 'false'); }
  if (b) b.classList.add('show');
  paintAudience(c);
}
function hideDrawer(c) {
  var d = qs(c, '#spectator-drawer'), b = qs(c, '#drawer-backdrop');
  if (d) { d.classList.remove('open'); d.setAttribute('aria-hidden', 'true'); }
  if (b) b.classList.remove('show');
}
function askPromotion(c, moves) {
  var box = qs(c, '#promotion-options'), modal = qs(c, '#promotion-modal');
  if (!box || !modal) { act(moves[0]); return; }
  var myWhite = ((ctx && ctx.state && ctx.state.private && ctx.state.private.myColor) || 'white') === 'white';
  box.innerHTML = '';
  ['q', 'r', 'b', 'n'].forEach(function (type) {
    var mv = moves.filter(function (m) { return (m.promotion || 'q') === type; })[0];
    if (!mv) return;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'promotion-option';
    btn.innerHTML = '<span class="piece ' + (myWhite ? 'white' : 'black') + '">' + (SYMBOLS[(myWhite ? 'w' : 'b') + type] || '') + '</span>';
    btn.setAttribute('aria-label', 'ترقية إلى ' + (NAMES[type] || ''));
    (function (m) { btn.addEventListener('click', function () { modal.classList.remove('show'); act(m); }); })(mv);
    box.appendChild(btn);
  });
  modal.classList.add('show');
  if (window.lucide && lucide.createIcons) { try { lucide.createIcons(); } catch (e) {} }
}
function pick(c, sq) {
  if (busy || isSpectator()) return;
  var mine = legal().some(function (a) { return a && a.type === 'move' && a.from === sq; });
  if (selected) {
    var moves = legal().filter(function (a) { return a && a.type === 'move' && a.from === selected && a.to === sq; });
    if (moves.length) {
      if (moves.some(function (m) { return m.promotion; })) return askPromotion(c, moves);
      return act(moves[0]);
    }
  }
  selected = mine ? sq : null;
  paintBoard(c);
  if (!mine && sq) setStatus(c, 'اختر قطعة مضيئة ثم مربعاً قانونياً.', '');
}
function act(a) {
  if (busy || !ctx) return;
  busy = true;
  a.moveId = a.moveId || moveId();
  setStatus(stage(), 'جارٍ إرسال النقلة إلى الخادم...', 'thinking');
  SocialAPI.request('/api/game-rooms/' + encodeURIComponent(ctx.roomId) + '/action', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a)
  }).then(function (d) {
    selected = null;
    if (d && d.room && window.kahwaApplyActionResponse) return window.kahwaApplyActionResponse(d.room);
    if (window.reloadKahwaRoom) return window.reloadKahwaRoom();
  }).catch(function (e) {
    setStatus(stage(), (e && e.message) || 'تعذرت النقلة', 'warning');
  }).finally(function () { busy = false; });
}
function hideLocal(c) {
  ['#ai-mode', '#local-mode', '#controls-panel', '#settings-open', '#settings-modal', '#spectator-toggle'].forEach(function (s) {
    var el = qs(c, s);
    if (el) el.style.display = 'none';
  });
  var off = qs(c, '[data-template-id="offline-banner"]');
  if (off) off.style.display = 'none';
  var at = qs(c, '[data-template-id="audience-title"]');
  if (at) at.textContent = 'المتفرجون';
}
function bindStatic(c) {
  if (c.__chessCanvaBound) return;
  c.__chessCanvaBound = true;
  var so = qs(c, '#spectators-open');
  if (so) so.addEventListener('click', function () { showDrawer(c); });
  var dc = qs(c, '#drawer-close');
  if (dc) dc.addEventListener('click', function () { hideDrawer(c); });
  var bd = qs(c, '#drawer-backdrop');
  if (bd) bd.addEventListener('click', function () { hideDrawer(c); });
}
function render(c, x) {
  ctx = x || ctx;
  c = c || stage();
  if (!c) return;
  paintBoard(c);
  paintPanels(c);
  paintAudience(c);
}
function mount(c, x) {
  ctx = x;
  selected = null;
  document.body.classList.add('chess-active');
  if (!c.querySelector(':scope > .app-shell')) {
    c.innerHTML = TEMPLATE;
    c.__chessCanvaBound = false;
    bindStatic(c);
    hideLocal(c);
    if (window.lucide && lucide.createIcons) { try { lucide.createIcons(); } catch (e) {} }
  }
  render(c, x);
}
window.kahwaChessCanvaUI = {
  mount: mount,
  render: render,
  bindActions: function () {},
  setLegalActions: function (a) { if (ctx && ctx.state) { ctx.state.legalActions = a || []; render(stage(), ctx); } },
  setLoading: function (v) { busy = !!v; },
  showSuccess: function (m) { setStatus(stage(), m, 'good'); },
  showError: function (m) { setStatus(stage(), m, 'warning'); },
  destroy: function () { var c = stage(); if (c) { c.innerHTML = ''; c.__chessCanvaBound = false; } ctx = null; selected = null; document.body.classList.remove('chess-active'); }
};
})();
