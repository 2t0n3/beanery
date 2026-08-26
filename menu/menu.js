/* ==========================================================================
   BEANERY — QR menu interactivity
   Three independent behaviours: live search, sticky category nav that
   tracks scroll position, and a back-to-top button.
   ========================================================================== */

(() => {
  'use strict';

  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const searchInput = $('#q');
  const clearBtn    = $('#clear');
  const noResults   = $('#noresults');
  const resetBtn    = $('#resetSearch');
  const sections    = $$('.sec');
  const catLinks    = $$('.cat');
  const catsTrack   = $('.cats__track');
  const totop       = $('#totop');

  /* ---------- search ---------- */

  const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

  function runSearch() {
    const term = norm(searchInput.value.trim());
    clearBtn.hidden = term.length === 0;
    document.body.classList.toggle('is-searching', term.length > 0);

    let anyVisible = false;

    sections.forEach((sec) => {
      const items = $$('.item, .pcard', sec);
      let matches = 0;

      items.forEach((item) => {
        const name = item.querySelector('.item__name, .pcard__name');
        const text = norm(name ? name.textContent : item.textContent);
        const hit = term === '' || text.includes(term);
        item.classList.toggle('is-hidden', !hit);
        if (hit) matches++;
      });

      const sectionMatches = term === '' || matches > 0;
      sec.classList.toggle('is-hidden', !sectionMatches);
      if (sectionMatches) anyVisible = true;
    });

    noResults.hidden = anyVisible;
  }

  searchInput.addEventListener('input', runSearch);

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    runSearch();
    searchInput.focus();
  });

  resetBtn.addEventListener('click', () => {
    searchInput.value = '';
    runSearch();
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && searchInput.value) {
      searchInput.value = '';
      runSearch();
    }
  });

  /* ---------- sticky category nav: active state on scroll ---------- */

  const catByHref = new Map(catLinks.map((a) => [a.getAttribute('href').slice(1), a]));

  function setActiveCat(id) {
    const target = catByHref.get(id);
    if (!target) return;
    catLinks.forEach((a) => a.classList.toggle('is-on', a === target));
    // keep the active pill in view within the horizontally scrolling track —
    // scroll catsTrack directly (never scrollIntoView) so this can't ever
    // touch the page's own vertical scroll position while the user scrolls
    const trackRect = catsTrack.getBoundingClientRect();
    const linkRect = target.getBoundingClientRect();
    if (linkRect.left < trackRect.left || linkRect.right > trackRect.right) {
      const targetCenter = target.offsetLeft + target.offsetWidth / 2;
      catsTrack.scrollTo({ left: targetCenter - catsTrack.clientWidth / 2, behavior: 'smooth' });
    }
  }

  const headEl = $('#cats');
  const headH = () => (headEl ? headEl.offsetHeight : 58);

  let observerLock = false;
  const io = new IntersectionObserver(
    (entries) => {
      if (observerLock) return;
      entries.forEach((entry) => {
        if (entry.isIntersecting) setActiveCat(entry.target.id);
      });
    },
    { rootMargin: `-${headH() + 8}px 0px -70% 0px`, threshold: 0 }
  );
  sections.forEach((sec) => io.observe(sec));

  // instant feedback on click, without waiting for the observer to catch up
  function onCatJump(a) {
    observerLock = true;
    setActiveCat(a.getAttribute('href').slice(1));
    window.setTimeout(() => { observerLock = false; }, 700);
  }
  catLinks.forEach((a) => a.addEventListener('click', () => onCatJump(a)));

  /* scroll reveal removed — sections render in their final state right away */

  /* ---------- card-row carousels: arrow scroll + edge-aware disable ---------- */

  $$('.cardrow').forEach((row) => {
    const track = $('.cardrow__track', row);
    const prev = $('.cardrow__arrow--prev', row);
    const next = $('.cardrow__arrow--next', row);
    if (!track || !prev || !next) return;

    const step = () => Math.min(track.clientWidth * 0.8, 340);

    function updateArrows() {
      const max = track.scrollWidth - track.clientWidth;
      prev.disabled = track.scrollLeft <= 4;
      next.disabled = track.scrollLeft >= max - 4;
    }

    prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
    track.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    updateArrows();
  });

  /* ---------- back to top ---------- */

  function toggleTotop() {
    totop.hidden = window.scrollY < window.innerHeight * 0.6;
  }
  window.addEventListener('scroll', toggleTotop, { passive: true });
  toggleTotop();

  totop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ---------- header photo: double-tap to swap the shot ----------
     Not persisted on purpose: header-cup.jpg is the default, so every
     fresh load starts there. dblclick alone is unreliable on touch, so
     the two taps are timed off pointerup and dblclick is only used to
     stop the browser selecting text on the second click. */

  const photo = $('.mhead__photo');
  const deco = $('.mhead__deco');

  if (photo && deco && photo.dataset.altSrc) {
    const SHOTS = [photo.getAttribute('src'), photo.dataset.altSrc];
    const GAP = 400;   // ms between taps
    const SLOP = 40;   // px the finger may drift

    // warm the cache so the first swap doesn't flash an empty frame
    const preload = new Image();
    preload.src = SHOTS[1];

    let shown = 0;
    let lastAt = 0, lastX = 0, lastY = 0, busy = false;

    function swap() {
      if (busy) return;
      busy = true;
      shown = shown ? 0 : 1;
      photo.style.opacity = '0';
      window.setTimeout(() => {
        photo.src = SHOTS[shown];
        photo.classList.toggle('mhead__photo--alt', shown === 1);
        photo.style.opacity = '';
        busy = false;
      }, 170);
    }

    deco.addEventListener('pointerup', (e) => {
      const near = Math.abs(e.clientX - lastX) < SLOP && Math.abs(e.clientY - lastY) < SLOP;
      if (e.timeStamp - lastAt < GAP && near) {
        lastAt = 0;
        swap();
      } else {
        lastAt = e.timeStamp;
        lastX = e.clientX;
        lastY = e.clientY;
      }
    });

    deco.addEventListener('dblclick', (e) => e.preventDefault());
  }
})();
