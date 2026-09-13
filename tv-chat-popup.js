(function(){
'use strict';
const pop=document.querySelector('[data-composer-pop]');
const open=document.querySelector('[data-open-composer]');
const close=document.querySelector('[data-close-composer]');
const form=document.querySelector('[data-message-form]');
const input=document.querySelector('[data-message-input]');
const history=document.querySelector('[data-messages]');
const toggleHistory=document.querySelector('[data-toggle-history]');
const ticker=document.querySelector('[data-ticker-track]');
const label=document.querySelector('.tv-news-label');
const welcome='🌟 أهلاً وسهلاً بكم في شنو منو TV — نتمنى لكم مشاهدة ممتعة وأوقاتاً طيبة مع الأهل والأصدقاء 🌟';
let lastMessageId='';
let restoreTimer=null;
function showComposer(){if(!pop)return;pop.hidden=false;setTimeout(()=>input?.focus(),30);}
function hideComposer(){if(pop)pop.hidden=true;}
open?.addEventListener('click',showComposer);
close?.addEventListener('click',hideComposer);
pop?.addEventListener('click',event=>{if(event.target===pop)hideComposer();});
toggleHistory?.addEventListener('click',()=>{if(!history)return;history.hidden=!history.hidden;toggleHistory.textContent=history.hidden?'عرض الرسائل':'إخفاء الرسائل';});
form?.addEventListener('submit',()=>{setTimeout(()=>{if(input&&!input.value.trim())hideComposer();},450);});
function restartTicker(){
 if(!ticker)return;
 ticker.style.animation='none';
 void ticker.offsetWidth;
 ticker.style.animation='';
}
function resumeOfficialTicker(){
 clearTimeout(restoreTimer);
 restoreTimer=setTimeout(()=>{
   if(window.BroadcastTicker&&typeof window.BroadcastTicker.refresh==='function'){
     window.BroadcastTicker.refresh();
   }else if(ticker){
     ticker.textContent=welcome;
     if(label)label.textContent='شنو منو TV';
     restartTicker();
   }
 },12000);
}
function updateTicker(){
 if(!history||!ticker)return;
 const rows=[...history.querySelectorAll('.tv-message')];
 const last=rows[rows.length-1];
 if(!last)return;
 const messageId=last.dataset.messageId||last.getAttribute('data-id')||((last.querySelector('strong')?.textContent||'')+'|'+(last.querySelector('p')?.textContent||''));
 if(messageId&&messageId===lastMessageId)return;
 const name=(last.querySelector('strong')?.textContent||'مستخدم').trim();
 const text=(last.querySelector('p')?.textContent||'').trim();
 if(!text)return;
 lastMessageId=messageId;
 ticker.textContent='💬 '+name+': '+text.slice(0,220);
 if(label)label.textContent='رسالة الغرفة';
 restartTicker();
 resumeOfficialTicker();
}
if(history){new MutationObserver(updateTicker).observe(history,{childList:true,subtree:true});}
})();
