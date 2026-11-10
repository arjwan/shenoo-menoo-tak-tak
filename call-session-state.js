(function(global){
 'use strict';if(global.ShnoCallSession)return;
 const terminalKey='shno-call-terminal',handoffKey='shno-call-handoff';
 function entries(){try{return JSON.parse(sessionStorage.getItem(terminalKey)||'[]').filter(x=>Array.isArray(x)&&Date.now()-x[1]<600000)}catch(_){return []}}
 global.ShnoCallSession={
  isTerminal(id){return Boolean(global.ShnoAndroidCall?.isCallClosed?.(id))||entries().some(x=>x[0]===id);},
  close(id){if(!id)return;const rows=entries().filter(x=>x[0]!==id);rows.push([id,Date.now()]);try{sessionStorage.setItem(terminalKey,JSON.stringify(rows.slice(-128)))}catch(_){}},
  handoff(invite){try{sessionStorage.setItem(handoffKey,JSON.stringify({...invite,at:Date.now()}))}catch(_){}},
  takeHandoff(id){try{const item=JSON.parse(sessionStorage.getItem(handoffKey)||'null');if(!item||item.callId!==id)return null;sessionStorage.removeItem(handoffKey);return Date.now()-item.at<45000&&!this.isTerminal(id)?item:null}catch(_){return null}}
 };
})(window);
