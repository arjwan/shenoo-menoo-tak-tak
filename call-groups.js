/* Private group chat, small-group WebRTC mesh, same-origin D1 session.
   Works in both Shno Mano web and the standalone app's authenticated WebView.
   No Socket.IO or user-supplied sender identity. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const api=(path,opts)=>SocialAPI.request('/api/call-groups'+path,opts);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let selfId='',groups=[],contacts=[],current=null,members=[],signalCursor=0,messageSnapshot='',polling=false;
let call=null,local=null,peers=new Map(),mediaType='audio',mute=false,layoutTwo=false,invitation=null;
const feedback=message=>{$('group-feedback').textContent=message||'';};
const setStatus=message=>{$('group-call-status').textContent=message;};
const post=(path,body)=>api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const uuid=()=>crypto.randomUUID();
async function init(){
 try{
  const session=await SocialAPI.request('/api/auth/session');
  selfId=session.user?.id||'';
  if(!selfId)throw Error('يرجى تسجيل الدخول');
  const rows=await SocialAPI.request('/api/conversations');
  contacts=(rows.conversations||[]).map(c=>c.otherUser).filter(u=>u&&u.id);
  await loadGroups();
  setInterval(tick,1800);
 }catch(e){feedback(e.message||'تعذر بدء المجموعات')}
}
async function loadGroups(){
 const result=await api('');
 groups=result.groups||[];
 $('group-items').innerHTML=groups.map(g=>'<button class="group-btn" data-group="'+esc(g.id)+'">'+esc(g.name)+' · '+g.memberCount+' أعضاء</button>').join('')||'<p>لا توجد مجموعات بعد</p>';
}
$('group-items').addEventListener('click',event=>{
 const el=event.target.closest('[data-group]');
 if(el)openGroup(el.dataset.group).catch(e=>feedback(e.message));
});
$('group-new').onclick=()=>{
 $('group-create').hidden=false;
 $('group-contacts').innerHTML=contacts.map(c=>'<label><input type="checkbox" value="'+esc(c.id)+'" name="member"> '+esc(c.fullName||c.username)+'</label>').join('')||'<p>ابدأ محادثة مع صديق قبل إضافته.</p>';
};
$('group-create-form').onsubmit=async event=>{
 event.preventDefault();
 const members=[...document.querySelectorAll('#group-contacts input:checked')].map(e=>e.value);
 try{
  const r=await post('',{name:$('group-name').value.trim(),members});
  $('group-create').hidden=true;await loadGroups();await openGroup(r.group.id);
 }catch(e){feedback(e.message)}
};
$('group-refresh').onclick=()=>loadGroups().catch(e=>feedback(e.message));
$('group-back').onclick=()=>{if(call)leaveCall();current=null;$('group-room').hidden=true;$('group-list').hidden=false;$('group-stage').hidden=true;$('group-invite').hidden=true};
async function openGroup(id){
 if(call)leaveCall();
 const r=await api('/'+encodeURIComponent(id));
 current=r.group;members=r.members||[];signalCursor=0;messageSnapshot='';
 $('group-room').hidden=false;$('group-list').hidden=true;$('group-title').textContent=current.name;
 $('group-members').textContent=members.map(m=>m.fullName).join('، ');
 await loadMessages();
 await checkSignals();
}
async function loadMessages(){
 if(!current)return;
 const d=await api('/'+current.id+'/messages'),items=d.messages||[];
 const snapshot=JSON.stringify(items);
 if(snapshot===messageSnapshot)return;
 messageSnapshot=snapshot;
 const box=$('group-messages'),bottom=box.scrollHeight-box.scrollTop-box.clientHeight<80;
 box.innerHTML=items.map(m=>'<div class="group-msg '+(m.mine?'mine':'')+'"><small>'+esc(m.senderName)+'</small>'+esc(m.text)+'</div>').join('');
 if(bottom)box.scrollTop=box.scrollHeight;
}
$('group-send').onsubmit=async e=>{
 e.preventDefault();if(!current)return;
 const input=$('group-text'),message=input.value.trim();
 if(!message)return;
 try{await post('/'+current.id+'/messages',{text:message});input.value='';await loadMessages()}
 catch(error){feedback(error.message)}
};
async function signal(user,event,data={},id=call?.id){
 if(!current||!id)return;
 return post('/'+current.id+'/signals',{userId:user,event,callId:id,data});
}
async function broadcast(event,data={},id=call?.id){
 for(const member of members)if(member.id!==selfId)await signal(member.id,event,data,id).catch(e=>feedback(e.message));
}
async function checkSignals(){
 if(!current)return;
 const id=current.id;
 const data=await api('/'+id+'/signals?after='+signalCursor);
 if(id!==current?.id)return;
 signalCursor=data.cursor||signalCursor;
 for(const s of data.signals||[])await dispatch(s);
}
async function tick(){
 if(polling||document.hidden||!current)return;
 polling=true;
 try{await checkSignals();await loadMessages()}catch(e){feedback(e.message)}
 finally{polling=false}
}
function tile(id,name,stream,own=false){
 const box=$('group-tiles');
 let el=box.querySelector('[data-tile="'+id+'"]');
 if(!el){
  el=document.createElement('div');el.className='group-tile';el.dataset.tile=id;
  const video=document.createElement('video');
  video.autoplay=true;video.playsInline=true;video.muted=own;
  const label=document.createElement('span');label.textContent=name||'مشارك';
  el.append(video,label);box.append(el);
 }
 const video=el.querySelector('video');
 if(stream) {video.srcObject=stream;video.play().catch(()=>{});}
 return el;
}
async function takeMedia(type){
 if(local){local.getTracks().forEach(t=>t.stop());local=null}
 local=await navigator.mediaDevices.getUserMedia({audio:true,video:type==='video'});
 mute=false;
 tile('self','أنت',local,true);
 return local;
}
async function startCall(type){
 if(!current||call)return;
 try{
  mediaType=type;await takeMedia(type);
  call={id:uuid(),hostId:selfId};
  $('group-stage').hidden=false;setStatus('دعوة أعضاء المجموعة…');
  await broadcast('invite',{type,name:current.name,hostId:selfId});
  setStatus('بانتظار انضمام المشاركين…');
 }catch(e){feedback('تعذر تشغيل الميكروفون أو الكاميرا: '+e.message)}
}
$('group-start-audio').onclick=()=>startCall('audio');
$('group-start-video').onclick=()=>startCall('video');
function ensurePeer(userId,initiator){
 if(peers.has(userId))return peers.get(userId);
 const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
 peers.set(userId,pc);
 if(local)local.getTracks().forEach(track=>pc.addTrack(track,local));
 pc.ontrack=e=>{const m=members.find(x=>x.id===userId);tile(userId,m?.fullName||'مشارك',e.streams[0])};
 pc.onicecandidate=e=>{if(e.candidate)signal(userId,'ice',e.candidate).catch(()=>{})};
 pc.onconnectionstatechange=()=>{if(pc.connectionState==='connected')setStatus('مكالمة جماعية متصلة');if(pc.connectionState==='failed')setStatus('تعذر الاتصال بأحد المشاركين')};
 if(initiator)sendOffer(userId,pc).catch(e=>feedback(e.message));
 return pc;
}
async function sendOffer(userId,pc){
 if(pc.signalingState!=='stable')return;
 const offer=await pc.createOffer();
 await pc.setLocalDescription(offer);
 await signal(userId,'offer',pc.localDescription);
}
async function dispatch(e){
 if(e.event==='invite' && !call){
  invitation=e;
  $('group-invite-text').textContent='مكالمة '+(e.data.type==='video'?'فيديو':'صوتية')+' واردة إلى '+(current?.name||'المجموعة');
  $('group-invite').hidden=false;return;
 }
 if(!call||e.callId!==call.id)return;
 if(e.event==='join'){
  ensurePeer(e.from,true);return;
 }
 if(e.event==='offer'){
  const pc=ensurePeer(e.from,false);
  await pc.setRemoteDescription(e.data);
  const answer=await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await signal(e.from,'answer',pc.localDescription);
  return;
 }
 if(e.event==='answer'){
  const pc=peers.get(e.from);
  if(pc&&pc.signalingState==='have-local-offer')await pc.setRemoteDescription(e.data);
  return;
 }
 if(e.event==='ice'){
  const pc=peers.get(e.from);
  if(pc)await pc.addIceCandidate(e.data).catch(()=>{});
  return;
 }
 if(e.event==='media'){
  setStatus(e.data.type==='video'?'المشارك فعّل الفيديو':'المشارك عاد إلى الصوت');
  return;
 }
 if(e.event==='leave'||e.event==='end'){
  const pc=peers.get(e.from);
  if(pc){pc.close();peers.delete(e.from)}
  $('group-tiles').querySelector('[data-tile="'+e.from+'"]')?.remove();
  if(e.event==='end'&&e.from===call.hostId)leaveCall(false);
 }
}
$('group-accept').onclick=async()=>{
 const invite=invitation;invitation=null;$('group-invite').hidden=true;
 if(!invite||call)return;
 try{
  mediaType=invite.data.type==='video'?'video':'audio';
  await takeMedia(mediaType);
  call={id:invite.callId,hostId:invite.data.hostId||invite.from};
  $('group-stage').hidden=false;setStatus('جارٍ الانضمام للمكالمة…');
  await signal(invite.from,'join',{type:mediaType});
 }catch(e){feedback('تعذر قبول الدعوة: '+e.message)}
};
$('group-reject').onclick=()=>{invitation=null;$('group-invite').hidden=true};
function leaveCall(notify=true){
 if(call&&notify)broadcast(call.hostId===selfId?'end':'leave').catch(()=>{});
 for(const pc of peers.values())pc.close();
 peers.clear();
 if(local){local.getTracks().forEach(t=>t.stop());local=null}
 call=null;invitation=null;
 $('group-stage').hidden=true;$('group-tiles').replaceChildren();
}
$('group-end').onclick=()=>leaveCall();
$('group-mute').onclick=()=>{
 if(!local)return;
 mute=!mute;
 local.getAudioTracks().forEach(t=>t.enabled=!mute);
 $('group-mute').textContent=mute?'🎙 تشغيل':'🎙 كتم';
};
$('group-video').onclick=async()=>{
 if(!call||!local)return;
 const target=mediaType==='video'?'audio':'video';
 try{
  if(target==='video'){
   const stream=await navigator.mediaDevices.getUserMedia({video:true});
   const track=stream.getVideoTracks()[0];local.addTrack(track);
   for(const pc of peers.values()){
    const sender=pc.getSenders().find(s=>s.track?.kind==='video');
    if(sender)await sender.replaceTrack(track);else pc.addTrack(track,local);
   }
  }else{
   for(const pc of peers.values())for(const sender of pc.getSenders())if(sender.track?.kind==='video')await sender.replaceTrack(null);
   local.getVideoTracks().forEach(t=>{local.removeTrack(t);t.stop()});
  }
  mediaType=target;tile('self','أنت',local,true);
  await broadcast('media',{type:mediaType});
  for(const [id,pc] of peers)await sendOffer(id,pc);
 }catch(e){feedback('تعذر تحويل المكالمة: '+e.message)}
};
$('group-split').onclick=()=>{
 layoutTwo=!layoutTwo;
 $('group-tiles').style.gridTemplateColumns=layoutTwo?'repeat(2,minmax(0,1fr))':'repeat(auto-fit,minmax(130px,1fr))';
};
$('group-speaker').onclick=()=>feedback('يتم اختيار مخرج الصوت من نظام الجهاز؛ لا يمكن للمتصفح تغيير سماعة الهاتف مباشرة');
async function addMember(){
 if(!current)return;
 const eligible=contacts.filter(u=>!members.some(m=>m.id===u.id));
 if(!eligible.length){feedback('لا يوجد صديق جديد يمكن إضافته');return}
 const text=eligible.map((u,i)=>(i+1)+'. '+(u.fullName||u.username)).join('\n');
 const choice=Number(prompt('اختر رقم العضو:\n'+text));
 if(!Number.isInteger(choice)||choice<1||choice>eligible.length)return;
 const selected=eligible[choice-1];
 try{
  await post('/'+current.id+'/members',{userId:selected.id});
  const fresh=await api('/'+current.id);members=fresh.members||[];
  $('group-members').textContent=members.map(m=>m.fullName).join('، ');
  if(call)await signal(selected.id,'invite',{type:mediaType,name:current.name,hostId:call.hostId});
 }catch(e){feedback(e.message)}
}
$('group-add').onclick=addMember;
$('group-add-in-call').onclick=addMember;
addEventListener('beforeunload',()=>{if(call)leaveCall(true)});
init();
}());
