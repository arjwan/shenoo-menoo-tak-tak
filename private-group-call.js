(function () {
  'use strict';
  if (!window.io || !window.SocialAPI || !SocialAPI.token()) return;

  var socket = window.io(SocialAPI.baseUrl, { auth: { token: SocialAPI.token() } });
  var groupId = null;
  var groupType = 'audio';
  var hostId = null;
  var baseUserId = null;
  var localStream = null;
  var ownsLocalStream = false;
  var peers = {};
  var pendingInvite = null;
  var modal = document.querySelector('[data-call-modal]');
  var statusEl = document.querySelector('[data-call-status]');
  var nameEl = document.querySelector('[data-call-name]');
  var acceptButton = document.querySelector('[data-call-accept]');
  var rejectButton = document.querySelector('[data-call-reject]');
  var incomingActions = document.querySelector('[data-incoming-call-actions]');
  var muteButton = document.querySelector('[data-call-mute]');
  var cameraButton = document.querySelector('[data-call-camera]');
  var endButton = document.querySelector('[data-call-end]');

  function params() { return new URLSearchParams(location.search); }
  function makeId() { return (crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(36).slice(2)); }
  function setStatus(text) { if (statusEl) statusEl.textContent = text; }
  function setName(text) { if (nameEl) nameEl.textContent = text || 'مكالمة جماعية'; }
  function showModal() { if (modal) modal.hidden = false; }
  function groupPeerElement(peerId) { return modal && modal.querySelector('[data-group-peer="' + CSS.escape(String(peerId)) + '"]'); }

  function inferType() {
    var q = params().get('call');
    if (q === 'video') return 'video';
    var nativeVideo = document.querySelector('[data-local-video]');
    var stream = nativeVideo && nativeVideo.srcObject;
    return stream && stream.getVideoTracks && stream.getVideoTracks().length ? 'video' : 'audio';
  }

  async function ensureLocalStream(type) {
    if (localStream && localStream.active) return localStream;
    var nativeVideo = document.querySelector('[data-local-video]');
    var existing = nativeVideo && nativeVideo.srcObject;
    if (existing && existing.getAudioTracks && existing.getAudioTracks().length) {
      localStream = existing;
      ownsLocalStream = false;
      return localStream;
    }
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
    ownsLocalStream = true;
    return localStream;
  }

  function closePeer(peerId) {
    var pc = peers[peerId];
    if (pc) {
      try { pc.ontrack = pc.onicecandidate = pc.onconnectionstatechange = null; pc.close(); } catch (_) {}
      delete peers[peerId];
    }
    var el = groupPeerElement(peerId);
    if (el) el.remove();
  }

  function cleanupGroup(keepBaseCall) {
    Object.keys(peers).forEach(closePeer);
    if (ownsLocalStream && localStream) localStream.getTracks().forEach(function (t) { t.stop(); });
    localStream = null;
    ownsLocalStream = false;
    pendingInvite = null;
    groupId = null;
    hostId = null;
    baseUserId = null;
    if (!keepBaseCall && modal) modal.hidden = true;
  }

  function attachRemote(peerId, stream) {
    if (!modal) return;
    var type = groupType === 'video' ? 'video' : 'audio';
    var el = groupPeerElement(peerId);
    if (!el) {
      el = document.createElement(type);
      el.setAttribute('data-group-peer', String(peerId));
      el.autoplay = true;
      el.playsInline = true;
      if (type === 'video') {
        el.style.cssText = 'position:relative;width:42vw;max-width:190px;height:26vh;object-fit:cover;border-radius:14px;border:2px solid rgba(25,217,160,.8);margin:6px;z-index:8;background:#07110e';
        var card = modal.querySelector('.call-card') || modal;
        card.appendChild(el);
      } else {
        el.style.display = 'none';
        modal.appendChild(el);
      }
    }
    el.srcObject = stream;
    el.play().catch(function () {});
  }

  async function ensurePeer(peerId, initiator) {
    peerId = String(peerId || '');
    if (!peerId || !groupId) return null;
    if (peers[peerId]) return peers[peerId];
    var stream = await ensureLocalStream(groupType);
    var pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    peers[peerId] = pc;
    stream.getTracks().forEach(function (track) { pc.addTrack(track, stream); });
    pc.ontrack = function (event) { if (event.streams && event.streams[0]) attachRemote(peerId, event.streams[0]); };
    pc.onicecandidate = function (event) {
      if (event.candidate) socket.emit('webrtc:call-group-ice', { groupId: groupId, userId: peerId, data: event.candidate });
    };
    pc.onconnectionstatechange = function () {
      if (pc.connectionState === 'connected') setStatus('مكالمة جماعية متصلة');
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') closePeer(peerId);
    };
    if (initiator) {
      var offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('webrtc:call-group-offer', { groupId: groupId, userId: peerId, data: pc.localDescription });
    }
    return pc;
  }

  async function enterGroup(payload, showIncoming) {
    groupId = String(payload.groupId || groupId || '');
    groupType = payload.type === 'video' ? 'video' : 'audio';
    hostId = String(payload.hostId || payload.from || hostId || '');
    baseUserId = String(payload.baseUserId || baseUserId || params().get('user') || '');
    if (!groupId) return;
    showModal();
    setName((showIncoming ? 'مكالمة جماعية · ' : '') + (payload.callerName || payload.hostName || 'شنو منو'));
    setStatus(showIncoming ? 'دعوة للانضمام إلى المكالمة' : 'تجهيز المكالمة الجماعية…');
    if (!showIncoming) {
      await ensureLocalStream(groupType);
      socket.emit('call-group:ready', { groupId: groupId });
    }
  }

  window.shnoAddParticipant = async function (userId) {
    userId = String(userId || '');
    var base = String(params().get('user') || baseUserId || '');
    if (!userId || !base || userId === base) return false;
    if (!groupId) groupId = makeId();
    groupType = inferType();
    baseUserId = base;
    try {
      await ensureLocalStream(groupType);
      setStatus('إرسال دعوة للمشارك…');
      socket.emit('call-group:add', { groupId: groupId, baseUserId: base, userId: userId, type: groupType }, function (result) {
        if (result && result.ok) {
          setStatus('تم إرسال دعوة المشارك');
          socket.emit('call-group:ready', { groupId: groupId });
        } else {
          setStatus((result && result.message) || 'تعذر إضافة المشارك');
        }
      });
      return true;
    } catch (_) {
      setStatus('تعذر الوصول إلى الكاميرا أو الميكروفون للمكالمة الجماعية');
      return false;
    }
  };

  socket.on('call-group:upgrade', function (payload) {
    enterGroup(payload || {}, false).catch(function () { setStatus('تعذر تجهيز المكالمة الجماعية'); });
  });

  socket.on('call-group:invite', function (payload) {
    payload = payload || {};
    if (!payload.groupId || groupId && groupId !== String(payload.groupId)) return;
    pendingInvite = payload;
    enterGroup(payload, true).catch(function () {});
    if (incomingActions) incomingActions.hidden = false;
    if (acceptButton) acceptButton.onclick = function () {
      if (!pendingInvite) return;
      var accepted = pendingInvite;
      enterGroup(accepted, false).then(function () {
        socket.emit('call-group:accept', { groupId: groupId }, function (result) {
          if (!result || !result.ok) {
            setStatus((result && result.message) || 'الدعوة لم تعد متاحة');
            cleanupGroup(false);
            return;
          }
          pendingInvite = null;
          if (incomingActions) incomingActions.hidden = true;
          setStatus('جاري ربط المشاركين…');
        });
      }).catch(function () { setStatus('تعذر الوصول إلى الكاميرا أو الميكروفون'); });
    };
    if (rejectButton) rejectButton.onclick = function () {
      socket.emit('call-group:reject', { groupId: String(payload.groupId) });
      cleanupGroup(false);
    };
  });

  socket.on('call-group:peer', function (payload) {
    if (!payload || String(payload.groupId) !== String(groupId)) return;
    groupType = payload.type === 'video' ? 'video' : groupType;
    ensurePeer(payload.peerId, Boolean(payload.initiator)).catch(function () { closePeer(payload.peerId); });
  });

  socket.on('webrtc:call-group-offer', async function (payload) {
    if (!payload || String(payload.groupId) !== String(groupId)) return;
    try {
      var pc = await ensurePeer(payload.from, false);
      await pc.setRemoteDescription(payload.data);
      var answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc:call-group-answer', { groupId: groupId, userId: String(payload.from), data: pc.localDescription });
    } catch (_) { closePeer(payload.from); }
  });

  socket.on('webrtc:call-group-answer', async function (payload) {
    if (!payload || String(payload.groupId) !== String(groupId)) return;
    var pc = peers[String(payload.from)];
    if (!pc) return;
    try { await pc.setRemoteDescription(payload.data); } catch (_) { closePeer(payload.from); }
  });

  socket.on('webrtc:call-group-ice', async function (payload) {
    if (!payload || String(payload.groupId) !== String(groupId)) return;
    try {
      var pc = await ensurePeer(payload.from, false);
      await pc.addIceCandidate(payload.data);
    } catch (_) {}
  });

  socket.on('call-group:left', function (payload) {
    if (!payload || String(payload.groupId) !== String(groupId)) return;
    closePeer(payload.userId);
    setStatus('غادر أحد المشاركين المكالمة');
  });

  socket.on('call-group:end', function (payload) {
    if (!payload || String(payload.groupId) !== String(groupId)) return;
    setStatus('انتهت المكالمة الجماعية');
    cleanupGroup(false);
  });

  socket.on('call-group:rejected', function (payload) {
    if (payload && String(payload.groupId) === String(groupId)) setStatus('رفض المستخدم الانضمام إلى المكالمة');
  });

  if (muteButton) muteButton.addEventListener('click', function () {
    setTimeout(function () {
      if (ownsLocalStream && localStream) localStream.getAudioTracks().forEach(function (t) { t.enabled = !muteButton.classList.contains('is-off'); });
    }, 0);
  }, true);
  if (cameraButton) cameraButton.addEventListener('click', function () {
    setTimeout(function () {
      if (ownsLocalStream && localStream) localStream.getVideoTracks().forEach(function (t) { t.enabled = !cameraButton.classList.contains('is-off'); });
    }, 0);
  }, true);
  if (endButton) endButton.addEventListener('click', function () {
    if (groupId) socket.emit('call-group:leave', { groupId: groupId });
    cleanupGroup(true);
  }, true);
  addEventListener('beforeunload', function () {
    if (groupId) socket.emit('call-group:leave', { groupId: groupId });
    cleanupGroup(true);
  });
}());
