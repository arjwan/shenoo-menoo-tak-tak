'use strict';

/**
 * Create isolated Sumer School synthetic students for load/functional simulation.
 * Default: 10 students for every active teacher × subject × stage/grade combination.
 * Usage:
 *   node src/scripts/seed-school-test-students.js
 *   TEST_STUDENTS_PER_GROUP=30 node src/scripts/seed-school-test-students.js
 * Cleanup:
 *   SCHOOL_SIMULATION_CLEANUP=1 node src/scripts/seed-school-test-students.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const SchoolStudent = require('../models/SchoolStudent');
const SchoolTeacher = require('../models/SchoolTeacher');

const perGroup = Math.max(1, Math.min(30, Number(process.env.TEST_STUDENTS_PER_GROUP || 10)));
const batch = String(process.env.SCHOOL_SIMULATION_BATCH || 'sumer-sim-v1').trim();
const cleanup = process.env.SCHOOL_SIMULATION_CLEANUP === '1';
const mongo = process.env.MONGODB_URI || process.env.MONGO_URI;

function safe(v){ return String(v || '').trim(); }
function slug(v){ return safe(v).replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase() || 'x'; }

async function ensureTestGuardian(){
  const username = 'sumer_sim_guardian';
  let user = await User.findOne({ username });
  if (user) return user;
  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
  user = await User.create({
    fullName: 'ولي أمر تجريبي — SIMULATION',
    username,
    contact: 'sumer-sim-guardian@invalid.test',
    contactType: 'email',
    email: 'sumer-sim-guardian@invalid.test',
    contactVerified: true,
    contactVerifiedAt: new Date(),
    passwordHash,
    termsAccepted: true,
    privacyAccepted: true,
    privacyAcceptedAt: new Date(),
    role: 'user',
    schoolAccess: { role:'guardian', status:'trial', activatedAt:new Date(), trialStartedAt:new Date(), trialEndsAt:new Date(Date.now()+30*86400000) },
    status: 'active',
    approvalSource: 'automatic'
  });
  return user;
}

async function cleanupBatch(){
  const students = await SchoolStudent.find({ isTestBot:true, simulationBatch:batch }).select('_id');
  const ids = students.map(s=>s._id);
  if (ids.length) {
    await SchoolTeacher.updateMany({}, { $pull: { assignedStudents: { $in: ids } } });
    await SchoolStudent.deleteMany({ _id:{ $in:ids }, isTestBot:true, simulationBatch:batch });
  }
  console.log(JSON.stringify({ok:true,mode:'cleanup',batch,deletedStudents:ids.length}));
}

async function seed(){
  const guardian = await ensureTestGuardian();
  const teachers = await SchoolTeacher.find({status:'active'}).lean();
  let created=0, existing=0, groups=0;

  for (const teacher of teachers) {
    const subjects = (teacher.subjects || []).filter(Boolean);
    const stages = (teacher.stages || []).filter(Boolean);
    const grades = (teacher.grades || []).filter(Boolean);
    if (!subjects.length || !stages.length || !grades.length) continue;

    for (const subject of subjects) for (const stage of stages) for (const grade of grades) {
      groups++;
      for (let i=1;i<=perGroup;i++) {
        const marker = `${batch}:${teacher._id}:${subject}:${stage}:${grade}:${i}`;
        let student = await SchoolStudent.findOne({isTestBot:true,simulationBatch:batch,'notes.text':marker});
        if (student) { existing++; continue; }
        const now=new Date();
        student=await SchoolStudent.create({
          guardian: guardian._id,
          name: `طالب تجريبي ${String(i).padStart(2,'0')} — ${teacher.name}`,
          stage, grade, section:'أ', subjects:[subject],
          assignedTeachers:[{teacher:teacher._id,subject}],
          status:'active', active:true, parentApproved:true,
          registrationDate:now, trialStartedAt:now,
          trialEndsAt:new Date(now.getTime()+30*86400000), trialStatus:'active',
          isTestBot:true, simulationBatch:batch,
          notes:[{text:marker,subject}]
        });
        await SchoolTeacher.updateOne({_id:teacher._id},{$addToSet:{assignedStudents:student._id}});
        created++;
      }
    }
  }
  console.log(JSON.stringify({ok:true,mode:'seed',batch,teachers:teachers.length,groups,perGroup,created,existing,totalSynthetic:created+existing}));
}

(async()=>{
  if(!mongo) throw new Error('MONGODB_URI/MONGO_URI is required');
  await mongoose.connect(mongo);
  try { if(cleanup) await cleanupBatch(); else await seed(); }
  finally { await mongoose.disconnect(); }
})().catch(err=>{ console.error(err); process.exit(1); });
