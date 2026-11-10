/* Sub-page motion (v35): animated headline, glowing cards that follow the pointer, staggered entrances. */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 1. Headline of the header splits into words and rises in */
  document.querySelectorAll('.sp-title').forEach(function (h) {
    if (h.__split) return; h.__split = true;
    var words = h.textContent.trim().split(/\s+/);
    h.setAttribute('aria-label', h.textContent.trim());
    h.innerHTML = words.map(function (w, i) {
      return '<span class="w" aria-hidden="true"><i style="--d:' + i + '">' + w.replace(/</g, '&lt;') + '</i></span>';
    }).join(' ');
    requestAnimationFrame(function () { setTimeout(function () { h.classList.add('go'); }, 120); });
  });

  /* 2. Cards: a soft light follows the pointer, and each card lifts on hover */
  var CARDS = '.bd-card,.st-card,.tl-card,.ch-card,.ds-card,.ct-card,.wg-card,.sv-mini,.svc-card,.dl-card,.rq-card,.cm-thread,.rf-card,.card,.course,.tst-card,.prod,.kpi';
  if (!reduce && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.addEventListener('pointermove', function (e) {
      var c = e.target.closest && e.target.closest(CARDS);
      if (!c) return;
      var r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  }

  /* 3. Entrance: cards and form panels rise in as they reach the screen */
  var targets = Array.prototype.slice.call(document.querySelectorAll(CARDS + ',.fm-form,.empty-state,.sp-cta'));
  if (reduce || !('IntersectionObserver' in window)) { targets.forEach(function (t) { t.classList.add('rv-in'); }); return; }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('rv-in'); io.unobserve(en.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  targets.forEach(function (t, i) {
    t.classList.add('rv');
    t.style.setProperty('--rv', (i % 6) * 70 + 'ms');
    var r = t.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.92) t.classList.add('rv-in'); else io.observe(t);
  });
  setTimeout(function () { targets.forEach(function (t) { t.classList.add('rv-in'); }); }, 4000);
})();
