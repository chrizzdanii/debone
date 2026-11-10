/* Student assistant: a chat in the dashboard that answers questions (v27). */
(function () {
  'use strict';
  if (!document.getElementById('side')) return;
  var KEY = 'debone-chat-v1';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var history = [];
  var busy = false, panel, log, form, input, chips, sendBtn, fab, typing = null, handoff = 'https://wa.me/2348035988889';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(name) { return window.DIcons ? DIcons.get(name) : ''; }
  var SUGGEST = ['How do I enrol in a course?', 'My payment went through but the course is locked', 'How do I submit an assignment?', 'What do the grade colours mean?', 'How do I reset my password?'];

  function build() {
    fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'cw-fab';
    fab.setAttribute('aria-label', 'Open the help assistant');
    fab.innerHTML = '<span class="cw-ring"></span><span class="cw-fab-ico">' + icon('chat') + '</span><span class="cw-fab-tag">Help</span>';
    panel = document.createElement('section');
    panel.className = 'cw-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'DEBONE assistant');
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML =
      '<header class="cw-head"><span class="cw-avatar">D</span><div class="cw-who"><b>DEBONE Assistant</b><span class="cw-status"><i></i>Online. Ask me anything about the site.</span></div>' +
        '<button type="button" class="cw-close" aria-label="Close">&times;</button></header>' +
      '<div class="cw-log" aria-live="polite"></div>' +
      '<div class="cw-chips"></div>' +
      '<form class="cw-form" autocomplete="off"><input class="cw-input" maxlength="1000" placeholder="Type your question…" aria-label="Your question"><button type="submit" class="cw-send" aria-label="Send">' + icon('chat') + '</button></form>' +
      '<p class="cw-foot">Need a person? <a href="' + handoff + '" target="_blank" rel="noopener" class="cw-wa">Message the studio on WhatsApp</a></p>';
    document.body.appendChild(fab);
    document.body.appendChild(panel);
    log = panel.querySelector('.cw-log'); form = panel.querySelector('.cw-form'); input = panel.querySelector('.cw-input');
    chips = panel.querySelector('.cw-chips'); sendBtn = panel.querySelector('.cw-send');
    fab.addEventListener('click', open);
    panel.querySelector('.cw-close').addEventListener('click', close);
    form.addEventListener('submit', function (e) { e.preventDefault(); send(input.value); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panel.classList.contains('open')) close(); });
  }

  function open() {
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    fab.classList.add('hide');
    requestAnimationFrame(function () { panel.classList.add('in'); });
    setTimeout(function () { input.focus({ preventScroll: true }); }, 350);
    scroll();
  }
  function close() {
    panel.classList.remove('in');
    panel.setAttribute('aria-hidden', 'true');
    setTimeout(function () { panel.classList.remove('open'); fab.classList.remove('hide'); }, 300);
    fab.focus({ preventScroll: true });
  }
  function scroll() { requestAnimationFrame(function () { log.scrollTop = log.scrollHeight; }); }

  function bubble(role, text, extra) {
    var b = document.createElement('div');
    b.className = 'cw-msg ' + role;
    b.innerHTML = (role === 'bot' ? '<span class="cw-mini">D</span>' : '') + '<div class="cw-bubble"><p></p>' + (extra || '') + '</div>';
    log.appendChild(b);
    b.classList.add('enter');
    scroll();
    return b;
  }
  function typeOut(el, text) {
    var p = el.querySelector('p');
    if (reduce) { p.textContent = text; scroll(); return Promise.resolve(); }
    var step = Math.max(1, Math.ceil(text.length / 160)), i = 0;
    return new Promise(function (resolve) {
      (function tick() {
        i = Math.min(text.length, i + step);
        p.textContent = text.slice(0, i);
        scroll();
        if (i < text.length) setTimeout(tick, 16); else resolve();
      })();
    });
  }
  function showTyping() {
    typing = document.createElement('div');
    typing.className = 'cw-msg bot enter';
    typing.innerHTML = '<span class="cw-mini">D</span><div class="cw-bubble cw-typing"><i></i><i></i><i></i></div>';
    log.appendChild(typing); scroll();
  }
  function hideTyping() { if (typing) { typing.remove(); typing = null; } }
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(history.slice(-30))); } catch (e) {} }

  function renderChips(list) {
    chips.innerHTML = '';
    (list || SUGGEST).slice(0, 4).forEach(function (t, i) {
      var c = document.createElement('button');
      c.type = 'button';
      c.className = 'cw-chip';
      c.style.setProperty('--i', i);
      c.textContent = t;
      c.addEventListener('click', function () { send(t); });
      chips.appendChild(c);
    });
  }

  async function send(raw) {
    var text = String(raw || '').trim();
    if (!text || busy) return;
    busy = true; sendBtn.disabled = true;
    input.value = '';
    chips.innerHTML = '';
    bubble('user', text);
    history.push({ role: 'user', content: text });
    showTyping();
    try {
      var res = await fetch('/api/chat', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-10) }) });
      var data = await res.json().catch(function () { return {}; });
      if (res.status === 401) { location.replace('login.html?next=dashboard'); return; }
      if (!res.ok) throw new Error(data.error || 'I could not answer just now. Please try again.');
      hideTyping();
      var extra = data.source === 'fallback' ? '<a class="cw-action" href="' + esc(data.handoff || handoff) + '" target="_blank" rel="noopener">Message the studio on WhatsApp</a>' : '';
      var el = bubble('bot', '', extra);
      await typeOut(el, data.reply);
      history.push({ role: 'assistant', content: data.reply });
      save();
      renderChips(data.suggestions);
    } catch (err) {
      hideTyping();
      var e = bubble('bot', '', '');
      await typeOut(e, err.message);
      e.querySelector('.cw-bubble').classList.add('cw-error');
    } finally {
      busy = false; sendBtn.disabled = false;
      input.focus({ preventScroll: true });
    }
  }

  function start() {
    build();
    var prior = [];
    try { prior = JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch (e) {}
    if (prior.length) {
      history = prior;
      prior.forEach(function (m) { var b = bubble(m.role === 'user' ? 'user' : 'bot', '', ''); b.querySelector('p').textContent = m.content; b.classList.add('restored'); });
    } else {
      var greetFor = function (n) { return 'Hi ' + n + '! I am the DEBONE assistant. I can help with enrolling, payments, coupons, assignments, your results, your profile, live classes and passwords. What would you like help with?'; };
      var greetEl = bubble('bot', '');
      greetEl.querySelector('p').textContent = greetFor('there');
      fetch('/api/me', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        if (d && d.user && d.user.name) {
          var first = d.user.name.split(' ')[0];
          greetEl.querySelector('p').textContent = greetFor(first);
        }
      }).catch(function () {});
    }
    renderChips(SUGGEST);
  }
  start();
})();
