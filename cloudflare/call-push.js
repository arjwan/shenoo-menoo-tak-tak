// Firebase Cloud Messaging HTTP v1. The credential is a server-side Cloudflare
// secret, never an asset or client-visible environment value.
const encoder = new TextEncoder();
const b64 = data => btoa(String.fromCharCode(...new Uint8Array(data)))
  .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
function parseCredential(env) {
  if (!env.FCM_SERVICE_ACCOUNT_JSON) return null;
  const account=JSON.parse(env.FCM_SERVICE_ACCOUNT_JSON);
  if (account.project_id!=='shinomino-call' ||
      !account.client_email?.endsWith('@shinomino-call.iam.gserviceaccount.com') ||
      !account.private_key?.includes('BEGIN PRIVATE KEY')) throw Error('Invalid FCM service credential');
  return account;
}
let cached=null;
async function accessToken(account) {
  const now=Math.floor(Date.now()/1000);
  if(cached?.email===account.client_email && cached.exp>now+90)return cached.token;
  const header=b64(encoder.encode(JSON.stringify({alg:'RS256',typ:'JWT'})));
  const claim=b64(encoder.encode(JSON.stringify({
    iss:account.client_email,
    scope:'https://www.googleapis.com/auth/firebase.messaging',
    aud:'https://oauth2.googleapis.com/token',
    iat:now, exp:now+3300
  })));
  const keyData=Uint8Array.from(atob(account.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,'')),c=>c.charCodeAt(0));
  const key=await crypto.subtle.importKey('pkcs8',keyData,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const sig=b64(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,encoder.encode(header+'.'+claim)));
  const res=await fetch('https://oauth2.googleapis.com/token',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:header+'.'+claim+'.'+sig})
  });
  if(!res.ok)throw Error('FCM OAuth token request HTTP '+res.status);
  const body=await res.json();
  cached={email:account.client_email,token:body.access_token,exp:now+Math.min(3300,body.expires_in||3300)};
  return cached.token;
}
export async function pushIncomingCall(env,{recipient,callId,conversationId,from,callerName,type,kind='call:invite'}) {
  const account=parseCredential(env);
  if(!account)return;
  const tokens=await env.DB.prepare('SELECT token FROM call_push_tokens WHERE user_id=? ORDER BY updated_at DESC LIMIT 10').bind(recipient).all();
  if(!tokens.results?.length)return;
  const bearer=await accessToken(account);
  await Promise.allSettled(tokens.results.map(async row=>{
    const res=await fetch('https://fcm.googleapis.com/v1/projects/shinomino-call/messages:send',{
      method:'POST',
      headers:{Authorization:'Bearer '+bearer,'Content-Type':'application/json'},
      body:JSON.stringify({message:{
        token:row.token,
        android:{priority:'HIGH',ttl:kind==='call:missed'?'3600s':'30s'},
        data:{kind,callId,conversationId,from,callerName:(callerName||'مستخدم شنو منو').slice(0,100),type}
      }})
    });
    if(res.status===404||res.status===400) {
      const error=await res.json().catch(()=>({}));
      if(JSON.stringify(error).includes('UNREGISTERED'))
        await env.DB.prepare('DELETE FROM call_push_tokens WHERE token=?').bind(row.token).run();
    }
    if(!res.ok)console.warn('FCM delivery request failed',res.status);
  }));
}
