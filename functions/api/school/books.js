import {schoolUser,schoolCatalog,bookRow} from '../../../cloudflare/pages/school-helpers.js';

export async function onRequest(context) {
  if(context.request.method!=='GET')return Response.json({ok:false,message:'الطريقة غير مدعومة'},{status:405,headers:{Allow:'GET'}});
  const auth=await schoolUser(context);if(auth.error)return auth.error;
  let catalog;try{catalog=await schoolCatalog(context);}catch{return Response.json({ok:false,message:'كتالوج المدرسة غير جاهز'},{status:503});}
  const params=new URL(context.request.url).searchParams;
  const items=catalog.items.filter(i=>['stage','grade','subject','unit'].every(key=>!params.get(key)||i[key]===params.get(key)))
    .filter(i=>!params.get('query')||[i.title,i.stage,i.grade,i.subject].join(' ').includes(params.get('query').slice(0,100)))
    .map(bookRow);
  return Response.json({ok:true,items,total:items.length,version:catalog.version},
    {headers:{'Cache-Control':'private, no-store'}});
}
