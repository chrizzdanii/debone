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
