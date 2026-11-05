/**
 * Cloudflare Pages API Router: functions/api/[[path]].js
 * Project: shenoo-main-cloudflare
 * Target Domain: shinomino.com
 */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // 1. Route Developer Panel and Sumer School requests to external MongoDB Atlas backend
  if (
    pathname === '/developer.html' ||
    pathname.startsWith('/api/developer') ||
    pathname.startsWith('/api/developer-mfa') ||
    pathname.startsWith('/api/school')
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
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to connect to auxiliary backend: ' + err.message
        }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json; charset=utf-8' }
        }
      );
    }
  }

  // 2. Delegate all other routes (including /api/auth/signup, D1, and R2) to Cloudflare Worker
  if (env.API && typeof env.API.fetch === 'function') {
    return env.API.fetch(request);
  }

  return context.next();
}
