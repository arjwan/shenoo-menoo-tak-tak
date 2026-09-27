'use strict';

/**
 * Seed platform-owned digital personas for Shenoo Menoo.
 * They are original synthetic identities, never copies of real people.
 *
 * Usage:
 *   node src/scripts/seed-social-digital-personas.js
 *   SOCIAL_PERSONA_COUNT=1000 SOCIAL_PERSONA_BATCH=launch-v1 node src/scripts/seed-social-digital-personas.js
 */
require('dotenv').config();
const mongoose=require('mongoose');
const bcrypt=require('bcryptjs');
const crypto=require('crypto');
const User=require('../models/User');

const mongo=process.env.MONGODB_URI||process.env.MONGO_URI;
const count=Math.max(1,Math.min(5000,Number(process.env.SOCIAL_PERSONA_COUNT||1000)));
const batch=String(process.env.SOCIAL_PERSONA_BATCH||'shenoo-digital-v1').trim();

const male=['علي','حيدر','كرار','مصطفى','حسن','سجاد','مهدي','أحمد','منتظر','ياسر','محمد','مرتضى','عباس','قاسم','زيد'];
const female=['زهراء','نور','مريم','سارة','آية','شهد','زينب','رؤى','بتول','هدى','فرح','غدير','نرجس','دانية','رسل'];
const family=['التميمي','الجبوري','الشمري','الخفاجي','الربيعي','اللامي','الساعدي','العزاوي','العبيدي','المالكي','الأسدي','الكعبي','الموسوي','الدليمي','العامري'];
const gov=['بغداد','البصرة','نينوى','النجف','كربلاء','بابل','ديالى','واسط','ذي قار','ميسان','الأنبار','كركوك','صلاح الدين','الديوانية','المثنى'];
const interests=['رياضة','تقنية','طبخ','كتب','تصوير','ألعاب','دراسة','سيارات','سفر','فن','موسيقى','أفلام','حدائق','قهوة','تاريخ','علوم'];
const jobs=['طالب','موظف','مصمم','مبرمج','مدرس','صانع محتوى','محاسب','مهندس','مصور','صاحب عمل حر'];
function pick(a,n){return a[n%a.length]}
function sample(a,n,k=3){const out=[];for(let i=0;i<k;i++)out.push(a[(n*7+i*5)%a.length]);return [...new Set(out)]}
function username(i,g){return `digital_${g==='male'?'m':'f'}_${String(i).padStart(5,'0')}`}
(async()=>{
 if(!mongo)throw Error('MONGODB_URI/MONGO_URI is required');
 await mongoose.connect(mongo);
 try{
  const sharedHash=await bcrypt.hash(crypto.randomBytes(48).toString('hex'),12);
  const ops=[];
  for(let i=1;i<=count;i++){
   const gender=i%2?'male':'female',first=pick(gender==='male'?male:female,i),last=pick(family,i*3),u=username(i,gender);
   const age=18+(i*11)%43,birth=new Date(Date.UTC(new Date().getUTCFullYear()-age,(i*5)%12,1+(i*7)%27));
   const city=pick(gov,i*5),ints=sample(interests,i,3+(i%3));
   ops.push({updateOne:{filter:{username:u,isSynthetic:true,syntheticBatch:batch},update:{$setOnInsert:{
    fullName:`${first} ${last}`,displayName:`${first} ${last}`,username:u,
    contact:`${u}@digital.shenoo.invalid`,contactType:'email',email:`${u}@digital.shenoo.invalid`,
    contactVerified:true,contactVerifiedAt:new Date(),birthDate:birth,gender,passwordHash:sharedHash,
    termsAccepted:true,privacyAccepted:true,privacyAcceptedAt:new Date(),role:'user',status:'active',approvalSource:'automatic',
    profile:{bio:`${pick(jobs,i)} • مهتم بـ ${ints.slice(0,2).join(' و ')}`,avatarUrl:'',coverUrl:'',governorate:city,city,profession:pick(jobs,i),online:false,lastSeen:null},
    isSynthetic:true,syntheticBatch:batch,
    syntheticPersona:{disclosureLabel:'شخصية رقمية',ageBand:age<25?'18-24':age<35?'25-34':age<45?'35-44':'45+',interests:ints,activityLevel:i%7===0?'high':i%3===0?'low':'medium'}
   }},upsert:true}});
  }
  let upserted=0,matched=0;
  for(let i=0;i<ops.length;i+=250){const r=await User.bulkWrite(ops.slice(i,i+250),{ordered:false});upserted+=r.upsertedCount||0;matched+=r.matchedCount||0}
  console.log(JSON.stringify({ok:true,batch,requested:count,created:upserted,existing:matched,total:await User.countDocuments({isSynthetic:true,syntheticBatch:batch})}));
 }finally{await mongoose.disconnect()}
})().catch(e=>{console.error(e);process.exit(1)});
