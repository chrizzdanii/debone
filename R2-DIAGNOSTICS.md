# DEBONE R2 upload diagnostics update

This release adds a staff-only backend bucket connectivity check, run automatically after a browser upload network failure. It does not disclose secret credentials or signed URLs. It distinguishes missing environment variables, bucket access failures, and cases where Vercel can reach R2 but the browser cannot.

## Deployment
Deploy the entire ZIP to Vercel, retaining existing environment variables. The existing Cloudflare CORS policy can remain unchanged. Test an MP4 upload and read the new on-screen diagnostic message.

## Limitations
This is an error-isolation improvement, **not a guaranteed upload fix**. It cannot correct network filtering or Cloudflare restrictions without observing their cause. A private R2 bucket remains private.
