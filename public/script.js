(function () {
  'use strict';
  var MENU_OPEN = "<svg viewBox=\"0 0 24 24\" width=\"22\" height=\"22\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" aria-hidden=\"true\"><path d=\"M4 7h16M4 12h16M4 17h16\"/></svg>";
  var MENU_CLOSE = "<svg viewBox=\"0 0 24 24\" width=\"22\" height=\"22\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" aria-hidden=\"true\"><path d=\"M6 6l12 12M18 6L6 18\"/></svg>";

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  var animate = hasGsap && !reduce;

  function $(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  var nav = document.getElementById('nav');
  var menu = document.getElementById('menu');
  var menuBtn = document.querySelector('.menu-btn');
  var progress = document.querySelector('.progress');

  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  /* 1. Smooth scrolling (Lenis, synced with ScrollTrigger) */
  var lenis = null;
  if (animate && window.Lenis) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  /* 2. Mobile menu */
  function setMenu(open) {
    if (!menu || !menuBtn) return;
    menu.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.innerHTML = open ? MENU_CLOSE : MENU_OPEN;
    document.body.style.overflow = open ? 'hidden' : '';
  }
  if (menuBtn && !menuBtn.__menuWired) { menuBtn.__menuWired = true; menuBtn.addEventListener('click', function () {
    setMenu(!menu.classList.contains('open'));
  }); }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setMenu(false);
  });

  /* 3. In-page links */
  $('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var href = a.getAttribute('href');
      var target = href.length > 1 ? document.querySelector(href) : null;
      setMenu(false);
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: -72, duration: 1.2 });
      else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
  });

  /* 4. Scroll state: progress bar, nav background, hide on scroll down */
  var lastY = 0;
  function onScroll() {
    var y = window.scrollY;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.transform = 'scaleX(' + (max > 0 ? y / max : 0) + ')';
    nav.classList.toggle('scrolled', y > 40);
    var menuOpen = menu && menu.classList.contains('open');
    nav.classList.toggle('hide', !menuOpen && y > lastY && y > 480);
    lastY = y;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* 5. Split headlines into masked words */
  function splitWords(el, highlight) {
    var text = el.textContent.trim();
    el.setAttribute('aria-label', text);
    el.innerHTML = text.split(/\s+/).map(function (w) {
      var clean = w.replace(/[^a-z]/gi, '').toLowerCase();
      var cls = highlight && highlight.indexOf(clean) > -1 ? ' hi' : '';
      return '<span class="word' + cls + '" aria-hidden="true"><span class="inner">' + w + '</span></span>';
    }).join(' ');
    return $('.inner', el);
  }
  var heroTitle = document.querySelector('.hero h1');
  var heroWords = heroTitle ? splitWords(heroTitle) : [];

  /* Mission: wrap each word so it can fill in on scroll */
  var fill = document.querySelector('.fill-text');
  var fillWords = [];
  if (fill) {
    var keys = ['remembered', 'beautifully', 'skills'];
    fill.setAttribute('aria-label', fill.textContent.trim());
    fill.innerHTML = fill.textContent.trim().split(/\s+/).map(function (w) {
      var clean = w.replace(/[^a-z]/gi, '').toLowerCase();
      return '<span class="w' + (keys.indexOf(clean) > -1 ? ' hi' : '') + '" aria-hidden="true">' + w + '</span>';
    }).join(' ');
    fillWords = $('.w', fill);
  }

  /* 6. Motion */
  if (animate) {
    // Hero intro
    var intro = gsap.timeline({ defaults: { ease: 'expo.out' } });
    intro
      .from(heroWords, { yPercent: 110, duration: 1.3, stagger: 0.07 })
      .from('.hero .eyebrow, .hero .lead, .hero .cta-row', { y: 26, opacity: 0, duration: 1, stagger: 0.12 }, '-=0.9');

    // Hero video drifts slightly as you scroll away
    gsap.to('.hero-video', {
      yPercent: 12, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
    });

    // Generic reveal for anything marked .reveal
    $('.reveal').forEach(function (el) {
      gsap.from(el, {
        y: 40, opacity: 0, duration: 1.1, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });

    // Staggered reveals for grids
    ScrollTrigger.batch('.card', {
      start: 'top 90%', once: true,
      onEnter: function (batch) {
        gsap.from(batch, { y: 60, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.12 });
      }
    });
    ScrollTrigger.batch('.tile', {
      start: 'top 92%', once: true,
      onEnter: function (batch) {
        gsap.from(batch, { y: 50, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.09 });
      }
    });

    // Mission words fill in as you scroll
    if (fillWords.length) {
      gsap.set(fillWords, { opacity: 0.15 });
      gsap.to(fillWords, {
        opacity: 1, stagger: 0.1, ease: 'none',
        scrollTrigger: { trigger: '.mission', start: 'top 75%', end: 'bottom 55%', scrub: true }
      });
    }

    // Parallax on the story and feature videos
    gsap.fromTo('.story-media video', { yPercent: -6 }, {
      yPercent: 6, ease: 'none',
      scrollTrigger: { trigger: '.story', start: 'top bottom', end: 'bottom top', scrub: true }
    });
    gsap.fromTo('.feature-media video', { scale: 1.12 }, {
      scale: 1, ease: 'none',
      scrollTrigger: { trigger: '.feature', start: 'top bottom', end: 'bottom top', scrub: true }
    });
  }

  /* 7. Counters */
  $('[data-count]').forEach(function (el) {
    var end = +el.getAttribute('data-count');
    var plus = el.hasAttribute('data-plus');
    var obj = { v: 0 };
    function fmt(n) { return Math.round(n).toLocaleString('en-US') + (plus ? '+' : ''); }
    if (!animate) { el.textContent = fmt(end); return; }
    el.textContent = fmt(0);
    ScrollTrigger.create({
      trigger: el, start: 'top 90%', once: true,
      onEnter: function () {
        gsap.to(obj, {
          v: end, duration: 2.2, ease: 'power2.out',
          onUpdate: function () { el.textContent = fmt(obj.v); }
        });
      }
    });
  });

  /* 8. Videos: pause when off-screen to save battery and bandwidth */
  var videos = $('video');
  if (reduce) {
    videos.forEach(function (v) { v.pause(); });
  } else if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var v = en.target;
        if (en.isIntersecting) {
          var p = v.play();
          if (p && p.catch) p.catch(function () {});
        } else {
          v.pause();
        }
      });
    }, { threshold: 0.1 });
    videos.forEach(function (v) { io.observe(v); });
  }

  /* 9. Work filter */
  var chips = $('.filters button');
  var tiles = $('.tile');
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
      var f = chip.getAttribute('data-filter');
      tiles.forEach(function (t) {
        t.hidden = !(f === 'all' || t.getAttribute('data-cat') === f);
      });
    });
  });

  /* 10. Lightbox */
  var lb = document.querySelector('.lb');
  var lbImg = lb.querySelector('img');
  var lbCap = lb.querySelector('.lb-cap');
  var current = null, opener = null, touchX = null;

  function show(tile) {
    var img = tile.querySelector('img');
    lbImg.src = img.getAttribute('src');
    lbImg.alt = img.getAttribute('alt') || '';
    lbCap.textContent = tile.getAttribute('data-title') || '';
    current = tile;
  }
  function openLb(tile) {
    show(tile);
    opener = tile;
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    lb.querySelector('.lb-x').focus();
  }
  function closeLb() {
    lb.hidden = true;
    document.body.style.overflow = '';
    if (opener) opener.focus();
  }
  function step(d) {
    var visible = tiles.filter(function (t) { return !t.hidden; });
    if (!visible.length) return;
    var i = visible.indexOf(current);
    show(visible[(i + d + visible.length) % visible.length]);
  }

  tiles.forEach(function (tile) {
    tile.tabIndex = 0;
    tile.setAttribute('role', 'button');
    tile.addEventListener('click', function () { openLb(tile); });
    tile.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLb(tile); }
    });
  });
  lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });
  lb.querySelector('.lb-x').addEventListener('click', closeLb);
  lb.querySelector('.lb-prev').addEventListener('click', function () { step(-1); });
  lb.querySelector('.lb-next').addEventListener('click', function () { step(1); });
  document.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });
  lb.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    touchX = null;
  }, { passive: true });

  /* 11. Custom cursor (desktop with a fine pointer only) */
  var cur = document.querySelector('.cur');
  if (cur && fine && !reduce) {
    document.documentElement.classList.add('has-cursor');
    var dot = cur.querySelector('i');
    var ring = cur.querySelector('b');
    var mx = -100, my = -100, rx = -100, ry = -100;
    document.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = 'translate(' + mx + 'px,' + my + 'px) translate(-3px,-3px)';
    });
    (function loop() {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px) translate(-50%,-50%)';
      requestAnimationFrame(loop);
    })();
    $('a, button, .tile').forEach(function (el) {
      el.addEventListener('mouseenter', function () {
        cur.classList.add('hover');
        ring.textContent = el.classList.contains('tile') ? 'VIEW' : (el.classList.contains('btn') ? 'GO' : '');
      });
      el.addEventListener('mouseleave', function () {
        cur.classList.remove('hover');
        ring.textContent = '';
      });
    });
  }

  /* 12. Magnetic primary buttons (max 10px pull) */
  if (fine && !reduce) {
    $('.btn-solid').forEach(function (b) {
      b.addEventListener('mousemove', function (e) {
        var r = b.getBoundingClientRect();
        var x = Math.max(-10, Math.min(10, (e.clientX - r.left - r.width / 2) * 0.25));
        var y = Math.max(-10, Math.min(10, (e.clientY - r.top - r.height / 2) * 0.25));
        b.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      });
      b.addEventListener('mouseleave', function () { b.style.transform = ''; });
    });
  }
})();
