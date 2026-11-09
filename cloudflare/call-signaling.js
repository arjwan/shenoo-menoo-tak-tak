// Short-lived one-to-one WebRTC signaling over the existing authenticated D1 API.
// No legacy bearer tokens, shared broadcast room, or client-supplied sender identity.
const events = new Set(['call:invite','call:accept','call:reject','call:end','webrtc:offer','webrtc:answer','webrtc:ice']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const response = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
export async function handleCallSignaling(req,env,user) {
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
  if(JSON.stringify(safePayload).length>8500)return response({ok:false,message:'إشارة المكالمة كبيرة'},413);
  const inserted=await env.DB.prepare(
    'INSERT INTO private_call_signals(sender_id,recipient_id,conversation_id,call_id,event_type,payload) VALUES(?,?,?,?,?,?)'
  ).bind(user.id,recipient,conversationId,callId,event,JSON.stringify(safePayload)).run();
  // Never disclose signaling to another user: GET always filters by recipient session.
  // Bound retention without a scheduled service; best-effort deletion.
  if(Math.random()<0.03)await env.DB.prepare('DELETE FROM private_call_signals WHERE expires_at<unixepoch()').run().catch(()=>{});
  return response({ok:true,id:inserted.meta?.last_row_id||null},201);
}
