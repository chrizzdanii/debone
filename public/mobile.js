/* DEBONE mobile helpers (v54): table labels, bottom tab bar, swipe to open the menu, no stuck drop zone. */
(function () {
  'use strict';
  var phone = window.matchMedia('(max-width: 900px)');

  /* 1. Give every table cell its column name, so tables can become cards on a phone */
  function label(t) {
    var heads = Array.prototype.map.call(t.querySelectorAll('thead th'), function (h) { return (h.textContent || '').trim(); });
    if (!heads.length) return;
    t.querySelectorAll('tbody tr').forEach(function (tr) {
      var i = 0;
      Array.prototype.forEach.call(tr.children, function (td) {
        if (td.tagName !== 'TD') return;
        if (!td.hasAttribute('data-label')) td.setAttribute('data-label', heads[i] || '');
        i += td.colSpan || 1;
      });
    });
  }
  var queued = false;
  function labelAll() { queued = false; document.querySelectorAll('table.dt, table.table, table.tbl').forEach(label); }
  function schedule() { if (!queued) { queued = true; setTimeout(labelAll, 60); } }
  labelAll();
  if ('MutationObserver' in window) new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });

  /* 2. Dashboard and admin only from here */
  var side = document.getElementById('side'), burger = document.getElementById('burger');
  if (!side || !burger) return;

  var isAdmin = /admin/i.test(side.getAttribute('aria-label') || '');
  var want = isAdmin ? ['overview', 'live', 'assignments'] : ['overview', 'courses', 'live', 'assignments'];
  var bar = document.createElement('nav');
  bar.className = 'm-tabs'; bar.setAttribute('aria-label', 'Quick navigation');
  want.forEach(function (v) {
    var src = side.querySelector('a[data-view="' + v + '"]');
    if (!src) return;
    var a = document.createElement('a');
    a.href = '#' + v; a.setAttribute('data-tab', v);
    var ix = src.querySelector('.ix'); var name = (src.textContent || '').trim();
    a.innerHTML = (ix ? ix.innerHTML : '') + '<span>' + (v === 'overview' ? 'Home' : v === 'assignments' ? 'Tasks' : name) + '</span>';
    bar.appendChild(a);
  });
  var more = document.createElement('button');
  more.type = 'button'; more.setAttribute('aria-label', 'Open the full menu');
  more.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg><span>Menu</span>';
  more.addEventListener('click', function () { burger.click(); });
  bar.appendChild(more);
  document.body.appendChild(bar);
  document.body.classList.add('has-tabbar');

  function mark() {
    var cur = (location.hash || '#overview').replace('#', '').split('/')[0];
    bar.querySelectorAll('a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-tab') === cur); });
  }
  addEventListener('hashchange', mark); mark();
  bar.addEventListener('click', function (e) { var a = e.target.closest('a'); if (a && navigator.vibrate) navigator.vibrate(8); });

  /* Hide the bar while the menu is open or the keyboard is up */
  function sideOpen() { document.body.classList.toggle('side-open', side.classList.contains('open')); }
  if ('MutationObserver' in window) new MutationObserver(sideOpen).observe(side, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('focusin', function (e) { if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) document.body.classList.add('kbd-open'); });
  document.addEventListener('focusout', function () { document.body.classList.remove('kbd-open'); });

  /* 3. Swipe: from the left edge to open the menu, swipe left on it to close */
  var x0 = 0, y0 = 0, t0 = 0, tracking = false;
  document.addEventListener('touchstart', function (e) {
    if (!phone.matches || e.touches.length !== 1) return;
    var t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; t0 = Date.now();
    tracking = side.classList.contains('open') || x0 < 22;
  }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (!tracking) return; tracking = false;
    var t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * .6 || Date.now() - t0 > 600) return;
    var open = side.classList.contains('open');
    if (dx > 0 && !open) burger.click(); else if (dx < 0 && open) burger.click();
  }, { passive: true });

  /* 4. Keep the typed field in view when the keyboard opens */
  document.addEventListener('focusin', function (e) {
    if (!phone.matches || !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    setTimeout(function () { try { e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {} }, 320);
  });

  /* 5. A file drop zone makes no sense on a phone: make sure it can never get stuck open */
  function killDrop() { var d = document.getElementById('wa-drop'); if (d && (phone.matches || 'ontouchstart' in window)) { d.hidden = true; d.style.display = 'none'; } }
  killDrop(); if ('MutationObserver' in window) new MutationObserver(killDrop).observe(document.body, { childList: true, subtree: true });
})();
