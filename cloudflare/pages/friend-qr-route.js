import {getAuthenticatedAppUser} from './profile-session.js';
import {friendQrRequest} from './friend-qr.js';
export async function friendQrRoute({request,env}){
 const user=env.DB&&await getAuthenticatedAppUser(request,env);
 if(!user)return Response.json({ok:false,message:'يرجى تسجيل الدخول'},{status:401});
 return friendQrRequest(request,env,user);
}
