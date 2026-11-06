import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {handleDeveloperManagement} from '../cloudflare/developer-management.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const mockDb=(rows=[])=>({
 prepare(sql){return {
  bind(...args){this.args=args;return this;},
  async all(){return {results:rows}},
  async first(){return rows[0]||null},
  async run(){return {meta:{changes:1}}}
 }}
});
const req=(path,method='GET',value)=>new Request('https://shenoo-main-cloudflare.pages.dev'+path,{method,headers:method==='GET'?{}:{'Content-Type':'application/json'},body:value===undefined?undefined:JSON.stringify(value)});
test('every missing management section now has a D1 route',async()=>{
 const api=await read('cloudflare/developer-api.js');
 const extra=await read('cloudflare/developer-management.js');
 const html=await read('developer/app.js');
 const migration=await read('cloudflare/migrations/0006_developer_management.sql');
 assert.match(api,/handleDeveloperManagement\(req,env,actor\)/);
 assert.match(api,/path==='\/api\/developer\/me'&&method==='PATCH'/);
 for(const name of ['developer_rooms','developer_room_reports','developer_service_providers','developer_service_requests'])assert.match(migration,new RegExp('CREATE TABLE IF NOT EXISTS '+name));
 for(const path of ['/api/developer/rooms','/api/developer/room-reports','/api/developer/modules/providers/admin/pending','/api/developer/modules/approvals'])assert.ok(extra.includes(path));
 assert.doesNotMatch(api,/إدارة الغرف قيد النقل إلى D1|البلاغات قيد النقل إلى D1/);
 assert.match(html,/create-room/);
 assert.doesNotMatch(html,/field\('phone','رقم الهاتف',\{value:currentUser\.phone/);
 assert.doesNotMatch(migration,/\b(?:DROP|DELETE|TRUNCATE)\b/i);
});
test('empty D1 collections return valid UI responses without faking records',async()=>{
 const env={DB:mockDb()};
 for(const [path,key] of [['/api/developer/rooms','rooms'],['/api/developer/room-reports','reports'],['/api/developer/modules/providers/admin/pending','providers'],['/api/developer/modules/approvals','approvals']]){
  const res=await handleDeveloperManagement(req(path),env,{id:'owner'});
  assert.equal(res.status,200);
  assert.deepEqual((await res.json())[key],[]);
 }
});
test('invalid admin mutations are rejected before any D1 write',async()=>{
 const env={DB:mockDb()},actor={id:'developer'};
 const create=await handleDeveloperManagement(req('/api/developer/rooms','POST',{name:'X',roomType:'public'}),env,actor);
 assert.equal(create.status,400);
 const report=await handleDeveloperManagement(req('/api/developer/room-reports/11111111-1111-4111-8111-111111111111','PATCH',{status:'delete'}),env,actor);
 assert.equal(report.status,400);
 const provider=await handleDeveloperManagement(req('/api/developer/modules/providers/admin/11111111-1111-4111-8111-111111111111/status','PATCH',{status:'blocked'}),env,actor);
 assert.equal(provider.status,400);
 const reject=await handleDeveloperManagement(req('/api/developer/modules/approvals/service/11111111-1111-4111-8111-111111111111/reject','PATCH',{}),env,actor);
 assert.equal(reject.status,400);
});
test('management module does not handle unrelated or unauthenticated developer login endpoints',async()=>{
 assert.equal(await handleDeveloperManagement(req('/api/developer/login'),{DB:mockDb()},{id:'developer'}),null);
});
