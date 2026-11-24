/* Payment choice: pay once, or in 2 or 3 installments. window.DInstall
   DInstall.panel(host, { load: function () { return Promise<{ totalNaira, installments:[{count,first,schedule:[{no,amountNaira,dueLabel}]}], rules }> }, onChange })
   returns { value(): 0 | 2 | 3, refresh() }.   DInstall.ask(opts) opens a small pop-up (used for bundles). */
(function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function naira(n) { return '₦' + Math.round(Number(n) || 0).toLocaleString('en-US'); }

  function rulesText(r) {
    r = r || {};
    return '<ul class="ins-rules"><li>Your first payment opens the course straight away.</li>' +
      '<li>Each later payment is due on the date shown, always before the course ends. You can pay early, or settle the whole balance at any time.</li>' +
      '<li>If a payment is late we remind you. After ' + (r.graceDays != null ? r.graceDays : 3) + ' day(s) past the due date your access pauses until you pay. Your progress is saved and the course opens again as soon as we confirm your payment.</li>' +
      '<li>Your certificate is issued after the last installment.</li></ul>';
  }

  function panel(host, opts) {
    var data = null, choice = 0;
    function draw() {
      if (!data) { host.innerHTML = '<p class="muted small">Loading payment options…</p>'; return; }
      var list = data.installments || [];
      if (!list.length) { choice = 0; host.innerHTML = ''; if (opts.onChange) opts.onChange(0, data); return; }
      if (choice && !list.some(function (o) { return o.count === choice; })) choice = 0;
      var html = '<fieldset class="ins"><legend>How would you like to pay?</legend>' +
        '<label class="ins-opt' + (choice === 0 ? ' on' : '') + '"><input type="radio" name="ins-plan" value="0"' + (choice === 0 ? ' checked' : '') + '><span><b>Pay in full</b><small>' + naira(data.totalNaira) + ' today</small></span></label>';
      list.forEach(function (o) {
        var rest = o.schedule.slice(1).map(function (s) { return naira(s.amountNaira); }).join(' + ');
        html += '<label class="ins-opt' + (choice === o.count ? ' on' : '') + '"><input type="radio" name="ins-plan" value="' + o.count + '"' + (choice === o.count ? ' checked' : '') + '><span><b>' + o.count + ' installments</b><small>' + naira(o.first) + ' today, then ' + rest + '</small></span></label>';
      });
      var sel = list.filter(function (o) { return o.count === choice; })[0];
      if (sel) {
        html += '<div class="ins-sched"><table><tbody>' + sel.schedule.map(function (s) {
          return '<tr><td>' + (s.no === 1 ? 'Today' : esc(s.dueLabel)) + '</td><td>Installment ' + s.no + ' of ' + sel.count + '</td><td>' + naira(s.amountNaira) + '</td></tr>';
        }).join('') + '<tr class="ins-tot"><td colspan="2">Total</td><td>' + naira(data.totalNaira) + '</td></tr></tbody></table>' + rulesText(data.rules) + '</div>';
      }
      host.innerHTML = html + '</fieldset>';
      host.querySelectorAll('input[name="ins-plan"]').forEach(function (r) {
        r.addEventListener('change', function () { choice = Number(r.value); draw(); if (opts.onChange) opts.onChange(choice, data); });
      });
      if (opts.onChange) opts.onChange(choice, data);
    }
    function refresh() { data = null; draw(); return opts.load().then(function (d) { data = d; draw(); }).catch(function () { data = { installments: [], totalNaira: 0 }; draw(); }); }
    refresh();
    return { value: function () { return choice; }, refresh: refresh };
  }

  // Pop-up for bundles: pick how to pay, then call opts.go(planCount)
  function ask(opts) {
    DModal.open({ size: 'md', eyebrow: 'Payment', title: esc(opts.title), body: '<div id="ins-host"></div><p class="form-error" id="ins-err" role="alert"></p><button type="button" class="btn btn-solid enrol-go" id="ins-go">Continue to payment</button>',
      onMount: function (box, inst) {
        var go = box.querySelector('#ins-go'), err = box.querySelector('#ins-err');
        var ctl = panel(box.querySelector('#ins-host'), { load: opts.load, onChange: function (n, d) { go.textContent = n && d ? 'Continue · pay ' + naira(d.installments.filter(function (o) { return o.count === n; })[0].first) + ' now' : 'Continue to payment'; } });
        go.addEventListener('click', function () {
          go.disabled = true; err.textContent = '';
          Promise.resolve(opts.go(ctl.value())).catch(function (e) { err.textContent = e.message || 'Something went wrong.'; go.disabled = false; });
        });
      } });
  }

  window.DInstall = { panel: panel, ask: ask, esc: esc, naira: naira };
})();
