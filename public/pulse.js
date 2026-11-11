/* Pulse (v51): asks the server once a second "has anything changed?". It is a tiny request.
   When the answer is yes, the page is told, and it updates itself in place. Nobody has to refresh. */
(function () {
  'use strict';
  var last = null, timer = null, stopped = false, idleAt = Date.now(), busy = false;
  ['pointerdown', 'keydown', 'touchstart', 'wheel', 'mousemove'].forEach(function (ev) {
    window.addEventListener(ev, function () { idleAt = Date.now(); }, { passive: true });
  });
  function delay() {
    if (document.hidden) return 4000;                    // tab in the background
    return Date.now() - idleAt > 90000 ? 4000 : 1000;    // once a second while someone is using the page
  }
  function tick() {
    if (stopped) return;
    if (busy) { timer = setTimeout(tick, delay()); return; }
    busy = true;
    fetch('/api/pulse', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) {
      if (r.status === 401) { stopped = true; return null; }
      return r.ok ? r.json() : null;
    }).then(function (d) {
      if (d && d.v != null) {
        if (last !== null && d.v !== last) window.dispatchEvent(new CustomEvent('debone:refresh'));
        last = d.v;
      }
    }).catch(function () {}).then(function () { busy = false; if (!stopped) timer = setTimeout(tick, delay()); });
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && !stopped) { clearTimeout(timer); tick(); } });
  window.addEventListener('focus', function () { if (!stopped) { clearTimeout(timer); tick(); } });
  window.DPulse = { poke: function () { clearTimeout(timer); tick(); } };   // pages call this right after they change something
  tick();
})();
