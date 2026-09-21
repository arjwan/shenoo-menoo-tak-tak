/* school-live.js — REAL CLASSROOM V1 (teacher + students, camera & mic).
 *
 * Backend: /api/school/classrooms* (REST) + the project's Socket.IO
 * (school:classroom:* events) for presence and WebRTC signaling.
 * Media path: peer-to-peer WebRTC in a star (teacher <-> each student);
 * the server only relays offer/answer/ICE — it never sees audio or video.
 *
 * Privacy rules implemented here:
 *  - getUserMedia is called ONLY inside the camera/mic button click handlers,
 *    so the browser permission prompt is always the visible consequence of a
 *    click; both devices are OFF when entering a classroom.
 *  - a red "الكاميرا تعمل" banner is shown whenever the local camera is on.
 *  - no MediaRecorder, no canvas capture, no face detection or analysis.
 *  - the server can only force devices OFF (guardian consent, teacher mute).
 */
(function () {
  'use strict';
  var core = window.SchoolLiveCore;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var api = function (path, options) { return window.SocialAPI.request(path, options); };
  var post = function (path, body) { return api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); };

  var token = window.SocialAPI ? window.SocialAPI.token() : '';
  var me = core.userIdFromToken(token);
  var state = {
    catalog: [], students: [], accountName: '',
    classroom: null, you: null, code: '', iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    socket: null,
    peers: new Map(), // userId -> { pc, audio, video, pendingIce: [] }
    local: { stream: null, videoTrack: null, audioTrack: null },
    handRaised: false, tiles: new Map(), everOnline: {}
  };

  function msg(text, bad) {
    var el = $('liveMessage');
    if (!text) { el.hidden = true; return; }
    el.textContent = text; el.className = 'message ' + (bad ? 'bad' : 'ok'); el.hidden = false;
    clearTimeout(msg.timer); msg.timer = setTimeout(function () { el.hidden = true; }, 6000);
  }
  function show(id, visible) { var el = $(id); if (el) el.hidden = !visible; }
  function fill(select, values, placeholder) {
    select.innerHTML = '<option value="">' + esc(placeholder) + '</option>' + values.map(function (v) { return '<option value="' + esc(v) + '">' + esc(v) + '</option>'; }).join('');
  }

  // ------------------------------------------------------------------ lobby
  function renderCascade() {
    var stage = $('createStage').value, grade = $('createGrade').value;
    var c = core.cascade(state.catalog, { stage: stage, grade: grade });
    if (!$('createStage').options.length || $('createStage').options.length === 1) fill($('createStage'), c.stages, 'المرحلة');
    $('createStage').value = stage;
    fill($('createGrade'), c.grades, 'الصف'); $('createGrade').value = grade; $('createGrade').disabled = !stage;
    var subject = $('createSubject').value;
    fill($('createSubject'), c.subjects, 'المادة'); $('createSubject').value = c.subjects.indexOf(subject) === -1 ? '' : subject; $('createSubject').disabled = !grade;
  }

  // A pupil's tile is drawn only once they are actually connected (online).
  // We remember the pupils we have seen online so a dropped connection is
  // still shown as "غير متصل" instead of vanishing — but a pupil who only
  // REST-joined (socket still connecting) is not drawn before it arrives:
  // their name appearing in the grid is the teacher's "متصل" moment.
  function markEverOnline(participants) {
    (participants || []).forEach(function (p) { if (p && p.online) state.everOnline[String(p.userId)] = true; });
  }

  function renderJoinAs() {
    var options = core.attendeeOptions(state.students, null, state.accountName);
    $('joinAs').innerHTML = options.map(function (o) { return '<option value="' + esc(o.value) + '">' + esc(o.label) + '</option>'; }).join('');
    var pupils = options.length - 1;
    var hint = $('pupilHint');
    hint.hidden = false;
    hint.textContent = pupils ? 'الكاميرا والصوت لكل طالب يتبعان موافقة ولي الأمر المحفوظة في صفحة المدرسة.' : 'لا توجد ملفات طلاب في حسابك — يمكنك الدخول بحسابك، أو أضف الطالب من صفحة المدرسة أولاً.';
  }

  function selectedPupil() {
    var id = $('joinAs').value;
    return id ? state.students.find(function (s) { return String(s._id) === id; }) || null : null;
  }

  async function loadLiveList() {
    var box = $('liveList');
    var pupil = selectedPupil();
    var qs = pupil ? '?stage=' + encodeURIComponent(pupil.stage) + '&grade=' + encodeURIComponent(pupil.grade) : '';
    try {
      var data = await api('/api/school/classrooms/live' + qs);
      var rooms = data.classrooms || [];
      if (!rooms.length) { box.innerHTML = '<p class="empty">' + (pupil ? 'لا توجد حصص مباشرة الآن لصف ' + esc(pupil.grade) : 'لا توجد حصص مباشرة الآن') + '</p>'; return; }
      box.innerHTML = rooms.map(function (r) {
        return '<div class="live-item"><div><b>' + esc(r.teacherName) + '</b> — ' + esc(core.classroomTitle(r)) + '<small>الحاضرون: ' + r.presentCount + (r.teacherOnline ? ' · المعلم متصل' : ' · المعلم غير متصل حالياً') + '</small></div><button type="button" data-join="' + esc(r.code) + '">انضمام</button></div>';
      }).join('');
      box.querySelectorAll('[data-join]').forEach(function (b) { b.addEventListener('click', function () { $('joinCode').value = b.dataset.join; join(b.dataset.join); }); });
    } catch (e) { box.innerHTML = '<p class="empty">' + esc(e.message) + '</p>'; }
  }

  async function create(ev) {
    ev.preventDefault();
    var body = { stage: $('createStage').value, grade: $('createGrade').value, subject: $('createSubject').value, lesson: $('createLesson').value.trim() };
    if (!body.stage || !body.grade || !body.subject) return msg('اختر المرحلة والصف والمادة', true);
    $('createBtn').disabled = true;
    try {
      var data = await post('/api/school/classrooms', body);
      enter(data, 'teacher');
    } catch (e) {
      if (e.status === 409) { try { var mine = await api('/api/school/classrooms/mine'); if (mine.hosting) return enter({ classroom: mine.hosting, iceServers: mine.iceServers }, 'teacher'); } catch (e2) { /* fall through */ } }
      msg(e.message, true);
    } finally { $('createBtn').disabled = false; }
  }

  async function join(codeValue) {
    var code = core.normalizeCode(codeValue || $('joinCode').value);
    if (!code) return msg('اكتب رمز الحصة (6 أحرف)', true);
    var pupil = selectedPupil();
    $('joinBtn').disabled = true;
    try {
      var data = await post('/api/school/classrooms/' + code + '/join', pupil ? { studentId: pupil._id } : {});
      enter(data, data.role);
    } catch (e) { msg(e.message, true); } finally { $('joinBtn').disabled = false; }
  }

  // ------------------------------------------------------------------- room
  function enter(data, role) {
    state.classroom = data.classroom; state.code = data.classroom.code;
    markEverOnline(data.classroom.participants);
    state.iceServers = Array.isArray(data.iceServers) && data.iceServers.length ? data.iceServers : state.iceServers;
    state.you = data.you || (data.classroom.participants || []).find(function (p) { return p.userId === me; }) || { userId: me, role: role, name: state.accountName, permissions: { camera: true, voice: true } };
    state.handRaised = Boolean(state.you.handRaised);
    show('lobby', false); show('room', true);
    var teacher = state.you.role === 'teacher';
    show('teacherPanel', teacher); show('endBtn', teacher); show('handBtn', !teacher); show('leaveBtn', !teacher); show('teacherTile', !teacher);
    $('selfName').textContent = state.you.name + (teacher ? ' (المعلم)' : '');
    history.replaceState(null, '', 'school-live.html?code=' + encodeURIComponent(state.code));
    renderRoom();
    connectSocket();
  }

  function applyClassroom(classroom) {
    if (!classroom || classroom.code !== state.code) return;
    state.classroom = classroom;
    markEverOnline(classroom.participants);
    var mine = (classroom.participants || []).find(function (p) { return p.userId === me; });
    if (mine) {
      var wasMuted = state.you && state.you.mutedByTeacher;
      state.you = mine;
      state.handRaised = Boolean(mine.handRaised);
      if (mine.mutedByTeacher && !wasMuted && state.local.audioTrack) { stopMic(); msg('كتم المعلم الميكروفون'); }
      if (mine.permissions && mine.permissions.camera === false && state.local.videoTrack) stopCamera();
      if (mine.permissions && mine.permissions.voice === false && state.local.audioTrack) stopMic();
    }
    renderRoom();
    if (state.you && state.you.role === 'teacher') reconcile();
    else { var t = core.teacherOf(classroom); if (t && !t.online) { closePeer(classroom.teacherId); } }
  }

  function renderRoom() {
    var c = state.classroom; if (!c) return;
    var teacher = state.you.role === 'teacher';
    $('roomTitle').textContent = core.classroomTitle(c);
    $('roomMeta').textContent = teacher ? 'أنت المعلم: ' + c.teacherName : 'المعلم: ' + c.teacherName;
    $('roomCode').textContent = c.code;
    var n = core.counts(c);
    $('roomCount').textContent = 'الحاضرون ' + n.present + ' · متصل ' + n.online;
    $('roomStatus').textContent = core.statusText(c, state.you);
    var cam = core.deviceState(state.you, 'camera', Boolean(state.local.videoTrack));
    var mic = core.deviceState(state.you, 'mic', Boolean(state.local.audioTrack));
    $('camBtn').textContent = cam.label; $('camBtn').disabled = cam.disabled || c.status !== 'live'; $('camBtn').classList.toggle('active', cam.active);
    $('micBtn').textContent = mic.label; $('micBtn').disabled = mic.disabled || c.status !== 'live'; $('micBtn').classList.toggle('active', mic.active);
    $('controlHint').textContent = [cam.reason, mic.reason].filter(Boolean).join(' · ');
    $('selfBadges').textContent = (state.local.videoTrack ? '📷 ' : '') + (state.local.audioTrack ? '🎙️ ' : '') + (state.handRaised ? '✋' : '');
    if (!teacher) {
      $('handBtn').textContent = state.handRaised ? '✋ إنزال اليد' : '✋ رفع اليد';
      $('handBtn').classList.toggle('active', state.handRaised);
      var t = core.teacherOf(c);
      $('teacherName').textContent = c.teacherName + (t && t.online ? '' : ' — غير متصل');
      $('teacherBadges').textContent = t ? (t.media.camera ? '📷 ' : '') + (t.media.mic ? '🎙️' : '') : '';
      $('teacherTile').classList.toggle('offline', !(t && t.online));
    } else renderGrid();
  }

  function renderGrid() {
    var tiles = core.studentTiles(state.classroom).filter(function (t) { return t.online || state.everOnline[t.userId]; });
    var grid = $('studentGrid');
    var seen = {};
    tiles.forEach(function (t) {
      seen[t.userId] = true;
      var el = state.tiles.get(t.userId);
      if (!el) {
        el = document.createElement('figure'); el.className = 'tile'; el.dataset.user = t.userId;
        el.innerHTML = '<video autoplay playsinline></video><figcaption><div><b class="name"></b><br><span class="badges"></span></div><div class="actions"><button type="button" data-act="mute"></button><button type="button" data-act="kick" class="danger">إخراج</button></div></figcaption>';
        el.querySelector('[data-act="mute"]').addEventListener('click', function () { toggleMute(t.userId); });
        el.querySelector('[data-act="kick"]').addEventListener('click', function () { kick(t.userId, el.querySelector('.name').textContent); });
        state.tiles.set(t.userId, el);
        var peer = state.peers.get(t.userId);
        if (peer) { el.querySelector('video').srcObject = peer.stream; }
      }
      el.querySelector('.name').textContent = t.name;
      el.querySelector('.badges').textContent = (t.online ? '🟢 متصل' : '⚪ غير متصل') + (t.camera ? ' · 📷' : '') + (t.mic ? ' · 🎙️' : '') + (t.mutedByTeacher ? ' · 🔇 مكتوم' : '') + (t.handRaised ? ' · ✋ رافع يده' : '');
      el.querySelector('[data-act="mute"]').textContent = t.mutedByTeacher ? 'رفع الكتم' : 'كتم';
      el.classList.toggle('hand', t.handRaised); el.classList.toggle('offline', !t.online);
      var video = el.querySelector('video'); video.muted = t.mutedByTeacher;
      grid.appendChild(el); // appendChild re-orders existing nodes without re-creating them
    });
    state.tiles.forEach(function (el, id) { if (!seen[id]) { el.remove(); state.tiles.delete(id); closePeer(id); } });
    show('gridEmpty', !tiles.length);
  }

  // ----------------------------------------------------------------- socket
  function connectSocket() {
    if (state.socket) { state.socket.disconnect(); state.socket = null; }
    if (!window.io) return msg('تعذر تحميل مكتبة الاتصال المباشر', true);
    var socket = window.io(window.SocialAPI.baseUrl, { auth: { token: token } });
    state.socket = socket;
    socket.on('connect', function () {
      // A (re)connect means every previous peer connection is stale.
      closeAllPeers();
      socket.emit('school:classroom:join', { code: state.code }, function (res) {
        if (!res || !res.ok) return msg((res && res.error) || 'تعذر الدخول إلى غرفة الحصة', true);
        if (Array.isArray(res.iceServers) && res.iceServers.length) state.iceServers = res.iceServers;
        applyClassroom(res.classroom);
        reportMedia();
        if (state.you.role === 'teacher') offerAll();
        else if (res.classroom.teacherOnline) signal(res.classroom.teacherId, 'ready', {});
      });
    });
    socket.on('disconnect', function () { $('roomStatus').textContent = 'انقطع الاتصال بالخادم — تجري إعادة المحاولة...'; });
    socket.on('school:classroom:update', function (d) { if (d && d.code === state.code) applyClassroom(d.classroom); });
    socket.on('school:classroom:peer', function (d) {
      if (!d || d.code !== state.code) return;
      if (state.you.role === 'teacher') { if (!d.online) closePeer(d.userId); }
      else if (d.role === 'teacher') { if (d.online) $('roomStatus').textContent = 'المعلم متصل — بانتظار الصورة'; else closePeer(d.userId); }
    });
    socket.on('school:classroom:hand', function (d) { if (d && d.code === state.code && state.you.role === 'teacher' && d.raised) msg('✋ ' + d.name + ' يرفع يده'); });
    socket.on('school:classroom:mute', function (d) { if (d && d.code === state.code && d.userId === me && d.muted) { stopMic(); msg('كتم المعلم الميكروفون'); } });
    socket.on('school:classroom:kicked', function (d) { if (d && d.code === state.code) leaveRoom('أخرجك المعلم من الحصة', true); });
    socket.on('school:classroom:ended', function (d) { if (d && d.code === state.code) leaveRoom('أنهى المعلم الحصة', false); });
    socket.on('school:classroom:signal', onSignal);
  }

  function reportMedia() {
    if (!state.socket || !state.socket.connected) return;
    state.socket.emit('school:classroom:media', { code: state.code, camera: Boolean(state.local.videoTrack), mic: Boolean(state.local.audioTrack) }, function (res) {
      if (!res || !res.ok) return;
      // The server may refuse (no guardian consent / teacher mute): honour it.
      if (res.forced && res.forced.indexOf('camera') !== -1 && state.local.videoTrack) { stopCamera(); msg('الكاميرا غير مسموحة لهذا الطالب', true); }
      if (res.forced && res.forced.indexOf('mic') !== -1 && state.local.audioTrack) { stopMic(); msg('المايك غير مسموح حالياً', true); }
    });
  }

  function signal(to, type, data) {
    if (!state.socket) return;
    state.socket.emit('school:classroom:signal', { code: state.code, to: String(to), type: type, data: data }, function (res) {
      if (res && !res.ok && type === 'offer') $('roomStatus').textContent = 'تعذر إرسال العرض إلى ' + to;
    });
  }

  // ----------------------------------------------------------------- WebRTC
  function newPeer(userId) {
    closePeer(userId);
    var pc = new RTCPeerConnection({ iceServers: state.iceServers });
    var entry = { pc: pc, pendingIce: [], stream: new MediaStream() };
    state.peers.set(String(userId), entry);
    pc.onicecandidate = function (e) { if (e.candidate) signal(userId, 'ice', e.candidate.toJSON ? e.candidate.toJSON() : e.candidate); };
    pc.ontrack = function (e) {
      entry.stream.addTrack(e.track);
      attachRemote(userId, entry.stream);
    };
    pc.onconnectionstatechange = function () {
      if (pc.connectionState === 'failed') {
        $('roomStatus').textContent = 'فشل الاتصال المباشر مع أحد الأطراف (قد تحتاج الشبكة إلى خادم TURN)';
        if (state.peers.get(String(userId)) === entry) closePeer(userId);
        // The teacher is the offerer: a student asks for a fresh offer.
        if (state.you && state.you.role !== 'teacher' && state.classroom && state.classroom.status === 'live') signal(userId, 'ready', {});
      } else if (pc.connectionState === 'closed' && state.peers.get(String(userId)) === entry) closePeer(userId);
    };
    return entry;
  }

  function remoteVideo(userId) {
    if (state.you && state.you.role === 'teacher') { var el = state.tiles.get(String(userId)); return el ? el.querySelector('video') : null; }
    return $('teacherVideo');
  }
  function attachRemote(userId, stream) {
    var video = remoteVideo(userId);
    if (!video) return; // tile not rendered yet: renderGrid attaches the stream when it creates the tile
    if (video.srcObject !== stream) video.srcObject = stream;
    // Browsers may block un-muted autoplay when the page was reloaded without
    // a click: offer an explicit play button instead of failing silently.
    video.play().catch(function () { show('playBtn', true); });
  }
  function playAllRemote() {
    var videos = [$('teacherVideo')].concat(Array.from(state.tiles.values()).map(function (el) { return el.querySelector('video'); }));
    Promise.all(videos.filter(function (v) { return v && v.srcObject; }).map(function (v) { return v.play().catch(function () { return 'blocked'; }); }))
      .then(function (results) { show('playBtn', results.indexOf('blocked') !== -1); });
  }

  function attachLocalTracks(entry) {
    entry.pc.getTransceivers().forEach(function (t) {
      var kind = (t.receiver && t.receiver.track && t.receiver.track.kind) || (t.sender && t.sender.track && t.sender.track.kind);
      if (kind === 'video' && state.local.videoTrack) t.sender.replaceTrack(state.local.videoTrack).catch(function () {});
      if (kind === 'audio' && state.local.audioTrack) t.sender.replaceTrack(state.local.audioTrack).catch(function () {});
    });
  }

  function replaceTrackEverywhere(kind, track) {
    state.peers.forEach(function (entry) {
      entry.pc.getTransceivers().forEach(function (t) {
        var k = (t.receiver && t.receiver.track && t.receiver.track.kind) || '';
        if (k === kind) t.sender.replaceTrack(track).catch(function () {});
      });
    });
  }

  // Teacher: one offer per online student. Transceivers are created up front
  // (audio + video, sendrecv) so turning a camera on later needs no
  // renegotiation — replaceTrack is enough on both sides.
  async function offerTo(userId) {
    var entry = newPeer(userId);
    entry.pc.addTransceiver('audio', { direction: 'sendrecv' });
    entry.pc.addTransceiver('video', { direction: 'sendrecv' });
    attachLocalTracks(entry);
    try {
      var offer = await entry.pc.createOffer();
      await entry.pc.setLocalDescription(offer);
      signal(userId, 'offer', { type: offer.type, sdp: offer.sdp });
    } catch (e) { $('roomStatus').textContent = 'تعذر إنشاء الاتصال: ' + e.message; }
  }

  // Roster changes only CLOSE stale connections; offers are event-driven
  // (teacher join => offerAll, student "ready" => offerTo) so each student
  // connection gets exactly one offer.
  function reconcile() {
    var plan = core.reconcilePeers(state.classroom, Array.from(state.peers.keys()));
    plan.close.forEach(closePeer);
  }
  function offerAll() {
    core.reconcilePeers(state.classroom, []).offer.forEach(function (id) { offerTo(id); });
  }

  async function onSignal(d) {
    if (!d || d.code !== state.code) return;
    var from = String(d.from);
    try {
      if (d.type === 'ready') {
        // A student (re)connected: (re)offer regardless of what we had before.
        if (state.you.role === 'teacher') offerTo(from);
      } else if (d.type === 'offer') {
        if (state.you.role === 'teacher') return; // the teacher is the only offerer
        if (from !== String(state.classroom.teacherId)) return;
        var entry = newPeer(from);
        await entry.pc.setRemoteDescription(new RTCSessionDescription(d.data));
        entry.pc.getTransceivers().forEach(function (t) { t.direction = 'sendrecv'; });
        attachLocalTracks(entry);
        var answer = await entry.pc.createAnswer();
        await entry.pc.setLocalDescription(answer);
        signal(from, 'answer', { type: answer.type, sdp: answer.sdp });
        flushIce(entry);
        $('roomStatus').textContent = 'متصل بالمعلم';
      } else if (d.type === 'answer') {
        var e2 = state.peers.get(from); if (!e2) return;
        await e2.pc.setRemoteDescription(new RTCSessionDescription(d.data));
        flushIce(e2);
      } else if (d.type === 'ice') {
        var e3 = state.peers.get(from); if (!e3) return;
        if (e3.pc.remoteDescription && e3.pc.remoteDescription.type) await e3.pc.addIceCandidate(new RTCIceCandidate(d.data)).catch(function () {});
        else e3.pendingIce.push(d.data);
      }
    } catch (e) { $('roomStatus').textContent = 'خطأ في الاتصال المباشر: ' + e.message; }
  }

  function flushIce(entry) {
    var list = entry.pendingIce.splice(0);
    list.forEach(function (c) { entry.pc.addIceCandidate(new RTCIceCandidate(c)).catch(function () {}); });
  }

  function closePeer(userId) {
    var entry = state.peers.get(String(userId));
    if (!entry) return;
    state.peers.delete(String(userId));
    try { entry.pc.ontrack = null; entry.pc.onicecandidate = null; entry.pc.close(); } catch (e) { /* ignore */ }
    var video = remoteVideo(userId);
    if (video && video.srcObject === entry.stream) video.srcObject = null;
  }
  function closeAllPeers() { Array.from(state.peers.keys()).forEach(closePeer); }

  // ------------------------------------------------------------ local media
  // getUserMedia lives ONLY here (button click handlers): the browser prompt
  // is always the direct result of the participant's own click.
  async function startCamera() {
    var stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false });
    var track = stream.getVideoTracks()[0];
    state.local.videoTrack = track;
    ensureLocalStream().addTrack(track);
    $('localVideo').srcObject = ensureLocalStream();
    replaceTrackEverywhere('video', track);
    show('cameraIndicator', true);
    track.onended = function () { stopCamera(); };
  }
  function stopCamera() {
    var track = state.local.videoTrack; if (!track) return;
    state.local.videoTrack = null;
    try { track.stop(); } catch (e) { /* ignore */ }
    if (state.local.stream) state.local.stream.removeTrack(track);
    replaceTrackEverywhere('video', null);
    show('cameraIndicator', false);
    renderRoom();
  }
  async function startMic() {
    var stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    var track = stream.getAudioTracks()[0];
    state.local.audioTrack = track;
    ensureLocalStream().addTrack(track);
    replaceTrackEverywhere('audio', track);
    show('micIndicator', true);
    track.onended = function () { stopMic(); };
  }
  function stopMic() {
    var track = state.local.audioTrack; if (!track) return;
    state.local.audioTrack = null;
    try { track.stop(); } catch (e) { /* ignore */ }
    if (state.local.stream) state.local.stream.removeTrack(track);
    replaceTrackEverywhere('audio', null);
    show('micIndicator', false);
    renderRoom();
  }
  function ensureLocalStream() { if (!state.local.stream) state.local.stream = new MediaStream(); return state.local.stream; }

  async function onCameraClick() {
    try {
      if (state.local.videoTrack) stopCamera(); else await startCamera();
    } catch (e) { msg(e.name === 'NotAllowedError' ? 'رفض المتصفح إذن الكاميرا' : 'تعذر تشغيل الكاميرا: ' + e.message, true); }
    renderRoom(); reportMedia();
  }
  async function onMicClick() {
    try {
      if (state.local.audioTrack) stopMic(); else await startMic();
    } catch (e) { msg(e.name === 'NotAllowedError' ? 'رفض المتصفح إذن المايك' : 'تعذر تشغيل المايك: ' + e.message, true); }
    renderRoom(); reportMedia();
  }

  // ---------------------------------------------------------------- actions
  async function toggleHand() {
    try {
      var data = await post('/api/school/classrooms/' + state.code + '/hand', { raised: !state.handRaised });
      state.handRaised = Boolean(data.participant.handRaised); renderRoom();
    } catch (e) { msg(e.message, true); }
  }
  async function toggleMute(userId) {
    var p = (state.classroom.participants || []).find(function (x) { return x.userId === userId; });
    try { await post('/api/school/classrooms/' + state.code + '/mute', { userId: userId, muted: !(p && p.mutedByTeacher) }); } catch (e) { msg(e.message, true); }
  }
  async function kick(userId, name) {
    if (!confirm('إخراج ' + name + ' من الحصة؟')) return;
    try { await post('/api/school/classrooms/' + state.code + '/kick', { userId: userId }); closePeer(userId); } catch (e) { msg(e.message, true); }
  }
  async function endClassroom() {
    if (!confirm('إنهاء الحصة لجميع الطلاب؟')) return;
    try { var data = await post('/api/school/classrooms/' + state.code + '/end', {}); leaveRoom('انتهت الحصة — الحاضرون: ' + data.attendance.map(function (a) { return a.name + ' (' + a.minutes + ' د)'; }).join('، '), false); } catch (e) { msg(e.message, true); }
  }
  async function leaveClassroom() {
    try { await post('/api/school/classrooms/' + state.code + '/leave', {}); } catch (e) { /* leaving is best effort */ }
    leaveRoom('خرجت من الحصة', false);
  }
  function leaveRoom(text, bad) {
    stopCamera(); stopMic(); closeAllPeers();
    if (state.socket) { try { state.socket.emit('school:classroom:leave', { code: state.code }); state.socket.disconnect(); } catch (e) { /* ignore */ } state.socket = null; }
    state.tiles.forEach(function (el) { el.remove(); }); state.tiles.clear(); state.everOnline = {};
    show('playBtn', false);
    state.classroom = null; state.you = null; state.code = ''; state.handRaised = false;
    show('room', false); show('lobby', true);
    history.replaceState(null, '', 'school-live.html');
    if (text) msg(text, bad);
    loadLiveList();
  }

  // ------------------------------------------------------------------- boot
  async function boot() {
    if (!token || !me) { show('authPanel', true); return; }
    $('createForm').addEventListener('submit', create);
    $('createStage').addEventListener('change', renderCascade);
    $('createGrade').addEventListener('change', renderCascade);
    $('joinForm').addEventListener('submit', function (ev) { ev.preventDefault(); join(); });
    $('joinAs').addEventListener('change', loadLiveList);
    $('camBtn').addEventListener('click', onCameraClick);
    $('micBtn').addEventListener('click', onMicClick);
    $('handBtn').addEventListener('click', toggleHand);
    $('leaveBtn').addEventListener('click', leaveClassroom);
    $('endBtn').addEventListener('click', endClassroom);
    $('playBtn').addEventListener('click', playAllRemote);
    window.addEventListener('pagehide', function () { stopCamera(); stopMic(); closeAllPeers(); });

    var wanted = core.codeFromSearch(location.search);
    try {
      var results = await Promise.all([
        api('/api/school/curriculum/catalog').catch(function () { return { items: [] }; }),
        api('/api/school/students').catch(function () { return { students: [] }; }),
        api('/api/school/classrooms/mine'),
        api('/api/users/me').catch(function () { return {}; })
      ]);
      state.catalog = results[0].items || [];
      state.students = results[1].students || [];
      var meDoc = results[3].user || {};
      state.accountName = meDoc.displayName || meDoc.fullName || meDoc.username || 'حسابي';
      renderCascade(); renderJoinAs();
      var mine = results[2];
      if (mine.hosting) return enter({ classroom: mine.hosting, iceServers: mine.iceServers }, 'teacher');
      if (mine.attending) return enter({ classroom: mine.attending, iceServers: mine.iceServers }, 'student');
      show('lobby', true);
      if (wanted) $('joinCode').value = wanted;
      loadLiveList();
    } catch (e) {
      if (e.status === 401) { show('authPanel', true); return; }
      show('lobby', true); msg(e.message, true);
    }
  }

  boot();
})();
