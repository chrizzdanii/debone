# DEBONE dashboard revision

Implemented:
- Reports responsive KPI grid, overflow-safe tables, animated cards and status indicator; refreshes data every 10 seconds while open. This is near-real-time polling, not push-based instantaneous streaming.
- Avatar image URLs are stable during dashboard re-renders; cache version changes after avatar upload or removal.
- Bundle cover upload was already present; added preview in admin editor and thumbnails in admin bundle list.
- Public bundle cards refined with transitions and responsive layout.
- Paid course capacity defaults to 1,000 only when no positive capacity was configured. Existing positive course capacities remain unchanged. Enrollment checks use the same default as displayed seats.
- No artificial seats-left number is shown for full courses with a configured capacity.

Checks: node --check passed on server/server.js, public/admin.js, public/dashboard.js, public/shell.js.
Not completed: live end-to-end browser/database testing, true push-streaming analytics, student dashboard bundle purchase cards if the dashboard currently only links to bundles.
Before deployment: back up the database and test with a student and admin account. A previously configured small course capacity must be edited by admin to 1000 if you want it increased.

## Bundle editor: Coming soon, discount offer, waiting list
- Bundle editor redesigned: sale status switch (Open for sale / Coming soon), course picker cards, pricing panel.
- Normal price (crossed out) + optional offer end date with live countdown. Example: normal 80,000, bundle price 50,000 shows "38% OFF, you save 30,000". If no normal price is typed, the sum of the course prices is still used as before.
- Coming-soon bundles show "Join the waiting list" instead of Buy (website and student dashboard). Buying is blocked on the server too.
- Waiting list page now lists bundles as well as courses. "Launch and notify" opens the bundle and notifies everyone waiting. Saving a bundle from Coming soon to Open also notifies them.
- A coming-soon course can only be put in a bundle that is also Coming soon. A bundle cannot be launched while it contains a coming-soon course.
- Files changed: server/server.js, public/admin.js, public/commerce.js, public/dashboard-offers.js, public/bundles.css, public/offers.css, public/bundles.html, server/private/admin.html, server/private/dashboard.html.

## Studio, About and Services pages + "Page content" admin panel
- New pages: studio.html, about.html, services.html (styles in dx.css, animation in dx.js).
- Admin > Page content: change photos and wording on those three pages, plus the shared numbers (students, clients, start year). Anything not changed keeps its original.
- Studio gallery photos come from Selected work; the five Studio service cards use Services photos.
- Code: server/page-slots.js lists every editable item. After editing a page or that list, run `node tests/page-slots.test.js`.
- New API: GET /api/page-content (public), /api/staff/page-content (admin). New collection: pageSlots.
- Please check the story timeline text on the About page and the numbers (index page says 50,000 clients; the build plan says 3,000+).
