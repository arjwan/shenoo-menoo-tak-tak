(function(){'use strict';
const roomId=new URLSearchParams(location.search).get('id');
const privacy=document.querySelector('[data-group-privacy]');
const approval=document.querySelector('[data-group-join-approval]');
const save=document.querySelector('[data-save-membership]');
const leave=document.querySelector('[data-leave-group]');
const status=document.querySelector('[data-status]');
function note(text,bad){if(!status)return;status.textContent=text||'';status.classList.toggle('error',!!bad);}
function sync(){if(!privacy||!approval)return;if(privacy.value==='private'){approval.value='owner_approval';approval.disabled=true;}else approval.disabled=false;}
async function refresh(){if(!roomId)return;try{const d=await SocialAPI.request('/api/groups/'+encodeURIComponent(roomId));const g=d.group||{};if(privacy)privacy.value=g.privacy||'public';if(approval)approval.value=g.privacy==='private'?'owner_approval':(g.joinApproval||'open');sync();if(leave)leave.hidden=!!g.isAdmin||!g.joined;}catch(_){} }
privacy?.addEventListener('change',sync);
approval?.addEventListener('change',sync);
save?.addEventListener('click',async()=>{if(!roomId)return;save.disabled=true;try{const body={privacy:privacy.value,joinApproval:privacy.value==='private'?'owner_approval':approval.value};const d=await SocialAPI.request('/api/groups/'+encodeURIComponent(roomId)+'/settings',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});privacy.value=d.group.privacy;approval.value=d.group.joinApproval;sync();note('تم حفظ خصوصية المجموعة وطريقة الانضمام.');}catch(e){note(e.message,true);}finally{save.disabled=false;}});
leave?.addEventListener('click',async()=>{if(!roomId||!confirm('هل تريد مغادرة هذه المجموعة؟'))return;leave.disabled=true;try{const d=await SocialAPI.request('/api/groups/'+encodeURIComponent(roomId)+'/join',{method:'DELETE'});note(d.message||'تمت مغادرة المجموعة');setTimeout(()=>location.replace('groups.html'),500);}catch(e){note(e.message,true);leave.disabled=false;}});
refresh();
})();
