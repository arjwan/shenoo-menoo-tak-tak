'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {execFile}=require('node:child_process'),{promisify}=require('node:util');
const run=promisify(execFile);
const uri=process.env.SIMULATION_TEST_DATABASE_URI;
const {TYPES}=require('../src/simulation/plan');
test('database seed is idempotent, cleanup protects external references and real records',{skip:!uri,timeout:180000},async()=>{
 const mongoose=require('mongoose');
 const batch=`integration-${Date.now()}`;
 const env={...process.env,SIMULATION_DATABASE_URI:uri};
 async function cli(...args){const r=await run(process.execPath,['server/src/scripts/simulation-batch.js',...args,'--batch',batch],{env,maxBuffer:1024*1024});return JSON.parse(r.stdout);}
 await mongoose.connect(uri);
 try{
  const User=require('../src/models/User'),Post=require('../src/models/Post');
  const real=await User.create({fullName:'Real fixture',username:`real_${Date.now()}`,contact:`real_${Date.now()}@example.invalid`,contactType:'email',passwordHash:'test',termsAccepted:true});
  const seeded=await cli('seed','--apply');assert.equal(seeded.counts.User,1200);
  const repeated=await cli('seed','--apply');assert.deepEqual(repeated.counts,seeded.counts);
  const synthetic=await User.findOne({isSynthetic:true,syntheticBatch:batch});
  const external=await Post.create({author:synthetic._id,text:'External reference'});
  await assert.rejects(cli('cleanup','--apply'),/Cleanup blocked/);
  assert.equal(await User.countDocuments({isSynthetic:true,syntheticBatch:batch}),1200);
  await external.deleteOne();
  await cli('cleanup','--apply');
  for(const type of TYPES)assert.equal(await require(`../src/models/${type}`).countDocuments({isSynthetic:true,syntheticBatch:batch}),0);
  assert.ok(await User.exists({_id:real._id}));await real.deleteOne();
 }finally{await mongoose.disconnect();}
});
