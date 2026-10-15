'use strict';
// Sága Art: po přidání do košíku přeletí perla k ikoně košíku.
// Kdo má zapnuté omezení animací, nic neletí.

(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

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
