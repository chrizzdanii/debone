'use strict';
/*
 * Applies search tags to every static page in public/.
 *   node tools/seo-apply.js
 * Safe to run again: it replaces its own tags each time.
 * If your website address is not https://debone.com.ng, run:  SITE_URL=https://your-domain node tools/seo-apply.js
 */
const fs = require('fs');
const path = require('path');
const seo = require('../server/seo.js');

const SITE = (process.env.SITE_URL || 'https://debone.com.ng').replace(/\/$/, '');
const PUB = path.join(__dirname, '..', 'public');
const OG = SITE + '/assets/og-cover.jpg';

const FAQ = {
  home: [
    ['Where is DEBONE located?', 'DEBONE Photos & Video Editing Studio is at 179 Old Refinery Road, Elelenwo, Port Harcourt, Rivers State.'],
    ['What are your opening hours?', 'We are open Monday to Saturday from 7:00 am to 8:00 pm, and on Sunday from 2:00 pm to 7:00 pm.'],
    ['What services does DEBONE offer?', 'Photography, videography, music videos, drone coverage, editing and retouching, printing, computer and printer repair, NIN and ID services, cybercafe services, and training in video editing and AI. We also sell cameras, printers, laptops and creator gear.'],
    ['How do I book a shoot or get a price?', 'Message us on WhatsApp on 0803 598 8889 or use the Book a shoot page. We reply with availability and a quotation before any work starts.'],
    ['How long has DEBONE been in business?', 'DEBONE was established in 1997 and has been government approved since 2012. We have served over 50,000 clients and trained over 1,400 students.']
  ],
  services: [
    ['Which photography and video services do you offer in Port Harcourt?', 'Weddings, portraits, events and product shoots, event and wedding films, music videos, and drone and aerial coverage, plus editing and retouching of your own footage and photos.'],
    ['How does pricing work?', 'Tell us what you need on WhatsApp. We agree the plan, timing and price with you before we start, so there are no surprises.'],
    ['Do you cover events outside Port Harcourt?', 'We also cover events abroad. Message us the date and location and we will confirm availability.']
  ],
  academy: [
    ['Is there a free class?', 'Yes. You can start with a free introduction to AI, then unlock full courses in AI video creation and AI automation.'],
    ['How do the classes work?', 'Classes are instructor-led and live, with fixed start dates. You can ask questions as you go, watch the recording if you miss a class, and submit assignments for marks.'],
    ['Do I get a certificate?', 'Eligible students receive a certificate once our team approves their completion. Anyone can check a certificate on our Verify a certificate page.']
  ],
  nin: [
    ['Which NIN services can DEBONE help with?', 'NIN enrollment, validation, modification and search support, plus bulk ID work for schools and companies and general cybercafe services. Message us on WhatsApp to confirm what you need and which documents to bring.'],
    ['Are NIN rules and fees fixed?', 'No. NIMC has said the NIN slip is the authorised means of identification and that data modification goes through its official self-service portal. Rules and fees change, so confirm with us or NIMC before you pay.']
  ],
  products: [
    ['How do I buy from the DEBONE shop?', 'Choose your items, then message us on WhatsApp. We confirm today\u2019s price and stock and arrange payment with you.'],
    ['Where is the shop?', 'DEBONE is at 179 Old Refinery Road, Elelenwo, Port Harcourt. We are open Monday to Saturday 7:00 am to 8:00 pm and Sunday 2:00 pm to 7:00 pm.']
  ],
  book: [
    ['How does booking a photographer or videographer work?', 'Tell us what you need. We reply with a quotation, and you accept it and pay a deposit to confirm the date.']
  ]
};

