/* Course bundle cards (v51): used by the website Bundles page and the student dashboard. */
(function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function naira(n) { return '₦' + Math.round(Number(n) || 0).toLocaleString('en-NG'); }
  var ART = [['#2b2208', '#E0A800'], ['#1b0f24', '#b48cff'], ['#0d2018', '#6BCB77'], ['#241014', '#ff4d6d'], ['#0e1a2b', '#7aa7ff']];
  function art(b, i) {
    if (b.hasImage) return '<div class="bx-img" style="background-image:url(\'/api/bundles/' + encodeURIComponent(b.id) + '/image?v=' + b.imageV + '\')"></div>';
    var c = ART[i % ART.length];
    return '<div class="bx-img art" style="--a:' + c[0] + ';--b:' + c[1] + '"><span>' + b.courses.length + '</span><em>courses</em></div>';
  }
  function card(b, i, o) {
    var buy = b.owned
      ? '<a class="bx-btn owned" href="' + (o.dashboard ? '#courses' : 'dashboard.html#courses') + '">You own this bundle · Open my courses</a>'
      : '<button class="bx-btn" type="button" data-bundle="' + esc(b.id) + '"><span>Buy the bundle</span><i></i></button>';
    return '<article class="bx-card" style="--i:' + i + '" data-tilt>' +
      '<div class="bx-media">' + art(b, i) + (b.savePct > 0 ? '<span class="bx-save">Save ' + b.savePct + '%</span>' : '') + '<span class="bx-count">' + b.courses.length + ' courses · ' + b.lessons + ' lessons</span></div>' +
      '<div class="bx-body"><p class="bx-eyebrow">Course bundle</p><h3>' + esc(b.title) + '</h3>' + (b.description ? '<p class="bx-desc">' + esc(b.description) + '</p>' : '') +
        '<ol class="bx-list">' + b.courses.map(function (c, k) {
          return '<li style="--k:' + k + '"><span class="n">' + (k + 1) + '</span><div><b>' + esc(c.title) + '</b><small>' + esc(c.startDate ? 'Starts ' + c.startDate : 'Start date to be announced') + (c.schedule ? ' · ' + esc(c.schedule) : '') + '</small></div></li>';
        }).join('') + '</ol>' +
        '<div class="bx-price"><div>' + (b.savings > 0 ? '<s>' + naira(b.value) + '</s>' : '') + '<b data-count="' + b.price + '">' + naira(b.price) + '</b></div>' +
          (b.savings > 0 ? '<span class="bx-pill">You save ' + naira(b.savings) + '</span>' : '') + '</div>' + buy + '</div></article>';
  }
  function countUp(el) {
    var end = Number(el.getAttribute('data-count')) || 0;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.DSilent && DSilent.active) return;
    var t0 = null;
    (function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / 1100, 1);
      el.textContent = naira(end * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step); else el.textContent = naira(end);
    })(performance.now());
  }
  function enhance(box) {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); var p = e.target.querySelector('[data-count]'); if (p) countUp(p); io.unobserve(e.target); } });
    }, { threshold: .15 }) : null;
    box.querySelectorAll('.bx-card').forEach(function (c) {
      if (io) io.observe(c); else c.classList.add('in');
      if (reduce) return;
      c.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        c.style.setProperty('--rx', (-y * 6).toFixed(2) + 'deg'); c.style.setProperty('--ry', (x * 8).toFixed(2) + 'deg');
        c.style.setProperty('--mx', (x + .5) * 100 + '%'); c.style.setProperty('--my', (y + .5) * 100 + '%');
      });
      c.addEventListener('pointerleave', function () { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
    });
  }
  window.BundleUI = {
    /* box: element to fill. list: bundles from /api/bundles. opts.onBuy(id, button) is called when someone presses Buy. */
    render: function (box, list, opts) {
      opts = opts || {};
      if (!list.length) { box.innerHTML = '<div class="bx-empty"><div class="ring"></div><b>No bundles are open yet</b><p>Individual courses are always available on the Digital Academy page.</p></div>'; return; }
      var total = list.reduce(function (t, b) { return t + b.savings; }, 0);
      box.innerHTML = (total > 0 ? '<p class="bx-banner">Buy together and save up to <b>' + Math.max.apply(null, list.map(function (b) { return b.savePct; })) + '%</b></p>' : '') +
        '<div class="bx-grid">' + list.map(function (b, i) { return card(b, i, opts); }).join('') + '</div>';
      enhance(box);
      box.querySelectorAll('[data-bundle]').forEach(function (btn) {
        btn.addEventListener('click', function () { if (opts.onBuy) opts.onBuy(btn.getAttribute('data-bundle'), btn); });
      });
    }
  };
})();
