(function(){
  'use strict';
  const API = 'https://shino-mino-tak-tak.duckdns.org';
  const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  const feed = document.querySelector('[data-feed]');
  const form = document.querySelector('[data-composer]');
  const fileInput = document.querySelector('[data-media]');
  const textInput = document.querySelector('[data-post-text]');
  const visibility = document.querySelector('[data-visibility]');
  const meBox = document.querySelector('[data-me-avatar]');
  const callList = document.querySelector('[data-call-friends]');

  function headers(extra){ return Object.assign({Authorization:'Bearer '+token,Accept:'application/json'}, extra||{}); }
  async function json(path, options){
    const response = await fetch(API+path, Object.assign({}, options||{}, {headers: headers((options||{}).headers)}));
    const data = await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.message || 'تعذر تنفيذ الطلب');
    return data;
  }
  function esc(value){ return String(value||'').replace(/[&<>"']/g, s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])); }
  function avatar(user){ return user && user.avatarUrl ? '<span class="avatar"><img src="'+esc(API+user.avatarUrl)+'" alt=""></span>' : '<span class="avatar">'+esc((user&&user.fullName||'?').slice(0,1))+'</span>'; }
  function time(value){ try{return new Intl.DateTimeFormat('ar-IQ',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}catch{return '';} }
  function media(post){ if(!post.media || !post.media.length) return ''; const m=post.media[0]; const src=esc(API+m.url); return m.type==='video' ? '<div class="post-media"><video controls preload="metadata" src="'+src+'"></video></div>' : '<div class="post-media"><img loading="lazy" src="'+src+'" alt="صورة منشور"></div>'; }
  function card(post){
    return '<article class="post-card" data-post-id="'+esc(post.id)+'">'+
      '<div class="post-head">'+avatar(post.author)+'<div class="post-meta"><a href="profile.html?id='+esc(post.author.id)+'"><strong>'+esc(post.author.fullName)+'</strong></a><small>@'+esc(post.author.username)+' · '+esc(time(post.createdAt))+'</small></div>'+(post.type==='ad'?'<span class="ad-badge">إعلان ممول</span>':'')+'</div>'+
      (post.text?'<div class="post-text">'+esc(post.text)+'</div>':'')+media(post)+
      '<div class="post-stats"><span data-likes-count>'+Number(post.likesCount||0)+' إعجاب</span><span data-comments-count>'+Number(post.commentsCount||0)+' تعليق</span></div>'+
      '<div class="post-actions"><button type="button" data-action="like" class="'+(post.liked?'is-active':'')+'">♡ إعجاب</button><button type="button" data-action="comments">💬 تعليق</button><button type="button" data-action="message" data-user="'+esc(post.author.id)+'">✉ مراسلة</button></div>'+
      '<div class="comments" hidden data-comments><div data-comments-list></div><form class="comment-form" data-comment-form><input name="text" maxlength="2000" placeholder="اكتب تعليقاً..."><button>إرسال</button></form></div></article>';
  }
  async function loadFeed(){
    try{ const data=await json('/api/posts'); feed.innerHTML=data.posts&&data.posts.length?data.posts.map(card).join(''):'<div class="post-card empty">لا توجد منشورات بعد. كن أول من ينشر.</div>'; }
    catch(error){ feed.innerHTML='<div class="post-card empty">'+esc(error.message)+'</div>'; }
  }
  async function loadMe(){ try{ const data=await json('/api/users/me'); const u=data.user||{}; if(meBox) meBox.innerHTML = u.profile&&u.profile.avatarUrl?'<img src="'+esc(API+u.profile.avatarUrl)+'" alt="">':esc((u.displayName||u.fullName||'?').slice(0,1)); }catch{} }
  async function loadCalls(){
    if(!callList) return;
    try{ const data=await json('/api/friends'); const friends=data.friends||[]; callList.innerHTML=friends.length?friends.slice(0,8).map(f=>'<div class="friend-call">'+avatar(f)+'<span><strong>'+esc(f.fullName)+'</strong><small style="display:block;color:#9299ad">@'+esc(f.username)+'</small></span><span class="call-links"><a title="اتصال صوتي" href="messages.html?user='+esc(f.id)+'&call=audio">☎</a><a title="اتصال فيديو" href="messages.html?user='+esc(f.id)+'&call=video">▣</a></span></div>').join(''):'<div class="empty">أضف أصدقاء لتظهر اختصارات الاتصال هنا.</div>'; }
    catch(error){ callList.innerHTML='<div class="empty">تعذر تحميل الأصدقاء.</div>'; }
  }
  form && form.addEventListener('submit', async function(e){
    e.preventDefault(); const btn=form.querySelector('button[type=submit]'); btn.disabled=true;
    try{ const body=new FormData(); body.append('text', textInput.value.trim()); body.append('visibility', visibility.value); if(fileInput.files[0]) body.append('media', fileInput.files[0]);
      const response=await fetch(API+'/api/posts',{method:'POST',headers:{Authorization:'Bearer '+token,Accept:'application/json'},body}); const data=await response.json().catch(()=>({})); if(!response.ok) throw new Error(data.message||'تعذر النشر');
      textInput.value=''; fileInput.value=''; feed.insertAdjacentHTML('afterbegin',card(data.post));
    }catch(error){ alert(error.message); } finally{ btn.disabled=false; }
  });
  feed && feed.addEventListener('click', async function(e){
    const postEl=e.target.closest('[data-post-id]'); if(!postEl)return; const id=postEl.dataset.postId; const action=e.target.closest('[data-action]');
    if(action){
      if(action.dataset.action==='like'){ try{const data=await json('/api/posts/'+id+'/like',{method:'POST'}); action.classList.toggle('is-active',data.liked); postEl.querySelector('[data-likes-count]').textContent=data.likesCount+' إعجاب';}catch(error){alert(error.message);} }
      if(action.dataset.action==='comments'){ const box=postEl.querySelector('[data-comments]'); box.hidden=!box.hidden; if(!box.hidden&&!box.dataset.loaded){ try{const data=await json('/api/posts/'+id+'/comments'); box.querySelector('[data-comments-list]').innerHTML=(data.comments||[]).map(c=>'<div class="comment">'+avatar(c.author)+'<div class="comment-body"><strong>'+esc(c.author.fullName)+'</strong><p>'+esc(c.text)+'</p></div></div>').join(''); box.dataset.loaded='1';}catch{} } }
      if(action.dataset.action==='message') location.href='messages.html?user='+encodeURIComponent(action.dataset.user);
    }
  });
  feed && feed.addEventListener('submit', async function(e){
    const cf=e.target.closest('[data-comment-form]'); if(!cf)return; e.preventDefault(); const postEl=cf.closest('[data-post-id]'); const id=postEl.dataset.postId; const input=cf.elements.text; if(!input.value.trim())return;
    try{ const data=await json('/api/posts/'+id+'/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:input.value.trim()})}); postEl.querySelector('[data-comments-list]').insertAdjacentHTML('beforeend','<div class="comment">'+avatar(data.comment.author)+'<div class="comment-body"><strong>'+esc(data.comment.author.fullName)+'</strong><p>'+esc(data.comment.text)+'</p></div></div>'); postEl.querySelector('[data-comments-count]').textContent=data.commentsCount+' تعليق'; input.value=''; }catch(error){alert(error.message);}
  });
  document.querySelector('[data-photo-btn]')?.addEventListener('click',()=>fileInput.click());
  document.querySelector('[data-video-btn]')?.addEventListener('click',()=>fileInput.click());
  document.getElementById('logout')?.addEventListener('click',()=>{localStorage.removeItem('token');localStorage.removeItem('user');sessionStorage.removeItem('token');sessionStorage.removeItem('user');location.replace('signin.html');});
  loadMe(); loadCalls(); loadFeed();
}());