// path, title, description, new H1 text (null keeps the current one), page type, FAQ key
const INDEXED = {
  'index.html': ['/', 'DEBONE Photos & Video Studio | Port Harcourt Since 1997', 'Photographer, videographer and drone studio in Port Harcourt. Also video editing and AI training, printing, NIN and ID services, and camera and laptop sales. Since 1997.', null, 'WebPage', 'home'],
  'services.html': ['/services', 'Photography, Video & Printing Services in Port Harcourt | DEBONE', 'Wedding and event photography, video, music videos, drone, editing, printing and computer repair in Port Harcourt. Message DEBONE on WhatsApp for a price.', 'Photography, video and print services in Port Harcourt.', 'CollectionPage', 'services'],
  'studio.html': ['/studio', 'Photo & Video Studio in Port Harcourt | DEBONE Studio', 'DEBONE Studio in Elelenwo, Port Harcourt: portraits, weddings, events, music videos and drone, shot and edited by one team. Book a shoot today.', 'The DEBONE photo and video studio in Port Harcourt.', 'WebPage'],
  'works.html': ['/works', 'Photography & Video Portfolio, Port Harcourt | DEBONE Work', 'See recent photography, video, drone and editing projects by DEBONE, a Port Harcourt studio shooting since 1997.', 'Photography and video work from Port Harcourt.', 'CollectionPage'],
  'book.html': ['/book', 'Book a Photographer or Videographer in Port Harcourt | DEBONE', 'Request a quotation for photography, video, drone or editing in Port Harcourt. We reply with availability and a price, and a deposit confirms your date.', 'Book a photographer or videographer in Port Harcourt.', 'WebPage', 'book'],
  'nin.html': ['/nin', 'NIN Enrollment Help, ID Services & Cybercafe | Port Harcourt', 'NIN enrollment, validation, modification help and search, plus ID work for schools and companies and cybercafe services in Port Harcourt.', 'NIN help, ID services and cybercafe in Port Harcourt.', 'WebPage', 'nin'],
  'academy.html': ['/academy', 'Video Editing & AI Courses in Port Harcourt | DEBONE Academy', 'Learn video editing, AI video creation and AI automation with live classes, recordings and certificates. Start with a free AI introduction.', 'Learn video editing and AI that makes real work faster.', 'WebPage', 'academy'],
  'live-courses.html': ['/live-courses', 'Live Video Editing & AI Courses with Certificates | DEBONE', 'Instructor-led live courses with fixed start dates. Join live, ask questions, watch recordings and earn a DEBONE Academy certificate.', 'Live courses in video editing and AI.', 'CollectionPage'],
  'bundles.html': ['/bundles', 'Video Editing & AI Course Bundles | Save More | DEBONE Academy', 'Study related DEBONE Academy courses together and save. Each course keeps its own live timetable.', 'Video editing and AI course bundles.', 'CollectionPage'],
  'webinars.html': ['/webinars', 'Free Video Editing & AI Webinars in Nigeria | DEBONE Academy', 'Short free live classes that show how DEBONE teaches video editing and AI before you pay for a full course.', 'Free video editing and AI webinars.', 'CollectionPage'],
  'class-timetable.html': ['/class-timetable', 'Class Timetable & Start Dates | DEBONE Academy Port Harcourt', 'See which days and times each DEBONE Academy course meets and when the next classes start.', 'Class timetable and start dates.', 'WebPage'],
  'challenges.html': ['/challenges', 'Monthly Challenges for Photographers & Video Editors | DEBONE', 'Enter a monthly creative challenge, submit your best work and get showcased by DEBONE. Winners are announced on the page.', 'Monthly challenges for photographers and video editors.', 'WebPage'],
  'talent.html': ['/talent', 'Hire Trained Video Editors & Photographers | DEBONE Talent', 'Creators trained at DEBONE Digital Academy, checked by our team and available for work.', 'Hire trained video editors and photographers.', 'CollectionPage'],
  'instructor.html': ['/instructor', 'Become an Instructor | Teach Video Editing & AI | DEBONE Academy', 'Qualified professionals can apply to teach with DEBONE Digital Academy. Every application is reviewed and terms are agreed in writing first.', 'Teach video editing and AI as a DEBONE instructor.', 'WebPage'],
  'certificate.html': ['/certificate', 'Verify a DEBONE Academy Certificate', 'Enter the verification code printed on a certificate to check that it was issued by DEBONE Digital Academy.', null, 'WebPage'],
  'digital-services.html': ['/digital-services', 'Website Design, AI Video & Graphic Design in Port Harcourt | DEBONE', 'Websites, AI video, graphic design and automation for businesses in Port Harcourt. Tell us what you need and we send a quotation.', 'Website design, AI video and graphic design in Port Harcourt.', 'WebPage'],
  'products.html': ['/products', 'Buy Laptops, Printers & Cameras in Port Harcourt | DEBONE Shop', 'Laptops, printers, cameras, lighting and computer accessories in Port Harcourt. Message DEBONE on WhatsApp for today\u2019s price and stock.', 'Laptops, printers and camera gear in Port Harcourt.', 'CollectionPage', 'products'],
  'store.html': ['/store', 'eBooks, Templates & Presets for Creators | DEBONE Digital Store', 'Guides, prompt packs, templates and presets for photographers and video editors, downloadable straight after payment.', 'Digital products for photographers and video editors.', 'CollectionPage'],
  'about.html': ['/about', 'About DEBONE | Port Harcourt Photo & Video Studio Since 1997', 'DEBONE has served over 50,000 clients and trained over 1,400 students from Port Harcourt. Established 1997, government approved since 2012.', 'About DEBONE, a Port Harcourt photo and video studio.', 'AboutPage'],
  'contact.html': ['/contact', 'Contact DEBONE | Address, Phone & WhatsApp, Port Harcourt', 'Visit DEBONE at 179 Old Refinery Road, Elelenwo, Port Harcourt. Call 0803 598 8889 or chat on WhatsApp. Open Mon to Sat 7am to 8pm, Sun 2pm to 7pm.', 'Contact DEBONE in Port Harcourt.', 'ContactPage'],
  'privacy.html': ['/privacy', 'Privacy Policy | DEBONE Photos & Video Editing Studio', 'How DEBONE collects, uses and protects your personal information.', null, 'WebPage'],
  'terms.html': ['/terms', 'Terms of Use | DEBONE Photos & Video Editing Studio', 'The terms that apply to DEBONE\u2019s website, academy, shop and services.', null, 'WebPage'],
  'refund-policy.html': ['/refund-policy', 'Refund Policy | DEBONE Photos & Video Editing Studio', 'How refunds work for DEBONE academy courses, shop orders and services.', null, 'WebPage']
};
// Pages for customers who are logged in, paying, resetting a password and so on. Google should not list them.
const NOINDEX = ['feedback.html', 'login.html', 'signup.html', 'forgot-password.html', 'reset-password.html', 'pay.html', 'quote.html',
  'staff-login.html', 'service.html', 'product.html', '401.html', '403.html', '404.html', '500.html', '503.html', 'offline.html'];

