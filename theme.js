(function(){
  'use strict';
  var KEY='shno-theme';
  var LEGACY_KEY='taktak-theme';
  var root=document.documentElement;
  var saved='';
  try{saved=localStorage.getItem(KEY)||localStorage.getItem(LEGACY_KEY)||'';}catch(e){}
  var theme=saved==='light'?'light':'dark';

  /* Load the final override from the theme runtime itself so every page using
     theme.js gets the same fixes, even when auth-guard is not responsible for it. */
  if(!document.querySelector('link[data-theme-light-fixes]')){
    var fixes=document.createElement('link');
    fixes.rel='stylesheet';
    fixes.href='theme-light-fixes.css?v=20260913-4';
    fixes.setAttribute('data-theme-light-fixes','1');
    document.head.appendChild(fixes);
  }

  function persist(next){
    next=next==='light'?'light':'dark';
    root.dataset.theme=next;
    if(document.body)document.body.classList.toggle('light',next==='light');
    try{localStorage.setItem(KEY,next);localStorage.setItem(LEGACY_KEY,next);}catch(e){}
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
html[data-theme="dark"] input,html[data-theme="dark"] textarea,html[data-theme="dark"] select{background:#151b2b!important;color:#f7f8fb!important;border-color:rgba(255,255,255,.10)!important}\
html[data-theme="light"]{color-scheme:light;--bg:#e9edf2!important;--bg-soft:#f4f6f8!important;--panel:#f4f6f8!important;--panel2:#edf1f5!important;--card:#f4f6f8!important;--card2:#edf1f5!important;--text:#172033!important;--muted:#4d5a6d!important;--line:rgba(18,24,40,.16)!important}\
html[data-theme="light"] body{background:#e9edf2!important;color:#172033!important}\
.theme-toggle-global{position:fixed;left:18px;bottom:18px;z-index:120;width:46px;height:46px;border-radius:15px;border:1px solid rgba(255,255,255,.14);background:rgba(17,23,40,.94);color:#fff;box-shadow:0 12px 30px rgba(0,0,0,.22);cursor:pointer;font-size:20px;display:grid;place-items:center;backdrop-filter:blur(12px)}\
html[data-theme="light"] .theme-toggle-global{background:#e1e6ec!important;color:#172033!important;border-color:#aeb8c5!important}\
@media(max-width:720px){.theme-toggle-global{left:10px;bottom:72px;width:42px;height:42px;border-radius:13px}}';
  document.head.appendChild(style);

  function updateButton(btn){if(!btn)return;var light=root.dataset.theme==='light';btn.textContent=light?'☾':'☀';btn.title=light?'الوضع الليلي':'الوضع النهاري';btn.setAttribute('aria-label',btn.title);}
  function mount(){
    var nativeBtn=document.getElementById('theme-toggle');if(nativeBtn)updateButton(nativeBtn);
    if(!document.querySelector('.theme-toggle-global')){var btn=document.createElement('button');btn.type='button';btn.className='theme-toggle-global';updateButton(btn);btn.addEventListener('click',function(){persist(root.dataset.theme==='light'?'dark':'light');window.dispatchEvent(new CustomEvent('shno:themechange',{detail:{theme:root.dataset.theme}}));});document.body.appendChild(btn);}
    var observer=new MutationObserver(function(){var current=root.dataset.theme==='light'?'light':'dark';try{if(localStorage.getItem(KEY)!==current||localStorage.getItem(LEGACY_KEY)!==current){localStorage.setItem(KEY,current);localStorage.setItem(LEGACY_KEY,current);}}catch(e){}if(document.body)document.body.classList.toggle('light',current==='light');document.querySelectorAll('.theme-toggle-global,#theme-toggle').forEach(updateButton);});
    observer.observe(root,{attributes:true,attributeFilter:['data-theme']});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
}());
