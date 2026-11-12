# DEBONE Zoom Basic integration

1. In Admin > Live Classes, create a session for the correct course. Paste a NEW Zoom meeting invitation URL into **Video room link**. Set the scheduled date/time in Nigeria time and set status to Scheduled; change to Live when teaching starts. The join window opens 15 minutes before the scheduled time. Set status to Ended when finished.
2. Paid enrolled students can see Join Zoom class; the backend checks login, course enrollment, session status and join window again when clicked. The Zoom URL is not returned in class listings, but is revealed to the student's browser on joining. A student can still copy/share it.
3. In Zoom Basic, enable Waiting Room and passcode, disable join-before-host and restrict screen sharing to host. Verify each entrant against the paid enrollment roster **manually**. Do not automatically admit unknown names. Free Zoom does not provide reliable payment-linked identity enforcement.
4. Zoom Basic normally supports 100 total participants and 40 minutes per meeting. A 1,000-student simultaneous class is not supported on Basic.
5. Local automatic recording is saved on the instructor's desktop, not uploaded automatically. This patch does not implement Zoom recording uploads or private video storage. Do not paste Zoom cloud recording links into the YouTube-only recording field.
6. Change the passcode of the meeting link previously shared in chat before using it for paid classes.
7. This integration has only passed JavaScript syntax checks; test paid, unpaid, early, ended, and forwarded-link scenarios before production.
