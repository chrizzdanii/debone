/* Live updates (v24): the page reacts straight away when something changes. */
(function () {
  'use strict';
  var popState = window.DNotify ? 'ready' : '', popQueue = [];
  function whenPop(fn) {
    if (popState === 'ready') return fn(true);
    if (popState === 'failed') return fn(false);
    popQueue.push(fn);
    if (popState === 'loading') return;
    popState = 'loading';
    var sc = document.createElement('script');
    sc.src = 'notify-pop.js?v=51';
    sc.onload = function () { popState = 'ready'; popQueue.splice(0).forEach(function (f) { f(true); }); };
    sc.onerror = function () { popState = 'failed'; popQueue.splice(0).forEach(function (f) { f(false); }); };
    document.head.appendChild(sc);
  }
  /* Load the pop-up early so the sound is ready the moment something arrives */
  if (document.readyState === 'complete') whenPop(function () {}); else window.addEventListener('load', function () { whenPop(function () {}); });
  /* Shared helpers for pages that redraw themselves when data changes (no page reload, no flicker) */
  var DLive = window.DLive = { silent: false, pending: false };
  DLive.busy = function () {
    /* true while the person is typing, has a pop-up open or has unsaved edits, so a redraw would get in the way */
    var ae = document.activeElement;
    var typing = !!ae && /^(TEXTAREA|INPUT|SELECT)$/.test(ae.tagName) && !/^(button|submit|checkbox|radio)$/.test(ae.type || '');
    return typing || !!(window.DModal && DModal.isOpen && DModal.isOpen());
  };
  /* Run a redraw quietly: no entrance animation, no scroll jump, no counting up from zero */
  DLive.quiet = function (fn) {
    var y = window.pageXOffset !== undefined ? window.pageYOffset : 0;
    DLive.silent = true;
    document.documentElement.classList.add('live-silent');
    var done = function () {
      DLive.silent = false;
      document.documentElement.classList.remove('live-silent');
      if (Math.abs((window.pageYOffset || 0) - y) > 2) window.scrollTo(0, y);
    };
    var r;
    try { r = fn(); } catch (e) { done(); throw e; }
    return Promise.resolve(r).then(function (v) { done(); return v; }, function (e) { done(); throw e; });
  };
  var fireTimer = null;
  function fire() {
    clearTimeout(fireTimer);
    fireTimer = setTimeout(function () { window.dispatchEvent(new CustomEvent('debone:refresh')); }, 60);
  }

  /* Changes reach the page within about a second:
     1. a live connection (instant) where the server allows one;
     2. otherwise the page asks "has anything changed?" every few seconds (this is what runs on Vercel). */
  var polling = false, rev = null, inflight = false;
  function check() {
    if (inflight || document.hidden) return;
    inflight = true;
    fetch('/api/live/rev', { cache: 'no-store', credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || d.rev == null) return;
        if (rev !== null && d.rev !== rev) fire();
        rev = d.rev;
      })
      .catch(function () {})
      .then(function () { inflight = false; });
  }
  function startPolling() {
    if (polling) return;
    polling = true;
    check();
    setInterval(check, 3000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
    window.addEventListener('focus', check);
    window.addEventListener('online', check);
  }
  if (!window.EventSource) { startPolling(); return; }
  var es = new EventSource('/api/events');
  var wasDown = false;
  es.addEventListener('error', function () {
    wasDown = true;
    if (es.readyState === 2) startPolling();
  });
  es.addEventListener('open', function () { if (wasDown) { wasDown = false; fire(); } });
  es.addEventListener('refresh', fire);
  es.addEventListener('unlock', function (e) { window.dispatchEvent(new CustomEvent('debone:unlock', { detail: JSON.parse(e.data) })); });
  es.addEventListener('notice', function (e) {
    var d = JSON.parse(e.data);
    /* The animated pop-up (with sound) is loaded on first use; a plain toast is the fallback */
    whenPop(function (ok) {
      if (ok) DNotify.show(d);
      else if (window.DModal) DModal.toast({ title: d.title, body: d.body, link: d.link, tone: 'info' });
    });
    window.dispatchEvent(new CustomEvent('debone:notice', { detail: d }));
  });
})();
