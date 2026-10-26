import { ICON } from "./icon.js";

// Living gradient: one small WebGL shader paints a slow mesh of the logo colours across the whole viewport.
// Every .fx canvas is a window onto its own slice of it, and the shader only runs while something is being touched.
export const FX = (() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const S = 6;
  const cv = document.createElement("canvas");
  const gl = cv.getContext("webgl", { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false });
  const stage = document.createElement("canvas"), sctx = stage.getContext("2d");
  let W = 8, H = 8, t = 0, last = 0, mx = .5, my = .5, tmx = .5, tmy = .5, heat = 0, raf = 0, U = {};
  const items = new Set();

  const FRAG = `precision mediump float;
uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse; uniform float uHeat;
const vec3 MINT=vec3(.333,.769,.663), SANS=vec3(.251,.678,.573), LAGO=vec3(.231,.541,.478), DEPT=vec3(.157,.392,.357), DEEP=vec3(.082,.247,.239), ABYS=vec3(.039,.169,.173);
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x), u.y); }
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<4;i++){ v+=a*noise(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return v; }
void main(){
  float h = uRes.y*.5; bool dark = gl_FragCoord.y >= h;
  vec2 uv = vec2(gl_FragCoord.x/uRes.x, mod(gl_FragCoord.y,h)/h);
  float asp = uRes.x/h; vec2 p = uv*vec2(asp,1.)*1.6; vec2 m = uMouse*vec2(asp,1.)*1.6;
  float d = distance(p,m); float pull = uHeat*exp(-d*d*2.2);
  p += (p-m)*pull*.22;
  float tt = uTime*.09;
  vec2 q = vec2(fbm(p+vec2(0.,tt)), fbm(p+vec2(5.2,-tt)));
  vec2 r = vec2(fbm(p+2.2*q+vec2(1.7,9.2)+tt*.8), fbm(p+2.2*q+vec2(8.3,2.8)-tt*.6));
  float v = smoothstep(.22,.78, fbm(p+2.6*r));
  vec3 col;
  if(dark){
    col = mix(ABYS, DEEP, smoothstep(.15,.55,v));
    col = mix(col, LAGO, smoothstep(.5,.78,v));
    col = mix(col, MINT, smoothstep(.74,1.,v) + pull*.35);
  } else {
    col = mix(MINT, SANS, smoothstep(.1,.4,v));
    col = mix(col, LAGO, smoothstep(.35,.6,v));
    col = mix(col, DEPT, smoothstep(.55,.78,v));
    col = mix(col, ABYS, smoothstep(.75,1.,v));
    col = mix(col, MINT, pull*.45);
  }
  col += (hash(gl_FragCoord.xy+fract(uTime)*91.)-.5)*.03;
  gl_FragColor = vec4(col,1.);
}`;

  let ok = !!gl;
  if (ok) {
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { ok = false; console.warn(gl.getShaderInfoLog(s)); } return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}"));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) ok = false;
    if (ok) {
      gl.useProgram(pr);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
      const a = gl.getAttribLocation(pr, "a"); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
      for (const n of ["uRes","uTime","uMouse","uHeat"]) U[n] = gl.getUniformLocation(pr, n);
    }
  }
  // Without WebGL: a still version of both halves
  const still = () => {
    const c = cv.getContext("2d"); if (!c) return;
    const g1 = c.createLinearGradient(0, 0, W, H); g1.addColorStop(0, "#0A2B2C"); g1.addColorStop(.6, "#153F3D"); g1.addColorStop(1, "#3B8A7A");
    c.fillStyle = g1; c.fillRect(0, 0, W, H);
    const g2 = c.createLinearGradient(0, H, W, 2 * H); g2.addColorStop(0, "#55C4A9"); g2.addColorStop(.5, "#40AD92"); g2.addColorStop(.8, "#28645B"); g2.addColorStop(1, "#0A2B2C");
    c.fillStyle = g2; c.fillRect(0, H, W, H);
  };
  function resize() {
    W = Math.max(8, Math.round(innerWidth / S)); H = Math.max(8, Math.round(innerHeight / S));
    cv.width = stage.width = W; cv.height = stage.height = H * 2;
    if (ok) gl.viewport(0, 0, W, H * 2); else still();
    sctx.drawImage(cv, 0, 0);
  }
  function render() {
    if (!ok) return;
    gl.uniform2f(U.uRes, W, H * 2); gl.uniform1f(U.uTime, t); gl.uniform2f(U.uMouse, mx, my); gl.uniform1f(U.uHeat, heat);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    sctx.drawImage(cv, 0, 0);
  }
  // draw the slice of the shader under a viewport rect into a 2D context
  function slice(ctx, x, y, w, h, variant, cw, ch) {
    const vw = innerWidth, vh = innerHeight;
    const sx = Math.max(0, Math.min(W - .5, x / vw * W)), sw = Math.max(.5, Math.min(W - sx, w / vw * W));
    const sy0 = Math.max(0, Math.min(H - .5, y / vh * H)), sh = Math.max(.5, Math.min(H - sy0, h / vh * H));
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(stage, sx, (variant === "dark" ? 0 : H) + sy0, sw, sh, 0, 0, cw, ch);
  }
  function geom(c) {
    const op = c.offsetParent; if (!op) return null;
    const r = op.getBoundingClientRect();
    return { x: r.left + op.clientLeft + c.offsetLeft, y: r.top + op.clientTop + c.offsetTop, w: c.offsetWidth, h: c.offsetHeight };
  }
  function paintCanvas(it) {
    const g = geom(it.c); if (!g || g.w < 1 || g.h < 1) return;
    if (g.y > innerHeight || g.y + g.h < 0) return;
    const dpr = Math.min(1.5, devicePixelRatio || 1), cw = Math.max(1, Math.round(g.w * dpr)), ch = Math.max(1, Math.round(g.h * dpr));
    if (it.c.width !== cw || it.c.height !== ch) { it.c.width = cw; it.c.height = ch; }
    slice(it.ctx, g.x, g.y, g.w, g.h, it.variant, cw, ch);
  }
  function frame(now) {
    const dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
    let busy = false;
    for (const it of items) { if (it.on()) { it.lastOn = now; busy = true; } }
    heat += ((busy ? 1 : 0) - heat) * .06;
    mx += (tmx - mx) * .08; my += (tmy - my) * .08;
    if (!reduce) t += dt;
    render();
    let drawn = false;
    for (const it of items) {
      if (now - (it.lastOn || -1e9) < 900) { drawn = true; it.paint ? it.paint(now) : paintCanvas(it); }
    }
    raf = (drawn || heat > .01) && !reduce ? requestAnimationFrame(frame) : 0;
    if (reduce && drawn) raf = 0;
  }
  const kick = () => { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };
  function add(c, host, variant, opts = {}) {
    const it = { c, host, variant, ctx: c.getContext ? c.getContext("2d") : null, on: opts.on || (() => host.matches(":hover") || host.matches(":focus-visible") || host.classList.contains("fx-on")), paint: opts.paint };
    items.add(it); return it;
  }
  function attach(host, variant, cls = "") {
    if (host.querySelector(":scope > canvas.fx")) return;
    const c = document.createElement("canvas"); c.className = ("fx " + cls).trim(); c.setAttribute("aria-hidden", "true");
    host.prepend(c); return add(c, host, variant);
  }
  addEventListener("resize", () => { resize(); kick(); });
  addEventListener("pointermove", (e) => { tmx = e.clientX / innerWidth; tmy = 1 - e.clientY / innerHeight; kick(); }, { passive: true });
  for (const ev of ["pointerover", "focusin", "focusout", "click", "keydown"]) addEventListener(ev, kick, { passive: true });
  addEventListener("scroll", kick, { passive: true });
  resize();
  return { add, attach, kick, slice, size: () => ({ W, H }), canvas: cv };
})();

