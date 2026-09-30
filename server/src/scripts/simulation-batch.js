'use strict';
// No dotenv loading: a target database must be chosen explicitly.
const {buildPlan,TYPES,options}=require('../simulation/plan');
const path=require('node:path');
const fs=require('node:fs/promises');
const crypto=require('node:crypto');
const args=process.argv.slice(2),command=args[0]||'preview';
function flag(key){const index=args.indexOf(key);return index<0?undefined:args[index+1];}
async function main(){
 const config=options({batch:flag('--batch'),count:flag('--count')});
 if(!['preview','seed','inspect','cleanup'].includes(command)) throw Error('Use preview, seed, inspect or cleanup');
 const plan=buildPlan(config);
 if(command==='preview') {console.log(JSON.stringify({batch:plan.batch,counts:Object.fromEntries(TYPES.map(t=>[t,plan.data[t].length])),teachers:plan.data.SchoolTeacher.map(t=>({name:t.name,stage:t.stages[0],subject:t.subjects[0],students:t.assignedStudents.length}))},null,2));return;}
 const uri=process.env.SIMULATION_DATABASE_URI;
 if(!uri) throw Error('Choose SIMULATION_DATABASE_URI explicitly. Production URI is never inferred.');
 if(['seed','cleanup'].includes(command)&&!args.includes('--apply')) throw Error('Use --apply to perform the selected database mutation; preview and inspect do not write.');
 const mongoose=require('mongoose');
 await mongoose.connect(uri,{serverSelectionTimeoutMS:10000,autoIndex:false});
 try {
  const models=Object.fromEntries(TYPES.map(t=>[t,require(`../models/${t}`)]));
  const filter={isSynthetic:true,syntheticBatch:plan.batch};
  const counts={};for(const t of TYPES)counts[t]=await models[t].countDocuments(filter);
  if(command==='inspect'){console.log(JSON.stringify({batch:plan.batch,counts},null,2));return;}
  const session=await mongoose.startSession();
  try {
   if(command==='cleanup') {
    await session.withTransaction(async()=>{
     const ids={};for(const t of TYPES)ids[t]=(await models[t].find(filter).select('_id').session(session).lean()).map(d=>d._id);
     // Refuse to erase a batch that real records now depend on. No real record is changed.
     const files=await fs.readdir(path.resolve(__dirname,'../models'));
     for(const file of files.filter(f=>f.endsWith('.js')))require(`../models/${file}`);
     function referencePaths(schema,prefix=''){
      const result=[];
      schema.eachPath((name,field)=>{
       const key=prefix+name,ref=field.options?.ref||field.caster?.options?.ref;
       if(typeof ref==='string')result.push([key,ref]);
       if(field.schema)result.push(...referencePaths(field.schema,key+'.'));
      });return result;
     }
     for(const model of Object.values(mongoose.models))for(const [field,target]of referencePaths(model.schema)){
      if(ids[target]?.length&&await model.exists({[field]:{$in:ids[target]},$nor:[filter]}).session(session))throw Error(`Cleanup blocked: external ${model.modelName}.${field} references the batch`);
     }
     for(const t of [...TYPES].reverse())await models[t].deleteMany(filter,{session});
    });
    // Leave media in place because real users may have reused a URL; a database cleanup never deletes user files.
    console.log(JSON.stringify({ok:true,batch:plan.batch,deleted:counts,mediaRetained:true}));return;
   }
   for(const model of Object.values(models))await model.init();
   const hash=await require('bcryptjs').hash(crypto.randomBytes(48).toString('hex'),12);
   for(const doc of plan.data.User)doc.passwordHash=hash;
   for(const t of TYPES)for(const doc of plan.data[t]){const error=new models[t](doc).validateSync();if(error)throw error;}
   const assetsRoot=path.resolve(__dirname,'../../uploads/simulation');
   await require('../simulation/assets').generateAssets(plan,assetsRoot);
   await session.withTransaction(async()=>{
    for(const t of TYPES){
     const docs=plan.data[t];
     for(let offset=0;offset<docs.length;offset+=200)await models[t].bulkWrite(docs.slice(offset,offset+200).map(doc=>({updateOne:{filter:{_id:doc._id,...filter},update:{$setOnInsert:doc},upsert:true,timestamps:false}})),{session,ordered:true});
    }
   });
   const after={};for(const t of TYPES)after[t]=await models[t].countDocuments(filter);
   await fs.writeFile(path.join(assetsRoot,plan.batch,'manifest.json'),JSON.stringify({batch:plan.batch,counts:after},null,2));
   console.log(JSON.stringify({ok:true,batch:plan.batch,counts:after}));
  }finally{await session.endSession();}
 }finally{await mongoose.disconnect();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
