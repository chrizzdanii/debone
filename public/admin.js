(function () {
  'use strict';

  var view = document.getElementById('view');
  var crumb = document.getElementById('crumb');
  var side = document.getElementById('side');
  var scrim = document.getElementById('scrim');
  var burger = document.getElementById('burger');
  var me = null;
  var ADMIN_VIEWS = ['courses', 'users', 'payments', 'announce'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function naira(n) { return '₦' + Number(n || 0).toLocaleString('en-US'); }
  function fmt(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function isAdmin() { return me && me.role === 'admin'; }

  async function api(url, opts) {
    opts = opts || {};
    var init = { method: opts.method || 'GET', credentials: 'same-origin', headers: {} };
    if (opts.body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    init.signal = AbortSignal.timeout(15000);
    var res = await fetch(url, init);
    if (res.status === 401) { location.replace('staff-login.html'); throw new Error('Please log in.'); }
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) { var e = new Error(data.error || 'Something went wrong.'); e.status = res.status; throw e; }
    return data;
  }
  function toast(msg, kind) {
    var host = document.getElementById('toasts');
    var t = document.createElement('div');
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.textContent = msg;
    host.appendChild(t);
    requestAnimationFrame(function () { requestAnimationFrame(function () { t.classList.add('show'); }); });
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 600); }, 3800);
  }
  function setView(html) {
    if (window.DLive && DLive.silent && /class="skeleton"/.test(html)) return;
    if (window.DLive && DLive.silent && DLive.patch) { DLive.patch(view, html); return; }
    view.innerHTML = html;
    view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter');
  }
  function head(eyebrow, title, sub) {
    return '<header class="view-head"><p class="eyebrow">' + esc(eyebrow) + '</p><h1>' + esc(title) + '</h1>' + (sub ? '<p class="muted">' + esc(sub) + '</p>' : '') + '</header>';
  }
  function denied() { setView(head('Restricted', 'Not available') + '<div class="empty-state">Only administrators can open this section.</div>'); }
  function courseOptions(courses, selected) {
    return courses.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === selected ? ' selected' : '') + '>' + esc(c.title) + '</option>'; }).join('');
  }
  function bindForm(selector, fn) {
    var f = view.querySelector(selector);
    if (!f) return;
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = f.querySelector('button[type=submit]');
      if (btn) { btn.disabled = true; }
      try { await fn(f); } catch (err) { toast(err.message, 'err'); }
      finally { if (btn) btn.disabled = false; }
    });
  }
  function fv(f, name) { return f.elements[name] ? f.elements[name].value.trim() : ''; }

  async function allCourses() { return (await api('/api/courses')).courses; }

  /* ---------- Overview ---------- */
  async function renderOverview() {
    crumb.textContent = 'Overview';
    var o = await api('/api/staff/overview');
    var cards = [
      ['Students', o.students], ['Instructors', o.instructors], ['Courses', o.courses],
      ['Live now', o.liveNow], ['Need marking', o.pendingGrading]
    ];
    if (isAdmin()) {
      cards.splice(3, 0, ['Active enrolments', o.enrollments]);
      cards.push(['Revenue', naira(o.revenue)]);
    }
    setView(head('Dashboard', 'Overview', 'Everything that needs your attention today.') +
      '<section class="kpis stagger">' + cards.map(function (c) {
        return '<div class="stat-card"><span>' + esc(c[0]) + '</span><b>' + (typeof c[1] === 'number' ? c[1].toLocaleString('en-US') : esc(c[1])) + '</b></div>';
      }).join('') + '</section>' +
      '<div class="two"><section class="panel"><p class="eyebrow">Quick actions</p><h2>Start here</h2>' +
        '<div class="btn-row" style="margin-top:18px"><a class="btn btn-solid btn-sm" href="#live">Schedule a live class</a>' +
        '<a class="btn btn-ghost btn-sm" href="#assignments">Create an assignment</a>' +
        (isAdmin() ? '<a class="btn btn-ghost btn-sm" href="#courses">Add a course</a>' : '') + '</div></section>' +
      '<section class="panel"><p class="eyebrow">Your role</p><h2>' + (isAdmin() ? 'Administrator' : 'Instructor') + '</h2>' +
        '<p class="muted" style="margin-top:12px">' + (isAdmin() ? 'You can manage courses, users, payments and announcements, as well as live classes and marking.' : 'You can run live classes, moderate the class chat, and mark assignments.') + '</p></section></div>');
  }

  /* ---------- Live classes (v50 redesign) ---------- */
  var liveTab = 'all';
  var ICON = {
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5l6-3.5v10l-6-3.5"/></svg>',
    yt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="4"/><path d="M10 9.5l4.5 2.5-4.5 2.5z"/></svg>',
    rec: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    empty: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="16" width="38" height="32" rx="7"/><path d="M44 28l14-8v24l-14-8"/><circle cx="25" cy="32" r="5"/></svg>'
  };
  function toLocalInput(v) {
    if (!v) return '';
    if (/Z$|[+-]\d\d:\d\d$/.test(v)) {
      var d = new Date(v); if (isNaN(d)) return '';
      var p = function (n) { return String(n).padStart(2, '0'); };
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
    }
    return String(v).slice(0, 16);
  }
  function countUp(el) {
    var end = Number(el.getAttribute('data-n')) || 0;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !end || (window.DLive && DLive.silent)) { el.textContent = end; return; }
    var t0 = null;
    (function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / 900, 1);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    })(performance.now());
  }
  function dueNow(s) {
    if (s.status !== 'scheduled' || !s.startsAt) return false;
    var t = new Date(s.startsAt).getTime();
    return !isNaN(t) && Date.now() >= t - 10 * 60000 && Date.now() <= t + (s.durationMinutes || 120) * 60000;
  }
  function lessonLabel(s, lessonsByCourse) {
    if (!s.lessonId) return '';
    var list = lessonsByCourse[s.courseId] || [];
    var i = list.findIndex(function (l) { return l.id === s.lessonId; });
    return i < 0 ? '' : 'Lesson ' + (i + 1) + ': ' + list[i].title;
  }
  function lessonOptions(lessons, selected) {
    return '<option value="">Not linked to a lesson</option>' + lessons.map(function (l, i) {
      return '<option value="' + esc(l.id) + '"' + (l.id === selected ? ' selected' : '') + '>Lesson ' + (i + 1) + ': ' + esc(l.title) + '</option>';
    }).join('');
  }

  async function renderLive() {
    crumb.textContent = 'Live classes';
    var courses = await allCourses();
    var sessions = [], lessonsByCourse = {};
    for (var i = 0; i < courses.length; i++) {
      var c = (await api('/api/staff/courses/' + encodeURIComponent(courses[i].id))).course;
      lessonsByCourse[courses[i].id] = c.lessons || [];
      c.sessions.forEach(function (s) { s.courseTitle = courses[i].title; sessions.push(s); });
    }
    sessions.sort(function (a, b) { return (b.startsAt || '').localeCompare(a.startsAt || ''); });
    var firstCourse = courses[0] ? courses[0].id : '';

    setView('<div class="lv">' +
      '<section class="lv-hero"><div class="lv-hero-row"><div><p class="eyebrow">Teaching</p><h1>Live <span>classes</span></h1>' +
        '<p class="muted">Schedule a class, link it to a lesson, go live with one tap, and keep the class chat tidy.</p></div>' +
        '<button class="btn btn-solid lv-cta" type="button" id="lv-new">' + ICON.plus + 'Schedule a class</button></div></section>' +
      '<div class="lv-stats" id="lv-stats"></div>' +
      '<div class="lv-grid">' +
        '<aside class="lv-compose" id="lv-compose"><h2><small>New session</small>Schedule a class</h2>' +
        '<form id="session-form" class="lv-form" autocomplete="off">' +
          '<div class="lv-sec"><h3><em>1</em>What is it about</h3>' +
            '<div class="lv-f"><label>Course</label><select class="input" name="courseId" required>' + courseOptions(courses, firstCourse) + '</select></div>' +
            '<div class="lv-f"><label>Lesson it belongs to</label><select class="input" name="lessonId">' + lessonOptions(lessonsByCourse[firstCourse] || [], '') + '</select>' +
              '<span class="lv-hint">Students unlock the next lesson after this live class (or its recording) and the lesson assignment are done.</span></div>' +
            '<div class="lv-f"><label>Title</label><div class="lv-ico">' + ICON.pen + '<input class="input with-ico" name="title" required maxlength="120" placeholder="e.g. Week 3: Reading charts"></div></div></div>' +
          '<div class="lv-sec"><h3><em>2</em>When</h3>' +
            '<div class="lv-f"><label>Date and time</label><div class="lv-ico">' + ICON.cal + '<input class="input with-ico" type="datetime-local" name="startsAt"></div></div>' +
            '<div class="lv-f"><label>Class length (minutes)</label><div class="lv-chips" id="lv-len">' +
              [60, 90, 120, 180].map(function (n) { return '<button type="button" class="lv-chip' + (n === 120 ? ' on' : '') + '" data-len="' + n + '">' + n + '</button>'; }).join('') + '</div>' +
              '<input class="input" type="number" min="15" max="600" name="durationMinutes" value="120"></div>' +
            '<div class="lv-f"><label>Status</label><div class="lv-seg" data-v="scheduled" id="lv-seg"><span class="pill"></span>' +
              [['scheduled', 'Scheduled'], ['live', 'Live now'], ['ended', 'Ended']].map(function (x) { return '<input type="radio" name="status" id="st-' + x[0] + '" value="' + x[0] + '"' + (x[0] === 'scheduled' ? ' checked' : '') + '><label for="st-' + x[0] + '">' + x[1] + '</label>'; }).join('') + '</div></div></div>' +
          '<div class="lv-sec"><h3><em>3</em>Links</h3>' +
            '<div class="lv-f"><label>Video room link</label><div class="lv-ico">' + ICON.video + '<input class="input with-ico" name="joinUrl" type="url" placeholder="Google Meet or Zoom link"></div></div>' +
            '<div class="lv-f"><label>YouTube live link</label><div class="lv-ico">' + ICON.yt + '<input class="input with-ico" name="youtubeUrl" placeholder="https://www.youtube.com/watch?v=…"></div><span class="lv-hint">Students watch this inside their dashboard.</span></div>' +
            '<div class="lv-f"><label>Recording link</label><div class="lv-ico">' + ICON.rec + '<input class="input with-ico" name="recordingUrl" placeholder="YouTube link of the recording"></div><span class="lv-hint">Add it after the class. Students who missed it watch it from their lesson.</span></div></div>' +
          '<button class="btn btn-solid lv-save" type="submit"><span>Save class</span></button>' +
        '</form></aside>' +
        '<section class="lv-main"><div class="lv-bar"><div class="lv-tabs" id="lv-tabs"><span class="ind"></span></div>' +
          '<input class="input lv-search" id="lv-search" type="search" placeholder="Search classes…" aria-label="Search classes"></div>' +
          '<div id="lv-list"></div></section>' +
      '</div></div>');

    var form = view.querySelector('#session-form');
    var seg = view.querySelector('#lv-seg');
    var query = '';

    /* --- form behaviour --- */
    form.elements.courseId.addEventListener('change', function () {
      form.elements.lessonId.innerHTML = lessonOptions(lessonsByCourse[form.elements.courseId.value] || [], '');
    });
    form.querySelectorAll('input[name=status]').forEach(function (r) { r.addEventListener('change', function () { seg.setAttribute('data-v', r.value); }); });
    form.querySelectorAll('[data-len]').forEach(function (b) {
      b.addEventListener('click', function () {
        form.elements.durationMinutes.value = b.getAttribute('data-len');
        form.querySelectorAll('[data-len]').forEach(function (x) { x.classList.toggle('on', x === b); });
      });
    });
    form.elements.durationMinutes.addEventListener('input', function () {
      form.querySelectorAll('[data-len]').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-len') === form.elements.durationMinutes.value); });
    });
    var saveBtn = form.querySelector('.lv-save');
    saveBtn.addEventListener('pointerdown', function (e) {
      var r = saveBtn.getBoundingClientRect(), d = Math.max(r.width, r.height), rip = document.createElement('i');
      rip.className = 'rip'; rip.style.cssText = 'width:' + d + 'px;height:' + d + 'px;left:' + (e.clientX - r.left - d / 2) + 'px;top:' + (e.clientY - r.top - d / 2) + 'px';
      saveBtn.appendChild(rip); setTimeout(function () { rip.remove(); }, 700);
    });
    view.querySelector('#lv-new').addEventListener('click', function () {
      var box = view.querySelector('#lv-compose'); box.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(function () { form.elements.title.focus({ preventScroll: true }); }, 450);
    });
    bindForm('#session-form', async function (f) {
      var body = { courseId: fv(f, 'courseId'), lessonId: fv(f, 'lessonId'), title: fv(f, 'title'), startsAt: fv(f, 'startsAt'),
        status: f.querySelector('input[name=status]:checked').value, joinUrl: fv(f, 'joinUrl'), youtubeUrl: fv(f, 'youtubeUrl'),
        recordingUrl: fv(f, 'recordingUrl'), durationMinutes: fv(f, 'durationMinutes') };
      var r = await api('/api/staff/sessions', { method: 'POST', body: body });
      toast('Class saved.');
      saveBtn.classList.add('ok'); saveBtn.querySelector('span').textContent = 'Saved ✓';
      setTimeout(function () { saveBtn.classList.remove('ok'); saveBtn.querySelector('span').textContent = 'Save class'; }, 1600);
      var courseTitle = (courses.find(function (c) { return c.id === body.courseId; }) || {}).title || '';
      r.session.courseTitle = courseTitle; sessions.unshift(r.session);
      f.elements.title.value = ''; f.elements.youtubeUrl.value = ''; f.elements.joinUrl.value = ''; f.elements.recordingUrl.value = '';
      draw(r.session.id);
    });

    /* --- list --- */
    var TABS = [['all', 'All'], ['live', 'Live now'], ['scheduled', 'Upcoming'], ['ended', 'Ended']];
    function counts() {
      var n = { all: sessions.length, live: 0, scheduled: 0, ended: 0 };
      sessions.forEach(function (s) { n[s.status] = (n[s.status] || 0) + 1; });
      return n;
    }
    function drawStats(first) {
      var n = counts(), att = sessions.reduce(function (t, s) { return t + (s.attendees || 0); }, 0);
      view.querySelector('#lv-stats').innerHTML = [
        ['is-live', 'Live now', n.live], ['is-up', 'Upcoming', n.scheduled], ['is-end', 'Completed', n.ended], ['is-att', 'Check-ins', att]
      ].map(function (x, i) { return '<div class="lv-stat ' + x[0] + '" style="--i:' + i + '"><span><i class="dot"></i>' + x[1] + '</span><b data-n="' + x[2] + '">0</b></div>'; }).join('');
      view.querySelectorAll('#lv-stats [data-n]').forEach(first ? countUp : function (el) { el.textContent = el.getAttribute('data-n'); });
    }
    function drawTabs() {
      var n = counts(), box = view.querySelector('#lv-tabs');
      box.querySelectorAll('button').forEach(function (b) { b.remove(); });
      TABS.forEach(function (t) {
        var b = document.createElement('button');
        b.type = 'button'; b.setAttribute('data-tab', t[0]); b.className = liveTab === t[0] ? 'on' : '';
        b.innerHTML = esc(t[1]) + '<sup>' + (n[t[0]] || 0) + '</sup>';
        b.addEventListener('click', function () { liveTab = t[0]; drawTabs(); drawList(); });
        box.appendChild(b);
      });
      var on = box.querySelector('button.on'), ind = box.querySelector('.ind');
      if (on) { ind.style.width = on.offsetWidth + 'px'; ind.style.transform = 'translateX(' + on.offsetLeft + 'px)'; }
    }
    function card(s, i) {
      var d = s.startsAt ? new Date(s.startsAt) : null, valid = d && !isNaN(d);
      var lab = lessonLabel(s, lessonsByCourse), len = s.durationMinutes || 120;
      var pct = Math.min(100, Math.round(((s.attendees || 0) / Math.max(1, (courses.find(function (c) { return c.id === s.courseId; }) || {}).enrolledCount || 1)) * 100));
      var lessons = lessonsByCourse[s.courseId] || [];
      var action = s.status === 'live' ? '<button class="lv-btn stop" type="button" data-set-status="ended">' + ICON.stop + 'End class</button>'
        : s.status === 'scheduled' ? '<button class="lv-btn go" type="button" data-set-status="live">' + ICON.play + 'Go live</button>' : '';
      return '<article class="lv-card st-' + esc(s.status) + '" data-row data-id="' + esc(s.id) + '" style="--i:' + i + '">' +
        '<div class="lv-row"><div class="lv-date">' + (valid ? '<b>' + d.getDate() + '</b><span>' + d.toLocaleString('en-GB', { month: 'short' }) + '</span><small>' + d.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit' }) + '</small>' : '<b>–</b><span>TBA</span>') + '</div>' +
          '<div class="lv-info"><h3>' + esc(s.title) + '</h3><div class="lv-tags">' +
            '<span class="lv-tag status ' + esc(s.status) + '">' + (s.status === 'live' ? '<i></i>' : '') + (s.status === 'scheduled' ? 'Upcoming' : s.status === 'live' ? 'Live now' : 'Ended') + '</span>' +
            (dueNow(s) ? '<span class="lv-tag due">Time to start</span>' : '') +
            '<span class="lv-tag">' + ICON.book.replace('<svg', '<svg width="13" height="13"') + esc(s.courseTitle || '') + '</span>' +
            (lab ? '<span class="lv-tag">' + esc(lab) + '</span>' : '<span class="lv-tag">No lesson linked</span>') +
            '<span class="lv-tag">' + ICON.clock.replace('<svg', '<svg width="13" height="13"') + len + ' min</span>' +
            (s.recordingRaw ? '<span class="lv-tag">Recording added</span>' : '') + '</div>' +
          '<div class="lv-meter"><div class="bar"><i data-w="' + pct + '"></i></div><span><b>' + (s.attendees || 0) + '</b> checked in</span></div></div>' +
          '<div class="lv-actions">' + action +
            '<button class="lv-btn" type="button" data-toggle="edit">' + ICON.edit + 'Edit</button>' +
            '<button class="lv-btn" type="button" data-chat-session="' + esc(s.id) + '">' + ICON.chat + 'Chat</button>' + '</div></div>' +
        '<div class="lv-drawer" data-drawer="edit"><div><div class="in">' +
          '<div class="lv-two"><div class="lv-f"><label>Title</label><input class="input" name="title" maxlength="120" value="' + esc(s.title) + '"></div>' +
            '<div class="lv-f"><label>Lesson</label><select class="input" name="lessonId">' + lessonOptions(lessons, s.lessonId) + '</select></div></div>' +
          '<div class="lv-two"><div class="lv-f"><label>Date and time</label><input class="input" type="datetime-local" name="startsAt" value="' + esc(toLocalInput(s.startsAt)) + '"></div>' +
            '<div class="lv-f"><label>Length (minutes)</label><input class="input" type="number" min="15" max="600" name="durationMinutes" value="' + len + '"></div></div>' +
          '<div class="lv-two"><div class="lv-f"><label>Status</label><select class="input" name="status">' + ['scheduled', 'live', 'ended'].map(function (x) { return '<option value="' + x + '"' + (s.status === x ? ' selected' : '') + '>' + (x === 'scheduled' ? 'Scheduled' : x === 'live' ? 'Live now' : 'Ended') + '</option>'; }).join('') + '</select></div>' +
            '<div class="lv-f"><label>Video room</label><input class="input" name="joinUrl" value="' + esc(s.joinUrl || '') + '" placeholder="Google Meet or Zoom link"></div></div>' +
          '<div class="lv-two"><div class="lv-f"><label>YouTube live link</label><input class="input" name="youtubeUrl" value="' + esc(s.watchUrl || '') + '" placeholder="https://www.youtube.com/watch?v=…"></div>' +
            '<div class="lv-f"><label>Recording link</label><input class="input" name="recordingUrl" value="' + esc(s.recordingRaw || '') + '" placeholder="YouTube link of the recording"></div></div>' +
          '<label class="lv-switch"><input type="checkbox" name="chatOpen"' + (s.chatOpen === false ? '' : ' checked') + '><span class="tr"></span>Class chat is open</label>' +
          '<div class="lv-actions" style="justify-content:flex-start"><button class="btn btn-solid btn-sm" type="button" data-save-session="' + esc(s.id) + '">Save changes</button>' +
            (isAdmin() ? '<button class="lv-btn danger" type="button" data-delete-session="' + esc(s.id) + '">' + ICON.trash + 'Delete</button>' : '') + '</div>' +
        '</div></div></div>' +
        '<div class="lv-drawer" data-drawer="chat"><div><div class="in"><div class="lv-chatlog" data-chat-log></div></div></div></div>' +
      '</article>';
    }
    function drawList(flash) {
      var q = query.toLowerCase();
      var rows = sessions.filter(function (s) {
        return (liveTab === 'all' || s.status === liveTab) && (!q || (s.title + ' ' + (s.courseTitle || '')).toLowerCase().indexOf(q) !== -1);
      });
      var order = { live: 0, scheduled: 1, ended: 2 };
      rows.sort(function (a, b) {
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
        return a.status === 'ended' ? (b.startsAt || '').localeCompare(a.startsAt || '') : (a.startsAt || '').localeCompare(b.startsAt || '');
      });
      var box = view.querySelector('#lv-list');
      box.innerHTML = rows.length ? '<div style="display:grid;gap:14px">' + rows.map(card).join('') + '</div>'
        : '<div class="lv-empty">' + ICON.empty + '<b>' + (sessions.length ? 'No classes match this view' : 'No classes yet') + '</b><span>' + (sessions.length ? 'Try another tab or clear the search.' : 'Schedule your first live class using the form.') + '</span></div>';
      requestAnimationFrame(function () { requestAnimationFrame(function () { box.querySelectorAll('[data-w]').forEach(function (el) { el.style.width = el.getAttribute('data-w') + '%'; }); }); });
      if (flash) { var el = box.querySelector('[data-id="' + flash + '"]'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
      bindCards();
    }
    function draw(flash) { drawStats(false); drawTabs(); drawList(flash); }

    async function patch(id, body, okMsg) {
      var r = await api('/api/staff/sessions/' + encodeURIComponent(id), { method: 'PATCH', body: body });
      var i = sessions.findIndex(function (x) { return x.id === id; });
      if (i >= 0) { var keep = sessions[i].courseTitle; sessions[i] = Object.assign({}, sessions[i], r.session, { courseTitle: keep, recordingRaw: body.recordingUrl !== undefined ? body.recordingUrl : sessions[i].recordingRaw }); }
      toast(okMsg); draw();
    }
    function bindCards() {
      view.querySelectorAll('[data-toggle=edit]').forEach(function (b) {
        b.addEventListener('click', function () { b.closest('[data-row]').querySelector('[data-drawer=edit]').classList.toggle('open'); });
      });
      view.querySelectorAll('[data-set-status]').forEach(function (b) {
        b.addEventListener('click', async function () {
          b.disabled = true;
          try { await patch(b.closest('[data-row]').getAttribute('data-id'), { status: b.getAttribute('data-set-status') }, b.getAttribute('data-set-status') === 'live' ? 'You are live. Students were notified.' : 'Class ended.'); }
          catch (e) { toast(e.message, 'err'); b.disabled = false; }
        });
      });
      view.querySelectorAll('[data-save-session]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var row = btn.closest('[data-row]'), q = function (n) { return row.querySelector('[name=' + n + ']'); };
          btn.disabled = true;
          try {
            await patch(btn.getAttribute('data-save-session'), { title: q('title').value.trim(), lessonId: q('lessonId').value, startsAt: q('startsAt').value, status: q('status').value,
              youtubeUrl: q('youtubeUrl').value.trim(), joinUrl: q('joinUrl').value.trim(), durationMinutes: q('durationMinutes').value,
              recordingUrl: q('recordingUrl').value.trim(), chatOpen: q('chatOpen').checked }, 'Class updated.');
          } catch (e) { toast(e.message, 'err'); btn.disabled = false; }
        });
      });
      view.querySelectorAll('[data-delete-session]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          if (!window.confirm('Delete this class and its chat history?')) return;
          var id = btn.getAttribute('data-delete-session'), row = btn.closest('[data-row]');
          try {
            await api('/api/staff/sessions/' + encodeURIComponent(id), { method: 'DELETE' });
            row.classList.add('lv-leave');
            setTimeout(function () { sessions = sessions.filter(function (x) { return x.id !== id; }); toast('Class deleted.'); draw(); }, 330);
          } catch (e) { toast(e.message, 'err'); }
        });
      });
      view.querySelectorAll('[data-chat-session]').forEach(function (btn) {
        btn.addEventListener('click', function () { openChatModeration(btn.getAttribute('data-chat-session'), btn); });
      });
    }
    view.querySelector('#lv-search').addEventListener('input', function (e) { query = e.target.value; drawList(); });

    drawStats(true); drawTabs(); drawList();
    window.addEventListener('resize', drawTabs, { once: true });
  }

  async function openChatModeration(sessionId, btn) {
    var box = btn.closest('[data-row]');
    var drawer = box.querySelector('[data-drawer=chat]');
    var log = drawer.querySelector('[data-chat-log]');
    if (drawer.classList.contains('open')) { drawer.classList.remove('open'); return; }
    log.innerHTML = '<p class="muted">Loading chat…</p>';
    drawer.classList.add('open');
    try {
      var r = await api('/api/staff/sessions/' + encodeURIComponent(sessionId) + '/chat');
      log.innerHTML = r.messages.length ? r.messages.map(function (m) {
        return '<div class="lv-msg"><div><b>' + esc(m.name) + '</b><span>' + esc(m.role) + ' · ' + esc(fmt(m.createdAt)) + '</span><p>' + esc(m.text) + '</p></div>' +
          '<button class="lv-btn danger" type="button" data-del-msg="' + esc(m.id) + '">Remove</button></div>';
      }).join('') : '<p class="muted">No messages yet.</p>';
      log.querySelectorAll('[data-del-msg]').forEach(function (b) {
        b.addEventListener('click', async function () {
          try { await api('/api/staff/chat/' + encodeURIComponent(b.getAttribute('data-del-msg')), { method: 'DELETE' }); b.closest('.lv-msg').remove(); toast('Message removed.'); }
          catch (e) { toast(e.message, 'err'); }
        });
      });
    } catch (e) { log.innerHTML = '<p class="muted">' + esc(e.message) + '</p>'; }
  }

  /* ---------- Assignments and marking ---------- */
  async function renderAssignments() {
    crumb.textContent = 'Assignments';
    var courses = await allCourses();
    var rows = [], lessonsByCourse = {};
    for (var i = 0; i < courses.length; i++) {
      var c = (await api('/api/staff/courses/' + encodeURIComponent(courses[i].id))).course;
      lessonsByCourse[courses[i].id] = c.lessons || [];
      c.assignments.forEach(function (a) { a.courseTitle = courses[i].title; a.lessonLabel = (function () { var k = (c.lessons || []).findIndex(function (l) { return l.id === a.lessonId; }); return k < 0 ? '' : ' · Lesson ' + (k + 1); })(); rows.push(a); });
    }
    setView(head('Teaching', 'Assignments', 'Set work, read submissions, and give marks and feedback.') +
      '<section class="box"><h2>New assignment</h2>' +
      '<form class="form-grid" id="assign-form">' +
        '<div class="grid-2"><div class="field"><label>Course</label><select class="input" name="courseId" required>' + courseOptions(courses, courses[0] ? courses[0].id : '') + '</select></div>' +
        '<div class="field"><label>Lesson</label><select class="input" name="lessonId">' + lessonOptions(lessonsByCourse[courses[0] ? courses[0].id : ''] || [], '') + '</select><span class="hint">Students must submit this to finish the lesson and unlock the next one.</span></div></div>' +
        '<div class="field"><label>Title</label><input class="input" name="title" required maxlength="120"></div>' +
        '<div class="field"><label>Instructions</label><textarea class="input" name="instructions" maxlength="5000" placeholder="What should students do?"></textarea></div>' +
        '<div class="grid-2"><div class="field"><label>Due date</label><input class="input" type="date" name="dueAt"></div>' +
        '<div class="field"><label>Maximum marks</label><input class="input" type="number" name="maxMarks" min="1" max="1000" value="100"></div></div>' +
        '<div><button class="btn btn-solid" type="submit">Create assignment</button></div>' +
      '</form></section>' +
      '<section class="box"><h2>Assignments</h2>' + (rows.length ? rows.map(function (a) {
        return '<div class="sub-row" style="grid-template-columns:2fr 1fr auto"><div><b>' + esc(a.title) + '</b><p class="muted" style="font-size:.85rem">' + esc(a.courseTitle) + esc(a.lessonLabel || '') + ' · due ' + esc(a.dueAt || 'no date') + ' · ' + a.maxMarks + ' marks</p></div>' +
          '<div></div><div class="row-actions"><button class="btn btn-solid btn-sm" type="button" data-grade="' + esc(a.id) + '">Submissions</button>' +
          (isAdmin() ? '<button class="btn btn-ghost btn-sm" type="button" data-del-assign="' + esc(a.id) + '">Delete</button>' : '') + '</div></div>';
      }).join('') : '<p class="muted">No assignments yet.</p>') + '</section>' +
      '<section class="box" id="grading" hidden></section>');

    bindForm('#assign-form', async function (f) {
      await api('/api/staff/assignments', { method: 'POST', body: { courseId: fv(f, 'courseId'), lessonId: fv(f, 'lessonId'), title: fv(f, 'title'), instructions: fv(f, 'instructions'), dueAt: fv(f, 'dueAt'), maxMarks: Number(fv(f, 'maxMarks')) || 100 } });
      toast('Assignment created.');
      renderAssignments();
    });
    var af = view.querySelector('#assign-form');
    if (af) af.elements.courseId.addEventListener('change', function () { af.elements.lessonId.innerHTML = lessonOptions(lessonsByCourse[af.elements.courseId.value] || [], ''); });
    view.querySelectorAll('[data-grade]').forEach(function (b) {
      b.addEventListener('click', function () { loadSubmissions(b.getAttribute('data-grade')); });
    });
    view.querySelectorAll('[data-del-assign]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!window.confirm('Delete this assignment and all its submissions?')) return;
        try { await api('/api/staff/assignments/' + encodeURIComponent(b.getAttribute('data-del-assign')), { method: 'DELETE' }); toast('Deleted.'); renderAssignments(); }
        catch (e) { toast(e.message, 'err'); }
      });
    });
  }

  /* ---------- Marking (table: marks and feedback side by side) ---------- */
  function gradeFor(marks, max) {
    if (marks === '' || marks == null || !max) return null;
    var pct = Number(marks) / max * 100;
    if (pct >= 75) return { key: 'distinction', label: 'Distinction' };
    if (pct >= 50) return { key: 'pass', label: 'Pass' };
    return { key: 'fail', label: 'Fail' };
  }
  function pillHtml(g) { return g ? '<span class="gpill ' + g.key + '">' + g.label + '</span>' : '<span class="gpill none">Not marked</span>'; }
  async function loadSubmissions(assignmentId) {
    var box = document.getElementById('grading');
    box.hidden = false;
    box.innerHTML = '<p class="muted">Loading submissions…</p>';
    try {
      var r = await api('/api/staff/assignments/' + encodeURIComponent(assignmentId) + '/submissions');
      var max = r.assignment.maxMarks;
      box.innerHTML = '<div class="mk-head"><div><p class="eyebrow">Marking</p><h3>' + esc(r.assignment.title) + '</h3></div><span class="muted">Out of ' + max + ' · ' + r.submissions.length + ' submission' + (r.submissions.length === 1 ? '' : 's') + '</span></div>' +
        (r.submissions.length ? '<div class="dt-wrap"><table class="dt mk"><thead><tr><th>Student</th><th>Submitted work</th><th>Marks</th><th>Feedback</th><th>Result</th><th></th></tr></thead><tbody>' +
          r.submissions.map(function (s, i) {
            var work = s.text ? '<p class="mk-work">' + esc(s.text.length > 220 ? s.text.slice(0, 220) + '…' : s.text) + '</p>' : '<p class="muted">No written answer.</p>';
            var link = s.link ? '<a class="mk-link" href="' + esc(s.link) + '" target="_blank" rel="noopener">Open link ↗</a>' : '';
            return '<tr style="--i:' + i + '" data-sub="' + esc(s.id) + '">' +
              '<td><div class="mk-who"><b>' + esc(s.studentName) + '</b><span class="muted small">' + esc(s.studentEmail) + '</span><span class="muted small">Submitted ' + esc(fmt(s.submittedAt)) + '</span></div></td>' +
              '<td class="mk-wcell">' + work + link + '</td>' +
              '<td><input class="input mk-in" type="number" min="0" max="' + max + '" name="marks" value="' + (s.marks == null ? '' : s.marks) + '" aria-label="Marks out of ' + max + '"></td>' +
              '<td><textarea class="input mk-fb" name="feedback" rows="3" maxlength="2000" aria-label="Feedback">' + esc(s.feedback) + '</textarea></td>' +
              '<td><span class="mk-pill" data-pill>' + pillHtml(s.grade) + '</span></td>' +
              '<td class="dt-act"><label class="small mk-resub"><input type="checkbox" data-resub> Ask to resubmit</label> <button class="btn btn-solid btn-sm" type="button" data-save-grade="' + esc(s.id) + '">Save</button></td></tr>';
          }).join('') + '</tbody></table></div>' : '<p class="muted">No submissions yet.</p>');
      box.querySelectorAll('tr[data-sub]').forEach(function (row) {
        var input = row.querySelector('[name=marks]');
        input.addEventListener('input', function () {
          row.querySelector('[data-pill]').innerHTML = pillHtml(gradeFor(input.value, max));
        });
      });
      box.querySelectorAll('[data-save-grade]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var row = b.closest('tr');
          b.disabled = true;
          try {
            await api('/api/staff/submissions/' + encodeURIComponent(b.getAttribute('data-save-grade')) + '/grade', { method: 'POST', body: {
              marks: row.querySelector('[name=marks]').value, feedback: row.querySelector('[name=feedback]').value.trim(), requestResubmit: !!row.querySelector('[data-resub]').checked
            } });
            toast('Marks saved. The student has been notified.');
            row.classList.add('mk-saved');
            setTimeout(function () { row.classList.remove('mk-saved'); }, 1400);
          } catch (e) { toast(e.message, 'err'); }
          finally { b.disabled = false; }
        });
      });
    } catch (e) { box.innerHTML = '<p class="muted">' + esc(e.message) + '</p>'; }
  }

  /* ---------- Courses and lessons (admin) ---------- */
  /* Course images: resized in the browser to a light JPEG */
  function readImage(file) {
    return new Promise(function (resolve, reject) {
      if (!file) return reject(new Error('Choose an image first.'));
      var img = new Image();
      img.onload = function () {
        var max = 900, scale = Math.min(1, max / Math.max(img.width, img.height));
        var w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        var canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.84));
      };
      img.onerror = function () { reject(new Error('That file could not be read as an image.')); };
      var reader = new FileReader();
      reader.onload = function () { img.src = reader.result; };
      reader.readAsDataURL(file);
    });
  }

  async function renderCourses(arg) {
    if (!isAdmin()) return denied();
    crumb.textContent = 'Courses & lessons';
    if (arg) return renderCourseEditor(arg);
    var courses = await allCourses();
    setView(head('Catalogue', 'Courses & lessons', 'Create courses, set prices, and write the lessons students see.') +
      '<section class="box"><h2>New course</h2><form class="form-grid" id="course-form">' +
        '<div class="grid-2"><div class="field"><label>Title</label><input class="input" name="title" required maxlength="120"></div>' +
        '<div class="field"><label>Subtitle</label><input class="input" name="subtitle" maxlength="80" placeholder="e.g. Full course · One-time payment"></div></div>' +
        '<div class="field"><label>Summary</label><textarea class="input" name="summary" maxlength="500"></textarea></div>' +
        '<div class="grid-3"><div class="field"><label>Level</label><input class="input" name="level" value="Beginner" maxlength="30"></div>' +
        '<div class="field"><label>Price (' + 'NGN' + ', 0 = free)</label><input class="input" type="number" name="price" min="0" value="0"></div></div>' +
        '<div class="field"><label>Course image</label><div class="img-up"><div class="img-prev" id="new-prev"><span>No image yet</span></div>' +
        '<div class="img-up-side"><input type="file" name="image" id="new-file" accept="image/jpeg,image/png,image/webp" class="input">' +
        '<p class="muted" style="font-size:.85rem;margin:8px 0 0">JPG, PNG or WebP, under 200 KB. Shown on the course card.</p></div></div></div>' +
        '<div><button class="btn btn-solid" type="submit">Create course</button></div></form></section>' +
      '<section class="box"><h2>All courses</h2><div class="table-wrap"><table class="tbl"><thead><tr><th>Course</th><th>Price</th><th>Lessons</th><th></th></tr></thead><tbody>' +
        courses.map(function (c) {
          return '<tr><td><b>' + esc(c.title) + '</b><div class="muted" style="font-size:.85rem">' + esc(c.subtitle || '') + '</div></td><td>' + (c.free ? 'Free' : naira(c.price)) + '</td><td>' + c.lessons.length + '</td>' +
            '<td><a class="btn btn-ghost btn-sm" href="#courses/' + esc(c.id) + '">Manage</a></td></tr>';
        }).join('') + '</tbody></table></div></section>');
    var nf = document.getElementById('new-file');
    if (nf) nf.addEventListener('change', function () {
      var file = nf.files && nf.files[0]; if (!file) return;
      readImage(file).then(function (url) { document.getElementById('new-prev').innerHTML = '<img src="' + url + '" alt="">'; })
        .catch(function (e) { toast(e.message, 'err'); });
    });
    bindForm('#course-form', async function (f) {
      var r = await api('/api/staff/courses', { method: 'POST', body: { title: fv(f, 'title'), subtitle: fv(f, 'subtitle'), summary: fv(f, 'summary'), level: fv(f, 'level'), price: Number(fv(f, 'price')) || 0 } });
      var file = f.querySelector('input[type=file]').files[0];
      if (file) {
        try { await api('/api/staff/courses/' + encodeURIComponent(r.course.id) + '/image', { method: 'POST', body: { data: await readImage(file) } }); }
        catch (e) { toast('Course created, but the image could not be saved: ' + e.message, 'err'); }
      }
      toast('Course created. Now add its lessons.');
      location.hash = '#courses/' + r.course.id;
    });
  }

  async function renderCourseEditor(id) {
    var c = (await api('/api/staff/courses/' + encodeURIComponent(id))).course;
    var CATS = (await api('/api/course-categories')).categories;
    var opt = function (v, label, cur) { return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(label) + '</option>'; };
    var num = function (v) { return v == null ? '' : v; };
    setView(head('Course', c.title, c.subtitle || '') +
      '<div class="row-actions" style="margin-bottom:18px"><a class="btn btn-ghost btn-sm" href="#courses">← All courses</a></div>' +
      '<section class="box"><h2>Course image</h2><div class="img-up img-up-lg">' +
        '<div class="img-prev" id="ed-prev">' + (c.hasImage ? '<img src="/api/courses/' + encodeURIComponent(c.id) + '/image?v=' + Date.now() + '" alt="Current course image">' : '<span>No image yet</span>') + '</div>' +
        '<div class="img-up-side"><p class="muted" style="margin:0 0 12px">Shown on the course card in the student dashboard and on the academy page. You can replace it or remove it at any time.</p>' +
        '<div class="row-actions"><label class="btn btn-ghost btn-sm img-pick">' + (c.hasImage ? 'Replace image' : 'Upload image') + '<input type="file" id="ed-file" accept="image/jpeg,image/png,image/webp" hidden></label>' +
        (c.hasImage ? '<button class="btn btn-ghost btn-sm" type="button" id="ed-remove">Remove image</button>' : '') + '</div></div></div></section>' +
      '<section class="box"><h2>Course details</h2><form class="form-grid" id="edit-course">' +
        '<div class="grid-2"><div class="field"><label>Title</label><input class="input" name="title" value="' + esc(c.title) + '" maxlength="120"></div>' +
        '<div class="field"><label>Subtitle</label><input class="input" name="subtitle" value="' + esc(c.subtitle || '') + '" maxlength="80"></div></div>' +
        '<div class="field"><label>Summary</label><textarea class="input" name="summary" maxlength="500">' + esc(c.summary || '') + '</textarea></div>' +
        '<div class="grid-3"><div class="field"><label>Level</label><input class="input" name="level" value="' + esc(c.level || '') + '"></div>' +
        '<div class="field"><label>Price (NGN, 0 = free)</label><input class="input" type="number" name="price" min="0" value="' + c.price + '"></div></div>' +
        '<div class="grid-2"><div class="field"><label>Category</label><select class="input" name="category"><option value="">Not set</option>' + CATS.map(function (x) { return opt(x.id, x.label + (x.comingSoon ? ' (coming soon)' : ''), c.category); }).join('') + '</select></div>' +
        '<div class="field"><label>Instructor</label><input class="input" name="instructor" maxlength="120" value="' + esc(c.instructor || '') + '" placeholder="Name of the qualified instructor"></div></div>' +
        '<div class="grid-3"><div class="field"><label>Start date</label><input class="input" type="date" name="startDate" value="' + esc(c.startDate || '') + '"></div>' +
        '<div class="field"><label>Duration</label><input class="input" name="duration" maxlength="60" value="' + esc(c.duration || '') + '" placeholder="e.g. 2 weeks"></div>' +
        '<div class="field"><label>Class days and times</label><input class="input" name="schedule" maxlength="240" value="' + esc(c.schedule || '') + '" placeholder="e.g. Mon, Wed, Fri · 7:00 pm"></div></div>' +
        '<div class="grid-3"><div class="field"><label>Classes per week</label><input class="input" type="number" name="classesPerWeek" min="1" max="7" value="' + num(c.classesPerWeek) + '"></div>' +
        '<div class="field"><label>Live sessions in total</label><input class="input" type="number" name="sessionsTotal" min="1" max="60" value="' + num(c.sessionsTotal) + '"></div>' +
        '<div class="field"><label>Maximum students (seats)</label><input class="input" type="number" name="seats" min="1" value="' + num(c.seats) + '" placeholder="No limit"></div></div>' +
        '<div class="grid-3"><div class="field"><label>Minimum students to run the course</label><input class="input" type="number" name="minStudents" min="1" value="' + num(c.minStudents) + '" placeholder="Not set"></div>' +
        '<div class="field"><span></span></div><div class="field"><span></span></div></div>' +
        '<div class="row-actions"><button class="btn btn-solid" type="submit">Save details</button>' +
        '<button class="btn btn-ghost" type="button" id="delete-course">Delete course</button></div></form></section>' +
      '<section class="box"><h2>Lessons</h2>' +
        (c.lessons.length ? c.lessons.map(function (l, i) {
          return '<div class="lesson-row"><span class="n">' + String(i + 1).padStart(2, '0') + '</span><div><b>' + esc(l.title) + '</b><small> · ' + (l.free ? 'Free preview' : 'Paid') + '</small></div>' +
            '<div class="row-actions"><button class="btn btn-ghost btn-sm" type="button" data-edit-lesson="' + esc(l.id) + '">Edit</button>' +
            '<button class="btn btn-ghost btn-sm" type="button" data-del-lesson="' + esc(l.id) + '">Delete</button></div></div>';
        }).join('') : '<p class="muted">No lessons yet. Add the first one below.</p>') +
      '</section>' +
      '<section class="box" id="lesson-box"><h2 id="lesson-h">Add a lesson</h2><form class="form-grid" id="lesson-form">' +
        '<input type="hidden" name="lessonId">' +
        '<div class="field"><label>Title</label><input class="input" name="title" required maxlength="120"></div>' +
        '<div class="field"><label>Lesson content (leave a blank line between paragraphs)</label><textarea class="input" name="body" rows="8" maxlength="20000"></textarea></div>' +
        '<div class="field"><label>Minutes to finish (optional)</label><input class="input" type="number" min="1" max="600" name="minutes"></div>' +
        '<div class="field" style="grid-column:1/-1"><label>Resources, one per line: Title | https://link</label><textarea class="input" name="resources" rows="3" maxlength="4000" placeholder="Prompt sheet | https://drive.google.com/..."></textarea></div>' +
        '<label class="check"><input type="checkbox" name="free"> Free preview (students can open it without paying)</label>' +
        '<div class="row-actions"><button class="btn btn-solid" type="submit" id="lesson-submit">Add lesson</button><button class="btn btn-ghost" type="button" id="lesson-cancel" hidden>Cancel edit</button></div>' +
      '</form></section>');

    var lessons = {};
    c.lessons.forEach(function (l) { lessons[l.id] = l; });
    var ef = document.getElementById('ed-file');
    if (ef) ef.addEventListener('change', async function () {
      try {
        var url = await readImage(ef.files[0]);
        await api('/api/staff/courses/' + encodeURIComponent(id) + '/image', { method: 'POST', body: { data: url } });
        toast('Course image saved. Students will see it straight away.');
        renderCourseEditor(id);
      } catch (e) { toast(e.message, 'err'); }
    });
    var er = document.getElementById('ed-remove');
    if (er) er.addEventListener('click', async function () {
      if (!window.confirm('Remove this course image?')) return;
      try {
        await api('/api/staff/courses/' + encodeURIComponent(id) + '/image', { method: 'DELETE' });
        toast('Course image removed.');
        renderCourseEditor(id);
      } catch (e) { toast(e.message, 'err'); }
    });
    bindForm('#edit-course', async function (f) {
      var det = { title: fv(f, 'title'), subtitle: fv(f, 'subtitle'), summary: fv(f, 'summary'), level: fv(f, 'level'), price: Number(fv(f, 'price')) || 0,
        category: fv(f, 'category'), instructor: fv(f, 'instructor'), startDate: fv(f, 'startDate'), duration: fv(f, 'duration'), schedule: fv(f, 'schedule'),
        classesPerWeek: fv(f, 'classesPerWeek'), sessionsTotal: fv(f, 'sessionsTotal'), seats: fv(f, 'seats'), minStudents: fv(f, 'minStudents') };
      try { await api('/api/staff/courses/' + encodeURIComponent(id), { method: 'PATCH', body: det }); }
      catch (e) { toast(e.message, 'err'); return; }
      toast('Course saved.');
      renderCourseEditor(id);
    });
    document.getElementById('delete-course').addEventListener('click', async function () {
      if (!window.confirm('Delete this course? This cannot be undone.')) return;
      try { await api('/api/staff/courses/' + encodeURIComponent(id), { method: 'DELETE' }); toast('Course deleted.'); location.hash = '#courses'; }
      catch (e) { toast(e.message, 'err'); }
    });

    var lf = document.getElementById('lesson-form');
    function resetLessonForm() {
      lf.reset(); lf.elements.lessonId.value = '';
      document.getElementById('lesson-h').textContent = 'Add a lesson';
      document.getElementById('lesson-submit').textContent = 'Add lesson';
      document.getElementById('lesson-cancel').hidden = true;
    }
    document.getElementById('lesson-cancel').addEventListener('click', resetLessonForm);
    view.querySelectorAll('[data-edit-lesson]').forEach(function (b) {
      b.addEventListener('click', function () {
        var l = lessons[b.getAttribute('data-edit-lesson')];
        lf.elements.lessonId.value = l.id; lf.elements.title.value = l.title; lf.elements.body.value = l.body; lf.elements.free.checked = !!l.free;
        lf.elements.minutes.value = l.minutes || ''; lf.elements.resources.value = l.resources || '';
        document.getElementById('lesson-h').textContent = 'Edit lesson';
        document.getElementById('lesson-submit').textContent = 'Save lesson';
        document.getElementById('lesson-cancel').hidden = false;
        document.getElementById('lesson-box').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    view.querySelectorAll('[data-del-lesson]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!window.confirm('Delete this lesson?')) return;
        try { await api('/api/staff/lessons/' + encodeURIComponent(b.getAttribute('data-del-lesson')), { method: 'DELETE' }); toast('Lesson deleted.'); renderCourseEditor(id); }
        catch (e) { toast(e.message, 'err'); }
      });
    });
    bindForm('#lesson-form', async function (f) {
      var lid = fv(f, 'lessonId');
      var body = { title: fv(f, 'title'), body: f.elements.body.value, free: f.elements.free.checked, minutes: fv(f, 'minutes'), resources: f.elements.resources.value };
      if (lid) await api('/api/staff/lessons/' + encodeURIComponent(lid), { method: 'PATCH', body: body });
      else await api('/api/staff/courses/' + encodeURIComponent(id) + '/lessons', { method: 'POST', body: body });
      toast(lid ? 'Lesson saved.' : 'Lesson added.');
      renderCourseEditor(id);
    });
  }

  /* ---------- Users and roles (admin) ---------- */
  async function renderUsers() {
    if (!isAdmin()) return denied();
    crumb.textContent = 'Users & roles';
    var r = await api('/api/staff/users');
    setView(head('People', 'Users & roles', 'Make instructors, promote admins, and see who is enrolled.') +
      '<section class="box"><div class="table-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Enrolled</th><th>Role</th></tr></thead><tbody>' +
      r.users.map(function (u) {
        return '<tr><td><b>' + esc(u.name) + '</b></td><td>' + esc(u.email) + '</td><td>' + esc(fmt(u.createdAt)) + '</td><td>' + u.enrolled + '</td>' +
          '<td><select class="input role-select" data-user="' + esc(u.id) + '" style="min-width:150px">' +
          ['student', 'instructor', 'admin'].map(function (x) { return '<option value="' + x + '"' + (u.role === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') +
          '</select></td></tr>';
      }).join('') + '</tbody></table></div></section>');
    view.querySelectorAll('.role-select').forEach(function (s) {
      s.addEventListener('change', async function () {
        try { await api('/api/staff/users/' + encodeURIComponent(s.getAttribute('data-user')), { method: 'PATCH', body: { role: s.value } }); toast('Role updated.'); }
        catch (e) { toast(e.message, 'err'); renderUsers(); }
      });
    });
  }

  /* ---------- Payments (admin) ---------- */
  async function renderPayments() {
    if (!isAdmin()) return denied();
    crumb.textContent = 'Payments';
    var r = await api('/api/staff/payments');
    var ok = r.payments.filter(function (p) { return p.status === 'success'; });
    var total = ok.reduce(function (s, p) { return s + p.amount; }, 0);
    setView(head('Money', 'Payments', 'Every enrolment payment, with its confirmation status.') +
      '<section class="kpis"><div class="stat-card"><span>Confirmed</span><b>' + ok.length + '</b></div><div class="stat-card"><span>Total received</span><b>' + naira(total) + '</b></div></section>' +
      '<section class="box"><div class="table-wrap"><table class="tbl"><thead><tr><th>Student</th><th>Course</th><th>Amount</th><th>Status</th><th>Reference</th><th>Date</th></tr></thead><tbody>' +
      (r.payments.length ? r.payments.map(function (p) {
        return '<tr><td><b>' + esc(p.studentName) + '</b><div class="muted" style="font-size:.8rem">' + esc(p.studentEmail) + '</div></td><td>' + esc(p.courseTitle) + '</td><td>' + naira(p.amount) + '</td>' +
          '<td><span class="status ' + esc(p.status) + '">' + esc(p.status) + '</span></td><td style="font-size:.8rem">' + esc(p.reference) + '</td><td>' + esc(fmt(p.createdAt)) + '</td></tr>';
      }).join('') : '<tr><td colspan="6" class="muted">No payments yet.</td></tr>') +
      '</tbody></table></div></section>');
  }

  /* ---------- Announcements (admin) ---------- */
  function renderAnnounce() {
    if (!isAdmin()) return denied();
    crumb.textContent = 'Announcements';
    setView(head('News', 'Announcements', 'Post news to every student dashboard.') +
      '<section class="box"><form class="form-grid" id="ann-form">' +
        '<div class="field"><label>Title</label><input class="input" name="title" required maxlength="120"></div>' +
        '<div class="field"><label>Message</label><textarea class="input" name="body" maxlength="500"></textarea></div>' +
        '<div><button class="btn btn-solid" type="submit">Post announcement</button></div></form></section>');
    bindForm('#ann-form', async function (f) {
      await api('/api/staff/announcements', { method: 'POST', body: { title: fv(f, 'title'), body: fv(f, 'body') } });
      toast('Announcement posted.'); f.reset();
    });
  }

  /* ---------- Newsletter (admin) ---------- */
  async function renderNewsletter() {
    if (!isAdmin()) return denied();
    crumb.textContent = 'Newsletter';
    var r = await api('/api/staff/newsletter');
    var rows = r.subscribers.map(function (n) {
      return '<tr><td>' + esc(n.email) + '</td><td>' + esc(fmt(n.createdAt)) + '</td><td><button class="btn btn-ghost btn-sm" type="button" data-unsub="' + esc(n.email) + '">Remove</button></td></tr>';
    }).join('');
    setView(head('Audience', 'Newsletter', 'People who joined the mailing list from the website footer.') +
      '<section class="box"><div class="toolbar"><b>' + r.subscribers.length + ' subscriber' + (r.subscribers.length === 1 ? '' : 's') + '</b>' +
      '<button class="btn btn-solid btn-sm" type="button" id="nl-export">Download CSV</button></div>' +
      '<div class="table-wrap"><table class="tbl"><thead><tr><th>Email</th><th>Joined</th><th></th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="3" class="muted">No subscribers yet.</td></tr>') + '</tbody></table></div></section>');
    document.getElementById('nl-export').addEventListener('click', function () {
      var csv = 'email,joined\n' + r.subscribers.map(function (n) { return n.email + ',' + n.createdAt; }).join('\n');
      var blob = new Blob([csv], { type: 'text/csv' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a'); link.href = url; link.download = 'debone-newsletter.csv';
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
    view.querySelectorAll('[data-unsub]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!window.confirm('Remove this subscriber?')) return;
        try { await api('/api/staff/newsletter?email=' + encodeURIComponent(b.getAttribute('data-unsub')), { method: 'DELETE' }); toast('Removed.'); renderNewsletter(); }
        catch (e) { toast(e.message, 'err'); }
      });
    });
  }

  /* ---------- Shop products (admin) ---------- */
  function itemImageField(item, label, required) {
    return '<div class="field"><label>' + label + '</label><div class="img-up"><div class="img-prev" id="if-prev">' +
      (item && item.image ? '<img src="' + esc(item.image) + '" alt="">' : '<span>No photo yet</span>') + '</div>' +
      '<div class="img-up-side"><input type="file" id="if-file" accept="image/jpeg,image/png,image/webp" class="input"' + (required && !(item && item.image) ? ' required' : '') + '>' +
      '<p class="muted small">JPG, PNG or WebP, under 200 KB.</p>' + (item && item.image ? '<button type="button" class="btn btn-ghost btn-sm" id="if-remove">Remove photo</button>' : '') + '</div></div></div>';
  }
  function bindImageField(box, onRemove) {
    var file = box.querySelector('#if-file');
    file.addEventListener('change', function () {
      if (!file.files[0]) return;
      readImage(file.files[0]).then(function (url) {
        box.querySelector('#if-prev').innerHTML = '<img src="' + url + '" alt="">';
        box.querySelector('#if-prev').dataset.picked = url;
      }).catch(function (e) { toast(e.message, 'err'); });
    });
    var rm = box.querySelector('#if-remove');
    if (rm && onRemove) rm.addEventListener('click', onRemove);
  }
  async function saveImage(url, data) { return api(url, { method: 'POST', body: { data: data } }); }

  function productForm(cats, item) {
    var isNew = !item, it = item || {};
    DModal.open({ size: 'lg', eyebrow: isNew ? 'New product' : 'Edit product', title: isNew ? 'Add a product to the shop' : esc(it.name), body:
      '<form class="sub-form" id="pf" novalidate>' +
        '<div class="grid-2"><div class="field"><label>Product name</label><input class="input" name="name" required maxlength="120" value="' + esc(it.name || '') + '"></div>' +
        '<div class="field"><label>Category</label><select class="input" name="cat">' + cats.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === it.cat ? ' selected' : '') + '>' + esc(c.label) + '</option>'; }).join('') + '</select></div></div>' +
        '<div class="field"><label>Short summary (shown on the card)</label><input class="input" name="summary" maxlength="200" value="' + esc(it.summary || '') + '"></div>' +
        '<div class="field"><label>Full description</label><textarea class="input" name="description" rows="4" maxlength="2000">' + esc(it.description || '') + '</textarea></div>' +
        '<div class="grid-2"><div class="field"><label>Price in naira (blank = price on request)</label><input class="input" type="number" name="price" min="0" value="' + (it.price == null ? '' : it.price) + '"></div></div>' +
        itemImageField(it, 'Product photo', false) +
        '<p class="form-error" id="pf-err" role="alert"></p>' +
        '<div class="sub-actions"><button type="button" class="btn btn-ghost" data-cancel>Cancel</button><button type="submit" class="btn btn-solid" id="pf-go">' + (isNew ? 'Create product' : 'Save changes') + '</button></div></form>',
      onMount: function (box, inst) {
        var removed = false;
        bindImageField(box, async function () {
          if (!window.confirm('Remove this photo from the product?')) return;
          try { await api('/api/staff/products/' + encodeURIComponent(it.id) + '/image', { method: 'DELETE' }); toast('Photo removed.'); inst.close(); renderProducts(); }
          catch (e) { toast(e.message, 'err'); }
        });
        box.querySelector('[data-cancel]').addEventListener('click', inst.close);
        box.querySelector('#pf').addEventListener('submit', async function (e) {
          e.preventDefault();
          var f = e.target, err = box.querySelector('#pf-err'); err.textContent = '';
          var body = { name: fv(f, 'name'), cat: fv(f, 'cat'), summary: fv(f, 'summary'), description: fv(f, 'description'), price: fv(f, 'price') };
          var picked = box.querySelector('#if-prev').dataset.picked;
          var go = box.querySelector('#pf-go'); go.disabled = true; go.textContent = 'Saving…';
          try {
            var saved;
            if (isNew) saved = (await api('/api/staff/products', { method: 'POST', body: body })).product;
            else saved = (await api('/api/staff/products/' + encodeURIComponent(it.id), { method: 'PATCH', body: body })).product;
            if (picked) await saveImage('/api/staff/products/' + encodeURIComponent(saved.id) + '/image', picked);
            inst.close();
            toast(isNew ? 'Product added to the shop.' : 'Product saved.');
            renderProducts();
          } catch (ex) { err.textContent = ex.message; go.disabled = false; go.textContent = isNew ? 'Create product' : 'Save changes'; }
        });
      } });
  }

  async function renderProducts() {
    crumb.textContent = 'Shop products';
    var d = await api('/api/products');
    var cats = d.categories;
    var catLabel = function (id) { var c = cats.find(function (x) { return x.id === id; }); return c ? c.label : id; };
    setView(head('Shop', 'Shop products', 'Add, edit and remove the products customers see in the shop.') +
      '<div class="dt-tools"><span class="muted">' + d.products.length + ' products</span><button class="btn btn-solid" type="button" id="p-new">Add product</button></div>' +
      '<section class="box"><div class="dt-wrap"><table class="dt"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Photo</th><th></th></tr></thead><tbody>' +
      d.products.map(function (p, i) {
        return '<tr style="--i:' + i + '"><td><div class="thumb-cell">' + (p.image ? '<img src="' + esc(p.image) + '" alt="">' : '<span class="thumb-empty">No photo</span>') +
          '<div><b>' + esc(p.name) + '</b><p class="muted small">' + esc(p.summary || '') + '</p></div></div></td>' +
          '<td>' + esc(catLabel(p.cat)) + '</td><td>' + (p.price ? naira(p.price) : '<span class="muted">On request</span>') + '</td>' +
          '<td>' + (p.hasImage ? '<span class="gpill pass">Uploaded</span>' : p.image ? '<span class="gpill none">Stock photo</span>' : '<span class="gpill none">None</span>') + '</td>' +
          '<td class="dt-act"><button class="btn btn-ghost btn-sm" type="button" data-edit="' + esc(p.id) + '">Edit</button> <button class="btn btn-ghost btn-sm" type="button" data-del="' + esc(p.id) + '">Delete</button></td></tr>';
      }).join('') + '</tbody></table></div></section>');
    document.getElementById('p-new').addEventListener('click', function () { productForm(cats, null); });
    view.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () { productForm(cats, d.products.find(function (p) { return p.id === b.getAttribute('data-edit'); })); });
    });
    view.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!window.confirm('Delete this product from the shop?')) return;
        try { await api('/api/staff/products/' + encodeURIComponent(b.getAttribute('data-del')), { method: 'DELETE' }); toast('Product deleted.'); renderProducts(); }
        catch (e) { toast(e.message, 'err'); }
      });
    });
  }

  /* ---------- Selected work (homepage "Recent frames") ---------- */
  function workForm(item) {
    var isNew = !item, it = item || {};
    DModal.open({ size: 'lg', eyebrow: isNew ? 'New work' : 'Edit work', title: isNew ? 'Add to Recent frames' : esc(it.title), body:
      '<form class="sub-form" id="wf" novalidate>' +
        '<div class="grid-2"><div class="field"><label>Title</label><input class="input" name="title" required maxlength="120" value="' + esc(it.title || '') + '"></div>' +
        '<div class="field"><label>Category (filter button)</label><input class="input" name="category" list="wf-cats" required maxlength="30" value="' + esc(it.category || 'studio') + '"><datalist id="wf-cats"><option value="studio"><option value="editing"><option value="camera"><option value="drone"><option value="events"></datalist></div></div>' +
        '<div class="grid-2"><div class="field"><label>Label on the photo</label><input class="input" name="caption" maxlength="40" value="' + esc(it.caption || '') + '" placeholder="e.g. Studio"></div>' +
        '<div class="field"><label>Description for screen readers</label><input class="input" name="alt" maxlength="160" value="' + esc(it.alt || '') + '"></div></div>' +
        itemImageField(it, 'Work photo', true) +
        '<p class="form-error" id="wf-err" role="alert"></p>' +
        '<div class="sub-actions"><button type="button" class="btn btn-ghost" data-cancel>Cancel</button><button type="submit" class="btn btn-solid" id="wf-go">' + (isNew ? 'Add to the homepage' : 'Save changes') + '</button></div></form>',
      onMount: function (box, inst) {
        bindImageField(box, async function () {
          if (!window.confirm('Remove this photo? A work needs a photo to show on the homepage.')) return;
          toast('Upload a new photo to replace it.', 'err');
        });
        box.querySelector('[data-cancel]').addEventListener('click', inst.close);
        box.querySelector('#wf').addEventListener('submit', async function (e) {
          e.preventDefault();
          var f = e.target, err = box.querySelector('#wf-err'); err.textContent = '';
          var picked = box.querySelector('#if-prev').dataset.picked;
          if (isNew && !picked) { err.textContent = 'Please add a photo for this work.'; return; }
          var body = { title: fv(f, 'title'), category: fv(f, 'category'), caption: fv(f, 'caption'), alt: fv(f, 'alt') };
          var go = box.querySelector('#wf-go'); go.disabled = true; go.textContent = 'Saving…';
          try {
            var saved;
            if (isNew) { body.data = picked; saved = (await api('/api/staff/works', { method: 'POST', body: body })).work; }
            else { saved = (await api('/api/staff/works/' + encodeURIComponent(it.id), { method: 'PATCH', body: body })).work; if (picked) await saveImage('/api/staff/works/' + encodeURIComponent(it.id) + '/image', picked); }
            inst.close();
            toast(isNew ? 'Added. It is now showing in Recent frames.' : 'Work saved.');
            renderWorks();
          } catch (ex) { err.textContent = ex.message; go.disabled = false; go.textContent = isNew ? 'Add to the homepage' : 'Save changes'; }
        });
      } });
  }

  async function renderWorks() {
    crumb.textContent = 'Selected work';
    var d = await api('/api/works');
    setView(head('Homepage', 'Selected work', 'These photos appear in “Recent frames” on the homepage. Newest work is shown first.') +
      '<div class="dt-tools"><span class="muted">' + d.works.length + ' works on the homepage</span><button class="btn btn-solid" type="button" id="w-new">Add work</button></div>' +
      '<section class="box"><div class="dt-wrap"><table class="dt"><thead><tr><th>Photo</th><th>Title</th><th>Category</th><th>Label</th><th></th></tr></thead><tbody>' +
      (d.works.length ? d.works.map(function (w, i) {
        return '<tr style="--i:' + i + '"><td><div class="thumb-cell wide">' + (w.image ? '<img src="' + esc(w.image) + '" alt="">' : '<span class="thumb-empty">No photo</span>') + '</div></td>' +
          '<td><b>' + esc(w.title) + '</b></td><td><span class="gpill none">' + esc(w.category) + '</span></td><td>' + esc(w.caption || '') + '</td>' +
          '<td class="dt-act"><button class="btn btn-ghost btn-sm" type="button" data-edit="' + esc(w.id) + '">Edit</button> <button class="btn btn-ghost btn-sm" type="button" data-del="' + esc(w.id) + '">Delete</button></td></tr>';
      }).join('') : '<tr><td colspan="5" class="muted">No work yet. Add your first photo.</td></tr>') + '</tbody></table></div></section>');
    document.getElementById('w-new').addEventListener('click', function () { workForm(null); });
    view.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () { workForm(d.works.find(function (w) { return w.id === b.getAttribute('data-edit'); })); });
    });
    view.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!window.confirm('Remove this work from the homepage?')) return;
        try { await api('/api/staff/works/' + encodeURIComponent(b.getAttribute('data-del')), { method: 'DELETE' }); toast('Removed from the homepage.'); renderWorks(); }
        catch (e) { toast(e.message, 'err'); }
      });
    });
  }

  /* ---------- Site settings (admin) ---------- */
  var SETTING_FIELDS = [
    ['businessName', 'Business name', 'text'], ['tagline', 'Tagline under the logo', 'text'],
    ['phone1', 'Phone 1', 'tel'], ['phone2', 'Phone 2', 'tel'],
    ['whatsapp', 'WhatsApp number (with country code, no +)', 'text'], ['email', 'Email address', 'email'],
    ['address', 'Address', 'textarea'], ['hours', 'Opening hours', 'text'],
    ['facebook', 'Facebook link', 'url'], ['instagram', 'Instagram link', 'url'], ['tiktok', 'TikTok link', 'url'], ['youtube', 'YouTube link', 'url']
  ];
  async function renderSettings() {
    crumb.textContent = 'Site settings';
    var s = (await api('/api/settings')).settings;
    setView(head('Website', 'Site settings', 'Change phone numbers, WhatsApp, address and social links here. The website updates straight away.') +
      '<section class="box"><form class="sub-form" id="set-form">' +
        '<div class="grid-2">' + SETTING_FIELDS.filter(function (f) { return f[2] !== 'textarea'; }).map(function (f) {
          return '<div class="field"><label>' + esc(f[1]) + '</label><input class="input" type="' + (f[2] === 'tel' ? 'tel' : f[2]) + '" name="' + f[0] + '" value="' + esc(s[f[0]] || '') + '" maxlength="120"></div>';
        }).join('') + '</div>' +
        SETTING_FIELDS.filter(function (f) { return f[2] === 'textarea'; }).map(function (f) {
          return '<div class="field"><label>' + esc(f[1]) + '</label><textarea class="input" name="' + f[0] + '" rows="2" maxlength="240">' + esc(s[f[0]] || '') + '</textarea></div>';
        }).join('') +
        '<div class="set-announce"><label class="set-toggle"><input type="checkbox" name="announcementOn"' + (s.announcementOn ? ' checked' : '') + '><span class="set-slider"></span><b>Show an announcement on every page</b></label>' +
        '<div class="field"><label>Announcement text</label><input class="input" name="announcement" maxlength="240" value="' + esc(s.announcement || '') + '" placeholder="e.g. Live training starts 19 November 2026"></div></div>' +
        '<p class="form-error" id="set-err" role="alert"></p>' +
        '<div class="sub-actions"><button type="submit" class="btn btn-solid" id="set-go">Save settings</button></div>' +
      '</form></section>');
    document.getElementById('set-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var f = e.target, err = document.getElementById('set-err'); err.textContent = '';
      var body = {};
      SETTING_FIELDS.forEach(function (x) { body[x[0]] = fv(f, x[0]); });
      body.announcementOn = !!f.elements.announcementOn.checked;
      body.announcement = fv(f, 'announcement');
      var go = document.getElementById('set-go'); go.disabled = true; go.textContent = 'Saving…';
      try { await api('/api/staff/settings', { method: 'PUT', body: body }); toast('Settings saved. The website is updated.'); }
      catch (ex) { err.textContent = ex.message; }
      finally { go.disabled = false; go.textContent = 'Save settings'; }
    });
  }

  /* ---------- Set-up and backup (admin) ---------- */
  async function renderSetup() {
    crumb.textContent = 'Set-up and backup';
    var st = await api('/api/staff/status');
    var done = st.checks.filter(function (c) { return c.ok; }).length;
    setView(head('Launch', 'Set-up and backup', 'Everything that must be in place before the site goes live, and your backups.') +
      '<section class="box setup-top"><div><p class="eyebrow">Launch readiness</p><b class="setup-n">' + done + ' / ' + st.checks.length + '</b><p class="muted">' +
        (st.ready ? 'Everything is in place.' : 'Work through the items below. Each one says exactly what to do.') + '</p></div>' +
        '<div class="setup-counts"><div><b>' + st.counts.students + '</b><span>students</span></div><div><b>' + st.counts.courses + '</b><span>courses</span></div><div><b>' + st.counts.products + '</b><span>products</span></div><div><b>' + st.counts.works + '</b><span>works</span></div><div><b>' + st.counts.subscribers + '</b><span>subscribers</span></div></div></section>' +
      '<section class="box"><div class="dt-wrap"><table class="dt"><thead><tr><th>Item</th><th>Status</th><th>What to do</th></tr></thead><tbody>' +
        st.checks.map(function (c, i) {
          return '<tr style="--i:' + i + '"><td><b>' + esc(c.label) + '</b></td><td><span class="gpill ' + (c.ok ? 'pass' : 'fail') + '">' + (c.ok ? 'Ready' : 'Needs action') + '</span></td><td class="muted">' + (c.ok ? '—' : esc(c.fix)) + '</td></tr>';
        }).join('') + '</tbody></table></div></section>' +
      '<section class="box backup-box"><div><p class="eyebrow">Backup</p><h3>Save a copy of all website data</h3><p class="muted">' +
        (st.lastBackup ? 'Last backup on the server: ' + esc(fmt(st.lastBackup)) : 'No backup has been made on the server yet.') + '</p></div>' +
        '<div class="row-actions"><button class="btn btn-ghost" type="button" id="bk-make">Create backup on the server</button><button class="btn btn-solid" type="button" id="bk-dl">Download backup file</button></div></section>');
    document.getElementById('bk-make').addEventListener('click', async function () {
      try { var r = await api('/api/staff/backup', { method: 'POST' }); toast('Backup saved on the server: ' + r.name); renderSetup(); }
      catch (e) { toast(e.message, 'err'); }
    });
    document.getElementById('bk-dl').addEventListener('click', function () {
      window.location.href = '/api/staff/backup/download';
    });
  }

  /* ---------- Services: what we do (admin) ---------- */
  function serviceForm(item) {
    var isNew = !item, it = item || {};
    DModal.open({ size: 'lg', eyebrow: isNew ? 'New service' : 'Edit service', title: isNew ? 'Add a service' : esc(it.title), body:
      '<form class="sub-form" id="sf" novalidate>' +
        '<div class="field"><label>Service name</label><input class="input" name="title" required maxlength="120" value="' + esc(it.title || '') + '"></div>' +
        '<div class="field"><label>Short summary (shown on the homepage and services page)</label><input class="input" name="summary" maxlength="220" value="' + esc(it.summary || '') + '"></div>' +
        '<div class="field"><label>Full description (shown on the service page). Press Enter for a new paragraph. Start a line with - to make a bullet point.</label><textarea class="input" name="description" rows="6" maxlength="3000">' + esc(it.description || '') + '</textarea></div>' +
        itemImageField(it, 'Service photo', false) +
        '<p class="form-error" id="sf-err" role="alert"></p>' +
        '<div class="sub-actions"><button type="button" class="btn btn-ghost" data-cancel>Cancel</button><button type="submit" class="btn btn-solid" id="sf-go">' + (isNew ? 'Create service' : 'Save changes') + '</button></div></form>',
      onMount: function (box, inst) {
        bindImageField(box, async function () {
          if (!window.confirm('Remove this photo from the service?')) return;
          try { await api('/api/staff/services/' + encodeURIComponent(it.id) + '/image', { method: 'DELETE' }); toast('Photo removed.'); inst.close(); renderServices(); }
          catch (e) { toast(e.message, 'err'); }
        });
        box.querySelector('[data-cancel]').addEventListener('click', inst.close);
        box.querySelector('#sf').addEventListener('submit', async function (e) {
          e.preventDefault();
          var f = e.target, err = box.querySelector('#sf-err'); err.textContent = '';
          var picked = box.querySelector('#if-prev').dataset.picked;
          var body = { title: fv(f, 'title'), summary: fv(f, 'summary'), description: fv(f, 'description') };
          var go = box.querySelector('#sf-go'); go.disabled = true; go.textContent = 'Saving…';
          try {
            var saved;
            if (isNew) { if (picked) body.data = picked; saved = (await api('/api/staff/services', { method: 'POST', body: body })).service; }
            else { saved = (await api('/api/staff/services/' + encodeURIComponent(it.id), { method: 'PATCH', body: body })).service; if (picked) await saveImage('/api/staff/services/' + encodeURIComponent(it.id) + '/image', picked); }
            inst.close();
            toast(isNew ? 'Service added. It now shows on the website.' : 'Service saved.');
            renderServices();
          } catch (ex) { err.textContent = ex.message; go.disabled = false; go.textContent = isNew ? 'Create service' : 'Save changes'; }
        });
      } });
  }
  async function renderServices() {
    crumb.textContent = 'Services';
    var d = await api('/api/services');
    setView(head('Website', 'Services', 'The services shown on the homepage and on the Services page. Use the arrows to change the order. Numbers follow this order.') +
      '<div class="dt-tools"><span class="muted">' + d.services.length + ' services</span><button class="btn btn-solid" type="button" id="s-new">Add service</button></div>' +
      '<section class="box"><div class="dt-wrap"><table class="dt"><thead><tr><th>No.</th><th>Service</th><th>Summary</th><th>Order</th><th></th></tr></thead><tbody>' +
      (d.services.length ? d.services.map(function (s, i) {
        return '<tr style="--i:' + i + '"><td><span class="sv-no">' + String(s.number).padStart(2, '0') + '</span></td>' +
          '<td><div class="thumb-cell">' + (s.image ? '<img src="' + esc(s.image) + '" alt="">' : '<span class="thumb-empty">No photo</span>') + '<div><b>' + esc(s.title) + '</b></div></div></td>' +
          '<td class="muted small">' + esc(s.summary || '') + '</td>' +
          '<td><button class="btn btn-ghost btn-sm" type="button" data-move="up" data-id="' + esc(s.id) + '"' + (i === 0 ? ' disabled' : '') + '>↑</button> <button class="btn btn-ghost btn-sm" type="button" data-move="down" data-id="' + esc(s.id) + '"' + (i === d.services.length - 1 ? ' disabled' : '') + '>↓</button></td>' +
          '<td class="dt-act"><button class="btn btn-ghost btn-sm" type="button" data-edit="' + esc(s.id) + '">Edit</button> <button class="btn btn-ghost btn-sm" type="button" data-del="' + esc(s.id) + '">Delete</button></td></tr>';
      }).join('') : '<tr><td colspan="5" class="muted">No services yet.</td></tr>') + '</tbody></table></div></section>');
    document.getElementById('s-new').addEventListener('click', function () { serviceForm(null); });
    view.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () { serviceForm(d.services.find(function (s) { return s.id === b.getAttribute('data-edit'); })); });
    });
    view.querySelectorAll('[data-move]').forEach(function (b) {
      b.addEventListener('click', async function () {
        try { await api('/api/staff/services/' + encodeURIComponent(b.getAttribute('data-id')) + '/move', { method: 'POST', body: { direction: b.getAttribute('data-move') } }); renderServices(); }
        catch (e) { toast(e.message, 'err'); }
      });
    });
    view.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!window.confirm('Delete this service from the website?')) return;
        try { await api('/api/staff/services/' + encodeURIComponent(b.getAttribute('data-del')), { method: 'DELETE' }); toast('Service deleted.'); renderServices(); }
        catch (e) { toast(e.message, 'err'); }
      });
    });
  }

  /* ---------- Feedback (admin) ---------- */
  async function renderFeedback() {
    crumb.textContent = 'Feedback';
    var d = await api('/api/staff/feedback');
    var ST = [['new','New'],['reviewing','Reviewing'],['planned','Planned'],['done','Done'],['declined','Declined']];
    setView(head('Audience', 'Feedback and suggestions', 'Ideas and problems sent from the website. Set a status and a note for each one.') +
      '<section class="box"><div class="dt-wrap"><table class="dt"><thead><tr><th>From</th><th>Message</th><th>Status</th><th>Note</th><th></th></tr></thead><tbody>' +
      (d.feedback.length ? d.feedback.map(function (f, i) {
        return '<tr style="--i:' + i + '" data-id="' + esc(f.id) + '"><td><b>' + esc(f.name) + '</b><div class="muted small">' + esc(f.email || 'no email') + '</div><div class="muted small">' + esc(fmt(f.createdAt)) + '</div></td>' +
          '<td style="max-width:360px"><span class="gpill none">' + esc(f.category) + '</span><p class="mk-work">' + esc(f.message) + '</p></td>' +
          '<td><select class="input" data-status>' + ST.map(function (s) { return '<option value="' + s[0] + '"' + (s[0] === f.status ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select></td>' +
          '<td><input class="input" data-note maxlength="500" value="' + esc(f.note || '') + '"></td>' +
          '<td class="dt-act"><button class="btn btn-solid btn-sm" type="button" data-save>Save</button></td></tr>';
      }).join('') : '<tr><td colspan="5" class="muted">No feedback yet.</td></tr>') + '</tbody></table></div></section>');
    view.querySelectorAll('[data-save]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var row = b.closest('tr');
        try {
          await api('/api/staff/feedback/' + encodeURIComponent(row.getAttribute('data-id')), { method: 'PATCH', body: { status: row.querySelector('[data-status]').value, note: row.querySelector('[data-note]').value } });
          toast('Saved.');
        } catch (e) { toast(e.message, 'err'); }
      });
    });
  }

  /* ---------- Instructor applications (admin) ---------- */
  async function renderApplications() {
    crumb.textContent = 'Instructor applications';
    var d = await api('/api/staff/applications');
    var ST = [['new','New'],['under_review','Under review'],['approved','Approved'],['declined','Declined']];
    setView(head('Team', 'Instructor applications', 'Review each applicant before anything is published. Agree payment and revenue terms in writing before approving.') +
      '<section class="box"><div class="dt-wrap"><table class="dt"><thead><tr><th>Applicant</th><th>Expertise and course</th><th>Status</th><th>Note</th><th></th></tr></thead><tbody>' +
      (d.applications.length ? d.applications.map(function (a, i) {
        return '<tr style="--i:' + i + '" data-id="' + esc(a.id) + '"><td><b>' + esc(a.fullName) + '</b><div class="muted small">' + esc(a.email) + (a.phone ? ' · ' + esc(a.phone) : '') + '</div><div class="muted small">' + esc(fmt(a.createdAt)) + '</div></td>' +
          '<td><b>' + esc(a.expertise) + '</b><div class="muted small">Course: ' + esc(a.proposedCourse) + '</div>' + (a.portfolio ? '<a class="mk-link" href="' + esc(a.portfolio) + '" target="_blank" rel="noopener">Portfolio ↗</a>' : '') + '</td>' +
          '<td><select class="input" data-status>' + ST.map(function (s) { return '<option value="' + s[0] + '"' + (s[0] === a.status ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select></td>' +
          '<td><input class="input" data-note maxlength="800" value="' + esc(a.note || '') + '"></td>' +
          '<td class="dt-act"><button class="btn btn-ghost btn-sm" type="button" data-view-app>Details</button> <button class="btn btn-solid btn-sm" type="button" data-save>Save</button></td></tr>';
      }).join('') : '<tr><td colspan="5" class="muted">No applications yet.</td></tr>') + '</tbody></table></div></section>');
    view.querySelectorAll('[data-view-app]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = d.applications.find(function (x) { return x.id === b.closest('tr').getAttribute('data-id'); });
        DModal.open({ size: 'md', eyebrow: 'Application', title: esc(a.fullName), body:
          '<dl class="course-facts"><div><dt>Email</dt><dd>' + esc(a.email) + '</dd></div><div><dt>Phone</dt><dd>' + esc(a.phone || '—') + '</dd></div>' +
          '<div><dt>Expertise</dt><dd>' + esc(a.expertise) + '</dd></div><div><dt>Course</dt><dd>' + esc(a.proposedCourse) + '</dd></div>' +
          '<div><dt>Availability</dt><dd>' + esc(a.availability || '—') + '</dd></div><div><dt>Portfolio</dt><dd>' + esc(a.portfolio || '—') + '</dd></div></dl>' +
          '<p class="form-label">Experience</p><p class="res-fb">' + esc(a.experience || '—') + '</p>' });
      });
    });
    view.querySelectorAll('[data-save]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var row = b.closest('tr');
        try {
          await api('/api/staff/applications/' + encodeURIComponent(row.getAttribute('data-id')), { method: 'PATCH', body: { status: row.querySelector('[data-status]').value, note: row.querySelector('[data-note]').value } });
          toast('Saved.');
        } catch (e) { toast(e.message, 'err'); }
      });
    });
  }

  /* ---------- Webinars (admin) ---------- */
  function webinarForm(w) {
    var isNew = !w, it = w || {};
    var local = it.startsAt ? new Date(it.startsAt).toISOString().slice(0, 16) : '';
    DModal.open({ size: 'md', eyebrow: isNew ? 'New webinar' : 'Edit webinar', title: isNew ? 'Schedule a free webinar' : esc(it.title), body:
      '<form class="sub-form" id="wbf" novalidate>' +
        '<div class="field"><label>Title</label><input class="input" name="title" required maxlength="120" value="' + esc(it.title || '') + '"></div>' +
        '<div class="field"><label>Description</label><textarea class="input" name="description" rows="3" maxlength="1500">' + esc(it.description || '') + '</textarea></div>' +
        '<div class="grid-2"><div class="field"><label>Date and time</label><input class="input" type="datetime-local" name="startsAt" required value="' + esc(local) + '"></div>' +
        '<div class="field"><label>Instructor</label><input class="input" name="instructor" maxlength="120" value="' + esc(it.instructor || '') + '"></div></div>' +
        '<div class="grid-3"><div class="field"><label>Duration (minutes)</label><input class="input" type="number" name="durationMinutes" min="10" max="480" value="' + esc(it.durationMinutes || 60) + '"></div>' +
        '<div class="field"><label>Seats (empty = no limit)</label><input class="input" type="number" name="capacity" min="1" value="' + esc(it.capacity || '') + '"></div>' +
        '<div class="field"><label>Join link</label><input class="input" name="link" maxlength="300" placeholder="https://" value="' + esc(it.link || '') + '"></div></div>' +
        '<p class="form-error" id="wbf-err" role="alert"></p>' +
        '<div class="sub-actions"><button type="button" class="btn btn-ghost" data-cancel>Cancel</button><button type="submit" class="btn btn-solid">' + (isNew ? 'Schedule webinar' : 'Save changes') + '</button></div></form>',
      onMount: function (box, inst) {
        box.querySelector('[data-cancel]').addEventListener('click', inst.close);
        box.querySelector('#wbf').addEventListener('submit', async function (e) {
          e.preventDefault();
          var f = e.target, err = box.querySelector('#wbf-err'); err.textContent = '';
          var body = { title: fv(f, 'title'), description: fv(f, 'description'), instructor: fv(f, 'instructor'), durationMinutes: fv(f, 'durationMinutes'),
            capacity: fv(f, 'capacity'), link: fv(f, 'link'), startsAt: fv(f, 'startsAt') ? new Date(fv(f, 'startsAt')).toISOString() : '' };
          try {
            await api(isNew ? '/api/staff/webinars' : '/api/staff/webinars/' + encodeURIComponent(it.id), { method: isNew ? 'POST' : 'PATCH', body: body });
            inst.close(); toast(isNew ? 'Webinar scheduled.' : 'Webinar saved.'); renderWebinars();
          } catch (ex) { err.textContent = ex.message; }
        });
      } });
  }
  async function renderWebinars() {
    crumb.textContent = 'Free webinars';
    var d = await api('/api/staff/webinars');
    setView(head('Academy', 'Free webinars', 'Free live introductions. Registrations are listed for each webinar.') +
      '<div class="dt-tools"><span class="muted">' + d.webinars.length + ' webinars</span><button class="btn btn-solid" type="button" id="wb-new">Schedule webinar</button></div>' +
      '<section class="box"><div class="dt-wrap"><table class="dt"><thead><tr><th>Webinar</th><th>When</th><th>Registered</th><th></th></tr></thead><tbody>' +
      (d.webinars.length ? d.webinars.map(function (w, i) {
        return '<tr style="--i:' + i + '"><td><b>' + esc(w.title) + '</b><div class="muted small">' + esc(w.instructor || '') + '</div></td>' +
          '<td>' + esc(new Date(w.startsAt).toLocaleString('en-GB')) + (w.past ? ' <span class="gpill none">past</span>' : '') + '</td>' +
          '<td>' + w.registered + (w.capacity ? ' of ' + w.capacity : '') + '</td>' +
          '<td class="dt-act"><button class="btn btn-ghost btn-sm" type="button" data-reg="' + esc(w.id) + '">Registrants</button> <button class="btn btn-ghost btn-sm" type="button" data-edit="' + esc(w.id) + '">Edit</button> <button class="btn btn-ghost btn-sm" type="button" data-del="' + esc(w.id) + '">Delete</button></td></tr>';
      }).join('') : '<tr><td colspan="4" class="muted">No webinars yet.</td></tr>') + '</tbody></table></div></section>');
    document.getElementById('wb-new').addEventListener('click', function () { webinarForm(null); });
    view.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { webinarForm(d.webinars.find(function (w) { return w.id === b.getAttribute('data-edit'); })); }); });
    view.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!window.confirm('Delete this webinar and its registrations?')) return;
        try { await api('/api/staff/webinars/' + encodeURIComponent(b.getAttribute('data-del')), { method: 'DELETE' }); toast('Deleted.'); renderWebinars(); } catch (e) { toast(e.message, 'err'); }
      });
    });
    view.querySelectorAll('[data-reg]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var r = await api('/api/staff/webinars/' + encodeURIComponent(b.getAttribute('data-reg')) + '/registrants');
        DModal.open({ size: 'md', eyebrow: 'Registrants', title: r.registrants.length + ' registered', body:
          (r.registrants.length ? '<div class="dt-wrap"><table class="dt"><thead><tr><th>Name</th><th>Email</th><th>Registered</th></tr></thead><tbody>' +
            r.registrants.map(function (x) { return '<tr><td>' + esc(x.name) + '</td><td>' + esc(x.email) + '</td><td>' + esc(fmt(x.createdAt)) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="muted">No one has registered yet.</p>') });
      });
    });
  }

  /* ---------- Course reviews (admin) ---------- */
  async function renderReviews() {
    crumb.textContent = 'Course reviews';
    var d = await api('/api/staff/reviews');
    setView(head('Academy', 'Course reviews', 'Approve reviews before they appear on the academy page. Rejected reviews are not shown.') +
      '<section class="box"><div class="dt-wrap"><table class="dt"><thead><tr><th>Course</th><th>Student</th><th>Rating</th><th>Review</th><th>Status</th><th></th></tr></thead><tbody>' +
      (d.reviews.length ? d.reviews.map(function (r, i) {
        var pill = r.status === 'approved' ? 'pass' : r.status === 'rejected' ? 'fail' : 'none';
        return '<tr style="--i:' + i + '" data-id="' + esc(r.id) + '"><td>' + esc(r.courseTitle) + '</td><td>' + esc(r.name) + '<div class="muted small">' + esc(fmt(r.createdAt)) + '</div></td>' +
          '<td><b>' + r.rating + '</b> / 5</td><td style="max-width:320px"><p class="mk-work">' + esc(r.text) + '</p></td>' +
          '<td><span class="gpill ' + pill + '">' + esc(r.status) + '</span></td>' +
          '<td class="dt-act"><button class="btn btn-solid btn-sm" type="button" data-set="approved">Approve</button> <button class="btn btn-ghost btn-sm" type="button" data-set="rejected">Reject</button> <button class="btn btn-ghost btn-sm" type="button" data-del-rv>Delete</button></td></tr>';
      }).join('') : '<tr><td colspan="6" class="muted">No reviews yet.</td></tr>') + '</tbody></table></div></section>');
    view.querySelectorAll('[data-set]').forEach(function (b) {
      b.addEventListener('click', async function () {
        try { await api('/api/staff/reviews/' + encodeURIComponent(b.closest('tr').getAttribute('data-id')), { method: 'PATCH', body: { status: b.getAttribute('data-set') } }); renderReviews(); }
        catch (e) { toast(e.message, 'err'); }
      });
    });
    view.querySelectorAll('[data-del-rv]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!window.confirm('Delete this review?')) return;
        try { await api('/api/staff/reviews/' + encodeURIComponent(b.closest('tr').getAttribute('data-id')), { method: 'DELETE' }); renderReviews(); } catch (e) { toast(e.message, 'err'); }
      });
    });
  }

  /* ---------- Certificates (admin) ---------- */
  function askDecline(req, done) {
    DModal.open({ size: 'sm', eyebrow: 'Decline certificate', title: esc(req.student), body:
      '<form class="sub-form" id="dcf"><p class="muted small">' + esc(req.course) + '</p>' +
      '<div class="field"><label for="dc-reason">Tell the student briefly why it was declined</label><textarea class="input" id="dc-reason" name="reason" rows="4" maxlength="400" required></textarea></div>' +
      '<p class="form-error" id="dcf-err" role="alert"></p><div class="sub-actions"><button type="button" class="btn btn-ghost" data-cancel>Cancel</button><button type="submit" class="btn btn-solid">Decline</button></div></form>',
      onMount: function (box, inst) {
        box.querySelector('[data-cancel]').addEventListener('click', inst.close);
        box.querySelector('#dcf').addEventListener('submit', async function (e) {
          e.preventDefault();
          var reason = fv(e.target, 'reason');
          if (reason.length < 5) { box.querySelector('#dcf-err').textContent = 'Please write a short reason (at least 5 characters).'; return; }
          try { await api('/api/staff/cert-requests/' + encodeURIComponent(req.id) + '/decline', { method: 'POST', body: { reason: reason } }); inst.close(); toast('Request declined. The student has been told why.'); done(); }
          catch (ex) { box.querySelector('#dcf-err').textContent = ex.message; }
        });
      } });
  }
  async function renderCertificates() {
    crumb.textContent = 'Certificates';
    var q = (await api('/api/staff/cert-requests')).requests, d = await api('/api/staff/certificates');
    var pending = q.filter(function (r) { return r.status === 'requested'; });
    setView(head('Academy', 'Certificates', 'Certificates are issued only when you approve a student\'s request.') +
      '<section class="box"><p class="eyebrow">Waiting for approval (' + pending.length + ')</p><div class="dt-wrap"><table class="dt"><thead><tr><th>Student</th><th>Course</th><th>Requested</th><th></th></tr></thead><tbody>' +
      (pending.length ? pending.map(function (r, i) {
        return '<tr style="--i:' + i + '" data-id="' + esc(r.id) + '"><td><b>' + esc(r.student) + '</b><div class="muted small">' + esc(r.email) + '</div></td><td>' + esc(r.course) + '</td><td>' + esc(fmt(r.createdAt)) + '</td>' +
          '<td class="dt-act"><button class="btn btn-solid btn-sm" type="button" data-cert="approve">Approve and issue</button> <button class="btn btn-ghost btn-sm" type="button" data-cert="decline">Decline</button></td></tr>';
      }).join('') : '<tr><td colspan="4" class="muted">No requests waiting. New requests appear here.</td></tr>') + '</tbody></table></div></section>' +
      '<section class="box" style="margin-top:16px"><p class="eyebrow">Issued certificates</p><div class="dt-wrap"><table class="dt"><thead><tr><th>Student</th><th>Course</th><th>Issued</th><th>Code</th><th></th></tr></thead><tbody>' +
      (d.certificates.length ? d.certificates.map(function (c, i) {
        return '<tr style="--i:' + i + '"><td><b>' + esc(c.studentName) + '</b></td><td>' + esc(c.courseTitle) + '</td><td>' + esc(fmt(c.issuedAt)) + '</td><td><b>' + esc(c.code) + '</b></td>' +
          '<td class="dt-act"><a class="btn btn-ghost btn-sm" href="certificate.html?code=' + encodeURIComponent(c.code) + '" target="_blank" rel="noopener">Verify</a></td></tr>';
      }).join('') : '<tr><td colspan="5" class="muted">No certificates issued yet.</td></tr>') + '</tbody></table></div></section>');
    view.querySelectorAll('[data-cert]').forEach(function (b) {
      var row = b.closest('tr'), id = row.getAttribute('data-id');
      var req = pending.find(function (r) { return r.id === id; });
      b.addEventListener('click', function () {
        if (b.getAttribute('data-cert') === 'decline') return askDecline(req, renderCertificates);
        b.disabled = true;
        api('/api/staff/cert-requests/' + encodeURIComponent(id) + '/approve', { method: 'POST', body: {} })
          .then(function () { toast('Certificate issued. The student can now download it.'); renderCertificates(); })
          .catch(function (e) { toast(e.message, 'err'); b.disabled = false; });
      });
    });
  }

  /* ---------- Transfer approvals (admin): check each receipt, then approve or reject ---------- */
  var TSTAT = { awaiting_transfer: 'Awaiting transfer', awaiting_proof: 'Transfer confirmed, no receipt yet', proof_uploaded: 'Waiting for your approval', rejected: 'Rejected', approved: 'Approved' };
  var tFilter = 'proof_uploaded';
  async function renderTransfers() {
    crumb.textContent = 'Payment approvals';
    var d = await api('/api/staff/orders' + (tFilter ? '?status=' + tFilter : ''));
    var tabs = [['proof_uploaded', 'Waiting for approval'], ['awaiting_proof', 'Transfer made, no receipt'], ['awaiting_transfer', 'Not paid yet'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['', 'All']];
    setView(head('Money in', 'Payment approvals', 'Check each bank transfer receipt. Approve it to open the course for the student straight away.') +
      '<div class="tr-tabs">' + tabs.map(function (t) { return '<button type="button" class="tr-tab' + (tFilter === t[0] ? ' on' : '') + '" data-tf="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<section class="box"><div class="dt-wrap"><table class="dt tr-table"><thead><tr><th>Student</th><th>For</th><th>Amount</th><th>Reference</th><th>Status</th><th>Receipt</th><th></th></tr></thead><tbody>' +
      (d.orders.length ? d.orders.map(function (o, i) {
        var act = o.status === 'proof_uploaded' ? '<button class="btn btn-solid btn-sm" type="button" data-ap="approve">Approve</button> <button class="btn btn-ghost btn-sm" type="button" data-ap="reject">Reject</button>' : '';
        var rc = o.hasProof ? '<button class="btn btn-ghost btn-sm" type="button" data-rc="' + esc(o.id) + '">View receipt</button>' : '<span class="muted small">None</span>';
        return '<tr style="--i:' + i + '" data-id="' + esc(o.id) + '"><td><b>' + esc(o.student) + '</b><div class="muted small">' + esc(o.email) + '</div></td><td>' + esc(o.item) + '<div class="muted small">' + esc(o.kind) + '</div></td>' +
          '<td><b>' + naira(o.amount) + '</b></td><td><code>' + esc(o.reference) + '</code></td>' +
          '<td><span class="gpill ' + (o.status === 'approved' ? 'pass' : o.status === 'rejected' ? 'fail' : 'none') + '">' + esc(TSTAT[o.status] || o.status) + '</span></td>' +
          '<td>' + rc + '</td><td class="dt-act">' + act + '</td></tr>';
      }).join('') : '<tr><td colspan="7" class="muted">Nothing here right now.</td></tr>') + '</tbody></table></div></section>');
    view.querySelectorAll('[data-tf]').forEach(function (b) { b.addEventListener('click', function () { tFilter = b.getAttribute('data-tf'); renderTransfers(); }); });
    view.querySelectorAll('[data-rc]').forEach(function (b) {
      b.addEventListener('click', function () {
        var url = '/api/staff/orders/' + encodeURIComponent(b.getAttribute('data-rc')) + '/proof';
        fetch(url, { credentials: 'same-origin' }).then(function (r) { return r.blob(); }).then(function (blob) {
          var src = URL.createObjectURL(blob), isPdf = blob.type === 'application/pdf';
          DModal.open({ size: 'lg', eyebrow: 'Receipt', title: 'Check the transfer', body:
            '<div class="rcp-view">' + (isPdf ? '<iframe src="' + src + '" title="Receipt"></iframe>' : '<img src="' + src + '" alt="Receipt">') + '</div>' +
            '<p class="muted small">Check the amount, the account it was sent to, and the date before you approve.</p>' });
        }).catch(function () { toast('Could not open the receipt.', 'err'); });
      });
    });
    view.querySelectorAll('[data-ap]').forEach(function (b) {
      b.addEventListener('click', function () {
        var row = b.closest('tr'), id = row.getAttribute('data-id');
        if (b.getAttribute('data-ap') === 'approve') {
          b.disabled = true;
          api('/api/staff/orders/' + encodeURIComponent(id), { method: 'PATCH', body: { status: 'approved' } })
            .then(function () { toast('Approved. The student\'s course is open now.'); renderTransfers(); })
            .catch(function (e) { toast(e.message, 'err'); b.disabled = false; });
          return;
        }
        DModal.open({ size: 'sm', eyebrow: 'Reject receipt', title: 'Why is it rejected?', body:
          '<form class="sub-form" id="rj-form"><div class="field"><label for="rj-reason">Tell the student what to fix</label><textarea class="input" id="rj-reason" name="reason" rows="4" maxlength="400" required placeholder="For example: the amount is short by ₦5,000, or the receipt is blurred."></textarea></div>' +
          '<p class="form-error" id="rj-err" role="alert"></p><div class="sub-actions"><button type="button" class="btn btn-ghost" data-cancel>Cancel</button><button type="submit" class="btn btn-solid">Reject receipt</button></div></form>',
          onMount: function (box, inst) {
            box.querySelector('[data-cancel]').addEventListener('click', inst.close);
            box.querySelector('#rj-form').addEventListener('submit', async function (e) {
              e.preventDefault();
              var reason = fv(e.target, 'reason');
              if (reason.length < 5) { box.querySelector('#rj-err').textContent = 'Please write a short reason.'; return; }
              try { await api('/api/staff/orders/' + encodeURIComponent(id), { method: 'PATCH', body: { status: 'rejected', reason: reason } }); inst.close(); toast('Rejected. The student has been told what to fix.'); renderTransfers(); }
              catch (ex) { box.querySelector('#rj-err').textContent = ex.message; }
            });
          } });
      });
    });
  }

  /* ---------- Digital products (admin) ---------- */
  function digitalForm(p) {
    var isNew = !p, it = p || {};
    DModal.open({ size: 'lg', eyebrow: isNew ? 'New digital product' : 'Edit product', title: isNew ? 'Add an eBook or digital product' : esc(it.title), body:
      '<form class="sub-form" id="dpf" novalidate>' +
        '<div class="grid-2"><div class="field"><label>Title</label><input class="input" name="title" required maxlength="120" value="' + esc(it.title || '') + '"></div>' +
        '<div class="field"><label>Author</label><input class="input" name="author" maxlength="120" value="' + esc(it.author || 'DEBONE') + '"></div></div>' +
        '<div class="field"><label>Description</label><textarea class="input" name="description" rows="3" maxlength="2000">' + esc(it.description || '') + '</textarea></div>' +
        '<div class="grid-3"><div class="field"><label>Category</label><input class="input" name="category" maxlength="60" value="' + esc(it.category || '') + '" placeholder="eBook, Prompt pack, Template"></div>' +
        '<div class="field"><label>Price in naira (0 = free)</label><input class="input" type="number" name="price" min="0" value="' + (it.price == null ? 0 : it.price) + '"></div>' +
        '<div class="field"><label>Pages</label><input class="input" type="number" name="pages" min="1" value="' + (it.pages || '') + '"></div></div>' +
        '<div class="grid-2"><div class="field"><label>Formats</label><input class="input" name="formats" maxlength="60" value="' + esc(it.formats || 'PDF') + '"></div>' +
        '<div class="field"><label>Active (visible in the store)</label><select class="input" name="active"><option value="true"' + (it.active !== false ? ' selected' : '') + '>Yes</option><option value="false"' + (it.active === false ? ' selected' : '') + '>No</option></select></div></div>' +
        '<div class="field"><label>File link (Google Drive or similar). Buyers get this file through a controlled download.</label><input class="input" name="fileUrl" maxlength="500" placeholder="https://" value="' + esc(it.fileUrl || '') + '"></div>' +
        '<div class="field"><label>Preview link (optional, for the free preview pages)</label><input class="input" name="previewUrl" maxlength="500" placeholder="https://" value="' + esc(it.previewUrl || '') + '"></div>' +
        '<div class="field"><label>Table of contents (one line per chapter)</label><textarea class="input" name="toc" rows="4" maxlength="4000">' + esc((it.toc || []).join('\n')) + '</textarea></div>' +
        itemImageField(it, 'Cover image', false) +
        '<p class="form-error" id="dpf-err" role="alert"></p>' +
        '<div class="sub-actions"><button type="button" class="btn btn-ghost" data-cancel>Cancel</button><button type="submit" class="btn btn-solid">' + (isNew ? 'Add product' : 'Save changes') + '</button></div></form>',
      onMount: function (box, inst) {
        bindImageField(box, null);
        box.querySelector('[data-cancel]').addEventListener('click', inst.close);
        box.querySelector('#dpf').addEventListener('submit', async function (e) {
          e.preventDefault();
          var f = e.target, err = box.querySelector('#dpf-err'); err.textContent = '';
          var body = {}; ['title','author','description','category','price','pages','formats','fileUrl','previewUrl','toc','active'].forEach(function (k) { body[k] = fv(f, k); });
          var picked = box.querySelector('#if-prev').dataset.picked; if (picked) body.data = picked;
          try {
            await api(isNew ? '/api/staff/products/digital' : '/api/staff/products/digital/' + encodeURIComponent(it.id), { method: isNew ? 'POST' : 'PATCH', body: body });
            inst.close(); toast(isNew ? 'Product added.' : 'Product saved.'); renderDigital();
          } catch (ex) { err.textContent = ex.message; }
        });
      } });
  }
  async function renderDigital() {
    crumb.textContent = 'Digital products';
    var d = await api('/api/staff/products');
    setView(head('Digital Store', 'Digital products', 'eBooks, prompt packs, templates and guides. Buyers download them after payment.') +
      '<div class="dt-tools"><span class="muted">' + d.products.length + ' products</span><button class="btn btn-solid" type="button" id="dp-new">Add product</button></div>' +
      '<section class="box"><div class="dt-wrap"><table class="dt"><thead><tr><th>Product</th><th>Price</th><th>File</th><th>Sales</th><th>Status</th><th></th></tr></thead><tbody>' +
      (d.products.length ? d.products.map(function (p, i) {
        return '<tr style="--i:' + i + '"><td><div class="thumb-cell">' + (p.image ? '<img src="' + esc(p.image) + '" alt="">' : '<span class="thumb-empty">No cover</span>') + '<div><b>' + esc(p.title) + '</b><p class="muted small">' + esc(p.author || '') + '</p></div></div></td>' +
          '<td>' + (p.price ? naira(p.price) : 'Free') + '</td><td>' + (p.fileUrl ? '<span class="gpill pass">Linked</span>' : '<span class="gpill fail">No file</span>') + '</td><td>' + p.sales + '</td>' +
          '<td><span class="gpill ' + (p.active ? 'pass' : 'none') + '">' + (p.active ? 'Live' : 'Hidden') + '</span></td>' +
          '<td class="dt-act"><button class="btn btn-ghost btn-sm" type="button" data-edit="' + esc(p.id) + '">Edit</button> <button class="btn btn-ghost btn-sm" type="button" data-del="' + esc(p.id) + '">Delete</button></td></tr>';
      }).join('') : '<tr><td colspan="6" class="muted">No digital products yet.</td></tr>') + '</tbody></table></div></section>');
    document.getElementById('dp-new').addEventListener('click', function () { digitalForm(null); });
    view.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { digitalForm(d.products.find(function (p) { return p.id === b.getAttribute('data-edit'); })); }); });
    view.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!window.confirm('Delete this product? Existing buyers keep their downloads only if it is not deleted.')) return;
        try { await api('/api/staff/products/digital/' + encodeURIComponent(b.getAttribute('data-del')), { method: 'DELETE' }); toast('Deleted.'); renderDigital(); } catch (e) { toast(e.message, 'err'); }
      });
    });
  }

  /* ---------- Bundles (admin) ---------- */
  async function renderBundles() {
    crumb.textContent = 'Course bundles';
    var d = await api('/api/staff/bundles'), courses = (await api('/api/courses')).courses;
    function form(b) {
      var isNew = !b, it = b || { courseIds: [] };
      DModal.open({ size: 'md', eyebrow: isNew ? 'New bundle' : 'Edit bundle', title: isNew ? 'Create a bundle' : esc(it.title), body:
        '<form class="sub-form" id="bdf"><div class="field"><label>Bundle title</label><input class="input" name="title" required maxlength="120" value="' + esc(it.title || '') + '"></div>' +
        '<div class="field"><label>Description</label><textarea class="input" name="description" rows="2" maxlength="1000">' + esc(it.description || '') + '</textarea></div>' +
        '<div class="field"><label>Courses in the bundle (choose two or more)</label><div class="bd-pick">' + courses.filter(function (c) { return !c.comingSoon; }).map(function (c) {
          return '<label class="bd-opt"><input type="checkbox" name="courseIds" value="' + esc(c.id) + '"' + (it.courseIds.indexOf(c.id) !== -1 ? ' checked' : '') + '> ' + esc(c.title) + (c.startDate ? ' · starts ' + esc(c.startDate) : '') + (c.schedule ? ' · ' + esc(c.schedule) : '') + '</label>';
        }).join('') + '</div></div>' +
        '<div class="grid-2"><div class="field"><label>Bundle price in naira</label><input class="input" type="number" name="price" min="1" required value="' + (it.price || '') + '"></div>' +
        '<div class="field"><label>Visible on the website</label><select class="input" name="active"><option value="true"' + (it.active !== false ? ' selected' : '') + '>Yes</option><option value="false"' + (it.active === false ? ' selected' : '') + '>No</option></select></div></div>' +
        '<p class="form-error" id="bdf-err" role="alert"></p><div class="sub-actions"><button type="button" class="btn btn-ghost" data-cancel>Cancel</button><button type="submit" class="btn btn-solid">' + (isNew ? 'Create bundle' : 'Save changes') + '</button></div></form>',
        onMount: function (box, inst) {
          box.querySelector('[data-cancel]').addEventListener('click', inst.close);
          box.querySelector('#bdf').addEventListener('submit', async function (e) {
            e.preventDefault();
            var f = e.target, err = box.querySelector('#bdf-err'); err.textContent = '';
            var ids = Array.prototype.slice.call(f.querySelectorAll('[name=courseIds]:checked')).map(function (x) { return x.value; });
            try {
              await api(isNew ? '/api/staff/bundles' : '/api/staff/bundles/' + encodeURIComponent(it.id), { method: isNew ? 'POST' : 'PATCH', body: { title: fv(f, 'title'), description: fv(f, 'description'), price: fv(f, 'price'), active: fv(f, 'active') === 'true', courseIds: ids } });
              inst.close(); toast('Bundle saved.'); renderBundles();
            } catch (ex) { err.textContent = ex.message; }
          });
        } });
    }
    setView(head('Academy', 'Course bundles', 'Discounted packages. The system stops bundles whose courses clash in time.') +
      '<div class="dt-tools"><span class="muted">' + d.bundles.length + ' bundles</span><button class="btn btn-solid" type="button" id="bd-new">New bundle</button></div>' +
      '<section class="box"><div class="dt-wrap"><table class="dt"><thead><tr><th>Bundle</th><th>Courses</th><th>Price</th><th>Status</th><th></th></tr></thead><tbody>' +
      (d.bundles.length ? d.bundles.map(function (b, i) {
        return '<tr style="--i:' + i + '"><td><b>' + esc(b.title) + '</b></td><td class="small">' + b.courseIds.map(function (id) { var c = courses.find(function (x) { return x.id === id; }); return esc(c ? c.title : id); }).join(', ') + '</td><td>' + naira(b.price) + '</td>' +
          '<td><span class="gpill ' + (b.active !== false ? 'pass' : 'none') + '">' + (b.active !== false ? 'Live' : 'Hidden') + '</span></td>' +
          '<td class="dt-act"><button class="btn btn-ghost btn-sm" type="button" data-edit="' + esc(b.id) + '">Edit</button> <button class="btn btn-ghost btn-sm" type="button" data-del="' + esc(b.id) + '">Delete</button></td></tr>';
      }).join('') : '<tr><td colspan="5" class="muted">No bundles yet.</td></tr>') + '</tbody></table></div></section>');
    document.getElementById('bd-new').addEventListener('click', function () { form(null); });
    view.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { form(d.bundles.find(function (x) { return x.id === b.getAttribute('data-edit'); })); }); });
    view.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', async function () { if (!window.confirm('Delete this bundle?')) return; try { await api('/api/staff/bundles/' + encodeURIComponent(b.getAttribute('data-del')), { method: 'DELETE' }); renderBundles(); } catch (e) { toast(e.message, 'err'); } });
    });
  }

  /* ---------- Studio bookings and quotations (admin) ---------- */
  async function renderBookings() {
    crumb.textContent = 'Bookings and quotes';
    var d = await api('/api/staff/bookings');
    setView(head('Studio', 'Bookings and quotes', 'Send a quotation with a deposit. The client accepts the quotation and pays the deposit online.') +
      '<section class="box"><div class="dt-wrap"><table class="dt"><thead><tr><th>Client</th><th>Project</th><th>Status</th><th>Quotation</th><th></th></tr></thead><tbody>' +
      (d.bookings.length ? d.bookings.map(function (b, i) {
        return '<tr style="--i:' + i + '" data-id="' + esc(b.id) + '"><td><b>' + esc(b.name) + '</b><div class="muted small">' + esc(b.email) + (b.phone ? ' · ' + esc(b.phone) : '') + '</div></td>' +
          '<td><b>' + esc(b.service) + '</b><div class="muted small">' + esc(b.eventDate || 'date to agree') + ' · ' + esc(b.location || '') + '</div><p class="mk-work">' + esc(b.description) + '</p></td>' +
          '<td><span class="gpill ' + (b.status === 'deposit_paid' || b.status === 'completed' ? 'pass' : b.status === 'cancelled' ? 'fail' : 'none') + '">' + esc(b.status.replace('_', ' ')) + '</span></td>' +
          '<td>' + (b.quoteAmount ? naira(b.quoteAmount) + '<div class="muted small">Deposit ' + naira(b.depositAmount) + ' (' + b.depositPercent + '%)</div>' : '<span class="muted">Not quoted</span>') + '</td>' +
          '<td class="dt-act"><button class="btn btn-solid btn-sm" type="button" data-quote="' + esc(b.id) + '">Quote</button> <button class="btn btn-ghost btn-sm" type="button" data-status="' + esc(b.id) + '">Status</button></td></tr>';
      }).join('') : '<tr><td colspan="5" class="muted">No booking requests yet.</td></tr>') + '</tbody></table></div></section>');
    view.querySelectorAll('[data-quote]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var b = d.bookings.find(function (x) { return x.id === btn.getAttribute('data-quote'); });
        DModal.open({ size: 'sm', eyebrow: 'Quotation', title: esc(b.service), body:
          '<form class="sub-form" id="qf"><div class="field"><label>Total amount in naira</label><input class="input" type="number" min="1" name="q" required value="' + (b.quoteAmount || '') + '"></div>' +
          '<div class="field"><label>Deposit percentage</label><input class="input" type="number" min="0" max="100" name="p" value="' + (b.depositPercent != null ? b.depositPercent : (settingsDefaults.depositPercent || 50)) + '"></div>' +
          '<p class="form-error" id="qf-err" role="alert"></p><div class="sub-actions"><button type="button" class="btn btn-ghost" data-cancel>Cancel</button><button type="submit" class="btn btn-solid">Send quotation</button></div></form>',
          onMount: function (box, inst) {
            box.querySelector('[data-cancel]').addEventListener('click', inst.close);
            box.querySelector('#qf').addEventListener('submit', async function (e) {
              e.preventDefault();
              try { await api('/api/staff/bookings/' + encodeURIComponent(b.id), { method: 'PATCH', body: { quoteAmount: fv(e.target, 'q'), depositPercent: fv(e.target, 'p') } });
                inst.close(); toast('Quotation saved. Share the client link: quote.html?token=' + b.token); renderBookings(); }
              catch (ex) { box.querySelector('#qf-err').textContent = ex.message; }
            });
          } });
      });
    });
    view.querySelectorAll('[data-status]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var b = d.bookings.find(function (x) { return x.id === btn.getAttribute('data-status'); });
        var opts = ['requested','quoted','accepted','deposit_paid','completed','cancelled'];
        DModal.open({ size: 'sm', eyebrow: 'Booking', title: 'Set status', body:
          '<form class="sub-form" id="sf2"><div class="field"><label>Status</label><select class="input" name="s">' + opts.map(function (o) { return '<option value="' + o + '"' + (o === b.status ? ' selected' : '') + '>' + o.replace('_', ' ') + '</option>'; }).join('') + '</select></div>' +
          '<div class="sub-actions"><button type="button" class="btn btn-ghost" data-cancel>Cancel</button><button type="submit" class="btn btn-solid">Save</button></div></form>',
          onMount: function (box, inst) {
            box.querySelector('[data-cancel]').addEventListener('click', inst.close);
            box.querySelector('#sf2').addEventListener('submit', async function (e) {
              e.preventDefault();
              try { await api('/api/staff/bookings/' + encodeURIComponent(b.id), { method: 'PATCH', body: { status: fv(e.target, 's') } }); inst.close(); renderBookings(); } catch (ex) { toast(ex.message, 'err'); }
            });
          } });
      });
    });
  }

  /* ---------- Refunds and schedule notices (admin) ---------- */
  async function renderRefunds() {
    crumb.textContent = 'Refunds';
    var d = await api('/api/staff/refunds'), n = await api('/api/staff/schedule-notices');
    setView(head('Money', 'Refunds and schedule notices', 'Approve refunds. Paystack refunds are sent automatically when a live key is set; otherwise process them in Paystack and mark them paid here.') +
      '<section class="box"><p class="eyebrow">Refund requests</p><div class="dt-wrap"><table class="dt"><thead><tr><th>Student</th><th>Item</th><th>Amount</th><th>Reason</th><th>Status</th><th></th></tr></thead><tbody>' +
      (d.refunds.length ? d.refunds.map(function (r, i) {
        return '<tr style="--i:' + i + '" data-id="' + esc(r.id) + '"><td><b>' + esc(r.student) + '</b><div class="muted small">' + esc(r.email) + '</div></td><td>' + esc(r.item) + '<div class="muted small">' + esc(r.kind) + ' · ' + esc(r.reference) + '</div></td>' +
          '<td>' + naira(r.amount) + '</td><td class="small" style="max-width:260px">' + esc(r.reason) + '</td><td><span class="gpill ' + (r.status === 'paid' ? 'pass' : r.status === 'declined' ? 'fail' : 'none') + '">' + esc(r.status) + '</span></td>' +
          '<td class="dt-act">' + (r.status === 'requested' ? '<button class="btn btn-solid btn-sm" type="button" data-dec="approved">Approve</button> <button class="btn btn-ghost btn-sm" type="button" data-dec="declined">Decline</button>' : r.status === 'approved' ? '<button class="btn btn-solid btn-sm" type="button" data-paid>Mark paid</button>' : '') + '</td></tr>';
      }).join('') : '<tr><td colspan="6" class="muted">No refund requests.</td></tr>') + '</tbody></table></div></section>' +
      '<section class="box" style="margin-top:16px"><p class="eyebrow">Minimum-student notices</p><div class="dt-wrap"><table class="dt"><thead><tr><th>Student</th><th>Course</th><th>Start date</th><th>Choice</th><th>Status</th></tr></thead><tbody>' +
      (n.notices.length ? n.notices.map(function (x) { return '<tr><td>' + esc(x.student) + '</td><td>' + esc(x.courseTitle) + '</td><td>' + esc(x.startDate) + '</td><td>' + esc(x.choice || '—') + '</td><td><span class="gpill none">' + esc(x.status) + '</span></td></tr>'; }).join('') : '<tr><td colspan="5" class="muted">No notices. A notice is sent to students when a course with a minimum is close to its start date and has too few students.</td></tr>') + '</tbody></table></div></section>');
    view.querySelectorAll('[data-dec]').forEach(function (b) {
      b.addEventListener('click', async function () {
        try { var res = await api('/api/staff/refunds/' + encodeURIComponent(b.closest('tr').getAttribute('data-id')), { method: 'PATCH', body: { status: b.getAttribute('data-dec') } }); toast(res.note || 'Saved.'); renderRefunds(); }
        catch (e) { toast(e.message, 'err'); }
      });
    });
    view.querySelectorAll('[data-paid]').forEach(function (b) {
      b.addEventListener('click', async function () {
        try { await api('/api/staff/refunds/' + encodeURIComponent(b.closest('tr').getAttribute('data-id')) + '/mark-paid', { method: 'PATCH', body: {} }); toast('Marked as paid.'); renderRefunds(); }
        catch (e) { toast(e.message, 'err'); }
      });
    });
  }

  /* ---------- Revenue and analytics (admin) ---------- */
  async function renderReports() {
    crumb.textContent = 'Reports and analytics';
    var r = await api('/api/staff/reports/revenue'), a = await api('/api/staff/analytics');
    var months = r.byMonth.map(function (m) { return '<div class="rp-bar"><i data-h="' + Math.max(4, Math.round(m.amount / Math.max(1, Math.max.apply(null, r.byMonth.map(function (x) { return x.amount; }))) * 100)) + '"></i><span>' + esc(m.month) + '</span><b>' + naira(m.amount) + '</b></div>'; }).join('') || '<p class="muted">No sales yet.</p>';
    setView(head('Business', 'Reports and analytics', 'Sales, refunds and website activity.') +
      '<div class="rp-stats"><div><span>Gross sales</span><b>' + naira(r.gross) + '</b></div><div><span>Refunded</span><b>' + naira(r.refunded) + '</b></div><div><span>Net</span><b>' + naira(r.net) + '</b></div><div><span>Orders</span><b>' + r.orders + '</b></div></div>' +
      '<div class="rp-actions"><a class="btn btn-solid" href="/api/staff/reports/revenue?format=csv">Download sales report (CSV)</a></div>' +
      '<div class="grid-2" style="margin-top:16px"><section class="box"><p class="eyebrow">Sales by month</p><div class="rp-chart">' + months + '</div></section>' +
      '<section class="box"><p class="eyebrow">Sales by item</p><div class="dt-wrap"><table class="dt"><thead><tr><th>Item</th><th>Type</th><th>Orders</th><th>Amount</th></tr></thead><tbody>' +
      (r.byItem.length ? r.byItem.map(function (i) { return '<tr><td>' + esc(i.item) + '</td><td class="muted small">' + esc(i.kind) + '</td><td>' + i.count + '</td><td>' + naira(i.amount) + '</td></tr>'; }).join('') : '<tr><td colspan="4" class="muted">No sales yet.</td></tr>') + '</tbody></table></div></section></div>' +
      '<div class="rp-stats" style="margin-top:16px"><div><span>Page views (30 days)</span><b>' + a.totalViews + '</b></div><div><span>Students</span><b>' + a.students + '</b></div><div><span>Newsletter subscribers</span><b>' + a.subscribers + '</b></div><div><span>New students (30 days)</span><b>' + a.signups.reduce(function (t, x) { return t + x.count; }, 0) + '</b></div></div>' +
      '<div class="grid-2" style="margin-top:16px"><section class="box"><p class="eyebrow">Most visited pages</p><div class="dt-wrap"><table class="dt"><thead><tr><th>Page</th><th>Views</th></tr></thead><tbody>' + (a.pages.length ? a.pages.map(function (p) { return '<tr><td>' + esc(p.page) + '</td><td>' + p.views + '</td></tr>'; }).join('') : '<tr><td colspan="2" class="muted">No visits yet.</td></tr>') + '</tbody></table></div></section>' +
      '<section class="box"><p class="eyebrow">Courses and products</p><div class="dt-wrap"><table class="dt"><thead><tr><th>Course</th><th>Students</th></tr></thead><tbody>' + a.topCourses.map(function (c) { return '<tr><td>' + esc(c.title) + '</td><td>' + c.students + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<div class="dt-wrap" style="margin-top:12px"><table class="dt"><thead><tr><th>Product</th><th>Sales</th></tr></thead><tbody>' + (a.topProducts.length ? a.topProducts.map(function (p) { return '<tr><td>' + esc(p.title) + '</td><td>' + p.sales + '</td></tr>'; }).join('') : '<tr><td colspan="2" class="muted">No products yet.</td></tr>') + '</tbody></table></div></section></div>');
    setTimeout(function () { view.querySelectorAll('[data-h]').forEach(function (el) { el.style.height = el.getAttribute('data-h') + '%'; }); }, 120);
  }

  /* ---------- Community moderation and suspensions (admin) ---------- */
  async function renderCommunityAdmin() {
    crumb.textContent = 'Community';
    var d = await api('/api/staff/community'), users = (await api('/api/staff/users')).users.filter(function (u) { return u.role === 'student'; });
    setView(head('Community', 'Community moderation', 'Hide or remove posts that break the rules. Suspend a student who keeps breaking them.') +
      '<section class="box"><div class="row-actions"><select class="input" id="sus-user"><option value="">Choose a student…</option>' + users.map(function (u) { return '<option value="' + esc(u.id) + '">' + esc(u.name) + ' · ' + esc(u.email) + (u.suspended ? ' (suspended)' : '') + '</option>'; }).join('') + '</select>' +
      '<button class="btn btn-ghost" type="button" id="sus-go">Suspend</button><button class="btn btn-solid" type="button" id="unsus-go">Restore</button></div></section>' +
      '<section class="box" style="margin-top:16px"><div class="dt-wrap"><table class="dt"><thead><tr><th>Post</th><th>Course</th><th>Replies</th><th>Status</th><th></th></tr></thead><tbody>' +
      (d.threads.length ? d.threads.map(function (t) {
        return '<tr data-kind="threads" data-id="' + esc(t.id) + '"><td><b>' + esc(t.title) + '</b><div class="muted small">' + esc(t.authorName) + '</div><p class="mk-work">' + esc(t.body) + '</p>' +
          t.replies.map(function (r) { return '<div class="cm-reply small" data-kind="replies" data-id="' + esc(r.id) + '"><b>' + esc(r.authorName) + '</b> ' + esc(r.body) + ' <button class="btn btn-ghost btn-sm" type="button" data-hide-r="' + (r.hidden ? '0' : '1') + '">' + (r.hidden ? 'Show' : 'Hide') + '</button> <button class="btn btn-ghost btn-sm" type="button" data-del-r>Delete</button></div>'; }).join('') + '</td>' +
          '<td class="small">' + esc(t.course) + '</td><td>' + t.replies.length + '</td><td><span class="gpill ' + (t.hidden ? 'fail' : 'pass') + '">' + (t.hidden ? 'Hidden' : 'Visible') + '</span></td>' +
          '<td class="dt-act"><button class="btn btn-ghost btn-sm" type="button" data-hide-t="' + (t.hidden ? '0' : '1') + '">' + (t.hidden ? 'Show' : 'Hide') + '</button> <button class="btn btn-ghost btn-sm" type="button" data-del-t>Delete</button></td></tr>';
      }).join('') : '<tr><td colspan="5" class="muted">No posts yet.</td></tr>') + '</tbody></table></div></section>');
    function setSus(flag) {
      var id = document.getElementById('sus-user').value; if (!id) return toast('Choose a student first.', 'err');
      api('/api/staff/users/' + encodeURIComponent(id) + '/suspend', { method: 'POST', body: { suspended: flag } }).then(function () { toast(flag ? 'Student suspended.' : 'Student restored.'); renderCommunityAdmin(); }).catch(function (e) { toast(e.message, 'err'); });
    }
    document.getElementById('sus-go').addEventListener('click', function () { setSus(true); });
    document.getElementById('unsus-go').addEventListener('click', function () { setSus(false); });
    view.querySelectorAll('[data-hide-t]').forEach(function (b) { b.addEventListener('click', function () { var tr = b.closest('tr'); api('/api/staff/community/threads/' + encodeURIComponent(tr.getAttribute('data-id')), { method: 'PATCH', body: { hidden: b.getAttribute('data-hide-t') === '1' } }).then(renderCommunityAdmin).catch(function (e) { toast(e.message, 'err'); }); }); });
    view.querySelectorAll('[data-del-t]').forEach(function (b) { b.addEventListener('click', function () { if (!window.confirm('Delete this post and its replies?')) return; var tr = b.closest('tr'); api('/api/staff/community/threads/' + encodeURIComponent(tr.getAttribute('data-id')), { method: 'DELETE' }).then(renderCommunityAdmin).catch(function (e) { toast(e.message, 'err'); }); }); });
    view.querySelectorAll('[data-hide-r]').forEach(function (b) { b.addEventListener('click', function () { var el = b.closest('[data-kind]'); api('/api/staff/community/replies/' + encodeURIComponent(el.getAttribute('data-id')), { method: 'PATCH', body: { hidden: b.getAttribute('data-hide-r') === '1' } }).then(renderCommunityAdmin).catch(function (e) { toast(e.message, 'err'); }); }); });
    view.querySelectorAll('[data-del-r]').forEach(function (b) { b.addEventListener('click', function () { var el = b.closest('[data-kind]'); api('/api/staff/community/replies/' + encodeURIComponent(el.getAttribute('data-id')), { method: 'DELETE' }).then(renderCommunityAdmin).catch(function (e) { toast(e.message, 'err'); }); }); });
  }

  /* ---------- Talent profiles (admin) ---------- */
  async function renderTalent() {
    crumb.textContent = 'Talent profiles';
    var d = await api('/api/staff/portfolios');
    setView(head('Talent', 'Talent profiles', 'Only approved profiles appear in the public talent directory.') +
      '<section class="box"><div class="dt-wrap"><table class="dt"><thead><tr><th>Student</th><th>Profile</th><th>Status</th><th></th></tr></thead><tbody>' +
      (d.portfolios.length ? d.portfolios.map(function (p) {
        return '<tr data-id="' + esc(p.id) + '"><td><b>' + esc(p.name) + '</b><div class="muted small">' + esc(p.email) + '</div></td><td><b>' + esc(p.headline) + '</b><p class="mk-work">' + esc(p.bio || '') + '</p><div class="small muted">' + esc((p.skills || []).join(', ')) + '</div>' + (p.workUrl ? '<a class="mk-link" href="' + esc(p.workUrl) + '" target="_blank" rel="noopener">Work ↗</a>' : '') + '</td>' +
          '<td><span class="gpill ' + (p.status === 'approved' ? 'pass' : p.status === 'rejected' ? 'fail' : 'none') + '">' + esc(p.status) + '</span></td>' +
          '<td class="dt-act"><button class="btn btn-solid btn-sm" type="button" data-pst="approved">Approve</button> <button class="btn btn-ghost btn-sm" type="button" data-pst="rejected">Reject</button></td></tr>';
      }).join('') : '<tr><td colspan="4" class="muted">No profiles yet.</td></tr>') + '</tbody></table></div></section>');
    view.querySelectorAll('[data-pst]').forEach(function (b) { b.addEventListener('click', function () { api('/api/staff/portfolios/' + encodeURIComponent(b.closest('tr').getAttribute('data-id')), { method: 'PATCH', body: { status: b.getAttribute('data-pst') } }).then(function () { toast('Saved.'); renderTalent(); }).catch(function (e) { toast(e.message, 'err'); }); }); });
  }

  /* ---------- Challenges (admin) ---------- */
  async function renderChallenges() {
    crumb.textContent = 'Monthly challenges';
    var d = await api('/api/staff/challenges');
    function form(c) {
      var isNew = !c, it = c || {};
      DModal.open({ size: 'md', eyebrow: isNew ? 'New challenge' : 'Edit challenge', title: isNew ? 'Start a challenge' : esc(it.title), body:
        '<form class="sub-form" id="chf"><div class="field"><label>Title</label><input class="input" name="title" required maxlength="120" value="' + esc(it.title || '') + '"></div>' +
        '<div class="field"><label>Description</label><textarea class="input" name="description" rows="2" maxlength="1000">' + esc(it.description || '') + '</textarea></div>' +
        '<div class="field"><label>Rules</label><textarea class="input" name="rules" rows="2" maxlength="1000">' + esc(it.rules || '') + '</textarea></div>' +
        '<div class="grid-2"><div class="field"><label>Category</label><input class="input" name="category" maxlength="60" value="' + esc(it.category || '') + '" placeholder="Best AI video"></div>' +
        '<div class="field"><label>Closing date</label><input class="input" type="date" name="deadline" required value="' + esc(it.deadline || '') + '"></div></div>' +
        '<p class="form-error" id="chf-err" role="alert"></p><div class="sub-actions"><button type="button" class="btn btn-ghost" data-cancel>Cancel</button><button type="submit" class="btn btn-solid">' + (isNew ? 'Start challenge' : 'Save changes') + '</button></div></form>',
        onMount: function (box, inst) {
          box.querySelector('[data-cancel]').addEventListener('click', inst.close);
          box.querySelector('#chf').addEventListener('submit', async function (e) {
            e.preventDefault();
            var f = e.target, err = box.querySelector('#chf-err'); err.textContent = '';
            try { await api(isNew ? '/api/staff/challenges' : '/api/staff/challenges/' + encodeURIComponent(it.id), { method: isNew ? 'POST' : 'PATCH', body: { title: fv(f, 'title'), description: fv(f, 'description'), rules: fv(f, 'rules'), category: fv(f, 'category'), deadline: fv(f, 'deadline') } });
              inst.close(); toast('Challenge saved.'); renderChallenges(); } catch (ex) { err.textContent = ex.message; }
          });
        } });
    }
    setView(head('Community', 'Monthly challenges', 'Start a challenge, review the entries, pick a winner and showcase the best work.') +
      '<div class="dt-tools"><span class="muted">' + d.challenges.length + ' challenges</span><button class="btn btn-solid" type="button" id="ch-new">New challenge</button></div>' +
      '<section class="box"><div class="dt-wrap"><table class="dt"><thead><tr><th>Challenge</th><th>Closes</th><th>Entries</th><th></th></tr></thead><tbody>' +
      (d.challenges.length ? d.challenges.map(function (c) {
        return '<tr data-id="' + esc(c.id) + '"><td><b>' + esc(c.title) + '</b><div class="muted small">' + esc(c.category || '') + '</div></td><td>' + esc(c.deadline) + '</td><td>' + c.entries + '</td>' +
          '<td class="dt-act"><button class="btn btn-ghost btn-sm" type="button" data-entries>Entries</button> <button class="btn btn-ghost btn-sm" type="button" data-edit>Edit</button> <button class="btn btn-ghost btn-sm" type="button" data-del>Delete</button></td></tr>';
      }).join('') : '<tr><td colspan="4" class="muted">No challenges yet.</td></tr>') + '</tbody></table></div></section>');
    document.getElementById('ch-new').addEventListener('click', function () { form(null); });
    view.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { form(d.challenges.find(function (c) { return c.id === b.closest('tr').getAttribute('data-id'); })); }); });
    view.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { if (!window.confirm('Delete this challenge and its entries?')) return; api('/api/staff/challenges/' + encodeURIComponent(b.closest('tr').getAttribute('data-id')), { method: 'DELETE' }).then(renderChallenges).catch(function (e) { toast(e.message, 'err'); }); }); });
    view.querySelectorAll('[data-entries]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var id = b.closest('tr').getAttribute('data-id');
        var r = await api('/api/staff/challenges/' + encodeURIComponent(id) + '/entries');
        DModal.open({ size: 'lg', eyebrow: 'Entries', title: r.entries.length + ' entries', body:
          '<div class="dt-wrap"><table class="dt"><thead><tr><th>Student</th><th>Work</th><th>Note</th><th></th></tr></thead><tbody>' +
          (r.entries.length ? r.entries.map(function (e) {
            return '<tr data-eid="' + esc(e.id) + '"><td><b>' + esc(e.name) + '</b><div class="muted small">' + esc(e.email) + '</div></td><td><a class="mk-link" href="' + esc(e.link) + '" target="_blank" rel="noopener">Open ↗</a></td><td class="small">' + esc(e.note || '') + '</td>' +
              '<td class="dt-act"><button class="btn ' + (e.winner ? 'btn-solid' : 'btn-ghost') + ' btn-sm" type="button" data-win="' + (e.winner ? '0' : '1') + '">' + (e.winner ? 'Winner ✓' : 'Pick as winner') + '</button> <button class="btn btn-ghost btn-sm" type="button" data-show="' + (e.showcased ? '0' : '1') + '">' + (e.showcased ? 'Remove from showcase' : 'Showcase') + '</button></td></tr>';
          }).join('') : '<tr><td colspan="4" class="muted">No entries yet.</td></tr>') + '</tbody></table></div>', onMount: function (box) {
            box.querySelectorAll('[data-win]').forEach(function (x) { x.addEventListener('click', function () { api('/api/staff/challenge-entries/' + encodeURIComponent(x.closest('tr').getAttribute('data-eid')), { method: 'PATCH', body: { winner: x.getAttribute('data-win') === '1' } }).then(function () { toast('Saved. The student has been told.'); renderChallenges(); }).catch(function (e) { toast(e.message, 'err'); }); }); });
            box.querySelectorAll('[data-show]').forEach(function (x) { x.addEventListener('click', function () { api('/api/staff/challenge-entries/' + encodeURIComponent(x.closest('tr').getAttribute('data-eid')), { method: 'PATCH', body: { showcased: x.getAttribute('data-show') === '1' } }).then(function () { toast('Saved.'); renderChallenges(); }).catch(function (e) { toast(e.message, 'err'); }); }); });
          } });
      });
    });
  }

  /* ---------- Referrals (admin) ---------- */
  async function renderReferrals() {
    crumb.textContent = 'Referrals';
    var d = await api('/api/staff/referrals'), w = (await api('/api/staff/withdrawals')).withdrawals;
    var waiting = w.filter(function (x) { return x.status === 'requested'; });
    setView(head('Growth', 'Referrals and withdrawals', 'Students earn a share of every payment their friends make. Approve a withdrawal once you have sent the money to the student\'s account.') +
      '<section class="box"><p class="eyebrow">Withdrawals waiting for approval (' + waiting.length + ')</p><div class="dt-wrap"><table class="dt"><thead><tr><th>Student</th><th>Amount</th><th>Paying friends</th><th>Bank account</th><th></th></tr></thead><tbody>' +
      (waiting.length ? waiting.map(function (x, i) {
        return '<tr style="--i:' + i + '" data-id="' + esc(x.id) + '"><td><b>' + esc(x.student) + '</b><div class="muted small">' + esc(x.email) + '</div></td><td><b>' + naira(x.amount) + '</b></td><td>' + x.friends + '</td>' +
          '<td class="small">' + esc(x.accountName) + '<br>' + esc(x.bankName) + ' · <b>' + esc(x.accountNumber) + '</b></td>' +
          '<td class="dt-act"><button class="btn btn-solid btn-sm" type="button" data-wd="approved">Approve</button> <button class="btn btn-ghost btn-sm" type="button" data-wd="declined">Decline</button></td></tr>';
      }).join('') : '<tr><td colspan="5" class="muted">No withdrawals waiting.</td></tr>') + '</tbody></table></div></section>' +
      '<section class="box" style="margin-top:16px"><p class="eyebrow">Withdrawal history</p><div class="dt-wrap"><table class="dt"><thead><tr><th>Student</th><th>Amount</th><th>Requested</th><th>Status</th></tr></thead><tbody>' +
      (w.filter(function (x) { return x.status !== 'requested'; }).length ? w.filter(function (x) { return x.status !== 'requested'; }).map(function (x) {
        return '<tr><td>' + esc(x.student) + '</td><td>' + naira(x.amount) + '</td><td>' + esc(fmt(x.createdAt)) + '</td><td><span class="gpill ' + (x.status === 'approved' ? 'pass' : 'fail') + '">' + esc(x.status) + '</span></td></tr>';
      }).join('') : '<tr><td colspan="4" class="muted">No decisions yet.</td></tr>') + '</tbody></table></div></section>' +
      '<section class="box" style="margin-top:16px"><p class="eyebrow">Referrers</p><div class="dt-wrap"><table class="dt"><thead><tr><th>Student</th><th>Code</th><th>Friends</th><th>Paying</th><th>Earned</th><th>Balance</th></tr></thead><tbody>' +
      (d.referrers.length ? d.referrers.map(function (r) { return '<tr><td><b>' + esc(r.name) + '</b><div class="muted small">' + esc(r.email) + '</div></td><td><b>' + esc(r.code) + '</b></td><td>' + r.referred + '</td><td>' + r.paidFriends + '</td><td>' + naira(r.earned) + '</td><td>' + naira(r.balance) + '</td></tr>'; }).join('') : '<tr><td colspan="6" class="muted">No referrals yet.</td></tr>') + '</tbody></table></div></section>');
    view.querySelectorAll('[data-wd]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.closest('tr').getAttribute('data-id'), status = b.getAttribute('data-wd');
        b.disabled = true;
        api('/api/staff/withdrawals/' + encodeURIComponent(id), { method: 'PATCH', body: { status: status } })
          .then(function () { toast(status === 'approved' ? 'Withdrawal approved. The student has been told.' : 'Withdrawal declined. The rewards are back in the balance.'); renderReferrals(); })
          .catch(function (e) { toast(e.message, 'err'); b.disabled = false; });
      });
    });
  }

  /* ---------- Business rules (admin) ---------- */
  var settingsDefaults = {};
  async function renderRules() {
    crumb.textContent = 'Business rules';
    var s = (await api('/api/settings')).settings;
    settingsDefaults = s;
    var f = function (name, label, type) { return '<div class="field"><label>' + esc(label) + '</label><input class="input" type="' + (type || 'number') + '" name="' + name + '" value="' + esc(s[name] != null ? s[name] : '') + '"></div>'; };
    setView(head('System', 'Business rules', 'These are the default rules the website follows. Change them here and the change applies straight away.') +
      '<section class="box"><form class="sub-form" id="rules-form">' +
        '<div class="grid-3">' + f('replayDays','Replay available for (days after the course ends)') + f('downloadLimit','Downloads allowed per product') + f('downloadDays','Download access lasts (days)') + '</div>' +
        '<div class="grid-3">' + f('depositPercent','Studio deposit (% of quotation)') + f('refundWindowDays','Refund window (days after payment)') + f('noticeDays','Notice before a course that is short of students (days)') + '</div>' +
        '<div class="grid-3">' + f('referralDiscountPercent','Friend discount on first course (%)') + f('referrerRewardPercent','Your reward: % of every amount your friend pays') + f('withdrawMinReferrals','Paying friends needed to withdraw') + f('certMinPercent','Minimum % to pass an assignment for a certificate') + '</div>' +
        '<div class="set-announce"><label class="set-toggle"><input type="checkbox" name="allowResubmission"' + (s.allowResubmission !== false ? ' checked' : '') + '><span class="set-slider"></span><b>Students may resubmit work the team asks them to improve</b></label></div>' +
        '<div class="bank-edit"><p class="rf2-label">Bank accounts students transfer to</p><p class="muted small">These accounts appear on every payment page. Students see the account name and number exactly as you type them here.</p>' +
        '<div class="grid-3">' + f('bankOneBank','Account 1: bank name','text') + f('bankOneName','Account 1: account name','text') + f('bankOneNumber','Account 1: account number','text') + '</div>' +
        '<div class="grid-3">' + f('bankTwoBank','Account 2: bank name','text') + f('bankTwoName','Account 2: account name','text') + f('bankTwoNumber','Account 2: account number','text') + '</div></div>' +
        '<p class="form-error" id="rules-err" role="alert"></p><div class="sub-actions"><button type="submit" class="btn btn-solid">Save business rules</button></div></form></section>');
    document.getElementById('rules-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var fm = e.target, body = {};
      ['replayDays','downloadLimit','downloadDays','depositPercent','refundWindowDays','noticeDays','referralDiscountPercent','referrerRewardPercent','withdrawMinReferrals','certMinPercent','bankOneBank','bankOneName','bankOneNumber','bankTwoBank','bankTwoName','bankTwoNumber'].forEach(function (k) { body[k] = fv(fm, k); });
      body.allowResubmission = !!fm.elements.allowResubmission.checked;
      try { await api('/api/staff/settings', { method: 'PUT', body: body }); toast('Business rules saved.'); }
      catch (ex) { document.getElementById('rules-err').textContent = ex.message; }
    });
  }

  /* ---------- Router ---------- */
  function openSide(open) {
    side.classList.toggle('open', open); scrim.classList.toggle('show', open); burger.setAttribute('aria-expanded', String(open));
  }
  async function route(silent) {
    silent = silent === true;
    var parts = (location.hash || '#overview').replace(/^#/, '').split('/');
    var name = parts[0] || 'overview', arg = parts[1] ? decodeURIComponent(parts[1]) : null;
    if (!['overview', 'live', 'assignments', 'courses', 'users', 'payments', 'announce', 'newsletter', 'products', 'works', 'settings', 'setup', 'services', 'feedback', 'applications', 'webinars', 'reviews', 'certificates', 'digital', 'bundles', 'bookings', 'refunds', 'reports', 'community', 'talent', 'challenges', 'referrals', 'rules', 'transfers'].includes(name)) name = 'overview';
    document.querySelectorAll('.side-nav a[data-view]').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-view') === name);
    });
    if (!silent) openSide(false);
    try {
      if (name === 'overview') return await renderOverview();
      if (name === 'live') return await renderLive();
      if (name === 'assignments') return await renderAssignments();
      if (name === 'courses') return await renderCourses(arg);
      if (name === 'users') return await renderUsers();
      if (name === 'payments') return await renderPayments();
      if (name === 'announce') return renderAnnounce();
      if (name === 'newsletter') return await renderNewsletter();
      if (name === 'products') return await renderProducts();
      if (name === 'works') return await renderWorks();
      if (name === 'settings') return await renderSettings();
      if (name === 'setup') return await renderSetup();
      if (name === 'services') return await renderServices();
      if (name === 'feedback') return await renderFeedback();
      if (name === 'applications') return await renderApplications();
      if (name === 'webinars') return await renderWebinars();
      if (name === 'reviews') return await renderReviews();
      if (name === 'certificates') return await renderCertificates();
      if (name === 'digital') return await renderDigital();
      if (name === 'bundles') return await renderBundles();
      if (name === 'bookings') return await renderBookings();
      if (name === 'refunds') return await renderRefunds();
      if (name === 'reports') return await renderReports();
      if (name === 'community') return await renderCommunityAdmin();
      if (name === 'talent') return await renderTalent();
      if (name === 'challenges') return await renderChallenges();
      if (name === 'referrals') return await renderReferrals();
      if (name === 'rules') return await renderRules();
      if (name === 'transfers') return await renderTransfers();
    } catch (e) { if (!silent) setView(head('Error', 'Something went wrong') + '<div class="empty-state">' + esc(e.message) + '</div>'); }
  }

  /* Live updates: when anything changes (a student pays, a setting is saved, another admin edits), redraw this view
     within a second. No page reload, no flicker, and never while you are typing or have unsaved edits. */
  var liveDirty = false, liveBusy = false, livePending = false;
  /* Refresh all admin sections without replacing the whole page. */
  async function liveRefresh() {
    if (!me || document.hidden) return;
    if (liveBusy) { livePending = true; return; }
    if (liveDirty || (window.DLive && DLive.busy())) { livePending = true; return; }
    livePending = false; liveBusy = true;
    try {
      await (window.DLive ? DLive.quiet(function () { return route(true); }) : route(true));
    } catch (err) { console.warn('Admin live update:', err); }
    finally { liveBusy = false; if (livePending && !document.hidden && !(window.DLive && DLive.busy())) { livePending = false; setTimeout(liveRefresh, 600); } }
  }
  function liveWatch() {
    view.addEventListener('input', function (e) { if (e.target.closest && e.target.closest('form')) liveDirty = true; }, true);
    view.addEventListener('change', function (e) { if (e.target.closest && e.target.closest('form')) liveDirty = true; }, true);
    view.addEventListener('submit', function () { liveDirty = false; }, true);
    window.addEventListener('hashchange', function () { liveDirty = false; livePending = false; });
    document.addEventListener('focusout', function () { if (livePending) setTimeout(function () { if (livePending) liveRefresh(); }, 350); });
    window.addEventListener('debone:refresh', liveRefresh);
    window.addEventListener('debone:notice', function () { setTimeout(liveRefresh, 300); });
  }

  async function boot() {
    try {
      me = (await api('/api/staff/me')).user;
    } catch (e) {
      setView(head('Restricted', 'Admin access only') + '<div class="empty-state">Log in with an instructor or admin account on the <a href="staff-login.html">staff login page</a>.</div>');
      return;
    }
    document.getElementById('me-name').textContent = me.name;
    document.getElementById('me-email').textContent = me.email;
    document.getElementById('role-tag').textContent = isAdmin() ? 'Administrator' : 'Instructor';
    if (!isAdmin()) document.querySelectorAll('.admin-only').forEach(function (a) { a.classList.add('hidden-role'); });
    burger.addEventListener('click', function () { openSide(!side.classList.contains('open')); });
    scrim.addEventListener('click', function () { openSide(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') openSide(false); });
    var _lo = document.getElementById('logout'); if (_lo) _lo.addEventListener('click', async function () {
      try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); } catch (e) { /* ignore */ }
      location.replace('login.html');
    });
    window.addEventListener('hashchange', function () { route(); });
    liveWatch();
    if (!location.hash) history.replaceState(null, '', 'admin.html#overview');
    route();
  }
  boot();
})();
