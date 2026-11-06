import { developerHelpers } from '../../../cloudflare/pages/developer-helpers.js';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const bytes=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
const b64=arr=>btoa(String.fromCharCode(...arr)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const digest=async s=>b64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))));
export async function onRequest(context){
 const {request,env}=context;
 if(request.method!=='POST')return reply({ok:false,message:'الطريقة غير مدعومة'},405);
 try{developerHelpers.verifyOrigin(request)}catch{return reply({ok:false,message:'مصدر الطلب غير موثوق'},403)}
 if(!env.DB||!env.DEVELOPER_RATE_LIMIT_SECRET)return reply({ok:false,message:'الخدمة غير مهيأة'},503);
 const throttle=await developerHelpers.enforceAuthRateLimit(request,env,'developer-first-password','',6,900);
 if(throttle)return throttle;
 const data=await request.json().catch(()=>null);
 if(!data||Array.isArray(data)||typeof data!=='object')return reply({ok:false,message:'طلب غير صالح'},400);
 const token=String(data.token||''),password=String(data.password||''),confirmation=String(data.confirmPassword||'');
 if(!/^[a-zA-Z0-9_-]{40,100}$/.test(token))return reply({ok:false,message:'رابط التهيئة غير صالح'},401);
 if(password.length<16||password.length>128||password!==confirmation)return reply({ok:false,message:'كلمة المرور الجديدة يجب أن تتكون من 16 حرفًا على الأقل وأن تطابق التأكيد'},400);
 const h=await digest(token);
 const row=await env.DB.prepare("SELECT t.user_id,u.username FROM developer_setup_tokens t JOIN users u ON u.id=t.user_id JOIN developer_grants g ON g.user_id=u.id AND g.revoked_at IS NULL WHERE t.token_hash=? AND t.consumed_at IS NULL AND t.expires_at>datetime('now') AND u.status='active'").bind(h).first();
 if(!row)return reply({ok:false,message:'انتهت صلاحية رابط التهيئة أو استُخدم سابقًا'},401);
 const salt=b64(crypto.getRandomValues(new Uint8Array(16)));
 const passwordHash=await developerHelpers.hash(password,salt);
 const batches=await env.DB.batch([
  env.DB.prepare("UPDATE users SET password_salt=?,password_hash=? WHERE id=? AND EXISTS (SELECT 1 FROM developer_setup_tokens WHERE user_id=? AND token_hash=? AND consumed_at IS NULL AND expires_at>datetime('now'))").bind(salt,passwordHash,row.user_id,row.user_id,h),
  env.DB.prepare("UPDATE developer_setup_tokens SET consumed_at=CURRENT_TIMESTAMP WHERE user_id=? AND token_hash=? AND consumed_at IS NULL AND expires_at>datetime('now')").bind(row.user_id,h),
  env.DB.prepare('UPDATE auth_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE user_id=? AND revoked_at IS NULL').bind(row.user_id),
  env.DB.prepare('UPDATE developer_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE user_id=? AND revoked_at IS NULL').bind(row.user_id)
 ]);
 if(!batches[0]?.meta?.changes)return reply({ok:false,message:'انتهى رابط التهيئة'},401);
 await env.DB.prepare('INSERT INTO developer_audit(id,actor_id,action,metadata) VALUES(?,?,?,?)').bind(crypto.randomUUID(),row.user_id,'developer.password.initialized','verified-owner-invite').run();
 return reply({ok:true,message:'تم إنشاء كلمة المرور. افتح لوحة المطور وسجّل الدخول ثم فعّل المصادقة الثنائية.'});
}
