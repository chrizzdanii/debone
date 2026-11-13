/* DEBONE overview dashboards (v1): one module for the admin and the student home screens.
   Everything updates in place (no page rebuild), numbers count up, charts draw and morph, and an "updated Xs ago" pill shows it is live. */
(function () {
  'use strict';
  var reduced = function () { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function naira(n) { return '₦' + Math.round(Number(n) || 0).toLocaleString('en-US'); }
  function compact(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return '₦' + (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (n >= 1e4) return '₦' + (n / 1e3).toFixed(0) + 'K';
    return naira(n);
  }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function ease(p) { return 1 - Math.pow(1 - p, 3); }

  var IC = {
    live: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5l6-3.5v10l-6-3.5"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/></svg>',
    card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6 15h4"/></svg>',
    mega: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10v4a1 1 0 0 0 1 1h2l6 4V5L6 9H4a1 1 0 0 0-1 1z"/><path d="M16 8.5a5 5 0 0 1 0 7"/></svg>',
    img: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><circle cx="8" cy="15" r="1.6"/><path d="M11 17l3-3 4 4"/></svg>',
    cert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5"/><path d="M8.5 13.5L7 21l5-2.5 5 2.5-1.5-7.5"/></svg>',
    compass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5.5a3.5 3.5 0 0 1 0 6.5M18 20a6.5 6.5 0 0 0-3-5.5"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14l-5-5 5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3L5 14h6l-1 7 8-11h-6z"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    trend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
    cap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c3 2.5 9 2.5 12 0v-4.5"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>'
  };

  /* ---------- Animation helpers ---------- */
  /* Count a number up (or from its current value to a new one) */
  function tween(el, to, fmt, dur) {
    fmt = fmt || function (v) { return Math.round(v).toLocaleString('en-US'); };
    to = Number(to) || 0;
    var from = el._v == null ? 0 : el._v;
    if (el._raf) cancelAnimationFrame(el._raf);
    if (reduced() || from === to) { el._v = to; el.textContent = fmt(to); return; }
    var t0 = null; dur = dur || (el._v == null ? 1300 : 800);
    if (el._v != null) { el.classList.remove('ov-bump'); void el.offsetWidth; el.classList.add('ov-bump'); }
    (function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1), v = from + (to - from) * ease(p);
      el._v = v; el.textContent = fmt(v);
      if (p < 1) el._raf = requestAnimationFrame(step); else { el._v = to; el.textContent = fmt(to); }
    })(performance.now());
  }
  function countAll(root) {
    $$('[data-ov-n]', root).forEach(function (el) {
      var f = el.getAttribute('data-fmt');
      tween(el, el.getAttribute('data-ov-n'), f === 'naira' ? naira : f === 'compact' ? compact : null);
    });
  }

  /* Smooth line through points (Catmull-Rom turned into Bezier curves) */
  function smooth(pts) {
    if (pts.length < 2) return '';
    var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2, t = 0.18;
      d += ' C' + (p1[0] + (p2[0] - p0[0]) * t).toFixed(1) + ' ' + (p1[1] + (p2[1] - p0[1]) * t).toFixed(1) + ',' +
        (p2[0] - (p3[0] - p1[0]) * t).toFixed(1) + ' ' + (p2[1] - (p3[1] - p1[1]) * t).toFixed(1) + ',' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    return d;
  }
  function pointsOf(vals, w, h, pad, max) {
    max = max || Math.max.apply(null, vals.concat([1]));
    var n = vals.length;
    return vals.map(function (v, i) { return [pad + (n < 2 ? 0 : i * (w - pad * 2) / (n - 1)), h - pad - (v / max) * (h - pad * 2)]; });
  }

  /* Small line under a KPI number */
  var uid = 0;
  function spark(vals, color) {
    var id = 'sg' + (++uid), w = 120, h = 38, pts = pointsOf(vals, w, h, 3);
    var line = smooth(pts), area = line + ' L' + pts[pts.length - 1][0] + ' ' + h + ' L' + pts[0][0] + ' ' + h + ' Z';
    return '<svg class="ov-spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + color + '" stop-opacity=".35"/><stop offset="1" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
      '<path class="ov-spark-a" d="' + area + '" fill="url(#' + id + ')"/><path class="ov-spark-l" pathLength="1" d="' + line + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>';
  }

  function ago(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    if (s < 5) return 'just now';
    if (s < 60) return s + 's ago';
    var m = Math.round(s / 60); if (m < 60) return m + ' min ago';
    var h = Math.round(m / 60); if (h < 24) return h + ' h ago';
    return Math.round(h / 24) + ' d ago';
  }
  function dayLabel(k) { var d = new Date(k + 'T12:00:00Z'); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }); }
  function greeting() { var h = new Date().getHours(); return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
  function today() { return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }); }

  /* One shared clock for every "updated Xs ago" label on the screen */
  var clockTimer = null;
  function startClock() {
    if (clockTimer) return;
    clockTimer = setInterval(function () {
      var els = $$('[data-ov-at]');
      if (!els.length) { clearInterval(clockTimer); clockTimer = null; return; }
      els.forEach(function (el) {
        var at = Number(el.getAttribute('data-ov-at')); if (!at) return;
        el.textContent = ago(Date.now() - at);
        var pill = el.closest('.ov-live'); if (pill) pill.classList.toggle('stale', Date.now() - at > 30000);
      });
    }, 1000);
  }
  function stamp(root) {
    $$('[data-ov-at]', root).forEach(function (el) { el.setAttribute('data-ov-at', Date.now()); el.textContent = 'just now'; var p = el.closest('.ov-live'); if (p) p.classList.remove('stale'); });
    startClock();
  }

  /* Cards fade and rise one after another; this also reveals them as they scroll into view */
  function reveal(root) {
    var items = $$('[data-rise]', root);
    if (reduced() || !('IntersectionObserver' in window)) { items.forEach(function (e) { e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -6% 0px', threshold: .08 });
    items.forEach(function (e, i) { e.style.setProperty('--d', (i % 6) * 70 + 'ms'); io.observe(e); });
  }

  /* Cards lean towards the finger or pointer (only where hover exists, never while scrolling on touch) */
  function tilt(root) {
    if (reduced() || !window.matchMedia('(hover:hover)').matches) return;
    $$('.ov-kpi,.ov-act', root).forEach(function (c) {
      c.addEventListener('pointermove', function (e) {
        var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        c.style.setProperty('--rx', (-y * 5).toFixed(2) + 'deg'); c.style.setProperty('--ry', (x * 6).toFixed(2) + 'deg');
        c.style.setProperty('--mx', ((x + .5) * 100).toFixed(0) + '%'); c.style.setProperty('--my', ((y + .5) * 100).toFixed(0) + '%');
      });
      c.addEventListener('pointerleave', function () { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
    });
  }

  /* =====================================================================
     ADMIN AND INSTRUCTOR
     ===================================================================== */
  var KIND = { sale: ['sale', IC.card], signup: ['signup', IC.users], enrol: ['enrol', IC.cap], work: ['work', IC.pen], class: ['class', IC.live], lesson: ['lesson', IC.check] };
  var MIX = { course: ['Courses', '#E0A800'], bundle: ['Bundles', '#6BCB77'], product: ['Digital products', '#7aa7ff'], deposit: ['Studio deposits', '#ff8fa3'] };
  var METRICS = {
    revenue: { label: 'Revenue', key: 'revenue', money: true, color: '#E0A800' },
    signups: { label: 'Sign ups', key: 'signups', color: '#6BCB77' },
    enrolments: { label: 'Enrolments', key: 'enrolments', color: '#7aa7ff' },
    views: { label: 'Page views', key: 'views', color: '#ff8fa3' }
  };

  function kpiCard(i, o) {
    var color = o.color || '#E0A800';
    return '<article class="ov-kpi" data-rise style="--i:' + i + ';--c:' + color + '" data-k="' + o.id + '">' +
      '<div class="ov-kpi-top"><span class="ov-ico">' + (o.icon || '') + '</span><span class="ov-kpi-l">' + esc(o.label) + '</span></div>' +
      '<b class="ov-num" data-ov-n="' + (Number(o.value) || 0) + '"' + (o.fmt ? ' data-fmt="' + o.fmt + '"' : '') + '>0</b>' +
      '<em class="ov-sub' + (o.up ? ' up' : '') + '">' + (o.sub || '&nbsp;') + '</em>' +
      (o.series ? spark(o.series, color) : '') + '</article>';
  }

  function adminKpis(d) {
    var k = d.kpi, s = d.series, sum7 = function (a) { return a.slice(-7).reduce(function (t, v) { return t + v; }, 0); };
    return [
      { id: 'rev30', label: 'Revenue, 30 days', value: k.revenue30, fmt: 'compact', icon: IC.trend, color: '#E0A800', series: s.revenue, sub: 'Today ' + naira(k.revenueToday), up: k.revenueToday > 0 },
      { id: 'students', label: 'Students', value: k.students, icon: IC.users, color: '#6BCB77', series: s.signups, sub: (k.signupsToday ? '+' + k.signupsToday + ' today' : sum7(s.signups) + ' this week'), up: k.signupsToday > 0 },
      { id: 'enrol', label: 'Active enrolments', value: k.enrollments, icon: IC.cap, color: '#7aa7ff', series: s.enrolments, sub: sum7(s.enrolments) + ' new this week', up: sum7(s.enrolments) > 0 },
      { id: 'online', label: 'Online now', value: k.online, icon: IC.bolt, color: '#ff8fa3', sub: k.onlineStudents + ' signed in students', up: k.online > 0 },
      { id: 'revall', label: 'Total revenue', value: k.revenueAll, fmt: 'compact', icon: IC.card, color: '#E0A800', sub: k.orders + ' paid orders' },
      { id: 'lessons', label: 'Lessons done today', value: k.lessonsToday, icon: IC.check, color: '#6BCB77', series: s.lessons, sub: sum7(s.lessons) + ' this week' },
      { id: 'views', label: 'Page views today', value: k.viewsToday, icon: IC.eye, color: '#7aa7ff', series: s.views, sub: sum7(s.views).toLocaleString('en-US') + ' this week' },
      { id: 'live', label: 'Live classes now', value: k.liveNow, icon: IC.live, color: '#ff4d6d', sub: k.liveNow ? 'Happening right now' : 'None running' }
    ];
  }

  function attention(k) {
    var items = [
      { n: k.pendingOrders, label: 'Payments to approve', href: '#transfers', icon: IC.card },
      { n: k.pendingGrading, label: 'Assignments to mark', href: '#assignments', icon: IC.pen },
      { n: k.pendingRefunds, label: 'Refund requests', href: '#refunds', icon: IC.undo },
      { n: k.pendingCerts, label: 'Certificate requests', href: '#certificates', icon: IC.cert }
    ].filter(function (x) { return x.n > 0; });
    if (!items.length) return '<div class="ov-clear"><span>' + IC.check + '</span><div><b>All clear</b><small>Nothing is waiting for you right now.</small></div></div>';
    return items.map(function (x, i) {
      return '<a class="ov-chip" href="' + x.href + '" style="--i:' + i + '"><span class="ov-chip-i">' + x.icon + '</span><span><b data-ov-n="' + x.n + '">0</b> ' + esc(x.label) + '</span>' + IC.chev + '</a>';
    }).join('');
  }

  function feedItem(f, fresh) {
    var K = KIND[f.kind] || KIND.lesson;
    return '<li class="ov-fi ' + K[0] + (fresh ? ' fresh' : '') + '" data-key="' + esc(f.t + '|' + f.text) + '"><span class="ov-fi-i">' + K[1] + '</span><span class="ov-fi-t">' + esc(f.text) + '</span><time data-t="' + esc(f.t) + '">' + ago(Date.now() - new Date(f.t).getTime()) + '</time></li>';
  }

  function coursesList(list) {
    var rows = (list || []).filter(function (c) { return c.students > 0 || c.revenue > 0; }).slice(0, 6);
    if (!rows.length) rows = (list || []).slice(0, 6);
    var max = Math.max.apply(null, rows.map(function (c) { return c.students; }).concat([1]));
    if (!rows.length) return '<p class="ov-empty">No courses yet.</p>';
    return rows.map(function (c, i) {
      return '<div class="ov-bar" style="--i:' + i + '"><div class="ov-bar-h"><b>' + esc(c.title) + '</b><span><strong data-ov-n="' + c.students + '">0</strong> students</span></div>' +
        '<div class="ov-track"><i data-w="' + Math.max(3, Math.round(c.students / max * 100)) + '"></i></div>' +
        '<div class="ov-bar-f"><span>' + c.completion + '% completion</span><span>' + naira(c.revenue) + '</span></div></div>';
    }).join('');
  }

  function donut(byKind) {
    var keys = Object.keys(byKind || {}).filter(function (k) { return byKind[k] > 0; });
    var total = keys.reduce(function (t, k) { return t + byKind[k]; }, 0);
    if (!total) return '<p class="ov-empty">Revenue by type shows here after the first payment.</p>';
    var R = 52, C = 2 * Math.PI * R, off = 0, segs = '', legend = '';
    keys.forEach(function (k, i) {
      var m = MIX[k] || [k, '#999'], len = byKind[k] / total * C;
      segs += '<circle class="ov-seg" cx="70" cy="70" r="' + R + '" fill="none" stroke="' + m[1] + '" stroke-width="16" stroke-dasharray="' + Math.max(len - 3, 1).toFixed(1) + ' ' + (C - Math.max(len - 3, 1)).toFixed(1) + '" stroke-dashoffset="' + (-off).toFixed(1) + '" style="--i:' + i + '"/>';
      legend += '<li><i style="background:' + m[1] + '"></i><span>' + esc(m[0]) + '</span><b>' + Math.round(byKind[k] / total * 100) + '%</b></li>';
      off += len;
    });
    return '<div class="ov-donut"><svg viewBox="0 0 140 140" aria-hidden="true"><g transform="rotate(-90 70 70)">' + segs + '</g></svg><div class="ov-donut-c"><small>Total</small><b>' + compact(total) + '</b></div></div><ul class="ov-legend">' + legend + '</ul>';
  }

  function liveCard(d) {
    var live = d.liveSessions || [], act = d.activeNow || [];
    return (live.length ? live.map(function (s) { return '<a class="ov-onair" href="#live"><span class="ov-pulse"><i></i></span><div><b>' + esc(s.title) + '</b><small>' + esc(s.course) + '</small></div><em>' + s.attendees + ' in</em></a>'; }).join('')
      : '<p class="ov-empty">No class is live right now.</p>') +
      '<p class="ov-mini">People online</p>' +
      (act.length ? '<div class="ov-people">' + act.map(function (p) { return '<span title="' + esc(p.page) + '"><i>' + esc((p.name || '?').charAt(0).toUpperCase()) + '</i>' + esc(p.name) + '</span>'; }).join('') + '</div>' : '<p class="ov-empty">No signed in students on the site at the moment.</p>');
  }

  var ACTIONS_ADMIN = [
    { h: '#live', l: 'Schedule a live class', i: IC.live }, { h: '#assignments', l: 'Create an assignment', i: IC.pen },
    { h: '#courses', l: 'Add a course', i: IC.book }, { h: '#transfers', l: 'Approve payments', i: IC.card },
    { h: '#announce', l: 'Post an announcement', i: IC.mega }, { h: '#pages', l: 'Edit page content', i: IC.img }
  ];
  var ACTIONS_STAFF = [{ h: '#live', l: 'Schedule a live class', i: IC.live }, { h: '#assignments', l: 'Create an assignment', i: IC.pen }];
  function actions(list) {
    return list.map(function (a, i) { return '<a class="ov-act" href="' + a.h + '" data-rise style="--i:' + i + '"><span>' + a.i + '</span><b>' + esc(a.l) + '</b>' + IC.chev + '</a>'; }).join('');
  }

  function heroAdmin(name, role) {
    return '<section class="ov-hero" data-rise><div class="ov-aur a"></div><div class="ov-aur b"></div><div class="ov-grid-bg"></div>' +
      '<div class="ov-hero-top"><span class="ov-eyebrow">' + esc(today()) + '</span><span class="ov-live"><i></i>Live<em data-ov-at="0">just now</em></span></div>' +
      '<h1>' + esc(greeting()) + ',<br><span>' + esc(name) + '</span></h1>' +
      '<p class="ov-lead" id="ov-lead">Loading what is happening right now…</p>' +
      '<div class="ov-hero-stats" id="ov-hs"></div></section>';
  }

  var adminState = null;

  function mountAdmin(view, o) {
    var me = o.me, isAdmin = o.isAdmin, api = o.api;
    var first = (me.name || 'there').split(' ')[0];
    view.innerHTML = '<div class="ov" id="ov-root">' + heroAdmin(first, me.role) +
      (isAdmin ? '<section class="ov-attn" id="ov-attn" data-rise></section>' : '') +
      '<section class="ov-kpis" id="ov-kpis"></section>' +
      (isAdmin ? '<div class="ov-cols">' +
        '<section class="ov-card wide" data-rise><header><div><p class="ov-ey">Trend</p><h3 id="ov-ct">Revenue</h3></div><div class="ov-ctl"><div class="ov-tabs" id="ov-m" role="tablist" aria-label="Metric">' +
          Object.keys(METRICS).map(function (k, i) { return '<button type="button" role="tab" data-m="' + k + '"' + (i ? '' : ' class="on" aria-selected="true"') + '>' + METRICS[k].label + '</button>'; }).join('') +
        '</div><div class="ov-tabs sm" id="ov-r" role="tablist" aria-label="Range"><button type="button" data-r="7">7d</button><button type="button" data-r="14">14d</button><button type="button" class="on" data-r="30">30d</button></div></div></header>' +
          '<div class="ov-chart" id="ov-chart"><div class="ov-tip" id="ov-tip"></div></div><div class="ov-axis" id="ov-axis"></div></section>' +
        '<section class="ov-card" data-rise><header><div><p class="ov-ey">Learners</p><h3>Top courses</h3></div><a class="ov-more" href="#reports">Reports</a></header><div id="ov-courses"></div></section>' +
        '<section class="ov-card" data-rise><header><div><p class="ov-ey">Money</p><h3>Revenue mix</h3></div></header><div id="ov-mix"></div></section>' +
        '<section class="ov-card" data-rise><header><div><p class="ov-ey">Right now</p><h3>Live and online</h3></div><a class="ov-more" href="#live">Classes</a></header><div id="ov-live-card"></div></section>' +
        '<section class="ov-card tall" data-rise><header><div><p class="ov-ey">Activity</p><h3>What just happened</h3></div><span class="ov-live sm"><i></i>Live</span></header><ul class="ov-feed" id="ov-feed"></ul></section>' +
      '</div>' : '') +
      '<p class="ov-ey ov-sec" data-rise>Quick actions</p><section class="ov-acts">' + actions(isAdmin ? ACTIONS_ADMIN : ACTIONS_STAFF) + '</section></div>';
    var root = $('#ov-root', view);
    adminState = { root: root, metric: 'revenue', range: 30, d: null, first: true, api: api, isAdmin: isAdmin, base: null, feedKeys: {} };
    reveal(root); tilt(root);

    /* Tabs: switching metric or range redraws the chart with a fresh draw animation */
    if (isAdmin) {
      $('#ov-m', root).addEventListener('click', function (e) {
        var b = e.target.closest('button[data-m]'); if (!b) return;
        $$('#ov-m button', root).forEach(function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
        adminState.metric = b.getAttribute('data-m'); drawChart(true);
      });
      $('#ov-r', root).addEventListener('click', function (e) {
        var b = e.target.closest('button[data-r]'); if (!b) return;
        $$('#ov-r button', root).forEach(function (x) { x.classList.toggle('on', x === b); });
        adminState.range = Number(b.getAttribute('data-r')); drawChart(true);
      });
    }
    return pullAdmin();
  }

  function setLead(d, base) {
    var lead = $('#ov-lead'); if (!lead) return;
    var hs = $('#ov-hs');
    if (d) {
      var k = d.kpi;
      lead.innerHTML = k.online ? '<b>' + k.online + '</b> ' + (k.online === 1 ? 'person is' : 'people are') + ' on the site right now. ' + (k.revenueToday ? 'You have taken <b>' + naira(k.revenueToday) + '</b> today.' : 'No payments yet today.') : (k.revenueToday ? 'You have taken <b>' + naira(k.revenueToday) + '</b> today.' : 'A quiet moment. New activity shows up here by itself.');
      var need = k.pendingOrders + k.pendingGrading + k.pendingRefunds + k.pendingCerts;
      hs.innerHTML = '<div><b data-ov-n="' + k.online + '">0</b><span>Online</span></div><div><b data-ov-n="' + k.liveNow + '">0</b><span>Live classes</span></div><div class="' + (need ? 'warn' : '') + '"><b data-ov-n="' + need + '">0</b><span>Need you</span></div>';
      countAll(hs);
    } else if (base) {
      lead.textContent = base.liveNow ? base.liveNow + ' live class' + (base.liveNow === 1 ? ' is' : 'es are') + ' running now.' : 'Here is what needs your attention today.';
      hs.innerHTML = '<div><b data-ov-n="' + base.liveNow + '">0</b><span>Live now</span></div><div class="' + (base.pendingGrading ? 'warn' : '') + '"><b data-ov-n="' + base.pendingGrading + '">0</b><span>To mark</span></div><div><b data-ov-n="' + base.courses + '">0</b><span>Courses</span></div>';
      countAll(hs);
    }
  }

  function paintAdmin(d) {
    var st = adminState; if (!st || !document.body.contains(st.root)) return;
    var first = st.first; st.first = false; st.d = d;
    setLead(d);
    var attn = $('#ov-attn', st.root); if (attn) { attn.innerHTML = attention(d.kpi); countAll(attn); }
    /* KPI cards: build once, then only change the numbers so nothing flashes */
    var kp = $('#ov-kpis', st.root), cards = adminKpis(d);
    if (!kp.children.length) { kp.innerHTML = cards.map(function (c, i) { return kpiCard(i, c); }).join(''); reveal(kp); tilt(kp); countAll(kp); }
    else cards.forEach(function (c) {
      var el = $('[data-k="' + c.id + '"]', kp); if (!el) return;
      var n = $('.ov-num', el); if (n) tween(n, c.value, c.fmt === 'compact' ? compact : null);
      var s = $('.ov-sub', el); if (s) { s.innerHTML = c.sub || '&nbsp;'; s.classList.toggle('up', !!c.up); }
      if (c.series) { var old = $('.ov-spark', el); if (old) { var tmp = document.createElement('div'); tmp.innerHTML = spark(c.series, c.color); var nu = tmp.firstChild; nu.classList.add('still'); old.replaceWith(nu); } }
    });
    drawChart(first);
    var cl = $('#ov-courses', st.root); if (cl) { cl.innerHTML = coursesList(d.courses); countAll(cl); setTimeout(function () { $$('.ov-track i', cl).forEach(function (i) { i.style.width = i.getAttribute('data-w') + '%'; }); }, 80); }
    var mx = $('#ov-mix', st.root); if (mx) { var sig = JSON.stringify(d.byKind); if (mx._sig !== sig) { mx._sig = sig; mx.innerHTML = donut(d.byKind); } }
    var lc = $('#ov-live-card', st.root); if (lc) lc.innerHTML = liveCard(d);
    paintFeed(d.feed || [], first);
    stamp(st.root);
  }

  function paintFeed(feed, first) {
    var ul = $('#ov-feed', adminState.root); if (!ul) return;
    var keys = adminState.feedKeys;
    if (first || !ul.children.length) {
      ul.innerHTML = feed.length ? feed.map(function (f, i) { keys[f.t + '|' + f.text] = 1; return feedItem(f, false).replace('class="ov-fi', 'style="--i:' + i + '" class="ov-fi'); }).join('') : '<li class="ov-empty">Activity appears here as it happens.</li>';
      return;
    }
    /* Add only what is new, at the top, with a slide in; refresh the "x ago" of the rest */
    var added = feed.filter(function (f) { return !keys[f.t + '|' + f.text]; });
    added.reverse().forEach(function (f) { keys[f.t + '|' + f.text] = 1; ul.insertAdjacentHTML('afterbegin', feedItem(f, true)); });
    while (ul.children.length > 14) ul.lastElementChild.remove();
    $$('time[data-t]', ul).forEach(function (t) { t.textContent = ago(Date.now() - new Date(t.getAttribute('data-t')).getTime()); });
  }

  /* Area chart with a draw-in animation, hover or touch readout, and smooth morphing between data refreshes */
  var CW = 640, CH = 250, CP = 14;
  function drawChart(fresh) {
    var st = adminState; if (!st || !st.d) return;
    var M = METRICS[st.metric], all = st.d.series[M.key] || [], days = st.d.days || [];
    var vals = all.slice(-st.range), dl = days.slice(-st.range);
    var box = $('#ov-chart', st.root); if (!box) return;
    $('#ov-ct', st.root).textContent = M.label + ', last ' + st.range + ' days';
    var max = Math.max.apply(null, vals.concat([1])), total = vals.reduce(function (t, v) { return t + v; }, 0);
    var pts = pointsOf(vals, CW, CH, CP, max), line = smooth(pts);
    var area = line + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + (CH - CP) + ' L' + pts[0][0].toFixed(1) + ' ' + (CH - CP) + ' Z';
    var tip = $('#ov-tip', st.root);
    if (!box._built || fresh) {
      var grid = '';
      for (var g = 0; g < 4; g++) { var y = CP + g * (CH - CP * 2) / 3; grid += '<line x1="0" x2="' + CW + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '"/>'; }
      box.innerHTML = '<div class="ov-ctot"><b id="ov-ctotn">0</b><span>' + (M.money ? 'in ' : 'over ') + st.range + ' days</span></div>' +
        '<svg viewBox="0 0 ' + CW + ' ' + CH + '" role="img" aria-label="' + esc(M.label) + ' chart"><defs><linearGradient id="ovg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + M.color + '" stop-opacity=".42"/><stop offset="1" stop-color="' + M.color + '" stop-opacity="0"/></linearGradient></defs>' +
        '<g class="ov-gl">' + grid + '</g><path id="ov-ca" class="ov-ca" d="' + area + '" fill="url(#ovg)"/><path id="ov-cl" class="ov-cl" pathLength="1" d="' + line + '" fill="none" stroke="' + M.color + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
        '<line id="ov-cur" class="ov-cur" y1="0" y2="' + CH + '"/><circle id="ov-dot" class="ov-dot" r="6" fill="' + M.color + '"/></svg>';
      box.appendChild(tip); box._built = true; box._vals = vals.slice();
      var svg = $('svg', box); svg.classList.remove('draw'); void svg.getBoundingClientRect(); svg.classList.add('draw');
      bindChart(box, svg);
      box._pts = pts; box._d = dl; box._M = M; box._vals = vals;
      tween($('#ov-ctotn', box), total, M.money ? naira : null, 900);
    } else {
      /* Same chart, new numbers: glide each point to its new height */
      var from = (box._vals || []).slice(), to = vals.slice();
      if (from.length !== to.length) from = to.slice();
      var t0 = null, dur = reduced() ? 1 : 700, cl = $('#ov-cl', box), ca = $('#ov-ca', box);
      var newMax = Math.max.apply(null, to.concat([1]));
      (function step(ts) {
        if (!t0) t0 = ts; var p = ease(Math.min((ts - t0) / dur, 1));
        var cur = to.map(function (v, i) { return from[i] + (v - from[i]) * p; });
        var pp = pointsOf(cur, CW, CH, CP, newMax), l = smooth(pp);
        cl.setAttribute('d', l); ca.setAttribute('d', l + ' L' + pp[pp.length - 1][0].toFixed(1) + ' ' + (CH - CP) + ' L' + pp[0][0].toFixed(1) + ' ' + (CH - CP) + ' Z');
        box._pts = pp;
        if (p < 1) requestAnimationFrame(step);
      })(performance.now());
      box._vals = to; box._d = dl; box._M = M;
      tween($('#ov-ctotn', box), total, M.money ? naira : null, 700);
    }
    var ax = $('#ov-axis', st.root);
    if (ax) { var idx = [0, Math.floor((dl.length - 1) / 3), Math.floor((dl.length - 1) * 2 / 3), dl.length - 1]; ax.innerHTML = idx.map(function (i) { return '<span>' + esc(dayLabel(dl[i])) + '</span>'; }).join('') + '<em>Peak ' + (M.money ? naira(max) : max.toLocaleString('en-US')) + '</em>'; }
  }
  function bindChart(box, svg) {
    var cur = $('#ov-cur', box), dot = $('#ov-dot', box), tip = $('#ov-tip', box);
    function move(e) {
      var r = svg.getBoundingClientRect(), pts = box._pts; if (!pts || !r.width) return;
      var x = ((e.clientX - r.left) / r.width) * CW, best = 0, bd = 1e9;
      pts.forEach(function (p, i) { var dd = Math.abs(p[0] - x); if (dd < bd) { bd = dd; best = i; } });
      var p = pts[best], v = box._vals[best];
      cur.setAttribute('x1', p[0]); cur.setAttribute('x2', p[0]); dot.setAttribute('cx', p[0]); dot.setAttribute('cy', p[1]);
      svg.classList.add('hot');
      tip.innerHTML = '<b>' + (box._M.money ? naira(v) : Math.round(v).toLocaleString('en-US')) + '</b><span>' + esc(dayLabel(box._d[best])) + '</span>';
      var left = (p[0] / CW) * r.width; tip.style.left = Math.min(Math.max(left, 52), r.width - 52) + 'px'; tip.style.top = Math.max((p[1] / CH) * r.height - 54, 0) + 'px'; tip.classList.add('on');
    }
    function leave() { svg.classList.remove('hot'); tip.classList.remove('on'); }
    svg.addEventListener('pointermove', move); svg.addEventListener('pointerdown', move); svg.addEventListener('pointerleave', leave); svg.addEventListener('pointercancel', leave);
  }

  var pollTimer = null, polling = false;
  async function pullAdmin() {
    var st = adminState; if (!st) return;
    try {
      if (st.isAdmin) { var d = await st.api('/api/staff/live-stats'); paintAdmin(d); }
      else {
        var b = await st.api('/api/staff/overview'); setLead(null, b);
        var kp = $('#ov-kpis', st.root);
        var cards = [
          { id: 's', label: 'Students', value: b.students, icon: IC.users, color: '#6BCB77' }, { id: 'c', label: 'Courses', value: b.courses, icon: IC.book, color: '#E0A800' },
          { id: 'l', label: 'Live now', value: b.liveNow, icon: IC.live, color: '#ff4d6d', sub: b.liveNow ? 'Happening right now' : 'None running', up: b.liveNow > 0 },
          { id: 'm', label: 'Need marking', value: b.pendingGrading, icon: IC.pen, color: '#7aa7ff', sub: b.pendingGrading ? 'Waiting for you' : 'All marked', up: !b.pendingGrading }
        ];
        if (!kp.children.length) { kp.innerHTML = cards.map(function (c, i) { return kpiCard(i, c); }).join(''); reveal(kp); tilt(kp); countAll(kp); }
        else cards.forEach(function (c) { var n = $('[data-k="' + c.id + '"] .ov-num', kp); if (n) tween(n, c.value); });
        stamp(st.root);
      }
    } catch (e) { var p = $('.ov-live', st.root); if (p) p.classList.add('stale'); }
  }
  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(function () {
      if (!adminState || !document.body.contains(adminState.root)) { clearInterval(pollTimer); pollTimer = null; adminState = null; return; }
      if (document.hidden || polling) return;
      var busy = window.DLive && DLive.busy && DLive.busy(); if (busy) return;
      polling = true; pullAdmin().then(function () { polling = false; }, function () { polling = false; });
    }, 6000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && adminState) pullAdmin(); });
  }

  /* =====================================================================
     STUDENT
     ===================================================================== */
  function ring(pct, size) {
    var R = 46, C = 2 * Math.PI * R;
    return '<div class="ov-ring" style="--s:' + (size || 150) + 'px" data-pct="' + pct + '"><svg viewBox="0 0 110 110" aria-hidden="true"><defs><linearGradient id="ovrg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F6C945"/><stop offset="1" stop-color="#E0A800"/></linearGradient></defs>' +
      '<circle cx="55" cy="55" r="' + R + '" class="t"/><circle cx="55" cy="55" r="' + R + '" class="v" stroke="url(#ovrg)" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + C.toFixed(1) + '" data-c="' + C.toFixed(1) + '"/></svg>' +
      '<div class="ov-ring-n"><b data-ov-n="' + pct + '">0</b><small>%</small></div></div>';
  }
  function setRing(r, pct) {
    var v = $('.v', r), c = Number(v.getAttribute('data-c'));
    setTimeout(function () { v.style.strokeDashoffset = (c * (1 - Math.min(Math.max(pct, 0), 100) / 100)).toFixed(1); }, 60);
  }
  function miniRing(pct) {
    var R = 15, C = 2 * Math.PI * R;
    return '<svg class="ov-mr" viewBox="0 0 38 38" aria-hidden="true"><circle cx="19" cy="19" r="' + R + '" class="t"/><circle cx="19" cy="19" r="' + R + '" class="v" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + C.toFixed(1) + '" data-c="' + C.toFixed(1) + '" data-pct="' + pct + '"/></svg>';
  }
  function fmtD(iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }

  function studentHTML(d, h) {
    var first = (d.user.name || '').split(' ')[0] || 'there', s = d.stats, next = d.next;
    var enrolled = d.courses.filter(function (c) { return c.enrolled; });
    var nextCourse = next && d.courses.filter(function (c) { return c.id === next.courseId; })[0];
    var live = (d.liveNow || [])[0];
    var done = s.totalLessons ? Math.round(s.completedLessons / s.totalLessons * 100) : 0;
    var hero = '<section class="ov-hero stu" data-rise><div class="ov-aur a"></div><div class="ov-aur b"></div><div class="ov-grid-bg"></div>' +
      '<div class="ov-hero-top"><span class="ov-eyebrow">' + esc(today()) + '</span><span class="ov-live"><i></i>Synced<em data-ov-at="0">just now</em></span></div>' +
      '<div class="ov-hero-row"><div class="ov-hero-copy"><h1>' + esc(greeting()) + ',<br><span>' + esc(first) + '</span></h1>' +
      '<p class="ov-lead" id="ov-slead">' + studentLead(d) + '</p>' +
      '<div class="ov-hero-cta" id="ov-scta">' + (next ? '<a class="ov-btn" href="#course/' + esc(next.courseId) + '">' + IC.play + 'Resume lesson</a>' : '<a class="ov-btn" href="#browse">' + IC.compass + 'Browse courses</a>') +
      '<a class="ov-btn ghost" href="#live">' + IC.live + 'Live classes</a></div></div>' +
      '<div class="ov-hero-ring" id="ov-sring">' + ring(s.avgProgress, 150) + '<span>Average progress</span></div></div></section>';
    var liveBar = live ? '<a class="ov-onair big" href="#live" data-rise id="ov-slive"><span class="ov-pulse"><i></i></span><div><b>Live now: ' + esc(live.title || 'Class in session') + '</b><small>Tap to join your class</small></div>' + IC.chev + '</a>' : '<span id="ov-slive"></span>';
    var kp = [
      { id: 'courses', label: 'My courses', value: s.enrolled, icon: IC.book, color: '#E0A800', sub: s.enrolled ? 'Unlocked for you' : 'Start with the free intro' },
      { id: 'done', label: 'Lessons done', value: s.completedLessons, icon: IC.check, color: '#6BCB77', sub: 'of ' + s.totalLessons + ' lessons' },
      { id: 'avg', label: 'Average progress', value: s.avgProgress, icon: IC.trend, color: '#7aa7ff', sub: done + '% of all lessons', fmt: 'pct' },
      { id: 'live', label: 'Live now', value: (d.liveNow || []).length, icon: IC.live, color: '#ff4d6d', sub: live ? 'Join from Live classes' : 'No class right now', up: !!live }
    ];
    var cont = '<section class="ov-card cont" data-rise id="ov-cont">' + continueHTML(next, nextCourse, h) + '</section>';
    var mine = '<section class="ov-card wide" data-rise><header><div><p class="ov-ey">Your learning</p><h3>My courses</h3></div><a class="ov-more" href="#courses">See all</a></header><div class="ov-rail" id="ov-rail">' +
      (enrolled.length ? enrolled.map(function (c, i) { return railCard(c, i, h); }).join('') : '<div class="ov-empty-card"><p>You have not unlocked a course yet.</p><a class="ov-btn sm" href="#browse">Browse courses</a></div>') + '</div></section>';
    var news = '<section class="ov-card" data-rise><header><div><p class="ov-ey">From the team</p><h3>Announcements</h3></div></header><ul class="ov-news" id="ov-news">' + newsHTML(d.announcements) + '</ul></section>';
    var pay = '<section class="ov-card" data-rise><header><div><p class="ov-ey">Receipts</p><h3>Recent payments</h3></div><a class="ov-more" href="#payments">View all</a></header><ul class="ov-pays" id="ov-pays">' + paysHTML(d.payments, h) + '</ul></section>';
    var acts = '<p class="ov-ey ov-sec" data-rise>Jump to</p><section class="ov-acts">' + actions([
      { h: '#browse', l: 'Browse courses', i: IC.compass }, { h: '#assignments', l: 'Assignments', i: IC.pen }, { h: '#certificates', l: 'Certificates', i: IC.cert }, { h: '#community', l: 'Community', i: IC.users }
    ]) + '</section>';
    return '<div class="ov" id="ov-root">' + hero + liveBar +
      '<section class="ov-kpis">' + kp.map(function (c, i) { return kpiCard(i, c); }).join('') + '</section>' +
      '<div class="ov-cols stu">' + cont + news + mine + pay + '</div>' + acts + '</div>';
  }
  function studentLead(d) {
    var s = d.stats;
    if (!s.enrolled) return 'Start with the free introduction, then unlock a full course when you are ready.';
    if (s.completedLessons >= s.totalLessons && s.totalLessons) return 'You have finished every lesson you unlocked. Well done.';
    return 'You have finished <b>' + s.completedLessons + '</b> of <b>' + s.totalLessons + '</b> lessons across <b>' + s.enrolled + '</b> ' + (s.enrolled === 1 ? 'course' : 'courses') + '.';
  }
  function continueHTML(next, c, h) {
    if (!next) return '<p class="ov-ey">Continue learning</p><h2>You are all caught up</h2><p class="muted">Browse courses to start something new.</p><div class="ov-hero-cta"><a class="ov-btn" href="#browse">' + IC.compass + 'Browse courses</a></div>';
    var p = c ? c.progress : 0;
    return (c && h.thumb ? h.thumb(c) : '') + '<p class="ov-ey">Continue learning</p><h2>' + esc(next.lessonTitle) + '</h2><p class="muted">' + esc(next.courseTitle) + '</p>' +
      '<div class="ov-prog"><div class="ov-prog-h"><span>' + (c ? c.completed + ' of ' + c.total + ' lessons' : '') + '</span><b>' + p + '%</b></div><div class="ov-track"><i data-w="' + p + '"></i></div></div>' +
      '<div class="ov-hero-cta"><a class="ov-btn" href="#course/' + esc(next.courseId) + '">' + IC.play + 'Resume lesson</a></div>';
  }
  function railCard(c, i, h) {
    return '<a class="ov-rc" href="#course/' + esc(c.id) + '" style="--i:' + i + '">' + (h.thumb ? h.thumb(c) : '') + '<div class="ov-rc-b"><b>' + esc(c.title) + '</b><span>' + c.completed + ' of ' + c.total + ' lessons</span>' +
      '<div class="ov-track"><i data-w="' + c.progress + '"></i></div></div>' + miniRing(c.progress) + '</a>';
  }
  function newsHTML(list) {
    return (list && list.length) ? list.slice(0, 5).map(function (a, i) { return '<li style="--i:' + i + '"><span class="ov-dot2"></span><div><b>' + esc(a.title) + '</b><p>' + esc(a.body) + '</p></div></li>'; }).join('') : '<li class="ov-empty">Nothing new from the team yet.</li>';
  }
  function paysHTML(list, h) {
    if (!list || !list.length) return '<li class="ov-empty">No payments yet. Receipts appear here when you enrol in a paid course.</li>';
    return list.map(function (p, i) {
      return '<li style="--i:' + i + '"><span class="ov-pi">' + IC.card + '</span><div><b>' + esc(p.courseTitle) + '</b><small>' + esc(fmtD(p.createdAt)) + '</small></div><div class="ov-pr"><b>' + naira(p.amount) + '</b><span class="ov-st ' + esc(p.status) + '">' + esc(p.status) + '</span></div></li>';
    }).join('');
  }

  var stuState = null;
  function afterStudent(view) {
    var root = $('#ov-root', view); if (!root) return;
    stuState = { root: root };
    reveal(root); tilt(root); countAll(root);
    $$('.ov-ring', root).forEach(function (r) { setRing(r, Number(r.getAttribute('data-pct'))); });
    $$('.ov-track i', root).forEach(function (i) { setTimeout(function () { i.style.width = i.getAttribute('data-w') + '%'; }, 120); });
    $$('.ov-mr .v', root).forEach(function (v) { var c = Number(v.getAttribute('data-c')), p = Number(v.getAttribute('data-pct')); setTimeout(function () { v.style.strokeDashoffset = (c * (1 - p / 100)).toFixed(1); }, 160); });
    stamp(root);
  }
  /* Fresh data arrived: change numbers and text in place so nothing flickers */
  function updateStudent(view, d, h) {
    var root = $('#ov-root', view); if (!root) return false;
    var s = d.stats, set = function (id, v) { var n = $('[data-k="' + id + '"] .ov-num', root); if (n) tween(n, v); };
    set('courses', s.enrolled); set('done', s.completedLessons); set('avg', s.avgProgress); set('live', (d.liveNow || []).length);
    var sub = function (id, t, up) { var e = $('[data-k="' + id + '"] .ov-sub', root); if (e) { e.innerHTML = t; e.classList.toggle('up', !!up); } };
    var live = (d.liveNow || [])[0];
    sub('done', 'of ' + s.totalLessons + ' lessons'); sub('live', live ? 'Join from Live classes' : 'No class right now', !!live);
    var ld = $('#ov-slead', root); if (ld) ld.innerHTML = studentLead(d);
    var r = $('#ov-sring .ov-ring', root); if (r) { r.setAttribute('data-pct', s.avgProgress); tween($('[data-ov-n]', r), s.avgProgress); setRing(r, s.avgProgress); }
    var nx = d.next, nc = nx && d.courses.filter(function (c) { return c.id === nx.courseId; })[0];
    var ct = $('#ov-cont', root); if (ct) { var sig = JSON.stringify([nx, nc && nc.progress]); if (ct._sig !== sig) { ct._sig = sig; ct.innerHTML = continueHTML(nx, nc, h); $$('.ov-track i', ct).forEach(function (i) { setTimeout(function () { i.style.width = i.getAttribute('data-w') + '%'; }, 60); }); } }
    var cta = $('#ov-scta', root); if (cta) { var a = cta.firstElementChild; if (a) { a.setAttribute('href', nx ? '#course/' + nx.courseId : '#browse'); } }
    var nw = $('#ov-news', root); if (nw) { var ns = JSON.stringify(d.announcements); if (nw._sig !== ns) { nw._sig = ns; nw.innerHTML = newsHTML(d.announcements); } }
    var py = $('#ov-pays', root); if (py) { var ps = JSON.stringify(d.payments); if (py._sig !== ps) { py._sig = ps; py.innerHTML = paysHTML(d.payments, h); } }
    var rail = $('#ov-rail', root); if (rail) {
      d.courses.filter(function (c) { return c.enrolled; }).forEach(function (c) {
        var el = rail.querySelector('a[href="#course/' + c.id + '"]'); if (!el) return;
        var i = $('.ov-track i', el); if (i) i.style.width = c.progress + '%';
        var sp = $('.ov-rc-b span', el); if (sp) sp.textContent = c.completed + ' of ' + c.total + ' lessons';
        var v = $('.ov-mr .v', el); if (v) { var cc = Number(v.getAttribute('data-c')); v.style.strokeDashoffset = (cc * (1 - c.progress / 100)).toFixed(1); }
      });
    }
    var lv = $('#ov-slive', root);
    if (lv) { var has = lv.classList.contains('ov-onair'); if (live && !has) { lv.outerHTML = '<a class="ov-onair big in" href="#live" id="ov-slive"><span class="ov-pulse"><i></i></span><div><b>Live now: ' + esc(live.title || 'Class in session') + '</b><small>Tap to join your class</small></div>' + IC.chev + '</a>'; } else if (!live && has) lv.outerHTML = '<span id="ov-slive"></span>'; }
    stamp(root);
    return true;
  }

  window.DOverview = {
    admin: function (view, opts) { var p = mountAdmin(view, opts); startPolling(); return p; },
    refreshAdmin: function () { if (adminState && document.body.contains(adminState.root)) return pullAdmin(); },
    student: studentHTML, afterStudent: afterStudent, updateStudent: updateStudent
  };
})();
