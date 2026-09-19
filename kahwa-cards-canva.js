/* ==========================================================================
 * Kahwa cards — preserved Canva original mounted as the runtime table.
 * Version: 20260919-canva-runtime-1
 * Original (read-only, never edited): canva-originals/cards/index.html
 *
 * TEMPLATE below is transplanted VERBATIM from the original file: the
 * #game-screen table (players-area, turn-banner, center-area, action-area,
 * hand-area, event-log, chat, voice), #results-screen, #rules-modal,
 * #settings-modal and #toast. A contract test diffs the transplant
 * skeleton against the original file on every run.
 *
 * Deliberate, documented exclusions (local-simulation setup, NOT the game):
 * - #library-screen / #setup-screen / #room-screen (offline setup + rooms
 *   the original itself labels "محاكاة محلية"; the real room comes from
 *   game-room.html + API/Socket instead).
 * - #suit-modal (Last-Card "8" rule does not exist in the rummy engine;
 *   opening it would be fake) and #game-card-template (library helper).
 *
 * What the adapter does (and does NOT do):
 * - Cards/players/log/center/results use the ORIGINAL component markup
 *   (.playing-card/.rank/.suit/.corner/.back/.turn, event <li>, result rows).
 * - Every hand/count/turn/meld comes from the authoritative cards engine
 *   (public/private/legalActions); every button sends a REAL action via
 *   SocialAPI to /api/game-rooms/:id/action. No bots, no local deck, no
 *   fake rounds, no shuffling in the client.
 * - simulation-badge is re-labeled to the real live state; timer, undo and
 *   the suit modal stay disabled (no such engine features); chat form is
 *   hidden because game rooms expose no chat API (sending would be fake);
 *   settings motion toggle works for real; leave/copy-code/rules/Escape
 *   are wired to the real room.
 * ========================================================================== */
