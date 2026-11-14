# This update

- **Course cards (student dashboard)**: My courses and Browse courses now share one card layout (public/course-cards.css, markup in public/dashboard.js). Badge and lesson count sit on their own row, title/description/progress/button line up, equal heights.
- **Shop order**: the order chosen in Admin > Shop products is now saved as its own record (`shopOrder`) and applied by the server to /api/products, so products.html and product.html follow it on Supabase/Vercel too. Before, the database only remembered insertion order.
- **Restore**: Announcements and Shop products now have a "Restore deleted" button next to "Delete all". Deleted items (single or all) are kept in a bin for 90 days and come back with photos and their old shop position.
- **Admin on phones**: public/admin-mobile.css (product/service rows no longer overflow, full-width buttons, 44px touch targets, 16px inputs, modal sizing).
- **Speed**: Brotli/gzip + ETag/304 + cache headers for static files, gzip for large API replies, GSAP self-hosted (public/vendor), shop images sized/async, cart loads the catalogue only when needed. Asset versions (?v=) bumped.
