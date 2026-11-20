# Deployment — two separate Vercel projects (free)

Everything runs on **Vercel Hobby** ($0/mo) plus **Neon Free** ($0/mo). There are two independent Vercel projects in the same GitHub repo:

| Project            | Root Directory | What it serves                                           |
| ------------------ | -------------- | -------------------------------------------------------- |
| `event-bridge-web` | `apps/web`     | React SPA + `/api/*` external rewrite to the API project |
| `event-bridge-api` | `apps/api`     | Express API as a Node function                           |

Both use the repo's npm workspaces. Each project's Vercel configuration runs install/build from the repo root via `cd ../..`, so `@event-bridge/shared` always builds first.

## 1. Neon (database)

1. Create a free project at <https://console.neon.tech>.
2. Copy two connection strings:
   - **Pooled** — used at runtime (`DATABASE_URL`).
   - **Direct** — used only for migrations (`DIRECT_URL`).
3. Keep them private; never commit them.

## 2. Run migrations once (from your machine)

Vercel does **not** run migrations. From the repo root:

```powershell
$env:DATABASE_URL="postgresql://<pooled-user>:<password>@<pooled-host>/event_bridge?sslmode=require"
$env:DIRECT_URL="postgresql://<user>:<password>@<direct-host>/event_bridge?sslmode=require"
npm ci
npm run db:migrate -w @event-bridge/api
```

`DIRECT_URL` is required because DDL must not go through Neon's pooled connection.

For an existing deployment, migration `0006_rainy_misty_knight.sql` adds the `request_completed`
notification type and is required by the completion flow; running `npm run db:migrate` applies it
along with any earlier pending migrations. Migrations `0004` (unique quotation indexes) and `0005`
(refresh-token families) must also be present for the current API build.

## 3. Deploy the API project first

1. <https://vercel.com/new> → **Import** `Ganpatdarzi/event_bridge`.
2. Project name: e.g. `event-bridge-api`.
3. **Root Directory**: `apps/api` (click _Edit_ next to the setting).
4. Framework preset: **Express** (`apps/api/vercel.json` supplies the settings):
   - Install: `cd ../.. && npm ci`
   - Build: `cd ../.. && npm run build:shared && npm run build -w @event-bridge/api`
   - Rewrite: every path → `/api/index` (`apps/api/api/index.js`).
5. Environment Variables (Production + Preview):

   | Key                  | Value                                             |
   | -------------------- | ------------------------------------------------- |
   | `NODE_ENV`           | `production`                                      |
   | `DATABASE_URL`       | Neon **pooled** connection string                 |
   | `JWT_SECRET`         | Long random string (`openssl rand -hex 32`)       |
   | `JWT_REFRESH_SECRET` | A **different** long random string                |
   | `APP_ORIGIN`         | Web project URL from step 4 (set after it exists) |
   | `COOKIE_SECURE`      | `true`                                            |

   Do **not** set `DIRECT_URL` on Vercel — migrations are not run there.

6. Deploy, then note the URL, e.g. `https://event-bridge-wine.vercel.app`.

Test it:

```powershell
curl https://event-bridge-wine.vercel.app/health
```

Expect `{"data":{"status":"ok",...}}`. If it fails, check Vercel **Runtime Logs** — usually a missing env var.

## 4. Deploy the web project

1. <https://vercel.com/new> → **Import the same repo** `Ganpatdarzi/event_bridge`.
2. Project name: e.g. `event-bridge-web`.
3. **Root Directory**: `apps/web`.
4. Framework preset: **Vite** (`apps/web/vercel.ts` supplies the settings):
   - Install: `cd ../.. && npm ci`
   - Build: `cd ../.. && npm run build:shared && npm run build -w @event-bridge/web`
   - Output Directory: `dist`
   - Rewrites: `/api/*` → external rewrite to the API project (`https://event-bridge-wine.vercel.app/api/:path*`); everything else that isn't a static file → `/index.html`.
5. Set one environment variable on the **web project** (Production + Preview):

   | Key          | Value                                                             |
   | ------------ | ----------------------------------------------------------------- |
   | `API_ORIGIN` | The API project URL from step 3, e.g. `https://my-api.vercel.app` |

   `apps/web/vercel.ts` reads `API_ORIGIN` at build time and generates the external rewrites. If
   the variable is missing, it falls back to `https://event-bridge-wine.vercel.app` so existing
   deployments keep working. After changing `API_ORIGIN`, redeploy the web project.

6. Deploy and note the URL, e.g. `https://event-bridge-vb33.vercel.app`.
7. Go back to the **API project** → Settings → Environment Variables → set `APP_ORIGIN` to this exact web URL → redeploy.

## 5. Verify the full flow

```powershell
# API through the web project's external rewrite
curl https://event-bridge-vb33.vercel.app/api/health

# SPA fallback on refresh of a client route
curl -I https://event-bridge-vb33.vercel.app/dashboard
```

Then open the web URL and sign up / log in. The browser only talks to `event-bridge-web.vercel.app`; Vercel's external rewrite forwards `/api/*` to the API project and passes `Set-Cookie` back, so the refresh cookie stays first-party (`httpOnly`, `Secure`, `SameSite=Lax`).

## Why `/api` is proxied instead of called directly

`apps/web/src/lib/api.ts` uses a relative `API_BASE = '/api/v1'`. Vercel external rewrites forward the request and response (including bodies, headers and cookies) while keeping the browser URL on the web domain, so no CORS/`SameSite` workaround is needed. The API origin is generated from the web project's `API_ORIGIN` environment variable in `apps/web/vercel.ts` at build time; it is not exposed to the browser bundle.

## Local development (unchanged)

```powershell
cp .env.example .env
# fill DATABASE_URL, DIRECT_URL, JWT secrets
npm ci
npm run db:migrate -w @event-bridge/api
npm run dev
```

`apps/web/vite.config.ts` proxies `/api` to `http://localhost:4000`, so local development also uses relative `/api/v1` URLs.

## Troubleshooting

| Symptom                                     | Likely fix                                                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Build fails with `husky: command not found` | Ensure the deployment uses the latest commit. `scripts/prepare.mjs` now skips Husky when it is absent.                               |
| Build fails with `tsc: not found`           | TypeScript is a dependency in this repo; make sure `npm ci` runs from the repo root via `cd ../.. && npm ci`.                        |
| Browser shows CORS error                    | `APP_ORIGIN` on the API project must exactly equal the web project origin.                                                           |
| Login works but refresh fails               | Check `APP_ORIGIN` on the API project and that the rewrite passes `Set-Cookie` through.                                              |
| 404 on `/api/v1/...` via web URL            | Confirm Root Directory is `apps/web` and `API_ORIGIN` on the web project points at the right API domain. Redeploy after changing it. |
| Refresh of a client route 404s              | Confirm the web rewrite to `/index.html` and output directory `dist`.                                                                |
| 500 on every API call                       | Missing `DATABASE_URL` / JWT secrets on the API project. Check Runtime Logs.                                                         |
| Migration fails                             | Use `DIRECT_URL` (Neon direct connection), not the pooled string.                                                                    |
