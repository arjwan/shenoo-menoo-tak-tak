(function () {
  "use strict";
  var list = document.querySelector("[data-conversation-list]"), windowEl = document.querySelector("[data-chat-window]"), feedback = document.querySelector("[data-message-feedback]"), callModal = document.querySelector("[data-call-modal]");
  var params = new URLSearchParams(location.search), currentId = params.get("conversation"), currentOther, recorder, localStream, peer, activeCall, pendingIce = [], callTimer, connectionTimer, typingTimer, liveOnline = {};
  var socket = window.ShnoCallSignaling && window.ShnoCallSignaling.create();
  // Signaling is now delivered by the same-origin, cookie-authenticated D1 Worker.
  function esc(v) { return String(v || "").replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function url(v) { return /^https?:\/\//i.test(v || "") ? v : SocialAPI.baseUrl + (v || ""); }
  var screenSharing=false,beforeShareType='audio',durationTimer=null,connectedAt=0,facing='user';
  function show(v, type) { var callFeedback=document.querySelector('[data-call-feedback]');if(callFeedback && !callModal.hidden)callFeedback.textContent=v||''; if (feedback) { feedback.textContent = v || ""; feedback.className = "form-message" + (type ? " is-" + type : ""); } }
  function callStatus(text) { var el = document.querySelector("[data-call-status]"); if (el) el.textContent = text; }
  function callName(name, type) {
    var el=document.querySelector('[data-call-name]');if(el)el.textContent=name||'مستخدم';
    callModal.dataset.media=type==='video'?'video':'audio';
    document.querySelector('[data-call-avatar]').textContent=String(name||'؟').slice(0,1);
    var mode=document.querySelector('[data-call-switch-mode]');mode.setAttribute('aria-pressed',String(type==='video'));
  }
  function startDuration(){
    if(connectedAt)return;connectedAt=Date.now();
    var clock=document.querySelector('[data-call-duration]');clock.hidden=false;
    function tick(){var seconds=Math.floor((Date.now()-connectedAt)/1000);clock.textContent=(seconds>=3600?String(Math.floor(seconds/3600)).padStart(2,'0')+':':'')+String(Math.floor(seconds/60)%60).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}
    tick();durationTimer=setInterval(tick,1000);
  }
  function newCallId() { return (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2)); }
  function presenceElement(userId) { return Array.from(windowEl.querySelectorAll("[data-chat-presence]")).find(function (el) { return String(el.dataset.userId) === String(userId); }); }
  function avatar(u) { u = u || {}; return '<span class="avatar">' + (u.avatarUrl ? '<img src="' + esc(url(u.avatarUrl)) + '" alt="">' : esc((u.fullName || u.name || "?").slice(0, 1))) + '<i class="presence ' + (u.online ? "online" : "") + '"></i></span>'; }
  function attachment(m) {
    var a = m.attachment; if (!a || m.deletedForEveryone) return "";
    var src = esc(url(a.url)), name = esc(a.name || "مرفق");
    if (m.type === "image") return '<a href="' + src + '" target="_blank" rel="noopener"><img class="message-media" src="' + src + '" alt="' + name + '"></a>';
    if (m.type === "video") return '<video class="message-media" src="' + src + '" controls playsinline preload="metadata"></video>';
    if (m.type === "audio") return '<audio class="message-audio" src="' + src + '" controls preload="metadata"></audio>';
    return '<a class="message-file" href="' + src + '" target="_blank" rel="noopener" download>📎 ' + name + "</a>";
  }
  function messageHtml(m) {
    var mine = m.senderId === m.currentUserId || m.mine, text = m.deletedForEveryone ? "تم حذف هذه الرسالة" : esc(m.text).replace(/\n/g, "<br>");
    return '<article class="chat-message ' + (mine ? "mine" : "") + '" data-message-id="' + esc(m._id || m.id) + '">' + (text ? "<p>" + text + "</p>" : "") + attachment(m) + "<time>" + (m.createdAt ? new Date(m.createdAt).toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" }) : "") + (mine ? '<span class="message-state">' + (m.readAt ? "✓✓ مقروء" : m.deliveredAt ? "✓✓" : "✓") + "</span>" : "") + "</time></article>";
  }
  function renderConversations(items) {
    if (!items.length) { list.innerHTML = '<div class="social-empty" style="min-height:220px"><strong>لا توجد محادثات</strong><p>ابدأ محادثة من ملف أحد الأصدقاء.</p></div>'; return; }
    list.innerHTML = items.map(function (c) { var u = c.otherUser || c; return '<button class="social-list-item ' + (String(c.id) === String(currentId) ? "is-active" : "") + '" type="button" data-conversation-id="' + esc(c.id) + '">' + avatar(u) + '<span class="social-list-copy"><strong>' + esc(u.fullName || u.name || "محادثة") + "</strong><small>" + esc(c.lastMessage ? (c.lastMessage.text || "وسائط") : "لا توجد رسائل") + '</small></span><span class="social-list-meta">' + (c.unreadCount ? '<b class="unread">' + Number(c.unreadCount) + "</b>" : "") + "</span></button>"; }).join("");
  }
  function renderMessages(data) {
    var items = data.messages || [], c = data.conversation || {}, u = c.otherUser || {};
    if (Object.prototype.hasOwnProperty.call(liveOnline, String(u.id))) u.online = liveOnline[String(u.id)];
    currentOther = u;
    windowEl.innerHTML = '<header class="chat-header"><button class="icon-button" data-chat-back>رجوع</button>' + avatar(u) + '<div class="chat-header-copy"><strong>' + esc(u.fullName || "محادثة") + '</strong><small data-chat-presence data-user-id="' + esc(u.id) + '">' + (u.online ? "متصل الآن" : (u.lastSeen ? "آخر ظهور " + new Date(u.lastSeen).toLocaleString("ar-IQ") : "غير متصل")) + '</small></div><div class="chat-header-actions"><button class="icon-button" data-start-call="audio">صوت</button><button class="icon-button" data-start-call="video">فيديو</button></div></header><div class="chat-messages" data-chat-messages>' + (items.length ? items.map(messageHtml).join("") : '<div class="chat-empty"><strong>لا توجد رسائل بعد</strong></div>') + '</div><div class="typing" data-typing-line></div><form class="chat-composer" data-composer><input type="file" hidden accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,audio/webm,audio/mpeg,audio/ogg,audio/mp4,application/pdf,text/plain" data-attachment><small title="الرفع في المحادثات لم يكتمل">نص فقط</small><textarea required maxlength="5000" placeholder="اكتب رسالة…" data-message-input></textarea><button class="send-button">إرسال</button></form>';
    var box = windowEl.querySelector("[data-chat-messages]"); if (box) box.scrollTop = box.scrollHeight;
  }
  async function loadList() { try { var d = await SocialAPI.request("/api/conversations"); renderConversations(d.conversations || []); } catch (e) { show(e.message, "error"); } }
  async function openConversation(id) {
    currentId = String(id); if (socket) socket.emit("private:join", currentId);
    try { var d = await SocialAPI.request("/api/conversations/" + encodeURIComponent(currentId) + "/messages"); renderMessages(d); await SocialAPI.request("/api/conversations/" + encodeURIComponent(currentId) + "/read", { method: "PATCH" }); history.replaceState(null, "", "messages.html?conversation=" + encodeURIComponent(currentId)); loadList(); } catch (e) { show(e.message, "error"); }
  }
  async function start() {
    var user = params.get("user"); if (!user) { if (currentId) openConversation(currentId); return; }
    try { var d = await SocialAPI.request("/api/conversations/" + encodeURIComponent(user), { method: "POST" }); await loadList(); await openConversation(d.conversation.id); var requestedCall=params.get("call")||params.get("prepare"); if (["audio", "video"].includes(requestedCall)) startCall(requestedCall); } catch (e) { show(e.message, "error"); }
  }
  list.addEventListener("click", function (e) { var row = e.target.closest("[data-conversation-id]"); if (row) openConversation(row.dataset.conversationId); });
  windowEl.addEventListener("submit", async function (e) {
    if (!e.target.matches("[data-composer]")) return; e.preventDefault(); var input = e.target.querySelector("[data-message-input]"), text = input.value.trim(); if (!text) return; input.value = "";
    try { await SocialAPI.request("/api/conversations/" + encodeURIComponent(currentId) + "/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "text", text: text }) }); await openConversation(currentId); } catch (err) { input.value = text; show(err.message, "error"); }
  });
  windowEl.addEventListener("input", function (e) { if (!e.target.matches("[data-message-input]") || !socket) return; socket.emit("private:typing", { conversationId: currentId, active: Boolean(e.target.value.trim()) }); clearTimeout(typingTimer); typingTimer = setTimeout(function () { socket.emit("private:typing", { conversationId: currentId, active: false }); }, 1500); });
  windowEl.addEventListener("click", function (e) {
    if (e.target.closest("[data-chat-back]")) { history.replaceState(null, "", "messages.html"); currentId = null; currentOther = null; windowEl.innerHTML = '<div class="chat-empty"><strong>اختر محادثة</strong><p>لا توجد محادثة مفتوحة. ستظهر محادثاتك الحقيقية هنا.</p></div>'; return; }
    if (e.target.closest("[data-attach]")) windowEl.querySelector("[data-attachment]").click();
    var startButton = e.target.closest("[data-start-call]"); if (startButton) startCall(startButton.dataset.startCall);
    var recordButton = e.target.closest("[data-record]"); if (recordButton) toggleRecording(recordButton);
  });
  windowEl.addEventListener("change", async function (e) {
    if (!e.target.matches("[data-attachment]") || !e.target.files[0]) return; var f = e.target.files[0], form = new FormData();
    if (f.size > 10 * 1024 * 1024) { e.target.value = ""; return show("حجم الملف أكبر من 10 ميغابايت", "error"); }
    form.append("type", f.type.startsWith("image/") ? "image" : f.type.startsWith("video/") ? "video" : f.type.startsWith("audio/") ? "audio" : "file"); form.append("attachment", f);
    try { await SocialAPI.request("/api/conversations/" + encodeURIComponent(currentId) + "/messages", { method: "POST", body: form }); e.target.value = ""; } catch (err) { show(err.message, "error"); }
  });
  function toggleRecording(button) {
    if (recorder && recorder.state === "recording") { recorder.stop(); button.textContent = "◉"; return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) return show("تسجيل الصوت غير مدعوم في هذا الجهاز", "error");
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) { var chunks = []; recorder = new MediaRecorder(stream); recorder.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); }; recorder.onstop = async function () { stream.getTracks().forEach(function (t) { t.stop(); }); var mime = recorder.mimeType || "audio/webm", blob = new Blob(chunks, { type: mime }); if (blob.size > 10 * 1024 * 1024) return show("الرسالة الصوتية أكبر من 10 ميغابايت", "error"); var form = new FormData(); form.append("type", "audio"); form.append("attachment", blob, "voice-message.webm"); try { await SocialAPI.request("/api/conversations/" + encodeURIComponent(currentId) + "/messages", { method: "POST", body: form }); } catch (e) { show(e.message, "error"); } }; recorder.start(); button.textContent = "■"; }).catch(function () { show("تعذر الوصول إلى الميكروفون", "error"); });
  }
  function reportCallState(state, id) {
    var detail={state:state,callId:id || (activeCall && activeCall.callId) || '',conversationId:activeCall && activeCall.conversationId,userId:activeCall && activeCall.userId,type:activeCall && activeCall.type};
    if(window.ShnoAndroidCall)window.ShnoAndroidCall.onCallState(JSON.stringify(detail));
    window.dispatchEvent(new CustomEvent('shno:call-state', {detail:detail}));
  }
  window.shnoEndCall = function () { endCall(true, 'انتهت المكالمة'); };
  function stopMedia() { if (localStream) localStream.getTracks().forEach(function (t) { t.stop(); }); localStream = null; document.querySelectorAll("[data-local-video],[data-remote-video]").forEach(function (v) { v.pause(); v.srcObject = null; v.classList.remove("is-visible"); }); }
  function endCall(notify, status, reason, transferring) {
    var endedId=activeCall && activeCall.callId;
    if(window.ShnoCallAudio)window.ShnoCallAudio.stop();
    if(window.ShnoIncomingCalls && activeCall)window.ShnoIncomingCalls.end(endedId);
    var delivered=Promise.resolve();
    if(notify && socket && activeCall){
      delivered=new Promise(function(resolve){
        socket.emit(typeof notify==='string'?notify:'call:end',callPayload({reason:reason||'ended'}),resolve);
      });
    }
    clearTimeout(callTimer);clearTimeout(connectionTimer);clearInterval(durationTimer);durationTimer=null;connectedAt=0;document.querySelector('[data-call-duration]').hidden=true;screenSharing=false;if(window.ShnoScreenShare)window.ShnoScreenShare.stop();stopMedia();
    if(peer){peer.ontrack=peer.onicecandidate=peer.onconnectionstatechange=null;peer.close();}
    peer=null;pendingIce=[];activeCall=null;callModal.hidden=true;
    document.querySelector('[data-incoming-call-actions]').hidden=true;
    if(status)show(status,status==='تعذر الاتصال'?'error':'success');
    // Keep the WebView alive until its terminal signal has reached the server.
    if(!transferring)delivered.then(function(){if(!activeCall)reportCallState('ended',endedId);});
  }
  function callPayload(data) { return Object.assign({ callId: activeCall.callId, userId: activeCall.userId, conversationId: activeCall.conversationId, type: activeCall.type }, data || {}); }
  async function getMedia(type) { stopMedia(); localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === "video" }); var v = document.querySelector("[data-local-video]"); if (type === "video") { v.srcObject = localStream; v.classList.add("is-visible"); } }
  function ensurePeer() {
    if (peer) return peer; peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }); localStream.getTracks().forEach(function (t) { peer.addTrack(t, localStream); });
    peer.ontrack = function (e) { var v = document.querySelector("[data-remote-video]"); if (!v) return; v.srcObject = e.streams[0]; if (e.track.kind === 'video') { v.classList.add('is-visible'); v.play().catch(function(){}); } else { v.play().catch(function(){}); } };
    peer.onicecandidate = function (e) { if (e.candidate) socket.emit("webrtc:ice", callPayload({ data: e.candidate })); };
    peer.onconnectionstatechange = function () { if (!peer) return; if (peer.connectionState === "connected") { clearTimeout(connectionTimer); callStatus("متصل الآن"); startDuration(); reportCallState("connected"); } else if (["failed", "closed"].includes(peer.connectionState)) endCall(true, "تعذر الاتصال", "connection-failed"); else if (peer.connectionState === "disconnected") { clearTimeout(connectionTimer); connectionTimer = setTimeout(function () { if (peer && peer.connectionState === "disconnected") endCall(true, "تعذر الاتصال", "disconnected"); }, 8000); } };
    return peer;
  }
  function receiveIncomingCall(payload) {
    payload = payload || {};
    var callId = String(payload.callId || "");
    var from = String(payload.from || payload.userId || "");
    var conversationId = String(payload.conversationId || "");
    var type = payload.type === "video" ? "video" : "audio";
    if (!callId || !from || !conversationId) return;
    if (activeCall) {
      if (String(activeCall.callId) === callId) {
        callModal.hidden = false;
        document.querySelector("[data-incoming-call-actions]").hidden = !activeCall.incoming || activeCall.accepted;
      } else if (socket) {
        socket.emit("call:reject", { callId: callId, userId: from, conversationId: conversationId, type: type, reason: "busy" });
      }
      return true;
    }
    activeCall = { callId: callId, userId: from, conversationId: conversationId, type: type, incoming: true };
    callModal.hidden = false;
    callName(payload.callerName || "مستخدم شنو منو", type);
    callStatus("مكالمة واردة");
    document.querySelector("[data-incoming-call-actions]").hidden = false;
    if(window.ShnoIncomingCalls)window.ShnoIncomingCalls.incoming({
      callId:callId,conversationId:conversationId,from:from,
      callerName:payload.callerName||"مستخدم شنو منو",type:type
    });
    clearTimeout(callTimer);
    callTimer=setTimeout(function(){if(activeCall && !activeCall.accepted)endCall(true,"لا يوجد رد","no-answer");},30000);
    return true;
  }
  // Native Android hands off an invite that was already received by its
  // foreground service. Keeping the callId here avoids waiting for a second
  // WebView socket event and keeps accept/reject tied to the original call.
  window.shnoHandleIncomingCall = receiveIncomingCall;

  async function startCall(type) { if(window.ShnoCallAudio)window.ShnoCallAudio.unlock();
    if (activeCall) return show("لديك مكالمة قائمة الآن", "error");
    if (!socket || !socket.connected || !currentOther || !currentOther.id) return show("تعذر بدء المكالمة الآن", "error"); activeCall = { callId: newCallId(), userId: String(currentOther.id), conversationId: currentId, type: type, incoming: false }; callModal.hidden = false; callName(currentOther.fullName, type); callStatus("جارٍ الاتصال…"); reportCallState("outgoing");
    try { var starting=activeCall; await getMedia(type); if(activeCall!==starting){stopMedia();return;} socket.emit("call:invite", callPayload(), function (result) { if (!activeCall) return; if (result && result.ok) { callStatus("يرن…"); if(window.ShnoCallAudio)window.ShnoCallAudio.startRingback(); return; } endCall(false); show((result && result.message) || "تعذر الاتصال", "error"); }); callTimer = setTimeout(function () { if (!activeCall || activeCall.incoming) return; endCall(true, "لا يوجد رد", "no-answer"); }, 30000); } catch (_) { endCall(false); show("تعذر الوصول إلى الكاميرا أو الميكروفون", "error"); }
  }
  async function acceptCall() {
    if (!activeCall || activeCall.accepted || activeCall.accepting) return;
    var accepting=activeCall;
    accepting.accepting=true;
    reportCallState('accepting');
    if(window.ShnoIncomingCalls)window.ShnoIncomingCalls.end(accepting.callId);
    try {
      await getMedia(accepting.type);
      if(activeCall!==accepting){stopMedia();return;}
      ensurePeer();
      accepting.accepted=true;accepting.accepting=false;
      clearTimeout(callTimer);
      document.querySelector('[data-incoming-call-actions]').hidden=true;
      callStatus('جاري إنشاء الاتصال…');
      connectionTimer=setTimeout(function(){if(activeCall===accepting)endCall(true,'تعذر الاتصال','connect-timeout');},30000);
      socket.emit('call:accept',callPayload(),function(result){if(activeCall===accepting && result && !result.ok)endCall(false,'انتهت المكالمة');});
    } catch (_) {
      if(activeCall!==accepting)return;
      endCall('call:reject','تعذر الوصول إلى الكاميرا أو الميكروفون','media-denied');
    }
  }
  function waitForStable(pc) {
    if(pc.signalingState==='stable')return Promise.resolve();
    return new Promise(function(resolve,reject){
      var timer=setTimeout(function(){cleanup();reject(new Error('انتهت مهلة تحديث الوسائط'));},15000);
      function cleanup(){clearTimeout(timer);pc.removeEventListener('signalingstatechange',check);}
      function check(){if(pc.signalingState==='stable'){cleanup();resolve();}else if(pc.signalingState==='closed'){cleanup();reject(new Error('انتهت المكالمة'));}}
      pc.addEventListener('signalingstatechange',check);check();
    });
  }
  // Switch media without ending the existing call or generating a new callId.
  // The existing WebRTC offer/answer signaling renegotiates the video m-line.
  window.shnoSwitchCallMedia = async function (targetType) {
    if (!activeCall || !peer || !localStream) return false;
    if(screenSharing)await stopScreenSharing();
    await waitForStable(peer);
    targetType = targetType === 'video' ? 'video' : 'audio';
    if (activeCall.type === targetType) return true;
    var videoSender = peer.getSenders().find(function (sender) {
      return (sender.track && sender.track.kind === 'video') || (peer.getTransceivers().some(function(t){return t.sender===sender && t.receiver.track.kind==='video';}));
    });
    try {
      if (targetType === 'video') {
        var camera = await navigator.mediaDevices.getUserMedia({video: true, audio: false});
        var track = camera.getVideoTracks()[0];
        if (!track) { camera.getTracks().forEach(function(t){t.stop();}); return false; }
        localStream.addTrack(track);
        if (videoSender) await videoSender.replaceTrack(track);
        else peer.addTrack(track, localStream);
        var preview = document.querySelector('[data-local-video]');
        if (preview) { preview.srcObject = localStream; preview.classList.add('is-visible'); preview.play().catch(function(){}); }
      } else {
        if (videoSender) await videoSender.replaceTrack(null);
        localStream.getVideoTracks().forEach(function (track) { localStream.removeTrack(track); track.stop(); });
        var previewOff = document.querySelector('[data-local-video]');
        if (previewOff) { previewOff.srcObject = null; previewOff.classList.remove('is-visible'); }
      }
      activeCall.type = targetType;
      var modeButton=document.querySelector('[data-call-switch-mode]');
      if(modeButton)modeButton.setAttribute('aria-pressed',String(targetType==='video'));
      callName(currentOther && currentOther.fullName || document.querySelector('[data-call-name]')?.textContent || 'مستخدم', targetType);
      var offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await sendCallSignal('webrtc:offer', callPayload({data: peer.localDescription}));
      await waitForStable(peer);reportCallState('connected');
      return true;
    } catch (error) {
      show('تعذر تغيير وضع المكالمة: '+(error.message || 'تحقق من صلاحية الكاميرا'),'error');
      return false;
    }
  };
  window.shnoGetCallMediaType = function () { return activeCall ? activeCall.type : null; };
  async function flushIce() { while (pendingIce.length && peer && peer.remoteDescription) await peer.addIceCandidate(pendingIce.shift()).catch(function () {}); }
  document.querySelector("[data-call-end]").onclick = function () { endCall(true, "انتهت المكالمة"); };
  document.querySelector("[data-call-accept]").onclick = acceptCall;
  document.querySelector("[data-call-reject]").onclick = function () { endCall("call:reject", "رفض المكالمة", "rejected"); };
  document.querySelector("[data-call-mute]").onclick = function () { var b = this; if (localStream) localStream.getAudioTracks().forEach(function (t) { t.enabled = !t.enabled; b.classList.toggle("is-off", !t.enabled); }); };
  var modeButton=document.querySelector('[data-call-switch-mode]');
  if(modeButton)modeButton.onclick=async function(){
    if(!activeCall)return;
    var next=activeCall.type==='video'?'audio':'video';
    this.disabled=true;
    try { await window.shnoSwitchCallMedia(next); }
    finally { this.disabled=false; }
  };
  function sendCallSignal(event, data) {
    return new Promise(function(resolve,reject){socket.emit(event,data,function(result){if(result && result.ok)resolve(result);else reject(new Error(result && result.message || 'تعذر إرسال الدعوة'));});});
  }
  async function chooseParticipant() {
    if(!activeCall || !peer || peer.connectionState!=='connected')return show('انتظر اتصال الطرفين أولاً','error');
    try {
      var response=await SocialAPI.request('/api/conversations');
      var contacts=(response.conversations||[]).map(function(c){return c.otherUser;}).filter(function(u){return u && u.id && u.id!==activeCall.userId;});
      var dialog=document.createElement('dialog');dialog.className='call-participant-picker';
      var title=document.createElement('h3');title.textContent='إضافة مشارك إلى المكالمة';dialog.appendChild(title);
      contacts.forEach(function(user){
        var button=document.createElement('button');button.type='button';button.textContent=user.fullName||user.username||'مشارك';button.className='icon-button';
        button.onclick=async function(){
          if(!activeCall)return;
          button.disabled=true;
          try{
            var original=activeCall;
            var created=await SocialAPI.request('/api/call-groups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'مكالمة جماعية',members:[original.userId,user.id]})});
            if(activeCall!==original)throw new Error('انتهت المكالمة');
            var nextCall=newCallId(),group=created.group.id;
            await sendCallSignal('call:end',callPayload({reason:'group-transfer',data:{groupId:group,callId:nextCall,type:original.type}}));
            endCall(false,null,null,true);
            location.assign('call-groups.html?group='+encodeURIComponent(group)+'&start='+original.type+'&callId='+encodeURIComponent(nextCall));
          }catch(e){show(e.message,'error');button.disabled=false;}
        };
        dialog.appendChild(button);
      });
      if(!contacts.length){var empty=document.createElement('p');empty.textContent='ابدأ محادثة مع صديق آخر ليظهر هنا';dialog.appendChild(empty);}
      var cancel=document.createElement('button');cancel.textContent='إلغاء';cancel.onclick=function(){dialog.close();dialog.remove();};dialog.appendChild(cancel);
      document.body.appendChild(dialog);dialog.showModal();
    }catch(e){show(e.message,'error');}
  }
  document.querySelector('[data-call-add]').onclick=chooseParticipant;
  document.querySelector('[data-call-contacts]').onclick=chooseParticipant;
  document.querySelector('[data-call-split]').onclick=function(){
    if(callModal.dataset.media!=='video')return show('شغّل الفيديو أولاً','error');
    callModal.classList.toggle('shno-split');
  };
  var speaker=false;
  document.querySelector('[data-call-speaker]').onclick=async function(){
    if(window.ShnoAndroidCall){speaker=!speaker;window.ShnoAndroidCall.setSpeaker(speaker);this.classList.toggle('is-active',speaker);this.setAttribute('aria-pressed',String(speaker));return;}
    var remote=document.querySelector('[data-remote-video]');
    if(navigator.mediaDevices.selectAudioOutput && remote.setSinkId){
      try{var output=await navigator.mediaDevices.selectAudioOutput();await remote.setSinkId(output.deviceId);}catch(e){show(e.message,'error');}
    }else show('اختر مخرج الصوت من إعدادات الجهاز','error');
  };
  document.querySelector('[data-call-expand]').onclick=function(){var expanded=callModal.classList.toggle('is-expanded');this.setAttribute('aria-expanded',String(expanded));};
  document.querySelector('[data-call-keypad]').onclick=function(){
    var sender=peer && peer.getSenders().find(function(s){return s.track && s.track.kind==='audio';});
    if(!sender || !sender.dtmf || !sender.dtmf.canInsertDTMF)return show('لوحة الأرقام متاحة بعد اتصال الصوت ودعم الطرف الآخر لنغمات DTMF','error');
    var dialog=document.createElement('dialog');dialog.className='call-keypad';
    var title=document.createElement('h3');title.textContent='لوحة الأرقام';dialog.appendChild(title);
    var display=document.createElement('input');display.readOnly=true;display.setAttribute('aria-label','الأرقام المرسلة');dialog.appendChild(display);
    var keys=document.createElement('div');keys.className='call-keypad-grid';
    '123456789*0#'.split('').forEach(function(digit){var button=document.createElement('button');button.type='button';button.textContent=digit;button.onclick=function(){if(sender.dtmf.canInsertDTMF){sender.dtmf.insertDTMF(sender.dtmf.toneBuffer+digit,150,70);display.value+=digit;}};keys.appendChild(button);});
    dialog.appendChild(keys);var close=document.createElement('button');close.textContent='رجوع';close.className='call-keypad-close';close.onclick=function(){dialog.close();dialog.remove();};dialog.appendChild(close);document.body.appendChild(dialog);dialog.showModal();
  };
  async function replaceLocalVideo(track){
    if(!peer || !localStream || !activeCall){if(track)track.stop();return;}
    await waitForStable(peer);
    var sender=peer.getTransceivers().find(function(t){return t.receiver.track.kind==='video';})?.sender;
    var old=localStream.getVideoTracks();
    if(sender)await sender.replaceTrack(track);else if(track)peer.addTrack(track,localStream);
    old.forEach(function(t){localStream.removeTrack(t);if(t!==track)t.stop();});
    if(track)localStream.addTrack(track);
    var preview=document.querySelector('[data-local-video]');preview.srcObject=track?localStream:null;preview.classList.toggle('is-visible',Boolean(track));if(track)preview.play().catch(function(){});
    activeCall.type=track?'video':'audio';callName(currentOther?.fullName||document.querySelector('[data-call-name]').textContent,activeCall.type);
    await peer.setLocalDescription(await peer.createOffer());
    await sendCallSignal('webrtc:offer',callPayload({data:peer.localDescription}));await waitForStable(peer);
  }
  document.querySelector('[data-call-flip]').onclick=async function(){
    if(screenSharing)return show('أوقف مشاركة الشاشة لتبديل الكاميرا','error');
    if(!peer || !localStream || !localStream.getVideoTracks().length)return;
    this.disabled=true;
    try{var next=facing==='user'?'environment':'user';var camera=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:next}},audio:false});await replaceLocalVideo(camera.getVideoTracks()[0]);facing=next;}
    catch(e){show('تعذر تبديل الكاميرا: '+e.message,'error');}finally{this.disabled=false;}
  };
  async function stopScreenSharing(){
    if(!screenSharing)return;
    screenSharing=false;window.ShnoScreenShare.stop();callModal.classList.remove('is-sharing');
    document.querySelector('[data-call-share]').classList.remove('is-active');document.querySelector('[data-call-share] span').textContent='مشاركة الشاشة';
    if(!activeCall || !peer)return;
    var camera=null;
    if(beforeShareType==='video')camera=(await navigator.mediaDevices.getUserMedia({video:true,audio:false})).getVideoTracks()[0];
    await replaceLocalVideo(camera);
  }
  document.querySelector('[data-call-share]').onclick=async function(){
    if(!peer || peer.connectionState!=='connected')return show('انتظر اتصال الطرفين أولاً','error');
    this.disabled=true;
    try{
      if(screenSharing){await stopScreenSharing();return;}
      var original=activeCall;beforeShareType=activeCall.type;
      var capture=await window.ShnoScreenShare.start();
      if(activeCall!==original){window.ShnoScreenShare.stop();return;}
      await replaceLocalVideo(capture.getVideoTracks()[0]);screenSharing=true;callModal.classList.add('is-sharing');this.classList.add('is-active');this.querySelector('span').textContent='إيقاف مشاركة الشاشة';
    }catch(e){window.ShnoScreenShare.stop();show(e.message,'error');}finally{this.disabled=false;}
  };
  window.addEventListener('shno:screen-share-stopped',function(){if(screenSharing)stopScreenSharing().catch(function(e){show(e.message,'error');});});
  if (socket) {
    socket.on("private:message", function (p) { String(p.conversationId) === String(currentId) ? openConversation(currentId) : loadList(); });
    socket.on("private:typing", function (p) { var line = windowEl.querySelector("[data-typing-line]"); if (line && String(p.conversationId) === String(currentId)) line.textContent = p.active ? "يكتب الآن…" : ""; });
    socket.on("private:read", function (p) { if (String(p.conversationId) !== String(currentId)) return; windowEl.querySelectorAll(".chat-message.mine .message-state").forEach(function (el) { el.textContent = "✓✓ مقروء"; }); loadList(); });
    function updatePresence(p, online) {
      liveOnline[String(p.userId)] = online;
      var el = presenceElement(p.userId);
      if (el) el.textContent = online ? "متصل الآن" : (p.lastSeen ? "آخر ظهور " + new Date(p.lastSeen).toLocaleString("ar-IQ") : "غير متصل");
      if (el) { var dot = el.closest(".chat-header")?.querySelector(".presence"); if (dot) dot.classList.toggle("online", online); }
    }
    socket.on("presence:state", function (p) {
      liveOnline = {};
      (p.userIds || []).forEach(function (id) { liveOnline[String(id)] = true; });
      if (currentOther) updatePresence({ userId: currentOther.id }, Boolean(liveOnline[String(currentOther.id)]));
    });
    socket.on("presence:online", function (p) { updatePresence(p, true); });
    socket.on("presence:offline", function (p) { updatePresence(p, false); });
    socket.on("call:invite", receiveIncomingCall);
    socket.on("call:accept", async function (p) { if (!activeCall || activeCall.incoming || String(p.callId) !== activeCall.callId) return; clearTimeout(callTimer); connectionTimer=setTimeout(function(){if(activeCall)endCall(true,"تعذر الاتصال","connect-timeout");},30000); if(window.ShnoCallAudio)window.ShnoCallAudio.stop(); try { var pc = ensurePeer(), offer = await pc.createOffer(); await pc.setLocalDescription(offer); socket.emit("webrtc:offer", callPayload({ data: pc.localDescription })); } catch (_) { endCall(true, "تعذر الاتصال", "offer-failed"); } });
    socket.on("call:reject", function (p) { if (activeCall && String(p.callId) === activeCall.callId) endCall(false, p.reason === "busy" ? "المستخدم مشغول بمكالمة أخرى" : "رفض المكالمة"); });
    socket.on("call:end", function (p) { if(activeCall && String(p.callId)===activeCall.callId && p.reason==='group-transfer' && p.data && /^[a-f0-9-]{36}$/i.test(p.data.groupId) && /^[a-f0-9-]{36}$/i.test(p.data.callId)) {
      endCall(false,null,null,true);
      location.assign('call-groups.html?group='+encodeURIComponent(p.data.groupId)+'&joinCall='+encodeURIComponent(p.data.callId));return;
    } if (activeCall && String(p.callId) === activeCall.callId) endCall(false, p.reason === "no-answer" ? "لا يوجد رد" : p.reason === "disconnected" ? "تعذر الاتصال" : "انتهت المكالمة"); });
    socket.on("webrtc:offer", async function (p) { if (!activeCall || String(p.callId) !== activeCall.callId) return; try { var pc = ensurePeer(); if(pc.signalingState!=='stable'){if(activeCall.incoming)await pc.setLocalDescription({type:'rollback'});else return;} await pc.setRemoteDescription(p.data); var remote=document.querySelector('[data-remote-video]');remote.classList.toggle('is-visible',p.type==='video'); await flushIce(); var answer = await pc.createAnswer(); await pc.setLocalDescription(answer); socket.emit("webrtc:answer", callPayload({ data: pc.localDescription })); } catch (_) { endCall(true,"تعذر الاتصال","answer-failed"); } });
    socket.on("webrtc:answer", async function (p) { if (!activeCall || String(p.callId) !== activeCall.callId || !peer) return; try { await peer.setRemoteDescription(p.data); await flushIce(); } catch (_) { endCall(true, "تعذر الاتصال", "answer-failed"); } });
    socket.on("webrtc:ice", async function (p) { if (!activeCall || String(p.callId) !== activeCall.callId) return; if (!peer || !peer.remoteDescription) pendingIce.push(p.data); else await peer.addIceCandidate(p.data).catch(function () {}); });
    socket.on("disconnect", function () { if (activeCall) endCall(false, "تعذر الاتصال"); });
  }
  document.querySelector("[data-conversation-search]").oninput = function () { var q = this.value.trim().toLowerCase(); list.querySelectorAll("[data-conversation-id]").forEach(function (row) { row.hidden = Boolean(q && !row.textContent.toLowerCase().includes(q)); }); };
  addEventListener("beforeunload", function () { if (activeCall && socket) socket.emit("call:end", callPayload({ reason: "page-closed" })); stopMedia(); if (peer) peer.close(); });
  // Refresh message content without replacing the composer or changing scroll position.
  // The current D1 messaging endpoint does not push socket events.
  var messageRefreshBusy=false,lastListRefresh=0;
  async function refreshCurrentMessages(){
    if(document.hidden||messageRefreshBusy||!currentId)return;
    var id=String(currentId),pane=windowEl.querySelector('[data-chat-messages]');
    if(!pane)return;
    messageRefreshBusy=true;
    try{
      var data=await SocialAPI.request('/api/conversations/'+encodeURIComponent(id)+'/messages');
      if(String(currentId)!==id||pane!==windowEl.querySelector('[data-chat-messages]'))return;
      var items=data.messages||[];
      var html=items.length?items.map(messageHtml).join(''):'<div class="chat-empty"><strong>لا توجد رسائل بعد</strong></div>';
      if(pane.innerHTML!==html){
        var nearBottom=pane.scrollHeight-pane.scrollTop-pane.clientHeight<80;
        var previousTop=pane.scrollTop;
        pane.innerHTML=html;
        pane.scrollTop=nearBottom?pane.scrollHeight:previousTop;
      }
    }catch(_){/* Retain the existing conversation on transient network failures. */}
    finally{messageRefreshBusy=false;}
  }
  setInterval(function(){
    if(document.hidden)return;
    refreshCurrentMessages();
    if(Date.now()-lastListRefresh>=10000){lastListRefresh=Date.now();loadList();}
  },2500);
  document.addEventListener('visibilitychange',function(){
    if(!document.hidden){refreshCurrentMessages();loadList();}
  });
  loadList().then(start);
}());
