/* Selected work: homepage selection, the Our work gallery, and a lightbox (v27). Content comes from the database. */
(function () {
  'use strict';
  var PAGE = document.body.getAttribute('data-page') === 'works';
  var HAS_GRID = !!document.getElementById('works-grid');
  var STRIP = !HAS_GRID;            /* every other public page gets the compact Our work strip */
  var LIMIT = PAGE ? Infinity : (STRIP ? 5 : 6);
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var LABEL = { studio: 'Studio', editing: 'Editing', camera: 'Camera', drone: 'Drone', events: 'Events', music: 'Music videos' };
  var works = [], active = 'all', shown = [], lb = null, lbIndex = 0;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function label(c) { return LABEL[c] || c.charAt(0).toUpperCase() + c.slice(1); }
  var WA = 'https://wa.me/2348035988889?text=';
  /* Copy for the numbered category sections on the Our work page */
  var COPY = {
    studio: { title: 'Studio sessions', text: 'Portraits, fashion and brand shoots lit and directed in our studio, then retouched and ready to share or print.', bullets: ['Portraits, couples and family sessions', 'Fashion and brand shoots', 'Retouched selects, ready for print'], cta: 'Book a studio session' },
    editing: { title: 'Editing & colour', text: 'Footage and photos cut, colour-graded and cleaned up so every project looks finished and consistent.', bullets: ['Video editing and colour grading', 'Photo retouching and clean-up', 'Titles, captions and simple motion graphics'], cta: 'Send us your files' },
    camera: { title: 'On set & behind the camera', text: 'Proper cameras, proper lenses and a crew that plans every shot, from the first setup to the last take.', bullets: ['Cinema-style video and stills', 'Lighting and set design', 'Directing and shot planning'], cta: 'Book a shoot' },
    drone: { title: 'Drone & aerial', text: 'Aerial shots that show scale and place, for events, venues, property and brand films.', bullets: ['Event and venue coverage', 'Property and site footage', 'Aerial sequences for films'], cta: 'Book drone coverage' },
    events: { title: 'Events & weddings', text: 'Weddings, launches and church and corporate events covered in photo and video, here and abroad.', bullets: ['Photo and video coverage', 'Highlight reels for social media', 'Travel for events outside Port Harcourt'], cta: 'Book event coverage' },
    music: { title: 'Music videos', text: 'From concept to release-ready file: planning, directing, shooting and colour-grading for every platform.', bullets: ['Concept and shot planning', 'Directing, lighting and shooting', 'Exports for YouTube, Instagram and TikTok'], cta: 'Get a music video quote' }
  };
  var grid = document.getElementById('works-grid');
  var filters = document.getElementById('works-filters');
  var showcase = document.getElementById('wk-showcase');

  /* Other public pages: build the compact "Our work" strip just above the footer */
  function buildStrip() {
    var slot = document.querySelector('[data-works-strip]');
    if (!slot) {
      slot = document.createElement('section');
      slot.setAttribute('data-works-strip', '');
      var main = document.querySelector('main');
      var foot = document.querySelector('footer.site-footer');
      if (main) main.appendChild(slot); else if (foot) foot.parentNode.insertBefore(slot, foot); else document.body.appendChild(slot);
    }
    slot.className = 'wk-strip section';
    slot.id = 'work-strip';
    slot.setAttribute('aria-labelledby', 'wk-strip-title');
    slot.innerHTML = '<div class="container">' +
      '<div class="wk-strip-head">' +
        '<div><p class="eyebrow">Our work</p><h2 class="section-title" id="wk-strip-title">Recent frames.</h2>' +
        '<p class="muted">A taste of the photography, video and editing we do in Port Harcourt.</p></div>' +
        '<a class="btn btn-ghost" href="works.html">See all our work</a>' +
      '</div>' +
      '<div class="wk-grid wk-strip-grid" id="works-grid" aria-live="polite"></div>' +
      '<div class="wk-strip-foot"><a class="btn btn-solid" href="works.html">See more work</a></div>' +
    '</div>';
    grid = slot.querySelector('#works-grid');
  }
  if (STRIP) buildStrip();
  if (!grid) return;

  function cats() {
    var out = [];
    works.forEach(function (w) { if (out.indexOf(w.category) === -1) out.push(w.category); });
    return out;
  }

  function drawFilters() {
    if (!filters) return;
    filters.innerHTML = '<span class="wk-pill-bg" aria-hidden="true"></span>' + ['all'].concat(cats()).map(function (c) {
      return '<button type="button" class="wk-pill" aria-pressed="' + (active === c) + '" data-filter="' + esc(c) + '">' + (c === 'all' ? 'All work' : esc(label(c))) + '</button>';
    }).join('');
    filters.querySelectorAll('[data-filter]').forEach(function (b) {
      b.addEventListener('click', function () { active = b.getAttribute('data-filter'); draw(true); });
    });
    moveBg();
  }
  function moveBg() {
    var bg = filters && filters.querySelector('.wk-pill-bg'), on = filters && filters.querySelector('[aria-pressed="true"]');
    if (!bg || !on) return;
    bg.style.width = on.offsetWidth + 'px'; bg.style.transform = 'translateX(' + on.offsetLeft + 'px)';
  }
  window.addEventListener('resize', moveBg);

  function draw(animate) {
    if (active !== 'all' && cats().indexOf(active) === -1) active = 'all';
    drawFilters();
    shown = works.filter(function (w) { return active === 'all' || w.category === active; }).slice(0, LIMIT);
    grid.innerHTML = shown.length ? shown.map(function (w, i) {
      return '<figure class="wk-tile' + (i === 0 && shown.length >= 5 ? ' wk-lead' : '') + (animate ? ' wk-in' : '') + '" style="--i:' + (i % 9) + '" tabindex="0" role="button" aria-label="Open ' + esc(w.title) + '" data-index="' + i + '">' +
        '<img src="' + esc(w.image) + '" alt="' + esc(w.alt) + '" loading="lazy">' +
        '<figcaption><span class="wk-cat">' + esc(label(w.category)) + '</span><b>' + esc(w.title) + '</b><span class="wk-zoom" aria-hidden="true">+</span></figcaption></figure>';
    }).join('') : '<p class="wk-empty muted">Our recent work will appear here soon.</p>';
    grid.querySelectorAll('.wk-tile').forEach(function (t) {
      var open = function () { openLb(Number(t.getAttribute('data-index'))); };
      t.addEventListener('click', open);
      t.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
    var more = document.getElementById('work-more');
    if (!PAGE && !STRIP && !more && works.length > LIMIT) {
      grid.insertAdjacentHTML('afterend', '<div class="work-more" id="work-more"><a class="btn btn-solid" href="works.html">See more work</a></div>');
    } else if (more && (PAGE || STRIP || works.length <= LIMIT)) { more.remove(); }
  }

  /* Numbered category sections (Our work page), same layout as the Services page */
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function drawShowcase() {
    if (!showcase) return;
    var list = cats();
    showcase.innerHTML = list.map(function (c, i) {
      var items = works.filter(function (w) { return w.category === c; });
      var cp = COPY[c] || { title: label(c), text: 'A selection of ' + label(c).toLowerCase() + ' projects from our studio.', bullets: ['Planned and shot by our team', 'Edited and finished in house'], cta: 'Ask about this' };
      var lead = items[0];
      return '<section class="svc' + (i % 2 ? ' flip' : '') + '" id="wk-cat-' + esc(c) + '">' +
        '<div class="svc-copy" data-reveal><p class="svc-num">' + pad(i + 1) + '</p><h2>' + esc(cp.title) + '</h2><p>' + esc(cp.text) + '</p>' +
        '<ul class="bullets">' + cp.bullets.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>' +
        '<div class="btn-row"><button type="button" class="btn btn-solid" data-see="' + esc(c) + '">See ' + items.length + ' project' + (items.length === 1 ? '' : 's') + '</button>' +
        '<a class="btn btn-ghost" href="' + WA + encodeURIComponent('Hi DEBONE, I\'d like to ask about ' + cp.title) + '" target="_blank" rel="noopener">' + esc(cp.cta) + '</a></div></div>' +
        '<div class="svc-media" data-reveal><img src="' + esc(lead.image) + '" alt="' + esc(lead.alt) + '" loading="lazy"></div></section>';
    }).join('');
    showcase.querySelectorAll('[data-see]').forEach(function (b) {
      b.addEventListener('click', function () {
        active = b.getAttribute('data-see'); draw(true);
        var g = document.getElementById('gallery');
        if (g) g.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      });
    });
  }

  /* Lightbox: previous and next, keyboard, swipe */
  function buildLb() {
    lb = document.createElement('div');
    lb.className = 'wk-lb';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Work preview');
    lb.innerHTML = '<button type="button" class="wk-lb-x" aria-label="Close">&times;</button>' +
      '<button type="button" class="wk-lb-nav prev" aria-label="Previous work">&#8592;</button>' +
      '<figure class="wk-lb-fig"><img alt=""><figcaption><span class="wk-lb-cat"></span><b class="wk-lb-title"></b><span class="wk-lb-count"></span></figcaption></figure>' +
      '<button type="button" class="wk-lb-nav next" aria-label="Next work">&#8594;</button>';
    document.body.appendChild(lb);
    lb.querySelector('.wk-lb-x').addEventListener('click', closeLb);
    lb.querySelector('.prev').addEventListener('click', function () { stepLb(-1); });
    lb.querySelector('.next').addEventListener('click', function () { stepLb(1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });
    document.addEventListener('keydown', function (e) {
      if (!lb || !lb.classList.contains('open')) return;
      if (e.key === 'Escape') closeLb();
      if (e.key === 'ArrowRight') stepLb(1);
      if (e.key === 'ArrowLeft') stepLb(-1);
    });
    var sx = null;
    lb.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (sx == null) return;
      var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 50) stepLb(dx < 0 ? 1 : -1);
      sx = null;
    }, { passive: true });
  }
  function showLb(animDir) {
    var w = shown[lbIndex];
    if (!w) return;
    var fig = lb.querySelector('.wk-lb-fig'), img = fig.querySelector('img');
    var swap = function () {
      img.src = w.image; img.alt = w.alt;
      lb.querySelector('.wk-lb-cat').textContent = label(w.category);
      lb.querySelector('.wk-lb-title').textContent = w.title;
      lb.querySelector('.wk-lb-count').textContent = (lbIndex + 1) + ' / ' + shown.length;
      fig.classList.remove('out'); fig.classList.add('in');
      setTimeout(function () { fig.classList.remove('in'); }, 600);
    };
    if (reduce || !animDir) { swap(); return; }
    fig.classList.add('out');
    setTimeout(swap, 260);
  }
  function openLb(i) {
    if (!lb) buildLb();
    lbIndex = i;
    lb.classList.add('open');
    document.body.classList.add('wk-lock');
    showLb(false);
    requestAnimationFrame(function () { lb.classList.add('in'); });
    lb.querySelector('.wk-lb-x').focus({ preventScroll: true });
  }
  function closeLb() {
    if (!lb) return;
    lb.classList.remove('in');
    setTimeout(function () { lb.classList.remove('open'); document.body.classList.remove('wk-lock'); }, 380);
  }
  function stepLb(d) {
    if (!shown.length) return;
    lbIndex = (lbIndex + d + shown.length) % shown.length;
    showLb(true);
  }

  function load() {
    fetch('/api/works').then(function (r) { return r.json(); }).then(function (d) {
      var nw = (d.works || []).filter(function (w) { return !!w.image; });
      var sg = JSON.stringify(nw); if (sg === load.sig) return; load.sig = sg;
      works = nw;
      draw(false);
      drawShowcase();
      var count = document.getElementById('work-count');
      if (count) count.textContent = works.length;
    }).catch(function () { grid.innerHTML = '<p class="wk-empty muted">Our recent work could not load. Please refresh.</p>'; });
  }
  load();
  window.addEventListener('debone:refresh', load);
})();
