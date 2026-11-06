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
    return proxyLegacy(context);
  }
  if (context.env.API?.fetch) return context.env.API.fetch(context.request);
  return Response.json({ ok: false, message: 'Cloudflare API binding missing' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } });
}
