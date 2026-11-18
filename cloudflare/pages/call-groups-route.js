import {wakeCallDevices} from '../call-push.js';
import {getAuthenticatedAppUser} from './profile-session.js';
import {handleCallGroups} from '../call-groups.js';
export async function callGroupsRoute({request,env,waitUntil}){
 if(!env.DB)return Response.json({ok:false,message:'خدمة المجموعات غير مهيأة'},{status:503});
 const actor=await getAuthenticatedAppUser(request,env);
 if(!actor)return Response.json({ok:false,message:'يرجى تسجيل الدخول'},{status:401,headers:{'Cache-Control':'no-store'}});
 try{
 const pushRequest=request.method==='POST'&&new URL(request.url).pathname.endsWith('/signals')?request.clone():null;
 const result=await handleCallGroups(request,env,actor);
 if(pushRequest&&result.status===201){const body=await pushRequest.json().catch(()=>null);if(body?.event==='invite'){
  const task=wakeCallDevices(env,body.userId,body.callId).catch(()=>console.warn('Group-call push delivery failed'));
  if(waitUntil)waitUntil(task);else await task;
 }}
 return result;
 }
 catch(error){console.error('Group route failure',String(error?.message||error));return Response.json({ok:false,message:'تعذر تحميل المجموعة'},{status:500});}
}
