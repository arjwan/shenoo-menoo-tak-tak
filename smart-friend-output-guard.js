(()=>{'use strict';
function clean(value){let s=String(value||'');const starts=['<think','<analysis','<reasoning'];for(const tag of starts){const i=s.toLowerCase().indexOf(tag);if(i>=0){const name=tag.slice(1);const close='</'+name+'>';const j=s.toLowerCase().indexOf(close,i);s=j>=0?s.slice(0,i)+s.slice(j+close.length):s.slice(0,i);}}
s=s.replace(/(?:^|\n)\s*(?:here(?:'s| is) a thinking process|thinking process|analysis|reasoning)\s*:?[\s\S]*/i,'');return s.trim();}
function scrub(root=document){root.querySelectorAll?.('.sf-msg.ai > div,[data-sf-result]').forEach(el=>{const v=clean(el.textContent);if(v!==el.textContent)el.textContent=v||'…';});}
scrub();new MutationObserver(()=>scrub()).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
})();