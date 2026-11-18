import {getAuthenticatedAppUser} from '../../cloudflare/pages/profile-session.js';
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private,no-store'}});
export async function onRequest({request,env}){
 if(!env.DB)return reply({ok:false,message:'سجل المكالمات غير مهيأ'},503);
 const origin=request.headers.get('Origin'),site=request.headers.get('Sec-Fetch-Site');
 if(request.method==='PATCH'&&((origin&&origin!==new URL(request.url).origin)||(!origin&&site==='cross-site')))
  return reply({ok:false,message:'مصدر الطلب غير موثوق'},403);
 const user=await getAuthenticatedAppUser(request,env);
 if(!user)return reply({ok:false,message:'يرجى تسجيل الدخول'},401);
 try{
  if(request.method==='PATCH'){
   const changed=await env.DB.prepare("UPDATE call_history SET recipient_read_at=CURRENT_TIMESTAMP WHERE recipient_id=? AND state='missed' AND recipient_read_at IS NULL").bind(user.id).run();
   return reply({ok:true,marked:changed.meta?.changes||0});
  }
  if(request.method==='GET'){
   const rows=await env.DB.prepare(
    "SELECT h.call_id,h.conversation_id,h.type,h.state,h.started_at,h.answered_at,h.ended_at,h.recipient_read_at,h.caller_id,h.recipient_id,u.id AS other_id,u.full_name AS other_name FROM call_history h JOIN users u ON u.id=CASE WHEN h.caller_id=? THEN h.recipient_id ELSE h.caller_id END WHERE h.caller_id=? OR h.recipient_id=? ORDER BY h.started_at DESC,h.call_id DESC LIMIT 100"
   ).bind(user.id,user.id,user.id).all();
   const missed=await env.DB.prepare("SELECT COUNT(*) AS n FROM call_history WHERE recipient_id=? AND state='missed' AND recipient_read_at IS NULL").bind(user.id).first();
   return reply({ok:true,missedCount:Number(missed?.n||0),calls:rows.results.map(h=>({
    id:h.call_id,conversationId:h.conversation_id,type:h.type,status:h.state,
    direction:h.caller_id===user.id?'outgoing':'incoming',
    otherUser:{id:h.other_id,fullName:h.other_name},
    missedUnread:h.recipient_id===user.id&&h.state==='missed'&&!h.recipient_read_at,
    startedAt:h.started_at,answeredAt:h.answered_at,endedAt:h.ended_at
   }))});
  }
  return reply({ok:false,message:'طريقة غير مدعومة'},405);
 }catch(e){console.error('Call history error',String(e?.message||e));return reply({ok:false,message:'تعذر قراءة سجل المكالمات'},500);}
}
