# SEO setup (read this before deploying)

1. In Vercel, set `PUBLIC_URL` to your real site address (for example `https://debone.com.ng`). The sitemap, robots.txt and the service and shop page tags are built from it.
2. If your address is not `https://debone.com.ng`, run `SITE_URL=https://your-address node tools/seo-apply.js` once, then upload the changed pages. That script writes the page titles, descriptions, canonical links, schema and FAQs into every static page. It is safe to run again.
3. Every service and shop product now has its own address: `/services/<id>` and `/shop/<id>`. They are built from the admin data, so new services and products get search tags and a sitemap entry automatically. Old `?id=` links redirect to them.
4. After deploying: open Google Search Console, add the site, submit `/sitemap.xml`, and use URL Inspection on the home page, /services, /academy, /nin and /products.
5. Pages that are not meant to be found on Google (login, sign up, payment, quotation, password reset, staff login, feedback, error pages) are marked noindex on purpose.
