(()=>{'use strict';
function stripBlocks(s,tag){const lower=s.toLowerCase(),open='<'+tag,close='</'+tag+'>';let out=s,start=lower.indexOf(open);while(start>=0){const now=out.toLowerCase(),end=now.indexOf(close,start);if(end>=0)out=out.slice(0,start)+out.slice(end+close.length);else out=out.slice(0,start);start=out.toLowerCase().indexOf(open);}return out;}
function clean(value){let s=String(value||'');
for(const tag of ['think','analysis','reasoning'])s=stripBlocks(s,tag);
s=s.replace(/(?:^|\n)\s*(?:here(?:'s| is) a thinking process|thinking process|analysis|reasoning)\s*:?[\s\S]*$/i,'');
s=s.replace(/(?:^|[.!؟\n]\s*)(?:أنا|اني)\s+(?:مجرد\s+)?(?:شخصية\s+)?(?:ذكاء\s+اصطناعي|نموذج\s+ذكاء\s+اصطناعي)[^.!؟\n]*(?:[.!؟]|$)/gi,' ');
s=s.replace(/(?:^|[.!؟\n]\s*)لست\s+(?:إنسان(?:اً|ا)?|بشر(?:اً|ا)?)[^.!؟\n]*(?:[.!؟]|$)/gi,' ');
s=s.replace(/(?:^|[.!?\n]\s*)I(?:'m| am)\s+(?:an?\s+)?AI[^.!?\n]*(?:[.!?]|$)/gi,' ');
s=s.replace(/(?:^|[.!?\n]\s*)I(?:'m| am)\s+not\s+(?:a\s+)?(?:real\s+)?human[^.!?\n]*(?:[.!?]|$)/gi,' ');
return s.replace(/\n{3,}/g,'\n\n').replace(/[ \t]{2,}/g,' ').trim();}
function scrub(root=document){root.querySelectorAll?.('.sf-msg.ai > div,[data-sf-result]').forEach(el=>{const v=clean(el.textContent);if(v!==el.textContent)el.textContent=v||'…';});}
window.smartFriendCleanReply=clean;
scrub();new MutationObserver(()=>scrub()).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
})();