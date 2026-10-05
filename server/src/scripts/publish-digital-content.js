'use strict';
const fs=require('node:fs'),path=require('node:path');
const {BATCH,buildContent}=require('../simulation/content-plan');
async function main(){
 if(!process.argv.includes('--apply'))throw Error('Use --apply to publish this reviewed one-time batch');
 require('dotenv').config({quiet:true});
 const uri=process.env.MONGODB_URI||process.env.MONGO_URI;if(!uri)throw Error('Server database is not configured');
 const mongoose=require('mongoose');await mongoose.connect(uri,{serverSelectionTimeoutMS:15000,autoIndex:false});
 try{
  const User=require('../models/User');
  const users=await User.find({isSynthetic:true,status:'active',$or:[{birthDate:{$lte:new Date(new Date().setUTCFullYear(new Date().getUTCFullYear()-18))}},{birthDate:null}]}).sort({_id:1}).limit(40).select('_id isSynthetic status').lean();
  const plan=buildContent(users),models=Object.fromEntries(['Post','Reel','Story'].map(t=>[t,require('../models/'+t)]));
  for(const [type,rows] of Object.entries(plan.data))for(const row of rows){
   const error=new models[type](row).validateSync();if(error)throw error;
   for(const media of row.media){const file=path.resolve(__dirname,'../../uploads',media.url.replace('/uploads/',''));if(!fs.existsSync(file)||fs.statSync(file).size===0)throw Error('Missing batch media');}
  }
  // Never fabricate likes, comments, shares, follower counts or online presence.
  // Idempotent inserts preserve real interactions when a workflow is retried.
  const counts={};
  for(const [type,rows] of Object.entries(plan.data)){
   await models[type].bulkWrite(rows.map(row=>({updateOne:{filter:{_id:row._id,isSynthetic:true,syntheticBatch:BATCH,author:row.author},update:{$setOnInsert:row},upsert:true,timestamps:false}})),{ordered:true});
   counts[type]=await models[type].countDocuments({isSynthetic:true,syntheticBatch:BATCH});
  }
  console.log(JSON.stringify({ok:true,batch:BATCH,authors:users.length,counts}));
 }finally{await mongoose.disconnect();}
}
main().catch(()=>{console.error('Content publishing failed; inspect the batch, media and database configuration. No credentials are logged.');process.exitCode=1;});
