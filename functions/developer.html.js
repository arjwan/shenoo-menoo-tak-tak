import { proxyLegacy } from '../cloudflare/pages/legacy-origin.js';

export const onRequest = context => proxyLegacy(context);
