import { proxyLegacy } from '../../cloudflare/pages/legacy-origin.js';

export async function onRequest(context) {
  const pathname = new URL(context.request.url).pathname;
  if (['/api/developer', '/api/developer-mfa', '/api/school'].some(
    prefix => pathname === prefix || pathname.startsWith(prefix + '/')
  )) return proxyLegacy(context);
  if (context.env.API?.fetch) return context.env.API.fetch(context.request);
  return Response.json({ ok: false, message: 'Cloudflare API binding missing' }, { status: 503 });
}
