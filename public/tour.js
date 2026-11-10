/* Guided tour of the student dashboard (v22). Starts once for new students; always available from the top bar. */
(function () {
  'use strict';
  var KEY = 'debone-tour-seen';
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
  function buildSteps() {
    var seen = {}, menu = [];
    Array.prototype.forEach.call(document.querySelectorAll('#side a[data-view]'), function (a) {
      var v = a.getAttribute('data-view');
      if (seen[v]) return; seen[v] = true;
      var label = a.textContent.replace(/\s+/g, ' ').trim();
      menu.push({ title: label, text: MENU_TEXT[v] || ('Open ' + label + ' to see everything in this section.'), target: 'a[data-view="' + v + '"]', icon: MENU_ICON[v] || 'grid' });
    });
    return [ { title: 'Welcome to your dashboard', text: 'This short tour shows you where everything is. It takes about a minute. You can skip it, or start it again any time from the Take a tour button.', target: null, icon: 'star' } ].concat(menu, [ { title: 'Notifications', text: 'The bell shows new announcements, live classes, assignments and marks. Open it to read them.', target: '.bell', icon: 'bell' }, { title: 'Log out', text: 'When you are finished, log out here to keep your account safe.', target: '.shell-logout', icon: 'shield' }, { title: 'You are ready', text: 'That is the tour. You can start it again any time from the Take a tour button at the top.', target: null, icon: 'check', finish: true } ]);
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

  function build() {
    root = document.createElement('div');
    root.className = 'tour';
    root.innerHTML =
      '<div class="tour-hole"></div>' +
      '<div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title">' +
        '<div class="tour-top"><span class="tour-ico"></span><span class="tour-count"></span>' +
        '<button type="button" class="tour-x" aria-label="Close the tour">&times;</button></div>' +
        '<div class="tour-bar"><i></i></div>' +
        '<h3 id="tour-title"></h3>' +
        '<p class="tour-text"></p>' +
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
    setTimeout(place, reduce ? 0 : 350);
    setTimeout(place, 800);
  }

  function next() {
    if (STEPS[idx].finish) return finish();
    go(idx + 1);
  }

  function open() {
    STEPS = buildSteps();
    if (!root) build(); else renderDots();
    active = true;
    root.style.display = 'block';
    root.classList.remove('closing');
    side(false);
    go(0);
  }

  function close() {
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
    active = false;
    side(false);
    root.classList.add('closing');
    setTimeout(function () { root.style.display = 'none'; }, reduce ? 0 : 350);
  }

  function finish() {
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
    active = false;
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
  }

  addButton();
  var seen = false;
  try { seen = !!localStorage.getItem(KEY); } catch (e) {}
  if (!seen && document.getElementById('side')) setTimeout(open, 1100);
})();
