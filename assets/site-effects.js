// Site-wide hover & scroll animations. Pages are rendered at runtime, so this tags
// elements with data-fx attributes as they appear; the styling lives in site-effects.css.
(function () {
  'use strict';
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var revealOpen = true; // only animate elements that exist during the first render
  var io = null;

  function isTransparent(c) { return !c || c === 'transparent' || /rgba\(.*,\s*0\)$/.test(c); }
  function hasBorder(cs) { return parseFloat(cs.borderTopWidth) > 0 && !isTransparent(cs.borderTopColor); }
  function inChrome(el) { return !!el.closest('header, [role="dialog"]'); }

  function reveal(el, delay) {
    if (!revealOpen || reduced || !io || el.hasAttribute('data-fx-reveal')) return;
    if (delay) el.style.setProperty('--fx-delay', delay + 'ms');
    el.setAttribute('data-fx-reveal', '');
    io.observe(el);
  }

  function tagButtons(root) {
    root.querySelectorAll('a[href], button').forEach(function (el) {
      if (el.hasAttribute('data-fx') || inChrome(el) || el.closest('footer')) return;
      var cs = getComputedStyle(el);
      var padded = parseFloat(cs.paddingTop) >= 10 && parseFloat(cs.paddingLeft) >= 16;
      if (padded && (!isTransparent(cs.backgroundColor) || hasBorder(cs)) && el.offsetWidth < 420 && !el.querySelector('img, h2, h3, h4')) {
        el.setAttribute('data-fx', 'btn');
      }
    });
  }

  function tagGrids(root) {
    root.querySelectorAll('div').forEach(function (grid) {
      if (grid.hasAttribute('data-fx-grid') || inChrome(grid)) return;
      var cs = getComputedStyle(grid);
      if (cs.display !== 'grid' || grid.children.length < 2) return;
      var gap = parseFloat(cs.columnGap) || parseFloat(cs.rowGap) || 0;
      var kids = Array.prototype.filter.call(grid.children, function (k) { return k.offsetWidth > 0; });
      if (kids.length < 2) return;
      grid.setAttribute('data-fx-grid', '');
      var inFooter = !!grid.closest('footer');
      kids.forEach(function (k, i) {
        if (k.hasAttribute('data-fx')) return;
        var ks = getComputedStyle(k);
        var filled = !isTransparent(ks.backgroundColor);
        var looksCard = gap <= 1 ? filled : (hasBorder(ks) || parseFloat(ks.borderTopLeftRadius) > 0 || filled);
        if (!looksCard || inFooter) return;
        k.setAttribute('data-fx', gap <= 1 ? 'cell' : 'card');
        reveal(k, Math.min(i, 8) * 70);
      });
    });
  }

  function tagImages(root) {
    root.querySelectorAll('img').forEach(function (img) {
      if (img.hasAttribute('data-fx-img') || inChrome(img) || img.closest('footer')) return;
      var p = img.parentElement;
      if (!p || getComputedStyle(p).overflow !== 'hidden') {
        // the frame may be the grandparent (cards with an inner image box)
        p = p && p.parentElement;
        if (!p || getComputedStyle(p).overflow !== 'hidden') return;
      }
      img.setAttribute('data-fx-img', '');
      if (!p.closest('[data-fx="card"]')) p.setAttribute('data-fx-zoomwrap', '');
    });
  }

  function tagText(root) {
    var first = document.querySelector('main section, body section');
    root.querySelectorAll('section h1, section h2').forEach(function (h) {
      if (h.hasAttribute('data-fx-hero') || h.hasAttribute('data-fx-reveal') || inChrome(h) || h.closest('[data-fx]')) return;
      if (first && first.contains(h) && revealOpen) {
        // hero: animate heading, intro text and buttons on load
        var box = h.parentElement;
        [h].concat(Array.prototype.slice.call(box.children).filter(function (c) { return c !== h && c.tagName !== 'NAV'; }))
          .forEach(function (el, i) { el.setAttribute('data-fx-hero', ''); el.style.setProperty('--fx-delay', (i * 110) + 'ms'); });
      } else {
        reveal(h, 0);
      }
    });
  }

  // 1px-gap grids draw their dividers with the grid background, which shows as a grey
  // block when the last row is incomplete. Keep every cell the same size and switch
  // those grids to per-cell outlines instead.
  function fillGrids() {
    document.querySelectorAll('[data-fx-grid]').forEach(function (grid) {
      var kids = Array.prototype.filter.call(grid.children, function (k) { return k.getAttribute('data-fx') === 'cell'; });
      if (kids.length < 2 || kids.length !== grid.children.length) return;
      // open = the last row ends short of the grid's right edge (empty slots showing)
      var g = grid.getBoundingClientRect(), l = kids[kids.length - 1].getBoundingClientRect();
      var inner = g.right - (parseFloat(getComputedStyle(grid).borderRightWidth) || 0);
      if (l.top > kids[0].getBoundingClientRect().top + 1 && l.right < inner - 2) grid.setAttribute('data-fx-open', '');
      else grid.removeAttribute('data-fx-open');
    });
  }

  function scan() {
    var root = document.body;
    if (!root) return;
    tagButtons(root);
    tagGrids(root);
    tagImages(root);
    tagText(root);
    fillGrids();
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; scan(); });
  }

  function start() {
    if ('IntersectionObserver' in window && !reduced) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.setAttribute('data-fx-in', ''); io.unobserve(e.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    }
    document.documentElement.classList.add('fx-ready');
    scan();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    var rt;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(fillGrids, 150); });
    // later re-renders (FAQ toggles, dialogs) get hover effects but no entrance animation
    setTimeout(function () { revealOpen = false; }, 2500);
    // safety net: never leave content hidden
    setTimeout(function () {
      document.querySelectorAll('[data-fx-reveal]:not([data-fx-in])').forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight) el.setAttribute('data-fx-in', '');
      });
    }, 3000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
