'use strict';
// Sága Art: navigace. Klouzavé podtržení, panely Kolekce/Šperky, schovávání při scrollu
// a celoobrazovkové mobilní menu. Bez knihoven (kvůli CSP).

(() => {
  const header = document.getElementById('siteHeader');
  const links = document.getElementById('navLinks');
  const indicator = links.querySelector('.nav-indicator');
  const burger = document.getElementById('navBurger');
  const mobile = document.getElementById('mobileMenu');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hoverable = matchMedia('(hover: hover) and (pointer: fine)').matches;

  // ── Klouzavé podtržení ──
  let activeLink = null;
  function moveIndicator(el) {
    if (!el) { indicator.style.opacity = '0'; return; }
    const lr = links.getBoundingClientRect(), r = el.getBoundingClientRect();
    indicator.style.opacity = '1';
    indicator.style.width = r.width + 'px';
    indicator.style.transform = `translateX(${r.left - lr.left}px)`;
  }
  links.addEventListener('pointerover', e => {
    const l = e.target.closest('.nav-link');
    if (l) moveIndicator(l);
  });
  links.addEventListener('pointerleave', () => moveIndicator(openBtn || activeLink));
  addEventListener('resize', () => moveIndicator(openBtn || activeLink));

  // ── Scrollspy: podtržení ukazuje sekci, ve které právě jste ──
  const spyMap = new Map([...links.querySelectorAll('[data-spy]')].map(l => [l.dataset.spy, l]));
  const visible = new Map();
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => visible.set(en.target.id, en.isIntersecting ? en.intersectionRatio : 0));
    let best = null, ratio = 0;
    visible.forEach((r, id) => { if (r > ratio) { ratio = r; best = id; } });
    const l = best ? spyMap.get(best) : null;
    if (l === activeLink) return;
    links.querySelectorAll('.nav-link').forEach(x => x.classList.toggle('is-active', x === l));
    activeLink = l;
    if (!links.matches(':hover') && !openBtn) moveIndicator(l);
  }, { rootMargin: '-35% 0px -55% 0px', threshold: [0, .25, .5, 1] });
  spyMap.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });

  // ── Panely Kolekce / Šperky ──
  let openBtn = null, closeTimer = 0;
  function openPanel(btn) {
    clearTimeout(closeTimer);
    if (openBtn === btn) return;
    closePanel(true);
    const panel = document.getElementById(btn.dataset.panel);
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add('open'));
    btn.setAttribute('aria-expanded', 'true');
    header.classList.add('panel-open');
    openBtn = btn;
    moveIndicator(btn);
  }
  function closePanel(now) {
    if (!openBtn) return;
    const btn = openBtn, panel = document.getElementById(btn.dataset.panel);
    openBtn = null;
    btn.setAttribute('aria-expanded', 'false');
    panel.classList.remove('open');
    header.classList.remove('panel-open');
    const hide = () => { if (!panel.classList.contains('open')) panel.hidden = true; };
    now || reduced ? hide() : setTimeout(hide, 250);
    moveIndicator(activeLink);
  }
  links.querySelectorAll('[data-panel]').forEach(btn => {
    btn.addEventListener('click', () => openBtn === btn ? closePanel() : openPanel(btn));
    if (hoverable) btn.addEventListener('pointerenter', () => openPanel(btn));
  });
  if (hoverable) {
    header.addEventListener('pointerleave', () => { closeTimer = setTimeout(() => closePanel(), 180); });
    header.addEventListener('pointerenter', () => clearTimeout(closeTimer));
    links.querySelectorAll('a.nav-link').forEach(a => a.addEventListener('pointerenter', () => closePanel()));
  }
  // klik na položku v panelu panel zavře (filtr řeší shop.js)
  header.addEventListener('click', e => {
    if (e.target.closest('.nav-panel a, .nav-panel [data-action]')) closePanel(true);
  });
  document.addEventListener('click', e => { if (openBtn && !header.contains(e.target)) closePanel(); });

  // ── Lišta se při scrollu dolů schová, nahoru se vrátí ──
  let lastY = scrollY, ticking = false;
  function onScroll() {
    ticking = false;
    const y = scrollY;
    header.classList.toggle('scrolled', y > 12);
    const menuOpen = !mobile.hidden;
    if (!openBtn && !menuOpen && y > 240 && y > lastY + 4) header.classList.add('hidden');
    else if (y < lastY - 4 || y <= 240) header.classList.remove('hidden');
    lastY = y;
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  header.addEventListener('focusin', () => header.classList.remove('hidden'));

  // ── Mobilní menu přes celou obrazovku ──
  function focusables() { return [...mobile.querySelectorAll('a, button')].filter(el => el.offsetParent !== null); }
  function openMenu() {
    const r = burger.getBoundingClientRect();
    mobile.style.setProperty('--ox', (r.left + r.width / 2) + 'px');
    mobile.style.setProperty('--oy', (r.top + r.height / 2) + 'px');
    mobile.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => mobile.classList.add('open')));
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Zavřít menu');
    header.classList.add('menu-open');
    header.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(() => focusables()[0]?.focus({ preventScroll: true }), reduced ? 0 : 350);
  }
  function closeMenu(restoreFocus = true) {
    if (mobile.hidden) return;
    mobile.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Otevřít menu');
    header.classList.remove('menu-open');
    document.body.style.overflow = '';
    setTimeout(() => { if (!mobile.classList.contains('open')) mobile.hidden = true; }, reduced ? 0 : 600);
    if (restoreFocus) burger.focus({ preventScroll: true });
  }
  burger.addEventListener('click', () => mobile.hidden || !mobile.classList.contains('open') ? openMenu() : closeMenu());
  mobile.addEventListener('click', e => { if (e.target.closest('a, [data-action]')) closeMenu(false); });
  addEventListener('resize', () => { if (innerWidth > 860) closeMenu(false); });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closePanel(); closeMenu(); }
    if (e.key === 'Tab' && !mobile.hidden) {
      const f = [burger, ...focusables()];
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });

  onScroll();
})();
