(()=>{'use strict';
function bindEnterSend(){const form=document.querySelector('[data-chat-form]');if(!form)return;const input=form.elements?.text||form.querySelector('textarea[name="text"]');if(!input||input.dataset.enterSendBound==='1')return;input.dataset.enterSendBound='1';input.addEventListener('keydown',e=>{if(e.key!=='Enter'||e.shiftKey||e.ctrlKey||e.altKey||e.metaKey||e.isComposing)return;e.preventDefault();if(typeof form.requestSubmit==='function')form.requestSubmit();else form.querySelector('button[type="submit"]')?.click();});}
function cleanVisibleReplies(){const cleaner=window.smartFriendCleanReply;if(typeof cleaner!=='function')return;document.querySelectorAll('.sf-msg.ai > div').forEach(el=>{const v=cleaner(el.textContent);if(v!==el.textContent)el.textContent=v||'…';});}
bindEnterSend();cleanVisibleReplies();
new MutationObserver(()=>{bindEnterSend();cleanVisibleReplies();}).observe(document.documentElement,{subtree:true,childList:true});
})();