(function () {
  'use strict';
  function post(url, body) {
    return fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, data: d }; }); });
  }
  var fp = document.getElementById('forgot-form');
  if (fp) {
    fp.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = document.getElementById('fp-email').value.trim();
      var err = document.getElementById('fp-error'), ok = document.getElementById('fp-ok'), btn = document.getElementById('fp-submit');
      err.textContent = ''; ok.textContent = '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'Please enter a valid email address.'; return; }
      btn.disabled = true; btn.textContent = 'Sending…';
      post('/api/auth/forgot', { email: email }).then(function (res) {
        if (!res.ok) throw new Error(res.data.error || 'Something went wrong. Please try again.');
        ok.textContent = res.data.message;
        fp.reset();
      }).catch(function (ex) { err.textContent = ex.message; })
        .then(function () { btn.disabled = false; btn.textContent = 'Send reset link'; });
    });
  }
  var rp = document.getElementById('reset-form');
  if (rp) {
    var token = decodeURIComponent((location.hash || '').replace(/^#/, ''));
    rp.addEventListener('submit', function (e) {
      e.preventDefault();
      var pass = document.getElementById('rp-pass').value, confirm = document.getElementById('rp-confirm').value;
      var err = document.getElementById('rp-error'), ok = document.getElementById('rp-ok'), btn = document.getElementById('rp-submit');
      err.textContent = ''; ok.textContent = '';
      if (!token) { err.textContent = 'This link is incomplete. Please open the link from your email again.'; return; }
      if (pass.length < 8) { err.textContent = 'Password must be at least 8 characters.'; return; }
      if (pass !== confirm) { err.textContent = 'The two passwords do not match.'; return; }
      btn.disabled = true; btn.textContent = 'Saving…';
      post('/api/auth/reset', { token: token, password: pass }).then(function (res) {
        if (!res.ok) throw new Error(res.data.error || 'Something went wrong. Please try again.');
        ok.innerHTML = 'Your password has been changed. <a href="academy.html">Log in with your new password</a>.';
        rp.reset();
      }).catch(function (ex) { err.textContent = ex.message; })
        .then(function () { btn.disabled = false; btn.textContent = 'Save new password'; });
    });
  }
})();
