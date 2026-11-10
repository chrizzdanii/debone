/* Notification pop-up (v29): an animated pop-up with a sound for every assignment, announcement,
   live class and mark sent from the admin panel. window.DNotify.show({ title, body, kind, link, course, marks }) */
(function () {
  'use strict';
  if (window.DNotify) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Load the styles once (works from every page that loads this file) */
  (function () {
    var me = document.currentScript, href = 'notify-pop.css?v=29';
    if (me && me.src) href = me.src.replace(/notify-pop\.js.*$/, 'notify-pop.css?v=29');
    if (!document.querySelector('link[data-np-css]')) {
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.setAttribute('data-np-css', '1');
      document.head.appendChild(l);
    }
  })();

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* Kinds: label, colour and icon */
  var KINDS = {
    assignment:   { label: 'New assignment', c: '#E0A800', icon: 'pen',       cta: 'Open assignment' },
    announcement: { label: 'Announcement',   c: '#FF6B4A', icon: 'megaphone', cta: 'Read announcement' },
    live:         { label: 'Live class',     c: '#FF4D6D', icon: 'live',      cta: 'Go to live class' },
    graded:       { label: 'Work marked',    c: '#4FD18B', icon: 'check',     cta: 'See my marks' },
    payment:      { label: 'Payment',        c: '#4FD18B', icon: 'check',     cta: 'Start learning' },
    update:       { label: 'Notification',   c: '#E0A800', icon: 'bell',      cta: 'Open' }
  };
  function icon(name) {
    if (window.DIcons) return DIcons.get(name);
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
  }

  /* ---------- Sound (made in the browser, no audio files needed) ---------- */
  var ctx = null, unlocked = false, pendingSound = null;
  function muted() { try { return localStorage.getItem('debone-np-mute') === '1'; } catch (e) { return false; } }
  function setMuted(v) { try { localStorage.setItem('debone-np-mute', v ? '1' : '0'); } catch (e) { /* ignore */ } }
  function getCtx() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { ctx = null; }
    return ctx;
  }
  function unlock() {
    var c = getCtx();
    if (!c) return;
    var done = function () {
      unlocked = c.state === 'running';
      if (unlocked) {
        document.documentElement.classList.remove('np-needs-tap');
        if (pendingSound) { var k = pendingSound; pendingSound = null; chime(k); }
      }
    };
    if (c.state === 'suspended') c.resume().then(done, done); else done();
  }
  ['pointerdown', 'keydown', 'touchstart', 'click'].forEach(function (ev) { window.addEventListener(ev, unlock, { passive: true }); });

  var MELODY = {
    assignment:   [659.25, 830.61, 987.77, 1318.51],
    announcement: [523.25, 659.25, 783.99, 1046.5],
    live:         [880, 659.25, 880, 1174.66],
    graded:       [587.33, 739.99, 880, 1174.66],
    payment:      [587.33, 739.99, 880, 1174.66],
    update:       [698.46, 880, 1046.5]
  };
  function chime(kind) {
    if (muted()) return;
    var c = getCtx();
    if (!c) return;
    if (c.state !== 'running') {
      pendingSound = kind;
      document.documentElement.classList.add('np-needs-tap');
      c.resume().then(function () { if (c.state === 'running') { unlocked = true; var k = pendingSound; pendingSound = null; document.documentElement.classList.remove('np-needs-tap'); if (k) play(c, k); } }, function () {});
      return;
    }
    play(c, kind);
  }
  function play(c, kind) {
    var notes = MELODY[kind] || MELODY.update, t0 = c.currentTime + 0.03;
    var master = c.createGain(); master.gain.value = 0.9; master.connect(c.destination);
    /* a soft echo so the chime sounds full */
    var delay = c.createDelay(0.6); delay.delayTime.value = 0.19;
    var fb = c.createGain(); fb.gain.value = 0.32;
    var wet = c.createGain(); wet.gain.value = 0.38;
    delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);
    notes.forEach(function (f, i) {
      var t = t0 + i * 0.115, last = i === notes.length - 1;
      [[f, 'sine', 0.2], [f * 2, 'triangle', 0.07], [f * 3.01, 'sine', 0.025]].forEach(function (p) {
        var o = c.createOscillator(), g = c.createGain();
        o.type = p[1]; o.frequency.value = p[0];
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(p[2], t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + (last ? 1.3 : 0.5));
        o.connect(g); g.connect(master); g.connect(delay);
        o.start(t); o.stop(t + (last ? 1.4 : 0.6));
      });
    });
    setTimeout(function () { try { master.disconnect(); } catch (e) { /* ignore */ } }, 3200);
    try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate([70, 50, 70]); } catch (e) { /* ignore */ }
  }

  /* ---------- Pop-up ---------- */
  var layer = null, queue = [], current = null, origTitle = document.title, titleTimer = null;

  function ensureLayer() {
    if (layer) return layer;
    layer = document.createElement('div');
    layer.className = 'np-layer';
    layer.innerHTML = '<div class="np-scrim"></div>';
    document.body.appendChild(layer);
    return layer;
  }

  function particles(n) {
    var out = '';
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + Math.random() * 0.4, d = 90 + Math.random() * 120;
      out += '<i style="--dx:' + Math.round(Math.cos(a) * d) + 'px;--dy:' + Math.round(Math.sin(a) * d - 20) + 'px;--r:' + Math.round(Math.random() * 540 - 270) + 'deg;--s:' + (0.5 + Math.random() * 0.9).toFixed(2) + ';--dl:' + (Math.random() * 0.18).toFixed(2) + 's"></i>';
    }
    return out;
  }

  function flashTitle(text) {
    if (!document.hidden) return;
    clearInterval(titleTimer);
    var on = false;
    titleTimer = setInterval(function () { on = !on; document.title = on ? '🔔 ' + text : origTitle; }, 1100);
    var stop = function () { if (!document.hidden) { clearInterval(titleTimer); document.title = origTitle; document.removeEventListener('visibilitychange', stop); } };
    document.addEventListener('visibilitychange', stop);
  }

  var seenTimer = null;
  function markSeen() {
    if (!/dashboard/.test(location.pathname)) return;
    clearTimeout(seenTimer);
    seenTimer = setTimeout(function () {
      fetch('/api/notifications/read', { method: 'POST', credentials: 'same-origin' }).then(function () { window.dispatchEvent(new CustomEvent('debone:notice-read')); }).catch(function () {});
    }, 400);
  }

  function show(n) {
    n = n || {};
    queue.push(n);
    if (!current) next();
  }

  function next() {
    var n = queue.shift();
    if (!n) { current = null; return; }
    var k = KINDS[n.kind] || KINDS.update;
    var host = ensureLayer();
    var total = queue.length + 1;
    var card = document.createElement('article');
    card.className = 'np-card np-k-' + (KINDS[n.kind] ? n.kind : 'update');
    card.style.setProperty('--np-c', k.c);
    card.setAttribute('role', 'alertdialog');
    card.setAttribute('aria-live', 'assertive');
    card.setAttribute('aria-label', k.label + ': ' + (n.title || ''));
    var chips = '';
    if (n.course) chips += '<span class="np-chip">' + icon('book') + esc(n.course) + '</span>';
    if (n.marks) chips += '<span class="np-chip">' + icon('trend') + esc(n.marks) + ' marks</span>';
    if (n.at) {
      var d = new Date(n.at);
      if (!isNaN(d)) chips += '<span class="np-chip">' + icon('calendar') + esc(d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })) + '</span>';
    }
    var isLink = !!n.link;
    card.innerHTML =
      '<span class="np-edge" aria-hidden="true"></span>' +
      '<span class="np-shine" aria-hidden="true"></span>' +
      '<span class="np-burst" aria-hidden="true">' + particles(18) + '</span>' +
      '<button type="button" class="np-mute" aria-label="Turn alert sound off" title="Sound">' + soundIcon(!muted()) + '</button>' +
      '<button type="button" class="np-x" aria-label="Close">&times;</button>' +
      '<div class="np-icon" aria-hidden="true"><span class="np-ring"></span><span class="np-ring r2"></span><span class="np-ring r3"></span><span class="np-ico">' + icon(k.icon) + '</span></div>' +
      '<p class="np-kind"><span class="np-dot"></span>' + esc(k.label) + (total > 1 ? '<em>1 of ' + total + '</em>' : '') + '</p>' +
      '<h3 class="np-title">' + esc(n.title || 'New notification') + '</h3>' +
      (n.body ? '<p class="np-body">' + esc(n.body) + '</p>' : '') +
      (chips ? '<div class="np-chips">' + chips + '</div>' : '') +
      '<p class="np-tap">🔇 Tap anywhere to turn the alert sound on</p>' +
      '<div class="np-actions">' +
        (isLink ? '<button type="button" class="np-btn np-go">' + esc(k.cta) + ' ' + arrow() + '</button>' : '') +
        '<button type="button" class="np-btn np-ghost np-ok">' + (queue.length ? 'Next' : (isLink ? 'Later' : 'Got it')) + '</button>' +
      '</div>' +
      '<i class="np-bar"></i>';
    host.appendChild(card);
    host.classList.add('on');
    document.body.classList.add('np-lock');
    current = card;
    var closed = false, timer = null;
    var life = reduce ? 12000 : 9000;
    card.style.setProperty('--np-life', life + 'ms');
    function close(go) {
      if (closed) return; closed = true;
      markSeen();
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      card.classList.add('out');
      var more = queue.length > 0;
      if (!more) host.classList.remove('on');
      setTimeout(function () {
        card.remove(); current = null;
        if (!more) document.body.classList.remove('np-lock');
        if (go && n.link) {
          if (n.link.charAt(0) === '#') { if (location.pathname.indexOf('dashboard') < 0) location.href = 'dashboard.html' + n.link; else location.hash = n.link; }
          else location.href = n.link;
        }
        next();
      }, reduce ? 0 : 420);
    }
    function onKey(e) { if (e.key === 'Escape') close(false); if (e.key === 'Enter' && isLink && document.activeElement === document.body) close(true); }
    document.addEventListener('keydown', onKey);
    card.querySelector('.np-x').addEventListener('click', function () { close(false); });
    card.querySelector('.np-ok').addEventListener('click', function () { close(false); });
    var go = card.querySelector('.np-go');
    if (go) go.addEventListener('click', function () { close(true); });
    var mute = card.querySelector('.np-mute');
    mute.addEventListener('click', function (e) {
      e.stopPropagation();
      var m = !muted(); setMuted(m);
      mute.innerHTML = soundIcon(!m);
      mute.setAttribute('aria-label', m ? 'Turn alert sound on' : 'Turn alert sound off');
      if (!m) { unlock(); chime(n.kind); }
    });
    host.querySelector('.np-scrim').onclick = function () { close(false); };
    function arm() { timer = setTimeout(function () { close(false); }, life); }
    arm();
    card.addEventListener('mouseenter', function () { clearTimeout(timer); card.classList.add('hold'); });
    card.addEventListener('mouseleave', function () { card.classList.remove('hold'); arm(); });

    requestAnimationFrame(function () { requestAnimationFrame(function () { card.classList.add('in'); }); });
    chime(KINDS[n.kind] ? n.kind : 'update');
    flashTitle(n.title || k.label);
    var focus = card.querySelector('.np-go') || card.querySelector('.np-ok');
    setTimeout(function () { try { focus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 700);
  }

  function arrow() { return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'; }
  function soundIcon(on) {
    return '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/>' +
      (on ? '<path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>' : '<path d="M16 9.5l5 5M21 9.5l-5 5"/>') + '</svg>';
  }

  /* Catch-up: pop up what the student missed while they were away (dashboard only) */
  function catchUp() {
    if (!/dashboard/.test(location.pathname)) return;
    fetch('/api/notifications', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d || !d.unread) return;
      var seen = d.seenAt || '', weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
      var fresh = d.items.filter(function (i) { return i.createdAt && i.createdAt > seen && i.createdAt > weekAgo && i.kind !== 'submission'; }).slice(0, 3).reverse();
      if (!fresh.length) return;
      var kindMap = { announcement: 'announcement', assignment: 'assignment', live: 'live', graded: 'graded' };
      fresh.forEach(function (i) { show({ title: i.title, body: i.body, link: i.link, kind: kindMap[i.kind] || 'update' }); });
      fetch('/api/notifications/read', { method: 'POST', credentials: 'same-origin' }).then(function () { window.dispatchEvent(new CustomEvent('debone:notice-read')); }).catch(function () {});
    }).catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(catchUp, 1200); });
  else setTimeout(catchUp, 1200);

  window.DNotify = { show: show, chime: chime, isMuted: muted };
})();
