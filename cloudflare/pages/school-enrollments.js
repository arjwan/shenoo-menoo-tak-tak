import { schoolUser } from './school-helpers.js';
import { handleDeveloper } from '../developer-api.js';
import { developerHelpers } from './developer-helpers.js';

const respond=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const deny=(message,status=400)=>respond({ok:false,message},status);
const consents=['microphone','camera','live_classroom_participation','virtual_teacher_participation','ai_voice_usage','save_learning_qa','school_notifications'];
const username=/^[\p{L}\p{M}0-9_.]{3,30}$/u;
const parseList=value=>{try{const v=JSON.parse(value||'[]');return Array.isArray(v)?v:[]}catch{return []}};
const record=row=>({
 id:row.id,studentName:row.student_name,studentUsername:row.student_username,
 relationship:row.relationship,stage:row.stage,grade:row.grade,section:row.section,
 subjects:parseList(row.subjects_json),status:row.status,createdAt:row.created_at,
 consentRecordedAt:row.consent_recorded_at,
 reviewNote:row.review_note||''
});
async function developer(context) {
 const headers=new Headers();
 const cookie=context.request.headers.get('Cookie');
 if(cookie)headers.set('Cookie',cookie);
 const checked=await handleDeveloper(new Request(new URL('/api/developer/me',context.request.url),{headers}),context.env,developerHelpers);
 if(!checked.ok)return {error:deny('تتطلب المراجعة جلسة المطور مع المصادقة الثنائية',401)};
 const data=await checked.json().catch(()=>null);
 if(data?.user?.role!=='developer'||!data.user.id)return {error:deny('غير مصرح',403)};
 return {user:data.user};
}
export async function guardianStudentEnrollment(context){
 if(!context.env.DB)return deny('قاعدة المدرسة غير مهيأة',503);
 const method=context.request.method;
 if(!['GET','POST'].includes(method))return deny('الطريقة غير مدعومة',405);
 const auth=await schoolUser(context);if(auth.error)return auth.error;
 if(method==='GET'){
  const rows=await context.env.DB.prepare('SELECT * FROM school_student_enrollments WHERE guardian_user_id=? ORDER BY created_at DESC LIMIT 100').bind(auth.user.id).all();
  return respond({ok:true,applications:(rows.results||[]).map(record)});
 }
 try {developerHelpers.verifyOrigin(context.request);}catch{return deny('مصدر الطلب غير موثوق',403)}
 const b=await context.request.json().catch(()=>null);
 if(!b||typeof b!=='object'||Array.isArray(b))return deny('طلب غير صالح');
 const name=String(b.studentName||'').trim(),studentUsername=String(b.studentUsername||'').trim().toLowerCase(),relationship=String(b.relationship||'ولي أمر'),stage=String(b.stage||''),grade=String(b.grade||'').trim(),section=String(b.section||'أ').trim();
 const subjects=Array.isArray(b.subjects)?b.subjects.map(v=>String(v||'').trim()).filter(Boolean).slice(0,30):[];
 if(name.length<2||name.length>120||!username.test(studentUsername)||!['أب','أم','ولي أمر','أخرى'].includes(relationship)||!['ابتدائي','متوسط','إعدادي'].includes(stage)||grade.length<2||grade.length>80||section.length>20||subjects.some(x=>x.length>80))return deny('بيانات الطالب غير مكتملة أو غير صالحة');
 if(b.guardianDeclaration!==true)return deny('يجب تأكيد مسؤولية ولي الأمر عن تقديم الطلب',400);
 const permissions=b.consents;
 if(!permissions||typeof permissions!=='object'||Array.isArray(permissions)||consents.some(k=>typeof permissions[k]!=='boolean'))return deny('يجب تسجيل اختيارات ولي الأمر لكل موافقة على حدة');
 if(await context.env.DB.prepare('SELECT id FROM users WHERE username=?').bind(studentUsername).first())return deny('اسم المستخدم محجوز لحساب موجود',409);
 if(await context.env.DB.prepare('SELECT id FROM school_students WHERE student_username=?').bind(studentUsername).first())return deny('اسم المستخدم مستخدم لطالب مسجل',409);
 const id=crypto.randomUUID();
 try{
  await context.env.DB.prepare('INSERT INTO school_student_enrollments(id,guardian_user_id,student_name,student_username,relationship,stage,grade,section,subjects_json,consents_json) VALUES(?,?,?,?,?,?,?,?,?,?)')
   .bind(id,auth.user.id,name,studentUsername,relationship,stage,grade,section,JSON.stringify(subjects),JSON.stringify(Object.fromEntries(consents.map(k=>[k,permissions[k]])))).run();
 }catch(e){if(/UNIQUE/i.test(String(e)))return deny('يوجد طلب طالب معلق بنفس اسم المستخدم',409);throw e}
 return respond({ok:true,message:'تم إرسال طلب التسجيل إلى إدارة المدرسة. لا يبدأ الاشتراك التجريبي قبل الموافقة وإنشاء حساب الطالب المستقل.',application:{id,status:'pending',studentName:name,studentUsername}},201);
}
export async function reviewStudentEnrollments(context){
 if(!context.env.DB)return deny('قاعدة المدرسة غير مهيأة',503);
 const match=new URL(context.request.url).pathname.match(/^\/api\/school\/management\/student-enrollments(?:\/([a-f0-9-]{36})\/(approve|reject))?$/i);
 if(!match)return deny('المسار غير موجود',404);
 const isReview=!!match[1],method=context.request.method;
 if(isReview?method!=='POST':method!=='GET')return deny('الطريقة غير مدعومة',405);
 const auth=await developer(context);if(auth.error)return auth.error;
 if(!isReview){
  const status=new URL(context.request.url).searchParams.get('status')||'pending';
  if(!['pending','approved','rejected','all'].includes(status))return deny('الحالة غير صالحة');
  const result=await (status==='all'?
   context.env.DB.prepare('SELECT e.*,u.username AS guardian_username FROM school_student_enrollments e JOIN users u ON u.id=e.guardian_user_id ORDER BY e.created_at DESC LIMIT 200').all():
   context.env.DB.prepare('SELECT e.*,u.username AS guardian_username FROM school_student_enrollments e JOIN users u ON u.id=e.guardian_user_id WHERE e.status=? ORDER BY e.created_at DESC LIMIT 200').bind(status).all());
  return respond({ok:true,applications:(result.results||[]).map(r=>({...record(r),guardianUsername:r.guardian_username}))});
 }
 try{developerHelpers.verifyOrigin(context.request);}catch{return deny('مصدر الطلب غير موثوق',403)}
 const b=await context.request.json().catch(()=>({}));
 if(!b||typeof b!=='object'||Array.isArray(b))return deny('طلب غير صالح');
 const note=String(b.reason||'').trim().slice(0,500);
 if(match[2]==='reject'&&!note)return deny('سبب الرفض مطلوب');
 const row=await context.env.DB.prepare("SELECT * FROM school_student_enrollments WHERE id=? AND status='pending'").bind(match[1]).first();
 if(!row)return deny('الطلب غير موجود أو تمت مراجعته',409);
 if(row.guardian_user_id===auth.user.id)return deny('لا يمكن اعتماد طلب تابع لحسابك',403);
 const status=match[2]==='approve'?'approved':'rejected';
 if(status==='approved'){
  // Approval intentionally does NOT create a child login or start the free trial.
  // An independently verified child account must be provisioned in a separate phase.
  const studentId=crypto.randomUUID();
  try{
   const batch=await context.env.DB.batch([
    context.env.DB.prepare("UPDATE school_student_enrollments SET status='approved',review_note=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(note,auth.user.id,row.id),
    context.env.DB.prepare("INSERT INTO school_students(id,enrollment_id,guardian_user_id,student_name,student_username,stage,grade,section,approved_by) VALUES(?,?,?,?,?,?,?,?,?)").bind(studentId,row.id,row.guardian_user_id,row.student_name,row.student_username,row.stage,row.grade,row.section,auth.user.id)
   ]);
   if(!batch[0]?.meta?.changes)return deny('الطلب تمت مراجعته',409);
  }catch(e){if(/UNIQUE|constraint/i.test(String(e)))return deny('حساب الطالب أو الطلب مسجل سابقًا',409);throw e}
 }else{
  const res=await context.env.DB.prepare("UPDATE school_student_enrollments SET status='rejected',review_note=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(note,auth.user.id,row.id).run();
  if(!res.meta.changes)return deny('الطلب تمت مراجعته',409);
 }
 await context.env.DB.prepare('INSERT INTO developer_audit(id,actor_id,action,metadata) VALUES(?,?,?,?)').bind(crypto.randomUUID(),auth.user.id,'school.student.'+status,row.id).run();
 return respond({ok:true,status,studentAccountCreated:false,trialStarted:false});
}
