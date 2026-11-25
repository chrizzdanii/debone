/* Guided tour for the student dashboard and the admin panel (v23). Starts once for new users; always available from the top bar.
   Step text comes from the same guide content as the written guide (/api/guide), so the two always agree. */
(function () {
  'use strict';
  var SHELL = document.body.getAttribute('data-shell') === 'staff' ? 'staff' : 'student';
  var KEY = 'debone-tour-seen' + (SHELL === 'staff' ? '-staff' : '');
  var VKEY = 'debone-tour-voice';
  var GUIDE = null;
  var synth = window.speechSynthesis, canSpeak = !!(synth && window.SpeechSynthesisUtterance);
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var STEPS = [];
  var MENU_TEXT = {
    overview: 'Your home page. See your progress, your next lesson and your latest notices at a glance.',
    courses: 'Every course you have unlocked, with your progress. Open a course to work through its lessons one by one.',
    browse: 'Find more courses. Free courses open straight away. Paid courses unlock after one secure payment.',
    live: 'Join your instructor live, watch past recordings and ask questions in the class chat.',
    community: 'A group chat for each course. Ask questions, reply to classmates and share your progress.',
    reviews: 'Rate the courses you are enrolled in. Our team checks each review before it is published.',
    assignments: 'Submit your work here, and check your marks and feedback once your instructor has marked it.',
    performance: 'See how you are doing over time, with your marks, your progress and a tip to improve.',
    certificates: 'Request your certificate when you finish a course. Our team checks your work and issues it.',
    portfolio: 'Build your talent profile so customers can find you. Our team approves each profile before it is shown.',
    downloads: 'Your digital products. Download the files you have bought, up to the limit shown.',
    requests: 'Schedule choices and refund requests, with the progress of each one.',
    referrals: 'Share your link, track your paying friends and request a withdrawal when you reach the target.',
    payments: 'Every payment you make is listed here with its status, so you always have a record.',
    profile: 'Add your photo and personal details here. The percentage shows how complete your profile is.'
  };
  var MENU_ICON = { overview: 'grid', courses: 'book', browse: 'compass', live: 'live', community: 'chat', reviews: 'star', assignments: 'pen', performance: 'trend', certificates: 'shield', portfolio: 'user', downloads: 'book', requests: 'shield', referrals: 'user', payments: 'card', profile: 'user' };
  function sectionFor(view) {
    if (!GUIDE || !view) return null;
    for (var i = 0; i < GUIDE.sections.length; i++) if (GUIDE.sections[i].view === view) return GUIDE.sections[i];
    return null;
  }
  function sectionById(id) {
    if (!GUIDE) return null;
    for (var i = 0; i < GUIDE.sections.length; i++) if (GUIDE.sections[i].id === id) return GUIDE.sections[i];
    return null;
  }
  function guideUrl(id) { return 'guide.html?for=' + SHELL + (id ? '#sec-' + id : ''); }
  function visible(el) {
    if (!el) return false;
    var cs = window.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    return el.offsetParent !== null || cs.position === 'fixed';
  }
  function buildSteps() {
    var seen = {}, menu = [], mobile = window.innerWidth <= 900;
    var who = SHELL === 'staff' ? 'admin panel' : 'dashboard';
    Array.prototype.forEach.call(document.querySelectorAll('#side a[data-view]'), function (a) {
      var v = a.getAttribute('data-view');
      if (seen[v] || !visible(a)) return; seen[v] = true;
      var label = a.textContent.replace(/\s+/g, ' ').trim();
      var sec = sectionFor(v);
      var text = (sec && (sec.tour || sec.summary)) || MENU_TEXT[v] || ('Open ' + label + ' to see everything in this section.');
      menu.push({ title: label, text: text, target: 'a[data-view="' + v + '"]', icon: MENU_ICON[v] || 'grid', more: sec ? guideUrl(sec.id) : null });
    });
    var steps = [{ title: 'Welcome to your ' + who, text: 'This tour shows you every part of the ' + who + ', one by one. It takes a few minutes. You can skip it, go back, or start it again any time from the Take a tour button. Press the speaker button if you would like each step read to you.', target: null, icon: 'star' }];
    steps.push({ title: 'Where you are', text: 'The title at the top shows which page you are on. Whatever you choose in the menu opens in the big area below it. That area is where all your work happens.', target: '#crumb', icon: 'grid' });
    if (mobile) steps.push({ title: 'The menu button', text: 'On a phone the menu is hidden to save space. Tap this button to open it, and tap outside the menu to close it.', target: '#burger', icon: 'grid' });
    steps = steps.concat(menu);
    var extra = [
      { title: 'Take a tour', text: 'This button starts this tour again whenever you want.', target: '.tour-btn', icon: 'compass' },
      { title: 'The full guide', text: 'Open the Guide to read every page in simple words, search it, listen to it being read aloud until you stop it, or download it as a PDF to keep.', target: '.guide-btn', icon: 'book', more: guideUrl() },
      { title: 'Your name', text: 'This shows who is signed in on this device.', target: '.user-chip', icon: 'user' }
    ];
    var closing = (GUIDE && GUIDE.tourClosing) || [];
    var closeText = function (t, d) { for (var i = 0; i < closing.length; i++) if (closing[i].title === t) return closing[i].text; return d; };
    extra.push({ title: 'Notifications', text: closeText('Notifications', 'The bell shows new things that need your attention. Open it to read them.'), target: '.bell', icon: 'bell' });
    extra.push({ title: 'Log out', text: closeText('Log out', 'When you are finished, log out here to keep your account safe.'), target: '.shell-logout', icon: 'shield' });
    if (SHELL === 'student') extra.push({ title: 'The Help assistant', text: ((sectionById('helper') || {}).tour) || 'The round Help button opens the DEBONE Assistant. Ask it how to use the site, any time.', target: '.cw-fab', icon: 'chat', more: guideUrl('helper') });
    extra.forEach(function (e) { var el = document.querySelector(e.target); if (visible(el)) steps.push(e); });
    steps.push({ title: 'You are ready', text: 'That is the whole tour. Keep the Guide button handy: it has the full step by step instructions for every page, and it can read them to you.', target: null, icon: 'check', finish: true, more: guideUrl() });
    return steps;
  }

  var root, hole, card, idx = 0, active = false;

  function $(s) { return root.querySelector(s); }
  function icon(name) { return window.DIcons ? DIcons.get(name) : ''; }
  function side(open) {
    var s = document.getElementById('side'), sc = document.getElementById('scrim');
    if (!s) return;
    s.classList.toggle('open', open);
    if (sc) sc.classList.toggle('show', open);
  }

  function voiceOn() { try { return localStorage.getItem(VKEY) === '1'; } catch (e) { return false; } }
  function syncVoice() { var vb = root && $('.tour-voice'); if (vb) { vb.classList.toggle('on', voiceOn()); vb.setAttribute('aria-pressed', voiceOn() ? 'true' : 'false'); } }
  function setVoice(on) {
    try { localStorage.setItem(VKEY, on ? '1' : '0'); } catch (e) {}
    syncVoice();
    if (on) speak(); else if (canSpeak) synth.cancel();
  }
  function speak() {
    if (!canSpeak || !voiceOn() || !active) return;
    var s = STEPS[idx]; if (!s) return;
    synth.cancel();
    var u = new SpeechSynthesisUtterance(s.title + '. ' + s.text);
    var vs = synth.getVoices() || [], want = ['en-NG', 'en-GB', 'en-US'], v = null;
    for (var i = 0; i < want.length && !v; i++) v = vs.filter(function (x) { return x.lang.replace('_', '-') === want[i]; })[0];
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-GB';
    setTimeout(function () { synth.speak(u); }, 80);
  }

  function build() {
    root = document.createElement('div');
    root.className = 'tour';
    root.innerHTML =
      '<div class="tour-hole"></div>' +
      '<div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title">' +
        '<div class="tour-top"><span class="tour-ico"></span><span class="tour-count"></span>' +
        (canSpeak ? '<button type="button" class="tour-voice" aria-pressed="false" aria-label="Read each step aloud" title="Read each step aloud"></button>' : '') +
        '<button type="button" class="tour-x" aria-label="Close the tour">&times;</button></div>' +
        '<div class="tour-bar"><i></i></div>' +
        '<h3 id="tour-title"></h3>' +
        '<p class="tour-text"></p>' +
        '<a class="tour-more" target="_blank" rel="noopener" hidden>Read the full steps in the guide</a>' +
        '<div class="tour-dots"></div>' +
        '<div class="tour-nav">' +
          '<button type="button" class="btn btn-ghost btn-sm tour-prev">Back</button>' +
          '<button type="button" class="btn btn-ghost btn-sm tour-skip">Skip tour</button>' +
          '<button type="button" class="btn btn-solid btn-sm tour-next">Next</button>' +
        '</div>' +
      '</div>' +
      '<div class="tour-done" aria-hidden="true"><svg viewBox="0 0 80 80"><circle class="td-c" cx="40" cy="40" r="34"/><path class="td-p" d="M24 42l11 11 21-23"/></svg></div>';
    document.body.appendChild(root);
    hole = $('.tour-hole'); card = $('.tour-card');
    renderDots();
    $('.tour-next').addEventListener('click', next);
    $('.tour-prev').addEventListener('click', function () { go(idx - 1); });
    $('.tour-skip').addEventListener('click', close);
    $('.tour-x').addEventListener('click', close);
    var vb = $('.tour-voice');
    if (vb) { vb.innerHTML = icon('live') || '&#128266;'; vb.addEventListener('click', function () { setVoice(!voiceOn()); }); syncVoice(); }
    document.addEventListener('keydown', function (e) {
      if (!active) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') go(idx - 1);
    });
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, { passive: true });
  }

  function renderDots() {
    var box = $('.tour-dots');
    box.innerHTML = '';
    STEPS.forEach(function (_, n) {
      var b = document.createElement('button');
      b.type = 'button'; b.setAttribute('aria-label', 'Go to step ' + (n + 1));
      b.addEventListener('click', function () { go(n); });
      box.appendChild(b);
    });
  }

  function render(animate) {
    var s = STEPS[idx];
    var text = $('.tour-text'), title = $('#tour-title');
    $('.tour-ico').innerHTML = icon(s.icon);
    $('.tour-count').textContent = 'Step ' + (idx + 1) + ' of ' + STEPS.length;
    $('.tour-bar i').style.width = ((idx + 1) / STEPS.length * 100) + '%';
    $('.tour-prev').disabled = idx === 0;
    $('.tour-prev').style.visibility = idx === 0 ? 'hidden' : 'visible';
    $('.tour-next').textContent = s.finish ? 'Finish' : 'Next';
    $('.tour-skip').style.visibility = s.finish ? 'hidden' : 'visible';
    Array.prototype.forEach.call($('.tour-dots').children, function (b, n) { b.classList.toggle('on', n === idx); });
    var more = $('.tour-more');
    if (more) { if (s.more) { more.href = s.more; more.hidden = false; more.textContent = s.finish ? 'Open the full guide' : 'Read the full steps in the guide'; } else more.hidden = true; }
    var swap = function () { title.textContent = s.title; text.textContent = s.text; text.classList.remove('swap'); };
    if (animate && !reduce) { text.classList.add('swap'); setTimeout(swap, 220); } else swap();
  }

  function place() {
    if (!active) return;
    var s = STEPS[idx];
    var el = s.target ? document.querySelector(s.target) : null;
    var r = el ? el.getBoundingClientRect() : null;
    var vw = window.innerWidth, vh = window.innerHeight;
    var cw = card.offsetWidth || 360, ch = card.offsetHeight || 260;
    if (r && r.width > 0 && r.height > 0) {
      var p = 8;
      hole.style.opacity = '1';
      hole.style.left = (r.left - p) + 'px'; hole.style.top = (r.top - p) + 'px';
      hole.style.width = (r.width + p * 2) + 'px'; hole.style.height = (r.height + p * 2) + 'px';
      var top = r.bottom + 18;
      if (top + ch > vh - 12) top = r.top - ch - 18;
      if (top < 12) top = Math.max(12, (vh - ch) / 2);
      var left = r.left + r.width / 2 - cw / 2;
      left = Math.max(12, Math.min(vw - cw - 12, left));
      card.style.top = top + 'px'; card.style.left = left + 'px';
    } else {
      hole.style.opacity = '0';
      card.style.top = Math.max(12, (vh - ch) / 2) + 'px';
      card.style.left = Math.max(12, (vw - cw) / 2) + 'px';
    }
  }

  function go(n) {
    if (n < 0 || n >= STEPS.length) return;
    idx = n;
    var s = STEPS[idx];
    var mobile = window.innerWidth <= 900;
    side(mobile && !!s.target && /a\[data-view|#side/.test(s.target));
    var el = s.target ? document.querySelector(s.target) : null;
    if (el) el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    render(true);
    speak();
    setTimeout(place, reduce ? 0 : 350);
    setTimeout(place, 800);
  }

  function next() {
    if (STEPS[idx].finish) return finish();
    go(idx + 1);
  }

  function open() {
    loadGuide(function () {
      STEPS = buildSteps();
      if (!root) build(); else renderDots();
      syncVoice();
      active = true;
      root.style.display = 'block';
      root.classList.remove('closing');
      side(false);
      go(0);
    });
  }
  function loadGuide(cb) {
    if (GUIDE) return cb();
    fetch('/api/guide?for=' + SHELL, { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { GUIDE = d && d.guide ? d.guide : null; cb(); }).catch(function () { cb(); });
  }

  function close() {
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
    active = false;
    if (canSpeak) synth.cancel();
    side(false);
    root.classList.add('closing');
    setTimeout(function () { root.style.display = 'none'; }, reduce ? 0 : 350);
  }

  function finish() {
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
    active = false;
    if (canSpeak) synth.cancel();
    side(false);
    var done = root.querySelector('.tour-done');
    done.classList.add('show');
    root.querySelector('.tour-card').style.opacity = '0';
    setTimeout(function () {
      done.classList.remove('show');
      close();
      root.querySelector('.tour-card').style.opacity = '';
    }, 2600);
  }

  function addButton() {
    var bar = document.querySelector('.top-actions');
    if (!bar || bar.querySelector('.tour-btn')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-ghost btn-sm tour-btn';
    b.innerHTML = '<span class="tour-btn-ico">' + icon('compass') + '</span><span>Take a tour</span>';
    b.addEventListener('click', open);
    bar.insertBefore(b, bar.firstChild);
    if (!bar.querySelector('.guide-btn')) {
      var g = document.createElement('a');
      g.className = 'btn btn-ghost btn-sm guide-btn';
      g.href = 'guide.html?for=' + SHELL;
      g.innerHTML = '<span class="tour-btn-ico">' + icon('book') + '</span><span>Guide</span>';
      bar.insertBefore(g, b.nextSibling);
    }
  }

  addButton();
  var seen = false;
  try { seen = !!localStorage.getItem(KEY); } catch (e) {}
  var asked = /(^|[?&])tour=1(&|$)/.test(location.search);
  if (asked) { try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {} }
  if ((asked || !seen) && document.getElementById('side')) setTimeout(open, asked ? 900 : (SHELL === 'staff' ? 2200 : 1100));
})();
