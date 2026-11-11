/* Services: homepage cards, the full Services page, and each service page (v27). Content comes from the database. */
(function () {
  'use strict';
  var mode = document.body.getAttribute('data-page');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function arrow() { return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'; }

  /* Homepage: the first six services with a "See more" button */
  function home(list) {
    var box = document.getElementById('home-services');
    if (!box) return;
    box.innerHTML = list.slice(0, 6).map(function (s) {
      return '<article class="card"><a class="card-link" href="service.html?id=' + encodeURIComponent(s.id) + '" aria-label="' + esc(s.title) + '">' +
        '<div class="card-media">' + (s.image ? '<img src="' + esc(s.image) + '" alt="' + esc(s.title) + '" loading="lazy">' : '') + '</div>' +
        '<h3>' + esc(s.title) + '</h3><p>' + esc(s.summary) + '</p><span class="card-go">Read more ' + arrow() + '</span></a></article>';
    }).join('');
    var more = document.getElementById('home-more');
    if (!more && list.length > 0) {
      box.insertAdjacentHTML('afterend', '<div class="more-row" id="home-more"><a class="btn btn-solid" href="services.html">See more of our services ' + arrow() + '</a></div>');
    }
  }

  /* Services page: numbered rows, alternating sides */
  function listPage(list) {
    var box = document.getElementById('sv-list');
    if (!box) return;
    box.innerHTML = list.map(function (s, i) {
      return '<article class="sv-row' + (i % 2 ? ' flip' : '') + '" data-reveal>' +
        '<a class="sv-img" href="service.html?id=' + encodeURIComponent(s.id) + '" aria-label="' + esc(s.title) + '">' +
          (s.image ? '<img src="' + esc(s.image) + '" alt="' + esc(s.title) + '" loading="lazy">' : '<span class="sv-noimg">' + esc(s.title) + '</span>') +
        '</a>' +
        '<div class="sv-copy"><span class="sv-num" aria-hidden="true">' + pad(s.number) + '</span>' +
          '<h2>' + esc(s.title) + '</h2><p>' + esc(s.summary) + '</p>' +
          '<a class="sv-link" href="service.html?id=' + encodeURIComponent(s.id) + '">View this service ' + arrow() + '</a></div>' +
      '</article>';
    }).join('') || '<div class="empty-state">Our services will appear here soon.</div>';
    var count = document.getElementById('sv-count');
    if (count) count.textContent = list.length;
    if (!reduce && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { threshold: 0.15 });
      box.querySelectorAll('.sv-row').forEach(function (r) { io.observe(r); });
    } else {
      box.querySelectorAll('.sv-row').forEach(function (r) { r.classList.add('in'); });
    }
  }

  /* One service: a full-width showcase page with prev / next and related services */
  function check() { return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'; }
  function back() { return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>'; }
  function parseDescription(text) {
    /* Lines starting with - or • become bullet points, everything else is a paragraph */
    var paras = [], bullets = [];
    String(text || '').split(/\n+/).forEach(function (line) {
      var t = line.trim();
      if (!t) return;
      var m = t.match(/^[-•*]\s+(.*)$/);
      if (m) bullets.push(m[1]); else paras.push(t);
    });
    return { paras: paras, bullets: bullets };
  }

  function detail(list) {
    var id = new URLSearchParams(location.search).get('id');
    var box = document.getElementById('sv-detail');
    var idx = list.findIndex(function (x) { return x.id === id; });
    var s = list[idx];
    var more = document.querySelector('.sv-more'), after = document.getElementById('sv-after');
    if (!s) {
      box.innerHTML = '<div class="container"><div class="sv-missing"><h1>We could not find that service</h1><p class="muted">It may have been renamed or removed. Browse all our services instead.</p><a class="btn btn-solid" href="services.html">All services ' + arrow() + '</a></div></div>';
      if (more) more.style.display = 'none';
      if (after) after.style.display = 'none';
      return;
    }
    if (more) more.style.display = '';
    if (after) after.style.display = '';
    document.title = s.title + ' | DEBONE Photos & Video Editing Studio';
    var d = parseDescription(s.description);
    var lead = s.summary || d.paras.shift() || '';
    var body = d.paras.filter(function (p) { return p !== lead; });
    var longest = s.title.split(/\s+/).reduce(function (m, w) { return Math.max(m, w.length); }, 0);
    var scale = longest > 14 ? 0.62 : longest > 11 ? 0.74 : longest > 9 ? 0.86 : 1;
    var words = s.title.split(/\s+/).map(function (w, i) { return '<span class="svd-w"><span style="--i:' + i + '">' + esc(w) + '</span></span>'; }).join(' ');
    var msg = encodeURIComponent('Hello DEBONE, I would like to know more about ' + s.title);
    box.innerHTML =
      '<div class="svd" id="svd">' +
        (s.image ? '<div class="svd-bg" style="background-image:url(\'' + esc(s.image).replace(/'/g, '%27') + '\')"></div>' : '') +
        '<div class="svd-glow"></div>' +
        '<span class="svd-bignum" aria-hidden="true">' + pad(idx + 1) + '</span>' +
        '<div class="container svd-grid">' +
          '<figure class="svd-media" id="svd-media">' +
            '<div class="svd-frame">' +
              (s.image ? '<img src="' + esc(s.image) + '" alt="" onerror="this.style.display=\'none\'">' : '<span class="svd-noimg">' + esc(s.title) + '</span>') +
              '<span class="svd-sheen"></span>' +
            '</div>' +
            '<i class="svd-corner c1"></i><i class="svd-corner c2"></i><i class="svd-corner c3"></i><i class="svd-corner c4"></i>' +
            '<figcaption class="svd-badge"><b>' + pad(idx + 1) + '</b><span>DEBONE<br>since 1997</span></figcaption>' +
            '<span class="svd-chip">Port Harcourt</span>' +
          '</figure>' +
          '<div class="svd-copy">' +
            '<a class="svd-back" href="services.html">' + back() + ' All services</a>' +
            '<p class="svd-eyebrow"><span>Service ' + pad(idx + 1) + '</span><i></i><span>of ' + pad(list.length) + '</span></p>' +
            '<h1 class="svd-title" style="--fs:' + scale + '">' + words + '</h1>' +
            '<p class="svd-lead">' + esc(lead) + '</p>' +
            '<span class="svd-rule"></span>' +
            body.map(function (p) { return '<p class="svd-body">' + esc(p) + '</p>'; }).join('') +
            (d.bullets.length ? '<p class="svd-label">What is included</p><ul class="svd-list">' + d.bullets.map(function (b, i) { return '<li style="--i:' + i + '"><span class="svd-tick">' + check() + '</span><span>' + esc(b) + '</span></li>'; }).join('') + '</ul>' : '') +
            '<div class="svd-actions">' +
              '<a class="btn btn-solid svd-cta" href="https://wa.me/2348035988889?text=' + msg + '" target="_blank" rel="noopener" data-setting-href="wa"><span>Ask about this service</span>' + arrow() + '</a>' +
              '<a class="btn btn-ghost" href="tel:+2348035988889" data-setting-href="phone1">Call the studio</a>' +
            '</div>' +
            '<ul class="svd-facts"><li><b>1997</b><span>Serving Port Harcourt</span></li><li><b>Fast</b><span>Replies on WhatsApp</span></li><li><b>Clear</b><span>Price before we start</span></li></ul>' +
          '</div>' +
        '</div>' +
      '</div>';

    /* Previous / next service */
    var nav = document.getElementById('sv-nav');
    if (nav) {
      var prev = list[(idx - 1 + list.length) % list.length], next = list[(idx + 1) % list.length];
      nav.innerHTML = list.length < 2 ? '' :
        '<a class="svn svn-prev" href="service.html?id=' + encodeURIComponent(prev.id) + '"><span class="svn-dir">' + back() + ' Previous</span><b>' + esc(prev.title) + '</b></a>' +
        '<a class="svn svn-next" href="service.html?id=' + encodeURIComponent(next.id) + '"><span class="svn-dir">Next ' + arrow() + '</span><b>' + esc(next.title) + '</b></a>';
    }

    var rel = list.filter(function (x) { return x.id !== s.id; }).slice(0, 3);
    var rbox = document.getElementById('sv-related');
    if (rbox) rbox.innerHTML = rel.map(function (x) {
      return '<a class="sv-mini" data-reveal href="service.html?id=' + encodeURIComponent(x.id) + '"><span class="sv-mini-img">' + (x.image ? '<img src="' + esc(x.image) + '" alt="" loading="lazy">' : '') + '</span><b>' + esc(x.title) + '</b><span class="sv-mini-go">' + arrow() + '</span></a>';
    }).join('');

    reveal(document.querySelectorAll('[data-reveal]'));
    effects();
  }

  /* Scroll reveals */
  function reveal(nodes) {
    if (reduce || !('IntersectionObserver' in window)) { nodes.forEach(function (n) { n.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    nodes.forEach(function (n) { io.observe(n); });
  }

  /* Pointer tilt on the photo and a gentle scroll parallax */
  var fxBound = false;
  function effects() {
    var media = document.getElementById('svd-media'), root = document.getElementById('svd');
    if (!media || reduce) return;
    var frame = media.querySelector('.svd-frame'), bg = root.querySelector('.svd-bg'), num = root.querySelector('.svd-bignum');
    if (window.matchMedia('(hover:hover)').matches) {
      media.addEventListener('mousemove', function (e) {
        var r = media.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        frame.style.transform = 'perspective(900px) rotateY(' + (x * 9).toFixed(2) + 'deg) rotateX(' + (-y * 9).toFixed(2) + 'deg) scale(1.02)';
        frame.style.setProperty('--sx', (x * 100 + 50).toFixed(0) + '%');
      });
      media.addEventListener('mouseleave', function () { frame.style.transform = ''; });
    }
    if (fxBound) return;
    fxBound = true;
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () {
        var y = Math.min(window.scrollY, 900);
        var b = document.querySelector('.svd-bg'), n = document.querySelector('.svd-bignum');
        if (b) b.style.transform = 'translate3d(0,' + (y * 0.18).toFixed(1) + 'px,0) scale(1.15)';
        if (n) n.style.transform = 'translate3d(0,' + (y * -0.22).toFixed(1) + 'px,0)';
        ticking = false;
      });
    }, { passive: true });
  }

  function jumpToHash() {
    var h = location.hash ? location.hash.slice(1) : '';
    if (!h) return;
    var el = document.getElementById(h);
    if (el) setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 250);
  }
  function load() {
    fetch('/api/services').then(function (r) { return r.json(); }).then(function (d) {
      var list = d.services || [];
      var sg = JSON.stringify(list); if (sg === load.sig) return; load.sig = sg;
      if (mode === 'home') home(list);
      else if (mode === 'services') { listPage(list); jumpToHash(); }
      else if (mode === 'service') detail(list);
    }).catch(function () {
      var m = document.getElementById('sv-list') || document.getElementById('home-services') || document.getElementById('sv-detail');
      if (m) m.innerHTML = '<div class="empty-state">Our services could not load right now. Please refresh the page.</div>';
    });
  }
  load();
  window.addEventListener('debone:refresh', load);
})();
