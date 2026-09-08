(function(){
'use strict';
var API='https://shino-mino-tak-tak.duckdns.org';
var token=localStorage.getItem('token')||sessionStorage.getItem('token')||'';
var dock=document.querySelector('[data-calls-dock]'),deskList=document.querySelector('[data-calls-dock-list]'),deskSearch=document.querySelector('[data-calls-dock-search]'),toggle=document.querySelector('[data-calls-dock-toggle]'),mobileLauncher=document.querySelector('[data-calls-mobile-launcher]'),mobileSheet=document.querySelector('[data-calls-mobile-sheet]'),mobileList=document.querySelector('[data-calls-mobile-list]'),mobileSearch=document.querySelector('[data-calls-mobile-search]'),mobileClose=document.querySelector('[data-calls-mobile-close]');
if(!dock&&!mobileSheet)return;
var people=[];
function esc(v){return String(v||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function url(v){if(!v)return'';return /^https?:\/\//i.test(v)?v:API+v;}
function avatar(p){var name=p.fullName||p.displayName||p.name||p.username||'؟';var image=p.avatarUrl||(p.profile&&p.profile.avatarUrl)||'';return '<span class="calls-dock-avatar">'+(image?'<img src="'+esc(url(image))+'" alt="">':esc(name.slice(0,1)))+'<i class="calls-dock-presence '+(p.online?'online':'')+'"></i></span>';}
function row(p){var id=encodeURIComponent(p.id||p._id||'');var name=esc(p.fullName||p.displayName||p.name||'مستخدم');return '<div class="calls-dock-contact">'+avatar(p)+'<div class="calls-dock-copy"><strong>'+name+'</strong><small>'+(p.online?'متصل الآن':'غير متصل')+'</small></div><div class="calls-dock-actions"><a href="messages.html?user='+id+'" title="مراسلة">💬</a><a href="messages.html?user='+id+'&call=audio" title="اتصال صوتي">☎</a><a href="messages.html?user='+id+'&call=video" title="اتصال فيديو">▣</a></div></div>';}
function render(target,items){if(!target)return;target.innerHTML=items.length?items.map(row).join(''):'<div class="calls-dock-empty">لا يوجد أصدقاء متاحون للاتصال الآن.</div>';}
function filter(q){q=String(q||'').trim().toLocaleLowerCase('ar');return !q?people:people.filter(function(p){return String((p.fullName||p.displayName||p.name||'')+' '+(p.username||'')).toLocaleLowerCase('ar').includes(q);});}
function bindSearch(input,target){if(!input)return;var timer;input.addEventListener('input',function(){clearTimeout(timer);timer=setTimeout(function(){render(target,filter(input.value));},120);});}
async function load(){try{var r=await fetch(API+'/api/friends',{headers:{Authorization:'Bearer '+token,Accept:'application/json'}});var d=await r.json().catch(function(){return{};});if(!r.ok)throw new Error(d.message||'تعذر تحميل الأصدقاء');people=(d.friends||d.users||d.data||[]).map(function(x){return x.user||x;});render(deskList,people);render(mobileList,people);}catch(e){var msg='<div class="calls-dock-empty">'+esc(e.message||'تعذر تحميل جهات الاتصال')+'</div>';if(deskList)deskList.innerHTML=msg;if(mobileList)mobileList.innerHTML=msg;}}
function setCollapsed(value){if(!dock)return;dock.classList.toggle('is-collapsed',value);toggle.setAttribute('aria-expanded',String(!value));toggle.textContent=value?'☎':'‹';try{localStorage.setItem('shnoCallsDockCollapsed',value?'1':'0');}catch(_){}}
if(toggle){var saved=false;try{saved=localStorage.getItem('shnoCallsDockCollapsed')==='1';}catch(_){}setCollapsed(saved);toggle.addEventListener('click',function(){setCollapsed(!dock.classList.contains('is-collapsed'));});}
if(mobileLauncher&&mobileSheet){mobileLauncher.addEventListener('click',function(){mobileSheet.classList.add('is-open');mobileLauncher.setAttribute('aria-expanded','true');if(mobileSearch)setTimeout(function(){mobileSearch.focus();},50);});}
function closeMobile(){if(!mobileSheet)return;mobileSheet.classList.remove('is-open');if(mobileLauncher)mobileLauncher.setAttribute('aria-expanded','false');}
if(mobileClose)mobileClose.addEventListener('click',closeMobile);
if(mobileSheet)mobileSheet.addEventListener('click',function(e){if(e.target===mobileSheet)closeMobile();});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeMobile();});
bindSearch(deskSearch,deskList);bindSearch(mobileSearch,mobileList);load();
}());