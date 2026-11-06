const {test}=require('node:test');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const mongoose=require('mongoose');
const jwt=require('jsonwebtoken');
process.env.JWT_SECRET='local-guard-test-secret-only';
process.env.AUXILIARY_WRITES_ENABLED='true';
const app=require('../auxiliary.cjs');
const User=require('../server/src/models/User');
test('every restored module rejects anonymous, preauth and non-developer callers before database access',async()=>{
 const original=User.findById;
 User.findById=async()=>({_id:'test-user',role:'user',status:'active',credentialVersion:0});
 mongoose.connection.readyState=1;
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 const base='http://127.0.0.1:'+server.address().port;
 try{
  for(const path of ['/api/developer/modules/approvals','/api/developer/modules/providers/admin/pending','/api/developer/modules/ticker/manage']){
   assert.equal((await fetch(base+path)).status,401);
   const pre=jwt.sign({userId:'test-user',scope:'developer-mfa'},process.env.JWT_SECRET);
   assert.equal((await fetch(base+path,{headers:{Authorization:'Bearer '+pre}})).status,401);
   const regular=jwt.sign({userId:'test-user'},process.env.JWT_SECRET);
   assert.equal((await fetch(base+path,{headers:{Authorization:'Bearer '+regular}})).status,403);
  }
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));User.findById=original;mongoose.connection.readyState=0;}
});
