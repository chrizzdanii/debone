/* DEBONE error pages: glitch, cursor light, parallax, search, auto retry, offline detection. */
(function(){
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var code = document.querySelector('.err-code');
  if (code && !reduce) {
    (function loop(){
      setTimeout(function(){
        code.classList.add('glitch');
        setTimeout(function(){ code.classList.remove('glitch'); loop(); }, 140 + Math.random()*160);
      }, 2200 + Math.random()*2800);
    })();
  }
  // Soft light that follows the pointer + gentle parallax on the illustration
  var glow = document.querySelector('.err-cursor'), stage = document.querySelector('.err-stage svg');
  if (glow && !reduce && matchMedia('(pointer:fine)').matches) {
    var tx = 0, ty = 0, x = 0, y = 0;
    addEventListener('pointermove', function(e){ tx = e.clientX; ty = e.clientY; glow.style.opacity = 1;
      if (stage) { var dx = (e.clientX/innerWidth - .5), dy = (e.clientY/innerHeight - .5);
        stage.style.transform = 'perspective(900px) rotateY(' + (dx*10) + 'deg) rotateX(' + (-dy*10) + 'deg)'; } });
    (function raf(){ x += (tx-x)*.12; y += (ty-y)*.12; glow.style.transform = 'translate(' + x + 'px,' + y + 'px)'; requestAnimationFrame(raf); })();
    if (stage) stage.style.transition = 'transform .25s ease-out';
  }
  // Search: send people to the best matching page
  var form = document.querySelector('.err-search');
  if (form) form.addEventListener('submit', function(e){
    e.preventDefault();
    var q = (form.q.value || '').trim().toLowerCase();
    if (!q) { form.q.focus(); return; }
    var map = [
      [/nin|id card|enrol|validat/, 'nin.html'], [/course|class|learn|train|academy|edit|ai|student/, 'academy.html'],
      [/camera|shop|buy|product|store|equipment|lens/, 'store.html'], [/photo|video|event|wedding|drone|music|work|portfolio/, 'works.html'],
      [/service|print|cyber|bulk/, 'services.html'], [/book|quote|price/, 'book.html'], [/contact|phone|address|location|whatsapp/, 'contact.html'],
      [/login|log in|sign|account|dashboard|password/, 'login.html']
    ];
    for (var i = 0; i < map.length; i++) if (map[i][0].test(q)) { location.href = map[i][1]; return; }
    location.href = 'https://wa.me/2348035988889?text=' + encodeURIComponent('Hi DEBONE, I was looking for: ' + q);
  });
  // Auto retry (500 and 503 pages): data-retry="seconds"
  var st = document.querySelector('[data-retry]');
  if (st) {
    var total = +st.getAttribute('data-retry') || 30, left = total;
    var txt = st.querySelector('[data-count]'), bar = st.querySelector('.err-bar i');
    var target = st.getAttribute('data-target') || '/';
    function tick(){
      if (txt) txt.textContent = left + 's';
      if (bar) bar.style.width = ((total-left)/total*100) + '%';
      if (left-- <= 0) { check(); left = total; }
    }
    function check(){
      fetch(target, { cache:'no-store', method:'HEAD' }).then(function(r){
        if (r.ok) { st.classList.add('ok'); st.querySelector('[data-msg]').textContent = 'We are back. Taking you in…'; setTimeout(function(){ location.href = target; }, 700); }
      }).catch(function(){});
    }
    tick(); setInterval(tick, 1000);
    var rb = document.querySelector('[data-retry-now]'); if (rb) rb.addEventListener('click', function(e){ e.preventDefault(); left = 0; tick(); });
  }
  // Offline page: reconnect detection
  var off = document.querySelector('[data-offline]');
  if (off) {
    var msg = off.querySelector('[data-msg]');
    function upd(){ if (navigator.onLine) { off.classList.add('ok'); msg.textContent = 'Connection restored. Reloading…'; setTimeout(function(){ history.length > 1 ? history.back() : (location.href = '/'); }, 800); } else { off.classList.remove('ok'); msg.textContent = 'Waiting for your connection…'; } }
    addEventListener('online', upd); addEventListener('offline', upd); upd();
  }
  // Show the address that failed
  var path = document.querySelector('[data-path]'); if (path) path.textContent = location.pathname + location.search;
  var back = document.querySelector('[data-back]'); if (back) back.addEventListener('click', function(e){ if (history.length > 1) { e.preventDefault(); history.back(); } });
})();
/* Register the offline service worker */
if ('serviceWorker' in navigator) addEventListener('load', function(){ navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function(){}); });
