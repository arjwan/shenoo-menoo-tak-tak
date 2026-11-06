import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {guardianStudentEnrollment,reviewStudentEnrollments} from '../cloudflare/pages/school-enrollments.js';
import {schoolManagementMe} from '../cloudflare/pages/school-session.js';
import {onRequest} from '../functions/api/[[path]].js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const origin='https://shenoo-main-cloudflare.pages.dev';
const parent={id:'parent-u',username:'guardian-test',role:'user',fullName:'Guardian'};
const envFor=(overrides={})=>({
 DB:{prepare(sql){return {sql,bind(...args){this.args=args;return this},first:async()=>null,all:async()=>({results:[]}),run:async()=>({meta:{changes:1}})}},batch:async()=>[{meta:{changes:1}},{meta:{changes:1}}]},
 API:{fetch:async()=>Response.json({ok:true,user:parent})},...overrides
});
const consents=Object.fromEntries(['microphone','camera','live_classroom_participation','virtual_teacher_participation','ai_voice_usage','save_learning_qa','school_notifications'].map(k=>[k,false]));
const data={studentName:'طالب تجريبي',studentUsername:'student.test',relationship:'ولي أمر',stage:'ابتدائي',grade:'الأول ابتدائي',section:'أ',subjects:['القراءة'],consents,guardianDeclaration:true};
const req=(path,method='GET',body)=>new Request(origin+path,{method,headers:method==='GET'?{}:{Origin:origin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
test('new school enrollment DDL is additive, consent audited and tied to D1 users',async()=>{
 const sql=await read('cloudflare/migrations/0007_school_guardian_enrollments.sql');
 for(const table of ['school_student_enrollments','school_students'])assert.match(sql,new RegExp('CREATE TABLE IF NOT EXISTS '+table));
 assert.match(sql,/guardian_user_id TEXT NOT NULL REFERENCES users\(id\)/);
 assert.match(sql,/consents_json TEXT NOT NULL/);
 assert.match(sql,/status TEXT NOT NULL DEFAULT 'pending'/);
 assert.doesNotMatch(sql,/^\s*(?:DROP|DELETE FROM|UPDATE users)/im);
});
test('unauthenticated child enrollment and manager list cannot access private data',async()=>{
 const env={DB:{prepare(){throw Error('private read reached')}},API:{fetch:async()=>Response.json({ok:false},{status:401})}};
 assert.equal((await guardianStudentEnrollment({env,request:req('/api/school/portal/guardian/student-enrollment','POST',data)})).status,401);
 assert.equal((await reviewStudentEnrollments({env,request:req('/api/school/management/student-enrollments')})).status,401);
});
test('valid guardian submission saves only a pending request, no child login or trial',async()=>{
 let statements=[];
 const env=envFor({DB:{prepare(sql){statements.push(sql);return {bind(){return this},first:async()=>null,run:async()=>({meta:{changes:1}})}}}});
 const response=await guardianStudentEnrollment({env,request:req('/api/school/portal/guardian/student-enrollment','POST',data)});
 assert.equal(response.status,201);
 const value=await response.json();assert.equal(value.application.status,'pending');
 assert.match(statements.join(' '),/INSERT INTO school_student_enrollments/);
 assert.doesNotMatch(statements.join(' '),/INSERT INTO users|INSERT INTO school_students|trial_started/);
});
test('reject enrollment with missing consent selections and do not change D1',async()=>{
 let writes=0;
 const env=envFor({DB:{prepare(){return {bind(){return this},run:async()=>{writes++;return {}}};}}});
 const response=await guardianStudentEnrollment({env,request:req('/api/school/portal/guardian/student-enrollment','POST',{...data,consents:{camera:true}})});
 assert.equal(response.status,400);assert.equal(writes,0);
});
test('normal member never gains school manager access or student identity from unapproved enrollment',async()=>{
 const env=envFor({DB:{prepare(sql){return {bind(){return this},first:async()=>null,all:async()=>({results:[]})}}}});
 const response=await schoolManagementMe({env,request:req('/api/school/management/me')});
 const json=await response.json();assert.equal(json.schoolContext.isManager,false);
 assert.equal(json.schoolContext.isStudent,false);
 assert.equal(json.schoolContext.isGuardian,false);
});
test('guardian with approved child roster has guardian role but not developer privileges',async()=>{
 const env=envFor({DB:{prepare(sql){return {bind(){return this},first:async()=>null,all:async()=>({results:sql.includes('guardian_user_id')?[{id:'child-a',student_name:'Child',grade:'الأول ابتدائي',stage:'ابتدائي',status:'pending_account'}]:[]})}}}});
 const response=await schoolManagementMe({env,request:req('/api/school/management/me')});
 const json=await response.json();assert.equal(json.schoolContext.isGuardian,true);assert.equal(json.schoolContext.isDeveloper,false);assert.equal(json.schoolContext.students.length,1);
});
test('Cloudflare catch-all routes student applications without forwarding to legacy',async()=>{
 const env=envFor({API:{fetch:async()=>Response.json({ok:false},{status:401})},DB:{prepare(){throw Error('No anonymous D1 access')}}});
 const student=await onRequest({env,request:req('/api/school/portal/guardian/student-enrollment','POST',data)});assert.equal(student.status,401);
 const manager=await onRequest({env,request:req('/api/school/management/student-enrollments')});assert.equal(manager.status,401);
});
test('developer console can review student enrollment, but not auto issue student passwords',async()=>{
 const ui=await read('developer/app.js'),api=await read('cloudflare/pages/school-enrollments.js');
 assert.match(ui,/student-enrollment-approve/);assert.match(ui,/student-enrollment-reject/);
 assert.match(api,/studentAccountCreated:false,trialStarted:false/);
 assert.match(api,/developer\.id|auth\.user\.id/);
 assert.doesNotMatch(api,/password_hash|password_salt|token=|session_token/);
});

test('guardian must explicitly attest responsibility but may refuse camera and microphone consents',async()=>{
 let writes=0;
 const env=envFor({DB:{prepare(){return {bind(){return this},first:async()=>null,run:async()=>{writes++;return {meta:{changes:1}}}}}}});
 const rejected=await guardianStudentEnrollment({env,request:req('/api/school/portal/guardian/student-enrollment','POST',{...data,guardianDeclaration:false})});
 assert.equal(rejected.status,400);assert.equal(writes,0);
 const accepted=await guardianStudentEnrollment({env,request:req('/api/school/portal/guardian/student-enrollment','POST',data)});
 assert.equal(accepted.status,201);assert.ok(writes>0);
});
test('student form accepts Arabic and Latin usernames and does not force media consent',async()=>{
 const guest=await read('school/js/views/view-guest.js');
 assert.match(guest,/guardian-declaration/);
 assert.match(guest,/guardianDeclaration: guardianDeclaration/);
 assert.doesNotMatch(guest,/allConsented/);
 assert.doesNotMatch(guest,/name="enrollment-consent" value="[^"]*" required/);
 const regex=guest.match(/if \(!\/\^\[([^\]]+)\]\{3,30\}\$\/u\.test\(studentUsername\)/);
 assert.ok(regex,'client uses Unicode username validator');
 assert.match(regex[1],/\\p\{L\}/);
});
