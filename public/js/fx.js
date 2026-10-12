'use strict';
// Sága Art — efekty: WebGL perlový náhrdelník v hero, perličky za kurzorem, náklon karet, let perly do košíku.
// Bez knihoven (kvůli CSP). Kdo má zapnuté omezení animací, dostane jen statický snímek.

(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;

  // ═══════════════════════════════════════
  // 1) HERO — perly s duhovým leskem nad hedvábím
  // ═══════════════════════════════════════
  const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;   // kurzor v uv (daleko = mimo hero)
uniform vec2 uLight;   // vyhlazený kurzor pro světlo
uniform vec2 uCenter;  // střed náhrdelníku v uv
uniform float uScale;
uniform float uKick;
out vec4 fragColor;

const int N = 19;

float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y);
}
float fbm(vec2 p){
  float v = 0., a = .5; mat2 m = mat2(1.6,1.2,-1.2,1.6);
  for (int i = 0; i < 4; i++) { v += a*noise(p); p = m*p; a *= .5; }
  return v;
}

vec3 silk(vec2 uv, float t){
  vec2 q = uv*1.3;
  vec2 w = vec2(fbm(q + vec2(0., t*.05)), fbm(q + vec2(5.2,1.3) - t*.04));
  float h = fbm(q + 2.2*w + t*.03);
  vec3 c = mix(vec3(.992,.953,.953), vec3(.957,.800,.820), smoothstep(.25,.85,h));
  c = mix(c, vec3(.86,.55,.62), smoothstep(.62,.95,h)*.35);
  float sheen = pow(.5+.5*sin(h*14. + w.x*6. - t*.4), 12.);
  c += sheen*vec3(1.,.97,.96)*.22;
  c += sheen*(.5+.5*cos(6.2831*(h + vec3(0.,.33,.67))))*.06;
  return c;
}

