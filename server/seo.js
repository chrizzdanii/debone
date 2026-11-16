'use strict';
/*
 * SEO helpers for DEBONE.
 *
 * Service and shop pages are edited in the admin panel, so their search tags are built from the live data
 * every time a page is requested: /services/<id> and /shop/<id>. The sitemap is built the same way,
 * so a service or product added in the admin appears in Google's list without any code change.
 */
const BIZ = {
  name: 'DEBONE Photos & Video Editing Studio',
  short: 'DEBONE',
  phone: '+2348035988889',
  phone2: '+2348139763301',
  street: '179 Old Refinery Road, Elelenwo',
  city: 'Port Harcourt',
  region: 'Rivers State',
  country: 'NG',
  founded: '1997',
  logo: '/assets/og-cover.jpg'
};

// Page titles written for what people type into Google. Anything not listed here falls back to "<title> in Port Harcourt".
const SERVICE_SEO = {
  photography: { title: 'Photographer in Port Harcourt: Weddings, Portraits & Events', lead: 'Photographer in Port Harcourt' },
  videography: { title: 'Videographer in Port Harcourt: Wedding & Event Video', lead: 'Videographer in Port Harcourt' },
  'music-videos': { title: 'Music Video Production in Port Harcourt', lead: 'Music video production in Port Harcourt' },
  drone: { title: 'Drone Photography & Videography in Port Harcourt', lead: 'Drone photography and video in Port Harcourt' },
  editing: { title: 'Video Editing & Photo Retouching in Port Harcourt', lead: 'Video editing and photo retouching in Port Harcourt' },
  printing: { title: 'Large Format & Photo Printing in Port Harcourt', lead: 'Printing in Port Harcourt' },
  repair: { title: 'Computer & Printer Repair in Port Harcourt', lead: 'Computer and printer repair in Port Harcourt' },
  training: { title: 'Video Editing & AI Training in Port Harcourt', lead: 'Video editing and AI training in Port Harcourt' },
  gear: { title: 'Cameras, Photography & Video Gear in Port Harcourt', lead: 'Camera and video gear in Port Harcourt' }
};

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ldJson = o => '<script type="application/ld+json">' + JSON.stringify(o).replace(/</g, '\\u003c') + '</script>';
const clip = (s, n) => {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  if (s.length <= n) return s;
  const cut = s.slice(0, n - 1);
  return cut.replace(/\s+\S*$/, '') + '…';
};
const abs = (base, u) => !u ? '' : /^https?:\/\//i.test(u) ? u : base + (u.startsWith('/') ? '' : '/') + u;

function parseDescription(text) {
  const paras = [], bullets = [];
  String(text || '').split(/\n+/).forEach(line => {
    const t = line.trim();
    if (!t) return;
    const m = t.match(/^[-•*]\s+(.*)$/);
    if (m) bullets.push(m[1]); else paras.push(t);
  });
  return { paras, bullets };
}

function businessLd(base) {
  return {
    '@type': ['LocalBusiness', 'Photographer'],
    '@id': base + '/#business',
    name: BIZ.name,
    alternateName: 'DEBONE Photos',
    url: base + '/',
    image: base + BIZ.logo,
    logo: base + BIZ.logo,
    telephone: BIZ.phone,
    foundingDate: BIZ.founded,
    address: { '@type': 'PostalAddress', streetAddress: BIZ.street, addressLocality: BIZ.city, addressRegion: BIZ.region, addressCountry: BIZ.country },
    areaServed: [{ '@type': 'City', name: 'Port Harcourt' }, { '@type': 'AdministrativeArea', name: 'Rivers State' }],
    openingHoursSpecification: [
      { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], opens: '07:00', closes: '20:00' },
      { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Sunday', opens: '14:00', closes: '19:00' }
    ]
  };
}

