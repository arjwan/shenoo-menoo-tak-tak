// School APIs reuse the standard D1 application session; they never accept legacy MongoDB JWTs.
export async function schoolUser(context) {
  if(!context.env.API?.fetch)return {error:Response.json({ok:false,message:'خدمة حسابات Cloudflare غير متاحة'},{status:503})};
  const url=new URL('/api/auth/session',context.request.url);
  const headers=new Headers();
  const cookie=context.request.headers.get('Cookie');
  if(cookie)headers.set('Cookie',cookie);
  const response=await context.env.API.fetch(new Request(url,{method:'GET',headers,redirect:'manual'}));
  if(!response.ok)return {error:Response.json({ok:false,message:'سجل الدخول لعرض كتب المدرسة'},{status:401,headers:{'Cache-Control':'no-store'}})};
  const result=await response.json().catch(()=>null);
  if(result?.user?.id && ['user','admin','developer'].includes(result.user.role))return {user:result.user};
  return {error:Response.json({ok:false,message:'جلسة المدرسة غير صالحة'},{status:401})};
}
export async function schoolCatalog(context) {
  const response=await context.env.ASSETS.fetch(new Request(new URL('/school-curriculum-catalog.json',context.request.url)));
  if(!response.ok)throw Error('Catalog asset missing');
  const result=await response.json();
  if(result.items?.length!==108)throw Error('Catalog source incomplete');
  return result;
}
export const bookRow=i=>({
  id:i.id,fileId:i.file?.driveId||i.id,title:i.title,stage:i.stage,grade:i.grade,
  subject:i.subject,year:i.year,status:i.availability,availability:i.availability,
  sourceUrl:i.sourceUrl,url:i.file?.url||'',pages:i.file?.pages,
  bytes:i.file?.size,indexingStatus:i.indexingStatus||'',textAvailable:false
});
