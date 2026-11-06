import { schoolUser } from '../../../cloudflare/pages/school-helpers.js';
import { developerHelpers } from '../../../cloudflare/pages/developer-helpers.js';

const reply=(message,status=400)=>Response.json({ok:false,message},{status,headers:{'Cache-Control':'no-store'}});
const decode=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4)),c=>c.charCodeAt(0));
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function secureEqual(a,b){
 let x=0;
 if(a.length!==b.length)return false;
 for(let i=0;i<a.length;i++)x|=a[i]^b[i];
 return x===0;
}
const clear=name=>name+'=; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=0';

export async function onRequest(context){
 const {request,env}=context;
 if(request.method!=='POST')return Response.json({ok:false,message:'الطريقة غير مدعومة'},{status:405,headers:{Allow:'POST','Cache-Control':'no-store'}});
 try{developerHelpers.verifyOrigin(request)}catch{return reply('مصدر الطلب غير موثوق',403)}
 if(!env.DB||!env.API?.fetch)return reply('خدمة الحسابات غير مهيأة',503);
 const auth=await schoolUser(context);if(auth.error)return auth.error;
 const limit=await developerHelpers.enforceAuthRateLimit(request,env,'password-rotation',auth.user.id,5,900);
 if(limit)return limit;
 const data=await request.json().catch(()=>null);
 if(!data||typeof data!=='object'||Array.isArray(data))return reply('الطلب غير صالح');
 const current=String(data.currentPassword||''),next=String(data.newPassword||'');
 if(!current||next.length<14||next.length>128||next===current||next!==String(data.confirmPassword||'')){
  return reply('كلمة المرور الجديدة يجب أن تكون مختلفة، من 14 إلى 128 حرفاً، ومتطابقة مع التأكيد');
 }
 const row=await env.DB.prepare("SELECT id,password_salt,password_hash,status FROM users WHERE id=? AND status='active'")
  .bind(auth.user.id).first();
 if(!row)return reply('جلسة الدخول غير صالحة',401);
 const check=await developerHelpers.hash(current,row.password_salt);
 if(!secureEqual(decode(check),decode(row.password_hash)))return reply('كلمة المرور الحالية غير صحيحة',401);
 const salt=b64(crypto.getRandomValues(new Uint8Array(16)));
 const passwordHash=await developerHelpers.hash(next,salt);
 // One D1 atomic batch: rotate password, revoke every app and developer session,
 // and expire any in-flight developer MFA challenge. No privilege changes.
 const done=await env.DB.batch([
  env.DB.prepare('UPDATE users SET password_salt=?,password_hash=? WHERE id=? AND password_hash=?')
   .bind(salt,passwordHash,auth.user.id,row.password_hash),
  env.DB.prepare("UPDATE auth_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE user_id=? AND revoked_at IS NULL")
   .bind(auth.user.id),
  env.DB.prepare("UPDATE developer_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE user_id=? AND revoked_at IS NULL")
   .bind(auth.user.id),
  env.DB.prepare("UPDATE developer_challenges SET consumed_at=CURRENT_TIMESTAMP WHERE user_id=? AND consumed_at IS NULL")
   .bind(auth.user.id)
 ]);
 if(!done[0]?.meta?.changes)return reply('تغيرت بيانات حسابك؛ أعد تسجيل الدخول وحاول مجددًا',409);
 await env.DB.prepare('INSERT INTO developer_audit(id,actor_id,action,metadata) VALUES(?,?,?,?)')
  .bind(crypto.randomUUID(),auth.user.id,'auth.password.changed','self-service').run();
 const headers=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store'});
 headers.append('Set-Cookie',clear('__Host-shino_session'));
 headers.append('Set-Cookie',clear('__Host-shenoo_developer'));
 return new Response(JSON.stringify({ok:true,message:'تم تغيير كلمة المرور وإغلاق جميع الجلسات. سجّل الدخول بالكلمة الجديدة.'}),{status:200,headers});
}
