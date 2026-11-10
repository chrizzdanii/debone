(function () {
  'use strict';
  var params = new URLSearchParams(location.search);
  var next = params.get('next') === 'admin' ? 'staff-login.html' : 'dashboard.html';
  var $ = function (id) { return document.getElementById(id); };
  var form = $('lg-form'), alertBox = $('lg-alert'), submit = $('lg-submit');

  function showAlert(msg, ok) {
    alertBox.textContent = msg;
    alertBox.className = 'lg-alert' + (ok ? ' ok' : '');
    alertBox.hidden = !msg;
  }
  $('lg-eye').addEventListener('click', function () {
    var pw = $('lg-pass'), show = pw.type === 'password';
    pw.type = show ? 'text' : 'password';
    this.setAttribute('aria-pressed', String(show));
    this.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });
  function syncGoogle() {
    $('lg-google').setAttribute('href', '/api/auth/google' + ($('lg-remember').checked ? '?remember=1' : ''));
  }
  $('lg-remember').addEventListener('change', syncGoogle);
  syncGoogle();
  if (params.get('error') === 'google') showAlert('Google sign-in is not available right now. Please use your email and password.');

  fetch('/api/me', { credentials: 'same-origin' }).then(function (r) { if (r.ok) location.replace(next); }).catch(function () {});

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    showAlert('');
    var email = $('lg-email').value.trim();
    var pass = $('lg-pass').value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showAlert('Please enter a valid email address.'); return; }
    if (pass.length < 8) { showAlert('Your password must be at least 8 characters.'); return; }
    var label = submit.textContent;
    submit.disabled = true; submit.textContent = 'Logging you in…';
    try {
      var res = await fetch('/api/auth/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: pass, remember: $('lg-remember').checked }) });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      showAlert('Welcome back. Opening your dashboard…', true);
      location.href = next;
    } catch (err) {
      showAlert(err.message);
      submit.disabled = false; submit.textContent = label;
    }
  });
  testimonials();
  function testimonials() {
    fetch('/data/academy-testimonials.json').then(function (r) { return r.json(); }).then(function (d) {
      var list = (d.testimonials || []).filter(function (t) { return t.text && t.text.length < 260; });
      if (!list.length) return;
      var i = Math.floor(Math.random() * list.length), card = $('lg-card');
      function show() { var t = list[i]; $('lg-quote').textContent = '“' + t.text + '”'; $('lg-by').textContent = t.name + (t.country ? ' · ' + t.country : ''); }
      show();
      if (list.length > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setInterval(function () { card.classList.add('swap'); setTimeout(function () { i = (i + 1) % list.length; show(); card.classList.remove('swap'); }, 600); }, 7000);
      }
    }).catch(function () {});
  }
})();
