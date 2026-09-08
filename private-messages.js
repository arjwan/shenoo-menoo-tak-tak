(function () {
  "use strict";
  var list = document.querySelector("[data-conversation-list]"), windowEl = document.querySelector("[data-chat-window]"), feedback = document.querySelector("[data-message-feedback]"), callModal = document.querySelector("[data-call-modal]");
  var params = new URLSearchParams(location.search), currentId = params.get("conversation"), currentOther, recorder, localStream, peer, activeCall, pendingIce = [], callTimer, connectionTimer, typingTimer;
  var socket = window.io && SocialAPI.token() ? window.io(SocialAPI.baseUrl, { auth: { token: SocialAPI.token() } }) : null;
  function esc(v) { return String(v || "").replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function url(v) { return /^https?:\/\//i.test(v || "") ? v : SocialAPI.baseUrl + (v || ""); }
  function show(v, type) { if (feedback) { feedback.textContent = v || ""; feedback.className = "form-message" + (type ? " is-" + type : ""); } }
  function callStatus(text) { var el = document.querySelector("[data-call-status]"); if (el) el.textContent = text; }
  function callName(name, type) { var el = document.querySelector("[data-call-name]"), camera = document.querySelector("[data-call-camera]"), avatarEl = document.querySelector("[data-call-avatar]"); if (el) el.textContent = (type === "video" ? "مكالمة فيديو · " : "مكالمة صوتية · ") + (name || "مستخدم"); if (camera) camera.hidden = type !== "video"; if (avatarEl) avatarEl.textContent = String(name || "؟").slice(0, 1); }
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
    var items = data.messages || [], c = data.conversation || {}, u = c.otherUser || {}; currentOther = u;
    windowEl.innerHTML = '<header class="chat-header"><button class="icon-button" data-chat-back>رجوع</button>' + avatar(u) + '<div class="chat-header-copy"><strong>' + esc(u.fullName || "محادثة") + '</strong><small data-chat-presence data-user-id="' + esc(u.id) + '">' + (u.online ? "متصل الآن" : (u.lastSeen ? "آخر ظهور " + new Date(u.lastSeen).toLocaleString("ar-IQ") : "غير متصل")) + '</small></div><div class="chat-header-actions"><button class="icon-button" data-start-call="audio">صوت</button><button class="icon-button" data-start-call="video">فيديو</button></div></header><div class="chat-messages" data-chat-messages>' + (items.length ? items.map(messageHtml).join("") : '<div class="chat-empty"><strong>لا توجد رسائل بعد</strong></div>') + '</div><div class="typing" data-typing-line></div><form class="chat-composer" data-composer><input type="file" hidden accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,audio/webm,audio/mpeg,audio/ogg,audio/mp4,application/pdf,text/plain" data-attachment><button class="attach-button" type="button" data-attach aria-label="إرفاق ملف">＋</button><button class="attach-button" type="button" data-record aria-label="تسجيل رسالة صوتية">◉</button><textarea required maxlength="5000" placeholder="اكتب رسالة…" data-message-input></textarea><button class="send-button">إرسال</button></form>';
    var box = windowEl.querySelector("[data-chat-messages]"); if (box) box.scrollTop = box.scrollHeight;
  }
  async function loadList() { try { var d = await SocialAPI.request("/api/conversations"); renderConversations(d.conversations || []); } catch (e) { show(e.message, "error"); } }
  async function openConversation(id) {
    currentId = String(id); if (socket) socket.emit("private:join", currentId);
    try { var d = await SocialAPI.request("/api/conversations/" + encodeURIComponent(currentId) + "/messages"); renderMessages(d); await SocialAPI.request("/api/conversations/" + encodeURIComponent(currentId) + "/read", { method: "PATCH" }); history.replaceState(null, "", "messages.html?conversation=" + encodeURIComponent(currentId)); loadList(); } catch (e) { show(e.message, "error"); }
  }
  async function start() {
    var user = params.get("user"); if (!user) { if (currentId) openConversation(currentId); return; }
    try { var d = await SocialAPI.request("/api/conversations/" + encodeURIComponent(user), { method: "POST" }); await loadList(); await openConversation(d.conversation.id); if (["audio", "video"].includes(params.get("call"))) startCall(params.get("call")); } catch (e) { show(e.message, "error"); }
  }
  list.addEventListener("click", function (e) { var row = e.target.closest("[data-conversation-id]"); if (row) openConversation(row.dataset.conversationId); });
  windowEl.addEventListener("submit", async function (e) {
    if (!e.target.matches("[data-composer]")) return; e.preventDefault(); var input = e.target.querySelector("[data-message-input]"), text = input.value.trim(); if (!text) return; input.value = "";
    try { await SocialAPI.request("/api/conversations/" + encodeURIComponent(currentId) + "/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "text", text: text }) }); } catch (err) { input.value = text; show(err.message, "error"); }
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
  function stopMedia() { if (localStream) localStream.getTracks().forEach(function (t) { t.stop(); }); localStream = null; document.querySelectorAll("[data-local-video],[data-remote-video]").forEach(function (v) { v.pause(); v.srcObject = null; v.classList.remove("is-visible"); }); }
  function endCall(notify, status, reason) { if (notify && socket && activeCall) socket.emit("call:end", callPayload({ reason: reason || "ended" })); clearTimeout(callTimer); clearTimeout(connectionTimer); stopMedia(); if (peer) { peer.ontrack = peer.onicecandidate = peer.onconnectionstatechange = null; peer.close(); } peer = null; pendingIce = []; activeCall = null; callModal.hidden = true; document.querySelector("[data-incoming-call-actions]").hidden = true; if (status) show(status, status === "تعذر الاتصال" ? "error" : "success"); }
  function callPayload(data) { return Object.assign({ callId: activeCall.callId, userId: activeCall.userId, conversationId: activeCall.conversationId, type: activeCall.type }, data || {}); }
  async function getMedia(type) { stopMedia(); localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === "video" }); var v = document.querySelector("[data-local-video]"); if (type === "video") { v.srcObject = localStream; v.classList.add("is-visible"); } }
  function ensurePeer() {
    if (peer) return peer; peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }); localStream.getTracks().forEach(function (t) { peer.addTrack(t, localStream); });
    peer.ontrack = function (e) { var v = document.querySelector("[data-remote-video]"); v.srcObject = e.streams[0]; if (activeCall && activeCall.type === "video") v.classList.add("is-visible"); v.play().catch(function () {}); };
    peer.onicecandidate = function (e) { if (e.candidate) socket.emit("webrtc:ice", callPayload({ data: e.candidate })); };
    peer.onconnectionstatechange = function () { if (!peer) return; if (peer.connectionState === "connected") { clearTimeout(connectionTimer); callStatus("متصل الآن"); } else if (["failed", "closed"].includes(peer.connectionState)) endCall(true, "تعذر الاتصال", "connection-failed"); else if (peer.connectionState === "disconnected") { clearTimeout(connectionTimer); connectionTimer = setTimeout(function () { if (peer && peer.connectionState === "disconnected") endCall(true, "تعذر الاتصال", "disconnected"); }, 8000); } };
    return peer;
  }
  async function startCall(type) {
    if (activeCall) return show("لديك مكالمة قائمة الآن", "error");
    if (!socket || !socket.connected || !currentOther || !currentOther.id) return show("تعذر بدء المكالمة الآن", "error"); activeCall = { callId: newCallId(), userId: String(currentOther.id), conversationId: currentId, type: type, incoming: false }; callModal.hidden = false; callName(currentOther.fullName, type); callStatus("جارٍ الاتصال…");
    try { await getMedia(type); socket.emit("call:invite", callPayload(), function (result) { if (!activeCall || !result || result.ok) return; endCall(false); show(result.message || "تعذر الاتصال", "error"); }); callTimer = setTimeout(function () { if (!activeCall || activeCall.incoming) return; socket.emit("call:end", callPayload({ reason: "no-answer" })); endCall(false, "لا يوجد رد"); }, 30000); } catch (_) { endCall(false); show("تعذر الوصول إلى الكاميرا أو الميكروفون", "error"); }
  }
  async function acceptCall() { if (!activeCall) return; try { await getMedia(activeCall.type); ensurePeer(); document.querySelector("[data-incoming-call-actions]").hidden = true; callStatus("جاري إنشاء الاتصال…"); socket.emit("call:accept", callPayload(), function (result) { if (result && !result.ok) endCall(false, "انتهت المكالمة"); }); } catch (_) { socket.emit("call:reject", callPayload({ reason: "media-denied" })); endCall(false); show("تعذر الوصول إلى الكاميرا أو الميكروفون", "error"); } }
  async function flushIce() { while (pendingIce.length && peer && peer.remoteDescription) await peer.addIceCandidate(pendingIce.shift()).catch(function () {}); }
  document.querySelector("[data-call-end]").onclick = function () { endCall(true, "انتهت المكالمة"); };
  document.querySelector("[data-call-accept]").onclick = acceptCall;
  document.querySelector("[data-call-reject]").onclick = function () { if (activeCall) socket.emit("call:reject", callPayload({ reason: "rejected" })); endCall(false, "رفض المكالمة"); };
  document.querySelector("[data-call-mute]").onclick = function () { var b = this; if (localStream) localStream.getAudioTracks().forEach(function (t) { t.enabled = !t.enabled; b.classList.toggle("is-off", !t.enabled); }); };
  document.querySelector("[data-call-camera]").onclick = function () { var b = this; if (localStream) localStream.getVideoTracks().forEach(function (t) { t.enabled = !t.enabled; b.classList.toggle("is-off", !t.enabled); }); };
  if (socket) {
    socket.on("private:message", function (p) { String(p.conversationId) === String(currentId) ? openConversation(currentId) : loadList(); });
    socket.on("private:typing", function (p) { var line = windowEl.querySelector("[data-typing-line]"); if (line && String(p.conversationId) === String(currentId)) line.textContent = p.active ? "يكتب الآن…" : ""; });
    socket.on("private:read", function (p) { if (String(p.conversationId) !== String(currentId)) return; windowEl.querySelectorAll(".chat-message.mine .message-state").forEach(function (el) { el.textContent = "✓✓ مقروء"; }); loadList(); });
    socket.on("presence:online", function (p) { var el = presenceElement(p.userId); if (el) el.textContent = "متصل الآن"; });
    socket.on("presence:offline", function (p) { var el = presenceElement(p.userId); if (el) el.textContent = p.lastSeen ? "آخر ظهور " + new Date(p.lastSeen).toLocaleString("ar-IQ") : "غير متصل"; });
    socket.on("call:invite", function (p) { if (activeCall) return socket.emit("call:reject", { callId: p.callId, userId: p.from, conversationId: p.conversationId, type: p.type, reason: "busy" }); activeCall = { callId: String(p.callId), userId: String(p.from), conversationId: String(p.conversationId), type: p.type, incoming: true }; callModal.hidden = false; callName(p.callerName, p.type); callStatus("مكالمة واردة"); document.querySelector("[data-incoming-call-actions]").hidden = false; });
    socket.on("call:accept", async function (p) { if (!activeCall || activeCall.incoming || String(p.callId) !== activeCall.callId) return; clearTimeout(callTimer); try { var pc = ensurePeer(), offer = await pc.createOffer(); await pc.setLocalDescription(offer); socket.emit("webrtc:offer", callPayload({ data: pc.localDescription })); } catch (_) { endCall(true, "تعذر الاتصال", "offer-failed"); } });
    socket.on("call:reject", function (p) { if (activeCall && String(p.callId) === activeCall.callId) endCall(false, p.reason === "busy" ? "المستخدم مشغول بمكالمة أخرى" : "رفض المكالمة"); });
    socket.on("call:end", function (p) { if (activeCall && String(p.callId) === activeCall.callId) endCall(false, p.reason === "no-answer" ? "لا يوجد رد" : p.reason === "disconnected" ? "تعذر الاتصال" : "انتهت المكالمة"); });
    socket.on("webrtc:offer", async function (p) { if (!activeCall || String(p.callId) !== activeCall.callId) return; try { var pc = ensurePeer(); await pc.setRemoteDescription(p.data); await flushIce(); var answer = await pc.createAnswer(); await pc.setLocalDescription(answer); socket.emit("webrtc:answer", callPayload({ data: pc.localDescription })); } catch (_) { endCall(true, "تعذر الاتصال", "answer-failed"); } });
    socket.on("webrtc:answer", async function (p) { if (!activeCall || String(p.callId) !== activeCall.callId || !peer) return; try { await peer.setRemoteDescription(p.data); await flushIce(); } catch (_) { endCall(true, "تعذر الاتصال", "answer-failed"); } });
    socket.on("webrtc:ice", async function (p) { if (!activeCall || String(p.callId) !== activeCall.callId) return; if (!peer || !peer.remoteDescription) pendingIce.push(p.data); else await peer.addIceCandidate(p.data).catch(function () {}); });
    socket.on("disconnect", function () { if (activeCall) endCall(false, "تعذر الاتصال"); });
  }
  document.querySelector("[data-conversation-search]").oninput = function () { var q = this.value.trim().toLowerCase(); list.querySelectorAll("[data-conversation-id]").forEach(function (row) { row.hidden = Boolean(q && !row.textContent.toLowerCase().includes(q)); }); };
  addEventListener("beforeunload", function () { if (activeCall && socket) socket.emit("call:end", callPayload({ reason: "page-closed" })); stopMedia(); if (peer) peer.close(); });
  loadList().then(start);
}());
