/* DEBONE form system (v1): enhances every .fx-form and the contact / certificate pages. Works with the existing submit handlers. */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- Reveal on scroll ---------- */
  function reveal() {
    var items = $all('.fx-rv');
    if (!items.length) return;
    if (!('IntersectionObserver' in window) || reduce) { items.forEach(function (i) { i.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    items.forEach(function (i) { io.observe(i); });
    setTimeout(function () { items.forEach(function (i) { i.classList.add('in'); }); }, 3500);
  }

  /* ---------- Fields ---------- */
  function ctrlOf(field) { return field.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea'); }

  function upgrade(field) {
    if (field.classList.contains('fx-f')) return;
    var c = ctrlOf(field);
    if (!c || !field.querySelector('label')) return;
    field.classList.add('fx-f');
    var tag = c.tagName.toLowerCase();
    if (tag === 'textarea') field.classList.add('is-area');
    else if (tag === 'select') field.classList.add('is-select');
    else if (/^(date|time|datetime-local|month|week)$/.test(c.type)) field.classList.add('is-static');
    if (tag !== 'select' && !c.getAttribute('placeholder')) c.setAttribute('placeholder', ' ');
    var t = document.createElement('span'); t.className = 'fx-tick'; t.innerHTML = CHECK; field.appendChild(t);
  }

  function ensureParts(field) {
    var c = ctrlOf(field);
    if (!c) return;
    if (!field.querySelector('.fx-hint')) { var h = document.createElement('em'); h.className = 'fx-hint'; h.setAttribute('role', 'alert'); field.appendChild(h); }
    var max = parseInt(c.getAttribute('maxlength'), 10);
    if (c.tagName === 'TEXTAREA' && max && !field.querySelector('.fx-count')) {
      var n = document.createElement('span'); n.className = 'fx-count'; n.setAttribute('aria-hidden', 'true'); field.appendChild(n);
    }
  }

  function problem(c) {
    var v = (c.value || '').trim();
    if (c.hasAttribute('required') && !v) return c.getAttribute('data-msg') || (c.tagName === 'SELECT' ? 'Please choose an option.' : 'This field is required.');
    if (!v) return '';
    var min = parseInt(c.getAttribute('minlength'), 10);
    if (min && v.length < min) return 'Please enter at least ' + min + ' characters.';
    if (c.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter a valid email address, like you@example.com.';
    if (c.type === 'url') { try { var u = new URL(v); if (!/^https?:$/.test(u.protocol)) throw 0; } catch (e) { return 'Enter a full link that starts with https://'; } }
    if (c.type === 'tel' && v.replace(/[^\d]/g, '').length < 7) return 'Enter a valid phone number.';
    return '';
  }

  function sync(field, showErrors) {
    var c = ctrlOf(field);
    if (!c) return '';
    var has = (c.value || '').trim().length > 0;
    field.classList.toggle('filled', has);
    var msg = problem(c);
    var hint = field.querySelector('.fx-hint');
    if (showErrors || field.classList.contains('touched')) {
      field.classList.toggle('is-bad', !!msg);
      if (hint) hint.textContent = msg;
    }
    field.classList.toggle('is-valid', has && !msg);
    var cnt = field.querySelector('.fx-count');
    if (cnt) {
      var max = parseInt(c.getAttribute('maxlength'), 10), len = c.value.length;
      cnt.textContent = len + ' / ' + max;
      cnt.classList.toggle('warn', len > max * 0.85);
      cnt.classList.toggle('max', len >= max);
    }
    return msg;
  }

  function bindField(field) {
    var c = ctrlOf(field);
    if (!c || field.getAttribute('data-fx')) return;
    field.setAttribute('data-fx', '1');
    ensureParts(field);
    c.addEventListener('input', function () { sync(field); });
    c.addEventListener('change', function () { sync(field); });
    c.addEventListener('blur', function () { field.classList.add('touched'); sync(field); });
    sync(field);
  }

  /* ---------- Form shell ---------- */
  function addDone(form) {
    if (form.querySelector('.fx-done')) return;
    var d = document.createElement('div');
    d.className = 'fx-done'; d.setAttribute('role', 'status'); d.setAttribute('aria-live', 'polite');
    var conf = '';
    for (var i = 0; i < 26; i++) {
      var ang = (i / 26) * Math.PI * 2 + Math.random() * 0.5, dist = 150 + Math.random() * 190;
      var col = ['#E0A800', '#F2BE1A', '#6BCB77', '#F4F4F0', '#FF8A3D'][i % 5];
      conf += '<i class="fx-conf" style="background:' + col + ';--x:' + Math.round(Math.cos(ang) * dist) + 'px;--y:' + Math.round(Math.sin(ang) * dist - 40) + 'px;--r:' + Math.round(Math.random() * 720 - 360) + 'deg;--t:' + (0.75 + Math.random() * 0.25).toFixed(2) + 's"></i>';
    }
    d.innerHTML = conf +
      '<div class="fx-check"><svg viewBox="0 0 104 104" aria-hidden="true"><circle class="ring" cx="52" cy="52" r="48"/><path class="tick" d="M32 54l14 14 27-30"/></svg></div>' +
      '<h3>' + (form.getAttribute('data-done-title') || 'Sent') + '</h3><p class="fx-done-msg"></p>' +
      '<button type="button" class="fx-back fx-again">' + (form.getAttribute('data-again') || 'Send another') + '</button>';
    form.appendChild(d);
    d.querySelector('.fx-again').addEventListener('click', function () { resetState(form); });
  }

  function resetState(form) {
    form.classList.remove('is-done');
    var m = form.querySelector('.form-error,.form-ok');
    if (m) { m.textContent = ''; m.className = 'form-error'; }
    $all('.fx-f', form).forEach(function (f) { f.classList.remove('touched', 'is-bad', 'is-valid', 'filled'); var h = f.querySelector('.fx-hint'); if (h) h.textContent = ''; sync(f); });
    if (form.__goStep) form.__goStep(0, 'back');
    var first = form.querySelector('.fx-f .input'); if (first && !reduce) { try { first.focus({ preventScroll: true }); } catch (e) {} }
  }

  function watchMessage(form) {
    var m = form.querySelector('[id$="-msg"]');
    if (!m) return;
    var obs = new MutationObserver(function () {
      var txt = (m.textContent || '').trim();
      if (!txt) return;
      if (m.classList.contains('form-ok')) {
        var p = form.querySelector('.fx-done-msg'); if (p) p.textContent = txt;
        form.classList.add('is-done');
        var top = form.getBoundingClientRect().top;
        if (top < 0 || top > window.innerHeight * 0.5) { try { form.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); } catch (e) {} }
      } else {
        form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
      }
    });
    obs.observe(m, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  function glow(form) {
    form.addEventListener('pointermove', function (e) {
      var r = form.getBoundingClientRect();
      form.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      form.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  }

  function magnet(btn) {
    if (reduce || !window.matchMedia('(hover:hover)').matches) return;
    btn.addEventListener('pointermove', function (e) {
      if (btn.disabled) return;
      var r = btn.getBoundingClientRect();
      var x = (e.clientX - r.left - r.width / 2) / r.width, y = (e.clientY - r.top - r.height / 2) / r.height;
      btn.style.transform = 'translate(' + (x * 10).toFixed(1) + 'px,' + (y * 8).toFixed(1) + 'px)';
    });
    btn.addEventListener('pointerleave', function () { btn.style.transform = ''; });
  }

  /* ---------- Wizard (multi step forms) ---------- */
  function wizard(form) {
    var panes = $all('.fx-pane', form);
    if (panes.length < 2) return;
    var steps = $all('.fx-st', form), conns = $all('.fx-conn', form);
    var back = form.querySelector('[data-back]'), next = form.querySelector('[data-next]'), send = form.querySelector('button[type=submit]');
    var cur = 0;
    function review() {
      var box = form.querySelector('[data-review]');
      if (!box) return;
      var rows = '';
      $all('[data-rv]', form).forEach(function (c) {
        var v = (c.value || '').trim();
        rows += '<div><dt>' + c.getAttribute('data-rv') + '</dt><dd>' + (v ? v.replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }).slice(0, 90) : '<span style="color:#6F6F6A">Not provided</span>') + '</dd></div>';
      });
      box.innerHTML = '<h4>Check your details</h4><dl>' + rows + '</dl>';
    }
    function go(i, dir) {
      cur = Math.max(0, Math.min(panes.length - 1, i));
      form.setAttribute('data-dir', dir || 'fwd');
      panes.forEach(function (p, n) { p.classList.toggle('on', n === cur); });
      steps.forEach(function (s, n) { s.classList.toggle('on', n === cur); s.classList.toggle('done', n < cur); var ic = s.querySelector('i'); ic.innerHTML = n < cur ? CHECK.replace('width', 'width') : String(n + 1); });
      conns.forEach(function (c, n) { c.classList.toggle('fill', n < cur); });
      back.hidden = cur === 0;
      var last = cur === panes.length - 1;
      next.hidden = last; send.hidden = !last;
      if (last) review();
    }
    form.__goStep = go; form.__stepOf = function (el) { return panes.indexOf(el.closest('.fx-pane')); };
    function stepValid(n) {
      var bad = null;
      $all('.fx-f', panes[n]).forEach(function (f) { if (sync(f, true) && !bad) bad = f; });
      if (bad) { form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); var c = ctrlOf(bad); if (c) c.focus({ preventScroll: false }); }
      return !bad;
    }
    next.addEventListener('click', function () { if (stepValid(cur)) go(cur + 1, 'fwd'); });
    back.addEventListener('click', function () { go(cur - 1, 'back'); });
    form.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT' && cur < panes.length - 1) { e.preventDefault(); next.click(); }
    });
    form.addEventListener('reset', function () { setTimeout(function () { go(0, 'back'); }, 0); });
    go(0);
  }

  /* ---------- Init forms ---------- */
  function initForm(form) {
    if (form.getAttribute('data-fx-ready')) return;
    form.setAttribute('data-fx-ready', '1');
    $all('.field', form).forEach(upgrade);
    $all('.fx-f', form).forEach(bindField);
    addDone(form); watchMessage(form); glow(form);
    $all('.fx-btn', form).forEach(magnet);
    wizard(form);
    form.addEventListener('reset', function () { setTimeout(function () { $all('.fx-f', form).forEach(function (f) { f.classList.remove('touched', 'is-bad', 'is-valid'); sync(f); }); }, 0); });
  }

  /* Validate before the page's own submit handler sees the event */
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form.classList || !form.classList.contains('fx-form')) return;
    var firstBad = null;
    $all('.fx-f', form).forEach(function (f) { if (sync(f, true) && !firstBad) firstBad = f; });
    if (firstBad) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (form.__stepOf && form.__goStep) { var s = form.__stepOf(firstBad); if (s > -1) form.__goStep(s, 'back'); }
      form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
      var c = ctrlOf(firstBad); if (c) setTimeout(function () { c.focus(); }, 60);
    }
  }, true);

  /* ---------- Contact page: open status + FAQ ---------- */
  function openStatus() {
    var nodes = $all('[data-open-status]');
    if (!nodes.length) return;
    var parts;
    try {
      parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', weekday: 'short', hour: 'numeric', hour12: false }).formatToParts(new Date());
    } catch (e) { return; }
    var day = '', hr = 0;
    parts.forEach(function (p) { if (p.type === 'weekday') day = p.value; if (p.type === 'hour') hr = parseInt(p.value, 10) % 24; });
    var H = { Sun: [14, 19] }, DEF = [7, 20];
    var order = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], full = { Sun: 'Sunday', Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' };
    function span(d) { return H[d] || DEF; }
    function t(h) { return (h % 12 || 12) + ':00 ' + (h < 12 ? 'am' : 'pm'); }
    var s = span(day), open = hr >= s[0] && hr < s[1], text;
    if (open) text = 'We are open now · until ' + t(s[1]);
    else if (hr < s[0]) text = 'Closed now · opens today at ' + t(s[0]);
    else { var nd = order[(order.indexOf(day) + 1) % 7]; text = 'Closed now · opens ' + full[nd] + ' at ' + t(span(nd)[0]); }
    nodes.forEach(function (n) {
      n.innerHTML = '<span class="fx-dot' + (open ? '' : ' off') + '"></span>' + text;
    });
  }
  function faq() {
    $all('.fq-item').forEach(function (it) {
      var b = it.querySelector('.fq-q');
      b.addEventListener('click', function () {
        var open = it.classList.toggle('open');
        b.setAttribute('aria-expanded', String(open));
        if (open) $all('.fq-item.open').forEach(function (o) { if (o !== it) { o.classList.remove('open'); o.querySelector('.fq-q').setAttribute('aria-expanded', 'false'); } });
      });
    });
  }
  function cardGlow() {
    $all('.ct2').forEach(function (c) {
      c.addEventListener('pointermove', function (e) {
        var r = c.getBoundingClientRect();
        c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* ---------- Certificate page ---------- */
  function certificate() {
    var input = document.getElementById('cert-code'), out = document.getElementById('cert-out'), form = document.getElementById('cert-form');
    if (!input || !out || !form) return;
    input.addEventListener('input', function () {
      var pos = input.selectionStart;
      input.value = input.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
      try { input.setSelectionRange(pos, pos); } catch (e) {}
    });
    input.addEventListener('paste', function (e) {
      var t = (e.clipboardData || window.clipboardData).getData('text');
      if (t) { e.preventDefault(); input.value = t.trim().toUpperCase().replace(/[^A-Z0-9-]/g, ''); }
    });
    var btn = form.querySelector('button[type=submit]');
    new MutationObserver(function () {
      if (out.querySelector('.cert')) {
        btn && btn.blur();
        setTimeout(function () { try { out.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); } catch (e) {} }, 120);
      }
    }).observe(out, { childList: true });
    form.addEventListener('submit', function () {
      if (!input.value.trim()) return;
      btn.disabled = true;
      setTimeout(function () { btn.disabled = false; }, 900);
    });
  }

  function start() {
    $all('.fx-form').forEach(initForm);
    reveal(); openStatus(); faq(); cardGlow(); certificate();
    setInterval(openStatus, 60000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
