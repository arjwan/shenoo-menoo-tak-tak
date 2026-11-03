const BACKEND = "https://shino-mino-tak-tak.duckdns.org";
const FRONTEND = BACKEND;
const API_PREFIXES = ["/api/", "/socket.io", "/uploads/"];
function isBackendPath(path) { return API_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix)); }
function corsHeaders(request) {
 const origin=request.headers.get("Origin") || "*";
 return {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers") || "Authorization,Content-Type,Accept",
  "Access-Control-Max-Age": "600",
  "Vary": "Origin",
  "Cache-Control": "no-store"
 };
}
export default {
 async fetch(request) {
  const incoming=new URL(request.url);
  const backend=isBackendPath(incoming.pathname);
  if(backend && request.method==="OPTIONS") return new Response(null,{status:204,headers:corsHeaders(request)});
  const target=new URL(incoming.pathname+incoming.search,backend?BACKEND:FRONTEND);
  const headers=new Headers(request.headers);
  headers.set("Origin",BACKEND);
  headers.delete("host");
  const init={method:request.method,headers,redirect:"manual"};
  if(request.method!=="GET"&&request.method!=="HEAD")init.body=request.body;
  let response;
  try{response=await fetch(new Request(target.toString(),init));}
  catch{return new Response(JSON.stringify({ok:false,error:"upstream_unavailable",message:"تعذر الاتصال بالخادم الأصلي"}),{status:502,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});}
  if(response.status===101) return response;
  const location=response.headers.get("Location");
  if(location){
   const redirect=new URL(location,target);
   if(redirect.origin===BACKEND){
    const redirected=new Response(response.body,response);
    redirected.headers.set("Location",incoming.origin+redirect.pathname+redirect.search+redirect.hash);
    response=redirected;
   }
  }
  if(backend){
   const out=new Response(response.body,response);
   const ch=corsHeaders(request);
   for(const [k,v] of Object.entries(ch))out.headers.set(k,v);
   return out;
  }
  return response;
 }
};