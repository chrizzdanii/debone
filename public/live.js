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
  /* Reconcile the existing view without clearing it. This intentionally keeps the
     original nodes (and their listeners) whenever their identity has not changed. */
  DLive.patch = function (host, html) {
    var template = document.createElement('template');
    template.innerHTML = html;
    var focused = document.activeElement;
    var scrolls = [];
    host.querySelectorAll('*').forEach(function (el) {
      if (el.scrollTop || el.scrollLeft) scrolls.push([el, el.scrollTop, el.scrollLeft]);
    });
    function key(el) {
      if (!el || el.nodeType !== 1) return null;
      if (el.id) return 'id:' + el.id;
      if (el.hasAttribute('data-id')) return el.tagName + ':id:' + el.getAttribute('data-id');
      if (el.hasAttribute('data-key')) return el.tagName + ':key:' + el.getAttribute('data-key');
      return null;
    }
    function preserve(el) {
      if (!el || el.nodeType !== 1) return false;
      return el.hasAttribute('data-live-preserve') ||
        el.matches('video,audio,iframe,canvas,[contenteditable],dialog') ||
        (focused && el.contains(focused) &&
         focused.matches('input,textarea,select,[contenteditable]'));
    }
    function compatible(a, b) {
      return a && b && a.nodeType === b.nodeType &&
        (a.nodeType !== 1 || a.tagName === b.tagName);
    }
    function sync(a, b) {
      if (a.isEqualNode(b) || preserve(a)) return;
      if (a.nodeType === 3 || a.nodeType === 8) {
        if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue;
        return;
      }
      if (a.nodeType !== 1) return;
      // Preserve the live value and selection of all form controls.
      if (a.matches('input,textarea,select')) return;
      Array.from(a.attributes).forEach(function (attr) {
        if (!b.hasAttribute(attr.name)) a.removeAttribute(attr.name);
      });
      Array.from(b.attributes).forEach(function (attr) {
        if (a.getAttribute(attr.name) !== attr.value) a.setAttribute(attr.name, attr.value);
      });
      children(a, b);
    }
    function children(parent, freshParent) {
      var oldNodes = Array.from(parent.childNodes);
      var newNodes = Array.from(freshParent.childNodes);
      var used = new Set();
      var keyed = new Map();
      oldNodes.forEach(function (node) {
        var k = key(node);
        if (k && !keyed.has(k)) keyed.set(k, node);
      });
      var cursor = parent.firstChild;
      newNodes.forEach(function (fresh, index) {
        var k = key(fresh), match = null;
        if (k && keyed.has(k)) match = keyed.get(k);
        if (!match && !k) {
          // Prefer the node at this position, but look ahead before replacing
          // an element when a sibling was inserted ahead of it.
          var candidate = oldNodes[index];
          if (candidate && !used.has(candidate) && !key(candidate) && compatible(candidate, fresh)) match = candidate;
          if (!match) match = oldNodes.find(function (n) {
            return !used.has(n) && !key(n) && compatible(n, fresh);
          });
        }
        if (match && used.has(match)) match = null;
        if (!match || !compatible(match, fresh)) {
          match = fresh.cloneNode(true);
          parent.insertBefore(match, cursor);
        } else {
          sync(match, fresh);
          if (match !== cursor) parent.insertBefore(match, cursor);
        }
        used.add(match);
        cursor = match.nextSibling;
      });
      oldNodes.forEach(function (node) {
        if (!used.has(node) && node.parentNode === parent && !preserve(node)) node.remove();
      });
    }
    children(host, template.content);
    scrolls.forEach(function (item) {
      if (item[0].isConnected) {
        if (item[0].scrollTop !== item[1]) item[0].scrollTop = item[1];
        if (item[0].scrollLeft !== item[2]) item[0].scrollLeft = item[2];
      }
    });
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
    setInterval(check, 5000);
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
