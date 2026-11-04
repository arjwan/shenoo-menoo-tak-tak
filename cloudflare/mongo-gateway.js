/* Developer-only MongoDB bridge. Stage until MongoDB credentials are configured
   and authentication + integration tests pass. All social/user routes remain on D1. */
import d1Worker from './worker.js';
import { MongoClient, ObjectId } from 'mongodb';

const DB_NAME = 'shino_mino_tak_tak';
let cachedClient;
const response = (data, status=200) => Response.json(data, {
  status, headers: {'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'}
});
function database(env) {
  if (!env.MONGODB_URI) throw Error('MongoDB connection is not configured');
  if (!cachedClient) cachedClient = new MongoClient(env.MONGODB_URI, {
    maxPoolSize: 2, minPoolSize: 0, maxIdleTimeMS: 20000, serverSelectionTimeoutMS: 5000
  });
  return cachedClient.db(DB_NAME);
}
async function authorizedDeveloper(req,env) {
  const session = await d1Worker.fetch(new Request(new URL('/api/auth/session',req.url),{
    headers: {Cookie:req.headers.get('Cookie')||''}
  }),env);
  if (!session.ok) return null;
  const {user} = await session.json();
  return ['developer','admin'].includes(user?.role) ? user : null;
}
function normalizeUser(u) {
  return {
    id: String(u._id), fullName:u.fullName||'', username:u.username||'',
    phone:u.phone||'', email:u.email||'', gender:u.gender||'other',
    birthDate:u.birthDate||null,role:u.role,status:u.status,
    approvalSource:u.approvalSource||'pending',createdAt:u.createdAt||null
  };
}
async function handleDeveloper(req,env,pathname) {
  const developer=await authorizedDeveloper(req,env);
  if (!developer) return response({ok:false,message:'هذه الخدمة تتطلب تسجيل دخول المطور المصرّح له'},403);
  const db=database(env);
  if (req.method==='GET' && pathname==='/api/developer/mongo-status') {
    await db.command({ping:1});
    return response({ok:true,source:'mongodb',database:DB_NAME,connected:true});
  }
  if (req.method==='GET' && pathname==='/api/developer/mongo-summary') {
    const [users,stores,teachers,schools,requests,rooms,conversations,groupReports]=await Promise.all([
      db.collection('users').countDocuments(),
      db.collection('stores').countDocuments(),
      db.collection('schoolteachers').countDocuments(),
      db.collection('schoolstudents').countDocuments(),
      db.collection('schoolteacherapplications').countDocuments({status:'pending'}),
      db.collection('gamerooms').countDocuments({'gameState.status':{$in:['waiting','active']}}),
      db.collection('conversations').countDocuments(),
      db.collection('groupreports').countDocuments({status:{$in:['open','reviewing']}})
    ]);
    return response({ok:true,source:'mongodb',counts:{users,stores,teachers,schools,requests,rooms,conversations,groupReports}});
  }
  if (req.method==='GET' && pathname==='/api/developer/mongo-users') {
    const url=new URL(req.url),q=String(url.searchParams.get('q')||'').trim().slice(0,70);
    const status=String(url.searchParams.get('status')||'').trim();
    if (status && !['pending','active','blocked','rejected','all'].includes(status))
      return response({ok:false,message:'حالة غير صالحة'},400);
    const filter={role:'user'};
    if (status && status!=='all') filter.status=status;
    if (q) {
      // Escape user-supplied search string before constructing regex.
      const safe=q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      filter.$or=[{username:{$regex:safe,$options:'i'}},{fullName:{$regex:safe,$options:'i'}}];
    }
    const users=await db.collection('users').find(filter,{
      projection:{fullName:1,username:1,phone:1,email:1,gender:1,birthDate:1,role:1,status:1,approvalSource:1,createdAt:1},
      sort:{createdAt:-1},limit:100,maxTimeMS:4000
    }).toArray();
    return response({ok:true,users:users.map(normalizeUser),source:'mongodb'});
  }
  if (req.method==='GET' && pathname==='/api/developer/mongo-admins') {
    const admins=await db.collection('users').find({role:{$in:['developer','admin']}},{
      projection:{fullName:1,username:1,role:1,status:1,createdAt:1},limit:100,maxTimeMS:4000
    }).toArray();
    return response({ok:true,admins:admins.map(normalizeUser),source:'mongodb'});
  }
  if (req.method==='GET' && pathname==='/api/developer/mongo-teacher-applications') {
    const url=new URL(req.url),status=String(url.searchParams.get('status')||'pending');
    if (!['pending','approved','rejected','all'].includes(status))
      return response({ok:false,message:'حالة غير صالحة'},400);
    const filter=status==='all'?{}:{status};
    const applications=await db.collection('schoolteacherapplications')
      .find(filter,{projection:{applicant:1,fullName:1,phone:1,email:1,subjects:1,stages:1,grades:1,qualifications:1,experienceYears:1,bio:1,notes:1,createdAt:1,status:1},sort:{createdAt:-1},limit:100,maxTimeMS:4000}).toArray();
    return response({ok:true,applications:applications.map(a=>({...a,_id:String(a._id),applicant:a.applicant&&typeof a.applicant==='object'?{...a.applicant,_id:a.applicant._id?String(a.applicant._id):undefined}:undefined})),source:'mongodb'});
  }
  // No arbitrary collection access or unreviewed cross-database writes.
  return response({ok:false,message:'الخدمة المطلوبة غير مفعلة على قاعدة المطور بعد'},501);
}
export default {
  async fetch(req,env,ctx) {
    const pathname=new URL(req.url).pathname;
    if (pathname.startsWith('/api/developer/mongo-')) {
      if(req.method!=='GET')return response({ok:false,message:'القراءة فقط لحين اختبار نظام مراجعة الصلاحيات'},405);
      try{return await handleDeveloper(req,env,pathname);}
      catch(e){console.error('MongoDB developer bridge:',String(e?.message||e));return response({ok:false,message:'تعذر الاتصال ببيانات المطور المساعدة'},503);}
    }
    return d1Worker.fetch(req,env,ctx);
  }
};
