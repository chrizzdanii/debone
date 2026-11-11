/* Live updates (v24): the page reacts straight away when something changes. */
(function () {
  'use strict';
  if (!window.EventSource) return;
  var popState = window.DNotify ? 'ready' : '', popQueue = [];
  function whenPop(fn) {
    if (popState === 'ready') return fn(true);
    if (popState === 'failed') return fn(false);
    popQueue.push(fn);
    if (popState === 'loading') return;
    popState = 'loading';
    var sc = document.createElement('script');
    sc.src = 'notify-pop.js?v=29';
    sc.onload = function () { popState = 'ready'; popQueue.splice(0).forEach(function (f) { f(true); }); };
    sc.onerror = function () { popState = 'failed'; popQueue.splice(0).forEach(function (f) { f(false); }); };
    document.head.appendChild(sc);
  }
  /* Load the pop-up early so the sound is ready the moment something arrives */
  if (document.readyState === 'complete') whenPop(function () {}); else window.addEventListener('load', function () { whenPop(function () {}); });
  var es = new EventSource('/api/events');
  /* On the Vercel host the server cannot keep a live connection open. It tells the browser to stop (HTTP 204),
     and the page then asks for fresh data every 8 seconds while the tab is visible. */
  var polling = false;
  es.addEventListener('error', function () {
    if (es.readyState !== 2 || polling) return;
    polling = true;
    setInterval(function () { if (!document.hidden) window.dispatchEvent(new CustomEvent('debone:refresh')); }, 8000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) window.dispatchEvent(new CustomEvent('debone:refresh')); });
    window.addEventListener('focus', function () { window.dispatchEvent(new CustomEvent('debone:refresh')); });
  });
  es.addEventListener('refresh', function () { window.dispatchEvent(new CustomEvent('debone:refresh')); });
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
