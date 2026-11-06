// Cloudflare D1 management routes; invoked after developer session + origin checks.
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const fail=(message,status=400)=>reply({ok:false,message},status);
const body=async request=>{const v=await request.json().catch(()=>null);if(!v||typeof v!=='object'||Array.isArray(v))throw {status:400,message:'طلب غير صالح'};return v;};
const log=async(env,actor,action,target)=>env.DB.prepare('INSERT INTO developer_audit(id,actor_id,action,metadata) VALUES(?,?,?,?)').bind(crypto.randomUUID(),actor,action,target).run();
const bool=v=>typeof v==='boolean'?Number(v):null;
export async function handleDeveloperManagement(req,env,actor){
 const url=new URL(req.url),path=url.pathname,method=req.method,db=env.DB;
 try{
  if(path==='/api/developer/rooms'&&method==='GET'){
   const rows=await db.prepare("SELECT r.*,u.full_name AS owner_name, (SELECT COUNT(*) FROM developer_room_members m WHERE m.room_id=r.id) AS member_count FROM developer_rooms r LEFT JOIN users u ON u.id=r.owner_id ORDER BY r.created_at DESC LIMIT 300").all();
   return reply({ok:true,rooms:(rows.results||[]).map(r=>({id:r.id,name:r.name,roomType:r.room_type,privacy:r.privacy,owner:{id:r.owner_id,fullName:r.owner_name||'—'},memberCount:r.member_count,isActive:!!r.is_active,isLocked:!!r.is_locked,isOfficial:!!r.is_official,createdAt:r.created_at}))});
  }
  if(path==='/api/developer/rooms'&&method==='POST'){
   const b=await body(req),name=String(b.name||'').trim(),roomType=String(b.roomType||'group'),privacy=String(b.privacy||'public');
   if(name.length<2||name.length>120||!['group','channel','support'].includes(roomType)||!['public','private'].includes(privacy))return fail('إعدادات الغرفة غير صالحة');
   const id=crypto.randomUUID();await db.prepare('INSERT INTO developer_rooms(id,name,room_type,privacy,owner_id) VALUES(?,?,?,?,?)').bind(id,name,roomType,privacy,null).run();
   await log(env,actor.id,'room.created',id);return reply({ok:true,id},201);
  }
  const room=path.match(/^\/api\/developer\/rooms\/([0-9a-f-]{36})$/i);
  if(room&&method==='PATCH'){
   const r=await db.prepare('SELECT * FROM developer_rooms WHERE id=?').bind(room[1]).first();if(!r)return fail('الغرفة غير موجودة',404);
   const b=await body(req),set=[],args=[];
   for(const [key,col] of [['isActive','is_active'],['isLocked','is_locked'],['isOfficial','is_official']]){
    if(b[key]!==undefined){const value=bool(b[key]);if(value===null)return fail('قيمة الحالة يجب أن تكون منطقية');set.push(col+'=?');args.push(value)}
   }
   if(b.ownerId!==undefined){
    const owner=String(b.ownerId||'').trim();
    if(owner&&!await db.prepare("SELECT id FROM users WHERE id=? AND status='active'").bind(owner).first())return fail('المالك الجديد غير موجود أو غير نشط',404);
    set.push('owner_id=?');args.push(owner||null);
   }
   if(!set.length)return fail('لا توجد تغييرات');
   await db.prepare('UPDATE developer_rooms SET '+set.join(',')+' WHERE id=?').bind(...args,room[1]).run();
   await log(env,actor.id,'room.updated',room[1]);return reply({ok:true});
  }
  if(path==='/api/developer/room-reports'&&method==='GET'){
   const rows=await db.prepare('SELECT r.*,dr.name AS room_name,u.username AS reporter_username,u.full_name AS reporter_name FROM developer_room_reports r JOIN developer_rooms dr ON dr.id=r.room_id LEFT JOIN users u ON u.id=r.reporter_id ORDER BY r.created_at DESC LIMIT 300').all();
   return reply({ok:true,reports:(rows.results||[]).map(r=>({id:r.id,group:{id:r.room_id,name:r.room_name},reporter:{username:r.reporter_username,fullName:r.reporter_name},reason:r.reason,status:r.status,resolution:r.resolution,createdAt:r.created_at}))});
  }
  const report=path.match(/^\/api\/developer\/room-reports\/([0-9a-f-]{36})$/i);
  if(report&&method==='PATCH'){
   const b=await body(req),status=String(b.status||''),resolution=String(b.resolution||'').trim();
   if(!['reviewing','resolved','dismissed'].includes(status)||resolution.length>2000)return fail('حالة البلاغ غير صالحة');
   const changed=await db.prepare("UPDATE developer_room_reports SET status=?,resolution=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('pending','reviewing')").bind(status,resolution,actor.id,report[1]).run();
   if(!changed.meta.changes)return fail('البلاغ غير موجود أو تمت مراجعته مسبقاً',409);
   await log(env,actor.id,'room.report.'+status,report[1]);return reply({ok:true});
  }
  if(path==='/api/developer/modules/providers/admin/pending'&&method==='GET'){
   const rows=await db.prepare("SELECT p.*,u.full_name AS owner_name,u.username AS owner_username FROM developer_service_providers p LEFT JOIN users u ON u.id=p.owner_id WHERE p.status='pending' ORDER BY p.created_at DESC LIMIT 200").all();
   return reply({ok:true,providers:(rows.results||[]).map(r=>({id:r.id,name:r.name,category:r.category,status:r.status,owner:{fullName:r.owner_name,username:r.owner_username},createdAt:r.created_at}))});
  }
  const provider=path.match(/^\/api\/developer\/modules\/providers\/admin\/([0-9a-f-]{36})\/status$/i);
  if(provider&&method==='PATCH'){
   const b=await body(req),status=String(b.status||''),note=String(b.reason||'').trim().slice(0,500);
   if(!['approved','rejected'].includes(status))return fail('الحالة غير صالحة');
   const changed=await db.prepare("UPDATE developer_service_providers SET status=?,review_note=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(status,note,actor.id,provider[1]).run();
   if(!changed.meta.changes)return fail('مقدم الخدمة غير موجود أو تمت مراجعته',409);
   await log(env,actor.id,'provider.'+status,provider[1]);return reply({ok:true});
  }
  if(path==='/api/developer/modules/approvals'&&method==='GET'){
   const rows=await db.prepare("SELECT r.*,u.username AS username,u.full_name AS applicant_name FROM developer_service_requests r LEFT JOIN users u ON u.id=r.applicant_id WHERE r.status='pending' ORDER BY r.created_at DESC LIMIT 200").all();
   return reply({ok:true,approvals:(rows.results||[]).map(r=>({id:r.id,type:r.type,applicant:r.applicant_name||r.title,username:r.username||'',typeLabel:r.type,details:r.details,createdAt:r.created_at}))});
  }
  const request=path.match(/^\/api\/developer\/modules\/approvals\/(service|advertisement|provider)\/([0-9a-f-]{36})\/(approve|reject)$/i);
  if(request&&method==='PATCH'){
   const b=await body(req),status=request[3]==='approve'?'approved':'rejected',note=String(b.reason||'').trim().slice(0,500);
   if(status==='rejected'&&!note)return fail('سبب الرفض مطلوب');
   const changed=await db.prepare("UPDATE developer_service_requests SET status=?,review_note=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND type=? AND status='pending'").bind(status,note,actor.id,request[2],request[1]).run();
   if(!changed.meta.changes)return fail('الطلب غير موجود أو تمت مراجعته',409);
   await log(env,actor.id,'service.'+status,request[2]);return reply({ok:true});
  }
  return null;
 }catch(e){
  if(e?.status)return fail(e.message,e.status);
  console.error('developer management D1 error',String(e?.message||e).slice(0,200));
  return fail('تعذر تنفيذ الطلب الإداري',500);
 }
}
