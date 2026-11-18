// Server-side private chat uploads. No public bucket URL or caller-selected R2 key.
const MIME={
 'audio/mp4':{kind:'audio',exts:['m4a','mp4']},
 'audio/x-m4a':{kind:'audio',exts:['m4a']},
 'audio/webm':{kind:'audio',exts:['webm']},
 'audio/ogg':{kind:'audio',exts:['ogg','oga']},
 'video/mp4':{kind:'video',exts:['mp4']},
 'video/webm':{kind:'video',exts:['webm']},
 'image/jpeg':{kind:'image',exts:['jpg','jpeg']},
 'image/png':{kind:'image',exts:['png']},
 'image/webp':{kind:'image',exts:['webp']}
};
export function privateMediaType(type,name,bytes){
 const mime=String(type||'').toLowerCase().split(';')[0].trim();
 const ext=String(name||'').toLowerCase().split('.').pop(),allowed=MIME[mime];
 if(!allowed||!allowed.exts.includes(ext)||bytes.length<12)return null;
 const sig=String.fromCharCode(...bytes.slice(0,4)),ftyp=String.fromCharCode(...bytes.slice(4,8));
 const matched=mime==='audio/mp4'||mime==='audio/x-m4a'||mime==='video/mp4'?ftyp==='ftyp':
 mime==='audio/webm'||mime==='video/webm'?bytes[0]===26&&bytes[1]===69&&bytes[2]===223&&bytes[3]===163:
 mime==='audio/ogg'?sig==='OggS':
 mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:
 mime==='image/png'?bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71:
 mime==='image/webp'?sig==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP':false;
 return matched?{kind:allowed.kind,mime}:null;
}
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const un64=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4)),v=>v.charCodeAt(0));
async function key(env){return crypto.subtle.importKey('raw',new TextEncoder().encode(env.AUTH_SECRET||env.DEVELOPER_RATE_LIMIT_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function signedPrivateMediaUrl(env,request,messageId){
 const expiry=Math.floor(Date.now()/1000)+3600;
 const value=messageId+'.'+expiry;
 const sig=b64(await crypto.subtle.sign('HMAC',await key(env),new TextEncoder().encode(value)));
 return new URL('/api/private-message-media/'+messageId+'?expires='+expiry+'&sig='+encodeURIComponent(sig),request.url).pathname+'?expires='+expiry+'&sig='+encodeURIComponent(sig);
}
export async function readPrivateMedia(request,env,mediaId){
 const u=new URL(request.url),expiry=Number(u.searchParams.get('expires')),sig=u.searchParams.get('sig')||'';
 if(!Number.isSafeInteger(expiry)||expiry<Math.floor(Date.now()/1000)||expiry>Math.floor(Date.now()/1000)+7200||!/^[A-Za-z0-9_-]{40,100}$/.test(sig))
  return Response.json({ok:false,message:'انتهت صلاحية رابط الوسائط'},{status:403});
 const verified=await crypto.subtle.verify('HMAC',await key(env),un64(sig),new TextEncoder().encode(mediaId+'.'+expiry)).catch(()=>false);
 if(!verified)return Response.json({ok:false,message:'رابط غير صالح'},{status:403});
 const row=await env.DB.prepare('SELECT r2_key,mime_type,file_size FROM private_message_attachments WHERE message_id=?').bind(mediaId).first();
 if(!row)return Response.json({ok:false,message:'المرفق غير موجود'},{status:404});
 const head=await env.MEDIA.head(row.r2_key);
 if(!head)return Response.json({ok:false,message:'الملف غير موجود'},{status:404});
 const headers=new Headers({'Content-Type':row.mime_type,'Cache-Control':'private,no-store','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff','Content-Disposition':'inline'});
 const length=head.size;let range;
 const raw=request.headers.get('Range');
 if(raw){
  const match=/^bytes=(\d*)-(\d*)$/.exec(raw.trim());
  if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+length}});
  let start=match[1]?Number(match[1]):Math.max(0,length-Number(match[2]));
  let end=match[2]&&match[1]?Number(match[2]):length-1;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=length||end<start)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+length}});
  end=Math.min(end,length-1);range={offset:start,length:end-start+1};
  headers.set('Content-Range','bytes '+start+'-'+end+'/'+length);
  headers.set('Content-Length',String(range.length));
 }else headers.set('Content-Length',String(length));
 const media=await env.MEDIA.get(row.r2_key,range?{range}:undefined);
 if(!media)return Response.json({ok:false,message:'الملف غير موجود'},{status:404});
 return new Response(media.body,{status:range?206:200,headers});
}
export async function savePrivateAttachment(req,env,user,conversationId){
 const mime=req.headers.get('Content-Type')||'';
 if(!mime.toLowerCase().includes('multipart/form-data'))return Response.json({ok:false,message:'مطلوب رفع ملف'},{status:415});
 if(Number(req.headers.get('Content-Length')||0)>11*1024*1024)return Response.json({ok:false,message:'حجم المرفق أكبر من 10 ميغابايت'},{status:413});
 let form;try{form=await req.formData()}catch{return Response.json({ok:false,message:'تعذر قراءة الملف'},{status:400});}
 const file=form.get('attachment');
 if(!(file instanceof File)||file.size<12||file.size>10*1024*1024)return Response.json({ok:false,message:'حجم الملف غير صالح'},{status:413});
 const name=String(file.name||'').replace(/[\\/\x00-\x1f]/g,'').slice(0,150);
 const bytes=new Uint8Array(await file.arrayBuffer());
 const media=privateMediaType(file.type,name,bytes);
 if(!media)return Response.json({ok:false,message:'صيغة الصوت أو الفيديو غير مدعومة أو المحتوى لا يطابق النوع'},{status:415});
 const caption=String(form.get('text')||'').trim().slice(0,1000);
 const messageId=crypto.randomUUID(),objectKey='private-messages/'+conversationId+'/'+messageId;
 try{
  await env.MEDIA.put(objectKey,bytes,{httpMetadata:{contentType:media.mime}});
  await env.DB.batch([
   env.DB.prepare('INSERT INTO messages(id,conversation_id,sender_id,text) VALUES(?,?,?,?)').bind(messageId,conversationId,user.id,caption),
   env.DB.prepare('INSERT INTO private_message_attachments(message_id,conversation_id,owner_id,r2_key,mime_type,file_name,file_size) VALUES(?,?,?,?,?,?,?)').bind(messageId,conversationId,user.id,objectKey,media.mime,name,file.size)
  ]);
 }catch(error){
  await env.MEDIA.delete(objectKey).catch(()=>{});
  throw error;
 }
 return Response.json({ok:true,message:{id:messageId,senderId:user.id,type:media.kind,text:caption,attachment:{url:await signedPrivateMediaUrl(env,req,messageId),name,mimeType:media.mime,size:file.size},mine:true,createdAt:new Date().toISOString()}},{status:201,headers:{'Cache-Control':'no-store'}});
}