// pozice perly i (N = přívěsek), poloměr r a druh k (0 perla, 1 amazonit, 2 akvamarín, 3 přívěsek)
vec3 bead(int i, float t, out float r, out float k){
  vec3 p;
  if (i == N) {
    p = vec3(0., -.94, .05);
    r = .17; k = 3.;
  } else {
    float s = float(i)/float(N-1);
    float x = sin((s*2. - 1.)*1.5708);   // hustěji u konců, kde je oblouk strmý
    p = vec3(x, .85 - 1.47*(1. - x*x), .12*sin(t*1.1 + s*7.));
    bool gem = (i % 4) == 2;
    r = gem ? .1 : .132;
    k = gem ? (((i/4) % 2) == 0 ? 1. : 2.) : 0.;
  }
  float sway = .10*sin(t*.6) + uKick*.28*sin(t*9.);
  vec2 pv = vec2(0., .85), d = p.xy - pv;
  float ca = cos(sway), sa = sin(sway);
  p.xy = pv + vec2(ca*d.x - sa*d.y, sa*d.x + ca*d.y);

  vec3 w = vec3(uCenter + p.xy*uScale, p.z*uScale);
  vec2 dm = uMouse - w.xy;
  float pull = exp(-dot(dm,dm)/(.09*uScale*uScale + 1e-4));
  w.xy += dm*pull*.35;
  w.z += pull*.25*uScale;
  r *= uScale;
  return w;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - .5*uRes)/uRes.y;
  float t = uTime;
  vec3 ro = vec3(uv, 2.);
  const float PK = .12;   // síla perspektivy
  vec3 rd = normalize(vec3((uv - uCenter)*PK, -1.));
  vec3 L = normalize(vec3(-.35 + uLight.x*.5, .65 + uLight.y*.35, .75));

  float tHit = 1e9, hr = 0., hk = 0., md = 0.;
  vec3 hc = vec3(0.);
  float thread = 1e9, shadow = 0.;
  vec2 prev = vec2(0.), mid = vec2(0.);

  for (int i = 0; i <= N; i++) {
    float r, k;
    vec3 c = bead(i, t, r, k);
    vec3 oc = ro - c;
    float b = dot(oc, rd);
    float d2 = dot(oc,oc) - b*b;            // vzdálenost paprsku od středu (na druhou)
    float h = r*r - d2;
    if (h > 0.) {
      float th = -b - sqrt(h);
      if (th > 0. && th < tHit) { tHit = th; hc = c; hr = r; hk = k; md = sqrt(max(d2, 0.)); }
    }
    vec2 pc2 = uCenter + (c.xy - uCenter)/(1. + PK*(2. - c.z));   // střed perly promítnutý na obrazovku
    vec2 dd = uv - (pc2 - L.xy*.18*uScale);
    shadow += exp(-dot(dd,dd)/(r*r*1.7))*.16;
    if (i > 0 && i < N) {
      vec2 pa = uv - prev, ba = pc2 - prev;
      float hh = clamp(dot(pa,ba)/dot(ba,ba), 0., 1.);
      thread = min(thread, length(pa - ba*hh));
    }
    if (i == N/2) mid = pc2;
    if (i == N) {
      vec2 pa = uv - mid, ba = pc2 - mid;
      float hh = clamp(dot(pa,ba)/dot(ba,ba), 0., 1.);
      thread = min(thread, length(pa - ba*hh));
    }
    if (i < N) prev = pc2;
  }

  vec3 col = silk(uv, t);
  col *= mix(vec3(1.), vec3(.84,.66,.71), min(shadow, .55));
  float tw = .0022 + .004*uScale;
  col = mix(col, vec3(.72,.58,.40), smoothstep(tw, tw*.3, thread)*.9);

  if (tHit < 1e8) {
    vec3 p = ro + rd*tHit;
    vec3 n = normalize(p - hc);
    vec3 v = -rd;
    float dif = max(dot(n,L), 0.);
    float fre = pow(1. - max(dot(n,v), 0.), 2.5);
    vec3 R = reflect(rd, n);
    vec3 env = silk(uv + R.xy*.35, t*.5);
    float spec = pow(max(dot(reflect(-L,n), v), 0.), 60.);
    vec3 pc;
    if (hk < .5 || hk > 2.5) {
      vec3 irid = .5 + .5*cos(6.2831*(vec3(0.,.33,.67) + fre*1.1 + n.y*.25 + t*.03));
      pc = vec3(.985,.95,.94)*(.62 + .42*dif);
      pc = mix(pc, env, .18);
      pc += irid*fre*.38 + spec*.9;
      pc += vec3(1.,.85,.86)*pow(fre,3.)*.25;
    } else {
      vec3 g = hk < 1.5 ? vec3(.58,.80,.72) : vec3(.62,.80,.90);
      pc = g*(.45 + .55*dif) + g*pow(max(dot(n,-L),0.),2.)*.25;
      pc = mix(pc, env, .15) + spec*1.2 + fre*.2;
    }
    float px = 1.5/uRes.y;
    col = mix(col, pc, clamp((hr - md)/px, 0., 1.));
  }

  col += (hash(gl_FragCoord.xy + t) - .5)*(2./255.);
  fragColor = vec4(col, 1.);
}`;

  const VERT = `#version 300 es
