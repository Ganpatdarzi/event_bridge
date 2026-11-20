/**
 * Programmatic Vercel configuration for the web project.
 *
 * Vercel evaluates `vercel.ts` at build time, so the API origin can come from a
 * project environment variable instead of being hard-coded. The fallback keeps
 * existing deployments working until `API_ORIGIN` is configured.
 */
const configuredOrigin = process.env.API_ORIGIN?.trim();
const apiOrigin = (configuredOrigin || 'https://event-bridge-wine.vercel.app').replace(/\/+$/, '');

if (!/^https?:\/\//.test(apiOrigin)) {
  throw new Error('API_ORIGIN must be an absolute URL, for example https://api.example.com');
}

export const config = {
  framework: 'vite',
  installCommand: 'cd ../.. && npm ci',
  buildCommand: 'cd ../.. && npm run build:shared && npm run build -w @event-bridge/web',
  outputDirectory: 'dist',
  rewrites: [
    {
      source: '/api/health',
      destination: `${apiOrigin}/health`,
    },
    {
      source: '/api/health/db',
      destination: `${apiOrigin}/health/db`,
    },
    {
      source: '/api/:path*',
      destination: `${apiOrigin}/api/:path*`,
    },
    {
      source: '/((?!api/).*)',
      destination: '/index.html',
    },
  ],
  headers: [
    {
      source: '/api/:path*',
      headers: [
        { key: 'x-vercel-enable-rewrite-caching', value: '0' },
        { key: 'Cache-Control', value: 'no-store' },
      ],
    },
  ],
};
