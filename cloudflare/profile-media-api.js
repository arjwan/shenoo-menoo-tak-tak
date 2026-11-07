/* Cloudflare D1/R2-backed profile pictures and public profile views. */
const j=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const reject=(m,s=400)=>j({ok:false,message:m},s);
const idPattern='([a-f0-9-]{36})';
const imageUrl=(id,type)=>'/api/profile-picture/'+id+'/'+type;
function parsed(row){try{return JSON.parse(row?.profile_json||'{}')}catch{return {}}}
async function profileRow(env,id){return env.DB.prepare('SELECT u.id,u.username,u.full_name,u.email,u.created_at,p.birth_date,p.gender,p.profile_json FROM users u LEFT JOIN user_profiles p ON p.user_id=u.id WHERE u.id=? AND u.status=\'active\'').bind(id).first()}
const view=(r,self)=>{const p=parsed(r);const publicInfo={id:r.id,username:r.username,fullName:r.full_name,displayName:r.full_name,avatarUrl:p.avatarKey?imageUrl(r.id,'avatar'):'',coverUrl:p.coverKey?imageUrl(r.id,'cover'):'',bio:p.bio||'',governorate:p.governorate||'',city:p.city||'',profession:p.profession||'',workplace:p.workplace||'',education:p.education||'',website:p.website||'',coverPositionX:p.coverPositionX??50,coverPositionY:p.coverPositionY??50,coverZoom:p.coverZoom??100,createdAt:r.created_at,isSelf:self};return self?{...publicInfo,birthDate:r.birth_date,gender:r.gender,email:r.email,profile:{...p,avatarUrl:publicInfo.avatarUrl,coverUrl:publicInfo.coverUrl}}:publicInfo};
export async function handleProfileMedia(req,env,user,path){
 const image=path.match(new RegExp('^/api/profile-picture/'+idPattern+'/(avatar|cover)$','i'));
 if(image&&req.method==='GET'){
   const row=await profileRow(env,image[1]);if(!row)return reject('الصورة غير موجودة',404);
   const meta=parsed(row),key=image[2]==='avatar'?meta.avatarKey:meta.coverKey;if(!key)return reject('الصورة غير موجودة',404);
   const o=await env.MEDIA.get(key);if(!o)return reject('الصورة غير موجودة',404);
   return new Response(o.body,{headers:{'Content-Type':o.httpMetadata?.contentType||'image/jpeg','X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=300'}});
 }
 const profile=path.match(new RegExp('^/api/users/(me|'+idPattern+')/profile$','i'));
 if(profile&&req.method==='GET'){
   const uid=profile[1]==='me'?user.id:profile[1],row=await profileRow(env,uid);
   if(!row)return reject('المستخدم غير موجود',404);
   return j({ok:true,user:view(row,uid===user.id)});
 }
 const change=path.match(/^\/api\/users\/me\/profile\/(avatar|cover)$/);
 if(change&&req.method==='PUT'){
   const mime=(req.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase();
   if(!['image/jpeg','image/png','image/webp'].includes(mime))return reject('صيغة الصورة غير مدعومة',415);
   const bytes=await req.arrayBuffer();if(!bytes.byteLength||bytes.byteLength>8*1024*1024)return reject('حجم الصورة غير صالح',413);
   const a=new Uint8Array(bytes.slice(0,16)),sig=mime==='image/jpeg'?a[0]===255&&a[1]===216&&a[2]===255:mime==='image/png'?a[0]===137&&a[1]===80&&a[2]===78&&a[3]===71:String.fromCharCode(...a.slice(0,4))==='RIFF'&&String.fromCharCode(...a.slice(8,12))==='WEBP';
   if(!sig)return reject('محتوى الصورة غير صالح');
   const row=await env.DB.prepare('SELECT profile_json FROM user_profiles WHERE user_id=?').bind(user.id).first(),info=parsed(row),key='profiles/'+user.id+'/'+change[1]+'/'+crypto.randomUUID(),field=change[1]==='avatar'?'avatarKey':'coverKey',old=info[field];
   await env.MEDIA.put(key,bytes,{httpMetadata:{contentType:mime}});
   try{
     info[field]=key;
     await env.DB.prepare("INSERT INTO user_profiles(user_id,profile_json) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET profile_json=excluded.profile_json,updated_at=CURRENT_TIMESTAMP").bind(user.id,JSON.stringify(info)).run();
   }catch(e){await env.MEDIA.delete(key).catch(()=>{});throw e}
   // Older objects stay available briefly for cached sessions; no destructive migration.
   return j({ok:true,message:'تم حفظ الصورة',url:imageUrl(user.id,change[1])});
 }
 return null;
}
