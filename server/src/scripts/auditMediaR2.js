require('dotenv').config();
const path=require('path');
const fs=require('fs');
const mongoose=require('mongoose');
const connectDB=require('../config/db');
const mediaStorage=require('../services/media-storage');
const Reel=require('../models/Reel');
const Post=require('../models/Post');
const Story=require('../models/Story');

const root=path.resolve(__dirname,'../../..');
const localPath=url=>url&&String(url).startsWith('/uploads/')?path.join(root,String(url).replace(/^\//,'')):'';
const stats={total:0,r2Verified:0,r2Missing:0,localOnly:0,localFallbackFiles:0,missingLocal:0,other:0};
const details=[];

async function check(item,label){
 if(!item||(!item.url&&!item.storageKey))return;
 stats.total++;
 const fallback=String(item.fallbackUrl||'');
 const fp=localPath(fallback||item.url);
 const localExists=fp?fs.existsSync(fp):false;
 if(item.storage==='r2'&&item.storageKey){
   const head=await mediaStorage.headObject(item.storageKey).catch(()=>null);
   if(head){stats.r2Verified++;if(localExists)stats.localFallbackFiles++;}
   else{stats.r2Missing++;details.push({label,status:'R2_MISSING',key:item.storageKey,fallback});}
   return;
 }
 if(fp){
   if(localExists){stats.localOnly++;details.push({label,status:'LOCAL_ONLY',file:fp});}
   else{stats.missingLocal++;details.push({label,status:'LOCAL_MISSING',file:fp,url:item.url||''});}
   return;
 }
 stats.other++;details.push({label,status:'OTHER',url:item.url||'',storage:item.storage||'',key:item.storageKey||''});
}

async function run(){
 if(!mediaStorage.configured())throw Error('إعدادات R2 غير مكتملة');
 await connectDB();
 const posts=await Post.find({'media.0':{$exists:true}}).lean();
 for(const d of posts)for(let i=0;i<(d.media||[]).length;i++)await check(d.media[i],`Post:${d._id}:media:${i}`);
 const reels=await Reel.find({'media.0':{$exists:true}}).lean();
 for(const d of reels)for(let i=0;i<(d.media||[]).length;i++)await check(d.media[i],`Reel:${d._id}:media:${i}`);
 const stories=await Story.find({$or:[{'media.0':{$exists:true}},{'music.url':{$ne:''}}]}).lean();
 for(const d of stories){
   for(let i=0;i<(d.media||[]).length;i++)await check(d.media[i],`Story:${d._id}:media:${i}`);
   if(d.music&&d.music.url)await check(d.music,`Story:${d._id}:music`);
 }
 console.log('=== R2 MEDIA AUDIT ===');
 console.log(JSON.stringify(stats,null,2));
 if(details.length){console.log('=== ITEMS NEEDING ATTENTION ===');for(const x of details)console.log(JSON.stringify(x));}
 else console.log('All referenced media is verified on R2.');
 await mongoose.disconnect();
}
run().catch(async e=>{console.error(e.stack||e);try{await mongoose.disconnect()}catch(_){}process.exit(1)});
