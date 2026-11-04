// Stream R2 media through the existing Cloudflare Worker service binding.
export async function onRequest({ request, env }) {
  if (!env.API) return new Response('Media service unavailable', { status: 503 });
  return env.API.fetch(request);
}
