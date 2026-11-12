# YouTube player update

The YouTube embed URL now uses `controls=0`, which removes the standard YouTube control bar (including the bottom-right YouTube button in the supplied screenshot) in the normal embedded player. Students can click the video to play/pause, but the usual seek, volume, settings and fullscreen buttons are also hidden. This is a tradeoff, not a security boundary.

YouTube may still display its branding or links elsewhere, including on pause, errors or other player states. It does not provide an officially supported way to prevent a viewer from opening an embedded video on YouTube. The video URL can still be extracted from browser developer tools. Do not claim this makes an unlisted YouTube recording secure. For actual paid-content protection, migrate recordings to private streaming with signed playback authorization.

The server-side enrollment and replay-expiration checks remain unchanged.
