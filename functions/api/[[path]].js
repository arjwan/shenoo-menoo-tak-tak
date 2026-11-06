import { proxyLegacy } from '../../cloudflare/pages/legacy-origin.js';
import { handleDeveloper } from '../../cloudflare/developer-api.js';
import { developerHelpers } from '../../cloudflare/pages/developer-helpers.js';
import { submitTeacher, listTeacherApplications, teacherApplicationDetail } from '../../cloudflare/pages/school-teachers.js';

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
  // Keep D1 teacher management out of the legacy school proxy. This explicit
  // dispatch also handles catch-all resolution on Pages when a more-specific
  // dynamic school route is not selected.
  if (pathname === '/api/school/management/teachers/apply') {
    return submitTeacher(context);
  }
  if (pathname === '/api/school/management/teacher-applications') {
    return listTeacherApplications(context);
  }
  if (/^\\/api\\/school\\/management\\/teacher-applications\\/[a-f0-9-]{36}(?:\\/(?:approve|reject))?$/i.test(pathname)) {
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
