/* Motion layer (v15): page transitions, scroll reveals, card tilt, and the sign-up panel. */
(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.add('js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 1. Page transition veil */
  var veil = document.createElement('div');
  veil.className = 'page-veil cover instant';
  document.body.appendChild(veil);
  if (!reduce) {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { veil.classList.remove('instant'); veil.classList.remove('cover'); veil.classList.add('out'); });
    });
  } else { veil.remove(); }

  document.addEventListener('click', function (e) {
    if (reduce || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#') return;
    var url;
    try { url = new URL(a.href); } catch (err) { return; }
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.hash) return;
    e.preventDefault();
    veil.classList.remove('out', 'from-top', 'instant');
    veil.classList.add('cover');
    setTimeout(function () { location.href = a.href; }, 620);
  });
  window.addEventListener('pageshow', function (ev) {
    if (ev.persisted) { veil.className = 'page-veil out'; }
  });

  /* 2. Scroll reveals for cards, grids and sections (including content added later) */
  var SEL = '.dcourse, .prod, .tst-card, .card, .step, .svc-card, .kpi, .panel, .ft-col, .rvs-summary, .stat, .feature-img, .session-card, .assign, .news li, .lesson-btn, .stat-card, .box, [data-reveal]';
  if (!reduce && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    var track = function (el) {
      if (el.__rv || el.closest('.side, .topbar, .rvs-stage, .ft-top, .site-footer, .auth-quote, #services, .services')) return;
      el.__rv = true;
      el.setAttribute('data-reveal', '');
      io.observe(el);
    };
    document.querySelectorAll(SEL).forEach(track);
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          if (n.nodeType !== 1) return;
          if (n.matches && n.matches(SEL)) track(n);
          if (n.querySelectorAll) n.querySelectorAll(SEL).forEach(track);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  } else {
    root.classList.remove('js');
  }

  /* 3. Gentle 3D tilt on cards for mouse users */
  if (!reduce && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var TILT = '.dcourse, .prod, .tst-card, .card, .svc-card, .kpi, .stat-card';
    var TILT_SKIP = '.services, #services';
    document.addEventListener('pointermove', function (e) {
      var c = e.target.closest && e.target.closest(TILT);
      if (!c || c.closest(TILT_SKIP)) return;
      var r = c.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      c.style.transform = 'perspective(1000px) rotateX(' + (-y * 4).toFixed(2) + 'deg) rotateY(' + (x * 5).toFixed(2) + 'deg) translateY(-4px)';
    });
    document.addEventListener('pointerout', function (e) {
      var c = e.target.closest && e.target.closest(TILT);
      if (c && !c.contains(e.relatedTarget)) c.style.transform = '';
    });
  }
})();

