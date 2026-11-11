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
  /* Patch changed DOM nodes in place, instead of replacing a whole dashboard view.
     This preserves the existing page, listeners, focused controls and scroll position. */
  DLive.patch = function (host, html) {
    var template = document.createElement('template');
    template.innerHTML = html;
    var focus = document.activeElement;
    var isEditing = function (el) {
      return el === focus && (el.matches('input,textarea,select,[contenteditable]'));
    };
    function sync(old, fresh) {
      if (old.nodeType !== fresh.nodeType || (old.nodeType === 1 && old.tagName !== fresh.tagName)) {
        old.replaceWith(fresh.cloneNode(true)); return;
      }
      if (old.nodeType === 3) { if (old.nodeValue !== fresh.nodeValue) old.nodeValue = fresh.nodeValue; return; }
      if (old.nodeType !== 1) return;
      if (old.hasAttribute('data-live-preserve') || isEditing(old)) return;
      if (old.matches('video,audio,iframe,canvas')) return;
      Array.from(old.attributes).forEach(function (attr) {
        if (!fresh.hasAttribute(attr.name)) old.removeAttribute(attr.name);
      });
      Array.from(fresh.attributes).forEach(function (attr) {
        if (old.getAttribute(attr.name) !== attr.value) old.setAttribute(attr.name, attr.value);
      });
      if (old.matches('input,textarea,select')) {
        if (old.type !== 'file' && old.value !== fresh.value) old.value = fresh.value;
        if ('checked' in old) old.checked = fresh.checked;
      }
      var a = Array.from(old.childNodes), b = Array.from(fresh.childNodes);
      for (var i = 0; i < b.length; i++) {
        if (!a[i]) { old.appendChild(b[i].cloneNode(true)); continue; }
        sync(a[i], b[i]);
      }
      for (var j = a.length - 1; j >= b.length; j--) if (a[j].parentNode === old) old.removeChild(a[j]);
    }
    var before = Array.from(host.childNodes), after = Array.from(template.content.childNodes);
    for (var i = 0; i < after.length; i++) {
      if (!before[i]) host.appendChild(after[i].cloneNode(true));
      else sync(before[i], after[i]);
    }
    for (var j = before.length - 1; j >= after.length; j--) if (before[j].parentNode === host) host.removeChild(before[j]);
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
