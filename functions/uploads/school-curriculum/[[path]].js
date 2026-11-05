import { proxyLegacy } from '../../../cloudflare/pages/legacy-origin.js';
// Existing PDF bytes stay on the original file host; stream ranges/downloads.
export async function onRequest(context) {
  if (!['GET', 'HEAD'].includes(context.request.method)) {
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  return proxyLegacy(context);
}
