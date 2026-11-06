import {test} from 'node:test';
import assert from 'node:assert/strict';
import {consultationRequest} from '../cloudflare/pages/consultations.js';
import {onRequest} from '../functions/api/[[path]].js';
const host='https://shinomino.com';
function stub(){
 const calls=[];
 const env={DB:{prepare(sql){const s={sql,args:[],bind(...a){this.args=a;return this},
 async all(){calls.push({sql,args:this.args});return {results:sql.includes("FROM consultation_providers p")?[{id:'approved-1',category:'medical',title:'طبيب',specialty:'باطنية',bio:'نبذة',service_type:'free',fee:0,currency:'IQD',user_id:'person-1',username:'doctor',full_name:'د. مختص'}]:[]}},
 async first(){calls.push({sql,args:this.args});return null},
 async run(){calls.push({sql,args:this.args});return {meta:{changes:1}}}};
 return s;}}};
 return {env,calls};
}
test('approved public consultations only; selected category parameterized',async()=>{
 const {env,calls}=stub();
 const res=await consultationRequest(new Request(host+'/api/consultations?category=medical'),env);
 assert.equal(res.status,200);
 const data=await res.json();
 assert.equal(data.providers[0].user.fullName,'د. مختص');
 assert.match(calls[0].sql,/p.status='approved'/);
 assert.match(calls[0].sql,/p.category=\?/);
 assert.deepEqual(calls[0].args,['medical']);
 assert.equal((await consultationRequest(new Request(host+'/api/consultations?category=unknown'),env)).status,400);
});
test('application requires owner authentication, validates paid fee, remains pending',async()=>{
 const {env,calls}=stub();
 const path=host+'/api/consultations/providers';
 const payload={category:'medical',title:'طبيب',specialty:'باطنية',bio:'خبرة',serviceType:'paid',fee:25000};
 const request=(body,origin=host)=>new Request(path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await consultationRequest(request(payload),env)).status,401);
 assert.equal((await consultationRequest(request(payload,'https://evil.example'),env,{id:'user-1'})).status,403);
 assert.equal((await consultationRequest(request({...payload,fee:0}),env,{id:'user-1'})).status,400);
 const res=await consultationRequest(request(payload),env,{id:'user-1'});
 assert.equal(res.status,201);
 assert.equal((await res.json()).provider.status,'pending');
 const insert=calls.find(c=>c.sql.startsWith('INSERT INTO consultation_providers'));
 assert.ok(insert);assert.match(insert.sql,/'pending'/);
 assert.equal(insert.args[1],'user-1');
});
test('Pages dispatcher gives public catalogue to D1 without requiring login',async()=>{
 const {env}=stub();
 const res=await onRequest({env,request:new Request(host+'/api/consultations?category=medical')});
 assert.equal(res.status,200);
 assert.equal((await res.json()).ok,true);
});
