/* Class timetable page (v43): the week at a glance, from each course's schedule, plus the upcoming starts. */
(function () {
  'use strict';
  var DAYS = [['Mon', 'Monday'], ['Tue', 'Tuesday'], ['Wed', 'Wednesday'], ['Thu', 'Thursday'], ['Fri', 'Friday'], ['Sat', 'Saturday'], ['Sun', 'Sunday']];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtDate(iso) { if (!iso) return ''; var d = new Date(iso + 'T00:00:00'); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
  // Reads "Mon, Wed, Fri 7pm" or "Tuesdays and Thursdays 18:00" into days and a time label
  function parseSchedule(text) {
    var t = String(text || '');
    var days = DAYS.filter(function (d) { return new RegExp('\\b' + d[0] + '|' + d[1], 'i').test(t); }).map(function (d) { return d[0]; });
    var m = t.match(/\d{1,2}(:\d{2})?\s?(am|pm)?/i);
    var time = m ? m[0].trim() : '';
    return { days: days, time: time };
  }
  var filter = 'all', courses = [];
  function load() {
    fetch('/api/courses', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (d) {
      courses = d.courses || [];
      paintFilters(); paint();
    }).catch(function () { document.getElementById('tt-list').innerHTML = '<div class="empty-state">The timetable could not load. Please refresh the page.</div>'; });
  }
  function paintFilters() {
    var cats = {};
    courses.forEach(function (c) { if (c.categoryLabel) cats[c.category] = c.categoryLabel; });
    var box = document.getElementById('tt-filters');
    box.innerHTML = '<button type="button" class="lc-chip on" data-cat="all" role="tab" aria-selected="true">All courses</button>' +
      Object.keys(cats).map(function (k) { return '<button type="button" class="lc-chip" data-cat="' + esc(k) + '" role="tab" aria-selected="false">' + esc(cats[k]) + '</button>'; }).join('');
    box.querySelectorAll('.lc-chip').forEach(function (b) {
      b.addEventListener('click', function () {
        filter = b.getAttribute('data-cat');
        box.querySelectorAll('.lc-chip').forEach(function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', String(x === b)); });
        paint();
      });
    });
  }
  function paint() {
    var list = courses.filter(function (c) { return filter === 'all' || c.category === filter; });
    var scheduled = list.filter(function (c) { return parseSchedule(c.schedule).days.length; });
    document.getElementById('tt-note').textContent = scheduled.length + ' of ' + list.length + ' courses have a published timetable.';
    // the week grid
    var week = document.getElementById('tt-week');
    week.innerHTML = DAYS.map(function (d, i) {
      var here = scheduled.filter(function (c) { return parseSchedule(c.schedule).days.indexOf(d[0]) !== -1; });
      return '<div class="tt-day" style="--i:' + i + '"><div class="tt-dh"><span>' + d[0] + '</span><b>' + d[1] + '</b></div>' +
        (here.length ? here.map(function (c, k) {
          var p = parseSchedule(c.schedule);
          return '<div class="tt-block" style="--k:' + k + '"><span class="tt-time">' + esc(p.time || 'Time TBA') + '</span><b>' + esc(c.title) + '</b><small>' + esc(c.instructor || 'DEBONE team') + '</small></div>';
        }).join('') : '<div class="tt-empty">No class</div>') + '</div>';
    }).join('');
    // upcoming starts
    var starts = list.filter(function (c) { return c.startDate; }).sort(function (a, b) { return a.startDate.localeCompare(b.startDate); });
    var others = list.filter(function (c) { return !c.startDate; });
    var rows = starts.map(function (c, i) {
      return '<article class="tt-row" style="--i:' + i + '"><div class="tt-date"><b>' + esc(fmtDate(c.startDate).split(' ').slice(1, 2).join(' ')) + '</b><span>' + esc(c.startDate.slice(8, 10)) + '</span></div>' +
        '<div class="tt-info"><h3>' + esc(c.title) + '</h3><p>' + esc(c.schedule || 'Schedule to be announced') + (c.instructor ? ' · ' + esc(c.instructor) : '') + '</p></div>' +
        '<a class="btn btn-ghost btn-sm" href="live-courses.html">See details</a></article>';
    }).join('');
    var unk = others.map(function (c, i) {
      return '<article class="tt-row muted-row" style="--i:' + (starts.length + i) + '"><div class="tt-date"><b>TBA</b><span>—</span></div><div class="tt-info"><h3>' + esc(c.title) + '</h3><p>Start date to be announced</p></div><a class="btn btn-ghost btn-sm" href="live-courses.html">See details</a></article>';
    }).join('');
    document.getElementById('tt-list').innerHTML = (rows || unk) ? rows + unk : '<div class="empty-state">No classes are scheduled in this area yet. <a href="contact.html">Ask us</a> about the next intake.</div>';
  }
  load();
})();
