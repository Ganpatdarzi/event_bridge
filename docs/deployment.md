# Deployment (free plans only)

This setup uses only free tiers — no credit card required and no paid plans:

| Piece                       | Platform                                                          | Free allowance used                                                  |
| --------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| Web (React SPA)             | **Cloudflare Pages**                                              | Unlimited static bandwidth, 100k Function requests/day               |
| `/api` proxy + SPA fallback | **Cloudflare Pages Function** (repo root `functions/[[path]].js`) | Included above                                                       |
| API (Express)               | **Vercel Hobby**                                                  | 1M invocations/mo, 100 GB transfer, 2 GB / 1 vCPU, 300s max duration |
| Database                    | **Neon Free**                                                     | 0.5 GB storage, 100 CU-hours/mo, no card                             |

> Render is intentionally **not** used — its automatic-migration blueprint required a paid plan. Migrations are run manually from your machine instead.

## 1. Neon (database)

1. Create a free project at <https://console.neon.tech>.
2. Create the `event_bridge` database if it was not created by default.
3. In the project dashboard, copy two connection strings:
   - **Pooled connection** — used at runtime (`DATABASE_URL`).
   - **Direct connection** — used only for migrations (`DIRECT_URL`).
4. Keep these values private. Never commit them.

## 2. Run migrations once (from your machine)

Vercel deploys do **not** run migrations for you. From the repo root:

```powershell
$env:DATABASE_URL="postgresql://<pooled-user>:<password>@<pooled-host>/event_bridge?sslmode=require"
$env:DIRECT_URL="postgresql://<user>:<password>@<direct-host>/event_bridge?sslmode=require"
npm ci --include=dev
npm run db:migrate -w @event-bridge/api
```

`DIRECT_URL` is required because migration DDL must not go through Neon's pooled connection. The runner falls back to `DATABASE_URL` if `DIRECT_URL` is unset, but using the direct URL avoids pooler errors.

## 3. Deploy the API to Vercel (Hobby)

1. Push this repo to GitHub (already done).
2. Go to <https://vercel.com/new> and **Import** `Ganpatdarzi/event_bridge`.
   - Use your **personal** account. Vercel Hobby cannot import repositories owned by organizations.
3. Framework preset: **Other**. Vercel will detect the root `vercel.json`:
   - Install: `npm ci`
   - Build: `npm run build:shared && npm run build -w @event-bridge/api`

   Vercel may omit dev dependencies during install; the repo is set up so this is harmless: `typescript` and the API's `@types/*` packages are runtime dependencies (so `tsc` always works), and `scripts/prepare.mjs` skips Husky when it is not installed.
   - Rewrite: every path -> `/api/index` (the Express app in `api/index.js`).

4. Add these **Environment Variables** (Production + Preview):

   | Key                  | Value                                                             |
   | -------------------- | ----------------------------------------------------------------- |
   | `NODE_ENV`           | `production`                                                      |
   | `DATABASE_URL`       | Neon **pooled** connection string                                 |
   | `JWT_SECRET`         | Long random string (e.g. `openssl rand -hex 32`)                  |
   | `JWT_REFRESH_SECRET` | A **different** long random string                                |
   | `APP_ORIGIN`         | Your Cloudflare Pages URL (e.g. `https://event-bridge.pages.dev`) |
   | `COOKIE_SECURE`      | `true`                                                            |

   `PORT` is not needed — Vercel injects it. Do **not** set `DIRECT_URL` on Vercel; migrations are not run there.

5. Deploy. Note the deployment URL, e.g. `https://event-bridge-api.vercel.app`.

   > The API rejects short/placeholder JWT secrets in production, so generate real random values.

### Test the Vercel API directly

```powershell
curl https://event-bridge-api.vercel.app/health
```

Expect a JSON health payload. If you get a 500, check the Vercel **Runtime Logs** — usually an env var is missing or the Neon pooled string is wrong.

## 4. Deploy the web app to Cloudflare Pages

1. Go to <https://dash.cloudflare.com> -> **Workers & Pages** -> **Create** -> **Pages** -> **Connect to Git**.
2. Select `Ganpatdarzi/event_bridge`, branch `main`.
3. Build settings:
   - **Root directory**: leave blank (must be repo root so `functions/` is detected).
   - **Build command**: `npm ci --include=dev && npm run build:shared && npm run build -w @event-bridge/web`
   - **Build output directory**: `apps/web/dist`
   - **Node version**: `22` (set as environment variable `NODE_VERSION=22`)
4. Add an environment variable:
   - `API_ORIGIN` = your Vercel URL from step 3, e.g. `https://event-bridge-api.vercel.app` (no trailing `/api`).
5. Deploy. Cloudflare auto-detects the root `functions/[[path]].js` file, which:
   - proxies `/api/*` to `$API_ORIGIN` (forwarding headers, body, and `Set-Cookie`),
   - serves the SPA (`/`) for non-API paths that are not static assets,
   - forces `Cache-Control: no-store` on proxied API responses.
6. After the first deploy, copy the Pages URL (e.g. `https://event-bridge.pages.dev`) and go back to Vercel -> **Settings -> Environment Variables** -> set `APP_ORIGIN` to that exact URL -> **Redeploy** (or it will auto-redeploy on a Git push).

## 5. Verify the full flow

```powershell
# API through the Cloudflare proxy
curl https://event-bridge.pages.dev/api/v1/health

# SPA fallback on refresh of a client route
curl -I https://event-bridge.pages.dev/dashboard
```

Then open the Pages URL in a browser and sign up / log in. The refresh cookie is `httpOnly`, `Secure`, `SameSite=Lax`, and stays same-origin because the browser only talks to the Cloudflare Pages domain.

## Local development (unchanged)

```powershell
cp .env.example .env
# fill DATABASE_URL (local Neon pooled or local Postgres), DIRECT_URL, JWT secrets
npm ci --include=dev
npm run db:migrate -w @event-bridge/api
npm run dev
```

`apps/web/vite.config.ts` proxies `/api` to `http://localhost:4000`, so the local SPA also uses relative `/api/v1` URLs.

## Troubleshooting

| Symptom                         | Likely fix                                                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Browser shows CORS error        | `APP_ORIGIN` on Vercel does not exactly equal the Cloudflare Pages origin.                                     |
| Login works but refresh fails   | Cloudflare Function is not forwarding `Set-Cookie`; confirm `API_ORIGIN` is the bare Vercel origin.            |
| 500 on every API call           | Missing `DATABASE_URL` / JWT secrets on Vercel, or `createApp()` failed validation. Check Vercel Runtime Logs. |
| 404 on `/api/v1/...` via Pages  | The root `functions/[[path]].js` was not deployed — ensure Cloudflare **Root directory is blank**.             |
| Refresh of a client route 404s  | Static fallback missing; `_redirects` and the Function both handle this — confirm output dir `apps/web/dist`.  |
| Migration fails on first deploy | Use `DIRECT_URL` (Neon direct connection), not the pooled string.                                              |
