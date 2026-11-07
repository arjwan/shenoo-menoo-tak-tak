// Dedicated Azawi worker: shares existing Cloudflare D1 revocable user sessions,
// without modifying the main social platform Worker or its secret bindings.
import { handleGameRooms } from './kahwa-rooms.js';
import { handleGameActions } from './kahwa-actions.js';

const SESSION_COOKIE='__Host-shino_session';
const reply=(status,message)=>Response.json({ok:false,message},{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function rawCookie(req){
 const item=(req.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(SESSION_COOKIE+'='));
 return item?item.slice(SESSION_COOKIE.length+1):'';
}
async function sessionUser(req,db){
 const raw=rawCookie(req);
 if(!raw||raw.length>512)return null;
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
 const hash=btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 return db.prepare("SELECT u.id,u.username,u.full_name,u.role,u.status FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.secret_hash=? AND s.revoked_at IS NULL AND s.expires_at>datetime('now') AND u.status='active'").bind(hash).first();
}
export default {
 async fetch(req,env){
   const path=new URL(req.url).pathname;
   if(!env.DB)return reply(503,'قاعدة بيانات الألعاب غير مهيأة');
   if(req.method==='OPTIONS')return reply(405,'طلب غير مسموح');
   if(req.headers.get('Sec-Fetch-Site')==='cross-site')return reply(403,'مصدر الطلب غير موثوق');
   const user=await sessionUser(req,env.DB).catch(()=>null);
   if(!user)return reply(401,'يرجى تسجيل الدخول');
   try{
     if(path==='/api/game-rooms'||path.startsWith('/api/game-rooms/'))return await handleGameRooms(req,env,user);
     if(path.startsWith('/api/game-actions/'))return await handleGameActions(req,env,user);
     return reply(404,'مسار اللعبة غير موجود');
   }catch(error){
     console.error('Azawi gameplay error:',error?.message||'unknown');
     return reply(503,'تعذر تشغيل خدمة الألعاب');
   }
 }
};
