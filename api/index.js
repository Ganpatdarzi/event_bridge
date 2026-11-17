import { createApp } from '../apps/api/dist/app.js';

const app = createApp();

/**
 * Vercel Node function entrypoint. The existing Express app handles the
 * request unchanged; `vercel.json` rewrites every public path to this file.
 */
export default function handler(req, res) {
  return app(req, res);
}
