import { listTeacherApplications, teacherApplicationDetail } from '../../../../../cloudflare/pages/school-teachers.js';

// Pages optional catch-all ([[path]]) can also match the collection root.
// Delegate it to the listing handler rather than treating it as a missing ID.
export function onRequest(context) {
  const pathname = new URL(context.request.url).pathname.replace(/\/$/, '');
  if (pathname === '/api/school/management/teacher-applications') {
    return listTeacherApplications(context);
  }
  return teacherApplicationDetail(context);
}
