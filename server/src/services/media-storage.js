const fs=require('fs');
const path=require('path');
const https=require('https');
const crypto=require('crypto');

const cleanBase=()=>String(process.env.MEDIA_CDN_BASE_URL||'').replace(/\/+$/,'');
function configured(){return Boolean(process.env.R2_ACCOUNT_ID&&process.env.R2_BUCKET&&process.env.R2_ACCESS_KEY_ID&&process.env.R2_SECRET_ACCESS_KEY&&cleanBase());}
const encKey=key=>String(key).split('/').map(encodeURIComponent).join('/');
const hmac=(key,data,encoding)=>crypto.createHmac('sha256',key).update(data).digest(encoding);
async function sha256File(file){return new Promise((resolve,reject)=>{const h=crypto.createHash('sha256'),s=fs.createReadStream(file);s.on('data',d=>h.update(d));s.on('end',()=>resolve(h.digest('hex')));s.on('error',reject)});}
function signingKey(secret,date){const d=hmac('AWS4'+secret,date),r=hmac(d,'auto'),s=hmac(r,'s3');return hmac(s,'aws4_request');}
function amzDate(now=new Date()){return now.toISOString().replace(/[:-]|\.\d{3}/g,'');}
function signedHeaders({method,key,payloadHash,contentType=''}){
 const account=process.env.R2_ACCOUNT_ID,bucket=process.env.R2_BUCKET,access=process.env.R2_ACCESS_KEY_ID,secret=process.env.R2_SECRET_ACCESS_KEY;
 const host=`${account}.r2.cloudflarestorage.com`,uri=`/${encodeURIComponent(bucket)}/${encKey(key)}`,stamp=amzDate(),date=stamp.slice(0,8);
 const headers={host,'x-amz-content-sha256':payloadHash,'x-amz-date':stamp};if(contentType)headers['content-type']=contentType;
 const names=Object.keys(headers).sort(),canonicalHeaders=names.map(n=>`${n}:${String(headers[n]).trim()}\n`).join(''),signed=names.join(';');
 const canonical=[method,uri,'',canonicalHeaders,signed,payloadHash].join('\n'),scope=`${date}/auto/s3/aws4_request`,toSign=['AWS4-HMAC-SHA256',stamp,scope,crypto.createHash('sha256').update(canonical).digest('hex')].join('\n');
 headers.authorization=`AWS4-HMAC-SHA256 Credential=${access}/${scope}, SignedHeaders=${signed}, Signature=${hmac(signingKey(secret,date),toSign,'hex')}`;
 return{host,uri,headers};
}
async function putFile(filePath,key,contentType){if(!configured())return false;const payloadHash=await sha256File(filePath),stat=await fs.promises.stat(filePath),sig=signedHeaders({method:'PUT',key,payloadHash,contentType});return new Promise((resolve,reject)=>{const req=https.request({hostname:sig.host,path:sig.uri,method:'PUT',headers:{...sig.headers,'content-length':stat.size}},res=>{res.resume();res.on('end',()=>res.statusCode>=200&&res.statusCode<300?resolve(true):reject(Error(`R2 upload failed: HTTP ${res.statusCode}`)))});req.on('error',reject);fs.createReadStream(filePath).on('error',reject).pipe(req)});}
async function deleteObject(key){if(!configured()||!key)return false;const empty=crypto.createHash('sha256').update('').digest('hex'),sig=signedHeaders({method:'DELETE',key,payloadHash:empty});return new Promise((resolve,reject)=>{const req=https.request({hostname:sig.host,path:sig.uri,method:'DELETE',headers:sig.headers},res=>{res.resume();res.on('end',()=>res.statusCode>=200&&res.statusCode<300||res.statusCode===404?resolve(true):reject(Error(`R2 delete failed: HTTP ${res.statusCode}`)))});req.on('error',reject);req.end()});}
async function publishFile(file,{category,fallbackUrl}){if(!file)return null;const key=`${String(category||'media').replace(/[^a-z0-9_-]/gi,'')}/${path.basename(file.filename||file.path)}`;if(!configured())return{url:fallbackUrl,fallbackUrl,storageKey:'',storage:'local'};await putFile(file.path,key,file.mimetype||'application/octet-stream');return{url:`${cleanBase()}/${encKey(key)}`,fallbackUrl,storageKey:key,storage:'r2'};}
module.exports={configured,publishFile,deleteObject};
