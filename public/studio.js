/* DEBONE STUDIO — motion + presentation layer for the admin and student dashboards.
   It never changes data or behaviour: it only wraps what each view already rendered
   (hero banner, avatars, table search, count-ups, hover effects). Safe to remove. */
(function () {
  'use strict';
  var body = document.body;
  var view = document.getElementById('view');
  if (!body || !view || !body.hasAttribute('data-shell')) return;
  body.classList.add('studio');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var IMG = '/assets/debone-products/';

  /* ---------- hero photography, grouped by mood (all from /assets/debone-products) ---------- */
  var SETS = {
    cam: ['001-dslr-camera-canon-eos-90d', '026-mirrorless-camera', '030-portrait-camera-lens'],
    video: ['040-professional-video-camera', 'sony-4k-professional-camcorder', '047-smartphone-gimbal'],
    light: ['050-led-studio-light', '041-led-ring-light', '038-photography-softbox'],
    audio: ['048-usb-microphone', 'professional-shotgun-microphone', '039-portable-audio-recorder'],
    print: ['004-photo-printer', '031-a3-printer', 'konica-minolta-bizhub-c203'],
    tech: ['006-brand-new-laptop', '011-desktop-computer', '013-nvme-ssd'],
    drone: ['dji-mini-4k-drone', 'gopro-hero12-black-action-camera', '049-camera-gimbal-stabiliser'],
    id: ['024-id-card-printer', '028-laminating-machine', '022-heat-press-machine'],
    shop: ['009-inkjet-printer', '036-camera-tripod', '037-speedlight-flash']
  };
  /* view key -> photo set (null = icon orb, used for money / system pages) */
  var ART = {
    admin: {
      live: 'video', 'zoom-verification': 'tech', assignments: 'tech', courses: 'video', transfers: null, certificates: 'id', community: 'audio', challenges: 'drone',
      bundles: 'cam', waitlist: 'tech', reviews: 'cam', webinars: 'video', pages: 'tech', services: 'print', talent: 'light', bookings: 'cam', digital: 'tech',
      products: 'shop', works: 'cam', settings: null, setup: null, rules: null, users: null, applications: 'light', payments: null, referrals: null, reports: null,
      refunds: null, announce: 'audio', feedback: 'audio', newsletter: null
    },
    student: {
      live: 'video', recordings: 'video', community: 'audio', reviews: 'cam', assignments: 'tech', performance: null, certificates: 'id', portfolio: 'light',
      payments: null, referrals: null, requests: null, downloads: 'tech', profile: null, courses: 'cam', browse: 'cam', bundles: 'drone'
    }
  };
  var shell = body.getAttribute('data-shell') === 'student' ? 'student' : 'admin';

  /* ---------- tiny helpers ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
  function initials(name) {
    var p = String(name || '?').replace(/@.*/, '').trim().split(/[\s._-]+/).filter(Boolean);
    return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  }
  var HUES = [['#FFD45C', '#E0A800'], ['#9BE8A6', '#4FB866'], ['#9DBFFF', '#5C86E8'], ['#C9B4FF', '#8F6BE8'], ['#FFB38A', '#F0733A'], ['#FF9FB0', '#E8566F'], ['#8DEBDD', '#3DB8A8']];
  function avatar(seed, text, cls) {
    var h = HUES[hash(seed) % HUES.length];
    return '<span class="st-av ' + (cls || '') + '" style="--av1:' + h[0] + ';--av2:' + h[1] + '" aria-hidden="true">' + esc(initials(text)) + '</span>';
  }
  function navIcon(key) {
    var a = $('.side-nav a[data-view="' + key + '"] .ix svg');
    return a ? a.outerHTML : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/></svg>';
  }
  var ICON = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
  };
  var EMPTY_SVG = '<svg viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle class="r" cx="48" cy="48" r="38" stroke-dasharray="3 7" opacity=".55"/><circle cx="48" cy="48" r="24" opacity=".9"/><path d="M48 24l9 15M72 48H54M60 69L51 54M36 69l9-15M24 48h18M36 27l9 15" opacity=".8"/><circle cx="48" cy="48" r="6" fill="currentColor" stroke="none"/></svg>';

  /* ---------- route key + progress bar ---------- */
  var bar = document.createElement('div'); bar.className = 'st-bar'; document.body.appendChild(bar);
  function routeKey() { return (location.hash || '#overview').replace(/^#/, ''); }
  function routeName() { return routeKey().split('/')[0] || 'overview'; }
  var lastKey = null;

  /* ---------- sidebar: gliding gold indicator ---------- */
  var nav = $('.side-nav'), ind = null;
  if (nav) { ind = document.createElement('span'); ind.className = 'st-ind'; nav.insertBefore(ind, nav.firstChild); }
  function moveInd() {
    if (!nav || !ind) return;
    var a = $('a.active', nav);
    if (!a) { ind.style.opacity = 0; return; }
    ind.style.opacity = 1;
    ind.style.height = a.offsetHeight + 'px';
    ind.style.transform = 'translateY(' + a.offsetTop + 'px)';
    if (a.scrollIntoView && lastKey !== null) { try { a.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }); } catch (e) {} }
  }
  if (nav) {
    new MutationObserver(function () { requestAnimationFrame(moveInd); }).observe(nav, { attributes: true, subtree: true, attributeFilter: ['class'] });
    window.addEventListener('resize', moveInd);
    setTimeout(moveInd, 60); setTimeout(moveInd, 600);
  }

  /* ---------- sidebar footer avatar + topbar tools ---------- */
  function paintMe() {
    var me = $('.side-foot .me'), n = $('#me-name');
    if (!me || !n) return;
    var old = $('.st-av', me);
    var txt = n.textContent || '';
    if (/loading/i.test(txt)) return;
    if (old && old.getAttribute('data-for') === txt) return;
    if (old) old.remove();
    var tmp = document.createElement('div'); tmp.innerHTML = avatar(txt + ($('#me-email') ? $('#me-email').textContent : ''), txt);
    var av = tmp.firstChild; av.setAttribute('data-for', txt); me.insertBefore(av, me.firstChild);
  }
  var meName = $('#me-name');
  if (meName) new MutationObserver(paintMe).observe(meName, { childList: true, characterData: true, subtree: true });
  paintMe();

  var topbar = $('.topbar');
  if (topbar && !$('.st-tools', topbar)) {
    var tools = document.createElement('div'); tools.className = 'st-tools';
    var d = new Date();
    tools.innerHTML = '<span class="st-chip hide-s">' + ICON.cal + '<b>' + d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + '</b></span>' +
      '<span class="st-chip live"><i></i>Live</span>';
    topbar.appendChild(tools);
  }
  window.addEventListener('scroll', function () { if (topbar) topbar.classList.toggle('st-scrolled', window.scrollY > 12); }, { passive: true });

  /* ---------- count-up numbers ---------- */
  function countUp(el) {
    if (el.__st || el.hasAttribute('data-count')) return;
    var raw = el.textContent.trim();
    var m = raw.match(/^([^\d-]*)(-?[\d,]+(?:\.\d+)?)(.*)$/);
    if (!m || el.children.length) return;
    el.__st = 1;
    var end = parseFloat(m[2].replace(/,/g, '')), commas = m[2].indexOf(',') > -1, dec = (m[2].split('.')[1] || '').length;
    if (!isFinite(end) || end === 0 || reduce) return;
    var t0 = null, dur = 1200;
    el.textContent = m[1] + (0).toFixed(dec) + m[3];
    function fmt(v) { var s = v.toFixed(dec); if (commas || end >= 10000) s = Number(s).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }); return m[1] + s + m[3]; }
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1), e = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt(end * e);
      if (p < 1) requestAnimationFrame(step); else el.textContent = raw;
    }
    requestAnimationFrame(step);
  }

  /* ---------- hero banner ---------- */
  function buildHero(head, key) {
    if (head.classList.contains('st-hero')) return;
    var eyebrow = $('.eyebrow', head), h1 = $('h1', head), sub = $('p.muted, p:not(.eyebrow)', head);
    var title = h1 ? h1.textContent.trim() : '', words = title.split(/\s+/).filter(Boolean);
    var fresh = view.classList.contains('st-fresh');
    var set = ART[shell] && ART[shell][key];
    var photos = set && SETS[set] ? SETS[set] : null;
    var h1html = words.map(function (w, i) {
      var g = i === words.length - 1 || (words.length > 2 && i === words.length - 2 && false);
      return '<span class="st-w' + (g ? ' g' : '') + '"><i style="--w:' + i + '">' + esc(w) + '</i></span>';
    }).join(' ');
    var art = '<div class="st-art" aria-hidden="true"><div class="st-rot"><div class="st-ring"></div>';
    if (photos) {
      art += photos.map(function (f, i) { return '<figure class="st-photo p' + (i + 1) + '"><img src="' + IMG + f + '.webp" alt="" loading="lazy" decoding="async" onerror="this.closest(\'figure\').style.display=\'none\'"></figure>'; }).join('');
    } else {
      art += '<div class="st-orb">' + navIcon(key) + '</div>';
    }
    art += '<div class="st-float f1"><span class="fi">' + navIcon(key) + '</span><span><span class="st-f1t">' + esc(title) + '</span><small>Section</small></span></div>';
    art += '<div class="st-float f2"><span class="fi">' + ICON.clock + '</span><span>' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + '<small>Last refreshed</small></span></div>';
    art += '</div></div>';
    head.className = (head.className + ' st-hero' + (fresh ? '' : ' st-static')).trim();
    head.innerHTML = '<span class="st-grid"></span><span class="st-aur a"></span><span class="st-aur b"></span>' +
      '<div class="st-copy">' +
      '<p class="eyebrow"><span class="st-eico">' + navIcon(key) + '</span>' + esc(eyebrow ? eyebrow.textContent : (shell === 'admin' ? 'Admin' : 'Academy')) + '</p>' +
      '<h1>' + h1html + '</h1>' +
      (sub ? '<p class="st-sub">' + esc(sub.textContent) + '</p>' : '') +
      '<div class="st-meta"></div></div>' + art;
    var tint = { audio: 'rgba(122,167,255,.4)', drone: 'rgba(183,155,255,.4)', id: 'rgba(255,159,64,.35)', video: 'rgba(255,107,122,.3)' }[set];
    if (tint) head.style.setProperty('--tint', tint);
    /* parallax tilt */
    if (!reduce) {
      head.addEventListener('pointermove', function (e) {
        var r = head.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        head.style.setProperty('--rx', (x * 14).toFixed(2) + 'deg'); head.style.setProperty('--ry', (-y * 10).toFixed(2) + 'deg');
      });
      head.addEventListener('pointerleave', function () { head.style.setProperty('--rx', '0deg'); head.style.setProperty('--ry', '0deg'); });
    }
  }
  function updateMeta(head) {
    var meta = $('.st-meta', head); if (!meta) return;
    var n = 0, label = 'records';
    var rows = $$('tbody tr', view).filter(function (r) { return !r.querySelector('td[colspan]') && !r.closest('.st-find'); });
    if (rows.length) n = rows.length;
    else {
      var cards = $$('.grid-courses > *, .lv-card, .session-card, .assign, .dcourse, .sub-row, .msg-row', view);
      n = cards.length; label = 'items';
    }
    var html = '';
    if (n) html += '<span class="st-chip pulse">' + ICON.list + '<b>' + n.toLocaleString('en-US') + '</b> ' + label + '</span>';
    var pend = $$('.status.pending, .status.proof_uploaded, .status.requested', view).length;
    if (pend) html += '<span class="st-chip">' + ICON.clock + '<b>' + pend + '</b> waiting for action</span>';
    if (meta.__h !== html) { meta.innerHTML = html; meta.__h = html; }
    var f1 = $('.st-f1t', head);
    if (f1 && n) { var sm = f1.parentNode.querySelector('small'); if (sm) sm.textContent = n + ' ' + label; }
  }

  /* ---------- list polish ---------- */
  function enhanceTables() {
    $$('table', view).forEach(function (t) {
      var th0 = $('thead th', t), hd = th0 ? th0.textContent : '';
      var whoCol = /student|user|name|applicant|instructor|talent|member|customer|author|learner/i.test(hd);
      $$('tbody tr', t).forEach(function (tr, i) {
        if (!tr.style.getPropertyValue('--i')) tr.style.setProperty('--i', Math.min(i, 24));
        var td = tr.firstElementChild;
        if (!td || td.__st || td.hasAttribute('colspan')) return;
        var b = td.querySelector(':scope > b, :scope > strong');
        if (!b) return;
        var sib = b.nextElementSibling;
        var isEmail = sib && /@/.test(sib.textContent);
        if (!(isEmail || whoCol)) return;
        if (td.querySelector('img')) return;
        td.__st = 1;
        var w = document.createElement('div'); w.className = 'st-who';
        var tmp = document.createElement('div'); tmp.innerHTML = avatar(b.textContent + (isEmail ? sib.textContent : ''), b.textContent);
        var inner = document.createElement('div');
        while (td.firstChild) inner.appendChild(td.firstChild);
        w.appendChild(tmp.firstChild); w.appendChild(inner); td.appendChild(w);
      });
    });
    /* quick filter for long tables */
    $$('.dt-wrap, .table-wrap', view).forEach(function (wrap) {
      if (wrap.__find) return;
      var rows = $$('tbody tr', wrap).filter(function (r) { return !r.querySelector('td[colspan]'); });
      if (rows.length < 7) return;
      wrap.__find = 1;
      var bar = document.createElement('div'); bar.className = 'st-find';
      bar.innerHTML = '<label>' + ICON.search + '<input type="search" placeholder="Filter this list…" aria-label="Filter this list" autocomplete="off"></label><span class="st-count"></span>';
      wrap.parentNode.insertBefore(bar, wrap);
      var input = $('input', bar), cnt = $('.st-count', bar);
      function run() {
        var q = input.value.trim().toLowerCase(), shown = 0;
        $$('tbody tr', wrap).forEach(function (r) {
          if (r.querySelector('td[colspan]')) return;
          var ok = !q || r.textContent.toLowerCase().indexOf(q) > -1;
          r.classList.toggle('st-hide', !ok); if (ok) shown++;
        });
        cnt.innerHTML = q ? '<b>' + shown + '</b> of ' + rows.length + ' shown' : '';
      }
      input.addEventListener('input', run);
    });
  }
  function enhanceEmpty() {
    $$('.empty-state', view).forEach(function (e) {
      if (e.__st || e.querySelector('.st-empty-art')) return; e.__st = 1;
      var d = document.createElement('div'); d.className = 'st-empty-art'; d.innerHTML = EMPTY_SVG; e.insertBefore(d, e.firstChild);
    });
  }

  /* ---------- main enhance pass (idempotent) ---------- */
  var mo = new MutationObserver(function () { schedule(); });
  var raf = 0;
  function schedule() { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; enhance(); }); }
  function enhance() {
    mo.disconnect();
    try {
      var key = routeKey(), name = routeName();
      var changed = key !== lastKey;
      if (changed) {
        view.classList.add('st-fresh');
        clearTimeout(enhance.t); enhance.t = setTimeout(function () { view.classList.remove('st-fresh'); }, 2200);
        bar.classList.remove('go'); void bar.offsetWidth; bar.classList.add('go');
      }
      var kids = Array.prototype.slice.call(view.children);
      var head = kids.filter(function (k) { return k.classList && k.classList.contains('view-head'); })[0];
      if (head) buildHero(head, name);
      kids.forEach(function (k, i) { if (changed || !k.style.getPropertyValue('--k')) k.style.setProperty('--k', i); });
      $$('.kpis, .grid-courses, .grid-2, .grid-3', view).forEach(function (g) {
        Array.prototype.forEach.call(g.children, function (c, j) { if (!c.style.getPropertyValue('--j')) c.style.setProperty('--j', j); });
      });
      enhanceTables(); enhanceEmpty();
      $$('.stat-card b, .kpi b, .st-num', view).forEach(countUp);
      if (head) updateMeta(head);
      lastKey = key;
    } catch (err) { if (window.console) console.warn('studio:', err); }
    mo.observe(view, { childList: true, subtree: true });
  }

  /* ---------- pointer effects (delegated) ---------- */
  var SPOT = '.box, .panel, .stat-card, .kpi, .dcourse, .lv-card';
  view.addEventListener('pointermove', function (e) {
    var c = e.target.closest && e.target.closest(SPOT);
    if (!c) return;
    var r = c.getBoundingClientRect();
    c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.btn');
    if (!b || reduce || b.disabled) return;
    var r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2;
    var d = document.createElement('span'); d.className = 'st-ripple';
    d.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' + (e.clientX - r.left - s / 2) + 'px;top:' + (e.clientY - r.top - s / 2) + 'px';
    b.appendChild(d); setTimeout(function () { d.remove(); }, 750);
  });


  /* broken images (e.g. a photo not uploaded yet) fall back to a branded tile instead of the browser's broken-image icon */
  view.addEventListener('error', function (e) {
    var t = e.target;
    if (!t || t.tagName !== 'IMG' || t.__bad) return;
    t.__bad = 1; t.style.visibility = 'hidden';
    if (t.parentNode && !t.parentNode.classList.contains('st-imgfail')) t.parentNode.classList.add('st-imgfail');
  }, true);

  window.addEventListener('hashchange', schedule);
  mo.observe(view, { childList: true, subtree: true });
  schedule();
})();
