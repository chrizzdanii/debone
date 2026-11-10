# DEBONE Official Website: status against the development plan

Status key: **Done** = built and tested · **Partly** = some of it works, the rest is listed · **Not started** = not built yet.

| Plan section | Status | What is in place | What is still missing |
|---|---|---|---|
| 1. Main navigation | Done | Grouped menu on every public page (Digital Academy, Creative Studio, Digital Services, Digital Store, About, Contact, Log in). Student and admin menus grouped by area. | "Soon" items link nowhere until built. |
| 2. Digital Academy (live training flow) | Partly | Course catalogue, categories, instructor, start date, duration, class days, seats, payment, dashboard, live classes, live chat, assignments and grading. | Attend Class button and recordings; certificates. |
| 3. Live schedule and recordings | Built (links) | Live class scheduling and embedded live video exist. | Automatic recording, replay access, 14-day expiry, retention rules. Needs a decision on video hosting. |
| 4. Enrolment and minimum students | Partly | Per-course seats (paid courses are refused when full), minimum-student field, registration fields, setup check for missing details. | Automatic notice to students when the minimum is not met, rescheduling and refund workflow. |
| 5. Course categories | Done | Seven categories from the plan, filters on the academy page, Advanced Technology marked Coming soon. | Only courses with an instructor and schedule should take payment; the setup check warns about this. |
| 6. Bundles | Not started | "Course bundles" shows as Soon in the navigation. | Bundle purchase, access rules, conflict-free timetables. |
| 7. Student dashboard | Partly | My courses, live classes, assignments, results, performance, certificates, course reviews, payments, profile, notifications, tour, help assistant. | Timetable page, Attend Class, recordings, community. |
| 8. Live classroom interaction | Partly | Live chat, instructor announcements, embedded video. | Screen sharing controls, attendance tracking, moderation (mute, remove). |
| 9. Assignments and certificates | Partly | Create, submit, grade, feedback, colour-coded results. Certificates issued automatically with a verification code and printable page. | Resubmission. Certificate PDF file (printing already works). |
| 10. Digital products store | Not started | Physical shop (laptops, printers, gear) exists. | Digital product catalogue, checkout, secure file delivery, receipts. |
| 11. eBook features | Not started | — | Covers, previews, controlled downloads, reviews, bundles. |
| 12. Digital product admin | Not started | — | Uploads, digital file control, digital order reports. |
| 13. Creative studio booking | Partly | Services pages with booking buttons (WhatsApp). | Booking form, quotations, deposits. |
| 14. Digital services | Partly | NIN & ID, printing, repair, gear pages. | Service enquiry forms and quotation process. |
| 15. Student community | Not started | — | Course communities, moderation, suspensions. |
| 16. AI learning assistant | Partly | Help assistant in the student dashboard. With an AI key it answers general questions. | Course search and schedule answers on the public site. |
| 17. Portfolios and talent marketplace | Not started | — | Portfolios, admin approval, verified badges. |
| 18. Become an instructor | Done | Public application form, admin review with status and notes. | Payment and revenue-share agreement (done outside the system). |
| 19. Free webinars | Done | Public webinar list, free registration (students must be signed in), seat limits, join link for registered students, admin scheduling and registrant lists. | Automatic reminders. |
| 20. Monthly challenges | Not started | — | Submissions, judging, showcase. |
| 21. Reviews and referrals | Partly | Verified student reviews (enrolled students), admin approval, public ratings on course cards. Testimonials and review slideshow. | Referral codes and rewards (needs the reward policy). |
| 22. Feedback | Done | Public feedback and suggestions form, admin list with status and notes. | — |
| 23. Admin dashboard | Partly | Students, courses, payments, assignments, grading, services, our work, products, newsletter, announcements, settings, set-up, feedback, instructor applications, webinars, reviews, certificates. | Refunds and rescheduling, revenue reports, website analytics, bundles, digital products, booking and enquiry management. |
| 24. Security and payments | Partly | Role-based access checked on the server, secure logins, verified payments, backups, privacy, terms and refund policy pages. | Recording retention policy, digital file access controls, full audit log. |
| 25. Phase 1 (launch) | Partly | See rows 1 to 9 and 23 to 24. | Recordings, digital store, eBook delivery, refunds workflow. |
| 25. Phase 2 | Partly | Certificates, reviews, webinars, instructor applications done. | Bundles, communities, referrals, advanced reporting, AI assistant course search. |
| 25. Phase 3 | Not started | — | Talent marketplace, competitions, memberships. |
| 26. Revenue sources | Partly | Courses, shop, services and bookings can be sold. | eBook and digital product revenue, bundles, memberships. |

## Built in the latest update (with default rules)

Every item from the earlier list is now built. Where a business decision was needed, a default was set. Each default can be changed in **Admin > Business rules**.

| Item | What was built | Default rule (change in Business rules) |
|---|---|---|
| Live recordings and Attend Class | Recording link per class, shown only to enrolled students. Replays expire automatically. | Replay available 14 days after the whole course ends. Recordings are links you paste (for example an unlisted YouTube link). |
| Digital products store, eBooks, downloads, admin | Store page, Paystack purchase, controlled downloads, admin catalogue with sales count. | Each product can be downloaded 3 times, for 365 days. Files are linked (Google Drive or similar), not uploaded to the server. |
| Course bundles | Public bundle page, one-payment purchase that unlocks every course in it, admin builder. | Bundle price set by admin. The system refuses bundles whose courses clash in time. |
| Student community | Course discussions, replies, moderation (hide, delete), suspending students. | Only enrolled students can post. Suspended students cannot log in. |
| Talent marketplace | Student profiles, admin approval, public directory with a "DEBONE certified" badge. | Only students with a certificate can create a profile, and the team approves each one. |
| Referrals | Personal referral link, friend gets a discount, referrer earns credit. | Friend 10% off first course. Referrer earns ₦2,000 credit. Credit is applied manually by the team. |
| Monthly challenges | Challenges with a closing date, student entries, winner and showcase selection. | One entry per student. The team picks the winner. |
| Studio quotes and deposits | Booking request, quotation with deposit, client accepts online and pays the deposit. | Deposit is 50% of the quotation. |
| Minimum-enrolment workflow | Students are told 7 days before a course that is short of students. They choose a new date or a refund. | Notice 7 days before the start. New dates are set by the team and students are notified. |
| Refunds | Students request refunds, the team approves, Paystack refunds are sent automatically when the live key is set. | Within 7 days of payment, and only before the course starts or before a product is downloaded. |
| Revenue reports and analytics | Sales by month and item, net after refunds, CSV download, page views, sign-ups, top courses and products. | Page views count page loads only. No tracking cookies are used. |
| Resubmission | The team can ask a student to resubmit. The student can then send new work. | Allowed by default (can be switched off in Business rules). |
| Certificate PDF | Download button on the Certificates page. | Certificate rule: all lessons finished, every assignment at least 50%. Minimum is set in Business rules. |

## Still to confirm
- Paystack live key, so payments, deposits and automatic refunds run for real.
- Email provider key, so reset and notice emails are sent.
- Whether the default rules above are the ones you want.

## Recommended order from here
1. Add the Paystack and email keys, then make one real test purchase of each kind.
2. Confirm the default rules.
3. Phase 2 and 3 items as the business needs them.
