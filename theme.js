(function(){
  'use strict';
  var KEY='shno-theme';
  var LEGACY_KEY='taktak-theme';
  var root=document.documentElement;
  var saved='';
  try{
    saved=localStorage.getItem(KEY)||localStorage.getItem(LEGACY_KEY)||'';
  }catch(e){}
  var theme=saved==='light'?'light':'dark';

  function persist(next){
    next=next==='light'?'light':'dark';
    root.dataset.theme=next;
    if(document.body)document.body.classList.toggle('light',next==='light');
    try{
      localStorage.setItem(KEY,next);
      localStorage.setItem(LEGACY_KEY,next);
    }catch(e){}
    document.querySelectorAll('.theme-toggle-global,#theme-toggle').forEach(updateButton);
  }

  persist(theme);

  var style=document.createElement('style');
  style.id='shno-global-theme';
  style.textContent='\
:root{color-scheme:dark}\
html[data-theme="dark"]{color-scheme:dark;--bg:#070910!important;--bg-soft:#0d1220!important;--panel:#101522!important;--panel2:#151b2b!important;--card:#101522!important;--card2:#151b2b!important;--text:#f7f8fb!important;--muted:#8f98aa!important;--line:rgba(255,255,255,.08)!important;--social-card:#101522!important;--social-line:rgba(255,255,255,.08)!important;--social-muted:#8f98aa!important}\
html[data-theme="dark"] body{background:radial-gradient(circle at 50% -20%,rgba(74,94,255,.09),transparent 32%),#070910!important;color:#f7f8fb!important}\
html[data-theme="dark"] .home-top,html[data-theme="dark"] .site-header{background:rgba(7,9,16,.92)!important;border-color:rgba(255,255,255,.08)!important}\
html[data-theme="dark"] .home-brand,html[data-theme="dark"] .brand,html[data-theme="dark"] h1,html[data-theme="dark"] h2,html[data-theme="dark"] h3,html[data-theme="dark"] strong{color:#f7f8fb}\
html[data-theme="dark"] .side-card,html[data-theme="dark"] .composer,html[data-theme="dark"] .post-card,html[data-theme="dark"] .quick-call,html[data-theme="dark"] .social-card,html[data-theme="dark"] .profile-section,html[data-theme="dark"] .chat-window,html[data-theme="dark"] .talk-card,html[data-theme="dark"] .talk-hero{background-color:#101522!important;border-color:rgba(255,255,255,.08)!important;color:#f7f8fb!important}\
html[data-theme="dark"] input,html[data-theme="dark"] textarea,html[data-theme="dark"] select{background:#151b2b!important;color:#f7f8fb!important;border-color:rgba(255,255,255,.10)!important}\
html[data-theme="light"]{color-scheme:light;--bg:#f4f6fb!important;--bg-soft:#ffffff!important;--panel:#ffffff!important;--panel2:#f7f8fc!important;--card:#ffffffee!important;--card2:#f7f8fc!important;--text:#161927!important;--muted:#667085!important;--line:rgba(18,24,40,.12)!important;--social-card:rgba(255,255,255,.92)!important;--social-line:rgba(18,24,40,.12)!important;--social-muted:#667085!important}\
html[data-theme="light"] body{background:radial-gradient(circle at 85% 0,rgba(124,92,255,.10),transparent 30%),radial-gradient(circle at 12% 35%,rgba(39,216,196,.08),transparent 28%),#f4f6fb!important;color:#161927!important}\
html[data-theme="light"] .home-top,html[data-theme="light"] .site-header{background:rgba(255,255,255,.90)!important;border-color:rgba(18,24,40,.10)!important}\
html[data-theme="light"] .home-brand,html[data-theme="light"] .brand,html[data-theme="light"] h1,html[data-theme="light"] h2,html[data-theme="light"] h3,html[data-theme="light"] strong{color:#161927}\
html[data-theme="light"] .side-card,html[data-theme="light"] .composer,html[data-theme="light"] .post-card,html[data-theme="light"] .quick-call,html[data-theme="light"] .social-card,html[data-theme="light"] .profile-section,html[data-theme="light"] .chat-window,html[data-theme="light"] .talk-card{background:rgba(255,255,255,.94)!important;border-color:rgba(18,24,40,.10)!important;color:#161927!important}\
html[data-theme="light"] input,html[data-theme="light"] textarea,html[data-theme="light"] select{background:#fff!important;color:#161927!important;border-color:rgba(18,24,40,.14)!important}\
html[data-theme="light"] .tool-btn,html[data-theme="light"] .icon-button,html[data-theme="light"] .small-button,html[data-theme="light"] .top-actions a,html[data-theme="light"] .top-actions button{background:#f7f8fc!important;color:#252a3d!important;border-color:rgba(18,24,40,.12)!important}\
html[data-theme="light"] .publish,html[data-theme="light"] .icon-button.primary,html[data-theme="light"] .small-button.primary{color:#fff!important}\
html[data-theme="light"] .post-media img,html[data-theme="light"] .post-media video{background:#eef1f6!important}\
.theme-toggle-global{position:fixed;left:18px;bottom:18px;z-index:120;width:46px;height:46px;border-radius:15px;border:1px solid rgba(255,255,255,.14);background:rgba(17,23,40,.94);color:#fff;box-shadow:0 12px 30px rgba(0,0,0,.22);cursor:pointer;font-size:20px;display:grid;place-items:center;backdrop-filter:blur(12px)}\
html[data-theme="light"] .theme-toggle-global{background:#fff;color:#252a3d;border-color:rgba(18,24,40,.14)}\
@media(max-width:720px){.theme-toggle-global{left:10px;bottom:72px;width:42px;height:42px;border-radius:13px}}';
  document.head.appendChild(style);

  function updateButton(btn){
    if(!btn)return;
    var light=root.dataset.theme==='light';
    btn.textContent=light?'☾':'☀';
    btn.title=light?'الوضع الليلي':'الوضع النهاري';
    btn.setAttribute('aria-label',btn.title);
  }

  function mount(){
    var nativeBtn=document.getElementById('theme-toggle');
    if(nativeBtn)updateButton(nativeBtn);
    if(!document.querySelector('.theme-toggle-global')){
      var btn=document.createElement('button');
      btn.type='button';
      btn.className='theme-toggle-global';
      updateButton(btn);
      btn.addEventListener('click',function(){
        persist(root.dataset.theme==='light'?'dark':'light');
        window.dispatchEvent(new CustomEvent('shno:themechange',{detail:{theme:root.dataset.theme}}));
      });
      document.body.appendChild(btn);
    }

    var observer=new MutationObserver(function(){
      var current=root.dataset.theme==='light'?'light':'dark';
      try{
        if(localStorage.getItem(KEY)!==current||localStorage.getItem(LEGACY_KEY)!==current){
          localStorage.setItem(KEY,current);
          localStorage.setItem(LEGACY_KEY,current);
        }
      }catch(e){}
      if(document.body)document.body.classList.toggle('light',current==='light');
      document.querySelectorAll('.theme-toggle-global,#theme-toggle').forEach(updateButton);
    });
    observer.observe(root,{attributes:true,attributeFilter:['data-theme']});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
}());
