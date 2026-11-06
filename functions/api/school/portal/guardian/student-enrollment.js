import { guardianStudentEnrollment } from '../../../../../cloudflare/pages/school-enrollments.js';
export const onRequest = context => guardianStudentEnrollment(context);
