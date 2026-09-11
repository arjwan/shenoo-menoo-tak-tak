(function(){'use strict';
const links=[['👤','صفحتي الشخصية','profile.html'],['👥','الأصدقاء والطلبات','friends.html'],['💬','الرسائل الخاصة','messages.html'],['☎','المكالمات','calls.html'],['🛠','الخدمات','services.html'],['🚕','النقل والحمل','transport.html'],['🛍','مول العراق','mall.html'],['🤝','الاستشارات','consultations.html'],['🏫','شنو منو مدرسة','school.html'],['📣','الإعلانات','ads.html'],['➕','إنشاء إعلان','create-ad.html'],['🏆','التحديات والبث','challenges.html'],['☕','كهوة عزاوي','game-room.html'],['🎙','تعال نسولف','taal-nsolf.html'],['🔮','ركن أم عباس','umm-abbas.html'],['☪','الصفحة الإسلامية','islamic.html'],['✨','صديقي الذكي','#smart-friend'],['⚙','الخصوصية والإعدادات','settings.html']];
const host=document.createElement('div');host.innerHTML='<div class="mobile-services-backdrop" data-mobile-services-backdrop hidden></div><aside class="mobile-services-drawer" data-mobile-services-drawer aria-hidden="true"><header><div><strong>كل شنو منو</strong><small>اسحب اللوحة بالعكس للإغلاق</small></div><button type="button" data-mobile-services-close aria-label="إغلاق">×</button></header><nav>'+links.map(x=>'<a href="'+x[2]+'"><b>'+x[0]+'</b><span>'+x[1]+'</span></a>').join('')+'</nav></aside>';
document.body.append(...host.children);
const drawer=document.querySelector('[data-mobile-services-drawer]');
const backdrop=document.querySelector('[data-mobile-services-backdrop]');
const bar=document.querySelector('.mobile-bar');if(bar){const last=bar.lastElementChild;if(last)last.outerHTML='<button type="button" data-mobile-services-open><b>☰</b>الكل</button>'}
let startX=0,startY=0,tracking=false;
function openDrawer(){drawer.classList.add('is-open');drawer.setAttribute('aria-hidden','false');backdrop.hidden=false;document.body.classList.add('mobile-menu-open')}
function closeDrawer(){drawer.classList.remove('is-open');drawer.setAttribute('aria-hidden','true');backdrop.hidden=true;document.body.classList.remove('mobile-menu-open')}
document.querySelector('[data-mobile-services-open]')?.addEventListener('click',openDrawer);
document.querySelector('[data-mobile-services-close]')?.addEventListener('click',closeDrawer);
backdrop.addEventListener('click',closeDrawer);
document.addEventListener('touchstart',event=>{if(event.touches.length!==1)return;const t=event.touches[0];startX=t.clientX;startY=t.clientY;tracking=true},{passive:true});
document.addEventListener('touchend',event=>{if(!tracking||event.changedTouches.length!==1)return;tracking=false;const t=event.changedTouches[0],dx=t.clientX-startX,dy=t.clientY-startY;if(Math.abs(dx)<70||Math.abs(dx)<Math.abs(dy)*1.25)return;if(drawer.classList.contains('is-open')){if(dx>0)closeDrawer()}else if(dx<0)openDrawer()},{passive:true});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeDrawer()});
drawer.querySelector('a[href="#smart-friend"]')?.addEventListener('click',event=>{event.preventDefault();closeDrawer();document.querySelector('[data-sf-launcher]')?.click()});
})();
