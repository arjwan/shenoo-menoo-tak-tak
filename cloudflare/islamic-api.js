/* Islamic community API for the existing Cloudflare D1/R2 stack.
   Isolated tables; does not alter other users' posts or account data. */
const categories = new Set(['dua','ziyarat','books','lecture','quran','general']);
const output = (data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const failure=(message,status=400)=>output({ok:false,message},status);
const hex=/^[a-f0-9-]{36}$/i;
let schemaReady=false;
async function schema(env){
  if(schemaReady)return;
  for(const query of [
    'CREATE TABLE IF NOT EXISTS islamic_posts(id TEXT PRIMARY KEY,author_id TEXT NOT NULL,category TEXT NOT NULL,title TEXT NOT NULL DEFAULT \'\',text TEXT NOT NULL DEFAULT \'\',media_key TEXT,media_type TEXT,media_mime TEXT,media_size INTEGER,shared_to_general INTEGER NOT NULL DEFAULT 0,general_post_id TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)',
    'CREATE INDEX IF NOT EXISTS idx_islamic_posts_category_time ON islamic_posts(category,created_at DESC)',
    'CREATE TABLE IF NOT EXISTS islamic_likes(post_id TEXT NOT NULL,user_id TEXT NOT NULL,PRIMARY KEY(post_id,user_id))',
    'CREATE TABLE IF NOT EXISTS islamic_comments(id TEXT PRIMARY KEY,post_id TEXT NOT NULL,author_id TEXT NOT NULL,text TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)',
    'CREATE INDEX IF NOT EXISTS idx_islamic_comments_post ON islamic_comments(post_id,created_at)'
  ])await env.DB.prepare(query).run();
  schemaReady=true;
}
function fileKind(file){
  const type=file.type.toLowerCase(),name=file.name.toLowerCase(),ext=name.split('.').pop();
  if(type==='image/jpeg'&&['jpg','jpeg'].includes(ext))return 'image';
  if(type==='image/png'&&ext==='png')return 'image';
  if(type==='image/webp'&&ext==='webp')return 'image';
  if(type==='video/mp4'&&ext==='mp4')return 'video';
  if(type==='video/webm'&&ext==='webm')return 'video';
  if(type==='audio/mpeg'&&ext==='mp3')return 'audio';
  if(type==='audio/mp4'&&ext==='m4a')return 'audio';
  if(type==='audio/ogg'&&ext==='ogg')return 'audio';
  if(type==='application/pdf'&&ext==='pdf')return 'document';
  return null;
}
function signature(buf,type){
  const a=new Uint8Array(buf);
  if(type==='image/jpeg')return a[0]===255&&a[1]===216&&a[2]===255;
  if(type==='image/png')return a[0]===137&&a[1]===80&&a[2]===78&&a[3]===71;
  if(type==='image/webp')return String.fromCharCode(...a.slice(0,4))==='RIFF'&&String.fromCharCode(...a.slice(8,12))==='WEBP';
  if(type==='application/pdf')return String.fromCharCode(...a.slice(0,5))==='%PDF-';
  if(type==='video/mp4'||type==='audio/mp4')return String.fromCharCode(...a.slice(4,8))==='ftyp';
  if(type==='video/webm')return a[0]===26&&a[1]===69&&a[2]===223&&a[3]===163;
  if(type==='audio/mpeg')return (a[0]===73&&a[1]===68&&a[2]===51)||(a[0]===255&&(a[1]&224)===224);
  if(type==='audio/ogg')return String.fromCharCode(...a.slice(0,4))==='OggS';
  return false;
}
async function postView(env,p,userId){
  const comments=(await env.DB.prepare('SELECT c.id,c.text,c.created_at,u.id AS uid,u.username,u.full_name FROM islamic_comments c JOIN users u ON u.id=c.author_id WHERE c.post_id=? ORDER BY c.created_at ASC LIMIT 100').bind(p.id).all()).results;
  const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM islamic_likes WHERE post_id=?').bind(p.id).first();
  const liked=await env.DB.prepare('SELECT 1 AS yes FROM islamic_likes WHERE post_id=? AND user_id=?').bind(p.id,userId).first();
  return {id:p.id,title:p.title,text:p.text,category:p.category,author:{id:p.author_id,username:p.username,fullName:p.full_name},createdAt:p.created_at,
    media:p.media_key?[{url:'/api/islamic/media/'+p.id,type:p.media_type,mimeType:p.media_mime,size:p.media_size}]:[],
    likesCount:count.n,liked:!!liked,commentsCount:comments.length,comments:comments.map(c=>({id:c.id,text:c.text,createdAt:c.created_at,author:{id:c.uid,username:c.username,fullName:c.full_name}})),
    sharedToGeneral:!!p.shared_to_general,generalPostId:p.general_post_id};
}
async function findPost(env,id){
  return env.DB.prepare('SELECT p.*,u.username,u.full_name FROM islamic_posts p JOIN users u ON u.id=p.author_id WHERE p.id=?').bind(id).first();
}
export async function handleIslamic(req,env,user,path){
  if(!path.startsWith('/api/islamic/'))return null;
  await schema(env);
  const method=req.method;
  if(method==='GET'&&path==='/api/islamic/posts'){
    const category=new URL(req.url).searchParams.get('category');
    const filter=categories.has(category)?category:null;
    const query='SELECT p.*,u.username,u.full_name FROM islamic_posts p JOIN users u ON u.id=p.author_id '+(filter?'WHERE p.category=? ':'')+'ORDER BY p.created_at DESC LIMIT 50';
    const rows=(await env.DB.prepare(query).bind(...(filter?[filter]:[])).all()).results;
    const posts=[];
    for(const p of rows)posts.push(await postView(env,p,user.id));
    return output({ok:true,posts});
  }
  if(method==='POST'&&path==='/api/islamic/posts'){
    const form=await req.formData().catch(()=>null);
    if(!form)return failure('بيانات النشر غير صالحة');
    const title=String(form.get('title')||'').trim(),text=String(form.get('text')||'').trim();
    const cat=String(form.get('category')||'general');
    const category=categories.has(cat)?cat:'general';
    const media=form.get('media'),exists=media instanceof File&&media.size>0;
    if((!title&&!text&&!exists)||title.length>180||text.length>10000)return failure('عنوان أو نص المنشور غير صالح');
    let mediaKey=null,kind=null,mime=null,size=null;
    if(exists){
      kind=fileKind(media);mime=media.type;size=media.size;
      if(!kind||size>15*1024*1024)return failure('نوع الملف غير مدعوم أو حجمه أكبر من 15 ميغابايت',413);
      const buffer=await media.arrayBuffer();
      if(!signature(buffer,mime))return failure('محتوى الملف لا يطابق نوعه',400);
      mediaKey='islamic/'+user.id+'/'+crypto.randomUUID()+'.'+media.name.toLowerCase().split('.').pop();
      await env.MEDIA.put(mediaKey,buffer,{httpMetadata:{contentType:mime}});
    }
    const id=crypto.randomUUID();
    try{await env.DB.prepare('INSERT INTO islamic_posts(id,author_id,category,title,text,media_key,media_type,media_mime,media_size) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,user.id,category,title,text,mediaKey,kind,mime,size).run();}
    catch(e){if(mediaKey)await env.MEDIA.delete(mediaKey).catch(()=>{});throw e;}
    return output({ok:true,post:await postView(env,await findPost(env,id),user.id)},201);
  }
  const mediaPath=path.match(/^\/api\/islamic\/media\/([a-f0-9-]{36})$/i);
  if(mediaPath&&method==='GET'){
    const p=await findPost(env,mediaPath[1]);
    if(!p||!p.media_key)return failure('الملف غير موجود',404);
    const object=await env.MEDIA.get(p.media_key);
    if(!object)return failure('الملف غير موجود',404);
    return new Response(object.body,{headers:{'Content-Type':p.media_mime,'X-Content-Type-Options':'nosniff','Content-Disposition':'inline','Cache-Control':'private, max-age=3600'}});
  }
  const match=path.match(/^\/api\/islamic\/posts\/([a-f0-9-]{36})\/(like|comments|share-general)$/i);
  if(match&&method==='POST'){
    const p=await findPost(env,match[1]);
    if(!p)return failure('المنشور غير موجود',404);
    if(match[2]==='like'){
      const existing=await env.DB.prepare('SELECT 1 AS yes FROM islamic_likes WHERE post_id=? AND user_id=?').bind(p.id,user.id).first();
      if(existing)await env.DB.prepare('DELETE FROM islamic_likes WHERE post_id=? AND user_id=?').bind(p.id,user.id).run();
      else await env.DB.prepare('INSERT OR IGNORE INTO islamic_likes(post_id,user_id) VALUES(?,?)').bind(p.id,user.id).run();
      const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM islamic_likes WHERE post_id=?').bind(p.id).first();
      return output({ok:true,liked:!existing,likesCount:count.n});
    }
    if(match[2]==='comments'){
      const body=await req.json().catch(()=>null),text=String(body?.text||'').trim();
      if(!text||text.length>2000)return failure('التعليق غير صالح');
      const id=crypto.randomUUID();
      await env.DB.prepare('INSERT INTO islamic_comments(id,post_id,author_id,text) VALUES(?,?,?,?)').bind(id,p.id,user.id,text).run();
      return output({ok:true,comment:{id,text,author:{id:user.id,username:user.username,fullName:user.full_name}},commentsCount:(await env.DB.prepare('SELECT COUNT(*) AS n FROM islamic_comments WHERE post_id=?').bind(p.id).first()).n},201);
    }
    if(p.general_post_id)return output({ok:true,alreadyShared:true,postId:p.general_post_id});
    const generalId=crypto.randomUUID(),generalText=[p.title,p.text,'/islamic.html#post='+p.id].filter(Boolean).join('\n\n');
    let copiedKey=null;
    if(p.media_key){
      const object=await env.MEDIA.get(p.media_key);
      if(!object)return failure('المرفق غير متاح للمشاركة',409);
      copiedKey='islamic/shared/'+generalId+'/'+crypto.randomUUID();
      await env.MEDIA.put(copiedKey,object.body,{httpMetadata:{contentType:p.media_mime}});
    }
    try{
      await env.DB.prepare("INSERT INTO posts(id,author_id,text,visibility) VALUES(?,?,?,'everyone')").bind(generalId,user.id,generalText).run();
      if(copiedKey){
        await env.DB.prepare('INSERT INTO media(id,post_id,owner_id,r2_key,kind,mime_type,size) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),generalId,user.id,copiedKey,p.media_type,p.media_mime,p.media_size).run();
      }
      await env.DB.prepare('UPDATE islamic_posts SET shared_to_general=1,general_post_id=? WHERE id=? AND general_post_id IS NULL').bind(generalId,p.id).run();
    }catch(e){
      await env.DB.prepare('DELETE FROM media WHERE post_id=?').bind(generalId).run().catch(()=>{});
      await env.DB.prepare('DELETE FROM posts WHERE id=?').bind(generalId).run().catch(()=>{});
      if(copiedKey)await env.MEDIA.delete(copiedKey).catch(()=>{});
      throw e;
    }
    return output({ok:true,postId:generalId},201);
  }
  return failure('عملية المنبر غير مدعومة',405);
}
