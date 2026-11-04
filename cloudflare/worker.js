/* Cloudflare-only clean API. No Oracle, MongoDB, cPanel or external origin. */
const encoder = new TextEncoder();
const json = (data, status=200) => new Response(JSON.stringify(data), {status, headers: {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const err = (message,status=400) => json({ok:false,message},status);
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64 = str => Uint8Array.from(atob(str.replace(/-/g,'+').replace(/_/g,'/') + '='.repeat((4-str.length%4)%4)), c=>c.charCodeAt(0));
const hash = async (password,salt) => b64(await crypto.subtle.deriveBits({name:'PBKDF2',salt:unb64(salt),iterations:120000,hash:'SHA-256'},await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']),256));
const key = async secret => crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
async function tokenFor(user,secret) {
  const payload=b64(encoder.encode(JSON.stringify({id:user.id,role:user.role,exp:Math.floor(Date.now()/1000)+7*86400})));
  const sig=b64(await crypto.subtle.sign('HMAC',await key(secret),encoder.encode(payload)));
  return payload+'.'+sig;
}
async function authenticate(req,env) {
  const value=req.headers.get('Authorization')||'';
  if(!value.startsWith('Bearer '))throw {status:401,message:'غير مصرح'};
  const parts=value.slice(7).split('.');
  if(parts.length!==2)throw {status:401,message:'جلسة الدخول غير صالحة'};
  const verified=await crypto.subtle.verify('HMAC',await key(env.AUTH_SECRET),unb64(parts[1]),encoder.encode(parts[0])).catch(()=>false);
  if(!verified)throw {status:401,message:'جلسة الدخول غير صالحة'};
  const p=JSON.parse(new TextDecoder().decode(unb64(parts[0])));
  if(!p.id||!Number.isFinite(p.exp)||p.exp<Math.floor(Date.now()/1000))throw {status:401,message:'جلسة الدخول غير صالحة'};
  const user=await env.DB.prepare('SELECT id,username,full_name,role,status FROM users WHERE id=?').bind(p.id).first();
  if(!user||user.status!=='active')throw {status:401,message:'الحساب غير متاح'};
  return user;
}
const safeUser = u => ({id:u.id,username:u.username,fullName:u.full_name,displayName:u.full_name,role:u.role});
async function bodyJSON(req) {const b=await req.json().catch(()=>null);if(!b||typeof b!=='object'||Array.isArray(b))throw {status:400,message:'طلب غير صالح'};return b;}
function mediaType(type, name) {
  const ext=name.toLowerCase().split('.').pop();
  if(type==='image/jpeg'&&['jpg','jpeg'].includes(ext))return 'image';
  if(type==='image/png'&&ext==='png')return 'image';
  if(type==='image/webp'&&ext==='webp')return 'image';
  if(type==='image/gif'&&ext==='gif')return 'image';
  if(type==='video/mp4'&&ext==='mp4')return 'video';
  if(type==='video/webm'&&ext==='webm')return 'video';
  if(['audio/mpeg','audio/mp3'].includes(type)&&ext==='mp3')return 'audio';
  return null;
}
function hasSignature(u,mime){
  if(mime==='image/jpeg')return u[0]===255&&u[1]===216&&u[2]===255;
  if(mime==='image/png')return u[0]===137&&u[1]===80&&u[2]===78&&u[3]===71;
  if(mime==='image/gif')return u[0]===71&&u[1]===73&&u[2]===70;
  if(mime==='image/webp')return String.fromCharCode(...u.slice(0,4))==='RIFF'&&String.fromCharCode(...u.slice(8,12))==='WEBP';
  if(mime==='video/mp4')return String.fromCharCode(...u.slice(4,8))==='ftyp';
  if(mime==='video/webm')return u[0]===26&&u[1]===69&&u[2]===223&&u[3]===163;
  if(mime==='audio/mpeg'||mime==='audio/mp3')return (u[0]===73&&u[1]===68&&u[2]===51)||(u[0]===255&&(u[1]&224)===224);
  return false;
}
async function main(req,env){
  const path=new URL(req.url).pathname;
  if(req.method==='GET'&&path==='/api/health')return json({ok:true,service:'shenoo-cloudflare-clean-api',storage:'d1+r2'});
  if(req.method==='GET'&&path==='/api/auth/registration-config')return json({ok:true,otpRequired:false,phoneRequired:false,developerCanCreateWithoutPhone:false});
  if(req.method==='POST'&&path==='/api/auth/signup'){
    const b=await bodyJSON(req),username=String(b.username||'').trim().toLowerCase(),fullName=String(b.fullName||'').trim(),email=String(b.email||'').trim().toLowerCase(),password=String(b.password||'');
    if(!/^[\p{L}\p{M}0-9_.]{3,30}$/u.test(username)||fullName.length<2||fullName.length>100||password.length<10||password.length>128||!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))return err('اسم المستخدم أو البريد أو كلمة المرور غير صالحة',400);
    if(b.confirmPassword!==undefined&&b.confirmPassword!==password)return err('كلمتا المرور غير متطابقتين');
    let salt,digest;
    try { salt=b64(crypto.getRandomValues(new Uint8Array(16))); digest=await hash(password,salt); }
    catch(e) { console.error('Signup crypto',String(e)); return json({ok:false,message:'تعذر تجهيز الحساب',code:'SIGNUP_CRYPTO'},500); }
    try{await env.DB.prepare('INSERT INTO users(id,username,full_name,email,password_salt,password_hash,role,status) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),username,fullName,email,salt,digest,'user','active').run();}
    catch(e){if(String(e.message||e).includes('UNIQUE'))return err('اسم المستخدم أو البريد مستخدم مسبقاً',409); console.error('Signup D1',String(e));return json({ok:false,message:'تعذر حفظ الحساب',code:'SIGNUP_DATABASE'},500); }
    return json({ok:true,status:'active',verificationRequired:false,message:'تم إنشاء الحساب وتفعيله'},201);
  }
  if(req.method==='POST'&&path==='/api/auth/signin'){
    const b=await bodyJSON(req),identifier=String(b.identifier||'').trim().toLowerCase(),password=String(b.password||'');
    if(!identifier||!password)return err('أدخل بيانات تسجيل الدخول',400);
    const user=await env.DB.prepare('SELECT * FROM users WHERE username=? OR email=?').bind(identifier,identifier).first();
    if(!user||user.status!=='active')return err('بيانات تسجيل الدخول غير صحيحة',401);
    const attempt=await hash(password,user.password_salt);
    const a=unb64(attempt),c=unb64(user.password_hash);
    if(a.length!==c.length||!a.every((v,i)=>v===c[i]))return err('بيانات تسجيل الدخول غير صحيحة',401);
    return json({ok:true,token:await tokenFor(user,env.AUTH_SECRET),user:safeUser(user),message:'تم تسجيل الدخول'});
  }
  if(req.method==='GET'&&path.startsWith('/media/')){
    const id=path.slice('/media/'.length);
    const m=await env.DB.prepare('SELECT m.r2_key,m.mime_type,m.size FROM media m JOIN posts p ON p.id=m.post_id WHERE m.id=? AND p.visibility=?').bind(id,'everyone').first();
    if(!m)return err('الملف غير موجود',404);
    const data=await env.MEDIA.get(m.r2_key);
    if(!data)return err('الملف غير موجود',404);
    return new Response(data.body,{headers:{'Content-Type':m.mime_type,'Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff','Content-Disposition':'inline'}});
  }
  if(!path.startsWith('/api/'))return err('المسار غير موجود',404);
  const user=await authenticate(req,env);
  if(req.method==='GET'&&path==='/api/users/me')return json({ok:true,user:safeUser(user)});
  if(req.method==='GET'&&path==='/api/posts'){
    const rows=await env.DB.prepare('SELECT p.id,p.text,p.visibility,p.created_at,u.id as author_id,u.username,u.full_name FROM posts p JOIN users u ON u.id=p.author_id WHERE p.visibility=? OR p.author_id=? ORDER BY p.created_at DESC LIMIT 30').bind('everyone',user.id).all();
    const ids=rows.results.map(p=>p.id);
    let media=[];
    if(ids.length){media=(await env.DB.prepare('SELECT * FROM media WHERE post_id IN ('+ids.map(()=>'?').join(',')+')').bind(...ids).all()).results;}
    return json({ok:true,posts:rows.results.map(p=>({id:p.id,text:p.text,visibility:p.visibility,author:{id:p.author_id,username:p.username,fullName:p.full_name},media:media.filter(m=>m.post_id===p.id).map(m=>({url:'/media/'+m.id,type:m.kind,mimeType:m.mime_type,size:m.size})),likesCount:0,commentsCount:0,sharesCount:0,createdAt:p.created_at,canEdit:p.author_id===user.id,canDelete:p.author_id===user.id}))});
  }
  if(req.method==='POST'&&path==='/api/posts'){
    const form=await req.formData(),text=String(form.get('text')||'').trim(),visibility=String(form.get('visibility')||'everyone');
    const file=form.get('media'),exists=file instanceof File&&file.size>0;
    if(text.length>5000||!['everyone','friends','followers','friends_followers'].includes(visibility)||(!text&&!exists))return err('محتوى المنشور غير صالح');
    let kind=null,buf=null,mediaId=null,objectKey=null;
    if(exists){
      kind=mediaType(file.type,file.name);
      if(!kind||file.size>15*1024*1024)return err('الملف غير مدعوم أو أكبر من 15 ميغابايت',413);
      buf=await file.arrayBuffer();
      if(!hasSignature(new Uint8Array(buf.slice(0,16)),file.type))return err('نوع الملف لا يطابق محتواه',400);
      mediaId=crypto.randomUUID();objectKey='posts/'+user.id+'/'+mediaId+'.'+file.name.split('.').pop().toLowerCase();
      await env.MEDIA.put(objectKey,buf,{httpMetadata:{contentType:file.type}});
    }
    const postId=crypto.randomUUID();
    try {
      await env.DB.prepare('INSERT INTO posts(id,author_id,text,visibility) VALUES(?,?,?,?)').bind(postId,user.id,text,visibility).run();
      if(exists)await env.DB.prepare('INSERT INTO media(id,post_id,owner_id,r2_key,kind,mime_type,size) VALUES(?,?,?,?,?,?,?)').bind(mediaId,postId,user.id,objectKey,kind,file.type,file.size).run();
    }catch(e){if(objectKey)await env.MEDIA.delete(objectKey).catch(()=>{});await env.DB.prepare('DELETE FROM posts WHERE id=?').bind(postId).run().catch(()=>{});throw e;}
    return json({ok:true,message:'تم النشر',post:{id:postId,text,visibility,author:safeUser(user),media:exists?[{url:'/media/'+mediaId,type:kind,mimeType:file.type,size:file.size}]:[],likesCount:0,commentsCount:0,sharesCount:0,canEdit:true,canDelete:true,createdAt:new Date().toISOString()}},201);
  }
  if(req.method==='GET'&&['/api/stories','/api/reels','/api/friends','/api/social/notifications'].includes(path))return json({ok:true,stories:[],reels:[],friends:[],users:[],notifications:[]});
  return err('هذه الوظيفة لم تُحوّل إلى Cloudflare بعد',501);
}
export default {async fetch(req,env){
  if(!env.DB||!env.MEDIA||!env.AUTH_SECRET)return err('Worker bindings are missing',503);
  try{return await main(req,env);}
  catch(e){if(e?.status)return err(e.message,e.status);console.error('Request failure',String(e?.message||e));return err('خطأ داخلي في الخدمة',500);}
}};
