import {getAuthenticatedAppUser} from './profile-session.js';
import {handleCallGroups} from '../call-groups.js';
export async function callGroupsRoute({request,env}){
 if(!env.DB)return Response.json({ok:false,message:'خدمة المجموعات غير مهيأة'},{status:503});
 const actor=await getAuthenticatedAppUser(request,env);
 if(!actor)return Response.json({ok:false,message:'يرجى تسجيل الدخول'},{status:401,headers:{'Cache-Control':'no-store'}});
 try{return await handleCallGroups(request,env,actor)}
 catch(error){console.error('Group route failure',String(error?.message||error));return Response.json({ok:false,message:'تعذر تحميل المجموعة'},{status:500});}
}
