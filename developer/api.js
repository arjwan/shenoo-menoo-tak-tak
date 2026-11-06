export const TOKEN_KEY = 'shenoo.developer.session.v1';
export function clearLegacySessions(storage) {
  for (const key of ['developerToken', 'developerUser']) storage.removeItem(key);
}
export function createClient({ fetcher = fetch, token = () => '', expired = () => {} } = {}) {
  return async function request(path, { auth, ...options } = {}) {
    if (!/^\/api\/(developer(?:-mfa)?(?:\/|$)|school(?:\/|$))/.test(path)) throw Error('مسار خارج خدمات لوحة المطوّر');
    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');
    if (options.body) headers.set('Content-Type', 'application/json');
    const credential = auth === false ? '' : typeof auth === 'string' ? auth : token();
    if (credential) headers.set('Authorization', 'Bearer ' + credential);
    let response;
    try { response = await fetcher(path, { ...options, headers, credentials: 'omit', redirect: 'error', cache: 'no-store' }); }
    catch { throw Error('تعذر الاتصال بالخادم. تحقق من اتصالك وحاول مجدداً.'); }
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401 && auth === undefined) expired();
      const error = new Error(data?.message || data?.error || `تعذر إكمال الطلب (${response.status})`);
      error.status = response.status;
      throw error;
    }
    if (!data || data.ok === false || data.success === false) throw Error(data?.message || 'استجابة غير صالحة من الخادم');
    return data;
  };
}
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function requireMfaChallenge(data) {
  if (!data?.preAuthToken || data.token) throw Error('لم تكتمل خطوة تأكيد الهوية');
  return { token: data.preAuthToken, phone: Boolean(data.mfa?.phone), fido: Boolean(data.mfa?.fido) };
}
