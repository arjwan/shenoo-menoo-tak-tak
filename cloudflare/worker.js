import { pbkdf2Sync, timingSafeEqual } from 'node:crypto';
/* Cloudflare-only clean API. No Oracle, MongoDB, cPanel or external origin. */
const encoder = new TextEncoder();
const json = (data, status=200) => new Response(JSON.stringify(data), {status, headers: {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const err = (message,status=400) => json({ok:false,message},status);
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64 = str => Uint8Array.from(atob(str.replace(/-/g,'+').replace(/_/g,'/') + '='.repeat((4-str.length%4)%4)), c=>c.charCodeAt(0));
const hash = async (password,salt) => b64(pbkdf2Sync(password, unb64(salt), 100000, 32, 'sha256'));

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
  // Signed, short-lived access to R2 story attachments. The story must still be active.
  const storyMediaRoute=path.match(/^\/api\/story-media\/([a-f0-9-]{36})$/i);
  if(req.method==='GET'&&storyMediaRoute){
    const mediaId=storyMediaRoute[1],access=new URL(req.url).searchParams.get('access')||'',parts=access.split('.');
    if(parts.length!==2)return err('رابط الوسائط غير مصرح',403);
    const valid=await crypto.subtle.verify('HMAC',await key(env.AUTH_SECRET),unb64(parts[1]),encoder.encode(parts[0])).catch(()=>false);
    if(!valid)return err('رابط الوسائط غير مصرح',403);
    const data=JSON.parse(new TextDecoder().decode(unb64(parts[0])));
    if(data.role!=='story-media'||data.id!==mediaId||data.exp<Math.floor(Date.now()/1000))return err('انتهت صلاحية الرابط',403);
    const file=await env.DB.prepare("SELECT m.r2_key,m.mime_type FROM story_media m JOIN stories s ON s.id=m.story_id WHERE m.id=? AND s.expires_at>datetime('now')").bind(mediaId).first();
    if(!file)return err('القصة غير متاحة',404);
    const head=await env.MEDIA.head(file.r2_key);
    if(!head)return err('الملف غير موجود',404);
    const headers=new Headers({'Content-Type':file.mime_type,'Cache-Control':'private,max-age=120','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff'});
    const rangeValue=req.headers.get('Range');
    let range=null;
    if(rangeValue){
      const m=/^bytes=(\d*)-(\d*)$/.exec(rangeValue.trim());
      if(!m||(m[1]===''&&m[2]===''))return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+head.size}});
      let start,end;
      if(m[1]===''){
        const suffix=Number(m[2]);if(!Number.isSafeInteger(suffix)||suffix<1)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+head.size}});
        start=Math.max(0,head.size-suffix);end=head.size-1;
      }else{
        start=Number(m[1]);end=m[2]!==''?Number(m[2]):head.size-1;
        if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=head.size||end<start)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+head.size}});
        end=Math.min(end,head.size-1);
      }
      range={offset:start,length:end-start+1};
      headers.set('Content-Range','bytes '+start+'-'+end+'/'+head.size);
      headers.set('Content-Length',String(range.length));
    }else headers.set('Content-Length',String(head.size));
    const obj=await env.MEDIA.get(file.r2_key,range?{range}:undefined);
    if(!obj)return err('الملف غير موجود',404);
    return new Response(obj.body,{status:range?206:200,headers});
  }
  if(req.method==='GET'&&path==='/api/health')return json({ok:true,service:'shenoo-cloudflare-clean-api',storage:'d1+r2'});
  if(req.method==='GET'&&path==='/api/auth/registration-config')return json({ok:true,otpRequired:false,phoneRequired:false,developerCanCreateWithoutPhone:false});
  if(req.method==='POST'&&path==='/api/auth/signup'){
    const b=await bodyJSON(req),username=String(b.username||'').trim().toLowerCase(),fullName=String(b.fullName||'').trim(),email=String(b.email||'').trim().toLowerCase(),password=String(b.password||'');
    if(!/^[\p{L}\p{M}0-9_.]{3,30}$/u.test(username)||fullName.length<2||fullName.length>100||password.length<10||password.length>128||!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))return err('اسم المستخدم أو البريد أو كلمة المرور غير صالحة',400);
    if(b.confirmPassword!==undefined&&b.confirmPassword!==password)return err('كلمتا المرور غير متطابقتين');
    let salt,digest;
    try { salt=b64(crypto.getRandomValues(new Uint8Array(16))); }
    catch(e) { console.error('Signup random',String(e)); return json({ok:false,message:'تعذر تجهيز الحساب',code:'SIGNUP_RANDOM',type:e.message},500); }
    try { digest=await hash(password,salt); }
    catch(e) { console.error('Signup derivation',String(e)); return json({ok:false,message:'تعذر تجهيز الحساب',code:'SIGNUP_HASH',type:e.message},500); }
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
    if(a.length!==c.length||!timingSafeEqual(a,c))return err('بيانات تسجيل الدخول غير صحيحة',401);
    return json({ok:true,token:await tokenFor(user,env.AUTH_SECRET),user:safeUser(user),message:'تم تسجيل الدخول'});
  }
  if(req.method==='GET'&&path.startsWith('/media/')){
    const id=path.slice('/media/'.length);
    const m=await env.DB.prepare('SELECT m.r2_key,m.mime_type,m.size FROM media m JOIN posts p ON p.id=m.post_id WHERE m.id=? AND p.visibility=?').bind(id,'everyone').first();
    if(!m)return err('الملف غير موجود',404);
    const object=await env.MEDIA.head(m.r2_key);
    if(!object)return err('الملف غير موجود',404);
    const size=object.size;
    const rangeHeader=req.headers.get('Range');
    const headers=new Headers({'Content-Type':m.mime_type,'Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff','Content-Disposition':'inline','Accept-Ranges':'bytes','Content-Encoding':'identity'});
    if(object.httpEtag)headers.set('ETag',object.httpEtag);
    let range;
    if(rangeHeader){
      const match=/^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
      if(!match||(match[1]===''&&match[2]===''))return new Response(null,{status:416,headers:{...Object.fromEntries(headers),'Content-Range':'bytes */'+size}});
      let start,end;
      if(match[1]===''){
        const suffix=Number(match[2]);
        if(!Number.isSafeInteger(suffix)||suffix<=0)return new Response(null,{status:416,headers:{...Object.fromEntries(headers),'Content-Range':'bytes */'+size}});
        start=Math.max(0,size-suffix);end=size-1;
      }else{
        start=Number(match[1]);end=match[2]!==''?Number(match[2]):size-1;
        if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||end<start)return new Response(null,{status:416,headers:{...Object.fromEntries(headers),'Content-Range':'bytes */'+size}});
        end=Math.min(end,size-1);
      }
      range={offset:start,length:end-start+1};
      headers.set('Content-Range','bytes '+start+'-'+end+'/'+size);
      headers.set('Content-Length',String(range.length));
    }else headers.set('Content-Length',String(size));
    const data=await env.MEDIA.get(m.r2_key,range?{range}:undefined);
    if(!data||!data.body)return err('الملف غير موجود',404);
    return new Response(data.body,{status:range?206:200,headers});
  }
  if(!path.startsWith('/api/'))return err('المسار غير موجود',404);
  const user=await authenticate(req,env);
  if(req.method==='GET'&&path==='/api/users/me')return json({ok:true,user:safeUser(user)});
  if(req.method==='GET'&&path==='/api/posts'){
    const rows=await env.DB.prepare('SELECT p.id,p.text,p.visibility,p.created_at,u.id as author_id,u.username,u.full_name FROM posts p JOIN users u ON u.id=p.author_id WHERE p.visibility=? OR p.author_id=? ORDER BY p.created_at DESC LIMIT 30').bind('everyone',user.id).all();
    const ids=rows.results.map(p=>p.id);
    let media=[];
    if(ids.length){media=(await env.DB.prepare('SELECT * FROM media WHERE post_id IN ('+ids.map(()=>'?').join(',')+')').bind(...ids).all()).results;}
    const likeIds=rows.results.map(p=>p.id); let reactions=[]; let comments=[]; if(likeIds.length){const qs=likeIds.map(()=>'?').join(',');reactions=(await env.DB.prepare('SELECT post_id,user_id FROM post_likes WHERE post_id IN ('+qs+')').bind(...likeIds).all()).results;comments=(await env.DB.prepare('SELECT post_id,COUNT(*) AS n FROM post_comments WHERE post_id IN ('+qs+') GROUP BY post_id').bind(...likeIds).all()).results;}
    return json({ok:true,posts:rows.results.map(p=>({id:p.id,text:p.text,visibility:p.visibility,author:{id:p.author_id,username:p.username,fullName:p.full_name},media:media.filter(m=>m.post_id===p.id).map(m=>({url:'/media/'+m.id,type:m.kind,mimeType:m.mime_type,size:m.size})),likesCount:reactions.filter(v=>v.post_id===p.id).length,liked:reactions.some(v=>v.post_id===p.id&&v.user_id===user.id),commentsCount:comments.find(c=>c.post_id===p.id)?.n||0,sharesCount:0,createdAt:p.created_at,canEdit:p.author_id===user.id,canDelete:p.author_id===user.id}))});
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

  // Cloudflare-native social functions. Every write is authorized server-side.
  if(req.method==='GET'&&path==='/api/users/search'){
    const q=String(new URL(req.url).searchParams.get('q')||'').trim().slice(0,60);
    if(q.length<2)return json({ok:true,users:[]});
    const rows=await env.DB.prepare("SELECT id,username,full_name FROM users WHERE status='active' AND (username LIKE ? OR full_name LIKE ?) ORDER BY username LIMIT 25").bind('%'+q+'%','%'+q+'%').all();
    return json({ok:true,users:rows.results.map(safeUser)});
  }
  const profileRoute=path.match(/^\/api\/users\/([a-f0-9-]{36})$/i);
  if(req.method==='GET'&&profileRoute){
    const target=await env.DB.prepare("SELECT id,username,full_name,role,status,created_at FROM users WHERE id=?").bind(profileRoute[1]).first();
    if(!target||target.status!=='active')return err('المستخدم غير موجود',404);
    const following=await env.DB.prepare('SELECT COUNT(*) AS n FROM follows WHERE follower_id=?').bind(target.id).first();
    const followers=await env.DB.prepare('SELECT COUNT(*) AS n FROM follows WHERE followed_id=?').bind(target.id).first();
    const ownFollow=await env.DB.prepare('SELECT 1 AS found FROM follows WHERE follower_id=? AND followed_id=?').bind(user.id,target.id).first();
    return json({ok:true,user:{...safeUser(target),createdAt:target.created_at,followersCount:followers.n,followingCount:following.n,isFollowing:!!ownFollow}});
  }
  const followRoute=path.match(/^\/api\/users\/([a-f0-9-]{36})\/follow$/i);
  if(followRoute&&['POST','DELETE'].includes(req.method)){
    const target=followRoute[1];
    if(target===user.id)return err('لا يمكنك متابعة نفسك');
    const exists=await env.DB.prepare("SELECT 1 AS found FROM users WHERE id=? AND status='active'").bind(target).first();
    if(!exists)return err('المستخدم غير موجود',404);
    if(req.method==='POST')await env.DB.prepare('INSERT OR IGNORE INTO follows(follower_id,followed_id) VALUES(?,?)').bind(user.id,target).run();
    else await env.DB.prepare('DELETE FROM follows WHERE follower_id=? AND followed_id=?').bind(user.id,target).run();
    return json({ok:true,following:req.method==='POST'});
  }
  if(req.method==='GET'&&path==='/api/friends'){
    const rows=await env.DB.prepare("SELECT u.id,u.username,u.full_name FROM follows f JOIN users u ON u.id=f.followed_id WHERE f.follower_id=? AND u.status='active' ORDER BY u.username LIMIT 100").bind(user.id).all();
    return json({ok:true,friends:rows.results.map(safeUser),users:rows.results.map(safeUser),mode:'following'});
  }
  const postRoute=path.match(/^\/api\/posts\/([a-f0-9-]{36})$/i);
  if(postRoute&&req.method==='DELETE'){
    const post=await env.DB.prepare('SELECT author_id FROM posts WHERE id=?').bind(postRoute[1]).first();
    if(!post)return err('المنشور غير موجود',404);
    if(post.author_id!==user.id)return err('غير مصرح',403);
    const media=await env.DB.prepare('SELECT r2_key FROM media WHERE post_id=?').bind(postRoute[1]).all();
    await env.DB.prepare('DELETE FROM posts WHERE id=? AND author_id=?').bind(postRoute[1],user.id).run();
    for(const m of media.results)await env.MEDIA.delete(m.r2_key).catch(e=>console.error('R2 delete',e));
    return json({ok:true,message:'تم حذف المنشور'});
  }
  const postLike=path.match(/^\/api\/posts\/([a-f0-9-]{36})\/like$/i);
  if(postLike&&['POST','DELETE'].includes(req.method)){
    const post=await env.DB.prepare('SELECT author_id,visibility FROM posts WHERE id=?').bind(postLike[1]).first();
    if(!post||!(post.visibility==='everyone'||post.author_id===user.id))return err('المنشور غير متاح',404);
    if(req.method==='POST')await env.DB.prepare('INSERT OR IGNORE INTO post_likes(post_id,user_id) VALUES(?,?)').bind(postLike[1],user.id).run();
    else await env.DB.prepare('DELETE FROM post_likes WHERE post_id=? AND user_id=?').bind(postLike[1],user.id).run();
    const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM post_likes WHERE post_id=?').bind(postLike[1]).first();
    return json({ok:true,liked:req.method==='POST',likesCount:count.n});
  }
  const postComments=path.match(/^\/api\/posts\/([a-f0-9-]{36})\/comments$/i);
  if(postComments&&['GET','POST'].includes(req.method)){
    const post=await env.DB.prepare('SELECT author_id,visibility FROM posts WHERE id=?').bind(postComments[1]).first();
    if(!post||!(post.visibility==='everyone'||post.author_id===user.id))return err('المنشور غير متاح',404);
    if(req.method==='POST'){
      const b=await bodyJSON(req),message=String(b.text||'').trim();
      if(!message||message.length>2000)return err('نص التعليق غير صالح');
      const id=crypto.randomUUID();
      await env.DB.prepare('INSERT INTO post_comments(id,post_id,author_id,text) VALUES(?,?,?,?)').bind(id,postComments[1],user.id,message).run();
      return json({ok:true,comment:{id,text:message,author:safeUser(user),createdAt:new Date().toISOString()}},201);
    }
    const rows=await env.DB.prepare('SELECT c.id,c.text,c.created_at,u.id AS user_id,u.username,u.full_name FROM post_comments c JOIN users u ON u.id=c.author_id WHERE c.post_id=? ORDER BY c.created_at DESC LIMIT 100').bind(postComments[1]).all();
    return json({ok:true,comments:rows.results.map(c=>({id:c.id,text:c.text,createdAt:c.created_at,author:{id:c.user_id,username:c.username,fullName:c.full_name}}))});
  }
  if(req.method==='GET'&&path==='/api/stories'){
    const rows=await env.DB.prepare("SELECT s.id,s.text,s.created_at,s.expires_at,u.id AS author_id,u.username,u.full_name,COALESCE(x.visibility,'everyone') AS visibility,COALESCE(x.overlays,'[]') AS overlays,m.id AS media_id,m.role AS media_role,m.kind AS media_kind,m.mime_type AS media_mime,m.size AS media_size FROM stories s JOIN users u ON u.id=s.author_id LEFT JOIN story_extras x ON x.story_id=s.id LEFT JOIN story_media m ON m.story_id=s.id WHERE s.expires_at>datetime('now') AND (s.author_id=? OR COALESCE(x.visibility,'everyone')='everyone' OR (COALESCE(x.visibility,'everyone') IN ('followers','friends_followers') AND EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=? AND f.followed_id=s.author_id)) OR (COALESCE(x.visibility,'everyone') IN ('friends','friends_followers') AND EXISTS(SELECT 1 FROM follows f JOIN follows f2 ON f2.follower_id=s.author_id AND f2.followed_id=? WHERE f.follower_id=? AND f.followed_id=s.author_id))) ORDER BY s.created_at DESC LIMIT 180").bind(user.id,user.id,user.id,user.id).all();
    const indexed=new Map();
    for(const r of rows.results){
      let story=indexed.get(r.id);
      if(!story){story={id:r.id,text:r.text,visibility:r.visibility,createdAt:r.created_at,expiresAt:r.expires_at,author:{id:r.author_id,username:r.username,fullName:r.full_name},overlays:JSON.parse(r.overlays||'[]'),media:[],music:null};indexed.set(r.id,story);}
      if(r.media_id){
        const access=await tokenFor({id:r.media_id,role:'story-media'},env.AUTH_SECRET);
        const data={url:'/api/story-media/'+r.media_id+'?access='+encodeURIComponent(access),type:r.media_kind,mimeType:r.media_mime,size:r.media_size};
        if(r.media_role==='music')story.music=data;else story.media.push(data);
      }
    }
    return json({ok:true,stories:[...indexed.values()].slice(0,60)});
  }
  if(req.method==='POST'&&path==='/api/stories'){
    const multipart=(req.headers.get('Content-Type')||'').includes('multipart/form-data');
    const b=multipart?await req.formData():await bodyJSON(req);
    const read=k=>multipart?b.get(k):b[k];
    const storyText=String(read('text')||'').trim(),visibility=String(read('visibility')||'everyone');
    if(storyText.length>1000||!['everyone','friends','followers','friends_followers'].includes(visibility))return err('محتوى القصة أو خصوصيتها غير صالح');
    let overlays;try{overlays=JSON.parse(String(read('overlays')||'[]'));}catch{return err('تنسيق النصوص والإيموجي غير صالح');}
    if(!Array.isArray(overlays)||overlays.length>25||overlays.some(o=>!o||!['text','emoji'].includes(o.kind)||typeof o.value!=='string'||o.value.length>140||![o.x,o.y,o.size].every(Number.isFinite)))return err('نصوص القصة غير صالحة');
    const files=[{file:multipart?read('media'):null,role:'main'},{file:multipart?read('music'):null,role:'music'}].filter(x=>x.file instanceof File&&x.file.size>0);
    if(!storyText&&!files.length&&!overlays.length)return err('أضف نصاً أو صورة أو فيديو');
    let prepared=[];
    for(const x of files){
      const type=mediaType(x.file.type,x.file.name);
      if(!type||(x.role==='music'&&type!=='audio')||(x.role==='main'&&type==='audio')||x.file.size>15*1024*1024)return err('صيغة غير مدعومة أو الملف أكبر من 15 ميغابايت',413);
      const bytes=await x.file.arrayBuffer();
      if(!hasSignature(new Uint8Array(bytes.slice(0,16)),x.file.type))return err('نوع الملف لا يطابق محتواه');
      const mediaId=crypto.randomUUID(),ext=x.file.name.split('.').pop().toLowerCase();
      prepared.push({id:mediaId,role:x.role,kind:type,mime:x.file.type,size:x.file.size,key:'stories/'+user.id+'/'+mediaId+'.'+ext,bytes});
    }
    const id=crypto.randomUUID(),uploaded=[];
    try{
      for(const f of prepared){await env.MEDIA.put(f.key,f.bytes,{httpMetadata:{contentType:f.mime}});uploaded.push(f.key);}
      await env.DB.prepare("INSERT INTO stories(id,author_id,text,expires_at) VALUES(?,?,?,datetime('now','+24 hours'))").bind(id,user.id,storyText).run();
      await env.DB.prepare('INSERT INTO story_extras(story_id,visibility,overlays) VALUES(?,?,?)').bind(id,visibility,JSON.stringify(overlays)).run();
      for(const f of prepared)await env.DB.prepare('INSERT INTO story_media(id,story_id,r2_key,kind,mime_type,size,role) VALUES(?,?,?,?,?,?,?)').bind(f.id,id,f.key,f.kind,f.mime,f.size,f.role).run();
      return json({ok:true,story:{id,text:storyText,visibility,author:safeUser(user)}},201);
    }catch(e){
      await env.DB.prepare('DELETE FROM story_media WHERE story_id=?').bind(id).run().catch(()=>{});
      await env.DB.prepare('DELETE FROM story_extras WHERE story_id=?').bind(id).run().catch(()=>{});
      await env.DB.prepare('DELETE FROM stories WHERE id=? AND author_id=?').bind(id,user.id).run().catch(()=>{});
      for(const k of uploaded)await env.MEDIA.delete(k).catch(()=>{});
      throw e;
    }
  }
  const storyDelete=path.match(/^\/api\/stories\/([a-f0-9-]{36})$/i);
  if(storyDelete&&req.method==='DELETE'){
    const own=await env.DB.prepare('SELECT author_id FROM stories WHERE id=?').bind(storyDelete[1]).first();
    if(!own)return err('القصة غير موجودة',404);
    if(own.author_id!==user.id)return err('غير مصرح',403);
    const assets=await env.DB.prepare('SELECT r2_key FROM story_media WHERE story_id=?').bind(storyDelete[1]).all();
    await env.DB.prepare('DELETE FROM story_media WHERE story_id=?').bind(storyDelete[1]).run();
    await env.DB.prepare('DELETE FROM story_extras WHERE story_id=?').bind(storyDelete[1]).run();
    await env.DB.prepare('DELETE FROM stories WHERE id=? AND author_id=?').bind(storyDelete[1],user.id).run();
    for(const f of assets.results)await env.MEDIA.delete(f.r2_key).catch(e=>console.error('Story R2 cleanup',e));
    return json({ok:true,message:'تم حذف القصة'});
  }
  if(req.method==='GET'&&path==='/api/reels'){
    const rows=await env.DB.prepare("SELECT m.id AS media_id,m.kind,m.mime_type,m.size,p.id,p.text,p.created_at,u.id AS author_id,u.username,u.full_name,(SELECT COUNT(*) FROM post_likes l WHERE l.post_id=p.id) AS likes,(SELECT COUNT(*) FROM post_comments c WHERE c.post_id=p.id) AS comments_count,EXISTS(SELECT 1 FROM post_likes l WHERE l.post_id=p.id AND l.user_id=?) AS liked FROM media m JOIN posts p ON p.id=m.post_id JOIN users u ON u.id=p.author_id WHERE m.kind IN ('video','audio') AND p.visibility='everyone' ORDER BY p.created_at DESC LIMIT 50").bind(user.id).all();
    return json({ok:true,reels:rows.results.map(v=>({id:v.id,postId:v.id,text:v.text,createdAt:v.created_at,author:{id:v.author_id,username:v.username,fullName:v.full_name},media:[{url:'/media/'+v.media_id,type:v.kind,mimeType:v.mime_type,size:v.size}],likes:v.likes,commentsCount:v.comments_count,liked:!!v.liked,canDelete:v.author_id===user.id}))});
  }
  if(req.method==='GET'&&path==='/api/social/notifications'){
    const rows=await env.DB.prepare('SELECT id,kind,body,read_at,created_at FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50').bind(user.id).all();
    return json({ok:true,notifications:rows.results.map(n=>({id:n.id,type:n.kind,message:n.body,read:!!n.read_at,createdAt:n.created_at}))});
  }

  return err('هذه الوظيفة لم تُحوّل إلى Cloudflare بعد',501);
}
export default {async fetch(req,env){
  if(!env.DB||!env.MEDIA||!env.AUTH_SECRET)return err('Worker bindings are missing',503);
  try{return await main(req,env);}
  catch(e){if(e?.status)return err(e.message,e.status);console.error('Request failure',String(e?.message||e));return err('خطأ داخلي في الخدمة',500);}
}};
