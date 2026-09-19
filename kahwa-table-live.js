(function () {
  'use strict';
  // طبقة الطاولة الحيّة في كهوة عزاوي: المشاهدون + دردشة الطاولة + دفع حالة اللعبة
  // من Socket.IO. لا تلمس سحب الدومنة ولا المايك (لكل منهما ملفه الخاص).
  // الخادم يبقى مرجعياً: هذه الطبقة تستقبل الحالة ولا تحسب أي حركة.
  var params = new URLSearchParams(location.search);
  var roomId = params.get('room');
  if (!roomId) return;

  var socket = null, panel = null, joined = false, lastMoveCount = -1;
  function token() { return ((window.SocialAPI && typeof SocialAPI.token === 'function') ? SocialAPI.token() : '') || localStorage.getItem('token') || sessionStorage.getItem('token') || ''; }
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function me() { return String(window.kahwaCurrentUserId || ''); }
  function notice(text, bad) {
    var n = document.querySelector('.kahwa-table-notice');
    if (!n) { n = document.createElement('div'); n.className = 'kahwa-table-notice'; document.body.appendChild(n); }
    n.textContent = text;
    n.className = 'kahwa-table-notice show ' + (bad ? 'error' : 'ok');
    clearTimeout(n._t);
    n._t = setTimeout(function () { n.classList.remove('show'); }, 2400);
  }
  function panelHost() { return document.querySelector('#roomView') || document.querySelector('main') || document.body; }

  // سوكت واحد مشترك لكل أدوات الصفحة (بدل فتح أكثر من اتصال).
  function gameSocket() {
    if (socket) return socket;
    if (typeof window.io !== 'function') return null;
    var t = token();
    if (!t) { notice('لا توجد جلسة دخول على هذا الجهاز — سجّل الدخول أولاً', true); return null; }
    socket = window.io({ auth: { token: t }, extraHeaders: { Authorization: 'Bearer ' + t } });
    socket.on('connect', function () {
      joined = false;
      socket.emit('game:join', { roomId: roomId }, function (a) {
        if (a && a.ok) joined = true;
        else socket.emit('game:resync', { roomId: roomId }, function () { });
      });
    });
    // إعادة الاتصال التلقائية: نعيد جلب الحالة الكاملة (عامة + يدي) من الخادم.
    socket.io.on('reconnect', function () { socket.emit('game:resync', { roomId: roomId }, function () { }); });
    socket.on('disconnect', function () { notice('انقطع الاتصال — جارٍ إعادة المزامنة…', true); });
    socket.on('connect_error', function (e) {
      if (/unauthorized/i.test(String((e && e.message) || ''))) notice('الجلسة غير مصرح بها — سجّل الدخول من هذا الجهاز', true);
      else notice('تعذر الاتصال بالخادم', true);
    });
    socket.on('game:state', applyPublic);
    socket.on('game:private', applyPrivate);
    socket.on('game:spectators', renderSpectators);
    socket.on('game:chat:message', addChatMessage);
    socket.on('game:domino-updated', function (d) {
      if (!d || d.moveCount === undefined) return;
      lastMoveCount = Number(d.moveCount);
    });
    return socket;
  }

  // دفع الحالة العامة إلى واجهة اللعبة الحالية (تُحدَّث فوراً بدون إعادة تحميل).
  function applyPublic(stateEvent) {
    if (!stateEvent || !window.kahwaGameUI) return;
    var engine = stateEvent.engineState || {};
    window.kahwaGameUI.applyView({ public: engine.public || null, spectator: !isPlayerFromState(stateEvent) });
  }
  function applyPrivate(payload) {
    if (!payload || !window.kahwaGameUI || !payload.engineState) return;
    window.kahwaGameUI.applyView({
      public: payload.engineState.public || null,
      private: payload.engineState.private || null,
      legalActions: payload.engineState.legalActions || [],
      spectator: false
    });
  }
  function isPlayerFromState(stateEvent) {
    var players = (stateEvent && stateEvent.players) || [];
    return players.some(function (p) { return String(p && p.id ? p.id : p) === me(); });
  }
function renderSpectators(x) {
    var count = document.querySelector('[data-live-count]');
    var list = document.querySelector('[data-live-spectators]');
    if (count) count.textContent = (x && x.count) || 0;
    if (list) list.innerHTML = (x && x.spectators && x.spectators.length)
      ? x.spectators.map(function (s) { return '<span>👤 ' + esc(s.name || s.username || 'مشاهد') + '</span>'; }).join('')
      : '<small>لا يوجد مشاهدون الآن</small>';
    var badge = document.querySelector('[data-spectator-count]');
    if (badge) badge.textContent = (x && x.count) || 0;
  }

  function addChatMessage(m) {
    var log = document.querySelector('[data-table-chat]');
    if (!log || !m) return;
    var row = document.createElement('div');
    row.className = 'table-chat-msg';
    row.innerHTML = '<b>' + esc(m.name || 'مستخدم') + (m.role === 'spectator' ? ' · مشاهد' : '') + '</b><span>' + esc(m.text || '') + '</span>';
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
  }

  function buildPanel() {
    if (panel || !roomId) return panel;
    var host = panelHost();
    panel = document.createElement('section');
    panel.className = 'kahwa-live-panel';
    panel.innerHTML = '<div class="kahwa-live-head"><button type="button" data-watch>👁 دخول كمشاهد</button><span data-voice-state>الدردشة والمشاهدة تعمل عبر Socket.IO</span></div><div class="kahwa-live-body"><aside><h3>👁 المشاهدون <b data-live-count>0</b></h3><div data-live-spectators class="live-spectators"><small>لا يوجد مشاهدون الآن</small></div></aside><div class="table-chat"><h3>💬 دردشة الطاولة</h3><div data-table-chat class="table-chat-log"><p>الدردشة مفتوحة للاعبين والمشاهدين.</p></div><form data-chat-form><input data-chat-input maxlength="500" placeholder="اكتب تعليقك..." autocomplete="off"><button>إرسال</button></form></div></div>';
    host.appendChild(panel);
    var watch = panel.querySelector('[data-watch]');
    watch.onclick = function () {
      var s = gameSocket();
      if (!s) return notice('تعذر الاتصال بالخادم', true);
      s.emit('game:spectate', { roomId: roomId }, function (a) {
        if (a && a.ok) { watch.textContent = '✓ أنت تشاهد'; watch.disabled = true; notice('دخلت كمشاهد'); }
        else notice((a && a.message) || 'تعذر دخول المشاهدة', true);
      });
    };
    panel.querySelector('[data-chat-form]').onsubmit = function (e) {
      e.preventDefault();
      var input = panel.querySelector('[data-chat-input]');
      var text = String(input.value || '').trim();
      if (!text) return;
      var s = gameSocket();
      if (!s) return notice('تعذر الاتصال بالخادم', true);
      s.emit('game:chat:send', { roomId: roomId, text: text }, function (a) {
        if (a && a.ok) input.value = '';
        else notice((a && a.message) || 'تعذر إرسال الرسالة', true);
      });
    };
    return panel;
  }

  window.kahwaTableUI = {
    socket: gameSocket,
    refresh: function () { var s = gameSocket(); if (s) s.emit('game:resync', { roomId: roomId }, function () { }); },
    notice: notice,
    isJoined: function () { return joined; }
  };

  document.addEventListener('DOMContentLoaded', function () {
    buildPanel();
    // اللاعب والزائر يستخدمان نفس السوكت المشترك لاستقبال الحالة واليد الخاصة.
    gameSocket();
  });
  window.addEventListener('beforeunload', function () {
    if (!socket) return;
    socket.emit('game:spectator:leave', { roomId: roomId });
    socket.disconnect();
  });
})();