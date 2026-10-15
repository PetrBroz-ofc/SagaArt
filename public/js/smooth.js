'use strict';
// Sága Art: plynulý scroll (ve stylu Lenis). Kolečko myši dostane setrvačnost a dojezd,
// odkazy na sekce plynule dojedou. Dotyk, klávesnice a posuvník zůstávají nativní.
// Vypnuto pro dotyková zařízení a pro ty, kdo mají v systému omezené animace.

(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const root = document.documentElement;
  const LERP = 0.1;            // kolik zbývající vzdálenosti se ujede za snímek
  const STEP_LINE = 40;        // px na „řádek“ u myší, které hlásí řádky
  let target = scrollY, current = scrollY, running = false;

  root.classList.add('smooth-scroll');   // vypne CSS scroll-behavior, aby se nepraly

  const maxScroll = () => root.scrollHeight - innerHeight;
  const clamp = v => Math.max(0, Math.min(maxScroll(), v));

  function loop() {
    if (!running) return;
    // scroll mezitím pohnulo něco jiného (posuvník, tlačítko Nahoru) -> předat vedení;
    // drobné posuny o pár px (změna výšky lišty) jen dorovnat
    const drift = scrollY - current;
    if (Math.abs(drift) > 60) { running = false; target = current = scrollY; return; }
    if (Math.abs(drift) > 1) { current = scrollY; target = clamp(target + drift); }
    current += (target - current) * LERP;
    if (Math.abs(target - current) < 0.5) current = target;
    scrollTo({ top: current, behavior: 'instant' });
    if (current !== target) requestAnimationFrame(loop);
    else running = false;
  }
  function start() {
    if (!running) { running = true; current = scrollY; requestAnimationFrame(loop); }
  }

  // Může prvek pod kurzorem sám scrollovat tímto směrem? (košík, detail, vodorovné pásy…)
  function innerScrollable(el, dy, dx) {
    for (el = el instanceof Element ? el : null; el && el !== document.body && el !== root; el = el.parentElement) {
      const s = getComputedStyle(el);
      if (Math.abs(dx) > Math.abs(dy)) {
        if (/(auto|scroll)/.test(s.overflowX) && el.scrollWidth > el.clientWidth) return true;
        continue;
      }
      if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight) {
        if (dy < 0 && el.scrollTop > 0) return true;
        if (dy > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
      }
    }
    return false;
  }

  addEventListener('wheel', e => {
    if (e.ctrlKey || e.defaultPrevented) return;                   // zoom, gesta
    if (document.body.style.overflow === 'hidden') return;          // otevřený detail / menu / úvod
    let dy = e.deltaY, dx = e.deltaX;
    if (e.deltaMode === 1) { dy *= STEP_LINE; dx *= STEP_LINE; }
    else if (e.deltaMode === 2) { dy *= innerHeight; dx *= innerWidth; }
    if (e.shiftKey && !dx) { dx = dy; dy = 0; }
    if (innerScrollable(e.target, dy, dx)) return;
    if (Math.abs(dx) > Math.abs(dy)) return;
    e.preventDefault();
    if (!running) target = scrollY;
    target = clamp(target + dy);
    start();
  }, { passive: false });

  // Odkazy na sekce (#kolekce…) plynule dojedou, s rezervou pro lištu nahoře
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const id = a.getAttribute('href').slice(1);
    const el = id ? document.getElementById(id) : null;
    if (!id) { e.preventDefault(); target = 0; start(); return; }
    if (!el) return;
    e.preventDefault();
    history.pushState(null, '', '#' + id);
    // počkat, až ostatní posluchače (filtry, zavření menu) dodělají změny rozložení
    requestAnimationFrame(() => {
      const offset = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
      target = clamp(el.getBoundingClientRect().top + scrollY - offset);
      start();
    });
  });

  // Jiný způsob scrollu (klávesnice, posuvník, scrollTo z kódu) převezme vedení
  addEventListener('scroll', () => { if (!running) target = current = scrollY; }, { passive: true });
  addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) running = false;
  });
  addEventListener('resize', () => { target = clamp(target); });
})();
