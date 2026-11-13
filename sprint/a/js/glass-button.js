// Glass buttons: each .b-glass gets a live, physically based render of a frosted
// glass pill (Three.js MeshPhysicalMaterial with transmission), coloured lights
// glowing inside it, and spring physics for tilt, press and the moving light.
import * as THREE from "./three.module.min.js";
import { RoomEnvironment } from "./RoomEnvironment.js";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

// --- one shared renderer draws every button into its own 2D canvas ------------
let renderer, pmrem, envTex;
function sharedRenderer() {
  if (renderer) return renderer;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  pmrem = new THREE.PMREMGenerator(renderer);
  envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  return renderer;
}

// a stadium (pill) outline, extruded with a round bevel so the edges catch light
function pillGeometry(w, h, depth) {
  const r = h / 2, s = new THREE.Shape(), x = w / 2 - r;
  s.moveTo(-x, -r); s.lineTo(x, -r);
  s.absarc(x, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(-x, r);
  s.absarc(-x, 0, r, Math.PI / 2, Math.PI * 1.5, false);
  const bevel = Math.min(r * 0.62, depth * 0.9);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.92, bevelSegments: 24, curveSegments: 64 });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

// a soft round light: white centre fading to nothing, tinted by the material colour
let dotTex;
function softDot() {
  if (dotTex) return dotTex;
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d"), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.35, "rgba(255,255,255,.75)"); r.addColorStop(0.7, "rgba(255,255,255,.22)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  dotTex = new THREE.CanvasTexture(c); dotTex.colorSpace = THREE.SRGBColorSpace; return dotTex;
}

// critically damped-ish spring
function spring(v, k = 170, c = 18) { return { x: v, v: 0, t: v, k, c }; }
function step(s, dt) { const a = s.k * (s.t - s.x) - s.c * s.v; s.v += a * dt; s.x += s.v * dt; }

