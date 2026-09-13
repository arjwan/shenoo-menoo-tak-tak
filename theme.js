(function(){
  'use strict';
  var KEY='shno-theme';
  var LEGACY_KEY='taktak-theme';
  var root=document.documentElement;
  var saved='';
  try{saved=localStorage.getItem(KEY)||localStorage.getItem(LEGACY_KEY)||'';}catch(e){}

  /* New product default: daylight mode. Existing users keep their explicit choice. */
  var theme=saved==='dark'?'dark':'light';

  if(!document.querySelector('link[data-theme-light-fixes]')){
    var fixes=document.createElement('link');
    fixes.rel='stylesheet';
    fixes.href='theme-light-fixes.css?v=20260913-5';
    fixes.setAttribute('data-theme-light-fixes','1');
    document.head.appendChild(fixes);
  }

  function persist(next){
    next=next==='dark'?'dark':'light';
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
:root{color-scheme:light}\
html[data-theme="light"]{color-scheme:light;--bg:#e9eef4!important;--bg-soft:#f1f5f9!important;--panel:#f7f9fb!important;--panel2:#eef3f8!important;--card:#f8fafc!important;--card2:#eef3f8!important;--text:#20242b!important;--muted:#596579!important;--line:#cbd4df!important}\
html[data-theme="dark"]{color-scheme:dark;--bg:#0c111b!important;--bg-soft:#111827!important;--panel:#141c29!important;--panel2:#192334!important;--card:#141c29!important;--card2:#192334!important;--text:#f3f6fb!important;--muted:#aeb8c8!important;--line:#2a3547!important}\
.theme-toggle-global{position:fixed;left:18px;bottom:18px;z-index:120;width:46px;height:46px;border-radius:15px;border:1px solid rgba(255,255,255,.14);background:#172033;color:#fff;box-shadow:0 12px 30px rgba(0,0,0,.18);cursor:pointer;font-size:20px;display:grid;place-items:center;backdrop-filter:blur(12px)}\
html[data-theme="light"] .theme-toggle-global{background:#edf2f7!important;color:#20242b!important;border-color:#c3ceda!important}\
html[data-theme="dark"] .theme-toggle-global{background:#172033!important;color:#f3f6fb!important;border-color:#354256!important}\
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
      var current=root.dataset.theme==='dark'?'dark':'light';
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
