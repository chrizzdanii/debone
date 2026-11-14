/* DEBONE studio map: one place to change the location. Renders any <div data-debone-map>. */
(function () {
  'use strict';
  var STUDIO = {
    name: 'DEBONE Photos & Video Editing Studio',
    address: '179 Old Refinery Road, Elelenwo, Port Harcourt, Rivers State, Nigeria',
    /* If you have the exact Google Maps share link for the studio, paste its place name or coordinates here, e.g. '4.8396,7.0731' */
    query: '179 Old Refinery Road, Elelenwo, Port Harcourt, Rivers State, Nigeria',
    hours: 'Monday to Saturday, 7:00 am to 8:00 pm · Sunday, 2:00 pm to 7:00 pm'
  };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var q = encodeURIComponent(STUDIO.query);
  var EMBED = 'https://www.google.com/maps?q=' + q + '&z=17&hl=en&output=embed';
  var OPEN = 'https://www.google.com/maps/search/?api=1&query=' + q;
  var DIRS = 'https://www.google.com/maps/dir/?api=1&destination=' + q;

  var PIN = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.2A7 7 0 0 1 19 9.8C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.6"/></svg>';
  var ARROW = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var CLOCK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

  function build(el) {
    if (el.getAttribute('data-built')) return;
    el.setAttribute('data-built', '1');
    var compact = el.hasAttribute('data-compact');
    el.classList.add('dmap');
    el.innerHTML =
      '<div class="dmap-frame">' +
        '<div class="dmap-skel" aria-hidden="true"><span class="dmap-grid"></span><span class="dmap-pulse">' + PIN + '</span><em>Loading map…</em></div>' +
        '<iframe class="dmap-iframe" title="Map showing ' + STUDIO.name + ', ' + STUDIO.address + '" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>' +
        '<button type="button" class="dmap-mode" aria-pressed="true" aria-label="Switch between dark and light map">Dark map</button>' +
        (compact ? '' : '<div class="dmap-card"><span class="dmap-pin">' + PIN + '</span><div class="dmap-txt"><b>' + STUDIO.name + '</b><span data-setting="address">' + STUDIO.address + '</span><span class="dmap-hrs">' + CLOCK + ' ' + STUDIO.hours + '</span></div></div>') +
      '</div>' +
      '<div class="dmap-actions"><a class="btn btn-solid btn-sm" href="' + DIRS + '" target="_blank" rel="noopener">Get directions ' + ARROW + '</a><a class="btn btn-ghost btn-sm" href="' + OPEN + '" target="_blank" rel="noopener">Open in Google Maps</a></div>';

    var frame = el.querySelector('.dmap-iframe');
    var skel = el.querySelector('.dmap-skel');
    frame.addEventListener('load', function () {
      el.classList.add('is-ready');
      setTimeout(function () { if (skel) skel.remove(); }, 700);
    });
    var mode = el.querySelector('.dmap-mode');
    el.classList.add('is-dark');
    mode.addEventListener('click', function () {
      var dark = el.classList.toggle('is-dark');
      mode.setAttribute('aria-pressed', String(dark));
      mode.textContent = dark ? 'Dark map' : 'Light map';
    });

    function load() { frame.src = EMBED; }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { el.classList.add('in'); load(); io.disconnect(); }
        });
      }, { rootMargin: '250px 0px' });
      io.observe(el);
    } else { el.classList.add('in'); load(); }
  }

  function init() { document.querySelectorAll('[data-debone-map]').forEach(build); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.DeboneMap = { studio: STUDIO, directions: DIRS, open: OPEN, init: init };
})();
