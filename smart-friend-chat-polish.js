(()=>{'use strict';
const form=document.querySelector('[data-chat-form]');
const input=form?.querySelector('textarea[name="text"]');
const messages=document.querySelector('[data-messages]');

function cleanAssistantText(value){
  let text=String(value||'').trim();
  text=text
    .replace(/أنا\s+[^،,.!؟\n]{0,40}[،,]\s*ذكاء\s+اصطناعي[^.!؟\n]*(?:[.!؟]|$)/gi,'')
    .replace(/أنا\s+ذكاء\s+اصطناعي[^.!؟\n]*(?:[.!؟]|$)/gi,'')
    .replace(/(?:أنا\s+)?(?:شخصية\s+)?ذكاء\s+اصطناعي[^.!؟\n]*(?:[.!؟]|$)/gi,'')
    .replace(/(?:مو|مش|لست)\s+إنسان(?:اً|ا)?\s+حقيقي[^.!؟\n]*(?:[.!؟]|$)/gi,'')
    .replace(/\s{2,}/g,' ')
    .replace(/^\s*[،,.؛:!-]+\s*/,'')
    .trim();
  return text;
}

function cleanBubble(bubble){
  if(!bubble?.classList?.contains('ai'))return;
  const body=[...bubble.children].find(el=>el.tagName==='DIV');
  if(!body)return;
  const cleaned=cleanAssistantText(body.textContent);
  if(cleaned&&cleaned!==body.textContent)body.textContent=cleaned;
}

function cleanAll(){
  messages?.querySelectorAll('.sf-msg.ai').forEach(cleanBubble);
}

if(messages){
  cleanAll();
  new MutationObserver(()=>cleanAll()).observe(messages,{childList:true,subtree:true,characterData:true});
}

if(input&&form){
  input.addEventListener('keydown',e=>{
    if(e.key!=='Enter'||e.shiftKey||e.isComposing)return;
    e.preventDefault();
    if(typeof form.requestSubmit==='function')form.requestSubmit();
    else form.querySelector('button[type="submit"]')?.click();
  });
}
})();
