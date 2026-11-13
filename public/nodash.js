/* DEBONE: keeps dashes out of the Studio, About and Services copy, including text typed later in the admin "Page content" panel. */
(function () {
  'use strict';
  var L = 'A-Za-z\\u00C0-\\u024F';
  var spaced = /\s+[–—-]\s+/g, joined = new RegExp('(?<=[' + L + '])-(?=[' + L + '])', 'g'), long = /[–—]/g;
  function clean(t) { return t.replace(spaced, ', ').replace(long, ', ').replace(joined, ' '); }
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, CODE: 1, PRE: 1, SVG: 1, NOSCRIPT: 1 };
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { fix(root); return; }
    if (root.nodeType !== 1 || SKIP[root.tagName.toUpperCase()]) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n, list = [];
    while ((n = w.nextNode())) list.push(n);
    list.forEach(fix);
    if (root.tagName === 'IMG' || root.querySelector) {
      var imgs = root.tagName === 'IMG' ? [root] : root.querySelectorAll('img[alt]');
      Array.prototype.forEach.call(imgs, function (i) { var a = i.getAttribute('alt'); if (a) { var c = clean(a); if (c !== a) i.setAttribute('alt', c); } });
    }
  }
  function fix(n) {
    var p = n.parentNode; if (!p || SKIP[(p.nodeName || '').toUpperCase()]) return;
    var t = n.nodeValue; if (!t || !/[-–—]/.test(t) || /@|https?:|\d-\d/.test(t)) return;
    var c = clean(t); if (c !== t) n.nodeValue = c;
  }
  function start() {
    walk(document.body);
    if (document.title) document.title = clean(document.title);
    if ('MutationObserver' in window) new MutationObserver(function (ms) {
      ms.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, walk); if (m.type === 'characterData') fix(m.target); });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
