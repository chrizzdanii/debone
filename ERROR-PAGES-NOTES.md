# Error pages update

New files (upload to GitHub under public/):
public/404.html, 403.html, 401.html, 500.html, 503.html, offline.html, error-pages.css, error-pages.js

Changed file (replace on GitHub): server/server.js
- Unknown pages now show public/404.html (was a plain "Page not found" line).
- Blocked paths show 403.html. A crash while loading a page shows 500.html (API calls still get JSON).
- Optional: set MAINTENANCE_MODE=1 in Vercel env to show 503.html to visitors. Staff, /admin, /staff-login and /api stay reachable. Remove the variable to reopen.

Not done yet: 401.html and offline.html are ready but nothing sends visitors to them automatically.
 - 401: point your dashboard.js "session expired" redirect at /401.html.
 - offline: needs a small service worker (next step).
Only server/server.js was changed; no customer data or other files are touched.

## v53 update (12 Nov 2026)
- Offline: public/sw.js + sw-register.js (registered on every page). Shows offline.html only when a page cannot load. API calls are never cached.
- 401: every "session expired" redirect (dashboard.js and the dashboard-*.js files) now goes to /401.html. The 401 page's "Log in again" returns to the dashboard. A wrong current password on Change password now returns 400, so it no longer looks like an expired session.
- Student lesson: the Live class step shows four stages (Locked, Live, Recorded, Finished).
- Admin Live classes: a control room at the top (on air with timer and check-ins, or next class with countdown, plus a warning when ended classes have no recording) and a stage line on every class card.
- Bundles: the "Save %" badge now shows (the code read the wrong field), plus Best value, Coming soon with a waiting-list button.
- Nav: current page highlighted, reading-progress bar, phone menu locks page scroll and closes on link tap.
Not browser-tested. Test on staging first.

## v54: mobile and responsive pass
New: public/mobile.css, public/mobile.js (added to every page, the dashboard and admin).
- Tables become cards on phones. Before, the refund and payment tables stayed 760px wide, so amounts and buttons were pushed off-screen.
- Dashboard and admin get a bottom tab bar (Home, Courses, Live, Tasks, Menu), swipe from the left edge to open the menu, bigger tap targets, 16px fields (no iPhone zoom), and the top bar no longer wraps "Log out".
- Fixed "PRACTICE &AMP; MARKS" on the Assignments page.
- The community drop zone can no longer get stuck open on a phone.
- No stuck hover effects on touch screens; menus and dialogs fit the real screen height.