/* ===== Dramatic motion (v16) ===== */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var desktop = window.matchMedia('(min-width: 901px)').matches;

  /* A. Word-by-word headline reveal for plain headings */
  var heads = document.querySelectorAll('main h1, main h2');
  heads.forEach(function (h) {
    if (h.closest('.services, #services')) return;
    if (h.children.length || h.closest('.hero, .auth-quote, .rvs-stage, .tst-card, .dcourse, .view-head h1') && h.closest('.hero')) return;
    var words = h.textContent.trim().split(/\s+/);
    if (words.length < 2 || words.length > 14) return;
    h.setAttribute('aria-label', h.textContent.trim());
    h.innerHTML = words.map(function (w, i) {
      return '<span class="fx-w" aria-hidden="true"><span class="fx-i" style="--d:' + i + '">' + w.replace(/</g, '&lt;') + '</span></span>';
    }).join(' ');
    h.__fx = true;
  });
  var hio = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); hio.unobserve(en.target); } });
  }, { threshold: 0.3 }) : null;
  document.querySelectorAll('main h1[aria-label], main h2[aria-label]').forEach(function (h) {
    if (hio) hio.observe(h); else h.classList.add('in');
  });
  /* Hero headline words come in on load */
  var hero = document.querySelector('.hero h1');
  if (hero) setTimeout(function () { hero.classList.add('fx-ready'); }, 350);

  /* B. Section curtain reveal (desktop) */
  if (desktop && hio) {
    var sio = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); sio.unobserve(en.target); } });
    }, { threshold: 0.12 });
    document.querySelectorAll('main > section:not(.hero):not(.page-hero):not(.services)').forEach(function (s) {
      s.classList.add('sec-fx'); sio.observe(s);
    });
  }

  /* C. Parallax on framed photography (desktop) */
  if (desktop) {
    var pars = Array.prototype.slice.call(document.querySelectorAll('.svc-media img, .auth-panel img'));
    pars.forEach(function (el) { el.classList.add('fx-par'); });
    var ticking = false;
    function parallax() {
      var vh = window.innerHeight;
      pars.forEach(function (el) {
        var r = el.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        var off = ((r.top + r.height / 2) - vh / 2) / vh;
        el.style.setProperty('--py', (off * -28).toFixed(1) + 'px');
      });
      ticking = false;
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(parallax); } }, { passive: true });
    parallax();
  }

  if (!fine || !desktop || document.body.hasAttribute('data-shell')) return;

  /* D. Custom cursor */
  document.documentElement.classList.add('fx-cursor');
  var dot = document.createElement('div'); dot.className = 'fx-dot';
  var ring = document.createElement('div'); ring.className = 'fx-ring';
  document.body.appendChild(dot); document.body.appendChild(ring);
  var mx = 0, my = 0, rx = 0, ry = 0, shown = false;
  document.addEventListener('pointermove', function (e) {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
    if (!shown) { shown = true; document.documentElement.classList.add('fx-on'); }
  });
  document.addEventListener('pointerout', function (e) { if (!e.relatedTarget) document.documentElement.classList.remove('fx-on'); });
  (function loop() {
    rx += (mx - rx) * 0.2; ry += (my - ry) * 0.2;
    ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
    requestAnimationFrame(loop);
  })();
  document.addEventListener('pointerover', function (e) {
    var t = e.target.closest && e.target.closest('a, button, .btn, .prod, .tile, .dcourse');
    ring.classList.toggle('hot', !!t);
  });

  /* E. Magnetic buttons */
  document.querySelectorAll('.btn').forEach(function (b) { if (!b.closest('.site-footer')) b.classList.add('fx-mag'); });
  document.addEventListener('pointermove', function (e) {
    var b = e.target.closest && e.target.closest('.btn');
    document.querySelectorAll('.btn.fx-mag').forEach(function (x) {
      if (x !== b && x.style.transform) x.style.transform = '';
    });
    if (!b) return;
    var r = b.getBoundingClientRect();
    var x = Math.max(-12, Math.min(12, (e.clientX - r.left - r.width / 2) * 0.28));
    var y = Math.max(-12, Math.min(12, (e.clientY - r.top - r.height / 2) * 0.28));
    b.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
  });
  document.addEventListener('pointerleave', function () {
    document.querySelectorAll('.btn.fx-mag').forEach(function (x) { x.style.transform = ''; });
  }, true);
})();

/* ===== Newsletter sign-up (footer) ===== */
(function () {
  'use strict';
  document.querySelectorAll('form[data-newsletter]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = form.querySelector('input[type=email]');
      var msg = form.querySelector('.ft-news-msg');
      var btn = form.querySelector('button');
      var email = input.value.trim();
      msg.className = 'ft-news-msg';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = 'Please enter a valid email address.'; msg.classList.add('err'); return; }
      btn.disabled = true; btn.textContent = 'Subscribing…';
      fetch('/api/newsletter', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.d.error || 'Something went wrong. Please try again.');
          msg.textContent = res.d.message; msg.classList.add('ok'); form.reset();
        })
        .catch(function (err) { msg.textContent = err.message; msg.classList.add('err'); })
        .then(function () { btn.disabled = false; btn.textContent = 'Subscribe'; });
    });
  });
})();

/* Page sections fade in as they reach the screen (all pages except the homepage services) */
(function () {
  'use strict';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
  var secs = document.querySelectorAll('main > section.section');
  if (!secs.length) return;
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
  secs.forEach(function (s) {
    if (s.closest('.services, #services')) { s.classList.add('in'); return; }
    var r = s.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.95) s.classList.add('in'); else io.observe(s);
  });
  /* Safety net: no section stays hidden, whatever the browser does */
  setTimeout(function () { secs.forEach(function (s) { s.classList.add('in'); }); }, 4000);
})();
