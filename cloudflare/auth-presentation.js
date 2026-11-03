// UI_ASSETS is generated from the approved HTML/CSS files at build time.
// Authentication scripts and API endpoints in those pages remain unchanged.
const AUTH_STYLE_VERSION = '20261103-home-1';
const AUTH_UI_TYPES = {
  '/signin.html': 'text/html; charset=utf-8',
  '/signup.html': 'text/html; charset=utf-8',
  '/auth-ui.css': 'text/css; charset=utf-8',
  '/taktak.html': 'text/html; charset=utf-8',
  '/taktak-colors.css': 'text/css; charset=utf-8',
  '/site-ui.css': 'text/css; charset=utf-8'
};

function authPresentationResponse(path, request) {
  if (!Object.hasOwn(AUTH_UI_TYPES, path)) return null;
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, {status: 405});
  return new Response(request.method === 'HEAD' ? null : UI_ASSETS[path], {
    headers: {
      'Content-Type': AUTH_UI_TYPES[path],
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'X-Shenoo-Auth-Style': AUTH_STYLE_VERSION
    }
  });
}
