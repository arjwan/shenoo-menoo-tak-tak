// Cloudflare-only signin endpoint; forward requests to D1 API Worker.
export async function onRequest({ request, env }) {
  if (!env.API) return Response.json({ok:false,message:'Cloudflare API binding missing'}, {status:503});
  return env.API.fetch(request);
}
