import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {schoolManagementMe} from '../cloudflare/pages/school-session.js';
import {onRequest} from '../functions/api/[[path]].js';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const url='https://shenoo-main-cloudflare.pages.dev/api/school/management/me';
const ordinarySession=user=>({
 DB:{prepare(sql){assert.match(sql,/school_teachers|school_students/);return {bind(){return this},async first(){return null},async all(){return {results:[]}}}}},
 API:{fetch:async()=>Response.json({ok:true,user})}
});
test('school management rejects anonymous visitors without a developer or application cookie',async()=>{
 const env={DB:{prepare(){throw Error('No user access should touch D1')}},API:{fetch:async()=>Response.json({ok:false},{status:401})}};
 const response=await schoolManagementMe({env,request:new Request(url)});
 assert.equal(response.status,401);
});
test('ordinary D1 user is a member but not developer, school manager, student or teacher',async()=>{
 const user={id:'user-1',role:'user',username:'ordinary',fullName:'Ordinary'};
 const r=await schoolManagementMe({env:ordinarySession(user),request:new Request(url)});
 assert.equal(r.status,200);const v=await r.json();
 assert.equal(v.authenticated,true);assert.equal(v.user.username,user.username);
 assert.equal(v.schoolContext.isDeveloper,false);
 assert.equal(v.schoolContext.isManager,false);
 assert.equal(v.schoolContext.isTeacher,false);
 assert.equal(v.schoolContext.isStudent,false);
 assert.equal(v.schoolContext.role,'guest');
});
test('ordinary app role admin never becomes developer or school manager automatically',async()=>{
 const r=await schoolManagementMe({env:ordinarySession({id:'u',role:'admin',username:'appadmin'}),request:new Request(url)});
 const v=await r.json();assert.equal(v.schoolContext.isDeveloper,false);assert.equal(v.schoolContext.isManager,false);
});
test('active D1 school teacher is recognized only from server-side teacher enrollment',async()=>{
 const env={DB:{prepare(sql){return {bind(){return this},first:async()=>sql.includes('school_teachers')?({id:'t1',user_id:'u1',full_name:'Teacher',subjects_json:'["رياضيات"]',grades_json:'["الأول ابتدائي"]',status:'active'}):null,all:async()=>({results:[]})}}},API:{fetch:async()=>Response.json({ok:true,user:{id:'u1',username:'teacher',role:'user'}})}};
 const r=await schoolManagementMe({env,request:new Request(url)});
 const v=await r.json();assert.equal(v.schoolContext.isTeacher,true);assert.equal(v.schoolContext.role,'teacher');assert.equal(v.schoolContext.isDeveloper,false);
});
test('Cloudflare routing and Sumer frontend use cookie verification instead of legacy token state',async()=>{
 const [r,html,api,guest,ui,session]=await Promise.all([
  read('functions/api/[[path]].js'),read('school.html'),read('school/js/sumer-api.js'),
  read('school/js/views/view-guest.js'),read('school/js/sumer-ui.js'),read('cloudflare/pages/school-session.js')
 ]);
 assert.match(r,/pathname === '\/api\/school\/management\/me'/);
 assert.ok(r.indexOf("pathname === '/api/school/management/me'")<r.indexOf('return proxyLegacy(context)'));
 assert.match(html,/api\.getMe\(\)\.then/);
 assert.doesNotMatch(html,/if \(api && api\.getToken\(\)\)/);
 assert.match(html,/location\.replace\('\/school-admin\.html#/);
 assert.doesNotMatch(html,/location\.replace\('\/developer\/#school'\)/);
 assert.match(api,/credentials: 'same-origin'/);
 assert.doesNotMatch(api,/var token = options\.token \|\| this\.getToken\(\)/);
 assert.match(guest,/token: null/);
 assert.match(ui,/roleLabel = 'عضو'/);
 assert.match(session,/handleDeveloper\(new Request/);
 assert.match(session,/schoolUser\(context\)/);
 assert.doesNotMatch(session,/role==='admin'.*isManager:true/);
});
test('Pages fallback rejects anonymous school context rather than proxying legacy',async()=>{
 const env={DB:{prepare(){throw Error('Unauthorized data query')}},API:{fetch:async()=>Response.json({ok:false},{status:401})}};
 const res=await onRequest({request:new Request(url),env});assert.equal(res.status,401);
});
