# Put DEBONE live on Vercel + Supabase

This version stores its data in **Supabase** (database + file storage) and runs on **Vercel**. Nothing is kept on the server's disk.
Cost: free, apart from your domain. Follow the steps in order.

## Step 1: Create the Supabase project
1. Sign in at supabase.com and click **New project**. Pick a name, a strong database password (save it) and the region closest to your students.
2. Wait until the project finishes setting up.
3. Open **SQL Editor > New query**, paste everything from the file `supabase/schema.sql`, and click **Run**. It should say "Success". This creates the data table and a private file bucket called `debone`.
4. Open **Project Settings > API** and copy two things:
   - **Project URL** (like `https://abcd.supabase.co`)
   - **service_role** key (under "Project API keys", click Reveal). This is a secret: never share it or put it in a website file.

## Step 2: Put the code on GitHub
1. Create a free account at github.com and a **New repository** (Private).
2. Upload everything from this folder (`api`, `public`, `server`, `supabase`, `package.json`, `vercel.json`, and so on).
   The `.gitignore` keeps secrets out. Do not upload a `.env` file.

## Step 3: Deploy on Vercel
1. Sign in at vercel.com with GitHub and click **Add New > Project**. Import your repository.
2. Framework Preset: **Other**. Leave Build Command empty. (`vercel.json` already sets the output folder.)
3. Open **Environment Variables** and add these before you click Deploy:

| Name | Value |
|---|---|
| `SUPABASE_URL` | your Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | your service_role key |
| `PUBLIC_URL` | the final site address, e.g. `https://debone.com.ng` (use the `.vercel.app` address for now) |
| `COOKIE_SECURE` | `true` |
| `SESSION_SECRET` | any long random text (30+ characters) |
| `CRON_SECRET` | any long random text |
| `ADMIN_EMAILS` | your email |
| `PAYSTACK_SECRET_KEY` | your Paystack key (`sk_test_...` first) |
| `RESEND_API_KEY` and `MAIL_FROM` | for password-reset emails (optional at first) |
| `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` | only if you use Google sign-in |

4. Click **Deploy**. When it finishes, open `https://your-project.vercel.app/api/health`. You should see `{"ok":true,...}`.

## Step 4: Domain
1. In Vercel: **Settings > Domains**, add your domain and set the DNS records Vercel shows you.
2. When the domain works over `https://`, change `PUBLIC_URL` to it (Settings > Environment Variables), then **Redeploy**.

## Step 5: Admin account
1. Open the live site and **sign up** with the same email you put in `ADMIN_EMAILS`.
2. Log in at `/staff-login.html`.
   If it says you are not staff, create the admin from your own computer instead: put the same values in `server/.env`, then run
   `node server/server.js --create-admin you@example.com "a-strong-password" "Your Name"`

## Step 6: Paystack
In the Paystack dashboard, set the **Webhook URL** to `https://your-domain.com/api/paystack/webhook`. Make one test payment before switching to the live key.

## Step 7: Check everything
Open the admin panel > **Set-up & backup**. Every item should say Ready. Then test on a phone: sign up, log in, forgot password, enrol, upload a receipt, and check the admin sees it.

## Backups
Your data lives in Supabase. Also download a backup from **Set-up & backup** every week. (Supabase's free plan has no automatic backups.)

## Moving old data in (only if you already ran the old version with real students)
Put the Supabase keys in `server/.env` and run `npm run migrate -- path/to/db.json`.

## Good to know (differences from the old server)
- **Live updates:** pages refresh every 20 seconds while open, instead of instantly. The pop-up "notice" messages that used to appear instantly are not shown live; the notification bell still works.
- **Receipts:** upload limit is 3 MB (Vercel's request limit).
- **Reminders:** the "class starts in an hour" reminder and the course schedule check run when someone visits the site, plus once a day from Vercel's cron job.
- **Page-view counts:** only the dashboard and admin pages are counted now. Use Vercel Analytics (free, Settings > Analytics) for public page visits.
- **Free Supabase plan:** the project pauses after 1 week with no activity (open the dashboard and click Restore). Limits: 500 MB database, 1 GB files, 5 GB data transfer a month.
- **Rate limits** (too many login attempts) work per server instance, so they are softer than before.
