/* Shno Mano — School Canva external adapter (browser glue).
 *
 * Injected by school-canva.html (the loader) into the immutable Canva
 * original's iframe, AFTER the original's own scripts. It wires the
 * original's built-in integration surface to the real Shno Mano platform:
 *
 *  1. REST: the original fetches ${restApiUrl}/health and /operations with
 *     no auth header; the fetch wrapper adds the current Shenoo Menoo Bearer
 *     JWT (same storage keys as the rest of the app). The original's request
 *     body is rewritten so queue records land on the guardian's real
 *     student (adapter-level request transformation, per integration
 *     requirements).
 *  2. WebSocket: the original opens a raw WebSocket to its websocketUrl.
 *     A marker URL (shno-school://classroom) is bridged to the project's
 *     authenticated Socket.IO classroom events (school:join/leave/
 *     heartbeat/live/webrtc:offer/webrtc:answer/webrtc:ice) using the
 *     Socket.IO client served at /socket.io/socket.io.js. JWT goes in the
 *     socket handshake auth, never in a URL.
 *  3. WebRTC: offer/answer/ICE ride the authenticated socket (server relays
 *     only between room members). STUN is the project default; TURN is
 *     delivered only if the server configured it from environment. Media is
 *     started exclusively by the original's own consent-gated buttons —
 *     this adapter never calls getUserMedia and never auto-starts media.
 *  4. Demo fallback: if the platform config is unavailable, the original
 *     keeps running in its untouched demo mode (localStorage + IndexedDB
 *     queue + dataSdk stub so its sync path stays exercisable).
 *
 * No secrets are present in this file; the session token is read at runtime
 * from the same localStorage/sessionStorage keys every other page uses.
 */
