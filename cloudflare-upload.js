/* Authenticated Cloudflare R2 multipart uploads; each chunk is 8 MiB.
 * The API Worker checks ownership, size and actual file signature. */
window.uploadMediaToCloudflare=async function(file,purpose,onProgress){
  if(!(file instanceof File)||!file.size)throw Error('اختر ملفاً أولاً');
  if(file.size>100*1024*1024)throw Error('الحد الأقصى لحجم الملف 100 ميغابايت');
  const token=localStorage.getItem('token')||sessionStorage.getItem('token')||'';
  if(!token)throw Error('سجّل دخولك أولاً');
  const base=location.origin;
  const request=async(path,options={})=>{
    const headers=new Headers(options.headers||{});
    headers.set('Authorization','Bearer '+token);
    const response=await fetch(base+path,{...options,headers});
    const result=await response.json().catch(()=>({}));
    if(!response.ok||result.ok===false)throw Error(result.message||'تعذر رفع الملف: '+response.status);
    return result;
  };
  const start=await request('/api/uploads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:file.name,mime:file.type,size:file.size,purpose})});
  const session=start.uploadId;
  try{
    const partSize=start.partSize;
    for(let i=0;i<start.parts;i++){
      const part=file.slice(i*partSize,Math.min(file.size,(i+1)*partSize));
      let attempts=0;
      while(true){
        try{
          await request('/api/uploads/'+session+'/part/'+(i+1),{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:part});
          break;
        }catch(e){
          if(++attempts>=3)throw e;
          await new Promise(resolve=>setTimeout(resolve,400*attempts));
        }
      }
      if(onProgress)onProgress(Math.round(Math.min(file.size,(i+1)*partSize)/file.size*100));
    }
    await request('/api/uploads/'+session+'/complete',{method:'POST'});
    return session;
  }catch(e){
    await request('/api/uploads/'+session+'/abort',{method:'DELETE'}).catch(()=>{});
    throw e;
  }
};
