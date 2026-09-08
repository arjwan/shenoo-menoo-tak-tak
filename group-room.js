(function () {
  'use strict';
  const roomId = new URLSearchParams(location.search).get('id');
  const $ = selector => document.querySelector(selector);
  const box = $('[data-group-messages]'), form = $('[data-group-form]'), statusBox = $('[data-status]');
  const voiceJoin = $('[data-voice-join]'), voiceMute = $('[data-voice-mute]'), cameraButton = $('[data-camera]'), liveButton = $('[data-live-toggle]');
  const mediaStage = $('[data-media-stage]'), speakersBox = $('[data-speakers]');
  const socket = window.io && SocialAPI.token() ? window.io(SocialAPI.baseUrl, { auth: { token: SocialAPI.token() } }) : null;
  let room, currentUserId = '', localStream, muted = true, cameraOn = false;
  const peers = {}, participants = new Map();
  const esc = value => String(value || '').replace(/[&<>"']/g, symbol => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[symbol]));
  const absolute = url => url && (/^https?:/i.test(url) ? url : SocialAPI.baseUrl + url);
  const setStatus = (text, error) => { statusBox.textContent = text || ''; statusBox.classList.toggle('error', Boolean(error)); };
  const roleLabel = { owner: 'المالك', admin: 'مسؤول', moderator: 'مراقب', member: 'عضو' };

  function mediaMarkup(item) {
    const file = item.attachment;
    if (!file || !file.url) return '';
    const src = esc(absolute(file.url));
    if (file.type === 'image') return '<img class="message-media" loading="lazy" src="' + src + '" alt="صورة مرسلة">';
    if (file.type === 'video') return '<video class="message-media" controls playsinline preload="metadata" src="' + src + '"></video>';
    if (file.type === 'audio') return '<audio class="message-media" controls preload="metadata" src="' + src + '"></audio>';
    return '<a class="attachment-name" href="' + src + '" target="_blank" rel="noopener">📎 ' + esc(file.originalName || 'ملف') + '</a>';
  }
  function messageMarkup(item) {
    const canDelete = item.mine || room?.isModerator;
    return '<article class="chat-message ' + (item.mine ? 'mine' : '') + '" data-message-id="' + esc(item.id) + '"><strong>' + esc(item.sender?.fullName || 'مستخدم') + '</strong>' + (item.text ? '<p>' + esc(item.text).replace(/\n/g, '<br>') + '</p>' : '') + mediaMarkup(item) + '<time>' + new Date(item.createdAt).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }) + '</time><div class="message-tools"><button type="button" data-report-message="' + esc(item.id) + '" data-user="' + esc(item.sender?.id) + '">⚑ تبليغ</button>' + (canDelete ? '<button type="button" data-delete-message="' + esc(item.id) + '">حذف</button>' : '') + '</div></article>';
  }
  function avatar(user) {
    return user.avatarUrl ? '<span class="member-avatar"><img src="' + esc(absolute(user.avatarUrl)) + '" alt=""></span>' : '<span class="member-avatar">' + esc((user.fullName || '?').slice(0, 1)) + '</span>';
  }
  function memberTools(user) {
    if (!room?.isModerator || String(user.id) === currentUserId || user.role === 'owner') return '';
    const basic = '<button data-member-action="' + (user.muted ? 'unmute' : 'mute') + '" data-user="' + esc(user.id) + '">' + (user.muted ? 'فك الكتم' : 'كتم') + '</button><button data-member-action="kick" data-user="' + esc(user.id) + '">إخراج</button><button data-member-action="ban" data-user="' + esc(user.id) + '">حظر</button>';
    const elevate = room.isAdmin ? '<button data-member-action="' + (user.role === 'moderator' ? 'unmoderator' : 'moderator') + '" data-user="' + esc(user.id) + '">' + (user.role === 'moderator' ? 'إلغاء المراقب' : 'تعيين مراقب') + '</button>' : '';
    return '<div class="member-tools">' + basic + elevate + '</div>';
  }
  function renderMembers(data) {
    $('[data-members]').innerHTML = (data.members || []).map(user => '<div class="member-row">' + avatar(user) + '<div class="member-copy"><strong>' + esc(user.fullName) + '</strong><small>@' + esc(user.username || '') + ' <span class="role-badge">' + esc(roleLabel[user.role] || '') + (user.muted ? ' · مكتوم' : '') + '</span></small></div>' + memberTools(user) + '</div>').join('') || '<div class="empty">لا يوجد أعضاء.</div>';
    $('[data-pending]').innerHTML = (data.pending || []).map(user => '<div class="member-row">' + avatar(user) + '<div class="member-copy"><strong>' + esc(user.fullName) + '</strong><small>@' + esc(user.username || '') + '</small></div><div class="member-tools"><button data-request-action="accept" data-user="' + esc(user.id) + '">قبول</button><button data-request-action="reject" data-user="' + esc(user.id) + '">رفض</button></div></div>').join('') || '<div class="empty">لا توجد طلبات.</div>';
    $('[data-banned]').innerHTML = (data.banned || []).map(user => '<div class="member-row">' + avatar(user) + '<div class="member-copy"><strong>' + esc(user.fullName) + '</strong></div><div class="member-tools"><button data-member-action="unban" data-user="' + esc(user.id) + '">فك الحظر</button></div></div>').join('') || '<div class="empty">لا يوجد محظورون.</div>';
  }
  function applyRoom(group) {
    room = group;
    $('[data-room-name]').textContent = room.name;
    $('[data-room-title]').textContent = room.name + (room.isOfficial ? ' ✓' : '');
    $('[data-room-description]').textContent = room.description || '';
    $('[data-room-type]').textContent = ({ text: '💬 كتابية', voice: '🎙 صوتية', challenge: '🏆 تحديات' })[room.roomType];
    $('[data-room-privacy]').textContent = room.privacy === 'private' ? '🔒 خاصة' : '🌐 عامة';
    $('[data-live-state]').textContent = room.isLive ? '● مباشرة' : 'غير مباشرة';
    const banner = $('[data-privacy-banner]');
    banner.classList.toggle('private', room.privacy === 'private');
    banner.textContent = room.privacy === 'private' ? '🔒 غرفة خاصة — لا يدخلها إلا المقبولون، ومع ذلك لا ترسل معلومات شديدة الحساسية.' : '🌐 غرفة عامة — الرسائل والوسائط والبث يراها أعضاء الغرفة ويمكن التبليغ عنها.';
    voiceJoin.hidden = !['voice', 'challenge'].includes(room.roomType);
    liveButton.hidden = !room.isAdmin;
    liveButton.textContent = room.isLive ? 'إنهاء البث' : 'بدء البث';
    $('[data-admin-panel]').hidden = !room.isAdmin;
    document.querySelectorAll('[data-setting]').forEach(input => { input.type === 'checkbox' ? input.checked = Boolean(room[input.dataset.setting]) : input.value = room[input.dataset.setting]; });
  }
  async function loadMembers() {
    try { renderMembers(await SocialAPI.request('/api/groups/' + encodeURIComponent(roomId) + '/members')); }
    catch (error) { setStatus(error.message, true); }
  }
  async function load() {
    if (!roomId) return setStatus('رابط الغرفة غير صالح', true);
    try {
      const [me, data] = await Promise.all([SocialAPI.request('/api/users/me'), SocialAPI.request('/api/groups/' + encodeURIComponent(roomId) + '/messages')]);
      currentUserId = String(me.user?.id || '');
      applyRoom(data.group);
      box.innerHTML = (data.messages || []).map(messageMarkup).join('') || '<div class="chat-empty">لا توجد رسائل بعد.</div>';
      box.scrollTop = box.scrollHeight;
      await loadMembers();
      socket?.emit('group:join', { groupId: roomId }, result => { if (result && !result.ok) setStatus(result.message, true); });
    } catch (error) { setStatus(error.message, true); }
  }
  function speakerTile(user, stream, local) {
    let tile = document.querySelector('[data-speaker="' + CSS.escape(String(user.id)) + '"]');
    if (!tile) { tile = document.createElement('div'); tile.className = 'speaker-tile'; tile.dataset.speaker = user.id; speakersBox.appendChild(tile); }
    if (stream && stream.getVideoTracks().length) {
      tile.innerHTML = '<video autoplay playsinline ' + (local ? 'muted' : '') + '></video><strong>' + esc(user.name || 'مستخدم') + '</strong><small>' + (user.muted ? 'مكتوم' : 'يتحدث') + '</small>';
      tile.querySelector('video').srcObject = stream;
    } else tile.innerHTML = '<div><span class="speaker-avatar">' + esc((user.name || '?').slice(0, 1)) + '</span><strong>' + esc(user.name || 'مستخدم') + '</strong><small>' + (user.muted ? 'مكتوم' : 'يتحدث') + '</small></div>';
    return tile;
  }
  function watchLevel(stream, tile) {
    try {
      const context = new (window.AudioContext || window.webkitAudioContext)(), analyser = context.createAnalyser(), values = new Uint8Array(128);
      analyser.fftSize = 256; context.createMediaStreamSource(stream).connect(analyser);
      const tick = () => { if (!document.body.contains(tile)) return context.close(); analyser.getByteFrequencyData(values); tile.classList.toggle('speaking', values.reduce((sum, value) => sum + value, 0) / values.length > 18); requestAnimationFrame(tick); };
      tick();
    } catch (_) {}
  }
  async function negotiate(userId) {
    const peer = peerFor(userId, false), offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit('webrtc:group-offer', { groupId: roomId, userId, data: peer.localDescription });
  }
  function peerFor(userId, start) {
    if (peers[userId]) return peers[userId];
    const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    peers[userId] = peer;
    localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
    peer.ontrack = event => { const tile = speakerTile(participants.get(String(userId)) || { id: userId, name: 'مشارك' }, event.streams[0], false); watchLevel(event.streams[0], tile); };
    peer.onicecandidate = event => { if (event.candidate) socket.emit('webrtc:group-ice', { groupId: roomId, userId, data: event.candidate }); };
    if (start) negotiate(userId).catch(error => setStatus(error.message, true));
    return peer;
  }
  voiceJoin.onclick = async () => {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStream.getAudioTracks().forEach(track => { track.enabled = false; });
      socket.emit('group-voice:join', { groupId: roomId }, result => {
        if (!result?.ok) { localStream.getTracks().forEach(track => track.stop()); localStream = null; return setStatus(result?.message || 'تعذر دخول المنصة', true); }
        voiceJoin.hidden = true; voiceMute.hidden = false; cameraButton.hidden = !(room.allowMemberVideo || room.isModerator); mediaStage.hidden = false;
        (result.participants || []).forEach(user => participants.set(String(user.id), user));
        watchLevel(localStream, speakerTile(participants.get(currentUserId) || { id: currentUserId, name: 'أنت', muted: true }, localStream, true));
      });
    } catch (error) { setStatus(error.message, true); }
  };
  voiceMute.onclick = () => {
    muted = !muted; localStream?.getAudioTracks().forEach(track => { track.enabled = !muted; });
    voiceMute.textContent = muted ? 'تشغيل الميكروفون' : 'كتم الميكروفون';
    socket?.emit('group-voice:mute', { groupId: roomId, muted });
  };
  cameraButton.onclick = async () => {
    try {
      if (cameraOn) {
        localStream?.getVideoTracks().forEach(track => { track.stop(); localStream.removeTrack(track); });
        cameraOn = false; cameraButton.textContent = 'فتح الكاميرا';
      } else {
        const video = await navigator.mediaDevices.getUserMedia({ video: true }), track = video.getVideoTracks()[0];
        localStream.addTrack(track); cameraOn = true; cameraButton.textContent = 'إغلاق الكاميرا';
        Object.values(peers).forEach(peer => peer.addTrack(track, localStream));
        await Promise.all(Object.keys(peers).map(negotiate));
      }
      speakerTile(participants.get(currentUserId) || { id: currentUserId, name: 'أنت' }, localStream, true);
    } catch (error) { setStatus(error.message, true); }
  };
  form.onsubmit = async event => {
    event.preventDefault();
    const text = form.querySelector('textarea').value.trim(), file = $('[data-attachment]').files[0];
    if (!text && !file) return;
    const body = new FormData(); body.append('text', text); if (file) body.append('attachment', file);
    try { await SocialAPI.request('/api/groups/' + roomId + '/messages', { method: 'POST', body }); form.reset(); setStatus(''); }
    catch (error) { setStatus(error.message, true); }
  };
  $('[data-attach]').onclick = () => $('[data-attachment]').click();
  $('[data-emoji]').onclick = () => { const input = form.querySelector('textarea'); input.value += ' 😊'; input.focus(); };
  async function report(details) {
    const reason = prompt('اكتب سبب التبليغ بوضوح:'); if (!reason) return;
    try { const data = await SocialAPI.request('/api/groups/' + roomId + '/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...details, reason }) }); setStatus(data.message); }
    catch (error) { setStatus(error.message, true); }
  }
  $('[data-report-room]').onclick = () => report({});
  liveButton.onclick = async () => {
    try { const data = await SocialAPI.request('/api/groups/' + roomId + '/live', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ live: !room.isLive }) }); applyRoom(data.group); }
    catch (error) { setStatus(error.message, true); }
  };
  $('[data-save-settings]').onclick = async () => {
    const body = {}; document.querySelectorAll('[data-setting]').forEach(input => { body[input.dataset.setting] = input.type === 'checkbox' ? input.checked : Number(input.value); });
    try { const data = await SocialAPI.request('/api/groups/' + roomId + '/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); applyRoom(data.group); setStatus('تم حفظ إعدادات الغرفة'); }
    catch (error) { setStatus(error.message, true); }
  };
  box.onclick = async event => {
    const reportButton = event.target.closest('[data-report-message]'), deleteButton = event.target.closest('[data-delete-message]');
    if (reportButton) return report({ messageId: reportButton.dataset.reportMessage, targetUserId: reportButton.dataset.user });
    if (deleteButton && confirm('حذف هذه الرسالة من الغرفة؟')) try { await SocialAPI.request('/api/groups/' + roomId + '/messages/' + deleteButton.dataset.deleteMessage, { method: 'DELETE' }); } catch (error) { setStatus(error.message, true); }
  };
  $('.room-side').onclick = async event => {
    const memberButton = event.target.closest('[data-member-action]'), requestButton = event.target.closest('[data-request-action]');
    try {
      if (memberButton) await SocialAPI.request('/api/groups/' + roomId + '/members/' + memberButton.dataset.user + '/' + memberButton.dataset.memberAction, { method: 'PATCH' });
      else if (requestButton) await SocialAPI.request('/api/groups/' + roomId + '/requests/' + requestButton.dataset.user + '/' + requestButton.dataset.requestAction, { method: 'PATCH' });
      else return;
      await loadMembers();
    } catch (error) { setStatus(error.message, true); }
  };
  if (socket) {
    socket.on('group:message', payload => { if (String(payload.groupId) !== String(roomId)) return; box.querySelector('.chat-empty')?.remove(); box.insertAdjacentHTML('beforeend', messageMarkup(payload.message)); box.scrollTop = box.scrollHeight; });
    socket.on('group:message-deleted', payload => { if (String(payload.groupId) === String(roomId)) document.querySelector('[data-message-id="' + CSS.escape(String(payload.messageId)) + '"]')?.remove(); });
    socket.on('group:state', payload => { if (String(payload.groupId) !== String(roomId)) return; if (payload.group) applyRoom({ ...room, ...payload.group }); if (payload.isLive !== undefined) { room.isLive = payload.isLive; applyRoom(room); } });
    socket.on('group:moderation', payload => { if (String(payload.groupId) === String(roomId)) { setStatus('طبّقت إدارة الغرفة إجراءً على حسابك: ' + payload.action, true); if (payload.action === 'mute') { muted = true; localStream?.getAudioTracks().forEach(track => { track.enabled = false; }); voiceMute.textContent = 'تشغيل الميكروفون'; } if (['kick', 'ban'].includes(payload.action)) setTimeout(() => location.replace('groups.html'), 1200); } });
    socket.on('group-voice:participants', payload => {
      if (String(payload.groupId) !== String(roomId) || !localStream) return;
      participants.clear(); (payload.participants || []).forEach(user => participants.set(String(user.id), user));
      document.querySelectorAll('[data-speaker]').forEach(tile => { if (!participants.has(tile.dataset.speaker)) tile.remove(); });
      (payload.participants || []).forEach(user => { if (String(user.id) !== currentUserId) peerFor(String(user.id), currentUserId < String(user.id)); });
    });
    socket.on('group-voice:mute', payload => { if (String(payload.groupId) !== String(roomId)) return; const tile = document.querySelector('[data-speaker="' + CSS.escape(String(payload.userId)) + '"]'); if (tile?.querySelector('small')) tile.querySelector('small').textContent = payload.muted ? 'مكتوم' : 'يتحدث'; });
    socket.on('webrtc:group-offer', async payload => { if (String(payload.groupId) !== String(roomId) || !localStream) return; const peer = peerFor(String(payload.from), false); await peer.setRemoteDescription(payload.data); const answer = await peer.createAnswer(); await peer.setLocalDescription(answer); socket.emit('webrtc:group-answer', { groupId: roomId, userId: payload.from, data: peer.localDescription }); });
    socket.on('webrtc:group-answer', payload => peers[payload.from]?.setRemoteDescription(payload.data).catch(() => {}));
    socket.on('webrtc:group-ice', payload => peers[payload.from]?.addIceCandidate(payload.data).catch(() => {}));
  }
  addEventListener('beforeunload', () => { socket?.emit('group-voice:leave', { groupId: roomId }); localStream?.getTracks().forEach(track => track.stop()); });
  load();
}());
