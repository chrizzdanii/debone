(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var ICON = {
    shield: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>',
    pin: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    wallet: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 14.5h2"/></svg>',
    bag: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    chat: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>'
  };
  /* A description is plain text: blank lines separate paragraphs, and lines that start with "- " become Highlights. */
  function parseDescription(text) {
    var paras = [], bullets = [], cur = [];
    function flush() { if (cur.length) { paras.push(cur.join(' ')); cur = []; } }
    String(text || '').split(/\r?\n/).forEach(function (line) {
      var t = line.trim();
      if (!t) { flush(); return; }
      var m = t.match(/^[-•*]\s+(.*)$/);
      if (m) { flush(); bullets.push(m[1]); } else cur.push(t);
    });
    flush();
    return { paras: paras, bullets: bullets };
  }
  var id = new URLSearchParams(location.search).get('id');
  var box = document.getElementById('product');
  var related = document.getElementById('related');

  var lastSig = null;
  function loadProduct() {
  fetch('/api/products', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (data) {
    var sig = JSON.stringify(data);
    if (sig === lastSig) return;
    var first = lastSig === null;
    lastSig = sig;
    var p = data.products.find(function (x) { return x.id === id; });
    if (!p) {
      box.innerHTML = '<div class="empty-state" style="grid-column:1/-1">We could not find that product. <a href="products.html">Back to the shop</a></div>';
      return;
    }
    var cat = data.categories.find(function (c) { return c.id === p.cat; });
    document.title = p.name + ' | DEBONE Shop';

    box.classList.toggle('pv-still', !first);
    var doc = parseDescription(p.description);
    var priceText = p.price ? '₦' + Number(p.price).toLocaleString('en-US') : '';
    var wa = 'https://wa.me/2348035988889?text=' + encodeURIComponent('Hi DEBONE, I want to ask about: ' + p.name);

    var crumbs = document.getElementById('pv-crumbs');
    if (crumbs) crumbs.innerHTML = '<a href="index.html">Home</a><i aria-hidden="true">/</i><a href="products.html">Shop</a>' +
      (cat ? '<i aria-hidden="true">/</i><a href="products.html">' + esc(cat.label) + '</a>' : '') +
      '<i aria-hidden="true">/</i><span aria-current="page">' + esc(p.name) + '</span>';

    box.innerHTML =
      '<div class="product-gallery pv-in" style="--d:0">' +
        '<div class="gallery-main pv-frame">' + (p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '">' : '<div class="gallery-art"><span>' + esc(p.name.split(' ')[0]) + '</span></div>') + '</div>' +
        '<ul class="pv-trust">' +
          '<li>' + ICON.shield + '<b>Honest advice</b><span>We match the product to your work</span></li>' +
          '<li>' + ICON.pin + '<b>Port Harcourt</b><span>Pickup at our office or delivery</span></li>' +
          '<li>' + ICON.wallet + '<b>Pay after we confirm</b><span>Bank transfer or cash</span></li>' +
        '</ul>' +
      '</div>' +
      '<div class="product-info">' +
        '<p class="prod-cat pv-in" style="--d:1"><span>' + esc(cat ? cat.label : 'Shop') + '</span></p>' +
        '<h1 class="pv-in" style="--d:2">' + esc(p.name) + '</h1>' +
        '<p class="product-summary pv-in" style="--d:3">' + esc(p.summary) + '</p>' +
        '<div class="pv-buy pv-in" style="--d:4">' +
          '<div class="pv-price">' + (priceText ? '<small>Price</small><b>' + priceText + '</b>' : '<small>Price</small><b class="is-ask">Ask for today\'s price</b>') + '</div>' +
          '<p class="pv-avail"><i aria-hidden="true"></i>Stock and price confirmed on WhatsApp before you pay</p>' +
          '<div class="product-actions">' +
            '<button type="button" class="btn btn-solid pv-add" id="add-order">' + ICON.bag + 'Add to order list</button>' +
            '<a class="btn btn-ghost" target="_blank" rel="noopener" href="' + wa + '">' + ICON.chat + 'Ask on WhatsApp</a>' +
          '</div>' +
        '</div>' +
        '<div class="product-desc pv-in" style="--d:5"><h3>About this product</h3>' +
          doc.paras.map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') + '</div>' +
        (doc.bullets.length ? '<div class="pv-high pv-in" style="--d:6"><h3>Highlights</h3><ul class="product-points">' +
          doc.bullets.map(function (t, i) { return '<li style="--i:' + i + '"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><span>' + esc(t) + '</span></li>'; }).join('') + '</ul></div>' : '') +
        '<ol class="pv-steps pv-in" style="--d:7" aria-label="How ordering works">' +
          '<li><b>1</b><div><strong>Add it to your order list</strong><span>Pick everything you need in one go.</span></div></li>' +
          '<li><b>2</b><div><strong>Send it on WhatsApp</strong><span>We confirm price, stock and delivery or pickup.</span></div></li>' +
          '<li><b>3</b><div><strong>Pay and collect</strong><span>Pay after confirmation, by bank transfer or cash at our office.</span></div></li>' +
        '</ol>' +
      '</div>';

    document.getElementById('add-order').addEventListener('click', function () {
      if (window.DeboneCart) window.DeboneCart.add(p.id, 1);
    });

    var others = data.products.filter(function (x) { return x.id !== p.id && x.cat === p.cat; }).slice(0, 3);
    if (others.length < 3) {
      data.products.forEach(function (x) {
        if (others.length < 3 && x.id !== p.id && others.indexOf(x) === -1) others.push(x);
      });
    }
    related.innerHTML = others.map(function (x) {
      return '<article class="prod"><a class="prod-link" href="product.html?id=' + encodeURIComponent(x.id) + '">' +
        (x.image ? '<div class="prod-art"><img src="' + esc(x.image) + '" alt="" loading="lazy"></div>' : '<div class="prod-art" aria-hidden="true"><span>' + esc(x.name.split(' ')[0]) + '</span></div>') +
        '<div class="prod-body"><p class="prod-cat">' + esc((data.categories.find(function (c) { return c.id === x.cat; }) || {}).label || '') + '</p>' +
        '<h3>' + esc(x.name) + '</h3><p>' + esc(x.summary) + '</p></div></a></article>';
    }).join('');
    if (!first) document.querySelectorAll('#product .pv-in, #related .reveal').forEach(function (el) { el.classList.add('in'); });
  }).catch(function () {
    if (lastSig === null) box.innerHTML = '<div class="empty-state" style="grid-column:1/-1">We could not load this product. Please try again in a moment.</div>';
  });
  }
  loadProduct();
  window.addEventListener('debone:refresh', function () { if (!(window.DModal && DModal.isOpen())) loadProduct(); });
})();
