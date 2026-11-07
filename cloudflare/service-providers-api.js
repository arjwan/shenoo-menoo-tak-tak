/* Service providers & transport migration: D1 records, R2 photos, pending moderation. */
const out=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const bad=(message,status=400)=>out({ok:false,message},status);
const kinds=new Set(['profession','transport']);
let ready=false;
async function setup(env){
  if(ready)return;
  for(const sql of [
    'CREATE TABLE IF NOT EXISTS service_providers_cf(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,kind TEXT NOT NULL,name TEXT NOT NULL,category TEXT NOT NULL,phone TEXT NOT NULL,whatsapp TEXT NOT NULL DEFAULT \'\',governorate TEXT NOT NULL,area TEXT NOT NULL,address TEXT NOT NULL,description TEXT NOT NULL DEFAULT \'\',vehicle_type TEXT NOT NULL DEFAULT \'\',vehicle_model TEXT NOT NULL DEFAULT \'\',latitude REAL,longitude REAL,available INTEGER NOT NULL DEFAULT 1,image_key TEXT,status TEXT NOT NULL DEFAULT \'pending\',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)',
    'CREATE INDEX IF NOT EXISTS idx_service_providers_cf_listing ON service_providers_cf(kind,status,created_at DESC)',
    'CREATE TABLE IF NOT EXISTS service_requests_cf(id TEXT PRIMARY KEY,provider_id TEXT NOT NULL,requester_id TEXT NOT NULL,request_type TEXT NOT NULL DEFAULT \'\',description TEXT NOT NULL,phone TEXT NOT NULL,pickup_address TEXT NOT NULL DEFAULT \'\',destination TEXT NOT NULL DEFAULT \'\',latitude REAL,longitude REAL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)'
  ])await env.DB.prepare(sql).run();
  ready=true;
}
const clip=(v,n=200)=>String(v||'').trim().slice(0,n);
const coordinate=(v,max)=>{if(v==null||String(v).trim()==='')return null;const n=Number(v);return Number.isFinite(n)&&Math.abs(n)<=max?n:null};
const record=p=>({id:p.id,name:p.name,kind:p.kind,category:p.category,phone:p.phone,whatsapp:p.whatsapp,
  governorate:p.governorate,area:p.area,address:p.address,description:p.description,vehicleType:p.vehicle_type,vehicleModel:p.vehicle_model,
  latitude:p.latitude,longitude:p.longitude,availableForWork:!!p.available,online:false,
  imageUrl:p.image_key?'/api/service-providers/'+p.id+'/image':'',status:p.status,createdAt:p.created_at});
