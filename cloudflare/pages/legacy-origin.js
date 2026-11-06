// Keep the original MongoDB application's authorization and MFA at the origin.
// Never retry protected requests against the D1 application.
export async function proxyLegacy({ request, env }, upstreamFetch = fetch) {
  const incoming = new URL(request.url);
  const origin = new URL(env.LEGACY_ORIGIN || 'https://api.shinomino.com');
  if (origin.protocol !== 'https:' || origin.username || origin.password ||
      origin.pathname !== '/' || origin.search || origin.hash || origin.origin === incoming.origin) {
    return Response.json({ ok: false, message: 'إعداد خادم المدرسة واللوحة غير صالح' }, { status: 503 });
  }
  const target = new URL(incoming.pathname + incoming.search, origin);
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.set('X-Forwarded-Host', incoming.host);
  headers.set('X-Forwarded-Proto', incoming.protocol.replace(':', ''));
  try {
    // Manual redirects avoid forwarding credentials to another host or HTTP.
    const result = await upstreamFetch(new Request(target, {
      method: request.method, headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'manual', duplex: 'half'
    }));
    if (result.status >= 500 || (result.status >= 300 && result.status < 400)) {
      await result.body?.cancel();
      return Response.json({ ok: false, message: 'خادم المدرسة واللوحة أعاد توجيهاً غير متوقع' }, { status: 502 });
    }
    const responseHeaders = new Headers(result.headers);
    responseHeaders.set('Cache-Control', 'private, no-store');
    responseHeaders.set('X-Content-Type-Options', 'nosniff');
    return new Response(result.body, { status: result.status, headers: responseHeaders });
  } catch {
    return Response.json({ ok: false, message: 'تعذر الاتصال بخادم المدرسة واللوحة' }, { status: 502 });
  }
}
