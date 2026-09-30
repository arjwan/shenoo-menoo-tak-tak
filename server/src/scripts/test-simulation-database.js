'use strict';
const {MongoMemoryReplSet}=require('mongodb-memory-server-core');
const {spawn}=require('node:child_process');
(async()=>{
 const replica=await MongoMemoryReplSet.create({binary:{version:'7.0.14'},replSet:{count:1}});
 try{
  const child=spawn(process.execPath,['--test','server/test/simulation-database.test.js'],{stdio:'inherit',env:{...process.env,SIMULATION_TEST_DATABASE_URI:replica.getUri()}});
  const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve)});
  process.exitCode=code||0;
 }finally{await replica.stop();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
