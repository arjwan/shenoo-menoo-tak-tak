(function(){'use strict';
const path=location.pathname.split('/').pop()||'taktak.html';
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
function text(el,v){if(el&&el.textContent!==v)el.textContent=v}
function normalizeHome(){if(path!=='taktak.html'&&path!=='')return;
 const brand=q('.home-brand'); if(brand) brand.textContent='شنو منو تك تك — بنكهة عراقية 🇮🇶';
 const cover=q('[data-cover-state]'); if(cover) cover.textContent='لنا وللعرب ولكل العالم — ساهم، انشر، أضف أصدقاء، واستكشف عالمًا جديدًا من التواصل.';
 const removeHref=['calls.html','friends.html','friend-qr.html'];
 qa('.top-actions a,.left-side a,.quick-apps a').forEach(a=>{const href=(a.getAttribute('href')||'').split('?')[0];if(removeHref.includes(href))a.remove();});
 const quick=q('.quick-apps');if(quick&&!quick.querySelector('[data-messages-hub]')){const a=document.createElement('a');a.className='quick-app';a.href='messages.html';a.dataset.messagesHub='1';a.innerHTML='<b>💬</b><span>شنو منو مراسلات</span>';quick.appendChild(a)}
 const left=q('.left-side');if(left&&!left.querySelector('[data-messages-hub]')){const a=document.createElement('a');a.href='messages.html';a.dataset.messagesHub='1';a.textContent='💬 شنو منو مراسلات';left.appendChild(a)}
 const top=q('.top-actions');if(top&&!top.querySelector('[data-messages-hub]')){const a=document.createElement('a');a.href='messages.html';a.dataset.messagesHub='1';a.title='شنو منو مراسلات';a.textContent='💬';top.appendChild(a)}
}
function normalizeMessages(){if(path!=='messages.html'&&path!=='friends.html')return;document.title='شنو منو مراسلات | شنو منو تك تك';qa('h1,h2,.page-title,.brand-title').forEach(el=>{if(/محادث|رسائل|أصدقاء/.test(el.textContent||''))el.textContent='شنو منو مراسلات'});}
function shareUrl(kind,id){const u=new URL(location.origin+'/'+(kind==='story'?'stories.html':'reels.html'));if(id)u.searchParams.set('id',id);u.searchParams.set('shared','shno-meno');return u.toString()}
async function share(kind,id){const url=shareUrl(kind,id),title=kind==='story'?'قصة على شنو منو تك تك':'ريلز على شنو منو تك تك';if(navigator.share){try{await navigator.share({title,text:'شاهد هذا المحتوى على شنو منو تك تك',url});return}catch(e){if(e&&e.name==='AbortError')return}}const choice=confirm('اضغط موافق لمشاركة الرابط خارجياً، أو إلغاء لفتحه داخل شنو منو مراسلات.');if(choice){try{await navigator.clipboard.writeText(url);alert('تم نسخ رابط شنو منو تك تك للمشاركة.')}catch{prompt('انسخ رابط المشاركة:',url)}}else{location.href='messages.html?share='+encodeURIComponent(url)+'&type='+kind}}
function storySharing(){if(path!=='stories.html')return;const install=()=>qa('.story-card[data-id]').forEach(card=>{if(card.querySelector('.story-share-button'))return;const b=document.createElement('button');b.type='button';b.className='story-share-button';b.textContent='↗ مشاركة';b.onclick=e=>{e.preventDefault();e.stopPropagation();share('story',card.dataset.id)};card.appendChild(b)});install();new MutationObserver(install).observe(document.body,{childList:true,subtree:true});}
function reelSharing(){if(path!=='reels.html')return;document.addEventListener('click',e=>{const b=e.target.closest('[data-share-reel]');if(!b)return;e.preventDefault();share('reel',b.dataset.shareReel||b.closest('[data-id]')?.dataset.id||'')});}

/* Presence is driven by the live Socket.IO room state. Keep DOM writes idempotent
   so the MutationObserver cannot trigger an endless repaint loop. */
const livePresence=new Map();
let repaintScheduled=false;
function cssEscape(v){return window.CSS&&typeof CSS.escape==='function'?CSS.escape(v):String(v).replace(/(["\\])/g,'\\$1')}
function idFromCallCard(card){
 const a=card&&card.querySelector('a[href*="messages.html?user="]');
 if(!a)return'';
 try{return new URL(a.href,location.href).searchParams.get('user')||''}catch(_){return''}
}
function paintPresence(userId,online){
 userId=String(userId||''); if(!userId)return;
 online=!!online;
 livePresence.set(userId,online);
 const label=online?'متصل الآن':'غير متصل';
 qa('[data-person-id="'+cssEscape(userId)+'"]').forEach(row=>{
   const dot=row.querySelector('.presence'); if(dot&&dot.classList.contains('online')!==online)dot.classList.toggle('online',online);
   const meta=row.querySelector('.social-list-meta small'); if(meta&&meta.textContent!==label)meta.textContent=label;
 });
 qa('.call-contact').forEach(card=>{
   if(String(idFromCallCard(card))!==userId)return;
   const dot=card.querySelector('.presence'); if(dot&&dot.classList.contains('online')!==online)dot.classList.toggle('online',online);
   const small=card.querySelector('.call-contact-copy small');
   if(small&&/@/.test(small.textContent||'')){
     const first=(small.textContent||'').split(' · ')[0];
     const next=first+' · '+(online?'متصل الآن':'صديق على شنو منو');
     if(small.textContent!==next)small.textContent=next;
   }
 });
 qa('[data-chat-presence][data-user-id="'+cssEscape(userId)+'"]').forEach(el=>{if(el.textContent!==label)el.textContent=label});
}
function repaintKnown(){livePresence.forEach((online,id)=>paintPresence(id,online));}
function scheduleRepaint(){
 if(repaintScheduled)return;
 repaintScheduled=true;
 requestAnimationFrame(function(){repaintScheduled=false;repaintKnown()});
}
function setupPresenceUi(){
 window.addEventListener('shno:presence:state',e=>{
   const ids=((e.detail&&e.detail.userIds)||[]).map(String),set=new Set(ids);
   qa('[data-person-id]').forEach(row=>paintPresence(row.dataset.personId,set.has(String(row.dataset.personId))));
   qa('.call-contact').forEach(card=>{const id=idFromCallCard(card);if(id)paintPresence(id,set.has(String(id)))});
   ids.forEach(id=>paintPresence(id,true));
 });
 window.addEventListener('shno:presence:online',e=>paintPresence(e.detail&&e.detail.userId,true));
 window.addEventListener('shno:presence:offline',e=>paintPresence(e.detail&&e.detail.userId,false));
 new MutationObserver(scheduleRepaint).observe(document.body,{childList:true,subtree:true});
}

document.addEventListener('DOMContentLoaded',()=>{normalizeHome();normalizeMessages();storySharing();reelSharing();setupPresenceUi()});
})();
