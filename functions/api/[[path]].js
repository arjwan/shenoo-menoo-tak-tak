// Cloudflare Pages Functions: all /api/* requests stay on Cloudflare.
// No Oracle, IQ Hosting, MariaDB, or external origin.
export async function onRequest({ request, env }) {
  if (!env.API) return Response.json({ ok: false, message: 'Cloudflare API binding missing' }, { status: 503 });
  return env.API.fetch(request);
}
