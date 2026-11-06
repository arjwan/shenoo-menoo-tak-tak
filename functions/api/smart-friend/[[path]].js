// Explicit Pages Function for Smart Friend. Keep this more specific than
// the generic /api/[[path]] fallback to the legacy Worker.
import {getAuthenticatedAppUser} from '../../../cloudflare/pages/profile-session.js';
import {smartFriendRoute} from '../../../cloudflare/pages/smart-friend.js';

export async function onRequest(context){
 const {request,env}=context;
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(!env.DB)return Response.json({ok:false,message:'قاعدة البيانات غير مهيأة'},{status:503,headers});
 const actor=await getAuthenticatedAppUser(request,env);
 if(!actor)return Response.json({ok:false,message:'يرجى تسجيل الدخول مجددًا'},{status:401,headers});
 try{
  return await smartFriendRoute(request,env,actor);
 }catch(e){
  console.error('Pages smart-friend route failed',String(e?.message||e));
  return Response.json({ok:false,message:'تعذر تنفيذ الطلب على Cloudflare، حاول مجددًا'},{status:500,headers});
 }
}
