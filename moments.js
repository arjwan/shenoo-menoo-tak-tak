(()=>{'use strict';
const frames={stories:document.getElementById('storiesFrame'),reels:document.getElementById('reelsFrame')};
const hints={stories:'القصص تختفي بعد 24 ساعة، وتحافظ على خصوصية الجمهور الذي تختاره.',reels:'الريلز تبقى في حسابك حتى تحذفها، ويمكن للمشاهدين التفاعل معها.'};
const tabs=[...document.querySelectorAll('[role="tab"]')];
const dialog=document.getElementById('createDialog');
let selected=null;
function initialMode(){const params=new URLSearchParams(location.search);return params.get('tab')==='reels'||params.get('type')==='reels'?'reels':'stories'}
function frameDocument(frame){try{return frame.contentDocument}catch(_){return null}}
function decorate(frame){
 const doc=frameDocument(frame);if(!doc||!doc.body)return;
 // Existing story and reels applications remain intact, including uploads,
 // privacy, comments and engagement. Only duplicate standalone chrome is hidden.
 if(!doc.getElementById('momentsEmbeddedStyle')){
  const style=doc.createElement('style');style.id='momentsEmbeddedStyle';
  style.textContent='body{margin:0!important;background:transparent!important}.mobile-bar{display:none!important} .story-head>a[href="taktak.html"], .reels .top>a[href="taktak.html"]{display:none!important} .story-shell,.reels{max-width:100%!important;margin:0!important;padding:12px!important}';
  doc.head.append(style);
 }
 // Keep internal application links opening as full pages rather than trapping
 // unrelated profile, message, or account pages in the media panel.
 if(!doc.body.dataset.momentsNavigation){
  doc.body.dataset.momentsNavigation='1';
  doc.addEventListener('click',e=>{
   const link=e.target.closest?.('a[href]');if(!link||e.defaultPrevented||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
   try{const url=new URL(link.href,location.origin);if(url.origin!==location.origin)return;
    const inside=['/stories.html','/reels.html'];if(inside.includes(url.pathname)){e.preventDefault();switchMode(url.pathname==='/reels.html'?'reels':'stories');return}
    e.preventDefault();window.location.assign(url.href);
   }catch(_){}
  },true);
 }
 const sync=()=>{if(!doc.body||!frame.isConnected)return;const main=doc.querySelector('main');const h=Math.max(main?.scrollHeight||0,doc.body.scrollHeight||0,500);frame.style.height=Math.min(Math.max(h+36,500),16000)+'px'};
 sync();
 if(!frame._momentsObserver&&doc.defaultView?.ResizeObserver){const ob=new doc.defaultView.ResizeObserver(sync);ob.observe(doc.body);const main=doc.querySelector('main');if(main)ob.observe(main);frame._momentsObserver=ob}
}
function ensureFrame(mode){const frame=frames[mode];if(!frame.getAttribute('src'))frame.src=frame.dataset.src;return frame}
function switchMode(mode,updateUrl=true){
 if(!frames[mode])return;
 selected=mode;
 tabs.forEach(tab=>{const active=tab.dataset.mode===mode;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1});
 document.querySelectorAll('[data-panel]').forEach(panel=>panel.hidden=panel.dataset.panel!==mode);
 document.getElementById('modeHint').textContent=hints[mode];
 ensureFrame(mode);
 if(updateUrl){const url=new URL(location.href);url.searchParams.set('tab',mode);url.searchParams.delete('type');url.searchParams.delete('create');history.replaceState(null,'',url)}
 const other=mode==='stories'?'reels':'stories';frameDocument(frames[other])?.querySelectorAll('video,audio').forEach(m=>m.pause?.());
}
function showCreate(mode){
 switchMode(mode);
 if(dialog.open)dialog.close();
 const frame=ensureFrame(mode);
 const focus=()=>{decorate(frame);const doc=frameDocument(frame);if(!doc)return;
  if(mode==='reels'){const form=doc.getElementById('upload');if(form&&!form.classList.contains('open'))doc.getElementById('create')?.click();doc.getElementById('clip')?.focus({preventScroll:true})}
  else {doc.getElementById('storyText')?.focus({preventScroll:true})}
  frame.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 };
 if(frame.dataset.loaded==='1')focus();else frame.addEventListener('load',focus,{once:true});
}
for(const [mode,frame] of Object.entries(frames)){frame.addEventListener('load',()=>{frame.dataset.loaded='1';decorate(frame)})}
tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>switchMode(tab.dataset.mode));tab.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowLeft'?1:-1)+tabs.length)%tabs.length;switchMode(tabs[next].dataset.mode);tabs[next].focus()})});
document.getElementById('createMedia').addEventListener('click',()=>{if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','')});
document.querySelectorAll('[data-create-mode]').forEach(btn=>btn.addEventListener('click',()=>showCreate(btn.dataset.createMode)));
window.addEventListener('popstate',()=>switchMode(initialMode(),false));
switchMode(initialMode(),false);
const params=new URLSearchParams(location.search);if(params.get('create')==='1')showCreate(initialMode());
})();