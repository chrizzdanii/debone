# Community update — 12 November 2026

- Updated message fetching to coalesce simultaneous events instead of silently dropping updates.
- Added a generation guard to avoid displaying results from a previously selected course.
- Wired community refresh to existing SSE community events and shared database revision refreshes.
- Changed fallback database revision check to 1.5 seconds, with chat refresh on demand; chat polling safety fallback remains 2.5 seconds.
- Improved community styling, media sizing, keyboard focus, mobile layout and overlay handling.
- Vercel serverless does not support the existing long-lived SSE endpoint. This build does NOT implement true push on Vercel. A hosted realtime broker/service with authenticated course channels and infrastructure configuration is required for true push.
- No multi-client browser test or production deployment was performed. Do not claim these as verified.
