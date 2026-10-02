// Design: getting work out. Pictures (PNG, JPEG), vector SVG, PDF (one page per frame) and the full-screen presenter
// used both in the app and on a shared deck link. Everything is drawn by design-render.mjs, so it matches the screen.
import { ready, drawAlone, exportImage, kidsOf, layoutText, shapePath, radii, rgba } from "/js/design-render.mjs";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const fileName = (s) => (String(s || "design").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() || "design").slice(0, 80);
export function saveBlob(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }

/* ---------- PDF: each frame becomes one page, drawn at high resolution ---------- */
export async function exportPdf(nodes, ids, { scale = 2 } = {}) {
  await ready(nodes);
  const pages = [];
  for (const id of ids) {
    const n = nodes[id]; if (!n) continue;
    const blob = await exportImage(nodes, id, { scale, type: "image/jpeg", quality: 0.93, bg: "#FFFFFF" });
    pages.push({ w: Math.abs(n.w), h: Math.abs(n.h), pw: Math.round(Math.abs(n.w) * scale), ph: Math.round(Math.abs(n.h) * scale), jpg: new Uint8Array(await blob.arrayBuffer()) });
  }
  return pdfOf(pages);
}
function pdfOf(pages) {
  const enc = new TextEncoder(), parts = [], offs = [];
  let len = 0; const put = (x) => { const b = typeof x === "string" ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (n, body) => { offs[n] = len; put(`${n} 0 obj\n`); body(); put("\nendobj\n"); };
  put("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const N = pages.length, kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
  obj(1, () => put("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => put(`<< /Type /Pages /Kids [${kids}] /Count ${N} >>`));
  pages.forEach((p, i) => {
    const pg = 3 + i * 3, im = pg + 1, ct = pg + 2, content = `q ${p.w} 0 0 ${p.h} 0 0 cm /Im0 Do Q`;
    obj(pg, () => put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.w} ${p.h}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${ct} 0 R >>`));
    obj(im, () => { put(`<< /Type /XObject /Subtype /Image /Width ${p.pw} /Height ${p.ph} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpg.length} >>\nstream\n`); put(p.jpg); put("\nendstream"); });
    obj(ct, () => put(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
  });
  const xref = len, total = 3 + N * 3;
  put(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let i = 1; i < total; i++) put(String(offs[i]).padStart(10, "0") + " 00000 n \n");
  put(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts, { type: "application/pdf" });
}

/* ---------- SVG: real vectors for shapes, gradients, strokes, text and effects ---------- */
export async function exportSvg(nodes, id) {
  await ready(nodes);
  const kids = kidsOf(nodes), root = nodes[id]; let uid = 0; const defs = [];
  const fonts = new Set();
  const rr = (n) => radii(n);
  const pathD = (n) => {
    const w = n.w, h = n.h;
    if (n.t === "ellipse") return `M${w / 2} 0A${w / 2} ${h / 2} 0 1 1 ${w / 2} ${h}A${w / 2} ${h / 2} 0 1 1 ${w / 2} 0Z`;
    if (n.t === "polygon" || n.t === "star") { const k = n.t === "star" ? (n.n || 5) * 2 : n.n || 3; let d = ""; for (let i = 0; i < k; i++) { const a = -Math.PI / 2 + (i * Math.PI * 2) / k, r = n.t === "star" && i % 2 ? n.ratio || 0.45 : 1; d += (i ? "L" : "M") + (w / 2 + (Math.cos(a) * w / 2) * r).toFixed(2) + " " + (h / 2 + (Math.sin(a) * h / 2) * r).toFixed(2); } return d + "Z"; }
    if (n.t === "line") return `M0 0L${w} ${h}`;
    const [tl, tr, br, bl] = rr(n);
    return `M${tl} 0H${w - tr}${tr ? `A${tr} ${tr} 0 0 1 ${w} ${tr}` : ""}V${h - br}${br ? `A${br} ${br} 0 0 1 ${w - br} ${h}` : ""}H${bl}${bl ? `A${bl} ${bl} 0 0 1 0 ${h - bl}` : ""}V${tl}${tl ? `A${tl} ${tl} 0 0 1 ${tl} 0` : ""}Z`;
  };
  const paint = (f, n) => {
    if (f.t === "s") return { fill: f.c, op: f.a ?? 1 };
    if (f.t === "l" || f.t === "r") {
      const gid = "g" + ++uid, stops = f.stops.map((s) => `<stop offset="${s.o}" stop-color="${s.c}" stop-opacity="${(s.a ?? 1) * (f.a ?? 1)}"/>`).join("");
      if (f.t === "l") { const th = ((f.ang ?? 90) * Math.PI) / 180, dx = Math.sin(th), dy = -Math.cos(th), L = Math.abs(n.w * dx) + Math.abs(n.h * dy), cx = n.w / 2, cy = n.h / 2; defs.push(`<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${cx - (dx * L) / 2}" y1="${cy - (dy * L) / 2}" x2="${cx + (dx * L) / 2}" y2="${cy + (dy * L) / 2}">${stops}</linearGradient>`); }
      else defs.push(`<radialGradient id="${gid}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${n.w / 2} ${n.h / 2}) scale(${n.w / 2} ${n.h / 2})">${stops}</radialGradient>`);
      return { fill: `url(#${gid})`, op: 1 };
    }
    return null;
  };
  const fxFilter = (n) => {
    const list = (n.fx || []).filter((e) => e.v !== false && e.t !== "bb"); if (!list.length) return "";
    const fid = "f" + ++uid; let body = "";
    for (const e of list) {
      if (e.t === "ds") body += `<feDropShadow dx="${e.x || 0}" dy="${e.y || 0}" stdDeviation="${(e.b || 0) / 2}" flood-color="${e.c}" flood-opacity="${e.a ?? 0.25}"/>`;
      if (e.t === "lb") body += `<feGaussianBlur stdDeviation="${(e.b || 0) / 2}"/>`;
      if (e.t === "is") body += `<feComponentTransfer in="SourceAlpha" result="inv"><feFuncA type="table" tableValues="1 0"/></feComponentTransfer><feOffset dx="${e.x || 0}" dy="${e.y || 0}"/><feGaussianBlur stdDeviation="${(e.b || 0) / 2}"/><feFlood flood-color="${e.c}" flood-opacity="${e.a ?? 0.25}"/><feComposite operator="in" in2="inv"/><feComposite operator="in" in2="SourceAlpha"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode/></feMerge>`;
    }
    defs.push(`<filter id="${fid}" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">${body}</filter>`);
    return ` filter="url(#${fid})"`;
  };
  const node = (n, top) => {
    if (n.hide) return "";
    const tf = top ? "" : `translate(${n.x || 0} ${n.y || 0})${n.rot && n.t !== "line" ? ` rotate(${n.rot} ${n.w / 2} ${n.h / 2})` : ""}`;
    const attrs = `${tf ? ` transform="${tf}"` : ""}${(n.op ?? 1) < 1 ? ` opacity="${n.op}"` : ""}${n.blend && n.blend !== "normal" ? ` style="mix-blend-mode:${n.blend}"` : ""}${fxFilter(n)}`;
    let inner = "";
    if (n.t === "text") {
      const L = layoutText(n), off = n.auto === "fixed" ? (n.va === "middle" ? (n.h - L.h) / 2 : n.va === "bottom" ? n.h - L.h : 0) : 0;
      for (const line of L.lines) for (const s of line.segs) {
        if (!s.s) continue; const r = s.r; fonts.add(r.f || "Inter");
        inner += `<text x="${s.x.toFixed(2)}" y="${(line.base + off).toFixed(2)}" xml:space="preserve" font-family="${esc(r.f || "Inter")}" font-size="${r.sz || 16}" font-weight="${r.w || 400}"${r.i ? ' font-style="italic"' : ""}${r.ls ? ` letter-spacing="${r.ls}"` : ""}${r.u || r.st ? ` text-decoration="${[r.u ? "underline" : "", r.st ? "line-through" : ""].join(" ").trim()}"` : ""} fill="${r.c || "#1A1A1A"}"${(r.a ?? 1) < 1 ? ` fill-opacity="${r.a}"` : ""}>${esc(s.s)}</text>`;
      }
      return `<g${attrs}>${inner}</g>`;
    }
    const d = pathD(n);
    if (n.t !== "group" && n.t !== "bool" && n.t !== "line") for (const f of n.fills || []) {
      if (f.v === false) continue;
      if (f.t === "i") { const cid = "c" + ++uid; defs.push(`<clipPath id="${cid}"><path d="${d}"/></clipPath>`); inner += `<image href="${esc(new URL(f.src, location.href).href)}" x="0" y="0" width="${n.w}" height="${n.h}" preserveAspectRatio="${f.fit === "fit" ? "xMidYMid meet" : "xMidYMid slice"}" clip-path="url(#${cid})" opacity="${f.a ?? 1}"/>`; continue; }
      const p = paint(f, n); if (p) inner += `<path d="${d}" fill="${p.fill}"${p.op < 1 ? ` fill-opacity="${p.op}"` : ""}/>`;
    }
    const kidsSvg = () => { let out = "", list = kids(n.id), maskAt = list.findIndex((c) => c.mask && !c.hide);
      if (maskAt < 0) return list.map((c) => node(c)).join("");
      out += list.slice(0, maskAt).map((c) => node(c)).join(""); const mid = "m" + ++uid, mk = list[maskAt];
      defs.push(`<mask id="${mid}" maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000">${node({ ...mk, mask: 0, fills: [{ t: "s", c: "#FFFFFF", a: 1 }], strokes: [] })}</mask>`);
      return out + `<g mask="url(#${mid})">${list.slice(maskAt + 1).map((c) => node(c)).join("")}</g>`; };
    if (n.t === "frame" || n.t === "group") {
      if (n.t === "frame" && n.clip !== false) { const cid = "c" + ++uid; defs.push(`<clipPath id="${cid}"><path d="${d}"/></clipPath>`); inner += `<g clip-path="url(#${cid})">${kidsSvg()}</g>`; }
      else inner += kidsSvg();
    }
    if (n.t === "bool") {
      const list = kids(n.id).filter((c) => !c.hide), mid = "m" + ++uid, shape = (c, col) => node({ ...c, fills: [{ t: "s", c: col, a: 1 }], strokes: [], fx: [] });
      let mask = "";
      if (n.op2 === "union") mask = list.map((c) => shape(c, "#FFFFFF")).join("");
      else if (n.op2 === "subtract") mask = shape(list[0], "#FFFFFF") + list.slice(1).map((c) => shape(c, "#000000")).join("");
      else if (n.op2 === "intersect") { mask = shape(list[0], "#FFFFFF"); for (const c of list.slice(1)) { const m2 = "m" + ++uid; defs.push(`<mask id="${m2}" maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000">${shape(c, "#FFFFFF")}</mask>`); mask = `<g mask="url(#${m2})">${mask}</g>`; } }
      else { mask = list.map((c) => shape(c, "#FFFFFF")).join(""); /* exclude: the overlap is cut out below */ for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { const m3 = "m" + ++uid; defs.push(`<mask id="${m3}" maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000">${shape(list[j], "#FFFFFF")}</mask>`); mask += `<g mask="url(#${m3})">${shape(list[i], "#000000")}</g>`; } }
      defs.push(`<mask id="${mid}" maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000">${mask}</mask>`);
      for (const f of n.fills || []) { if (f.v === false) continue; const p = paint(f, n); if (p) inner += `<rect width="${n.w}" height="${n.h}" fill="${p.fill}"${p.op < 1 ? ` fill-opacity="${p.op}"` : ""} mask="url(#${mid})"/>`; }
    }
    for (const s of n.strokes || []) {
      if (s.v === false || !(s.w > 0)) continue;
      const al = n.t === "line" ? "c" : s.al, dash = s.d ? ` stroke-dasharray="${s.d} ${s.g || s.d}"` : "";
      if (al === "c") inner += `<path d="${d}" fill="none" stroke="${s.c}" stroke-opacity="${s.a ?? 1}" stroke-width="${s.w}"${n.t === "line" ? ' stroke-linecap="round"' : ""}${dash}/>`;
      else { const cid = "c" + ++uid; defs.push(al === "i" ? `<clipPath id="${cid}"><path d="${d}"/></clipPath>` : `<mask id="${cid}" maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000"><rect x="-100000" y="-100000" width="200000" height="200000" fill="#fff"/><path d="${d}" fill="#000"/></mask>`); inner += `<path d="${d}" fill="none" stroke="${s.c}" stroke-opacity="${s.a ?? 1}" stroke-width="${s.w * 2}"${dash} ${al === "i" ? `clip-path="url(#${cid})"` : `mask="url(#${cid})"`}/>`; }
      if (n.t === "line") { const ang = (Math.atan2(n.h, n.w) * 180) / Math.PI, sz = Math.max(6, s.w * 3.2); const end = (x, y, a, kind) => kind === "arrow" ? `<path d="M0 0L${-sz} ${-sz * 0.55}L${-sz} ${sz * 0.55}Z" fill="${s.c}" transform="translate(${x} ${y}) rotate(${a})"/>` : kind === "dot" ? `<circle cx="${x}" cy="${y}" r="${sz * 0.42}" fill="${s.c}"/>` : kind === "bar" ? `<path d="M0 ${-sz * 0.6}V${sz * 0.6}" stroke="${s.c}" stroke-width="${Math.max(2, s.w)}" transform="translate(${x} ${y}) rotate(${a})"/>` : ""; inner += end(n.w, n.h, ang, n.eb) + end(0, 0, ang + 180, n.ea); }
    }
    return `<g${attrs}>${inner}</g>`;
  };
  const body = node({ ...root, x: 0, y: 0, rot: 0 }, true);
  const fontCss = fonts.size ? `<style>@import url('https://fonts.googleapis.com/css2?${[...fonts].map((f) => "family=" + encodeURIComponent(f).replace(/%20/g, "+") + ":ital,wght@0,100..900;1,100..900").join("&")}&amp;display=swap');</style>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.abs(root.w)}" height="${Math.abs(root.h)}" viewBox="0 0 ${Math.abs(root.w)} ${Math.abs(root.h)}">${fontCss}<defs>${defs.join("")}</defs>${body}</svg>`;
}

/* ---------- presenting: full screen, one frame at a time ---------- */
export function present(nodes, slides, { start = 0, title = "", onClose } = {}) {
  if (!slides.length) return null;
  const el = document.createElement("div"); el.className = "dz-present"; el.tabIndex = -1;
  el.innerHTML = `<canvas></canvas><div class="dz-pbar"><button data-p="prev" aria-label="Previous slide"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button><span class="dz-pn"></span><button data-p="next" aria-label="Next slide"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button><button data-p="full" aria-label="Full screen"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>${onClose ? `<button data-p="x" aria-label="Stop presenting"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>` : ""}</div><div class="dz-pload">Loading…</div>`;
  document.body.append(el);
  const cv = el.querySelector("canvas"), ctx = cv.getContext("2d"), pn = el.querySelector(".dz-pn");
  let i = Math.max(0, Math.min(slides.length - 1, start)), hideT = 0;
  const draw = () => {
    const dpr = Math.min(3, devicePixelRatio || 1), W = innerWidth, H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + "px"; cv.style.height = H + "px";
    const n = nodes[slides[i]]; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = "#000"; ctx.fillRect(0, 0, cv.width, cv.height);
    if (!n) return;
    const k = Math.min(W / Math.abs(n.w), H / Math.abs(n.h)) * dpr, ox = (cv.width - Math.abs(n.w) * k) / 2, oy = (cv.height - Math.abs(n.h) * k) / 2;
    ctx.save(); ctx.translate(ox, oy); const t = ctx.getTransform();
    // drawAlone draws from the origin; move it to the centre first
    const sub = document.createElement("canvas"); sub.width = Math.max(1, Math.round(Math.abs(n.w) * k)); sub.height = Math.max(1, Math.round(Math.abs(n.h) * k));
    drawAlone(sub.getContext("2d"), nodes, slides[i], k);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(sub, Math.round(t.e), Math.round(t.f)); ctx.restore();
    pn.textContent = `${i + 1} / ${slides.length}`;
  };
  const go = (d) => { const j = Math.max(0, Math.min(slides.length - 1, i + d)); if (j !== i) { i = j; draw(); } };
  const close = () => { removeEventListener("keydown", key, true); removeEventListener("resize", draw); if (document.fullscreenElement === el) document.exitFullscreen().catch(() => {}); el.remove(); onClose && onClose(); };
  const key = (e) => {
    if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) { e.preventDefault(); e.stopPropagation(); go(1); }
    else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) { e.preventDefault(); e.stopPropagation(); go(-1); }
    else if (e.key === "Home") { e.preventDefault(); i = 0; draw(); } else if (e.key === "End") { e.preventDefault(); i = slides.length - 1; draw(); }
    else if (e.key === "Escape" && onClose) { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "f" || e.key === "F") { e.preventDefault(); full(); }
  };
  const full = () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else el.requestFullscreen?.().catch(() => {}); };
  el.addEventListener("click", (e) => { const b = e.target.closest("[data-p]"); if (b) { const p = b.dataset.p; if (p === "prev") go(-1); else if (p === "next") go(1); else if (p === "full") full(); else if (p === "x") close(); return; } go(e.clientX < innerWidth / 3 ? -1 : 1); });
  let sx = null; el.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; }, { passive: true }); el.addEventListener("touchend", (e) => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); sx = null; });
  el.addEventListener("mousemove", () => { el.classList.add("ui"); clearTimeout(hideT); hideT = setTimeout(() => el.classList.remove("ui"), 2200); });
  addEventListener("keydown", key, true); addEventListener("resize", draw);
  ready(nodes).then(() => { el.querySelector(".dz-pload").remove(); draw(); });
  draw(); el.focus();
  return { close, el };
}
