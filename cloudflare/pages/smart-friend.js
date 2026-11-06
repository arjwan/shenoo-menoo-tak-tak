// Cloudflare smart friend personas: persistent D1 config, optional R2 avatars.
// Text generation requires a separate connected AI provider, never faked.
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
const fail=(message,status=400)=>json({ok:false,message},status);
const personalities=new Set(['friendly','calm','funny','serious','listener','educated']);
const styles=new Set(['casual','balanced','advice']);
const genders=new Set(['male','female']);
const originOk=req=>{const o=req.headers.get('Origin');return (!o||o===new URL(req.url).origin)&&req.headers.get('Sec-Fetch-Site')!=='cross-site'};
const rowToFriend=r=>({id:r.id,slot:r.slot,name:r.name,gender:r.gender,age:r.age,personality:r.personality,conversationStyle:r.conversation_style,
 interests:JSON.parse(r.interests_json||'[]'),avatarUrl:r.avatar_key?'/api/smart-friend/avatar/'+r.id:null});
async function bySlot(env,userId,slot){return env.DB.prepare('SELECT * FROM smart_friend_personas WHERE user_id=? AND slot=? LIMIT 1').bind(userId,slot).first()}
const validSlot=raw=>/^(?:10|[1-9])$/.test(raw)?Number(raw):null;
async function parseAvatar(form){
 const avatar=form.get('avatar');
 if(!avatar||typeof avatar.arrayBuffer!=='function')return null;
 if(!['image/jpeg','image/png','image/webp'].includes(avatar.type)||avatar.size>5*1024*1024||avatar.size<12)return null;
 const buffer=await avatar.arrayBuffer(),v=new Uint8Array(buffer);
 const jpeg=v[0]===255&&v[1]===216&&v[2]===255;
 const png=v[0]===137&&v[1]===80&&v[2]===78&&v[3]===71;
 const webp=v[0]===82&&v[1]===73&&v[2]===70&&v[3]===70&&v[8]===87&&v[9]===69&&v[10]===66&&v[11]===80;
 if(!((avatar.type==='image/jpeg'&&jpeg)||(avatar.type==='image/png'&&png)||(avatar.type==='image/webp'&&webp)))return null;
 return {buffer,type:avatar.type};
}
export async function smartFriendRoute(request,env,user){
 const pathname=new URL(request.url).pathname,method=request.method;
 if(!env.DB)return fail('قاعدة البيانات غير مهيأة',503);
 if(pathname==='/api/smart-friend/friends'&&method==='GET'){
  const result=await env.DB.prepare('SELECT * FROM smart_friend_personas WHERE user_id=? ORDER BY slot ASC').bind(user.id).all();
  return json({ok:true,friends:(result.results||[]).map(rowToFriend),providerConfigured:false});
 }
 if(pathname==='/api/smart-friend/friends'&&method==='POST'){
  if(!originOk(request))return fail('مصدر الطلب غير موثوق',403);
  const b=await request.json().catch(()=>null);
  const parsed=validatePersona(b);if(parsed.error)return fail(parsed.error);
  const existing=await env.DB.prepare('SELECT slot FROM smart_friend_personas WHERE user_id=? ORDER BY slot ASC').bind(user.id).all();
  const occupied=new Set((existing.results||[]).map(r=>r.slot));let slot=1;while(occupied.has(slot)&&slot<=10)slot++;
  if(slot>10)return fail('يمكن إنشاء 10 شخصيات كحد أقصى',409);
  const id=crypto.randomUUID();
  try{
   await env.DB.prepare('INSERT INTO smart_friend_personas(id,user_id,slot,name,gender,age,personality,conversation_style,interests_json) VALUES(?,?,?,?,?,?,?,?,?)')
    .bind(id,user.id,slot,parsed.name,parsed.gender,parsed.age,parsed.personality,parsed.conversationStyle,JSON.stringify(parsed.interests)).run();
  }catch(e){if(/unique|constraint/i.test(String(e)))return fail('تعارض في حجز خانة الشخصية، أعد المحاولة',409);throw e}
  return json({ok:true,friend:{id,slot,...parsed,avatarUrl:null}},201);
 }
 const item=pathname.match(/^\/api\/smart-friend\/friends\/(10|[1-9])$/);
 if(item&&method==='PUT'){
  if(!originOk(request))return fail('مصدر الطلب غير موثوق',403);
  const existing=await bySlot(env,user.id,Number(item[1]));
  if(!existing)return fail('هذه الشخصية غير موجودة',404);
  const b=await request.json().catch(()=>null),parsed=validatePersona(b);
  if(parsed.error)return fail(parsed.error);
  await env.DB.prepare('UPDATE smart_friend_personas SET name=?,gender=?,age=?,personality=?,conversation_style=?,interests_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?')
   .bind(parsed.name,parsed.gender,parsed.age,parsed.personality,parsed.conversationStyle,JSON.stringify(parsed.interests),existing.id,user.id).run();
  return json({ok:true,friend:rowToFriend({...existing,...{name:parsed.name,gender:parsed.gender,age:parsed.age,personality:parsed.personality,conversation_style:parsed.conversationStyle,interests_json:JSON.stringify(parsed.interests)}})});
 }
 const avatar=pathname.match(/^\/api\/smart-friend\/friends\/(10|[1-9])\/avatar$/);
 if(avatar&&method==='POST'){
  if(!originOk(request))return fail('مصدر الطلب غير موثوق',403);
  if(!env.MEDIA)return fail('تخزين الصور غير مهيأ',503);
  const existing=await bySlot(env,user.id,Number(avatar[1]));
  if(!existing)return fail('هذه الشخصية غير موجودة',404);
  if(Number(request.headers.get('Content-Length')||0)>5.5*1024*1024)return fail('حجم الصورة كبير جداً',413);
  const form=await request.formData().catch(()=>null);
  const file=form&&await parseAvatar(form);
  if(!file)return fail('اختر صورة JPG أو PNG أو WebP بحد أقصى 5 ميغابايت',415);
  const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
  const key='smart-friend/'+user.id+'/'+existing.id+'/'+crypto.randomUUID()+'.'+ext;
  await env.MEDIA.put(key,file.buffer,{httpMetadata:{contentType:file.type}});
  try{await env.DB.prepare('UPDATE smart_friend_personas SET avatar_key=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?').bind(key,existing.id,user.id).run()}
  catch(e){await env.MEDIA.delete(key).catch(()=>{});throw e}
  return json({ok:true,friend:rowToFriend({...existing,avatar_key:key})});
 }
 const image=pathname.match(/^\/api\/smart-friend\/avatar\/([a-f0-9-]{36})$/i);
 if(image&&method==='GET'){
  if(!env.MEDIA)return fail('تخزين الصور غير مهيأ',503);
  const r=await env.DB.prepare('SELECT avatar_key FROM smart_friend_personas WHERE id=? AND user_id=?').bind(image[1],user.id).first();
  if(!r?.avatar_key)return fail('الصورة غير موجودة',404);
  const obj=await env.MEDIA.get(r.avatar_key);
  if(!obj)return fail('الصورة غير موجودة',404);
  return new Response(obj.body,{headers:{'Content-Type':obj.httpMetadata?.contentType||'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }
 if(pathname==='/api/smart-friend/messages'&&method==='GET'){
  const friend=new URL(request.url).searchParams.get('friend');
  const r=friend?await env.DB.prepare('SELECT id FROM smart_friend_personas WHERE id=? AND user_id=?').bind(friend,user.id).first():null;
  if(!r)return fail('الشخصية غير موجودة',404);
  return json({ok:true,messages:[],providerConfigured:false});
 }
 if(pathname==='/api/smart-friend/messages'&&method==='POST')return fail('المحادثة الذكية تحتاج ربط مزود الذكاء الاصطناعي بالخادم؛ تم حفظ إعدادات الشخصية فقط',503);
 if(pathname==='/api/smart-friend/group'&&method==='POST')return fail('الحوار الجماعي يحتاج ربط مزود الذكاء الاصطناعي بالخادم',503);
 return fail('هذه الوظيفة لم تُنقل إلى Cloudflare بعد',501);
}
function validatePersona(b){
 if(!b||typeof b!=='object'||Array.isArray(b))return {error:'بيانات الشخصية غير صحيحة'};
 const name=typeof b.name==='string'?b.name.trim():'';
 if(name.length<1||name.length>40||!genders.has(b.gender)||!Number.isInteger(b.age)||b.age<18||b.age>80||!personalities.has(b.personality)||!styles.has(b.conversationStyle))return {error:'تحقق من الاسم والعمر وخيارات الشخصية'};
 const interests=Array.isArray(b.interests)?b.interests:[];
 if(interests.length>20||interests.some(x=>typeof x!=='string'||x.length>60))return {error:'الاهتمامات غير صالحة'};
 return {name,gender:b.gender,age:b.age,personality:b.personality,conversationStyle:b.conversationStyle,interests};
}
