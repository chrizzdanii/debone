# DEBONE YouTube access hardening

## Implemented
- Authenticated, course-enrollment-checked playback API for live and recorded YouTube embeds.
- Live embeds are not returned until the class is marked live.
- Recordings require an ended class and an active replay window.
- The recordings library embeds videos in the dashboard rather than linking to YouTube.
- Removed direct YouTube watch links and recording URLs from student session/list APIs.
- Student lesson replay buttons navigate to the in-dashboard class view.

## Important limitations
YouTube unlisted videos are NOT private or DRM-protected. Anyone who obtains the video ID can access the video outside DEBONE. A browser can inspect an iframe source, and screen recording is possible. Disabling copy/right-click does not solve this. YouTube cannot provide genuinely paid-user-only playback. Do not claim these controls make the underlying video link uncopyable.

## Operations
1. Set each paid YouTube live/recording to Unlisted (not Public). Private YouTube videos generally cannot be embedded for arbitrary students.
2. Never send the YouTube URL via WhatsApp, announcements or course resources.
3. Publish links only in staff class settings; test as paid, unpaid and logged-out users.
4. Confirm `replayDays` is set to 14 in admin configuration.
5. Use a streaming host with signed playback tokens/DRM when stronger access protection is required.
6. This code records a replay as watched when opened, not when playback finishes; watch-progress verification requires a further player integration.
