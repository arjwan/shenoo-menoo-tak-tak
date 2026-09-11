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
function localPath(url){if(!url||!url.startsWith('/uploads/'))return'';return path.join(root,url.replace(/^\//,''));}
async function migrateItem(item,category){if(!item||item.storage==='r2'||item.storageKey)return false;const fallbackUrl=item.fallbackUrl||item.url,fp=localPath(fallbackUrl);if(!fp||!fs.existsSync(fp))return false;const file={path:fp,filename:path.basename(fp),mimetype:item.mimeType||'application/octet-stream',size:item.size||fs.statSync(fp).size},p=await mediaStorage.publishFile(file,{category,fallbackUrl});if(p.storage!=='r2')throw Error('R2 غير مفعّل');item.url=p.url;item.fallbackUrl=p.fallbackUrl;item.storageKey=p.storageKey;item.storage=p.storage;return true;}
async function run(){if(!mediaStorage.configured())throw Error('إعدادات R2 غير مكتملة');await connectDB();let moved=0,skipped=0;for(const Model of [Reel,Post]){const docs=await Model.find({'media.0':{$exists:true}});for(const doc of docs){let changed=false;for(const item of doc.media||[]){if(await migrateItem(item,Model===Reel?'reels':'posts')){changed=true;moved++}else skipped++}if(changed)await doc.save()}}
 const stories=await Story.find({$or:[{'media.0':{$exists:true}},{'music.url':{$ne:''}}]});for(const doc of stories){let changed=false;for(const item of doc.media||[]){if(await migrateItem(item,'stories')){changed=true;moved++}else skipped++}if(doc.music?.url){if(await migrateItem(doc.music,'stories')){changed=true;moved++}else skipped++}if(changed)await doc.save()}
 console.log(`R2 migration complete: moved=${moved} skipped=${skipped}`);await mongoose.disconnect();}
run().catch(async e=>{console.error(e.stack||e);try{await mongoose.disconnect()}catch(_){}process.exit(1)});
