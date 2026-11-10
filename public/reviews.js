(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DELAY = 6500;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function initials(name) {
    return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join('') || '?';
  }
  var TINTS = ['#FF5A1F', '#1FE0C4', '#F2EDE4', '#FF8A5C', '#7CC4FF', '#E7B96B'];
  function tint(name) {
    var h = 0; for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return TINTS[h % TINTS.length];
  }
  function stars(n) {
    var s = '';
    for (var i = 1; i <= 5; i++) s += '<i class="' + (i <= n ? 'on' : '') + '">★</i>';
    return '<span class="rvs-stars" aria-label="' + n + ' out of 5 stars">' + s + '</span>';
  }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function isNigeria(c) { return /nigeria/i.test(String(c || '')); }

  /* ---------- Customer reviews slideshow ---------- */
  function slideshow(stage, items) {
    stage.innerHTML = '';
    if (!items.length) {
      stage.innerHTML = '<p class="rvs-none">No reviews with this rating yet.</p>';
      return { stop: function () {} };
    }
    var slidesWrap = document.createElement('div');
    slidesWrap.className = 'rvs-slides';
    slidesWrap.innerHTML = items.map(function (r, i) {
      return '<figure class="rvs-slide' + (i === 0 ? ' active' : '') + '">' +
        (r.rating ? stars(Number(r.rating)) : '') +
        '<blockquote class="rvs-text">&ldquo;' + esc(r.text) + '&rdquo;</blockquote>' +
        '<figcaption class="rvs-person"><span class="rvs-avatar" style="background:' + tint(r.name) + '">' + esc(initials(r.name)) + '</span>' +
        '<div><b>' + esc(r.name) + '</b><small>' + esc(r.label || 'Customer') + '</small></div></figcaption></figure>';
    }).join('');

    var progress = document.createElement('div');
    progress.className = 'rvs-progress';
    progress.innerHTML = '<i></i>';

    var controls = document.createElement('div');
    controls.className = 'rvs-controls';
    controls.innerHTML =
      '<button type="button" class="rvs-arrow" data-dir="-1" aria-label="Previous review">&larr;</button>' +
      '<div class="rvs-count" aria-live="polite"><b class="rvs-now">01</b><span> / ' + pad(items.length) + '</span></div>' +
      '<button type="button" class="rvs-arrow" data-dir="1" aria-label="Next review">&rarr;</button>' +
      '<button type="button" class="rvs-pause" aria-label="Pause slideshow">Pause</button>';

    stage.appendChild(slidesWrap);
    stage.appendChild(controls);
    stage.appendChild(progress);

    var slides = slidesWrap.querySelectorAll('.rvs-slide');
    var now = controls.querySelector('.rvs-now');
    var fill = progress.querySelector('i');
    var pauseBtn = controls.querySelector('.rvs-pause');
    var idx = 0, timer = null, paused = false, startedAt = 0, remaining = DELAY;

    function show(next, dir) {
      next = (next + slides.length) % slides.length;
      slides.forEach(function (s, i) {
        s.classList.toggle('active', i === next);
        s.classList.toggle('back', i === next && dir < 0);
      });
      idx = next;
      now.textContent = pad(idx + 1);
      restart();
    }
    function run(ms) {
      startedAt = Date.now();
      remaining = ms;
      fill.style.transition = 'width ' + ms + 'ms linear';
      fill.style.width = '100%';
      timer = setTimeout(function () { show(idx + 1, 1); }, ms);
    }
    function restart() {
      clearTimeout(timer);
      fill.style.transition = 'none';
      fill.style.width = '0%';
      void fill.offsetWidth;
      if (!paused && !reduce) run(DELAY);
    }
    function pause() {
      if (paused) return;
      paused = true;
      clearTimeout(timer);
      var total = progress.clientWidth || 1;
      var done = parseFloat(getComputedStyle(fill).width) || 0;
      remaining = Math.max(300, remaining - (Date.now() - startedAt));
      fill.style.transition = 'none';
      fill.style.width = (done / total * 100) + '%';
      pauseBtn.textContent = 'Play';
      pauseBtn.setAttribute('aria-label', 'Play slideshow');
    }
    function play() {
      if (!paused) return;
      paused = false;
      pauseBtn.textContent = 'Pause';
      pauseBtn.setAttribute('aria-label', 'Pause slideshow');
      if (!reduce) run(remaining);
    }

    controls.addEventListener('click', function (e) {
      var a = e.target.closest('[data-dir]');
      if (a) { var d = Number(a.getAttribute('data-dir')); show(idx + d, d); return; }
      if (e.target.closest('.rvs-pause')) { if (paused) play(); else pause(); }
    });
    stage.setAttribute('tabindex', '0');
    stage.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') show(idx + 1, 1);
      if (e.key === 'ArrowLeft') show(idx - 1, -1);
    });
    var sx = null;
    stage.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', function (e) {
      if (sx === null) return;
      var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 40) show(idx + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
      sx = null;
    }, { passive: true });
    stage.addEventListener('mouseenter', pause);
    stage.addEventListener('mouseleave', play);
    document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); else play(); });

    if (reduce) { paused = true; pauseBtn.textContent = 'Play'; }
    else run(DELAY);
    return { stop: function () { clearTimeout(timer); } };
  }

  function renderReviews(box, list) {
    var total = list.length;
    var avg = total ? list.reduce(function (s, r) { return s + Number(r.rating || 0); }, 0) / total : 0;
    var dist = [5, 4, 3, 2, 1].map(function (n) {
      var c = list.filter(function (r) { return Number(r.rating) === n; }).length;
      return { n: n, c: c, pct: total ? Math.round((c / total) * 100) : 0 };
    });
    box.innerHTML =
      '<div class="rvs-summary">' +
        '<div class="rvs-score"><b data-avg="' + avg.toFixed(1) + '">0.0</b>' + stars(Math.round(avg)) +
          '<span>Based on ' + total + ' customer review' + (total === 1 ? '' : 's') + '</span></div>' +
        '<div class="rvs-bars">' + dist.map(function (d) {
          return '<div class="rvs-bar"><span>' + d.n + ' star' + (d.n === 1 ? '' : 's') + '</span><div class="rvs-meter"><i data-w="' + d.pct + '"></i></div><em>' + d.c + '</em></div>';
        }).join('') + '</div>' +
      '</div>' +
      '<div class="rvs-filters" role="group" aria-label="Filter reviews">' +
        '<button type="button" aria-pressed="true" data-f="all">All</button>' +
        [5, 4, 3, 2, 1].map(function (n) { return '<button type="button" aria-pressed="false" data-f="' + n + '">' + n + ' star' + (n === 1 ? '' : 's') + '</button>'; }).join('') +
      '</div>' +
      '<div class="rvs-stage" role="region" aria-roledescription="carousel" aria-label="Customer reviews"></div>';

    var stage = box.querySelector('.rvs-stage');
    var current = null;
    function play(filter) {
      if (current) current.stop();
      current = slideshow(stage, list.filter(function (r) { return filter === 'all' || Number(r.rating) === Number(filter); }));
    }
    box.querySelectorAll('[data-f]').forEach(function (b) {
      b.addEventListener('click', function () {
        box.querySelectorAll('[data-f]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        play(b.getAttribute('data-f'));
      });
    });
    play('all');

    function animateSummary() {
      var score = box.querySelector('[data-avg]');
      var target = parseFloat(score.getAttribute('data-avg'));
      if (reduce) { score.textContent = target.toFixed(1); }
      else {
        var t0 = null;
        requestAnimationFrame(function step(ts) {
          if (!t0) t0 = ts;
          var p = Math.min((ts - t0) / 1200, 1);
          score.textContent = (target * (1 - Math.pow(1 - p, 3))).toFixed(1);
          if (p < 1) requestAnimationFrame(step);
        });
      }
      box.querySelectorAll('[data-w]').forEach(function (el) {
        requestAnimationFrame(function () { requestAnimationFrame(function () { el.style.width = el.getAttribute('data-w') + '%'; }); });
      });
    }
    if (typeof window.IntersectionObserver === 'function') {
      var io = new IntersectionObserver(function (es) {
        if (es.some(function (e) { return e.isIntersecting; })) { animateSummary(); io.disconnect(); }
      }, { threshold: 0.2 });
      io.observe(box.querySelector('.rvs-summary'));
    } else { animateSummary(); }
  }

  /* ---------- Student testimonies (academy page): same slideshow as the customer reviews ---------- */
  function renderTestimonies(box, list) {
    if (!list.length) {
      box.innerHTML = '<div class="rvs-none"><p>Student stories will appear here as our graduates share them.</p>' +
        '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://wa.me/2348035988889?text=Hi%20DEBONE%2C%20I%20completed%20a%20course%20and%20want%20to%20share%20my%20story">Share your story on WhatsApp</a></div>';
      return;
    }
    var intl = list.filter(function (t) { return !isNigeria(t.country); }).length;
    box.innerHTML =
      '<div class="rvs-filters" role="group" aria-label="Filter testimonies">' +
        '<button type="button" aria-pressed="true" data-c="all">All (' + list.length + ')</button>' +
        '<button type="button" aria-pressed="false" data-c="ng">Nigeria (' + (list.length - intl) + ')</button>' +
        '<button type="button" aria-pressed="false" data-c="intl">International (' + intl + ')</button>' +
      '</div><div class="rvs-stage" role="region" aria-roledescription="carousel" aria-label="Student testimonies"></div>';
    var stage = box.querySelector('.rvs-stage');
    var current = null;
    function play(f) {
      if (current) current.stop();
      var items = list.filter(function (t) { return f === 'all' || (f === 'ng') === isNigeria(t.country); })
        .map(function (t) { return { name: t.name, text: t.text, label: t.country || 'Student' }; });
      current = slideshow(stage, items);
    }
    box.querySelectorAll('[data-c]').forEach(function (b) {
      b.addEventListener('click', function () {
        box.querySelectorAll('[data-c]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        play(b.getAttribute('data-c'));
      });
    });
    play('all');
  }

  var reviewBox = document.getElementById('reviews');
  if (reviewBox) {
    fetch('/data/reviews.json').then(function (r) { return r.json(); })
      .then(function (d) { renderReviews(reviewBox, d.reviews || []); })
      .catch(function () { reviewBox.innerHTML = '<p class="rvs-none">Reviews are unavailable right now.</p>'; });
  }
  var testBox = document.getElementById('student-testimonies');
  if (testBox) {
    fetch('/data/academy-testimonials.json').then(function (r) { return r.json(); })
      .then(function (d) { renderTestimonies(testBox, d.testimonials || []); })
      .catch(function () { renderTestimonies(testBox, []); });
  }
})();
