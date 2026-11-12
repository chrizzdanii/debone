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

  // Where clicking each heading goes. Hovering (or the arrow) still opens the dropdown as before.
  var LANDING = { academy: 'academy.html', studio: 'studio.html', services: 'services.html', store: 'store.html', about: 'about.html' };

  groups.forEach(function (g) {
    var t = g.querySelector('.nav-trigger');
    var panel = g.querySelector('.nav-panel');
    if (!t) return;
    var key = (t.textContent || '').trim().toLowerCase();
    var href = LANDING[key];
    if (href) {
      // Turn the heading into a real link: click goes to the page, hover or the arrow opens the dropdown
      var a = document.createElement('a');
      a.className = t.className; a.href = href; a.id = t.id || '';
      a.setAttribute('aria-haspopup', 'true'); a.setAttribute('aria-expanded', 'false');
      if (t.getAttribute('aria-controls')) a.setAttribute('aria-controls', t.getAttribute('aria-controls'));
      a.innerHTML = t.innerHTML;
      t.parentNode.replaceChild(a, t);
      t = a;
      if (/\/?[\w-]+\.html$/.test(location.pathname) && location.pathname.split('/').pop() === href) a.setAttribute('aria-current', 'page');
      if (panel) {
        // On a phone the heading opens the list, so give a clear way into the section page itself
        var first = panel.querySelector('.nav-col');
        if (first && !panel.querySelector('.nav-all')) {
          var all = document.createElement('a');
          all.className = 'nav-all'; all.href = href; all.textContent = 'Open the ' + t.textContent.trim() + ' page →';
          first.insertBefore(all, first.firstChild);
        }
      }
    }
    t.addEventListener('click', function (e) {
      var chev = e.target.closest && e.target.closest('.nav-chev');
      if (desktop.matches && href && !chev) {
        // Desktop: a click on the name goes to its page (hover already showed the menu)
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      var open = !g.classList.contains('open');
      closeAll(g);
      setOpen(g, open);
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