export async function handleServices(req,env,user,path){
  if(!path.startsWith('/api/service-providers'))return null;
  await setup(env);
  const method=req.method;
  if(path==='/api/service-providers'&&method==='GET'){
    const params=new URL(req.url).searchParams;
    const kind=kinds.has(params.get('kind'))?params.get('kind'):'profession';
    const q=clip(params.get('q'),80),category=clip(params.get('category'),80),governorate=clip(params.get('governorate'),80),available=params.get('available')==='1';
    const values=[kind],where=["kind=?","status='approved'"];
    if(q){where.push('(name LIKE ? OR category LIKE ? OR area LIKE ?)');values.push('%'+q+'%','%'+q+'%','%'+q+'%')}
    if(category){where.push('category=?');values.push(category)}
    if(governorate){where.push('governorate LIKE ?');values.push('%'+governorate+'%')}
    if(available)where.push('available=1');
    const rows=(await env.DB.prepare('SELECT * FROM service_providers_cf WHERE '+where.join(' AND ')+' ORDER BY created_at DESC LIMIT 100').bind(...values).all()).results;
    return out({ok:true,providers:rows.map(record)});
  }
  if(path==='/api/service-providers'&&method==='POST'){
    const form=await req.formData().catch(()=>null);
    if(!form)return bad('بيانات التسجيل غير صالحة');
    const kind=clip(form.get('kind'),20),name=clip(form.get('name'),120),category=clip(form.get('category'),90),
      phone=clip(form.get('phone'),40),whatsapp=clip(form.get('whatsapp'),40),governorate=clip(form.get('governorate'),90),
      area=clip(form.get('area'),90),address=clip(form.get('address'),300),description=clip(form.get('description'),1800),
      vehicleType=clip(form.get('vehicleType'),100),vehicleModel=clip(form.get('vehicleModel'),100);
    if(!kinds.has(kind)||!name||!category||!phone||!governorate||!area||!address||(kind==='transport'&&!vehicleType))return bad('أكمل الحقول المطلوبة');
    const latitude=coordinate(form.get('latitude'),90),longitude=coordinate(form.get('longitude'),180);
    const available=form.get('availableForWork')==='true'?1:0;
    const file=form.get('image'),hasImage=file instanceof File&&file.size>0;
    let key=null;
    if(hasImage){
      const allowed={'image/jpeg':['jpg','jpeg'],'image/png':['png'],'image/webp':['webp']};
      const ext=file.name.toLowerCase().split('.').pop();
      if(!allowed[file.type]?.includes(ext)||file.size>5*1024*1024)return bad('الصورة غير مدعومة أو أكبر من 5 ميغابايت',413);
      const buffer=await file.arrayBuffer(),a=new Uint8Array(buffer);
      const valid=file.type==='image/jpeg'?(a[0]===255&&a[1]===216&&a[2]===255):file.type==='image/png'?(a[0]===137&&a[1]===80&&a[2]===78&&a[3]===71):(String.fromCharCode(...a.slice(0,4))==='RIFF'&&String.fromCharCode(...a.slice(8,12))==='WEBP');
      if(!valid)return bad('نوع الصورة لا يطابق محتواها');
      key='service-providers/'+user.id+'/'+crypto.randomUUID()+'.'+ext;
      await env.MEDIA.put(key,buffer,{httpMetadata:{contentType:file.type}});
    }
    const id=crypto.randomUUID();
    try{
      await env.DB.prepare('INSERT INTO service_providers_cf(id,owner_id,kind,name,category,phone,whatsapp,governorate,area,address,description,vehicle_type,vehicle_model,latitude,longitude,available,image_key,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(id,user.id,kind,name,category,phone,whatsapp,governorate,area,address,description,vehicleType,vehicleModel,latitude,longitude,available,key,'pending').run();
    }catch(e){if(key)await env.MEDIA.delete(key).catch(()=>{});throw e;}
    return out({ok:true,message:'تم إرسال الطلب إلى الإدارة للمراجعة',providerId:id,status:'pending'},201);
  }
  if(path==='/api/service-providers/pending'&&method==='GET'){
    if(!['admin','developer'].includes(user.role))return bad('غير مصرح',403);
    const rows=(await env.DB.prepare("SELECT * FROM service_providers_cf WHERE status='pending' ORDER BY created_at ASC LIMIT 100").all()).results;
    return out({ok:true,providers:rows.map(record)});
  }
  const image=path.match(new RegExp('^/api/service-providers/([a-f0-9-]{36})/image$','i'));
  if(image&&method==='GET'){
    const p=await env.DB.prepare('SELECT image_key,status,owner_id FROM service_providers_cf WHERE id=?').bind(image[1]).first();
    if(!p||!p.image_key||p.status!=='approved'&&p.owner_id!==user.id&&!['admin','developer'].includes(user.role))return bad('الصورة غير متاحة',404);
    const obj=await env.MEDIA.get(p.image_key);
    if(!obj)return bad('الصورة غير متاحة',404);
    return new Response(obj.body,{headers:{'Content-Type':obj.httpMetadata?.contentType||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=3600'}});
  }
  const review=path.match(new RegExp('^/api/service-providers/([a-f0-9-]{36})/review$','i'));
  if(review&&method==='PATCH'){
    if(!['admin','developer'].includes(user.role))return bad('هذه العملية للإدارة فقط',403);
    const body=await req.json().catch(()=>null),status=String(body?.decision||'');
    if(!['approved','rejected'].includes(status))return bad('قرار غير صالح');
    const result=await env.DB.prepare("UPDATE service_providers_cf SET status=? WHERE id=? AND status='pending'").bind(status,review[1]).run();
    if(!result.meta.changes)return bad('الطلب غير موجود أو تمت مراجعته',409);
    return out({ok:true,status});
  }
  const requestRoute=path.match(new RegExp('^/api/service-providers/([a-f0-9-]{36})/requests$','i'));
  if(requestRoute&&method==='POST'){
    const provider=await env.DB.prepare("SELECT owner_id FROM service_providers_cf WHERE id=? AND status='approved' AND available=1").bind(requestRoute[1]).first();
    if(!provider)return bad('صاحب الخدمة غير متاح',404);
    const body=await req.json().catch(()=>null);
    if(!body)return bad('طلب غير صالح');
    const desc=clip(body.description,1800),phone=clip(body.phone,40);
    if(!desc||!phone)return bad('أدخل الوصف ورقم الاتصال');
    const id=crypto.randomUUID();
    await env.DB.prepare('INSERT INTO service_requests_cf(id,provider_id,requester_id,request_type,description,phone,pickup_address,destination,latitude,longitude) VALUES(?,?,?,?,?,?,?,?,?,?)')
      .bind(id,requestRoute[1],user.id,clip(body.requestType,120),desc,phone,clip(body.pickupAddress,300),clip(body.destination,300),coordinate(body.latitude,90),coordinate(body.longitude,180)).run();
    return out({ok:true,message:'تم إرسال طلب الخدمة',requestId:id},201);
  }
  return bad('عملية الخدمة غير مدعومة',405);
}
