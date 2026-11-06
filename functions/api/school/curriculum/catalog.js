// Public 108-book Iraqi curriculum catalog: source is built from the verified GitHub catalog.
export async function onRequest(context) {
  if (context.request.method !== 'GET') {
    return Response.json({ok:false,message:'الطريقة غير مدعومة'},{status:405,headers:{Allow:'GET'}});
  }
  const target=new URL('/school-curriculum-catalog.json',context.request.url);
  const source=await context.env.ASSETS.fetch(new Request(target));
  if(!source.ok) return Response.json({ok:false,message:'كتالوج المناهج غير متاح'},{status:503});
  const data=await source.json();
  if(!Array.isArray(data.items)||data.items.length!==108) {
    return Response.json({ok:false,message:'بيانات كتالوج المناهج غير مكتملة'},{status:503});
  }
  const filters=new URL(context.request.url).searchParams;
  const items=data.items.filter(item=>['stage','grade','subject'].every(key=>!filters.get(key)||item[key]===filters.get(key)));
  return Response.json({ok:true,version:data.version,items,total:items.length},
    {headers:{'Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff'}});
}
