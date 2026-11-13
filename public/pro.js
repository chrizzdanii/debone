/* DEBONE pro layer: animation + photo sections for store and academy pages. No dependencies. */
(function () {
  'use strict';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var POOL = (window.ACAD && ACAD.pool) || [
    'https://assets.mixkit.co/videos/50641/50641-thumb-720-0.jpg', 'https://assets.mixkit.co/videos/44071/44071-thumb-720-0.jpg',
    'https://assets.mixkit.co/videos/44076/44076-thumb-720-0.jpg', 'https://assets.mixkit.co/videos/50639/50639-thumb-720-0.jpg',
    'https://assets.mixkit.co/videos/44074/44074-thumb-720-0.jpg', 'https://assets.mixkit.co/videos/44069/44069-thumb-720-0.jpg',
    'https://assets.mixkit.co/videos/44073/44073-thumb-720-0.jpg', 'https://assets.mixkit.co/videos/50635/50635-thumb-720-0.jpg',
    'https://assets.mixkit.co/videos/44068/44068-thumb-720-0.jpg', 'https://assets.mixkit.co/videos/44075/44075-thumb-720-0.jpg'
  ];
  var page = (location.pathname.split('/').pop() || 'index').replace('.html', '') || 'index';
  var COPY = {
    store: { words: ['Guides', 'Templates', 'Presets', 'eBooks', 'Prompt packs', 'Instant download'], title: 'Made to <em>download</em>.', sub: 'Every file is made by working creators. Pay once, download straight away.', labels: ['Guides', 'Presets', 'Templates', 'Prompts', 'eBooks'] },
    products: { words: ['Cameras', 'Lenses', 'Lighting', 'Laptops', 'Printers', 'Accessories'], title: 'Gear we <em>trust</em>.', sub: 'Kit chosen and tested by a studio that has shot since 1997.', labels: ['Cameras', 'Lenses', 'Lights', 'Laptops', 'Printing'] },
    product: null,
    bundles: { words: ['Bundles', 'Save more', 'Learn faster', 'Full courses', 'Certificates'], title: 'Learn more, <em>pay less</em>.', sub: 'Bundle courses together and unlock everything in one payment.', labels: ['Video', 'AI', 'Editing', 'Automation', 'Projects'] },
    'digital-services': { words: ['Websites', 'Branding', 'Video edits', 'Social media', 'Automation'], title: 'Digital work, <em>delivered</em>.', sub: 'From logos to full sites, made by the DEBONE team.', labels: ['Design', 'Edit', 'Brand', 'Web', 'Social'] },
    talent: { words: ['Photographers', 'Editors', 'Designers', 'Creators', 'Graduates'], title: 'Meet the <em>talent</em>.', sub: 'People trained at DEBONE and ready for your next project.', labels: ['Photo', 'Film', 'Edit', 'Design', 'AI'] },
    academy: { words: ['AI video', 'Automation', 'Editing', 'Certificates', 'Live classes', 'Free intro'], title: 'See where <em>learning</em> happens.', sub: 'Real cameras, real projects and instructors who work in the industry every week.', labels: ['Live class', 'Editing suite', 'Studio floor', 'Camera lab', 'Projects', 'Feedback'] }
  };
  var cfg = COPY[page];

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function svg(p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
  var ICON = {
    bolt: svg('<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>'),
    shield: svg('<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8-7.5 9.5-4.3-1.5-7.5-4.9-7.5-9.5V6L12 3z"/><path d="M9 12l2 2 4-4"/>'),
    star: svg('<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>'),
    dl: svg('<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14"/>')
  };

  /* split a heading into animated words (keeps <em>) */
  function split(node) {
    if (!node || node.dataset.proSplit) return;
    node.dataset.proSplit = '1';
    var i = 0;
    (function walk(n) {
      Array.prototype.slice.call(n.childNodes).forEach(function (c) {
        if (c.nodeType === 3) {
          var frag = document.createDocumentFragment();
          c.textContent.split(/(\s+)/).forEach(function (t) {
            if (!t) return;
            if (/^\s+$/.test(t)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = el('span', 'pro-w'); var s = el('span'); s.textContent = t; s.style.setProperty('--wi', i++); w.appendChild(s); w.style.setProperty('--wi', i); frag.appendChild(w);
          });
          c.parentNode.replaceChild(frag, c);
        } else if (c.nodeType === 1) walk(c);
      });
    })(node);
    node.classList.add('pro-split');
  }

  function counter(node) {
    var to = parseFloat(node.dataset.to), suffix = node.dataset.suffix || '', t0 = null, dur = 1600;
    if (reduce) { node.textContent = to + suffix; return; }
    function step(t) { if (!t0) t0 = t; var p = Math.min((t - t0) / dur, 1), e = 1 - Math.pow(1 - p, 4); node.textContent = Math.round(to * e) + suffix; if (p < 1) requestAnimationFrame(step); }
    requestAnimationFrame(step);
  }

  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (en) {
    en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('pro-in'); x.target.querySelectorAll('[data-to]').forEach(counter); if (x.target.dataset.to) counter(x.target); io.unobserve(x.target); } });
  }, { threshold: .15, rootMargin: '0px 0px -6% 0px' }) : null;
  function reveal(node, i) { node.classList.add('pro-reveal'); node.style.setProperty('--pi', i || 0); if (io) io.observe(node); else node.classList.add('pro-in'); }

  function photoRow(rev, offset, labels) {
    var row = el('div', 'pro-row' + (rev ? ' rev' : ''));
    var html = '';
    for (var k = 0; k < 2; k++) for (var i = 0; i < 8; i++) {
      var n = (i + offset) % POOL.length;
      html += '<figure class="pro-ph"><img src="' + POOL[n] + '" alt="" loading="lazy" decoding="async" onerror="this.style.opacity=0"><b>' + labels[i % labels.length] + '</b></figure>';
    }
    row.innerHTML = html; return row;
  }

  function buildRibbon(words) {
    var r = el('div', 'pro-ribbon'); r.setAttribute('aria-hidden', 'true');
    var t = el('div', 'pro-ribbon-track'), h = '';
    for (var k = 0; k < 4; k++) words.forEach(function (w) { h += '<span>' + w + '</span>'; });
    t.innerHTML = h; r.appendChild(t); return r;
  }

  function buildShow(c) {
    var s = el('section', 'pro-show');
    s.appendChild(el('div', 'pro-show-head', '<h2>' + c.title + '</h2><p>' + c.sub + '</p>'));
    s.appendChild(photoRow(false, 0, c.labels)); s.appendChild(photoRow(true, 4, c.labels));
    var h = s.querySelector('h2'); reveal(s.querySelector('.pro-show-head'), 0); return s;
  }

  function buildStats(items) {
    var w = el('div', 'pro-stats');
    w.innerHTML = items.map(function (x) { return '<div class="pro-stat"><strong data-to="' + x[0] + '" data-suffix="' + (x[2] || '') + '">0</strong><span>' + x[1] + '</span></div>'; }).join('');
    reveal(w, 0); return w;
  }

  function heroFX() {
    var hero = document.querySelector('.sp-hero');
    if (hero) {
      var glow = el('span', 'pro-hero-glow'); glow.setAttribute('aria-hidden', 'true');
      var bg = hero.querySelector('.sp-bg'); (bg || hero).appendChild(glow);
      hero.addEventListener('pointermove', function (e) { var r = hero.getBoundingClientRect(); glow.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%'); glow.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%'); }, { passive: true });
      split(hero.querySelector('.sp-title'));
      var chips = el('div', 'pro-float-chips');
      chips.setAttribute('aria-hidden', 'true');
      chips.innerHTML = '<div class="pro-chip" style="--ci:0"><i>' + ICON.bolt + '</i>Instant access</div><div class="pro-chip" style="--ci:1"><i>' + ICON.shield + '</i>Secure payment</div><div class="pro-chip" style="--ci:2"><i>' + ICON.star + '</i>Since 1997</div>';
      hero.appendChild(chips);
    }
  }

  function studentCard() {
    var card = document.querySelector('.sc-card'); if (!card) return;
    split(card.querySelector('h2'));
    if (reduce) return;
    var inner = card;
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      card.style.transform = 'perspective(1000px) rotateY(' + (x * 7) + 'deg) rotateX(' + (-y * 7) + 'deg)';
      card.style.transition = 'transform .12s linear';
    });
    card.addEventListener('pointerleave', function () { card.style.transition = 'transform .8s cubic-bezier(.2,.8,.2,1)'; card.style.transform = ''; });
  }

  function tiltCards() {
    if (reduce) return;
    var sel = '.st-grid>*,.bd-list>*,.tl-grid>*,.course-grid>*,.pd-grid>*,.product-grid>*,.ds-grid>*';
    function arm(n) {
      if (n.dataset.proTilt || n.nodeType !== 1 || n.classList.contains('skeleton') || n.tagName === 'P') return;
      n.dataset.proTilt = '1'; n.classList.add('pro-tilt');
      n.addEventListener('pointermove', function (e) { var r = n.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; n.style.setProperty('--ry', ((x - .5) * 9) + 'deg'); n.style.setProperty('--rx', ((.5 - y) * 9) + 'deg'); n.style.setProperty('--gx', (x * 100) + '%'); n.style.setProperty('--gy', (y * 100) + '%'); }, { passive: true });
      n.addEventListener('pointerleave', function () { n.style.setProperty('--ry', '0deg'); n.style.setProperty('--rx', '0deg'); });
    }
    function scan(i) { document.querySelectorAll(sel).forEach(function (n, k) { arm(n); if (!n.dataset.proRv) { n.dataset.proRv = 1; reveal(n, (k % 6)); } }); }
    scan();
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    heroFX(); studentCard(); tiltCards();
    document.querySelectorAll('.page-hero h1').forEach(split);
    var hero = document.querySelector('.sp-hero') || document.querySelector('.page-hero');
    if (cfg && hero && !document.querySelector('.pro-show')) {
      var anchor = hero, n = anchor.nextElementSibling;
      var rib = buildRibbon(cfg.words), show = buildShow(cfg);
      anchor.parentNode.insertBefore(rib, anchor.nextSibling);
      rib.parentNode.insertBefore(show, rib.nextSibling);
      if (page === 'academy') show.parentNode.insertBefore(buildStats([[1997, 'Studio established', ''], [2012, 'Government approved', ''], [100, 'Hands-on projects', '%'], [24, 'Access to your lessons', '/7']]), show.nextSibling);
      if (page === 'store' || page === 'products') show.parentNode.insertBefore(buildStats([[1997, 'Serving creators since', ''], [27, 'Years of experience', '+'], [24, 'Hour support replies', 'h'], [100, 'Secure checkout', '%']]), show.nextSibling);
    }
    document.querySelectorAll('.section-title,.ag-title,.cta-band h2,.section-head').forEach(function (n, i) { reveal(n, 0); });
    document.querySelectorAll('.cta-band .container').forEach(function (n, i) { reveal(n, i % 4); });
    var bar = document.querySelector('.progress');
    if (bar && !bar.dataset.proBar) { /* existing progress bar kept */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
