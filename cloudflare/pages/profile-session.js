import {handleProfile} from '../profile-api.js';
const deny=(message,status)=>Response.json({ok:false,message},{status,headers:{'Cache-Control':'no-store'}});
const encoder=new TextEncoder();
const sessionName='__Host-shino_session';
export async function profileSession(context){
 const {env,request}=context;
 if(!env.DB)return deny('قاعدة البيانات غير مهيأة',503);
 const actor=await getAuthenticatedAppUser(request,env);
 if(!actor)return deny('يرجى تسجيل الدخول أو تجديد الجلسة',401);
 try{return await handleProfile(request,env,actor)}
 catch(e){console.error('Profile API error',String(e?.message||e));return deny('تعذّر معالجة الطلب، حاول مجددًا',500)}
}
export async function getAuthenticatedAppUser(request,env){
 const raw=request.headers.get('Cookie')||'';
 const token=raw.split(';').map(v=>v.trim()).find(v=>v.startsWith(sessionName+'='))?.slice(sessionName.length+1)||'';
 if(!token||token.length>1024)return null;
 const digest=await crypto.subtle.digest('SHA-256',encoder.encode(token));
 const hash=btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 const actor=await env.DB.prepare("SELECT u.id,u.username,u.full_name FROM auth_sessions a JOIN users u ON u.id=a.user_id WHERE a.secret_hash=? AND a.revoked_at IS NULL AND a.expires_at>datetime('now') AND u.status='active' LIMIT 1").bind(hash).first();
 return actor||null;
}
