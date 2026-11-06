import {listTeacherApplications} from '../../../../cloudflare/pages/school-teachers.js';
export const onRequest = context => listTeacherApplications(context);
