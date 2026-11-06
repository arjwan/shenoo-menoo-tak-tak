import { proxyLegacy } from '../../cloudflare/pages/legacy-origin.js';

export async function onRequest(context) {
  const pathname = new URL(context.request.url).pathname;
  // Developer API now lives in the Cloudflare D1 Worker; school remains on its origin.
  if (pathname === '/api/school' || pathname.startsWith('/api/school/')) return proxyLegacy(context);
  if (context.env.API?.fetch) return context.env.API.fetch(context.request);
  return Response.json({ ok: false, message: 'Cloudflare API binding missing' }, { status: 503 });
}
