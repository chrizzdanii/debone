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
      if (r.status === 401) { location.replace('/401.html'); throw new Error('Please log in.'); }
      return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Something went wrong.'); return d; });
    });
  }
  function toast(t, tone) { if (window.DModal) DModal.toast({ title: t, tone: tone || 'ok' }); }
  function head(eyebrow, title, sub) { return '<header class="view-head"><p class="eyebrow">' + esc(eyebrow) + '</p><h1>' + esc(title) + '</h1>' + (sub ? '<p class="muted">' + esc(sub) + '</p>' : '') + '</header>'; }
  function setView(html) {
    if (window.DLive && DLive.silent && /class="skeleton"/.test(html)) return; view.innerHTML = html; view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter'); }

  /* Downloads: a clean library of everything the student has bought */
  var DL_ICON = {
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/></svg>'
  };
  function dlCountUp(root) {
    root.querySelectorAll('[data-count]').forEach(function (el) {
      var to = Number(el.getAttribute('data-count')) || 0, t0 = null;
      if (!to || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = to; return; }
      (function f(ts) { if (!t0) t0 = ts; var p = Math.min(1, (ts - t0) / 900); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(f); })(performance.now());
    });
  }
  async function renderDownloads() {
    crumb.textContent = 'Downloads';
    var d = await api('/api/me/downloads');
    var list = (d.downloads || []).slice().sort(function (a, b) { return new Date(b.purchasedAt) - new Date(a.purchasedAt); });
    var fresh = 0;
    try { fresh = Number(sessionStorage.getItem('debone-new-download')) || 0; sessionStorage.removeItem('debone-new-download'); } catch (e) { /* private mode */ }
    var freshId = fresh && list.length && (Date.now() - fresh < 10 * 60 * 1000) ? list[0].id : null;
    var ready = list.filter(function (x) { return x.available; }).length;
    var left = list.reduce(function (t, x) { return t + (x.available ? x.downloadsLeft : 0); }, 0);

    var hero = '<section class="dl-hero"><div class="dl-hero-txt"><p class="eyebrow">Your files</p><h1>Downloads</h1>' +
      '<p class="muted">Everything you have bought, ready to save to your device. Each file can be downloaded up to <b>' + d.limit + '</b> times and stays available for a set period.</p></div>' +
      '<div class="dl-stats"><div class="dl-stat"><span class="dl-stat-ico">' + DL_ICON.box + '</span><b data-count="' + list.length + '">0</b><small>Purchased</small></div>' +
      '<div class="dl-stat"><span class="dl-stat-ico ok">' + DL_ICON.check + '</span><b data-count="' + ready + '">0</b><small>Ready now</small></div>' +
      '<div class="dl-stat"><span class="dl-stat-ico">' + DL_ICON.down + '</span><b data-count="' + left + '">0</b><small>Downloads left</small></div></div></section>';

    var cards = list.map(function (x, i) {
      var daysLeft = Math.ceil((new Date(x.expiresAt).getTime() - Date.now()) / 86400000);
      var reasonText = { expired: 'Expired', limit: 'Limit reached', 'not ready': 'Not ready yet' }[x.reason] || 'Unavailable';
      var pill = x.available ? '<span class="dl-pill ok"><i></i>Ready</span>' : '<span class="dl-pill bad">' + esc(reasonText) + '</span>';
      var fmts = String(x.formats || '').split(/[,/|·]+/).map(function (f) { return f.trim(); }).filter(Boolean).slice(0, 3);
      var tag = fmts.length ? fmts[0].toUpperCase().slice(0, 5) : 'FILE';
      var segs = '';
      for (var k = 0; k < d.limit; k++) segs += '<i class="' + (k < x.downloadsUsed ? 'used' : '') + '" style="--k:' + k + '"></i>';
      var expTxt = !x.expiresAt ? '' : (daysLeft > 0 ? (daysLeft <= 14 ? '<b class="warn">' + daysLeft + ' day' + (daysLeft === 1 ? '' : 's') + ' left</b>' : 'Until ' + esc(fmt(x.expiresAt))) : 'Expired ' + esc(fmt(x.expiresAt)));
      var action = x.available
        ? '<a class="dl-btn" href="/api/downloads/' + encodeURIComponent(x.id) + '" data-dl><span class="dl-btn-ico">' + DL_ICON.down + '</span><span class="dl-btn-txt">Download file</span></a>'
        : '<a class="dl-btn off" href="contact.html">Contact us for help</a>';
      return '<article class="dl-card' + (x.id === freshId ? ' is-new' : '') + (x.available ? '' : ' is-off') + '" style="--i:' + i + '">' +
        (x.id === freshId ? '<span class="dl-new">New</span>' : '') +
        '<div class="dl-top"><div class="dl-file"><span class="dl-file-ico">' + DL_ICON.file + '</span><em>' + esc(tag) + '</em></div>' + pill + '</div>' +
        '<h3>' + esc(x.title) + '</h3>' +
        '<p class="dl-by">' + (x.author ? 'By ' + esc(x.author) : 'DEBONE Digital') + '</p>' +
        (fmts.length ? '<div class="dl-fmts">' + fmts.map(function (f) { return '<span>' + esc(f) + '</span>'; }).join('') + '</div>' : '') +
        '<div class="dl-meter"><div class="dl-meter-top"><span>Downloads used</span><b>' + x.downloadsUsed + ' of ' + d.limit + '</b></div><div class="dl-segs" role="img" aria-label="' + x.downloadsUsed + ' of ' + d.limit + ' downloads used">' + segs + '</div></div>' +
        '<div class="dl-meta"><span>' + DL_ICON.clock + (expTxt || 'No expiry') + '</span><span>Bought ' + esc(fmt(x.purchasedAt)) + '</span></div>' +
        action + '</article>';
    }).join('');

    var empty = '<div class="dl-empty"><span class="dl-empty-ico">' + DL_ICON.bag + '</span><h3>Your library is empty</h3><p>When you buy an eBook, template pack or guide from the store, it appears here ready to download.</p><a class="dl-btn" href="store.html"><span class="dl-btn-txt">Browse the digital store</span></a></div>';

    setView(hero + (list.length ? '<div class="dl-grid">' + cards + '</div>' : empty) +
      '<p class="dl-help">Trouble with a file? <a href="contact.html">Contact support</a> or message us on <a href="https://wa.me/2348035988889" target="_blank" rel="noopener">WhatsApp</a>.</p>');
    dlCountUp(view);
    var newCard = view.querySelector('.dl-card.is-new');
    if (newCard) setTimeout(function () { try { newCard.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { /* old browser */ } }, 650);
    view.querySelectorAll('[data-dl]').forEach(function (a) {
      a.addEventListener('click', function () {
        if (a.classList.contains('busy')) return;
        a.classList.add('busy'); a.querySelector('.dl-btn-txt').textContent = 'Starting your download…';
        setTimeout(function () { if (/^#downloads/.test(location.hash)) renderDownloads().catch(function () {}); }, 3200);
      });
    });
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
