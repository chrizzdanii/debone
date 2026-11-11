/* Shared top bar for the student dashboard and the admin panel: user badge, notifications and log out. */
(function () {
  'use strict';
  var kind = document.body.getAttribute('data-shell') || 'student';
  var bar = document.querySelector('.topbar');
  if (!bar) return;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function when(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  var KIND = { announcement: 'News', live: 'Live class', assignment: 'Assignment', graded: 'Marked', submission: 'To mark' };

  var wrap = document.createElement('div');
  wrap.className = 'top-actions';
  wrap.innerHTML =
    '<div class="user-chip" title="Signed in">' +
      '<span class="avatar" id="shell-avatar">··</span>' +
      '<span class="user-meta"><b id="shell-name">Signed in</b><small>' + (kind === 'staff' ? 'Staff' : 'Student') + '</small></span>' +
    '</div>' +
    '<div class="bell-wrap">' +
      '<button type="button" class="bell" aria-label="Notifications" aria-expanded="false" aria-controls="bell-panel">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>' +
        '<span class="bell-badge" hidden>0</span>' +
      '</button>' +
      '<div class="bell-panel" id="bell-panel" hidden>' +
        '<header><b>Notifications</b><button type="button" class="bell-clear">Mark all read</button></header>' +
        '<ul class="bell-list"></ul>' +
      '</div>' +
    '</div>' +
    '<button type="button" class="shell-logout">Log out</button>';
  bar.appendChild(wrap);

  var bell = wrap.querySelector('.bell');
  var badge = wrap.querySelector('.bell-badge');
  var panel = wrap.querySelector('#bell-panel');
  var list = wrap.querySelector('.bell-list');
  var seenAt = '';

  /* Show the signed-in name and initials, read from the page's own name field */
  function syncName() {
    var src = document.getElementById('me-name');
    var name = src && src.textContent && src.textContent !== 'Loading…' ? src.textContent.trim() : '';
    if (!name) return;
    document.getElementById('shell-name').textContent = name;
    if (document.getElementById('shell-avatar').dataset.photo) return;
    var initials = name.split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join('');
    document.getElementById('shell-avatar').textContent = initials || '··';
  }

  function render(data) {
    seenAt = data.seenAt || '';
    var unread = data.unread || 0;
    badge.textContent = unread > 99 ? '99+' : String(unread);
    badge.hidden = unread === 0;
    if (!data.items.length) { list.innerHTML = '<li class="bell-empty">Nothing new yet.</li>'; return; }
    list.innerHTML = data.items.map(function (n) {
      var isNew = n.createdAt && n.createdAt > seenAt;
      return '<li class="' + (isNew ? 'unread' : '') + '"><a href="' + esc(n.link || '#') + '">' +
        '<small>' + esc(KIND[n.kind] || 'Update') + '</small>' +
        '<b>' + esc(n.title) + '</b>' +
        (n.body ? '<span>' + esc(n.body) + '</span>' : '') +
        '<span>' + esc(when(n.createdAt)) + '</span></a></li>';
    }).join('');
  }

  function load() {
    syncName();
    return fetch('/api/notifications', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d) render(d); })
      .catch(function () {});
  }
  function markRead() {
    return fetch('/api/notifications/read', { method: 'POST', credentials: 'same-origin' })
      .then(function () { badge.hidden = true; badge.textContent = '0'; seenAt = new Date().toISOString(); });
  }
  function closePanel() { panel.hidden = true; bell.setAttribute('aria-expanded', 'false'); }

  bell.addEventListener('click', function (e) {
    e.stopPropagation();
    var open = panel.hidden;
    panel.hidden = !open;
    bell.setAttribute('aria-expanded', String(open));
    if (open) load().then(function () { if (!badge.hidden) markRead(); });
  });
  wrap.querySelector('.bell-clear').addEventListener('click', function () { markRead().then(load); });
  document.addEventListener('click', function (e) { if (!panel.hidden && !wrap.contains(e.target)) closePanel(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePanel(); });

  wrap.querySelector('.shell-logout').addEventListener('click', function () {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(function () {})
      .then(function () { location.replace(kind === 'staff' ? 'staff-login.html' : 'login.html'); });
  });

  /* Show the photo (or the initials) in the top bar. Called on load, after every change and on every refresh. */
  function setAvatar(src) {
    var el = document.getElementById('shell-avatar');
    if (!el) return;
    if (src) {
      el.textContent = '';
      el.dataset.photo = '1';
      el.style.backgroundImage = 'url(' + src + ')';
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
    } else {
      delete el.dataset.photo; delete el.dataset.src;
      el.style.backgroundImage = '';
      syncName();
    }
  }
  function applyUser(u) {
    if (!u) return;
    if (u.name) {
      var sn = document.getElementById('shell-name'); if (sn.textContent !== u.name) sn.textContent = u.name;
      var side = document.getElementById('me-name'); if (side && side.textContent !== u.name) side.textContent = u.name;
    }
    if (u.hasAvatar) { var av = '/api/me/avatar?v=' + (u.avatarV || 'x'); var cur = document.getElementById('shell-avatar'); if (!(cur && cur.dataset.photo && cur.dataset.src === av)) { setAvatar(av); if (cur) cur.dataset.src = av; } }
    else {
      setAvatar('');
      var initials = (u.name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join('');
      document.getElementById('shell-avatar').textContent = initials || '··';
    }
  }
  function syncPhoto() {
    return fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (d && d.user) applyUser(d.user);
    }).catch(function () {});
  }
  window.DShell = { applyUser: applyUser, setAvatar: setAvatar, refreshUser: syncPhoto };
  /* Changes made on this page show immediately (no waiting for a refresh) */
  window.addEventListener('debone:user', function (e) { applyUser(e.detail); });
  window.addEventListener('debone:avatar-preview', function (e) { setAvatar(e.detail && e.detail.src); });
  /* Changes made elsewhere (another tab or device) arrive with the next refresh */
  var lastUserSync = 0;
  window.addEventListener('debone:refresh', function () {
    if (Date.now() - lastUserSync < 700) return;
    lastUserSync = Date.now(); syncPhoto();
  });
  syncPhoto();
  load();
  setInterval(load, 60000);
  /* A new notice arrived (or the pop-up marked things read): refresh the bell straight away */
  window.addEventListener('debone:notice', function () { setTimeout(load, 400); });
  var lastBell = 0;
  window.addEventListener('debone:refresh', function () { if (Date.now() - lastBell < 700) return; lastBell = Date.now(); load(); });
  window.addEventListener('debone:notice-read', function () { setTimeout(load, 200); });
  setTimeout(syncName, 800);
  setTimeout(syncName, 2500);
})();
