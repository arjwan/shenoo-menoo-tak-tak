(function(){
  'use strict';

  const API='https://shino-mino-tak-tak.duckdns.org';
  const token=localStorage.getItem('token')||sessionStorage.getItem('token')||'';
  const profileId=new URLSearchParams(location.search).get('id')||'me';

  function esc(v){return String(v||'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));}
  function absolute(url){if(!url)return'';return /^https?:\/\//i.test(url)?url:API+url;}
  function when(v){try{return new Intl.DateTimeFormat('ar-IQ',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v));}catch{return'';}}
  function media(p){
    if(!p.media||!p.media.length)return'';
    const m=p.media[0],src=esc(absolute(m.url)),mime=String(m.mimeType||''),type=String(m.type||'');
    if(type==='video'||mime.startsWith('video/'))return '<div class="profile-post-media"><video controls playsinline preload="metadata" src="'+src+'"></video></div>';
    if(type==='audio'||mime.startsWith('audio/'))return '<div class="profile-post-media"><audio controls preload="metadata" src="'+src+'"></audio></div>';
    return '<div class="profile-post-media"><img loading="lazy" src="'+src+'" alt=""></div>';
  }
  function card(p){
    return '<article class="profile-post-card">'+
      '<div class="profile-post-time">'+esc(when(p.createdAt))+'</div>'+
      (p.text?'<div class="profile-post-text">'+esc(p.text)+'</div>':'')+
      media(p)+
      '<div class="profile-post-stats"><span>'+Number(p.likesCount||0)+' إعجاب</span><span>'+Number(p.commentsCount||0)+' تعليق</span></div>'+
    '</article>';
  }
  async function request(path){
    const r=await fetch(API+path,{headers:{Authorization:'Bearer '+token,Accept:'application/json'}});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.message||'تعذر تحميل المنشورات');
    return d;
  }
  async function load(){
    const root=document.querySelector('[data-profile-root]');
    if(!root)return;
    let section=document.querySelector('[data-profile-posts-section]');
    if(!section){
      section=document.createElement('section');
      section.className='profile-posts-section';
      section.setAttribute('data-profile-posts-section','');
      section.innerHTML='<div class="profile-posts-heading"><h2>المنشورات</h2><small>تبقى محفوظة في الصفحة الشخصية</small></div><div class="profile-posts-list" data-profile-posts-list><div class="profile-posts-empty">جارٍ تحميل المنشورات...</div></div>';
      root.appendChild(section);
    }
    const list=section.querySelector('[data-profile-posts-list]');
    try{
      const d=await request('/api/posts/user/'+encodeURIComponent(profileId));
      const posts=d.posts||[];
      list.innerHTML=posts.length?posts.map(card).join(''):'<div class="profile-posts-empty">لا توجد منشورات بعد.</div>';
      const count=document.querySelector('[data-posts-count]');
      if(count)count.textContent=Number(d.total||posts.length);
    }catch(e){
      list.innerHTML='<div class="profile-posts-empty">'+esc(e.message)+'</div>';
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});
  else load();
})();
