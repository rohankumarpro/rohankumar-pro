// The Design renderer: draws a design (frames, shapes, text, pictures, groups, masks, boolean shapes) on a 2D canvas.
// The editor, the present view and every export use this same code, so what you see is exactly what you export.
//
// A node's x, y are relative to its parent (a frame, group or boolean shape); w, h are its size; rot turns it about its
// centre. Lines run from (0,0) to (w,h) and may have negative sizes. Children are drawn in z order. In a parent, a child
// marked as a mask clips every sibling above it. Text holds runs of differently styled text.

export const DPR = () => Math.min(3, window.devicePixelRatio || 1);
const RAD = Math.PI / 180;

/* ---------- fonts (Google Fonts, loaded on demand) ---------- */
const fontLinks = new Set(), fontWait = new Map();
export const FONT_LIST = ["Inter", "Roboto", "Open Sans", "Montserrat", "Poppins", "Lato", "Oswald", "Raleway", "Nunito", "Playfair Display", "Merriweather", "Work Sans", "DM Sans", "Manrope", "Space Grotesk", "Sora", "Outfit", "Plus Jakarta Sans", "Figtree", "Rubik", "Karla", "Mulish", "Barlow", "Barlow Condensed", "Bebas Neue", "Anton", "Archivo", "Archivo Black", "Lexend", "Urbanist", "Epilogue", "Syne", "Unbounded", "Space Mono", "JetBrains Mono", "IBM Plex Sans", "IBM Plex Serif", "Source Serif 4", "Fraunces", "Libre Baskerville", "Lora", "Cormorant Garamond", "DM Serif Display", "Instrument Serif", "Abril Fatface", "Alfa Slab One", "Righteous", "Pacifico", "Caveat", "Dancing Script", "Permanent Marker", "Lobster", "Shrikhand", "Bricolage Grotesque", "Big Shoulders Display", "Inter Tight", "Noto Sans", "Noto Serif", "Josefin Sans", "Quicksand", "Comfortaa", "Fredoka", "Baloo 2", "Chakra Petch", "Orbitron"];
export function loadFont(family) {
  if (!family || fontLinks.has(family)) return fontWait.get(family) || Promise.resolve();
  fontLinks.add(family);
  const l = document.createElement("link"); l.rel = "stylesheet";
  l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,700&display=swap`;
  const p = new Promise((res) => { l.onload = res; l.onerror = res; setTimeout(res, 4000); });
  document.head.append(l); fontWait.set(family, p); return p;
}
// every font and weight a set of nodes uses, ready to draw
export async function fontsFor(nodes) {
  const want = new Map();
  for (const n of nodes) if (n.t === "text") for (const r of n.runs || []) { const f = r.f || "Inter"; const k = `${r.i ? "italic " : ""}${r.w || 400} 20px "${f}"`; want.set(k, f); }
  await Promise.all([...new Set(want.values())].map(loadFont));
  await Promise.all([...want.keys()].map((k) => document.fonts.load(k).catch(() => {})));
}

/* ---------- pictures ---------- */
const IMG = new Map();
let onImage = null; // the editor redraws when a picture arrives
export function setImageListener(f) { onImage = f; }
export function img(src) {
  let e = IMG.get(src);
  if (!e) { const im = new Image(); im.crossOrigin = "anonymous"; im.decoding = "async"; e = { im, ok: false }; IMG.set(src, e); im.onload = () => { e.ok = true; onImage && onImage(src); }; im.onerror = () => { e.bad = true; }; im.src = src; }
  return e.ok ? e.im : null;
}
export async function imagesFor(nodes) {
  const srcs = new Set(); for (const n of nodes) for (const f of n.fills || []) if (f.t === "i" && f.src) srcs.add(f.src);
  await Promise.all([...srcs].map((s) => new Promise((res) => { const e = IMG.get(s); if (e && (e.ok || e.bad)) return res(); img(s); const t = setInterval(() => { const e2 = IMG.get(s); if (e2 && (e2.ok || e2.bad)) { clearInterval(t); res(); } }, 50); setTimeout(() => { clearInterval(t); res(); }, 8000); })));
}

/* ---------- colour ---------- */
export function rgba(hex, a = 1) { const n = parseInt((hex || "#000000").slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }

/* ---------- geometry ---------- */
export function localMatrix(n) {
  const m = new DOMMatrix().translate(n.x || 0, n.y || 0);
  if (n.rot && n.t !== "line") { const cx = n.w / 2, cy = n.h / 2; m.translateSelf(cx, cy).rotateSelf(n.rot).translateSelf(-cx, -cy); }
  return m;
}
export function radii(n) {
  const max = Math.min(Math.abs(n.w), Math.abs(n.h)) / 2;
  const r = Array.isArray(n.r) ? n.r : [n.r || 0, n.r || 0, n.r || 0, n.r || 0];
  return r.map((v) => Math.max(0, Math.min(max, +v || 0)));
}
function roundRect(p, x, y, w, h, r) {
  const [tl, tr, br, bl] = r;
  p.moveTo(x + tl, y); p.lineTo(x + w - tr, y); if (tr) p.arcTo(x + w, y, x + w, y + tr, tr); else p.lineTo(x + w, y);
  p.lineTo(x + w, y + h - br); if (br) p.arcTo(x + w, y + h, x + w - br, y + h, br); else p.lineTo(x + w, y + h);
  p.lineTo(x + bl, y + h); if (bl) p.arcTo(x, y + h, x, y + h - bl, bl); else p.lineTo(x, y + h);
  p.lineTo(x, y + tl); if (tl) p.arcTo(x, y, x + tl, y, tl); else p.lineTo(x, y);
  p.closePath();
}
// the outline of a node in its own coordinates
export function shapePath(n) {
  const p = new Path2D(), w = n.w, h = n.h;
  switch (n.t) {
    case "ellipse": p.ellipse(w / 2, h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2); break;
    case "polygon": case "star": {
      const k = n.t === "star" ? (n.n || 5) * 2 : n.n || 3;
      for (let i = 0; i < k; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / k, rr = n.t === "star" && i % 2 ? n.ratio || 0.45 : 1;
        const x = w / 2 + (Math.cos(a) * w / 2) * rr, y = h / 2 + (Math.sin(a) * h / 2) * rr;
        i ? p.lineTo(x, y) : p.moveTo(x, y);
      }
      p.closePath(); break;
    }
    case "line": p.moveTo(0, 0); p.lineTo(w, h); break;
    case "text": p.rect(0, 0, w, h); break;
    default: roundRect(p, 0, 0, w, h, radii(n));
  }
  return p;
}

/* ---------- text ---------- */
const measureCtx = (() => { const c = document.createElement("canvas"); return c.getContext("2d"); })();
const fontOf = (r) => `${r.i ? "italic " : ""}${r.w || 400} ${r.sz || 16}px "${r.f || "Inter"}", system-ui, sans-serif`;
const caseOf = (s, tc) => (tc === "upper" ? s.toUpperCase() : tc === "lower" ? s.toLowerCase() : tc === "title" ? s.replace(/\b(\p{L})/gu, (m) => m.toUpperCase()) : s);
const LS_OK = "letterSpacing" in CanvasRenderingContext2D.prototype;
function measure(text, r) {
  const c = measureCtx; c.font = fontOf(r); if (LS_OK) c.letterSpacing = (r.ls || 0) + "px";
  const m = c.measureText(text); let w = m.width; if (!LS_OK && r.ls) w += r.ls * [...text].length;
  return { w, asc: m.fontBoundingBoxAscent ?? (r.sz || 16) * 0.8, desc: m.fontBoundingBoxDescent ?? (r.sz || 16) * 0.22 };
}
const LAYOUT = new Map();
export function clearLayout() { LAYOUT.clear(); } // fonts arrived: text must be measured again
// lines of positioned pieces; {lines, w, h}. width is used only when the box does not grow sideways
export function layoutText(n) {
  const key = JSON.stringify([n.runs, n.w, n.auto, n.ta, n.tc]);
  const hit = LAYOUT.get(n.id); if (hit && hit.key === key) return hit.out;
  const runs = n.runs && n.runs.length ? n.runs : [{ s: "", sz: 16, w: 400 }];
  const wrap = n.auto !== "w", maxW = Math.max(1, Math.abs(n.w));
  // tokens: words, spaces and line breaks, each with its run's style
  const toks = [];
  for (const r of runs) { const s = caseOf(r.s || "", n.tc); for (const part of s.split(/(\n| +)/)) if (part) toks.push({ s: part, r }); }
  const lines = []; let cur = { segs: [], w: 0 };
  const push = () => { lines.push(cur); cur = { segs: [], w: 0 }; };
  const add = (s, r) => { const m = measure(s, r); const last = cur.segs[cur.segs.length - 1]; if (last && last.r === r) { last.s += s; last.w = measure(last.s, r).w; cur.w = cur.segs.reduce((t, x) => t + x.w, 0); } else { cur.segs.push({ s, r, w: m.w }); cur.w += m.w; } };
  for (const t of toks) {
    if (t.s === "\n") { if (!cur.segs.length) cur.segs.push({ s: "", r: t.r, w: 0 }); push(); continue; }
    const tw = measure(t.s, t.r).w;
    if (wrap && cur.w + tw > maxW + 0.5 && cur.segs.length && !/^ +$/.test(t.s)) {
      // trailing spaces do not count at a line end
      const last = cur.segs[cur.segs.length - 1]; if (last) { last.s = last.s.replace(/ +$/, ""); last.w = measure(last.s, last.r).w; cur.w = cur.segs.reduce((x, y) => x + y.w, 0); }
      push();
    }
    if (wrap && /^ +$/.test(t.s) && !cur.segs.length && lines.length) continue; // no leading spaces after a wrap
    if (wrap && tw > maxW) { // a word longer than the box breaks by letters
      let buf = "";
      for (const ch of [...t.s]) { if (cur.w + measure(buf + ch, t.r).w > maxW && (buf || cur.segs.length)) { if (buf) add(buf, t.r); push(); buf = ch; } else buf += ch; }
      if (buf) add(buf, t.r); continue;
    }
    add(t.s, t.r);
  }
  if (cur.segs.length || !lines.length) { if (!cur.segs.length) cur.segs.push({ s: "", r: runs[runs.length - 1], w: 0 }); push(); }
  let y = 0, width = 0;
  for (const L of lines) {
    let lh = 0, asc = 0, desc = 0;
    for (const s of L.segs) { const sz = s.r.sz || 16, h = s.r.lh ? s.r.lh * sz : sz * 1.2; lh = Math.max(lh, h); const m = measure("Hg", s.r); asc = Math.max(asc, m.asc); desc = Math.max(desc, m.desc); }
    L.y = y; L.h = lh; L.base = y + (lh - (asc + desc)) / 2 + asc; y += lh; width = Math.max(width, L.w);
  }
  const boxW = wrap ? maxW : width;
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i], extra = boxW - L.w;
    let x = n.ta === "center" ? extra / 2 : n.ta === "right" ? extra : 0, gap = 0;
    if (n.ta === "justify" && i < lines.length - 1 && wrap) { const sp = L.segs.reduce((t, s) => t + (s.s.match(/ /g) || []).length, 0); gap = sp ? extra / sp : 0; x = 0; }
    for (const s of L.segs) { s.x = x; s.gap = gap; x += s.w + gap * (s.s.match(/ /g) || []).length; }
  }
  const out = { lines, w: Math.ceil(width), h: Math.ceil(y) };
  LAYOUT.set(n.id, { key, out }); return out;
}
// the size a text box should have for its words (auto width, or auto height)
export function textSize(n) { const L = layoutText(n); return n.auto === "w" ? { w: Math.max(1, L.w), h: Math.max(1, L.h) } : n.auto === "h" ? { w: n.w, h: Math.max(1, L.h) } : { w: n.w, h: n.h }; }

/* ---------- drawing ---------- */
const hasFx = (n, t) => (n.fx || []).some((e) => e.v !== false && (!t || e.t === t));
function setFillStyle(ctx, f, n) {
  if (f.t === "s") { ctx.fillStyle = rgba(f.c, f.a ?? 1); return true; }
  if (f.t === "l") {
    const th = (f.ang ?? 90) * RAD, dx = Math.sin(th), dy = -Math.cos(th), L = Math.abs(n.w * dx) + Math.abs(n.h * dy), cx = n.w / 2, cy = n.h / 2;
    const g = ctx.createLinearGradient(cx - dx * L / 2, cy - dy * L / 2, cx + dx * L / 2, cy + dy * L / 2);
    for (const s of f.stops) g.addColorStop(Math.max(0, Math.min(1, s.o)), rgba(s.c, (s.a ?? 1) * (f.a ?? 1)));
    ctx.fillStyle = g; return true;
  }
  return false;
}
function paintFills(ctx, n, path) {
  for (const f of n.fills || []) {
    if (f.v === false) continue;
    if (f.t === "s" || f.t === "l") { setFillStyle(ctx, f, n); ctx.fill(path); continue; }
    if (f.t === "r") {
      ctx.save(); ctx.clip(path); ctx.translate(n.w / 2, n.h / 2); ctx.scale(Math.max(0.01, Math.abs(n.w) / 2), Math.max(0.01, Math.abs(n.h) / 2));
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1); for (const s of f.stops) g.addColorStop(Math.max(0, Math.min(1, s.o)), rgba(s.c, (s.a ?? 1) * (f.a ?? 1)));
      ctx.fillStyle = g; ctx.fillRect(-1.5, -1.5, 3, 3); ctx.restore(); continue;
    }
    if (f.t === "i") {
      const im = img(f.src); if (!im) { ctx.fillStyle = "rgba(128,128,128,.18)"; ctx.fill(path); continue; }
      const iw = im.naturalWidth, ih = im.naturalHeight, w = n.w, h = n.h;
      ctx.save(); ctx.clip(path); ctx.globalAlpha *= f.a ?? 1;
      if (f.fit === "tile") { const pat = ctx.createPattern(im, "repeat"); ctx.fillStyle = pat; ctx.fillRect(0, 0, w, h); }
      else {
        const k = f.fit === "fit" ? Math.min(w / iw, h / ih) : Math.max(w / iw, h / ih) * (f.fit === "crop" ? f.cs || 1 : 1);
        const dw = iw * k, dh = ih * k, dx = (w - dw) / 2 + (f.fit === "crop" ? (f.cx || 0) * w : 0), dy = (h - dh) / 2 + (f.fit === "crop" ? (f.cy || 0) * h : 0);
        ctx.imageSmoothingQuality = "high"; ctx.drawImage(im, dx, dy, dw, dh);
      }
      ctx.restore();
    }
  }
}
function paintStrokes(ctx, n, path) {
  for (const s of n.strokes || []) {
    if (s.v === false || !(s.w > 0)) continue;
    ctx.save(); ctx.strokeStyle = rgba(s.c, s.a ?? 1); ctx.lineJoin = "miter"; ctx.miterLimit = 10;
    if (s.d) ctx.setLineDash([s.d, s.g || s.d]);
    const al = n.t === "line" ? "c" : s.al;
    if (al === "i") { ctx.clip(path); ctx.lineWidth = s.w * 2; ctx.stroke(path); }
    else if (al === "o") { const out = new Path2D(); out.rect(-1e5, -1e5, 2e5, 2e5); out.addPath(path); ctx.clip(out, "evenodd"); ctx.lineWidth = s.w * 2; ctx.stroke(path); }
    else { ctx.lineWidth = s.w; ctx.lineCap = n.t === "line" ? "round" : "butt"; ctx.stroke(path); }
    ctx.restore();
    if (n.t === "line") lineEnds(ctx, n, s);
  }
}
function lineEnds(ctx, n, s) {
  const ang = Math.atan2(n.h, n.w), size = Math.max(6, s.w * 3.2);
  const end = (x, y, a, kind) => {
    if (!kind || kind === "none") return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = rgba(s.c, s.a ?? 1); ctx.strokeStyle = rgba(s.c, s.a ?? 1);
    if (kind === "arrow") { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-size, -size * 0.55); ctx.lineTo(-size, size * 0.55); ctx.closePath(); ctx.fill(); }
    else if (kind === "dot") { ctx.beginPath(); ctx.arc(0, 0, size * 0.42, 0, Math.PI * 2); ctx.fill(); }
    else if (kind === "bar") { ctx.lineWidth = Math.max(2, s.w); ctx.beginPath(); ctx.moveTo(0, -size * 0.6); ctx.lineTo(0, size * 0.6); ctx.stroke(); }
    ctx.restore();
  };
  end(n.w, n.h, ang, n.eb); end(0, 0, ang + Math.PI, n.ea);
}
function paintText(ctx, n) {
  const L = layoutText(n), vOff = n.auto === "fixed" ? (n.va === "middle" ? (n.h - L.h) / 2 : n.va === "bottom" ? n.h - L.h : 0) : 0;
  const strokes = (n.strokes || []).filter((s) => s.v !== false && s.w > 0);
  for (const line of L.lines) for (const s of line.segs) {
    if (!s.s) continue;
    const r = s.r; ctx.font = fontOf(r); if (LS_OK) ctx.letterSpacing = (r.ls || 0) + "px"; ctx.textBaseline = "alphabetic";
    const y = line.base + vOff;
    const draw = (fn) => { if (!s.gap) { ctx[fn](s.s, s.x, y); return; } let x = s.x; for (const part of s.s.split(/( )/)) { if (!part) continue; ctx[fn](part, x, y); x += measure(part, r).w + (part === " " ? s.gap : 0); } };
    for (const st of strokes) { ctx.save(); ctx.strokeStyle = rgba(st.c, st.a ?? 1); ctx.lineWidth = st.w * 2; ctx.lineJoin = "round"; draw("strokeText"); ctx.restore(); }
    ctx.fillStyle = rgba(r.c || "#1A1A1A", r.a ?? 1); draw("fillText");
    if (r.u || r.st) { const sz = r.sz || 16, th = Math.max(1, sz / 14); ctx.fillStyle = rgba(r.c || "#1A1A1A", r.a ?? 1); const w = s.w + s.gap * (s.s.match(/ /g) || []).length; if (r.u) ctx.fillRect(s.x, y + sz * 0.12, w, th); if (r.st) ctx.fillRect(s.x, y - sz * 0.3, w, th); }
  }
  if (LS_OK) ctx.letterSpacing = "0px";
}
// the screen box of a node (with room for its effects), in device pixels
function screenBox(m, n, pad) {
  const pts = [[0, 0], [n.w, 0], [n.w, n.h], [0, n.h]].map(([x, y]) => m.transformPoint(new DOMPoint(x, y)));
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  return { x: Math.floor(Math.min(...xs) - pad), y: Math.floor(Math.min(...ys) - pad), r: Math.ceil(Math.max(...xs) + pad), b: Math.ceil(Math.max(...ys) + pad) };
}
const scaleOf = (m) => Math.hypot(m.a, m.b);
function makeLayer(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }

// draws one node and everything inside it. m: the node's full transform (world to device pixels)
export function drawNode(ctx, n, m, kids, opt = {}) {
  if (n.hide && !opt.showHidden) return;
  const k = scaleOf(m);
  const useLayer = hasFx(n, "ds") || hasFx(n, "is") || hasFx(n, "lb") || ((n.op ?? 1) < 1 && (kids(n.id).length || (n.fills || []).length + (n.strokes || []).length > 1)) || (n.blend && n.blend !== "normal" && kids(n.id).length) || n.t === "bool";
  if (hasFx(n, "bb")) backgroundBlur(ctx, n, m, k);
  if (!useLayer) {
    ctx.save(); ctx.globalAlpha *= n.op ?? 1; if (n.blend && n.blend !== "normal") ctx.globalCompositeOperation = n.blend;
    paintBody(ctx, n, m, kids, opt); ctx.restore(); return;
  }
  // effects need the node drawn on its own first
  const pad = (n.fx || []).reduce((t, e) => Math.max(t, (e.b || 0) * 2 + Math.abs(e.x || 0) + Math.abs(e.y || 0) + Math.abs(e.s || 0)), 2) * k + 4;
  const sb = screenBox(m, n, pad), cw = ctx.canvas.width, ch = ctx.canvas.height;
  const box = { x: Math.max(sb.x, -2 * pad), y: Math.max(sb.y, -2 * pad), r: Math.min(sb.r, cw + 2 * pad), b: Math.min(sb.b, ch + 2 * pad) };
  if (box.r <= box.x || box.b <= box.y) return;
  const lw = Math.min(8192, box.r - box.x), lh = Math.min(8192, box.b - box.y);
  const layer = makeLayer(lw, lh), lc = layer.getContext("2d");
  const lm = new DOMMatrix().translate(-box.x, -box.y).multiply(m);
  paintBody(lc, n, lm, kids, opt);
  // inner shadows: the shadow of everything outside the shape, kept inside it
  for (const e of (n.fx || []).filter((e) => e.v !== false && e.t === "is")) {
    const inv = makeLayer(lw, lh), ic = inv.getContext("2d");
    ic.fillStyle = "#000"; ic.fillRect(0, 0, lw, lh); ic.globalCompositeOperation = "destination-out"; ic.drawImage(layer, 0, 0);
    const sh = makeLayer(lw, lh), sc = sh.getContext("2d");
    sc.shadowColor = rgba(e.c, e.a ?? 0.25); sc.shadowBlur = (e.b || 0) * k; sc.shadowOffsetX = (e.x || 0) * k + 20000; sc.shadowOffsetY = (e.y || 0) * k;
    sc.drawImage(inv, -20000, 0); sc.globalCompositeOperation = "destination-in"; sc.shadowColor = "transparent"; sc.drawImage(layer, 0, 0);
    lc.save(); lc.globalCompositeOperation = "source-atop"; lc.drawImage(sh, 0, 0); lc.restore();
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha *= n.op ?? 1;
  // drop shadows sit under the node
  for (const e of (n.fx || []).filter((e) => e.v !== false && e.t === "ds")) {
    const spread = (e.s || 0) * k;
    ctx.save(); ctx.shadowColor = rgba(e.c, e.a ?? 0.25); ctx.shadowBlur = (e.b || 0) * k; ctx.shadowOffsetX = (e.x || 0) * k + 20000; ctx.shadowOffsetY = (e.y || 0) * k;
    if (spread) { const s = 1 + (2 * spread) / Math.max(1, Math.min(lw, lh)); ctx.translate(box.x + lw / 2 - 20000, box.y + lh / 2); ctx.scale(s, s); ctx.drawImage(layer, -lw / 2, -lh / 2); }
    else ctx.drawImage(layer, box.x - 20000, box.y);
    ctx.restore();
  }
  if (n.blend && n.blend !== "normal") ctx.globalCompositeOperation = n.blend;
  const lb = (n.fx || []).find((e) => e.v !== false && e.t === "lb");
  if (lb && "filter" in ctx) ctx.filter = `blur(${((lb.b || 0) * k) / 2}px)`;
  ctx.drawImage(layer, box.x, box.y);
  ctx.restore();
}
function backgroundBlur(ctx, n, m, k) {
  const e = (n.fx || []).find((x) => x.v !== false && x.t === "bb"); if (!e || !("filter" in ctx)) return;
  ctx.save(); ctx.setTransform(m); ctx.clip(shapePath(n)); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = `blur(${((e.b || 0) * k) / 2}px)`; ctx.drawImage(ctx.canvas, 0, 0); ctx.restore();
}
function paintBody(ctx, n, m, kids, opt) {
  ctx.setTransform(m);
  if (n.t === "text") { paintText(ctx, n); return; }
  if (n.t === "group") { drawChildren(ctx, n, m, kids, opt); return; }
  if (n.t === "bool") { paintBool(ctx, n, m, kids); return; }
  const path = shapePath(n);
  if (n.t !== "line") paintFills(ctx, n, path);
  if (n.t === "frame") {
    if (n.clip !== false) { ctx.save(); ctx.clip(path); drawChildren(ctx, n, m, kids, opt); ctx.restore(); }
    else drawChildren(ctx, n, m, kids, opt);
    ctx.setTransform(m);
  }
  paintStrokes(ctx, n, path);
}
// children in z order; a child marked as a mask clips the siblings above it
export function drawChildren(ctx, n, m, kids, opt) {
  const list = kids(n.id);
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c.mask && !c.hide) {
      const rest = list.slice(i + 1); if (!rest.length) break;
      const cw = ctx.canvas.width, ch = ctx.canvas.height, t = ctx.getTransform();
      const L = makeLayer(cw, ch), lc = L.getContext("2d");
      for (const r of rest) drawNode(lc, r, t.multiply(localMatrix(r)), kids, opt);
      const M = makeLayer(cw, ch), mc = M.getContext("2d");
      drawNode(mc, { ...c, mask: 0, op: 1, fx: [] }, t.multiply(localMatrix(c)), kids, opt);
      lc.globalCompositeOperation = "destination-in"; lc.drawImage(M, 0, 0);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(L, 0, 0); ctx.restore(); ctx.setTransform(t);
      break;
    }
    drawNode(ctx, c, m.multiply(localMatrix(c)), kids, opt);
    ctx.setTransform(m);
  }
}
const BOOL_OP = { union: "source-over", subtract: "destination-out", intersect: "destination-in", exclude: "xor" };
function paintBool(ctx, n, m, kids) {
  const list = kids(n.id).filter((c) => !c.hide); if (!list.length) return;
  const cw = ctx.canvas.width, ch = ctx.canvas.height, base = ctx.getTransform();
  const M = makeLayer(cw, ch), mc = M.getContext("2d");
  list.forEach((c, i) => {
    mc.globalCompositeOperation = i ? BOOL_OP[n.op2] || "source-over" : "source-over";
    mc.setTransform(base.multiply(localMatrix(c)));
    mc.fillStyle = "#000"; if (c.t === "bool") { const s = makeLayer(cw, ch), sc = s.getContext("2d"); sc.setTransform(base.multiply(localMatrix(c))); paintBool(sc, { ...c, fills: [{ t: "s", c: "#000000", a: 1 }] }, base.multiply(localMatrix(c)), kids); mc.setTransform(1, 0, 0, 1, 0, 0); mc.drawImage(s, 0, 0); }
    else if (c.t === "text") { const s = makeLayer(cw, ch), sc = s.getContext("2d"); sc.setTransform(base.multiply(localMatrix(c))); paintText(sc, { ...c, runs: (c.runs || []).map((r) => ({ ...r, c: "#000000", a: 1 })) }); mc.setTransform(1, 0, 0, 1, 0, 0); mc.drawImage(s, 0, 0); }
    else mc.fill(shapePath(c));
  });
  const F = makeLayer(cw, ch), fc = F.getContext("2d"); fc.setTransform(base);
  const all = new Path2D(); all.rect(-1e5, -1e5, 2e5, 2e5);
  paintFills(fc, { ...n, w: n.w, h: n.h }, (() => { const p = new Path2D(); p.rect(0, 0, n.w, n.h); return p; })());
  fc.setTransform(1, 0, 0, 1, 0, 0); fc.globalCompositeOperation = "destination-in"; fc.drawImage(M, 0, 0);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(F, 0, 0); ctx.restore(); ctx.setTransform(base);
}

/* ---------- a whole design, or one frame ---------- */
// kids(id): the children of a node in z order. Build it once per draw from the node table.
export function kidsOf(nodes) {
  const by = new Map();
  for (const n of Object.values(nodes)) { const p = n.parent || ""; (by.get(p) || by.set(p, []).get(p)).push(n); }
  for (const l of by.values()) l.sort((a, b) => (a.z || 0) - (b.z || 0));
  return (id) => by.get(id || "") || [];
}
export function worldMatrix(nodes, id) {
  const chain = []; let n = nodes[id]; while (n) { chain.unshift(n); n = n.parent ? nodes[n.parent] : null; }
  return chain.reduce((m, x) => m.multiply(localMatrix(x)), new DOMMatrix());
}
// draws one frame (or any node) on its own, scaled: for exports, thumbnails and presenting
export function drawAlone(ctx, nodes, id, scale, opt = {}) {
  const n = nodes[id]; if (!n) return;
  const kids = kidsOf(nodes);
  const m = new DOMMatrix().scale(scale, scale).multiply(n.rot && n.t !== "line" ? new DOMMatrix() : new DOMMatrix());
  const own = { ...n, x: 0, y: 0, rot: 0 };
  drawNode(ctx, own, m.multiply(localMatrix(own)), (pid) => kids(pid), opt);
}
export async function ready(nodes) { const list = Object.values(nodes); await Promise.all([fontsFor(list), imagesFor(list)]); }
// a picture of one frame (PNG or JPEG), scale 1x/2x/3x
export async function exportImage(nodes, id, { scale = 2, type = "image/png", quality = 0.92, bg } = {}) {
  await ready(nodes);
  const n = nodes[id], w = Math.max(1, Math.round(Math.abs(n.w) * scale)), h = Math.max(1, Math.round(Math.abs(n.h) * scale));
  const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d");
  if (type === "image/jpeg" || bg) { x.fillStyle = bg || "#FFFFFF"; x.fillRect(0, 0, w, h); }
  drawAlone(x, nodes, id, scale);
  return new Promise((res) => c.toBlob(res, type, quality));
}