const NAMES = { '/services': 'Services', '/studio': 'Studio', '/works': 'Our work', '/book': 'Book a shoot', '/nin': 'NIN & ID services', '/academy': 'Academy', '/live-courses': 'Live courses', '/bundles': 'Course bundles', '/webinars': 'Free webinars', '/class-timetable': 'Class timetable', '/challenges': 'Monthly challenges', '/talent': 'Talent directory', '/instructor': 'Become an instructor', '/certificate': 'Verify a certificate', '/digital-services': 'Digital services', '/products': 'Shop', '/store': 'Digital store', '/about': 'About', '/contact': 'Contact', '/privacy': 'Privacy policy', '/terms': 'Terms of use', '/refund-policy': 'Refund policy' };

const read = f => fs.readFileSync(path.join(PUB, f), 'utf8');
const write = (f, s) => fs.writeFileSync(path.join(PUB, f), s);

function faqSection(items) {
  return '<!--seo-faq-->\n<section class="section seo-faq" aria-labelledby="faq-h"><div class="container"><p class="eyebrow">FAQ</p><h2 class="section-title" id="faq-h">Questions people ask us</h2><div class="seo-faq-list">' +
    items.map(([q, a]) => '<details><summary>' + seo.esc(q) + '</summary><p>' + seo.esc(a) + '</p></details>').join('') +
    '</div></div></section>\n<!--/seo-faq-->';
}

let done = 0;
for (const [file, [p, title, desc, h1, type, faqKey]] of Object.entries(INDEXED)) {
  let html = read(file);
  const url = SITE + (p === '/' ? '/' : p);
  // headline: put the words people search for in the page's H1
  if (h1) html = html.replace(/(<h1\b[^>]*>)[\s\S]*?(<\/h1>)/, (m, a, b) => a + seo.esc(h1) + b);
  // FAQ block (real answers, also marked up for Google)
  html = html.replace(/<!--seo-faq-->[\s\S]*?<!--\/seo-faq-->\s*/g, '');
  html = html.replace(/<link rel="stylesheet" href="seo\.css[^>]*>\s*/g, '');
  const graph = [seo.businessLd(SITE)];
  if (p === '/') graph.push({ '@type': 'WebSite', '@id': SITE + '/#website', url: SITE + '/', name: seo.BIZ.name, publisher: { '@id': SITE + '/#business' }, inLanguage: 'en-NG' });
  graph.push({ '@type': type, '@id': url + '#webpage', url, name: title, description: desc, inLanguage: 'en-NG', isPartOf: { '@id': SITE + '/#website' }, about: { '@id': SITE + '/#business' } });
  if (p !== '/') graph.push({ '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' }, { '@type': 'ListItem', position: 2, name: NAMES[p] || title, item: url }] });
  let extraHead = '';
  if (faqKey) {
    const items = FAQ[faqKey];
    graph.push({ '@type': 'FAQPage', '@id': url + '#faq', mainEntity: items.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });
    const block = faqSection(items);
    const marker = html.match(/<section class="cta-band"/) ? '<section class="cta-band"' : html.match(/<footer/) ? '<footer' : '</main>';
    html = html.replace(marker, block + '\n' + marker);
    extraHead = '<link rel="stylesheet" href="seo.css?v=1">';
  }
  html = seo.setHead(html, { title, description: desc, canonical: url, image: OG, ldBlocks: [{ '@context': 'https://schema.org', '@graph': graph }] });
  html = html.replace('</head>', '<meta name="geo.region" content="NG-RI">\n<meta name="geo.placename" content="Port Harcourt">\n' + extraHead + '\n</head>');
  write(file, html);
  done++;
}

for (const file of NOINDEX) {
  let html = read(file);
  html = html.replace(/<meta\s+name="robots"[^>]*>\s*/gi, '');
  html = html.replace(/<link\s+rel="canonical"[^>]*>\s*/gi, '');
  // Error pages must not tell search engines to follow links to nowhere; other private pages can pass link value on.
  html = html.replace('</head>', '<meta name="robots" content="noindex,' + (/^\d{3}\.html$|offline/.test(file) ? 'nofollow' : 'follow') + '">\n</head>');
  write(file, html);
  done++;
}
console.log('SEO tags applied to ' + done + ' pages for ' + SITE);
