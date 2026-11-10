import {getAuthenticatedAppUser} from './profile-session.js';
export async function issueCallIce(request,env,user,fetcher=fetch){
 if(request.method!=='GET')return Response.json({ok:false,message:'الطريقة غير مدعومة'},{status:405});
 if(!env.SHNO_CALL_TURN_KEY||!env.SHNO_CALL_TURN_TOKEN)return Response.json({ok:true,relay:false,iceServers:[{urls:'stun:stun.cloudflare.com:3478'}]},{headers:{'Cache-Control':'private, no-store'}});
 const window=Math.floor(Date.now()/3600000)*3600;
 const rate=await env.DB.prepare("INSERT INTO auth_rate_limits(scope,identifier_hash,window_start,attempts) VALUES('call-turn',?,?,1) ON CONFLICT(scope,identifier_hash,window_start) DO UPDATE SET attempts=attempts+1 RETURNING attempts").bind(user.id,window).first();
 if(Number(rate?.attempts)>12)return Response.json({ok:false,message:'أعد محاولة الاتصال لاحقاً'},{status:429});
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
 try{
  const response=await fetcher('https://rtc.live.cloudflare.com/v1/turn/keys/'+encodeURIComponent(env.SHNO_CALL_TURN_KEY)+'/credentials/generate-ice-servers',{
   method:'POST',headers:{Authorization:'Bearer '+env.SHNO_CALL_TURN_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({ttl:14400,customIdentifier:user.id}),signal:controller.signal});
  if(!response.ok)throw Error('TURN issuer unavailable');
  const result=await response.json();
  const iceServers=(result.iceServers||[]).map(server=>({urls:[].concat(server.urls||[]).filter(url=>/^(stun|turn|turns):(?:stun|turn)\.cloudflare\.com:(3478|443|5349|80)(\?transport=(udp|tcp))?$/.test(url)),...(server.username?{username:server.username,credential:server.credential}:{})})).filter(s=>s.urls.length);
  if(!iceServers.some(s=>s.username&&s.credential))throw Error('Missing relay credentials');
  return Response.json({ok:true,relay:true,expiresIn:14400,iceServers},{headers:{'Cache-Control':'private, no-store'}});
 }catch(_){return Response.json({ok:false,message:'تعذر تجهيز شبكة المكالمة، أعد المحاولة'},{status:503});}
 finally{clearTimeout(timer)}
}
export async function callIceRoute({request,env}){
 const user=env.DB&&await getAuthenticatedAppUser(request,env);
 if(!user)return Response.json({ok:false,message:'يرجى تسجيل الدخول'},{status:401});
 return issueCallIce(request,env,user);
}
