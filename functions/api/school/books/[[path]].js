import {schoolUser,schoolCatalog} from '../../../../cloudflare/pages/school-helpers.js';

export async function onRequest(context) {
  if(context.request.method!=='GET')return Response.json({ok:false,message:'الطريقة غير مدعومة'},{status:405,headers:{Allow:'GET'}});
  const match=new URL(context.request.url).pathname.match(/^\/api\/school\/books\/([^/]+)\/reader$/);
  if(!match)return Response.json({ok:false,message:'المسار غير موجود'},{status:404});
  const auth=await schoolUser(context);if(auth.error)return auth.error;
  let catalog;try{catalog=await schoolCatalog(context);}catch{return Response.json({ok:false,message:'كتالوج المدرسة غير جاهز'},{status:503});}
  const name=decodeURIComponent(match[1]);
  const item=catalog.items.find(i=>i.id===name||i.file?.driveId===name);
  if(!item)return Response.json({ok:false,message:'الكتاب غير موجود'},{status:404});
  const url=item.sourceUrl||'';
  if(!/^https:\/\/drive\.google\.com\/file\/d\/[-_a-z0-9]+/i.test(url)) {
    return Response.json({ok:false,message:'مصدر الكتاب غير متاح'},{status:404});
  }
  // PDFs are not mirrored in R2. Use the verified external source; never invent a local PDF.
  return Response.json({ok:true,id:item.id,title:item.title,url,readerUrl:url,downloadUrl:url,
    sourceUrl:url},{headers:{'Cache-Control':'private, no-store'}});
}
