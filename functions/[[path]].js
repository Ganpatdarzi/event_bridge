/**
 * Cloudflare Pages Function for Event Bridge.
 *
 * Two jobs:
 *   1. Proxy /api/* to the Express API so the browser stays on one origin.
 *      This is required because the refresh token is an httpOnly cookie with
 *      SameSite=Lax; a cross-site setup would need SameSite=None plus extra
 *      CORS/cookie work.
 *   2. Serve index.html for client-side routes (React Router deep links).
 *
 * Set API_ORIGIN in the Cloudflare Pages project (Settings > Variables and
 * Secrets), e.g. https://event-bridge-api.vercel.app
 */

const API_PREFIX = '/api';

function errorResponse(code, message, status) {
  return Response.json({ error: { code, message } }, { status });
}

async function proxyApi(request, env, url) {
  const origin = String(env.API_ORIGIN || '').replace(/\/+$/, '');
  if (!origin) {
    return errorResponse('configuration_error', 'API_ORIGIN is not configured', 500);
  }

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');

  const hasBody = !['GET', 'HEAD'].includes(request.method.toUpperCase());

  try {
    const upstream = await fetch(`${origin}${url.pathname}${url.search}`, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      redirect: 'manual',
    });

    const responseHeaders = new Headers(upstream.headers);
    // API responses are session/user specific; never cache them at the edge.
    responseHeaders.set('Cache-Control', 'no-store');

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch {
    return errorResponse('bad_gateway', 'API is unreachable', 502);
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (url.pathname === API_PREFIX || url.pathname.startsWith(`${API_PREFIX}/`)) {
    return proxyApi(request, env, url);
  }

  // Let Pages serve real assets first (and apply any _redirects rules).
  const assetResponse = await env.ASSETS.fetch(request);
  if (assetResponse.status !== 404) {
    return assetResponse;
  }

  // React Router route: fall back to the SPA shell.
  return env.ASSETS.fetch(new URL('/', request.url));
}
