// Cloudflare D1 developer control plane. No MariaDB/MongoDB connection and no password-only admin session.
// The calling Worker supplies its existing password hashing, rate-limiting, Origin and session helpers.
const j=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const fail=(message,status=400)=>j({ok:false,message},status);
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const decode=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
const sha=async value=>b64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))));
const rand=()=>b64(crypto.getRandomValues(new Uint8Array(32)));
const devCookie=(value,age)=>'__Host-shenoo_developer='+value+'; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age='+age;
const cookie=req=>(req.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-shenoo_developer='))?.split('=').slice(1).join('=')||'';
const authHeader=req=>(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
const safe=u=>({id:u.id,fullName:u.full_name,displayName:u.full_name,username:u.username,email:u.email||'',phone:'',role:'developer',status:u.status,createdAt:u.created_at});
const jsonBody=async req=>{const v=await req.json().catch(()=>null);if(!v||Array.isArray(v)||typeof v!=='object')throw {status:400,message:'الطلب غير صالح'};return v;};
const base32=bytes=>{const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let acc=0,bits=0,out='';for(const byte of bytes){acc=(acc<<8)|byte;bits+=8;while(bits>=5){bits-=5;out+=alphabet[(acc>>>bits)&31];}}if(bits)out+=alphabet[(acc<<(5-bits))&31];return out;};
const from32=value=>{const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let acc=0,bits=0,output=[];for(const c of value.toUpperCase().replace(/=+$/,'')){const idx=alphabet.indexOf(c);if(idx<0)throw Error('Invalid TOTP secret');acc=(acc<<5)|idx;bits+=5;if(bits>=8){bits-=8;output.push((acc>>>bits)&255);}}return new Uint8Array(output);};
async function totp(secret,counter){const bytes=new Uint8Array(8);let n=counter;for(let i=7;i>=0;i--){bytes[i]=n&255;n=Math.floor(n/256);}const key=await crypto.subtle.importKey('raw',from32(secret),{name:'HMAC',hash:'SHA-1'},false,['sign']);const sig=new Uint8Array(await crypto.subtle.sign('HMAC',key,bytes));const off=sig[sig.length-1]&15;const val=(((sig[off]&127)<<24)|(sig[off+1]<<16)|(sig[off+2]<<8)|sig[off+3])%1000000;return String(val).padStart(6,'0');}
async function matchedCounter(secret,code,minimum=-1){if(!/^\d{6}$/.test(String(code||'')))return null;const current=Math.floor(Date.now()/30000);for(const n of [current-1,current,current+1])if(n>minimum&&await totp(secret,n)===code)return n;return null;}
async function preAuth(req,env){const value=authHeader(req);if(!value||value.length>200)return null;return env.DB.prepare("SELECT c.*,u.username,u.full_name,u.email,u.role,u.status FROM developer_challenges c JOIN users u ON u.id=c.user_id JOIN developer_grants g ON g.user_id=u.id AND g.revoked_at IS NULL WHERE c.token_hash=? AND c.expires_at>datetime('now') AND c.consumed_at IS NULL AND u.status='active'").bind(await sha(value)).first();}
async function developer(req,env){const value=cookie(req);if(!value||value.length>200)return null;const row=await env.DB.prepare("SELECT u.id,u.username,u.full_name,u.email,u.role,u.status,u.created_at FROM developer_sessions s JOIN users u ON u.id=s.user_id JOIN developer_grants g ON g.user_id=u.id AND g.revoked_at IS NULL WHERE s.secret_hash=? AND s.revoked_at IS NULL AND s.expires_at>datetime('now') AND u.status='active'").bind(await sha(value)).first();return row||null;}
async function audit(env,actor,action,metadata=''){await env.DB.prepare("INSERT INTO developer_audit(id,actor_id,action,metadata) VALUES(?,?,?,?)").bind(crypto.randomUUID(),actor,action,String(metadata).slice(0,1200)).run();}
function columns(u){return {id:u.id,fullName:u.full_name,displayName:u.full_name,username:u.username,email:u.email||'',phone:'',contact:u.email||'',role:u.role,status:u.status,createdAt:u.created_at};}
export async function handleDeveloper(req,env,h){
 const path=new URL(req.url).pathname,method=req.method;
 try{
  if(method==='POST'&&path==='/api/developer/login'){
   h.verifyOrigin(req);
   const b=await jsonBody(req),identifier=String(b.identifier||'').trim().toLowerCase(),password=String(b.password||'');
   const throttle=await h.enforceAuthRateLimit(req,env,'developer-login',identifier,5,900);
   if(throttle)return throttle;
   if(!identifier||!password||password.length>128)return fail('بيانات الدخول غير صحيحة',401);
   const u=await env.DB.prepare("SELECT u.* FROM users u JOIN developer_grants g ON g.user_id=u.id AND g.revoked_at IS NULL WHERE (u.username=? OR u.email=?) AND u.status='active'").bind(identifier,identifier).first();
   // Derive a real PBKDF2 hash even when the account is absent, to limit timing leaks.
   const salt=u?.password_salt||'AAAAAAAAAAAAAAAAAAAAAA';
   const hash=await h.hash(password,salt);
   // Compare derived keys without an early-exit string comparison.
   const actual=decode(hash),expected=decode(u?.password_hash||'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
   let mismatch=actual.length^expected.length;
   for(let i=0;i<Math.max(actual.length,expected.length);i++)mismatch|=(actual[i]||0)^(expected[i]||0);
   if(!u||mismatch)return fail('بيانات الدخول غير صحيحة',401);
   const pre=rand();
   // Enrollment requires moving between the browser and an authenticator app.
   // A 15-minute pre-auth token is still one-time and never grants admin access.
   await env.DB.prepare("INSERT INTO developer_challenges(id,user_id,token_hash,expires_at) VALUES(?,?,?,datetime('now','+15 minutes'))").bind(crypto.randomUUID(),u.id,await sha(pre)).run();
   const mfa=await env.DB.prepare('SELECT user_id FROM developer_mfa WHERE user_id=?').bind(u.id).first();
   return j({ok:true,preAuthToken:pre,mfa:{totp:!!mfa,enroll:!mfa}});
  }
  if(method==='POST'&&path==='/api/developer-mfa/totp/enroll'){
   h.verifyOrigin(req);const ch=await preAuth(req,env);if(!ch)return fail('انتهت صلاحية التأكيد؛ أعد تسجيل الدخول',401);
   const existing=await env.DB.prepare('SELECT user_id FROM developer_mfa WHERE user_id=?').bind(ch.user_id).first();
   if(existing)return fail('التحقق الثنائي مسجل مسبقاً',409);
   let secret=ch.enrollment_secret;
   if(!secret){
    // Reuse the very first recent pending enrollment secret for this verified
    // account. Otherwise a fresh password login silently invalidates the key
    // already installed in the owner's authenticator app.
    const pending=await env.DB.prepare("SELECT enrollment_secret FROM developer_challenges WHERE user_id=? AND enrollment_secret IS NOT NULL AND consumed_at IS NULL AND created_at>datetime('now','-24 hours') ORDER BY created_at ASC LIMIT 1").bind(ch.user_id).first();
    secret=pending?.enrollment_secret||base32(crypto.getRandomValues(new Uint8Array(20)));
    await env.DB.prepare('UPDATE developer_challenges SET enrollment_secret=? WHERE id=? AND enrollment_secret IS NULL').bind(secret,ch.id).run();
   }
   const uri='otpauth://totp/'+encodeURIComponent('ShinoMino:'+ch.username)+'?secret='+encodeURIComponent(secret)+'&issuer=ShinoMino&algorithm=SHA1&digits=6&period=30';
   return j({ok:true,secret,otpauth:uri});
  }
  if(method==='POST'&&path==='/api/developer-mfa/totp/verify'){
   h.verifyOrigin(req);const ch=await preAuth(req,env);if(!ch)return fail('انتهت صلاحية التأكيد؛ أعد تسجيل الدخول',401);
   const limited=await h.enforceAuthRateLimit(req,env,'developer-mfa',ch.user_id,8,900);if(limited)return limited;
   const b=await jsonBody(req),record=await env.DB.prepare('SELECT secret,last_counter FROM developer_mfa WHERE user_id=?').bind(ch.user_id).first();
   const enrolling=!record,secret=record?.secret||ch.enrollment_secret;if(!secret)return fail('قم بإعداد تطبيق المصادقة أولاً',409);
   const counter=await matchedCounter(secret,String(b.code||''),Number(record?.last_counter??-1));if(counter===null)return fail('رمز المصادقة غير صحيح أو مستخدم سابقاً',401);
   // One-time consume ensures concurrent MFA attempts cannot mint duplicate sessions.
   const consumed=await env.DB.prepare("UPDATE developer_challenges SET consumed_at=CURRENT_TIMESTAMP WHERE id=? AND consumed_at IS NULL AND expires_at>datetime('now')").bind(ch.id).run();
   if(!consumed.meta.changes)return fail('انتهى طلب التأكيد',401);
   if(enrolling){try{await env.DB.prepare('INSERT INTO developer_mfa(user_id,secret,last_counter) VALUES(?,?,?)').bind(ch.user_id,secret,counter).run();}catch{return fail('تم إعداد التحقق مسبقاً، أعد تسجيل الدخول',409);}}
   else {const changed=await env.DB.prepare('UPDATE developer_mfa SET last_counter=? WHERE user_id=? AND last_counter<?').bind(counter,ch.user_id,counter).run();if(!changed.meta.changes)return fail('رمز مستخدم سابقاً',401);}
   const session=rand();await env.DB.prepare("INSERT INTO developer_sessions(id,user_id,secret_hash,expires_at) VALUES(?,?,?,datetime('now','+12 hours'))").bind(crypto.randomUUID(),ch.user_id,await sha(session)).run();
   await audit(env,ch.user_id,'developer.mfa.login');
   return new Response(JSON.stringify({ok:true,verified:true}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':devCookie(session,43200)}});
  }
  if(method==='POST'&&path==='/api/developer/logout'){h.verifyOrigin(req);const token=cookie(req);if(token)await env.DB.prepare('UPDATE developer_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE secret_hash=?').bind(await sha(token)).run();return new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':devCookie('',0)}});}
  const actor=await developer(req,env);if(!actor)return fail('يلزم دخول المطور والتحقق الثنائي',401);
  if(!['GET','HEAD'].includes(method))h.verifyOrigin(req);
  if(method==='GET'&&(path==='/api/developer/me'||path==='/api/developer/session')){
   const rec=await env.DB.prepare('SELECT user_id FROM developer_mfa WHERE user_id=?').bind(actor.id).first();
   return j({ok:true,user:safe(actor),security:{phonePaired:false,fidoKeys:0,totpEnabled:!!rec}});
  }
  if(method==='GET'&&(path==='/api/developer/dashboard'||path==='/api/developer/stats')){
   const x=await env.DB.prepare("SELECT (SELECT count(*) FROM users) AS users,(SELECT count(*) FROM users WHERE status='blocked') AS blocked,(SELECT count(*) FROM ad_records WHERE status='pending') AS pending,(SELECT count(*) FROM ad_records) AS ads,(SELECT count(*) FROM posts) AS posts").first();
   return j({ok:true,stats:{...x,pendingUsers:0,pendingStores:0,stores:0,reports:0,rooms:0,conversations:0,online:0,subscriptions:0,activeChats:0},services:{api:'online',database:'online'},recentRequests:[]});
  }
  if(method==='GET'&&path==='/api/developer/users'){
   const url=new URL(req.url),search=String(url.searchParams.get('q')||'').trim().toLowerCase().slice(0,80),status=String(url.searchParams.get('status')||'');
   const params=[],where=["role='user'","NOT EXISTS (SELECT 1 FROM developer_grants g WHERE g.user_id=users.id AND g.revoked_at IS NULL)"];if(['active','blocked'].includes(status)){where.push('status=?');params.push(status);}
   if(search){where.push("(lower(username) LIKE ? OR lower(full_name) LIKE ? OR lower(COALESCE(email,'')) LIKE ?)");const v='%'+search.replace(/[%_]/g,'')+'%';params.push(v,v,v);}
   const rows=await env.DB.prepare('SELECT id,username,full_name,email,role,status,created_at FROM users WHERE '+where.join(' AND ')+' ORDER BY created_at DESC LIMIT 500').bind(...params).all();
   return j({ok:true,users:(rows.results||[]).map(columns)});
  }
  if(method==='GET'&&path==='/api/developer/admins'){
   const rows=await env.DB.prepare("SELECT u.id,u.username,u.full_name,u.email,CASE WHEN g.user_id IS NOT NULL THEN 'developer' ELSE u.role END AS role,u.status,u.created_at FROM users u LEFT JOIN developer_grants g ON g.user_id=u.id AND g.revoked_at IS NULL WHERE (u.role IN ('admin','developer') OR g.user_id IS NOT NULL) ORDER BY u.created_at DESC LIMIT 200").all();
   return j({ok:true,admins:(rows.results||[]).map(columns)});
  }
  if(method==='GET'&&path==='/api/developer/approvals'){
   const rows=await env.DB.prepare("SELECT a.post_id AS id,a.title AS applicant,a.category AS typeLabel,a.contact AS details,a.created_at AS createdAt,u.username FROM ad_records a JOIN posts p ON p.id=a.post_id JOIN users u ON u.id=p.author_id WHERE a.status='pending' ORDER BY a.created_at DESC LIMIT 200").all();
   const approvals=(rows.results||[]).map(x=>({...x,type:'advertisement'}));return j({ok:true,approvals,users:[],stores:[],advertisements:approvals});
  }
  if(method==='GET'&&path==='/api/developer/audit'){
   const rows=await env.DB.prepare('SELECT a.id,a.action,a.metadata AS details,a.created_at AS createdAt,u.full_name AS actorName,u.username AS actorUsername FROM developer_audit a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 200').all();
   return j({ok:true,audit:(rows.results||[]).map(x=>({...x,actor:{fullName:x.actorName,username:x.actorUsername}}))});
  }
  if(method==='GET'&&path==='/api/developer/rooms')return fail('إدارة الغرف قيد النقل إلى D1',501);
  if(method==='GET'&&path==='/api/developer/room-reports')return fail('البلاغات قيد النقل إلى D1',501);
  if(path==='/api/developer/modules/ticker/manage'&&method==='GET'){
   const rows=await env.DB.prepare('SELECT id,text,type,priority,enabled,created_at AS createdAt FROM developer_ticker ORDER BY priority DESC,created_at DESC LIMIT 200').all();return j({ok:true,items:(rows.results||[]).map(x=>({...x,enabled:!!x.enabled}))});
  }
  if(path==='/api/developer/modules/ticker/manage'&&method==='POST'){
   const b=await jsonBody(req),value=String(b.text||'').trim(),type=String(b.type||'notice'),priority=Number(b.priority||0);
   if(!value||value.length>300||!['notice','guidance','ad'].includes(type)||!Number.isInteger(priority)||priority<0||priority>100)return fail('بيانات الرسالة غير صالحة');
   const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO developer_ticker(id,text,type,priority) VALUES(?,?,?,?)').bind(id,value,type,priority).run();await audit(env,actor.id,'ticker.created',id);return j({ok:true,id},201);
  }
  const ticker=path.match(/^\/api\/developer\/modules\/ticker\/manage\/([a-f0-9-]{36})$/i);
  if(ticker&&method==='PATCH'){const b=await jsonBody(req);const row=await env.DB.prepare('SELECT * FROM developer_ticker WHERE id=?').bind(ticker[1]).first();if(!row)return fail('الرسالة غير موجودة',404);
   const value=b.text===undefined?row.text:String(b.text).trim(),type=b.type===undefined?row.type:String(b.type),priority=b.priority===undefined?row.priority:Number(b.priority),enabled=b.enabled===undefined?row.enabled:(b.enabled?1:0);
   if(!value||value.length>300||!['notice','guidance','ad'].includes(type)||!Number.isInteger(priority)||priority<0||priority>100)return fail('بيانات غير صالحة');
   await env.DB.prepare('UPDATE developer_ticker SET text=?,type=?,priority=?,enabled=? WHERE id=?').bind(value,type,priority,enabled,ticker[1]).run();await audit(env,actor.id,'ticker.updated',ticker[1]);return j({ok:true});
  }
  if(ticker&&method==='DELETE'){await env.DB.prepare('DELETE FROM developer_ticker WHERE id=?').bind(ticker[1]).run();await audit(env,actor.id,'ticker.deleted',ticker[1]);return j({ok:true});}
  const uPath=path.match(/^\/api\/developer\/(users|admins)\/([a-f0-9-]{36})$/i);
  if(uPath&&method==='PATCH'){
   const b=await jsonBody(req),target=await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(uPath[2]).first();
   if(!target||target.role!==(uPath[1]==='users'?'user':'admin'))return fail('الحساب غير موجود أو محمي',404);
   if(await env.DB.prepare('SELECT user_id FROM developer_grants WHERE user_id=? AND revoked_at IS NULL').bind(target.id).first())return fail('حساب المطور محمي',403);
   const updates=[],values=[];
   if(b.status!==undefined){if(!['active','blocked'].includes(b.status))return fail('الحالة غير صالحة');updates.push('status=?');values.push(b.status);}
   if(b.fullName!==undefined){const v=String(b.fullName).trim();if(v.length<2||v.length>100)return fail('الاسم غير صالح');updates.push('full_name=?');values.push(v);}
   if(b.username!==undefined){const v=String(b.username).trim().toLowerCase();if(!/^[\p{L}\p{M}0-9_.]{3,30}$/u.test(v))return fail('اسم المستخدم غير صالح');updates.push('username=?');values.push(v);}
   if(b.email!==undefined){const v=String(b.email).trim().toLowerCase();if(v&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))return fail('البريد غير صالح');updates.push('email=?');values.push(v||null);}
   if(!updates.length)return fail('لا توجد حقول قابلة للتعديل');
   try{await env.DB.prepare('UPDATE users SET '+updates.join(',')+' WHERE id=?').bind(...values,uPath[2]).run();}catch{return fail('بيانات الحساب مستخدمة أو غير صالحة',409);}
   await audit(env,actor.id,'user.updated',uPath[2]);return j({ok:true});
  }
  if(method==='POST'&&(path==='/api/developer/users'||path==='/api/developer/admins')){
   const b=await jsonBody(req),fullName=String(b.fullName||'').trim(),username=String(b.username||'').trim().toLowerCase(),email=String(b.email||b.contact||'').trim().toLowerCase(),password=String(b.password||''),role=path.endsWith('/admins')?'admin':'user';
   if(fullName.length<2||fullName.length>100||!/^[\p{L}\p{M}0-9_.]{3,30}$/u.test(username)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<10||password.length>128)return fail('الاسم واسم المستخدم والبريد وكلمة المرور (10 أحرف) مطلوبة');
   const salt=b64(crypto.getRandomValues(new Uint8Array(16))),hash=await h.hash(password,salt),id=crypto.randomUUID();
   try{await env.DB.prepare("INSERT INTO users(id,username,full_name,email,password_salt,password_hash,role,status) VALUES(?,?,?,?,?,?,?,'active')").bind(id,username,fullName,email,salt,hash,role).run();}catch{return fail('اسم المستخدم أو البريد مستخدم مسبقاً',409);}
   await audit(env,actor.id,role+'.created',id);return j({ok:true,id},201);
  }
  if(method==='DELETE'&&uPath?.[1]==='users'){
   const target=await env.DB.prepare("SELECT role FROM users WHERE id=?").bind(uPath[2]).first();if(target?.role!=='user')return fail('الحساب غير موجود أو محمي',404);
   if(await env.DB.prepare('SELECT user_id FROM developer_grants WHERE user_id=? AND revoked_at IS NULL').bind(uPath[2]).first())return fail('حساب المطور محمي',403);
   await env.DB.prepare("DELETE FROM users WHERE id=? AND role='user'").bind(uPath[2]).run();await audit(env,actor.id,'user.deleted',uPath[2]);return j({ok:true});
  }
  const review=path.match(/^\/api\/developer\/approvals\/([a-f0-9-]{36})\/(approve|reject)$/i);
  if(review&&method==='PATCH'){
   const b=await jsonBody(req),status=review[2]==='approve'?'approved':'rejected',note=String(b.reason||'').slice(0,500);
   const result=await env.DB.prepare("UPDATE ad_records SET status=?,review_note=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE post_id=? AND status='pending'").bind(status,note,actor.id,review[1]).run();
   if(!result.meta.changes)return fail('الطلب غير موجود أو تمت مراجعته',409);await audit(env,actor.id,'ad.'+status,review[1]);return j({ok:true});
  }
  if(path.startsWith('/api/developer/modules/'))return fail('هذه الخدمة قيد نقلها إلى Cloudflare',501);
  return fail('وظيفة الإدارة غير متاحة بعد على Cloudflare',501);
 }catch(error){if(error?.status)return fail(error.message,error.status);console.error('Developer D1 API error',String(error));return fail('تعذر تنفيذ العملية الإدارية',500);}
}
