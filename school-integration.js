(()=>{'use strict';
const QUEUE_KEY='shnoSchoolSyncQueue.v1';
const DB='shno_mano_school_offline',VER=3,STUDENTS='students',SCHEDULES='schedules',SESSIONS='sessions';
const nativeFetch=window.fetch.bind(window);
const token=()=>localStorage.getItem('token')||sessionStorage.getItem('token')||'';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','X-Shno-School-Integration':'1'}});
const nowId=(p)=>`${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
function loadQueue(){try{return JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]').filter(x=>x&&x.clientOpId&&x.type)}catch(_){return []}}
function saveQueue(q){localStorage.setItem(QUEUE_KEY,JSON.stringify(q.slice(0,500)))}
function enqueue(op){const q=loadQueue();if(!q.some(x=>x.clientOpId===op.clientOpId))q.push({...op,queuedAt:new Date().toISOString()});saveQueue(q);setBadge(q.length);return op}
function setBadge(n){document.documentElement.dataset.schoolPendingSync=String(n||loadQueue().length||0)}
function parseBody(init){try{return typeof init.body==='string'?JSON.parse(init.body||'{}'):{}}catch(_){return {}}}
function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,VER);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(STUDENTS))db.createObjectStore(STUDENTS,{keyPath:'_id'});if(!db.objectStoreNames.contains(SCHEDULES))db.createObjectStore(SCHEDULES,{keyPath:'_id'});if(!db.objectStoreNames.contains(SESSIONS))db.createObjectStore(SESSIONS,{keyPath:'_id'})}})}
function txDone(tx){return new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}
async function put(store,value){const db=await openDb();const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);await txDone(tx);db.close();return value}
async function get(store,key){const db=await openDb();const tx=db.transaction(store,'readonly');const req=tx.objectStore(store).get(key);const val=await new Promise((res,rej)=>{req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error)});db.close();return val}
async function patchStudent(id,fn){const s=await get(STUDENTS,id);if(!s)return null;const next=fn({...s})||s;await put(STUDENTS,next);return next}
function schoolUrl(input){return typeof input==='string'?input:(input&&input.url)||''}
function samePath(url,path){try{return new URL(url,location.href).pathname===path}catch(_){return url.endsWith(path)}}
async function tryOnline(input,init){try{if(!navigator.onLine)throw new Error('offline');return await nativeFetch(input,init)}catch(e){throw e}}
async function syncNow(){const q=loadQueue();if(!q.length||!navigator.onLine)return {ok:true,pending:q.length};
 try{const r=await nativeFetch('/api/school/sync',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token()},body:JSON.stringify({operations:q})});const d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw new Error(d.message||'تعذرت مزامنة المدرسة');const okIds=new Set((d.results||[]).filter(x=>x.ok).map(x=>x.clientOpId));const left=q.filter(x=>!okIds.has(x.clientOpId));saveQueue(left);setBadge(left.length);if(okIds.size){try{await nativeFetch('/api/school/students',{headers:{Authorization:'Bearer '+token()}});await nativeFetch('/api/school/schedules',{headers:{Authorization:'Bearer '+token()}})}catch(_){}}return {ok:true,pending:left.length,results:d.results||[]}}catch(e){setBadge(q.length);return {ok:false,message:e.message,pending:q.length}}
}
async function offlineStudent(body){const localId=nowId('local-student');const student={_id:localId,guardian:'local',name:String(body.name||'').trim(),stage:String(body.stage||'').trim(),grade:String(body.grade||'').trim(),subjects:Array.isArray(body.subjects)?body.subjects:[],parentApproved:true,active:true,learningPermissions:{voice:false,camera:false,updatedAt:null},progress:{average:0,sessions:0,answered:0},notes:[],scores:[],offline:true,createdAt:new Date().toISOString()};await put(STUDENTS,student);enqueue({clientOpId:nowId('op-student'),type:'student.create',localId,payload:{...body,localId}});return json({ok:true,student,offline:true,message:'تم حفظ الطالب محليًا وسيُزامن عند عودة الاتصال'},201)}
async function offlinePermissions(id,body){const student=await patchStudent(id,s=>{s.learningPermissions={voice:body.voice===true,camera:body.camera===true,updatedAt:new Date().toISOString()};s.offline=true;return s});if(!student)return json({ok:false,message:'الطالب غير محفوظ على الجهاز'},404);enqueue({clientOpId:nowId('op-perm'),type:'student.permissions',localId:id,payload:{studentRef:id,voice:body.voice===true,camera:body.camera===true}});return json({ok:true,student,offline:true,message:'تم حفظ الموافقة محليًا وستُزامن'},200)}
async function offlineSchedule(body){const localId=nowId('local-schedule');const schedule={_id:localId,guardian:'local',student:body.studentId,subject:String(body.subject||'').trim(),title:body.title||'وقت الدراسة',scheduledAt:body.scheduledAt,durationMinutes:Number(body.durationMinutes)||45,reminderMinutes:Number(body.reminderMinutes)||15,status:'scheduled',offline:true,createdAt:new Date().toISOString()};await put(SCHEDULES,schedule);enqueue({clientOpId:nowId('op-schedule'),type:'schedule.create',localId,payload:{...body,studentRef:body.studentId,localId}});return json({ok:true,schedule,offline:true,message:'تم حفظ الموعد محليًا وسيُزامن'},201)}
async function queueLocalComplete(url,init){const id=(url.match(/sessions\/(local-[^/]+)\/complete/)||[])[1];if(!id)return null;const session=await get(SESSIONS,id);const body=parseBody(init);if(session){enqueue({clientOpId:nowId('op-session'),type:'session.complete',localId:id,payload:{...body,localId:id,studentRef:session.student?._id||session.student,subject:session.subject,lesson:session.lesson,mode:session.mode,startedAt:session.startedAt}})}return null}
window.fetch=async function(input,init={}){const url=schoolUrl(input),method=String(init.method||'GET').toUpperCase();
 if(url.includes('/api/school/')&&navigator.onLine&&loadQueue().length)syncNow();
 if(samePath(url,'/api/school/students')&&method==='POST'){try{return await tryOnline(input,init)}catch(_){return offlineStudent(parseBody(init))}}
 const perm=url.match(/\/api\/school\/students\/([^/]+)\/learning-permissions$/);if(perm&&method==='PATCH'){try{if(!String(perm[1]).startsWith('local-'))return await tryOnline(input,init);throw new Error('local')}catch(_){return offlinePermissions(decodeURIComponent(perm[1]),parseBody(init))}}
 if(samePath(url,'/api/school/schedules')&&method==='POST'){try{return await tryOnline(input,init)}catch(_){return offlineSchedule(parseBody(init))}}
 if(/\/api\/school\/sessions\/local-[^/]+\/complete/.test(url)&&method==='POST')await queueLocalComplete(url,init);
 return nativeFetch(input,init)};
window.ShnoSchoolIntegration={sync:syncNow,pending:()=>loadQueue().length};
window.addEventListener('online',()=>syncNow());document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncNow()});setBadge();
})();
