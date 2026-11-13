/* Bank transfer payment page (v42): bank details, "I have made the transfer", receipt upload, live status. */
(function () {
  'use strict';
  var params = new URLSearchParams(location.search);
  var orderId = params.get('order') || '';
  var token = params.get('token') || '';
  var box = { amount: document.getElementById('pay-total'), item: document.getElementById('pay-item'), ref: document.getElementById('pay-ref'),
    banks: document.getElementById('pay-banks'), action: document.getElementById('pay-action'), steps: document.getElementById('pay-steps'),
    eyebrow: document.getElementById('pay-eyebrow'), lead: document.getElementById('pay-lead'), crumb: document.getElementById('pay-crumb') };
  var timer = null, lastStatus = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function naira(n) { return '₦' + Number(n || 0).toLocaleString('en-US'); }
  function qs(extra) { var p = []; if (token) p.push('token=' + encodeURIComponent(token)); return p.concat(extra || []).length ? '?' + p.concat(extra || []).join('&') : ''; }
  function api(url, opts) {
    opts = opts || {};
    var init = { method: opts.method || 'GET', credentials: 'same-origin', headers: {} };
    if (opts.body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    return fetch(url, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.status === 401) { location.replace('login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search)); throw new Error('Please log in.'); }
        if (!r.ok) throw new Error(d.error || 'Something went wrong. Please try again.');
        return d;
      });
    });
  }
  function toast(t, tone) { if (window.DModal) DModal.toast({ title: t, tone: tone || 'ok' }); }

  function stepFor(status) { return { awaiting_transfer: 1, awaiting_proof: 2, proof_uploaded: 3, rejected: 3, approved: 4 }[status] || 1; }
  function paintSteps(status) {
    var n = stepFor(status);
    Array.prototype.forEach.call(box.steps.children, function (li, i) {
      li.classList.toggle('done', i + 1 < n || status === 'approved');
      li.classList.toggle('on', i + 1 === n);
      li.classList.toggle('bad', status === 'rejected' && i + 1 === 3);
    });
  }

  function paintBanks(o) {
    box.banks.innerHTML = (o.bankAccounts || []).map(function (b, i) {
      return '<article class="bank-card" style="--i:' + i + '"><div class="bank-top"><span class="bank-chip">' + esc(b.bank) + '</span><span class="bank-logo">' + esc((b.bank || '•').charAt(0)) + '</span></div>' +
        '<p class="bank-label">Account number</p><div class="bank-num"><code id="bn-' + i + '">' + esc(b.number) + '</code>' +
        '<button type="button" class="pay-copy" data-copy="bn-' + i + '">Copy</button></div>' +
        '<p class="bank-name">' + esc(b.name) + '</p></article>';
    }).join('');
    bindCopy(box.banks);
  }

  function bindCopy(scope) {
    (scope || document).querySelectorAll('[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var el = document.getElementById(btn.getAttribute('data-copy'));
        var text = el.textContent.trim();
        var done = function () { btn.textContent = 'Copied ✓'; btn.classList.add('copied'); setTimeout(function () { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1800); };
        if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () { window.prompt('Copy this:', text); });
        else window.prompt('Copy this:', text);
      });
    });
  }

  function dropzone(label) {
    return '<form class="pay-drop" id="pay-form" novalidate>' +
      '<label class="pay-drop-zone" id="pay-zone"><input type="file" id="pay-file" accept="image/jpeg,image/png,image/webp,application/pdf">' +
        '<span class="pay-drop-ico"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg></span>' +
        '<b>' + esc(label) + '</b><span class="muted small">Drop your receipt here, or tap to choose. JPG, PNG, WebP or PDF, up to 3 MB.</span>' +
        '<span class="pay-preview" id="pay-preview" hidden></span></label>' +
      '<p class="form-error" id="pay-err" role="alert"></p>' +
      '<div class="pay-actions"><button class="btn btn-solid" type="submit" id="pay-send" disabled>Send receipt</button></div></form>';
  }

  function bindDrop() {
    var zone = document.getElementById('pay-zone'), input = document.getElementById('pay-file'), prev = document.getElementById('pay-preview'), send = document.getElementById('pay-send'), form = document.getElementById('pay-form'), file = null;
    function show(f) {
      file = f; send.disabled = false; prev.hidden = false;
      if (f.type.indexOf('image/') === 0) { var url = URL.createObjectURL(f); prev.innerHTML = '<img src="' + url + '" alt="Receipt preview">'; }
      else prev.innerHTML = '<span class="pay-pdf">PDF</span><span>' + esc(f.name) + '</span>';
      zone.classList.add('has-file');
    }
    input.addEventListener('change', function () { if (input.files[0]) show(input.files[0]); });
    ['dragenter', 'dragover'].forEach(function (ev) { zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove('over'); }); });
    zone.addEventListener('drop', function (e) { if (e.dataTransfer.files[0]) show(e.dataTransfer.files[0]); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = document.getElementById('pay-err');
      if (!file) return;
      if (file.size > 3 * 1024 * 1024) { err.textContent = 'The file is larger than 3 MB. Choose a smaller photo or PDF.'; return; }
      err.textContent = '';
      send.disabled = true; send.classList.add('sending'); send.textContent = 'Sending…';
      var reader = new FileReader();
      reader.onload = function () {
        api('/api/orders/' + encodeURIComponent(orderId) + '/proof' + qs(), { method: 'POST', body: { dataUrl: reader.result, name: file.name } })
          .then(function (res) { toast(res.message); load(); })
          .catch(function (ex) { err.textContent = ex.message; send.disabled = false; send.classList.remove('sending'); send.textContent = 'Send receipt'; });
      };
      reader.readAsDataURL(file);
    });
  }

  function render(o) {
    lastStatus = o.status;
    box.amount.textContent = naira(o.amount);
    box.item.textContent = o.item;
    box.ref.textContent = o.reference;
    box.crumb.textContent = o.item;
    paintSteps(o.status);
    paintBanks(o);
    var a = box.action;
    if (o.status === 'awaiting_transfer') {
      box.eyebrow.textContent = 'Step 1 of 4';
      box.lead.textContent = 'Send the exact amount to one of the accounts above, then tell us you have made the transfer.';
      a.innerHTML = '<div class="pay-cta"><button class="btn btn-solid btn-lg" type="button" id="pay-made">I have made the transfer</button><p class="muted small">Press this only after you have sent the money.</p></div>';
      document.getElementById('pay-made').addEventListener('click', function () {
        this.disabled = true;
        api('/api/orders/' + encodeURIComponent(orderId) + '/transfer-made' + qs(), { method: 'POST', body: {} }).then(load).catch(function (ex) { toast(ex.message, 'err'); });
      });
    } else if (o.status === 'awaiting_proof' || o.status === 'rejected') {
      box.eyebrow.textContent = o.status === 'rejected' ? 'Receipt needs attention' : 'Step 3 of 4';
      box.lead.textContent = o.status === 'rejected' ? 'Please upload a clear receipt again.' : 'Now upload a photo or PDF of your receipt so we can confirm your payment.';
      a.innerHTML = (o.status === 'rejected' ? '<div class="pay-reject"><b>Why it was not accepted</b><p>' + esc(o.rejectReason) + '</p></div>' : '') + '<div class="pay-card pay-upload"><p class="eyebrow">Upload your receipt</p>' + dropzone('Choose your receipt') + '</div>';
      bindDrop();
    } else if (o.status === 'proof_uploaded') {
      box.eyebrow.textContent = 'Step 3 of 4';
      box.lead.textContent = 'Thank you. Your receipt is with our team. This page updates by itself when we confirm it.';
      a.innerHTML = '<div class="pay-review"><span class="pay-pulse"></span><div><b>Receipt received</b><p class="muted">' + esc(o.proofName || 'Your receipt') + ' is waiting for confirmation.</p></div></div>';
    } else if (o.status === 'approved') {
      var isProduct = o.kind === 'product';
      box.eyebrow.textContent = 'Step 4 of 4';
      box.lead.textContent = isProduct ? 'Payment confirmed. Your file is ready to download.' : 'Payment confirmed. Your course is now open.';
      var go = isProduct ? 'dashboard.html#downloads' : (o.courseId ? 'dashboard.html#course/' + encodeURIComponent(o.courseId) : 'dashboard.html#payments');
      a.innerHTML = '<div class="pay-done"><span class="pay-tick"></span><h2>' + (isProduct ? 'Payment confirmed' : 'You are in') + '</h2><p class="muted">' + (isProduct ? 'Taking you to your downloads.' : 'Welcome to DEBONE. Your access is ready.') + '</p><a class="btn btn-solid btn-lg" href="' + go + '">' + (isProduct ? 'Go to my downloads' : 'Open my course') + '</a></div>';
      if (isProduct) productSuccess(o); else burst();
    }
  }

  /* Digital product paid: celebrate, then take the buyer straight to Downloads in the student dashboard */
  var popupShown = false;
  var DOWNLOADS_URL = 'dashboard.html#downloads';
  function productSuccess(o) {
    if (popupShown) return; popupShown = true;
    try { sessionStorage.setItem('debone-new-download', String(Date.now())); } catch (e) { /* private mode */ }
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var SECONDS = 6, timer = null, leaving = false;
    var ov = document.createElement('div');
    ov.className = 'ps-overlay'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'ps-title');
    ov.innerHTML = '<div class="ps-card"><div class="ps-inner">' +
      '<div class="ps-badge" aria-hidden="true"><i></i><i></i><i></i><svg viewBox="0 0 100 100"><circle class="ps-circle" cx="50" cy="50" r="46"/><path class="ps-check" d="M29 52l15 15 28-32"/></svg></div>' +
      '<p class="ps-eyebrow">Payment confirmed</p>' +
      '<h2 class="ps-title" id="ps-title">Thank you!</h2>' +
      '<p class="ps-sub">Your purchase is complete and your file is now waiting in your student dashboard.</p>' +
      '<div class="ps-file"><span class="ps-file-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 11l5 5 5-5M4 20h16"/></svg></span>' +
        '<span class="ps-file-txt"><b>' + esc(o.item) + '</b><span>Ready to download</span></span><span class="ps-file-amt">' + naira(o.amount) + '</span></div>' +
      '<div class="ps-go"><a class="btn btn-solid btn-lg" id="ps-open" href="' + DOWNLOADS_URL + '">Go to my downloads</a>' +
        '<div class="ps-bar" id="ps-bar" style="--ps-t:' + SECONDS + 's" aria-hidden="true"><b></b></div>' +
        '<p class="ps-note" id="ps-note">Opening your downloads automatically…</p>' +
        '<button type="button" class="ps-stay" id="ps-stay">Stay on this page</button></div>' +
    '</div></div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function () { requestAnimationFrame(function () { ov.classList.add('in'); }); });
    document.getElementById('ps-open').focus({ preventScroll: true });
    if (!reduce) setTimeout(sparks, 700);
    if (navigator.vibrate) { try { navigator.vibrate([18, 40, 18]); } catch (e) { /* not supported */ } }

    function leave() {
      if (leaving) return; leaving = true; clearTimeout(timer);
      ov.classList.add('out');
      setTimeout(function () { location.href = DOWNLOADS_URL; }, reduce ? 0 : 260);
    }
    document.getElementById('ps-open').addEventListener('click', function (e) { e.preventDefault(); leave(); });
    document.getElementById('ps-stay').addEventListener('click', function () {
      clearTimeout(timer); document.getElementById('ps-bar').classList.add('stopped'); document.getElementById('ps-bar').style.opacity = '.25';
      document.getElementById('ps-note').textContent = 'Your file is always in Downloads in your dashboard.'; this.remove();
    });
    timer = setTimeout(leave, (SECONDS + 1.5) * 1000);
  }
  function sparks() {
    var cols = ['#E0A800', '#F7D35C', '#6BCB77', '#F4F4F0', '#FFB84D'];
    var cx = innerWidth / 2, cy = Math.min(innerHeight * 0.3, 260);
    for (var i = 0; i < 70; i++) {
      var p = document.createElement('i'); p.className = 'ps-spark';
      var ang = Math.random() * Math.PI * 2, force = 120 + Math.random() * 260;
      p.style.left = cx + 'px'; p.style.top = cy + 'px'; p.style.background = cols[i % cols.length];
      if (i % 3 === 0) p.style.borderRadius = '50%';
      p.style.setProperty('--dx', Math.cos(ang) * force + 'px'); p.style.setProperty('--dy', Math.sin(ang) * force * 0.8 - 80 + 'px'); p.style.setProperty('--rot', (Math.random() * 900 - 450) + 'deg');
      p.style.animationDelay = (Math.random() * 0.25) + 's';
      document.body.appendChild(p); setTimeout(function (n) { return function () { n.remove(); }; }(p), 2400);
    }
  }

  function burst() {
    var cols = ['#E0A800', '#F7D35C', '#6BCB77', '#F4F4F0'];
    for (var i = 0; i < 40; i++) {
      var p = document.createElement('i'); p.className = 'confetti';
      p.style.left = (Math.random() * 100) + 'vw'; p.style.top = '40vh'; p.style.background = cols[i % 4];
      p.style.setProperty('--dx', (Math.random() * 300 - 150) + 'px'); p.style.setProperty('--dy', (-Math.random() * 260 - 80) + 'px'); p.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
      document.body.appendChild(p); setTimeout(function (n) { return function () { n.remove(); }; }(p), 1500);
    }
  }

  function load() {
    if (!orderId) { box.action.innerHTML = '<div class="empty-state">Open this page from your enrolment or checkout.</div>'; return; }
    api('/api/orders/' + encodeURIComponent(orderId) + qs()).then(function (d) { render(d.order); schedule(d.order); })
      .catch(function (ex) { box.action.innerHTML = '<div class="empty-state">' + esc(ex.message) + '</div>'; });
  }
  function schedule(o) {
    clearTimeout(timer);
    if (o.status === 'proof_uploaded') timer = setTimeout(load, 15000);
  }
  load();
})();
