/* Student dashboard v36: WhatsApp-style community, review and referral pages, pop-up forms. */
(function () {
  'use strict';
  var view = document.getElementById('view'), crumb = document.getElementById('crumb');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function api(url, opts) {
    opts = opts || {};
    var init = { method: opts.method || 'GET', credentials: 'same-origin', headers: {} };
    if (opts.body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    return fetch(url, init).then(function (r) {
      if (r.status === 401) { location.replace('/401.html'); throw new Error('Please log in.'); }
      return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Something went wrong.'); return d; });
    });
  }
  function toast(t, tone) { if (window.DModal) DModal.toast({ title: t, tone: tone || 'ok' }); }
  function head(eyebrow, title, sub) { return '<header class="view-head"><p class="eyebrow">' + esc(eyebrow) + '</p><h1>' + esc(title) + '</h1>' + (sub ? '<p class="muted">' + esc(sub) + '</p>' : '') + '</header>'; }
  function setView(html) {
    if (window.DLive && DLive.silent && /class="skeleton"/.test(html)) return; view.innerHTML = html; view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter'); }
  function dayLabel(iso) {
    var d = new Date(iso), now = new Date();
    var same = function (a, b) { return a.toDateString() === b.toDateString(); };
    var yest = new Date(now); yest.setDate(now.getDate() - 1);
    if (same(d, now)) return 'Today';
    if (same(d, yest)) return 'Yesterday';
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
  function timeLabel(iso) { return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }

  /* Pop-up that asks for a short text (used for refunds and challenge entries) */
  function askText(opts) {
    return new Promise(function (resolve) {
      var done = false;
      DModal.open({ size: 'sm', eyebrow: opts.eyebrow || '', title: opts.title, body:
        '<form class="sub-form" id="ask-form" novalidate>' +
          opts.fields.map(function (f) {
            return '<div class="field"><label for="ask-' + f.name + '">' + esc(f.label) + (f.optional ? ' <span class="muted">(optional)</span>' : '') + '</label>' +
              (f.multiline ? '<textarea class="input" id="ask-' + f.name + '" name="' + f.name + '" rows="4" maxlength="' + (f.max || 500) + '" placeholder="' + esc(f.placeholder || '') + '"></textarea>'
                : '<input class="input" id="ask-' + f.name + '" name="' + f.name + '" type="' + (f.type || 'text') + '" maxlength="' + (f.max || 300) + '" placeholder="' + esc(f.placeholder || '') + '" value="' + esc(f.value || '') + '">') + '</div>';
          }).join('') +
          '<p class="form-error" id="ask-err" role="alert"></p>' +
          '<div class="sub-actions"><button type="button" class="btn btn-ghost" data-cancel>Cancel</button><button type="submit" class="btn btn-solid">' + esc(opts.submit || 'Send') + '</button></div></form>',
        onMount: function (box, inst) {
          box.querySelector('[data-cancel]').addEventListener('click', function () { if (!done) { done = true; resolve(null); } inst.close(); });
          box.querySelector('#ask-form').addEventListener('submit', function (e) {
            e.preventDefault();
            var vals = {}, err = box.querySelector('#ask-err'), ok = true;
            opts.fields.forEach(function (f) {
              var v = box.querySelector('[name="' + f.name + '"]').value.trim();
              vals[f.name] = v;
              if (!f.optional && v.length < (f.min || 1)) { err.textContent = (f.error || 'Please fill in ' + f.label.toLowerCase() + '.'); ok = false; }
            });
            if (!ok) return;
            err.textContent = '';
            done = true; inst.close(); resolve(vals);
          });
        } });
    });
  }

  /* ---------- Community: a WhatsApp-style group chat for each course ----------
     Text, pictures and files. Reply to a message. Delete your own messages. New messages appear live. */
  var ICONS = {
    clip: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5l-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9"/></svg>',
    image: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 8"/></svg>',
    send: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v7M14 10v7"/></svg>',
    reply: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v3"/></svg>',
    doc: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
    down: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>'
  };
  var NAME_COLOURS = ['#53BDEB', '#E0A800', '#FF8A7A', '#B28DFF', '#6BCB77', '#FFB86B', '#5EE0D0', '#F28CC4'];
  function nameColour(n) { var h = 0; String(n || '').split('').forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) >>> 0; }); return NAME_COLOURS[h % NAME_COLOURS.length]; }
  function fileSize(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
  function fileExt(n) { var e = String(n || '').split('.').pop(); return e && e.length < 6 ? e.toUpperCase() : 'FILE'; }
  var CHAT_MAX = 2.4 * 1024 * 1024;
  var chat = { course: null, msgs: [], sig: '', replyTo: null, pending: null, timer: null, busy: false, stick: true, rerun: false, generation: 0 };

  /* Shrinks big photos before sending so they upload fast on mobile data */
  function prepareFile(file) {
    return new Promise(function (resolve, reject) {
      var isImg = /^image\/(jpeg|png|webp)$/.test(file.type);
      function fromBlob(blob, name) {
        if (blob.size > CHAT_MAX) return reject(new Error('That file is larger than 2.4 MB. Please choose a smaller one.'));
        var r = new FileReader(); r.onload = function () { resolve({ name: name, dataUrl: r.result, size: blob.size, isImg: isImg || /^image\//.test(blob.type), preview: (isImg || /^image\//.test(blob.type)) ? r.result : null }); }; r.onerror = function () { reject(new Error('That file could not be read.')); }; r.readAsDataURL(blob);
      }
      if (!isImg || file.size < 700 * 1024) return fromBlob(file, file.name);
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 1600, sc = Math.min(1, max / Math.max(img.width, img.height)), w = Math.round(img.width * sc), h = Math.round(img.height * sc);
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        cv.toBlob(function (b) { if (!b) return fromBlob(file, file.name); fromBlob(b, file.name.replace(/\.\w+$/, '') + '.jpg'); }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); fromBlob(file, file.name); };
      img.src = url;
    });
  }

  function bubbleHtml(m) {
    if (m.deleted) {
      return '<div class="wa-row wa2-gone' + (m.mine ? ' mine' : '') + '" data-id="' + esc(m.id) + '"><div class="wa-bubble"><p><em>' + (m.mine ? 'You deleted this message' : 'This message was deleted') + '</em></p><span class="wa-meta">' + timeLabel(m.createdAt) + '</span></div></div>';
    }
    var quote = m.replyTo ? '<div class="wa2-quote" data-jump="' + esc(m.replyTo.id) + '"><b style="color:' + nameColour(m.replyTo.name) + '">' + esc(m.replyTo.name) + '</b><span>' + esc(m.replyTo.text) + '</span></div>' : '';
    var media = '';
    if (m.file && m.file.kind === 'image') media = '<button type="button" class="wa2-img" data-view-img="/api/community/files/' + esc(m.file.id) + '" aria-label="Open picture"><img loading="lazy" src="/api/community/files/' + esc(m.file.id) + '" alt="' + esc(m.file.name) + '"></button>';
    else if (m.file) media = '<a class="wa2-file" href="/api/community/files/' + esc(m.file.id) + '" download="' + esc(m.file.name) + '"><span class="wa2-fico">' + ICONS.doc + '<em>' + esc(fileExt(m.file.name)) + '</em></span><span class="wa2-finfo"><b>' + esc(m.file.name) + '</b><small>' + fileSize(m.file.size) + ' · tap to download</small></span></a>';
    var who = m.mine ? '' : '<span class="wa-name" style="color:' + nameColour(m.name) + '">' + esc(m.name) + (m.role === 'staff' ? ' <i class="wa2-staff">Instructor</i>' : '') + '</span>';
    return '<div class="wa-row' + (m.mine ? ' mine' : '') + (m.pending ? ' wa2-pending' : '') + '" data-id="' + esc(m.id) + '"><div class="wa-bubble">' + who + quote + media +
      (m.text ? '<p>' + esc(m.text) + '</p>' : '') +
      '<span class="wa-meta">' + (m.pending ? 'Sending…' : timeLabel(m.createdAt)) + (m.mine && !m.pending ? '<span class="wa2-tick" aria-label="Sent">✓✓</span>' : '') + '</span>' +
      (m.pending ? '' : '<div class="wa2-actions"><button type="button" data-act-reply="' + esc(m.id) + '" aria-label="Reply" title="Reply">' + ICONS.reply + '</button>' +
        (m.mine ? '<button type="button" data-act-del="' + esc(m.id) + '" aria-label="Delete message" title="Delete">' + ICONS.trash + '</button>' : '') + '</div>') +
      '</div></div>';
  }
  function logHtml(list) {
    if (!list.length) return '<div class="wa-empty"><div class="wa-empty-ring"></div><b>No messages yet</b><p>Say hello, ask a question, or share a picture of your work.</p></div>';
    var last = null, out = '';
    list.forEach(function (m) {
      var day = dayLabel(m.createdAt);
      if (day !== last) { out += '<div class="wa-day"><span>' + esc(day) + '</span></div>'; last = day; }
      out += bubbleHtml(m);
    });
    return out;
  }
  function paintLog(force) {
    var log = document.getElementById('wa-log'); if (!log) return;
    var list = chat.msgs.concat(chat.pending ? [chat.pending] : []);
    var sig = JSON.stringify(list.map(function (m) { return [m.id, m.deleted ? 1 : 0, m.pending ? 1 : 0, m.text, m.file && m.file.id]; }));
    if (!force && sig === chat.sig) return;
    var near = log.scrollHeight - log.scrollTop - log.clientHeight < 140;
    var grew = list.length > (chat.count || 0);
    chat.sig = sig; chat.count = list.length;
    var known = chat.known; chat.known = new Set(list.map(function (m) { return m.id; }));
    log.innerHTML = logHtml(list);
    if (known) log.querySelectorAll('.wa-row').forEach(function (r) { if (!known.has(r.getAttribute('data-id'))) r.classList.add('wa2-new'); });
    if (near || chat.stick) { log.scrollTop = log.scrollHeight; chat.stick = false; }
    else if (grew) { var b = document.getElementById('wa-jump'); if (b) b.hidden = false; }
    var mem = document.getElementById('wa-count'); if (mem) mem.textContent = chat.members + ' members · ' + list.filter(function (m) { return !m.deleted; }).length + ' messages';
  }
  async function pollChat() {
    if (!chat.course || !document.getElementById('wa-log')) return;
    if (chat.busy) { chat.rerun = true; return; }
    chat.busy = true;
    var currentCourse = chat.course, generation = chat.generation;
    try {
      var d = await api('/api/courses/' + encodeURIComponent(currentCourse) + '/community/chat');
      if (generation !== chat.generation || currentCourse !== chat.course) return;
      chat.msgs = d.messages; chat.members = d.members; paintLog(false);
    } catch (e) { /* preserve visible messages on transient errors */ } finally { chat.busy = false; if (chat.rerun) { chat.rerun = false; if (generation === chat.generation) pollChat(); } }
  }
  function stopChat() { clearInterval(chat.timer); chat.timer = null; chat.generation++; chat.rerun = false; }
  function setReply(m) {
    chat.replyTo = m;
    var box = document.getElementById('wa-replying'); if (!box) return;
    box.hidden = !m;
    if (m) { document.getElementById('wa-to').textContent = m.mine ? 'yourself' : m.name; document.getElementById('wa-to-text').textContent = m.deleted ? '' : (m.text || (m.file ? (m.file.kind === 'image' ? 'Photo' : m.file.name) : '')).slice(0, 90); document.getElementById('wa-text').focus(); }
  }
  function openImage(src) {
    var o = document.createElement('div'); o.className = 'wa2-lightbox'; o.innerHTML = '<button type="button" aria-label="Close">&times;</button><img src="' + esc(src) + '" alt="">';
    o.addEventListener('click', function () { o.classList.remove('in'); setTimeout(function () { o.remove(); }, 200); });
    document.body.appendChild(o); requestAnimationFrame(function () { o.classList.add('in'); });
  }

  async function renderCommunity() {
    crumb.textContent = 'Community';
    stopChat();
    var dash = await api('/api/dashboard');
    var enrolled = dash.courses.filter(function (c) { return c.enrolled; });
    if (!enrolled.length) { setView(head('Learn together', 'Community', 'Ask questions and help classmates in your courses.') + '<div class="empty-state">Enrol in a course to join its community.</div>'); return; }
    var cur = (location.hash.split('/')[1]) || enrolled[0].id;
    var course = enrolled.find(function (c) { return c.id === cur; }) || enrolled[0];
    var d = await api('/api/courses/' + encodeURIComponent(course.id) + '/community/chat');
    chat = { course: course.id, msgs: d.messages, members: d.members, sig: '', count: 0, replyTo: null, pending: null, timer: null, busy: false, stick: true, attach: null };
    setView(head('Learn together', 'Community', 'Ask questions, help classmates and share your progress and your work.') +
      '<section class="wa-shell wa2-shell" id="wa-shell">' +
        '<div class="wa-top"><div class="wa-avatar">' + esc((course.title || 'C').charAt(0)) + '</div><div><b>' + esc(course.title) + '</b><span id="wa-count"></span></div><span class="wa2-live"><i></i>Live</span></div>' +
        '<div class="wa-courses">' + enrolled.map(function (c) { return '<a class="wa-chip' + (c.id === course.id ? ' on' : '') + '" href="#community/' + esc(c.id) + '">' + esc(c.title) + '</a>'; }).join('') + '</div>' +
        '<div class="wa-log" id="wa-log" aria-live="polite"></div>' +
        '<button type="button" class="wa2-jump" id="wa-jump" hidden aria-label="Jump to the newest message">' + ICONS.down + ' New messages</button>' +
        '<div class="wa-composer">' +
          '<div class="wa-replying" id="wa-replying" hidden><div><span>Replying to <b id="wa-to"></b></span><small id="wa-to-text"></small></div><button type="button" id="wa-cancel" aria-label="Cancel reply">&times;</button></div>' +
          '<div class="wa2-attach" id="wa-attach" hidden></div>' +
          '<form class="wa-form" id="wa-form" autocomplete="off">' +
            '<button type="button" class="wa2-btn" id="wa-pick-file" aria-label="Attach a file" title="Attach a file">' + ICONS.clip + '</button>' +
            '<button type="button" class="wa2-btn" id="wa-pick-img" aria-label="Send a picture" title="Send a picture">' + ICONS.image + '</button>' +
            '<textarea id="wa-text" rows="1" maxlength="2000" placeholder="Type a message"></textarea>' +
            '<button type="submit" class="wa-send" id="wa-send" aria-label="Send">' + ICONS.send + '</button>' +
          '</form>' +
          '<input type="file" id="wa-file" hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,image/*">' +
          '<input type="file" id="wa-img" hidden accept="image/*">' +
        '</div>' +
        '<div class="wa2-drop" id="wa-drop" hidden><div>Drop a picture or file to send it</div></div>' +
      '</section>');
    var log = document.getElementById('wa-log'), ta = document.getElementById('wa-text'), form = document.getElementById('wa-form'), sendBtn = document.getElementById('wa-send');
    paintLog(true);
    log.scrollTop = log.scrollHeight;
    log.addEventListener('scroll', function () { if (log.scrollHeight - log.scrollTop - log.clientHeight < 60) document.getElementById('wa-jump').hidden = true; });
    document.getElementById('wa-jump').addEventListener('click', function () { log.scrollTop = log.scrollHeight; this.hidden = true; });

    ta.addEventListener('input', function () { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); form.requestSubmit(); } });
    document.getElementById('wa-cancel').addEventListener('click', function () { setReply(null); });

    function showAttach() {
      var box = document.getElementById('wa-attach'), a = chat.attach;
      box.hidden = !a;
      if (!a) { box.innerHTML = ''; return; }
      box.innerHTML = (a.preview ? '<img src="' + esc(a.preview) + '" alt="">' : '<span class="wa2-fico">' + ICONS.doc + '<em>' + esc(fileExt(a.name)) + '</em></span>') +
        '<div><b>' + esc(a.name) + '</b><small>' + fileSize(a.size) + ' · ready to send</small></div><button type="button" id="wa-unattach" aria-label="Remove attachment">&times;</button>';
      document.getElementById('wa-unattach').addEventListener('click', function () { chat.attach = null; showAttach(); });
    }
    async function takeFile(file) {
      if (!file) return;
      try { chat.attach = await prepareFile(file); showAttach(); ta.focus(); }
      catch (e) { toast(e.message, 'err'); }
    }
    document.getElementById('wa-pick-file').addEventListener('click', function () { document.getElementById('wa-file').click(); });
    document.getElementById('wa-pick-img').addEventListener('click', function () { document.getElementById('wa-img').click(); });
    ['wa-file', 'wa-img'].forEach(function (id) { document.getElementById(id).addEventListener('change', function () { takeFile(this.files[0]); this.value = ''; }); });
    ta.addEventListener('paste', function (e) {
      var items = (e.clipboardData && e.clipboardData.files) || [];
      if (items.length) { e.preventDefault(); takeFile(items[0]); }
    });
    var shell = document.getElementById('wa-shell'), drop = document.getElementById('wa-drop');
    function hasFiles(e) { return !!(e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')); }
    function hideDrop() { drop.hidden = true; dragDepth = 0; }
    var dragDepth = 0;
    shell.addEventListener('dragenter', function (e) { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; drop.hidden = false; });
    shell.addEventListener('dragleave', function (e) {
      if (!hasFiles(e)) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) hideDrop();
    });
    shell.addEventListener('dragover', function (e) { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    shell.addEventListener('drop', function (e) { if (!hasFiles(e)) return; e.preventDefault(); hideDrop(); if (e.dataTransfer.files[0]) takeFile(e.dataTransfer.files[0]); });
    window.addEventListener('drop', hideDrop);
    window.addEventListener('dragend', hideDrop);
    window.addEventListener('blur', hideDrop);
    shell.addEventListener('keydown', function(e) { if (e.key === 'Escape') hideDrop(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) hideDrop(); });

    log.addEventListener('click', async function (e) {
      var img = e.target.closest('[data-view-img]'); if (img) return openImage(img.getAttribute('data-view-img'));
      var jump = e.target.closest('[data-jump]');
      if (jump) { var t = log.querySelector('[data-id="' + jump.getAttribute('data-jump') + '"]'); if (t) { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); t.classList.add('wa2-flash'); setTimeout(function () { t.classList.remove('wa2-flash'); }, 1400); } return; }
      var rb = e.target.closest('[data-act-reply]');
      if (rb) { var rm = chat.msgs.find(function (x) { return x.id === rb.getAttribute('data-act-reply'); }); if (rm) setReply(rm); return; }
      var db = e.target.closest('[data-act-del]');
      if (db) {
        var id = db.getAttribute('data-act-del');
        if (!window.confirm('Delete this message for everyone?')) return;
        var row = db.closest('.wa-row'); if (row) row.classList.add('wa2-removing');
        try { await api('/api/community/chat/' + encodeURIComponent(id), { method: 'DELETE' }); toast('Message deleted.'); pollChat(); }
        catch (err) { if (row) row.classList.remove('wa2-removing'); toast(err.message, 'err'); }
      }
    });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var text = ta.value.trim(), a = chat.attach;
      if (!text && !a) return;
      var reply = chat.replyTo;
      sendBtn.disabled = true;
      // Show the message at once, like WhatsApp, and confirm it when the server has it
      chat.pending = { id: 'pending', mine: true, pending: true, name: 'You', text: text, createdAt: new Date().toISOString(), replyTo: reply ? { id: reply.id, name: reply.name, text: reply.text || '' } : null,
        file: a ? { id: 'pending', name: a.name, size: a.size, kind: a.isImg ? 'image' : 'file' } : null };
      var pm = chat.pending; chat.stick = true; paintLog(true);
      if (a && a.preview) { var pi = log.querySelector('.wa-row.wa2-pending img'); if (pi) pi.src = a.preview; }
      ta.value = ''; ta.style.height = 'auto'; chat.attach = null; showAttach(); setReply(null);
      try {
        await api('/api/courses/' + encodeURIComponent(course.id) + '/community/chat', { method: 'POST', body: { text: text, replyTo: reply ? reply.id : null, file: a ? { name: a.name, dataUrl: a.dataUrl } : null } });
        chat.pending = null; chat.stick = true; await pollChat(); paintLog(true);
      } catch (err) {
        chat.pending = null; paintLog(true); toast(err.message, 'err');
        ta.value = pm.text; chat.attach = a; showAttach(); chat.replyTo = reply; setReply(reply);
      } finally { sendBtn.disabled = false; }
    });

    // Live: a new message from anyone appears within a moment
    chat.timer = setInterval(function () { if (!document.getElementById('wa-log')) return stopChat(); if (!document.hidden) pollChat(); }, 2500);
    window.addEventListener('focus', pollChat);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && document.getElementById('wa-log')) pollChat(); });
    var onEvt = function () { if (!document.getElementById('wa-log')) { window.removeEventListener('debone:community', onEvt); return; } pollChat(); };
    window.addEventListener('debone:community', onEvt);
    // Vercel cannot maintain SSE connections; a shared database revision triggers immediate refresh.
    var onRefresh = function () { if (document.getElementById('wa-log')) pollChat(); else window.removeEventListener('debone:refresh', onRefresh); };
    window.addEventListener('debone:refresh', onRefresh);
  }

  /* ---------- Course reviews: clear stars, labelled form ---------- */
  async function renderReviews() {
    crumb.textContent = 'Course reviews';
    var dash = await api('/api/dashboard'), mine = (await api('/api/me/reviews')).reviews;
    var enrolled = dash.courses.filter(function (c) { return c.enrolled; });
    var stars = function (n) { var s = ''; for (var i = 1; i <= 5; i++) s += '<span class="rv2-star' + (i <= n ? ' on' : '') + '">★</span>'; return s; };
    var cards = enrolled.length ? enrolled.map(function (c, i) {
      var r = mine.find(function (x) { return x.courseId === c.id; });
      var body;
      if (r) {
        var lab = { pending: 'Waiting for review', approved: 'Published', rejected: 'Not published' }[r.status];
        body = '<div class="rv2-done"><div class="rv2-stars">' + stars(r.rating) + '</div><p>' + esc(r.text) + '</p><span class="gpill ' + (r.status === 'approved' ? 'pass' : r.status === 'rejected' ? 'fail' : 'none') + '">' + lab + '</span></div>';
      } else {
        body = '<form class="rv2-form" data-course="' + esc(c.id) + '">' +
          '<div class="rv2-pick" role="radiogroup" aria-label="Your rating">' + [1,2,3,4,5].map(function (n) {
            return '<label class="rv2-opt"><input type="radio" name="r-' + esc(c.id) + '" value="' + n + '"' + (n === 5 ? ' checked' : '') + '><span class="rv2-star">★</span><em>' + n + '</em></label>';
          }).join('') + '</div>' +
          '<label class="rv2-label" for="t-' + esc(c.id) + '">What did you learn?</label>' +
          '<textarea class="input" id="t-' + esc(c.id) + '" rows="3" maxlength="600" minlength="10" required placeholder="Share what worked for you and what could be better"></textarea>' +
          '<p class="form-error" role="alert"></p><div class="rv2-foot"><button class="btn btn-solid" type="submit">Publish review</button></div></form>';
      }
      return '<article class="rv2-card" style="--i:' + i + '"><div class="rv2-head"><span class="rv2-ico">★</span><h3>' + esc(c.title) + '</h3></div>' + body + '</article>';
    }).join('') : '<div class="empty-state">You can review a course once you are enrolled in it.</div>';
    setView(head('Your voice', 'Course reviews', 'Rate the courses you are enrolled in. Our team checks each review before it is published.') +
      '<div class="rv2-grid">' + cards + '</div>');
    view.querySelectorAll('.rv2-form').forEach(function (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var err = form.querySelector('.form-error'), btn = form.querySelector('button');
        err.textContent = '';
        var rating = Number(form.querySelector('input[type=radio]:checked').value);
        var text = form.querySelector('textarea').value.trim();
        if (text.length < 10) { err.textContent = 'Please write at least 10 characters.'; return; }
        btn.disabled = true; btn.textContent = 'Publishing…';
        try {
          await api('/api/courses/' + encodeURIComponent(form.getAttribute('data-course')) + '/reviews', { method: 'POST', body: { rating: rating, text: text } });
          toast('Thank you. Your review is with our team.'); renderReviews();
        } catch (ex) { err.textContent = ex.message; btn.disabled = false; btn.textContent = 'Publish review'; }
      });
    });
  }

  /* ---------- Refer a friend: rewards, withdrawals and progress ---------- */
  function fmtN(n) { return '₦' + Math.round(Number(n || 0)).toLocaleString('en-US'); }
  function askWithdrawal(d) {
    return new Promise(function (resolve) {
      var done = false;
      DModal.open({ size: 'sm', eyebrow: 'Withdraw your rewards', title: 'Request a withdrawal', body:
        '<form class="sub-form" id="wd-form" novalidate>' +
          '<div class="wd-amount"><span>You will withdraw</span><b>' + fmtN(d.balance) + '</b></div>' +
          '<div class="field"><label for="wd-bank">Bank name</label><input class="input" id="wd-bank" name="bankName" maxlength="80" placeholder="e.g. GTBank" required></div>' +
          '<div class="field"><label for="wd-acc-name">Account name</label><input class="input" id="wd-acc-name" name="accountName" maxlength="120" required></div>' +
          '<div class="field"><label for="wd-acc-no">Account number</label><input class="input" id="wd-acc-no" name="accountNumber" inputmode="numeric" maxlength="10" placeholder="10 digits" required></div>' +
          '<p class="form-error" id="wd-err" role="alert"></p>' +
          '<div class="sub-actions"><button type="button" class="btn btn-ghost" data-cancel>Cancel</button><button type="submit" class="btn btn-solid">Send withdrawal request</button></div></form>',
        onMount: function (box, inst) {
          box.querySelector('[data-cancel]').addEventListener('click', function () { if (!done) { done = true; resolve(null); } inst.close(); });
          box.querySelector('#wd-form').addEventListener('submit', function (e) {
            e.preventDefault();
            var f = e.target, err = box.querySelector('#wd-err');
            var v = { bankName: f.bankName.value.trim(), accountName: f.accountName.value.trim(), accountNumber: f.accountNumber.value.trim() };
            if (v.bankName.length < 3) { err.textContent = 'Enter your bank name.'; return; }
            if (v.accountName.length < 3) { err.textContent = 'Enter the account name exactly as it appears at the bank.'; return; }
            if (!/^\d{10}$/.test(v.accountNumber)) { err.textContent = 'Enter a 10-digit account number.'; return; }
            done = true; inst.close(); resolve(v);
          });
        } });
    });
  }
  async function renderReferrals() {
    crumb.textContent = 'Refer a friend';
    var d = await api('/api/me/referral');
    var pct = Math.min(100, Math.round(d.paidFriends / d.min * 100));
    var canWithdraw = d.eligible;
    var hint = canWithdraw ? 'You have ' + d.paidFriends + ' paying friends. You can withdraw now.'
      : d.pending ? 'Your withdrawal is waiting for approval. You will see the status here.'
      : d.balance <= 0 && d.paidFriends === 0 ? 'Refer ' + d.min + ' friends who pay for a course to unlock your first withdrawal.'
      : 'Refer ' + d.needed + ' more friend' + (d.needed === 1 ? '' : 's') + ' who pay for a course to unlock a withdrawal.';
    setView(head('Share and earn', 'Refer a friend', 'Your friend gets ' + d.discountPercent + '% off their first course. You earn ' + d.rewardPercent + '% of every amount they pay.') +
      '<section class="rf2-link"><p class="rf2-label">Your link</p><div class="rf2-row"><code id="rf-link">' + esc(d.link) + '</code><button class="btn btn-solid" type="button" id="rf-copy">Copy link</button></div><p class="rf2-code">Your code <b>' + esc(d.code) + '</b></p></section>' +
      '<section class="rf2-stats">' +
        '<div class="rf2-stat rf2-hero"><span>Available balance</span><b>' + fmtN(d.balance) + '</b><button class="btn ' + (canWithdraw ? 'btn-solid' : 'btn-ghost') + ' btn-sm" type="button" id="wd-open"' + (canWithdraw ? '' : ' disabled') + '>Request withdrawal</button></div>' +
        '<div class="rf2-stat"><span>Paying friends</span><b>' + d.paidFriends + '<em> / ' + d.min + '</em></b><div class="rf2-bar"><i style="--w:' + pct + '%"></i></div></div>' +
        '<div class="rf2-stat"><span>Total earned</span><b>' + fmtN(d.totalEarned) + '</b><small>Withdrawn so far: ' + fmtN(d.withdrawn) + '</small></div>' +
      '</section>' +
      '<p class="rf2-hint' + (canWithdraw ? ' ok' : '') + '">' + esc(hint) + '</p>' +
      '<section class="rf2-list"><p class="rf2-label">Friends you referred</p>' +
        (d.referred.length ? d.referred.map(function (x, i) {
          return '<div class="rf2-friend" style="--i:' + i + '"><span class="rf2-av">' + esc(x.name.charAt(0)) + '</span><div class="rf2-who"><b>' + esc(x.name) + '</b><small>' + (x.paid ? 'Paid ' + fmtN(x.paidTotal) : 'Has not paid for a course yet') + '</small></div>' +
            (x.paid ? '<span class="gpill pass">+' + fmtN(x.earned) + '</span>' : '<span class="gpill none">Waiting</span>') + '</div>';
        }).join('') : '<div class="empty-state">No one has joined with your link yet. Share it on WhatsApp to get started.</div>') +
      '</section>' +
      '<section class="rf2-list"><p class="rf2-label">Your withdrawals</p>' +
        (d.withdrawals.length ? '<div class="dt-wrap"><table class="dt"><thead><tr><th>Date</th><th>Amount</th><th>Bank</th><th>Status</th></tr></thead><tbody>' + d.withdrawals.map(function (w) {
          var label = { requested: 'Waiting for approval', approved: 'Approved', declined: 'Not approved' }[w.status] || w.status;
          return '<tr><td>' + esc(new Date(w.createdAt).toLocaleDateString('en-GB')) + '</td><td>' + fmtN(w.amount) + '</td><td>' + esc(w.bankName) + '</td><td><span class="gpill ' + (w.status === 'approved' ? 'pass' : w.status === 'declined' ? 'fail' : 'none') + '">' + esc(label) + '</span></td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="muted">No withdrawals yet.</p>') +
      '</section>');
    document.getElementById('rf-copy').addEventListener('click', function () {
      var btn = document.getElementById('rf-copy');
      (navigator.clipboard ? navigator.clipboard.writeText(d.link) : Promise.reject()).then(function () { btn.textContent = 'Copied ✓'; setTimeout(function () { btn.textContent = 'Copy link'; }, 2000); }, function () {});
    });
    var wd = document.getElementById('wd-open');
    if (wd) wd.addEventListener('click', async function () {
      var v = await askWithdrawal(d);
      if (!v) return;
      api('/api/me/withdrawals', { method: 'POST', body: v }).then(function (res) { toast(res.message); renderReferrals(); }).catch(function (e) { toast(e.message, 'err'); });
    });
  }

  /* ---------- Certificates: request one when a course is complete ---------- */
  async function renderCertificates() {
    crumb.textContent = 'Certificates';
    var d = await api('/api/me/certificates');
    var courses = d.progress.map(function (p, i) {
      var req = d.requests.filter(function (r) { return r.courseId === p.courseId; }).sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); })[0];
      var issued = d.certificates.find(function (c) { return c.courseId === p.courseId; });
      var pct = p.lessonsTotal ? Math.round(p.lessonsDone / p.lessonsTotal * 100) : 0;
      var action;
      if (issued) action = '<a class="btn btn-solid btn-sm" href="/api/me/certificates/' + encodeURIComponent(issued.code) + '/pdf">Download PDF</a> <a class="btn btn-ghost btn-sm" href="certificate.html?code=' + encodeURIComponent(issued.code) + '" target="_blank" rel="noopener">View</a>';
      else if (req && req.status === 'requested') action = '<span class="gpill none">Waiting for approval</span>';
      else if (p.complete) action = '<button class="btn btn-solid btn-sm" type="button" data-cert-req="' + esc(p.courseId) + '">Request certificate</button>';
      else action = '<span class="muted small">Finish the course to request it</span>';
      var note = req && req.status === 'declined' ? '<p class="cert-note">Not approved: ' + esc(req.reason) + '</p>' : '';
      var missing = !p.complete && p.missing && p.missing.length ? '<ul class="cert-missing">' + p.missing.slice(0, 4).map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' : '';
      return '<article class="cert-card" style="--i:' + i + '"><div class="cert-top"><span class="cert-seal' + (issued ? ' on' : '') + '">' + (issued ? '✓' : '') + '</span><div><h3>' + esc(p.courseTitle) + '</h3><p class="muted small">' + p.lessonsDone + ' of ' + p.lessonsTotal + ' lessons finished</p></div></div>' +
        '<div class="cert-bar"><i style="--w:' + pct + '%"></i></div>' + missing + note + '<div class="cert-foot">' + action + '</div></article>';
    }).join('');
    setView(head('Achievements', 'Certificates', 'Request your certificate once you finish a course. Our team checks your work and issues it.') +
      '<div class="cert-grid">' + (courses || '<div class="empty-state">Enrol in a course to earn a certificate.</div>') + '</div>');
    view.querySelectorAll('[data-cert-req]').forEach(function (b) {
      b.addEventListener('click', function () {
        b.disabled = true; b.textContent = 'Sending…';
        api('/api/me/certificates/request', { method: 'POST', body: { courseId: b.getAttribute('data-cert-req') } })
          .then(function (res) { toast(res.message); renderCertificates(); }).catch(function (e) { toast(e.message, 'err'); b.disabled = false; b.textContent = 'Request certificate'; });
      });
    });
  }

  /* ---------- Requests: refunds asked in a pop-up ---------- */
  async function renderRequests() {
    crumb.textContent = 'Requests and refunds';
    var n = await api('/api/me/schedule-notices'), r = await api('/api/me/refunds'), p = await api('/api/payments');
    var notices = n.notices.length ? n.notices.map(function (x) {
      var action = x.status === 'open'
        ? '<div class="rq-actions"><button class="btn btn-solid btn-sm" type="button" data-choose="' + esc(x.id) + '" data-c="new_date">Wait for a new date</button><button class="btn btn-ghost btn-sm" type="button" data-choose="' + esc(x.id) + '" data-c="refund">Request a refund</button></div>'
        : '<span class="gpill none">' + esc({ waiting: 'Waiting for a new date', refund_requested: 'Refund requested', rescheduled: 'New date: ' + (x.newStartDate || '') }[x.status] || x.status) + '</span>';
      return '<article class="rq-card"><h3>' + esc(x.courseTitle) + '</h3><p class="muted">The course needs more students to run on its start date. Choose what you would like.</p>' + action + '</article>';
    }).join('') : '<div class="empty-state">No schedule notices. Your courses are running as planned.</div>';
    var payable = p.payments.filter(function (x) { return x.status === 'success'; });
    var pays = payable.length ? payable.map(function (x) {
      return '<tr><td><b>' + esc(x.courseTitle) + '</b></td><td>₦' + Number(x.amount).toLocaleString('en-US') + '</td><td>' + esc(new Date(x.paidAt || x.createdAt).toLocaleDateString('en-GB')) + '</td><td class="dt-act"><button class="btn btn-ghost btn-sm" type="button" data-refund="' + esc(x.reference) + '">Request refund</button></td></tr>';
    }).join('') : '<tr><td colspan="4" class="muted">No paid orders yet.</td></tr>';
    var refunds = r.refunds.length ? r.refunds.map(function (x) {
      return '<tr><td>' + esc(x.reference) + '</td><td>₦' + Number(x.amount).toLocaleString('en-US') + '</td><td>' + esc(x.reason) + '</td><td><span class="gpill none">' + esc(x.status) + '</span></td></tr>';
    }).join('') : '<tr><td colspan="4" class="muted">No refund requests.</td></tr>';
    setView(head('Account', 'Requests and refunds', 'Schedule choices, refund requests and their progress.') +
      '<section class="rq-section"><p class="rf2-label">Schedule notices</p><div class="rq-list">' + notices + '</div></section>' +
      '<section class="panel"><p class="rf2-label">Request a refund</p><p class="muted small">Refunds can be requested within the period in our refund policy. Courses that have started and products already downloaded are not refundable.</p>' +
        '<div class="dt-wrap"><table class="dt"><thead><tr><th>Item</th><th>Paid</th><th>Date</th><th></th></tr></thead><tbody>' + pays + '</tbody></table></div></section>' +
      '<section class="panel"><p class="rf2-label">Your refund requests</p><div class="dt-wrap"><table class="dt"><thead><tr><th>Payment</th><th>Amount</th><th>Reason</th><th>Status</th></tr></thead><tbody>' + refunds + '</tbody></table></div></section>');
    view.querySelectorAll('[data-choose]').forEach(function (b) {
      b.addEventListener('click', async function () {
        try { await api('/api/me/schedule-notices/' + encodeURIComponent(b.getAttribute('data-choose')) + '/choose', { method: 'POST', body: { choice: b.getAttribute('data-c') } }); toast('Thank you. Your choice is recorded.'); renderRequests(); }
        catch (e) { toast(e.message, 'err'); }
      });
    });
    view.querySelectorAll('[data-refund]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var v = await askText({ eyebrow: 'Refund request', title: 'Request a refund', submit: 'Send request', fields: [
          { name: 'reason', label: 'Tell us briefly why you want a refund', multiline: true, min: 5, max: 500, placeholder: 'For example: I enrolled by mistake, or the schedule does not fit my week.', error: 'Please tell us a little more (at least 5 characters).' } ] });
        if (!v) return;
        api('/api/me/payments/' + encodeURIComponent(b.getAttribute('data-refund')) + '/refund', { method: 'POST', body: { reason: v.reason } })
          .then(function (res) { toast(res.message); renderRequests(); }).catch(function (e) { toast(e.message, 'err'); });
      });
    });
  }

  /* ---------- Recordings: every recorded class of your courses, including classes before you joined ---------- */
  async function renderRecordings() {
    crumb.textContent = 'Recordings';
    var d = await api('/api/me/recordings');
    var label = { available: 'Available', expired: 'Replay ended', processing: 'Being prepared', upcoming: 'Upcoming' };
    var tone = { available: 'pass', expired: 'fail', processing: 'none', upcoming: 'none' };
    var fmtD = function (iso) { return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; };
    var cards = d.recordings.length ? d.recordings.map(function (r, i) {
      var action = r.status === 'available' ? '<button type="button" class="btn btn-solid btn-sm" data-recording="' + esc(r.id) + '">Watch replay</button>'
        : r.status === 'expired' ? '<span class="muted small">Replay window closed</span>'
        : r.status === 'upcoming' ? '<span class="muted small">Available after the class</span>'
        : '<span class="muted small">Our team is uploading it</span>';
      return '<article class="rc-card" style="--i:' + i + '"><div class="rc-thumb' + (r.status === 'available' ? ' on' : '') + '"><span>' + (r.status === 'available' ? '▶' : '●') + '</span></div>' +
        '<div class="rc-body"><span class="gpill ' + tone[r.status] + '">' + label[r.status] + '</span><h3>' + esc(r.title) + '</h3>' +
        '<p class="muted small">' + esc(r.courseTitle) + (r.startsAt ? ' · ' + fmtD(r.startsAt) : '') + '</p>' +
        (r.replayUntil && r.status === 'available' ? '<p class="small">Watch until ' + esc(fmtD(r.replayUntil)) + '</p>' : '') +
        '<div class="rc-foot">' + action + '</div></div></article>';
    }).join('') : '<div class="empty-state">Recordings of your classes appear here. If you joined late, you can still watch every class you missed.</div>';
    setView(head('Catch up', 'Recordings', 'Missed a class or joined late? Watch every recorded class of your courses here.') +
      '<div class="rc-grid">' + cards + '</div><section id="recording-player" class="video-frame" style="display:none;margin-top:20px"></section>');
    view.querySelectorAll('[data-recording]').forEach(function (b) {
      b.addEventListener('click', async function () {
        b.disabled = true;
        try {
          var id = b.getAttribute('data-recording');
          var playback = await api('/api/sessions/' + encodeURIComponent(id) + '/playback?type=recording');
          var player = document.getElementById('recording-player');
          player.style.display = 'block';
          player.innerHTML = playback.format === 'mp4' ? '<video controls controlsList="nodownload" playsinline preload="metadata" style="width:100%;max-height:70vh;background:#000" src="' + esc(playback.videoUrl) + '"></video>' : '<iframe src="' + esc(playback.embedUrl) + '" title="' + esc(playback.title) + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
          player.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await api('/api/sessions/' + encodeURIComponent(id) + '/watched', { method: 'POST', body: {} });
        } catch (err) { toast(err.message, 'err'); }
        b.disabled = false;
      });
    });
  }

  var old = window.DashExtras && window.DashExtras.render;
  window.DashExtras = Object.assign(window.DashExtras || {}, {
    render: function (name, arg) {
      if (name === 'community') return renderCommunity();
      if (name === 'reviews') return renderReviews();
      if (name === 'referrals') return renderReferrals();
      if (name === 'certificates') return renderCertificates();
      if (name === 'recordings') return renderRecordings();
      if (name === 'requests') return renderRequests();
      return old ? old(name, arg) : undefined;
    }
  });
  window.DashPop = { askText: askText };
})();
