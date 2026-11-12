/* Promotional comparison is illustrative, not a former selling price. */
window.DeboneIllustrativePrice = window.DeboneIllustrativePrice || function (price) {
  var n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return '';
  var reference = Math.round(n * 1.5);
  var money = function (x) { return '₦' + Math.round(x).toLocaleString('en-NG'); };
  return '<span class="debone-price-comparison" aria-label="Illustrative price comparison">' +
    '<s>' + money(reference) + '</s><span class="debone-value-badge">✦ 33% below comparison</span>' +
    '<small>Illustrative comparison, not a previous price</small></span>';
};
/* Student dashboard: course bundles (list + detail pages) and the shared urgency helpers (countdowns, confetti). */
(function () {
  'use strict';
  var view = document.getElementById('view'), crumb = document.getElementById('crumb');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
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
  function setView(html) {
    if (window.DLive && DLive.silent && /class="skeleton"/.test(html)) return;
    view.innerHTML = html; view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter');
  }

  /* ---------- Countdown: every [data-cd] element counts down to its date ---------- */
  var timer = null;
  function pad(n) { return String(n).padStart(2, '0'); }
  function paint() {
    var els = document.querySelectorAll('[data-cd]');
    if (!els.length) { clearInterval(timer); timer = null; return; }
    els.forEach(function (el) {
      var ms = new Date(el.getAttribute('data-cd')).getTime() - Date.now(), out = el.querySelector('em') || el;
      if (isNaN(ms)) return;
      if (ms <= 0) { out.textContent = 'Offer ended'; el.classList.add('ended'); return; }
      var s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
      el.classList.toggle('urgent', ms < 86400000);
      out.textContent = (d ? d + 'd ' : '') + pad(h) + 'h ' + pad(m) + 'm ' + pad(sec) + 's left';
    });
  }
  function tick() { paint(); if (!timer) timer = setInterval(paint, 1000); }

  /* ---------- Celebration burst ---------- */
  function burst(x, y) {
    var colours = ['#E0A800', '#F7D35C', '#FF5A1F', '#1FE0C4', '#F4F4F0'];
    x = x == null ? window.innerWidth / 2 : x; y = y == null ? window.innerHeight / 3 : y;
    for (var i = 0; i < 40; i++) {
      var p = document.createElement('i');
      p.className = 'confetti';
      p.style.left = x + 'px'; p.style.top = y + 'px';
      p.style.background = colours[i % colours.length];
      p.style.setProperty('--dx', (Math.random() * 420 - 210) + 'px');
      p.style.setProperty('--dy', (-Math.random() * 320 - 40) + 'px');
      p.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
      p.style.animationDelay = (Math.random() * 160) + 'ms';
      document.body.appendChild(p);
      setTimeout(function (n) { return function () { n.remove(); }; }(p), 1500);
    }
  }

  function countUp(root) {
    root.querySelectorAll('[data-num]').forEach(function (el) {
      var to = Number(el.getAttribute('data-num')) || 0, pre = el.getAttribute('data-pre') || '', t0 = null;
      function f(ts) { if (!t0) t0 = ts; var p = Math.min(1, (ts - t0) / 1100); el.textContent = pre + Math.round(to * (1 - Math.pow(1 - p, 3))).toLocaleString('en-US'); if (p < 1) requestAnimationFrame(f); }
      requestAnimationFrame(f);
    });
  }
  function reveal(root) {
    var cards = root.querySelectorAll('.dbd-card,.dbd-course,.dbd-hero,.dbd-panel');
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: .1 });
      cards.forEach(function (c) { io.observe(c); });
    } else cards.forEach(function (c) { c.classList.add('in'); });
  }

  function img(b, cls) {
    return b.hasImage ? '<img class="' + (cls || '') + '" loading="lazy" src="/api/bundles/' + encodeURIComponent(b.id) + '/image?v=' + b.imageV + '" alt="' + esc(b.title) + '">'
      : '<div class="dbd-ph"><span>' + esc((b.title || 'B').charAt(0)) + '</span></div>';
  }
  function cd(b) { return b.offerEndsAt ? '<span class="offer-cd" data-cd="' + esc(b.offerEndsAt) + '"><i></i><em>…</em></span>' : ''; }
  function wlBlock(b) {
    return b.onWaitlist
      ? '<div class="wl-in"><span class="wl-ok">✓ You are on the waiting list</span><button class="btn btn-ghost btn-sm" type="button" data-bwl-leave="' + esc(b.id) + '">Leave</button></div>'
      : '<button class="btn btn-solid btn-sm btn-hurry" type="button" data-bwl="' + esc(b.id) + '">Join waiting list</button>';
  }
  function buyLabel(b) { return b.owned ? 'You own this bundle' : (b.ownedCount ? 'Get the rest of the bundle' : 'Buy the bundle · ' + naira(b.price)); }

  async function buy(id, btn) {
    btn.disabled = true; var label = btn.textContent; btn.textContent = 'Opening secure payment…';
    try {
      var res = await api('/api/bundles/' + encodeURIComponent(id) + '/buy', { method: 'POST', body: {} });
      if (res.order) { location.href = 'pay.html?order=' + encodeURIComponent(res.order.id); return; }
      toast(res.credited ? 'Your previous payments covered this bundle. All included courses are unlocked.' : 'You already have all these courses.'); location.hash = '#courses';
    } catch (e) { toast(e.message, 'err'); btn.disabled = false; btn.textContent = label; }
  }

  /* ---------- Bundles list ---------- */
  async function renderBundles() {
    crumb.textContent = 'Course bundles';
    var d = await api('/api/bundles'), list = d.bundles || [];
    var topSave = list.reduce(function (m, b) { return Math.max(m, b.savings || 0); }, 0);
    var totalCourses = list.reduce(function (t, b) { return t + b.courses.length; }, 0);
    var best = list.filter(function (x) { return !x.comingSoon; }).sort(function (a, b) { return (b.savingsPercent || 0) - (a.savingsPercent || 0); })[0];
    setView(head('Save more', 'Course bundles', 'Learn more for less. Each bundle packs several courses at one lower price.') +
      (list.length ? '<div class="dbd-stats"><div><b data-num="' + list.length + '">0</b><span>Bundles to choose from</span></div><div><b data-num="' + totalCourses + '">0</b><span>Courses inside</span></div>' +
        '<div><b data-num="' + topSave + '" data-pre="₦">0</b><span>Biggest saving on one bundle</span></div></div>' : '') +
      (best && best.savingsPercent ? '<section class="deal-banner"><div class="deal-glow"></div><div><p class="eyebrow">Best value</p><h3>' + esc(best.title) + ': save ' + naira(best.savings) + ' (' + best.savingsPercent + '% off)</h3>' +
        '<p class="muted">Buying these ' + best.courses.length + ' courses separately costs ' + naira(best.value) + '. Together they cost <b>' + naira(best.price) + '</b>.</p></div>' +
        '<a class="btn btn-solid btn-hurry" href="#bundle/' + encodeURIComponent(best.id) + '">See the bundle</a></section>' : '') +
      (list.length ? '<div class="dbd-grid">' + list.map(function (b, i) {
        return '<article class="dbd-card' + (b.owned ? ' owned' : '') + '" style="--i:' + (i % 6) + '"><a class="dbd-img" href="#bundle/' + encodeURIComponent(b.id) + '" aria-label="Open ' + esc(b.title) + '">' + img(b) +
          (b.comingSoon ? '<span class="dbd-ribbon soon">Coming soon</span>' : b.savingsPercent ? '<span class="dbd-ribbon">Save ' + b.savingsPercent + '%</span>' : '') + '<span class="dbd-count">' + b.courses.length + ' courses</span>' + (b.owned ? '<span class="dbd-own">✓ Owned</span>' : '') + '</a>' +
          '<div class="dbd-body"><p class="eyebrow">Course bundle</p><h3><a href="#bundle/' + encodeURIComponent(b.id) + '">' + esc(b.title) + '</a></h3>' + (b.description ? '<p class="dbd-desc">' + esc(b.description) + '</p>' : '') +
          '<ul class="dbd-list">' + b.courses.map(function (c, j) { return '<li style="--j:' + j + '"><span class="dbd-tick' + (c.owned ? ' on' : '') + '">' + (c.owned ? '✓' : '') + '</span><b>' + esc(c.title) + '</b></li>'; }).join('') + '</ul>' +
          '<div class="dbd-foot"><div class="dbd-price"><b>' + naira(b.paymentCredit ? b.paymentCredit.remaining : b.price) + '</b>' + window.DeboneIllustrativePrice(b.price) + '' + (b.value > b.price ? '<s>' + naira(b.value) + '</s><em>Save ' + naira(b.savings) + '</em>' : '') + (b.paymentCredit && b.paymentCredit.total ? '<small class="dbd-credit">✓ ' + naira(b.paymentCredit.total) + ' previous payments credited</small>' : '') + cd(b) + '</div>' +
          '<div class="dbd-acts"><a class="btn btn-ghost btn-sm" href="#bundle/' + encodeURIComponent(b.id) + '">Details</a>' +
          (b.owned ? '' : b.comingSoon ? wlBlock(b) : '<button class="btn btn-solid btn-sm btn-hurry" type="button" data-dbuy="' + esc(b.id) + '">' + (b.ownedCount ? 'Get the rest' : 'Buy now') + '</button>') + '</div></div></div></article>';
      }).join('') + '</div>' : '<div class="empty-state">No bundles are open yet. Check back soon, or <a href="#browse">browse single courses</a>.</div>'));
    countUp(view); reveal(view); bind(renderBundles); tick();
  }

  /* ---------- One bundle ---------- */
  async function renderBundle(id) {
    crumb.textContent = 'Course bundle';
    var d = await api('/api/bundles'), b = (d.bundles || []).filter(function (x) { return x.id === id; })[0];
    if (!b) { setView(head('Course bundles', 'Bundle not found', '') + '<div class="empty-state">This bundle is not available. <a href="#bundles">See all bundles</a>.</div>'); return; }
    var pct = b.value ? Math.round(b.price / b.value * 100) : 100;
    setView('<p class="dbd-back"><a href="#bundles">← All bundles</a></p>' +
      '<section class="dbd-hero"><div class="dbd-hero-img">' + img(b) + (b.comingSoon ? '<span class="dbd-ribbon big soon">Coming soon</span>' : b.savingsPercent ? '<span class="dbd-ribbon big">Save ' + b.savingsPercent + '%</span>' : '') + '</div>' +
      '<div class="dbd-hero-info"><p class="eyebrow">Course bundle · ' + b.courses.length + ' courses</p><h1>' + esc(b.title) + '</h1>' +
        (b.description ? '<p class="muted">' + esc(b.description) + '</p>' : '') +
        '<div class="dbd-pricebox">' + (b.comingSoon || b.offerEndsAt ? '<div class="offer-top">' + (b.comingSoon ? '<span class="gpill none">Launch price</span>' : '') + cd(b) + '</div>' : '') + '<div class="dbd-bigprice"><b data-num="' + b.price + '" data-pre="₦">' + naira(b.price) + '</b>' + window.DeboneIllustrativePrice(b.price) + '' + (b.value > b.price ? '<s>' + naira(b.value) + '</s>' : '') + '</div>' +
        (b.savings ? '<p class="dbd-saveline"><span class="offer-pct">' + b.savingsPercent + '% OFF</span> You save <strong>' + naira(b.savings) + '</strong> compared with buying one by one.</p>' +
          '<div class="dbd-meter" aria-hidden="true"><i style="--w:' + pct + '%"></i><span style="left:' + pct + '%">You pay ' + pct + '%</span></div>' : '') + '</div>' +
        (b.owned ? '<div class="dbd-owned">✓ You already own every course in this bundle. <a href="#courses">Go to My courses</a></div>'
          : b.comingSoon ? wlBlock(b) + '<p class="muted small">' + (b.waitlistCount ? b.waitlistCount + (b.waitlistCount === 1 ? ' person is' : ' people are') + ' on the waiting list. ' : '') + 'We will notify you the moment this bundle opens.</p>'
          : '<button class="btn btn-solid btn-hurry dbd-buy" type="button" data-dbuy="' + esc(b.id) + '">' + esc(buyLabel(b)) + '</button>' +
            (b.ownedCount ? '<p class="muted small">You already own ' + b.ownedCount + ' of ' + b.courses.length + ' courses. The rest unlock with this bundle.</p>' : '<p class="muted small">Secure Paystack payment · Courses unlock as soon as payment is confirmed.</p>')) +
      '</div></section>' +
      '<section class="dbd-panel"><p class="eyebrow">What is inside</p><div class="dbd-courses">' + b.courses.map(function (c, j) {
        return '<article class="dbd-course' + (c.owned ? ' owned' : '') + '" style="--j:' + j + '"><span class="dbd-num">' + String(j + 1).padStart(2, '0') + '</span>' +
          '<div><h3>' + esc(c.title) + '</h3><p class="muted small">' + (c.lessons ? c.lessons + ' lessons' : '') + (c.instructor ? ' · ' + esc(c.instructor) : '') + (c.startDate ? ' · Starts ' + esc(c.startDate) : '') + (c.schedule ? ' · ' + esc(c.schedule) : '') + '</p></div>' +
          '<div class="dbd-cprice">' + (c.owned ? '<span class="gpill pass">Owned</span>' : '<s>' + naira(c.price) + '</s>') + '</div></article>';
      }).join('') + '</div>' +
      '<div class="dbd-sum"><div><span>Total if bought separately</span><b>' + naira(b.value) + '</b></div><div><span>Bundle price</span><b class="gold">' + naira(b.price) + '</b></div><div><span>You save</span><b class="green">' + naira(b.savings) + '</b></div></div></section>');
    countUp(view); reveal(view); bind(function () { return renderBundle(id); }); tick();
    if (b.savings) setTimeout(function () { var m = view.querySelector('.dbd-meter'); if (m) m.classList.add('go'); }, 150);
  }

  function bind(rerender) {
    view.querySelectorAll('[data-dbuy]').forEach(function (btn) {
      btn.addEventListener('click', function (e) { burst(e.clientX, e.clientY); buy(btn.getAttribute('data-dbuy'), btn); });
    });
    view.querySelectorAll('[data-bwl],[data-bwl-leave]').forEach(function (btn) {
      btn.addEventListener('click', async function (e) {
        var join = btn.hasAttribute('data-bwl'), id = btn.getAttribute(join ? 'data-bwl' : 'data-bwl-leave'), label = btn.textContent;
        btn.disabled = true; btn.textContent = join ? 'Joining…' : 'Leaving…';
        try {
          await api('/api/bundles/' + encodeURIComponent(id) + '/waitlist', { method: join ? 'POST' : 'DELETE', body: {} });
          if (join) burst(e.clientX, e.clientY);
          toast(join ? 'You are on the waiting list. We will notify you the moment this bundle opens.' : 'You left the waiting list.');
          if (rerender) rerender();
        } catch (ex) { toast(ex.message, 'err'); btn.disabled = false; btn.textContent = label; }
      });
    });
  }

  window.DOffers = { tick: tick, burst: burst };
  var old = window.DashExtras && window.DashExtras.render;
  window.DashExtras = Object.assign(window.DashExtras || {}, {
    render: function (name, arg) {
      if (name === 'bundles') return renderBundles().catch(function (e) { setView(head('Course bundles', 'Could not load', '') + '<div class="empty-state">' + esc(e.message) + '</div>'); });
      if (name === 'bundle') return renderBundle(arg ? decodeURIComponent(arg) : '').catch(function (e) { setView(head('Course bundles', 'Could not load', '') + '<div class="empty-state">' + esc(e.message) + '</div>'); });
      return old ? old(name, arg) : undefined;
    }
  });
})();
