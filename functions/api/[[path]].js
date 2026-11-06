import { proxyLegacy } from '../../cloudflare/pages/legacy-origin.js';
import { handleDeveloper } from '../../cloudflare/developer-api.js';
import { developerHelpers } from '../../cloudflare/pages/developer-helpers.js';

export async function onRequest(context) {
  const pathname = new URL(context.request.url).pathname;
  // Pages serves developer APIs directly against D1: no cPanel or MongoDB dependency.
  if (/^\/api\/developer(?:-mfa)?(?:\/|$)/.test(pathname)) {
    if (!context.env.DB) {
      return Response.json({ ok: false, message: 'قاعدة إدارة Cloudflare غير مهيأة' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    return handleDeveloper(context.request, context.env, developerHelpers);
  }
  // School remains on its origin until the school migration is fully tested.
  if (pathname === '/api/school' || pathname.startsWith('/api/school/')) {
    return proxyLegacy(context);
  }
  if (context.env.API?.fetch) return context.env.API.fetch(context.request);
  return Response.json({ ok: false, message: 'Cloudflare API binding missing' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } });
}
