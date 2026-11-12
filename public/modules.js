/* Public forms and pages: feedback, instructor applications, webinars, certificate check (v31). */
(function () {
  'use strict';
  var page = document.body.getAttribute('data-page');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function post(url, body) {
    return fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); });
  }
  function fail(res) { throw new Error(res.d.error || 'Something went wrong. Please try again.'); }

  /* Feedback */
  if (page === 'feedback') {
    $('fb-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, msg = $('fb-msg'), btn = f.querySelector('button[type=submit]');
      msg.className = 'form-ok'; msg.textContent = '';
      var body = { name: f.name.value.trim(), email: f.email.value.trim(), category: f.category.value, message: f.message.value.trim() };
      btn.disabled = true; btn.textContent = 'Sending…';
      post('/api/feedback', body).then(function (res) {
        if (!res.ok) fail(res);
        msg.textContent = res.d.message; f.reset();
      }).catch(function (err) { msg.className = 'form-error'; msg.textContent = err.message; })
        .then(function () { btn.disabled = false; btn.textContent = 'Send suggestion'; });
    });
  }

  /* Instructor application */
  if (page === 'instructor') {
    $('ia-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, msg = $('ia-msg'), btn = f.querySelector('button[type=submit]');
      msg.className = 'form-ok'; msg.textContent = '';
      var body = {};
      ['fullName','email','phone','expertise','experience','portfolio','proposedCourse','availability'].forEach(function (k) { body[k] = f.elements[k].value.trim(); });
      btn.disabled = true; btn.textContent = 'Sending application…';
      post('/api/instructor-applications', body).then(function (res) {
        if (!res.ok) fail(res);
        msg.textContent = res.d.message; f.reset();
      }).catch(function (err) { msg.className = 'form-error'; msg.textContent = err.message; })
        .then(function () { btn.disabled = false; btn.textContent = 'Send application'; });
    });
  }

  /* Webinars */
  if (page === 'webinars') {
    var box = $('wb-list');
    function fmt(iso) { return new Date(iso).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' }); }
    function card(w) {
      var seats = w.capacity ? (w.seatsLeft > 0 ? 'Registration open' : 'Full') : 'Registration open';
      var action;
      if (w.past) action = '<span class="btn btn-ghost btn-sm is-disabled">Finished</span>';
      else if (w.registered_by_me) action = (w.link ? '<a class="btn btn-solid btn-sm" href="' + esc(w.link) + '" target="_blank" rel="noopener">Join webinar</a>' : '') + '<span class="wb-reg">You are registered</span>';
      else if (w.capacity && w.seatsLeft === 0) action = '<span class="btn btn-ghost btn-sm is-disabled">Full</span>';
      else action = '<button type="button" class="btn btn-solid btn-sm" data-reg="' + esc(w.id) + '">Register free</button>';
      return '<article class="wb-card"><div class="wb-img" style="background-image:url(\'' + window.ACAD.img((w.title || '').length + 2) + '\')"></div><div class="wb-date"><b>' + new Date(w.startsAt).getDate() + '</b><span>' + new Date(w.startsAt).toLocaleString('en-GB', { month: 'short' }).toUpperCase() + '</span></div>' +
        '<div class="wb-body"><p class="eyebrow">' + esc(w.instructor || 'DEBONE') + '</p><h3>' + esc(w.title) + '</h3><p class="muted">' + esc(fmt(w.startsAt)) + ' · ' + w.durationMinutes + ' minutes</p>' +
        '<p>' + esc(w.description || '') + '</p><div class="wb-foot"><span class="wb-seats">' + seats + '</span>' + action + '</div></div></article>';
    }
    function load() {
      fetch('/api/webinars', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (d) {
        var list = d.webinars || [];
        var sg = JSON.stringify(list); if (sg === load.sig) return; load.sig = sg;
        var up = list.filter(function (w) { return !w.past; });
        box.innerHTML = up.map(card).join('') || '<div class="empty-state">No webinars are scheduled right now. New dates are announced here and on WhatsApp.</div>';
        box.querySelectorAll('[data-reg]').forEach(function (b) {
          b.addEventListener('click', function () {
            b.disabled = true; b.textContent = 'Registering…';
            post('/api/webinars/' + encodeURIComponent(b.getAttribute('data-reg')) + '/register', {}).then(function (res) {
              if (res.status === 401) { location.href = 'login.html?next=webinars.html'; return; }
              if (!res.ok) fail(res);
              if (window.DModal) DModal.toast({ title: 'You are registered', body: 'We will remind you before the webinar starts.', tone: 'ok' });
              load();
            }).catch(function (err) { if (window.DModal) DModal.toast({ title: err.message, tone: 'err' }); b.disabled = false; b.textContent = 'Register free'; });
          });
        });
      }).catch(function () { box.innerHTML = '<div class="empty-state">Webinars could not load. Please refresh.</div>'; });
    }
    load();
    window.addEventListener('debone:refresh', load);
  }

  /* Certificate check */
  if (page === 'certificate') {
    var params = new URLSearchParams(location.search);
    var input = $('cert-code'), out = $('cert-out');
    function show(code) {
      out.innerHTML = '<div class="empty-state">Checking…</div>';
      fetch('/api/certificates/verify?code=' + encodeURIComponent(code)).then(function (r) { return r.json(); }).then(function (d) {
        if (!d.valid) { out.innerHTML = '<div class="cert-no"><b>We could not verify this code.</b><p class="muted">Check the code on the certificate and try again. Codes are not case sensitive.</p></div>'; return; }
        var date = new Date(d.issuedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        out.innerHTML = '<article class="cert" id="cert-print"><div class="cert-inner"><p class="cert-brand">DEBONE Digital Academy</p>' +
          '<p class="cert-said">This certifies that</p><h2 class="cert-name">' + esc(d.studentName) + '</h2>' +
          '<p class="cert-said">has successfully completed</p><h3 class="cert-course">' + esc(d.courseTitle) + '</h3>' +
          '<div class="cert-foot"><div><b>' + esc(date) + '</b><span>Date issued</span></div><div><b>' + esc(d.code) + '</b><span>Verification code</span></div></div></div></article>' +
          '<div class="cert-actions"><span class="cert-valid">✓ Verified certificate</span><button type="button" class="btn btn-solid" id="cert-print-btn">Print or save as PDF</button></div>';
        $('cert-print-btn').addEventListener('click', function () { window.print(); });
      }).catch(function () { out.innerHTML = '<div class="empty-state">The check could not be completed. Please try again.</div>'; });
    }
    $('cert-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var code = input.value.trim();
      if (code) show(code);
    });
    if (params.get('code')) { input.value = params.get('code'); show(params.get('code')); }
  }
})();
