'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {buildContent,catalog,BATCH}=require('../src/simulation/content-plan');
const {graphic}=require('../src/scripts/generate-digital-content-media');
const users=Array.from({length:40},(_,i)=>({_id:(i+1).toString(16).padStart(24,'0'),isSynthetic:true,status:'active'}));
const now=new Date('2026-10-05T15:00:00Z'),plan=buildContent(users,now);
test('40 distinct posts span four topics and short/long formats',()=>{
 assert.equal(plan.data.Post.length,40);
 assert.equal(new Set(catalog.map(x=>x.text)).size,40);
 assert.deepEqual(new Set(catalog.map(x=>x.category)),new Set(['politics','social','art','sports']));
 assert.ok(catalog.some(x=>x.text.length<80));assert.ok(catalog.some(x=>x.text.length>300));
 assert.equal(new Set(plan.data.Post.map(x=>x.author)).size,40);
});
test('stories expire after 24 hours and 12 reels point to distinct batch assets',()=>{
 assert.equal(plan.data.Story.length,16);assert.equal(plan.data.Reel.length,12);
 assert.ok(plan.data.Story.every(x=>+x.expiresAt===+now+86400000));
 assert.equal(new Set(plan.data.Reel.map(x=>x.media[0].url)).size,12);
});
test('human, inactive or insufficient account selections are rejected',()=>{
 assert.throws(()=>buildContent([{...users[0],isSynthetic:false},...users.slice(1)]));
 assert.throws(()=>buildContent([{...users[0],status:'blocked'},...users.slice(1)]));
 assert.throws(()=>buildContent(users.slice(0,3)));
});
test('retries produce stable IDs and no fabricated engagement',()=>{
 assert.deepEqual(plan,buildContent(users,now));
 const rows=Object.values(plan.data).flat();assert.equal(new Set(rows.map(x=>x._id)).size,rows.length);
 assert.ok(rows.every(x=>x.isSynthetic&&x.syntheticBatch===BATCH));
 assert.ok([...plan.data.Post,...plan.data.Reel].every(x=>x.likes.length===0));
 assert.ok(plan.data.Post.every(x=>x.commentsCount===0&&x.sharesCount===0));
 assert.ok(plan.data.Reel.every(x=>x.comments.length===0&&x.savedBy.length===0));
});
test('each original visual is distinct and carries its content title',()=>{
 const graphics=catalog.map(graphic);assert.equal(new Set(graphics).size,40);
 assert.ok(graphics.every((g,i)=>g.includes(catalog[i].title)));
});
test('all generated records validate against production schemas',()=>{
 for(const [type,rows] of Object.entries(plan.data)){
  const Model=require('../src/models/'+type);
  for(const row of rows)assert.equal(new Model(row).validateSync(),undefined,type);
 }
});
test('profile disclosure is returned and rendered independently of private biography',()=>{
 const api=fs.readFileSync(path.join(__dirname,'../src/routes/user.routes.js'),'utf8');
 const ui=fs.readFileSync(path.join(__dirname,'../../profile.js'),'utf8');
 assert.ok(api.includes("digitalPersona:user.isSynthetic===true"));
 assert.ok(ui.includes("if(u.digitalPersona)addInfo('نوع الحساب'"));
});
