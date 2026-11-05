/**
 * Cloudflare Pages API Router: functions/api/[[path]].js
 * Project: shenoo-main-cloudflare
 * Target Domain: shinomino.com
 */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // توجيه طلبات اللوحة والمدرسة إلى خادم MongoDB Atlas على IQ Hosting
  if (
    pathname === '/developer.html' ||
    pathname.startsWith('/api/developer') ||
    pathname.startsWith('/api/developer-mfa') ||
    pathname.startsWith('/api/school/')
  ) {
    const targetUrl = new URL(pathname + url.search, 'http://api.shinomino.com');
    const proxyHeaders = new Headers(request.headers);
    proxyHeaders.set('X-Forwarded-Host', url.host);
    proxyHeaders.set('X-Forwarded-Proto', url.protocol.replace(':', ''));

    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: proxyHeaders,
      body: request.body,
      redirect: 'follow'
    });

    try {
      return await fetch(proxyRequest);
    } catch (err) {
      return new Response(JSON.stringify({
        success: false,
        error: 'تعذر الاتصال بخادم MongoDB المساعد: ' + err.message
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }
  }

  // بقية خدمات التطبيق تستمر بالعمل على D1 و R2 دون أي مساس بها
  if (env.API && typeof env.API.fetch === 'function') {
    return env.API.fetch(request);
  }

  return context.next();
}