// Where the gradient shows up. Each host gets its window when it appears on the page.
function wireFX(root = document) {
  root.querySelectorAll(".btn").forEach((el) => FX.attach(el, "dark"));
  root.querySelectorAll(".copy").forEach((el) => FX.attach(el, "dark"));
  root.querySelectorAll(".stat").forEach((el) => FX.attach(el, "full"));
  root.querySelectorAll("a.it").forEach((el) => { FX.attach(el, "full"); const tg = el.querySelector(".tg"); if (tg && !tg.querySelector("canvas.fx")) { const c = document.createElement("canvas"); c.className = "fx"; tg.prepend(c); FX.add(c, el, "dark"); } });
  root.querySelectorAll(".cell").forEach((el) => { const o = el.querySelector(".open"); if (o && !o.querySelector("canvas.fx")) { const c = document.createElement("canvas"); c.className = "fx"; o.prepend(c); FX.add(c, el, "full"); } });
}
wireFX();
new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) wireFX(n.parentElement || document); }).observe(document.body, { childList: true, subtree: true });

// Unlock bloom: the gradient floods the card from the button
(() => { const pop = document.getElementById("pf"); if (!pop) return; const c = document.createElement("canvas"); c.className = "bloomfx"; c.setAttribute("aria-hidden", "true"); pop.append(c); const msg = document.createElement("div"); msg.className = "bloommsg"; msg.setAttribute("aria-hidden", "true"); msg.innerHTML = ICON("open") + "<span>Unlocked</span>"; pop.append(msg); FX.add(c, pop, "dark", { on: () => pop.classList.contains("bloom") }); })();

