/* Silent updates (v51): when data changes, a page is redrawn in place. No fade-in, no jump to the top, nothing the eye notices. */
(function () {
  'use strict';
  var st = { active: false, t: null, y: 0, spots: [] };
  function scrollers() {
    var out = [], el = document.getElementById('view');
    while (el && el !== document.body) { if (el.scrollHeight > el.clientHeight + 2) out.push(el); el = el.parentElement; }
    return out;
  }
  function end() {
    st.active = false; clearTimeout(st.t);
    requestAnimationFrame(function () { requestAnimationFrame(function () { document.body.classList.remove('silent'); }); });
  }
  window.DSilent = {
    get active() { return st.active; },
    begin: function () {
      st.active = true; st.y = window.scrollY; st.spots = scrollers().map(function (e) { return [e, e.scrollTop]; });
      document.body.classList.add('silent');
      clearTimeout(st.t); st.t = setTimeout(end, 900);
    },
    /* A loading skeleton is never drawn over a page that is already showing: the old content stays until the new content is ready */
    hold: function (html) {
      return st.active && String(html).indexOf('class="skeleton"') !== -1;
    },
    /* Called by every setView after the new HTML is in. Returns true when this was a silent redraw. */
    swapped: function () {
      if (!st.active) return false;
      window.scrollTo(0, st.y);
      st.spots.forEach(function (x) { x[0].scrollTop = x[1]; });
      requestAnimationFrame(function () { window.scrollTo(0, st.y); st.spots.forEach(function (x) { x[0].scrollTop = x[1]; }); });
      return true;
    },
    /* true when the person has typed or changed something that a redraw would wipe */
    dirty: function (root) {
      root = root || document.getElementById('view'); if (!root) return false;
      var ae = document.activeElement;
      if (ae && root.contains(ae) && /^(TEXTAREA|INPUT|SELECT)$/.test(ae.tagName) && ae.type !== 'button' && ae.type !== 'submit') return true;
      var f = root.querySelectorAll('input, textarea, select'), i, e;
      for (i = 0; i < f.length; i++) {
        e = f[i];
        if (e.type === 'hidden' || e.type === 'file' || e.type === 'button' || e.type === 'submit') { if (e.type === 'file' && e.files && e.files.length) return true; continue; }
        if (e.type === 'checkbox' || e.type === 'radio') { if (e.checked !== e.defaultChecked) return true; continue; }
        if (e.tagName === 'SELECT') {
          var sel = -1, def = 0, k;
          for (k = 0; k < e.options.length; k++) { if (e.options[k].selected) sel = k; if (e.options[k].defaultSelected) def = k; }
          if (sel !== def) return true; continue;
        }
        if (e.value !== e.defaultValue) return true;
      }
      if (root.querySelector('.lv-drawer.open, details[open], .wa-pending:not([hidden])')) return true;
      return false;
    }
  };
})();
