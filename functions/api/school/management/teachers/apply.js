import {submitTeacher} from '../../../../../cloudflare/pages/school-teachers.js';
export const onRequest = context => submitTeacher(context);
