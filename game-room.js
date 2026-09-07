(function () {
  "use strict";
  var params = new URLSearchParams(location.search), roomId = params.get("room");
  var socket = window.io && SocialAPI.token() ? window.io(SocialAPI.baseUrl, { auth: { token: SocialAPI.token() } }) : null;
  var room, localStream, peers = {}, localMuted = true, currentUserId = null, locallyMuted = {};
  var text = function (selector, value) { var el = document.querySelector(selector); if (el) el.textContent = value; };
  function feedback(value, error) { var el = document.querySelector("[data-feedback]"); if (!el) return; el.textContent = value; el.className = "form-message" + (error ? " is-error" : " is-success"); }
  function playerName(player) { return typeof player === "object" && player ? (player.displayName || player.fullName || player.username || player.name || "لاعب") : String(player || ""); }
  function playerId(player) { return typeof player === "object" && player ? String(player.id || player._id || "") : String(player || ""); }
  function render(data) {
    room = data.room || data;
    var state = room.gameState || {};
    var players = room.players || [];
    var maxPlayers = Math.min(4, Math.max(2, Number(room.maxPlayers) || 2));
    text("[data-room-name]", room.name || "مباراة كهوة عزاوي");
    text("[data-game-status]", state.status || "waiting");
    text("[data-move-count]", state.moveCount || 0);
    text("[data-turn]", state.turn ? (state.turn.name || state.turn.displayName || state.turn.id || state.turn) : "—");
    text("[data-player-count]", players.length);
    text("[data-player-max]", maxPlayers);
    var grid = document.querySelector("[data-players]"); if (grid) grid.dataset.max = maxPlayers;
    for (var index = 0; index < 4; index += 1) {
      var seat = document.querySelector('[data-player="' + index + '"]'); if (!seat) continue;
      var activeSeat = index < maxPlayers;
      seat.hidden = !activeSeat;
      if (!activeSeat) continue;
      var player = players[index];
      seat.classList.toggle("is-empty", !player);
      seat.classList.toggle("is-turn", !!player && !!state.turn && playerId(player) === playerId(state.turn));
      seat.querySelector("strong").textContent = player ? playerName(player) : "بانتظار لاعب";
      seat.querySelector("small").textContent = player ? "جاهز في الغرفة" : "المقعد " + (index + 1) + " متاح";
    }
    var settings = document.querySelector("[data-owner-settings]"); if (settings) settings.hidden = !room.owner || String(room.owner.id || room.owner._id || room.owner) !== String(currentUserId);
  }
  function renderSpectators(data) { text("[data-spectator-count]", data.count || 0); var list = document.querySelector("[data-spectator-list]"); if (!list) return; list.innerHTML = (data.spectators || []).length ? data.spectators.map(function (user) { return '<span class="participant">' + (user.name || user.username) + "</span>"; }).join("") : '<span class="voice-empty">لا يوجد مشاهدون حالياً.</span>'; }
  function renderVoice(data) { var list = document.querySelector("[data-voice-list]"); if (!list) return; list.innerHTML = (data.participants || []).length ? data.participants.map(function (user) { return '<button class="participant ' + (user.muted ? "muted" : "") + '" data-voice-user="' + user.id + '" type="button">' + user.name + (user.muted ? " · مكتوم" : "") + "</button>"; }).join("") : '<span class="voice-empty">لا يوجد مشاركون بالصوت.</span>'; }
  async function load() { if (!roomId) return feedback("رابط الغرفة غير صالح", true); try { var me = await SocialAPI.request("/api/users/me"); currentUserId = (me.user || {}).id; var data = await SocialAPI.request("/api/game-rooms/" + encodeURIComponent(roomId)); render(data); } catch (error) { feedback(error.message, true); } }
  function ensurePeer(userId, initiator) { if (peers[userId]) return peers[userId]; var peer = new RTCPeerConnection(); peers[userId] = peer; if (localStream) localStream.getTracks().forEach(function (track) { peer.addTrack(track, localStream); }); peer.ontrack = function (event) { var audio = document.getElementById("voice-" + userId) || document.createElement("audio"); audio.id = "voice-" + userId; audio.autoplay = true; audio.srcObject = event.streams[0]; document.body.appendChild(audio); }; peer.onicecandidate = function (event) { if (event.candidate && socket) socket.emit("webrtc:voice-ice", { roomId: roomId, userId: userId, data: event.candidate }); }; if (initiator) peer.createOffer().then(function (offer) { return peer.setLocalDescription(offer); }).then(function () { socket.emit("webrtc:voice-offer", { roomId: roomId, userId: userId, data: peer.localDescription }); }); return peer; }
  async function joinVoice() { if (!socket) return feedback("خدمة الاتصال غير متاحة حالياً", true); try { localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); localStream.getAudioTracks().forEach(function (track) { track.enabled = false; }); socket.emit("voice:join", { roomId: roomId }, function (result) { if (!result.ok) { localStream.getTracks().forEach(function (track) { track.stop(); }); return feedback(result.message, true); } document.querySelector("[data-voice-join]").hidden = true; document.querySelector("[data-voice-mute]").hidden = false; document.querySelector("[data-voice-leave]").hidden = false; renderVoice(result); }); } catch (error) { feedback(error.message, true); } }
  function leaveVoice() { if (socket) socket.emit("voice:leave", { roomId: roomId }); Object.keys(peers).forEach(function (id) { peers[id].close(); delete peers[id]; }); if (localStream) localStream.getTracks().forEach(function (track) { track.stop(); }); document.querySelector("[data-voice-join]").hidden = false; document.querySelector("[data-voice-mute]").hidden = true; document.querySelector("[data-voice-leave]").hidden = true; }
  document.querySelector("[data-spectators-toggle]")?.addEventListener("click", function () { var panel = document.querySelector("[data-spectator-panel]"); panel.hidden = !panel.hidden; });
  document.querySelector("[data-voice-list]")?.addEventListener("click", function (event) { var item = event.target.closest("[data-voice-user]"); if (!item) return; var id = item.dataset.voiceUser; locallyMuted[id] = !locallyMuted[id]; var audio = document.getElementById("voice-" + id); if (audio) audio.volume = locallyMuted[id] ? 0 : 1; item.classList.toggle("muted", locallyMuted[id]); });
  document.querySelector("[data-voice-join]")?.addEventListener("click", joinVoice); document.querySelector("[data-voice-leave]")?.addEventListener("click", leaveVoice); document.querySelector("[data-voice-mute]")?.addEventListener("click", function () { localMuted = !localMuted; if (localStream) localStream.getAudioTracks().forEach(function (track) { track.enabled = !localMuted; }); this.textContent = localMuted ? "تشغيل الميكروفون" : "كتم الميكروفون"; if (socket) socket.emit("voice:mute-state", { roomId: roomId, muted: localMuted }); });
  document.querySelector("[data-owner-settings]")?.addEventListener("click", function () { document.querySelector("[data-settings-modal]").hidden = false; }); document.querySelector("[data-settings-close]")?.addEventListener("click", function () { document.querySelector("[data-settings-modal]").hidden = true; });
  document.querySelector("[data-settings-form]")?.addEventListener("submit", async function (event) { event.preventDefault(); var body = Object.fromEntries(new FormData(event.target)); body.voiceEnabled = event.target.voiceEnabled.checked; try { var result = await SocialAPI.request("/api/game-rooms/" + roomId + "/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); render(result); document.querySelector("[data-settings-modal]").hidden = true; } catch (error) { feedback(error.message, true); } });
  if (socket) { socket.emit("game:spectate", { roomId: roomId }, function (result) { if (!result.ok) feedback(result.message, true); else render(result); }); socket.on("game:state", render); socket.on("game:spectators", renderSpectators); socket.on("voice:participants", function (data) { renderVoice(data); (data.participants || []).forEach(function (user) { if (user.id !== currentUserId && localStream) ensurePeer(user.id, String(currentUserId) < String(user.id)); }); }); socket.on("voice:mute-state", function (data) { var item = document.querySelector('[data-voice-user="' + data.userId + '"]'); if (item) { item.classList.toggle("muted", data.muted); item.textContent = item.textContent.replace(/ · مكتوم$/, "") + (data.muted ? " · مكتوم" : ""); } }); socket.on("webrtc:voice-offer", async function (data) { var peer = ensurePeer(data.from, false); await peer.setRemoteDescription(data.data); var answer = await peer.createAnswer(); await peer.setLocalDescription(answer); socket.emit("webrtc:voice-answer", { roomId: roomId, userId: data.from, data: peer.localDescription }); }); socket.on("webrtc:voice-answer", function (data) { if (peers[data.from]) peers[data.from].setRemoteDescription(data.data); }); socket.on("webrtc:voice-ice", function (data) { if (peers[data.from]) peers[data.from].addIceCandidate(data.data); }); }
  load();
}());
