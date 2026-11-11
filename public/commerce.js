/* Store, bundles, talent, challenges, studio booking and quotations (v32). */
(function () {
  'use strict';
  var page = document.body.getAttribute('data-page');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function naira(n) { return '₦' + Number(n || 0).toLocaleString('en-US'); }
  function req(url, opts) {
    opts = opts || {};
    return fetch(url, { method: opts.method || 'GET', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) { var e = new Error(d.error || 'Something went wrong. Please try again.'); e.status = r.status; throw e; } return d; }); });
  }
  function toast(t, tone) { if (window.DModal) DModal.toast({ title: t, tone: tone || 'ok' }); }
  function goLogin(next) { location.href = 'login.html?next=' + encodeURIComponent(next); }

  /* Digital store */
  if (page === 'store') {
    req('/api/store').then(function (d) {
      var list = d.products || [];
      $('st-grid').innerHTML = list.map(function (p, i) {
        return '<article class="st-card" style="--i:' + i + '">' +
          '<div class="st-cover">' + (p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.title) + '" loading="lazy">' : '<span>' + esc(p.title) + '</span>') + '</div>' +
          '<div class="st-body"><p class="eyebrow">' + esc(p.category || 'Digital product') + '</p><h3>' + esc(p.title) + '</h3>' +
          '<p class="muted">' + esc(p.author ? 'By ' + p.author : '') + (p.pages ? ' · ' + p.pages + ' pages' : '') + (p.formats ? ' · ' + esc(p.formats) : '') + '</p>' +
          '<p>' + esc(p.description) + '</p>' +
          (p.toc && p.toc.length ? '<details class="st-toc"><summary>Table of contents</summary><ol>' + p.toc.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol></details>' : '') +
          '<div class="st-foot"><b>' + (p.price ? naira(p.price) : 'Free') + '</b>' +
          '<button class="btn btn-solid btn-sm" type="button" data-buy="' + esc(p.id) + '">' + (p.price ? 'Buy now' : 'Get it free') + '</button></div></div></article>';
      }).join('') || '<div class="empty-state">Our digital products are being prepared. Check back soon.</div>';
      $('st-grid').querySelectorAll('[data-buy]').forEach(function (b) {
        b.addEventListener('click', function () {
          b.disabled = true; b.textContent = 'Opening…';
          req('/api/store/' + encodeURIComponent(b.getAttribute('data-buy')) + '/buy', { method: 'POST', body: {} }).then(function (res) {
            if (res.order) { location.href = 'pay.html?order=' + encodeURIComponent(res.order.id); return; }
            if (res.free || res.alreadyOwned) { toast(res.free ? 'Added to your downloads.' : 'You already own this. See Downloads.'); location.href = 'dashboard.html#downloads'; return; }
          }).catch(function (e) { if (e.status === 401) return goLogin('store.html'); toast(e.message, 'err'); b.disabled = false; b.textContent = 'Buy now'; });
        });
      });
    }).catch(function () { $('st-grid').innerHTML = '<div class="empty-state">The store could not load. Please refresh.</div>'; });
  }

  /* Bundles */
  if (page === 'bundles') {
    req('/api/bundles').then(function (d) {
      var list = d.bundles || [];
      $('bd-list').innerHTML = list.map(function (b, i) {
        return '<article class="bd-card" style="--i:' + i + '"><div class="bd-img" style="background-image:url(\'' + (b.image || window.ACAD.img(i + 1)) + '\')"></div><div class="bd-head"><p class="eyebrow">Course bundle</p><h3>' + esc(b.title) + '</h3><p class="muted">' + esc(b.description) + '</p></div>' +
          '<ul class="bd-courses">' + b.courses.map(function (c) { return '<li><b>' + esc(c.title) + '</b><span>' + esc(c.startDate ? 'Starts ' + c.startDate : 'Start date to be announced') + (c.schedule ? ' · ' + esc(c.schedule) : '') + '</span></li>'; }).join('') + '</ul>' +
          '<div class="bd-foot"><b>' + naira(b.price) + '</b><button class="btn btn-solid" type="button" data-bundle="' + esc(b.id) + '">Buy the bundle</button></div></article>';
      }).join('') || '<div class="empty-state">No bundles are open yet. Individual courses are on the Digital Academy page.</div>';
      $('bd-list').querySelectorAll('[data-bundle]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          btn.disabled = true; btn.textContent = 'Opening…';
          req('/api/bundles/' + encodeURIComponent(btn.getAttribute('data-bundle')) + '/buy', { method: 'POST', body: {} }).then(function (res) {
            if (res.order) { location.href = 'pay.html?order=' + encodeURIComponent(res.order.id); return; }
            toast('You already have these courses.'); location.href = 'dashboard.html#courses';
          }).catch(function (e) { if (e.status === 401) return goLogin('bundles.html'); toast(e.message, 'err'); btn.disabled = false; btn.textContent = 'Buy the bundle'; });
        });
      });
    });
  }

  /* Talent directory */
  if (page === 'talent') {
    req('/api/talent').then(function (d) {
      $('tl-list').innerHTML = (d.talent || []).map(function (t, i) {
        return '<article class="tl-card" style="--i:' + i + '"><div class="tl-top"><span class="tl-avatar">' + esc(t.name.charAt(0)) + '</span><div><b>' + esc(t.name) + '</b>' + (t.verified ? '<span class="tl-badge">DEBONE certified</span>' : '') + '</div></div>' +
          '<h3>' + esc(t.headline) + '</h3><p>' + esc(t.bio || '') + '</p>' +
          '<div class="tl-skills">' + (t.skills || []).map(function (s) { return '<span>' + esc(s) + '</span>'; }).join('') + '</div>' +
          (t.workUrl ? '<a class="btn btn-ghost btn-sm" href="' + esc(t.workUrl) + '" target="_blank" rel="noopener">See their work</a>' : '') + '</article>';
      }).join('') || '<div class="empty-state">Our graduates will be listed here once their profiles are approved.</div>';
    });
  }

  /* Challenges */
  if (page === 'challenges') {
    req('/api/challenges').then(function (d) {
      var list = d.challenges || [];
      $('ch-list').innerHTML = list.map(function (c, i) {
        var status = c.open ? '<span class="gpill pass">Open until ' + esc(c.deadline) + '</span>' : '<span class="gpill none">Closed</span>';
        var win = c.winners.length ? '<div class="ch-win"><b>Winner</b> ' + c.winners.map(function (w) { return esc(w.name) + (w.link ? ' · <a href="' + esc(w.link) + '" target="_blank" rel="noopener">view entry</a>' : ''); }).join(', ') + '</div>' : '';
        var action = c.open ? (c.entered ? '<span class="gpill pass">You have entered</span>' : '<button class="btn btn-solid btn-sm" type="button" data-enter="' + esc(c.id) + '">Enter this challenge</button>') : '';
        return '<article class="ch-card" style="--i:' + i + '"><div class="ch-img" style="background-image:url(\'' + window.ACAD.img(i + 3) + '\')"></div><div class="ch-head">' + status + '<span class="muted">' + c.entries + ' entries</span></div>' +
          '<h3>' + esc(c.title) + '</h3><p>' + esc(c.description) + '</p><p class="muted small">' + esc(c.rules) + '</p>' + win + '<div class="ch-foot">' + action + '</div></article>';
      }).join('') || '<div class="empty-state">No challenges are running right now. Watch this page for the next one.</div>';
      $('ch-list').querySelectorAll('[data-enter]').forEach(function (b) {
        b.addEventListener('click', function () {
          var ask = window.DashPop ? DashPop.askText : null;
          if (!ask) return;
          ask({ eyebrow: 'Monthly challenge', title: 'Enter this challenge', submit: 'Submit entry', fields: [
            { name: 'link', label: 'Link to your work (Google Drive or YouTube)', placeholder: 'https://', type: 'url', max: 300, min: 8, error: 'Paste a link to your work.' },
            { name: 'note', label: 'A short note about your entry', multiline: true, optional: true, max: 400 } ] }).then(function (v) {
            if (!v) return;
            req('/api/challenges/' + encodeURIComponent(b.getAttribute('data-enter')) + '/enter', { method: 'POST', body: { link: v.link, note: v.note } })
            .then(function (res) { toast(res.message); b.replaceWith(Object.assign(document.createElement('span'), { className: 'gpill pass', textContent: 'You have entered' })); })
            .catch(function (e) { if (e.status === 401) return goLogin('challenges.html'); toast(e.message, 'err'); });
          });
        });
      });
    });
  }

  /* Studio booking */
  if (page === 'book') {
    var form = $('bk-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, msg = $('bk-msg'), btn = f.querySelector('button[type=submit]');
      msg.className = 'form-ok'; msg.textContent = '';
      var body = {}; ['name','email','phone','service','eventDate','location','description'].forEach(function (k) { body[k] = f.elements[k].value.trim(); });
      btn.disabled = true; btn.textContent = 'Sending request…';
      req('/api/bookings', { method: 'POST', body: body }).then(function (res) {
        msg.textContent = res.message + ' Keep this code: ' + res.token.slice(0, 8).toUpperCase(); f.reset();
      }).catch(function (err) { msg.className = 'form-error'; msg.textContent = err.message; })
        .then(function () { btn.disabled = false; btn.textContent = 'Request a quotation'; });
    });
  }

  /* Quotation: accept and pay the deposit */
  if (page === 'quote') {
    var token = new URLSearchParams(location.search).get('token') || '';
    var box = $('qt-box');
    function paint(d) {
      var b = d.booking;
      var steps = ['requested', 'quoted', 'accepted', 'deposit_paid', 'completed'];
      var idx = steps.indexOf(b.status);
      box.innerHTML = '<div class="qt-steps">' + ['Requested', 'Quoted', 'Accepted', 'Deposit paid', 'Completed'].map(function (s, i) {
        return '<span class="qt-step ' + (i <= idx ? 'on' : '') + '">' + s + '</span>';
      }).join('') + '</div>' +
        '<h2>' + esc(b.service) + '</h2><p class="muted">' + esc(b.eventDate || 'Date to be agreed') + (b.location ? ' · ' + esc(b.location) : '') + '</p>' +
        '<p>' + esc(b.description) + '</p>' +
        (b.quoteAmount ? '<div class="qt-amount"><div><span>Quotation</span><b>' + naira(b.quoteAmount) + '</b></div><div><span>Deposit (' + b.depositPercent + '%)</span><b>' + naira(b.depositAmount) + '</b></div></div>' : '<div class="empty-state">We are preparing your quotation. Check back soon or message us on WhatsApp.</div>') +
        '<div class="qt-actions" id="qt-actions"></div>';
      var act = $('qt-actions');
      if (b.status === 'quoted') act.innerHTML = '<button class="btn btn-solid" type="button" id="qt-accept">Accept this quotation</button>';
      else if (b.status === 'accepted' && !b.depositPaid) act.innerHTML = '<button class="btn btn-solid" type="button" id="qt-pay">Pay the deposit of ' + naira(b.depositAmount) + '</button>';
      else if (b.depositPaid) act.innerHTML = '<span class="gpill pass">Deposit received. Thank you.</span>';
      var acc = $('qt-accept');
      if (acc) acc.addEventListener('click', function () { req('/api/bookings/accept', { method: 'POST', body: { token: token } }).then(load).catch(function (e) { toast(e.message, 'err'); }); });
      var pay = $('qt-pay');
      if (pay) pay.addEventListener('click', function () { pay.disabled = true; req('/api/bookings/deposit', { method: 'POST', body: { token: token } }).then(function (r) { location.href = 'pay.html?order=' + encodeURIComponent(r.order.id) + '&token=' + encodeURIComponent(token); }).catch(function (e) { toast(e.message, 'err'); pay.disabled = false; }); });
    }
    function load() {
      if (!token) { box.innerHTML = '<div class="empty-state">Open the link from your quotation message.</div>'; return; }
      req('/api/bookings/by-token?token=' + encodeURIComponent(token)).then(paint).catch(function (e) { box.innerHTML = '<p class="muted">' + esc(e.message) + '</p>'; });
    }
    load();
  }
  /* Digital services enquiry */
  if (page === 'digital') {
    $('ds-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, msg = $('ds-msg'), btn = f.querySelector('button[type=submit]');
      msg.className = 'form-ok'; msg.textContent = '';
      var body = {}; ['name','email','phone','service','description'].forEach(function (k) { body[k] = f.elements[k].value.trim(); });
      btn.disabled = true; btn.textContent = 'Sending…';
      req('/api/bookings', { method: 'POST', body: body }).then(function (res) { msg.textContent = res.message; f.reset(); })
        .catch(function (err) { msg.className = 'form-error'; msg.textContent = err.message; })
        .then(function () { btn.disabled = false; btn.textContent = 'Request a quotation'; });
    });
  }

  /* Contact form: goes to the DEBONE team inbox */
  if (page === 'contact') {
    $('ct-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, msg = $('ct-msg'), btn = f.querySelector('button[type=submit]');
      msg.className = 'form-ok'; msg.textContent = '';
      var body = { name: f.name.value.trim(), email: f.email.value.trim(), category: 'Contact enquiry', message: f.message.value.trim() };
      btn.disabled = true; btn.textContent = 'Sending…';
      req('/api/feedback', { method: 'POST', body: body }).then(function (res) { msg.textContent = res.message; f.reset(); })
        .catch(function (err) { msg.className = 'form-error'; msg.textContent = err.message; })
        .then(function () { btn.disabled = false; btn.textContent = 'Send message'; });
    });
  }
})();
