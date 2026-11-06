import {test} from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/api/[[path]].js';
const base='https://shenoo-main-cloudflare.pages.dev';
const context=(path,method='GET')=>({
 request:new Request(base+path,{method}),
 env:{
  DB:{prepare(){throw Error('Unauthenticated caller reached private D1')}},
  API:{fetch:async()=>Response.json({ok:false,message:'No app session'},{status:401})}
 }
});
test('school teacher list is owned by D1 and denies unauthenticated callers rather than legacy 404',async()=>{
 const res=await onRequest(context('/api/school/management/teacher-applications?status=pending'));
 assert.equal(res.status,401);
 assert.equal((await res.json()).message,'هذه العملية مخصصة للمطور بعد التحقق الثنائي');
});
test('D1 teacher details and decisions must not fall through to legacy origin',async()=>{
 const id='12345678-1234-4234-8234-123456789abc';
 for(const route of ['/api/school/management/teacher-applications/'+id,'/api/school/management/teacher-applications/'+id+'/approve','/api/school/management/teacher-applications/'+id+'/reject']){
  const res=await onRequest(context(route,route.endsWith(id)?'GET':'POST'));
  assert.equal(res.status,401);
 }
});
test('teacher submission still requires an authenticated user and never falls back to legacy',async()=>{
 const res=await onRequest(context('/api/school/management/teachers/apply','POST'));
 assert.equal(res.status,401);
});
