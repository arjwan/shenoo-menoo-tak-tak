(function(){
  'use strict';

  const friendsRoot=document.querySelector('[data-talk-friends]');
  const requestsRoot=document.querySelector('[data-talk-requests]');
  const contactsBtn=document.querySelector('[data-contacts]');
  const contactsResult=document.querySelector('[data-contact-result]');
  const pageStatus=document.querySelector('[data-page-status]');

  function esc(v){return String(v||'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));}
  function setStatus(text,type){if(!pageStatus)return;pageStatus.textContent=text;pageStatus.className='page-status '+(type||'');}
  function row(user){return '<div class="friend-row"><span class="avatar">'+esc((user.fullName||'?').slice(0,1))+'</span><div class="friend-copy"><strong>'+esc(user.fullName||'مستخدم')+'</strong><small>@'+esc(user.username||'—')+'</small></div><div class="friend-actions"><a href="messages.html?user='+encodeURIComponent(user.id)+'&call=audio">☎ صوت</a><a href="messages.html?user='+encodeURIComponent(user.id)+'&call=video">▣ فيديو</a><a href="messages.html?user='+encodeURIComponent(user.id)+'">✉ شات</a><a href="game-room.html?challenge='+encodeURIComponent(user.id)+'">🎯 تحدي</a></div></div>';}

  async function loadFriends(){
    if(!friendsRoot)return;
    friendsRoot.innerHTML='<div class="empty">جارٍ تحميل الأصدقاء…</div>';
    try{
      const data=await SocialAPI.request('/api/friends');
      const items=data.friends||[];
      friendsRoot.innerHTML=items.length?items.map(row).join(''):'<div class="empty"><p>لا يوجد أصدقاء بعد.</p><a class="talk-action" href="friends.html?intent=add">➕ اكتشف أشخاصاً وأرسل طلب صداقة</a></div>';
    }catch(error){friendsRoot.innerHTML='<div class="empty">تعذر تحميل الأصدقاء: '+esc(error.message)+'</div>';}
  }

  async function loadRequests(type){
    if(!requestsRoot)return;
    requestsRoot.innerHTML='<div class="empty">جارٍ تحميل الطلبات…</div>';
    try{
      const data=await SocialAPI.request('/api/friends/requests?type='+(type==='sent'?'sent':'incoming'));
      const items=data.requests||[];
      requestsRoot.innerHTML=items.length?items.map(function(item){
        const u=item.user||item.sender||item.receiver||{};
        return '<div class="friend-row"><span class="avatar">'+esc((u.fullName||'?').slice(0,1))+'</span><div class="friend-copy"><strong>'+esc(u.fullName||'مستخدم')+'</strong><small>@'+esc(u.username||'—')+'</small></div><div class="friend-actions">'+(type==='sent'?'<button data-cancel="'+esc(item.id)+'">إلغاء</button>':'<button data-accept="'+esc(item.id)+'">قبول</button><button data-reject="'+esc(item.id)+'">رفض</button>')+'</div></div>';
      }).join(''):'<div class="empty">لا توجد طلبات في هذا القسم.</div>';
    }catch(error){requestsRoot.innerHTML='<div class="empty">تعذر تحميل الطلبات: '+esc(error.message)+'</div>';}
  }

  document.querySelectorAll('[data-request-tab]').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('[data-request-tab]').forEach(x=>x.classList.toggle('active',x===btn));
    loadRequests(btn.dataset.requestTab);
  }));

  if(requestsRoot)requestsRoot.addEventListener('click',async e=>{
    const b=e.target.closest('button');if(!b)return;
    b.disabled=true;
    try{
      if(b.dataset.accept)await SocialAPI.request('/api/friends/requests/'+b.dataset.accept+'/accept',{method:'POST'});
      if(b.dataset.reject)await SocialAPI.request('/api/friends/requests/'+b.dataset.reject+'/reject',{method:'POST'});
      if(b.dataset.cancel)await SocialAPI.request('/api/friends/requests/'+b.dataset.cancel+'/cancel',{method:'PATCH'});
      await Promise.allSettled([loadRequests(document.querySelector('[data-request-tab].active')?.dataset.requestTab||'incoming'),loadFriends()]);
    }catch(error){alert(error.message);}finally{b.disabled=false;}
  });

  if(contactsBtn)contactsBtn.addEventListener('click',async()=>{
    if(!contactsResult)return;
    if(!('contacts' in navigator)||!navigator.contacts.select){contactsResult.innerHTML='<p class="contact-note">متصفحك لا يدعم اختيار جهات الاتصال مباشرة. استخدم صفحة دعوة الأصدقاء لمشاركة رابط التسجيل.</p>';return;}
    try{
      const contacts=await navigator.contacts.select(['name','tel'],{multiple:false});
      if(!contacts.length)return;
      const c=contacts[0],name=(c.name&&c.name[0])||'جهة اتصال',tel=(c.tel&&c.tel[0])||'';
      contactsResult.innerHTML='<div class="friend-row"><div class="friend-copy"><strong>'+esc(name)+'</strong><small>'+esc(tel)+'</small></div><div class="friend-actions"><a href="tel:'+encodeURIComponent(tel)+'">☎ اتصال</a><a href="invite-friends.html">➕ دعوة لشنو منو</a></div></div>';
    }catch{contactsResult.innerHTML='<p class="contact-note">لم يتم اختيار جهة اتصال.</p>';}
  });

  async function boot(){
    if(!window.SocialAPI){setStatus('تعذر تحميل وحدة الاتصال. حدّث الصفحة مرة واحدة.','error');return;}
    setStatus('جارٍ تشغيل خدمات التواصل…','loading');
    const results=await Promise.allSettled([loadFriends(),loadRequests('incoming')]);
    const failed=results.filter(x=>x.status==='rejected').length;
    setStatus(failed?'تم تشغيل الصفحة مع تعذر بعض الخدمات.':'الخدمات الأساسية جاهزة.','success');
  }

  boot().catch(error=>setStatus('حدث خطأ أثناء تشغيل الصفحة: '+error.message,'error'));
}());
