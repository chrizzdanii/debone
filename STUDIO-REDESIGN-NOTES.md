# DEBONE Studio redesign (admin + student dashboards)
New files: public/studio.css, public/studio.js (loaded last in server/private/admin.html and dashboard.html).
No data/logic code was changed. To roll back, delete the two <link>/<script> lines for studio.* in both HTML files.
Covers every admin and student view via shared components: animated hero banner with product photography (from /assets/debone-products),
gliding sidebar indicator, glass cards with cursor spotlight, count-up numbers, avatars + quick filter on long tables,
gold buttons with ripple, status pills, empty-state art, modal/toast polish, mobile layouts, reduced-motion support.
Hero photo/icon per page is set in the ART map at the top of studio.js.
