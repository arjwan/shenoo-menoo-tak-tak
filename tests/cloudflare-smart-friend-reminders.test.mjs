import {test} from 'node:test';
import assert from 'node:assert/strict';
import {smartFriendRoute} from '../cloudflare/pages/smart-friend.js';
const base='https://shinomino.com',user={id:'owner-1'};
const data=[];
function db(){
 return {prepare(sql){
  const s={args:[],bind(...args){this.args=args;return this},
   async first(){
    if(sql.includes('COUNT(*)'))return {n:data.filter(x=>x.user_id===this.args[0]&&x.active).length};
    throw Error('unexpected first '+sql);
   },
   async all(){
    if(!sql.includes('FROM smart_friend_reminders'))throw Error('unexpected all '+sql);
    return {results:data.filter(x=>x.user_id===this.args[0]&&x.active&&x.due_at<=this.args[1])
      .sort((a,b)=>a.due_at.localeCompare(b.due_at)).slice(0,30).map(x=>({...x}))};
   },
   async run(){
    if(sql.startsWith('INSERT')){
     const [id,uid,title,due_at,repeat,voice]=this.args;
     data.push({id,user_id:uid,title,due_at,repeat,voice,active:1});
     return {meta:{changes:1}};
    }
    if(sql.startsWith('UPDATE')){
     const recurring=sql.includes('SET due_at=?');
     const args=this.args;
     const id=recurring?args[1]:args[0],uid=recurring?args[2]:args[1],expected=recurring?args[3]:args[2];
     const row=data.find(x=>x.id===id&&x.user_id===uid&&x.due_at===expected&&x.active);
     if(!row)return {meta:{changes:0}};
     if(recurring)row.due_at=args[0];else row.active=0;
     return {meta:{changes:1}};
    }
    throw Error('unexpected run '+sql);
   }};
  return s;
 }};
}
const env={DB:db()};
const post=(d,origin=base)=>new Request(base+'/api/smart-friend/tools/reminders',
 {method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(d)});
const get=()=>new Request(base+'/api/smart-friend/tools/reminders/due');
test('schedules one-time reminder, prevents duplicates and isolates owner',async()=>{
 data.length=0;
 const dueAt=new Date(Date.now()+20000).toISOString();
 const added=await smartFriendRoute(post({title:'اتصل',dueAt,repeat:'none',voice:true}),env,user);
 assert.equal(added.status,201);
 data[0].due_at=new Date(Date.now()-1000).toISOString();
 const found=await smartFriendRoute(get(),env,user);
 assert.equal((await found.json()).reminders.length,1);
 assert.equal(data[0].active,0);
 const again=await smartFriendRoute(get(),env,user);
 assert.equal((await again.json()).reminders.length,0);
 const other=await smartFriendRoute(get(),env,{id:'other'});
 assert.equal((await other.json()).reminders.length,0);
});
test('daily reminder moves to next day without duplicate delivery',async()=>{
 data.length=0;
 const dueAt=new Date(Date.now()+20000).toISOString();
 assert.equal((await smartFriendRoute(post({title:'رياضة',dueAt,repeat:'daily',voice:false}),env,user)).status,201);
 data[0].due_at=new Date(Date.now()-1000).toISOString();
 const first=await smartFriendRoute(get(),env,user);
 assert.equal((await first.json()).reminders.length,1);
 assert.equal(data[0].active,1);
 assert.ok(Date.parse(data[0].due_at)>Date.now());
 const second=await smartFriendRoute(get(),env,user);
 assert.equal((await second.json()).reminders.length,0);
});
test('rejects invalid date, cross origin, and missing title',async()=>{
 const future=new Date(Date.now()+20000).toISOString();
 const valid={title:'hello',dueAt:future,repeat:'none',voice:false};
 for(const [request,status] of [
  [post({...valid,dueAt:'not-a-date'}),400],
  [post({...valid,title:''}),400],
  [post(valid,'https://evil.example'),403]
 ]){
  const response=await smartFriendRoute(request,env,user);
  assert.equal(response.status,status);
 }
});
