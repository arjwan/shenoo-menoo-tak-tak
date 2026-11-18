import { getAuthenticatedAppUser } from '../../cloudflare/pages/profile-session.js';

const reply = (body, status=200) => Response.json(body, {status, headers: {'Cache-Control':'no-store'}});
export async function onRequest({request,env}) {
  if (!env.DB) return reply({ok:false,message:'Push storage unavailable'},503);
  const origin=request.headers.get('Origin');
  if(origin && origin !== new URL(request.url).origin) return reply({ok:false},403);
  if(!origin && request.headers.get('Sec-Fetch-Site')==='cross-site') return reply({ok:false},403);
  const user=await getAuthenticatedAppUser(request,env);
  if(!user) return reply({ok:false,message:'Sign in required'},401);
  if(!['POST','DELETE'].includes(request.method))return reply({ok:false},405);
  if(!(request.headers.get('Content-Type')||'').includes('application/json'))return reply({ok:false},415);
  const text=await request.text();
  if(text.length>5000)return reply({ok:false},413);
  let data;try{data=JSON.parse(text)}catch{return reply({ok:false},400)}
  const token=data?.token;
  if(typeof token!=='string'||token.length<40||token.length>4096||! /^[a-zA-Z0-9_:\-]+$/.test(token))
    return reply({ok:false,message:'Invalid device token'},400);
  try {
    if(request.method==='DELETE')
      await env.DB.prepare('DELETE FROM call_push_tokens WHERE token=? AND user_id=?').bind(token,user.id).run();
    else
      await env.DB.prepare("INSERT INTO call_push_tokens(token,user_id,platform,updated_at) VALUES(?,?,'android',unixepoch()) ON CONFLICT(token) DO UPDATE SET user_id=excluded.user_id,updated_at=unixepoch()").bind(token,user.id).run();
    return reply({ok:true});
  } catch(error) {
    console.error('Call push token storage failed',String(error?.message||error));
    return reply({ok:false,message:'Device token storage unavailable'},503);
  }
}