(function () {
  'use strict';

  var core = window.ShnoSchoolCanvaCore;
  var CONFIG_INPUT = window.__SHNO_SCHOOL_CANVA_CONFIG__ || null;
  if (!core) return;

  function token() {
    try { return localStorage.getItem('token') || sessionStorage.getItem('token') || ''; } catch (e) { return ''; }
  }

  function notify(text) {
    try { if (typeof window.notify === 'function') { window.notify(text); return; } } catch (e) {}
    var el = document.getElementById('toast-text');
    if (el) el.textContent = text;
  }

  // ---------------------------------------------------------------------
  // 1) REST: add the current session Bearer to school API calls.
  // ---------------------------------------------------------------------
  var nativeFetch = window.fetch ? window.fetch.bind(window) : null;
  if (nativeFetch) {
    window.fetch = function (input, init) {
      init = init || {};
      try {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        if (url.indexOf('/api/school') !== -1 && token()) {
          var headers = new Headers(init.headers || (input && input.headers) || {});
          if (!headers.has('Authorization')) headers.set('Authorization', 'Bearer ' + token());
          var merged = Object.assign({}, init);
          merged.headers = headers;
          init = merged;
        }
      } catch (e) { /* keep original behavior on any wrapper failure */ }
      return nativeFetch(input, init);
    };
  }

  // ---------------------------------------------------------------------
  // 2) WebSocket -> authenticated Socket.IO bridge (marker URLs only).
  // ---------------------------------------------------------------------
  var bridgeAvailable = Boolean(window.io) && core.isMarkerUrl(CONFIG_INPUT && CONFIG_INPUT.websocketUrl);
  if (bridgeAvailable) {
    var NativeWebSocket = window.WebSocket;

    function SchoolClassroomSocket(url, protocols) {
      var self = this;
      this.readyState = 0;
      this.onopen = null; this.onmessage = null; this.onclose = null; this.onerror = null;
      this._closed = false; this._openFired = false; this._failures = 0;

      this._socket = window.io({
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 400,
        reconnectionDelayMax: 4000,
        timeout: 10000,
        auth: { token: token() }
      });

      var deliver = function (event, data) {
        var envelope = core.fromSocketEvent(event, data);
        if (envelope && self.onmessage) self.onmessage({ data: JSON.stringify(envelope) });
      };
      for (var i = 0; i < core.INBOUND_EVENTS.length; i++) {
        this._socket.on(core.INBOUND_EVENTS[i], deliver.bind(null, core.INBOUND_EVENTS[i]));
      }

      // The original drops its joinRoom while the socket is still
      // connecting (sendEvent requires OPEN). Re-issue the join from the
      // original's own roomId when the socket (re)connects; the server
      // treats joins as idempotent, so a race with the original's own send
      // is harmless.
      var joinPendingRoom = function () {
        var roomId = '';
        try { roomId = (window.ExternalAdapter && window.ExternalAdapter.roomId) || ''; } catch (e) {}
        if (roomId) self._socket.emit('school:join', { roomId: roomId });
      };

      this._socket.on('connect', function () {
        self._failures = 0;
        self.readyState = 1;
        if (!self._openFired) {
          self._openFired = true;
          if (self.onopen) self.onopen({ type: 'open' });
        }
        joinPendingRoom();
      });
      this._socket.on('reconnect', joinPendingRoom);
      this._socket.on('disconnect', function () { self.readyState = 3; });
      this._socket.on('connect_error', function (err) {
        self._failures += 1;
        if (self.onerror) self.onerror({ type: 'error', message: err && err.message ? err.message : 'socket-error' });
        if (self._failures >= 5 && self.readyState !== 1) self._terminate('auth-failure');
      });
    }

    SchoolClassroomSocket.prototype.send = function (raw) {
      if (this.readyState !== 1 || this._closed) return false;
      var envelope = null;
      try { envelope = JSON.parse(raw); } catch (e) { return false; }
      var cmd = core.toSocketCommand(envelope);
      if (!cmd) return false;
      this._socket.emit(cmd.event, cmd.args[0]);
      return true;
    };
    SchoolClassroomSocket.prototype.close = function () { this._terminate('client-close'); };
    SchoolClassroomSocket.prototype._terminate = function (reason) {
      if (this._closed) return;
      this._closed = true;
      this.readyState = 3;
      try { this._socket.disconnect(); } catch (e) {}
      if (this.onclose) this.onclose({ type: 'close', wasClean: reason === 'client-close', reason: reason });
    };
    SchoolClassroomSocket.CONNECTING = 0;
    SchoolClassroomSocket.OPEN = 1;
    SchoolClassroomSocket.CLOSING = 2;
    SchoolClassroomSocket.CLOSED = 3;

    window.WebSocket = function (url, protocols) {
      if (core.isMarkerUrl(url)) return new SchoolClassroomSocket(url, protocols);
      return new NativeWebSocket(url, protocols);
    };
    try { Object.defineProperty(window.WebSocket, 'name', { value: 'WebSocket' }); } catch (e) {}
  }

  // ---------------------------------------------------------------------
  // 3) The original hard-requires window.dataSdk in its sync path even in
  //    real mode (and its initData() uses it for the Canva Sheet). Provide
  //    a safe stub: real sync goes through /operations; the demo sheet
  //    path reports "unavailable" so items stay queued locally.
  // ---------------------------------------------------------------------
  if (!window.dataSdk) {
    window.dataSdk = {
      init: function () { return Promise.resolve({ isOk: true, data: [] }); },
      create: function () { return Promise.resolve({ isOk: false, reason: 'canva-sheet-unavailable' }); }
    };
  }

  // ---------------------------------------------------------------------
  // 4) Configure the original's integration surface (its own hook).
  // ---------------------------------------------------------------------
  var config = Object.assign({}, core.defaultConfig());
  if (CONFIG_INPUT && !core.isDemoConfig(CONFIG_INPUT)) {
    Object.keys(CONFIG_INPUT).forEach(function (k) { config[k] = CONFIG_INPUT[k]; });
  }
  try {
    if (typeof window.configureIntegration === 'function') window.configureIntegration(config);
  } catch (e) { /* demo mode stays intact */ }

  var realMode = !core.isDemoConfig(config);
  var realStudent = null;
  var realSessionId = '';

  function api(path) {
    return window.fetch(path, { headers: { Authorization: 'Bearer ' + token() } })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (!r.ok || d.ok === false) throw new Error(d.message || 'http ' + r.status);
          return d;
        });
      });
  }

  // Adapter-level request transformation: when the guardian has a real
  // student on Shno Mano, Canva queue records are synced to that student
  // instead of the demo student. The original's body bytes are never
  // altered for demo accounts (demo fallback preserved).
  if (realMode && window.ExternalAdapter && typeof window.ExternalAdapter.request === 'function') {
    var baseRequest = window.ExternalAdapter.request.bind(window.ExternalAdapter);
    window.ExternalAdapter.request = function (pathName, options, attempt) {
      try {
        if (realStudent && pathName === 'operations' && options && typeof options.body === 'string') {
          var record = JSON.parse(options.body);
          if (record && typeof record === 'object' && record.student_name) {
            record.student_name = realStudent.name;
            options = Object.assign({}, options, { body: JSON.stringify(record) });
          }
        }
      } catch (e) { /* fall through with the original body */ }
      return baseRequest(pathName, options, attempt);
    };
  }

  // ---------------------------------------------------------------------
  // 5) Additive UI: real classroom bar in the class view + integration
  //    status line in settings. Pure DOM additions; original markup and
  //    styles are untouched. Media buttons only trigger the original's
  //    consent-gated startAudioSession/startVideoSession (no auto media).
  // ---------------------------------------------------------------------
  var ui = { joined: false, roomId: '', videoEl: null, statusEl: null, participantsEl: null, joinBtn: null };

  function el(tag, css, text) {
    var node = document.createElement(tag);
    if (css) node.style.cssText = css;
    if (text) node.textContent = text;
    return node;
  }

  function buildClassroomBar() {
    var view = document.getElementById('class-view');
    if (!view || document.getElementById('shno-classroom-bar')) return;
    var bar = el('div', 'margin-top:18px;border:2px solid #146c70;border-radius:20px;background:#fffdf9;padding:14px 16px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;');
    bar.id = 'shno-classroom-bar';
    var title = el('b', 'color:#183a3c;font-size:16px;', '🔗 الصف الافتراضي (شنو منو)');
    ui.joinBtn = el('button', 'border:0;border-radius:12px;background:#146c70;color:#fff;font-weight:800;padding:10px 16px;cursor:pointer;', 'دخول الصف');
    ui.joinBtn.type = 'button';
    ui.participantsEl = el('span', 'color:#53706f;font-weight:700;font-size:14px;', 'لم يتم الانضمام بعد');
    var audioBtn = el('button', 'border:2px solid #146c70;border-radius:12px;background:#fff;color:#146c70;font-weight:800;padding:8px 14px;cursor:pointer;', '🎙️ صوتي');
    audioBtn.type = 'button';
    audioBtn.title = 'يعمل فقط بعد موافقة ولي الأمر وإذن الجهاز';
    var videoBtn = el('button', 'border:2px solid #146c70;border-radius:12px;background:#fff;color:#146c70;font-weight:800;padding:8px 14px;cursor:pointer;', '📷 كاميرتي');
    videoBtn.type = 'button';
    videoBtn.title = 'يعمل فقط بعد موافقة ولي الأمر وإذن الجهاز';
    var mediaBox = el('div', 'width:100%;display:none;');
    mediaBox.id = 'shno-classroom-media';
    bar.appendChild(title); bar.appendChild(ui.joinBtn); bar.appendChild(ui.participantsEl);
    bar.appendChild(audioBtn); bar.appendChild(videoBtn); bar.appendChild(mediaBox);
    view.appendChild(bar);

    function currentRoomId() {
      var stateRef = null;
      try { stateRef = (typeof state !== 'undefined') ? state : null; } catch (e) { stateRef = null; }
      if (realSessionId) return 'sess-' + realSessionId;
      return core.stableRoomId([
        stateRef && stateRef.stage, stateRef && stateRef.grade, stateRef && stateRef.subject,
        realStudent && realStudent.name
      ]);
    }

    ui.joinBtn.addEventListener('click', function () {
      if (!realMode) { notify('الربط غير مفعّل — الوضع التجريبي محليًا.'); return; }
      if (ui.joined) {
        try { window.leaveVirtualClass(); } catch (e) {}
        ui.joined = false;
        ui.joinBtn.textContent = 'دخول الصف';
        ui.participantsEl.textContent = 'لم يتم الانضمام بعد';
        return;
      }
      var roomId = currentRoomId();
      Promise.resolve(window.joinVirtualClass(roomId)).then(function (ok) {
        if (ok) {
          ui.joined = true;
          ui.roomId = roomId;
          ui.joinBtn.textContent = 'مغادرة الصف';
          ui.participantsEl.textContent = 'جارٍ الانضمام إلى الصف…';
        } else {
          notify('تعذر فتح اتصال الصف الآن.');
        }
      }).catch(function () { notify('تعذر فتح اتصال الصف الآن.'); });
    });

    audioBtn.addEventListener('click', function () {
      if (!ui.joined) { notify('ادخل الصف الافتراضي أولًا.'); return; }
      Promise.resolve(window.startAudioSession()).catch(function (e) {
        notify(e && e.message ? e.message : 'تعذر تشغيل الصوت.');
      });
    });
    videoBtn.addEventListener('click', function () {
      if (!ui.joined) { notify('ادخل الصف الافتراضي أولًا.'); return; }
      Promise.resolve(window.startVideoSession()).catch(function (e) {
        notify(e && e.message ? e.message : 'تعذر تشغيل الكاميرا.');
      });
    });

    document.addEventListener('external-media', function (e) {
      var detail = e.detail || {};
      if (detail.roomId !== ui.roomId) return;
      var box = document.getElementById('shno-classroom-media');
      if (!box) return;
      box.style.display = 'block';
      var video = document.createElement('video');
      video.muted = true; video.autoplay = true; video.playsInline = true;
      video.style.cssText = 'max-width:100%;border-radius:14px;background:#0b1220;max-height:260px;';
      video.srcObject = detail.stream;
      box.appendChild(video);
    });

    // Participants arrive as `participants` envelopes through the original's
    // external-event dispatch (handleSignal ignores them safely).
    document.addEventListener('external-event', function (e) {
      var d = e.detail || {};
      if (d.type === 'participants' && d.roomId === ui.roomId) {
        var names = (d.participants || []).map(function (p) { return p.name || p.id; });
        ui.participantsEl.textContent = names.length ? 'في الصف: ' + names.join('، ') : 'لا يوجد مشاركون بعد';
        if (d.left) notify('غادر أحد المشاركين الصف.');
      }
      if (d.type === 'live' && d.roomId === ui.roomId) {
        if (d.kind === 'raise-hand') notify('رفع طالب آخر يده في الصف.');
        if (d.kind === 'question' && d.text) notify('سؤال جديد: ' + d.text);
      }
    });
  }

  function buildStatusLine() {
    var view = document.getElementById('settings-view');
    if (!view || document.getElementById('shno-integration-status')) return;
    ui.statusEl = el('p', 'margin-top:14px;padding:10px 12px;border-radius:14px;background:#eff6f3;color:#146c70;font-weight:700;font-size:14px;line-height:1.9;', '');
    ui.statusEl.id = 'shno-integration-status';
    view.appendChild(ui.statusEl);
    function render() {
      var lines = [
        'الربط: ' + (realMode ? 'حقيقي — ' + (config.environment || 'production') : 'تجريبي محلي (demo)'),
        'REST: ' + (realMode ? (config.restApiUrl || '/api/school') : 'معطّل'),
        'Socket: ' + (realMode ? 'Socket.IO الموثق — صفوف افتراضية' : 'معطّل'),
        'STUN: ' + (config.stunUrl || 'غير مهيأ'),
        'TURN: ' + ((Array.isArray(config.turnServers) && config.turnServers.length) ? 'مهيأ من الخادم' : 'غير مهيأ (يُضبط من بيئة الخادم)'),
        'حصة جارية: ' + (realSessionId ? realSessionId : 'لا توجد'),
        'المعلم الذكي (AI): ' + (window.__shnoAiStatus ? window.__shnoAiStatus : '—')
      ];
      ui.statusEl.textContent = lines.join(' · ');
    }
    render();
    window.__shnoRenderIntegrationStatus = render;
  }

  // ---------------------------------------------------------------------
  // 6) Real data hydration (non-destructive; every step fails soft so the
  //    demo app keeps working when the platform is unreachable).
  // ---------------------------------------------------------------------
  function hydrateTeachers() {
    return api('/api/school/teachers').then(function (d) {
      var real = (d.teachers || []).map(function (t) {
        return {
          id: t.id, name: t.name, gender: t.gender, subject: t.subject, stage: t.stage,
          grades: Array.isArray(t.grades) ? t.grades.join('، ') : String(t.grades || ''),
          experience: t.experience, presence: t.status || 'متاح الآن',
          language: t.language || 'عربية عراقية', rating: Number(t.rating) || 5
        };
      });
      if (!real.length) return;
      try {
        if (typeof teachers !== 'undefined' && Array.isArray(teachers)) {
          teachers.splice(0, teachers.length);
          real.forEach(function (t) { teachers.push(t); });
          if (typeof renderTeachers === 'function') renderTeachers();
        }
      } catch (e) { /* demo teachers remain */ }
    }).catch(function () {});
  }

  function hydrateConsentsAndSession() {
    return Promise.all([
      api('/api/school/students').catch(function () { return { students: [] }; }),
      api('/api/school/sessions/active').catch(function () { return { session: null }; }),
      api('/api/school/schedules').catch(function () { return { schedules: [] }; }),
      api('/api/school/ai/status').catch(function () { return {}; })
    ]).then(function (out) {
      var students = out[0].students || [];
      if (students.length) {
        realStudent = { name: students[0].name, id: students[0]._id };
        var perms = students[0].learningPermissions || {};
        // Only an explicit guardian approval grants the original's media
        // gate; nothing is auto-granted or auto-started.
        try {
          if (typeof state !== 'undefined' && state) state.consents = core.mapConsents(perms);
        } catch (e) {}
      }
      if (out[1].session) realSessionId = String(out[1].session._id || '');
      if (window.__shnoRenderIntegrationStatus) window.__shnoRenderIntegrationStatus();
      return Promise.resolve();
    });
  }

  function enhanceTeacherQuestion() {
    var form = document.getElementById('student-question-form');
    var input = document.getElementById('student-question');
    var reply = document.getElementById('teacher-reply');
    if (!form || !input || !reply) return;
    var lastQuestion = '';
    input.addEventListener('input', function () { lastQuestion = input.value; });
    form.addEventListener('submit', function () {
      // Runs after the original's handler (registered first), which keeps
      // the demo reply visible as fallback until the real one arrives.
      if (!realMode || !realStudent || !lastQuestion.trim()) return;
      var stateRef = null;
      try { stateRef = (typeof state !== 'undefined') ? state : null; } catch (e) { stateRef = null; }
      var body = {
        studentId: realStudent.id,
        subject: stateRef && stateRef.subject,
        question: lastQuestion,
        history: []
      };
      if (realSessionId) body.sessionId = realSessionId;
      window.fetch('/api/school/teacher/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
        body: JSON.stringify(body)
      }).then(function (res) { return res.json().catch(function () { return {}; }); })
        .then(function (d) {
          if (d && d.ok === true && d.answer) reply.textContent = 'رد المعلم (شنو منو): ' + d.answer;
        }).catch(function () {});
    });
  }

  function boot() {
    try { buildClassroomBar(); } catch (e) {}
    try { buildStatusLine(); } catch (e) {}
    if (!realMode) return;
    window.__shnoAiStatus = null;
    hydrateTeachers();
    hydrateConsentsAndSession().then(function () {
      api('/api/school/ai/status').then(function (d) {
        window.__shnoAiStatus = d.configured ? ('مهيأ — ' + (d.provider || '')) : 'غير مهيأ (معلم محلي)';
        if (window.__shnoRenderIntegrationStatus) window.__shnoRenderIntegrationStatus();
      }).catch(function () {});
    });
    try { enhanceTeacherQuestion(); } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
