'use strict';
// Sága Art: drobné efekty. Let perly do košíku a patička (nápis, tlačítko Nahoru).
// Kdo má zapnuté omezení animací, nic se nehýbe.

(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Patička: tlačítko Nahoru ──
  document.getElementById('toTop')?.addEventListener('click', () => {
    scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    document.querySelector('.nav-logo')?.focus({ preventScroll: true });
  });

  if (reduced) return;

  // ── Patička: písmena velkého nápisu vyjedou zespodu, když se k němu doscrolluje ──
  const mark = document.querySelector('.footer-wordmark');
  if (mark && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('reveal-ready');
    new IntersectionObserver((entries, obs) => {
      if (entries[0].isIntersecting) { mark.classList.add('in-view'); obs.disconnect(); }
    }, { threshold: .35 }).observe(mark);
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="addToCart"]');
    const cart = document.querySelector('.nav-cart .cart-badge');
    if (!btn || !cart) return;
    const a = btn.getBoundingClientRect(), b = cart.getBoundingClientRect();
    const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
    const x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
    const el = document.createElement('div');
    el.className = 'fly-pearl';
    document.body.appendChild(el);
    const mx = (x0 + x1) / 2, my = Math.min(y0, y1) - 160;
    const steps = 14, frames = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mx + t * t * x1;
      const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * my + t * t * y1;
      frames.push({ transform: `translate(${x - 8}px, ${y - 8}px) scale(${1.3 - t * .7})`, opacity: t > .9 ? 0 : 1 });
    }
    el.animate(frames, { duration: 700, easing: 'cubic-bezier(.45,.05,.55,.95)' }).onfinish = () => {
      el.remove();
      cart.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.4)' }, { transform: 'scale(1)' }],
        { duration: 380, easing: 'cubic-bezier(.3,1.6,.5,1)' });
    };
  }, true);
})();
