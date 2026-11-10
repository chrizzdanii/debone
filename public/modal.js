/* Pop-up system (v24): animated dialogs and notification pop-ups. window.DModal */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var count = 0, toastHost = null;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function host() {
    if (!toastHost) { toastHost = document.createElement('div'); toastHost.className = 'dm-toasts'; toastHost.setAttribute('aria-live', 'polite'); document.body.appendChild(toastHost); }
    return toastHost;
  }

  function open(opts) {
    opts = opts || {};
    var back = document.createElement('div'); back.className = 'dm-back';
    var box = document.createElement('div');
    box.className = 'dm-box dm-' + (opts.size || 'md');
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    box.innerHTML = '<button type="button" class="dm-x" aria-label="Close">&times;</button>' +
      (opts.eyebrow ? '<p class="dm-eyebrow">' + opts.eyebrow + '</p>' : '') +
      (opts.title ? '<h3 class="dm-title">' + opts.title + '</h3>' : '') +
      '<div class="dm-body">' + (opts.body || '') + '</div>';
    back.appendChild(box); document.body.appendChild(back);
    document.body.classList.add('dm-lock'); count++;
    box.querySelectorAll('.dm-eyebrow, .dm-title, .dm-body > *').forEach(function (k, i) { k.style.setProperty('--i', i); k.classList.add('dm-kid'); });
    var closed = false;
    function close() {
      if (closed) return; closed = true;
      back.classList.add('out'); box.classList.add('out');
      document.removeEventListener('keydown', onKey);
      setTimeout(function () {
        back.remove(); count = Math.max(0, count - 1);
        if (count === 0) document.body.classList.remove('dm-lock');
      }, reduce ? 0 : 480);
    }
    function trap(e) {
      var f = box.querySelectorAll('button, [href], input, select, textarea');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    function onKey(e) { if (e.key === 'Escape') close(); if (e.key === 'Tab') trap(e); }
    box.querySelector('.dm-x').addEventListener('click', close);
    back.addEventListener('mousedown', function (e) { if (e.target === back) close(); });
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      back.classList.add('in'); box.classList.add('in');
      box.querySelectorAll('.dm-kid').forEach(function (k) { k.classList.add('in'); });
    }); });
    var inst = { el: box, close: close };
    if (opts.onMount) opts.onMount(box, inst);
    var first = box.querySelector('input, textarea, button.btn-solid');
    if (first && !reduce) setTimeout(function () { first.focus({ preventScroll: true }); }, 550);
    return inst;
  }

  function toast(opts) {
    opts = opts || {};
    var t = document.createElement('div');
    t.className = 'dm-toast dm-tone-' + (opts.tone || 'info');
    t.innerHTML = '<span class="dm-toast-ico">' + (window.DIcons ? DIcons.get('bell') : '') + '</span>' +
      '<div class="dm-toast-text"><b>' + esc(opts.title) + '</b>' + (opts.body ? '<span>' + esc(opts.body) + '</span>' : '') + '</div>' +
      '<button type="button" class="dm-toast-x" aria-label="Dismiss">&times;</button><i class="dm-toast-bar"></i>';
    host().appendChild(t);
    var timer;
    function dismiss() { clearTimeout(timer); t.classList.add('out'); setTimeout(function () { t.remove(); }, 450); }
    requestAnimationFrame(function () { requestAnimationFrame(function () { t.classList.add('in'); }); });
    timer = setTimeout(dismiss, opts.ms || 7000);
    t.addEventListener('mouseenter', function () { clearTimeout(timer); });
    t.addEventListener('mouseleave', function () { timer = setTimeout(dismiss, 2500); });
    t.querySelector('.dm-toast-x').addEventListener('click', function (e) { e.stopPropagation(); dismiss(); });
    t.addEventListener('click', function (e) {
      if (e.target.closest('.dm-toast-x') || !opts.link) return;
      if (opts.link.charAt(0) === '#') location.hash = opts.link; else location.href = opts.link;
      dismiss();
    });
    return { dismiss: dismiss };
  }

  window.DModal = { open: open, toast: toast, isOpen: function () { return count > 0; } };
})();
