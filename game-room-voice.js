(function(){
'use strict';
var params=new URLSearchParams(location.search),roomId=params.get('room'),socket=null,stream=null,joined=false,muted=true,speaker=true;
var peers=new Map(),audios=new Map(),ice={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
function ui(){var box=document.createElement('section');box.className='game-voice';box.innerHTML='<button data-vtoggle title="إخفاء أو إظهار الصوت">🎧</button><div data-vcontrols><button data-vjoin title="انضم للصوت">🎙</button><button data-vmute hidden title="فتح أو كتم الميكروفون">🔇</button><button data-vspeaker hidden title="تشغيل أو إغلاق السماعة">🔊</button><button data-vleave hidden title="مغادرة الصوت">✕</button><span data-vcount>0</span></div><small data-vmsg></small>';document.body.appendChild(box);return box}
var box=ui(),toggleBtn=box.querySelector('[data-vtoggle]'),controls=box.querySelector('[data-vcontrols]'),joinBtn=box.querySelector('[data-vjoin]'),muteBtn=box.querySelector('[data-vmute]'),speakerBtn=box.querySelector('[data-vspeaker]'),leaveBtn=box.querySelector('[data-vleave]'),count=box.querySelector('[data-vcount]'),message=box.querySelector('[data-vmsg]');
function msg(s,bad){message.textContent=s||'';message.className=bad?'bad':''}
function emitAck(event,data){return new Promise(function(resolve,reject){socket.emit(event,data,function(r){if(r&&r.ok)resolve(r);else reject(new Error(r&&r.message||'تعذر الاتصال'))})})}
function closePeer(uid){var p=peers.get(String(uid));if(p)p.close();peers.delete(String(uid));var a=audios.get(String(uid));if(a)a.remove();audios.delete(String(uid))}
function peer(uid){uid=String(uid);if(peers.has(uid))return peers.get(uid);var pc=new RTCPeerConnection(ice);peers.set(uid,pc);if(stream)stream.getTracks().forEach(function(t){pc.addTrack(t,stream)});pc.onicecandidate=function(e){if(e.candidate)socket.emit('webrtc:voice-ice',{roomId:roomId,userId:uid,data:e.candidate})};pc.ontrack=function(e){var a=audios.get(uid);if(!a){a=document.createElement('audio');a.autoplay=true;a.playsInline=true;a.hidden=true;document.body.appendChild(a);audios.set(uid,a)}a.srcObject=e.streams[0];a.muted=!speaker;a.volume=1;a.play().catch(function(){})};pc.onconnectionstatechange=function(){if(['failed','closed'].includes(pc.connectionState))closePeer(uid)};return pc}
async function offer(uid){var pc=peer(uid),o=await pc.createOffer();await pc.setLocalDescription(o);socket.emit('webrtc:voice-offer',{roomId:roomId,userId:String(uid),data:o})}
function showJoined(v){joined=v;joinBtn.hidden=v;muteBtn.hidden=!v;speakerBtn.hidden=!v;leaveBtn.hidden=!v}
async function join(){
 try{joinBtn.disabled=true;msg('اسمح باستخدام الميكروفون…');stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});stream.getAudioTracks().forEach(function(t){t.enabled=false});
 socket=window.io(SocialAPI.baseUrl,{auth:{token:SocialAPI.token()}});
 await new Promise(function(resolve,reject){socket.on('connect',resolve);socket.on('connect_error',reject)});
 try{await emitAck('game:join',{roomId:roomId})}catch(_e){await emitAck('game:spectate',{roomId:roomId})}
 var r=await emitAck('voice:join',{roomId:roomId});showJoined(true);msg('متصل بالصوت');count.textContent=(r.participants||[]).length+' متصل';
 socket.on('voice:participants',function(d){if(String(d.roomId)!==String(roomId))return;var ids=(d.participants||[]).map(function(x){return String(x.id)});count.textContent=ids.length+' متصل';Array.from(peers.keys()).forEach(function(k){if(!ids.includes(k))closePeer(k)});});
 socket.on('voice:mute-state',function(d){if(String(d.roomId)===String(roomId))count.title=d.muted?'أحد المشاركين كتم الميكروفون':'أحد المشاركين فتح الميكروفون'});
 socket.on('webrtc:voice-offer',async function(d){if(String(d.roomId)!==String(roomId))return;var pc=peer(d.from);await pc.setRemoteDescription(d.data);var a=await pc.createAnswer();await pc.setLocalDescription(a);socket.emit('webrtc:voice-answer',{roomId:roomId,userId:String(d.from),data:a})});
 socket.on('webrtc:voice-answer',async function(d){if(String(d.roomId)===String(roomId)){var pc=peer(d.from);await pc.setRemoteDescription(d.data)}});
 socket.on('webrtc:voice-ice',async function(d){if(String(d.roomId)===String(roomId))try{await peer(d.from).addIceCandidate(d.data)}catch(_e){}});
 (r.participants||[]).forEach(function(p){var uid=String(p.id);if(uid!==String(window.kahwaCurrentUserId))offer(uid).catch(function(e){msg(e.message||'تعذر ربط الصوت',true)})});
 }catch(e){msg(e.name==='NotAllowedError'?'يجب السماح للميكروفون':e.message,true);leave()}finally{joinBtn.disabled=false}
}
function leave(){if(socket){socket.emit('voice:leave',{roomId:roomId});socket.disconnect();socket=null}Array.from(peers.keys()).forEach(closePeer);if(stream){stream.getTracks().forEach(function(t){t.stop()});stream=null}muted=true;showJoined(false);count.textContent='0 متصل'}
toggleBtn.onclick=function(){box.classList.toggle('is-collapsed');toggleBtn.textContent=box.classList.contains('is-collapsed')?'🎧':'⌄'};joinBtn.onclick=join;muteBtn.onclick=function(){muted=!muted;if(stream)stream.getAudioTracks().forEach(function(t){t.enabled=!muted});muteBtn.textContent=muted?'🔇':'🎙';socket&&socket.emit('voice:mute-state',{roomId:roomId,muted:muted})};speakerBtn.onclick=function(){speaker=!speaker;audios.forEach(function(a){a.muted=!speaker;if(speaker)a.play().catch(function(){})});speakerBtn.textContent=speaker?'🔊':'🔈'};leaveBtn.onclick=leave;window.addEventListener('beforeunload',leave);
})();