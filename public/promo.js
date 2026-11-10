/* Newsletter pop-up with a 30% coupon (v26). The coupon appears only after the visitor subscribes. */
(function () {
  'use strict';
  if (localStorage.getItem('debone-promo-off') === '1') return;
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var TITLE = 'Get 30% off your first course';

  function words(text) {
    return text.split(' ').map(function (w, i) {
      return '<span class="w"><i style="--d:' + i + '">' + esc(w) + '</i></span>';
    }).join(' ');
  }

  function confetti(host) {
    var colours = ['#E0A800', '#F4F4F0', '#F2BE1A', '#9B9B95'];
    for (var i = 0; i < 26; i++) {
      var p = document.createElement('i');
      p.className = 'pm-confetti';
      p.style.left = (50 + (Math.random() - 0.5) * 50) + '%';
      p.style.background = colours[i % colours.length];
      p.style.setProperty('--dx', ((Math.random() - 0.5) * 320).toFixed(0) + 'px');
      p.style.setProperty('--rot', ((Math.random() - 0.5) * 720).toFixed(0) + 'deg');
      p.style.animationDelay = (Math.random() * 0.15).toFixed(2) + 's';
      host.appendChild(p);
      setTimeout(function (el) { el.remove(); }.bind(null, p), 1700);
    }
  }

  function markup() {
    return '<div class="nl">' +
      '<div class="nl-media">' +
        '<img src="https://assets.mixkit.co/videos/44068/44068-thumb-720-0.jpg" alt="">' +
        '<span class="nl-cap">AI Video Creation</span>' +
        '<span class="nl-badge"><b>30%</b><small>OFF</small></span>' +
      '</div>' +
      '<div class="nl-body">' +
        '<p class="nl-eyebrow">Limited offer</p>' +
        '<h2 class="nl-title" aria-label="' + esc(TITLE) + '">' + words(TITLE) + '</h2>' +
        '<p class="nl-lead">Join the DEBONE newsletter for AI video training news, live class dates and student offers. Subscribe and your 30% coupon is ready straight away.</p>' +
        '<div class="nl-step" data-step="1">' +
          '<form class="nl-form" novalidate>' +
            '<label class="nl-label" for="nl-email">Email address</label>' +
            '<div class="nl-row"><input id="nl-email" class="nl-input" type="email" autocomplete="email" placeholder="you@example.com" required>' +
            '<button class="nl-btn" type="submit">Subscribe</button></div>' +
            '<p class="nl-msg" role="status"></p>' +
          '</form>' +
        '</div>' +
        '<div class="nl-step" data-step="2" hidden>' +
          '<p class="nl-label">Your 30% coupon</p>' +
          '<div class="nl-coupon" id="nl-coupon"><span class="nl-code"></span>' +
            '<button type="button" class="nl-copy">Copy code</button></div>' +
          '<p class="nl-tip" aria-live="polite"></p>' +
          '<p class="nl-note">Enter this code when you enrol. It works on the account registered with this email.</p>' +
          '<a class="nl-signup-btn" href="signup.html" hidden>Sign up now</a>' +
        '</div>' +
        '<label class="nl-never"><input type="checkbox" id="nl-never"> Do not show this pop-up again</label>' +
      '</div>' +
    '</div>';
  }

  function show() {
    if (!window.DModal) return;
    DModal.open({
      size: 'promo', body: markup(),
      onMount: function (box) {
        var body = box.querySelector('.nl-body');
        requestAnimationFrame(function () { setTimeout(function () { body.classList.add('in'); }, 120); });
        var form = box.querySelector('.nl-form'), msg = box.querySelector('.nl-msg');
        var input = box.querySelector('#nl-email'), btn = form.querySelector('.nl-btn');
        var never = box.querySelector('#nl-never');
        never.addEventListener('change', function () {
          if (never.checked) localStorage.setItem('debone-promo-off', '1'); else localStorage.removeItem('debone-promo-off');
        });
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var email = input.value.trim();
          msg.className = 'nl-msg';
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = 'Please enter a valid email address.'; msg.classList.add('err'); input.focus(); return; }
          btn.disabled = true; btn.textContent = 'Subscribing…';
          fetch('/api/newsletter', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email }) })
            .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
            .then(function (res) {
              if (!res.ok) throw new Error(res.d.error || 'Something went wrong. Please try again.');
              if (!res.d.coupon) { msg.textContent = 'This email has already used its coupon. Log in to continue.'; msg.classList.add('err'); return; }
              reveal(box, res.d.coupon);
            })
            .catch(function (err) { msg.textContent = err.message; msg.classList.add('err'); })
            .then(function () { btn.disabled = false; btn.textContent = 'Subscribe'; });
        });
      }
    });
  }

  function reveal(box, code) {
    var s1 = box.querySelector('[data-step="1"]'), s2 = box.querySelector('[data-step="2"]');
    s1.style.transition = 'opacity .35s, transform .35s';
    s1.style.opacity = '0'; s1.style.transform = 'translateY(-10px)';
    setTimeout(function () {
      s1.hidden = true; s2.hidden = false;
      s2.style.opacity = '0'; s2.style.transform = 'translateY(14px)';
      box.querySelector('.nl-code').innerHTML = code.split('').map(function (ch, i) {
        return '<span class="nl-ch" style="--d:' + i + '">' + esc(ch) + '</span>';
      }).join('');
      requestAnimationFrame(function () {
        s2.style.transition = 'opacity .6s ease, transform .7s cubic-bezier(.2,.8,.2,1)';
        s2.style.opacity = '1'; s2.style.transform = 'none';
      });
      confetti(box.querySelector('.nl-body'));
    }, 360);
    var copy = box.querySelector('.nl-copy'), tip = box.querySelector('.nl-tip');
    copy.addEventListener('click', function () {
      var done = function () {
        tip.textContent = 'Copied to clipboard';
        var c = box.querySelector('#nl-coupon');
        c.classList.remove('nl-flash'); void c.offsetWidth; c.classList.add('nl-flash');
        clearTimeout(tip._t); tip._t = setTimeout(function () { tip.textContent = ''; }, 2200);
        var su = box.querySelector('.nl-signup-btn');
        su.hidden = false; su.classList.remove('nl-pop'); void su.offsetWidth; su.classList.add('nl-pop');
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, done);
      else { var ta = document.createElement('textarea'); ta.value = code; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove(); done(); }
    });
  }

  setTimeout(show, 5000);
})();