/* Replace or insert the tags search engines read. */
function setHead(html, { title, description, canonical, image, ldBlocks, robots }) {
  html = html.replace(/<title>[\s\S]*?<\/title>/i, '<title>' + esc(title) + '</title>');
  html = html.replace(/<meta\s+name="description"[^>]*>\s*/gi, '');
  html = html.replace(/<meta\s+(?:property="og:[^"]*"|name="twitter:[^"]*"|name="robots")[^>]*>\s*/gi, '');
  html = html.replace(/<link\s+rel="canonical"[^>]*>\s*/gi, '');
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/gi, '');
  const tags = [
    '<meta name="description" content="' + esc(description) + '">',
    '<link rel="canonical" href="' + esc(canonical) + '">',
    '<meta name="robots" content="' + (robots || 'index,follow,max-image-preview:large') + '">',
    '<meta property="og:site_name" content="' + esc(BIZ.name) + '">',
    '<meta property="og:type" content="website">',
    '<meta property="og:locale" content="en_NG">',
    '<meta property="og:title" content="' + esc(title) + '">',
    '<meta property="og:description" content="' + esc(description) + '">',
    '<meta property="og:url" content="' + esc(canonical) + '">',
    '<meta property="og:image" content="' + esc(image) + '">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + esc(title) + '">',
    '<meta name="twitter:description" content="' + esc(description) + '">',
    '<meta name="twitter:image" content="' + esc(image) + '">'
  ].concat(ldBlocks.map(ldJson)).join('\n');
  return html.replace('</head>', tags + '\n</head>');
}

/* Make a page that lives at /services/<id> load its files from the site root, and keep #skip links on the same page. */
function rootRelative(html, selfPath) {
  html = html.replace(/<head>/i, '<head>\n<base href="/">');
  return html.replace(/href="#([^"]*)"/g, (m, h) => 'href="' + selfPath + '#' + h + '"');
}
function injectId(html, id) {
  const tag = '<script>window.__SEO_ID=' + JSON.stringify(id).replace(/</g, '\\u003c') + ';</script>';
  return html.replace('</head>', tag + '\n</head>');
}

function renderService(tpl, sv, all, base) {
  const meta = SERVICE_SEO[sv.id] || { title: sv.title + ' in Port Harcourt', lead: sv.title + ' in Port Harcourt' };
  const title = meta.title + ' | DEBONE';
  const canonical = base + '/services/' + encodeURIComponent(sv.id);
  const d = parseDescription(sv.description);
  const lead = sv.summary || d.paras[0] || '';
  let description = clip(lead, 118);
  if (!/port harcourt/i.test(description)) description += ' DEBONE, Port Harcourt, since 1997.';
  description = clip(description, 158);
  const image = sv.image ? abs(base, sv.image) : base + BIZ.logo;
  const body = d.paras.filter(p => p !== lead);
  const article =
    '<div class="container"><article class="sv-ssr">' +
    '<p class="muted"><a href="services.html">All services</a></p>' +
    '<h1>' + esc(sv.title) + (/port harcourt/i.test(sv.title) ? '' : ' <span style="display:block;font-size:.45em">in Port Harcourt</span>') + '</h1>' +
    '<p class="lead">' + esc(lead) + '</p>' +
    body.map(p => '<p>' + esc(p) + '</p>').join('') +
    (d.bullets.length ? '<h2>What is included</h2><ul>' + d.bullets.map(b => '<li>' + esc(b) + '</li>').join('') + '</ul>' : '') +
    '</article></div>';
  let html = tpl.replace(/(<section class="sv-detail-wrap" id="sv-detail">)[\s\S]*?(<\/section>)/, (m, a, b) => a + article + b);
  const ld = [{
    '@context': 'https://schema.org',
    '@graph': [
      businessLd(base),
      {
        '@type': 'Service', '@id': canonical + '#service', name: sv.title, serviceType: meta.lead, description: clip(lead, 300),
        provider: { '@id': base + '/#business' }, areaServed: { '@type': 'City', name: 'Port Harcourt' }, url: canonical, image,
        availableChannel: { '@type': 'ServiceChannel', serviceUrl: 'https://wa.me/' + BIZ.phone.replace('+', '') }
      },
      {
        '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: base + '/' },
          { '@type': 'ListItem', position: 2, name: 'Services', item: base + '/services' },
          { '@type': 'ListItem', position: 3, name: sv.title, item: canonical }
        ]
      }
    ]
  }];
  html = setHead(html, { title, description, canonical, image, ldBlocks: ld });
  return injectId(rootRelative(html, '/services/' + sv.id), sv.id);
}

