# Revision 4 — Student progression, live navigation and notifications

- Join live class from a lesson checks the student in and navigates to the in-dashboard Live Classes page for that specific session (`#live/<sessionId>`).
- A lesson without any published assignment is **not** finishable. Students must wait for the instructor to publish an assignment, and then submit every assignment for that lesson. Enforced server-side by `/api/lessons/:id/complete` as well as the disabled button in My Courses.
- The assignment section explicitly explains the waiting state.
- Notifications now check for new unread items every two seconds on dashboard pages, plus on refresh, focus, reconnection and return to the tab. This is a fallback for deployments without working server-sent events.
- Notifications are not silently marked read just because a popup appeared. The notification bell can still show unread items.
- Live notification timestamp uses actual live start time when available, so a class transitioning from scheduled to live can trigger a new alert.

## Important limits
- Polling is near-real-time, not guaranteed instantaneous. Delivery can be delayed by connectivity, browser background throttling, or server load.
- Browser autoplay restrictions may prevent alert sound until the user interacts with the page.
- The previous implementation still treats opening a recording as completion; verified watch progress needs a separate video-player integration.
- Syntax checked with Node.js; full browser/integration tests and deployment were not performed.
