/* Hybrid D1 + MongoDB routing.
 * This entrypoint is staged, NOT deployed until MONGODB_URI is configured in
 * Cloudflare as a secret and the deployed bundle has been tested.
 * D1 remains the default for existing endpoints. MongoDB is allowlisted per
 * service, never selected by trying a failed D1 query.
 */
import d1Worker from './worker.js';
import { MongoClient } from 'mongodb';

const MONGO_DATABASE='shino_mino_tak_tak';
const mongoOptions={maxPoolSize:2,minPoolSize:0,maxIdleTimeMS:20000,serverSelectionTimeoutMS:5000};
let client;
function getMongo(env){
  if(!env.MONGODB_URI)throw new Error('MONGODB_URI secret not configured');
  if(!client)client=new MongoClient(env.MONGODB_URI,mongoOptions);
  return client.db(MONGO_DATABASE);
}
const response=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function corsNotNeeded(req){return new URL(req.url).origin;}
async function requireD1Session(req,env){
  // Authenticate through the currently deployed, revocable D1 cookie session.
  const url=new URL('/api/auth/session',req.url);
  const session=await d1Worker.fetch(new Request(url,{method:'GET',headers:{Cookie:req.headers.get('Cookie')||''}}),env);
  if(!session.ok)return null;
  const data=await session.json();
  return data.user||null;
}
async function findMongo(req,env,path){
  const viewer=await requireD1Session(req,env);
  if(!viewer)return response({ok:false,message:'يرجى تسجيل الدخول'},401);
  if(req.method!=='GET')return response({ok:false,message:'الخدمة غير مهيأة للتعديل بعد'},405);
  // Expose only approved stores, never arbitrary collection reads.
  if(path==='/api/stores'){
    const stores=await getMongo(env).collection('stores')
      .find({status:'approved'},{projection:{name:1,description:1,status:1,createdAt:1},limit:60}).toArray();
    return response({ok:true,stores:stores.map(x=>({
      id:String(x._id),name:x.name||'',description:x.description||'',status:x.status
    }))});
  }
  // Developer totals are real MongoDB counts, with D1 role enforcement.
  if(path==='/api/developer/mongo-summary'){
    if(!['admin','developer'].includes(viewer.role))return response({ok:false,message:'هذه الصفحة للمطور فقط'},403);
    const db=getMongo(env);
    const [users,stores,teachers]=await Promise.all([
      db.collection('users').countDocuments(),
      db.collection('stores').countDocuments(),
      db.collection('schoolteachers').countDocuments()
    ]);
    return response({ok:true,source:'mongodb',counts:{users,stores,teachers}});
  }
  return null;
}
export default {
 async fetch(req,env,ctx){
   const path=new URL(req.url).pathname;
   if(path==='/api/stores'||path==='/api/developer/mongo-summary'){
     try{return await findMongo(req,env,path)}
     catch(e){console.error('MongoDB service unavailable',String(e));return response({ok:false,message:'الخدمة غير متاحة مؤقتاً في قاعدة البيانات المساعدة'},503);}
   }
   return d1Worker.fetch(req,env,ctx);
 }
};
