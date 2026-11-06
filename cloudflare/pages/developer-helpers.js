// Portable WebCrypto helpers for Pages Functions (no Node.js compatibility flag required).
// The password KDF matches the existing D1 auth Worker: PBKDF2-SHA256/100000/32.
const encoder = new TextEncoder();
const b64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64 = value => Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4)), c=>c.charCodeAt(0));

async function hash(password, salt) {
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:unb64(salt),iterations:100000,hash:'SHA-256'},key,256);
  return b64(new Uint8Array(bits));
}
function verifyOrigin(request) {
  const origin=request.headers.get('Origin');
  if(origin&&origin!==new URL(request.url).origin)throw {status:403,message:'طلب من مصدر غير موثوق'};
  if(!origin&&request.headers.get('Sec-Fetch-Site')==='cross-site')throw {status:403,message:'طلب من مصدر غير موثوق'};
}
async function enforceAuthRateLimit(request,env,scope,identity,limit,seconds) {
  // The per-project secret is configured as a Pages Functions secret, never in Git.
  if(!env.DEVELOPER_RATE_LIMIT_SECRET)return Response.json({ok:false,message:'حماية المحاولات غير مهيأة'},{status:503});
  const input=scope+':'+(request.headers.get('CF-Connecting-IP')||'unknown')+':'+String(identity||'').trim().toLowerCase();
  const key=await crypto.subtle.importKey('raw',encoder.encode(env.DEVELOPER_RATE_LIMIT_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const digest=b64(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(input))));
  const start=Math.floor(Date.now()/1000/seconds)*seconds;
  const row=await env.DB.prepare('INSERT INTO auth_rate_limits(scope,identifier_hash,window_start,attempts) VALUES(?,?,?,1) ON CONFLICT(scope,identifier_hash,window_start) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(scope,digest,start).first();
  if(Number(row?.attempts)>limit)return Response.json({ok:false,message:'محاولات كثيرة؛ حاول لاحقاً'},{status:429,headers:{'Retry-After':String(seconds-(Math.floor(Date.now()/1000)-start)),'Cache-Control':'no-store'}});
  return null;
}
export const developerHelpers = {hash,verifyOrigin,enforceAuthRateLimit};
