# DEBONE website

Public website, shop, selected work, student academy and admin panel for DEBONE Photos & Video Editing Studio.

- **Run locally:** `npm start`, then open http://localhost:3000
- **Create an admin:** `node server/server.js --create-admin you@example.com "password" "Your Name"`
- **Deploy on Vercel + Supabase:** read **VERCEL-SUPABASE.md** (the old Docker guide is still in DEPLOY.md)
- **Settings:** copy `server/.env.example` to `server/.env` and fill it in (never commit this file)
- **Data:** stored in Supabase when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set; otherwise in `server/data/db.json` (local testing). Back up from the admin panel.


## The guide, tour, voice reader and PDF

Every student and staff member gets a **Take a tour** button and a **Guide** button in the top bar.

- **Tour:** walks through every menu item and top bar control for the person's role (students, instructors and admins each see their own pages).
- **Guide** (`/guide.html`): the full written guide. Read it, search it, press **Listen** to have it read aloud until stopped (pause, speed, voice, previous/next section), or **Download PDF**.
- **One source of truth:** all the wording lives in `server/guide/student.json`, `server/guide/staff.json` and `server/guide/better.json` (the "why DEBONE is better" section). The tour, the guide, the voice and the PDF all read these files.
- **Live numbers:** write `{{refundWindowDays}}` and similar in the text and the real value from Business rules is filled in everywhere, PDF included.
- **Adding a new dashboard page?** Add a section for it in the matching JSON file with the same `view` name as the menu item. Run `npm test`: a test fails and names the page if a menu item has no guide section, so nothing is ever missing.
- The PDF is made on demand by `server/guide.js` (uses the `pdfkit` package, so run `npm install` after pulling this update).
