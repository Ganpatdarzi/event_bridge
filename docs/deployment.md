# Deployment runbook — Event Bridge

Target stack:

| Layer     | Host                                                | Why                                                           |
| --------- | --------------------------------------------------- | ------------------------------------------------------------- |
| Web       | Cloudflare Pages                                    | Static SPA, global CDN, Git deploys                           |
| API proxy | Cloudflare Pages Function (`functions/[[path]].js`) | Keeps `/api` same-origin so the httpOnly refresh cookie works |
| API       | Render (`render.yaml`)                              | Runs the existing Express/Node 22 app without rewrites        |
| Database  | Neon (already created)                              | Pooled URL at runtime, direct URL for migrations              |

Why not put the API on Cloudflare Workers? It uses `argon2` (native addon), `pg` and Express 5; Workers cannot run native modules. Cloudflare Containers could run it, but needs the Workers Paid plan plus a Durable Object wrapper and cold-start handling — unnecessary for this MVP.

---

## 1. Prerequisites

- GitHub repo pushed to `main` (done).
- Cloudflare account with Pages enabled.
- Render account.
- Neon database with two connection strings:
  - **Pooled** → `DATABASE_URL` (used by the API at runtime).
  - **Direct** → `DIRECT_URL` (used by migrations).
- Fresh JWT secrets are generated automatically by Render, so you do not need to create them.

> Do not run `npm run db:seed` against production. The deploy only runs migrations.

---

## 2. Deploy the API on Render

1. Render Dashboard → **New +** → **Blueprint** → connect `Ganpatdarzi/event_bridge`.
2. Select branch `main`. Render finds `render.yaml` at the repo root.
3. Fill the prompted values:
   - `APP_ORIGIN` — leave blank for now; set it after the Pages deploy (step 4). You can use `http://localhost:5173` temporarily so the service can boot.
   - `DATABASE_URL` — Neon **pooled** connection string (include `?sslmode=require`).
   - `DIRECT_URL` — Neon **direct** connection string.
4. Create the Blueprint. Render will:
   - install with dev dependencies (`npm ci --include=dev`),
   - build the shared package and API,
   - run Drizzle migrations via `preDeployCommand`,
   - start `node dist/server.js`,
   - health-check `/health`.
5. Copy the service URL, e.g. `https://event-bridge-api.onrender.com`.

If the first deploy fails at the migration step, check `DIRECT_URL` and that the Neon branch allows connections from Render.

---

## 3. Deploy the web app on Cloudflare Pages

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → select the repo.
2. Configure the build:

   | Setting                | Value                                                                                |
   | ---------------------- | ------------------------------------------------------------------------------------ |
   | Production branch      | `main`                                                                               |
   | Root directory         | _(leave blank — repo root)_                                                          |
   | Build command          | `npm ci --include=dev && npm run build:shared && npm run build -w @event-bridge/web` |
   | Build output directory | `apps/web/dist`                                                                      |
   | Node version           | `22` ( Settings → Environment variables → `NODE_VERSION = 22` )                      |

3. Add a runtime variable (Settings → **Variables and Secrets**):

   | Name         | Value                                                                        |
   | ------------ | ---------------------------------------------------------------------------- |
   | `API_ORIGIN` | the Render API URL from step 2, e.g. `https://event-bridge-api.onrender.com` |

   No trailing slash. This is a plain variable, not a secret.

4. Deploy. The root-level `functions/[[path]].js` is picked up automatically because the root directory is the repo root.

What that Function does:

- `/api/*` → forwards method, path, query, body and headers to `API_ORIGIN`, and forwards `Set-Cookie` back. Responses are marked `no-store`.
- everything else → serves the real static asset if present; otherwise serves `index.html` so React Router deep links like `/vendor/quotations` work.
- `apps/web/public/_redirects` provides a second SPA fallback for non-Function requests.

---

## 4. Point the API back at the web origin

Once you know the Pages URL (e.g. `https://event-bridge.pages.dev`):

1. Render → `event-bridge-api` → **Environment** → set `APP_ORIGIN` to that exact origin (no trailing slash).
2. Redeploy the Render service.
3. If you later add a custom domain, set `APP_ORIGIN` to the custom origin instead.

`APP_ORIGIN` must match the browser origin exactly: it drives both CORS and the `SameSite=Lax` refresh cookie. Leave `COOKIE_DOMAIN` empty.

---

## 5. Smoke test

```bash
API=https://event-bridge-api.onrender.com
WEB=https://event-bridge.pages.dev

curl -s $API/health
curl -s $API/health/db
curl -s $WEB/api/v1/categories | head -c 300
curl -s -o /dev/null -w '%{http_code}\n' $WEB/vendor/quotations
```

Expected:

- `/health` → `{"data":{"status":"ok",...}}`
- `/health/db` → `{"data":{"status":"ok","database":"reachable"}}`
- `$WEB/api/v1/categories` → same JSON as calling the API directly (proves the proxy works)
- deep link → `200` with the SPA HTML

Then in a browser: register/login, reload the page (refresh cookie should keep you signed in), and open DevTools → Application → Cookies to confirm the refresh cookie is set on the Pages domain with `Secure` + `HttpOnly`.

---

## 6. Production checklist

- [x] `NODE_ENV=production`, `COOKIE_SECURE=true`, `APP_ORIGIN` set correctly
- [x] Secrets managed by the hosts (Render `generateValue`, Cloudflare variable for the non-secret API origin)
- [x] Migrations applied automatically before the API starts
- [x] CORS restricted to the deployed web origin
- [x] HTTPS/HSTS from Cloudflare and Render
- [ ] Confirm Neon point-in-time restore/backups
- [ ] Wire error tracking (e.g. Sentry) if required
- [x] Demo/seed accounts are not created by the deploy

---

## 7. Troubleshooting

| Symptom                                         | Likely cause                                     | Fix                                                                               |
| ----------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------- |
| Web shows `API is unreachable` (502)            | `API_ORIGIN` missing/wrong                       | Set it in Pages → Variables and Secrets, then redeploy                            |
| CORS error in console                           | `APP_ORIGIN` doesn't match the Pages URL exactly | Set exact origin on Render and redeploy                                           |
| Login works but reload logs you out             | Refresh cookie blocked                           | Check `COOKIE_SECURE=true`, empty `COOKIE_DOMAIN`, and that `/api` is same-origin |
| Deep link 404s                                  | Function or `_redirects` missing                 | Ensure `functions/[[path]].js` and `apps/web/public/_redirects` are in `main`     |
| API build fails with missing `tsx`/`typescript` | dev dependencies skipped                         | Keep `npm ci --include=dev` in the build command                                  |
| Migration fails                                 | `DIRECT_URL` wrong or Neon IP rules              | Fix the direct URL / allow Render egress                                          |

---

## 8. Optional: local Pages Function testing

```powershell
Copy-Item apps/web/.dev.vars.example apps/web/.dev.vars
npx wrangler pages dev apps/web/dist --binding=API_ORIGIN=http://localhost:4000
```

Run the API locally first (`npm run dev:api`). `.dev.vars` is gitignored.
