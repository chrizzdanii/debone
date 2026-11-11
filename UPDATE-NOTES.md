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
