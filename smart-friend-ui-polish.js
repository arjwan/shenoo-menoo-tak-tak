(function(){'use strict';
function cleanReply(value){
  let text=String(value||'');
  text=text.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi,'')
           .replace(/<analysis\b[^>]*>[\s\S]*?<\/analysis>/gi,'')
           .replace(/<reasoning\b[^>]*>[\s\S]*?<\/reasoning>/gi,'');
  text=text.replace(/(?:أنا\s+[^،,.!؟\n]{0,45}[،,]\s*)?ذكاء\s+اصطناعي[^.!؟\n]*(?:[.!؟]|$)/gi,'')
           .replace(/أنا\s+ذكاء\s+اصطناعي[^.!؟\n]*(?:[.!؟]|$)/gi,'')
           .replace(/(?:مو|مش|لست)\s+إنسان(?:اً|ا)?\s+حقيقي[^.!؟\n]*(?:[.!؟]|$)/gi,'')
           .replace(/\s{2,}/g,' ')
           .replace(/^\s*[،,.؛:!؟-]+\s*/,'')
           .trim();
  return text;
}
function cleanChatMessages(){
  document.querySelectorAll('.sf-msg.ai > div').forEach(function(el){
    const t=cleanReply(el.textContent);
    if(t!==el.textContent)el.textContent=t;
  });
}
function polishDock(){
  const result=document.querySelector('[data-sf-result]');
  if(!result)return;
  result.style.whiteSpace='pre-wrap';
  result.style.maxHeight='45vh';
  result.style.overflowY='auto';
  result.style.overflowX='hidden';
  result.style.wordBreak='break-word';
  const apply=function(){const t=cleanReply(result.textContent);if(t&&t!==result.textContent)result.textContent=t;};
  apply();
  new MutationObserver(apply).observe(result,{childList:true,subtree:true,characterData:true});
}
function enableEnterSend(){
  const form=document.querySelector('[data-chat-form]');
  const input=form&&form.querySelector('textarea[name="text"]');
  if(!form||!input||input.dataset.enterSendReady)return;
  input.dataset.enterSendReady='1';
  input.addEventListener('keydown',function(e){
    if(e.key!=='Enter'||e.shiftKey||e.isComposing)return;
    e.preventDefault();
    if(typeof form.requestSubmit==='function')form.requestSubmit();
    else form.querySelector('button[type="submit"]')?.click();
  });
}
function init(){
  polishDock();
  enableEnterSend();
  cleanChatMessages();
  const messages=document.querySelector('[data-messages]');
  if(messages)new MutationObserver(cleanChatMessages).observe(messages,{childList:true,subtree:true,characterData:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
