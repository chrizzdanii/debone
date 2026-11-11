/* Navigation (v50): clicking a section name opens that section's page; hovering it, or clicking its arrow, opens the dropdown. */
(function () {
  'use strict';
  var groups = Array.prototype.slice.call(document.querySelectorAll('#menu .nav-group'));
  if (!groups.length) return;
  var desktop = window.matchMedia('(min-width: 901px)');
  var timers = new Map();
  var HOME = { 'ng-academy': 'academy.html', 'ng-studio': 'works.html', 'ng-services': 'services.html', 'ng-store': 'store.html', 'ng-about': 'index.html#story' };

  function setOpen(g, open) {
    clearTimeout(timers.get(g));
    g.classList.toggle('open', open);
    var t = g.querySelector('.nav-trigger');
    if (t) t.setAttribute('aria-expanded', String(open));
  }
  function closeAll(except) {
    groups.forEach(function (g) { if (g !== except) setOpen(g, false); });
  }
  function closeSoon(g) {
    clearTimeout(timers.get(g));
    timers.set(g, setTimeout(function () { setOpen(g, false); }, 320));
  }

  groups.forEach(function (g) {
    var t = g.querySelector('.nav-trigger');
    var panel = g.querySelector('.nav-panel');
    if (!t) return;
    var home = HOME[t.getAttribute('aria-controls')];
    if (home) { t.setAttribute('data-href', home); t.classList.add('has-page'); t.title = 'Open ' + t.textContent.trim(); }
    t.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var onArrow = !!(e.target.closest && e.target.closest('.nav-chev'));
      // Clicking the name goes to the page. Clicking the arrow (or a section with no page) toggles the dropdown.
      if (home && !onArrow && e.detail !== 0) { window.location.href = home; return; }
      if (desktop.matches) {
        closeAll(g);
        setOpen(g, true);   // on a computer the menu is already open from the hover; the arrow keeps it open
      } else {
        var open = !g.classList.contains('open');
        closeAll(g);
        setOpen(g, open);
      }
    });
    g.addEventListener('mouseenter', function () { if (desktop.matches) { closeAll(g); setOpen(g, true); } });
    g.addEventListener('mouseleave', function () { if (desktop.matches) closeSoon(g); });
    if (panel) panel.addEventListener('mouseenter', function () { clearTimeout(timers.get(g)); });
    g.addEventListener('focusin', function () { if (desktop.matches) { closeAll(g); setOpen(g, true); } });
    g.addEventListener('focusout', function (e) { if (desktop.matches && !g.contains(e.relatedTarget)) closeSoon(g); });
    g.addEventListener('keydown', function (e) { if (e.key === 'Escape') { setOpen(g, false); t.focus(); } });
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.nav-group')) closeAll(null);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(null); });
  if (desktop.addEventListener) desktop.addEventListener('change', function () { closeAll(null); });
})();
