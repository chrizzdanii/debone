# Installment payments and WhatsApp number

## The rules (change numbers in Admin > Business rules)
- Applies to **courses and bundles only**. Not offered for the shop, digital products, webinars or studio deposits.
- Student chooses at checkout: pay in full, or 2 installments (60% / 40%), or 3 installments (50% / 30% / 20%). Same total price either way.
- First payment opens the course. Later payments fall due every 14 days, always at least 3 days before the course ends (gaps shrink for short courses; no plan is offered if there is not enough time).
- Only offered above ₦30,000. Each course can allow 2, 3, both, or none (Admin > Courses > course > Payment options).
- Late payment ladder: reminder 3 days before, on the day, the day after, then **grace period (3 days)**, then **access paused** (progress kept, opens again the moment the payment is approved), then flagged "Needs your decision" after 14 days overdue.
- Certificate only after the last installment. Bundles cannot be bought while an installment plan covers one of their courses.
- Refund: 7 days from the FIRST payment, before the course starts, covers everything paid so far, and closes the plan.
- Admin (Admin > Installments): late students first, WhatsApp button, Record payment (cash/phone), More time, Close plan.

## WhatsApp
- Required field on the sign-up form, no explanation shown. Stored as digits with country code. Google sign-ups are asked once per visit in a dismissible pop-up and can add it in Profile.
- Admin > Users: WhatsApp column with a chat button, and a "Signed up, no course yet" filter.
- To make it optional again: set `WHATSAPP_REQUIRED = false` in server/server.js and remove `required` on the input in public/signup.html.

## Reminders
Emails go out only if RESEND_API_KEY is set. They are sent by the daily /api/cron job (set CRON_SECRET) and also when the site is visited. Students always see the reminder banner in their dashboard.
