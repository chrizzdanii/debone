(function () {
  'use strict';
  var params = new URLSearchParams(location.search);
  var next = params.get('next') === 'admin' ? 'staff-login.html' : 'dashboard.html';
  var $ = function (id) { return document.getElementById(id); };
  var REF_KEY = 'debone-ref', ref = (params.get('ref') || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
  try { if (ref) localStorage.setItem(REF_KEY, ref); else ref = localStorage.getItem(REF_KEY) || ''; } catch (e) {}
  var form = $('lg-form'), alertBox = $('lg-alert'), submit = $('lg-submit');
  if (ref) { var g = $('lg-google'); if (g) g.setAttribute('href', '/api/auth/google?ref=' + encodeURIComponent(ref)); }

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
  if (params.get('error') === 'google') showAlert('Google sign-up is not available right now. Please use the form.');

  fetch('/api/me', { credentials: 'same-origin' }).then(function (r) { if (r.ok) location.replace(next); }).catch(function () {});

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    showAlert('');
    var name = $('lg-name').value.trim();
    var email = $('lg-email').value.trim();
    var pass = $('lg-pass').value;
    if (name.length < 2) { showAlert('Please enter your full name.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showAlert('Please enter a valid email address.'); return; }
    if (pass.length < 8) { showAlert('Your password must be at least 8 characters.'); return; }
    var label = submit.textContent;
    submit.disabled = true; submit.textContent = 'Creating your account…';
    try {
      var res = await fetch('/api/auth/signup', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: $('lg-name').value.trim(), email: email, phone: $('lg-phone').value.trim(), password: pass, referralCode: ref }) });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      try { localStorage.removeItem(REF_KEY); } catch (e) {}
      showAlert('Account created. Opening your dashboard…', true);
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
