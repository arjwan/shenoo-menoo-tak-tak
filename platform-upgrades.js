(function(){'use strict';
const path=location.pathname.split('/').pop()||'taktak.html';
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
function text(el,v){if(el)el.textContent=v}
function normalizeHome(){if(path!=='taktak.html'&&path!=='')return;
 const brand=q('.home-brand'); if(brand) brand.textContent='شنو منو تك تك — بنكهة عراقية';
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
document.addEventListener('DOMContentLoaded',()=>{normalizeHome();normalizeMessages();storySharing();reelSharing()});
})();
