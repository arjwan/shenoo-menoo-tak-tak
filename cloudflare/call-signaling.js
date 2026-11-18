import { pushIncomingCall } from './call-push.js';
// Short-lived one-to-one WebRTC signaling over the existing authenticated D1 API.
// No legacy bearer tokens, shared broadcast room, or client-supplied sender identity.
const events = new Set(['call:invite','call:accept','call:reject','call:end','webrtc:offer','webrtc:answer','webrtc:ice','call:location']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const response = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
export async function handleCallSignaling(req,env,user,waitUntil) {
  const path = new URL(req.url).pathname;
  if(path !== '/api/call-signals') return null;
  if(req.method==='GET') {
    const url = new URL(req.url), raw=url.searchParams.get('after')||'0',after=Number(raw);
    if(!Number.isSafeInteger(after)||after<0)return response({ok:false,message:'مؤشر الإشارات غير صالح'},400);
    const rows=await env.DB.prepare(
      'SELECT s.id,s.sender_id,s.conversation_id,s.call_id,s.event_type,s.payload,u.full_name FROM private_call_signals s JOIN users u ON u.id=s.sender_id WHERE s.recipient_id=? AND s.id>? AND s.expires_at>unixepoch() AND (?<>0 OR s.created_at>=unixepoch()-60) ORDER BY s.id ASC LIMIT 70'
    ).bind(user.id,after,after).all();
    const list=rows.results.map(s=>({
      id:s.id,event:s.event_type,conversationId:s.conversation_id,callId:s.call_id,
      from:s.sender_id,callerName:s.full_name,payload:JSON.parse(s.payload)
    }));
    return response({ok:true,events:list,cursor:list.length?list[list.length-1].id:after});
  }
  if(req.method!=='POST')return response({ok:false,message:'الطريقة غير مدعومة'},405);
  const type=req.headers.get('Content-Type')||'';
  if(!type.includes('application/json'))return response({ok:false,message:'الطلب يجب أن يكون JSON'},415);
  const raw=await req.text();
  if(raw.length>12000)return response({ok:false,message:'الإشارة كبيرة جداً'},413);
  let data;try{data=JSON.parse(raw);}catch(_){return response({ok:false,message:'JSON غير صالح'},400);}
  const event=String(data.event||''), callId=String(data.callId||''),conversationId=String(data.conversationId||''),
        recipient=String(data.userId||''),payload=data.data??null;
  if(!events.has(event)||!uuid.test(callId)||!uuid.test(conversationId)||!uuid.test(recipient)||recipient===user.id)
    return response({ok:false,message:'بيانات المكالمة غير صالحة'},400);
  if(payload!==null&&(typeof payload!=='object'||Array.isArray(payload)))return response({ok:false,message:'بيانات WebRTC غير صالحة'},400);
  const member=await env.DB.prepare('SELECT COUNT(*) AS n FROM conversation_members WHERE conversation_id=? AND user_id IN (?,?)').bind(conversationId,user.id,recipient).first();
  if(Number(member?.n)!==2)return response({ok:false,message:'المكالمة تتطلب محادثة مشتركة مرخصة'},403);
  const target=await env.DB.prepare("SELECT id FROM users WHERE id=? AND status='active'").bind(recipient).first();
  if(!target)return response({ok:false,message:'الجهة غير متاحة'},404);
  const recent=await env.DB.prepare('SELECT COUNT(*) AS n FROM private_call_signals WHERE sender_id=? AND created_at>unixepoch()-10').bind(user.id).first();
  if(Number(recent?.n)>=120)return response({ok:false,message:'عدد إشارات المكالمات كبير؛ أعد المحاولة'},429);
  const safePayload={
    type:data.type==='video'?'video':'audio',
    reason:String(data.reason||'').slice(0,80),
    data:payload
  };
  // Location is disclosed only as an explicitly sent call-scoped event.
  // No location is attached to invites, profile data or FCM notifications.
  if(event==='call:location'){
    // A private call session is required even after its short-lived SDP/ICE signals expire.
    const live=await env.DB.prepare(
      "SELECT call_id FROM call_active_sessions WHERE call_id=? AND conversation_id=? AND ended_at IS NULL AND expires_at>unixepoch() AND ((caller_id=? AND recipient_id=?) OR (caller_id=? AND recipient_id=?)) LIMIT 1"
    ).bind(callId,conversationId,user.id,recipient,recipient,user.id).first();
    if(!live)return response({ok:false,message:'لا يمكن مشاركة الموقع خارج مكالمة نشطة'},403);
    if(!payload || typeof payload!=='object' || Array.isArray(payload))return response({ok:false,message:'بيانات الموقع غير صالحة'},400);
    if(!['city','precise','revoke'].includes(payload.kind))return response({ok:false,message:'نوع الموقع غير صالح'},400);
    if(payload.kind==='city'){
      const city=String(payload.city||'').trim(),province=String(payload.province||'').trim();
      if(!city || !province || city.length>80 || province.length>80 || /[<>\x00-\x1f]/.test(city+province))
        return response({ok:false,message:'اسم المدينة أو المحافظة غير صالح'},400);
      safePayload.data={kind:'city',city,province};
    }else if(payload.kind==='precise'){
      const latitude=payload.latitude,longitude=payload.longitude,accuracy=payload.accuracy;
      if(typeof latitude!=='number'||typeof longitude!=='number'||typeof accuracy!=='number'||
         !Number.isFinite(latitude)||!Number.isFinite(longitude)||!Number.isFinite(accuracy)||
         Math.abs(latitude)>90||Math.abs(longitude)>180||accuracy<0||accuracy>300)
        return response({ok:false,message:'إحداثيات الموقع غير صالحة'},400);
      safePayload.data={kind:'precise',latitude,longitude,accuracy};
    }else safePayload.data={kind:'revoke'};
  }
  if(JSON.stringify(safePayload).length>8500)return response({ok:false,message:'إشارة المكالمة كبيرة'},413);
  const inserted=await env.DB.prepare(
    'INSERT INTO private_call_signals(sender_id,recipient_id,conversation_id,call_id,event_type,payload) VALUES(?,?,?,?,?,?)'
  ).bind(user.id,recipient,conversationId,callId,event,JSON.stringify(safePayload)).run();
  // Call-lifetime metadata contains no location data; it supports consensual
  // sharing after the 120-second signaling retention period.
  if(event==='call:invite'){
    await env.DB.prepare(
      "INSERT INTO call_active_sessions(call_id,conversation_id,caller_id,recipient_id,expires_at) VALUES(?,?,?,?,unixepoch()+14400) ON CONFLICT(call_id) DO NOTHING"
    ).bind(callId,conversationId,user.id,recipient).run();
    await env.DB.prepare(
      "INSERT OR IGNORE INTO call_history(call_id,conversation_id,caller_id,recipient_id,type) VALUES(?,?,?,?,?)"
    ).bind(callId,conversationId,user.id,recipient,safePayload.type).run();
  }else if(event==='call:accept'){
    await env.DB.prepare(
      "UPDATE call_history SET state='answered',answered_at=CURRENT_TIMESTAMP WHERE call_id=? AND recipient_id=? AND caller_id=? AND ended_at IS NULL AND state='ringing'"
    ).bind(callId,user.id,recipient).run();
  }else if(event==='call:end'||event==='call:reject'){
    await env.DB.prepare(
      "UPDATE call_active_sessions SET ended_at=unixepoch() WHERE call_id=? AND conversation_id=? AND ended_at IS NULL"
    ).bind(callId,conversationId).run();
    await env.DB.prepare(
      "UPDATE call_history SET state=CASE WHEN answered_at IS NOT NULL THEN 'answered' WHEN ?='call:reject' THEN 'declined' ELSE 'missed' END,ended_at=CURRENT_TIMESTAMP WHERE call_id=? AND ended_at IS NULL AND (caller_id=? OR recipient_id=?)"
    ).bind(event,callId,user.id,user.id).run();
    if(event==='call:end'){
      const missed=await env.DB.prepare(
        "SELECT caller_id,recipient_id,type FROM call_history WHERE call_id=? AND state='missed'"
      ).bind(callId).first();
      if(missed&&missed.caller_id===user.id&&missed.recipient_id===recipient){
        const caller=await env.DB.prepare('SELECT full_name FROM users WHERE id=?').bind(user.id).first();
        const notice=pushIncomingCall(env,{recipient,callId,conversationId,from:user.id,
          callerName:caller?.full_name||'مستخدم شنو منو',type:missed.type,kind:'call:missed'})
          .catch(e=>console.error('Missed call push failed',String(e?.message||e)));
        if(typeof waitUntil==='function')waitUntil(notice);else await notice;
      }
    }
  }
  // Persist the invite before attempting best-effort device delivery.
  // Push failures must never prevent the existing D1/WebRTC signaling flow.
  if(event==='call:invite') {
    try {
      const caller=await env.DB.prepare('SELECT full_name FROM users WHERE id=?').bind(user.id).first();
      const deliver=pushIncomingCall(env,{
        recipient, callId, conversationId, from:user.id,
        callerName:caller?.full_name||'مستخدم شنو منو',type:safePayload.type
      }).catch(error=>console.error('Call FCM delivery failed',String(error?.message||error)));
      if(typeof waitUntil==='function')waitUntil(deliver);
      else await deliver;
    } catch(error) { console.error('Call push preparation failed',String(error?.message||error)); }
  }
  // Never disclose signaling to another user: GET always filters by recipient session.
  // Bound retention without a scheduled service; best-effort deletion.
  if(Math.random()<0.03)await env.DB.prepare('DELETE FROM private_call_signals WHERE expires_at<unixepoch()').run().catch(()=>{});
  return response({ok:true,id:inserted.meta?.last_row_id||null},201);
}
