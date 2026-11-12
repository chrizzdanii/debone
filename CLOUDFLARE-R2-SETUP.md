# DEBONE private Zoom recordings — Cloudflare R2

## 1. Configure hosting secrets (server-side only)

Set these environment variables on your hosting platform, then redeploy/restart:

```
R2_ACCOUNT_ID=<your Cloudflare account ID>
R2_BUCKET=debone-class-recordings
R2_ACCESS_KEY_ID=<R2 S3 access key ID>
R2_SECRET_ACCESS_KEY=<R2 S3 secret access key>
```

Never put these credentials in browser JavaScript, public HTML, a Git repository, or a ZIP sent to students. Do not send them in chat. Token needs Object Read & Write permission scoped to the private bucket. Keep public bucket access disabled.

## 2. Configure R2 bucket CORS

In Cloudflare Dashboard → R2 → debone-class-recordings → Settings → CORS policy, configure an allowed origin for **your actual HTTPS DEBONE website domain** (replace the placeholder). This is needed for direct browser uploads using signed PUT URLs.

```json
[
  {
    "AllowedOrigins": ["https://YOUR-DEBONE-DOMAIN.example"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Do not use `*` as an allowed origin. Confirm Cloudflare's current dashboard CORS editor format if it differs.

## 3. Upload and publish

Admin → Academy → Live Classes → edit the relevant class → **Private Zoom recording (Cloudflare R2)** → select MP4 → **Upload MP4 & publish**. Keep the page open until it reports success. Set class status to **Ended** and save changes. Students enrolled in that course can then watch from **Recordings** and their lesson/live page while the replay window is open.

## 4. Limits and caveats

- This is **private R2 storage**, not Cloudflare Stream; no transcoding, adaptive streaming or DRM. Large files and mobile connections may buffer.
- Signed playback GET URLs expire after 120 seconds. A playback started near expiry may fail on later seeks/range requests; refresh the page and press Watch replay again. A production-scale solution should use a controlled streaming proxy or HLS with token refresh.
- Links can be extracted while valid and screens can be recorded. Never promise perfect anti-copy protection.
- Upload cap is 2 GiB per MP4; browser PUT uploads may need a multipart uploader for larger files or unreliable connections.
- Existing replay expiry follows the site's configured `replayDays` (default 14) counted from the course's final scheduled class, **not** from each recording's upload date.
- A successful upload does not erase old files in R2 when replacing recordings. Delete superseded objects manually if needed to control storage costs.
- Cloudflare free tier has storage and operation limits. Review billing and monitor usage, especially with many students.
- This project uses AWS SDK dependencies. Deploy using `npm install` / your host's normal build process.
- Test a paid student, unpaid student, expired recording, upload and video seeking on the real hosting environment before using with a class.
