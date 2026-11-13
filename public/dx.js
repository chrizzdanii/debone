/* DEBONE Studio, About and Services pages: live content, animation, gallery and lightbox.
   No libraries needed. If anything here fails the page still reads fine (see dx.css). */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  /* ---------- 1. Content set in the admin (Page content) ---------- */
  function getJSON(url, ms) {
    return new Promise(function (resolve) {
      var done = false, t = setTimeout(function () { if (!done) { done = true; resolve(null); } }, ms || 4000);
      fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; })
        .then(function (d) { if (!done) { done = true; clearTimeout(t); resolve(d); } });
    });
  }
  var servicesPromise = null;
  function services() {
    if (!servicesPromise) servicesPromise = getJSON('/api/services', 5000).then(function (d) { return d && Array.isArray(d.services) ? d.services : null; });
    return servicesPromise;
  }
  function applyContent(content) {
    if (!content) return;
    Object.keys(content).forEach(function (key) {
      var c = content[key];
      if (!c) return;
      if (typeof c.text === 'string') $$('[data-pc="' + key + '"]').forEach(function (el) { el.textContent = c.text; });
      $$('[data-pc-img="' + key + '"]').forEach(function (img) {
        if (c.image) img.setAttribute('src', c.image);
        if (c.alt && img.getAttribute('alt') !== '') img.setAttribute('alt', c.alt);
      });
    });
  }
  /* If a replaced photo fails to load, go back to the original. If that fails too, show the dark frame. */
  function watchImages() {
    $$('img[data-pc-img]').forEach(function (img) { if (!img.dataset.def) img.dataset.def = img.getAttribute('src'); });
    function bad(img) {
      var frame = img.closest('.dx-frame');
      if (img.dataset.def && img.getAttribute('src') !== img.dataset.def) { img.setAttribute('src', img.dataset.def); return; }
      if (frame) frame.classList.add('dx-broken');
    }
    $$('.dx-frame img, .dx-hero-bg img, .dx-cta-bg img').forEach(function (img) {
      img.addEventListener('error', function () { bad(img); });
      if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) bad(img);
    });
  }

  /* ---------- 2. Words, numbers and years ---------- */
  function splitWords(el) {
    var txt = el.textContent.trim();
    if (!txt) return;
    el.setAttribute('aria-label', txt);
    el.innerHTML = txt.split(/\s+/).map(function (w, i) { return '<span class="dx-w" aria-hidden="true"><span class="dx-wi" style="--wi:' + i + '">' + esc(w) + '</span></span>'; }).join(' ');
  }
  function sinceYear() {
    var el = $('[data-pc="stat-since"]');
    var y = el ? parseInt(String(el.textContent).replace(/\D/g, ''), 10) : NaN;
    return y >= 1900 && y <= new Date().getFullYear() ? y : 1997;
  }
  function setYears() {
    var years = Math.max(1, new Date().getFullYear() - sinceYear());
    $$('[data-years]').forEach(function (el) { el.textContent = String(years); });
  }
  function parseNum(text) {
    var m = String(text).trim().match(/^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/);
    if (!m) return null;
    return { pre: m[1], num: parseFloat(m[2].replace(/,/g, '')), commas: m[2].indexOf(',') >= 0, suf: m[3] };
  }
  function fmtNum(n, p) { var v = Math.round(n); return p.pre + (p.commas ? v.toLocaleString('en-US') : String(v)) + p.suf; }
  function setupCounters() {
    var els = $$('.dx-num');
    if (!els.length) return;
    els.forEach(function (el) { el.__p = parseNum(el.textContent); });
    if (reduce || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        var el = e.target, p = el.__p;
        if (!p) return;
        var t0 = performance.now(), dur = 1800;
        (function tick(t) {
          var k = clamp((t - t0) / dur, 0, 1), eased = k === 1 ? 1 : 1 - Math.pow(2, -10 * k);
          el.textContent = fmtNum(p.num * eased, p);
          if (k < 1) requestAnimationFrame(tick);
        })(t0);
      });
    }, { threshold: 0.4 });
    els.forEach(function (el) { if (el.__p) { el.textContent = fmtNum(0, el.__p); io.observe(el); } });
  }

  /* ---------- 3. Reveal on scroll ---------- */
  function setupReveal() {
    $$('[data-dx-stagger]').forEach(function (g) {
      $$('[data-dx]', g).forEach(function (el, i) { if (el.parentElement === g) el.style.setProperty('--d', i); });
    });
    var targets = $$('[data-dx]');
    if (!('IntersectionObserver' in window) || reduce) { targets.forEach(function (el) { el.classList.add('dx-in'); }); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        (e.target.__dx || [e.target]).forEach(function (n) { n.classList.add('dx-in'); });
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    targets.forEach(function (el) {
      /* A fully clipped element can report "not visible", so mask reveals watch their parent instead */
      if (el.getAttribute('data-dx') === 'mask' && el.parentElement) { var host = el.parentElement; (host.__dx = host.__dx || []).push(el); io.observe(host); }
      else io.observe(el);
    });
  }

  /* ---------- 4. Scroll effects (parallax, mission words, timeline) ---------- */
  function setupScroll() {
    var pars = $$('[data-par]').map(function (el) { return { el: el, k: parseFloat(el.getAttribute('data-par')) || 0, clamp: false }; });
    $$('[data-par-img]').forEach(function (el) { pars.push({ el: el, k: -0.05, clamp: true, box: el.closest('.dx-frame') || el.parentElement }); });
    $$('.dx-cta-bg img').forEach(function (el) { pars.push({ el: el, k: -0.07, clamp: true, box: el.parentElement }); });
    var mission = $('#dx-mission'), words = [];
    if (mission) {
      var KEY = /^(remember\w*|beautiful\w*|skills?|unforgettable|creative\w*)$/i;
      var parts = mission.textContent.trim().split(/\s+/);
      mission.setAttribute('aria-label', parts.join(' '));
      mission.innerHTML = parts.map(function (w) { return '<span class="dx-mw' + (KEY.test(w.replace(/[^\w]/g, '')) ? ' key' : '') + '" aria-hidden="true">' + esc(w) + '</span>'; }).join(' ');
      words = $$('.dx-mw', mission);
      if (reduce) words.forEach(function (w) { w.classList.add('on'); });
    }
    var tl = $('#dx-tl');
    var queued = false;
    function frame() {
      queued = false;
      var vh = window.innerHeight;
      if (!reduce) {
        pars.forEach(function (p) {
          var box = p.box || p.el, r = box.getBoundingClientRect();
          if (r.bottom < -200 || r.top > vh + 200) return;
          var off = (r.top + r.height / 2 - vh / 2) * p.k;
          if (p.clamp) { var lim = r.height * 0.09; off = clamp(off, -lim, lim); }
          p.el.style.setProperty('--py', off.toFixed(1) + 'px');
        });
        if (words.length) {
          var r = mission.getBoundingClientRect();
          var prog = clamp((vh * 0.82 - r.top) / (r.height + vh * 0.28), 0, 1);
          var upto = prog * words.length * 1.08;
          words.forEach(function (w, i) { w.classList.toggle('on', i < upto); });
        }
      }
      if (tl) {
        var tr = tl.getBoundingClientRect();
        var tp = clamp((vh * 0.62 - tr.top) / tr.height, 0, 1);
        tl.style.setProperty('--tl', reduce ? 1 : tp.toFixed(3));
      }
    }
    function schedule() { if (!queued) { queued = true; requestAnimationFrame(frame); } }
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    frame();
  }

  /* ---------- 5. Small pieces ---------- */
  function setupMarquee() {
    $$('.dx-marquee-track').forEach(function (track) {
      var items = $$('span', track);
      if (!items.length) return;
      var w = track.scrollWidth || 1, vw = window.innerWidth || 1200;
      var copies = Math.max(1, Math.ceil((vw * 1.15) / w));
      var set = '';
      for (var i = 0; i < copies; i++) set += track.innerHTML;
      track.innerHTML = set + set;
    });
  }
  function setupTimecode() {
    var els = $$('[data-tc]');
    if (!els.length || reduce) return;
    var t0 = performance.now(), live = true;
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { live = es[0].isIntersecting; }).observe(els[0].closest('.dx-hero') || els[0]);
    var last = 0;
    (function loop(t) {
      if (live && t - last > 40) {
        last = t;
        var s = (t - t0) / 1000, f = Math.floor((s % 1) * 25);
        var txt = '00:' + pad(Math.floor(s / 60) % 60) + ':' + pad(Math.floor(s) % 60) + ':' + pad(f);
        els.forEach(function (el) { el.textContent = txt; });
      }
      requestAnimationFrame(loop);
    })(t0);
  }
  function setupSpotlight() {
    if (!finePointer || reduce) return;
    var hero = $('.dx-hero');
    if (!hero) return;
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      hero.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      hero.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    });
  }
  function setupProcess() {
    var steps = $$('.dx-step');
    if (!steps.length) return;
    var imgs = $$('.dx-proc-frame img'), bar = $('[data-proc-bar]'), tc = $('[data-proc-tc]');
    function activate(i) {
      steps.forEach(function (s, n) { s.classList.toggle('on', n === i); });
      imgs.forEach(function (im, n) { im.classList.toggle('on', n === i); });
      if (bar) bar.style.transform = 'scaleX(' + ((i + 1) / steps.length).toFixed(3) + ')';
      if (tc) tc.textContent = 'REC 0' + (i + 1) + ' / 0' + steps.length;
    }
    steps.forEach(function (s, i) { s.addEventListener('click', function () { activate(i); }); });
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) activate(parseInt(e.target.getAttribute('data-i'), 10) || 0); });
    }, { rootMargin: '-42% 0px -48% 0px' });
    steps.forEach(function (s) { io.observe(s); });
  }

  /* ---------- 6. Studio disciplines from Services (admin) ---------- */
  function setupServiceCards() {
    var cards = $$('[data-svc]'), counts = $$('[data-services-count]');
    if (!cards.length && !counts.length) return;
    services().then(function (list) {
      if (!list) return;
      counts.forEach(function (el) { el.textContent = String(list.length); el.__p = parseNum(el.textContent); });
      cards.forEach(function (card) {
        var s = list.find(function (x) { return x.id === card.getAttribute('data-svc'); });
        if (!s) { card.hidden = true; return; }
        var img = $('[data-svc-img]', card), sum = $('[data-svc-sum]', card);
        if (img && s.image) img.setAttribute('src', s.image);
        if (sum && s.summary) sum.textContent = s.summary;
      });
    });
  }

  /* ---------- 7. Work gallery + lightbox ---------- */
  function setupWork() {
    var track = $('#dx-track');
    if (!track) return;
    var chips = $('#dx-filters'), barEl = $('#dx-track-bar');
    var filter = 'all';
    function cards() { return $$('.dx-work-card', track); }
    function visible() { return cards().filter(function (c) { return !c.hidden; }); }
    function updateBar() {
      var max = track.scrollWidth - track.clientWidth;
      var vis = track.clientWidth / Math.max(track.scrollWidth, 1);
      if (barEl) barEl.style.transform = 'scaleX(' + clamp(max > 0 ? vis + (1 - vis) * (track.scrollLeft / max) : 1, 0.05, 1).toFixed(3) + ')';
    }
    function drawChips() {
      if (!chips) return;
      var cats = [];
      cards().forEach(function (c) { var k = c.getAttribute('data-cat'); if (k && cats.indexOf(k) < 0) cats.push(k); });
      if (cats.length < 2) { chips.innerHTML = ''; return; }
      chips.innerHTML = ['all'].concat(cats).map(function (k) {
        return '<button type="button" class="dx-chip' + (k === filter ? ' on' : '') + '" data-f="' + esc(k) + '" aria-pressed="' + (k === filter) + '">' + (k === 'all' ? 'All' : esc(k.replace(/-/g, ' '))) + '</button>';
      }).join('');
    }
    function apply() {
      cards().forEach(function (c) { c.hidden = !(filter === 'all' || c.getAttribute('data-cat') === filter); });
      track.scrollTo({ left: 0, behavior: reduce ? 'auto' : 'smooth' });
      updateBar();
    }
    if (chips) chips.addEventListener('click', function (e) {
      var b = e.target.closest('[data-f]');
      if (!b) return;
      filter = b.getAttribute('data-f');
      $$('.dx-chip', chips).forEach(function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
      apply();
    });
    $$('.dx-arrow').forEach(function (b) {
      b.addEventListener('click', function () {
        var c = $('.dx-work-card:not([hidden])', track), step = (c ? c.getBoundingClientRect().width + 16 : 320) * 1.5;
        track.scrollBy({ left: step * parseInt(b.getAttribute('data-dir'), 10), behavior: reduce ? 'auto' : 'smooth' });
      });
    });
    track.addEventListener('scroll', updateBar, { passive: true });
    window.addEventListener('resize', updateBar);
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { track.scrollBy({ left: 320, behavior: 'smooth' }); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { track.scrollBy({ left: -320, behavior: 'smooth' }); e.preventDefault(); }
    });
    /* Drag to scroll with a mouse */
    var down = false, sx = 0, sl = 0, moved = false;
    track.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse' || e.button !== 0) return; down = true; moved = false; sx = e.clientX; sl = track.scrollLeft; });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - sx;
      if (Math.abs(dx) > 6) { moved = true; track.classList.add('drag'); }
      if (moved) track.scrollLeft = sl - dx;
    });
    window.addEventListener('pointerup', function () { if (down) { down = false; setTimeout(function () { track.classList.remove('drag'); }, 0); } });
    track.addEventListener('click', function (e) {
      if (moved) { moved = false; e.preventDefault(); e.stopPropagation(); return; }
      var card = e.target.closest('.dx-work-card');
      if (card) openLightbox(visible(), visible().indexOf(card), card);
    }, true);

    /* Lightbox */
    var lb = null, list = [], at = 0, lastFocus = null;
    function buildLb() {
      lb = doc.createElement('div');
      lb.className = 'dx-lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Photo viewer'); lb.setAttribute('data-lenis-prevent', '');
      lb.innerHTML = '<button type="button" class="lb-x" aria-label="Close">✕</button><button type="button" class="lb-p" aria-label="Previous photo">←</button><button type="button" class="lb-n" aria-label="Next photo">→</button><figure><img alt=""><figcaption><b></b><span></span></figcaption></figure>';
      doc.body.appendChild(lb);
      lb.addEventListener('click', function (e) { if (e.target === lb || e.target.closest('figure') === null && !e.target.closest('button')) close(); });
      $('.lb-x', lb).addEventListener('click', close);
      $('.lb-p', lb).addEventListener('click', function () { go(-1); });
      $('.lb-n', lb).addEventListener('click', function () { go(1); });
      var tx = 0;
      lb.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; }, { passive: true });
      lb.addEventListener('touchend', function (e) { var d = e.changedTouches[0].clientX - tx; if (Math.abs(d) > 50) go(d < 0 ? 1 : -1); });
    }
    function show() {
      var c = list[at]; if (!c) return;
      var im = $('img', c);
      var img = $('img', lb);
      img.src = c.getAttribute('data-full') || (im && im.src) || '';
      img.alt = im ? im.alt : '';
      $('figcaption b', lb).textContent = ($('.dx-wc-cap b', c) || {}).textContent || '';
      $('figcaption span', lb).textContent = (at + 1) + ' / ' + list.length;
    }
    function go(n) { if (!list.length) return; at = (at + n + list.length) % list.length; show(); }
    function onKey(e) {
      if (!lb || !lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Tab') {
        var f = $$('button', lb), first = f[0], last = f[f.length - 1];
        if (e.shiftKey && doc.activeElement === first) { last.focus(); e.preventDefault(); }
        else if (!e.shiftKey && doc.activeElement === last) { first.focus(); e.preventDefault(); }
      }
    }
    function openLightbox(l, i, from) {
      if (!l.length) return;
      if (!lb) { buildLb(); doc.addEventListener('keydown', onKey); }
      list = l; at = Math.max(0, i); lastFocus = from || doc.activeElement;
      show();
      lb.classList.add('open');
      root.style.overflow = 'hidden';
      $('.lb-x', lb).focus();
    }
    function close() {
      if (!lb) return;
      lb.classList.remove('open');
      root.style.overflow = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    /* Photos come from the admin ("Selected work"). If that fails, the photos already in the page stay. */
    getJSON('/api/works', 5000).then(function (d) {
      if (d && Array.isArray(d.works) && d.works.length) {
        track.innerHTML = d.works.map(function (w) {
          return '<button type="button" class="dx-work-card" data-cat="' + esc(w.category) + '" data-full="' + esc(w.image || '') + '"><div class="dx-frame"><img src="' + esc(w.image || '') + '" alt="' + esc(w.alt || w.title) + '" loading="lazy" decoding="async"></div><span class="dx-wc-cap"><b>' + esc(w.title) + '</b><em>' + esc(w.caption || w.category) + '</em></span></button>';
        }).join('');
        $$('.dx-frame img', track).forEach(function (img) { img.addEventListener('error', function () { var f = img.closest('.dx-frame'); if (f) f.classList.add('dx-broken'); }); });
      }
      drawChips(); updateBar();
    });
    drawChips(); updateBar();
  }

  /* ---------- 8. Services page: jump bar over the list ---------- */
  function setupJump() {
    var list = $('#sv-list'), nav = $('#dx-jump'), inner = $('#dx-jump-in');
    if (!list || !nav || !inner) return;
    function build() {
      var rows = $$('.sv-row', list);
      if (!rows.length) { nav.hidden = true; return; }
      var items = rows.map(function (row) {
        var a = $('.sv-link', row) || $('a', row);
        var id = ''; try { id = new URL(a.href, location.href).searchParams.get('id') || ''; } catch (e) { /* ignore */ }
        var title = ($('h2', row) || {}).textContent || id;
        row.id = 'svc-' + (id || title.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
        row.style.scrollMarginTop = '150px';
        return { id: row.id, title: title, row: row };
      });
      inner.innerHTML = items.map(function (it) { return '<a href="#' + esc(it.id) + '" data-j="' + esc(it.id) + '">' + esc(it.title) + '</a>'; }).join('');
      nav.hidden = false;
      inner.onclick = function (e) {
        var a = e.target.closest('[data-j]'); if (!a) return;
        e.preventDefault();
        var row = doc.getElementById(a.getAttribute('data-j'));
        if (row) row.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      };
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (es) {
          es.forEach(function (e) {
            if (!e.isIntersecting) return;
            $$('a', inner).forEach(function (a) {
              var on = a.getAttribute('data-j') === e.target.id;
              a.classList.toggle('on', on);
              if (on && inner.scrollWidth > inner.clientWidth) inner.scrollTo({ left: Math.max(0, a.offsetLeft - inner.offsetLeft - 40), behavior: 'smooth' });
            });
          });
        }, { rootMargin: '-35% 0px -55% 0px' });
        items.forEach(function (it) { io.observe(it.row); });
      }
    }
    var timer = null;
    new MutationObserver(function () { clearTimeout(timer); timer = setTimeout(build, 80); }).observe(list, { childList: true });
    build();
  }

  /* ---------- Start ---------- */
  function start() {
    getJSON('/api/page-content', 1400).then(function (d) {
      applyContent(d && d.content);
      watchImages();
      $$('[data-pc-split]').forEach(splitWords);
      setYears();
      root.classList.add('dx-ready');
      setupCounters();
      setupScroll();
    });
    setupReveal();
    setupMarquee();
    setupTimecode();
    setupSpotlight();
    setupProcess();
    setupServiceCards();
    setupWork();
    setupJump();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})();
