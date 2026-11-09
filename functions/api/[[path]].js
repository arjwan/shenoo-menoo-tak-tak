import { proxyLegacy } from '../../cloudflare/pages/legacy-origin.js';
import { handleDeveloper } from '../../cloudflare/developer-api.js';
import { developerHelpers } from '../../cloudflare/pages/developer-helpers.js';
import { submitTeacher, listTeacherApplications, teacherApplicationDetail } from '../../cloudflare/pages/school-teachers.js';
import { schoolManagementMe } from '../../cloudflare/pages/school-session.js';
import { profileSession, getAuthenticatedAppUser } from '../../cloudflare/pages/profile-session.js';
import { friendQrRequest } from '../../cloudflare/pages/friend-qr.js';
import { smartFriendRoute } from '../../cloudflare/pages/smart-friend.js';
import { guardianStudentEnrollment, reviewStudentEnrollments } from '../../cloudflare/pages/school-enrollments.js';

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
  if (pathname === '/api/friends/qr' || pathname === '/api/friends/qr/request' ||
      pathname === '/api/smart-friend/friends' || pathname.startsWith('/api/smart-friend/friends/') ||
      pathname === '/api/smart-friend/messages' || pathname === '/api/smart-friend/group' ||
      pathname.startsWith('/api/smart-friend/avatar/')) {
    if (!context.env.DB) return Response.json({ok:false,message:'قاعدة البيانات غير مهيأة'},{status:503});
    const actor = await getAuthenticatedAppUser(context.request,context.env);
    if (!actor) return Response.json({ok:false,message:'يرجى تسجيل الدخول'},{status:401,headers:{'Cache-Control':'no-store'}});
    if (pathname.startsWith('/api/friends/qr')) return friendQrRequest(context.request,context.env,actor);
    return smartFriendRoute(context.request,context.env,actor);
  }
  // Profile editing, photo/cover media and privacy now run natively on D1/R2.
  if (pathname === '/api/users/me/profile' || pathname === '/api/users/me/privacy' ||
      /^\/api\/users\/me\/profile\/(?:avatar|cover)$/.test(pathname) ||
      /^\/api\/users\/[a-f0-9-]{36}\/profile$/i.test(pathname) ||
      /^\/api\/profile-media\/[a-f0-9-]{36}\/(?:avatar|cover)$/i.test(pathname)) {
    return profileSession(context);
  }
  if (pathname === '/api/school/management/me') return schoolManagementMe(context);
  if (pathname === '/api/school/portal/guardian/student-enrollment') return guardianStudentEnrollment(context);
  if (pathname === '/api/school/management/student-enrollments' ||
      /^\/api\/school\/management\/student-enrollments\/[a-f0-9-]{36}\/(?:approve|reject)$/i.test(pathname)) {
    return reviewStudentEnrollments(context);
  }
  // Keep D1 teacher management out of the legacy school proxy. This explicit
  // dispatch also handles catch-all resolution on Pages when a more-specific
  // dynamic school route is not selected.
  if (pathname === '/api/school/management/teachers/apply') {
    return submitTeacher(context);
  }
  if (pathname === '/api/school/management/teacher-applications') {
    return listTeacherApplications(context);
  }
  if (/^\/api\/school\/management\/teacher-applications\/[a-f0-9-]{36}(?:\/(?:approve|reject))?$/i.test(pathname)) {
    return teacherApplicationDetail(context);
  }
  // Other school paths remain on the legacy origin until their D1 migration.
  if (pathname === '/api/school' || pathname.startsWith('/api/school/')) {
    // A verified MFA developer may use the original school endpoints without
    // registering as a separate student or teacher. No browser-supplied role.
    if (/^\\/api\\/school\\/(?:virtual|classroom)(?:\\/|$)/.test(pathname) &&
        context.env.SCHOOL_DEVELOPER_BRIDGE_SECRET?.length >= 32) {
      const checkUrl = new URL('/api/developer/me', context.request.url);
      const headers = new Headers();
      const cookie = context.request.headers.get('Cookie');
      if (cookie) headers.set('Cookie', cookie);
      const checked = await handleDeveloper(new Request(checkUrl, {method:'GET',headers}), context.env, developerHelpers);
      if (checked.ok) {
        const actor = await checked.json().catch(() => null);
        if (actor?.user?.role === 'developer' && actor.user.id) {
          const enc = new TextEncoder();
          const claims = {aud:'sumer-school-developer',role:'developer',id:String(actor.user.id),
            username:String(actor.user.username || 'developer').slice(0,100),iat:Date.now()};
          const encoded = btoa(String.fromCharCode(...enc.encode(JSON.stringify(claims))))
            .replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');
          const key = await crypto.subtle.importKey('raw',enc.encode(context.env.SCHOOL_DEVELOPER_BRIDGE_SECRET),
            {name:'HMAC',hash:'SHA-256'},false,['sign']);
          const sig = new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(encoded)));
          const signed = btoa(String.fromCharCode(...sig)).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');
          const forwarded = new Headers(context.request.headers);
          forwarded.delete('x-school-developer-bridge');
          forwarded.delete('authorization');
          forwarded.set('x-school-developer-bridge',encoded+'.'+signed);
          return proxyLegacy({...context,request:new Request(context.request,{headers:forwarded})});
        }
      }
    }
    return proxyLegacy(context);
  }
  if (context.env.API?.fetch) return context.env.API.fetch(context.request);
  return Response.json({ ok: false, message: 'Cloudflare API binding missing' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } });
}
