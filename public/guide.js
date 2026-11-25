/* DEBONE guide page: reads the guide from /api/guide, shows it, searches it, reads it aloud and downloads the PDF. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);
  var wanted = params.get('for') === 'staff' ? 'staff' : params.get('for') === 'student' ? 'student' : '';
  var G = null, canStaff = false, audience = 'student';
  var blocks = [];            // everything that can be read aloud, in order: { id, text, sec }
  var chunks = [];            // short pieces of speech: { text, id, sec }
  var secFirst = {};          // section id -> first chunk index
  var secOrder = [];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(msg) { var t = $('g-toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('show'); }, 4200); }
  var ICON = {
    speaker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
    download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M4 19h16"/></svg>',
    tour: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>',
    open: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5"/></svg>'
  };

  /* ---------- building the page and the speech script ---------- */
  var bid = 0;
  function add(text, sec) { var id = 'b' + (++bid); blocks.push({ id: id, text: text, sec: sec }); return id; }
  function stop(t) { t = String(t).trim(); return /[.!?:]$/.test(t) ? t : t + '.'; }

  function secHtml(s, n) {
    var own = (audience === 'staff') === canStaff && (canStaff || audience === 'student');
    var base = audience === 'staff' ? 'admin.html' : 'dashboard.html';
    var h = '<section class="g-sec" id="sec-' + esc(s.id) + '" data-sec="' + esc(s.id) + '">';
    h += '<p class="g-grp">' + esc(s.group) + '</p>';
    h += '<h2 data-b="' + add('Section ' + n + '. ' + s.title + '.', s.id) + '">' + esc(s.title) + (s.adminOnly ? '<span class="g-badge">ADMIN ONLY</span>' : '') + '</h2>';
    if (s.summary) h += '<p class="g-summary" data-b="' + add(s.summary, s.id) + '">' + esc(s.summary) + '</p>';
    h += '<div class="g-row"><button type="button" class="g-mini" data-listen="' + esc(s.id) + '">' + ICON.speaker + 'Listen from here</button>';
    if (s.view && own) h += '<a class="g-mini" href="' + base + '#' + esc(s.view) + '">' + ICON.open + 'Open this page</a>';
    h += '</div>';
    h += '<p class="g-lab">What this is for</p><p class="g-what" data-b="' + add('What this is for. ' + s.what, s.id) + '">' + esc(s.what) + '</p>';
    if (s.steps && s.steps.length) {
      h += '<p class="g-lab">Step by step</p><ol class="g-steps">';
      s.steps.forEach(function (t, i) { h += '<li data-b="' + add('Step ' + (i + 1) + '. ' + t, s.id) + '">' + esc(t) + '</li>'; });
      h += '</ol>';
    }
    if (s.tips && s.tips.length) {
      h += '<p class="g-lab">Good to know</p>';
      s.tips.forEach(function (t, i) { h += '<p class="g-note" data-b="' + add((i === 0 ? 'Good to know. ' : '') + t, s.id) + '">' + esc(t) + '</p>'; });
    }
    if (s.mistakes && s.mistakes.length) {
      h += '<p class="g-lab">If something goes wrong</p>';
      s.mistakes.forEach(function (t, i) { h += '<p class="g-note warn" data-b="' + add((i === 0 ? 'If something goes wrong. ' : '') + t, s.id) + '">' + esc(t) + '</p>'; });
    }
    return h + '</section>';
  }

  function render() {
    var title = G.title;
    document.title = title + ' | DEBONE';
    var back = $('g-back'); back.href = canStaff ? 'admin.html' : 'dashboard.html';
    back.querySelector('span').textContent = canStaff ? 'Back to admin panel' : 'Back to dashboard';
    if (canStaff) {
      var tabs = $('g-tabs'); tabs.hidden = false;
      tabs.innerHTML = '<a href="guide.html?for=staff" class="' + (audience === 'staff' ? 'on' : '') + '">Staff guide</a><a href="guide.html?for=student" class="' + (audience === 'student' ? 'on' : '') + '">Student guide</a>';
    }
    blocks = []; bid = 0;
    var introId = add(G.title + '. ' + G.subtitle + '. ' + G.intro.join(' '), 'intro');
    var hero = '<p class="g-eyebrow">DEBONE Photos &amp; Video Editing Studio</p><h1 data-b="' + introId + '">' + esc(G.title) + '</h1><p class="g-sub">' + esc(G.subtitle) + '</p><div class="g-intro">' + G.intro.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div>';
    hero += '<div class="g-actions"><button type="button" class="g-btn solid" id="g-listen">' + ICON.speaker + 'Listen to the full guide</button>' +
      '<button type="button" class="g-btn" id="g-pdf">' + ICON.download + 'Download PDF</button>' +
      '<button type="button" class="g-btn" id="g-tour">' + ICON.tour + 'Take the tour</button></div>' +
      '<div class="g-search"><input type="search" id="g-q" placeholder="Search the guide, for example: refund, certificate, payment" aria-label="Search the guide" autocomplete="off"><button type="button" id="g-qx" aria-label="Clear search" hidden>&times;</button></div><div class="g-count" id="g-count" aria-live="polite"></div>';
    $('g-hero').innerHTML = hero;

    var main = '';
    G.sections.forEach(function (s, i) { main += secHtml(s, i + 1); });
    // why it is better
    var B = G.better;
    main += '<section class="g-block" id="sec-better" data-sec="better"><p class="g-grp">The difference</p><h2 data-b="' + add(B.title + '.', 'better') + '">' + esc(B.title) + '</h2><p class="g-what" data-b="' + add(B.intro, 'better') + '">' + esc(B.intro) + '</p><div class="g-row" style="margin-top:14px"><button type="button" class="g-mini" data-listen="better">' + ICON.speaker + 'Listen from here</button></div><div class="g-cards">';
    B.points.forEach(function (p, i) {
      main += '<article class="g-card" data-b="' + add('Number ' + (i + 1) + '. ' + p.title + '. ' + p.text + ' The usual way: ' + p.usual, 'better') + '"><h3>' + esc(p.title) + '</h3><p>' + esc(p.text) + '</p><p class="usual">The usual way: ' + esc(p.usual) + '</p></article>';
    });
    main += '</div><div class="g-table"><table><thead><tr><th>What you need</th><th>DEBONE</th><th>The usual way</th></tr></thead><tbody>' +
      B.table.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td class="y">' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td></tr>'; }).join('') + '</tbody></table></div></section>';
    add('Side by side. DEBONE does all of these: ' + B.table.map(function (r) { return r[0]; }).join('. ') + '.', 'better');
    // glossary + faq
    main += '<section class="g-block" id="sec-words" data-sec="words"><p class="g-grp">Reference</p><h2 data-b="' + add('Words explained.', 'words') + '">Words explained</h2><div class="g-gl">' +
      G.glossary.map(function (g) { return '<div data-b="' + add(g[0] + '. ' + g[1], 'words') + '"><b>' + esc(g[0]) + '</b><span>' + esc(g[1]) + '</span></div>'; }).join('') + '</div></section>';
    main += '<section class="g-block g-faq" id="sec-faq" data-sec="faq"><p class="g-grp">Quick answers</p><h2 data-b="' + add('Common questions.', 'faq') + '">Common questions</h2>' +
      G.faq.map(function (q) { return '<details data-b="' + add('Question. ' + q[0] + ' Answer. ' + q[1], 'faq') + '"><summary>' + esc(q[0]) + '</summary><p>' + esc(q[1]) + '</p></details>'; }).join('') + '</section>';
    main += '<div class="g-empty" id="g-none" hidden>Nothing matches your search. Try a simpler word.</div>';
    $('g-main').innerHTML = main;

    // contents
    var toc = '<details open class="g-tocd"><summary class="g-tocs"><h2 style="display:inline">CONTENTS</h2></summary>', last = null;
    G.sections.forEach(function (s, i) {
      if (s.group !== last) { last = s.group; toc += '<p class="tg">' + esc(s.group) + '</p>'; }
      toc += '<a href="#sec-' + esc(s.id) + '" data-t="' + esc(s.id) + '">' + (i + 1) + '. ' + esc(s.title) + '</a>';
    });
    toc += '<p class="tg">More</p><a href="#sec-better" data-t="better">Why DEBONE is better</a><a href="#sec-words" data-t="words">Words explained</a><a href="#sec-faq" data-t="faq">Common questions</a></details>';
    $('g-toc').innerHTML = toc;
    if (window.innerWidth <= 900) $('g-toc').querySelector('details').removeAttribute('open');

    buildChunks();
    wire();
    if (location.hash) { var t = document.querySelector(location.hash.replace(/[^#\w-]/g, '')); if (t) setTimeout(function () { t.scrollIntoView(); }, 60); }
  }

  /* ---------- voice ---------- */
  var synth = window.speechSynthesis, canSpeak = !!(synth && window.SpeechSynthesisUtterance);
  var idx = 0, playing = false, token = 0, lastStart = 0, voices = [], rate = 1, voiceURI = '';
  try { rate = parseFloat(localStorage.getItem('guide-rate')) || 1; voiceURI = localStorage.getItem('guide-voice') || ''; } catch (e) {}

  function split(text) {
    var out = [], buf = '';
    var parts = String(text).match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [text];
    parts.forEach(function (p) {
      p = p.trim(); if (!p) return;
      while (p.length > 190) { var cut = p.lastIndexOf(',', 190); if (cut < 70) cut = p.lastIndexOf(' ', 190); if (cut < 40) cut = 190; push(p.slice(0, cut + 1)); p = p.slice(cut + 1).trim(); }
      if (p) push(p);
    });
    function push(s) { s = s.trim(); if (!s) return; if ((buf + ' ' + s).length <= 190 && buf) buf += ' ' + s; else { if (buf) out.push(buf); buf = s; } }
    if (buf) out.push(buf);
    return out;
  }
  function buildChunks() {
    chunks = []; secFirst = {}; secOrder = [];
    blocks.forEach(function (b) {
      if (!(b.sec in secFirst)) { secFirst[b.sec] = chunks.length; secOrder.push(b.sec); }
      split(stop(b.text)).forEach(function (t) { chunks.push({ text: t, id: b.id, sec: b.sec }); });
    });
  }
  function secTitle(id) {
    if (id === 'intro') return G.title;
    if (id === 'better') return G.better.title;
    if (id === 'words') return 'Words explained';
    if (id === 'faq') return 'Common questions';
    var s = G.sections.filter(function (x) { return x.id === id; })[0]; return s ? s.title : '';
  }
  function loadVoices() {
    voices = synth.getVoices() || [];
    var sel = $('gp-voice'); if (!sel) return;
    var en = voices.filter(function (v) { return /^en/i.test(v.lang); }), rest = voices.filter(function (v) { return !/^en/i.test(v.lang); });
    var list = en.concat(rest);
    sel.innerHTML = list.map(function (v) { return '<option value="' + esc(v.voiceURI) + '">' + esc(v.name + ' (' + v.lang + ')') + '</option>'; }).join('');
    var pick = list.filter(function (v) { return v.voiceURI === voiceURI; })[0] ||
      ['en-NG', 'en-GB', 'en-US'].map(function (l) { return en.filter(function (v) { return v.lang.replace('_', '-') === l; })[0]; }).filter(Boolean)[0] || list[0];
    if (pick) { sel.value = pick.voiceURI; voiceURI = pick.voiceURI; }
  }
  function currentVoice() { return voices.filter(function (v) { return v.voiceURI === voiceURI; })[0] || null; }
  function mark(id) {
    document.querySelectorAll('.reading').forEach(function (e) { e.classList.remove('reading'); });
    var el = document.querySelector('[data-b="' + id + '"]');
    if (el) { el.classList.add('reading'); var r = el.getBoundingClientRect(); if (r.top < 90 || r.bottom > window.innerHeight - 190) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }
  function ui() {
    var p = $('g-player'); p.hidden = false; p.classList.toggle('paused', !playing);
    $('gp-play').setAttribute('aria-label', playing ? 'Pause' : 'Play');
    var c = chunks[Math.min(idx, chunks.length - 1)];
    if (c) { $('gp-title').textContent = secTitle(c.sec); }
    $('gp-bar').style.width = (chunks.length ? Math.min(100, idx / chunks.length * 100) : 0) + '%';
  }
  function speakNext(myToken) {
    if (myToken !== token || !playing) return;
    if (idx >= chunks.length) { endAll(true); return; }
    var c = chunks[idx], u = new SpeechSynthesisUtterance(c.text);
    var v = currentVoice(); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-GB';
    u.rate = rate;
    u.onend = function () { if (myToken !== token || !playing) return; idx++; speakNext(myToken); };
    u.onerror = function (e) { if (myToken !== token || !playing) return; if (e && (e.error === 'interrupted' || e.error === 'canceled')) return; idx++; speakNext(myToken); };
    mark(c.id); ui(); lastStart = Date.now();
    synth.speak(u);
  }
  function playFrom(i) {
    if (!canSpeak) { toast('Your browser cannot read aloud. Try Chrome, Edge or Safari.'); return; }
    synth.cancel(); token++; idx = Math.max(0, Math.min(i, chunks.length - 1)); playing = true;
    var t = token; setTimeout(function () { speakNext(t); }, 60);
  }
  function pause() { playing = false; token++; synth.cancel(); ui(); }
  function endAll(finished) {
    playing = false; token++; synth.cancel(); idx = 0;
    document.querySelectorAll('.reading').forEach(function (e) { e.classList.remove('reading'); });
    $('g-player').hidden = true;
    if (finished) toast('That is the end of the guide.');
  }
  function jumpSection(dir) {
    var c = chunks[idx], cur = secOrder.indexOf(c ? c.sec : 'intro'), n = Math.max(0, Math.min(secOrder.length - 1, cur + dir));
    playFrom(secFirst[secOrder[n]]);
  }
  // some phones stop without telling us: move on if nothing is being spoken
  setInterval(function () {
    if (!playing || !canSpeak) return;
    if (!synth.speaking && !synth.pending && Date.now() - lastStart > 2500) { idx++; speakNext(token); }
  }, 1500);
  window.addEventListener('pagehide', function () { if (canSpeak) synth.cancel(); });

  /* ---------- PDF ---------- */
  function downloadPdf() {
    var btn = $('g-pdf'), label = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = ICON.download + 'Preparing your PDF…';
    fetch('/api/guide/pdf?for=' + audience, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('pdf');
      var name = ((r.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/) || [])[1] || 'DEBONE-Guide.pdf';
      return r.blob().then(function (b) { return { b: b, name: name }; });
    }).then(function (o) {
      var a = document.createElement('a'); a.href = URL.createObjectURL(o.b); a.download = o.name; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
      toast('Your PDF is downloading.');
    }).catch(function () {
      toast('The PDF could not be made right now. Opening the print view: choose Save as PDF.');
      setTimeout(function () { window.print(); }, 900);
    }).then(function () { btn.disabled = false; btn.innerHTML = label; });
  }

  /* ---------- search and events ---------- */
  function search(q) {
    q = q.trim().toLowerCase();
    var shown = 0, total = 0;
    document.querySelectorAll('#g-main [data-sec]').forEach(function (el) {
      total++; var hit = !q || el.textContent.toLowerCase().indexOf(q) !== -1;
      el.hidden = !hit; if (hit) shown++;
      var link = document.querySelector('.g-toc [data-t="' + el.getAttribute('data-sec') + '"]'); if (link) link.hidden = !hit;
    });
    $('g-count').textContent = q ? (shown ? shown + ' of ' + total + ' sections match' : '') : '';
    $('g-none').hidden = !(q && !shown);
    $('g-qx').hidden = !q;
    document.querySelectorAll('#g-main details').forEach(function (d) { if (q && d.textContent.toLowerCase().indexOf(q) !== -1) d.open = true; });
  }
  function wire() {
    $('g-listen').addEventListener('click', function () { playFrom(0); });
    $('g-pdf').addEventListener('click', downloadPdf);
    $('g-tour').addEventListener('click', function () { location.href = canStaff && audience === 'staff' ? 'admin.html?tour=1' : 'dashboard.html?tour=1'; });
    $('g-q').addEventListener('input', function (e) { search(e.target.value); });
    $('g-qx').addEventListener('click', function () { $('g-q').value = ''; search(''); $('g-q').focus(); });
    $('g-main').addEventListener('click', function (e) { var b = e.target.closest('[data-listen]'); if (b) playFrom(secFirst[b.getAttribute('data-listen')] || 0); });
    $('gp-play').addEventListener('click', function () { if (playing) pause(); else playFrom(idx); });
    $('gp-stop').addEventListener('click', function () { endAll(false); });
    $('gp-prev').addEventListener('click', function () { jumpSection(-1); });
    $('gp-next').addEventListener('click', function () { jumpSection(1); });
    $('gp-rate').value = String(rate);
    $('gp-rate').addEventListener('change', function (e) { rate = parseFloat(e.target.value) || 1; try { localStorage.setItem('guide-rate', rate); } catch (x) {} if (playing) playFrom(idx); });
    $('gp-voice').addEventListener('change', function (e) { voiceURI = e.target.value; try { localStorage.setItem('guide-voice', voiceURI); } catch (x) {} if (playing) playFrom(idx); });
    if (!canSpeak) { $('g-listen').disabled = true; $('g-hero').insertAdjacentHTML('beforeend', '<p class="g-nosr">Reading aloud is not supported in this browser. Try Chrome, Edge or Safari, or download the PDF.</p>'); }
    else { loadVoices(); if (synth.addEventListener) synth.addEventListener('voiceschanged', loadVoices); else synth.onvoiceschanged = loadVoices; }
    var links = document.querySelectorAll('.g-toc a'), map = {};
    links.forEach(function (a) { map[a.getAttribute('data-t')] = a; });
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { links.forEach(function (a) { a.classList.remove('on'); }); var a = map[en.target.getAttribute('data-sec')]; if (a) a.classList.add('on'); } }); }, { rootMargin: '-90px 0px -65% 0px' });
      document.querySelectorAll('#g-main [data-sec]').forEach(function (s) { io.observe(s); });
    }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && playing) pause(); });
  }

  /* ---------- load ---------- */
  fetch('/api/guide' + (wanted ? '?for=' + wanted : ''), { credentials: 'same-origin', cache: 'no-store' }).then(function (r) {
    if (r.status === 401) { location.replace('login.html?next=guide'); throw new Error('login'); }
    if (r.status === 403 && wanted === 'staff') { location.replace('guide.html?for=student'); throw new Error('redirect'); }
    if (!r.ok) throw new Error('load');
    return r.json();
  }).then(function (d) {
    G = d.guide; canStaff = !!d.canReadStaff; audience = G.audience; render();
  }).catch(function (e) {
    if (e.message === 'login' || e.message === 'redirect') return;
    $('g-hero').innerHTML = '<h1>Guide</h1><p class="g-sub">The guide could not be loaded. Please check your internet and refresh the page.</p>';
  });
})();
