(function () {
  'use strict';

  var grid = document.getElementById('grid');
  var chipsEl = document.getElementById('chips');
  var q = document.getElementById('q');
  var active = 'all';
  var data = { categories: [], products: [] };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function catLabel(id) {
    var c = data.categories.find(function (x) { return x.id === id; });
    return c ? c.label : '';
  }

  function drawChips() {
    var all = [{ id: 'all', label: 'All' }].concat(data.categories);
    chipsEl.innerHTML = all.map(function (c) {
      return '<button type="button" class="chip-btn" data-cat="' + esc(c.id) + '" aria-pressed="' + (c.id === active) + '">' + esc(c.label) + '</button>';
    }).join('');
  }

  function matches(p) {
    var term = q.value.trim().toLowerCase();
    var catOk = active === 'all' || p.cat === active;
    var textOk = !term || (p.name + ' ' + p.summary + ' ' + catLabel(p.cat)).toLowerCase().indexOf(term) > -1;
    return catOk && textOk;
  }

  var CAT_ICON = { cameras: 'camera', photo: 'camera', laptops: 'box', printing: 'printer', accessories: 'keyboard', creator: 'video' };
  function placeholder(p) {
    var name = CAT_ICON[p.cat] || 'box';
    return '<div class="pc-ph" aria-hidden="true">' + (window.DIcons ? DIcons.get(name) : '') + '</div>';
  }
  function card(p) {
    var media = p.image
      ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy">'
      : placeholder(p);
    return '' +
      '<article class="pc">' +
        '<a class="pc-media" href="product.html?id=' + encodeURIComponent(p.id) + '" aria-label="View ' + esc(p.name) + '">' + media +
          '<span class="pc-tag">' + esc(catLabel(p.cat)) + '</span></a>' +
        '<div class="pc-body">' +
          '<a class="pc-title" href="product.html?id=' + encodeURIComponent(p.id) + '"><h3>' + esc(p.name) + '</h3></a>' +
          '<p class="pc-sum">' + esc(p.summary) + '</p>' +
          '<div class="pc-foot">' +
            '<span class="pc-price">' + (p.price ? '₦' + Number(p.price).toLocaleString('en-US') : 'Price on request') + '</span>' +
            '<button type="button" class="pc-add" data-add="' + esc(p.id) + '" aria-label="Add ' + esc(p.name) + ' to your order">+</button>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function render(animate) {
    var list = data.products.filter(matches);
    grid.innerHTML = list.length
      ? list.map(card).join('')
      : '<p class="empty">Nothing matches that yet. Try another word, or <a href="https://wa.me/2348035988889" target="_blank" rel="noopener">ask us on WhatsApp</a>.</p>';
    if (animate && window.gsap && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.fromTo('#grid .pc', { y: 30, opacity: 0, scale: 0.98 }, { y: 0, opacity: 1, scale: 1, duration: 0.7, ease: 'power3.out', stagger: 0.05, clearProps: 'transform' });
    }
  }

  chipsEl.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-cat]');
    if (!b) return;
    active = b.getAttribute('data-cat');
    chipsEl.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    render(true);
  });
  grid.addEventListener('click', function (e) {
    var b = e.target.closest('[data-add]');
    if (b && window.DeboneCart) window.DeboneCart.add(b.getAttribute('data-add'), 1);
  });
  var t;
  q.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { render(true); }, 180); });

  fetch('/api/products').then(function (r) { return r.json(); }).then(function (d) {
    data = d;
    drawChips();
    render(false);
    if (window.gsap && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.fromTo('#grid .pc', { y: 50, opacity: 0 }, {
        y: 0, opacity: 1, duration: 1, ease: 'power3.out', stagger: 0.06, clearProps: 'transform',
        scrollTrigger: { trigger: '#grid', start: 'top 85%', once: true }
      });
    }
  }).catch(function () {
    grid.innerHTML = '<p class="empty">We could not load the shop right now. Please refresh the page.</p>';
  });
  window.addEventListener('debone:refresh', function () {
    if (window.DModal && DModal.isOpen()) return;
    fetch('/api/products').then(function (r) { return r.json(); }).then(function (d) { data = d; drawChips(); render(false); }).catch(function () {});
  });
})();
