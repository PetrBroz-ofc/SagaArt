'use strict';
// Sága Art: ovládání vodorovného pásu (kolekce). Šipky, počítadlo, lišta průběhu
// s táhlem, tažení myší se setrvačností a kurzor „Táhněte“. Bez knihoven (kvůli CSP).

(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  document.querySelectorAll('[data-carousel]').forEach(setup);

  function setup(wrap) {
    const track = wrap.querySelector('[data-carousel-track]');
    const prev = wrap.querySelector('[data-carousel-prev]');
    const next = wrap.querySelector('[data-carousel-next]');
    const countNow = wrap.querySelector('[data-carousel-now]');
    const countAll = wrap.querySelector('[data-carousel-all]');
    const bar = wrap.querySelector('[data-carousel-bar]');
    const thumb = wrap.querySelector('[data-carousel-thumb]');
    const cursor = wrap.querySelector('[data-carousel-cursor]');
    if (!track) return;

    const items = () => [...track.children].filter(el => el.offsetParent !== null);
    const step = () => {
      const [a, b] = items();
      return a && b ? b.offsetLeft - a.offsetLeft : track.clientWidth * .8;
    };
    const maxLeft = () => track.scrollWidth - track.clientWidth;
    const pad = n => String(n).padStart(2, '0');

    // ── stav: šipky, počítadlo, lišta ──
    let raf = 0;
    function update() {
      raf = 0;
      const n = items().length, max = maxLeft(), left = track.scrollLeft;
      const scrollable = max > 2;
      wrap.classList.toggle('is-static', !scrollable);
      if (prev) prev.disabled = left <= 2;
      if (next) next.disabled = left >= max - 2;
      const idx = left >= max - 2 && scrollable ? n : Math.min(n, Math.round(left / (step() || 1)) + 1);
      if (countNow) countNow.textContent = pad(n ? idx : 0);
      if (countAll) countAll.textContent = pad(n);
      if (thumb && bar) {
        const ratio = track.clientWidth / track.scrollWidth;
        const w = Math.max(.08, Math.min(1, ratio));
        thumb.style.width = (w * 100) + '%';
        thumb.style.transform = `translateX(${(max ? left / max : 0) * (1 - w) / w * 100}%)`;
      }
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
    track.addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule);
    new MutationObserver(schedule).observe(track, { childList: true });
    update();

    // ── šipky ──
    const go = dir => track.scrollBy({ left: dir * step(), behavior: reduced ? 'auto' : 'smooth' });
    prev?.addEventListener('click', () => go(-1));
    next?.addEventListener('click', () => go(1));
    track.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    });

    // ── tažení lišty průběhu ──
    if (bar && thumb) {
      let scrubbing = false;
      const scrubTo = x => {
        const r = bar.getBoundingClientRect();
        const w = thumb.getBoundingClientRect().width;
        const p = Math.max(0, Math.min(1, (x - r.left - w / 2) / (r.width - w || 1)));
        track.scrollLeft = p * maxLeft();
      };
      bar.addEventListener('pointerdown', e => {
        scrubbing = true;
        bar.setPointerCapture(e.pointerId);
        wrap.classList.add('is-dragging');
        scrubTo(e.clientX);
      });
      bar.addEventListener('pointermove', e => { if (scrubbing) scrubTo(e.clientX); });
      const stop = () => { scrubbing = false; wrap.classList.remove('is-dragging'); };
      bar.addEventListener('pointerup', stop);
      bar.addEventListener('pointercancel', stop);
    }

    // ── tažení pásu myší se setrvačností (dotyk má nativní posun) ──
    if (finePointer) {
      let down = false, moved = 0, startX = 0, startLeft = 0, lastX = 0, lastT = 0, vel = 0, glide = 0;
      track.addEventListener('pointerdown', e => {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        cancelAnimationFrame(glide);
        down = true; moved = 0;
        startX = lastX = e.clientX; startLeft = track.scrollLeft; lastT = performance.now(); vel = 0;
      });
      addEventListener('pointermove', e => {
        if (!down) return;
        const dx = e.clientX - startX;
        if (!moved && Math.abs(dx) < 6) return;
        if (!moved) wrap.classList.add('is-dragging');
        moved = Math.abs(dx);
        track.scrollLeft = startLeft - dx;
        const now = performance.now();
        vel = (e.clientX - lastX) / Math.max(1, now - lastT);
        lastX = e.clientX; lastT = now;
      });
      addEventListener('pointerup', () => {
        if (!down) return;
        down = false;
        if (!moved) return;
        // dojezd: rychlost se postupně tlumí, pak se pás „zacvakne“ na nejbližší kartu
        let v = -vel * 16;
        const tick = () => {
          v *= .92;
          track.scrollLeft += v;
          if (Math.abs(v) > .5 && !reduced) glide = requestAnimationFrame(tick);
          else {
            wrap.classList.remove('is-dragging');
            const s = step();
            track.scrollTo({ left: Math.round(track.scrollLeft / s) * s, behavior: reduced ? 'auto' : 'smooth' });
          }
        };
        glide = requestAnimationFrame(tick);
      });
      // po tažení nesmí klik otevřít kolekci
      track.addEventListener('click', e => {
        if (moved > 6) { e.preventDefault(); e.stopPropagation(); moved = 0; }
      }, true);
      track.addEventListener('dragstart', e => e.preventDefault());

      // ── kulatý kurzor „Táhněte“ ──
      if (cursor) {
        let cx = 0, cy = 0, tx = 0, ty = 0, cr = 0;
        const follow = () => {
          cx += (tx - cx) * .22; cy += (ty - cy) * .22;
          cursor.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
          cr = Math.abs(tx - cx) + Math.abs(ty - cy) > .3 ? requestAnimationFrame(follow) : 0;
        };
        track.addEventListener('pointerenter', e => {
          const r = wrap.getBoundingClientRect();
          cx = tx = e.clientX - r.left; cy = ty = e.clientY - r.top;
          wrap.classList.add('show-cursor');
          follow();
        });
        track.addEventListener('pointermove', e => {
          const r = wrap.getBoundingClientRect();
          tx = e.clientX - r.left; ty = e.clientY - r.top;
          if (!cr) cr = requestAnimationFrame(follow);
        });
        track.addEventListener('pointerleave', () => wrap.classList.remove('show-cursor'));
      }
    }
  }
})();
