// Cloudflare D1 + R2 profile endpoints. All routes are called AFTER verified
// ordinary HttpOnly authentication in cloudflare/worker.js.
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const error=(message,status=400)=>json({ok:false,message},status);
const properties={bio:500,governorate:100,city:100,birthPlace:120,address:180,education:160,academicSpecialization:160,profession:120,workplace:120,website:250};
const coverCropBounds={coverPositionX:[0,100],coverPositionY:[0,100],coverZoom:[100,250]};
const privacyKeys=['friendRequests','messaging','lastSeen','photo','birthDate','gender','governorate','city','birthPlace','address','education','profession','workplace','phone','email','socialLinks'];
const allowedPrivacy=['everyone','friends','nobody'];
const parse=value=>{try{const o=JSON.parse(value||'{}');return o&&typeof o==='object'&&!Array.isArray(o)?o:{}}catch{return {}}};
const safe=(value,max)=>typeof value==='string'?value.trim().slice(0,max+1):'';
const mediaMime=new Set(['image/jpeg','image/png','image/webp']);
const magic=(bytes,mime)=>mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:mime==='image/png'?bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71:bytes[0]===82&&bytes[1]===73&&bytes[2]===70&&bytes[3]===70&&bytes[8]===87&&bytes[9]===69&&bytes[10]===66&&bytes[11]===80;
const imageUrl=(id,type)=>'/api/profile-media/'+id+'/'+type;
const getProfile=async (env,id)=>parse((await env.DB.prepare('SELECT profile_json FROM user_profiles WHERE user_id=?').bind(id).first())?.profile_json);
async function saveProfile(env,userId,update){
 const old=await getProfile(env,userId);
 const next={...old,...update};
 await env.DB.prepare("INSERT INTO user_profiles(user_id,profile_json) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET profile_json=excluded.profile_json,updated_at=CURRENT_TIMESTAMP").bind(userId,JSON.stringify(next)).run();
 return next;
}
function checkOrigin(req){
 const origin=req.headers.get('Origin');
 if(origin&&origin!==new URL(req.url).origin)return false;
 return !(!origin&&req.headers.get('Sec-Fetch-Site')==='cross-site');
}
async function acceptedFriend(env,viewer,owner){
 if(viewer===owner)return true;
 const row=await env.DB.prepare("SELECT id FROM friend_requests WHERE status='accepted' AND ((sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?)) LIMIT 1").bind(viewer,owner,owner,viewer).first();
 return !!row;
}
function allowed(value,isSelf,isFriend){
 return isSelf||value==='everyone'||(value==='friends'&&isFriend);
}
async function profileView(req,env,actor,targetId){
 const user=await env.DB.prepare("SELECT id,username,full_name,created_at,status FROM users WHERE id=?").bind(targetId).first();
 const extra=await env.DB.prepare("SELECT birth_date,gender FROM user_profiles WHERE user_id=?").bind(targetId).first();
 if(!user||user.status!=='active')return error('الملف الشخصي غير موجود',404);
 const isSelf=actor.id===targetId,profile=await getProfile(env,targetId);
 const isFriend=!isSelf?await acceptedFriend(env,actor.id,targetId):true;
 const [posts,friends]=await Promise.all([
  env.DB.prepare('SELECT COUNT(*) AS n FROM posts WHERE author_id=?').bind(targetId).first(),
  env.DB.prepare('SELECT COUNT(*) AS n FROM follows WHERE follower_id=?').bind(targetId).first()
 ]);
 const p={...profile};delete p.avatarKey;delete p.coverKey;
 // Do not leak private demographic or contact fields to other accounts.
 if(!isSelf){
  delete p.privacy;
  delete p.address;delete p.birthPlace;delete p.birthDate;delete p.email;delete p.phone;
  const visibility=profile.privacy||{};
  for(const k of ['governorate','city','education','profession','workplace','gender','photo','lastSeen']){
   if(!allowed(visibility[k]||'everyone',isSelf,isFriend)){if(k==='photo'){delete p.avatarUrl;delete p.coverUrl;}else delete p[k];}
  }
  if(!allowed(visibility.socialLinks||'everyone',isSelf,isFriend))delete p.socialLinks;
 }
 const mediaAllowed=allowed(profile.privacy?.photo||'everyone',isSelf,isFriend);
 return json({ok:true,user:{id:user.id,username:user.username,fullName:user.full_name,createdAt:user.created_at,
  ...p,isSelf,birthDate:isSelf||((profile.privacy?.birthDate||'nobody')==='everyone')?extra?.birth_date||null:null,
  gender:isSelf||((profile.privacy?.gender||'nobody')==='everyone')?extra?.gender||'other':null,
  avatarUrl:mediaAllowed&&profile.avatarKey?imageUrl(targetId,'avatar'):null,
  coverUrl:mediaAllowed&&profile.coverKey?imageUrl(targetId,'cover'):null,
  postsCount:posts?.n||0,friendsCount:friends?.n||0}});
}
export async function handleProfile(req,env,actor){
 const path=new URL(req.url).pathname,method=req.method;
 const media=path.match(/^\/api\/profile-media\/([a-f0-9-]{36})\/(avatar|cover)$/i);
 if(media&&method==='GET'){
  const profile=await getProfile(env,media[1]);
  const friend=media[1]===actor.id?true:await acceptedFriend(env,actor.id,media[1]);
  if(!allowed(profile.privacy?.photo||'everyone',media[1]===actor.id,friend))return error('الصورة غير متاحة',403);
  const stored=profile[media[2]+'Key'];
  if(!stored)return error('الصورة غير موجودة',404);
  const object=await env.MEDIA.get(stored);
  if(!object)return error('الصورة غير موجودة',404);
  const headers=new Headers({'Content-Type':object.httpMetadata?.contentType||'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
  return new Response(object.body,{headers});
 }
 if(path==='/api/users/me/profile'&&method==='GET')return profileView(req,env,actor,actor.id);
 const other=path.match(/^\/api\/users\/([a-f0-9-]{36})\/profile$/i);
 if(other&&method==='GET')return profileView(req,env,actor,other[1]);
 if(path==='/api/users/me/privacy'&&method==='PATCH'){
  if(!checkOrigin(req))return error('طلب من مصدر غير موثوق',403);
  const body=await req.json().catch(()=>null);
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!privacyKeys.includes(k)||!allowedPrivacy.includes(body[k])))return error('خيارات الخصوصية غير صالحة');
  const before=await getProfile(env,actor.id);
  await saveProfile(env,actor.id,{privacy:{...(before.privacy||{}),...body}});
  return json({ok:true,message:'تم حفظ إعدادات الخصوصية'});
 }
 if(path==='/api/users/me/profile'&&method==='PATCH'){
  if(!checkOrigin(req))return error('طلب من مصدر غير موثوق',403);
  const b=await req.json().catch(()=>null);
  if(!b||typeof b!=='object'||Array.isArray(b))return error('طلب تعديل غير صالح');
  const update={};
  for(const [k,value] of Object.entries(b)){
   if(Object.hasOwn(properties,k)){
    if(typeof value!=='string'||value.length>properties[k])return error('قيمة الحقل غير صالحة: '+k);
    update[k]=value.trim();
   }else if(Object.hasOwn(coverCropBounds,k)){
    const [minimum,maximum]=coverCropBounds[k];
    if(typeof value!=='number'||!Number.isFinite(value)||!Number.isInteger(value)||value<minimum||value>maximum)return error('تمركز الغلاف أو التكبير غير صالح: '+k);
    update[k]=value;
   }else if(k==='socialLinks'){
    if(!Array.isArray(value)||value.length>10||value.some(x=>typeof x!=='string'||x.length>350))return error('الروابط غير صالحة');
    for(const x of value){const raw=x.includes('|')?x.slice(x.indexOf('|')+1):x;try{const url=new URL(raw);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return error('الرابط غير آمن')}catch{return error('رابط غير صالح')}}
    update.socialLinks=value;
   }else return error('هذا الحقل غير قابل للتعديل: '+k);
  }
  if(update.website){try{const u=new URL(update.website);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return error('الرابط غير صالح');}catch{return error('الرابط غير صالح')}}
  const p=await saveProfile(env,actor.id,update);
  return json({ok:true,message:'تم حفظ الملف الشخصي',profile:p});
 }
 const upload=path.match(/^\/api\/users\/me\/profile\/(avatar|cover)$/i);
 if(upload&&method==='PUT'){
  if(!checkOrigin(req))return error('طلب من مصدر غير موثوق',403);
  const mime=(req.headers.get('Content-Type')||'').split(';')[0].trim();
  const size=Number(req.headers.get('Content-Length')||'0');
  if(!mediaMime.has(mime))return error('اختر صورة JPG أو PNG أو WebP فقط',415);
  if(size>8*1024*1024)return error('حجم الصورة يجب ألا يتجاوز 8 ميغابايت',413);
  const body=await req.arrayBuffer();
  if(body.byteLength<12||body.byteLength>8*1024*1024)return error('حجم الصورة غير صالح',413);
  if(!magic(new Uint8Array(body.slice(0,12)),mime))return error('نوع الملف لا يطابق الصورة',415);
  if(!env.MEDIA)return error('التخزين غير مهيأ',503);
  const type=upload[1],key='profiles/'+actor.id+'/'+type+'/'+crypto.randomUUID()+'.'+(mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg');
  await env.MEDIA.put(key,body,{httpMetadata:{contentType:mime}});
  try{await saveProfile(env,actor.id,{[type+'Key']:key});}
  catch(e){await env.MEDIA.delete(key).catch(()=>{});throw e}
  return json({ok:true,message:type==='avatar'?'تم حفظ الصورة الشخصية':'تم حفظ صورة الغلاف',url:imageUrl(actor.id,type)+'?v='+Date.now()});
 }
 return error('المسار غير موجود',404);
}
