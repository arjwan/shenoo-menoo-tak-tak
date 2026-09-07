(function(){
'use strict';
const video=document.getElementById('mainVideoPlayer');
const wrapper=document.getElementById('videoWrapper');
const placeholder=document.getElementById('videoPlaceholder');
const menuOverlay=document.querySelector('[data-menu-overlay]');
const list=document.querySelector('[data-channel-list]');
const search=document.querySelector('[data-search]');
const editBtn=document.querySelector('[data-edit]');
const inlineAdd=document.querySelector('[data-inline-add]');
const playlistSelect=document.querySelector('[data-playlist-select]');
const urlOverlay=document.querySelector('[data-url-overlay]');
const playlistNameOverlay=document.querySelector('[data-playlist-name-overlay]');
const volume=document.querySelector('[data-volume]');
const volumeValue=document.querySelector('[data-volume-value]');
const now=document.querySelector('[data-now-title]');
const playPause=document.querySelector('[data-play-pause]');
const mute=document.querySelector('[data-mute]');
const chat=document.querySelector('[data-chat]');
const individualMode=document.querySelector('[data-individual-mode]');
let hls=null;
let editMode=false;
let pendingM3U='';
let activeId='';
let fitContain=true;

function esc(v){return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function getPlaylists(){try{return JSON.parse(localStorage.getItem('taktak_tv_playlists')||'{}')}catch(e){return {}}}
function savePlaylists(v){localStorage.setItem('taktak_tv_playlists',JSON.stringify(v));}
function ensureDefault(){const p=getPlaylists();if(!Object.keys(p).length){p['قنواتي']={};savePlaylists(p);}return p;}
function updatePlaylistSelector(){const p=ensureDefault();const names=Object.keys(p);const old=playlistSelect.value;playlistSelect.innerHTML=names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');playlistSelect.value=names.includes(old)?old:names[0];}
function currentPlaylist(){const p=ensureDefault();return p[playlistSelect.value]||{};}
function flatChannels(){const rows=[];for(const [group,chs] of Object.entries(currentPlaylist()))for(const [name,url] of Object.entries(chs||{}))rows.push({id:group+'::'+name,group,name,url});return rows;}
function render(){const q=(search.value||'').trim().toLowerCase();const grouped={};for(const c of flatChannels()){if(q&&!c.name.toLowerCase().includes(q)&&!c.group.toLowerCase().includes(q))continue;(grouped[c.group]||(grouped[c.group]=[])).push(c);}let html='';for(const [group,chs] of Object.entries(grouped)){html+=`<div class="channel-group-title">${esc(group)}</div>`;for(const c of chs){html+=`<div class="channel-item ${editMode?'edit-mode ':''}${c.id===activeId?'is-active':''}" data-id="${esc(c.id)}"><div class="play-btn" data-play-channel><i class="fas fa-play-circle" style="color:#38bdf8"></i><span>${esc(c.name)}</span></div><span class="del-btn" data-delete-channel><i class="fas fa-trash-alt"></i></span></div>`;}}
list.innerHTML=html||'<div style="color:#94a3b8;text-align:center;padding:20px">لا توجد قنوات في هذا الملف</div>';
inlineAdd.classList.toggle('is-open',editMode);
}
function validStreamUrl(url){try{const u=new URL(url);return /^https?:$/.test(u.protocol)&&!/(porn|xxx|adult|sexcam|hentai)/i.test(u.href);}catch(e){return false;}}
function playUrl(name,url){if(!validStreamUrl(url)){alert('الرابط غير صالح أو غير مسموح.');return;}activeId='';for(const c of flatChannels())if(c.name===name&&c.url===url)activeId=c.id;now.textContent=name||'قناة';placeholder.style.display='none';if(hls){hls.destroy();hls=null;}if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=url;}else if(/\.m3u8(?:\?|$)/i.test(url)&&window.Hls&&Hls.isSupported()){hls=new Hls();hls.loadSource(url);hls.attachMedia(video);}else{video.src=url;}video.play().catch(()=>{});render();}
function addChannel(name,url,group='📌 قنوات مخصصة'){if(!name||!url)return alert('أدخل اسم القناة والرابط.');if(!validStreamUrl(url))return alert('الرابط غير صالح أو غير مسموح.');const p=ensureDefault();const key=playlistSelect.value||Object.keys(p)[0];p[key]||(p[key]={});p[key][group]||(p[key][group]={});p[key][group][name]=url;savePlaylists(p);render();}
function deleteChannel(c){if(!confirm(`حذف قناة "${c.name}"؟`))return;const p=ensureDefault();const key=playlistSelect.value;if(p[key]&&p[key][c.group]){delete p[key][c.group][c.name];if(!Object.keys(p[key][c.group]).length)delete p[key][c.group];savePlaylists(p);render();}}
function parseM3U(content){const out={};let group='قنوات عامة',name='';for(let line of String(content||'').split(/\r?\n/)){line=line.trim();if(line.startsWith('#EXTINF')){const gm=line.match(/group-title="([^"]*)"/i);if(gm&&gm[1])group=gm[1];const nm=line.match(/,(.*)$/);name=nm&&nm[1]?nm[1].trim():'';}else if(line&&!line.startsWith('#')&&name){if(validStreamUrl(line)){out[group]||(out[group]={});out[group][name]=line;}name='';}}return out;}
function setVolume(v){v=Math.max(0,Math.min(100,Number(v)||0));video.volume=v/100;volume.value=String(v);volumeValue.textContent=v+'%';mute.querySelector('i').className=v===0?'fas fa-volume-xmark':v<50?'fas fa-volume-low':'fas fa-volume-high';}
function activateIndividualMode(){
  localStorage.setItem('taktak_tv_mode','individual');
  chat.hidden=true;
  individualMode.classList.add('is-active');
  individualMode.setAttribute('aria-pressed','true');
  individualMode.textContent='✓ مشاهدة فردية';
  const note=placeholder.querySelector('small');
  if(note)note.textContent='الوضع الحالي: مشاهدة فردية.';
}
setVolume(80);

menuOverlay.addEventListener('click',e=>{if(e.target===menuOverlay)menuOverlay.classList.remove('is-open');});
document.querySelector('[data-open-menu]').onclick=()=>{updatePlaylistSelector();render();menuOverlay.classList.add('is-open');};
document.querySelector('[data-close-menu]').onclick=()=>menuOverlay.classList.remove('is-open');
editBtn.onclick=()=>{editMode=!editMode;editBtn.textContent=editMode?'✅ إغلاق الإدارة':'🛠️ إدارة';render();};
playlistSelect.onchange=render;search.oninput=render;
list.addEventListener('click',e=>{const item=e.target.closest('.channel-item');if(!item)return;const c=flatChannels().find(x=>x.id===item.dataset.id);if(!c)return;if(e.target.closest('[data-delete-channel]'))return deleteChannel(c);if(e.target.closest('[data-play-channel]')){menuOverlay.classList.remove('is-open');playUrl(c.name,c.url);}});
document.querySelector('[data-inline-save]').onclick=()=>{const n=document.querySelector('[data-inline-name]');const u=document.querySelector('[data-inline-url]');addChannel(n.value.trim(),u.value.trim());n.value='';u.value='';};
document.querySelector('[data-open-url]').onclick=()=>urlOverlay.classList.add('is-open');
document.querySelector('[data-close-url]').onclick=()=>urlOverlay.classList.remove('is-open');
document.querySelector('[data-direct-save]').onclick=()=>{const n=document.querySelector('[data-direct-name]'),u=document.querySelector('[data-direct-url]');addChannel(n.value.trim(),u.value.trim());if(n.value&&u.value){n.value='';u.value='';urlOverlay.classList.remove('is-open');}};
document.querySelector('[data-m3u-file]').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{pendingM3U=String(ev.target.result||'');document.querySelector('[data-playlist-name]').value=f.name.replace(/\.(m3u8?|txt)$/i,'');playlistNameOverlay.classList.add('is-open');};r.readAsText(f);e.target.value='';};
document.querySelector('[data-playlist-import]').onclick=()=>{const name=document.querySelector('[data-playlist-name]').value.trim();if(!name)return;const channels=parseM3U(pendingM3U);const p=ensureDefault();p[name]=channels;savePlaylists(p);pendingM3U='';playlistNameOverlay.classList.remove('is-open');updatePlaylistSelector();playlistSelect.value=name;render();alert(`تم استيراد ${Object.values(channels).reduce((n,g)=>n+Object.keys(g).length,0)} قناة.`);};
document.querySelector('[data-playlist-cancel]').onclick=()=>{pendingM3U='';playlistNameOverlay.classList.remove('is-open');};
document.querySelector('[data-video-file]').onchange=e=>{const f=e.target.files[0];if(!f)return;if(hls){hls.destroy();hls=null;}placeholder.style.display='none';video.src=URL.createObjectURL(f);now.textContent=f.name;video.play().catch(()=>{});};
volume.oninput=()=>setVolume(volume.value);document.querySelector('[data-volume-down]').onclick=()=>setVolume(Math.round(video.volume*100)-10);document.querySelector('[data-volume-up]').onclick=()=>setVolume(Math.round(video.volume*100)+10);
mute.onclick=()=>{if(video.volume>0){video.dataset.prevVolume=video.volume;setVolume(0);}else setVolume(Math.round((Number(video.dataset.prevVolume)||.8)*100));};
playPause.onclick=()=>{if(video.paused)video.play().catch(()=>{});else video.pause();};video.addEventListener('play',()=>playPause.querySelector('i').className='fas fa-pause');video.addEventListener('pause',()=>playPause.querySelector('i').className='fas fa-play');
document.querySelector('[data-fit]').onclick=()=>{fitContain=!fitContain;video.style.objectFit=fitContain?'contain':'cover';};
document.querySelectorAll('[data-size]').forEach(b=>b.onclick=()=>{if(b.dataset.size==='max')wrapper.classList.add('is-maximized');else wrapper.classList.remove('is-maximized');});
document.addEventListener('keydown',e=>{if(e.key==='Escape')wrapper.classList.remove('is-maximized');});
document.querySelector('[data-chat-toggle]').onclick=()=>chat.hidden=false;document.querySelector('[data-chat-close]').onclick=()=>chat.hidden=true;
document.querySelector('[data-voice]').onclick=()=>{if(!navigator.mediaDevices?.getUserMedia)return alert('الصوت غير مدعوم في هذا المتصفح.');navigator.mediaDevices.getUserMedia({audio:true}).then(s=>{s.getTracks().forEach(t=>t.stop());alert('الميكروفون جاهز. ربط الصوت الجماعي بالخادم هو الخطوة التالية.');}).catch(()=>alert('تعذر تشغيل الميكروفون.'));};
individualMode.onclick=()=>activateIndividualMode();
urlOverlay.addEventListener('click',e=>{if(e.target===urlOverlay)urlOverlay.classList.remove('is-open');});playlistNameOverlay.addEventListener('click',e=>{if(e.target===playlistNameOverlay)playlistNameOverlay.classList.remove('is-open');});
activateIndividualMode();
updatePlaylistSelector();render();
})();