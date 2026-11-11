/* Navigation (v35): hover or click opens a section; it stays open while the pointer is over it. */
(function () {
  'use strict';
  var groups = Array.prototype.slice.call(document.querySelectorAll('#menu .nav-group'));
  if (!groups.length) return;
  var desktop = window.matchMedia('(min-width: 901px)');
  var timers = new Map();

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
    t.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (desktop.matches) {
        // Main label navigates; hovering or the chevron still opens the menu.
        if (e.target.closest('.nav-chev')) { closeAll(g); setOpen(g, !g.classList.contains('open')); return; }
        var label = (t.textContent || '').trim().toLowerCase();
        var destinations = {academy:'academy.html', about:'about.html', services:'services.html', shop:'products.html'};
        if (destinations[label]) window.location.href = destinations[label];
        else { closeAll(g); setOpen(g, true); }
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
