// Native Cloudflare D1 friend QR issuance and one-time friend requests.
// QR is generated locally in the browser. Never send one-time tokens to QR image APIs.
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const fail=(message,status=400)=>json({ok:false,message},status);
const expiryMinutes=10;
function originOK(req){
 const origin=req.headers.get('Origin');
 if(origin&&origin!==new URL(req.url).origin)return false;
 return !(!origin&&req.headers.get('Sec-Fetch-Site')==='cross-site');
}
function base64url(bytes){
 return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
async function tokenHash(token){
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
 return base64url(new Uint8Array(hash));
}
export async function friendQrRequest(request,env,user){
 const pathname=new URL(request.url).pathname;
 if(pathname==='/api/friends/qr'&&request.method==='GET'){
  // Give each issued token 10 minutes; older tokens automatically expire.
  const raw=new Uint8Array(32);crypto.getRandomValues(raw);
  const token=base64url(raw),hash=await tokenHash(token),id=crypto.randomUUID();
  await env.DB.prepare("INSERT INTO friend_qr_tokens(id,user_id,token_hash,expires_at) VALUES(?,?,?,datetime('now','+10 minutes'))")
   .bind(id,user.id,hash).run();
  return json({ok:true,payload:'shnomano://friend?token='+token,expiresInSeconds:expiryMinutes*60});
 }
 if(pathname==='/api/friends/qr/request'&&request.method==='POST'){
  if(!originOK(request))return fail('طلب من مصدر غير موثوق',403);
  const body=await request.json().catch(()=>null);
  const token=body&&typeof body.token==='string'?body.token:'';
  if(!/^[A-Za-z0-9_-]{43}$/.test(token))return fail('رمز QR غير صالح');
  const hash=await tokenHash(token);
  const match=await env.DB.prepare(
   "SELECT id,user_id FROM friend_qr_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at>datetime('now') LIMIT 1"
  ).bind(hash).first();
  if(!match)return fail('انتهت صلاحية رمز QR أو استُخدم مسبقاً',410);
  if(match.user_id===user.id)return fail('هذا رمز حسابك، شاركه مع صديقك',400);
  const receiver=await env.DB.prepare("SELECT id FROM users WHERE id=? AND status='active'").bind(match.user_id).first();
  if(!receiver)return fail('الحساب لم يعد متاحاً',404);
  const existing=await env.DB.prepare(
   "SELECT id,status,sender_id,receiver_id FROM friend_requests WHERE ((sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?)) AND status IN ('pending','accepted') LIMIT 1"
  ).bind(user.id,receiver.id,receiver.id,user.id).first();
  if(existing?.status==='accepted')return fail('هذا المستخدم ضمن أصدقائك بالفعل',409);
  if(existing?.status==='pending')return fail('يوجد طلب صداقة قيد الانتظار بالفعل',409);
  // Conditional consumption prevents replay even if two requests race.
  const consumed=await env.DB.prepare(
   "UPDATE friend_qr_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=? AND used_at IS NULL AND expires_at>datetime('now')"
  ).bind(match.id).run();
  if(consumed.meta?.changes!==1)return fail('الرمز استُخدم مسبقاً',409);
  await env.DB.prepare("INSERT INTO friend_requests(id,sender_id,receiver_id,status) VALUES(?,?,?,'pending')")
   .bind(crypto.randomUUID(),user.id,receiver.id).run();
  return json({ok:true,message:'تم إرسال طلب الصداقة بنجاح'});
 }
 return fail('المسار غير مدعوم',404);
}
