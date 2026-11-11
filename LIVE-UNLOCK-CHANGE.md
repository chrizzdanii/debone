# Next lesson live-class gate

For enrolled students, lessons after the first remain locked until BOTH:
1. The preceding lesson is completed according to its existing attendance/assignment rules.
2. An administrator has actually switched a live session linked to the next lesson to **Live** at least once.

Scheduled dates alone do not unlock lessons. The server records `liveStartedAt` on the first admin transition to Live, so the lesson stays available after the class ends. Existing sessions currently marked Live also count. Sessions marked Ended without a recorded live start do not count. A next lesson with no linked live session remains locked until a session is linked and started. Staff and already completed lessons retain existing exemptions.

Both the My Courses lock display and the lesson API use this server-side gate. Admins should ensure each upcoming lesson has a linked live session and set it to Live when teaching begins.
