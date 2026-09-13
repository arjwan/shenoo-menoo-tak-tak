(function(){'use strict';
function ensureRooms(){
  const sidebar=document.querySelector('.left-side.side-card,.left-side');
  if(sidebar){
    const old=Array.from(sidebar.querySelectorAll('a')).find(a=>((a.textContent||'').includes('المحادثات الخاصة')));
    if(old){old.href='groups.html';old.textContent='🏠 الغرف العامة والخاصة';old.classList.add('rooms-home-link');}
    if(!sidebar.querySelector('a[href="groups.html"]')){
      const link=document.createElement('a');link.href='groups.html';link.className='rooms-home-link';link.textContent='🏠 الغرف العامة والخاصة';
      const challenge=sidebar.querySelector('a[href="challenges.html"]');
      if(challenge)sidebar.insertBefore(link,challenge);else sidebar.appendChild(link);
    }
  }
  const quick=document.querySelector('.quick-apps');
  if(quick&&!quick.querySelector('a[href="groups.html"]')){
    const a=document.createElement('a');a.className='quick-app rooms-quick-app';a.href='groups.html';a.innerHTML='<b>🏠</b><span>الغرف</span>';
    const messages=quick.querySelector('a[href="messages.html"]');
    if(messages)quick.insertBefore(a,messages);else quick.appendChild(a);
  }
}
function run(){ensureRooms();setTimeout(ensureRooms,300);setTimeout(ensureRooms,1200);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
new MutationObserver(()=>ensureRooms()).observe(document.documentElement,{childList:true,subtree:true});
})();
