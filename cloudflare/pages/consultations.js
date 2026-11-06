// Consultation providers on D1. Only administrators can approve applications;
// this public route NEVER changes review status.
const response=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const bad=(message,status=400)=>response({ok:false,message},status);
const categories=new Set(['medical','legal','educational','psychological']);
function sameOrigin(req){
 const origin=req.headers.get('Origin');
 return (!origin||origin===new URL(req.url).origin)&&!(req.headers.get('Sec-Fetch-Site')==='cross-site'&&!origin);
}
export async function consultationRequest(request,env,actor=null){
 const url=new URL(request.url),path=url.pathname,method=request.method;
 if(!env.DB)return bad('قاعدة بيانات الاستشارات غير مهيأة',503);
 if(path==='/api/consultations'&&method==='GET'){
  const selected=url.searchParams.get('category')||'';
  if(selected&&!categories.has(selected))return bad('الاختصاص غير صالح');
  const query=selected?
   "SELECT p.id,p.category,p.title,p.specialty,p.bio,p.service_type,p.fee,p.currency,u.id AS user_id,u.username,u.full_name FROM consultation_providers p JOIN users u ON u.id=p.user_id WHERE p.status='approved' AND u.status='active' AND p.category=? ORDER BY p.created_at DESC LIMIT 100":
   "SELECT p.id,p.category,p.title,p.specialty,p.bio,p.service_type,p.fee,p.currency,u.id AS user_id,u.username,u.full_name FROM consultation_providers p JOIN users u ON u.id=p.user_id WHERE p.status='approved' AND u.status='active' ORDER BY p.created_at DESC LIMIT 100";
  const stmt=env.DB.prepare(query);
  const rows=await (selected?stmt.bind(selected):stmt).all();
  return response({ok:true,providers:(rows.results||[]).map(p=>({id:p.id,category:p.category,title:p.title,specialty:p.specialty,bio:p.bio,serviceType:p.service_type,fee:p.fee,currency:p.currency,user:{id:p.user_id,username:p.username,fullName:p.full_name}}))});
 }
 if((path==='/api/consultations/providers'&&method==='POST')||(path==='/api/consultations/mine'&&method==='GET')){
  if(!actor)return bad('يرجى تسجيل الدخول',401);
  if(method==='GET'){
   const data=await env.DB.prepare('SELECT id,category,title,specialty,bio,service_type,fee,currency,status,rejection_reason,created_at FROM consultation_providers WHERE user_id=? ORDER BY created_at DESC').bind(actor.id).all();
   return response({ok:true,providers:(data.results||[]).map(p=>({id:p.id,category:p.category,title:p.title,specialty:p.specialty,bio:p.bio,serviceType:p.service_type,fee:p.fee,currency:p.currency,status:p.status,rejectionReason:p.rejection_reason,createdAt:p.created_at}))});
  }
  if(!sameOrigin(request))return bad('مصدر الطلب غير موثوق',403);
  if(!(request.headers.get('Content-Type')||'').includes('application/json'))return bad('يجب إرسال JSON',415);
  if(Number(request.headers.get('Content-Length')||0)>6500)return bad('حجم البيانات كبير',413);
  const data=await request.json().catch(()=>null);
  if(!data||typeof data!=='object'||Array.isArray(data))return bad('بيانات الطلب غير صالحة');
  const clean=(key,max)=>typeof data[key]==='string'&&data[key].trim().length<=max?data[key].trim():'';
  const category=clean('category',30),title=clean('title',120),specialty=clean('specialty',120),bio=clean('bio',1200),serviceType=clean('serviceType',20);
  const fee=serviceType==='free'?0:Number(data.fee);
  if(!categories.has(category)||!title||!specialty||!bio||!['free','paid'].includes(serviceType)||!Number.isSafeInteger(fee)||fee<0||(serviceType==='paid'&&fee===0)||fee>100000000)return bad('أكمل بيانات المختص والأجرة بشكل صحيح');
  const existing=await env.DB.prepare('SELECT id,status FROM consultation_providers WHERE user_id=? AND category=?').bind(actor.id,category).first();
  if(existing)return bad('لديك طلب في هذا الاختصاص بالفعل',409);
  try{
   const id=crypto.randomUUID();
   await env.DB.prepare("INSERT INTO consultation_providers(id,user_id,category,title,specialty,bio,service_type,fee,status) VALUES(?,?,?,?,?,?,?,?,'pending')").bind(id,actor.id,category,title,specialty,bio,serviceType,fee).run();
   return response({ok:true,message:'تم إرسال طلب تقديم الاستشارات للمراجعة، ولن يظهر قبل الاعتماد',provider:{id,status:'pending'}},201);
  }catch(e){
   if(/UNIQUE|constraint/i.test(String(e?.message||e)))return bad('لديك طلب في هذا الاختصاص بالفعل',409);
   console.error('Consultations D1 application failed',String(e?.message||e).slice(0,160));
   return bad('تعذر إرسال الطلب حالياً',503);
  }
 }
 return bad('المسار غير موجود',404);
}
