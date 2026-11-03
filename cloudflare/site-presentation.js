// Shared presentation is injected only into application HTML; APIs and media pass through.
function sitePresentationResponse(response, path) {
  if (response.status !== 200 || !/text\/html/i.test(response.headers.get('Content-Type') || '')) return response;
  // Authentication already uses the approved stylesheet. Leave exported artwork intact.
  if (['/signin.html', '/signup.html'].includes(path) || path.startsWith('/canva-originals/')) return response;
  return new HTMLRewriter()
    .on('html', {element(el) {
      el.setAttribute('class', ((el.getAttribute('class') || '') + ' shenoo-ui-scope').trim());
      if (!el.getAttribute('data-theme')) el.setAttribute('data-theme', 'light');
    }})
    .on('head', {element(el) {el.append('<link rel="stylesheet" href="/site-ui.css?v=20261103-1" />', {html:true});}})
    .transform(response);
}
