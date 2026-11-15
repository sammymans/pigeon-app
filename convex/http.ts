import { httpRouter } from 'convex/server';
import { auth } from './auth';
import { whopWebhook } from './whop';

const http = httpRouter();
auth.addHttpRoutes(http);
http.route({ path: '/webhooks/whop', method: 'POST', handler: whopWebhook });
export default http;
