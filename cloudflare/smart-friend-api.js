/* D1 chat history, R2 persona avatars, Workers AI conversation. */
const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const denied=(message,status=400)=>respond({ok:false,message},status);
const hexId=/^[a-f0-9-]{36}$/i;
let initialized=false;
async function init(env){
 if(initialized)return;
 for(const s of [
  'CREATE TABLE IF NOT EXISTS smart_friend_avatars_cf(friend_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,r2_key TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS smart_friend_messages_cf(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,friend_id TEXT NOT NULL,role TEXT NOT NULL,text TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)',
  'CREATE INDEX IF NOT EXISTS idx_smart_friend_messages_cf ON smart_friend_messages_cf(user_id,friend_id,created_at)'
 ])await env.DB.prepare(s).run();
 initialized=true;
}
async function owned(env,user,id){
 return env.DB.prepare('SELECT id,slot,name,gender,age,personality,conversation_style,interests_json FROM smart_friend_personas WHERE id=? AND user_id=?').bind(id,user.id).first();
}
const avatarUrl=id=>'/api/smart-friend/avatar/'+id;
const view=(p,a)=>({id:p.id,slot:p.slot,name:p.name,gender:p.gender,age:p.age,personality:p.personality,conversationStyle:p.conversation_style,interests:JSON.parse(p.interests_json||'[]'),avatarUrl:a?avatarUrl(p.id):''});
async function getAvatar(env,id){return env.DB.prepare('SELECT r2_key FROM smart_friend_avatars_cf WHERE friend_id=?').bind(id).first()}
async function talk(env,user,friend,text){
 if(!env.AI)return denied('مزود الذكاء الاصطناعي غير متصل بعد',503);
 const now=(await env.DB.prepare("SELECT COUNT(*) AS n FROM smart_friend_messages_cf WHERE user_id=? AND role='user' AND created_at>=datetime('now','-1 hour')").bind(user.id).first())?.n||0;
 if(now>=40)return denied('تجاوزت الحد المسموح من الرسائل لهذه الساعة، حاول لاحقاً',429);
 const history=(await env.DB.prepare('SELECT role,text FROM smart_friend_messages_cf WHERE user_id=? AND friend_id=? ORDER BY created_at DESC LIMIT 14').bind(user.id,friend.id).all()).results.reverse();
 let interests=[];try{interests=JSON.parse(friend.interests_json||'[]')}catch{}
 const instruction=`أنت رفيق ذكي افتراضي اسمه ${friend.name}، تتحدث بالعربية الطبيعية وباللهجة العراقية حين يناسب المستخدم. شخصيتك ${friend.personality}، أسلوبك ${friend.conversation_style}، اهتماماتك: ${interests.join('، ')}.
كن محاوراً مرحاً وصريحاً وواسع الاطلاع، تقبل الاختلاف والمواضيع الحساسة والنقد والفلسفة والفن والنكات والنقاشات غير التقليدية من دون وعظ أو اعتذارات غير لازمة. اسأل أسئلة متابعة عند فائدتها فقط. لا تدّع أنك إنسان أو أن لديك تجارب شخصية حقيقية، ولا تختلق معلومات؛ امتنع فقط عن المساعدة في إلحاق ضرر فعلي أو انتهاك الخصوصية. حافظ على إجابات موجزة متفاعلة ولا تكرر عبارات محفوظة.`;
 const messages=[{role:'system',content:instruction},...history.map(h=>({role:h.role==='assistant'?'assistant':'user',content:h.text})),{role:'user',content:text}];
 let reply;
 try{
  const value=await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast',{messages,max_tokens:450,temperature:0.85});
  reply=String(value?.response||value?.result?.response||'').trim();
 }catch(e){console.error('Smart friend AI provider error',String(e?.message||e));return denied('تعذر الوصول إلى نموذج المحادثة الآن',503)}
 if(!reply)return denied('لم يصدر رد من نموذج المحادثة',503);
 await env.DB.batch([
  env.DB.prepare("INSERT INTO smart_friend_messages_cf(id,user_id,friend_id,role,text) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),user.id,friend.id,'user',text),
  env.DB.prepare("INSERT INTO smart_friend_messages_cf(id,user_id,friend_id,role,text) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),user.id,friend.id,'assistant',reply)
 ]);
 return {reply};
}
export async function handleSmartFriend(req,env,user,path){
 if(!path.startsWith('/api/smart-friend/'))return null;
 await init(env);
 const method=req.method;
 if(method==='GET'&&path==='/api/smart-friend/friends'){
  const records=(await env.DB.prepare('SELECT * FROM smart_friend_personas WHERE user_id=? ORDER BY slot').bind(user.id).all()).results;
  const friends=[];
  for(const f of records)friends.push(view(f,await getAvatar(env,f.id)));
  return respond({ok:true,friends,providerConfigured:!!env.AI});
 }
 const avatar=path.match(/^\/api\/smart-friend\/avatar\/([a-f0-9-]{36})$/i);
 if(avatar&&method==='GET'){
  const p=await owned(env,user,avatar[1]);if(!p)return denied('الصورة غير متاحة',404);
  const a=await getAvatar(env,p.id);if(!a)return denied('الصورة غير متاحة',404);
  const obj=await env.MEDIA.get(a.r2_key);if(!obj)return denied('الصورة غير متاحة',404);
  return new Response(obj.body,{headers:{'Content-Type':obj.httpMetadata?.contentType||'image/jpeg','X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=300'}});
 }
 const image=path.match(/^\/api\/smart-friend\/friends\/(\d+)\/avatar$/);
 if(image&&method==='POST'){
  const slot=Number(image[1]);
  const p=await env.DB.prepare('SELECT * FROM smart_friend_personas WHERE user_id=? AND slot=?').bind(user.id,slot).first();
  if(!p)return denied('الشخصية غير موجودة',404);
  const form=await req.formData().catch(()=>null),file=form?.get('avatar');
  if(!(file instanceof File)||!file.size||file.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))return denied('الصورة غير مدعومة أو أكبر من 5 ميغابايت',413);
  const buf=await file.arrayBuffer(),a=new Uint8Array(buf.slice(0,16));
  const valid=file.type==='image/jpeg'?a[0]===255&&a[1]===216&&a[2]===255:file.type==='image/png'?a[0]===137&&a[1]===80&&a[2]===78&&a[3]===71:String.fromCharCode(...a.slice(0,4))==='RIFF'&&String.fromCharCode(...a.slice(8,12))==='WEBP';
  if(!valid)return denied('محتوى الصورة غير صالح');
  const key='smart-friend/'+user.id+'/'+p.id+'/'+crypto.randomUUID();
  await env.MEDIA.put(key,buf,{httpMetadata:{contentType:file.type}});
  try{await env.DB.prepare('INSERT INTO smart_friend_avatars_cf(friend_id,user_id,r2_key) VALUES(?,?,?) ON CONFLICT(friend_id) DO UPDATE SET r2_key=excluded.r2_key').bind(p.id,user.id,key).run();}catch(e){await env.MEDIA.delete(key).catch(()=>{});throw e}
  return respond({ok:true,friend:view(p,{r2_key:key})});
 }
 const slot=path.match(/^\/api\/smart-friend\/friends\/(\d+)$/);
 if(slot&&method==='DELETE'){
  const p=await env.DB.prepare('SELECT id FROM smart_friend_personas WHERE user_id=? AND slot=?').bind(user.id,Number(slot[1])).first();
  if(!p)return denied('الشخصية غير موجودة',404);
  await env.DB.batch([
   env.DB.prepare('DELETE FROM smart_friend_messages_cf WHERE user_id=? AND friend_id=?').bind(user.id,p.id),
   env.DB.prepare('DELETE FROM smart_friend_avatars_cf WHERE user_id=? AND friend_id=?').bind(user.id,p.id),
   env.DB.prepare('DELETE FROM smart_friend_personas WHERE user_id=? AND id=?').bind(user.id,p.id)
  ]);
  return respond({ok:true,friendId:p.id});
 }
 if(path==='/api/smart-friend/messages'&&method==='GET'){
  const id=new URL(req.url).searchParams.get('friend')||'';
  if(!hexId.test(id)||!await owned(env,user,id))return denied('الشخصية غير موجودة',404);
  const messages=(await env.DB.prepare('SELECT id,role,text,created_at FROM smart_friend_messages_cf WHERE user_id=? AND friend_id=? ORDER BY created_at DESC LIMIT 60').bind(user.id,id).all()).results.reverse().map(m=>({id:m.id,role:m.role,text:m.text,createdAt:m.created_at}));
  return respond({ok:true,messages});
 }
 if(path==='/api/smart-friend/messages'&&method==='POST'){
  const isJson=(req.headers.get('Content-Type')||'').includes('application/json');
  const data=isJson?await req.json().catch(()=>null):await req.formData().catch(()=>null);
  const get=k=>isJson?data?.[k]:data?.get(k);
  const id=String(get('friendId')||''),text=String(get('text')||'').trim();
  if(!hexId.test(id)||!text||text.length>2500)return denied('الرسالة غير صالحة');
  const friend=await owned(env,user,id);if(!friend)return denied('الشخصية غير موجودة',404);
  const answer=await talk(env,user,friend,text);
  if(answer instanceof Response)return answer;
  return respond({ok:true,message:{role:'assistant',text:answer.reply},emotion:'talking'});
 }
 if(path==='/api/smart-friend/group'&&method==='POST'){
  const b=await req.json().catch(()=>null),ids=Array.isArray(b?.friendIds)?[...new Set(b.friendIds)].slice(0,4):[],text=String(b?.text||'').trim();
  if(ids.length<2||!text||text.length>1200)return denied('اختر شخصيتين واكتب موضوعاً');
  const replies=[];
  for(const id of ids){
   if(!hexId.test(id))continue;
   const friend=await owned(env,user,id);if(!friend)continue;
   const answer=await talk(env,user,friend,text);
   if(answer instanceof Response)return answer;
   replies.push({friend:{id:friend.id,name:friend.name},text:answer.reply});
  }
  return respond({ok:true,replies});
 }
 return null;
}
