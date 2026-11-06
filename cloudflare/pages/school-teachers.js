import { schoolUser } from './school-helpers.js';
import { handleDeveloper } from '../developer-api.js';
import { developerHelpers } from './developer-helpers.js';

const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const failure=(message,status=400)=>reply({ok:false,message},status);
const lists=(v,limit=10)=>Array.isArray(v)?v.map(x=>String(x||'').trim().slice(0,80)).filter(Boolean).slice(0,limit):[];
const parseArray=value=>{try{return JSON.parse(value||'[]')}catch{return []}};
const appRow=r=>({
 id:r.id,applicantId:r.applicant_id,fullName:r.full_name,phone:r.phone,email:r.email,
 subjects:parseArray(r.subjects_json),specialties:parseArray(r.subjects_json),
 stages:parseArray(r.stages_json),grades:parseArray(r.grades_json),sections:parseArray(r.sections_json),
 qualifications:r.qualifications,experience:r.experience,experienceYears:r.experience_years,
 bio:r.bio,notes:r.notes,status:r.status,rejectionReason:r.review_note,
 reviewedBy:r.reviewed_by,reviewedAt:r.reviewed_at,createdAt:r.created_at
});

async function requireDeveloper(context){
 if(!context.env.DB)return {error:failure('قاعدة Cloudflare غير مهيأة',503)};
 const u=new URL('/api/developer/me',context.request.url);
 const headers=new Headers();
 const cookie=context.request.headers.get('Cookie');
 if(cookie)headers.set('Cookie',cookie);
 const response=await handleDeveloper(new Request(u,{method:'GET',headers}),context.env,developerHelpers);
 if(!response.ok)return {error:failure('هذه العملية مخصصة للمطور بعد التحقق الثنائي',401)};
 const body=await response.json().catch(()=>null);
 if(body?.user?.role!=='developer'||!body.user.id)return {error:failure('غير مصرح',403)};
 return {user:body.user};
}

