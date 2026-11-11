# DEBONE implementation status (November 2026)

This revision is a source-code update, not a deployed or end-to-end verified release.

## Implemented in this revision
- Next-lesson navigation button reads the next lesson's server-calculated schedule lock; disabled until scheduled day, even if previous lesson is complete.
- Community chat accepts small PNG/JPEG/WebP/GIF images, PDFs and TXT files (55 KB per attachment), with server-side MIME/size validation and course-access checks.
- Students can delete their own replies from the WhatsApp-style chat UI, as well as their own thread messages.
- Community image previews and attachment downloads, with responsive styling.

## Already present in the incoming updated ZIP
- Server-side lesson requirements and completion gate; session attendance/recording markers and assignment submission checks.
- Bundle image upload support in admin and bundle page; some bundle motion effects.
- Analytics refresh at a 15-second polling interval.
- Navigation click/hover adjustments.

## Still requiring additional implementation and verification
- Recording completion: current server records a recording as watched when its link is opened. To accurately confirm viewing, host recordings in a trackable HTML5 player or use a provider with signed playback events and a completion threshold. The current behavior does NOT verify video watch time.
- Community attachments are intentionally limited to 55 KB by the current JSON database design. Production-grade WhatsApp-like files need object storage, malware scanning, quota controls and download authorization.
- Reports are periodically refreshed, not event-stream realtime; a streaming/SSE or WebSocket backend is needed.
- Live course seats use actual configured capacity; do not claim 1,000 seats unless an administrator sets and can support that capacity. Configure `seats` to 1000 for applicable courses in the admin editor.
- Full visual acceptance testing, enrollment/payment tests, student role tests, deployment and production data migration have not been run.

Run `npm run check`, then test using student and staff accounts on a staging deployment before production rollout.
