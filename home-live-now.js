(function(){'use strict';
if(!/\/(?:taktak\.html)?$/i.test(location.pathname))return;
function inject(){if(document.querySelector('[data-home-live-now]'))return;const anchor=document.querySelector('.home-quick-panel')||document.querySelector('.people-strip')||document.querySelector('.feed');if(!anchor)return;const sec=document.createElement('section');sec.className='home-live-now compact-panel';sec.setAttribute('data-home-live-now','1');sec.innerHTML='<div class="home-live-now-head"><div><strong>🔴 البث المباشر الآن</strong><small data-home-live-count>0 بث مباشر</small></div><div><a href="live-create.html">＋ إنشاء بث</a> · <a href="challenges.html">عرض البثوث</a></div></div><div class="home-live-stage"><div class="home-live-empty" data-home-live-empty><b>📡</b><strong>لا يوجد بث مباشر الآن</strong><span>ابدأ بثًا مباشرًا بدون إنشاء غرفة وحدد من يستطيع مشاهدته.</span><a href="live-create.html">🔴 إنشاء بث مباشر</a></div><div class="home-live-cards" data-home-live-list hidden></div></div>';
anchor.insertAdjacentElement('afterend',sec);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject,{once:true});else inject();
})();
