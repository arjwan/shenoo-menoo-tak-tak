(()=>{'use strict';
const API='https://shino-mino-tak-tak.duckdns.org';
const token=localStorage.getItem('token')||sessionStorage.getItem('token')||'';
const trigger=document.querySelector('[data-home-notifications-trigger]');
const menu=document.querySelector('[data-home-notifications-menu]');
const list=document.querySelector('[data-home-notifications-list]');
const badge=document.querySelector('[data-home-notifications-badge]');
const readAll=document.querySelector('[data-home-notifications-readall]');
if(!trigger||!menu||!list)return;
const esc=v=>String(v||'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
const abs=u=>!u?'':/^https?:/i.test(u)?u:API+u;
async function api(p,o={}){o.headers=Object.assign({Authorization:'Bearer '+token,Accept:'application/json','Content-Type':'application/json'},o.headers||{});const r=await fetch(API+p,o),d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.message||'تعذر تنفيذ الطلب');return d}
function card(n){const a=n.actor||{},pic=a.avatarUrl?'<img src="'+esc(abs(a.avatarUrl))+'" alt="">':esc((a.fullName||a.username||'?').slice(0,1));return '<button class="home-notification-item '+(!n.readAt?'unread':'')+'" type="button" data-notification-id="'+esc(n.id)+'" data-notification-href="'+esc(n.href||'taktak.html')+'"><span class="home-notification-avatar">'+pic+'</span><span class="home-notification-copy"><strong>'+esc(a.fullName||a.username||'شنو منو')+'</strong><span>'+esc(n.text||'لديك إشعار جديد')+'</span><small>'+new Date(n.createdAt).toLocaleString('ar-IQ')+'</small></span></button>'}
async function load(){try{const d=await api('/api/social/notifications');const unread=Number(d.unread||0);badge.hidden=!unread;badge.textContent=unread>99?'99+':String(unread);list.innerHTML=(d.notifications||[]).length?d.notifications.slice(0,20).map(card).join(''):'<div class="home-notification-empty">لا توجد إشعارات بعد.</div>'}catch(e){list.innerHTML='<div class="home-notification-empty">'+esc(e.message)+'</div>'}}
function setOpen(open){menu.hidden=!open;trigger.setAttribute('aria-expanded',open?'true':'false');if(open)load();}
trigger.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setOpen(menu.hidden)});
document.addEventListener('click',e=>{if(!menu.hidden&&!menu.contains(e.target)&&e.target!==trigger)setOpen(false)});
menu.addEventListener('click',async e=>{const item=e.target.closest('[data-notification-id]');if(!item)return;try{await api('/api/social/notifications/'+item.dataset.notificationId+'/read',{method:'PATCH'})}catch(_){}location.href=item.dataset.notificationHref||'taktak.html'});
readAll?.addEventListener('click',async()=>{try{await api('/api/social/notifications/read-all',{method:'PATCH'});await load()}catch(e){list.innerHTML='<div class="home-notification-empty">'+esc(e.message)+'</div>'}});
load();setInterval(load,60000);
})();
