import {getAuthenticatedAppUser} from '../../../cloudflare/pages/profile-session.js';
import {registerCallPush} from '../../../cloudflare/call-push.js';
export async function onRequest({request,env}){
 const actor=env.DB&&await getAuthenticatedAppUser(request,env);
 if(!actor)return Response.json({ok:false,message:'يرجى تسجيل الدخول'},{status:401,headers:{'Cache-Control':'no-store'}});
 return registerCallPush(request,env,actor);
}
