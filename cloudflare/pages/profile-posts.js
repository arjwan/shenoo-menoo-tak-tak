// Profile posts from D1, including authorized private media through R2.
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const deny=(message,status=400)=>json({ok:false,message},status);
async function permission(env,viewer,owner){
 if(viewer===owner)return {self:true,friend:true,follower:true};
 const [friend,follower]=await Promise.all([
  env.DB.prepare("SELECT id FROM friend_requests WHERE status='accepted' AND ((sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?)) LIMIT 1").bind(viewer,owner,owner,viewer).first(),
  env.DB.prepare('SELECT 1 AS found FROM follows WHERE follower_id=? AND followed_id=? LIMIT 1').bind(viewer,owner).first()
 ]);
 return {self:false,friend:!!friend,follower:!!follower};
}
function visible(visibility,p){return p.self||visibility==='everyone'||((visibility==='friends'||visibility==='friends_followers')&&p.friend)||((visibility==='followers'||visibility==='friends_followers')&&p.follower)}
export async function profilePostsRequest(request,env,actor){
 if(!env.DB)return deny('قاعدة البيانات غير مهيأة',503);
 if(!actor)return deny('يرجى تسجيل الدخول',401);
 const {pathname}=new URL(request.url);
 if(request.method!=='GET')return deny('الطريقة غير مدعومة',405);
 const media=pathname.match(/^\/api\/profile-post-media\/([a-f0-9-]{36})$/i);
 if(media){
  if(!env.MEDIA)return deny('التخزين غير مهيأ',503);
  const record=await env.DB.prepare('SELECT m.r2_key,m.mime_type,m.size,p.author_id,p.visibility FROM media m JOIN posts p ON p.id=m.post_id WHERE m.id=? AND NOT EXISTS (SELECT 1 FROM ad_records a WHERE a.post_id=p.id)').bind(media[1]).first();
  if(!record)return deny('الصورة غير موجودة',404);
  const owner=await env.DB.prepare("SELECT id FROM users WHERE id=? AND status='active'").bind(record.author_id).first();
  if(!owner)return deny('الصورة غير موجودة',404);
  const rights=await permission(env,actor.id,record.author_id);
  if(!visible(record.visibility,rights))return deny('الصورة غير متاحة',403);
  const object=await env.MEDIA.get(record.r2_key);
  if(!object)return deny('الصورة غير موجودة',404);
  return new Response(object.body,{headers:{'Content-Type':record.mime_type||'application/octet-stream','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline'}});
 }
 const match=pathname.match(/^\/api\/posts\/user\/(me|[a-f0-9-]{36})$/i);
 if(!match)return deny('المسار غير موجود',404);
 const ownerId=match[1]==='me'?actor.id:match[1];
 const owner=await env.DB.prepare("SELECT id FROM users WHERE id=? AND status='active'").bind(ownerId).first();
 if(!owner)return deny('الملف الشخصي غير موجود',404);
 const rights=await permission(env,actor.id,ownerId);
 const vis=rights.self?['everyone','friends','followers','friends_followers']:
  ['everyone',...(rights.friend?['friends','friends_followers']:[]),...(rights.follower?['followers','friends_followers']:[])];
 const criteria="FROM posts p WHERE p.author_id=? AND p.visibility IN ("+vis.map(()=>'?').join(',')+") AND NOT EXISTS (SELECT 1 FROM ad_records a WHERE a.post_id=p.id)";
 const [rows,total]=await Promise.all([
  env.DB.prepare('SELECT p.id,p.text,p.visibility,p.created_at '+criteria+' ORDER BY p.created_at DESC LIMIT 50').bind(ownerId,...vis).all(),
  env.DB.prepare('SELECT COUNT(*) AS n '+criteria).bind(ownerId,...vis).first()
 ]);
 const ids=(rows.results||[]).map(r=>r.id);
 let files=[],likes=[],comments=[];
 if(ids.length){
  const qs=ids.map(()=>'?').join(',');
  const results=await Promise.all([
   env.DB.prepare('SELECT id,post_id,kind,mime_type,size FROM media WHERE post_id IN ('+qs+')').bind(...ids).all(),
   env.DB.prepare('SELECT post_id,COUNT(*) AS n FROM post_likes WHERE post_id IN ('+qs+') GROUP BY post_id').bind(...ids).all(),
   env.DB.prepare('SELECT post_id,COUNT(*) AS n FROM post_comments WHERE post_id IN ('+qs+') GROUP BY post_id').bind(...ids).all()
  ]);
  [files,likes,comments]=results.map(x=>x.results||[]);
 }
 return json({ok:true,total:Number(total?.n||0),posts:(rows.results||[]).map(p=>({
  id:p.id,text:p.text,createdAt:p.created_at,visibility:p.visibility,
  media:files.filter(m=>m.post_id===p.id).map(m=>({url:'/api/profile-post-media/'+m.id,type:m.kind,mimeType:m.mime_type,size:m.size})),
  likesCount:Number(likes.find(l=>l.post_id===p.id)?.n||0),
  commentsCount:Number(comments.find(c=>c.post_id===p.id)?.n||0)
 }))});
}
