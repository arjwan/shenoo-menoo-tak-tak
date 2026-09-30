'use strict';
const crypto = require('node:crypto');
const TYPES = ['User','Post','PostComment','Reel','Story','SchoolTeacher','SchoolStudent','SchoolEnrollmentRequest','SchoolEventSchedule','SchoolAttendanceRecord','SchoolGradeRecord','GuardianConsent'];
function options(input = {}) {
  const batch = input.batch || 'shenoo-test-20260930';
  if (!/^[a-zA-Z0-9_-]{3,48}$/.test(batch)) throw Error('Invalid batch identifier');
  const count = Number(input.count || 1200);
  if (!Number.isInteger(count) || count < 1001 || count > 5000) throw Error('Count must be an integer from 1001 to 5000');
  const now = new Date(input.now || Date.now());
  if (!Number.isFinite(now.getTime())) throw Error('Invalid date');
  return {batch,count,now};
}
function id(batch, type, key) { return crypto.createHash('sha256').update(`${batch}:${type}:${key}`).digest('hex').slice(0,24); }
const first = ['علي','حيدر','حسن','مصطفى','كرار','محمد','أحمد','سجاد','عباس','مهدي','نور','مريم','زهراء','زينب','سارة','شهد','آية','هدى','فرح','رؤى'];
const last = ['حسن','علي','أحمد','محمد','خالد','سالم','كريم','جاسم','سعد','عادل','فاضل','ماجد','راشد','ناصر','باسم','وليد','طارق','سامر','هاشم','قاسم'];
const subjects = ['رياضيات','اللغة العربية','اللغة الإنجليزية','العلوم','التربية الإسلامية','الاجتماعيات'];
const stages = ['ابتدائي','متوسط','إعدادي'];
const topics = ['قرأت اليوم كتابًا جميلًا عن تاريخ العراق','صباح الخير، ما خطتكم لهذا اليوم؟','أحب تعلم مهارة جديدة كل أسبوع','مشاركة صغيرة عن جمال الطبيعة','الرياضة اليومية تمنحني نشاطًا','من يحب الرسم والألوان؟','وقت الدراسة يحتاج إلى تنظيم','أجمل اللحظات تجمعنا مع الأصدقاء','جربت وصفة جديدة في المطبخ','التقنية تجعل التعلم أسهل'];
const replies = ['فكرة جميلة','بالتوفيق دائمًا','شكرًا على المشاركة','موضوع يستحق النقاش','أتفق معك','ما الخطوة التالية؟'];
function buildPlan(input) {
  const {batch,count,now} = options(input);
  const data = Object.fromEntries(TYPES.map(t=>[t,[]]));
  const prefix = crypto.createHash('sha256').update(batch).digest('hex').slice(0,12);
  const base = `/uploads/simulation/${batch}`;
  function add(type,key,doc) {
    const row = {_id:id(batch,type,key),...doc,isSynthetic:true,syntheticBatch:batch,simulationKey:String(key),createdAt:doc.createdAt || now,updatedAt:now};
    data[type].push(row); return row;
  }
  function schoolAccess(role) {return {role,status:'trial',activatedAt:now,trialStartedAt:now,trialEndsAt:new Date(+now+30*86400000)};}
  for (let i=0;i<count;i++) {
    const role = i<300?'guardian':i<600?'student':i<618?'teacher':'guest';
    const username = `sim_${prefix}_${String(i).padStart(4,'0')}`;
    const name = `${first[i%20]} ${last[Math.floor(i/20)%20]}`;
    add('User',i,{fullName:name,displayName:name,username,contact:`${username}@example.invalid`,email:`${username}@example.invalid`,contactType:'email',contactVerified:true,passwordHash:'REPLACE_WITH_RANDOM_HASH',termsAccepted:true,privacyAccepted:true,role:'user',status:'active',approvalSource:'developer',birthDate:new Date(role==='student'?'2013-01-01':'1995-01-01'),gender:i%20<10?'male':'female',schoolAccess:schoolAccess(role),profile:{avatarUrl:`${base}/avatar-${i}.svg`,coverUrl:`${base}/image-${i}.svg`,bio:topics[i%topics.length],online:false},privacy:{messaging:'nobody',audioCalls:'nobody',videoCalls:'nobody',friendRequests:'nobody'},syntheticPersona:{activityLevel:i%3?'medium':'high'}});
  }
  const users=data.User;
  for(let t=0;t<18;t++) {
    const stage=stages[Math.floor(t/6)],subject=subjects[t%6];
    add('SchoolTeacher',t,{user:users[600+t]._id,name:users[600+t].fullName,gender:users[600+t].gender==='male'?'ذكر':'أنثى',subjects:[subject],stages:[stage],grades:['الأول'],sections:['أ'],status:'active',assignedStudents:[]});
  }
  for(let i=0;i<300;i++) {
    const teacher=data.SchoolTeacher[(i*i+Math.floor(i/18))%18],stage=teacher.stages[0],subject=teacher.subjects[0];
    const status=i<180?'approved':i<260?'pending':'rejected';
    add('SchoolEnrollmentRequest',i,{user:users[i]._id,guardian:users[i]._id,requestedRole:'student',studentName:users[300+i].fullName,studentUsername:users[300+i].username,stage,grade:'الأول',subjects:[subject],status,note:`اختبار التسجيل لدى ${teacher.name}`,reviewedAt:status==='pending'?null:now,rejectionReason:status==='rejected'?'سيناريو اختبار رفض الطلب':'',consents:['microphone','camera','live_classroom_participation','virtual_teacher_participation','ai_voice_usage','save_learning_qa','school_notifications'].map(consentType=>({consentType,granted:true,decidedAt:now}))});
    if(status!=='approved') {users[300+i].schoolAccess.status='not_started';continue;}
    const student=add('SchoolStudent',i,{guardian:users[i]._id,studentUser:users[300+i]._id,name:users[300+i].fullName,stage,grade:'الأول',section:'أ',subjects:[subject],assignedTeachers:[{teacher:teacher._id,subject}],status:'active',active:true,parentApproved:true,isTestBot:true,simulationBatch:batch,trialStartedAt:now,trialEndsAt:new Date(+now+30*86400000),progress:{average:60+i%40,sessions:3,answered:4}});
    teacher.assignedStudents.push(student._id);
    for(const consentType of data.SchoolEnrollmentRequest[i].consents.map(c=>c.consentType)) add('GuardianConsent',`${i}:${consentType}`,{guardian:users[i]._id,student:student._id,consentType,granted:true,text:'موافقة اصطناعية لاختبار النظام',version:'2026-09-21-v1'});
    add('SchoolAttendanceRecord',i,{student:student._id,teacher:teacher.user,stage,grade:'الأول',subject,date:now,status:i%7?'present':'absent'});
    add('SchoolGradeRecord',i,{student:student._id,teacher:teacher.user,subject,title:'تقييم تدريبي',score:60+i%40,maxScore:100,gradeType:'quiz'});
  }
  for(let t=0;t<18;t++) {
    const teacher=data.SchoolTeacher[t];
    add('SchoolEventSchedule',t,{type:'LIVE_CLASS',title:`حصة تدريبية — ${teacher.subjects[0]}`,teacher:teacher.user,teacherName:teacher.name,stage:teacher.stages[0],grade:'الأول',section:'أ',subject:teacher.subjects[0],lesson:'درس محاكاة تشغيلية',scheduledAt:new Date(+now+(t+1)*3600000),students:teacher.assignedStudents,createdBy:teacher.user});
  }
  for(let i=0;i<count;i++) {
    const author=users[i]._id,createdAt=new Date(+now-(i%120)*3600000);
    const likes=Array.from({length:2+i%9},(_,j)=>users[(i+j+1)%count]._id);
    const post=add('Post',i,{author,text:topics[i%10],media:[{url:`${base}/image-${i}.svg`,type:'image',mimeType:'image/svg+xml',storage:'local'}],visibility:'everyone',type:'post',active:true,likes,commentsCount:2,sharesCount:i%5,createdAt});
    for(let j=0;j<2;j++) add('PostComment',`${i}:${j}`,{post:post._id,author:users[(i+j+1)%count]._id,text:replies[(i+j)%replies.length],createdAt:new Date(+createdAt+(j+1)*60000)});
    if(i<80) add('Reel',i,{author,text:topics[i%10],media:[{url:`${base}/reel-${i%8}.mp4`,type:'video',mimeType:'video/mp4',storage:'local'}],visibility:'everyone',likes,comments:[{author:users[(i+1)%count]._id,text:replies[i%6]}],savedBy:[users[(i+2)%count]._id],active:true,createdAt});
    if(i<120) add('Story',i,{author,text:topics[i%10],media:[{url:`${base}/image-${i}.svg`,type:'image',mimeType:'image/svg+xml',storage:'local'}],visibility:'everyone',active:true,expiresAt:new Date(+now+86400000)});
  }
  return {batch,count,base,data};
}
module.exports={TYPES,options,id,buildPlan};
