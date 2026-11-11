(function () {
  'use strict';

  var view = document.getElementById('view');
  var crumb = document.getElementById('crumb');
  var chatTimer = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  async function api(url, opts) {
    opts = opts || {};
    var init = { method: opts.method || 'GET', credentials: 'same-origin', headers: {} };
    if (opts.body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    init.signal = AbortSignal.timeout(15000);
    var res = await fetch(url, init);
    if (res.status === 401) { location.replace('login.html?next=dashboard'); throw new Error('Please log in.'); }
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) { var e = new Error(data.error || 'Something went wrong.'); e.status = res.status; throw e; }
    return data;
  }
  function toast(msg, kind) {
    var host = document.getElementById('toasts');
    var t = document.createElement('div');
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.textContent = msg;
    host.appendChild(t);
    requestAnimationFrame(function () { requestAnimationFrame(function () { t.classList.add('show'); }); });
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 600); }, 3800);
  }
  function stopChat() { if (chatTimer) { clearInterval(chatTimer); chatTimer = null; } }
  function setView(html) {
    stopChat();
    view.innerHTML = html;
    view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter');
  }
  function head(eyebrow, title, sub) {
    return '<header class="view-head"><p class="eyebrow">' + esc(eyebrow) + '</p><h1>' + esc(title) + '</h1>' + (sub ? '<p class="muted">' + esc(sub) + '</p>' : '') + '</header>';
  }
  function empty(msg) { return '<div class="empty-state">' + esc(msg) + '</div>'; }

  var STATUS = { scheduled: 'Scheduled', live: 'Live now', ended: 'Ended' };

  /* ---------- Live classes ---------- */
  async function renderLive(arg) {
    setView(head('Learn live', 'Live classes', 'Join your instructor live, watch recordings and ask questions in the class chat.') + '<div class="skeleton" style="min-height:300px"></div>');
    crumb.textContent = 'Live classes';
    var dash = await api('/api/dashboard');
    var enrolled = dash.courses.filter(function (c) { return c.enrolled; });
    if (!enrolled.length) { setView(head('Learn live', 'Live classes') + empty('Enrol in a course to see its live classes.')); return; }

    var all = [];
    for (var i = 0; i < enrolled.length; i++) {
      var r = await api('/api/courses/' + encodeURIComponent(enrolled[i].id) + '/sessions');
      r.sessions.forEach(function (s) { all.push(s); });
    }
    var live = all.filter(function (s) { return s.status === 'live'; });
    var upcoming = all.filter(function (s) { return s.status === 'scheduled'; });
    var past = all.filter(function (s) { return s.status === 'ended'; });
    var selected = all.find(function (s) { return s.id === arg; }) || live[0] || upcoming[0] || past[0] || null;

    function card(s) {
      return '<button class="session-card' + (selected && s.id === selected.id ? ' active' : '') + '" type="button" data-session="' + esc(s.id) + '">' +
        '<span class="tag ' + (s.status === 'live' ? 'live' : s.status === 'ended' ? '' : 'paid') + '">' + (s.status === 'live' ? '<i class="dot"></i>' : '') + STATUS[s.status] + '</span>' +
        '<b>' + esc(s.title) + '</b><span>' + esc(s.courseTitle) + (s.startsAt ? ' · ' + esc(fmt(s.startsAt)) : '') + '</span></button>';
    }
    var list = '';
    if (live.length) list += '<h3 class="list-h">Live now</h3>' + live.map(card).join('');
    if (upcoming.length) list += '<h3 class="list-h">Upcoming</h3>' + upcoming.map(card).join('');
    if (past.length) list += '<h3 class="list-h">Past classes</h3>' + past.map(card).join('');
    if (!all.length) list = empty('No live classes have been scheduled yet.');

    var player = '<div class="empty-state">Choose a class to join.</div>';
    if (selected) {
      var media = selected.embedUrl
        ? '<div class="video-frame"><iframe src="' + esc(selected.embedUrl) + '" title="' + esc(selected.title) + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div>'
        : '<div class="video-frame video-wait"><div><p class="eyebrow">' + (selected.status === 'scheduled' ? 'Starts ' + esc(fmt(selected.startsAt)) : 'Video not available yet') + '</p>' +
          '<p class="muted">' + (selected.joinUrl ? 'Your instructor is hosting this class in a video room.' : 'The video link will appear here when the class starts.') + '</p></div></div>';
      var extras = '';
      if (selected.joinUrl && selected.joinOpen) extras += '<a class="btn btn-solid join-now" target="_blank" rel="noopener" href="' + esc(selected.joinUrl) + '"><span class="join-dot"></span>Join class now</a> ';
      else if (selected.joinUrl) extras += '<span class="join-wait">Join opens 15 minutes before the class</span> ';
      if ((selected.joinOpen || selected.liveOpen) && !selected.attended) extras += '<button class="btn btn-ghost btn-sm" type="button" id="attend-btn">I am attending</button> ';
      if (selected.attended) extras += '<span class="gpill pass">You are checked in</span> ';
      if (selected.countdownTo) extras += '<div class="countdown" data-countdown="' + esc(selected.countdownTo) + '" aria-live="off"></div>';
      if (selected.recordingUrl) extras += '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" data-watched="' + esc(selected.id) + '" href="' + esc(selected.recordingUrl) + '">Watch recording</a> ';
      if (selected.watchUrl) extras += '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="' + esc(selected.watchUrl) + '">Open on YouTube</a>';
      player = '<div class="player-head"><div><p class="eyebrow">' + esc(selected.courseTitle) + '</p><h2>' + esc(selected.title) + '</h2></div>' +
        '<span class="tag ' + (selected.status === 'live' ? 'live' : '') + '">' + STATUS[selected.status] + '</span></div>' +
        media + '<div class="player-actions">' + extras + '</div>' +
        '<div class="chat"><div class="chat-head"><b>Class chat</b><span class="muted">Ask questions. Your instructor reads and replies here.</span></div>' +
        '<div class="chat-log" id="chat-log" aria-live="polite"></div>' +
        (selected.chatOpen === false ? '<p class="chat-closed">The instructor has closed the chat for this class.</p>' : '<form class="chat-form" id="chat-form"><input class="input" id="chat-input" maxlength="500" placeholder="Type your question…" autocomplete="off"><button class="btn btn-solid btn-sm" type="submit">Send</button></form>') + '</div>';
    }

    setView(head('Learn live', 'Live classes', 'Join your instructor live, watch recordings and ask questions in the class chat.') +
      '<div class="live-layout"><aside class="live-list stagger">' + list + '</aside><section class="live-main">' + player + '</section></div>');

    view.querySelectorAll('[data-session]').forEach(function (b) {
      b.addEventListener('click', function () { location.hash = '#live/' + b.getAttribute('data-session'); });
    });
    if (selected) startChat(selected.id);
    var att = document.getElementById('attend-btn');
    if (att) att.addEventListener('click', function () {
      att.disabled = true;
      api('/api/sessions/' + encodeURIComponent(selected.id) + '/attend', { method: 'POST', body: {} })
        .then(function () { toast('Checked in. Enjoy the class!'); renderLive(selected.id); })
        .catch(function (err) { toast(err.message, 'err'); att.disabled = false; });
    });
    view.querySelectorAll('[data-watched]').forEach(function (a) {
      a.addEventListener('click', function () {
        // Opening the recording counts as doing the class, so the next lesson can unlock
        api('/api/sessions/' + encodeURIComponent(a.getAttribute('data-watched')) + '/watched', { method: 'POST', body: {} }).catch(function () {});
      });
    });
    startCountdowns();
  }
  function startCountdowns() {
    var els = document.querySelectorAll('[data-countdown]');
    if (!els.length) return;
    function tick() {
      els.forEach(function (el) {
        var ms = new Date(el.getAttribute('data-countdown')).getTime() - Date.now();
        if (ms <= 0) { el.innerHTML = '<b>Starting now</b>'; return; }
        var h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000), s = Math.floor(ms % 60000 / 1000);
        el.innerHTML = '<span>Starts in</span><b>' + (h ? h + 'h ' : '') + String(m).padStart(2, '0') + 'm ' + String(s).padStart(2, '0') + 's</b>';
      });
    }
    tick();
    clearInterval(window.__countdown);
    window.__countdown = setInterval(tick, 1000);
  }

  var lastStamp = '';
  function drawMessages(msgs, replace) {
    var log = document.getElementById('chat-log');
    if (!log) return;
    if (replace) log.innerHTML = '';
    if (!msgs.length && replace) { log.innerHTML = '<p class="chat-empty muted">No messages yet. Say hello.</p>'; return; }
    var nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    var empty0 = log.querySelector('.chat-empty'); if (empty0 && msgs.length) empty0.remove();
    msgs.forEach(function (m) {
      var staff = m.role === 'admin' || m.role === 'instructor';
      var row = document.createElement('div');
      row.className = 'msg' + (m.mine ? ' mine' : '') + (staff ? ' staff' : '');
      row.innerHTML = '<div class="msg-meta"><b>' + esc(m.name) + '</b>' + (staff ? '<span class="badge">Instructor</span>' : '') +
        '<span>' + esc(fmt(m.createdAt)) + '</span></div><p>' + esc(m.text) + '</p>';
      log.appendChild(row);
      lastStamp = m.createdAt > lastStamp ? m.createdAt : lastStamp;
    });
    if (nearBottom || replace) log.scrollTop = log.scrollHeight;
  }

  async function pollChat(sessionId) {
    try {
      var r = await api('/api/sessions/' + encodeURIComponent(sessionId) + '/chat' + (lastStamp ? '?after=' + encodeURIComponent(lastStamp) : ''));
      if (r.messages.length) drawMessages(r.messages, false);
    } catch (e) { /* keep polling */ }
  }

  function startChat(sessionId) {
    lastStamp = '';
    var log = document.getElementById('chat-log');
    api('/api/sessions/' + encodeURIComponent(sessionId) + '/chat').then(function (r) {
      drawMessages(r.messages, true);
    }).catch(function (e) { if (log) log.innerHTML = '<p class="muted">' + esc(e.message) + '</p>'; });
    chatTimer = setInterval(function () { pollChat(sessionId); }, 3000);

    var form = document.getElementById('chat-form');
    if (!form) return;
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var input = document.getElementById('chat-input');
      var text = input.value.trim();
      if (!text) return;
      input.value = '';
      try {
        var r = await api('/api/sessions/' + encodeURIComponent(sessionId) + '/chat', { method: 'POST', body: { text: text } });
        drawMessages([r.message], false);
      } catch (err) { toast(err.message, 'err'); input.value = text; }
    });
  }

  /* ---------- Assignments ---------- */
  function fmtDate(iso) { return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No due date'; }

  async function renderAssignments() {
    setView(head('Practice & marks', 'Assignments', 'Submit your work, track due dates and see your marks and feedback.') + '<div class="skeleton" style="min-height:260px"></div>');
    crumb.textContent = 'Assignments';
    var dash = await api('/api/dashboard');
    var enrolled = dash.courses.filter(function (c) { return c.enrolled; });
    if (!enrolled.length) { setView(head('Practice & marks', 'Assignments') + empty('Enrol in a course to see its assignments.')); return; }
    var blocks = [];
    for (var i = 0; i < enrolled.length; i++) {
      var r = await api('/api/courses/' + encodeURIComponent(enrolled[i].id) + '/assignments');
      if (r.assignments.length) blocks.push({ course: enrolled[i], items: r.assignments });
    }
    if (!blocks.length) { setView(head('Practice & marks', 'Assignments') + empty('No assignments have been set yet.')); return; }

    setView(head('Practice & marks', 'Assignments', 'Submit your work, track due dates and see your marks and feedback.') +
      blocks.map(function (b) {
        return '<section class="panel"><p class="eyebrow">' + esc(b.course.title) + '</p>' +
          b.items.map(function (a) {
            var s = a.submission;
            var status = !s ? 'Not submitted' : s.marks != null ? 'Graded' : 'Submitted, awaiting marks';
            var cls = !s ? '' : s.marks != null ? 'success' : 'pending';
            var body = '';
            if (s && s.marks != null) {
              body = '<div class="mark-box"><b>' + s.marks + ' / ' + a.maxMarks + '</b>' + (s.feedback ? '<p>' + esc(s.feedback) + '</p>' : '<p class="muted">No feedback added.</p>') + '</div>';
            }
            var graded = s && s.marks != null;
            var form = graded ? '' :
              '<form class="submit-form" data-assignment="' + esc(a.id) + '">' +
                '<textarea class="input" name="text" rows="4" maxlength="5000" placeholder="Write your answer here…">' + esc(s ? s.text : '') + '</textarea>' +
                '<input class="input" name="link" type="url" maxlength="500" placeholder="Optional: link to your work (Google Drive, YouTube, etc.)" value="' + esc(s ? s.link : '') + '">' +
                '<div class="btn-row"><button class="btn btn-solid btn-sm" type="submit">' + (s ? 'Update submission' : 'Submit') + '</button>' +
                (s ? '<span class="muted">Submitted ' + esc(fmtDate(s.submittedAt)) + '</span>' : '') + '</div></form>';
            return '<article class="assign"><header><div><h3>' + esc(a.title) + '</h3><p class="muted">Due ' + esc(fmtDate(a.dueAt)) + ' · ' + a.maxMarks + ' marks</p></div>' +
              '<span class="status ' + cls + '">' + status + '</span></header>' +
              (a.instructions ? '<p class="assign-text">' + esc(a.instructions) + '</p>' : '') + body + form + '</article>';
          }).join('') + '</section>';
      }).join(''));

    view.querySelectorAll('.submit-form').forEach(function (f) {
      f.addEventListener('submit', async function (e) {
        e.preventDefault();
        var text = f.elements.text.value.trim(), link = f.elements.link.value.trim();
        if (!text && !link) { toast('Write your answer or add a link.', 'err'); return; }
        try {
          await api('/api/assignments/' + encodeURIComponent(f.getAttribute('data-assignment')) + '/submit', { method: 'POST', body: { text: text, link: link } });
          toast('Submitted. Your instructor will mark it soon.');
          renderAssignments();
        } catch (err) { toast(err.message, 'err'); }
      });
    });
  }

  /* ---------- Router hook (called by dashboard.js) ---------- */
  window.DashExtras = {
    render: function (name, arg) {
      if (name === 'live') return renderLive(arg);
      if (name === 'assignments') return renderAssignments();
    },
    stop: stopChat
  };
})();
