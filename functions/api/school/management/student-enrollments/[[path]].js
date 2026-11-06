import { reviewStudentEnrollments } from '../../../../../cloudflare/pages/school-enrollments.js';
export const onRequest = context => reviewStudentEnrollments(context);
