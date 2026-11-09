// Shared D1 group chat and WebRTC mesh signaling for Shno Mano web + standalone Android.
// All operations are bound to the authenticated session, never a client-provided sender.
const out=(body,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const events=new Set(["invite","join","leave","end","offer","answer","ice","media"]);
const readJson=async req=>{try{const b=await req.json();return b&&typeof b==="object"&&!Array.isArray(b)?b:null}catch(_){return null}};
async function isMember(db,group,user){return !!await db.prepare("SELECT 1 FROM shno_call_group_members WHERE group_id=? AND user_id=?").bind(group,user).first()}
async function allowedInvite(db,a,b){
 return !!await db.prepare("SELECT 1 FROM conversation_pairs WHERE (user_low=? AND user_high=?) OR (user_low=? AND user_high=?)").bind(a,b,b,a).first();
}
export async function handleCallGroups(req,env,user){
 const url=new URL(req.url),path=url.pathname;
 if(!path.startsWith("/api/call-groups"))return null;
 if(!env.DB)return out({ok:false,message:"قاعدة المكالمات غير مهيأة"},503);
 const db=env.DB,parts=path.split("/").filter(Boolean);
 const method=req.method;
 if(!["GET","POST"].includes(method))return out({ok:false,message:"الطريقة غير مدعومة"},405);
 if(method==="POST"){
  const origin=req.headers.get("Origin"),site=req.headers.get("Sec-Fetch-Site");
  if((origin&&origin!==url.origin)||(!origin&&site==="cross-site"))return out({ok:false,message:"المصدر غير موثوق"},403);
 }
 if(parts.length===2){
  if(method==="GET"){
   const q=await db.prepare("SELECT g.id,g.name,g.owner_id,g.created_at,(SELECT COUNT(*) FROM shno_call_group_members x WHERE x.group_id=g.id) AS member_count FROM shno_call_groups g JOIN shno_call_group_members m ON m.group_id=g.id WHERE m.user_id=? ORDER BY g.created_at DESC LIMIT 70").bind(user.id).all();
   return out({ok:true,groups:q.results.map(g=>({id:g.id,name:g.name,ownerId:g.owner_id,memberCount:g.member_count,createdAt:g.created_at}))});
  }
  const body=await readJson(req),name=String(body?.name||"").trim(),requested=body?.members;
  if(name.length<2||name.length>80||!Array.isArray(requested))return out({ok:false,message:"اسم المجموعة أو الأعضاء غير صالح"},400);
  const members=[...new Set(requested.map(String))].filter(u=>u!==user.id);
  if(members.length<1||members.length>7||members.some(u=>!uuid.test(u)))return out({ok:false,message:"اختر من 1 إلى 7 أعضاء"},400);
  for(const member of members)if(!await allowedInvite(db,user.id,member))return out({ok:false,message:"إضافة أعضاء من محادثاتك المسموح بها فقط"},403);
  const group=crypto.randomUUID();
  await db.batch([
   db.prepare("INSERT INTO shno_call_groups(id,name,owner_id) VALUES(?,?,?)").bind(group,name,user.id),
   db.prepare("INSERT INTO shno_call_group_members(group_id,user_id) VALUES(?,?)").bind(group,user.id),
   ...members.map(u=>db.prepare("INSERT INTO shno_call_group_members(group_id,user_id) VALUES(?,?)").bind(group,u))
  ]);
  return out({ok:true,group:{id:group,name,ownerId:user.id,memberCount:members.length+1}},201);
 }
 if(parts.length===3&&parts[2]==="alerts"&&method==="GET"){
  const after=Number(url.searchParams.get("after")||0);
  if(!Number.isSafeInteger(after)||after<0)return out({ok:false,message:"مؤشر إشعارات غير صالح"},400);
  const rows=await db.prepare("SELECT s.id,s.group_id,s.call_id,s.sender_id,s.event,g.name FROM shno_call_group_signals s JOIN shno_call_groups g ON g.id=s.group_id JOIN shno_call_group_members m ON m.group_id=s.group_id AND m.user_id=s.recipient_id WHERE s.recipient_id=? AND s.event='invite' AND s.id>? AND s.expires_at>unixepoch() ORDER BY s.id ASC LIMIT 60").bind(user.id,after).all();
  const invites=rows.results.map(s=>({id:s.id,groupId:s.group_id,callId:s.call_id,from:s.sender_id,name:s.name}));
  return out({ok:true,invites,cursor:invites.length?invites[invites.length-1].id:after});
 }
 if(parts.length<3||parts[0]!=="api"||parts[1]!=="call-groups"||!uuid.test(parts[2]))return out({ok:false,message:"المجموعة غير صالحة"},400);
 const group=parts[2];
 if(!await isMember(db,group,user.id))return out({ok:false,message:"ليس لديك صلاحية الوصول إلى المجموعة"},403);
 if(parts.length===3&&method==="GET"){
  const g=await db.prepare("SELECT id,name,owner_id,created_at FROM shno_call_groups WHERE id=?").bind(group).first();
  const m=await db.prepare("SELECT u.id,u.full_name,u.username FROM shno_call_group_members gm JOIN users u ON u.id=gm.user_id WHERE gm.group_id=? AND u.status='active'").bind(group).all();
  return out({ok:true,group:{id:g.id,name:g.name,ownerId:g.owner_id,createdAt:g.created_at},members:m.results.map(x=>({id:x.id,fullName:x.full_name,username:x.username}))});
 }
 if(parts.length!==4)return out({ok:false,message:"المسار غير مدعوم"},404);
 const resource=parts[3];
 if(resource==="members"&&method==="POST"){
  const g=await db.prepare("SELECT owner_id FROM shno_call_groups WHERE id=?").bind(group).first();
  if(g?.owner_id!==user.id)return out({ok:false,message:"إضافة الأعضاء لصاحب المجموعة"},403);
  const body=await readJson(req),other=String(body?.userId||"");
  if(!uuid.test(other)||!await allowedInvite(db,user.id,other))return out({ok:false,message:"عضو غير مسموح"},403);
  const n=await db.prepare("SELECT COUNT(*) AS n FROM shno_call_group_members WHERE group_id=?").bind(group).first();
  if(n.n>=8)return out({ok:false,message:"الحد الأقصى 8 أعضاء"},400);
  await db.prepare("INSERT OR IGNORE INTO shno_call_group_members(group_id,user_id) VALUES(?,?)").bind(group,other).run();
  return out({ok:true});
 }
 if(resource==="messages"){
  if(method==="GET"){
   const after=String(url.searchParams.get("after")||"");
   const rows=after&&uuid.test(after)?await db.prepare("SELECT m.id,m.text,m.sender_id,m.created_at,u.full_name FROM shno_call_group_messages m JOIN users u ON u.id=m.sender_id WHERE m.group_id=? AND m.created_at>=(SELECT created_at FROM shno_call_group_messages WHERE id=? AND group_id=?) ORDER BY m.created_at,m.id LIMIT 80").bind(group,after,group).all():await db.prepare("SELECT m.id,m.text,m.sender_id,m.created_at,u.full_name FROM shno_call_group_messages m JOIN users u ON u.id=m.sender_id WHERE m.group_id=? ORDER BY m.created_at DESC,m.id DESC LIMIT 80").bind(group).all();
   const messages=(after?rows.results:rows.results.reverse()).map(m=>({id:m.id,text:m.text,senderId:m.sender_id,senderName:m.full_name,mine:m.sender_id===user.id,createdAt:m.created_at}));
   return out({ok:true,messages});
  }
  const body=await readJson(req),text=String(body?.text||"").trim();
  if(!text||text.length>5000)return out({ok:false,message:"رسالة غير صالحة"},400);
  const messageId=crypto.randomUUID();
  await db.prepare("INSERT INTO shno_call_group_messages(id,group_id,sender_id,text) VALUES(?,?,?,?)").bind(messageId,group,user.id,text).run();
  return out({ok:true,message:{id:messageId,text,senderId:user.id,mine:true}},201);
 }
 if(resource==="signals"){
  if(method==="GET"){
   const after=Number(url.searchParams.get("after")||0);
   if(!Number.isSafeInteger(after)||after<0)return out({ok:false,message:"مؤشر خاطئ"},400);
   const rows=await db.prepare("SELECT id,call_id,sender_id,event,payload FROM shno_call_group_signals WHERE group_id=? AND recipient_id=? AND id>? AND expires_at>unixepoch() ORDER BY id ASC LIMIT 80").bind(group,user.id,after).all();
   const signals=rows.results.map(x=>({id:x.id,callId:x.call_id,from:x.sender_id,event:x.event,data:JSON.parse(x.payload)}));
   return out({ok:true,signals,cursor:signals.length?signals[signals.length-1].id:after});
  }
  const body=await readJson(req),event=String(body?.event||""),callId=String(body?.callId||""),recipient=String(body?.userId||"");
  const payload=body?.data??{};
  if(!events.has(event)||!uuid.test(callId)||!uuid.test(recipient)||recipient===user.id||!payload||typeof payload!=="object"||Array.isArray(payload))return out({ok:false,message:"إشارة غير صالحة"},400);
  if(JSON.stringify(payload).length>9000)return out({ok:false,message:"الإشارة كبيرة"},413);
  if(!await isMember(db,group,recipient))return out({ok:false,message:"المستلم ليس عضواً"},403);
  const inserted=await db.prepare("INSERT INTO shno_call_group_signals(group_id,call_id,sender_id,recipient_id,event,payload) VALUES(?,?,?,?,?,?)").bind(group,callId,user.id,recipient,event,JSON.stringify(payload)).run();
  return out({ok:true,id:inserted.meta?.last_row_id},201);
 }
 return out({ok:false,message:"مسار غير معروف"},404);
}
