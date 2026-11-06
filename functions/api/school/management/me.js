import { schoolManagementMe } from '../../../../cloudflare/pages/school-session.js';
export const onRequest = context => schoolManagementMe(context);
