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
      if (r.status === 401) { location.replace('login.html?next=dashboard'); throw new Error('Please log in.'); }
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

  function attachmentHtml(a) {
    if (!a || !a.data || !a.name) return '';
    var href = esc(a.data), name = esc(a.name);
    return a.type && a.type.indexOf('image/') === 0
      ? '<a href="' + href + '" download="' + name + '" class="wa-attachment"><img src="' + href + '" alt="' + name + '" style="max-width:240px;max-height:200px;border-radius:12px;display:block"></a>'
      : '<a href="' + href + '" download="' + name + '" class="wa-attachment">📎 ' + name + '</a>';
  }
  /* ---------- Community: a chat for each course ---------- */
  var replyTo = null, communityTimer = null, communityRequest = false;
  function communityLog(threads) {
    var last = null, log = '';
    threads.slice().reverse().forEach(function (t) {
      var day = dayLabel(t.createdAt);
      if (day !== last) { log += '<div class="wa-day"><span>' + esc(day) + '</span></div>'; last = day; }
      log += '<div class="wa-row' + (t.mine ? ' mine' : '') + '" data-thread="' + esc(t.id) + '"><div class="wa-bubble">' +
        '<span class="wa-name">' + (t.mine ? 'You' : esc(t.authorName)) + '</span>' +
        (t.body && t.body.indexOf(t.title) === 0 ? '' : '<b class="wa-title">' + esc(t.title) + '</b>') + '<p>' + esc(t.body || t.title) + '</p>' +
        attachmentHtml(t.attachment) + '<span class="wa-meta">' + timeLabel(t.createdAt) + (t.mine ? '<button type="button" class="wa-reply-btn" data-delete-thread="' + esc(t.id) + '">Delete</button>' : '') + '<button type="button" class="wa-reply-btn" data-reply="' + esc(t.id) + '" data-who="' + esc(t.authorName) + '">Reply</button></span></div></div>';
      (t.replies || []).forEach(function (r) {
        log += '<div class="wa-row reply' + (r.mine ? ' mine' : '') + '"><div class="wa-bubble"><span class="wa-name">' + (r.mine ? 'You' : esc(r.authorName)) + '</span><p>' + esc(r.body || '') + '</p>' + attachmentHtml(r.attachment) + '<span class="wa-meta">' + timeLabel(r.createdAt) + (r.mine ? '<button type="button" class="wa-reply-btn" data-delete-reply="' + esc(r.id) + '">Delete</button>' : '') + '</span></div></div>';
      });
    });
    return threads.length ? log : '<div class="wa-empty"><div class="wa-empty-ring"></div><b>No messages yet</b><p>Start the conversation. Ask a question or share your progress.</p></div>';
  }
  function bindCommunityMessages(root, refresh) {
    root.querySelectorAll('[data-delete-thread], [data-delete-reply]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!window.confirm('Delete this message?')) return;
        var isReply = b.hasAttribute('data-delete-reply');
        var id = b.getAttribute(isReply ? 'data-delete-reply' : 'data-delete-thread');
        try { await api('/api/community/' + (isReply ? 'replies/' : 'threads/') + encodeURIComponent(id), { method: 'DELETE' }); await refresh(); }
        catch (e) { toast(e.message, 'err'); }
      });
    });
    root.querySelectorAll('[data-reply]').forEach(function (b) {
      b.addEventListener('click', function () {
        replyTo = b.getAttribute('data-reply');
        document.getElementById('wa-to').textContent = b.getAttribute('data-who');
        document.getElementById('wa-replying').hidden = false;
        document.getElementById('wa-text').focus();
      });
    });
  }
  async function renderCommunity() {
    crumb.textContent = 'Community';
    var dash = await api('/api/dashboard');
    var enrolled = dash.courses.filter(function (c) { return c.enrolled; });
    if (!enrolled.length) { setView(head('Learn together', 'Community', 'Ask questions and help classmates in your courses.') + '<div class="empty-state">Enrol in a course to join its community.</div>'); return; }
    var cur = (location.hash.split('/')[1]) || enrolled[0].id;
    var course = enrolled.find(function (c) { return c.id === cur; }) || enrolled[0];
    var d = await api('/api/courses/' + encodeURIComponent(course.id) + '/community');
    replyTo = null;
    var log = communityLog(d.threads);
    setView(head('Learn together', 'Community', 'Ask questions, help classmates and share your progress.') +
      '<section class="wa-shell">' +
        '<div class="wa-top"><div class="wa-avatar">' + esc((course.title || 'C').charAt(0)) + '</div><div><b>' + esc(course.title) + '</b><span>' + d.threads.length + ' discussions · course group</span></div></div>' +
        '<div class="wa-courses">' + enrolled.map(function (c) { return '<a class="wa-chip' + (c.id === course.id ? ' on' : '') + '" href="#community/' + esc(c.id) + '">' + esc(c.title) + '</a>'; }).join('') + '</div>' +
        '<div class="wa-log" id="wa-log">' + log + '</div>' +
        '<div class="wa-composer"><div class="wa-replying" id="wa-replying" hidden><span>Replying to <b id="wa-to"></b></span><button type="button" id="wa-cancel" aria-label="Cancel reply">&times;</button></div>' +
          '<div class="wa-preview" id="wa-preview" hidden></div><form class="wa-form" id="wa-form"><label class="wa-plus" title="Add image or file" aria-label="Add image or file"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg><input id="wa-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain" style="display:none"></label><textarea id="wa-text" rows="1" maxlength="2000" placeholder="Type a message"></textarea><button type="submit" class="wa-send" aria-label="Send"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l16-8-6 16-2-7-8-1z"/></svg></button></form></div>' +
      '</section>');
    var logEl = document.getElementById('wa-log');
    logEl.scrollTop = logEl.scrollHeight;
    var ta = document.getElementById('wa-text');
    ta.addEventListener('input', function () { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); document.getElementById('wa-form').requestSubmit(); } });
    async function refreshMessages() {
      if (!document.getElementById('wa-log') || location.hash.split('/')[0] !== '#community' || communityRequest) return;
      communityRequest = true;
      try {
        var fresh = await api('/api/courses/' + encodeURIComponent(course.id) + '/community');
        var target = document.getElementById('wa-log');
        if (!target) return;
        var html = communityLog(fresh.threads);
        if (target.innerHTML !== html) {
          var atBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100;
          var previousScroll = target.scrollTop;
          target.innerHTML = html;
          bindCommunityMessages(target, refreshMessages);
          target.scrollTop = atBottom ? target.scrollHeight : previousScroll;
        }
      } catch (err) { /* Keep draft intact during temporary connection loss. */ }
      finally { communityRequest = false; }
    }
    bindCommunityMessages(logEl, refreshMessages);
    if (communityTimer) clearInterval(communityTimer);
    communityTimer = setInterval(function () { if (!document.hidden) refreshMessages(); }, 3000);
    var fileInput = document.getElementById('wa-file'), preview = document.getElementById('wa-preview');
    fileInput.addEventListener('change', function () {
      var file = fileInput.files[0];
      preview.hidden = !file;
      preview.innerHTML = '';
      if (!file) return;
      var thumb = document.createElement('div'); thumb.className = 'wa-preview-thumb';
      if (file.type.indexOf('image/') === 0) {
        var img = document.createElement('img'); img.alt = 'Selected image preview';
        var url = URL.createObjectURL(file); img.src = url;
        img.onload = function () { URL.revokeObjectURL(url); };
        thumb.appendChild(img);
      } else { thumb.textContent = '📄'; }
      var details = document.createElement('div'); details.className = 'wa-preview-info';
      var filename = document.createElement('strong'); filename.textContent = file.name;
      var size = document.createElement('small'); size.textContent = (file.size / 1024).toFixed(1) + ' KB';
      details.appendChild(filename); details.appendChild(size);
      var remove = document.createElement('button'); remove.type = 'button'; remove.className = 'wa-preview-remove'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Remove attachment');
      remove.onclick = function () { fileInput.value = ''; preview.innerHTML = ''; preview.hidden = true; };
      preview.appendChild(thumb); preview.appendChild(details); preview.appendChild(remove);
      if (file.size > 55 * 1024) toast('File must be 55 KB or smaller. Please compress it before sending.', 'err');
    });
    document.getElementById('wa-cancel').addEventListener('click', function () { replyTo = null; document.getElementById('wa-replying').hidden = true; });
    document.getElementById('wa-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var text = ta.value.trim(), file = document.getElementById('wa-file').files[0]; if (!text && !file) return;
      var btn = view.querySelector('.wa-send'); btn.disabled = true;
      try {
        var attachment = null;
        if (file) {
          if (file.size > 55 * 1024) throw new Error('File must be 55 KB or smaller.');
          attachment = { name: file.name, data: await new Promise(function(resolve,reject) { var reader = new FileReader(); reader.onload = function() { resolve(reader.result); }; reader.onerror = reject; reader.readAsDataURL(file); }) };
        }
        if (replyTo) await api('/api/community/threads/' + encodeURIComponent(replyTo) + '/replies', { method: 'POST', body: { body: text, attachment: attachment } });
        else await api('/api/courses/' + encodeURIComponent(course.id) + '/community/threads', { method: 'POST', body: { title: (text || file.name).slice(0, 60), body: text, attachment: attachment } });
        replyTo = null; ta.value = ''; fileInput.value = ''; preview.hidden = true; preview.innerHTML = ''; await refreshMessages();
      } catch (err) { toast(err.message, 'err'); btn.disabled = false; }
    });
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
          player.innerHTML = '<iframe src="' + esc(playback.embedUrl) + '" title="' + esc(playback.title) + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
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
