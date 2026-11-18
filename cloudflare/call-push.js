// Wake-up hints contain no caller names, SDP, messages or session secrets.
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function registerCallPush(request,env,user){
 if(!['POST','DELETE'].includes(request.method))return json({ok:false},405);
 const origin=request.headers.get('Origin');
 if(origin&&origin!==new URL(request.url).origin||request.headers.get('Sec-Fetch-Site')==='cross-site')return json({ok:false},403);
 const raw=await request.text();if(raw.length>5000)return json({ok:false},413);
 let data;try{data=JSON.parse(raw)}catch{return json({ok:false},400)}
 if(!uuid.test(data.installationId||''))return json({ok:false},400);
 if(request.method==='DELETE'){
  await env.DB.prepare('DELETE FROM call_push_devices WHERE installation_id=? AND user_id=?').bind(data.installationId,user.id).run();return json({ok:true});
 }
 if(typeof data.token!=='string'||data.token.length<20||data.token.length>4096||!/^[A-Za-z0-9_:\-]+$/.test(data.token))return json({ok:false},400);
 // Bind delivery to the current authenticated session, including logout/revocation.
 const cookie=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-shino_session='))?.slice(21);
 if(!cookie)return json({ok:false},401);
 const hash=b64(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(cookie)));
 const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM call_push_devices WHERE user_id=?').bind(user.id).first();
 if(Number(count?.n)>=10){const own=await env.DB.prepare('SELECT installation_id FROM call_push_devices WHERE installation_id=? AND user_id=?').bind(data.installationId,user.id).first();if(!own)return json({ok:false,message:'عدد الأجهزة المسجلة كبير'},429)}
 await env.DB.prepare('INSERT INTO call_push_devices(installation_id,user_id,session_hash,token,updated_at) VALUES(?,?,?,?,unixepoch()) ON CONFLICT(installation_id) DO UPDATE SET user_id=excluded.user_id,session_hash=excluded.session_hash,token=excluded.token,updated_at=unixepoch()').bind(data.installationId,user.id,hash,data.token).run();
 return json({ok:true,pushConfigured:!!env.SHNO_FCM_SERVICE_ACCOUNT});
}
const b64=buffer=>btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const encode=obj=>b64(new TextEncoder().encode(JSON.stringify(obj)));
let cached=null;
async function oauth(account,fetcher){
 if(cached?.email===account.client_email&&cached.until>Date.now()+60000)return cached.token;
 const now=Math.floor(Date.now()/1000),unsigned=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:account.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
 const der=Uint8Array.from(atob(account.private_key.replace(/-----[^-]+-----|\s/g,'')),x=>x.charCodeAt(0));
 const key=await crypto.subtle.importKey('pkcs8',der,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const signature=b64(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned)));
 const r=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+signature}),signal:AbortSignal.timeout(7000)});
 if(!r.ok)throw Error('FCM OAuth unavailable');const body=await r.json();if(!body.access_token)throw Error('FCM OAuth missing token');
 cached={email:account.client_email,token:body.access_token,until:Date.now()+Math.min(Number(body.expires_in)||3600,3600)*1000};return cached.token;
}
export async function wakeCallDevices(env,recipient,callId,fetcher=fetch){
 if(!env.SHNO_FCM_SERVICE_ACCOUNT)return {configured:false,sent:0};
 const account=JSON.parse(env.SHNO_FCM_SERVICE_ACCOUNT);
 if(!/^[a-z0-9-]+$/.test(account.project_id)||!account.client_email||!account.private_key)throw Error('Invalid FCM configuration');
 const rows=await env.DB.prepare("SELECT d.installation_id,d.token FROM call_push_devices d JOIN auth_sessions a ON a.secret_hash=d.session_hash AND a.user_id=d.user_id JOIN users u ON u.id=d.user_id WHERE d.user_id=? AND a.revoked_at IS NULL AND a.expires_at>datetime('now') AND u.status='active' AND d.updated_at>unixepoch()-2592000 LIMIT 10").bind(recipient).all();
 if(!rows.results.length)return {configured:true,sent:0};
 const token=await oauth(account,fetcher);let sent=0;
 await Promise.all(rows.results.map(async d=>{
  const r=await fetcher('https://fcm.googleapis.com/v1/projects/'+account.project_id+'/messages:send',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({message:{token:d.token,data:{event:'call:wake',callId,recipient},android:{priority:'HIGH',ttl:'30s',collapse_key:'call-'+callId}}}),signal:AbortSignal.timeout(7000)});
  if(r.ok){sent++;return}
  const body=await r.json().catch(()=>({}));
  if(body.error?.details?.some(x=>x.errorCode==='UNREGISTERED'))await env.DB.prepare('DELETE FROM call_push_devices WHERE installation_id=? AND token=?').bind(d.installation_id,d.token).run();
  else throw Error('FCM delivery failed: '+r.status);
 }));
 return {configured:true,sent};
}