function renderProduct(tpl, p, cat, base) {
  const canonical = base + '/shop/' + encodeURIComponent(p.id);
  const name = String(p.name || '');
  const title = clip(name, 36) + ' | Buy in Port Harcourt | DEBONE';
  const d = parseDescription(p.description);
  let description = clip(p.summary || d.paras[0] || name, 112);
  description = clip(description + ' Order on WhatsApp from DEBONE, Port Harcourt.', 158);
  const image = p.image ? abs(base, p.image) : base + BIZ.logo;
  const priceNum = Number(p.price);
  const article =
    '<div style="grid-column:1/-1"><article class="pv-ssr">' +
    '<h1>' + esc(name) + '</h1><p class="lead">' + esc(p.summary || '') + '</p>' +
    d.paras.map(x => '<p>' + esc(x) + '</p>').join('') +
    (d.bullets.length ? '<ul>' + d.bullets.map(b => '<li>' + esc(b) + '</li>').join('') + '</ul>' : '') +
    '</article></div>';
  let html = tpl.replace(/(<div class="container product-layout" id="product">)[\s\S]*?(<\/div>\s*<\/section>)/, (m, a, b) => a + article + b);
  const product = {
    '@type': 'Product', '@id': canonical + '#product', name, description: clip(p.summary || d.paras[0] || name, 300), image: [image], url: canonical,
    category: cat ? cat.label : undefined, brand: { '@type': 'Brand', name: 'DEBONE' }, seller: { '@id': base + '/#business' }
  };
  // Only publish a price when the shop has set a real one. No price means customers confirm it on WhatsApp.
  if (priceNum > 0) product.offers = { '@type': 'Offer', priceCurrency: 'NGN', price: String(priceNum), url: canonical, seller: { '@id': base + '/#business' } };
  const crumbs = [{ n: 'Home', u: base + '/' }, { n: 'Shop', u: base + '/products' }];
  if (cat) crumbs.push({ n: cat.label, u: base + '/products' });
  crumbs.push({ n: name, u: canonical });
  const ld = [{
    '@context': 'https://schema.org',
    '@graph': [businessLd(base), product, { '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.n, item: c.u })) }]
  }];
  html = setHead(html, { title, description, canonical, image, ldBlocks: ld });
  return injectId(rootRelative(html, '/shop/' + p.id), p.id);
}

// Public pages that should be in Google. [path, priority, change frequency]
const STATIC_PAGES = [
  ['/', '1.0', 'weekly'], ['/services', '0.9', 'weekly'], ['/studio', '0.8', 'monthly'], ['/works', '0.8', 'weekly'],
  ['/book', '0.8', 'monthly'], ['/nin', '0.8', 'monthly'], ['/academy', '0.9', 'weekly'], ['/live-courses', '0.8', 'weekly'],
  ['/bundles', '0.7', 'weekly'], ['/webinars', '0.7', 'weekly'], ['/class-timetable', '0.7', 'weekly'], ['/products', '0.9', 'weekly'],
  ['/store', '0.6', 'weekly'], ['/digital-services', '0.8', 'monthly'], ['/about', '0.7', 'monthly'], ['/contact', '0.8', 'monthly'],
  ['/talent', '0.5', 'weekly'], ['/challenges', '0.5', 'weekly'], ['/instructor', '0.4', 'monthly'], ['/certificate', '0.4', 'monthly'],
  ['/privacy', '0.2', 'yearly'], ['/terms', '0.2', 'yearly'], ['/refund-policy', '0.2', 'yearly']
];

function sitemapXml(base, services, products) {
  const x = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const day = d => { try { return new Date(d).toISOString().slice(0, 10); } catch (e) { return ''; } };
  const rows = [];
  STATIC_PAGES.forEach(([p, pr, cf]) => rows.push('  <url><loc>' + x(base + (p === '/' ? '/' : p)) + '</loc><changefreq>' + cf + '</changefreq><priority>' + pr + '</priority></url>'));
  services.forEach(sv => rows.push('  <url><loc>' + x(base + '/services/' + encodeURIComponent(sv.id)) + '</loc>' + (sv.updatedAt ? '<lastmod>' + day(sv.updatedAt) + '</lastmod>' : '') + '<changefreq>monthly</changefreq><priority>0.8</priority></url>'));
  products.forEach(p => {
    const img = p.image ? '<image:image><image:loc>' + x(abs(base, p.image)) + '</image:loc><image:title>' + x(p.name) + '</image:title></image:image>' : '';
    rows.push('  <url><loc>' + x(base + '/shop/' + encodeURIComponent(p.id)) + '</loc>' + (p.updatedAt ? '<lastmod>' + day(p.updatedAt) + '</lastmod>' : '') + '<changefreq>weekly</changefreq><priority>0.7</priority>' + img + '</url>');
  });
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' + rows.join('\n') + '\n</urlset>\n';
}

function robotsTxt(base) {
  return 'User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /dashboard\nDisallow: /admin\n\nSitemap: ' + base + '/sitemap.xml\n';
}

module.exports = { setHead, BIZ, esc, clip, ldJson, businessLd, renderService, renderProduct, sitemapXml, robotsTxt, STATIC_PAGES };
