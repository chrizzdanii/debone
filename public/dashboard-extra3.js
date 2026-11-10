/* Student dashboard: downloads, requests and refunds, referrals, community, portfolio (v32). */
(function () {
  'use strict';
  var view = document.getElementById('view'), crumb = document.getElementById('crumb');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(iso) { if (!iso) return '—'; var d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function naira(n) { return '₦' + Number(n || 0).toLocaleString('en-US'); }
  function api(url, opts) {
    opts = opts || {};
    var init = { method: opts.method || 'GET', credentials: 'same-origin', headers: {} };
    if (opts.body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    return fetch(url, init).then(function (r) {
      if (r.status === 401) { location.replace('login.html?next=dashboard'); throw new Error('Please log in.'); }
      return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Something went wrong.'); return d; });
    });
  }
  function toast(t, tone) { if (window.DModal) DModal.toast({ title: t, tone: tone || 'ok' }); }
  function head(eyebrow, title, sub) { return '<header class="view-head"><p class="eyebrow">' + esc(eyebrow) + '</p><h1>' + esc(title) + '</h1>' + (sub ? '<p class="muted">' + esc(sub) + '</p>' : '') + '</header>'; }
  function setView(html) { view.innerHTML = html; view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter'); }

  /* Downloads */
  async function renderDownloads() {
    crumb.textContent = 'Downloads';
    var d = await api('/api/me/downloads');
    setView(head('Your files', 'Downloads', 'Files you have bought. Each product can be downloaded up to ' + d.limit + ' times and stays available for a set period.') +
      '<div class="dl-grid">' + (d.downloads.length ? d.downloads.map(function (x, i) {
        var status = x.available ? '<span class="gpill pass">Ready</span>' : '<span class="gpill fail">' + esc({ expired: 'Expired', limit: 'Download limit reached', 'not ready': 'Not ready yet' }[x.reason] || 'Unavailable') + '</span>';
        return '<article class="dl-card" style="--i:' + i + '"><h3>' + esc(x.title) + '</h3><p class="muted">' + esc(x.author) + (x.formats ? ' · ' + esc(x.formats) : '') + '</p>' +
          '<p class="small">Downloads used: <b>' + x.downloadsUsed + '</b> of ' + d.limit + ' · Available until ' + esc(fmt(x.expiresAt)) + '</p>' + status +
          (x.available ? '<a class="btn btn-solid btn-sm" href="/api/downloads/' + encodeURIComponent(x.id) + '">Download</a>' : '') + '</article>';
      }).join('') : '<div class="empty-state">No purchases yet. Visit the <a href="store.html">digital store</a>.</div>') + '</div>');
  }

  /* Requests: schedule changes and refunds */
  async function renderRequests() {
    crumb.textContent = 'Requests and refunds';
    var n = await api('/api/me/schedule-notices'), r = await api('/api/me/refunds'), p = await api('/api/payments');
    var notices = n.notices.length ? n.notices.map(function (x) {
      var action = x.status === 'open'
        ? '<div class="row-actions"><button class="btn btn-solid btn-sm" type="button" data-choose="' + esc(x.id) + '" data-c="new_date">Wait for a new date</button><button class="btn btn-ghost btn-sm" type="button" data-choose="' + esc(x.id) + '" data-c="refund">Request a refund</button></div>'
        : '<span class="gpill none">' + esc({ waiting: 'Waiting for a new date', refund_requested: 'Refund requested', rescheduled: 'New date: ' + (x.newStartDate || '') }[x.status] || x.status) + '</span>';
      return '<article class="rq-card"><h3>' + esc(x.courseTitle) + '</h3><p class="muted">The course needs more students to run on its start date. Choose what you would like.</p>' + action + '</article>';
    }).join('') : '<div class="empty-state">No schedule notices. Your courses are running as planned.</div>';
    var payable = p.payments.filter(function (x) { return x.status === 'success'; });
    var pays = payable.length ? payable.map(function (x) {
      return '<tr><td><b>' + esc(x.courseTitle) + '</b></td><td>' + naira(x.amount) + '</td><td>' + esc(fmt(x.paidAt || x.createdAt)) + '</td><td class="dt-act"><button class="btn btn-ghost btn-sm" type="button" data-refund="' + esc(x.reference) + '">Request refund</button></td></tr>';
    }).join('') : '<tr><td colspan="4" class="muted">No paid orders yet.</td></tr>';
    var refunds = r.refunds.length ? r.refunds.map(function (x) {
      return '<tr><td>' + esc(x.reference) + '</td><td>' + naira(x.amount) + '</td><td>' + esc(x.reason) + '</td><td><span class="gpill none">' + esc(x.status) + '</span></td><td>' + esc(fmt(x.createdAt)) + '</td></tr>';
    }).join('') : '<tr><td colspan="5" class="muted">No refund requests.</td></tr>';
    setView(head('Account', 'Requests and refunds', 'Schedule choices, refund requests and their progress.') +
      '<section class="panel"><p class="eyebrow">Schedule notices</p><div class="rq-list">' + notices + '</div></section>' +
      '<section class="panel" style="margin-top:16px"><p class="eyebrow">Request a refund</p><p class="muted small">Refunds can be requested within the period shown in our refund policy. Courses that have already started and products already downloaded are not refundable.</p>' +
      '<div class="dt-wrap"><table class="dt"><thead><tr><th>Item</th><th>Paid</th><th>Date</th><th></th></tr></thead><tbody>' + pays + '</tbody></table></div></section>' +
      '<section class="panel" style="margin-top:16px"><p class="eyebrow">Your refund requests</p><div class="dt-wrap"><table class="dt"><thead><tr><th>Payment</th><th>Amount</th><th>Reason</th><th>Status</th><th>Sent</th></tr></thead><tbody>' + refunds + '</tbody></table></div></section>');
    view.querySelectorAll('[data-choose]').forEach(function (b) {
      b.addEventListener('click', async function () {
        try { await api('/api/me/schedule-notices/' + encodeURIComponent(b.getAttribute('data-choose')) + '/choose', { method: 'POST', body: { choice: b.getAttribute('data-c') } }); toast('Thank you. Your choice is recorded.'); renderRequests(); }
        catch (e) { toast(e.message, 'err'); }
      });
    });
    view.querySelectorAll('[data-refund]').forEach(function (b) {
      b.addEventListener('click', function () {
        var reason = window.prompt('Tell us briefly why you want a refund:', '');
        if (!reason || reason.trim().length < 5) return;
        api('/api/me/payments/' + encodeURIComponent(b.getAttribute('data-refund')) + '/refund', { method: 'POST', body: { reason: reason.trim() } })
          .then(function (res) { toast(res.message); renderRequests(); }).catch(function (e) { toast(e.message, 'err'); });
      });
    });
  }

  /* Referrals */
  async function renderReferrals() {
    crumb.textContent = 'Refer a friend';
    var d = await api('/api/me/referral');
    setView(head('Share', 'Refer a friend', 'Share your link. Your friend gets ' + d.discountPercent + '% off their first course. When they pay, you earn ' + naira(d.rewardNaira) + ' credit.') +
      '<section class="panel rf-card"><p class="eyebrow">Your link</p><div class="rf-link"><code id="rf-link">' + esc(d.link) + '</code><button class="btn btn-solid btn-sm" type="button" id="rf-copy">Copy link</button></div>' +
      '<p class="muted small">Your code: <b>' + esc(d.code) + '</b></p><div class="rf-stats"><div><b>' + naira(d.credit) + '</b><span>Credit earned</span></div><div><b>' + d.referred.length + '</b><span>Friends joined</span></div><div><b>' + d.referred.filter(function (x) { return x.paid; }).length + '</b><span>Paid</span></div></div></section>' +
      '<section class="panel" style="margin-top:16px"><p class="eyebrow">Friends you referred</p>' + (d.referred.length ? '<ul class="rf-list">' + d.referred.map(function (x) { return '<li>' + esc(x.name) + ' <span class="gpill ' + (x.paid ? 'pass' : 'none') + '">' + (x.paid ? 'paid' : 'not paid yet') + '</span></li>'; }).join('') + '</ul>' : '<div class="empty-state">No one has joined with your link yet.</div>') + '</section>');
    document.getElementById('rf-copy').addEventListener('click', function () {
      var t = document.getElementById('rf-link').textContent;
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { document.getElementById('rf-copy').textContent = 'Copied'; }, function () {});
    });
  }

  /* Community */
  async function renderCommunity() {
    crumb.textContent = 'Community';
    var dash = await api('/api/dashboard');
    var enrolled = dash.courses.filter(function (c) { return c.enrolled; });
    if (!enrolled.length) { setView(head('Learn together', 'Community', 'Ask questions and help classmates in your courses.') + '<div class="empty-state">Enrol in a course to join its community.</div>'); return; }
    var cur = (location.hash.split('/')[1]) || enrolled[0].id;
    var course = enrolled.find(function (c) { return c.id === cur; }) || enrolled[0];
    var d = await api('/api/courses/' + encodeURIComponent(course.id) + '/community');
    setView(head('Learn together', 'Community', 'Ask questions and help classmates in your courses. Be kind and stay on topic.') +
      '<div class="cm-pick">' + enrolled.map(function (c) { return '<a class="chip-btn" href="#community/' + esc(c.id) + '" aria-pressed="' + (c.id === course.id) + '">' + esc(c.title) + '</a>'; }).join('') + '</div>' +
      '<section class="panel cm-new"><p class="eyebrow">Start a discussion</p><input class="input" id="cm-title" maxlength="120" placeholder="Title, for example: How do I export my video?"><textarea class="input" id="cm-body" rows="3" maxlength="2000" placeholder="Describe your question or share your progress"></textarea><button class="btn btn-solid" type="button" id="cm-post">Post</button></section>' +
      '<div class="cm-threads">' + (d.threads.length ? d.threads.map(function (t) {
        return '<article class="cm-thread"><h3>' + esc(t.title) + '</h3><p class="muted small">' + esc(t.authorName) + ' · ' + esc(fmt(t.createdAt)) + '</p><p>' + esc(t.body) + '</p>' +
          '<div class="cm-replies">' + t.replies.map(function (r) { return '<div class="cm-reply"><b>' + esc(r.authorName) + '</b> ' + esc(r.body) + '</div>'; }).join('') + '</div>' +
          '<div class="row-actions"><input class="input" data-reply="' + esc(t.id) + '" maxlength="2000" placeholder="Reply…"><button class="btn btn-ghost btn-sm" type="button" data-send="' + esc(t.id) + '">Reply</button></div></article>';
      }).join('') : '<div class="empty-state">No discussions yet. Start the first one above.</div>') + '</div>');
    document.getElementById('cm-post').addEventListener('click', function () {
      var title = document.getElementById('cm-title').value.trim(), body = document.getElementById('cm-body').value.trim();
      api('/api/courses/' + encodeURIComponent(course.id) + '/community/threads', { method: 'POST', body: { title: title, body: body } })
        .then(function () { toast('Posted.'); renderCommunity(); }).catch(function (e) { toast(e.message, 'err'); });
    });
    view.querySelectorAll('[data-send]').forEach(function (b) {
      b.addEventListener('click', function () {
        var input = view.querySelector('[data-reply="' + b.getAttribute('data-send') + '"]');
        if (!input.value.trim()) return;
        api('/api/community/threads/' + encodeURIComponent(b.getAttribute('data-send')) + '/replies', { method: 'POST', body: { body: input.value.trim() } })
          .then(function () { renderCommunity(); }).catch(function (e) { toast(e.message, 'err'); });
      });
    });
  }

  /* Talent portfolio */
  async function renderPortfolio() {
    crumb.textContent = 'Talent profile';
    var d = await api('/api/me/portfolio');
    var p = d.portfolio || {};
    var lock = !d.hasCertificate ? '<div class="empty-state">Talent profiles are for students who have earned a DEBONE certificate. Complete a course to unlock yours.</div>' : '';
    setView(head('Get hired', 'Talent profile', 'Show your work to customers. Our team checks each profile before it is published.') + lock +
      (d.hasCertificate ? '<section class="panel"><form class="fm-form tp-form" id="tp-form"><div class="field"><label>Headline</label><input class="input" name="headline" maxlength="120" value="' + esc(p.headline || '') + '" placeholder="e.g. Video editor for brands"></div>' +
        '<div class="field"><label>About you</label><textarea class="input" name="bio" rows="4" maxlength="800">' + esc(p.bio || '') + '</textarea></div>' +
        '<div class="field"><label>Skills (comma separated)</label><input class="input" name="skills" maxlength="400" value="' + esc((p.skills || []).join(', ')) + '"></div>' +
        '<div class="field"><label>Link to your best work</label><input class="input" name="workUrl" type="url" maxlength="300" value="' + esc(p.workUrl || '') + '" placeholder="https://"></div>' +
        '<p class="muted small">Status: <span class="gpill ' + (p.status === 'approved' ? 'pass' : p.status === 'rejected' ? 'fail' : 'none') + '">' + esc(p.status || 'not submitted') + '</span></p>' +
        '<p class="form-error" id="tp-err" role="alert"></p><div class="btn-row"><button class="btn btn-solid" type="submit">Save and send for approval</button></div></form></section>' : ''));
    var form = document.getElementById('tp-form');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = function (n) { return form.elements[n].value.trim(); };
      api('/api/me/portfolio', { method: 'POST', body: { headline: v('headline'), bio: v('bio'), skills: v('skills'), workUrl: v('workUrl') } })
        .then(function (res) { toast(res.message); renderPortfolio(); }).catch(function (err) { document.getElementById('tp-err').textContent = err.message; });
    });
  }

  var old = window.DashExtras && window.DashExtras.render;
  window.DashExtras = Object.assign(window.DashExtras || {}, {
    render: function (name, arg) {
      if (name === 'downloads') return renderDownloads();
      if (name === 'requests') return renderRequests();
      if (name === 'referrals') return renderReferrals();
      if (name === 'community') return renderCommunity();
      if (name === 'portfolio') return renderPortfolio();
      return old ? old(name, arg) : undefined;
    }
  });
})();
