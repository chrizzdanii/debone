/* DEBONE: centrally managed contact and social links. */
(function () {
  'use strict';
  var settings = null;
  function number(value) {
    var d = String(value || '').replace(/\D/g, '');
    if (d.length === 11 && d.charAt(0) === '0') d = '234' + d.slice(1);
    return d;
  }
  function telephone(value) {
    var d = number(value);
    return d ? '+' + d : '';
  }
  function social(value) {
    try { var u = new URL(String(value || '').trim()); return /^https?:$/.test(u.protocol) ? u.href : ''; }
    catch (_) { return ''; }
  }
  function updatedLink(href) {
    if (!settings || !href) return null;
    var s = settings;
    if (/^(https?:\/\/)?(api\.)?wa\.me\//i.test(href) || /^https?:\/\/api\.whatsapp\.com\/send/i.test(href)) {
      var wa = number(s.whatsapp);
      if (!wa) return null;
      var query = href.indexOf('?') >= 0 ? href.slice(href.indexOf('?')) : '';
      return 'https://wa.me/' + wa + query;
    }
    if (/^tel:/i.test(href)) {
      var phone = /(?:8139763301|08139763301)/.test(href) ? s.phone2 : s.phone1;
      return telephone(phone) ? 'tel:' + telephone(phone) : null;
    }
    if (/^mailto:/i.test(href) && s.email) {
      var suffix = href.indexOf('?') >= 0 ? href.slice(href.indexOf('?')) : '';
      return 'mailto:' + s.email + suffix;
    }
    return null;
  }
  window.DeboneSiteContact = {
    get: function () { return settings ? Object.assign({}, settings) : null; },
    whatsapp: function (message) {
      var wa = number(settings && settings.whatsapp);
      return wa ? 'https://wa.me/' + wa + (message ? '?text=' + encodeURIComponent(message) : '') : '';
    },
    phone: function (secondary) { return telephone(settings && settings[secondary ? 'phone2' : 'phone1']); },
    refresh: refresh
  };
  function apply(root) {
    if (!settings) return;
    var s = settings;
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('[data-setting]').forEach(function (el) {
      var key = el.getAttribute('data-setting');
      if (Object.prototype.hasOwnProperty.call(s, key)) el.textContent = s[key] || '';
    });
    scope.querySelectorAll('a[href], [data-setting-href]').forEach(function (el) {
      var key = el.getAttribute('data-setting-href');
      var href = el.getAttribute('href') || '';
      var replacement = null;
      if (key === 'wa') replacement = window.DeboneSiteContact.whatsapp();
      else if (key === 'phone1' || key === 'phone2') replacement = 'tel:' + telephone(s[key]);
      else if (key === 'email' && s.email) replacement = 'mailto:' + s.email;
      else if (['facebook', 'instagram', 'tiktok', 'youtube'].indexOf(key) >= 0) replacement = social(s[key]);
      else replacement = updatedLink(href);
      if (replacement && replacement !== href) el.setAttribute('href', replacement);
    });
    // Old site-wide announcement is intentionally disabled.
    document.querySelectorAll('.site-announce').forEach(function (el) { el.remove(); });
  }
  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    setTimeout(function () { queued = false; apply(document); }, 0);
  }
  function refresh() {
    return fetch('/api/settings', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('Settings unavailable');
      return r.json();
    }).then(function (data) { settings = data.settings || {}; schedule(); return settings; });
  }
  // Catch links inserted later by catalogue, chat, cart and other components.
  if (typeof MutationObserver !== 'undefined') {
    var observer = new MutationObserver(function (records) {
      if (!settings) return;
      if (records.some(function (r) { return r.type === 'childList' && r.addedNodes.length; })) schedule();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
  document.addEventListener('click', function (event) {
    var el = event.target.closest && event.target.closest('a[href]');
    if (!el || !settings) return;
    var replacement = updatedLink(el.getAttribute('href'));
    if (replacement) el.setAttribute('href', replacement);
  }, true);
  window.addEventListener('debone:refresh', refresh);
  refresh().catch(function () {});
})();
