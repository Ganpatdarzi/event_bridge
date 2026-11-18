import { createApp } from '../dist/app.js';

const app = createApp();

/**
 * Vercel Node function for the API project (Root Directory = apps/api).
 * Every public path is rewritten here by apps/api/vercel.json.
 */
export default function handler(req, res) {
  return app(req, res);
}
