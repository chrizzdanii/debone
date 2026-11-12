/* Student assignments (table, pop-up submission), grade colours, and performance tracking (v24). */
(function () {
  'use strict';
  var view = document.getElementById('view');
  var crumb = document.getElementById('crumb');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(iso) { if (!iso) return '—'; var d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  async function api(url, opts) {
    opts = opts || {};
    var init = { method: opts.method || 'GET', credentials: 'same-origin', headers: {} };
    if (opts.body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    init.signal = AbortSignal.timeout(15000);
    var res = await fetch(url, init);
    if (res.status === 401) { location.replace('/401.html'); throw new Error('Please log in.'); }
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) { var e = new Error(data.error || 'Something went wrong.'); e.status = res.status; throw e; }
    return data;
  }
  function toast(msg, kind) { if (window.DModal) DModal.toast({ title: msg, tone: kind === 'err' ? 'err' : 'ok', ms: 4500 }); }
  function pill(grade) {
    if (!grade) return '<span class="gpill none">Not marked</span>';
    return '<span class="gpill ' + grade.key + '">' + grade.label + '</span>';
  }
  function head(eyebrow, title, sub) {
    return '<header class="view-head"><p class="eyebrow">' + esc(eyebrow) + '</p><h1>' + esc(title) + '</h1>' + (sub ? '<p class="muted">' + esc(sub) + '</p>' : '') + '</header>';
  }
  function setView(html) {
    if (window.DLive && DLive.silent && /class="skeleton"/.test(html)) return;
    view.innerHTML = html;
    view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter');
  }
  function countUp(el, to) {
    var t0 = null, dur = 1200;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = to; return; }
    requestAnimationFrame(function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(to * e);
      if (p < 1) requestAnimationFrame(step);
    });
  }

  /* ---------- Assignments: a proper table with filters ---------- */
  var filter = 'all';
  async function renderAssignments() {
    crumb.textContent = 'Assignments';
    setView(head('Practice &amp; marks', 'Assignments', 'Submit your work, track due dates, and see your marks and feedback.') + '<div class="skeleton" style="min-height:260px"></div>');
    var dash = await api('/api/dashboard');
    var enrolled = dash.courses.filter(function (c) { return c.enrolled; });
    var rows = [];
    for (var i = 0; i < enrolled.length; i++) {
      var r = await api('/api/courses/' + encodeURIComponent(enrolled[i].id) + '/assignments');
      r.assignments.forEach(function (a) { rows.push({ a: a, course: enrolled[i].title }); });
    }
    var state = function (x) { return !x.a.submission ? 'todo' : (x.a.submission.marks == null ? 'submitted' : 'graded'); };
    var shown = rows.filter(function (x) { return filter === 'all' || state(x) === filter; });
    var counts = { all: rows.length, todo: rows.filter(function (x) { return state(x) === 'todo'; }).length, submitted: rows.filter(function (x) { return state(x) === 'submitted'; }).length, graded: rows.filter(function (x) { return state(x) === 'graded'; }).length };
    var chips = [['all', 'All'], ['todo', 'To do'], ['submitted', 'Submitted'], ['graded', 'Marked']].map(function (c) {
      return '<button type="button" class="chip-btn" data-f="' + c[0] + '" aria-pressed="' + (filter === c[0]) + '">' + c[1] + ' <span>' + counts[c[0]] + '</span></button>';
    }).join('');
    var body = shown.length ? '<div class="dt-wrap"><table class="dt"><thead><tr><th>Assignment</th><th>Course</th><th>Due</th><th>Marks</th><th>Status</th><th>Result</th><th></th></tr></thead><tbody>' +
      shown.map(function (x, n) {
        var s = x.a.submission, st = state(x);
        var status = st === 'todo' ? '<span class="sdot todo"></span>To do' : st === 'submitted' ? '<span class="sdot sub"></span>Submitted' : '<span class="sdot done"></span>Marked';
        var marks = s && s.marks != null ? '<b>' + s.marks + '</b> / ' + x.a.maxMarks : '<span class="muted">' + x.a.maxMarks + '</span>';
        var btn = st === 'graded' ? '<button type="button" class="btn btn-ghost btn-sm" data-open="' + esc(x.a.id) + '">View result</button>'
          : '<button type="button" class="btn btn-solid btn-sm" data-open="' + esc(x.a.id) + '">' + (s ? 'Update' : 'Submit') + '</button>';
        return '<tr style="--i:' + n + '"><td><b>' + esc(x.a.title) + '</b></td><td class="muted">' + esc(x.course) + '</td><td>' + (x.a.dueAt ? fmt(x.a.dueAt) : 'No due date') + '</td><td>' + marks + '</td><td>' + status + '</td><td>' + pill(s ? s.grade : null) + '</td><td class="dt-act">' + btn + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="empty-state">No assignments in this filter yet.</div>';
    setView(head('Practice &amp; marks', 'Assignments', 'Submit your work, track due dates, and see your marks and feedback.') +
      '<div class="dt-tools"><div class="chips">' + chips + '</div><a class="btn btn-ghost btn-sm" href="#performance">View my performance</a></div>' + body);
    view.querySelectorAll('[data-f]').forEach(function (b) { b.addEventListener('click', function () { filter = b.getAttribute('data-f'); renderAssignments(); }); });
    view.querySelectorAll('[data-open]').forEach(function (b) {
      b.addEventListener('click', function () {
        var row = rows.find(function (x) { return x.a.id === b.getAttribute('data-open'); });
        if (row) openAssignment(row);
      });
    });
  }

  function openAssignment(row) {
    var a = row.a, s = a.submission, graded = s && s.marks != null;
    if (graded) {
      var pct = Math.round((s.marks / a.maxMarks) * 100);
      DModal.open({ size: 'md', eyebrow: row.course, title: esc(a.title), body:
        '<div class="res"><div class="res-score"><b class="res-num" data-to="' + s.marks + '">0</b><span>/ ' + a.maxMarks + '</span>' + pill(s.grade) + '</div>' +
        '<div class="res-bar"><i data-w="' + pct + '"></i></div><p class="res-pct">' + pct + '% · marked ' + esc(fmt(s.gradedAt)) + '</p>' +
        '<h4>Feedback</h4><p class="res-fb">' + (s.feedback ? esc(s.feedback) : 'No feedback was written.') + '</p>' +
        '<p class="muted res-note">Marked work cannot be changed.</p></div>',
        onMount: function (box) {
          countUp(box.querySelector('.res-num'), s.marks);
          setTimeout(function () { box.querySelector('.res-bar i').style.width = pct + '%'; }, 200);
        } });
      return;
    }
    DModal.open({ size: 'md', eyebrow: row.course, title: esc(a.title), body:
      '<form class="sub-form" id="sub-form" novalidate>' +
        '<p class="muted sub-instr">' + esc(a.instructions || 'Write your answer below, or add a link to your work.') + '</p>' +
        '<div class="field"><label for="sf-text">Your answer</label><textarea class="input" id="sf-text" rows="6" maxlength="5000" placeholder="Write your answer here…">' + esc(s ? s.text : '') + '</textarea></div>' +
        '<div class="field"><label for="sf-link">Link to your work (optional)</label><input class="input" id="sf-link" type="url" maxlength="500" placeholder="Google Drive or YouTube link" value="' + esc(s ? s.link : '') + '"></div>' +
        '<p class="form-error" id="sf-err" role="alert"></p>' +
        '<div class="sub-actions"><button type="button" class="btn btn-ghost" data-cancel>Cancel</button><button type="submit" class="btn btn-solid" id="sf-go">' + (s ? 'Save update' : 'Submit assignment') + '</button></div>' +
      '</form>',
      onMount: function (box, inst) {
        box.querySelector('[data-cancel]').addEventListener('click', inst.close);
        box.querySelector('#sub-form').addEventListener('submit', async function (e) {
          e.preventDefault();
          var text = box.querySelector('#sf-text').value.trim(), link = box.querySelector('#sf-link').value.trim(), err = box.querySelector('#sf-err');
          err.textContent = '';
          if (!text && !link) { err.textContent = 'Write your answer or add a link to your work.'; return; }
          var btn = box.querySelector('#sf-go'); btn.disabled = true; btn.textContent = 'Submitting…';
          try {
            await api('/api/assignments/' + encodeURIComponent(a.id) + '/submit', { method: 'POST', body: { text: text, link: link } });
            inst.close();
            toast('Submitted. Your instructor will mark it soon.');
            setTimeout(function () { renderAssignments(); }, 520);
          } catch (ex) { err.textContent = ex.message; btn.disabled = false; btn.textContent = s ? 'Save update' : 'Submit assignment'; }
        });
      } });
  }

  /* ---------- Performance: track progress and see where to improve ---------- */
  async function renderPerformance() {
    crumb.textContent = 'Performance';
    setView(head('Your progress', 'Performance', 'See how you are doing across every assignment, and what to work on next.') + '<div class="skeleton" style="min-height:300px"></div>');
    var p = await api('/api/me/performance');
    var tip, avg = p.avg;
    if (avg == null) tip = 'Your first marked assignment will appear here. Submit your work to start tracking your progress.';
    else if (avg < 50) tip = 'Read every assignment’s instructions twice, answer each part, and use the feedback you receive to plan your next piece of work.';
    else if (avg < 75) tip = 'You are passing. Add specific examples and check your work before you submit to move into Distinction.';
    else tip = 'Excellent work. Keep the same standard, and try to lift your weakest course further.';
    var bars = p.trend.length ? p.trend.map(function (t, i) {
      return '<div class="bc-col" style="--i:' + i + '"><div class="bc-bar ' + t.grade + '" data-h="' + Math.max(6, t.pct) + '"><span>' + t.pct + '%</span></div><small title="' + esc(t.label) + '">' + esc(t.label.length > 14 ? t.label.slice(0, 13) + '…' : t.label) + '</small></div>';
    }).join('') : '<div class="empty-state">Your chart will fill in after your first marked assignment.</div>';
    var courses = p.courses.length ? p.courses.map(function (c) {
      var g = c.avg >= 75 ? 'distinction' : c.avg >= 50 ? 'pass' : 'fail';
      return '<div class="pc-course"><div><b>' + esc(c.course) + '</b><span class="muted">' + c.count + ' marked</span></div><div class="pc-meter ' + g + '"><i data-w="' + c.avg + '"></i></div><em class="gpill ' + g + '">' + c.avg + '%</em></div>';
    }).join('') : '<div class="empty-state">No course results yet.</div>';
    var rows = p.rows.length ? p.rows.map(function (r, n) {
      return '<tr style="--i:' + n + '"><td><b>' + esc(r.assignment) + '</b></td><td class="muted">' + esc(r.course) + '</td><td><b>' + r.marks + '</b> / ' + r.max + '</td><td>' + r.pct + '%</td><td>' + pill(r.grade) + '</td><td>' + fmt(r.gradedAt) + '</td><td class="muted">' + (r.feedback ? esc(r.feedback) : '—') + '</td></tr>';
    }).join('') : '<tr><td colspan="7" class="muted">No marked assignments yet.</td></tr>';
    setView(head('Your progress', 'Performance', 'See how you are doing across every assignment, and what to work on next.') +
      '<section class="pf-stats">' +
        '<div class="pfs"><span>Average score</span><b class="pfs-n" data-to="' + (avg == null ? 0 : avg) + '">0</b><small>%</small></div>' +
        '<div class="pfs"><span>Best score</span><b class="pfs-n" data-to="' + (p.best == null ? 0 : p.best) + '">0</b><small>%</small></div>' +
        '<div class="pfs"><span>Distinction</span><b class="pfs-n" data-to="' + p.counts.distinction + '">0</b><small>work</small></div>' +
        '<div class="pfs"><span>Waiting for marks</span><b class="pfs-n" data-to="' + p.pending + '">0</b><small>work</small></div>' +
      '</section>' +
      '<div class="pf-grid2"><section class="panel pf-chart"><p class="eyebrow">Score by assignment</p><div class="bc">' + bars + '</div></section>' +
        '<section class="panel"><p class="eyebrow">By course</p><div class="pc-list">' + courses + '</div></section></div>' +
      '<section class="panel tip-box"><span class="tip-ico"></span><div><p class="eyebrow">Your next step</p><p>' + esc(tip) + '</p></div></section>' +
      '<section class="panel"><p class="eyebrow">Marked work</p><div class="dt-wrap"><table class="dt"><thead><tr><th>Assignment</th><th>Course</th><th>Marks</th><th>%</th><th>Result</th><th>Marked</th><th>Feedback</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>');
    if (window.DIcons) view.querySelector('.tip-ico').innerHTML = DIcons.get('trend');
    view.querySelectorAll('.pfs-n').forEach(function (el) { countUp(el, Number(el.getAttribute('data-to'))); });
    setTimeout(function () {
      view.querySelectorAll('.bc-bar').forEach(function (el) { el.style.height = el.getAttribute('data-h') + '%'; });
      view.querySelectorAll('.pc-meter i').forEach(function (el) { el.style.width = el.getAttribute('data-w') + '%'; });
    }, 150);
  }

  var old = window.DashExtras && window.DashExtras.render;
  window.DashExtras = Object.assign(window.DashExtras || {}, {
    render: function (name, arg) {
      if (name === 'assignments') return renderAssignments();
      if (name === 'performance') return renderPerformance();
      if (old) return old(name, arg);
    }
  });
  /* ---------- Certificates ---------- */
  async function renderCertificates() {
    crumb.textContent = 'Certificates';
    setView(head('Achievement', 'Certificates', 'Certificates are issued automatically when you meet the course requirements.') + '<div class="skeleton" style="min-height:240px"></div>');
    var d = await api('/api/me/certificates');
    var certs = d.certificates.length ? '<div class="cert-grid">' + d.certificates.map(function (c, i) {
      return '<article class="cert-mini" style="--i:' + i + '"><span class="cert-mini-tag">Certificate</span><h3>' + esc(c.courseTitle) + '</h3>' +
        '<p class="muted">Issued ' + esc(fmt(c.issuedAt)) + '</p><p class="cert-code-line"><b>' + esc(c.code) + '</b></p>' +
        '<div class="row-actions"><a class="btn btn-solid btn-sm" href="certificate.html?code=' + encodeURIComponent(c.code) + '" target="_blank" rel="noopener">View &amp; print</a>' +
        '<a class="btn btn-ghost btn-sm" href="/api/me/certificates/' + encodeURIComponent(c.code) + '/pdf">Download PDF</a>' +
        '<button class="btn btn-ghost btn-sm" type="button" data-copy-cert="' + esc(c.code) + '">Copy code</button></div></article>';
    }).join('') + '</div>' : '<div class="empty-state">No certificates yet. Complete a course and pass its assignments to earn one.</div>';
    var prog = d.progress.length ? d.progress.map(function (p) {
      var pct = p.lessonsTotal ? Math.round(p.lessonsDone / p.lessonsTotal * 100) : 0;
      return '<div class="cp-row"><div class="cp-top"><b>' + esc(p.courseTitle) + '</b><span class="gpill ' + (p.complete ? 'pass' : 'none') + '">' + (p.complete ? 'Requirements met' : pct + '% of lessons') + '</span></div>' +
        '<div class="meter teal"><i data-w="' + (p.complete ? 100 : pct) + '"></i></div>' +
        (p.missing.length && !p.complete ? '<ul class="cp-miss">' + p.missing.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
    }).join('') : '<div class="empty-state">Enrol in a course to see what is needed for its certificate.</div>';
    setView(head('Achievement', 'Certificates', 'Certificates are issued automatically when you meet the course requirements.') +
      '<section class="panel"><p class="eyebrow">Your certificates</p>' + certs + '</section>' +
      '<section class="panel" style="margin-top:16px"><p class="eyebrow">Requirements</p><p class="muted">To earn a certificate: finish every lesson, submit every assignment, and reach 50% or more in each one.</p>' + prog + '</section>');
    view.querySelectorAll('[data-copy-cert]').forEach(function (b) {
      b.addEventListener('click', function () {
        var code = b.getAttribute('data-copy-cert');
        (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(function () { b.textContent = 'Copied'; }, function () { b.textContent = code; });
      });
    });
    setTimeout(function () { view.querySelectorAll('[data-w]').forEach(function (el) { el.style.width = el.getAttribute('data-w') + '%'; }); }, 120);
  }

  /* ---------- Course reviews ---------- */
  async function renderReviews() {
    crumb.textContent = 'Course reviews';
    setView(head('Your voice', 'Course reviews', 'Rate the courses you are enrolled in. Our team checks each review before it is published.') + '<div class="skeleton" style="min-height:240px"></div>');
    var dash = await api('/api/dashboard');
    var mine = (await api('/api/me/reviews')).reviews;
    var enrolled = dash.courses.filter(function (c) { return c.enrolled; });
    var cards = enrolled.length ? enrolled.map(function (c, i) {
      var r = mine.find(function (x) { return x.courseId === c.id; });
      var body;
      if (r) {
        var st = { pending: 'Waiting for review', approved: 'Published', rejected: 'Not published' }[r.status];
        body = '<div class="rv-done"><div class="rv-stars-static">' + '★'.repeat(r.rating) + '<span>' + '★'.repeat(5 - r.rating) + '</span></div>' +
          '<p>' + esc(r.text) + '</p><span class="gpill ' + (r.status === 'approved' ? 'pass' : r.status === 'rejected' ? 'fail' : 'none') + '">' + st + '</span></div>';
      } else {
        body = '<form class="rv-form" data-course="' + esc(c.id) + '"><div class="rv-pick" role="radiogroup" aria-label="Rating">' +
          [5, 4, 3, 2, 1].map(function (n) { return '<input type="radio" id="rv-' + esc(c.id) + '-' + n + '" name="rating-' + esc(c.id) + '" value="' + n + '"' + (n === 5 ? ' checked' : '') + '><label for="rv-' + esc(c.id) + '-' + n + '" aria-label="' + n + ' stars">★</label>'; }).join('') +
          '</div><textarea class="input" rows="3" maxlength="600" required minlength="10" placeholder="What did you learn? What would you improve?"></textarea>' +
          '<p class="form-error" role="alert"></p><button class="btn btn-solid btn-sm" type="submit">Publish my review</button></form>';
      }
      return '<article class="rv-card" style="--i:' + i + '"><h3>' + esc(c.title) + '</h3>' + body + '</article>';
    }).join('') : '<div class="empty-state">You can review a course once you are enrolled in it.</div>';
    setView(head('Your voice', 'Course reviews', 'Rate the courses you are enrolled in. Our team checks each review before it is published.') +
      '<div class="rv-grid">' + cards + '</div>');
    view.querySelectorAll('.rv-form').forEach(function (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var err = form.querySelector('.form-error'), btn = form.querySelector('button');
        err.textContent = '';
        var rating = form.querySelector('input[type=radio]:checked').value;
        btn.disabled = true; btn.textContent = 'Sending…';
        try {
          await api('/api/courses/' + encodeURIComponent(form.getAttribute('data-course')) + '/reviews', { method: 'POST', body: { rating: Number(rating), text: form.querySelector('textarea').value.trim() } });
          toast('Thank you. Your review is with our team.');
          renderReviews();
        } catch (ex) { err.textContent = ex.message; btn.disabled = false; btn.textContent = 'Publish my review'; }
      });
    });
  }

  var old2 = window.DashExtras && window.DashExtras.render;
  window.DashExtras = Object.assign(window.DashExtras || {}, {
    render: function (name, arg) {
      if (name === 'certificates') return renderCertificates();
      if (name === 'reviews') return renderReviews();
      return old2 ? old2(name, arg) : undefined;
    }
  });
})();