export async function submitTeacher(context){
 if(context.request.method!=='POST')return failure('الطريقة غير مدعومة',405);
 const auth=await schoolUser(context);if(auth.error)return auth.error;
 developerHelpers.verifyOrigin(context.request);
 let b;try{b=await context.request.json()}catch{return failure('طلب غير صالح')};
 if(!b||typeof b!=='object'||Array.isArray(b))return failure('طلب غير صالح');
 const fullName=String(b.fullName||auth.user.fullName||'').trim().slice(0,100);
 const subjects=lists(b.subjects||b.specialties||(b.subject?[b.subject]:[]));
 const stages=lists(b.stages||(b.stage?[b.stage]:[]));
 const grades=lists(b.grades||(b.grade?[b.grade]:[]));
 const sections=lists(b.sections?.length?b.sections:['أ']);
 const phone=String(b.phone||'').trim().slice(0,30);
 const email=String(b.email||'').trim().toLowerCase().slice(0,255);
 const qualifications=String(b.qualifications||'').trim().slice(0,800);
 const experience=String(b.experience||'').trim().slice(0,800);
 const experienceYears=Number(b.experienceYears||0);
 const bio=String(b.bio||'').trim().slice(0,2000);
 const notes=String(b.notes||'').trim().slice(0,800);
 if(fullName.length<2||!subjects.length||!Number.isInteger(experienceYears)||experienceYears<0||experienceYears>80)return failure('الاسم ومادة تدريسية واحدة على الأقل مطلوبان');
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return failure('البريد الإلكتروني غير صالح');
 const active=await context.env.DB.prepare("SELECT id FROM school_teachers WHERE user_id=? AND status='active'").bind(auth.user.id).first();
 if(active)return failure('حسابك مسجل بالفعل كمعلم',409);
 const id=crypto.randomUUID();
 try {
  await context.env.DB.prepare(`INSERT INTO school_teacher_applications
   (id,applicant_id,full_name,phone,email,subjects_json,stages_json,grades_json,sections_json,
    qualifications,experience,experience_years,bio,notes)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
   .bind(id,auth.user.id,fullName,phone,email,JSON.stringify(subjects),JSON.stringify(stages),
    JSON.stringify(grades),JSON.stringify(sections),qualifications,experience,experienceYears,bio,notes).run();
 }catch(error){if(/UNIQUE/i.test(String(error)))return failure('لديك طلب تدريس قيد المراجعة بالفعل',409);throw error}
 return reply({ok:true,message:'تم استلام طلب التدريس للمراجعة',application:{id,fullName,subjects,stages,grades,status:'pending'}},201);
}

export async function listTeacherApplications(context){
 if(context.request.method!=='GET')return failure('الطريقة غير مدعومة',405);
 const auth=await requireDeveloper(context);if(auth.error)return auth.error;
 const p=new URL(context.request.url).searchParams;
 const status=String(p.get('status')||'');
 if(status&&!['pending','approved','rejected'].includes(status))return failure('حالة الطلب غير صالحة');
 const rows=await (status?
  context.env.DB.prepare('SELECT * FROM school_teacher_applications WHERE status=? ORDER BY created_at DESC LIMIT 200').bind(status):
  context.env.DB.prepare('SELECT * FROM school_teacher_applications ORDER BY created_at DESC LIMIT 200')).all();
 return reply({ok:true,applications:(rows.results||[]).map(appRow)});
}

export async function teacherApplicationDetail(context){
 const match=new URL(context.request.url).pathname.match(/^\/api\/school\/management\/teacher-applications\/([a-f0-9-]{36})(?:\/(approve|reject))?$/i);
 if(!match)return failure('المسار غير موجود',404);
 const auth=await requireDeveloper(context);if(auth.error)return auth.error;
 const id=match[1],decision=match[2],method=context.request.method;
 if(!decision&&method!=='GET')return failure('الطريقة غير مدعومة',405);
 if(decision&&method!=='POST')return failure('الطريقة غير مدعومة',405);
 const row=await context.env.DB.prepare('SELECT * FROM school_teacher_applications WHERE id=?').bind(id).first();
 if(!row)return failure('طلب التدريس غير موجود',404);
 if(method==='GET')return reply({ok:true,application:appRow(row)});
 developerHelpers.verifyOrigin(context.request);
 if(row.applicant_id===auth.user.id)return failure('لا يمكن اعتماد أو رفض طلبك بنفسك',403);
 if(row.status!=='pending')return failure('هذا الطلب تمت مراجعته مسبقاً',409);
 const body=await context.request.json().catch(()=>({}));
 if(!body||typeof body!=='object'||Array.isArray(body))return failure('طلب غير صالح');
 const note=String(decision==='reject'?body.reason||'':body.notes||'').trim().slice(0,500);
 if(decision==='reject'&&!note)return failure('سبب الرفض مطلوب');
 const status=decision==='approve'?'approved':'rejected';
 if(decision==='approve'){
  const teacherId=crypto.randomUUID();
  // D1 batch commits the teacher profile and application review together.
  const batch=await context.env.DB.batch([
   context.env.DB.prepare(`INSERT INTO school_teachers
    (id,user_id,full_name,subjects_json,stages_json,grades_json,sections_json,registered_by)
    VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET
    status='active',full_name=excluded.full_name,subjects_json=excluded.subjects_json,
    stages_json=excluded.stages_json,grades_json=excluded.grades_json,
    sections_json=excluded.sections_json,registered_by=excluded.registered_by`)
    .bind(teacherId,row.applicant_id,row.full_name,row.subjects_json,row.stages_json,row.grades_json,row.sections_json,auth.user.id),
   context.env.DB.prepare("UPDATE school_teacher_applications SET status='approved',review_note=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'")
    .bind(note,auth.user.id,id)
  ]);
  if(!batch[1]?.meta?.changes)return failure('الطلب تمت مراجعته سابقاً',409);
 }else{
  const result=await context.env.DB.prepare("UPDATE school_teacher_applications SET status='rejected',review_note=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'")
    .bind(note,auth.user.id,id).run();
  if(!result.meta.changes)return failure('الطلب تمت مراجعته سابقاً',409);
 }
 await context.env.DB.prepare('INSERT INTO developer_audit(id,actor_id,action,metadata) VALUES(?,?,?,?)')
  .bind(crypto.randomUUID(),auth.user.id,'school.teacher.'+status,id).run();
 return reply({ok:true,application:{...appRow(row),status,reviewedBy:auth.user.id,reviewNote:note}});
}
