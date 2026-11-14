/* Phone menu button (v56). The home page and the pages that load inner.js already wire this button themselves.
   Every other page (Store, Contact, Book, Bundles, Talent and so on) relied on nothing, so the button did nothing.
   Wiring it here, once, makes the menu work on every page that loads nav.js. */
(function () {
  'use strict';
  var btn = document.querySelector('.menu-btn');
  var menu = document.getElementById('menu');
  if (!btn || !menu || btn.__menuWired) return;
  btn.__menuWired = true;
  var OPEN = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
  var CLOSE = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  function setMenu(open) {
    menu.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    btn.innerHTML = open ? CLOSE : OPEN;
    document.body.style.overflow = open ? 'hidden' : '';
  }
  btn.addEventListener('click', function () { setMenu(!menu.classList.contains('open')); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu.classList.contains('open')) setMenu(false); });
  var wide = window.matchMedia('(min-width: 901px)');
  var onWide = function () { if (wide.matches && menu.classList.contains('open')) setMenu(false); };
  if (wide.addEventListener) wide.addEventListener('change', onWide); else if (wide.addListener) wide.addListener(onWide);
})();

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

/* v53 polish: current page, scroll progress, calmer phone menu */
(function () {
  'use strict';
  var css = '.nav-progress{position:fixed;left:0;top:0;height:3px;width:100%;transform-origin:0 50%;transform:scaleX(0);background:linear-gradient(90deg,#E0A800,#6BCB77);z-index:200;pointer-events:none}' +
    '.nav nav a[aria-current="page"]:not(.btn){opacity:1;color:#E0A800}.nav nav a[aria-current="page"]:not(.btn)::after{transform:scaleX(1)}' +
    '.nav .nav-item[aria-current="page"]{background:rgba(224,168,0,.12)}' +
    '.nav a:focus-visible,.nav button:focus-visible{outline:3px solid #E0A800;outline-offset:3px;border-radius:8px}' +
    'body.menu-locked{overflow:hidden}' +
    '@media (prefers-reduced-motion:reduce){.nav-progress{display:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  // 1. Mark the page you are on, in the bar and inside the dropdowns
  var here = (location.pathname.split('/').pop() || 'index.html').replace(/^$/, 'index.html');
  if (!/\.html$/.test(here)) here += '.html';
  document.querySelectorAll('#menu a[href]').forEach(function (a) {
    var h = a.getAttribute('href').split('#')[0];
    if (!h || /^https?:/.test(h)) return;
    var file = h.split('?')[0];
    var sameQuery = !h.split('?')[1] || location.search.indexOf(h.split('?')[1]) !== -1;
    if (file === here && sameQuery) {
      a.setAttribute('aria-current', 'page');
      var g = a.closest('.nav-group'); var t = g && g.querySelector('.nav-trigger');
      if (t && !t.getAttribute('aria-current')) t.setAttribute('aria-current', 'page');
    }
  });

  // 2. A thin bar that fills as you read
  var bar = document.createElement('div'); bar.className = 'nav-progress'; bar.setAttribute('aria-hidden', 'true'); document.body.appendChild(bar);
  var queued = false;
  function paint() {
    queued = false;
    var h = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, scrollY / h) : 0) + ')';
  }
  addEventListener('scroll', function () { if (!queued) { queued = true; requestAnimationFrame(paint); } }, { passive: true });
  paint();

  // 3. Phone menu: stop the page scrolling behind it, close when a link is chosen
  var menu = document.getElementById('menu');
  if (menu && 'MutationObserver' in window) {
    new MutationObserver(function () { document.body.classList.toggle('menu-locked', menu.classList.contains('open') && !matchMedia('(min-width: 901px)').matches); })
      .observe(menu, { attributes: true, attributeFilter: ['class'] });
    menu.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (a && menu.classList.contains('open') && !a.classList.contains('nav-trigger')) { var b = document.querySelector('.menu-btn'); if (b) b.click(); }
    });
    addEventListener('resize', function () { if (matchMedia('(min-width: 901px)').matches) document.body.classList.remove('menu-locked'); });
  }
})();
