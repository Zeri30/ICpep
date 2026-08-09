# ICpEP.SE — Backend + Supabase Setup Guide

This project has two parts:

| Folder | What it is | Runs on |
|---|---|---|
| `frontend/` | The public website (Next.js). Has the membership form. | http://localhost:3000 |
| `backend/` | The API + admin panel (Laravel + Filament). Talks to Supabase. | http://localhost:8000 |

**Data flow:** a student fills the membership form → the form sends it (with the e‑signature + formal picture files) to the Laravel API → Laravel uploads the files to **Supabase Storage** and saves the record to **Supabase Postgres** → officers review submissions in the **admin panel** at `http://localhost:8000/admin`.

You only need to do the steps below **once**.

---

## Part A — Create your Supabase project

1. Go to <https://supabase.com>, sign in, and click **New project**.
2. Give it a name (e.g. `icpep-se`), pick a **region** close to you (e.g. Singapore / `ap-southeast-1`), and set a **Database Password** — **write this password down**, you'll need it in Part B.
3. Wait ~2 minutes for it to finish provisioning.

### A1. Get the database connection details
1. In your project, click **Connect** (top bar) → the **Connection string** tab.
2. Choose **Session pooler** (this one works from anywhere). You'll see values like:
   - Host: `aws-0-ap-southeast-1.pooler.supabase.com`
   - Port: `5432`
   - Database: `postgres`
   - User: `postgres.abcdefghijklmnop` (your project ref is the part after the dot)
3. Keep this tab open for Part B.

