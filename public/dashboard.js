(function () {
  'use strict';

  var view = document.getElementById('view');
  var crumb = document.getElementById('crumb');
  var side = document.getElementById('side');
  var scrim = document.getElementById('scrim');
  var burger = document.getElementById('burger');
  var overlay = document.getElementById('overlay');
  var toasts = document.getElementById('toasts');
  var state = { d: null };
  var currentCourseId = null;
  var THUMBS = {
    'ai-intro': 'https://assets.mixkit.co/videos/44068/44068-thumb-720-0.jpg',
    'ai-video': 'https://assets.mixkit.co/videos/44075/44075-thumb-720-0.jpg',
    'ai-automation': 'https://assets.mixkit.co/videos/44071/44071-thumb-720-0.jpg'
  };
  function thumb(c) {
    var u = c.hasImage ? '/api/courses/' + encodeURIComponent(c.id) + '/image' : THUMBS[c.id];
    return u ? '<div class="dc-thumb"><img src="' + u + '" alt="" loading="lazy"></div>' : '';
  }

  /* ---------- Helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function naira(n) { return '₦' + Number(n).toLocaleString('en-US'); }
  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function reduced() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches || !!(window.DLive && DLive.silent); }

  async function api(url, opts) {
    opts = opts || {};
    var init = { method: opts.method || 'GET', credentials: 'same-origin', headers: {} };
    if (opts.body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }
    init.signal = AbortSignal.timeout(15000);
    var res = await fetch(url, init);
    if (res.status === 401) {
      location.replace('login.html?next=dashboard');
      throw new Error('Please log in to continue.');
    }
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      var err = new Error(data.error || 'Something went wrong. Please try again.');
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function toast(msg, kind) {
    var t = document.createElement('div');
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.textContent = msg;
    toasts.appendChild(t);
    requestAnimationFrame(function () { requestAnimationFrame(function () { t.classList.add('show'); }); });
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { t.remove(); }, 600);
    }, 4000);
  }

  function setOverlay(on) { overlay.hidden = !on; }

  function animateCounters() {
    if (reduced()) {
      view.querySelectorAll('[data-count]').forEach(function (el) { el.textContent = Number(el.getAttribute('data-count')).toLocaleString('en-US'); });
      return;
    }
    view.querySelectorAll('[data-count]').forEach(function (el) {
      var end = Number(el.getAttribute('data-count'));
      var t0 = null, dur = 1100;
      function step(ts) {
        if (!t0) t0 = ts;
        var p = Math.min((ts - t0) / dur, 1);
        var e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(end * e).toLocaleString('en-US');
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  function animateBars(root) {
    (root || view).querySelectorAll('[data-w]').forEach(function (el) {
      var target = el.getAttribute('data-w') + '%';
      if (reduced()) { el.style.width = target; return; }
      requestAnimationFrame(function () { requestAnimationFrame(function () { el.style.width = target; }); });
    });
  }

  function setView(html) {
    if (window.DLive && DLive.silent && /class="skeleton"/.test(html)) return;
    view.innerHTML = html;
    view.classList.remove('enter');
    void view.offsetWidth;
    view.classList.add('enter');
    if (!(window.DLive && DLive.silent)) window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function viewHead(eyebrow, title, sub) {
    return '<header class="view-head"><p class="eyebrow">' + esc(eyebrow) + '</p><h1>' + esc(title) + '</h1>' +
      (sub ? '<p class="muted">' + esc(sub) + '</p>' : '') + '</header>';
  }

  function emptyState(msg) {
    return '<div class="empty-state">' + esc(msg) + '</div>';
  }

  function paymentTable(list) {
    if (!list.length) return emptyState('No payments yet. When you enrol in a paid course, your receipts appear here.');
    return '<table class="tbl"><thead><tr><th>Course</th><th>Amount</th><th>Status</th><th>Date</th><th></th></tr></thead><tbody>' +
      list.map(function (p) {
        var check = p.status === 'pending'
          ? '<button class="btn btn-ghost btn-sm" type="button" data-check="' + esc(p.reference) + '">Check status</button>'
          : '';
        return '<tr>' +
          '<td data-label="Course">' + esc(p.courseTitle) + '</td>' +
          '<td data-label="Amount">' + naira(p.amount) + '</td>' +
          '<td data-label="Status"><span class="status ' + esc(p.status) + '">' + esc(p.status) + '</span></td>' +
          '<td data-label="Date">' + fmtDate(p.createdAt) + '</td>' +
          '<td data-label="">' + check + '</td>' +
          '</tr>';
      }).join('') + '</tbody></table>';
  }

  /* ---------- Data ---------- */
  async function loadDash() {
    state.d = await api('/api/dashboard');
    document.getElementById('me-name').textContent = state.d.user.name;
    document.getElementById('me-email').textContent = state.d.user.email;
    window.dispatchEvent(new CustomEvent('debone:user', { detail: state.d.user }));
    var adm = document.getElementById('admin-link');
    if (adm) adm.hidden = !(state.d.user.role === 'admin' || state.d.user.role === 'instructor');
    return state.d;
  }

  /* ---------- Overview ---------- */
  function kpi(label, value, suffix) {
    var KI = { 'Courses': 'book', 'Lessons done': 'check', 'Average progress': 'trend' };
    var ico = window.DIcons ? '<span class="kpi-ico">' + DIcons.get(KI[label] || 'star') + '</span>' : '';
    return '<div class="kpi">' + ico + '<span>' + esc(label) + '</span><b data-count="' + Number(value) + '">0</b>' +
      (suffix ? '<em>' + esc(suffix) + '</em>' : '') + '</div>';
  }

  function renderOverview() {
    var d = state.d;
    var first = (d.user.name || '').split(' ')[0] || 'there';
    var next = d.next;
    var continueBlock = next
      ? '<h2>' + esc(next.lessonTitle) + '</h2><p class="muted">' + esc(next.courseTitle) + '</p>' +
        '<div class="btn-row" style="margin-top:24px"><a class="btn btn-solid" href="#course/' + esc(next.courseId) + '">Resume lesson</a></div>'
      : '<h2>You are all caught up</h2><p class="muted">Browse courses to start something new.</p>' +
        '<div class="btn-row" style="margin-top:24px"><a class="btn btn-ghost" href="#browse">Browse courses</a></div>';

    var staffNote = (d.user.role === 'admin' || d.user.role === 'instructor')
      ? '<section class="panel"><p class="eyebrow">Staff account</p><p class="muted">You are signed in as ' + esc(d.user.role) + '. Paid courses are locked for staff too, exactly as for students. To test payment, sign in with a separate student account.</p></section>'
      : '';
    setView(
      '<div class="stagger">' + profileBanner(d.user) + couponBanner(d.user) +
        viewHead('Welcome back', 'Hi, ' + first + '.', 'Here is where your learning stands today.') + staffNote +
        '<section class="kpis">' +
          kpi('Courses', d.stats.enrolled) +
          kpi('Lessons done', d.stats.completedLessons, '/ ' + d.stats.totalLessons) +
          kpi('Average progress', d.stats.avgProgress, '%') +
        '</section>' +
        '<div class="two">' +
          '<section class="panel continue"><p class="eyebrow">Continue learning</p>' + continueBlock + '</section>' +
          '<section class="panel"><p class="eyebrow">Announcements</p><ul class="news">' +
            d.announcements.map(function (a) { return '<li><b>' + esc(a.title) + '</b><span>' + esc(a.body) + '</span></li>'; }).join('') +
          '</ul></section>' +
        '</div>' +
        '<section class="panel"><div class="panel-head"><p class="eyebrow">Recent payments</p><a href="#payments">View all</a></div>' +
          paymentTable(d.payments) +
        '</section>' +
      '</div>'
    );
    animateCounters();
  }

  /* ---------- My courses ---------- */
  function enrolledCard(c) {
    var label = c.completed === c.total && c.total > 0 ? 'Review' : (c.completed > 0 ? 'Continue' : 'Start');
    return '<article class="dcourse">' + thumb(c) +
      '<span class="tag ' + (c.free ? 'free' : 'paid') + '">' + (c.free ? 'Free intro' : 'Unlocked') + '</span>' +
      '<h3>' + esc(c.title) + '</h3>' +
      '<p>' + esc(c.summary) + '</p>' +
      '<div><div class="meta-row"><span>' + c.completed + ' of ' + c.total + ' lessons</span><span>' + c.progress + '%</span></div>' +
        '<div class="meter teal"><i data-w="' + c.progress + '"></i></div></div>' +
      '<div class="foot"><a class="btn btn-solid btn-sm" href="#course/' + esc(c.id) + '">' + label + '</a></div>' +
    '</article>';
  }

  function renderCourses() {
    var list = state.d.courses.filter(function (c) { return c.enrolled; });
    var head = viewHead('Your learning', 'My courses', 'Everything you have unlocked, with your progress.');
    if (!list.length) {
      setView(head + emptyState('You have not unlocked a course yet.') +
        '<div class="btn-row" style="margin-top:20px"><a class="btn btn-solid" href="#browse">Browse courses</a></div>');
      return;
    }
    setView(head + '<div class="grid-courses stagger">' + list.map(enrolledCard).join('') + '</div>');
    animateBars();
  }

  /* ---------- Browse ---------- */
  function browseCard(c) {
    var status, action;
    if (c.comingSoon && !c.enrolled) {
      status = '<span class="tag soon">Coming soon</span>';
      action = '<span class="btn btn-ghost btn-sm is-disabled" aria-disabled="true">Coming soon</span>';
    } else if (c.enrolled) {
      status = '<span class="tag ' + (c.free ? 'free' : 'paid') + '">' + (c.free ? 'Free intro' : 'Unlocked') + '</span>';
      action = '<a class="btn btn-solid btn-sm" href="#course/' + esc(c.id) + '">Open course</a>';
    } else {
      status = '<span class="tag paid">Locked</span>';
      action = '<button class="btn btn-solid btn-sm" type="button" data-enroll="' + esc(c.id) + '">Enrol for ' + naira(c.price) + '</button>';
    }
    return '<article class="dcourse">' + thumb(c) + status +
      '<h3>' + esc(c.title) + '</h3>' +
      '<p>' + esc(c.summary) + '</p>' +
      '<p class="muted" style="font-size:.85rem">' + c.total + ' lessons' + (c.free || c.comingSoon ? '' : ' · ' + naira(c.price) + ' one-time') + '</p>' +
      '<div class="foot">' + action + '</div>' +
    '</article>';
  }

  function renderBrowse() {
    setView(viewHead('Catalogue', 'Browse courses', 'Start the free intro now. Unlock full courses with secure payment.') +
      '<div class="grid-courses stagger">' + state.d.courses.map(browseCard).join('') + '</div>');
  }

  /* ---------- Course player ---------- */
  function liveBanner(c) {
    var d = new Date(c.liveStart + 'T00:00:00');
    var day = d.getDate(), mon = d.toLocaleString('en-GB', { month: 'short' }).toUpperCase(), yr = d.getFullYear();
    var long = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    return '<section class="live-banner"><div class="lb-date"><b>' + day + '</b><span>' + mon + '</span><small>' + yr + '</small></div>' +
      '<div class="lb-text"><p class="eyebrow">Official live training</p><h3>' + esc(c.title) + ' starts ' + esc(long) + '</h3>' +
      '<p class="muted">Join the video room from the Live classes page on the day. Your instructor posts the link there.</p></div>' +
      '<a class="btn btn-solid btn-sm" href="#live">Go to live classes</a></section>';
  }

  var LOCK_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  function lessonButton(l) {
    var status = l.completed ? 'Done' : (l.locked ? 'Locked' : 'Open');
    return '<li><button class="lesson-btn' + (l.locked ? ' locked' : '') + (l.gated ? ' gated' : '') + (l.completed ? ' done' : '') +
      '" type="button" data-lesson="' + esc(l.id) + '" title="' + esc(l.lockReason || '') + '" aria-label="Lesson ' + l.number + ': ' + esc(l.title) + ', ' + status + '">' +
      '<span class="n">' + String(l.number).padStart(2, '0') + '</span>' +
      '<span class="t">' + esc(l.title) + '</span>' +
      '<span class="st">' + (l.locked ? LOCK_SVG : '') + status + '</span></button></li>';
  }

  function markActive(lid) {
    document.querySelectorAll('.lesson-btn').forEach(function (b) { b.classList.remove('active'); });
    var btn = document.querySelector('[data-lesson="' + lid + '"]');
    if (btn) btn.classList.add('active');
  }

  async function renderCourse(id, lessonId) {
    if (!id) return renderCourses();
    currentCourseId = id;
    setView('<div class="skeleton" style="min-height:420px"></div>');
    var c;
    try {
      c = (await api('/api/courses/' + encodeURIComponent(id))).course;
    } catch (e) {
      setView(emptyState('We could not find that course.'));
      return;
    }
    crumb.textContent = c.title;

    var firstOpen = c.lessons.find(function (l) { return !l.locked && !l.completed; }) ||
                    c.lessons.find(function (l) { return !l.locked; });
    var start = lessonId || (firstOpen ? firstOpen.id : (c.lessons[0] ? c.lessons[0].id : null));

    setView(
      (c.liveStart ? liveBanner(c) : '') + '<div class="course-layout">' +
        '<aside class="course-side">' +
          '<header><p class="eyebrow">' + (c.free ? 'Free introduction' : 'Full course') + '</p>' +
            '<h2>' + esc(c.title) + '</h2>' +
            '<div class="meta-row"><span id="course-count">' + c.completed + ' of ' + c.total + ' complete</span><span id="course-pct">' + c.progress + '%</span></div>' +
            '<div class="meter teal"><i id="course-meter" data-w="' + c.progress + '"></i></div>' +
            (c.enrolled ? '' : '<p class="muted" style="margin-top:14px;font-size:.9rem">Locked. Enrol to unlock the full course.</p>') +
          '</header>' +
          '<ol style="list-style:none;margin:0;padding:0">' + c.lessons.map(lessonButton).join('') + '</ol>' +
          '<div class="cert-card" id="cert-card"' + (c.total > 0 && c.completed === c.total ? '' : ' hidden') + '>' +
            '<b>All lessons complete</b><p>Well done. Request your certificate from the Certificates page. Our team checks your work and sends it to you once it is approved.</p>' +
            '<a class="btn btn-solid btn-sm" href="#certificates">Go to certificates</a></div>' +
        '</aside>' +
        '<section class="lesson-pane" id="pane" aria-live="polite"></section>' +
      '</div>'
    );
    animateBars();

    if (start) {
      markActive(start);
      openLesson(start, c);
    } else {
      document.getElementById('pane').innerHTML = emptyState('This course has no lessons yet.');
    }
  }

  var lastLesson = { id: null, sig: '' };
  async function openLesson(lid, course, quiet) {
    var pane = document.getElementById('pane');
    if (!pane) return;
    markActive(lid);
    if (!quiet) pane.innerHTML = '<div class="skeleton" style="height:320px;border:0"></div>';
    try {
      var d = await api('/api/lessons/' + encodeURIComponent(lid));
      lastLesson = { id: lid, sig: lessonSig(d) };
      renderLesson(d);
    } catch (e) {
      if (e.status === 403 && e.data && e.data.gated) return renderGated(e.data);
      if (e.status === 403 && e.data && e.data.course) return renderPaywall(e.data.course);
      pane.innerHTML = emptyState(e.message);
    }
  }
  function lessonSig(d) { return JSON.stringify([d.completed, d.journey]); }

  function renderGated(g) {
    var pane = document.getElementById('pane');
    pane.innerHTML =
      '<div class="gate-card"><div class="gate-lock">' + LOCK_SVG.replace('width="14" height="14"', 'width="34" height="34"') + '</div>' +
      '<p class="eyebrow" style="justify-content:center">Locked</p>' +
      '<h2>Finish lesson ' + esc(g.previous ? g.previous.number : '') + ' first</h2>' +
      '<p class="muted">This lesson opens after you finish the previous one: read it, join its live class (or watch the recording if you missed it) and submit its assignment.</p>' +
      (g.previous ? '<button class="btn btn-solid" type="button" data-go="' + esc(g.previous.id) + '">Go to lesson ' + esc(g.previous.number) + '</button>' : '') +
      '</div>';
  }

  function fmtWhen(iso) {
    if (!iso) return 'Date to be announced';
    var d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  var CHECK_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  function step(n, state, title, inner) {
    return '<section class="jstep ' + state + '"><div class="jdot">' + (state === 'done' ? CHECK_SVG : n) + '</div>' +
      '<div class="jbody"><h3>' + title + '</h3>' + inner + '</div></section>';
  }
  function classStep(j) {
    var req = j.requirements;
    if (!j.sessions.length) return step(3, 'done', 'Live class', '<p class="muted">There is no live class for this lesson.</p>');
    var s = j.sessions[0];
    var state = req.classDone ? 'done' : 'todo', inner = '<p class="jmeta"><b>' + esc(s.title) + '</b> · ' + esc(fmtWhen(s.startsAt)) + '</p>';
    if (req.classDone) {
      inner += '<p class="jok">' + (s.attended ? 'You are checked in for this class.' : 'Class done.') + ' ✓</p>';
      if (s.recordingUrl) inner += '<button class="btn btn-ghost btn-sm" type="button" data-watch="' + esc(s.id) + '">Watch the recording again</button>';
    } else if (s.status === 'live' || s.liveOpen) {
      inner += '<p class="jlive"><i></i>Class is live now</p><button class="btn btn-solid btn-sm pulse" type="button" data-join="' + esc(s.id) + '" data-url="' + esc(s.joinUrl || '') + '" data-yt="' + (s.youtubeId ? '1' : '') + '">Join live class</button>';
    } else if (s.status === 'ended') {
      inner += s.recordingUrl
        ? '<p class="muted">You missed the live class. Watch the recording to complete this step.</p><button class="btn btn-solid btn-sm" type="button" data-watch="' + esc(s.id) + '">Watch recorded class</button>'
        : '<p class="muted">The class has ended. The recording will appear here as soon as your instructor uploads it.</p>';
    } else {
      inner += '<p class="muted">The join button appears here when the class starts.</p>' + (s.countdownTo ? '<p class="jcount" data-countdown="' + esc(s.countdownTo) + '"></p>' : '');
    }
    return step(3, state, 'Live class', inner);
  }
  function assignStep(j) {
    if (!j.assignments.length) return step(4, 'done', 'Assignment', '<p class="muted">There is no assignment for this lesson.</p>');
    var all = j.requirements.submitted;
    var inner = j.assignments.map(function (a) {
      var sub = a.submission;
      var head = '<p class="jmeta"><b>' + esc(a.title) + '</b> · ' + a.maxMarks + ' marks' + (a.dueAt ? ' · due ' + esc(a.dueAt) : '') + '</p>' +
        (a.instructions ? '<p class="jins">' + esc(a.instructions) + '</p>' : '');
      if (sub && sub.graded) return '<div class="jassign">' + head + '<p class="jok">Marked: <b>' + sub.marks + ' / ' + a.maxMarks + '</b> ✓</p>' + (sub.feedback ? '<p class="muted">' + esc(sub.feedback) + '</p>' : '') + '</div>';
      return '<form class="jassign" data-assign="' + esc(a.id) + '">' + head +
        (sub ? '<p class="jok">Submitted ✓ You can update it until it is marked.</p>' : '') +
        '<textarea class="input" name="text" rows="3" maxlength="5000" placeholder="Write your answer">' + esc(sub ? sub.text : '') + '</textarea>' +
        '<input class="input" name="link" type="url" placeholder="Or paste a link to your work (optional)" value="' + esc(sub ? sub.link : '') + '">' +
        '<button class="btn btn-ghost btn-sm" type="submit">' + (sub ? 'Update submission' : 'Submit assignment') + '</button></form>';
    }).join('');
    return step(4, all ? 'done' : 'todo', 'Assignment', inner);
  }

  function renderLesson(d) {
    var l = d.lesson, j = d.journey, req = j.requirements;
    var pane = document.getElementById('pane');
    var res = (d.resources || []).map(function (r) {
      return '<a class="lesson-res" href="' + esc(r.url) + '" target="_blank" rel="noopener"><span class="lesson-res-ico">↗</span>' + esc(r.title) + '</a>';
    }).join('');
    var nextBtn = d.next
      ? (d.completed
        ? '<button class="btn btn-solid btn-sm unlock-pop" type="button" data-go="' + esc(d.next) + '">Next lesson →</button>'
        : '<button class="btn btn-ghost btn-sm next-locked" type="button" disabled title="Finish this lesson to unlock the next one">' + LOCK_SVG + ' Next lesson locked</button>')
      : '';
    pane.innerHTML =
      '<div class="lesson-top"><p class="eyebrow">' + esc(d.course.title) + '</p><span class="lesson-pos">Lesson ' + d.position + ' of ' + d.total + (d.minutes ? ' · ' + d.minutes + ' min' : '') + '</span></div>' +
      '<h2 class="lesson-title">' + esc(l.title) + '</h2>' +
      '<div class="journey">' +
        step(1, 'done', 'Read the lesson', '<div class="lesson-body">' + l.body.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div>' +
          (res ? '<div class="lesson-resources"><p class="rf2-label">Resources</p><div class="lesson-res-list">' + res + '</div></div>' : '')) +
        step(2, req.noteDone ? 'done' : 'todo', 'Write your notes', '<div class="lesson-notes"><div class="lesson-notes-head"><p class="rf2-label">My notes</p><span class="note-state" id="note-state">Saved privately</span></div>' +
          '<textarea class="input" id="lesson-note" rows="4" maxlength="4000" placeholder="Write down what matters to you. Only you can see these notes.">' + esc(d.note || '') + '</textarea></div>') +
        classStep(j) + assignStep(j) +
      '</div>' +
      '<div class="finish-bar' + (d.completed ? ' is-done' : (req.ready ? ' is-ready' : '')) + '">' +
        '<div class="fb-text">' + (d.completed
          ? '<b>Lesson complete ✓</b><span>' + (j.nextTitle ? 'Next up: ' + esc(j.nextTitle) : 'You have finished the last lesson.') + '</span>'
          : (req.ready ? '<b>You are ready to finish this lesson</b><span>' + (j.nextTitle ? 'This unlocks: ' + esc(j.nextTitle) : 'This is the last lesson.') + '</span>'
            : '<b>Still to do</b><span>' + req.missing.map(esc).join(' · ') + '</span>')) + '</div>' +
        '<button class="btn btn-solid btn-sm" type="button" data-lesson-done="' + esc(l.id) + '"' + (d.completed || !req.ready ? ' disabled' : '') + '>' + (d.completed ? '✓ Completed' : 'Finish lesson') + '</button>' +
      '</div>' +
      '<div class="lesson-nav"><div class="btn-row">' + (d.prev ? '<button class="btn btn-ghost btn-sm" type="button" data-go="' + esc(d.prev) + '">← Previous</button>' : '') + '</div>' +
        '<div class="btn-row">' + nextBtn + '</div></div>';

    var ta = document.getElementById('lesson-note'), st = document.getElementById('note-state'), timer = null;
    ta.addEventListener('input', function () {
      st.textContent = 'Saving…';
      clearTimeout(timer);
      timer = setTimeout(function () {
        api('/api/lessons/' + encodeURIComponent(l.id) + '/note', { method: 'PUT', body: { text: ta.value } })
          .then(function () { st.textContent = 'Saved'; }).catch(function () { st.textContent = 'Not saved. Check your connection.'; });
      }, 700);
    });
    pane.querySelectorAll('[data-join]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var url = b.getAttribute('data-url'), yt = b.getAttribute('data-yt'), sid = b.getAttribute('data-join');
        var w = url ? window.open('about:blank', '_blank') : null;
        b.disabled = true;
        try {
          await api('/api/sessions/' + encodeURIComponent(sid) + '/attend', { method: 'POST', body: {} });
          if (w) w.location = url;
          toast('You are checked in. Enjoy the class!');
          if (!url && yt) location.hash = '#live/' + sid;
          else openLesson(l.id, null, true);
        } catch (e) { if (w) w.close(); toast(e.message, 'err'); b.disabled = false; }
      });
    });
    pane.querySelectorAll('[data-watch]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var w = window.open('about:blank', '_blank');
        b.disabled = true;
        try {
          var r = await api('/api/sessions/' + encodeURIComponent(b.getAttribute('data-watch')) + '/watched', { method: 'POST', body: {} });
          if (w) w.location = r.url;
          toast('Recording opened. This step is now complete.');
          openLesson(l.id, null, true);
        } catch (e) { if (w) w.close(); toast(e.message, 'err'); b.disabled = false; }
      });
    });
    pane.querySelectorAll('form[data-assign]').forEach(function (f) {
      f.addEventListener('submit', async function (e) {
        e.preventDefault();
        var btn = f.querySelector('button[type=submit]'); btn.disabled = true;
        try {
          await api('/api/assignments/' + encodeURIComponent(f.getAttribute('data-assign')) + '/submit', { method: 'POST', body: { text: f.elements.text.value.trim(), link: f.elements.link.value.trim() } });
          toast('Assignment submitted.');
          openLesson(l.id, null, true);
        } catch (err) { toast(err.message, 'err'); btn.disabled = false; }
      });
    });
    var cd = pane.querySelector('[data-countdown]');
    if (cd) {
      var tick = function () {
        if (!document.body.contains(cd)) return;
        var ms = new Date(cd.getAttribute('data-countdown')).getTime() - Date.now();
        if (ms <= 0) { cd.textContent = 'Starting now…'; return; }
        var m = Math.floor(ms / 60000), h = Math.floor(m / 60), dd = Math.floor(h / 24);
        cd.textContent = 'Starts in ' + (dd ? dd + 'd ' + (h % 24) + 'h' : h ? h + 'h ' + (m % 60) + 'm' : m + ' min');
        setTimeout(tick, 15000);
      };
      tick();
    }
  }

  function renderPaywall(course) {
    var pane = document.getElementById('pane');
    if (course.comingSoon) {
      pane.innerHTML = '<div class="paywall"><p class="eyebrow" style="justify-content:center">Coming soon</p><h2>' + esc(course.title) + '</h2><p>This course is not open for enrolment yet. It will appear here as open when enrolment begins.</p></div>';
      return;
    }
    pane.innerHTML =
      '<div class="paywall done-pop">' +
        '<p class="eyebrow" style="justify-content:center">Locked</p>' +
        '<h2>Unlock ' + esc(course.title) + '</h2>' +
        '<p class="price">' + naira(course.price) + '<small>One-time</small></p>' +
        '<p>Pay once through secure Paystack checkout to unlock every lesson in this course.</p>' +
        '<button class="btn btn-solid" type="button" data-enroll="' + esc(course.id) + '">Enrol for ' + naira(course.price) + '</button>' +
        '<p class="muted" style="margin-top:18px;font-size:.9rem">Your course unlocks automatically once the payment is confirmed.</p>' +
      '</div>';
  }

  async function refreshCourseHeader(courseId) {
    if (!courseId) return;
    var c = (await api('/api/courses/' + encodeURIComponent(courseId))).course;
    var count = document.getElementById('course-count');
    var pct = document.getElementById('course-pct');
    var meter = document.getElementById('course-meter');
    if (count) count.textContent = c.completed + ' of ' + c.total + ' complete';
    if (pct) pct.textContent = c.progress + '%';
    if (meter) meter.style.width = c.progress + '%';
    var cc = document.getElementById('cert-card');
    if (cc) cc.hidden = !(c.total > 0 && c.completed === c.total);
    c.lessons.forEach(function (l) {
      var btn = document.querySelector('[data-lesson="' + l.id + '"]');
      if (!btn) return;
      var wasLocked = btn.classList.contains('locked');
      btn.classList.toggle('done', l.completed);
      btn.classList.toggle('locked', l.locked);
      btn.classList.toggle('gated', !!l.gated);
      btn.title = l.lockReason || '';
      var st = btn.querySelector('.st');
      if (st) st.innerHTML = (l.locked ? LOCK_SVG : '') + (l.completed ? 'Done' : (l.locked ? 'Locked' : 'Open'));
      if (wasLocked && !l.locked) { btn.classList.add('just-unlocked'); setTimeout(function () { btn.classList.remove('just-unlocked'); }, 1800); }
    });
  }
  /* Called on every live refresh: update the lock states, and the open lesson only if something changed and nobody is typing */
  async function refreshCourseState() {
    if (!currentCourseId || !document.getElementById('pane')) return;
    await refreshCourseHeader(currentCourseId);
    if (!lastLesson.id) return;
    var ae = document.activeElement, pane = document.getElementById('pane');
    if (ae && pane.contains(ae) && /^(TEXTAREA|INPUT)$/.test(ae.tagName)) return;
    try {
      var d = await api('/api/lessons/' + encodeURIComponent(lastLesson.id));
      var sig = lessonSig(d);
      if (sig !== lastLesson.sig) { lastLesson.sig = sig; renderLesson(d); }
    } catch (e) { /* ignore: the page keeps what it has */ }
  }

  function celebrate(el) {
    var box = el.getBoundingClientRect(), colours = ['#E0A800', '#F7D35C', '#6BCB77', '#F4F4F0'];
    for (var i = 0; i < 26; i++) {
      var p = document.createElement('i');
      p.className = 'confetti';
      p.style.left = (box.left + box.width / 2) + 'px'; p.style.top = (box.top + box.height / 2) + 'px';
      p.style.background = colours[i % colours.length];
      p.style.setProperty('--dx', (Math.random() * 280 - 140) + 'px');
      p.style.setProperty('--dy', (-Math.random() * 220 - 60) + 'px');
      p.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
      p.style.animationDelay = (Math.random() * 120) + 'ms';
      document.body.appendChild(p);
      setTimeout(function (n) { return function () { n.remove(); }; }(p), 1400);
    }
  }
  async function completeLesson(lid, btn) {
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      await api('/api/lessons/' + encodeURIComponent(lid) + '/complete', { method: 'POST' });
      btn.textContent = 'Completed';
      btn.classList.add('done-pop');
      celebrate(btn);
      await loadDash();
      await refreshCourseHeader(currentCourseId);
      toast('Lesson complete. The next lesson is now unlocked.');
      setTimeout(function () { openLesson(lid, null, true); }, 700);
    } catch (e) {
      toast(e.message, 'err');
      btn.disabled = false;
      btn.textContent = 'Mark as complete';
    }
  }

  /* ---------- Enrolment and Paystack ---------- */
  async function enroll(courseId, btn) {
    var course = state.d.courses.find(function (c) { return c.id === courseId; });
    if (!course) return;
    if (course.comingSoon) { DModal.toast({ title: 'This course is coming soon.', tone: 'info' }); return; }
    var coupon = state.d.user.coupon;
    var fee = Number(course.price) || 0;
    var money = function (n) { return '₦' + Math.round(n).toLocaleString('en-US'); };
    if (fee === 0) { return doEnroll(courseId, '', btn); }
    DModal.open({ size: 'md', eyebrow: 'Enrol', title: esc(course.title), body:
      '<div class="enrol"><div class="enrol-row"><span>Course fee</span><b>' + money(fee) + '</b></div>' +
      (coupon ? '<div class="enrol-coupon"><span>Your 30% coupon <b>' + esc(coupon.code) + '</b></span><button type="button" class="btn btn-ghost btn-sm" data-use>Use it</button></div>' : '') +
      '<label class="enrol-label" for="enrol-code">Coupon code (optional)</label>' +
      '<input class="input" id="enrol-code" autocomplete="off" placeholder="Enter your coupon code" maxlength="20">' +
      '<p class="enrol-hint">Coupons work on the account registered with the email you subscribed with.</p>' +
      '<div class="enrol-total"><span>You pay</span><b id="enrol-total">' + money(fee) + '</b></div>' +
      '<p class="form-error" id="enrol-err" role="alert"></p>' +
      '<button type="button" class="btn btn-solid enrol-go" id="enrol-go">Continue to secure payment</button></div>',
      onMount: function (box, inst) {
        var input = box.querySelector('#enrol-code'), total = box.querySelector('#enrol-total');
        var preview = function () {
          var typed = input.value.trim().toUpperCase();
          var ok = coupon && typed === coupon.code;
          total.textContent = money(ok ? fee * 0.7 : fee);
          total.classList.toggle('discounted', !!ok);
        };
        input.addEventListener('input', preview);
        var use = box.querySelector('[data-use]');
        if (use) use.addEventListener('click', function () { input.value = coupon.code; preview(); input.focus(); });
        box.querySelector('#enrol-go').addEventListener('click', function () {
          doEnroll(courseId, input.value.trim().toUpperCase(), this, inst, box.querySelector('#enrol-err'));
        });
      } });
  }

  async function doEnroll(courseId, code, btn, inst, errEl) {
    if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Opening secure payment…'; }
    try {
      var data = await api('/api/courses/' + encodeURIComponent(courseId) + '/enroll', { method: 'POST', body: { coupon: code || '' } });
      if (data.free || data.enrolled) {
        if (inst) inst.close();
        await loadDash(); route();
        DModal.toast({ title: 'Course unlocked. Enjoy learning!', tone: 'ok' });
        return;
      }
      if (data.order) { location.href = 'pay.html?order=' + encodeURIComponent(data.order.id); return; }
      throw new Error('Payment could not be started. Please try again.');
    } catch (err) {
      if (errEl) errEl.textContent = err.message; else DModal.toast({ title: err.message, tone: 'err' });
      if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || 'Continue to secure payment'; }
    }
  }

  async function checkPayment(reference, btn) {
    btn.disabled = true;
    btn.textContent = 'Checking…';
    try {
      var r = await api('/api/payments/verify?reference=' + encodeURIComponent(reference));
      if (r.status === 'success') {
        toast('Payment confirmed. Your course is unlocked.');
        await loadDash();
        return route();
      }
      toast(r.status === 'pending' ? 'Still processing. Try again in a moment.' : 'This payment did not complete.', r.status === 'pending' ? 'warn' : 'err');
    } catch (e) {
      toast(e.message, 'err');
    }
    btn.disabled = false;
    btn.textContent = 'Check status';
  }

  async function handlePaystackReturn(reference) {
    try {
      var r = await api('/api/payments/verify?reference=' + encodeURIComponent(reference));
      await loadDash();
      if (r.status === 'success') {
        toast('Payment confirmed. Your course is unlocked.');
        history.replaceState(null, '', 'dashboard.html#course/' + encodeURIComponent(r.courseId));
      } else if (r.status === 'pending') {
        toast('Your payment is still processing. Refresh in a moment.', 'warn');
        history.replaceState(null, '', 'dashboard.html#payments');
      } else {
        toast('This payment did not complete. You have not been charged for a course.', 'err');
        history.replaceState(null, '', 'dashboard.html#browse');
      }
    } catch (e) {
      toast(e.message, 'err');
      history.replaceState(null, '', 'dashboard.html#payments');
    }
  }

  /* ---------- Payments ---------- */
  var ORDER_LABEL = { awaiting_transfer: 'Waiting for your transfer', awaiting_proof: 'Upload your receipt', proof_uploaded: 'Receipt under review', rejected: 'Receipt needs attention', approved: 'Approved' };
  var ORDER_TONE = { awaiting_transfer: 'none', awaiting_proof: 'none', proof_uploaded: 'none', rejected: 'fail', approved: 'pass' };
  async function renderPayments() {
    setView(viewHead('Billing', 'Payments', 'Your orders, receipts and payment status.') +
      '<section class="panel" id="orders-panel"><div class="skeleton" style="height:120px;border:0"></div></section>' +
      '<section class="panel" id="pay-panel"><div class="skeleton" style="height:120px;border:0"></div></section>');
    try {
      var o = await api('/api/me/orders');
      var op = document.getElementById('orders-panel');
      if (op) op.innerHTML = '<p class="rf2-label">My orders</p>' + (o.orders.length ? '<div class="ord-list">' + o.orders.map(function (x, i) {
        var action = x.status === 'approved' ? (x.courseId ? '<a class="btn btn-solid btn-sm" href="#course/' + esc(x.courseId) + '">Open course</a>' : '')
          : '<a class="btn btn-solid btn-sm" href="pay.html?order=' + encodeURIComponent(x.id) + '">' + (x.status === 'awaiting_transfer' ? 'See bank details' : x.status === 'rejected' ? 'Upload again' : x.status === 'proof_uploaded' ? 'View status' : 'Continue') + '</a>';
        return '<article class="ord-card" style="--i:' + i + '"><div><b>' + esc(x.item) + '</b><p class="muted small">' + esc(x.reference) + ' · ₦' + Number(x.amount).toLocaleString('en-US') + '</p>' +
          (x.status === 'rejected' && x.rejectReason ? '<p class="ord-why">' + esc(x.rejectReason) + '</p>' : '') + '</div>' +
          '<span class="gpill ' + ORDER_TONE[x.status] + '">' + esc(ORDER_LABEL[x.status] || x.status) + '</span>' + action + '</article>';
      }).join('') + '</div>' : '<div class="empty-state">No orders yet. Enrol in a course to see your payment here.</div>');
    } catch (e) { var op2 = document.getElementById('orders-panel'); if (op2) op2.innerHTML = emptyState(e.message); }
    try {
      var r = await api('/api/payments');
      var panel = document.getElementById('pay-panel');
      if (panel) panel.innerHTML = '<p class="rf2-label">Payment history</p>' + paymentTable(r.payments);
    } catch (e) {
      var p2 = document.getElementById('pay-panel');
      if (p2) p2.innerHTML = emptyState(e.message);
    }
  }

  /* ---------- Profile (complete student profile) ---------- */
  var PROFILE_LABELS = { name: 'Full name', phone: 'Phone number', avatar: 'Profile photo', dob: 'Date of birth', gender: 'Gender', state: 'State', city: 'City', occupation: 'Occupation', educationLevel: 'Education level', goals: 'Learning goals', nokName: 'Emergency contact name', nokPhone: 'Emergency contact phone' };
  var OPTS = {
    gender: ['Female', 'Male', 'Prefer not to say'],
    occupation: ['Student', 'Employed', 'Self-employed', 'Unemployed', 'Other'],
    educationLevel: ['Primary', 'Secondary', 'OND / NCE', 'HND / Bachelor', 'Postgraduate', 'Other'],
    howHeard: ['Friend or family', 'Social media', 'Google', 'WhatsApp', 'Walk-in', 'Other']
  };

  function avatarHtml(u, big) {
    var cls = big ? 'pf-avatar big' : 'pf-avatar';
    if (u.hasAvatar) return '<img class="' + cls + ' pf-img" src="/api/me/avatar?v=' + Date.now() + '" alt="Your profile photo">';
    var initials = (u.name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join('');
    return '<div class="' + cls + '" aria-label="No profile photo yet">' + esc(initials) + '</div>';
  }

  function fieldSelect(id, label, options, value, req) {
    return '<div class="field"><label for="' + id + '">' + label + (req ? ' <span class="req">*</span>' : '') + '</label>' +
      '<select class="input" id="' + id + '" name="' + id + '"><option value="">Choose…</option>' +
      options.map(function (o) { return '<option' + (o === value ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></div>';
  }
  function fieldText(id, label, value, opts) {
    opts = opts || {};
    return '<div class="field"><label for="' + id + '">' + label + (opts.req ? ' <span class="req">*</span>' : '') + '</label>' +
      '<input class="input" id="' + id + '" name="' + id + '" type="' + (opts.type || 'text') + '" value="' + esc(value || '') + '"' +
      (opts.max ? ' maxlength="' + opts.max + '"' : '') + (opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : '') +
      (opts.readonly ? ' readonly' : '') + (opts.autocomplete ? ' autocomplete="' + opts.autocomplete + '"' : '') + '></div>';
  }

  function renderProfile() {
    var u = state.d.user, p = u.profile || {}, c = u.completion || { percent: 0, missing: [] };
    var missing = c.missing.map(function (k) { return '<span class="chip-miss">' + esc(PROFILE_LABELS[k] || k) + '</span>'; }).join('');
    setView(viewHead('Account', 'Your profile', 'Complete your profile so we can register you properly and tailor your courses.') +
      '<section class="panel pf-progress"><div class="pf-progress-top"><div><p class="eyebrow">Profile completion</p><b class="pf-pct">' + c.percent + '%</b></div>' +
      (c.percent === 100 ? '<span class="tag free">Complete</span>' : '') + '</div>' +
      '<div class="meter teal"><i data-w="' + c.percent + '"></i></div>' +
      (c.missing.length ? '<p class="muted pf-miss-t">Still needed:</p><div class="pf-miss">' + missing + '</div>' : '<p class="muted">Thank you. Your profile is complete.</p>') +
      '</section>' +

      '<form class="pf-form" id="profile-form" novalidate>' +
        '<section class="panel"><h2>Profile photo</h2>' +
          '<div class="pf-photo">' + avatarHtml(u, true) +
            '<div class="pf-photo-actions"><label class="btn btn-ghost btn-sm pf-upload">Upload photo<input type="file" id="pf-file" accept="image/jpeg,image/png,image/webp" hidden></label>' +
            (u.hasAvatar ? '<button class="btn btn-ghost btn-sm" type="button" id="pf-remove">Remove</button>' : '') +
            '<p class="muted pf-hint">JPG, PNG or WebP. A clear face photo works best.</p></div></div></section>' +

        '<section class="panel"><h2>Personal details</h2><div class="pf-grid">' +
          fieldText('pf-name', 'Full name', u.name, { req: true, max: 80, autocomplete: 'name' }) +
          fieldText('pf-email', 'Email address', u.email, { readonly: true, type: 'email' }) +
          fieldText('pf-phone', 'Phone number', u.phone, { req: true, max: 20, type: 'tel', autocomplete: 'tel', placeholder: 'e.g. 0803 000 0000' }) +
          fieldText('pf-dob', 'Date of birth', p.dob, { req: true, type: 'date' }) +
          fieldSelect('pf-gender', 'Gender', OPTS.gender, p.gender, true) +
          fieldText('pf-state', 'State', p.state, { req: true, max: 60 }) +
          fieldText('pf-city', 'City or town', p.city, { req: true, max: 60 }) +
          fieldText('pf-address', 'Home address', p.address, { max: 200 }) +
        '</div></section>' +

        '<section class="panel"><h2>Education and work</h2><div class="pf-grid">' +
          fieldSelect('pf-occupation', 'Current status', OPTS.occupation, p.occupation, true) +
          fieldSelect('pf-education', 'Highest education level', OPTS.educationLevel, p.educationLevel, true) +
          fieldText('pf-institution', 'School, college or employer', p.institution, { max: 120 }) +
          fieldSelect('pf-how', 'How did you hear about us?', OPTS.howHeard, p.howHeard, false) +
        '</div></section>' +

        '<section class="panel"><h2>Learning goals</h2>' +
          '<div class="field"><label for="pf-goals">What do you want to learn or achieve? <span class="req">*</span></label>' +
          '<textarea class="input" id="pf-goals" name="pf-goals" rows="4" maxlength="500" placeholder="For example: learn AI video creation to grow my content business">' + esc(p.goals || '') + '</textarea></div></section>' +

        '<section class="panel"><h2>Emergency contact</h2><div class="pf-grid">' +
          fieldText('pf-nokname', 'Contact person’s name', p.nokName, { req: true, max: 80 }) +
          fieldText('pf-nokphone', 'Contact person’s phone', p.nokPhone, { req: true, max: 20, type: 'tel' }) +
        '</div></section>' +

        '<p class="form-error" id="pf-error" role="alert"></p>' +
        '<div class="pf-save"><button class="btn btn-solid" type="submit" id="pf-save">Save profile</button></div>' +
      '</form>' +

      '<section class="panel pf-pw"><h2>Change password</h2>' +
        '<form class="form form-narrow" id="pw-form" novalidate>' +
          '<div class="field"><label for="pw-current">Current password</label><input class="input" id="pw-current" type="password" autocomplete="current-password" required></div>' +
          '<div class="field"><label for="pw-next">New password</label><input class="input" id="pw-next" type="password" autocomplete="new-password" minlength="8" required></div>' +
          '<p class="form-error" id="pw-err" role="alert"></p>' +
          '<button class="btn btn-ghost" type="submit">Update password</button>' +
        '</form></section>');

    setTimeout(function () {
      document.querySelectorAll('[data-w]').forEach(function (el) { el.style.width = el.getAttribute('data-w') + '%'; });
    }, 60);

    document.getElementById('pf-file').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      if (file.size > 8 * 1024 * 1024) { toast('That photo is too large. Please choose one under 8 MB.', 'err'); return; }
      resizeToJpeg(file, 360).then(function (dataUrl) {
        window.dispatchEvent(new CustomEvent('debone:avatar-preview', { detail: { src: dataUrl } }));   // show it at once
        var big = document.querySelector('.pf-photo .pf-avatar'); if (big && big.tagName === 'IMG') big.src = dataUrl;
        return api('/api/me/avatar', { method: 'POST', body: { data: dataUrl } });
      }).then(function () {
        toast('Profile photo saved.');
        return loadDash();
      }).then(function () { renderProfile(); })
        .catch(function (err) { toast(err.message, 'err'); if (window.DShell) DShell.refreshUser(); });
    });
    var rm = document.getElementById('pf-remove');
    if (rm) rm.addEventListener('click', function () {
      api('/api/me/avatar', { method: 'DELETE' }).then(function () { toast('Photo removed.'); return loadDash(); })
        .then(function () { renderProfile(); }).catch(function (err) { toast(err.message, 'err'); });
    });

    document.getElementById('profile-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var err = document.getElementById('pf-error'); err.textContent = '';
      var v = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
      var body = {
        name: v('pf-name'), phone: v('pf-phone'),
        profile: {
          dob: v('pf-dob'), gender: v('pf-gender'), state: v('pf-state'), city: v('pf-city'), address: v('pf-address'),
          occupation: v('pf-occupation'), educationLevel: v('pf-education'), institution: v('pf-institution'), howHeard: v('pf-how'),
          goals: v('pf-goals'), nokName: v('pf-nokname'), nokPhone: v('pf-nokphone')
        }
      };
      var required = [['pf-name', 'Full name'], ['pf-phone', 'Phone number'], ['pf-dob', 'Date of birth'], ['pf-gender', 'Gender'], ['pf-state', 'State'], ['pf-city', 'City or town'], ['pf-occupation', 'Current status'], ['pf-education', 'Highest education level'], ['pf-goals', 'Learning goals'], ['pf-nokname', 'Contact person’s name'], ['pf-nokphone', 'Contact person’s phone']];
      for (var i = 0; i < required.length; i++) {
        if (!v(required[i][0])) { err.textContent = 'Please fill in: ' + required[i][1] + '.'; document.getElementById(required[i][0]).focus(); return; }
      }
      var btn = document.getElementById('pf-save'); btn.disabled = true; btn.textContent = 'Saving…';
      try {
        await api('/api/me', { method: 'PATCH', body: body });
        await loadDash();
        toast('Profile saved.');
        renderProfile();
      } catch (ex) { err.textContent = ex.message; }
      finally { btn.disabled = false; btn.textContent = 'Save profile'; }
    });

    document.getElementById('pw-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var pe = document.getElementById('pw-err'); pe.textContent = '';
      var next = document.getElementById('pw-next').value;
      if (next.length < 8) { pe.textContent = 'New password must be at least 8 characters.'; return; }
      try {
        await api('/api/me/password', { method: 'POST', body: { current: document.getElementById('pw-current').value, next: next } });
        e.target.reset();
        toast('Password updated.');
      } catch (ex) { pe.textContent = ex.message; }
    });
  }

  /* Resize a chosen photo to a small square JPEG in the browser (keeps uploads light) */
  function resizeToJpeg(file, size) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var s = Math.min(img.width, img.height), sx = (img.width - s) / 2, sy = (img.height - s) / 2;
        var canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
        canvas.getContext('2d').drawImage(img, sx, sy, s, s, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      img.onerror = function () { reject(new Error('That file could not be read as an image.')); };
      var reader = new FileReader();
      reader.onload = function () { img.src = reader.result; };
      reader.onerror = function () { reject(new Error('That file could not be read.')); };
      reader.readAsDataURL(file);
    });
  }

  /* Overview banner: nudge students to finish their profile */
  function profileBanner(u) {
    var c = u.completion || { percent: 100 };
    if (c.percent >= 100) return '';
    return '<a class="pf-banner" href="#profile"><span><b>Complete your profile</b> ' + c.percent + '% done. Add your photo and details to finish registration.</span><span class="pf-banner-go">Finish</span></a>';
  }

  function couponBanner(u) {
    if (!u.coupon) return '';
    return '<section class="coupon-card" aria-label="Your 30% coupon"><div class="cc-ico"></div><div class="cc-text"><p class="eyebrow">Your reward</p><h3>30% off your next course</h3>' +
      '<p class="muted">Use this code at checkout:</p><div class="cc-code"><span>' + esc(u.coupon.code) + '</span><button type="button" class="btn btn-ghost btn-sm" data-copy="' + esc(u.coupon.code) + '">Copy</button></div></div>' +
      '<a class="btn btn-solid btn-sm" href="#browse">Browse courses</a></section>';
  }

  /* ---------- Router ---------- */
  var TITLES = { overview: 'Overview', courses: 'My courses', browse: 'Browse courses', live: 'Live classes', assignments: 'Assignments', payments: 'Payments', profile: 'Profile', performance: 'Performance', certificates: 'Certificates', reviews: 'Course reviews', downloads: 'Downloads', recordings: 'Recordings', requests: 'Requests and refunds', referrals: 'Refer a friend', community: 'Community', portfolio: 'Talent profile', course: 'Course' };

  function openSide(open) {
    side.classList.toggle('open', open);
    scrim.classList.toggle('show', open);
    burger.setAttribute('aria-expanded', String(open));
  }

  function route() {
    if (window.DashExtras && DashExtras.stop) DashExtras.stop();
    if (!state.d) return;
    var parts = (location.hash || '#overview').replace(/^#/, '').split('/');
    var name = TITLES[parts[0]] ? parts[0] : 'overview';
    var arg = parts[1];
    crumb.textContent = TITLES[name];
    document.querySelectorAll('.side-nav a').forEach(function (a) {
      var target = name === 'course' ? 'courses' : name;
      a.classList.toggle('active', a.getAttribute('data-view') === target);
    });
    openSide(false);

    if (name === 'live' || name === 'assignments' || name === 'performance' || name === 'certificates' || name === 'reviews' || name === 'downloads' || name === 'recordings' || name === 'requests' || name === 'referrals' || name === 'community' || name === 'portfolio') return window.DashExtras.render(name, arg);
    if (name === 'overview') return renderOverview();
    if (name === 'courses') return renderCourses();
    if (name === 'browse') return renderBrowse();
    if (name === 'payments') return renderPayments();
    if (name === 'profile') return renderProfile();
    if (name === 'course') return renderCourse(arg ? decodeURIComponent(arg) : null);
  }

  /* ---------- Global events ---------- */
  document.addEventListener('click', function (e) {
    var enrollBtn = e.target.closest('[data-enroll]');
    if (enrollBtn) return enroll(enrollBtn.getAttribute('data-enroll'), enrollBtn);

    var doneBtn = e.target.closest('[data-lesson-done]');
    if (doneBtn && !doneBtn.disabled) return completeLesson(doneBtn.getAttribute('data-lesson-done'), doneBtn);

    var goBtn = e.target.closest('[data-go]');
    if (goBtn) {
      var gid = goBtn.getAttribute('data-go');
      markActive(gid);
      return openLesson(gid);
    }

    var lessonBtn = e.target.closest('[data-lesson]');
    if (lessonBtn) {
      var lid = lessonBtn.getAttribute('data-lesson');
      if (lessonBtn.classList.contains('gated')) {
        lessonBtn.classList.add('shake'); setTimeout(function () { lessonBtn.classList.remove('shake'); }, 500);
        toast(lessonBtn.title || 'Finish the previous lesson first.', 'warn');
        markActive(lid);
        return openLesson(lid);
      }
      if (lessonBtn.classList.contains('locked')) {
        markActive(lid);
        return openLesson(lid);
      }
      markActive(lid);
      return openLesson(lid);
    }

    var checkBtn = e.target.closest('[data-check]');
    if (checkBtn) return checkPayment(checkBtn.getAttribute('data-check'), checkBtn);
    var copyBtn = e.target.closest('[data-copy]');
    if (copyBtn) {
      var code = copyBtn.getAttribute('data-copy');
      (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(function () {
        copyBtn.textContent = 'Copied';
      }, function () { copyBtn.textContent = code; });
      return;
    }
  });

  burger.addEventListener('click', function () { openSide(!side.classList.contains('open')); });
  scrim.addEventListener('click', function () { openSide(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') openSide(false); });

  var _lo = document.getElementById('logout'); if (_lo) _lo.addEventListener('click', async function () {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); } catch (e) { /* ignore */ }
    location.replace('login.html');
  });

  /* ---------- Boot ---------- */
  async function boot() {
    try {
      await loadDash();
    } catch (e) {
      if (e.status) setView(emptyState(e.message));
      return;
    }
    var params = new URLSearchParams(location.search);
    var ref = params.get('pay') || params.get('reference') || params.get('trxref');
    if (ref) {
      await handlePaystackReturn(ref);
    }
    window.addEventListener('hashchange', route);
    // Live updates: the page refreshes straight away when something changes
    /* Live updates: anything that changes (new marks, a payment confirmed, a new class, an admin setting) shows within a second,
       without a reload, without flicker, and never while you are typing or a pop-up is open. */
    var LIVE_VIEWS = ['overview', 'courses', 'browse', 'payments', 'performance', 'assignments', 'live', 'certificates', 'recordings', 'downloads', 'requests', 'referrals'];
    var refreshing = false, again = false, dirty = false, pending = false;
    function liveRedraw() {
      if (refreshing) { again = true; return; }
      if (dirty || (window.DLive && DLive.busy())) { pending = true; return; }
      refreshing = true; again = false; pending = false;
      var run = async function () {
        await loadDash();
        var name = (location.hash || '#overview').replace(/^#/, '').split('/')[0];
        if (name === 'course') await refreshCourseState();
        else if (LIVE_VIEWS.indexOf(name) !== -1 && !(name === 'live' && document.getElementById('chat-log'))) await Promise.resolve(route());
      };
      (window.DLive ? DLive.quiet(run) : run()).catch(function () {}).then(function () {
        refreshing = false;
        if (again) setTimeout(liveRedraw, 200);
      });
    }
    view.addEventListener('input', function (e) { if (e.target.closest && e.target.closest('form')) dirty = true; }, true);
    view.addEventListener('change', function (e) { if (e.target.closest && e.target.closest('form')) dirty = true; }, true);
    view.addEventListener('submit', function () { dirty = false; }, true);
    window.addEventListener('hashchange', function () { dirty = false; pending = false; });
    window.addEventListener('debone:refresh', liveRedraw);
    document.addEventListener('focusout', function () { if (pending) setTimeout(function () { if (pending) liveRedraw(); }, 400); });
    window.addEventListener('debone:unlock', async function (ev) {
      await loadDash();
      var cur = (location.hash || '').replace(/^#/, '').split('/');
      if (cur[0] === 'course' && cur[1] === ev.detail.courseId) route();
      else if (cur[0] === 'overview' || cur[0] === 'courses' || cur[0] === 'payments') route();
    });
    if (!location.hash) {
      history.replaceState(null, '', 'dashboard.html#overview');
    }
    route();
  }

  boot();
})();
