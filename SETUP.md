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

---

## Troubleshooting

- **`SQLSTATE` / could not connect on `migrate`** — double-check `DB_HOST/PORT/USERNAME/PASSWORD`. Use the **Session pooler** values (not "Direct connection"). Run `php artisan config:clear` after editing `.env`.
- **Form says "Couldn't reach the server"** — make sure `php artisan serve` is running and `frontend/.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:8000`. Restart `npm run dev` after changing `.env.local`.
- **Upload fails / files don't appear** — verify the bucket is named exactly `applications` and the four `SUPABASE_S3_*` values are correct. Run `php artisan config:clear`.
- **Blocked by CORS** — set `FRONTEND_URL` in `backend/.env` to match the site's origin exactly (e.g. `http://localhost:3000`), then `php artisan config:clear`.
