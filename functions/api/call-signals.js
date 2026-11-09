import { getAuthenticatedAppUser } from '../../cloudflare/pages/profile-session.js';
import { handleCallSignaling } from '../../cloudflare/call-signaling.js';
const denied=(message,status)=>Response.json({ok:false,message},{status,headers:{'Cache-Control':'no-store'}});
export async function onRequest({request,env}){
  if(!env.DB)return denied('خدمة المكالمات غير مهيأة',503);
  if(!['GET','HEAD','OPTIONS'].includes(request.method)){
    const origin=request.headers.get('Origin'),site=request.headers.get('Sec-Fetch-Site');
    if((origin&&origin!==new URL(request.url).origin)||(!origin&&site==='cross-site'))
      return denied('طلب من مصدر غير موثوق',403);
  }
  const actor=await getAuthenticatedAppUser(request,env);
  if(!actor)return denied('يرجى تسجيل الدخول',401);
  try{return await handleCallSignaling(request,env,actor)}
  catch(e){console.error('Private calls routing failure',String(e?.message||e));return denied('تعذر توجيه المكالمة',500)}
}
