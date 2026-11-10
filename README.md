# DEBONE website

Public website, shop, selected work, student academy and admin panel for DEBONE Photos & Video Editing Studio.

- **Run locally:** `npm start`, then open http://localhost:3000
- **Create an admin:** `node server/server.js --create-admin you@example.com "password" "Your Name"`
- **Deploy on Vercel + Supabase:** read **VERCEL-SUPABASE.md** (the old Docker guide is still in DEPLOY.md)
- **Settings:** copy `server/.env.example` to `server/.env` and fill it in (never commit this file)
- **Data:** stored in Supabase when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set; otherwise in `server/data/db.json` (local testing). Back up from the admin panel.
