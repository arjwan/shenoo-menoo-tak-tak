import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('school teacher migration is additive, referenced, and one pending request per account',async()=>{
 const source=await read('cloudflare/migrations/0004_school_teacher_workflow.sql');
 assert.match(source,/CREATE TABLE IF NOT EXISTS school_teacher_applications/i);
 assert.match(source,/CREATE TABLE IF NOT EXISTS school_teachers/i);
 assert.match(source,/REFERENCES users\(id\)/i);
 assert.match(source,/UNIQUE INDEX IF NOT EXISTS school_teacher_one_pending/i);
 assert.match(source,/WHERE status='pending'/);
 assert.doesNotMatch(source,/DROP TABLE|DELETE FROM users|UPDATE users SET role/i);
});

test('Pages teacher routes are more specific than legacy school catch-all',async()=>{
 const [apply,list,detail]=await Promise.all([
  read('functions/api/school/management/teachers/apply.js'),
  read('functions/api/school/management/teacher-applications.js'),
  read('functions/api/school/management/teacher-applications/[[path]].js')
 ]);
 assert.match(apply,/submitTeacher/);
 assert.match(list,/listTeacherApplications/);
 assert.match(detail,/teacherApplicationDetail/);
});

test('teacher applications require D1 account; review requires verified developer cookie',async()=>{
 const s=await read('cloudflare/pages/school-teachers.js');
 assert.match(s,/await schoolUser\(context\)/);
 assert.match(s,/handleDeveloper\(new Request/);
 assert.match(s,/body\?\.user\?\.role/);
 assert.match(s,/developerHelpers\.verifyOrigin/);
 assert.match(s,/row\.applicant_id===auth\.user\.id/);
 assert.doesNotMatch(s,/mongoose|MongoDB|JWT_SECRET|req\.user/);
});

test('school management listing denies unauthenticated reads without accessing private data',async()=>{
 const { listTeacherApplications,teacherApplicationDetail }=await import('../cloudflare/pages/school-teachers.js');
 const env={DB:{prepare:()=>{throw Error('Unauthorized access reached private D1 data')}},API:{fetch:async()=>Response.json({ok:false},{status:401})}};
 const listed=await listTeacherApplications({request:new Request('https://example.com/api/school/management/teacher-applications'),env});
 assert.equal(listed.status,401);
 const detail=await teacherApplicationDetail({request:new Request('https://example.com/api/school/management/teacher-applications/12345678-1234-1234-1234-123456789abc'),env});
 assert.equal(detail.status,401);
});
test('authenticated applicants cannot read another applicant record or approve themselves',async()=>{
 const {teacherApplicationDetail}=await import('../cloudflare/pages/school-teachers.js');
 const env={API:{fetch:async()=>Response.json({ok:true,user:{id:'applicant-a',role:'user'}})},DB:{prepare:()=>({bind:()=>({first:async()=>({id:'request',applicant_id:'applicant-b'})})})}};
 const url='https://example.com/api/school/management/teacher-applications/12345678-1234-1234-1234-123456789abc';
 assert.equal((await teacherApplicationDetail({request:new Request(url),env})).status,403);
 assert.equal((await teacherApplicationDetail({request:new Request(url+'/approve',{method:'POST'}),env})).status,401);
});
