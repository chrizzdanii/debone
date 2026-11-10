(function () {
  'use strict';

  var KEY = 'debone-order-list';
  var WA_NUMBER = '2348035988889';
  var catalog = null;
  var catalogPromise = fetch('/data/products.json').then(function (r) { return r.json(); }).then(function (d) {
    catalog = d; return d;
  }).catch(function () { catalog = { products: [] }; return catalog; });

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
  }
  function write(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    render();
  }
  function find(id) {
    return (catalog && catalog.products || []).find(function (p) { return p.id === id; });
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var api = {
    items: read,
    add: function (id, qty) {
      var items = read();
      var hit = items.find(function (i) { return i.id === id; });
      if (hit) hit.qty += qty || 1; else items.push({ id: id, qty: qty || 1 });
      write(items);
      open();
    },
    setQty: function (id, qty) {
      var items = read().map(function (i) { if (i.id === id) i.qty = qty; return i; })
        .filter(function (i) { return i.qty > 0; });
      write(items);
    },
    remove: function (id) { write(read().filter(function (i) { return i.id !== id; })); },
    clear: function () { write([]); },
    message: function () {
      var lines = read().map(function (i, n) {
        var p = find(i.id);
        return (n + 1) + '. ' + (p ? p.name : i.id) + ' x' + i.qty;
      });
      var text = 'Hi DEBONE, I would like to place this order:\n' + lines.join('\n') +
        '\n\nPlease confirm the price, availability and how I can pay.';
      return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(text);
    }
  };
  window.DeboneCart = api;

  /* ---- UI ---- */
  var drawer, btnCount;

  function buildUI() {
    var actions = document.querySelector('.nav-actions');
    if (actions) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cart-btn';
      btn.setAttribute('aria-label', 'Open your order list');
      btn.innerHTML = 'Order <span class="cart-count" id="cart-count">0</span>';
      btn.addEventListener('click', open);
      var menu = actions.querySelector('.menu-btn');
      actions.insertBefore(btn, menu || null);
      btnCount = btn.querySelector('.cart-count');
    }
    drawer = document.createElement('div');
    drawer.className = 'cart';
    drawer.hidden = true;
    drawer.innerHTML =
      '<div class="cart-scrim" data-close></div>' +
      '<aside class="cart-panel" role="dialog" aria-modal="true" aria-label="Your order list">' +
        '<header class="cart-head"><h2>Your order list</h2><button type="button" class="cart-x" data-close aria-label="Close">&times;</button></header>' +
        '<div class="cart-body" id="cart-body"></div>' +
        '<footer class="cart-foot">' +
          '<p class="cart-note">Prices are confirmed on WhatsApp. Nothing is charged here.</p>' +
          '<a class="btn btn-solid cart-send" id="cart-send" target="_blank" rel="noopener">Send order on WhatsApp</a>' +
          '<button type="button" class="cart-clear" id="cart-clear">Clear list</button>' +
        '</footer>' +
      '</aside>';
    document.body.appendChild(drawer);

    drawer.addEventListener('click', function (e) {
      if (e.target.hasAttribute('data-close')) close();
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var id = b.getAttribute('data-id');
      var cur = read().find(function (i) { return i.id === id; });
      if (b.getAttribute('data-act') === 'inc') api.setQty(id, (cur ? cur.qty : 0) + 1);
      if (b.getAttribute('data-act') === 'dec') api.setQty(id, (cur ? cur.qty : 1) - 1);
      if (b.getAttribute('data-act') === 'rm') api.remove(id);
    });
    document.getElementById('cart-clear').addEventListener('click', function () { api.clear(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  function open() { if (drawer) { drawer.hidden = false; requestAnimationFrame(function () { drawer.classList.add('open'); }); render(); } }
  function close() { if (drawer) { drawer.classList.remove('open'); setTimeout(function () { drawer.hidden = true; }, 350); } }

  function render() {
    var items = read();
    var total = items.reduce(function (s, i) { return s + i.qty; }, 0);
    if (btnCount) btnCount.textContent = total;
    if (!drawer) return;
    var body = document.getElementById('cart-body');
    var send = document.getElementById('cart-send');
    send.href = api.message();
    send.classList.toggle('disabled', items.length === 0);
    if (!items.length) {
      body.innerHTML = '<div class="cart-empty"><p>Your order list is empty.</p><a href="products.html">Browse the shop</a></div>';
      return;
    }
    body.innerHTML = items.map(function (i) {
      var p = find(i.id) || { name: i.id, summary: '' };
      return '<div class="cart-line">' +
        '<div><b>' + esc(p.name) + '</b><span>' + esc(p.summary || '') + '</span></div>' +
        '<div class="cart-qty">' +
          '<button type="button" data-act="dec" data-id="' + esc(i.id) + '" aria-label="Decrease">&minus;</button>' +
          '<span>' + i.qty + '</span>' +
          '<button type="button" data-act="inc" data-id="' + esc(i.id) + '" aria-label="Increase">+</button>' +
        '</div>' +
        '<button type="button" class="cart-rm" data-act="rm" data-id="' + esc(i.id) + '">Remove</button>' +
      '</div>';
    }).join('');
  }

  function init() {
    buildUI();
    render();
    catalogPromise.then(render);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
