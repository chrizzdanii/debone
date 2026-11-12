/* DEBONE service worker: shows /offline.html when a page cannot be reached. Nothing else is cached. */
var VERSION = 'debone-offline-v1';
var CORE = ['/offline.html', '/error-pages.css?v=2', '/error-pages.js?v=2', '/favicon.svg'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION).then(function (c) {
      return Promise.all(CORE.map(function (u) { return c.add(u).catch(function () {}); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.indexOf('/api/') === 0) return; // never touch API calls

  // Page loads: go to the network; if the device is offline, show the offline page.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(function () {
        return caches.match('/offline.html', { ignoreSearch: true });
      })
    );
    return;
  }
  // Only the offline page's own assets are served from the cache, and only when the network fails.
  if (/^\/(error-pages\.(css|js)|favicon\.svg)$/.test(url.pathname)) {
    e.respondWith(fetch(req).catch(function () { return caches.match(req, { ignoreSearch: true }); }));
  }
});