function makeButton(btn) {
  const R = sharedRenderer();
  const cv = document.createElement("canvas");
  cv.className = "gb-cv"; cv.setAttribute("aria-hidden", "true");
  btn.insertBefore(cv, btn.firstChild);
  const ctx = cv.getContext("2d");

  const scene = new THREE.Scene();
  scene.environment = envTex;
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  cam.position.set(0, 0, 20);

  // geometry is built in "button pixels"; the canvas is padded so tilt never clips
  let bw = 1, bh = 1, PAD = 26, group = new THREE.Group(), pill, back, blobs = [];
  scene.add(group);

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.2, transmission: 1, thickness: 22, ior: 1.42,
    attenuationColor: new THREE.Color(0xf4f2ff), attenuationDistance: 140,
    clearcoat: 0.7, clearcoatRoughness: 0.18, specularIntensity: 0.6, envMapIntensity: 0.55, side: THREE.DoubleSide,
  });
  const paint = document.createElement("canvas"), pg = paint.getContext("2d");
  const paintTex = new THREE.CanvasTexture(paint); paintTex.colorSpace = THREE.SRGBColorSpace;
  const backMat = new THREE.MeshBasicMaterial({ map: paintTex, toneMapped: false });
  const cols = [0x2f6bff, 0xff4f7e, 0xffb37a, 0x8a5cff];
  const blobMats = cols.map((c) => new THREE.MeshBasicMaterial({ color: c, map: softDot(), transparent: true, depthWrite: false, toneMapped: false }));
  // a matte copy of the pill, used to cut everything to the glass silhouette
  const maskScene = new THREE.Scene(), maskGroup = new THREE.Group(); maskScene.add(maskGroup);
  const maskMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });

  // soft key light from top-left, cool rim from below-right, for the edge highlights
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-6, 9, 12); scene.add(key);
  const rim = new THREE.DirectionalLight(0xdfe6ff, 0.6); rim.position.set(8, -6, 6); scene.add(rim);

  function build() {
    const r = btn.getBoundingClientRect();
    bw = r.width; bh = r.height;
    const dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round((bw + PAD * 2) * dpr); cv.height = Math.round((bh + PAD * 2) * dpr);
    cv.style.width = bw + PAD * 2 + "px"; cv.style.height = bh + PAD * 2 + "px";
    cam.left = -(bw / 2 + PAD); cam.right = bw / 2 + PAD; cam.top = bh / 2 + PAD; cam.bottom = -(bh / 2 + PAD);
    cam.updateProjectionMatrix();
    group.clear(); blobs = [];
    const depth = bh * 0.34;
    pill = new THREE.Mesh(pillGeometry(bw - bh * 0.24, bh * 0.76, depth), glass);
    pill.position.z = 4; group.add(pill); 
    maskGroup.clear(); const mp = new THREE.Mesh(pill.geometry, maskMat); mp.position.z = 4; maskGroup.add(mp);
    // what the glass sees behind it: a warm white plate and four coloured lights
    back = new THREE.Mesh(new THREE.PlaneGeometry(bw * 1.3, bh * 1.6), backMat); back.position.z = -depth * 1.4; group.add(back);
    paint.width = 512; paint.height = Math.round(512 * (bh * 1.6) / (bw * 1.3));
  }

  // physics state
  const tiltX = spring(0, 120, 14), tiltY = spring(0, 120, 14), press = spring(0, 420, 24), lift = spring(0, 160, 18);
  const lx = spring(0.78, 60, 12), ly = spring(0.5, 60, 12), glow = spring(0, 90, 15);
  let vis = false, raf = 0, last = performance.now(), t0 = last, idleFrames = 0;

  function render(now) {
    const dt = Math.min(0.033, (now - last) / 1000); last = now;
    [tiltX, tiltY, press, lift, lx, ly, glow].forEach((s) => step(s, dt));
    const t = reduce ? 0 : (now - t0) / 1000;

    group.rotation.x = tiltX.x; group.rotation.y = tiltY.x;
    const sc = 1 - press.x * 0.035; group.scale.set(sc + press.x * 0.012, sc, 1);
    group.position.y = lift.x * 2 - press.x * 2;

    // lights: rest on the right, drift by themselves, follow the pointer with lag
    // paint the backdrop: warm white with four soft coloured lights around the light point
    const PW = paint.width, PH = paint.height, sx = PW / (bw * 1.3), sy = PH / (bh * 1.6);
    const cx = PW / 2 + (lx.x - 0.5) * bw * sx, cy = PH / 2 + (ly.x - 0.5) * bh * sy, spread = 1 + glow.x * 0.3;
    pg.globalCompositeOperation = "source-over"; pg.fillStyle = "#FBFAF8"; pg.fillRect(0, 0, PW, PH);
    const L = [["47,107,255", -0.06, -0.42, 0.62], ["255,79,126", -0.26, 0.42, 0.6], ["255,179,122", 0.4, 0.02, 0.48], ["138,92,255", -0.1, 0.0, 0.5]];
    pg.globalCompositeOperation = "multiply";
    L.forEach(([c, ox, oy, r], i) => {
      const ph = t * (0.45 + i * 0.12) + i * 1.7;
      const x = cx + (ox * bw * spread + Math.sin(ph) * bh * 0.18) * sx, y = cy + (oy * bh * spread + Math.cos(ph * 0.8) * bh * 0.12) * sy;
      const rr = r * bh * spread * 1.6 * sx;
      const gr = pg.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, `rgba(${c},1)`); gr.addColorStop(0.45, `rgba(${c},.6)`); gr.addColorStop(1, `rgba(${c},0)`);
      pg.fillStyle = gr; pg.fillRect(0, 0, PW, PH);
    });
    pg.globalCompositeOperation = "screen"; const hl = pg.createRadialGradient(cx, cy, 0, cx, cy, bh * 0.9 * sx);
    hl.addColorStop(0, "rgba(255,255,255,.35)"); hl.addColorStop(1, "rgba(255,255,255,0)"); pg.fillStyle = hl; pg.fillRect(0, 0, PW, PH);
    paintTex.needsUpdate = true;

    maskGroup.rotation.copy(group.rotation); maskGroup.scale.copy(group.scale); maskGroup.position.copy(group.position);
    R.setSize(cv.width, cv.height, false);
    R.render(scene, cam);
    ctx.globalCompositeOperation = "copy"; ctx.drawImage(R.domElement, 0, 0);
    R.render(maskScene, cam);
    ctx.globalCompositeOperation = "destination-in"; ctx.drawImage(R.domElement, 0, 0);
    ctx.globalCompositeOperation = "source-over";

    // label: white where the light sits, ink elsewhere
    btn.style.setProperty("--gx", (lx.x * 100).toFixed(2) + "%");
    btn.style.setProperty("--gy", (ly.x * 100).toFixed(2) + "%");
    btn.style.setProperty("--press", press.x.toFixed(3));

    const moving = [tiltX, tiltY, press, lift, lx, ly, glow].some((s) => Math.abs(s.v) > 1e-3 || Math.abs(s.t - s.x) > 1e-3);
    idleFrames = moving ? 0 : idleFrames + 1;
    if (vis && (!reduce || idleFrames < 2)) raf = requestAnimationFrame(render); else raf = 0;
  }
  function go() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(render); } }

  build(); render(performance.now());
  new IntersectionObserver((es) => { vis = es[0].isIntersecting; if (vis) go(); }).observe(btn);
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { build(); go(); }, 120); });

  btn.addEventListener("pointermove", (e) => {
    const r = btn.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    tiltY.t = (px - 0.5) * 0.16; tiltX.t = (py - 0.5) * 0.22;
    lx.t = Math.max(0.15, Math.min(0.92, px)); ly.t = py; glow.t = 1; lift.t = 1; go();
  });
  btn.addEventListener("pointerleave", () => { tiltX.t = tiltY.t = 0; lx.t = 0.78; ly.t = 0.5; glow.t = 0; lift.t = 0; press.t = 0; go(); });
  btn.addEventListener("pointerdown", () => { press.t = 1; go(); });
  addEventListener("pointerup", () => { if (press.t) { press.t = 0; press.v = -4; go(); } });
  btn.classList.add("gb-ready");
}

try { document.querySelectorAll(".b-glass").forEach(makeButton); } catch (e) { console.warn("glass buttons off", e); }
