(()=>{'use strict';
if(!/\/(?:taktak\.html)?$/i.test(location.pathname))return;
const API='https://shino-mino-tak-tak.duckdns.org';
const token=localStorage.getItem('token')||sessionStorage.getItem('token')||'';
const esc=v=>String(v||'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
const abs=u=>!u?'':/^https?:/i.test(u)?u:API+u;
async function api(p,o={}){o.headers=Object.assign({Authorization:'Bearer '+token,Accept:'application/json','Content-Type':'application/json'},o.headers||{});const r=await fetch(API+p,o),d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.message||'تعذر تنفيذ الطلب');return d}
const topLink=document.querySelector('.top-actions a[href="notifications.html"]');
if(!topLink)return;
const wrap=document.createElement('span');wrap.className='home-notifications-wrap';
topLink.parentNode.insertBefore(wrap,topLink);wrap.appendChild(topLink);
topLink.href='#notifications';topLink.classList.add('home-notification-trigger');topLink.setAttribute('data-home-notifications-trigger','1');topLink.setAttribute('aria-expanded','false');
const badge=document.createElement('span');badge.className='home-notification-badge';badge.setAttribute('data-home-notifications-badge','1');badge.hidden=true;topLink.appendChild(badge);
const menu=document.createElement('section');menu.className='home-notification-menu';menu.setAttribute('data-home-notifications-menu','1');menu.hidden=true;menu.innerHTML='<div class="home-notification-head"><strong>🔔 الإشعارات</strong><button type="button" data-home-notifications-readall>قراءة الكل</button></div><div class="home-notification-list" data-home-notifications-list><div class="home-notification-empty">جارٍ تحميل الإشعارات…</div></div>';
wrap.appendChild(menu);
const list=menu.querySelector('[data-home-notifications-list]');const readAll=menu.querySelector('[data-home-notifications-readall]');
function targetFor(n){
  const href=String(n.href||'').trim();
  if(href&&href!=='notifications.html'&&!href.endsWith('/notifications.html'))return href;
  const type=String(n.type||'').toLowerCase(),id=String(n.targetId||'').trim(),actor=n.actor&&n.actor.id?String(n.actor.id):'';
  if(type==='story'&&id)return 'taktak.html?story='+encodeURIComponent(id);
  if(type==='reel'&&id)return 'taktak.html?reel='+encodeURIComponent(id);
  if((type==='post'||type==='comment'||type==='like')&&id)return 'taktak.html?post='+encodeURIComponent(id)+(type==='comment'?'#comments':'');
  if((type==='follow'||type==='friend'||type==='friend_request'||type==='profile')&&actor)return 'profile.html?id='+encodeURIComponent(actor);
  return actor?'profile.html?id='+encodeURIComponent(actor):'taktak.html';
}
function card(n){const a=n.actor||{},pic=a.avatarUrl?'<img src="'+esc(abs(a.avatarUrl))+'" alt="">':esc((a.fullName||a.username||'?').slice(0,1)),target=targetFor(n);return '<button class="home-notification-item '+(!n.readAt?'unread':'')+'" type="button" data-notification-id="'+esc(n.id)+'" data-notification-href="'+esc(target)+'"><span class="home-notification-avatar">'+pic+'</span><span class="home-notification-copy"><strong>'+esc(a.fullName||a.username||'شنو منو')+'</strong><span>'+esc(n.text||'لديك إشعار جديد')+'</span><small>'+new Date(n.createdAt).toLocaleString('ar-IQ')+'</small></span></button>'}
async function load(){try{const d=await api('/api/social/notifications');const unread=Number(d.unread||0);badge.hidden=!unread;badge.textContent=unread>99?'99+':String(unread);list.innerHTML=(d.notifications||[]).length?d.notifications.slice(0,20).map(card).join(''):'<div class="home-notification-empty">لا توجد إشعارات بعد.</div>'}catch(e){list.innerHTML='<div class="home-notification-empty">'+esc(e.message)+'</div>'}}
function setOpen(open){menu.hidden=!open;topLink.setAttribute('aria-expanded',open?'true':'false');if(open)load();}
topLink.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setOpen(menu.hidden)});
document.addEventListener('click',e=>{if(!menu.hidden&&!menu.contains(e.target)&&!topLink.contains(e.target))setOpen(false)});
menu.addEventListener('click',async e=>{const item=e.target.closest('[data-notification-id]');if(!item)return;const target=item.dataset.notificationHref||'taktak.html';try{await api('/api/social/notifications/'+item.dataset.notificationId+'/read',{method:'PATCH'})}catch(_){}setOpen(false);location.href=target});
readAll.addEventListener('click',async e=>{e.stopPropagation();try{await api('/api/social/notifications/read-all',{method:'PATCH'});await load()}catch(err){list.innerHTML='<div class="home-notification-empty">'+esc(err.message)+'</div>'}});
for(const a of document.querySelectorAll('a[href="notifications.html"]')){if(a===topLink)continue;a.href='#notifications';a.addEventListener('click',e=>{e.preventDefault();window.scrollTo({top:0,behavior:'smooth'});setOpen(true)});}
load();setInterval(load,60000);
})();
