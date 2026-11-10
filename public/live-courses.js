/* Live courses page (v43): every live course with start date, schedule, seats and price. */
(function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function naira(n) { return '₦' + Number(n || 0).toLocaleString('en-US'); }
  function fmtDate(iso) { if (!iso) return ''; var d = new Date(iso + 'T00:00:00'); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); }
  function daysUntil(iso) { if (!iso) return null; var d = new Date(iso + 'T00:00:00'); return Math.ceil((d - new Date()) / 86400000); }
  var filter = 'all';
  function load() {
    fetch('/api/courses', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (d) {
      var live = d.courses || [];
      paintStats(live); paintFilters(live); paint(live);
    }).catch(function () { document.getElementById('lc-grid').innerHTML = '<div class="empty-state">The courses could not load. Please refresh the page.</div>'; });
  }
  function paintStats(list) {
    var open = list.filter(function (c) { return !c.comingSoon; });
    var seats = open.reduce(function (t, c) { return t + (c.seatsLeft != null ? c.seatsLeft : 0); }, 0);
    var next = open.filter(function (c) { return c.startDate && daysUntil(c.startDate) >= 0; }).sort(function (a, b) { return a.startDate.localeCompare(b.startDate); })[0];
    document.getElementById('lc-stats').innerHTML =
      '<div class="lc-stat"><b data-count="' + open.length + '">0</b><span>Live courses open</span></div>' +
      '<div class="lc-stat"><b data-count="' + seats + '">0</b><span>Seats left</span></div>' +
      '<div class="lc-stat"><b>' + (next ? esc(fmtDate(next.startDate)) : 'Soon') + '</b><span>Next start</span></div>';
    document.querySelectorAll('[data-count]').forEach(function (el) {
      var end = Number(el.getAttribute('data-count')), t0 = null;
      function step(ts) { if (!t0) t0 = ts; var p = Math.min(1, (ts - t0) / 1100); el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); }
      requestAnimationFrame(step);
    });
  }
  function paintFilters(list) {
    var cats = {};
    list.forEach(function (c) { if (c.categoryLabel) cats[c.category] = c.categoryLabel; });
    var box = document.getElementById('lc-filters');
    box.innerHTML = '<button type="button" class="lc-chip on" data-cat="all" role="tab" aria-selected="true">All courses</button>' +
      Object.keys(cats).map(function (k) { return '<button type="button" class="lc-chip" data-cat="' + esc(k) + '" role="tab" aria-selected="false">' + esc(cats[k]) + '</button>'; }).join('');
    box.querySelectorAll('.lc-chip').forEach(function (b) {
      b.addEventListener('click', function () {
        filter = b.getAttribute('data-cat');
        box.querySelectorAll('.lc-chip').forEach(function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', String(x === b)); });
        paint(list);
      });
    });
  }
  function card(c, i) {
    var left = c.seatsLeft, total = c.seats || 0;
    var pct = total ? Math.round(((total - (left || 0)) / total) * 100) : 0;
    var until = daysUntil(c.startDate);
    var when = c.comingSoon ? '<span class="lc-tag soon">Coming soon</span>' : c.startDate ? '<span class="lc-tag">' + (until > 0 ? 'Starts in ' + until + ' day' + (until === 1 ? '' : 's') : until === 0 ? 'Starts today' : 'Started') + '</span>' : '<span class="lc-tag muted-tag">Date to be announced</span>';
    return '<article class="lc-card" style="--i:' + i + '">' +
      '<div class="lc-img" style="background-image:url(\'' + window.ACAD.courseImg(c, i) + '\')"></div>' +
      '<div class="lc-top">' + (c.categoryLabel ? '<span class="lc-cat">' + esc(c.categoryLabel) + '</span>' : '') + when + '</div>' +
      '<h3>' + esc(c.title) + '</h3>' +
      '<p class="lc-sub">' + esc(c.subtitle || c.summary || '') + '</p>' +
      '<dl class="lc-facts">' +
        '<div><dt>Instructor</dt><dd>' + esc(c.instructor || 'DEBONE team') + '</dd></div>' +
        '<div><dt>Starts</dt><dd>' + (c.startDate ? esc(fmtDate(c.startDate)) : 'To be announced') + '</dd></div>' +
        '<div><dt>Schedule</dt><dd>' + esc(c.schedule || 'To be announced') + '</dd></div>' +
        '<div><dt>Length</dt><dd>' + esc(c.duration || (c.sessionsTotal ? c.sessionsTotal + ' classes' : 'To be announced')) + '</dd></div>' +
      '</dl>' +
      (total ? '<div class="lc-seats"><div class="lc-seats-top"><span>' + (left != null ? left + ' seats left' : '') + '</span><span>' + pct + '% taken</span></div><div class="lc-bar"><i style="--w:' + pct + '%"></i></div></div>' : '') +
      '<div class="lc-foot"><b>' + (c.price > 0 ? naira(c.price) : 'Free') + '</b>' +
        (c.comingSoon ? '<span class="btn btn-ghost btn-sm lc-dis">Coming soon</span>' : '<a class="btn btn-solid btn-sm" href="login.html?next=dashboard">' + (c.price > 0 ? 'Enrol now' : 'Start free') + '</a>') +
      '</div></article>';
  }
  function paint(list) {
    var items = list.filter(function (c) { return filter === 'all' || c.category === filter; });
    document.getElementById('lc-grid').innerHTML = items.length ? items.map(card).join('') :
      '<div class="empty-state">No live courses in this area yet. Check back soon, or <a href="contact.html">ask us</a> when the next class opens.</div>';
  }
  load();
})();
