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
 *  4. View wiring: the original renders every page from its own top-level
 *     data globals (state, teachers, stages, subjectMap, lessons,
 *     state.library) and its render functions. The adapter feeds those
 *     globals with the guardian's real Shno Mano data (student, teachers,
 *     curriculum offline-pack, sessions, consents, scores, notes) and then
 *     drives the original's own render functions + small DOM patches, so
 *     home/path/teachers/class/exam/report/consent/library/settings all
 *     show the real account. The original's bytes are never modified.
 *  5. Demo fallback: if the platform config is unavailable (or any fetch
 *     fails), the original keeps running in its untouched demo mode
 *     (localStorage + IndexedDB queue + dataSdk stub).
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

  // Bridge the 2026-09-20 Canva update's dataSdk contract to the real,
  // authenticated Shno Mano school APIs without modifying the Canva asset.
  function bootUpdatedCanva() {
    if (!document.getElementById('structure-list')) return false;
    var rows = [], subscriber = null, sequence = 0;
    function emit() { if (subscriber && typeof subscriber.onDataChanged === 'function') subscriber.onDataChanged(rows.slice()); }
    function save(record) {
      var opId = String(record.operation_id || ('school-canva-' + Date.now() + '-' + (++sequence)));
      return window.fetch('/api/school/operations', { method: 'POST', headers: {
        'Content-Type': 'application/json', Authorization: 'Bearer ' + token(), 'Idempotency-Key': opId
      }, body: JSON.stringify(record) }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (body) { return { ok: r.ok && body.isOk !== false, body: body }; });
      });
    }
    window.dataSdk = {
      init: function (handler) { subscriber = handler; setTimeout(emit, 0); return Promise.resolve({ isOk: true }); },
      create: function (record) { return save(record).then(function (out) {
        if (!out.ok) return { isOk: false, error: out.body.message || 'تعذر الحفظ' };
        rows.unshift(Object.assign({}, record, { __backendId: String(record.operation_id || Date.now()) })); emit(); return { isOk: true };
      }).catch(function (e) { return { isOk: false, error: e.message }; }); },
      update: function (record) { return save(record).then(function (out) {
        if (!out.ok) return { isOk: false, error: out.body.message || 'تعذر التعديل' };
        var i = rows.findIndex(function (x) { return x.__backendId === record.__backendId; });
        if (i >= 0) rows[i] = Object.assign({}, record); emit(); return { isOk: true };
      }).catch(function (e) { return { isOk: false, error: e.message }; }); },
      delete: function () { return Promise.resolve({ isOk: false, error: 'الحذف يحتاج اعتماد إدارة شنو منو' }); }
    };
    var get = function (path) { return api(path).catch(function () { return {}; }); };
    Promise.all([get('/api/school/students'), get('/api/school/teachers'), get('/api/school/curriculum/offline-pack'),
      get('/api/school/curriculum/catalog'), get('/api/school/curriculum/files')]).then(function (out) {
      var result = [], seen = {};
      function unique(type, key, fields) { var value = String(fields[key] || ''), id = type + ':' + value;
        if (!value || seen[id]) return; seen[id] = true; result.push(Object.assign({ __backendId: id, record_type: type, operation_status: 'مؤكد من شنو منو' }, fields)); }
      (out[3].items || []).forEach(function (item) {
        unique('stage', 'stage', { stage: item.stage }); unique('grade', 'grade', { stage: item.stage, grade: item.grade });
        unique('subject', 'subject', { stage: item.stage, grade: item.grade, subject: item.subject });
        result.push({ __backendId: 'catalog:' + item.id, record_type: 'curriculum', curriculum_file_name: item.title,
          curriculum_stage: item.stage, curriculum_grade: item.grade, curriculum_subject: item.subject,
          curriculum_file_type: 'application/pdf', curriculum_status: 'مفهرس في شنو منو', curriculum_description: item.content || '' });
      });
      (out[1].teachers || []).forEach(function (t) { result.push({ __backendId: 'teacher:' + t.id, record_type: 'teacher',
        teacher_name: t.name, teacher_gender: t.gender, teacher_id: String(t.id), teacher_email: String(t.id), teacher_bio: t.style || t.motto || '',
        teacher_presence: t.status || 'متاح الآن', teacher_grades: Array.isArray(t.grades) ? t.grades.join('، ') : String(t.grades || ''), subject: t.subject, stage: t.stage }); });
      (out[2].items || []).forEach(function (item) { if (item.lesson) result.push({ __backendId: 'lesson:' + item.id, record_type: 'lesson',
        stage: item.stage, grade: item.grade, subject: item.subject, unit: item.chapter || '', lesson: item.lesson,
        lesson_content: item.content || '', lesson_question: item.question || '', exam_question_text: item.question || '' }); });
      (out[0].students || []).forEach(function (s) { result.push({ __backendId: 'student:' + s._id, record_type: 'student', student_name: s.name, stage: s.stage, grade: s.grade }); });
      rows = result; realCurriculumFiles = Array.isArray(out[4].files) ? out[4].files : []; emit(); patchCurriculumFiles();
    });
    // Top-level `const handler` in the Canva export lives in the global
    // lexical environment. Calling through same-realm eval reliably reaches
    // its `init()` even when the function is not exposed as window.init.
    try {
      if (typeof window.init === 'function') window.init();
      else window.eval('init()');
    } catch (e) {
      try { window.eval('init()'); } catch (ignored) {}
    }
    return true;
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
        patchSeats(d.participants || []);
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
        nextSchedule ? 'درس مجدول: ' + nextSchedule.subject + ' — ' + nextSchedule.when : '',
        'المعلم الذكي (AI): ' + (window.__shnoAiStatus ? window.__shnoAiStatus : '—')
      ].filter(Boolean);
      ui.statusEl.textContent = lines.join(' · ');
    }
    render();
    window.__shnoRenderIntegrationStatus = render;
  }

  // ---------------------------------------------------------------------
  // 6) View wiring: feed the original's own data globals (state, teachers,
  //    stages, subjectMap, lessons, state.library) with the guardian's real
  //    Shno Mano data, drive the original's render functions, and apply
  //    small DOM patches for the few values the original hard-codes. Every
  //    step fails soft — on any failure the original's demo content stays
  //    exactly as authored.
  // ---------------------------------------------------------------------
  var realTeachersRaw = [];
  var realReport = null;
  var realExamKeys = {};
  var realCurriculumFiles = [];
  var nextSchedule = null;
  var hydrated = false;

  function $id(id) { try { return document.getElementById(id); } catch (e) { return null; } }
  function textOf(id, value) { var n = $id(id); if (n) n.textContent = value; }

  // Wrap an original render function (top-level function declaration ->
  // window property) so a DOM patch re-applies after every real render.
  function wrapRender(name, after) {
    try {
      var orig = window[name];
      if (typeof orig !== 'function' || orig.__shnoWrapped) return false;
      var patched = function () {
        var r = orig.apply(this, arguments);
        try { after(); } catch (e) {}
        return r;
      };
      patched.__shnoWrapped = true;
      window[name] = patched;
      return true;
    } catch (e) { return false; }
  }

  function patchTeachersView() {
    try {
      if (!realTeachersRaw.length) return;
      var grid = $id('teacher-grid');
      var count = $id('teacher-count');
      if (count && grid) count.textContent = grid.children.length + ' من ' + realTeachersRaw.length + ' معلمًا (دليل شنو منو)';
      var kicker = document.querySelector('#teachers-view [data-template-id="teachers-kicker"]');
      if (kicker) kicker.textContent = 'دليل المعلمين (شنو منو)';
    } catch (e) {}
  }

  function patchCurriculumFiles() {
    try {
      if (!realCurriculumFiles.length) return;
      var list = $id('catalog-list');
      if (!list) return;
      var search = $id('library-search');
      var query = search ? String(search.value || '').trim().toLowerCase() : '';
      var rows = realCurriculumFiles.filter(function (item) {
        return !query || String(item.sourcePage || '').toLowerCase().indexOf(query) !== -1 || String(item.fileName || '').toLowerCase().indexOf(query) !== -1;
      });
      var frag = document.createDocumentFragment();
      rows.forEach(function (item, index) {
        var card = document.createElement('article');
        card.className = 'record-card';
        var title = document.createElement('h3');
        title.className = 'font-extrabold';
        var sourceCode = '';
        try { sourceCode = new URL(item.sourcePage).hostname.split('.')[0]; } catch (e) {}
        title.textContent = 'كتاب المنهج العراقي ' + (sourceCode ? '— ' + sourceCode : 'رقم ' + (index + 1));
        var details = document.createElement('p');
        details.className = 'mt-1 font-bold text-[#53706f]';
        details.textContent = (Number(item.pages) || 0) + ' صفحة · ' + Math.max(1, Math.round((Number(item.bytes) || 0) / 1048576)) + ' MB · موثّق SHA-256';
        var link = document.createElement('a');
        link.className = 'mt-3 inline-block rounded-xl bg-[#146c70] px-4 py-2 font-extrabold text-white';
        link.href = item.url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = 'فتح وقراءة PDF';
        card.appendChild(title); card.appendChild(details); card.appendChild(link);
        frag.appendChild(card);
      });
      list.replaceChildren(frag);
      var kicker = document.querySelector('#library-view [data-template-id="catalog-kicker"]');
      if (kicker) kicker.textContent = realCurriculumFiles.length + ' كتابًا عراقيًا منشورًا على خادم شنو منو';
    } catch (e) {}
  }

  function patchTeacherProfile() {
    try {
      if (!realTeachersRaw.length) return;
      var box = $id('teacher-profile-content');
      if (!box) return;
      box.innerHTML = box.innerHTML.split('شخصية تعليمية افتراضية').join('معلم من دليل شنو منو');
      var teacherId = '';
      try { teacherId = (typeof state !== 'undefined' && state) ? String(state.teacherId || '') : ''; } catch (e) {}
      var t = realTeachersRaw.find(function (x) { return String(x.id) === teacherId; });
      if (t && (t.style || t.motto)) {
        var bits = [];
        if (t.style) bits.push('أسلوب التدريس: ' + t.style);
        if (t.motto) bits.push('الشعار: ' + t.motto);
        var line = document.createElement('p');
        line.className = 'mt-2';
        line.textContent = bits.join(' | ');
        box.appendChild(line);
      }
    } catch (e) {}
  }

  function patchReportView() {
    try {
      if (!realStudent) return;
      var box = $id('report-content');
      if (box) {
        var html = box.innerHTML;
        var prog = realStudent.progress || {};
        core.reportPatches({ studentName: realStudent.name, sessions: prog.sessions, average: prog.average })
          .forEach(function (p) { html = html.split(p.from).join(p.to); });
        box.innerHTML = html;
      }
      var host = $id('activity-list');
      if (host && host.parentNode) {
        var extra = $id('shno-report-real');
        if (!extra) {
          extra = el('div', 'margin-top:10px;border:2px solid #146c70;border-radius:18px;background:#fffdf9;padding:12px 14px;font-weight:700;color:#146c70;font-size:14px;line-height:2;white-space:pre-line;', '');
          extra.id = 'shno-report-real';
          host.parentNode.insertBefore(extra, host.nextSibling);
        }
        var lines = ['سجل المنصة (حقيقي من شنو منو):'];
        if (realReport && realReport.report && Number.isFinite(realReport.report.sessions)) lines.push('الحصص المسجلة: ' + realReport.report.sessions);
        (realStudent.scores || []).slice(-3).reverse().forEach(function (sc) {
          lines.push('درجة ' + (sc.subject || '') + ': ' + sc.score + '/' + (sc.maxScore || 10));
        });
        (realStudent.notes || []).slice(-3).reverse().forEach(function (n) {
          lines.push('ملاحظة' + (n.subject ? ' (' + n.subject + ')' : '') + ': ' + n.text);
        });
        if (lines.length === 1) lines.push('لا توجد نشاطات مسجلة على المنصة بعد — ستظهر هنا فور حدوثها.');
        extra.textContent = lines.join('\n');
      }
    } catch (e) {}
  }

  function patchConsentView() {
    try {
      if (!realStudent) return;
      var consents = null;
      try { consents = (typeof state !== 'undefined' && state) ? state.consents : null; } catch (e) {}
      if (consents) textOf('consent-log', core.consentLogText(consents));
    } catch (e) {}
  }

  function patchSeats(participants) {
    try {
      var title = document.querySelector('h2[data-template-id="students-title"]');
      var grid = title ? title.nextElementSibling : null;
      if (!grid) return;
      var seats = core.seatCards(realStudent ? realStudent.name : '', participants || []);
      var frag = document.createDocumentFragment();
      seats.forEach(function (s) {
        var d = document.createElement('div');
        d.className = 'rounded-2xl bg-white p-3 text-center font-bold';
        d.appendChild(document.createTextNode(s.name));
        d.appendChild(document.createElement('br'));
        var span = document.createElement('span');
        span.className = s.status === 'متصل الآن' ? 'text-[#146c70]' : 'text-[#846019]';
        span.textContent = s.status;
        d.appendChild(span);
        frag.appendChild(d);
      });
      grid.replaceChildren(frag);
    } catch (e) {}
  }

  function patchHomeStats(input) {
    try {
      var section = document.querySelector('#home-view section[aria-labelledby="statistics-title"]');
      if (!section) return;
      var ps = [];
      Array.prototype.forEach.call(section.querySelectorAll('article'), function (a) {
        var p = a.querySelectorAll('p');
        if (p.length) ps.push(p[0]);
      });
      if (ps.length !== 7) return;
      var stats = core.homeStats(input);
      ps.forEach(function (p, i) { p.textContent = core.formatCount(stats[i]); });
      var title = $id('statistics-title');
      if (title) title.textContent = 'نظرة سريعة على حسابك (شنو منو)';
      var tagline = document.querySelector('[data-template-id="app-tagline"]');
      if (tagline) tagline.textContent = 'منصة تعلم افتراضية عراقية — مربوطة بحساب شنو منو';
    } catch (e) {}
  }

  function buildExamExtras() {
    try {
      var view = $id('exam-view');
      if (!view) return;
      if (realStudent && Array.isArray(realStudent.scores) && realStudent.scores.length && !$id('shno-past-scores')) {
        var box = el('article', 'margin-top:20px;border:2px solid #146c70;border-radius:20px;background:#fffdf9;padding:16px 18px;', '');
        box.id = 'shno-past-scores';
        box.appendChild(el('b', 'color:#183a3c;font-size:16px;', 'آخر الدرجات المسجلة (شنو منو — حقيقية)'));
        var list = el('div', 'margin-top:10px;display:grid;gap:6px;');
        realStudent.scores.slice(-5).reverse().forEach(function (sc) {
          list.appendChild(el('div', 'background:#eff6f3;border-radius:12px;padding:8px 12px;font-weight:700;color:#146c70;font-size:14px;',
            (sc.subject || 'مادة') + (sc.lesson ? ' — ' + sc.lesson : '') + ': ' + sc.score + '/' + (sc.maxScore || 10)));
        });
        box.appendChild(list);
        view.appendChild(box);
      }
      var form = $id('exam-form');
      if (form && !form.__shnoExamHook) {
        form.__shnoExamHook = true;
        // Registered after the original's onsubmit (assigned during its
        // init), so the original's local suggested score runs first, then
        // the real model answer from the curriculum is shown for review.
        form.addEventListener('submit', function () {
          try {
            var st = null;
            try { st = (typeof state !== 'undefined') ? state : null; } catch (e) {}
            var key = st ? realExamKeys[st.subject] : null;
            if (!key) return;
            var mistakes = $id('common-mistakes');
            if (mistakes) mistakes.textContent = 'الإجابة النموذجية (من منهج شنو منو): ' + key + ' — الدرجة النهائية يعتمد المعلم أو ولي الأمر.';
          } catch (e) {}
        });
      }
    } catch (e) {}
  }

  function hydrateEverything() {
    if (hydrated) return;
    hydrated = true;
    var get = function (path) { return api(path).catch(function () { return {}; }); };
    Promise.all([
      get('/api/school/students'),
      get('/api/school/teachers'),
      get('/api/school/sessions/active'),
      get('/api/school/schedules'),
      Promise.all([
        get('/api/school/curriculum/offline-pack'),
        get('/api/school/curriculum/catalog').catch(function () { return { items: [] }; })
      ]).then(function (curriculumResults) {
        var pack = curriculumResults[0] || { items: [] };
        var catalog = curriculumResults[1] || { items: [] };
        var downloaded = Array.isArray(pack.items) ? pack.items : [];
        var known = {};
        downloaded.forEach(function (item) { known[[item.stage, item.grade, item.subject].join('|')] = 1; });
        var pending = (Array.isArray(catalog.items) ? catalog.items : []).filter(function (item) {
          return !known[[item.stage, item.grade, item.subject].join('|')];
        });
        return { items: downloaded.concat(pending) };
      }),
      get('/api/school/curriculum/files')
    ]).then(function (out) {
      var students = out[0].students || [];
      realTeachersRaw = out[1].teachers || [];
      var packItems = out[4].items || [];
      realCurriculumFiles = Array.isArray(out[5].files) ? out[5].files : [];
      if (out[2].session) realSessionId = String(out[2].session._id || '');
      var schedules = out[3].schedules || [];
      if (schedules.length) {
        nextSchedule = { subject: schedules[0].subject || 'درس', when: new Date(schedules[0].scheduledAt).toLocaleDateString('ar-IQ') };
      }

      // 1) Real student identity, consents and learning path.
      if (students.length) {
        var s0 = students[0];
        realStudent = {
          name: s0.name,
          id: String(s0._id),
          stage: s0.stage,
          grade: s0.grade,
          subjects: Array.isArray(s0.subjects) ? s0.subjects : [],
          scores: Array.isArray(s0.scores) ? s0.scores : [],
          notes: Array.isArray(s0.notes) ? s0.notes : [],
          progress: s0.progress || {},
          learningPermissions: s0.learningPermissions || {}
        };
        try {
          if (typeof state !== 'undefined' && state) {
            // Only an explicit guardian approval grants the original's
            // media gate; nothing is auto-granted or auto-started.
            state.consents = core.mapConsents(realStudent.learningPermissions);
            var p = core.studentPath(realStudent, realTeachersRaw);
            if (p.stage) state.stage = p.stage;
            if (p.grade) state.grade = p.grade;
            if (p.subject) state.subject = p.subject;
            state.teacherId = p.teacherId;
            // Keep the original's selects coherent: register the student's
            // real grade/subjects when the standard lists lack them.
            try {
              var addedGrade = false;
              var addedSubject = false;
              if (typeof stages !== 'undefined' && p.stage && stages[p.stage]) {
                if (p.grade && stages[p.stage].indexOf(p.grade) === -1) { stages[p.stage].push(p.grade); addedGrade = true; }
                p.subjects.forEach(function (sub) {
                  if (typeof subjectMap !== 'undefined' && subjectMap[p.stage] && subjectMap[p.stage].indexOf(sub) === -1) {
                    subjectMap[p.stage].push(sub); addedSubject = true;
                  }
                });
              }
              if ((addedGrade || addedSubject) && typeof setOptions === 'function') {
                if (addedGrade) {
                  var allGrades = [];
                  if (typeof stages !== 'undefined') Object.keys(stages).forEach(function (k) { allGrades = allGrades.concat(stages[k] || []); });
                  if ($id('teacher-grade-filter')) setOptions($id('teacher-grade-filter'), 'كل الصفوف', allGrades);
                }
                if (addedSubject) {
                  var allSubjects = [];
                  if (typeof subjectMap !== 'undefined') Object.values(subjectMap).forEach(function (list) { allSubjects = allSubjects.concat(list || []); });
                  allSubjects = allSubjects.filter(function (v, i, a) { return a.indexOf(v) === i; });
                  if ($id('teacher-subject-filter')) setOptions($id('teacher-subject-filter'), 'كل المواد', allSubjects);
                }
              }
            } catch (e) {}
          }
        } catch (e) {}
      }

      // 2) Real teacher directory (the platform's canonical list via API).
      if (realTeachersRaw.length) {
        try {
          if (typeof teachers !== 'undefined' && Array.isArray(teachers)) {
            teachers.splice(0, teachers.length);
            realTeachersRaw.forEach(function (t) {
              teachers.push({
                id: t.id, name: t.name, gender: t.gender, subject: t.subject, stage: t.stage,
                grades: Array.isArray(t.grades) ? t.grades.join('، ') : String(t.grades || ''),
                experience: t.experience, presence: t.status || 'متاح الآن',
                language: t.language || 'عربية عراقية', rating: Number(t.rating) || 5
              });
            });
          }
        } catch (e) {}
      }

      // 3) Real curriculum: board lessons per subject + library catalog.
      try {
        if (typeof lessons !== 'undefined' && lessons) {
          var subjectList = (realStudent && realStudent.subjects.length) ? realStudent.subjects : Object.keys(lessons);
          subjectList.forEach(function (sub) {
            var item = core.pickPackItem(packItems, sub, realStudent && realStudent.stage, realStudent && realStudent.grade);
            if (item) {
              lessons[sub] = core.packLesson(item, lessons[sub]);
              if (item.modelAnswer) realExamKeys[sub] = item.modelAnswer;
            }
          });
        }
      } catch (e) {}
      try {
        if (typeof state !== 'undefined' && state && packItems.length) {
          var rows = core.packLibrary(packItems);
          var names = {};
          rows.forEach(function (r) { names[r.name] = 1; });
          var local = (Array.isArray(state.library) ? state.library : []).filter(function (x) { return !names[x.name]; });
          state.library = rows.concat(local);
        }
      } catch (e) {}

      // 4) Drive the original's own render functions with the real data.
      try {
        if (typeof populatePath === 'function') populatePath();
        if (typeof renderTeachers === 'function') renderTeachers();
        if (typeof renderConsent === 'function') renderConsent();
        if (typeof renderReport === 'function') renderReport();
        if (typeof renderLibrary === 'function') renderLibrary();
        patchCurriculumFiles();
        if (typeof renderQueue === 'function') renderQueue();
      } catch (e) {}

      // 5) Real home statistics + per-view DOM patches.
      var gradeList = [];
      var subjectSet = [];
      students.forEach(function (s) {
        if (s.grade) gradeList.push(s.grade);
        (Array.isArray(s.subjects) ? s.subjects : []).forEach(function (x) { subjectSet.push(x); });
      });
      patchHomeStats({
        studentCount: students.length,
        teacherCount: realTeachersRaw.length,
        grades: gradeList,
        subjects: subjectSet,
        lessonCount: packItems.length,
        examCount: realStudent && realStudent.scores.length || 0,
        reportCount: realStudent && realStudent.notes.length || 0
      });
      patchSeats([]);
      buildExamExtras();
      if (window.__shnoRenderIntegrationStatus) window.__shnoRenderIntegrationStatus();

      // 6) Real per-student report data (sessions + learning records).
      if (realStudent) {
        get('/api/school/students/' + realStudent.id + '/report').then(function (d) {
          realReport = d;
          try { if (typeof renderReport === 'function') renderReport(); } catch (e) {}
        }).catch(function () {});
      }
    }).catch(function () {});
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
    if (bootUpdatedCanva()) return;
    // Wrap the original's render functions first, so every later re-render
    // (user filter, save(), consent click, ...) keeps the real-data patches.
    wrapRender('renderTeachers', patchTeachersView);
    wrapRender('selectTeacher', patchTeacherProfile);
    wrapRender('renderReport', patchReportView);
    wrapRender('renderConsent', patchConsentView);
    wrapRender('renderLibrary', patchCurriculumFiles);
    try { buildClassroomBar(); } catch (e) {}
    try { buildStatusLine(); } catch (e) {}
    if (!realMode) return;
    window.__shnoAiStatus = null;
    hydrateEverything();
    api('/api/school/ai/status').then(function (d) {
      window.__shnoAiStatus = d && d.ok === false ? 'خطأ' : (d && d.configured ? ('مهيأ — ' + (d.provider || '')) : 'غير مهيأ (معلم محلي)');
      if (window.__shnoRenderIntegrationStatus) window.__shnoRenderIntegrationStatus();
    }).catch(function () {});
    try { enhanceTeacherQuestion(); } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
