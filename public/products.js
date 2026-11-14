(function () {
  'use strict';

  var grid = document.getElementById('grid');
  var chipsEl = document.getElementById('chips');
  var q = document.getElementById('q');
  var active = 'all';
  var PAGE_SIZE = 20;
  var page = 1;
  var pager = document.getElementById('pager');
  var count = document.getElementById('shop-count');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

  var ARROW_L = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  var ARROW_R = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

  function pageList(total, cur) {
    if (total <= 7) { var all = []; for (var i = 1; i <= total; i++) all.push(i); return all; }
    var out = [1];
    var from = Math.max(2, cur - 1), to = Math.min(total - 1, cur + 1);
    if (from > 2) out.push('…');
    for (var n = from; n <= to; n++) out.push(n);
    if (to < total - 1) out.push('…');
    out.push(total);
    return out;
  }

  function drawPager(total, pages, from, to) {
    if (count) count.innerHTML = total ? 'Showing <b>' + from + '&ndash;' + to + '</b> of <b>' + total + '</b> products' : '';
    if (!pager) return;
    if (pages <= 1) { pager.innerHTML = ''; pager.hidden = true; return; }
    pager.hidden = false;
    var nums = pageList(pages, page).map(function (n) {
      if (n === '…') return '<span class="pg-gap" aria-hidden="true">…</span>';
      return '<button type="button" class="pg-num' + (n === page ? ' on' : '') + '" data-page="' + n + '" aria-label="Page ' + n + '"' + (n === page ? ' aria-current="page"' : '') + '>' + n + '</button>';
    }).join('');
    pager.innerHTML =
      '<button type="button" class="pg-arrow pg-prev" data-go="-1" aria-label="Previous products"' + (page === 1 ? ' disabled' : '') + '>' + ARROW_L + '</button>' +
      '<div class="pg-mid"><div class="pg-nums">' + nums + '</div>' +
        '<div class="pg-bar" aria-hidden="true"><i style="width:' + (page / pages * 100) + '%"></i></div>' +
        '<p class="pg-label">Page <b>' + page + '</b> of ' + pages + '</p></div>' +
      '<button type="button" class="pg-arrow pg-next" data-go="1" aria-label="Next products"' + (page === pages ? ' disabled' : '') + '>' +
        '<span class="pg-next-t">Next</span>' + ARROW_R + '</button>';
  }

  function render(animate, dir) {
    var list = data.products.filter(matches);
    var pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (page > pages) page = pages;
    var start = (page - 1) * PAGE_SIZE;
    var slice = list.slice(start, start + PAGE_SIZE);
    grid.innerHTML = slice.length
      ? slice.map(card).join('')
      : '<p class="empty">Nothing matches that yet. Try another word, or <a href="https://wa.me/2348035988889" target="_blank" rel="noopener">ask us on WhatsApp</a>.</p>';
    drawPager(list.length, pages, list.length ? start + 1 : 0, start + slice.length);
    if (animate && window.gsap && !reduceMotion) {
      var x = dir ? dir * 60 : 0, y = dir ? 0 : 30;
      gsap.fromTo('#grid .pc', { x: x, y: y, opacity: 0, scale: 0.97 }, { x: 0, y: 0, opacity: 1, scale: 1, duration: 0.65, ease: 'power3.out', stagger: 0.035, clearProps: 'transform' });
    }
  }

  function goTo(n, dir) {
    var list = data.products.filter(matches);
    var pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    n = Math.min(pages, Math.max(1, n));
    if (n === page) return;
    var d = dir || (n > page ? 1 : -1);
    page = n;
    render(true, d);
    var top = document.querySelector('.shop-tools');
    if (top) {
      var y = top.getBoundingClientRect().top + window.pageYOffset - 100;
      if (window.__lenis && window.__lenis.scrollTo) window.__lenis.scrollTo(y, { duration: 1.1 });
      else window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
    try { history.replaceState(null, '', page > 1 ? '?page=' + page : location.pathname); } catch (e) {}
  }

  if (pager) pager.addEventListener('click', function (e) {
    var a = e.target.closest('[data-go]');
    if (a && !a.disabled) return goTo(page + Number(a.getAttribute('data-go')));
    var b = e.target.closest('[data-page]');
    if (b) goTo(Number(b.getAttribute('data-page')));
  });
  document.addEventListener('keydown', function (e) {
    if (/input|textarea|select/i.test((e.target.tagName || ''))) return;
    if (e.key === 'ArrowRight') goTo(page + 1);
    if (e.key === 'ArrowLeft') goTo(page - 1);
  });

  chipsEl.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-cat]');
    if (!b) return;
    active = b.getAttribute('data-cat');
    page = 1;
    chipsEl.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    render(true);
  });
  grid.addEventListener('click', function (e) {
    var b = e.target.closest('[data-add]');
    if (b && window.DeboneCart) window.DeboneCart.add(b.getAttribute('data-add'), 1);
  });
  var t;
  q.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { page = 1; render(true); }, 180); });

  fetch('/api/products').then(function (r) { return r.json(); }).then(function (d) {
    data = d;
    var qp = parseInt(new URLSearchParams(location.search).get('page'), 10);
    if (qp > 0) page = qp;
    drawPager(0, 1, 0, 0);
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
    fetch('/api/products').then(function (r) { return r.json(); }).then(function (d) { if (JSON.stringify(d) === JSON.stringify(data)) return; data = d; drawChips(); render(false); }).catch(function () {});
  });
})();
