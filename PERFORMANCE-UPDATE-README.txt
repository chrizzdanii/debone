DEBONE performance update — 14 November 2026

Only six existing files were modified. No database, payment, authentication, or server-side code was changed.

Upload the six JavaScript files into the public/ directory of your GitHub repository, replacing their existing versions.

Changes:
- Live revision fallback checks every 5 seconds instead of 1.5 seconds.
- Notification pop-up checks every 12 seconds instead of 2 seconds; event-triggered checks remain.
- Course community chat polls every 3.5 seconds instead of 2.5 seconds; event-triggered checks remain.
- Class chat polls every 3.5 seconds instead of 1 second; prevents overlapping requests and skips hidden tabs.
- Admin live reports poll every 12 seconds instead of 4 seconds and avoid overlapping requests.
- QR reporting polls every 30 seconds instead of 8 seconds, skips hidden tabs.
- Header notifications prevent overlapping requests and refresh on tab return.

These are conservative client-side optimizations, not a guarantee that every source of latency is resolved. Test admin reports, community chat, notifications, and class chat after deployment.