// Focus ring: a 3px window of the gradient around the focused field
(() => {
  const ring = document.createElement("div"); ring.className = "ring"; ring.setAttribute("aria-hidden", "true");
  const c = document.createElement("canvas"); c.className = "fx"; ring.append(c); document.body.append(ring);
  let el = null;
  const place = () => { if (!el) return; const r = el.getBoundingClientRect(); Object.assign(ring.style, { left: r.left - 3 + "px", top: r.top - 3 + "px", width: r.width + 6 + "px", height: r.height + 6 + "px" }); };
  FX.add(c, ring, "full", { on: () => ring.classList.contains("on") });
  addEventListener("focusin", (e) => { if (e.target.matches && e.target.matches(".in")) { el = e.target; place(); ring.classList.add("on"); FX.kick(); } });
  addEventListener("focusout", () => { el = null; ring.classList.remove("on"); });
  addEventListener("scroll", place, { passive: true }); addEventListener("resize", place);
  setInterval(() => el && place(), 250);
})();

// Hero dot field: faint grey at rest; near the pointer the dots swell and show the living gradient
(() => {
  const cv = document.getElementById("dots"), hero = document.getElementById("hero"); if (!cv || !hero) return; const ctx = cv.getContext("2d");
  const hot = document.createElement("canvas"), hctx = hot.getContext("2d");
  let Wd = 0, Hd = 0, dpr = 1, px = -999, py = -999, heat = 0, inside = false, dotCol = "#A3A39E";
  const read = () => { dotCol = getComputedStyle(document.documentElement).getPropertyValue("--ink3").trim(); };
  const size = () => { const r = hero.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); Wd = r.width; Hd = r.height; for (const c of [cv, hot]) { c.width = Wd * dpr; c.height = Hd * dpr; } ctx.setTransform(dpr, 0, 0, dpr, 0, 0); hctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw(); };
  function draw() {
    ctx.clearRect(0, 0, Wd, Hd); hctx.clearRect(0, 0, Wd, Hd);
    const G = 22, R = 210, narrow = Wd < 700;
    for (let y = G / 2; y < Hd; y += G) for (let x = G / 2; x < Wd; x += G) {
      const base = narrow ? Math.max(0, Math.min(1, (x / Wd + (1 - y / Hd) - 1) / .6)) : Math.max(0, Math.min(1, (x / Wd - .4) / .45));
      const k = Math.max(0, 1 - Math.hypot(x - px, y - py) / R) ** 2 * heat;
      if (base > .02 && k < .1) { ctx.globalAlpha = base * .55; ctx.fillStyle = dotCol; ctx.beginPath(); ctx.arc(x, y, .9, 0, Math.PI * 2); ctx.fill(); }
      if (k >= .02) { hctx.globalAlpha = Math.min(1, .45 + k); hctx.fillStyle = "#fff"; hctx.beginPath(); hctx.arc(x, y, 1.1 + k * 2.6, 0, Math.PI * 2); hctx.fill(); }
    }
    ctx.globalAlpha = 1; hctx.globalAlpha = 1;
    if (heat > .02) {
      const r = hero.getBoundingClientRect();
      hctx.save(); hctx.setTransform(1, 0, 0, 1, 0, 0); hctx.globalCompositeOperation = "source-in";
      FX.slice(hctx, r.left, r.top, r.width, r.height, "full", hot.width, hot.height);
      hctx.restore(); ctx.drawImage(hot, 0, 0, Wd, Hd);
    }
  }
  FX.add(cv, hero, "full", { on: () => inside, paint: () => { heat += ((inside ? 1 : 0) - heat) * .08; draw(); } });
  hero.addEventListener("pointermove", (e) => { const r = hero.getBoundingClientRect(); const nx = e.clientX - r.left, ny = e.clientY - r.top; if (px < -900) { px = nx; py = ny; } px += (nx - px) * .5; py += (ny - py) * .5; inside = true; FX.kick(); });
  hero.addEventListener("pointerleave", () => { inside = false; FX.kick(); });
  read(); new ResizeObserver(size).observe(hero);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { read(); draw(); });
  new MutationObserver(() => { read(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
})();


export { wireFX };
