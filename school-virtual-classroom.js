'use strict';

/**
 * school-virtual-classroom.js
 *
 * Client runtime for AI Virtual Teacher Classroom V1.
 * Coordinates real Iraqi curriculum binding, whiteboard drawing/zooming,
 * honest Q&A and chat, user-initiated camera/mic controls, and Socket.IO presence.
 */
(function () {
  var core = window.SchoolVirtualTeacherCore;
  if (!core) {
    console.error('SchoolVirtualTeacherCore not loaded.');
    return;
  }

  // State
  var state = {
    token: '',
    user: null,
    code: '',
    session: null,
    isHost: false,
    timerInterval: null,
    whiteboard: null,
    catalogItems: [],
    students: [],
    devices: core.initialDevicesState(),
    localStream: null,
    speechSynthesisActive: true,
    cameraPeers: new Map(),
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    hostId: '',
    socket: null
  };
  var displayedMessages = new Set();
  var spokenAnswers = new Set();

  // Helper selectors
  var $ = function (id) { return document.getElementById(id); };

  function show(id) { var el = $(id); if (el) el.hidden = false; }
  function hide(id) { var el = $(id); if (el) el.hidden = true; }

  function notify(msg, isError) {
    var box = $('virtualMessage');
    if (!box) return;
    box.textContent = msg;
    box.style.backgroundColor = isError ? '#ffebee' : '#fff3cd';
    box.style.color = isError ? '#c62828' : '#856404';
    box.style.borderColor = isError ? '#ef9a9a' : '#ffeeba';
    box.hidden = false;
    setTimeout(function () { box.hidden = true; }, 6000);
  }

  function getToken() {
    try {
      if (window.SocialApi && typeof window.SocialApi.getToken === 'function') {
        var t = window.SocialApi.getToken();
        if (t) return t;
      }
    } catch (e) {}
    return localStorage.getItem('token') || localStorage.getItem('auth_token') || '';
  }

  function api(url, opts) {
    opts = opts || {};
    var headers = opts.headers || {};
    if (state.token) headers.Authorization = 'Bearer ' + state.token;
    if (opts.body && typeof opts.body === 'object') {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    opts.headers = headers;
    return fetch(url, opts).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) {
          var err = new Error(data && data.message ? data.message : 'HTTP ' + res.status);
          err.status = res.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  // -------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------
  function init() {
    state.token = getToken();
    var codeFromUrl = core.codeFromSearch(window.location.search);

    // Initial whiteboard state
    state.whiteboard = core.createWhiteboardState();
    setupWhiteboardCanvas();

    // Bind event listeners
    bindLobbyEvents();
    bindWhiteboardToolbar();
    bindMediaControls();
    bindQuestionControls();
    bindSettingsControls();

    if (codeFromUrl) {
      joinVirtualSession(codeFromUrl, '');
    } else {
      enterLobby();
    }
  }

  // -------------------------------------------------------------
  // Lobby Mode
  // -------------------------------------------------------------
  function enterLobby() {
    hide('virtualRoom');
    hide('classroomStatusBar');
    hide('topTeacherBadge');
    show('virtualLobby');
    loadLobbyData();
  }

  function loadLobbyData() {
    // 1) Load curriculum catalog for cascade
    api('/api/school/curriculum/catalog').then(function (data) {
      state.catalogItems = Array.isArray(data.items) ? data.items : [];
      populateStages();
    }).catch(function (e) {
      notify('تعذر تحميل كتالوج المناهج: ' + e.message, true);
    });

    // 2) Load real registered students of this account
    api('/api/school/students').then(function (data) {
      state.students = Array.isArray(data.students) ? data.students : [];
      populateStudentsSelect();
    }).catch(function () {});

    // 3) Load active sessions list
    loadActiveSessions();
  }

  function populateStages() {
    var stageSelect = $('createStage');
    if (!stageSelect) return;
    stageSelect.innerHTML = '<option value="">اختر المرحلة الدراسية</option>';
    var c = core.cascade(state.catalogItems, {});
    c.stages.forEach(function (st) {
      var opt = document.createElement('option');
      opt.value = st;
      opt.textContent = st;
      stageSelect.appendChild(opt);
    });
  }

  function populateStudentsSelect() {
    var sel = $('joinStudent');
    if (!sel) return;
    sel.innerHTML = '<option value="">أنا بنفسي (حسابي الحالي)</option>';
    state.students.forEach(function (s) {
      var opt = document.createElement('option');
      opt.value = s._id || s.id;
      opt.textContent = s.name + ' (' + s.stage + ' — ' + s.grade + ')';
      sel.appendChild(opt);
    });
  }

  function loadActiveSessions() {
    var box = $('activeSessionsBox');
    if (!box) return;
    api('/api/school/virtual/sessions/active').then(function (d) {
      var list = Array.isArray(d.sessions) ? d.sessions : [];
      if (!list.length) {
        box.innerHTML = '<p class="empty-state-text">لا توجد حصص افتراضية نشطة حالياً.</p>';
        return;
      }
      box.innerHTML = '';
      list.forEach(function (s) {
        var chip = document.createElement('div');
        chip.className = 'session-chip';
        var title = document.createElement('div');
        title.textContent = (s.subject || 'مادة') + ': ' + (s.lesson || 'درس') + ' (' + (s.grade || '') + ')';
        var badge = document.createElement('span');
        badge.className = 'badge'; badge.textContent = s.code;
        chip.appendChild(title); chip.appendChild(badge);
        chip.addEventListener('click', function () {
          joinVirtualSession(s.code, $('joinStudent').value);
        });
        box.appendChild(chip);
      });
    }).catch(function () {
      box.innerHTML = '<p class="empty-state-text">تعذر جلب الحصص المتاحة.</p>';
    });
  }

  function bindLobbyEvents() {
    var stageSelect = $('createStage');
    var gradeSelect = $('createGrade');
    var subjectSelect = $('createSubject');

    if (stageSelect) {
      stageSelect.addEventListener('change', function () {
        var stage = stageSelect.value;
        gradeSelect.innerHTML = '<option value="">اختر الصف</option>';
        subjectSelect.innerHTML = '<option value="">اختر المادة</option>';
        subjectSelect.disabled = true;

        if (!stage) {
          gradeSelect.disabled = true;
          return;
        }

        var c = core.cascade(state.catalogItems, { stage: stage });
        c.grades.forEach(function (g) {
          var opt = document.createElement('option');
          opt.value = g;
          opt.textContent = g;
          gradeSelect.appendChild(opt);
        });
        gradeSelect.disabled = false;
      });
    }

    if (gradeSelect) {
      gradeSelect.addEventListener('change', function () {
        var stage = stageSelect.value;
        var grade = gradeSelect.value;
        subjectSelect.innerHTML = '<option value="">اختر المادة</option>';

        if (!grade) {
          subjectSelect.disabled = true;
          return;
        }

        var c = core.cascade(state.catalogItems, { stage: stage, grade: grade });
        c.subjects.forEach(function (sub) {
          var opt = document.createElement('option');
          opt.value = sub;
          opt.textContent = sub;
          subjectSelect.appendChild(opt);
        });
        subjectSelect.disabled = false;
      });
    }

    var createForm = $('createVirtualForm');
    if (createForm) {
      createForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var stage = stageSelect.value;
        var grade = gradeSelect.value;
        var subject = subjectSelect.value;
        var lesson = ($('createLesson').value || '').trim();
        var profileId = $('selectProfile').value;
        var dialect = $('selectDialect').value;

        if (!stage || !grade || !subject || !lesson) {
          notify('يرجى ملء جميع الحقول من المنهج الحقيقي أولاً.', true);
          return;
        }

        var createButton = $('createVirtualBtn');
        createButton.disabled = true;
        api('/api/school/virtual/sessions', {
          method: 'POST',
          body: {
            stage: stage,
            grade: grade,
            subject: subject,
            lesson: lesson,
            profileId: profileId,
            dialect: dialect
          }
        }).then(function (res) {
          notify('تم بدء الحصة الافتراضية بنجاح!');
          loadSession(res.code);
        }).catch(function (err) {
          notify('خطأ في بدء الحصة: ' + err.message, true);
        }).finally(function () { createButton.disabled = false; });
      });
    }

    var joinForm = $('joinVirtualForm');
    if (joinForm) {
      joinForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var code = core.normalizeCode($('joinCodeInput').value);
        var studentId = $('joinStudent').value;
        if (!code) {
          notify('رمز الحصة يجب أن يتكون من 6 أحرف صالحة.', true);
          return;
        }
        joinVirtualSession(code, studentId);
      });
    }

    var leaveBtn = $('leaveClassBtn');
    if (leaveBtn) {
      leaveBtn.addEventListener('click', function () {
        if (!state.code) return;
        api('/api/school/virtual/sessions/' + encodeURIComponent(state.code) + '/leave', {
          method: 'POST',
          body: {}
        }).finally(function () {
          cleanupSession();
          enterLobby();
        });
      });
    }
  }

  // -------------------------------------------------------------
  // Active Room Mode
  // -------------------------------------------------------------
  function joinVirtualSession(code, studentId) {
    code = core.normalizeCode(code);
    if (!code) { notify('رمز الحصة غير صالح.', true); return; }
    api('/api/school/virtual/sessions/' + encodeURIComponent(code) + '/join', {
      method: 'POST', body: { studentId: studentId || undefined }
    }).then(function () { loadSession(code); }).catch(function (err) {
      notify('تعذر الانضمام: ' + err.message, true);
      enterLobby();
    });
  }

  function loadSession(code) {
    code = core.normalizeCode(code);
    if (!code) {
      notify('رمز الحصة غير صالح.', true);
      enterLobby();
      return;
    }

    api('/api/school/virtual/sessions/' + encodeURIComponent(code)).then(function (data) {
      state.code = code;
      state.session = data.session;
      renderClassroom(data.session);
      hide('virtualLobby');
      show('virtualRoom');
      show('classroomStatusBar');
      show('topTeacherBadge');

      // Update URL without reloading
      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, '', '?code=' + code);
      }

      startElapsedTimer(data.session.startedAt);
      initSocket(code);
      loadMessages(code);
    }).catch(function (err) {
      notify('تعذر فتح الحصة: ' + err.message, true);
      enterLobby();
    });
  }

  function renderClassroom(session) {
    // 1) Metadata bar
    $('metaLesson').textContent = 'الدرس: ' + (session.lesson || 'غير محدد');
    $('metaSubject').textContent = 'المادة: ' + (session.subject || 'غير محدد');
    $('metaGrade').textContent = 'الصف: ' + (session.grade || 'غير محدد');
    $('metaSource').textContent = '📖 ' + (session.sourceTitle || session.sourceBookName || 'المنهج العراقي');

    // 2) Top Teacher Quick Indicator
    var teacher = session.virtualTeacher || {};
    state.session = session;
    $('topTeacherName').textContent = teacher.name || 'أ. سارة الذكية';

    // 3) Left Teacher Panel
    $('teacherDisplayName').textContent = teacher.name || 'أ. سارة الذكية';
    $('teacherRoleTag').textContent = teacher.title || 'معلم رياضيات افتراضي';
    var dialectObj = core.getDialect(teacher.dialect);
    $('teacherDialectLabel').textContent = dialectObj.name;

    // 4) Check Host Role for End Button
    // If authenticated user is host, show End Session button
    api('/api/school/virtual/sessions/mine').then(function (d) {
      if (d && d.hosting && d.hosting.code === session.code) {
        state.isHost = true;
        show('endClassBtn');
        show('virtualAttendanceBtn');
      } else {
        state.isHost = false;
        hide('endClassBtn');
        hide('virtualAttendanceBtn');
      }
    }).catch(function () {});

    // 5) Whiteboard Render
    if (session.whiteboardData && Array.isArray(session.whiteboardData.slides) && session.whiteboardData.slides.length) {
      state.whiteboard = core.createWhiteboardState(session.whiteboardData.slides);
      state.whiteboard.setSlide(session.whiteboardData.currentSlide || 0);
      renderWhiteboardSlide();
    }

    // 6) Participants List
    renderParticipants(session.participants || []);
  }

  function renderParticipants(participants) {
    var list = $('studentsList');
    var carousel = $('studentsCarousel');
    var countEl = $('participantsCount');
    if (!list) return;

    var students = participants.filter(function (p) {
      return p.role === 'student' && !p.leftAt;
    });

    if (countEl) countEl.textContent = String(students.length + 1); // +1 for AI Teacher

    if (!students.length) {
      list.innerHTML = '';
      show('studentsEmptyState');
      if (carousel) {
        carousel.innerHTML = '';
        show('carouselEmptyState');
      }
      return;
    }

    hide('studentsEmptyState');
    if (carousel) hide('carouselEmptyState');

    list.innerHTML = '';
    if (carousel) carousel.innerHTML = '';

    students.forEach(function (s) {
      // Roster row
      var item = document.createElement('div');
      item.className = 'roster-item';
      var micIcon = s.media && s.media.mic ? '🎙️' : '🔇';
      var handIcon = s.handRaised ? '✋' : '';
      item.innerHTML = '<div class="roster-avatar">👤</div>' +
        '<div class="roster-info">' +
          '<div class="roster-name">' + s.name + '</div>' +
          '<div class="roster-sub">' + (s.online ? 'متصل' : 'غير متصل') + '</div>' +
        '</div>' +
        '<div class="roster-icons"><span>' + handIcon + '</span><span>' + micIcon + '</span></div>';
      list.appendChild(item);

      // Carousel tile
      if (carousel) {
        var tile = document.createElement('div');
        tile.className = 'carousel-tile';
        tile.innerHTML = '<div class="carousel-avatar">👤</div>' +
          '<div class="carousel-name" title="' + s.name + '">' + s.name + '</div>' +
          '<div class="carousel-status-icons"><span>' + handIcon + '</span><span>' + micIcon + '</span></div>';
        carousel.appendChild(tile);
      }
    });
  }

  function startElapsedTimer(startTime) {
    if (state.timerInterval) clearInterval(state.timerInterval);
    var start = startTime ? new Date(startTime).getTime() : Date.now();
    var timerEl = $('elapsedTimer');

    function update() {
      var diff = Math.floor((Date.now() - start) / 1000);
      var m = Math.floor(diff / 60);
      var s = diff % 60;
      var strM = m < 10 ? '0' + m : String(m);
      var strS = s < 10 ? '0' + s : String(s);
      if (timerEl) timerEl.textContent = strM + ':' + strS;
    }
    update();
    state.timerInterval = setInterval(update, 1000);
  }

  function cleanupSession() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
    stopMediaTracks();
    state.cameraPeers.forEach(function (peer) { peer.close(); });
    state.cameraPeers.clear();
    if ($('virtualStudentCameraGrid')) $('virtualStudentCameraGrid').replaceChildren();
    hide('virtualStudentCameras');
    if (state.socket) {
      try {
        state.socket.emit('school:virtual:leave', { code: state.code });
        state.socket.disconnect();
      } catch (e) {}
      state.socket = null;
    }
    state.code = '';
    state.isHost = false;
    hide('virtualAttendancePanel');
    state.session = null;
    displayedMessages.clear();
    spokenAnswers.clear();
  }

  window.addEventListener('pagehide', cleanupSession);
  window.addEventListener('beforeunload', cleanupSession);

  // -------------------------------------------------------------
  // Whiteboard Canvas & Slide Render
  // -------------------------------------------------------------
  var canvasCtx = null;
  var isDrawing = false;
  var lastX = 0;
  var lastY = 0;
  function saveWhiteboard() {
    if (!state.code || !state.isHost) return;
    var canvas = $('whiteboardCanvas');
    if (!canvas) return;
    var drawing = canvas.toDataURL('image/png');
    var slide = state.whiteboard.getCurrentSlide();
    slide.drawing = drawing;
    api('/api/school/virtual/sessions/' + encodeURIComponent(state.code) + '/whiteboard', {
      method: 'POST', body: { currentSlide: state.whiteboard.getCurrentSlideIndex(), drawing: drawing }
    }).catch(function (error) { notify('تعذر حفظ السبورة: ' + error.message, true); });
  }

  function saveSlidePosition() {
    if (!state.code || !state.isHost) return;
    api('/api/school/virtual/sessions/' + encodeURIComponent(state.code) + '/whiteboard', {
      method: 'POST', body: { currentSlide: state.whiteboard.getCurrentSlideIndex() }
    }).catch(function (error) { notify('تعذر حفظ موضع السبورة: ' + error.message, true); });
  }

  function setupWhiteboardCanvas() {
    var canvas = $('whiteboardCanvas');
    if (!canvas) return;
    canvasCtx = canvas.getContext('2d');

    function getCoords(e) {
      var rect = canvas.getBoundingClientRect();
      var scaleX = canvas.width / rect.width;
      var scaleY = canvas.height / rect.height;
      var clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      var clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    }

    function startDraw(e) {
      if (!state.isHost) return;
      if (state.whiteboard.getTool() === 'select') return;
      e.preventDefault();
      try { state.whiteboard.pushHistory(canvas.toDataURL('image/png')); } catch (_) {}
      isDrawing = true;
      var pos = getCoords(e);
      lastX = pos.x;
      lastY = pos.y;
    }

    function draw(e) {
      if (!isDrawing || !canvasCtx) return;
      e.preventDefault();
      var pos = getCoords(e);
      var tool = state.whiteboard.getTool();

      canvasCtx.beginPath();
      canvasCtx.moveTo(lastX, lastY);
      canvasCtx.lineTo(pos.x, pos.y);

      if (tool === 'eraser') {
        canvasCtx.globalCompositeOperation = 'destination-out';
        canvasCtx.lineWidth = state.whiteboard.getStrokeSize();
      } else if (tool === 'highlighter') {
        canvasCtx.globalCompositeOperation = 'source-over';
        canvasCtx.strokeStyle = 'rgba(255, 235, 59, 0.4)';
        canvasCtx.lineWidth = state.whiteboard.getStrokeSize();
      } else {
        canvasCtx.globalCompositeOperation = 'source-over';
        canvasCtx.strokeStyle = state.whiteboard.getColor();
        canvasCtx.lineWidth = state.whiteboard.getStrokeSize();
      }

      canvasCtx.lineCap = 'round';
      canvasCtx.lineJoin = 'round';
      canvasCtx.stroke();

      lastX = pos.x;
      lastY = pos.y;
    }

    function stopDraw() {
      if (isDrawing && canvas) {
        isDrawing = false;
        saveWhiteboard();
      }
    }

    canvas.addEventListener('pointerdown', startDraw);
    canvas.addEventListener('pointermove', draw);
    canvas.addEventListener('pointerup', stopDraw);
    canvas.addEventListener('pointercancel', stopDraw);
  }

  function renderWhiteboardSlide() {
    var slide = state.whiteboard.getCurrentSlide();
    var idx = state.whiteboard.getCurrentSlideIndex();
    var total = state.whiteboard.getTotalSlides();

    $('slideIndicator').textContent = (idx + 1) + ' / ' + total;
    $('boardLessonTitle').textContent = slide.title || 'عنوان الدرس';

    // Left Column
    if (slide.leftColumn) {
      $('boardLeftTitle').textContent = slide.leftColumn.title || '';
      var leftItemsEl = $('boardLeftItems');
      leftItemsEl.innerHTML = '';
      (slide.leftColumn.items || []).forEach(function (it) {
        var div = document.createElement('div');
        div.className = 'math-item';
        div.textContent = it;
        leftItemsEl.appendChild(div);
      });
    }

    // Right Column
    if (slide.rightColumn) {
      $('boardRightTitle').textContent = slide.rightColumn.title || '';
      if (slide.example) {
        $('boardRightExample').innerHTML = '<div class="example-title">مثال:</div><div class="example-body">' + slide.example + '</div>';
        show('boardRightExample');
      } else {
        hide('boardRightExample');
      }
    }

    // Note Box
    if (slide.note) {
      $('boardNoteText').textContent = slide.note;
      show('boardNoteBox');
    } else {
      hide('boardNoteBox');
    }

    // Clear and restore drawing
    if (canvasCtx && $('whiteboardCanvas')) {
      canvasCtx.clearRect(0, 0, $('whiteboardCanvas').width, $('whiteboardCanvas').height);
      if (slide.drawing) {
        var img = new Image();
        img.onload = function () {
          if (state.whiteboard.getCurrentSlideIndex() !== idx) return;
          canvasCtx.drawImage(img, 0, 0);
        };
        img.src = slide.drawing;
      }
    }
  }

  function bindWhiteboardToolbar() {
    var toolBtns = ['toolSelect', 'toolPen', 'toolHighlighter', 'toolEraser'];
    toolBtns.forEach(function (btnId) {
      var btn = $(btnId);
      if (!btn) return;
      btn.addEventListener('click', function () {
        toolBtns.forEach(function (id) { if ($(id)) $(id).classList.remove('active'); });
        btn.classList.add('active');
        var tool = btnId.replace('tool', '').toLowerCase();
        state.whiteboard.setTool(tool);
      });
    });

    // Colors
    var colorDots = document.querySelectorAll('.color-dot');
    colorDots.forEach(function (dot) {
      dot.addEventListener('click', function () {
        colorDots.forEach(function (d) { d.classList.remove('active'); });
        dot.classList.add('active');
        state.whiteboard.setColor(dot.dataset.color);
        // Switch back to pen if on eraser
        if (state.whiteboard.getTool() === 'eraser') {
          $('toolPen').click();
        }
      });
    });

    // Clear
    var clearBtn = $('toolClear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (!state.isHost) return;
        if (canvasCtx && $('whiteboardCanvas')) {
          canvasCtx.clearRect(0, 0, $('whiteboardCanvas').width, $('whiteboardCanvas').height);
          state.whiteboard.clearDrawing();
          saveWhiteboard();
        }
      });
    }

    // Undo & Redo
    var undoBtn = $('undoBtn');
    if (undoBtn) {
      undoBtn.addEventListener('click', function () {
        if (!state.isHost) return;
        var canvas = $('whiteboardCanvas');
        if (!canvas || !canvasCtx) return;
        var prev = state.whiteboard.undo(canvas.toDataURL());
        if (prev) {
          var img = new Image();
          img.onload = function () {
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            canvasCtx.drawImage(img, 0, 0);
            saveWhiteboard();
          };
          img.src = prev;
        } else {
          canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
          saveWhiteboard();
        }
      });
    }

    var redoBtn = $('redoBtn');
    if (redoBtn) {
      redoBtn.addEventListener('click', function () {
        if (!state.isHost) return;
        var canvas = $('whiteboardCanvas');
        if (!canvas || !canvasCtx) return;
        var next = state.whiteboard.redo(canvas.toDataURL());
        if (next) {
          var img = new Image();
          img.onload = function () {
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            canvasCtx.drawImage(img, 0, 0);
            saveWhiteboard();
          };
          img.src = next;
        }
      });
    }

    // Pagination
    var prevBtn = $('prevSlideBtn');
    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        if (!state.isHost) return;
        if (state.whiteboard.prevSlide()) { renderWhiteboardSlide(); saveSlidePosition(); }
      });
    }
    var nextBtn = $('nextSlideBtn');
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        if (!state.isHost) return;
        if (state.whiteboard.nextSlide()) { renderWhiteboardSlide(); saveSlidePosition(); }
      });
    }

    // Zoom
    var zoomInBtn = $('zoomInBtn');
    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', function () {
        var z = state.whiteboard.zoomIn();
        applyZoom(z);
      });
    }
    var zoomOutBtn = $('zoomOutBtn');
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', function () {
        var z = state.whiteboard.zoomOut();
        applyZoom(z);
      });
    }

    // Fullscreen
    var fsBtn = $('fullscreenBtn');
    if (fsBtn) {
      fsBtn.addEventListener('click', function () {
        var surface = $('whiteboardSurface');
        if (!document.fullscreenElement) {
          if (surface.requestFullscreen) surface.requestFullscreen();
        } else {
          if (document.exitFullscreen) document.exitFullscreen();
        }
      });
    }
  }

  function applyZoom(z) {
    $('zoomLabel').textContent = z + '%';
    var content = $('whiteboardContent');
    if (content) {
      content.style.transform = 'scale(' + (z / 100) + ')';
      content.style.transformOrigin = 'top right';
    }
  }

  // -------------------------------------------------------------
  // Camera & Mic Controls (Explicit User-Action Only, No Recording)
  // -------------------------------------------------------------
  function bindMediaControls() {
    var micBtn = $('micBtn');
    var camBtn = $('camBtn');
    var handBtn = $('handBtn');
    var endBtn = $('endClassBtn');

    // Microphone toggle
    if (micBtn) {
      micBtn.addEventListener('click', function () {
        if (state.devices.mic) {
          // Stop mic
          stopAudioTracks();
          state.devices.mic = false;
          micBtn.classList.remove('active');
          $('micLabel').textContent = 'تشغيل المايك';
          sendMediaState();
        } else {
          // Explicit user click triggers getUserMedia
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            notify('المتصفح لا يدعم الوصول للمايك.', true);
            return;
          }
          navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
            state.devices.mic = true;
            micBtn.classList.add('active');
            $('micLabel').textContent = 'إيقاف المايك';
            // Store tracks
            if (!state.localStream) state.localStream = stream;
            else stream.getAudioTracks().forEach(function (t) { state.localStream.addTrack(t); });
            sendMediaState();
          }).catch(function (err) {
            notify('تعذر تشغيل المايك: ' + err.message, true);
          });
        }
      });
    }

    // Camera toggle
    if (camBtn) {
      camBtn.addEventListener('click', function () {
        if (state.devices.camera) {
          // Stop camera
          stopVideoTracks();
          state.cameraPeers.forEach(function (peer) { peer.close(); });
          state.cameraPeers.clear();
          state.devices.camera = false;
          camBtn.classList.remove('active');
          $('camLabel').textContent = 'تشغيل الكاميرا';
          hide('localVideoContainer');
          sendMediaState();
        } else {
          // Explicit user click triggers getUserMedia
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            notify('المتصفح لا يدعم الوصول للكاميرا.', true);
            return;
          }
          navigator.mediaDevices.getUserMedia({ video: true }).then(function (stream) {
            state.devices.camera = true;
            camBtn.classList.add('active');
            $('camLabel').textContent = 'إيقاف الكاميرا';
            show('localVideoContainer');
            var vid = $('localVideo');
            if (vid) vid.srcObject = stream;
            // Store tracks
            if (!state.localStream) state.localStream = stream;
            else stream.getVideoTracks().forEach(function (t) { state.localStream.addTrack(t); });
            sendMediaState().then(function (allowed) {
              if (allowed && !state.isHost) startStudentCamera();
            });
          }).catch(function (err) {
            notify('تعذر تشغيل الكاميرا: ' + err.message, true);
          });
        }
      });
    }

    // Hand raise
    if (handBtn) {
      handBtn.addEventListener('click', function () {
        if (!state.code) return;
        var currentlyRaised = handBtn.classList.contains('active');
        api('/api/school/virtual/sessions/' + encodeURIComponent(state.code) + '/hand', {
          method: 'POST',
          body: { raised: !currentlyRaised }
        }).then(function (res) {
          if (res.participant && res.participant.handRaised) {
            handBtn.classList.add('active');
          } else {
            handBtn.classList.remove('active');
          }
        }).catch(function (err) {
          notify('خطأ في تحديث اليد: ' + err.message, true);
        });
      });
    }

    // End class
    if (endBtn) {
      endBtn.addEventListener('click', function () {
        if (!state.code || !confirm('هل أنت متأكد من رغبتك في إنهاء هذه الحصة الافتراضية؟')) return;
        api('/api/school/virtual/sessions/' + encodeURIComponent(state.code) + '/end', {
          method: 'POST',
          body: {}
        }).then(function () {
          notify('تم إنهاء الحصة الافتراضية.');
          cleanupSession();
          enterLobby();
        }).catch(function (err) {
          notify('تعذر إنهاء الحصة: ' + err.message, true);
        });
      });
    }
  }

  function stopAudioTracks() {
    if (state.localStream) {
      state.localStream.getAudioTracks().forEach(function (t) { t.stop(); });
    }
  }

  function stopVideoTracks() {
    if (state.localStream) {
      state.localStream.getVideoTracks().forEach(function (t) { t.stop(); });
    }
    var vid = $('localVideo');
    if (vid) vid.srcObject = null;
  }

  function stopMediaTracks() {
    stopAudioTracks();
    stopVideoTracks();
    state.localStream = null;
    state.devices = core.initialDevicesState();
    if ($('micBtn')) {
      $('micBtn').classList.remove('active');
      $('micLabel').textContent = 'تشغيل المايك';
    }
    if ($('camBtn')) {
      $('camBtn').classList.remove('active');
      $('camLabel').textContent = 'تشغيل الكاميرا';
    }
    hide('localVideoContainer');
  }

  function sendMediaState() {
    if (!state.code) return Promise.resolve(false);
    return api('/api/school/virtual/sessions/' + encodeURIComponent(state.code) + '/media', {
      method: 'POST',
      body: {
        camera: state.devices.camera,
        mic: state.devices.mic
      }
    }).then(function (result) {
      if (state.devices.camera && result.forced && result.forced.includes('camera')) {
        stopVideoTracks(); state.devices.camera = false; hide('localVideoContainer');
        $('camLabel').textContent = 'تشغيل الكاميرا';
        notify('كاميرا الطالب غير مسموحة في هذه الحصة.', true);
        return false;
      }
      return true;
    }).catch(function (error) { notify('تعذر تحديث حالة الكاميرا: ' + error.message, true); return false; });
  }

  // -------------------------------------------------------------
  // Q&A and Chat Handling
  // -------------------------------------------------------------
  function bindQuestionControls() {
    var form = $('questionForm');
    var input = $('questionInput');
    var voiceBtn = $('voiceQuestionBtn');
    var quickBtn = $('quickAskBtn');

    // Tab buttons
    var tabPart = $('tabBtnParticipants');
    var tabChat = $('tabBtnChat');
    if (tabPart && tabChat) {
      tabPart.addEventListener('click', function () {
        tabPart.classList.add('active');
        tabChat.classList.remove('active');
        $('tabContentParticipants').classList.add('active');
        $('tabContentChat').classList.remove('active');
      });
      tabChat.addEventListener('click', function () {
        tabChat.classList.add('active');
        tabPart.classList.remove('active');
        $('tabContentChat').classList.add('active');
        $('tabContentParticipants').classList.remove('active');
      });
    }

    if (quickBtn) {
      quickBtn.addEventListener('click', function () {
        if (tabChat) tabChat.click();
        if (input) input.focus();
      });
    }

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var text = (input.value || '').trim();
        if (!text || !state.code) return;
        input.value = '';

        api('/api/school/virtual/sessions/' + encodeURIComponent(state.code) + '/questions', {
          method: 'POST',
          body: { text: text, isVoice: false }
        }).then(function (res) {
          hide('aiUnavailableBanner');
          if (res.question) appendMessage(res.question);
          if (res.answer) {
            appendMessage(res.answer);
            speakAiAnswer(res.answer.text, res.answer._id || res.answer.id);
          }
        }).catch(function (err) {
          if (err.status === 503) {
            show('aiUnavailableBanner');
            if (err.data && err.data.question) appendMessage(err.data.question);
          } else {
            notify('خطأ في إرسال السؤال: ' + err.message, true);
          }
        });
      });
    }

    // Voice question button
    if (voiceBtn) {
      voiceBtn.addEventListener('click', function () {
        var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
          notify('ميزة التعرف الصوتي غير مدعومة في متصفحك. استخدم كتابة السؤال نصياً.', true);
          return;
        }
        var rec = new SpeechRec();
        rec.lang = 'ar-IQ';
        rec.interimResults = false;
        voiceBtn.textContent = '🔴';
        rec.onresult = function (ev) {
          var transcript = ev.results[0][0].transcript;
          if (input) input.value = transcript;
          voiceBtn.textContent = '🎤';
        };
        rec.onerror = function () {
          voiceBtn.textContent = '🎤';
        };
        rec.onend = function () {
          voiceBtn.textContent = '🎤';
        };
        rec.start();
      });
    }

    // Speech bubble speak button
    var speakBtn = $('speakSpeechBtn');
    if (speakBtn) {
      speakBtn.addEventListener('click', function () {
        var text = $('speechText').textContent;
        speakAiAnswer(text, null, true);
      });
    }

    // Toggle teacher voice
    var voiceToggleBtn = $('toggleTeacherVoiceBtn');
    if (voiceToggleBtn) {
      voiceToggleBtn.addEventListener('click', function () {
        state.speechSynthesisActive = !state.speechSynthesisActive;
        if (state.speechSynthesisActive) {
          voiceToggleBtn.classList.add('active');
          $('teacherVoiceIcon').textContent = '🔊';
          $('teacherVoiceText').textContent = 'صوت المعلم مفعّل';
          speakAiAnswer($('speechText').textContent, null, true);
        } else {
          voiceToggleBtn.classList.remove('active');
          $('teacherVoiceIcon').textContent = '🔇';
          $('teacherVoiceText').textContent = 'صوت المعلم مكتوم';
          if (window.speechSynthesis) window.speechSynthesis.cancel();
        }
      });
    }
  }

  function loadMessages(code) {
    api('/api/school/virtual/sessions/' + encodeURIComponent(code) + '/messages').then(function (d) {
      var messages = Array.isArray(d.messages) ? d.messages : [];
      var box = $('chatMessagesBox');
      if (!box) return;
      box.innerHTML = '';
      displayedMessages.clear();
      if (!messages.length) {
        show('chatEmptyState');
        return;
      }
      hide('chatEmptyState');
      messages.forEach(function (m) {
        appendMessage(m);
      });
    }).catch(function () {});
  }

  function appendMessage(m) {
    var id = m._id || m.id;
    if (id && displayedMessages.has(String(id))) return;
    if (id) displayedMessages.add(String(id));
    hide('chatEmptyState');
    var box = $('chatMessagesBox');
    if (!box) return;

    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble ' + (m.senderType === 'teacher_ai' ? 'teacher-msg' : 'student-msg');

    var time = new Date(m.timestamp || Date.now());
    var timeStr = time.getHours() + ':' + (time.getMinutes() < 10 ? '0' : '') + time.getMinutes();

    var sender = document.createElement('div'); sender.className = 'msg-sender';
    sender.textContent = (m.senderName || 'مشارك') + ' · ' + timeStr;
    var content = document.createElement('div'); content.className = 'msg-text';
    content.textContent = m.text || '';
    bubble.appendChild(sender); bubble.appendChild(content);

    box.appendChild(bubble);
    box.scrollTop = box.scrollHeight;

    // If teacher speech bubble update
    if (m.senderType === 'teacher_ai') {
      $('speechText').textContent = m.text;
    }
  }

  function speakAiAnswer(text, answerId, manual) {
    if (!state.speechSynthesisActive || !text) return;
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      notify('هذا المتصفح لا يدعم صوت المعلم. جرّب Chrome مع تثبيت صوت عربي في إعدادات النظام.', true);
      return;
    }
    var key = answerId && String(answerId);
    if (!manual && key && spokenAnswers.has(key)) return;
    if (key) spokenAnswers.add(key);
    try {
      window.speechSynthesis.cancel();
      var utterance = new SpeechSynthesisUtterance(text);
      var voices = window.speechSynthesis.getVoices();
      var arabic = voices.find(function (v) { return /^ar[-_]IQ$/i.test(v.lang); }) ||
        voices.find(function (v) { return /^ar[-_]/i.test(v.lang); });
      if (arabic) utterance.voice = arabic;
      utterance.lang = arabic ? arabic.lang : 'ar-IQ';
      utterance.pitch = 1.0;
      utterance.rate = 1.0;
      utterance.volume = 1;
      utterance.onerror = function (event) {
        if (key) spokenAnswers.delete(key);
        if (event.error !== 'interrupted' && event.error !== 'canceled') {
          notify('تعذر نطق صوت المعلم (' + event.error + '). اضغط زر 🔊 ثم تأكد من توفر صوت عربي وصوت الجهاز.', true);
        }
      };
      window.speechSynthesis.speak(utterance);
      // Some Chromium builds pause long utterances until resume is called.
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    } catch (e) {
      if (key) spokenAnswers.delete(key);
      notify('تعذر تشغيل صوت المعلم: ' + e.message, true);
    }
  }

  // -------------------------------------------------------------
  // Settings & Personas Modal
  // -------------------------------------------------------------
  function bindSettingsControls() {
    var openBtn = $('openSettingsBtn');
    var switchBtn = $('switchTeacherBtn');
    var modal = $('settingsModal');
    var closeBtn = $('closeSettingsBtn');
    var saveBtn = $('saveSettingsBtn');
    var attendanceBtn = $('virtualAttendanceBtn');
    if (attendanceBtn) attendanceBtn.addEventListener('click', function () {
      if (!state.code || !state.isHost) return;
      api('/api/school/virtual/sessions/' + encodeURIComponent(state.code) + '/attendance').then(function (result) {
        var rows = $('virtualAttendanceRows'); rows.replaceChildren();
        (result.attendance || []).forEach(function (person) {
          var row = document.createElement('p');
          row.textContent = (person.name || 'طالب') + ' — ' + (person.minutesPresent || 0) + ' دقيقة';
          rows.appendChild(row);
        });
        if (!rows.childNodes.length) rows.textContent = 'لا يوجد حضور مسجل بعد.';
        show('virtualAttendancePanel');
      }).catch(function (error) { notify(error.message, true); });
    });
    $('closeVirtualAttendance').addEventListener('click', function () { hide('virtualAttendancePanel'); });

    function openModal() {
      if (!modal) return;
      populateModalProfiles();
      var current = state.session && state.session.virtualTeacher;
      if ($('modalProfileSelect')) $('modalProfileSelect').value = current && current.profileId || 'sarah-smart';
      if ($('modalDialectSelect')) $('modalDialectSelect').value = current && current.dialect || 'ar-standard';
      show('settingsModal');
    }

    if (openBtn) openBtn.addEventListener('click', openModal);
    if (switchBtn) switchBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', function () { hide('settingsModal'); });
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        if (!state.code || !state.isHost) { notify('تعديل المعلم متاح لمشرف الحصة فقط.', true); return; }
        saveBtn.disabled = true;
        api('/api/school/virtual/sessions/' + encodeURIComponent(state.code) + '/teacher', {
          method: 'PATCH', body: { profileId: $('modalProfileSelect').value, dialect: $('modalDialectSelect').value }
        }).then(function (result) {
          state.session.virtualTeacher = result.teacher;
          updateTeacherDisplay(result.teacher);
          hide('settingsModal');
          notify('تم حفظ إعدادات المعلم الافتراضي للحصة.');
        }).catch(function (error) { notify(error.message, true); }).finally(function () { saveBtn.disabled = false; });
      });
    }
  }

  function populateModalProfiles() {
    var box = $('modalProfilesList');
    if (!box) return;
    box.innerHTML = '<label for="modalProfileSelect">شخصية المعلم</label><select id="modalProfileSelect"></select>';
    var select = $('modalProfileSelect');
    core.PROFILES.forEach(function (p) {
      var option = document.createElement('option');
      option.value = p.profileId;
      option.textContent = p.name + ' — ' + p.title;
      select.appendChild(option);
    });
  }

  function updateTeacherDisplay(teacher) {
    if (!teacher) return;
    $('topTeacherName').textContent = teacher.name;
    $('teacherDisplayName').textContent = teacher.name;
    $('teacherRoleTag').textContent = teacher.title;
    $('teacherDialectLabel').textContent = core.getDialect(teacher.dialect).name;
  }

  function cameraSignal(to, type, data) {
    if (state.socket && state.socket.connected) state.socket.emit('school:virtual:signal', { code: state.code, to: to, type: type, data: data });
  }

  function cameraPeer(userId) {
    var existing = state.cameraPeers.get(userId);
    if (existing) existing.close();
    var peer = new RTCPeerConnection({ iceServers: state.iceServers });
    state.cameraPeers.set(userId, peer);
    peer.onicecandidate = function (event) {
      if (event.candidate) cameraSignal(userId, 'ice', event.candidate.toJSON());
    };
    if (state.isHost) peer.ontrack = function (event) {
      var grid = $('virtualStudentCameraGrid');
      var tile = document.getElementById('virtualCamera-' + userId);
      if (!tile) {
        tile = document.createElement('figure'); tile.id = 'virtualCamera-' + userId;
        var video = document.createElement('video'); video.autoplay = true; video.playsInline = true; video.muted = true;
        var caption = document.createElement('figcaption');
        var participant = (state.session.participants || []).find(function (p) { return String(p.userId) === userId; });
        caption.textContent = participant ? participant.name : 'طالب';
        tile.append(video, caption); grid.appendChild(tile);
      }
      tile.querySelector('video').srcObject = event.streams[0] || new MediaStream([event.track]);
      show('virtualStudentCameras');
    };
    peer.onconnectionstatechange = function () {
      if (peer.connectionState === 'failed') notify('تعذر اتصال كاميرا الطالب؛ قد تتطلب الشبكة خادم TURN.', true);
    };
    return peer;
  }

  async function startStudentCamera() {
    if (!state.hostId || !state.socket || !state.socket.connected || !state.devices.camera || !window.RTCPeerConnection) return;
    try {
      var peer = cameraPeer(state.hostId);
      state.localStream.getVideoTracks().forEach(function (track) { peer.addTrack(track, state.localStream); });
      await peer.setLocalDescription(await peer.createOffer());
      cameraSignal(state.hostId, 'offer', peer.localDescription);
    } catch (error) { notify('تعذر إرسال كاميرا الطالب: ' + error.message, true); }
  }

  async function onCameraSignal(data) {
    if (!data || data.code !== state.code || !window.RTCPeerConnection) return;
    try {
      var peer = state.cameraPeers.get(data.from);
      if (data.type === 'offer' && state.isHost) {
        peer = cameraPeer(data.from);
        await peer.setRemoteDescription(data.data);
        await peer.setLocalDescription(await peer.createAnswer());
        cameraSignal(data.from, 'answer', peer.localDescription);
      } else if (data.type === 'answer' && peer && !state.isHost) {
        await peer.setRemoteDescription(data.data);
      } else if (data.type === 'ice' && peer) {
        await peer.addIceCandidate(data.data);
      }
    } catch (error) { notify('تعذر اتصال كاميرا الطالب: ' + error.message, true); }
  }

  // -------------------------------------------------------------
  // Socket.IO Presence and Events
  // -------------------------------------------------------------
  function initSocket(code) {
    if (typeof io !== 'function') return;
    try {
      var origin = (window.SocialApi && window.SocialApi.baseUrl) || window.location.origin;
      state.socket = io(origin, {
        auth: { token: state.token },
        query: { token: state.token },
        reconnection: false
      });

      state.socket.on('connect', function () {
        state.socket.emit('school:virtual:join', { code: code }, function (result) {
          if (!result || !result.ok) return notify('تعذر اتصال كاميرات الحصة.', true);
          state.hostId = result.host;
          if (result.host === result.you) state.isHost = true;
          if (Array.isArray(result.iceServers)) state.iceServers = result.iceServers;
          if (!state.isHost && state.devices.camera) startStudentCamera();
        });
      });
      state.socket.on('school:virtual:signal', onCameraSignal);
      state.socket.on('school:virtual:peer', function (data) {
        if (!data || data.code !== state.code) return;
        if (data.online && !state.isHost && data.userId === state.hostId && state.devices.camera) startStudentCamera();
        if (!data.online) {
          var peer = state.cameraPeers.get(data.userId);
          if (peer) peer.close();
          state.cameraPeers.delete(data.userId);
          var tile = document.getElementById('virtualCamera-' + data.userId);
          if (tile) tile.remove();
          if (!$('virtualStudentCameraGrid').childElementCount) hide('virtualStudentCameras');
        }
      });

      state.socket.on('school:virtual:update', function (data) {
        if (data && data.session && data.code === state.code) {
          renderParticipants(data.session.participants || []);
        }
      });

      state.socket.on('school:virtual:teacher', function (data) {
        if (data && data.code === state.code && data.teacher && state.session) {
          state.session.virtualTeacher = data.teacher;
          updateTeacherDisplay(data.teacher);
        }
      });

      state.socket.on('school:virtual:whiteboard', function (data) {
        if (!data || data.code !== state.code || !data.whiteboardData || state.isHost) return;
        var board = data.whiteboardData;
        if (!board.slides || !board.slides.length) return;
        state.whiteboard = core.createWhiteboardState(board.slides);
        state.whiteboard.setSlide(board.currentSlide || 0);
        renderWhiteboardSlide();
      });

      state.socket.on('school:virtual:message', function (data) {
        if (data && data.message && data.code === state.code) {
          appendMessage(data.message);
          if (data.message.senderType === 'teacher_ai') speakAiAnswer(data.message.text, data.message._id || data.message.id);
        }
      });

      state.socket.on('school:virtual:ended', function (data) {
        if (data && data.code === state.code) {
          notify('أنهى المعلم هذه الحصة الافتراضية.');
          cleanupSession();
          enterLobby();
        }
      });
    } catch (e) {}
  }

  // Auto-init on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