(function () {
'use strict';
var TEMPLATE = `<section id="game-screen" class="screen">
     <header class="panel rounded-2xl p-3 sm:p-4 flex flex-wrap gap-3 items-center justify-between mb-4">
      <div>
       <div class="flex items-center gap-2">
        <h2 id="game-title" class="font-bold"></h2><span data-template-id="simulation-badge" class="canva-tag rounded-full px-2 py-1 text-xs" style="background: rgb(32, 107, 84); color: rgb(185, 241, 211); font-weight: 700; font-style: normal; font-size: 16px;">محاكاة محلية</span>
       </div>
       <p id="game-meta" class="text-xs text-[#b9d7ca] mt-1"></p>
      </div>
      <div class="flex flex-wrap gap-2"><button id="copy-code" type="button" class="rounded-lg px-3 py-2 bg-white/10 hover:bg-white/20 text-sm"><i data-lucide="copy" class="inline w-4"></i> نسخ الدعوة</button> <button type="button" class="rounded-lg px-3 py-2 bg-white/10 hover:bg-white/20" aria-label="القواعد" onclick="openRules()"><i data-lucide="book-open"></i></button> <button type="button" class="rounded-lg px-3 py-2 bg-white/10 hover:bg-white/20" aria-label="الإعدادات" onclick="openModal('settings-modal')"><i data-lucide="settings"></i></button> <button type="button" class="rounded-lg px-3 py-2 bg-[#8f3635] hover:bg-[#a94542]" aria-label="إنهاء المباراة" onclick="leaveGame()"><i data-lucide="log-out"></i></button>
      </div>
     </header>
     <div class="grid grid-cols-1 xl:grid-cols-[1fr_310px] gap-4">
      <section class="wood felt rounded-[2rem] p-3 sm:p-6 overflow-hidden">
       <div id="players-area" class="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3"></div>
       <div class="flex flex-col items-center justify-center py-7">
        <div id="turn-banner" class="rounded-full px-4 py-2 bg-[#052f27]/90 border border-white/15 text-center" aria-live="polite"></div>
        <div id="timer-display" class="text-[#f6c860] font-bold mt-3 hidden"></div>
        <div id="center-area" class="flex gap-6 sm:gap-10 items-end mt-6"></div>
        <div id="action-area" class="flex flex-wrap justify-center gap-2 mt-6"></div>
       </div>
       <section class="border-t border-white/15 pt-4">
        <div class="flex justify-between items-center gap-3 mb-3">
         <h3 data-template-id="hand-title" class="canva-text font-bold" style="color: rgb(237, 248, 243); font-weight: 700; font-style: normal; font-size: 19px;">أوراقك</h3><button id="undo-button" data-template-id="undo-button" class="canva-button hidden rounded-lg px-3 py-2 text-sm" type="button" style="background: rgb(10, 65, 54); color: rgb(237, 248, 243); font-weight: 600; font-style: normal; font-size: 16px;">تراجع</button>
        </div>
        <div id="hand-area" class="min-h-[115px] flex flex-wrap justify-center sm:justify-start gap-2" aria-label="أوراقك"></div>
        <p id="hand-help" class="text-sm text-[#c6e2d5] mt-3" aria-live="polite"></p>
       </section>
      </section>
      <aside class="space-y-4">
       <section class="panel rounded-2xl p-4">
        <div class="flex justify-between items-center">
         <h3 data-template-id="events-title" class="canva-text font-bold" style="color: rgb(237, 248, 243); font-weight: 700; font-style: normal; font-size: 19px;">سجل الطاولة</h3><i data-lucide="scroll-text" class="w-5 text-[#f6c860]"></i>
        </div>
        <ol id="event-log" class="max-h-52 overflow-y-auto text-sm space-y-2 mt-3 text-[#d2e6dc]" aria-live="polite"></ol>
       </section>
       <section class="panel rounded-2xl p-4">
        <h3 data-template-id="chat-title" class="canva-text font-bold" style="color: rgb(237, 248, 243); font-weight: 700; font-style: normal; font-size: 19px;">دردشة الغرفة</h3>
        <div id="chat-list" class="h-28 overflow-y-auto text-sm mt-3"></div>
        <form id="chat-form" class="flex gap-2 mt-3">
         <label class="sr-only" for="chat-input">رسالة الدردشة</label><input id="chat-input" class="min-w-0 flex-1 rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm" type="text" maxlength="140"><button type="submit" class="rounded-lg bg-[#f6c860] text-[#173126] p-2" aria-label="إرسال"><i data-lucide="send" class="w-4"></i></button>
        </form>
       </section>
       <section class="panel rounded-2xl p-4">
        <h3 data-template-id="voice-title" class="canva-text font-bold" style="color: rgb(237, 248, 243); font-weight: 700; font-style: normal; font-size: 19px;">الصوت</h3>
        <p data-template-id="voice-status" class="canva-text text-sm text-[#b8d6ca] mt-2" style="color: rgb(184, 214, 202); font-weight: 400; font-style: normal; font-size: 16px;">الصوت غير متاح حالياً. لا يتم تسجيل أو حفظ أي صوت داخل هذه اللعبة.</p>
       </section>
      </aside>
     </div>
    </section>
    <section id="results-screen" class="screen">
     <div class="py-12 flex justify-center">
      <div class="panel rounded-3xl p-6 sm:p-9 max-w-2xl w-full text-center">
       <i data-lucide="trophy" class="w-14 h-14 mx-auto text-[#f6c860]"></i>
       <h2 data-template-id="results-title" class="canva-text font-bold mt-3" style="color: rgb(246, 200, 96); font-weight: 800; font-style: normal; font-size: 24px;">نتيجة الجولة</h2>
       <p id="winner-text" class="text-xl font-bold text-[#f6c860] mt-3"></p>
       <p id="result-reason" class="text-[#c6e2d5] mt-2"></p>
       <div id="results-list" class="mt-6 text-right space-y-2"></div>
       <div class="flex flex-col sm:flex-row gap-3 mt-7">
        <button data-template-id="next-round-button" id="next-round-button" class="canva-button rounded-xl py-3 px-5 flex-1 font-bold" type="button" style="background: rgb(246, 200, 96); color: rgb(23, 49, 38); font-weight: 700; font-style: normal; font-size: 16px;">إعادة الجولة</button><button data-template-id="new-match-button" class="canva-button rounded-xl py-3 px-5 flex-1 font-bold" type="button" onclick="showScreen('library-screen')" style="background: rgb(23, 109, 88); color: rgb(255, 255, 255); font-weight: 700; font-style: normal; font-size: 16px;">العودة للمكتبة</button>
       </div>
      </div>
     </div>
    </section>
   </main>
  </div>
  <div id="rules-modal" class="modal fixed inset-0 z-50 items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="rules-title">
   <div class="panel rounded-3xl p-6 max-w-xl w-full max-h-[calc(88*min(var(--vh,1vh),1vh))] overflow-y-auto">
    <div class="flex justify-between items-center">
     <h2 data-template-id="rules-title" class="canva-text font-bold" style="color: rgb(246, 200, 96); font-weight: 700; font-style: normal; font-size: 24px;">القواعد وكيف ألعب</h2><button type="button" aria-label="إغلاق" class="p-2 hover:bg-white/10 rounded-lg" onclick="closeModal('rules-modal')"><i data-lucide="x"></i></button>
    </div>
    <div id="rules-content" class="mt-5 leading-8 text-[#d3e8de]"></div>
   </div>
  </div>
  <div id="settings-modal" class="modal fixed inset-0 z-50 items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="settings-title">
   <div class="panel rounded-3xl p-6 max-w-md w-full">
    <div class="flex justify-between items-center">
     <h2 data-template-id="settings-title" class="canva-text font-bold" style="color: rgb(246, 200, 96); font-weight: 700; font-style: normal; font-size: 24px;">إعدادات اللعب</h2><button type="button" aria-label="إغلاق" class="p-2 hover:bg-white/10 rounded-lg" onclick="closeModal('settings-modal')"><i data-lucide="x"></i></button>
    </div><label class="flex gap-3 mt-5"><input id="settings-motion" class="accent-[#f6c860] w-5 h-5" type="checkbox"><span data-template-id="settings-motion-label" class="canva-text" style="color: rgb(237, 248, 243); font-weight: 400; font-style: normal; font-size: 16px;">تقليل الحركة</span></label><label class="flex gap-3 mt-4"><input id="settings-timer" class="accent-[#f6c860] w-5 h-5" type="checkbox"><span data-template-id="settings-timer-label" class="canva-text" style="color: rgb(237, 248, 243); font-weight: 400; font-style: normal; font-size: 16px;">تفعيل مؤقت الدور</span></label>
   </div>
  </div>
  <div id="toast" class="toast fixed bottom-5 left-1/2 -translate-x-1/2 z-[70] rounded-full bg-[#f6c860] text-[#173126] px-5 py-3 font-bold text-sm" role="status"></div>
`;
var SUIT_GLYPH = { s: '\u2660', h: '\u2665', d: '\u2666', c: '\u2663' };
var SUIT_AR = { '\u2665': 'قلوب', '\u2666': 'ألماس', '\u2663': 'سباتي', '\u2660': 'بستوني' };
var ctx = null, selected = {}, busy = false;
function moveId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }

function id(x) { return String((x && (x.id || x._id)) || x || ''); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function stage() { return document.getElementById('kahwa-game-stage'); }
function qs(c, s) { return c ? c.querySelector(s) : null; }
function nameOf(u) { return (u && (u.name || u.fullName || u.displayName || u.username)) || 'لاعب'; }
function engineLegal() { return (ctx && ctx.state && ctx.state.legalActions) || []; }
function canDo(type, source) {
  return engineLegal().some(function (a) { return a && a.type === type && (!source || a.source === source); });
}
function isSpectator() {
  var room = (ctx && ctx.room) || {}, players = room.players || [], me = String((ctx && ctx.me) || '');
  if (!me) return true;
  return !players.some(function (p) { return id(p) === me; });
}
function showToast(c, t) {
  var e = qs(c, '#toast');
  if (!e) return;
  e.textContent = t;
  e.classList.add('show');
  clearTimeout(e._t);
  e._t = setTimeout(function () { e.classList.remove('show'); }, 2800);
}
function showModal(c, mid) { var m = qs(c, '#' + mid); if (m) m.classList.add('show'); }
function hideModal(c, mid) { var m = qs(c, '#' + mid); if (m) m.classList.remove('show'); }
function switchScreen(c, sid) {
  (c.querySelectorAll('.screen') || []).forEach(function (x) { x.classList.remove('active'); });
  var s = qs(c, '#' + sid);
  if (s) s.classList.add('active');
}
function glyphOf(card) { return SUIT_GLYPH[card.suit] || ''; }
function labelOf(card) { return card.rank + ' ' + (SUIT_AR[glyphOf(card)] || ''); }
function makeCard(card, enabled) {
  var b = document.createElement('button');
  b.type = 'button';
  var red = card.suit === 'h' || card.suit === 'd';
  b.className = 'playing-card ' + (red ? 'red' : 'black') + (enabled ? ' legal' : '');
  b.disabled = !enabled;
  b.setAttribute('aria-label', labelOf(card) + (enabled ? '، قابلة للعب' : '، غير قابلة للعب'));
  b.innerHTML = '<span class="rank">' + esc(card.rank) + '</span><span class="suit">' + esc(glyphOf(card)) + '</span><span class="rank corner">' + esc(card.rank) + '</span>';
  return b;
}
function makeBack(enabled) {
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'playing-card back';
  b.disabled = !enabled;
  b.setAttribute('aria-label', 'ورقة مقلوبة');
  return b;
}
function paintPlayers(c) {
  var pub = (ctx && ctx.state && ctx.state.public) || {};
  var room = (ctx && ctx.room) || {};
  var me = String((ctx && ctx.me) || '');
  var box = qs(c, '#players-area');
  if (!box) return;
  box.innerHTML = '';
  var names = {};
  (room.players || []).forEach(function (p) { names[id(p)] = nameOf(p); });
  (pub.players || []).forEach(function (p) {
    var e = document.createElement('article');
    e.className = 'rounded-xl p-3 bg-[#042f27]/80 border border-white/10' + (turnId() === String(p.id) ? ' turn' : '');
    var mine = String(p.id) === me;
    e.innerHTML = '<div class="flex justify-between gap-2"><strong class="text-sm">' + esc(names[p.id] || 'لاعب') + (mine ? ' <span class="text-[#f6c860]">أنت</span>' : '') + '</strong><span class="text-xs text-[#c6e2d5]">' + Number(p.score || 0) + ' نقطة</span></div><p class="text-xs text-[#b8d6ca] mt-2">الأوراق: ' + Number(p.handCount || 0) + '</p>';
    box.appendChild(e);
  });
}
function paintCenter(c) {
  var pub = (ctx && ctx.state && ctx.state.public) || {};
  var a = qs(c, '#center-area');
  if (!a) return;
  a.innerHTML = '';
  var stock = makeBack(canDo('draw', 'stock'));
  stock.addEventListener('click', function () { doAct({ type: 'draw', source: 'stock' }); });
  a.appendChild(stock);
  if (pub.discardTop) {
    var top = makeCard(pub.discardTop, canDo('draw', 'discard'));
    top.addEventListener('click', function () { doAct({ type: 'draw', source: 'discard' }); });
    a.appendChild(top);
  }
  var label = document.createElement('p');
  label.className = 'absolute mt-32 text-sm text-[#f6c860]';
  var dt = pub.discardTop ? labelOf(pub.discardTop) : 'لا يوجد';
  label.textContent = 'كومة السحب: ' + Number(pub.stockCount || 0) + ' · المكشوفة: ' + dt;
  a.appendChild(label);
  (pub.melds || []).forEach(function (m) {
    var row = document.createElement('div');
    row.className = 'flex flex-wrap justify-center gap-2 mt-6';
    row.setAttribute('aria-label', 'مجموعة مكوّنة');
    (m.cards || []).forEach(function (card) { row.appendChild(makeCard(card, false)); });
    var cap = document.createElement('p');
    cap.className = 'text-xs text-[#c6e2d5]';
    cap.textContent = playerName(String(m.playerId)) + ' · ' + Number(m.points || 0) + ' نقطة';
    var wrap = document.createElement('div');
    wrap.appendChild(row); wrap.appendChild(cap);
    a.appendChild(wrap);
  });
}
function playerName(pid) {
  var room = (ctx && ctx.room) || {};
  var found = (room.players || []).filter(function (p) { return id(p) === String(pid); })[0];
  return found ? nameOf(found) : 'لاعب';
}
function turnId() {
  var pub = (ctx && ctx.state && ctx.state.public) || ctx.state || {};
  var t = (pub && pub.turn !== undefined) ? pub.turn : null;
  if (t && typeof t === 'object') return String(t.id || '');
  return String(t || '');
}
function paintHand(c) {
  var priv = (ctx && ctx.state && ctx.state.private) || {};
  var area = qs(c, '#hand-area'), help = qs(c, '#hand-help');
  if (!area) return;
  area.innerHTML = '';
  var hand = priv.hand || [];
  var mayPick = !isSpectator() && priv.turn && priv.phase === 'play';
  Object.keys(selected).forEach(function (k) {
    if (!hand.some(function (x) { return String(x.id) === String(k); })) delete selected[k];
  });
  hand.forEach(function (card) {
    var on = !!selected[String(card.id)];
    var e = makeCard(card, mayPick);
    if (on) { e.classList.add('legal'); e.setAttribute('aria-pressed', 'true'); }
    e.addEventListener('click', function () {
      if (!mayPick) return;
      if (selected[String(card.id)]) delete selected[String(card.id)];
      else selected[String(card.id)] = true;
      paintHand(c); paintActions(c);
    });
    area.appendChild(e);
  });
  if (help) {
    var n = Object.keys(selected).length;
    help.textContent = isSpectator() ? 'أنت متفرج: تشاهد الطاولة فقط.' :
      !priv.turn ? 'انتظر دورك؛ الأوراق غير القابلة للعب معطلة.' :
      priv.phase === 'draw' ? 'دورك: اسحب من الكومة أو خذ المكشوفة.' :
      (n ? ('حددت ' + n + ' — أكمل مجموعة من 3+ أو ارمِ ورقة واحدة.') : 'اختر أوراق مجموعة صالحة ثم كوّنها، أو ارمِ ورقة واحدة.');
  }
}
function paintActions(c) {
  var area = qs(c, '#action-area');
  if (!area) return;
  area.innerHTML = '';
  var priv = (ctx && ctx.state && ctx.state.private) || {};
  var mine = !isSpectator() && priv.turn;
  function btn(text, primary, enabled, fn) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = primary ? 'rounded-xl bg-[#f6c860] text-[#173126] px-5 py-3 font-bold' : 'rounded-xl bg-white/10 px-5 py-3';
    b.disabled = !enabled;
    b.textContent = text;
    b.addEventListener('click', fn);
    area.appendChild(b);
  }
  if (priv.phase === 'draw') {
    btn('اسحب من الكومة', true, mine && canDo('draw', 'stock'), function () { doAct({ type: 'draw', source: 'stock' }); });
    btn('خذ المكشوفة', false, mine && canDo('draw', 'discard'), function () { doAct({ type: 'draw', source: 'discard' }); });
  } else {
    var n = Object.keys(selected).length;
    btn('كوّن مجموعة' + (n ? ' (' + n + ')' : ''), true, mine && canDo('meld') && n >= 3, function () {
      doAct({ type: 'meld', cardIds: Object.keys(selected) });
    });
    btn('ارمِ المحددة', false, mine && canDo('discard') && n === 1, function () {
      if (Object.keys(selected).length !== 1) { showToast(c, 'ارمِ ورقة واحدة فقط'); return; }
      doAct({ type: 'discard', cardId: Object.keys(selected)[0] });
    });
  }
}
function paintEvents(c) {
  var pub = (ctx && ctx.state && ctx.state.public) || {};
  var box = qs(c, '#event-log');
  if (!box) return;
  var ev = [];
  (pub.melds || []).slice().reverse().forEach(function (m) {
    ev.push(esc(playerName(String(m.playerId))) + ' كوّن مجموعة (+' + Number(m.points || 0) + ').');
  });
  ev.push('الدور: ' + esc(playerName(turnId())) + (pub.phase === 'draw' ? ' — مرحلة السحب.' : ' — مرحلة اللعب.'));
  ev.push('السحب: ' + Number(pub.stockCount || 0) + ' · الرمي: ' + Number(pub.discardCount || 0) + ' · الحركات: ' + Number(pub.moveCount || 0) + '.');
  box.innerHTML = ev.map(function (x) { return '<li class="border-b border-white/10 pb-2">' + x + '</li>'; }).join('');
}
function paintHead(c) {
  var pub = (ctx && ctx.state && ctx.state.public) || {};
  var priv = (ctx && ctx.state && ctx.state.private) || {};
  var room = (ctx && ctx.room) || {};
  var t = qs(c, '#game-title');
  if (t) t.textContent = room.name || 'تحدي الأوراق';
  var meta = qs(c, '#game-meta');
  if (meta) meta.textContent = 'اللاعبون ' + ((pub.players || []).length) + ' · رمز الغرفة ' + (room.roomCode || room.code || '—');
  var badge = qs(c, '[data-template-id="simulation-badge"]');
  if (badge) badge.textContent = 'مباشر';
  var banner = qs(c, '#turn-banner');
  if (banner) banner.textContent = isSpectator() ? ('مشاهدة: دور ' + playerName(turnId())) : (priv.turn ? 'دورك الآن' : ('دور ' + playerName(turnId()) + ' الآن'));
  var timer = qs(c, '#timer-display');
  if (timer) timer.classList.add('hidden');
}
function paintResults(c) {
  var pub = (ctx && ctx.state && ctx.state.public) || {};
  if (!pub.finished) { switchScreen(c, 'game-screen'); return; }
  switchScreen(c, 'results-screen');
  var wt = qs(c, '#winner-text'), rr = qs(c, '#result-reason'), rl = qs(c, '#results-list');
  if (wt) wt.textContent = 'الفائز: ' + playerName(String(pub.winner));
  if (rr) rr.textContent = pub.finishReason === 'empty_hand' ? 'تخلّص من جميع أوراقه.' : 'انتهت الجولة.';
  if (rl) {
    var rows = (pub.players || []).slice().sort(function (a, b) { return Number(b.score || 0) - Number(a.score || 0); });
    rl.innerHTML = rows.map(function (p, i) {
      return '<div class="rounded-xl border ' + (i === 0 ? 'border-[#f6c860]/40 bg-[#f6c860]/10' : 'border-white/10 bg-white/5') + ' p-3 flex justify-between"><span>' + (i + 1) + '. ' + esc(playerName(String(p.id))) + '</span><strong>' + Number(p.score || 0) + ' نقطة</strong></div>';
    }).join('');
  }
}
function paintChat(c) {
  var form = qs(c, '#chat-form');
  if (form) form.style.display = 'none';
  var list = qs(c, '#chat-list');
  if (list) list.innerHTML = '<p class="border-b border-white/10 py-2">دردشة الغرفة غير متوفرة في نسخة الخادم الحالية — سجل الطاولة يعرض أحداث اللعب الحقيقية.</p>';
}
function paintVoice(c) {
  var v = qs(c, '[data-template-id="voice-status"]');
  if (v) v.textContent = 'الصوت الحقيقي يعمل من زر الغرفة.';
}
function paintRules(c) {
  var box = qs(c, '#rules-content');
  if (!box) return;
  box.innerHTML = '<h3 class="font-bold text-[#f6c860]">Rummy الخادم الحقيقي</h3><p class="mt-3"><strong>الهدف:</strong> كوّن مجموعات وتسلسلات وتخلص من أوراقك.</p><p class="mt-2"><strong>عدد اللاعبين:</strong> ' + (((ctx && ctx.state && ctx.state.public && ctx.state.public.players) || []).length) + '</p><p class="mt-2"><strong>طريقة الفوز:</strong> أول يد فارغة.</p><p class="mt-2"><strong>القواعد الأساسية:</strong> اسحب ثم ارمِ، واجمع ثلاث أوراق أو أكثر بنفس القيمة أو تسلسل نفس الرمز. كل حركة يتحقق منها الخادم.</p><p class="mt-4 rounded-xl bg-white/5 p-3 text-sm">لا تُنفذ أي حركة إلا في دور اللاعب الصحيح وبعد التحقق من قانونيتها. تبقى أوراق الخصوم خاصة، وتعرض شاشة المتفرج عدد الأوراق وسجل الطاولة فقط.</p>';
}
function doAct(a) {
  if (busy || !ctx || isSpectator()) return;
  busy = true;
  a.moveId = a.moveId || moveId();
  SocialAPI.request('/api/game-rooms/' + encodeURIComponent(ctx.roomId) + '/action', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a)
  }).then(function (d) {
    selected = {};
    if (d && d.room && window.kahwaApplyActionResponse) return window.kahwaApplyActionResponse(d.room);
    if (window.reloadKahwaRoom) return window.reloadKahwaRoom();
  }).catch(function (e) {
    showToast(stage(), (e && e.message) || 'تعذرت الحركة');
  }).finally(function () { busy = false; });
}
function stripInline(c) {
  (c.querySelectorAll('[onclick]') || []).forEach(function (el) { el.removeAttribute('onclick'); });
}
function bindStatic(c) {
  if (c.__cardsCanvaBound) return;
  c.__cardsCanvaBound = true;
  stripInline(c);
  (c.querySelectorAll('[aria-label="القواعد"]') || []).forEach(function (el) {
    el.addEventListener('click', function () { paintRules(c); showModal(c, 'rules-modal'); });
  });
  (c.querySelectorAll('[aria-label="الإعدادات"]') || []).forEach(function (el) {
    el.addEventListener('click', function () { showModal(c, 'settings-modal'); });
  });
  (c.querySelectorAll('[aria-label="إنهاء المباراة"]') || []).forEach(function (el) {
    el.addEventListener('click', function () { leaveRoom(); });
  });
  (c.querySelectorAll('#rules-modal [aria-label="إغلاق"], #settings-modal [aria-label="إغلاق"]') || []).forEach(function (el) {
    el.addEventListener('click', function () {
      hideModal(c, 'rules-modal'); hideModal(c, 'settings-modal');
    });
  });
  var cc = qs(c, '#copy-code');
  if (cc) cc.addEventListener('click', function () {
    var room = (ctx && ctx.room) || {};
    var code = room.roomCode || room.code || '';
    var text = 'انضم إلى طاولة ' + (room.name || 'الورق') + ' برمز ' + code;
    function done(ok) { showToast(c, ok ? 'تم نسخ نص الدعوة.' : ('رمز الغرفة: ' + code)); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    else done(false);
  });
  var nm = qs(c, '[data-template-id="new-match-button"]');
  if (nm) nm.addEventListener('click', function () { location.href = 'game-room.html'; });
  var mo = qs(c, '#settings-motion');
  if (mo) mo.addEventListener('change', function () { c.classList.toggle('reduce-motion', mo.checked); });
  var ti = qs(c, '#settings-timer');
  if (ti) { ti.disabled = true; ti.title = 'لا يوجد مؤقت في محرك الخادم'; }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { hideModal(stage(), 'rules-modal'); hideModal(stage(), 'settings-modal'); }
  });
}
function leaveRoom() {
  if (!ctx) { location.href = 'game-room.html'; return; }
  SocialAPI.request('/api/game-rooms/' + encodeURIComponent(ctx.roomId) + '/join', { method: 'DELETE' })
    .catch(function () {})
    .finally(function () { location.href = 'game-room.html'; });
}
function hideLocal(c) {
  var nr = qs(c, '#next-round-button');
  if (nr) nr.style.display = 'none';
  paintChat(c);
  paintVoice(c);
}
function render(c, x) {
  ctx = x || ctx;
  c = c || stage();
  if (!c) return;
  paintHead(c);
  paintPlayers(c);
  paintCenter(c);
  paintHand(c);
  paintActions(c);
  paintEvents(c);
  paintResults(c);
}
function mount(c, x) {
  ctx = x;
  selected = {};
  document.body.classList.add('cards-active');
  if (!c.querySelector(':scope > #game-screen')) {
    c.innerHTML = TEMPLATE;
    c.__cardsCanvaBound = false;
    bindStatic(c);
    hideLocal(c);
    if (window.lucide && lucide.createIcons) { try { lucide.createIcons(); } catch (e) {} }
  }
  render(c, x);
}
window.kahwaCardsCanvaUI = {
  mount: mount,
  render: render,
  bindActions: function () {},
  setLegalActions: function (a) { if (ctx && ctx.state) { ctx.state.legalActions = a || []; render(stage(), ctx); } },
  setLoading: function (v) { busy = !!v; },
  showSuccess: function (m) { showToast(stage(), m); },
  showError: function (m) { showToast(stage(), m); },
  destroy: function () { var c = stage(); if (c) { c.innerHTML = ''; c.__cardsCanvaBound = false; } ctx = null; selected = {}; document.body.classList.remove('cards-active'); }
};
})();
