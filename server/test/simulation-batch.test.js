'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {buildPlan,options,TYPES}=require('../src/simulation/plan');
const plan=buildPlan({batch:'test-fixture',now:'2026-09-30T12:00:00Z'});
test('1200 accounts, media, 300 enrollment requests and varied teacher loads',()=>{
 assert.equal(plan.data.User.length,1200);assert.equal(plan.data.Post.length,1200);assert.equal(plan.data.PostComment.length,2400);assert.equal(plan.data.SchoolEnrollmentRequest.length,300);
 assert.equal(new Set(plan.data.User.map(u=>u.profile.avatarUrl)).size,1200);
 assert.equal(new Set(plan.data.Post.map(p=>p.media[0].url)).size,1200);
 assert.equal(new Set(plan.data.SchoolEnrollmentRequest.map(r=>r.stage)).size,3);
 assert.equal(plan.data.SchoolTeacher.length,18);
 assert.ok(plan.data.SchoolTeacher.every(t=>t.assignedStudents.length>0));
 assert.ok(new Set(plan.data.SchoolTeacher.map(t=>t.assignedStudents.length)).size>1);
 assert.equal(plan.data.SchoolEnrollmentRequest.filter(r=>r.status==='pending').length,80);
});
test('every row is batch scoped, stable and unique; different batches never collide',()=>{
 const second=buildPlan({batch:'other-fixture',now:'2026-09-30T12:00:00Z'});
 const all=TYPES.flatMap(t=>plan.data[t]);assert.equal(new Set(all.map(d=>d._id)).size,all.length);
 assert.ok(all.every(d=>d.isSynthetic===true&&d.syntheticBatch==='test-fixture'));
 assert.deepEqual(plan,buildPlan({batch:'test-fixture',now:'2026-09-30T12:00:00Z'}));
 const ids=new Set(all.map(d=>d._id));assert.ok(TYPES.flatMap(t=>second.data[t]).every(d=>!ids.has(d._id)));
});
test('social references and school relationships target existing synthetic records',()=>{
 const users=new Set(plan.data.User.map(u=>u._id)),students=new Map(plan.data.SchoolStudent.map(s=>[s._id,s]));
 const teachers=new Map(plan.data.SchoolTeacher.map(t=>[t._id,t]));
 for(const post of plan.data.Post){assert.ok(users.has(post.author));assert.ok(post.likes.every(id=>users.has(id)));assert.equal(post.commentsCount,plan.data.PostComment.filter(c=>c.post===post._id).length);}
 for(const student of students.values()){assert.ok(users.has(student.guardian));assert.ok(users.has(student.studentUser));for(const link of student.assignedTeachers)assert.ok(teachers.get(link.teacher).assignedStudents.includes(student._id));}
 for(const event of plan.data.SchoolEventSchedule){assert.ok(users.has(event.teacher));assert.ok(event.students.every(id=>students.has(id)));}
 for(const user of plan.data.User){assert.equal(user.privacy.messaging,'nobody');assert.equal(user.profile.online,false);}
});
test('invalid identifiers and count bounds rejected',()=>{
 for(const batch of ['../escape','x','bad/path'])assert.throws(()=>options({batch}));
 for(const count of [10,5001,'oops',1001.1])assert.throws(()=>options({count}));
});
test('Mongoose validates every generated record and retains cleanup markers',()=>{
 for(const type of TYPES){const Model=require(`../src/models/${type}`);for(const row of plan.data[type]){const doc=new Model(row);assert.equal(doc.validateSync(),undefined,`${type}: ${doc.validateSync()?.message}`);assert.equal(doc.isSynthetic,true);assert.equal(doc.syntheticBatch,plan.batch);}}
});
test('synthetic metadata visible only to developer and administration',()=>{
 const view=require('../src/simulation/persona-view'),user=plan.data.User[0];
 assert.equal(view(user,{role:'user'}).digitalPersona,undefined);
 assert.equal(view(user,{role:'developer'}).syntheticBatch,plan.batch);
 assert.equal(view(user,{role:'developer'}).digitalPersona,true);
});
