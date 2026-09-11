(function(){'use strict';
const API='https://shino-mino-tak-tak.duckdns.org';
const token=localStorage.getItem('token')||sessionStorage.getItem('token')||'';
const desktop=document.querySelector('.paid-ads');
const rightSide=document.querySelector('.right-side');
const feed=document.querySelector('.feed');
if(!desktop||!feed)return;
const style=document.createElement('link');style.rel='stylesheet';style.href='taktak-live-ads.css?v=20260911-1';document.head.appendChild(style);
const fallback=[
 {adTitle:'اعرض إعلانك مجانًا',text:'أنشئ إعلانك الآن، وبعد موافقة المطور سيظهر هنا وفي المنشورات.',adCategory:'إعلانات شنو منو',href:'create-ad.html',icon:'📣'},
 {adTitle:'وصل تجارتك إلى كل العراق',text:'أضف منتجاتك وخدماتك ومعلومات التواصل بصورة واضحة.',adCategory:'مول العراق',href:'mall.html',icon:'🛍'},
 {adTitle:'مساحتك جاهزة',text:'الإعلان المقبول يتناوب تلقائيًا في الصفحة الرئيسية.',adCategory:'مساحة إعلانية',href:'ads.html',icon:'✨'}
];
let ads=[],step=0,timer=null;
function esc(v){return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function abs(v){return !v?'':/^https?:/i.test(v)?v:API+v}
function shell(extra=''){return '<div class="live-ads-head"><h3>📢 إعلانات شنو منو</h3><a href="ads.html">عرض الكل</a></div><div class="live-ad-list">'+[0,1,2].map(i=>'<article class="live-ad-slot '+(i?'compact':'')+'" data-live-ad-slot="'+i+'"></article>').join('')+'</div><div class="live-ad-dots" data-live-ad-dots></div>'+extra}
function card(ad){const m=ad.media&&ad.media[0],href=ad.href||('ads.html?id='+encodeURIComponent(ad.id||''));let media='';if(m&&m.url){const src=esc(abs(m.url));media='<span class="live-ad-media">'+(m.type==='video'?'<video muted playsinline preload="metadata" src="'+src+'"></video>':'<img loading="lazy" src="'+src+'" alt="">')+'</span>'}else media='<span class="live-ad-media" style="display:grid;place-items:center;font-size:54px">'+esc(ad.icon||'📣')+'</span>';return '<a class="live-ad-card" href="'+esc(href)+'">'+media+'<span class="live-ad-shade"></span><span class="live-ad-copy"><small>إعلان معتمد · '+esc(ad.adCategory||'عام')+'</small><strong>'+esc(ad.adTitle||'إعلان')+'</strong>'+(ad.text?'<p>'+esc(ad.text)+'</p>':'')+(ad.adContact?'<span class="live-ad-contact">للتواصل: '+esc(ad.adContact)+'</span>':'')+'</span></a>'}
function render(root){const list=ads.length?ads:fallback;root.querySelectorAll('[data-live-ad-slot]').forEach((slot,i)=>{slot.innerHTML=card(list[(step+i)%list.length]);requestAnimationFrame(()=>slot.firstElementChild?.classList.add('is-visible'))});const dots=root.querySelector('[data-live-ad-dots]');if(dots)dots.innerHTML=list.map((_,i)=>'<i class="'+(i===step%list.length?'active':'')+'"></i>').join('')}
function renderAll(){render(desktop);const mobile=document.querySelector('.mobile-live-ads');if(mobile)render(mobile)}
function advance(){const list=ads.length?ads:fallback;step=(step+1)%list.length;renderAll()}
desktop.classList.add('live-ads');desktop.innerHTML=shell();
const mobile=document.createElement('section');mobile.className='mobile-live-ads';mobile.innerHTML=shell();document.querySelector('.profile-cover')?.after(mobile);
if(rightSide){const dock=rightSide.querySelector('[data-calls-dock]');const fab=document.createElement('button');fab.type='button';fab.className='desktop-call-fab';fab.innerHTML='☎ الاتصال والأصدقاء';rightSide.appendChild(fab);if(dock){const close=document.createElement('button');close.type='button';close.className='calls-popup-close';close.textContent='×';close.setAttribute('aria-label','إغلاق الاتصال');dock.querySelector('.calls-dock-head')?.appendChild(close);fab.addEventListener('click',()=>dock.classList.toggle('is-popup-open'));close.addEventListener('click',()=>dock.classList.remove('is-popup-open'));document.addEventListener('click',event=>{if(dock.classList.contains('is-popup-open')&&!dock.contains(event.target)&&event.target!==fab)dock.classList.remove('is-popup-open')})}}
async function load(){try{const r=await fetch(API+'/api/posts/ads',{headers:{Authorization:'Bearer '+token,Accept:'application/json'}}),d=await r.json();if(r.ok&&Array.isArray(d.ads))ads=d.ads}catch(_){}renderAll();clearInterval(timer);timer=setInterval(advance,5500)}
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInterval(timer);timer=null}else if(!timer){timer=setInterval(advance,5500)}});
load();
})();
