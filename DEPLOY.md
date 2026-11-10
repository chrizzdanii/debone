> **Hosting on Vercel + Supabase? Use `VERCEL-SUPABASE.md` instead.** The guide below is for Docker hosts (Render, Railway, a VPS) with a disk.

# Deploying the DEBONE website

This guide takes the site from your computer to the internet. Work through it in order. The admin panel's
**Set-up & backup** page shows the same checklist live, and tells you what is still missing.

## 1. What you need
- A domain name (for example `debone.com.ng`).
- A hosting account that runs Node.js or Docker: Render, Railway, Fly.io, or a VPS (for example from Contabo or DigitalOcean).
- A Paystack account (test and live keys).
- A Resend account for emails (free tier is enough to start).
- Optional: a Google Cloud project for "Sign in with Google".

## 2. Prepare the keys
1. **Paystack:** copy the *secret* key (`sk_test_…` now, `sk_live_…` later). Never put it in the website files.
2. **Resend:** create an API key. Verify your domain (add the DNS records Resend gives you) so emails come from `no-reply@your-domain.com`.
3. **Google (optional):** create an OAuth client, type *Web application*. Add the authorised redirect address
   `https://your-domain.com/api/auth/google/callback`.

## 3. Deploy
### Option A: Render or Railway (easiest)
1. Put the project folder on GitHub (the `.gitignore` already keeps secrets and data out).
2. Create a *Web Service* from the repository. Build with Docker (or `npm install` / start command `npm start`).
3. Add a **persistent disk / volume** mounted at `/app/server/data`. This keeps the database and backups safe between deployments.
4. Under *Environment*, add every value from `server/.env.example`.
5. Deploy. Check `https://<your-service>/api/health` shows `{"ok":true}`.

### Option B: a VPS with Docker
```bash
git clone <your repository> debone && cd debone
cp server/.env.example server/.env      # then edit it
docker build -t debone .
docker run -d --name debone --restart unless-stopped -p 80:3000 \
  -v debone-data:/app/server/data --env-file server/.env debone
```
Put HTTPS in front of it (Caddy or Nginx with Let's Encrypt). Caddy does this automatically:
```
your-domain.com { reverse_proxy localhost:80 }
```

## 4. Connect the domain
Point your domain's DNS `A` (or `CNAME`) record to the hosting provider, as they describe. Wait until the
site opens over `https://`. Then set `PUBLIC_URL` to that address and restart the service.

## 5. Connect Paystack
1. In the Paystack dashboard, set the **Webhook URL** to `https://your-domain.com/api/paystack/webhook`.
2. Paystack sends students back to the site after payment; the site checks each payment on the server, so
   courses unlock even if the student closes the page.
3. Make one real test payment with the test key first, then switch to the live key.

## 6. Create the admin account
Sign up on the website with your own email, then run once on the server (or in the hosting shell):
```bash
node server/server.js --make-admin you@example.com
```
Or, before the first start, create an admin directly:
```bash
node server/server.js --create-admin you@example.com "a-strong-password" "Your Name"
```
Log in at `https://your-domain.com/staff-login.html`.

## 7. Set the business details (no coding needed)
In the admin panel open **Site settings** and check the phone numbers, WhatsApp number, address, hours and
social links. Tick *Show an announcement* to display a message on every page (for example the live training date).

## 8. Add your content (no coding needed)
- **Courses:** *Courses & lessons*. Add the course image, price, lessons, live class dates and assignments.
  Use *Coming soon* for courses that are not open yet.
- **Shop:** *Shop products*. Add, edit or remove products and their photos. Leave the price blank for *Price on request*.
- **Selected work:** *Selected work*. Upload the photos for the homepage "Recent frames" and the *Our work* page.
- **Newsletter:** *Newsletter* shows subscribers and lets you export them as a CSV file.

## 9. Before you open to the public
Open **Set-up & backup** in the admin panel. Every item must show *Ready*:
- Online payments, emails, Google sign-in (optional), HTTPS, an admin account, business details reviewed, a backup.
Also complete these outside the code:
- Have a lawyer review the **privacy policy**, **terms** and **refund policy**, and fill in the three
  `[BUSINESS TO CONFIRM]` items in the refund policy.
- Test: sign up, log in, forgot password (check the email arrives), enrol with a test payment, submit an assignment,
  mark it, and check the student sees the result. Test on a phone too.

## 10. Backups (important)
- **Download a backup** from *Set-up & backup* once a week, and keep copies off the server.
- The server also keeps its own copies in `server/data/backups` (the newest 30).
- Restoring: stop the site, replace `server/data/db.json` with the backup file, start the site again.

## 11. Updating the site later
Make changes, push them to the repository, and redeploy. Your data stays because it lives in the volume.
Never delete the `server/data` volume unless you have a backup.

## Troubleshooting
- **Login cookie not kept:** make sure the site is on `https://` and `PUBLIC_URL` matches it exactly.
- **Password-reset emails not arriving:** check `RESEND_API_KEY`, the verified domain, and the spam folder.
- **Payment made but course still locked:** check the Paystack webhook URL; the admin *Payments* page shows each payment's status.
- **Google button says "not available":** `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are missing, or the redirect address does not match exactly.
