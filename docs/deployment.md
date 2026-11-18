# Deployment — two separate Vercel projects (free)

Everything runs on **Vercel Hobby** ($0/mo) plus **Neon Free** ($0/mo). There are two independent Vercel projects in the same GitHub repo:

| Project            | Root Directory | What it serves                        |
| ------------------ | -------------- | ------------------------------------- |
| `event-bridge-web` | `apps/web`     | React SPA + a `/api/*` proxy function |
| `event-bridge-api` | `apps/api`     | Express API as a Node function        |

Both use the repo's npm workspaces. Each project's `vercel.json` runs install/build from the repo root via `cd ../..`, so `@event-bridge/shared` always builds first.

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

6. Deploy, then note the URL, e.g. `https://event-bridge-api.vercel.app`.

Test it:

```powershell
curl https://event-bridge-api.vercel.app/health
```

Expect `{"data":{"status":"ok",...}}`. If it fails, check Vercel **Runtime Logs** — usually a missing env var.

## 4. Deploy the web project

1. <https://vercel.com/new> → **Import the same repo** `Ganpatdarzi/event_bridge`.
2. Project name: e.g. `event-bridge-web`.
3. **Root Directory**: `apps/web`.
4. Framework preset: **Vite** (`apps/web/vercel.json` supplies the settings):
   - Install: `cd ../.. && npm ci`
   - Build: `cd ../.. && npm run build:shared && npm run build -w @event-bridge/web`
   - Output Directory: `dist`
   - Rewrites: `/api/*` → proxy function; everything else that isn't a static file → `/index.html`.
5. Environment Variable:

   | Key          | Value                                                                                        |
   | ------------ | -------------------------------------------------------------------------------------------- |
   | `API_ORIGIN` | API project URL from step 3, e.g. `https://event-bridge-api.vercel.app` (no trailing `/api`) |

6. Deploy and note the URL, e.g. `https://event-bridge-web.vercel.app`.
7. Go back to the **API project** → Settings → Environment Variables → set `APP_ORIGIN` to this exact web URL → redeploy.

## 5. Verify the full flow

```powershell
# API through the web project's proxy
curl https://event-bridge-web.vercel.app/api/v1/health

# SPA fallback on refresh of a client route
curl -I https://event-bridge-web.vercel.app/dashboard
```

Then open the web URL and sign up / log in. The browser only talks to `event-bridge-web.vercel.app`; the function in `apps/web/api/[...path].js` forwards `/api/*` to the API project and passes `Set-Cookie` back, so the refresh cookie stays first-party (`httpOnly`, `Secure`, `SameSite=Lax`).

## Why `/api` is proxied instead of called directly

`apps/web/src/lib/api.ts` uses a relative `API_BASE = '/api/v1'`. A Vercel external rewrite could proxy it, but the small Node function is more reliable here: it forwards request bodies/headers, preserves multiple `Set-Cookie` headers, and lets the API origin come from an environment variable instead of a hardcoded URL in `vercel.json`.

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

| Symptom                                     | Likely fix                                                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Build fails with `husky: command not found` | Ensure the deployment uses the latest commit. `scripts/prepare.mjs` now skips Husky when it is absent.        |
| Build fails with `tsc: not found`           | TypeScript is a dependency in this repo; make sure `npm ci` runs from the repo root via `cd ../.. && npm ci`. |
| Browser shows CORS error                    | `APP_ORIGIN` on the API project must exactly equal the web project origin.                                    |
| Login works but refresh fails               | Check `API_ORIGIN` on the web project; the proxy must forward `Set-Cookie`.                                   |
| 404 on `/api/v1/...` via web URL            | Confirm Root Directory is `apps/web` so `apps/web/api/[...path].js` is deployed.                              |
| Refresh of a client route 404s              | Confirm the web rewrite to `/index.html` and output directory `dist`.                                         |
| 500 on every API call                       | Missing `DATABASE_URL` / JWT secrets on the API project. Check Runtime Logs.                                  |
| Migration fails                             | Use `DIRECT_URL` (Neon direct connection), not the pooled string.                                             |