### A2. Create the storage bucket
1. Left sidebar → **Storage** → **New bucket**.
2. Name it exactly **`applications`**. **Leave "Public bucket" OFF** (it must stay private — it holds students' photos and signatures).
3. Click **Create bucket**.

### A3. Get the Storage S3 keys
1. Left sidebar → **Project Settings** → **Storage**.
2. Under **S3 Connection**, copy the **Endpoint** (looks like `https://<ref>.storage.supabase.co/storage/v1/s3`) and the **Region**.
3. Scroll to **S3 Access Keys** → **New access key** → copy the **Access key ID** and **Secret access key** (the secret is shown once — copy it now).

---

## Part B — Fill in the backend `.env`

Open **`backend/.env`** and fill in the placeholders using the values from Part A:

```env
# From A1 (Session pooler)
DB_HOST=aws-0-ap-southeast-1.pooler.supabase.com
DB_PORT=5432
DB_DATABASE=postgres
DB_USERNAME=postgres.<your-project-ref>
DB_PASSWORD=<the database password from step A2>
DB_SSLMODE=require

# From A3
SUPABASE_S3_ENDPOINT=https://<your-project-ref>.storage.supabase.co/storage/v1/s3
SUPABASE_S3_REGION=ap-southeast-1
SUPABASE_S3_ACCESS_KEY_ID=<access key id>
SUPABASE_S3_SECRET_ACCESS_KEY=<secret access key>
SUPABASE_S3_BUCKET=applications
```

> The admin login (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) is already set in `.env`. `.env` is **not** committed to git, so these secrets stay off GitHub. Change `ADMIN_PASSWORD` here any time, then re-run the seeder (Part C, step 3).

---

## Part C — Set up the database (run once)

Open a terminal in `backend/` and run:

```bash
# 1. Generate the app key (only if APP_KEY is empty in .env)
php artisan key:generate

# 2. Create all the tables in Supabase (users, sessions, applications, ...)
php artisan migrate

# 3. Create the admin login from ADMIN_EMAIL / ADMIN_PASSWORD in .env
php artisan db:seed --class=Database\\Seeders\\AdminUserSeeder
```

If `migrate` connects and finishes without errors, your Supabase database is wired up correctly. ✅

---

## Part D — Run it

Open **two** terminals:

**Terminal 1 — backend (Laravel):**
```bash
cd backend
php artisan serve            # http://localhost:8000
```

**Terminal 2 — frontend (Next.js):**
```bash
cd frontend
npm run dev                  # http://localhost:3000
```

Now:
- **Public site + form:** <http://localhost:3000> (scroll to *Membership*).
- **Admin panel:** <http://localhost:8000/admin> — log in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `backend/.env`.

Submit a test application on the site, then refresh the admin panel — it should appear, with clickable previews of the e‑signature and formal picture.

---

## Deploying later (short version)

- **Frontend** (e.g. Vercel): set `NEXT_PUBLIC_API_URL` to your deployed Laravel URL.
- **Backend** (any PHP host / Laravel Cloud / Render): set the same `.env` values there, set `FRONTEND_URL` to your deployed frontend URL (so CORS allows it), set `APP_ENV=production` and `APP_DEBUG=false`, and run `php artisan migrate --force` + the admin seeder on the server.
- **Security settings (required)** — see below. Two `.env` values that default to being *off* until a production deploy turns them on deliberately.
- **Log rotation (recommended)** — see below. Skipping this doesn't break the app, but `storage/logs/laravel.log` grows forever instead of rotating.
- **Scheduler (required)** — see below. Skipping this doesn't break the app, but two maintenance tasks silently never run.

### Security settings for production

Two settings in `.env.example` are documented but left unset/commented by default, since the wrong value for local dev (plain HTTP, no reverse proxy) would actively break things there. Both must be set explicitly once this is actually deployed — nothing in code enforces them, since code can't tell "local" from "production that forgot to set this."

1. **`SESSION_SECURE_COOKIE=true`** — without it, the session cookie and the `icpep_remember` cookie ship without the `Secure` attribute, meaning a browser would send them over a plain HTTP connection too, not just HTTPS. Set this explicitly rather than relying on Laravel's own HTTPS auto-detection (see point 2 for why that detection can silently fail).

2. **`TRUSTED_PROXIES`** — set to the reverse proxy/load balancer's IP(s), or `*` when the platform's own network is the only way to reach the app (true for most PaaS setups — Render, Railway, etc.). This is required for two separate things to work correctly behind a proxy:
   - Laravel's HTTPS auto-detection (what `SESSION_SECURE_COOKIE` unset would otherwise fall back to) reads the proxy's `X-Forwarded-Proto` header — without `TRUSTED_PROXIES`, it never sees that header and assumes plain HTTP even when the real connection is HTTPS.
   - Every per-IP rate limiter in this app (admin login's brute-force protection in `AdminAuthController`, and the public `/applications`/`/registration-status`/etc. limiters in `AppServiceProvider`) keys on `$request->ip()`. Without `TRUSTED_PROXIES`, that resolves to the proxy's own IP for every visitor — meaning the whole site shares one rate-limit bucket instead of each visitor getting their own, which both under-protects (one abusive visitor's limit is shared with everyone else, so it fills fast) and over-restricts (a real visitor can get throttled by traffic that was never theirs).

   See the comment in `backend/bootstrap/app.php` (`trustProxies`) for exactly how this is wired.

**Verifying it's actually set correctly, once deployed:**

- `curl -I https://your-domain/api/registration-status` and check the response's `Set-Cookie` header (if a session cookie is issued) includes `Secure` — confirms `SESSION_SECURE_COOKIE` took effect.
- From two different real IPs (or a VPN to change yours), hit the admin login endpoint with a wrong password a few times from each and confirm they get independent rate-limit counters (one IP being throttled doesn't throttle the other) — confirms `TRUSTED_PROXIES` is resolving real client IPs, not the proxy's.
- `php artisan tinker` on the deployed instance and inspect `request()` isn't available outside an HTTP request, so instead add a temporary throwaway route (or check application logs if `$request->ip()` is ever logged) to confirm it reports a real visitor IP rather than the platform's internal proxy address — remove the route again afterward.

### Log rotation for production

`LOG_STACK` defaults to `single` — one `storage/logs/laravel.log` that only ever grows, which is fine for local dev (nobody's watching it for weeks at a stretch) but not for a server that stays up indefinitely. Set `LOG_STACK=daily` in production: Laravel then writes to `storage/logs/laravel-YYYY-MM-DD.log`, starting a new file each day, and automatically deletes files older than `LOG_DAILY_DAYS` (default 14 — raise it in `.env` if you want a longer troubleshooting window) on its own, with no separate cron/cleanup job needed the way the two `php artisan ...:prune` commands above do.

What doesn't change: what gets logged, at what level, or how any error is handled — `LOG_STACK` only controls how the log *directory* is organized (one growing file vs. one file per day with automatic pruning). `LOG_LEVEL` (separately, already `debug` locally / recommended `warning` or `error` in production — see the comment in `.env.example`) controls what's noisy enough to write in the first place, and is unaffected by this switch either way.

**Verifying it's actually rotating, once deployed:** after `LOG_STACK=daily` is set and the app has logged at least once, `ls storage/logs/` on the server should show a `laravel-YYYY-MM-DD.log` file dated today rather than a plain `laravel.log`. Confirming the *pruning* half without waiting two weeks: temporarily set `LOG_DAILY_DAYS=1` in a non-production environment, create a couple of dummy dated log files by hand (e.g. `touch storage/logs/laravel-2020-01-01.log`), trigger any log write, and confirm the old dummy file is gone afterward.

### Wiring up the scheduler

Laravel's scheduler (`routes/console.php`) currently runs two daily maintenance commands:

- `remember-tokens:prune` — deletes expired "remember me" tokens.
- `activity-log:prune` — deletes Activity Log rows older than `ACTIVITY_LOG_RETENTION_DAYS` (default 730 days).

Neither runs on its own. Laravel's scheduler only does something when `php artisan schedule:run` is actually invoked, and that has to come from outside the app — a cron entry, a platform's cron-job feature, or (on Laravel Cloud) automatically, since Laravel Cloud runs the scheduler for you with nothing to configure here.

**Plain host / VPS** — add this to the server's crontab (adjust the path to wherever `backend/` lives):

```cron
* * * * * cd /path/to/backend && php artisan schedule:run >> /dev/null 2>&1
```

This fires every minute; Laravel itself decides nothing is due to run except at the times each command specifies (`->daily()` here).

**Render, free tier** — Render's **Cron Job** service type (below) needs at least the Starter plan; it's not available on the free web-service tier at all. If you're staying on free, use the external-ping endpoint instead:

1. `POST /api/scheduler/run?token=...` (see `App\Http\Controllers\SchedulerController`) runs `schedule:run` on demand, guarded by a shared-secret token so it can be called by something outside the app with no officer session behind it.
2. Generate a long random token and set it as `SCHEDULER_TOKEN` in Render's environment variables (e.g. `php artisan tinker --execute="echo Str::random(40);"` on Render's shell). Left unset, the endpoint refuses every request.
3. Register a free job on [cron-job.org](https://cron-job.org) (or similar): URL `https://<your-render-domain>/api/scheduler/run?token=<that token>`, method `POST`, schedule **daily at 03:00 Asia/Manila** (or **19:00 UTC** if the service only offers UTC).
4. The time has to match `routes/console.php`'s own `dailyAt('03:00')->timezone(config('icpep.timezone'))` on both commands — `schedule:run` only runs a command when the *current* minute matches its schedule, so a ping several minutes off from that would miss it for the day. Run `php artisan schedule:list` to confirm what's registered and when it's next due.

**Render, paid, or any host with real cron access** — use Render's **Cron Job** service type instead of (or alongside) the web service:

1. Dashboard → **New** → **Cron Job**.
2. Point it at the same repo/branch as the backend, with **Root Directory** set to `backend`.
3. **Build Command:** `composer install --no-dev --optimize-autoloader` (the cron job never serves HTTP, so it doesn't need the frontend build).
4. **Command:** `php artisan schedule:run`.
5. **Schedule:** `* * * * *`.
6. Give it the same environment variables as the web service (in particular the `DB_*`/`SUPABASE_*` values) — either by copying them or, if the web service's env vars are in a Render **Environment Group**, attaching that same group here instead of duplicating them by hand.

A starter `render.yaml` for this cron job is included at the repo root (`render.yaml`) — treat it as a reference to merge into your own Blueprint rather than a ready-to-deploy file, since it doesn't know your web service's exact runtime/build setup. Render's [Blueprint reference](https://render.com/docs/blueprint-spec) has the current, authoritative field list if anything here has drifted.

**Verifying it's actually running:** `php artisan schedule:list` shows what's registered and when each is next due. After the cron/Cron-Job has had a chance to fire at least once, `SELECT MAX(created_at) FROM activity_logs` staying non-empty and current is a fine sanity check that the log itself is healthy — but the more direct proof is temporarily setting `ACTIVITY_LOG_RETENTION_DAYS` very low in a non-production environment and confirming old rows disappear after `php artisan schedule:run` fires.

### Cache store — single instance only, for now

`CACHE_STORE=file` (the default in `.env`) is a local, per-process cache, and this app relies on it for more than incidental speedups — the current membership term, the role/permission matrix, registration settings, Payment History's list, and the Dashboard's headline figures are all cached and invalidated on write (see `backend/config/cache.php` for the full explanation). That invalidation is correct only when every process serving requests shares one cache.

**While the backend runs as a single instance — the only way this repo deploys today — this needs no changes.** If it's ever deployed across more than one app server/container (autoscaling, multiple Render instances, etc.), switch `CACHE_STORE` to a shared backend first: `database` (already Laravel's own default, and the `cache` table migration is already present — just unset `CACHE_STORE` or set it to `database`) or `redis`. Deploying to more than one instance without making this switch means one instance's cache invalidation won't be seen by the others, and they'll keep serving stale data — in the case of the permission matrix, that specifically means a just-revoked permission could still be honored on another instance until that process restarts.

---

## Troubleshooting

- **`SQLSTATE` / could not connect on `migrate`** — double-check `DB_HOST/PORT/USERNAME/PASSWORD`. Use the **Session pooler** values (not "Direct connection"). Run `php artisan config:clear` after editing `.env`.
- **Form says "Couldn't reach the server"** — make sure `php artisan serve` is running and `frontend/.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:8000`. Restart `npm run dev` after changing `.env.local`.
- **Upload fails / files don't appear** — verify the bucket is named exactly `applications` and the four `SUPABASE_S3_*` values are correct. Run `php artisan config:clear`.
- **Blocked by CORS** — set `FRONTEND_URL` in `backend/.env` to match the site's origin exactly (e.g. `http://localhost:3000`), then `php artisan config:clear`.
