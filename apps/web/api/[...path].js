const API_ORIGIN = process.env.API_ORIGIN;

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

/**
 * Same-origin /api proxy for the Vite SPA. The browser only talks to the
 * web project's Vercel domain, so the refresh cookie stays first-party.
 */
export default async function handler(req, res) {
  const origin = String(API_ORIGIN || '').replace(/\/+$/, '');
  if (!origin) {
    return sendJson(res, 500, {
      error: { code: 'configuration_error', message: 'API_ORIGIN is not configured' },
    });
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;

  const headers = { ...req.headers };
  delete headers.host;
  delete headers['content-length'];
  if (body && !headers['content-type']) headers['content-type'] = 'application/json';

  const [pathname, query = ''] = req.url.split('?');
  const upstreamPath =
    pathname === '/api/health' || pathname === '/api/health/db'
      ? pathname.slice('/api'.length)
      : pathname;
  const target = `${origin}${upstreamPath}${query ? `?${query}` : ''}`;

  let upstream;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
      redirect: 'manual',
    });
  } catch (error) {
    return sendJson(res, 502, {
      error: {
        code: 'bad_gateway',
        message: 'Could not reach the API',
        detail: error instanceof Error ? error.message : String(error),
      },
    });
  }

  res.statusCode = upstream.status;
  const setCookies = upstream.headers.getSetCookie?.() ?? [];
  upstream.headers.forEach((value, key) => {
    const name = key.toLowerCase();
    if (['set-cookie', 'content-encoding', 'transfer-encoding', 'connection'].includes(name)) {
      return;
    }
    res.setHeader(key, value);
  });
  if (setCookies.length) res.setHeader('set-cookie', setCookies);

  res.setHeader('cache-control', 'no-store');

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  res.end(Buffer.from(await upstream.arrayBuffer()));
}
