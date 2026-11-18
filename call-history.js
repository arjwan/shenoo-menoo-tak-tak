(function(){
'use strict';
const list=document.getElementById('history'),status=document.getElementById('status');
let rows=[],filter='all';
function label(call){
 if(call.status==='missed')return 'فائتة';
 if(call.status==='declined')return 'مرفوضة';
 if(call.direction==='outgoing')return call.status==='answered'?'صادرة · تم الرد':'صادرة';
 if(call.status==='answered')return 'واردة · تم الرد';
 return 'واردة';
}
function render(){
 list.replaceChildren();
 const shown=rows.filter(c=>filter==='all'||filter==='missed'&&c.status==='missed'||filter===c.direction);
 status.textContent=shown.length?shown.length+' مكالمة':'لا توجد مكالمات في هذا القسم';
 for(const call of shown){
  const node=document.createElement('article');node.className='call';
  const icon=document.createElement('span');icon.className='call-icon';icon.textContent=call.status==='missed'?'📵':call.direction==='outgoing'?'↗️':'↙️';
  const text=document.createElement('div');text.className='call-data';
  const name=document.createElement('strong');name.textContent=call.otherUser?.fullName||'جهة اتصال';
  const details=document.createElement('small');details.textContent=label(call)+' · '+(call.type==='video'?'فيديو':'صوت')+' · '+new Date(call.startedAt).toLocaleString('ar-IQ');
  if(call.missedUnread)details.classList.add('unread');
  text.append(name,details);
  const retry=document.createElement('button');retry.textContent='اتصال';retry.type='button';
  retry.onclick=function(){
   if(!/^[a-f0-9-]{36}$/i.test(call.otherUser?.id||''))return;
   location.href='messages.html?user='+encodeURIComponent(call.otherUser.id)+'&call='+encodeURIComponent(call.type==='video'?'video':'audio');
  };
  node.append(icon,text,retry);list.append(node);
 }
}
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',function(){
 filter=button.dataset.filter;
 document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
 render();
}));
(async()=>{
 try{
  const data=await SocialAPI.request('/api/call-history');
  rows=Array.isArray(data.calls)?data.calls:[];render();
  if(data.missedCount>0)await SocialAPI.request('/api/call-history',{method:'PATCH'}).catch(()=>{});
 }catch(error){status.textContent=error.message||'تعذر قراءة سجل المكالمات';}
})();
})();