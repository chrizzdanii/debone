/* Promotional comparison is illustrative, not a former selling price. */
window.DeboneIllustrativePrice = window.DeboneIllustrativePrice || function (price) {
  var n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return '';
  var reference = Math.round(n * 1.5);
  var money = function (x) { return '₦' + Math.round(x).toLocaleString('en-NG'); };
  return '<span class="debone-price-comparison" aria-label="Illustrative price comparison">' +
    '<s>' + money(reference) + '</s><span class="debone-value-badge">✦ 33% below comparison</span>' +
    '<small>Illustrative comparison, not a previous price</small></span>';
};
/* Digital Academy (v30): course catalogue with categories, schedule and seats (from the database). */
(function () {
  'use strict';
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var naira = function (n) { return '₦' + Number(n).toLocaleString('en-US'); };
  var active = 'all', courses = [], cats = [];
  var grid = document.getElementById('course-grid');
  if (!grid) return;

  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso + 'T00:00:00');
    return isNaN(d) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function facts(c) {
    var rows = [];
    if (c.startDate) rows.push(['Starts', fmtDate(c.startDate)]);
    if (c.duration) rows.push(['Duration', c.duration]);
    if (c.classesPerWeek || c.sessionsTotal) {
      rows.push(['Classes', [c.classesPerWeek ? c.classesPerWeek + ' per week' : '', c.sessionsTotal ? c.sessionsTotal + ' live sessions' : ''].filter(Boolean).join(' · ')]);
    }
    if (c.schedule) rows.push(['Class days', c.schedule]);
    rows.push(['Instructor', c.instructor || 'To be announced']);
    if (c.minStudents) rows.push(['Runs with', 'at least ' + c.minStudents + ' students']);
    if (!rows.length) return '';
    return '<dl class="course-facts">' + rows.map(function (r) {
      return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>';
    }).join('') + '</dl>';
  }

  function courseCard(c) {
    var tag = c.comingSoon ? '<span class="tag soon">Coming soon</span>' : (c.free ? '<span class="tag free">Free</span>' : '<span class="tag paid">Paid course</span>');
    var cat = c.categoryLabel ? '<p class="course-cat">' + esc(c.categoryLabel) + '</p>' : '';
    var o = c.offer;
    var price = c.comingSoon ? '<span class="price">Coming soon' + (c.waitlistCount ? '<small>' + c.waitlistCount + ' on the waiting list</small>' : '') + '</span>'
      : (c.free ? '<span class="price">Free<small>No payment</small></span>'
        : o ? '<span class="price">' + naira(c.price) + '' + window.DeboneIllustrativePrice(c.price) + '<small><s>' + naira(o.originalPrice) + '</s> · ✓ Save ' + naira(o.save) + ' (' + o.percent + '% OFF)</small></span>'
        : '<span class="price">' + naira(c.price) + '' + window.DeboneIllustrativePrice(c.price) + '<small>One-time</small></span>');
    var live = c.liveLabel ? '<p class="course-live">' + esc(c.liveLabel) + '</p>' : '';
    var rate = (c.rating && c.rating.count) ? '<p class="course-rating">★ ' + c.rating.avg + ' <span>(' + c.rating.count + (c.rating.count === 1 ? ' review' : ' reviews') + ')</span></p>' : '';
    var img = c.hasImage ? '<div class="course-img"><img src="/api/courses/' + encodeURIComponent(c.id) + '/image" alt="' + esc(c.title) + '" loading="lazy"></div>' : '';
    var lessons = c.lessons.map(function (l) {
      return '<li><span>' + esc(l.title) + '</span><span>' + (l.free ? 'Free' : 'Locked') + '</span></li>';
    }).join('');
    var action = c.comingSoon
      ? '<a class="btn btn-ghost btn-sm" href="login.html?next=dashboard">Join waiting list</a>'
      : '<a class="btn btn-solid btn-sm" href="signup.html">' + (c.free ? 'Start free' : 'Sign up to enrol') + '</a>';
    return '<article class="course" data-cat="' + esc(c.category || '') + '">' + img + tag + cat +
      '<h3>' + esc(c.title) + '</h3><p>' + esc(c.summary) + '</p>' + rate + live + facts(c) +
      (lessons ? '<ul class="lesson-list" aria-label="Lessons in ' + esc(c.title) + '">' + lessons + '</ul>' : '') +
      '<div class="foot">' + price + action + '</div></article>';
  }

  function drawFilters() {
    var box = document.getElementById('course-filters');
    if (!box) {
      box = document.createElement('div');
      box.id = 'course-filters';
      box.className = 'filters course-filters';
      box.setAttribute('role', 'group');
      box.setAttribute('aria-label', 'Filter courses by category');
      grid.parentNode.insertBefore(box, grid);
    }
    var used = courses.map(function (c) { return c.category; });
    var list = cats.filter(function (x) { return used.indexOf(x.id) !== -1; });
    box.innerHTML = '<button type="button" aria-pressed="' + (active === 'all') + '" data-cat="all">All courses</button>' +
      list.map(function (x) {
        return '<button type="button" aria-pressed="' + (active === x.id) + '" data-cat="' + esc(x.id) + '">' + esc(x.label) + (x.comingSoon ? ' · soon' : '') + '</button>';
      }).join('');
    box.querySelectorAll('[data-cat]').forEach(function (b) {
      b.addEventListener('click', function () { active = b.getAttribute('data-cat'); draw(); });
    });
  }

  function draw() {
    drawFilters();
    var shown = courses.filter(function (c) { return active === 'all' || c.category === active; });
    grid.innerHTML = shown.map(courseCard).join('') || '<div class="empty-state">No courses in this category yet. New courses are announced here first.</div>';
  }

  function load() {
    Promise.all([
      fetch('/api/courses', { credentials: 'same-origin' }).then(function (r) { return r.json(); }),
      fetch('/api/course-categories').then(function (r) { return r.json(); }).catch(function () { return { categories: [] }; })
    ]).then(function (res) {
      var sg = JSON.stringify(res); if (sg === load.sig) return; load.sig = sg;
      courses = res[0].courses || [];
      cats = res[1].categories || [];
      draw();
    }).catch(function () {
      grid.innerHTML = '<div class="empty-state">We could not load the courses right now. Please refresh the page.</div>';
    });
  }
  load();
  window.addEventListener('debone:refresh', load);
})();