in vec2 p;
void main(){ gl_Position = vec4(p, 0., 1.); }`;

  function initHero() {
    const hero = document.querySelector('.hero');
    const anchor = document.querySelector('.hero-right');
    if (!hero || !anchor) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'hero-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) return;

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    try {
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (e) {
      console.warn('Hero WebGL nedostupné:', e.message);
      return;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const U = {};
    ['uRes', 'uTime', 'uMouse', 'uLight', 'uCenter', 'uScale', 'uKick'].forEach(n => { U[n] = gl.getUniformLocation(prog, n); });

    hero.prepend(canvas);
    document.documentElement.classList.add('hero-gl');

    let W = 0, H = 0, center = [0, 0], scale = .3;
    const mouse = { x: 10, y: 10, tx: 10, ty: 10, lx: 0, ly: 0 };
    let kick = 0;

    function resize() {
      const rect = hero.getBoundingClientRect();
      const mobile = rect.width < 768;
      // strop na počet pixelů — plynulost i na slabších zařízeních
      let dpr = Math.min(devicePixelRatio || 1, mobile ? 1 : 1.25);
      const maxPx = mobile ? 5e5 : 1.1e6;
      if (rect.width * rect.height * dpr * dpr > maxPx) dpr = Math.sqrt(maxPx / (rect.width * rect.height));
      W = Math.max(1, Math.round(rect.width * dpr));
      H = Math.max(1, Math.round(rect.height * dpr));
      canvas.width = W; canvas.height = H;
      gl.viewport(0, 0, W, H);

      // náhrdelník se vejde do pravé části hero (na mobilu do spodní)
      const a = anchor.getBoundingClientRect();
      const cx = a.left - rect.left + a.width / 2, cy = a.top - rect.top + a.height / 2;
      center = [(cx - rect.width / 2) / rect.height, (rect.height / 2 - cy) / rect.height];
      const sh = .78 * (a.height / rect.height) / 1.9;
      const sw = .86 * (a.width / rect.height) / 2.3;
      scale = Math.min(sh, sw);
      center[1] += .02 * scale;
    }

    function toUv(e) {
      const r = canvas.getBoundingClientRect();
      return [(e.clientX - r.left - r.width / 2) / r.height, (r.height / 2 - (e.clientY - r.top)) / r.height];
    }
    hero.addEventListener('pointermove', e => { [mouse.tx, mouse.ty] = toUv(e); });
    hero.addEventListener('pointerleave', () => { mouse.tx = 10; mouse.ty = 10; });
    hero.addEventListener('pointerdown', e => {
      if (e.target.closest('a,button')) return;
      kick = 1;
    });

    let visible = true, running = false, last = performance.now(), time = 0;
    function frame(now) {
      running = false;
      if (!visible || document.hidden) return;
      const dt = Math.min(.05, (now - last) / 1000);
      last = now;
      time += dt;
      const far = mouse.tx > 5;
      if (far) { mouse.x += (10 - mouse.x) * .02; mouse.y += (10 - mouse.y) * .02; }
      else {
        if (mouse.x > 5) { mouse.x = mouse.tx; mouse.y = mouse.ty; }
        mouse.x += (mouse.tx - mouse.x) * .12; mouse.y += (mouse.ty - mouse.y) * .12;
      }
      const lt = far ? [0, 0] : [mouse.tx - center[0], mouse.ty - center[1]];
      mouse.lx += (lt[0] - mouse.lx) * .06; mouse.ly += (lt[1] - mouse.ly) * .06;
      kick *= Math.pow(.25, dt);
      draw();
      loop();
    }
    function draw() {
      gl.uniform2f(U.uRes, W, H);
      gl.uniform1f(U.uTime, time);
      gl.uniform2f(U.uMouse, mouse.x, mouse.y);
      gl.uniform2f(U.uLight, mouse.lx, mouse.ly);
      gl.uniform2f(U.uCenter, center[0], center[1]);
      gl.uniform1f(U.uScale, scale);
      gl.uniform1f(U.uKick, kick);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function loop() {
      if (reduced || running) return;
      running = true;
      requestAnimationFrame(frame);
    }

    new ResizeObserver(() => { resize(); if (reduced) draw(); }).observe(hero);
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; last = performance.now(); loop(); }).observe(hero);
    document.addEventListener('visibilitychange', () => { last = performance.now(); loop(); });
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); visible = false; });

    resize();
    time = 3.2;
    draw();
    loop();
  }

  // ═══════════════════════════════════════
  // 2) PERLIČKY ZA KURZOREM
  // ═══════════════════════════════════════
  function initTrail() {
    if (reduced || !finePointer) return;
    const c = document.createElement('canvas');
    c.className = 'pearl-trail';
    c.setAttribute('aria-hidden', 'true');
    document.body.appendChild(c);
    const ctx = c.getContext('2d');
    let dpr = 1, W = 0, H = 0;
    const resize = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = innerWidth; H = innerHeight;
      c.width = W * dpr; c.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    addEventListener('resize', resize);
    resize();

    const parts = [];
    let lx = null, ly = null, raf = 0;
    const TINTS = ['#fffafa', '#fffafa', '#fffafa', '#cfe8df', '#d4e6ef', '#f6d3d8'];

    const spawn = (x, y, vx, vy) => {
      if (parts.length > 90) parts.shift();
      parts.push({ x, y, vx, vy, r: 2.5 + Math.random() * 3.5, life: 1, tint: TINTS[(Math.random() * TINTS.length) | 0] });
    };

    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      if (lx === null) { lx = e.clientX; ly = e.clientY; return; }
      const dx = e.clientX - lx, dy = e.clientY - ly;
      if (dx * dx + dy * dy < 22 * 22) return;
      spawn(e.clientX, e.clientY, dx * .03 + (Math.random() - .5) * .6, dy * .03 - .4);
      lx = e.clientX; ly = e.clientY;
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });

    // výbuch perliček po kliknutí v hero
    addEventListener('pointerdown', e => {
      if (!e.target.closest('.hero') || e.target.closest('a,button')) return;
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 4;
        spawn(e.clientX, e.clientY, Math.cos(a) * s, Math.sin(a) * s - 2);
      }
      if (!raf) raf = requestAnimationFrame(tick);
    });

    function pearl(p) {
      const g = ctx.createRadialGradient(p.x - p.r * .35, p.y - p.r * .4, p.r * .1, p.x, p.y, p.r);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(.55, p.tint);
      g.addColorStop(1, 'rgba(185,96,110,.55)');
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    function tick() {
      ctx.clearRect(0, 0, W, H);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.vy += .18; p.vx *= .99;
        p.x += p.vx; p.y += p.vy;
        p.life -= .016;
        if (p.life <= 0 || p.y > H + 20) { parts.splice(i, 1); continue; }
        pearl(p);
      }
      ctx.globalAlpha = 1;
      raf = parts.length ? requestAnimationFrame(tick) : 0;
    }
  }

  // ═══════════════════════════════════════
  // 3) NÁKLON KARET S ODLESKEM
  // ═══════════════════════════════════════
  function initTilt() {
    if (reduced || !finePointer) return;
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    let active = null;
    const reset = card => {
      card.classList.remove('tilting');
      card.style.removeProperty('--rx');
      card.style.removeProperty('--ry');
    };
    grid.addEventListener('pointermove', e => {
      const card = e.target.closest('.product-card');
      if (active && active !== card) reset(active);
      active = card;
      if (!card) return;
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      card.classList.add('tilting');
      card.style.setProperty('--rx', ((.5 - py) * 12).toFixed(2) + 'deg');
      card.style.setProperty('--ry', ((px - .5) * 14).toFixed(2) + 'deg');
      card.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
      card.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
    });
    grid.addEventListener('pointerleave', () => { if (active) reset(active); active = null; });
  }

  // ═══════════════════════════════════════
  // 4) PERLA PŘELETÍ DO KOŠÍKU
  // ═══════════════════════════════════════
  function initFly() {
    if (reduced) return;
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
        frames.push({ transform: `translate(${x - 9}px, ${y - 9}px) scale(${1.4 - t * .8})`, opacity: t > .9 ? 0 : 1 });
      }
      el.animate(frames, { duration: 750, easing: 'cubic-bezier(.45,.05,.55,.95)' }).onfinish = () => {
        el.remove();
        cart.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.6)' }, { transform: 'scale(1)' }],
          { duration: 420, easing: 'cubic-bezier(.3,1.6,.5,1)' });
      };
    }, true);
  }

  initHero();
  initTrail();
  initTilt();
  initFly();
})();
