import { schoolUser } from './school-helpers.js';
import { handleDeveloper } from '../developer-api.js';
import { developerHelpers } from './developer-helpers.js';

const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const contextFor=(user,role='user',teacher=null,developer=false)=>({
 ok:true,authenticated:true,
 user:{id:user.id,username:user.username,fullName:user.fullName||user.displayName||user.username,role:developer?'developer':role},
 schoolContext:{
  role:developer?'developer':teacher?'teacher':'guest',
  isDeveloper:developer,
  isManager:false,
  isTeacher:!!teacher,
  isStudent:false,
  isGuardian:false,
  teacher:teacher||null,
  guardian:null,studentProfile:null,students:[]
 }
});
// Authorization is derived exclusively from Cloudflare's verified HttpOnly
// developer MFA session or D1 application cookie. No user-selected roles,
// browser tokens, or ordinary app "admin" roles grant school management.
export async function schoolManagementMe(context){
 if(context.request.method!=='GET')return json({ok:false,message:'الطريقة غير مدعومة'},405);
 if(!context.env.DB)return json({ok:false,message:'قاعدة المدرسة غير مهيأة'},503);
 const url=new URL('/api/developer/me',context.request.url);
 const headers=new Headers();
 const cookie=context.request.headers.get('Cookie');
 if(cookie)headers.set('Cookie',cookie);
 const checked=await handleDeveloper(new Request(url,{method:'GET',headers}),context.env,developerHelpers);
 if(checked.ok){
  const data=await checked.json().catch(()=>null);
  if(data?.user?.role==='developer'&&data.user.id)return json(contextFor(data.user,'developer',null,true));
 }
 const auth=await schoolUser(context);
 if(auth.error)return auth.error;
 const user=auth.user;
 const [row,children,student]=await Promise.all([
  context.env.DB.prepare("SELECT id,user_id,full_name,subjects_json,grades_json,status FROM school_teachers WHERE user_id=? AND status='active' LIMIT 1").bind(user.id).first(),
  context.env.DB.prepare("SELECT id,student_name,grade,stage,section,status FROM school_students WHERE guardian_user_id=? AND status IN ('pending_account','active') ORDER BY created_at DESC LIMIT 100").bind(user.id).all(),
  context.env.DB.prepare("SELECT id,student_name,grade,stage,section,status FROM school_students WHERE student_user_id=? AND status='active' LIMIT 1").bind(user.id).first()
 ]);
 let teacher=null;
 if(row){
  const parse=value=>{try{const v=JSON.parse(value||'[]');return Array.isArray(v)?v:[]}catch{return []}};
  teacher={id:row.id,userId:row.user_id,fullName:row.full_name,subjects:parse(row.subjects_json),grades:parse(row.grades_json)};
 }
 const school=contextFor(user,user.role,teacher,false);
 if(student){
  school.schoolContext.role='student';
  school.schoolContext.isStudent=true;
  school.schoolContext.studentProfile={id:student.id,name:student.student_name,grade:student.grade,stage:student.stage,section:student.section};
 }else if(!teacher&&(children.results||[]).length){
  school.schoolContext.role='guardian';
  school.schoolContext.isGuardian=true;
  school.schoolContext.guardian={userId:user.id};
  school.schoolContext.students=(children.results||[]).map(r=>({id:r.id,name:r.student_name,grade:r.grade,stage:r.stage,section:r.section,status:r.status}));
 }
 return json(school);
}
