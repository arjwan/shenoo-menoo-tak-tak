// Cloudflare Pages handles private chat uploads directly against its existing D1/R2 bindings.
import {readPrivateMedia,savePrivateAttachment,signedPrivateMediaUrl} from '../private-message-media.js';
import {getAuthenticatedAppUser} from './profile-session.js';
const reply=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const pattern=/^\/api\/conversations\/([a-f0-9-]{36})\/messages$/i;
const filePattern=/^\/api\/private-message-media\/([a-f0-9-]{36})$/i;
export async function privateChatRoute({request,env}){
 const path=new URL(request.url).pathname;
 const media=path.match(filePattern);
 if(media){return request.method==='GET'?readPrivateMedia(request,env,media[1]):reply({ok:false},405);}
 const target=path.match(pattern);if(!target)return null;
 if(request.method!=='GET'&&request.method!=='POST')return reply({ok:false},405);
 // Only uploads are intercepted; existing D1 Worker continues handling text messages.
 const multipart=(request.headers.get('Content-Type')||'').toLowerCase().includes('multipart/form-data');
 if(request.method==='POST'&&!multipart)return null;
 if(!env.DB||!env.MEDIA)return reply({ok:false,message:'خدمة المرفقات غير مهيأة'},503);
 const user=await getAuthenticatedAppUser(request,env);
 if(!user)return reply({ok:false,message:'يرجى تسجيل الدخول'},401);
 const conversationId=target[1];
 const member=await env.DB.prepare('SELECT 1 AS allowed FROM conversation_members WHERE conversation_id=? AND user_id=?').bind(conversationId,user.id).first();
 if(!member)return reply({ok:false,message:'المحادثة غير موجودة'},404);
 if(request.method==='POST'){
  const origin=request.headers.get('Origin'),site=request.headers.get('Sec-Fetch-Site');
  if((origin&&origin!==new URL(request.url).origin)||(!origin&&site==='cross-site'))return reply({ok:false,message:'طلب غير موثوق'},403);
  try{return await savePrivateAttachment(request,env,user,conversationId);}
  catch(error){console.error('Private media upload failed',String(error?.message||error));return reply({ok:false,message:'تعذر حفظ الرسالة الصوتية أو الفيديو'},500);}
 }
 const before=new URL(request.url).searchParams.get('before')||'';
 if(before&&!/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(before))return reply({ok:false,message:'مؤشر الصفحة غير صالح'},400);
 const other=await env.DB.prepare('SELECT u.id,u.username,u.full_name FROM conversation_members m JOIN users u ON u.id=m.user_id WHERE m.conversation_id=? AND m.user_id<>?').bind(conversationId,user.id).first();
 const sql='SELECT id,sender_id,text,created_at FROM messages WHERE conversation_id=?'+(before?' AND created_at<?':'')+' ORDER BY created_at DESC,id DESC LIMIT 51';
 const rows=await (before?env.DB.prepare(sql).bind(conversationId,before):env.DB.prepare(sql).bind(conversationId)).all();
 const entries=rows.results.slice(0,50);
 const ids=entries.map(m=>m.id);
 const attachments=ids.length?(await env.DB.prepare('SELECT message_id,mime_type,file_name,file_size FROM private_message_attachments WHERE conversation_id=? AND message_id IN ('+ids.map(()=>'?').join(',')+')').bind(conversationId,...ids).all()).results:[];
 const byId=new Map(attachments.map(a=>[a.message_id,a]));
 const messages=await Promise.all(entries.reverse().map(async m=>{
  const a=byId.get(m.id);
  const kind=a?.mime_type.startsWith('audio/')?'audio':a?.mime_type.startsWith('video/')?'video':a?'image':'text';
  return {id:m.id,senderId:m.sender_id,text:m.text,type:kind,mine:m.sender_id===user.id,createdAt:m.created_at,
   attachment:a?{url:await signedPrivateMediaUrl(env,request,m.id),name:a.file_name,mimeType:a.mime_type,size:a.file_size}:null};
 }));
 return reply({ok:true,messages,conversation:{id:conversationId,otherUser:other?{id:other.id,username:other.username,fullName:other.full_name}:null},nextCursor:rows.results.length>50?entries[0]?.created_at:null});
}
