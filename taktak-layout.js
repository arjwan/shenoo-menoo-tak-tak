(()=>{'use strict';
const search=document.querySelector('[data-people-search]');
const results=document.querySelector('[data-home-search-results]');
if(search&&results){search.addEventListener('input',()=>{results.hidden=search.value.trim().length<2;});search.addEventListener('keydown',e=>{if(e.key==='Escape'){results.hidden=true;search.blur();}});}
const nav=document.querySelector('.left-side');
if(nav){nav.querySelector('a[href="taktak.html"]')?.setAttribute('aria-current','page');}
// Older enhancement scripts add shortcuts after page load. Keep one service entry in navigation.
const top=document.querySelector('.top-actions');
function consolidate(){if(!top||!nav)return;for(const el of [...top.children]){if(['theme-toggle','logout'].includes(el.id))continue;
if(el.matches('a')){const href=el.getAttribute('href');const existing=[...nav.querySelectorAll('a')].find(a=>a.getAttribute('href')===href);if(existing){el.remove();continue;}}
if(el.matches('a,button')){el.textContent=el.getAttribute('aria-label')||el.title||el.textContent;nav.appendChild(el);}
}}
if(top&&nav){consolidate();new MutationObserver(consolidate).observe(top,{childList:true});}
})();
