(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
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
    var cn = document.getElementById('crumb-name'); if (cn) cn.textContent = p.name;
    document.title = p.name + ' | DEBONE Shop';

    box.innerHTML =
      '<div class="product-gallery reveal">' +
        '<div class="gallery-main">' + (p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '">' : '<div class="gallery-art"><span>' + esc(p.name.split(' ')[0]) + '</span></div>') + '</div>' +
        '<p class="muted gallery-note">Product photos are added as we stock each item. Ask us for live photos on WhatsApp.</p>' +
      '</div>' +
      '<div class="product-info reveal">' +
        '<p class="prod-cat">' + esc(cat ? cat.label : '') + '</p>' +
        '<h1>' + esc(p.name) + '</h1>' +
        '<p class="product-summary">' + esc(p.summary) + '</p>' +
        '<p class="product-price">' + (p.price ? '₦' + Number(p.price).toLocaleString('en-US') : 'Price on request') + '</p>' +
        '<div class="empty-state">Prices and stock are confirmed on WhatsApp before you pay.</div>' +
        '<div class="product-actions">' +
          '<button type="button" class="btn btn-solid" id="add-order">Add to order list</button>' +
          '<a class="btn btn-ghost" target="_blank" rel="noopener" href="https://wa.me/2348035988889?text=' + encodeURIComponent('Hi DEBONE, I want to ask about: ' + p.name) + '">Ask on WhatsApp</a>' +
        '</div>' +
        '<div class="product-desc"><h3>About this product</h3><p>' + esc(p.description) + '</p></div>' +
        '<ul class="product-points">' +
          '<li>Confirm price, stock and delivery or pickup on WhatsApp</li>' +
          '<li>Pay after confirmation, by bank transfer or cash at our office</li>' +
          '<li>Advice on the right model for your work, free of charge</li>' +
        '</ul>' +
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
    if (!first) document.querySelectorAll('#product .reveal, #related .reveal').forEach(function (el) { el.classList.add('in'); });
  }).catch(function () {
    if (lastSig === null) box.innerHTML = '<div class="empty-state" style="grid-column:1/-1">We could not load this product. Please try again in a moment.</div>';
  });
  }
  loadProduct();
  window.addEventListener('debone:refresh', function () { if (!(window.DModal && DModal.isOpen())) loadProduct(); });
})();
