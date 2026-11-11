/* Business details from Site settings, applied to every public page (v26). */
(function () {
  'use strict';
  function digits(v) { return String(v || '').replace(/[^0-9+]/g, ''); }
  var lastSig = null;
  function apply() {
  fetch('/api/settings', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
    var sg = JSON.stringify(d.settings || {}); if (sg === lastSig) return; lastSig = sg;
    var s = d.settings || {};
    document.querySelectorAll('[data-setting]').forEach(function (el) {
      var key = el.getAttribute('data-setting');
      if (s[key]) el.textContent = s[key];
    });
    document.querySelectorAll('[data-setting-href]').forEach(function (el) {
      var key = el.getAttribute('data-setting-href');
      if (key === 'wa' && s.whatsapp) el.setAttribute('href', 'https://wa.me/' + digits(s.whatsapp).replace('+', ''));
      if ((key === 'phone1' || key === 'phone2') && s[key]) el.setAttribute('href', 'tel:' + digits(s[key]));
    });
    var old = document.querySelector('.site-announce'); if (old) old.remove();
    if (s.announcementOn && s.announcement) {
      var bar = document.createElement('div');
      bar.className = 'site-announce';
      bar.setAttribute('role', 'region');
      bar.setAttribute('aria-label', 'Announcement');
      bar.innerHTML = '<span></span><button type="button" aria-label="Close announcement">&times;</button>';
      bar.querySelector('span').textContent = s.announcement;
      bar.querySelector('button').addEventListener('click', function () { bar.classList.add('out'); setTimeout(function () { bar.remove(); }, 400); });
      document.body.appendChild(bar);
    }
  }).catch(function () {});
  }
  apply();
  window.addEventListener('debone:refresh', apply);
})();
