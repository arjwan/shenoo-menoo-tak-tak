/* A single progressive enhancement for the static Cloudflare Pages site.
   Scrolling remains native and respects touch, wheel and keyboard input.
   No wheel handler is installed: the hovered/focused pane owns its scroll. */
(()=>{
 'use strict';
 const path=location.pathname.toLowerCase();
 const html=document.documentElement;
 const body=document.body;
 if(!body)return;
 const home=body.querySelector('.home-grid')&&html.classList.contains('home-colors-scope');
 const smart=body.querySelector('.sf-studio .sf-chat');
 const messages=body.querySelector('main.social-page .chat-shell .conversation-list');
 const developer=path.startsWith('/developer/')&&body.querySelector('#workspace .layout #navigation');
 const school=body.querySelector('#sumer-app > .sumer-layout .sumer-main');
 let mode=null;
 if(home)mode='home';
 else if(smart)mode='smart-friend';
 else if(messages)mode='messages';
 else if(developer)mode='developer';
 else if(school)mode='school';
 else {
  const directMain=Array.from(body.children).find(el=>el.tagName==='MAIN');
  // Authentication, kiosk-like experiences and the landing page preserve
  // their original layout. Pages with a direct header/main get a fixed shell.
  if(directMain&&!/^(?:\/|\/index\.html|\/signin\.html|\/signup\.html)$/.test(path)){
   mode='main';
   directMain.dataset.shScrollRegion='';
  } else if(!/^(?:\/|\/index\.html|\/signin\.html|\/signup\.html)$/.test(path)){
   mode='body';
  }
 }
 if(!mode)return;
 html.dataset.shScroll=mode;
 const regions=mode==='home'
   ?body.querySelectorAll('.feed,.left-side,.right-side')
   :mode==='smart-friend'
   ?body.querySelectorAll('.sf-personas,.sf-settings,.sf-messages')
   :mode==='messages'
   ?body.querySelectorAll('.conversation-list,.chat-messages')
   :mode==='developer'
   ?body.querySelectorAll('#navigation,.layout > .content')
   :mode==='school'
   ?body.querySelectorAll('.sumer-sidebar,.sumer-main')
   :mode==='main'
   ?body.querySelectorAll('main[data-sh-scroll-region]')
   :[];
 for(const region of regions){
  region.dataset.shScrollRegion='';
  // Keyboard users can choose a pane then scroll it with PageDown/arrow keys.
  if(!region.hasAttribute('tabindex'))region.tabIndex=0;
 }
})();