(function () {
  'use strict';
  var form = document.getElementById('staff-form');
  var err = document.getElementById('staff-error');
  var btn = document.getElementById('staff-submit');

  // Already signed in as staff? Go straight to the panel.
  fetch('/api/staff/me', { credentials: 'same-origin' }).then(function (r) {
    if (r.ok) location.replace('admin.html#overview');
  }).catch(function () {});

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    err.textContent = '';
    var email = document.getElementById('email').value.trim();
    var password = document.getElementById('password').value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'Please enter a valid email address.'; return; }
    if (!password) { err.textContent = 'Please enter your password.'; return; }
    var label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Checking…';
    try {
      var res = await fetch('/api/staff/login', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'Login failed. Please try again.');
      btn.textContent = 'Opening admin…';
      location.href = 'admin.html#overview';
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false; btn.textContent = label;
    }
  });
})();
