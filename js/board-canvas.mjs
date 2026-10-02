// The Boards canvas: an infinite, zoomable surface with pages, sticky notes, text, pictures, links, sections and connectors.
// Built for speed: the whole board moves as one GPU layer, only what is on screen is drawn, pictures switch between a small
// and a full copy by zoom, and every pointer move is batched into one animation frame.
import { h, esc, toast, mobile, Up, lightbox } from "/js/lib.mjs";
import { icon, ICONS } from "/shared/icons.mjs";
import { coverCss, COLORS, STICKY, LINE } from "/js/board-covers.mjs";

/* ---------- icons this app needs beyond the shared set (same 24px grid, same stroke) ---------- */
const EXTRA = {
  cursor: '<path d="M5.5 3.5 18 11l-5.6 1.4-2.6 5.6z"/>',
  hand: '<path d="M8 12.5V6a1.5 1.5 0 0 1 3 0v5.5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-.6a6 6 0 0 1-4.7-2.3L3.4 15a1.6 1.6 0 0 1 2.5-2l2.1 2"/>',
  sticky: '<path d="M5 4h14a1 1 0 0 1 1 1v9.5L14.5 20H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M14 20v-5a1 1 0 0 1 1-1h5"/>',
  connector: '<circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="6" r="2.4"/><path d="M8.2 16.6C14 15 10 9 15.8 7.4"/>',
  frame: '<path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/>',
  type: '<path d="M5 7V4.5h14V7M12 4.5v15M9 19.5h6"/>',
  "zoom-in": '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5M8 11h6M11 8v6"/>',
  "zoom-out": '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5M8 11h6"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  front: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M15 9V5.5A1.5 1.5 0 0 0 13.5 4h-8A1.5 1.5 0 0 0 4 5.5v8A1.5 1.5 0 0 0 5.5 15H9"/>',
  back: '<rect x="4" y="4" width="11" height="11" rx="2.5"/><path d="M15 9h3.5A1.5 1.5 0 0 1 20 10.5v8a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 9 18.5V15"/>',
  "al-left": '<path d="M4 4v16M8 7h11M8 12h6M8 17h9"/>',
  "al-center": '<path d="M12 4v16M6 7h12M9 12h6M7 17h10"/>',
  "al-right": '<path d="M20 4v16M5 7h11M10 12h6M7 17h9"/>',
  "al-top": '<path d="M4 4h16M7 8v11M12 8v6M17 8v9"/>',
  "al-middle": '<path d="M4 12h16M7 6v12M12 9v6M17 7v10"/>',
  "al-bottom": '<path d="M4 20h16M7 5v11M12 10v6M17 7v9"/>',
  "dist-h": '<path d="M4 4v16M20 4v16M10 8h4v8h-4z"/>',
  "dist-v": '<path d="M4 4h16M4 20h16M8 10h8v4H8z"/>',
  bold: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',
  open: '<path d="M14 4h6v6M20 4l-8 8M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
  curve: '<path d="M4 19C10 19 8 5 20 5"/>',
  straight: '<path d="M4 19 20 5"/>',
  elbow: '<path d="M4 19h8V5h8"/>',
  arrow1: '<path d="M4 12h15M14 7l5 5-5 5"/>',
  arrow2: '<path d="M5 12h14M10 7l-5 5 5 5M14 7l5 5-5 5"/>',
  arrow0: '<path d="M4 12h16"/>',
  dash: '<path d="M3 12h4M10 12h4M17 12h4"/>',
  tidy: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="4" rx="1.5"/><rect x="13" y="10" width="7" height="10" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/>',
  dup: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  section: '<rect x="3.5" y="6.5" width="17" height="13" rx="2.5"/><path d="M3.5 4h7"/>',
  page: '<rect x="4" y="3.5" width="16" height="17" rx="3"/><path d="M4 9h16M8 13h8M8 16.5h5"/>',
  ungroup: '<rect x="3.5" y="6.5" width="17" height="13" rx="2.5" stroke-dasharray="3 3"/><path d="M3.5 4h7"/>',
};
export const I = (n, s = 18) => (EXTRA[n] ? `<svg class="ic" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${EXTRA[n]}</svg>` : icon(n, { size: s }));

const rid = () => Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8);
const clone = (o) => (o == null ? null : JSON.parse(JSON.stringify(o)));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MINZ = 0.05, MAXZ = 4;
const TXT = { s: 14, m: 18, l: 30, xl: 46 };
const STK = { s: 15, m: 20, l: 28 };
const isEditable = (t) => !!(t && t.closest && t.closest('input,textarea,select,[contenteditable="true"],[contenteditable="plaintext-only"]'));
const plainOnly = (() => { try { const d = document.createElement("div"); d.contentEditable = "plaintext-only"; return d.contentEditable === "plaintext-only"; } catch { return false; } })();
const ago = (ts) => { if (!ts) return ""; const s = (Date.now() - ts) / 1000; if (s < 60) return "just now"; if (s < 3600) return Math.round(s / 60) + " min ago"; if (s < 86400) return Math.round(s / 3600) + " h ago"; if (s < 86400 * 7) return Math.round(s / 86400) + " d ago"; return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" }); };
const ytThumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const isUrl = (s) => /^https?:\/\/[^\s]+$/i.test(String(s || "").trim());
const isImgUrl = (s) => isUrl(s) && /\.(jpe?g|png|webp|gif|avif)(\?.*)?$/i.test(s.trim());

/* ---------- one colour sheet, made from the palette, for light and dark ---------- */
(function colourSheet() {
  if (document.getElementById("bd-colours")) return;
  const rule = (dark) => Object.entries(COLORS).map(([k, c]) => `.bdc [data-c="${k}"]{--f:${dark ? c.dark : c.fill};--k:${c.ink}}`).join("");
  const s = document.createElement("style"); s.id = "bd-colours";
  const scoped = (pre) => rule(true).replace(/(^|})\.bdc/g, `$1${pre} .bdc`);
  s.textContent = rule(false) + `@media (prefers-color-scheme:dark){${scoped(':root:not([data-theme="light"])')}}` + scoped(':root[data-theme="dark"]');
  document.head.append(s);
})();

/* ---------- menus: one Material menu for every right-click and "more" button ---------- */
let openMenu = null;
export function closeMenu() { if (openMenu) { openMenu.remove(); openMenu = null; } }
export function menu(x, y, items, { minW, ret } = {}) {
  closeMenu();
  const build = (list, sub) => {
    const m = h("div", { class: "bd-menu" + (sub ? " sub" : ""), role: "menu" });
    if (minW) m.style.minWidth = minW + "px";
    for (const it of list) {
      if (!it) continue;
      if (it === "-") { m.append(h("hr")); continue; }
      if (it.head) { m.append(h("div", { class: "bd-mh" }, it.head)); continue; }
      if (it.swatches) {
        const row = h("div", { class: "bd-sw" });
        for (const s of it.swatches) row.append(h("button", { class: "bd-swb" + (s.on ? " on" : ""), "data-c": s.c, title: s.name || s.c, "aria-label": s.name || s.c, onclick: () => { closeMenu(); s.run(); } }, h("i")));
        m.append(row); continue;
      }
      if (it.tiles) {
        const row = h("div", { class: "bd-tiles" });
        for (const c of it.tiles) row.append(h("button", { class: "bd-tile" + (c.on ? " on" : ""), title: c.name, "aria-label": c.name, style: `background:${c.bg}`, onclick: () => { closeMenu(); c.run(); } }));
        m.append(row); continue;
      }
      if (it.chips) {
        const row = h("div", { class: "bd-chips" });
        for (const c of it.chips) row.append(h("button", { class: "bd-chip" + (c.on ? " on" : ""), title: c.title || "", "aria-label": c.title || c.t, onclick: () => { closeMenu(); c.run(); }, html: c.i ? I(c.i, 17) + (c.t ? `<span>${esc(c.t)}</span>` : "") : esc(c.t) }));
        m.append(row); continue;
      }
      const b = h("button", { role: "menuitem", class: (it.danger ? "danger " : "") + (it.sub ? "has-sub" : ""), disabled: it.disabled || false },
        h("span", { class: "ic", html: it.i ? I(it.i, 18) : "" }), h("span", { class: "t" }, it.t), it.k ? h("kbd", {}, it.k) : "", it.sub ? h("span", { class: "chev", html: I("chevron-right", 15) }) : "");
      if (it.sub) {
        let sm = null;
        const show = () => { $$sub(m); sm = build(it.sub, true); document.body.append(sm); const r = b.getBoundingClientRect(); place(sm, r.right - 4, r.top - 6, r.left + 4); m.__sub = sm; };
        b.addEventListener("pointerenter", show); b.addEventListener("click", (e) => { e.stopPropagation(); show(); });
      } else {
        b.addEventListener("pointerenter", () => $$sub(m));
        b.onclick = () => { closeMenu(); it.run && it.run(); };
      }
      m.append(b);
    }
    return m;
  };
  const $$sub = (m) => { if (m.__sub) { m.__sub.remove(); m.__sub = null; } };
  const place = (m, px, py, altX) => {
    const w = m.offsetWidth, hh = m.offsetHeight;
    let left = px, top = py;
    if (left + w > innerWidth - 8) left = altX != null ? altX - w : innerWidth - w - 8;
    if (top + hh > innerHeight - 8) top = Math.max(8, innerHeight - hh - 8);
    m.style.left = Math.max(8, left) + "px"; m.style.top = Math.max(8, top) + "px";
  };
  const root = build(items);
  const wrap = h("div", { class: "bd-menus bdc" }); wrap.append(root);
  document.body.append(wrap); place(root, x, y);
  const origRemove = wrap.remove.bind(wrap);
  wrap.remove = () => { const back = ret && (wrap.contains(document.activeElement) || document.activeElement === document.body || (root.__sub && root.__sub.contains(document.activeElement))); if (root.__sub) root.__sub.remove(); origRemove(); if (back) ret.focus({ preventScroll: true }); document.removeEventListener("pointerdown", off, true); document.removeEventListener("keydown", key, true); window.removeEventListener("blur", closeMenu); };
  const off = (e) => { if (!e.target.closest(".bd-menu")) closeMenu(); };
  const key = (e) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); closeMenu(); } };
  setTimeout(() => { document.addEventListener("pointerdown", off, true); document.addEventListener("keydown", key, true); window.addEventListener("blur", closeMenu); }, 0);
  openMenu = wrap;
  root.querySelector("button:not([disabled])")?.focus({ preventScroll: true });
  return wrap;
}

/* =====================================================================================================================
   The canvas
   ===================================================================================================================== */
export function createCanvas(host, opts = {}) {
  const owner = !!opts.owner && !mobile();
  const S = { items: new Map(), links: new Map(), sel: new Set(), lsel: null, view: { x: 0, y: 0, z: 1 }, tool: "select", editing: null, els: new Map(), lels: new Map(), hover: null, space: false, drag: null, last: null, color: "yellow", dead: false };
  const hist = { undo: [], redo: [], cur: null };
  const M = (x, y, items) => menu(x, y, items, { ret: stage });

  host.classList.add("bd", "bdc");
  host.innerHTML = `<div class="bd-stage${owner ? " own" : ""}" tabindex="0" aria-label="Board canvas"><div class="bd-grid"></div>
      <div class="bd-world"><div class="bd-frames"></div><svg class="bd-links" width="1" height="1" overflow="visible"><g class="bd-lg"></g><path class="bd-ghost" d=""/></svg><div class="bd-items"></div><div class="bd-labels"></div></div>
      <div class="bd-ov"><svg class="bd-guides" width="100%" height="100%"></svg><div class="bd-marq" hidden></div><div class="bd-selbox" hidden></div><div class="bd-anchors"></div><div class="bd-qbar" hidden></div></div>
      <div class="bd-empty" hidden></div>
    </div>
    ${owner ? `<div class="bd-tools" role="toolbar" aria-label="Tools">
      ${tb("select", "cursor", "Select", "V")}${tb("hand", "hand", "Move around", "H")}<i class="bd-tsep"></i>
      ${tb("page", "page", "Page", "P")}${tb("sticky", "sticky", "Sticky note", "S")}${tb("text", "type", "Text", "T")}${tb("image", "image", "Picture", "I")}${tb("link", "link", "Link", "L")}${tb("frame", "frame", "Section", "F")}${tb("connector", "connector", "Connector", "C")}
    </div>` : ""}
    <div class="bd-zoom" role="group" aria-label="Zoom">
      <button data-z="out" title="Zoom out (Ctrl -)" aria-label="Zoom out">${I("minus", 18)}</button><button data-z="pct" class="bd-pct" title="Zoom options">100%</button><button data-z="in" title="Zoom in (Ctrl +)" aria-label="Zoom in">${I("plus", 18)}</button><i class="bd-tsep"></i><button data-z="fit" title="Show everything (Shift 1)" aria-label="Show everything">${I("fit", 18)}</button>
    </div>`;
  function tb(t, ic, label, k) { return `<button class="bd-tb" data-tool="${t}"${t === "sticky" ? ' data-c="yellow"' : ""} title="${label} (${k})" aria-label="${label}" aria-pressed="${t === "select"}">${I(ic, 20)}</button>`; }

  const stage = host.querySelector(".bd-stage"), world = host.querySelector(".bd-world"), framesL = host.querySelector(".bd-frames"), itemsL = host.querySelector(".bd-items"), labelsL = host.querySelector(".bd-labels");
  const linkG = host.querySelector(".bd-lg"), ghost = host.querySelector(".bd-ghost"), guides = host.querySelector(".bd-guides"), marq = host.querySelector(".bd-marq"), selbox = host.querySelector(".bd-selbox"), anchors = host.querySelector(".bd-anchors"), qbar = host.querySelector(".bd-qbar"), emptyEl = host.querySelector(".bd-empty");
  const pct = host.querySelector(".bd-pct"), grid = host.querySelector(".bd-grid");
  let R = stage.getBoundingClientRect();
  const rect = () => (R = stage.getBoundingClientRect());
  const ro = new ResizeObserver(() => { rect(); schedule("view"); }); ro.observe(stage);

  /* ---------- coordinates ---------- */
  const toW = (cx, cy) => ({ x: (cx - R.left - S.view.x) / S.view.z, y: (cy - R.top - S.view.y) / S.view.z });
  const toS = (wx, wy) => ({ x: wx * S.view.z + S.view.x, y: wy * S.view.z + S.view.y });
  const center = () => toW(R.left + R.width / 2, R.top + R.height / 2);
  const bbox = (ids) => { let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity; for (const id of ids) { const it = S.items.get(id); if (!it) continue; l = Math.min(l, it.x); t = Math.min(t, it.y); r = Math.max(r, it.x + it.w); b = Math.max(b, it.y + it.h); } return l === Infinity ? null : { x: l, y: t, w: r - l, h: b - t }; };
  const inside = (a, b) => a.x >= b.x - 0.5 && a.y >= b.y - 0.5 && a.x + a.w <= b.x + b.w + 0.5 && a.y + a.h <= b.y + b.h + 0.5;
  const hits = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const topZ = () => { let z = 0; for (const it of S.items.values()) if (it.z > z) z = it.z; return z; };
  const lowZ = () => { let z = 0; for (const it of S.items.values()) if (it.z < z) z = it.z; return z; };

  /* ---------- one animation frame for everything ---------- */
  let raf = 0; const need = { view: false, ov: false, links: new Set() };
  function schedule(k, id) { if (k === "link") need.links.add(id); else need[k] = true; if (!raf) raf = requestAnimationFrame(frame); }
  function frame() {
    raf = 0;
    if (need.view) { need.view = false; applyView(); need.ov = true; }
    if (need.links.size) { for (const id of need.links) { const l = S.links.get(id); if (l) paintLink(l); } need.links.clear(); }
    if (need.ov) { need.ov = false; drawOverlay(); }
  }
  let idleT = 0;
  let isMoving = false, lastIz = 0, lastGs = 0, lastPct = "";
  function moving() { if (!isMoving) { isMoving = true; stage.classList.add("moving"); } clearTimeout(idleT); idleT = setTimeout(() => { isMoving = false; stage.classList.remove("moving"); setIz(); sharpen(); }, 180); }
  // the inverse zoom (for lines and labels that keep their size on screen) changes every item's style, so it is set once the board settles
  function setIz() { const iz = +(1 / S.view.z).toFixed(4); if (iz !== lastIz) { lastIz = iz; world.style.setProperty("--iz", iz); } }
  function applyView() {
    const v = S.view;
    world.style.transform = `translate3d(${v.x}px,${v.y}px,0) scale(${v.z})`;
    if (!isMoving) setIz();
    // the dot grid is its own layer: panning only slides it, zooming resizes the dots
    const g = v.z < 0.25 ? 96 : v.z < 0.6 ? 48 : 24, gs = Math.max(1, g * v.z);
    if (Math.abs(gs - lastGs) > 0.01) { lastGs = gs; grid.style.backgroundSize = `${gs}px ${gs}px`; grid.hidden = gs < 7; }
    const md = (a) => ((a % gs) + gs) % gs;
    grid.style.transform = `translate3d(${md(v.x + 100)}px,${md(v.y + 100)}px,0)`;
    stage.classList.toggle("far", v.z < 0.34);
    const pt = Math.round(v.z * 100) + "%"; if (pt !== lastPct) { lastPct = pt; pct.textContent = pt; }
    cull();
    opts.onView && opts.onView(v);
  }
  // only what is (nearly) on screen is drawn
  function cull() {
    const m = 0.6, v = S.view, w = R.width / v.z, hh = R.height / v.z;
    const vis = { x: -v.x / v.z - w * m, y: -v.y / v.z - hh * m, w: w * (1 + 2 * m), h: hh * (1 + 2 * m) };
    for (const [id, el] of S.els) { const it = S.items.get(id); if (!it) continue; const off = !hits(it, vis) && !S.sel.has(id); if (el.__off !== off) { el.__off = off; el.classList.toggle("off", off); } }
  }
  // after a zoom settles: pictures get the copy that matches their size on screen
  function sharpen() {
    const dpr = devicePixelRatio || 1;
    for (const [id, el] of S.els) {
      const it = S.items.get(id); if (!it || el.__off || it.t !== "image" || !it.thumb || it.thumb === it.src) continue;
      const want = it.w * S.view.z * dpr > 680 ? it.src : it.thumb, img = el.querySelector("img");
      if (img && img.getAttribute("src") !== want) { const pre = new Image(); pre.onload = () => { if (img.isConnected) img.src = want; }; pre.src = want; }
    }
  }

  /* ---------- painting items ---------- */
  const autoH = (it) => it.t === "text" || it.t === "link";
  function inner(it) {
    switch (it.t) {
      case "page": {
        const cv = coverCss(it.cover), img = it.cover && it.cover.src;
        const ic = it.icon && ICONS[it.icon] ? it.icon : "file-text";
        return `<div class="bd-pg${cv || img ? " has-cv" : ""}">${cv ? `<div class="bd-pgc" style="background:${cv}"></div>` : img ? `<div class="bd-pgc"><img src="${esc(img)}" alt="" draggable="false" style="object-position:50% ${it.cover.fy ?? 50}%" loading="lazy" decoding="async"></div>` : ""}
          <div class="bd-pgb"><span class="bd-pgi">${I(ic, 20)}</span><b class="bd-pgt">${esc(it.title || "Untitled")}</b>${it.snip ? `<p class="bd-pgs">${esc(it.snip)}</p>` : `<p class="bd-pgs muted">${owner ? "Double-click to write" : "Empty page"}</p>`}
          <small class="bd-pgm">${it.words ? `${it.words} word${it.words === 1 ? "" : "s"}` : "Page"}${it.edited ? " · " + ago(it.edited) : ""}</small></div></div>`;
      }
      case "sticky": return `<div class="bd-tx" data-ph="Type something">${esc(it.text || "")}</div>`;
      case "text": return `<div class="bd-tx" data-ph="Type something" style="font-size:${TXT[it.size || "m"]}px;${it.bold || it.size === "l" || it.size === "xl" ? "font-weight:700;" : ""}text-align:${it.align || "left"}">${esc(it.text || "")}</div>`;
      case "image": return `<img src="${esc(it.thumb || it.src)}" alt="${esc(it.name || "")}" draggable="false" decoding="async">${it._up ? '<span class="bd-upl"><span class="rb-spin"></span></span>' : ""}${it.cap ? `<span class="bd-cap">${esc(it.cap)}</span>` : ""}`;
      case "link": {
        const img = it.yt ? ytThumb(it.yt) : it.img;
        return `<div class="bd-ln${img ? " has-img" : ""}">${img ? `<div class="bd-lni"><img src="${esc(img)}" alt="" draggable="false" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.parentNode.remove()">${it.yt ? `<span class="bd-play">${I("play", 22)}</span>` : ""}</div>` : ""}
          <div class="bd-lnb"><b>${esc(it.title || it.url.replace(/^https?:\/\/(www\.)?/, ""))}</b>${it.desc ? `<p>${esc(it.desc)}</p>` : ""}<small>${it.fav ? `<img src="${esc(it.fav)}" alt="" width="14" height="14" referrerpolicy="no-referrer" onerror="this.remove()">` : I("globe", 13)}<span>${esc(it.site || "")}</span>${it._busy ? '<span class="rb-spin sm"></span>' : ""}</small></div></div>`;
      }
      case "frame": return `<div class="bd-frt"><span>${esc(it.title || "Section")}</span></div>`;
    }
    return "";
  }
  function place(el, it) {
    el.style.transform = `translate(${it.x}px,${it.y}px)`;
    el.style.width = it.w + "px";
    el.style.height = autoH(it) ? "" : it.h + "px";
    el.style.zIndex = String(Math.round(it.z || 0));
  }
  function paint(it) {
    let el = S.els.get(it.id);
    const layer = it.t === "frame" ? framesL : itemsL;
    if (!el || el.parentNode !== layer) { if (el) el.remove(); el = h("div", { class: "bd-it" }); el.dataset.id = it.id; S.els.set(it.id, el); layer.append(el); }
    el.dataset.t = it.t;
    if (it.color) el.dataset.c = it.color; else delete el.dataset.c;
    if (it.t === "sticky") el.dataset.s = it.size || "m";
    el.classList.toggle("locked", !!it.locked); el.classList.toggle("bd-sel", S.sel.has(it.id));
    if (S.editing !== it.id) el.innerHTML = inner(it);
    place(el, it);
    if (it.t === "sticky") fitSticky(el, it);
    if (autoH(it)) measure(it);
    return el;
  }
  function unpaint(id) { const el = S.els.get(id); if (el) el.remove(); S.els.delete(id); }
  // sticky notes shrink their text to fit, like paper notes
  function fitSticky(el, it) {
    const tx = el.querySelector(".bd-tx"); if (!tx) return;
    let fs = STK[it.size || "m"];
    const len = (it.text || "").length, room = (it.w - 32) * (it.h - 32);
    tx.style.fontSize = fs + "px";
    if (len * fs * fs * 0.62 < room * 0.55 && (it.text || "").split("\n").length * fs * 1.4 < it.h - 40) return;
    while (fs > 9 && (tx.scrollHeight > it.h - 30 || tx.scrollWidth > it.w - 30)) { fs -= fs > 18 ? 2 : 1; tx.style.fontSize = fs + "px"; }
  }
  const mq = new Set(); let mqRaf = 0;
  function measure(it) { mq.add(it.id); if (!mqRaf) mqRaf = requestAnimationFrame(runMeasure); }
  function runMeasure() {
    mqRaf = 0; const changed = [];
    for (const id of mq) { const el = S.els.get(id), it = S.items.get(id); if (!el || !it || el.__off) continue; const hh = el.offsetHeight; if (hh && Math.abs(hh - it.h) > 1) { it.h = hh; changed.push(id); } }
    mq.clear();
    for (const id of changed) { linksOf(id).forEach((l) => schedule("link", l.id)); if (!S.drag) mark(id); }
    if (changed.length) schedule("ov");
  }

  /* ---------- connectors ---------- */
  const N = { t: [0, -1], b: [0, 1], l: [-1, 0], r: [1, 0] };
  const sidePt = (it, s) => s === "t" ? [it.x + it.w / 2, it.y] : s === "b" ? [it.x + it.w / 2, it.y + it.h] : s === "l" ? [it.x, it.y + it.h / 2] : [it.x + it.w, it.y + it.h / 2];
  function autoSide(A, B) {
    const dx = (B.x + B.w / 2) - (A.x + A.w / 2), dy = (B.y + B.h / 2) - (A.y + A.h / 2);
    if (Math.abs(dx) / (A.w + B.w) >= Math.abs(dy) / (A.h + B.h)) return dx >= 0 ? ["r", "l"] : ["l", "r"];
    return dy >= 0 ? ["b", "t"] : ["t", "b"];
  }
  function geom(A, B, as, bs, style) {
    const [aa, bb] = autoSide(A, B);
    const sa = as && as !== "auto" ? as : aa, sb = bs && bs !== "auto" ? bs : bb;
    const na = N[sa], nb = N[sb];
    let [x0, y0] = sidePt(A, sa), [x3, y3] = sidePt(B, sb);
    x0 += na[0] * 4; y0 += na[1] * 4; x3 += nb[0] * 7; y3 += nb[1] * 7;
    let d, mid, dir;
    if (style === "straight") { d = `M${x0} ${y0}L${x3} ${y3}`; mid = [(x0 + x3) / 2, (y0 + y3) / 2]; dir = [x3 - x0, y3 - y0]; }
    else if (style === "elbow") {
      const hz = na[0] !== 0; let pts;
      if (hz && nb[0] !== 0) { const mx = (x0 + x3) / 2; pts = [[x0, y0], [mx, y0], [mx, y3], [x3, y3]]; }
      else if (!hz && nb[1] !== 0) { const my = (y0 + y3) / 2; pts = [[x0, y0], [x0, my], [x3, my], [x3, y3]]; }
      else if (hz) pts = [[x0, y0], [x3, y0], [x3, y3]]; else pts = [[x0, y0], [x0, y3], [x3, y3]];
      d = "M" + pts.map((p) => p.join(" ")).join("L");
      const i = Math.floor((pts.length - 1) / 2); mid = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2];
      const a = pts[pts.length - 2], b = pts[pts.length - 1]; dir = [b[0] - a[0], b[1] - a[1]];
    } else {
      const k = clamp(Math.hypot(x3 - x0, y3 - y0) * 0.42, 28, 260);
      const c1 = [x0 + na[0] * k, y0 + na[1] * k], c2 = [x3 + nb[0] * k, y3 + nb[1] * k];
      d = `M${x0} ${y0}C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${x3} ${y3}`;
      mid = [(x0 + 3 * c1[0] + 3 * c2[0] + x3) / 8, (y0 + 3 * c1[1] + 3 * c2[1] + y3) / 8];
      dir = [-nb[0], -nb[1]];
    }
    return { d, mid, end: [x3, y3], start: [x0, y0], dir, sdir: style === "straight" ? [x0 - x3, y0 - y3] : style === "elbow" ? null : [-na[0], -na[1]], na };
  }
  const head = (p, dir, w) => { const L = Math.hypot(dir[0], dir[1]) || 1, ux = dir[0] / L, uy = dir[1] / L, s = 7 + w * 2.2, b = s * 0.62; const bx = p[0] - ux * s, by = p[1] - uy * s; return `M${p[0] + ux * 2} ${p[1] + uy * 2}L${bx - uy * b} ${by + ux * b}L${bx + uy * b} ${by - ux * b}Z`; };
  const linksOf = (id) => [...S.links.values()].filter((l) => l.a === id || l.b === id);
  function paintLink(l) {
    const A = S.items.get(l.a), B = S.items.get(l.b);
    let g = S.lels.get(l.id);
    if (!A || !B) { if (g) { g.remove(); g.__lb && g.__lb.remove(); S.lels.delete(l.id); } return; }
    if (!g) {
      g = document.createElementNS("http://www.w3.org/2000/svg", "g"); g.setAttribute("class", "bd-l"); g.dataset.lid = l.id;
      g.innerHTML = '<path class="bd-lh"/><path class="bd-ll"/><path class="bd-la"/><path class="bd-la2"/>'; linkG.append(g); S.lels.set(l.id, g);
    }
    const G = geom(A, B, l.as, l.bs, l.style), w = l.w || 2, col = (COLORS[l.color] || COLORS.grey).ink;
    const [hit, line, ah, ah2] = g.children;
    hit.setAttribute("d", G.d); line.setAttribute("d", G.d);
    g.style.setProperty("--lc", col); g.style.setProperty("--lw", w);
    g.classList.toggle("dash", !!l.dash); g.classList.toggle("bd-sel", S.lsel === l.id);
    ah.setAttribute("d", l.ends !== "none" ? head(G.end, G.dir, w) : "");
    ah2.setAttribute("d", l.ends === "both" && G.sdir ? head(G.start, G.sdir, w) : l.ends === "both" && !G.sdir ? head(G.start, [-G.na[0], -G.na[1]], w) : "");
    let lb = g.__lb;
    if (l.label || S.editingLink === l.id) {
      if (!lb) { lb = h("div", { class: "bd-lb" }); lb.dataset.lid = l.id; labelsL.append(lb); g.__lb = lb; }
      if (S.editingLink !== l.id) lb.textContent = l.label || "";
      lb.style.transform = `translate(${G.mid[0]}px,${G.mid[1]}px) translate(-50%,-50%)`; lb.style.setProperty("--lc", col);
      lb.classList.toggle("bd-sel", S.lsel === l.id);
    } else if (lb) { lb.remove(); g.__lb = null; }
  }

  /* ---------- history (undo / redo) and saving ---------- */
  function begin() { if (!hist.cur) hist.cur = { i: new Map(), l: new Map() }; }
  function touchI(id) { if (hist.cur && !hist.cur.i.has(id)) hist.cur.i.set(id, clone(S.items.get(id) || null)); }
  function touchL(id) { if (hist.cur && !hist.cur.l.has(id)) hist.cur.l.set(id, clone(S.links.get(id) || null)); }
  function commit() {
    const c = hist.cur; hist.cur = null; if (!c) return;
    const e = { i: [], l: [] };
    for (const [id, before] of c.i) { const after = clone(S.items.get(id) || null); if (JSON.stringify(before) !== JSON.stringify(after)) e.i.push([id, before, after]); }
    for (const [id, before] of c.l) { const after = clone(S.links.get(id) || null); if (JSON.stringify(before) !== JSON.stringify(after)) e.l.push([id, before, after]); }
    if (e.i.length || e.l.length) { hist.undo.push(e); if (hist.undo.length > 300) hist.undo.shift(); hist.redo.length = 0; }
  }
  function replay(e, back) {
    for (const [id, b, a] of e.i) { const v = back ? b : a; if (v) { S.items.set(id, clone(v)); paint(S.items.get(id)); mark(id); } else { S.items.delete(id); unpaint(id); S.sel.delete(id); mark(id, true); } }
    for (const [id, b, a] of e.l) { const v = back ? b : a; if (v) { S.links.set(id, clone(v)); markL(id); } else { S.links.delete(id); markL(id, true); } paintLink(v || { id, a: "", b: "" }); }
    for (const [id] of e.i) linksOf(id).forEach((l) => paintLink(l));
    refreshEmpty(); selChanged();
  }
  function undo() { finishEdit(); const e = hist.undo.pop(); if (!e) return; replay(e, true); hist.redo.push(e); }
  function redo() { finishEdit(); const e = hist.redo.pop(); if (!e) return; replay(e, false); hist.undo.push(e); }

  const Q = { up: new Set(), del: new Set(), lup: new Set(), ldel: new Set(), t: 0, busy: false, again: false, fails: 0, prevT: 0 };
  function mark(id, gone) { if (gone) { Q.up.delete(id); Q.del.add(id); } else { Q.del.delete(id); Q.up.add(id); } queue(); }
  function markL(id, gone) { if (gone) { Q.lup.delete(id); Q.ldel.add(id); } else { Q.ldel.delete(id); Q.lup.add(id); } queue(); }
  function queue() { if (!owner) return; status("unsaved"); clearTimeout(Q.t); Q.t = setTimeout(flush, 650); persistSoon(); }
  let pT = 0; function persistSoon() { clearTimeout(pT); pT = setTimeout(persist, 250); }
  function pending() {
    return { up: [...Q.up].map((id) => S.items.get(id)).filter((it) => it && !it._up), del: [...Q.del], lup: [...Q.lup].map((id) => S.links.get(id)).filter(Boolean), ldel: [...Q.ldel] };
  }
  function persist() { if (opts.persist) opts.persist(Q.up.size || Q.del.size || Q.lup.size || Q.ldel.size ? pending() : null); }
  function preview() {
    const list = [...S.items.values()].filter((x) => !x._up); if (!list.length) return [];
    const b = bbox(list.map((x) => x.id)), s = 1000 / Math.max(b.w, b.h, 1);
    return list.sort((a, c) => (a.t === "frame" ? -1 : 0) - (c.t === "frame" ? -1 : 0) || c.w * c.h - a.w * a.h).slice(0, 90)
      .map((it) => [Math.round((it.x - b.x) * s), Math.round((it.y - b.y) * s), Math.max(4, Math.round(it.w * s)), Math.max(4, Math.round(it.h * s)), it.t === "sticky" ? it.color || "yellow" : it.t === "frame" ? "frame" : it.t === "image" ? "image" : it.t === "page" ? "page" : it.t === "link" ? "link" : "text"]);
  }
  async function flush() {
    clearTimeout(Q.t);
    if (!owner || !opts.send) return true;
    if (Q.busy) { Q.again = true; return false; }
    const p = pending(); if (!p.up.length && !p.del.length && !p.lup.length && !p.ldel.length) { if (!Q.up.size) status("saved"); return true; }
    const sent = { up: p.up.map((x) => x.id), del: p.del, lup: p.lup.map((x) => x.id), ldel: p.ldel };
    sent.up.forEach((id) => Q.up.delete(id)); sent.del.forEach((id) => Q.del.delete(id)); sent.lup.forEach((id) => Q.lup.delete(id)); sent.ldel.forEach((id) => Q.ldel.delete(id));
    if (Date.now() - Q.prevT > 8000) { p.meta = { preview: preview() }; Q.prevT = Date.now(); }
    Q.busy = true; status("saving");
    let ok = false; try { ok = await opts.send(clone(p)); } catch { ok = false; }
    Q.busy = false;
    if (!ok) { // put them back (newer edits to the same items stay newer) and try again soon
      sent.up.forEach((id) => { if (!Q.del.has(id)) Q.up.add(id); }); sent.del.forEach((id) => { if (!S.items.has(id)) Q.del.add(id); });
      sent.lup.forEach((id) => { if (!Q.ldel.has(id)) Q.lup.add(id); }); sent.ldel.forEach((id) => { if (!S.links.has(id)) Q.ldel.add(id); });
      Q.fails++; status("offline"); persist(); clearTimeout(Q.t); Q.t = setTimeout(flush, Math.min(20000, 1500 * 2 ** Math.min(Q.fails, 4))); return false;
    }
    Q.fails = 0; persist();
    if (Q.again || Q.up.size || Q.del.size || Q.lup.size || Q.ldel.size) { Q.again = false; clearTimeout(Q.t); Q.t = setTimeout(flush, 120); } else status("saved");
    return true;
  }
  function status(s) { opts.onStatus && opts.onStatus(s); }

  /* ---------- changing things (always through these, so undo and saving just work) ---------- */
  function put(it) { begin(); touchI(it.id); S.items.set(it.id, it); paint(it); mark(it.id); linksOf(it.id).forEach((l) => schedule("link", l.id)); refreshEmpty(); return it; }
  function upd(id, patch) { const it = S.items.get(id); if (!it) return; begin(); touchI(id); Object.assign(it, patch); for (const k in patch) if (patch[k] === undefined) delete it[k]; paint(it); mark(id); linksOf(id).forEach((l) => schedule("link", l.id)); schedule("ov"); }
  function remove(ids) {
    begin();
    for (const id of ids) {
      const it = S.items.get(id); if (!it) continue;
      for (const l of linksOf(id)) { touchL(l.id); S.links.delete(l.id); markL(l.id, true); paintLink({ id: l.id, a: "", b: "" }); }
      touchI(id); S.items.delete(id); unpaint(id); S.sel.delete(id); mark(id, true);
    }
    refreshEmpty(); selChanged();
  }
  function putLink(l) { begin(); touchL(l.id); S.links.set(l.id, l); paintLink(l); markL(l.id); return l; }
  function updLink(id, patch) { const l = S.links.get(id); if (!l) return; begin(); touchL(id); Object.assign(l, patch); for (const k in patch) if (patch[k] === undefined) delete l[k]; paintLink(l); markL(id); }
  function removeLink(id) { if (!S.links.has(id)) return; begin(); touchL(id); S.links.delete(id); markL(id, true); paintLink({ id, a: "", b: "" }); if (S.lsel === id) S.lsel = null; selChanged(); }
  const done = () => { commit(); };

  /* ---------- making things ---------- */
  function make(t, at, extra = {}) {
    const base = { id: rid(), t, z: t === "frame" ? lowZ() - 1 : topZ() + 1 };
    const size = { page: [300, 200], sticky: [220, 220], text: [320, 40], image: [320, 240], link: [320, 120], frame: [640, 440] }[t];
    const it = Object.assign(base, { w: size[0], h: size[1] }, t === "sticky" ? { color: S.color, text: "" } : {}, t === "text" ? { text: "", size: "m" } : {}, t === "page" ? { title: "", icon: "", cover: null, snip: "", words: 0, edited: Date.now() } : {}, t === "frame" ? { title: "Section", color: "grey" } : {}, extra);
    it.x = Math.round((extra.x ?? at.x - it.w / 2)); it.y = Math.round((extra.y ?? at.y - it.h / 2));
    return it;
  }
  function create(t, at, extra) {
    const it = make(t, at, extra), edit = ((t === "sticky" || t === "text") && !(extra && extra.text)) || t === "frame";
    put(it); if (!edit) done(); // made and then named in one go is one step to undo
    select([it.id]);
    if (edit) startEdit(it.id, true);
    if (t === "page" && opts.openPage) setTimeout(() => opts.openPage(it, { fresh: true }), 60);
    return it;
  }
  async function addImages(files, at) {
    files = files.filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name));
    if (!files.length) return;
    let x = at.x, rowH = 0; const made = [];
    for (const f of files.slice(0, 30)) {
      const url = URL.createObjectURL(f);
      const dims = await new Promise((res) => { const im = new Image(); im.onload = () => res([im.naturalWidth, im.naturalHeight]); im.onerror = () => res([4, 3]); im.src = url; });
      const k = Math.min(1, 360 / Math.max(dims[0], dims[1])) || 1, w = Math.round(dims[0] * k), hh = Math.round(dims[1] * k);
      const it = make("image", at, { x: files.length > 1 ? x : at.x - w / 2, y: files.length > 1 ? at.y : at.y - hh / 2, w, h: hh, src: url, thumb: url, iw: dims[0], ih: dims[1], name: f.name, _up: true });
      x += w + 24; rowH = Math.max(rowH, hh);
      put(it); made.push([it, f]);
    }
    done(); select(made.map(([it]) => it.id));
    for (const [it, f] of made) {
      try {
        const r = await Up.image(f);
        const cur = S.items.get(it.id); if (!cur) continue;
        URL.revokeObjectURL(cur.src);
        Object.assign(cur, { src: r.url, thumb: r.thumb, iw: r.w, ih: r.h }); delete cur._up;
        for (const e of hist.undo) for (const rec of e.i) for (const v of [rec[1], rec[2]]) if (v && v.id === it.id) { v.src = r.url; v.thumb = r.thumb; delete v._up; } // undo keeps the stored copy, not the local preview
        paint(cur); mark(cur.id);
      } catch (e) {
        toast(e.message || "Could not upload the picture");
        const cur = S.items.get(it.id); if (cur) { S.items.delete(it.id); unpaint(it.id); S.sel.delete(it.id); Q.up.delete(it.id); selChanged(); }
      }
    }
  }
  async function addLink(url, at) {
    url = url.trim(); if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    if (isImgUrl(url)) { const it = make("image", at, { src: url, thumb: url, name: url.split("/").pop().split("?")[0] }); const im = new Image(); im.onload = () => { const k = Math.min(1, 360 / Math.max(im.naturalWidth, im.naturalHeight)); upd(it.id, { w: Math.round(im.naturalWidth * k), h: Math.round(im.naturalHeight * k), iw: im.naturalWidth, ih: im.naturalHeight }); done(); }; im.src = url; put(it); done(); select([it.id]); return; }
    let site = ""; try { site = new URL(url).hostname.replace(/^www\./, ""); } catch { toast("That doesn't look like a web address"); return; }
    const it = make("link", at, { url, title: "", site, _busy: true }); put(it); done(); select([it.id]);
    const meta = opts.unfurl ? await opts.unfurl(url) : null;
    const cur = S.items.get(it.id); if (!cur) return;
    delete cur._busy;
    if (meta) Object.assign(cur, { title: meta.title || "", desc: meta.desc || "", img: meta.img || "", site: meta.site || site, fav: meta.fav || "", ...(meta.yt ? { yt: meta.yt, w: Math.max(cur.w, 340) } : {}) });
    for (const e of hist.undo) for (const rec of e.i) if (rec[2] && rec[2].id === it.id) { Object.assign(rec[2], cur); delete rec[2]._busy; }
    paint(cur); mark(cur.id);
  }

  /* ---------- selection ---------- */
  function select(ids, add) {
    if (!add) { for (const id of S.sel) S.els.get(id)?.classList.remove("bd-sel"); S.sel.clear(); }
    for (const id of ids) if (S.items.has(id)) { S.sel.add(id); S.els.get(id)?.classList.add("bd-sel"); }
    if (ids.length || !add) { const was = S.lsel; S.lsel = null; if (was) { const l = S.links.get(was); l && paintLink(l); } }
    selChanged();
  }
  function selectLink(id) { select([]); S.lsel = id; const l = S.links.get(id); if (l) paintLink(l); selChanged(); }
  function clearSel() { select([]); }
  let qKey = "";
  function selChanged() { qKey = ""; schedule("ov"); opts.onSelect && opts.onSelect([...S.sel]); }
  const selItems = () => [...S.sel].map((id) => S.items.get(id)).filter(Boolean);

  /* ---------- the overlay: selection frame, handles, connector dots, guides and the quick bar ---------- */
  function drawOverlay() {
    const z = S.view.z, single = S.sel.size === 1 ? S.items.get([...S.sel][0]) : null;
    const b = S.sel.size ? bbox(S.sel) : null;
    const busy = S.drag && S.drag.kind !== "connect";
    if (b && !S.editing) {
      const p = toS(b.x, b.y);
      selbox.hidden = false;
      selbox.style.transform = `translate(${p.x}px,${p.y}px)`; selbox.style.width = b.w * z + "px"; selbox.style.height = b.h * z + "px";
      selbox.classList.toggle("multi", S.sel.size > 1);
      const canResize = owner && single && !single.locked && !busy;
      const hs = !canResize ? [] : autoH(single) ? ["w", "e"] : ["nw", "ne", "sw", "se"];
      const key = hs.join(",") + (single && single.locked ? "L" : "");
      if (selbox.__k !== key) { selbox.__k = key; selbox.innerHTML = hs.map((k) => `<i class="bd-hd" data-h="${k}"></i>`).join("") + (single && single.locked ? `<span class="bd-lock">${I("lock", 13)}</span>` : ""); }
    } else selbox.hidden = true;
    // connector dots on the item under the pointer
    const hv = owner && !busy && !S.editing && (S.tool === "select" || S.tool === "connector") && S.hover && S.items.get(S.hover);
    if (hv && !hv.locked && hv.t !== "frame") {
      const pts = ["t", "r", "b", "l"].map((s) => { const [x, y] = sidePt(hv, s), q = toS(x, y), n = N[s]; return `<i class="bd-anc" data-anc="${s}" data-for="${hv.id}" style="transform:translate(${q.x + n[0] * 16}px,${q.y + n[1] * 16}px)"></i>`; }).join("");
      if (anchors.__k !== pts) { anchors.__k = pts; anchors.innerHTML = pts; }
    } else if (anchors.__k) { anchors.__k = ""; anchors.innerHTML = ""; }
    // quick bar above the selection
    const showQ = owner && !busy && !S.editing && !S.drag && (b || S.lsel);
    if (showQ) {
      const k = [...S.sel].join(",") + "|" + (S.lsel || "") + "|" + JSON.stringify(selItems().map((x) => [x.color, x.size, x.bold, x.align, x.locked])) + JSON.stringify(S.lsel ? S.links.get(S.lsel) : "");
      if (k !== qKey) { qKey = k; buildQbar(); }
      let qb = b;
      if (!qb && S.lsel) { const l = S.links.get(S.lsel), A = l && S.items.get(l.a), B = l && S.items.get(l.b); if (A && B) { const G = geom(A, B, l.as, l.bs, l.style); qb = { x: G.mid[0], y: G.mid[1], w: 0, h: 0 }; } }
      if (qb && qbar.childElementCount) {
        qbar.hidden = false;
        const p = toS(qb.x + qb.w / 2, qb.y), w = qbar.offsetWidth, hh = qbar.offsetHeight;
        let y = p.y - hh - 14; if (y < 68) y = toS(0, qb.y + qb.h).y + 14;
        if (y > R.height - hh - 70) y = Math.max(8, R.height - hh - 70);
        qbar.style.transform = `translate(${clamp(p.x - w / 2, 8, R.width - w - 8)}px,${clamp(y, 8, R.height - hh - 8)}px)`;
      } else qbar.hidden = true;
    } else qbar.hidden = true;
  }
  function qb(ic, title, run, on) { const b = h("button", { class: "bd-qb" + (on ? " on" : ""), title, "aria-label": title, html: I(ic, 18) }); b.onclick = (e) => { e.stopPropagation(); run(b); }; return b; }
  function qdot(c, on, run) { const b = h("button", { class: "bd-qd" + (on ? " on" : ""), "data-c": c, title: COLORS[c].name, "aria-label": COLORS[c].name }, h("i")); b.onclick = (e) => { e.stopPropagation(); run(); }; return b; }
  function buildQbar() {
    qbar.innerHTML = "";
    const items = selItems(), one = items.length === 1 ? items[0] : null, types = new Set(items.map((x) => x.t));
    const sep = () => qbar.append(h("i", { class: "bd-qs" }));
    if (S.lsel) {
      const l = S.links.get(S.lsel); if (!l) return;
      ["curve", "straight", "elbow"].forEach((s) => qbar.append(qb(s, { curve: "Curved", straight: "Straight", elbow: "Elbow" }[s], () => { updLink(l.id, { style: s }); done(); }, l.style === s)));
      sep();
      qbar.append(qb(l.ends === "both" ? "arrow2" : l.ends === "none" ? "arrow0" : "arrow1", "Arrow ends", () => { updLink(l.id, { ends: l.ends === "end" ? "both" : l.ends === "both" ? "none" : "end" }); done(); }));
      qbar.append(qb("dash", "Dashed line", () => { updLink(l.id, { dash: l.dash ? undefined : true }); done(); }, l.dash));
      qbar.append(qb("pencil", "Label", () => editLinkLabel(l.id)));
      sep();
      LINE.slice(0, 6).forEach((c) => qbar.append(qdot(c, l.color === c, () => { updLink(l.id, { color: c }); done(); })));
      sep(); qbar.append(qb("trash", "Delete", () => { removeLink(l.id); done(); }));
      return;
    }
    if (!items.length) return;
    if (items.some((x) => x.locked)) { qbar.append(qb("unlock", "Unlock", () => { items.forEach((x) => upd(x.id, { locked: undefined })); done(); })); return; }
    if (types.size === 1 && (types.has("sticky") || types.has("frame"))) {
      STICKY.slice(0, 8).forEach((c) => qbar.append(qdot(c, items.every((x) => x.color === c), () => { items.forEach((x) => upd(x.id, { color: c })); if (types.has("sticky")) S.color = c; done(); })));
      sep();
    }
    if (types.size === 1 && types.has("sticky")) {
      [["s", "S"], ["m", "M"], ["l", "L"]].forEach(([s, t]) => { const b = h("button", { class: "bd-qt" + (items.every((x) => (x.size || "m") === s) ? " on" : ""), title: { s: "Small text", m: "Medium text", l: "Large text" }[s] }, t); b.onclick = () => { items.forEach((x) => upd(x.id, { size: s })); done(); }; qbar.append(b); });
      sep();
    }
    if (types.size === 1 && types.has("text")) {
      [["s", "S"], ["m", "M"], ["l", "L"], ["xl", "XL"]].forEach(([s, t]) => { const b = h("button", { class: "bd-qt" + (items.every((x) => (x.size || "m") === s) ? " on" : ""), title: { s: "Small", m: "Medium", l: "Heading", xl: "Title" }[s] }, t); b.onclick = () => { items.forEach((x) => upd(x.id, { size: s })); done(); }; qbar.append(b); });
      qbar.append(qb("bold", "Bold", () => { const v = !items.every((x) => x.bold); items.forEach((x) => upd(x.id, { bold: v || undefined })); done(); }, items.every((x) => x.bold)));
      qbar.append(qb(one && one.align === "center" ? "al-center" : one && one.align === "right" ? "al-right" : "al-left", "Alignment", () => { const nx = { left: "center", center: "right", right: "left" }[(one || items[0]).align || "left"]; items.forEach((x) => upd(x.id, { align: nx === "left" ? undefined : nx })); done(); }));
      sep();
    }
    if (one && one.t === "page") { qbar.append(qb("open", "Open page", () => opts.openPage && opts.openPage(one))); sep(); }
    if (one && one.t === "link") { qbar.append(qb("external", "Open link", () => window.open(one.url, "_blank", "noopener"))); sep(); }
    if (one && one.t === "image") { qbar.append(qb("eye", "View", () => viewImage(one))); qbar.append(qb("download", "Download", () => download(one))); sep(); }
    if (items.length > 1) {
      qbar.append(qb("al-left", "Align left", () => align("l"))); qbar.append(qb("al-top", "Align top", () => align("t")));
      qbar.append(qb("tidy", "Tidy up", () => tidy())); qbar.append(qb("section", "Put in a section", () => wrapSection()));
      sep();
    }
    qbar.append(qb("more", "More", (b) => { const r = b.getBoundingClientRect(); M(r.left, r.bottom + 6, itemMenu()); }));
  }

  /* ---------- pointer input ---------- */
  const ptrs = new Map();
  stage.addEventListener("pointerdown", down);
  stage.addEventListener("pointermove", move);
  stage.addEventListener("pointerup", up);
  stage.addEventListener("pointercancel", up);
  stage.addEventListener("lostpointercapture", (e) => { if (S.drag && S.drag.pid === e.pointerId) up(e); });
  stage.addEventListener("pointerleave", () => { if (!S.drag && S.hover) { S.hover = null; schedule("ov"); } });
  stage.addEventListener("dblclick", dbl);
  stage.addEventListener("wheel", wheel, { passive: false });

  function hitInfo(e) {
    const t = e.target;
    return { el: t.closest && t.closest(".bd-it"), anc: t.closest && t.closest("[data-anc]"), hd: t.closest && t.closest("[data-h]"), lk: t.closest && (t.closest(".bd-l") || t.closest(".bd-lb")), qbar: t.closest && t.closest(".bd-qbar") };
  }
  function down(e) {
    if (S.dead) return;
    closeMenu();
    rect();
    if (e.button === 2) return;
    const hi = hitInfo(e);
    if (hi.qbar) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) { // pinch: two fingers zoom and pan
      if (S.drag && S.drag.kind === "move" && S.drag.started) commitDrag();
      const [a, b] = [...ptrs.values()];
      S.drag = { kind: "pinch", d0: Math.hypot(a.x - b.x, a.y - b.y), z0: S.view.z, m0: toW((a.x + b.x) / 2, (a.y + b.y) / 2) };
      return;
    }
    if (S.editing) { const ed = S.els.get(S.editing); if (ed && ed.contains(e.target)) return; finishEdit(); }
    if (S.editingLink) { if (e.target.closest(".bd-lb.editing")) return; finishLinkEdit(); }
    if (!isEditable(document.activeElement) || !host.contains(document.activeElement)) stage.focus({ preventScroll: true });
    const w = toW(e.clientX, e.clientY); S.last = w;
    const id = hi.el && hi.el.dataset.id, it = id && S.items.get(id);
    const panWanted = e.button === 1 || S.space || S.tool === "hand" || !owner || (e.pointerType === "touch" && !it && !hi.lk && S.tool === "select");
    if (panWanted) { if (!owner && it && e.pointerType !== "touch") { S.tapItem = id; } else S.tapItem = e.pointerType === "touch" && it ? id : null; return startPan(e); }
    if (hi.hd && S.sel.size === 1) return startResize(e, hi.hd.dataset.h);
    if (hi.anc) return startConnect(e, hi.anc.dataset.for, hi.anc.dataset.anc);
    if (["sticky", "text", "page", "frame"].includes(S.tool)) {
      if (S.tool === "frame") return startFrameDraw(e, w);
      const t = S.tool; setTool("select"); create(t, w); e.preventDefault(); return;
    }
    if (S.tool === "image") { setTool("select"); pickImages(w); return; }
    if (S.tool === "link") { setTool("select"); askLink(w); return; }
    if (S.tool === "connector") { if (it && it.t !== "frame") return startConnect(e, id, "auto"); return startMarquee(e, w); }
    if (it) {
      // a section is picked up by its label or by an empty part of it; inside, a drag draws a selection box
      if (it.t === "frame" && !hi.el.querySelector(".bd-frt").contains(e.target) && !S.sel.has(id) && !e.shiftKey) {
        return startMarquee(e, w, id);
      }
      if (e.shiftKey) { if (S.sel.has(id)) { S.sel.delete(id); hi.el.classList.remove("bd-sel"); selChanged(); return; } select([id], true); }
      else if (!S.sel.has(id)) select([id]);
      return startMove(e, w, id);
    }
    if (hi.lk) { selectLink(hi.lk.dataset.lid); return; }
    if (!e.shiftKey) clearSel();
    startMarquee(e, w);
  }
  function capture(e) { try { stage.setPointerCapture(e.pointerId); } catch {} }
  function startPan(e) { S.drag = { kind: "pan", pid: e.pointerId, sx: e.clientX, sy: e.clientY, vx: S.view.x, vy: S.view.y, moved: false }; stage.classList.add("panning"); capture(e); }
  function startMove(e, w, id) {
    const it = S.items.get(id);
    S.drag = { kind: "move", pid: e.pointerId, sx: e.clientX, sy: e.clientY, w0: w, id, started: false, alt: e.altKey, wasSel: S.sel.size, locked: !!(it && it.locked) };
    capture(e);
  }
  function beginMove(d) {
    let ids = [...S.sel].filter((id) => !S.items.get(id)?.locked);
    if (d.alt) ids = duplicate(ids, 0, true);
    // sections carry what sits inside them
    const set = new Set(ids);
    for (const id of ids) { const f = S.items.get(id); if (f && f.t === "frame") for (const o of S.items.values()) if (!set.has(o.id) && !o.locked && inside(o, f) && o.z > f.z - 0.5) set.add(o.id); }
    d.ids = [...set]; d.start = new Map(d.ids.map((id) => { const it = S.items.get(id); return [id, [it.x, it.y]]; }));
    d.box = bbox(d.ids);
    d.links = new Set(); for (const id of d.ids) for (const l of linksOf(id)) d.links.add(l.id);
    // snap targets: edges and centres of what is visible and not moving
    const v = S.view, vis = { x: -v.x / v.z, y: -v.y / v.z, w: R.width / v.z, h: R.height / v.z };
    d.sx_ = []; d.sy_ = [];
    for (const o of S.items.values()) { if (set.has(o.id) || !hits(o, vis)) continue; d.sx_.push(o.x, o.x + o.w / 2, o.x + o.w); d.sy_.push(o.y, o.y + o.h / 2, o.y + o.h); }
    begin(); for (const id of d.ids) touchI(id);
    d.started = true; stage.classList.add("dragging");
  }
  function snap(d, dx, dy, e) {
    if (e.ctrlKey || e.metaKey || !d.box) return [dx, dy, []];
    const th = 6 / S.view.z, b = d.box, lines = [];
    const xs = [b.x + dx, b.x + b.w / 2 + dx, b.x + b.w + dx], ys = [b.y + dy, b.y + b.h / 2 + dy, b.y + b.h + dy];
    let bx = null, by = null;
    for (const c of d.sx_) for (const x of xs) { const dd = c - x; if (Math.abs(dd) < th && (bx == null || Math.abs(dd) < Math.abs(bx))) bx = dd; }
    for (const c of d.sy_) for (const y of ys) { const dd = c - y; if (Math.abs(dd) < th && (by == null || Math.abs(dd) < Math.abs(by))) by = dd; }
    if (bx != null) { dx += bx; const xs2 = [b.x + dx, b.x + b.w / 2 + dx, b.x + b.w + dx]; for (const x of xs2) if (d.sx_.some((c) => Math.abs(c - x) < 0.5)) lines.push(["v", x]); }
    if (by != null) { dy += by; const ys2 = [b.y + dy, b.y + b.h / 2 + dy, b.y + b.h + dy]; for (const y of ys2) if (d.sy_.some((c) => Math.abs(c - y) < 0.5)) lines.push(["h", y]); }
    return [dx, dy, lines];
  }
  function drawGuides(lines) {
    if (!lines.length) { if (guides.__k) { guides.innerHTML = ""; guides.__k = ""; } return; }
    const s = lines.map(([k, v]) => { if (k === "v") { const x = toS(v, 0).x; return `<line x1="${x}" y1="0" x2="${x}" y2="${R.height}"/>`; } const y = toS(0, v).y; return `<line x1="0" y1="${y}" x2="${R.width}" y2="${y}"/>`; }).join("");
    guides.innerHTML = s; guides.__k = s;
  }
  function startResize(e, hk) {
    const it = S.items.get([...S.sel][0]); if (!it || it.locked) return;
    begin(); touchI(it.id);
    S.drag = { kind: "resize", pid: e.pointerId, hk, id: it.id, sx: e.clientX, sy: e.clientY, o: { x: it.x, y: it.y, w: it.w, h: it.h }, ratio: it.w / it.h };
    capture(e); stage.classList.add("dragging");
  }
  function startConnect(e, from, side) {
    S.drag = { kind: "connect", pid: e.pointerId, from, side, sx: e.clientX, sy: e.clientY, target: null };
    capture(e); stage.classList.add("dragging", "connecting");
  }
  function startMarquee(e, w, inFrame) { S.drag = { kind: "marq", pid: e.pointerId, w0: w, sx: e.clientX, sy: e.clientY, base: e.shiftKey ? new Set(S.sel) : new Set(), inFrame, moved: false }; capture(e); }
  function startFrameDraw(e, w) { S.drag = { kind: "framedraw", pid: e.pointerId, w0: w, sx: e.clientX, sy: e.clientY }; capture(e); }

  function move(e) {
    if (S.dead) return;
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = S.drag;
    if (!d) { // hover: which item would get connector dots
      if (!owner || e.pointerType === "touch") return;
      const el = e.target.closest && e.target.closest(".bd-it"), anc = e.target.closest && e.target.closest("[data-anc]");
      const id = anc ? anc.dataset.for : el ? el.dataset.id : null;
      if (id !== S.hover) { S.hover = id; schedule("ov"); }
      return;
    }
    if (d.kind === "pinch") {
      if (ptrs.size < 2) return;
      const [a, b] = [...ptrs.values()], dist = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2 - R.left, my = (a.y + b.y) / 2 - R.top;
      const z = clamp(d.z0 * dist / d.d0, MINZ, MAXZ);
      S.view.z = z; S.view.x = mx - d.m0.x * z; S.view.y = my - d.m0.y * z; moving(); schedule("view"); return;
    }
    if (e.pointerId !== d.pid) return;
    const dxs = e.clientX - d.sx, dys = e.clientY - d.sy;
    if (d.kind === "pan") {
      if (!d.moved && Math.hypot(dxs, dys) < 3) return; d.moved = true;
      S.view.x = d.vx + dxs; S.view.y = d.vy + dys; moving(); schedule("view"); return;
    }
    const w = toW(e.clientX, e.clientY); S.last = w;
    if (d.kind === "move") {
      if (d.locked) return;
      if (!d.started) { if (Math.hypot(dxs, dys) < 4) return; beginMove(d); }
      let dx = (e.clientX - d.sx) / S.view.z, dy = (e.clientY - d.sy) / S.view.z;
      if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      const [sx, sy, lines] = snap(d, dx, dy, e); d.dx = sx; d.dy = sy;
      for (const id of d.ids) { const it = S.items.get(id), st = d.start.get(id); if (!it) continue; it.x = Math.round(st[0] + sx); it.y = Math.round(st[1] + sy); const el = S.els.get(id); if (el) el.style.transform = `translate(${it.x}px,${it.y}px)`; }
      for (const lid of d.links) schedule("link", lid);
      drawGuides(lines); schedule("ov");
      edgePan(e);
      return;
    }
    if (d.kind === "resize") {
      const it = S.items.get(d.id), o = d.o, z = S.view.z; let dx = dxs / z, dy = dys / z;
      let { x, y, w: ww, h: hh } = o;
      const min = { page: [200, 120], sticky: [90, 90], text: [60, 20], image: [40, 40], link: [200, 60], frame: [160, 120] }[it.t];
      if (d.hk.includes("e")) ww = o.w + dx; if (d.hk.includes("w")) ww = o.w - dx;
      if (d.hk.includes("s")) hh = o.h + dy; if (d.hk.includes("n")) hh = o.h - dy;
      ww = Math.max(min[0], ww); hh = Math.max(min[1], hh);
      if ((it.t === "image" && !e.shiftKey) || (it.t !== "image" && e.shiftKey && !autoH(it))) { if (ww / hh > d.ratio) hh = ww / d.ratio; else ww = hh * d.ratio; }
      if (d.hk.includes("w")) x = o.x + o.w - ww; if (d.hk.includes("n")) y = o.y + o.h - hh;
      Object.assign(it, { x: Math.round(x), y: Math.round(y), w: Math.round(ww), ...(autoH(it) ? {} : { h: Math.round(hh) }) });
      const el = S.els.get(it.id); place(el, it); if (it.t === "sticky") fitSticky(el, it); if (autoH(it)) measure(it);
      linksOf(it.id).forEach((l) => schedule("link", l.id)); schedule("ov"); return;
    }
    if (d.kind === "connect") {
      const A = S.items.get(d.from); if (!A) return;
      const el = document.elementsFromPoint(e.clientX, e.clientY).find((x) => x.classList && x.classList.contains("bd-it") && x.dataset.id !== d.from);
      const tid = el ? el.dataset.id : null, T = tid && S.items.get(tid);
      if (d.target !== tid) { S.els.get(d.target)?.classList.remove("target"); d.target = T && T.t !== "frame" ? tid : null; if (d.target) el.classList.add("target"); }
      const B = d.target ? S.items.get(d.target) : { x: w.x - 1, y: w.y - 1, w: 2, h: 2 };
      const G = geom(A, B, d.side, d.target ? "auto" : (Math.abs(w.x - (A.x + A.w / 2)) > Math.abs(w.y - (A.y + A.h / 2)) ? (w.x > A.x ? "l" : "r") : (w.y > A.y ? "t" : "b")), "curve");
      ghost.setAttribute("d", G.d); edgePan(e); return;
    }
    if (d.kind === "marq" || d.kind === "framedraw") {
      if (!d.moved && Math.hypot(dxs, dys) < 3) return; d.moved = true;
      const r = { x: Math.min(d.w0.x, w.x), y: Math.min(d.w0.y, w.y), w: Math.abs(w.x - d.w0.x), h: Math.abs(w.y - d.w0.y) };
      const p = toS(r.x, r.y); marq.hidden = false; marq.classList.toggle("frame", d.kind === "framedraw");
      marq.style.transform = `translate(${p.x}px,${p.y}px)`; marq.style.width = r.w * S.view.z + "px"; marq.style.height = r.h * S.view.z + "px";
      if (d.kind === "marq") {
        const ids = new Set(d.base);
        for (const it of S.items.values()) { if (it.id === d.inFrame) continue; if (it.t === "frame" ? inside(it, r) : hits(it, r)) ids.add(it.id); }
        const key = [...ids].sort().join(","); if (key !== d.key) { d.key = key; select([...ids]); }
      }
      edgePan(e);
    }
  }
  // dragging near the edge moves the board
  let epT = 0;
  function edgePan(e) {
    cancelAnimationFrame(epT);
    const m = 36, x = e.clientX - R.left, y = e.clientY - R.top;
    const vx = x < m ? (m - x) : x > R.width - m ? -(x - R.width + m) : 0, vy = y < m ? (m - y) : y > R.height - m ? -(y - R.height + m) : 0;
    if (!vx && !vy) return;
    epT = requestAnimationFrame(() => { if (!S.drag) return; S.view.x += vx * 0.35; S.view.y += vy * 0.35; if (S.drag.sx != null) { S.drag.sx += vx * 0.35; S.drag.sy += vy * 0.35; } if (S.drag.kind === "pan") return; schedule("view"); move(e); });
  }
  function commitDrag() {
    const d = S.drag; if (!d) return;
    if (d.kind === "move" && d.started) { for (const id of d.ids) mark(id); done(); }
  }
  function up(e) {
    ptrs.delete(e.pointerId);
    const d = S.drag; if (!d) return;
    if (d.kind === "pinch") { if (ptrs.size < 2) S.drag = null; return; }
    if (e.pointerId !== d.pid && e.type !== "lostpointercapture") return;
    S.drag = null; cancelAnimationFrame(epT);
    stage.classList.remove("dragging", "panning", "connecting"); drawGuides([]);
    if (d.kind === "pan") {
      if (!d.moved && S.tapItem) { const it = S.items.get(S.tapItem); S.tapItem = null; if (it) tapRead(it, e); }
      else if (!d.moved && owner && e.pointerType === "touch") clearSel();
    }
    else if (d.kind === "move") {
      if (d.started) { for (const id of d.ids) mark(id); done(); }
      else if (!e.shiftKey && d.wasSel > 1 && S.sel.has(d.id)) select([d.id]); // a click on one of several picks just that one
    }
    else if (d.kind === "resize") { mark(d.id); done(); }
    else if (d.kind === "connect") {
      ghost.setAttribute("d", ""); S.els.get(d.target)?.classList.remove("target");
      const moved = Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 8;
      if (d.target) { putLink({ id: rid(), a: d.from, b: d.target, as: d.side, bs: "auto", style: "curve", ends: "end", color: "grey" }); done(); }
      else if (moved) { // dropped on empty canvas: a new sticky note, connected
        const w = toW(e.clientX, e.clientY), A = S.items.get(d.from);
        const t = make("sticky", w, { color: A && A.t === "sticky" ? A.color : S.color, w: A && A.t === "sticky" ? A.w : 220, h: A && A.t === "sticky" ? A.h : 220 });
        put(t); putLink({ id: rid(), a: d.from, b: t.id, as: d.side, bs: "auto", style: "curve", ends: "end", color: "grey" });
        select([t.id]); startEdit(t.id, true);
      }
      if (S.tool === "connector") setTool("select");
    }
    else if (d.kind === "marq") { marq.hidden = true; if (!d.moved && d.inFrame) select([d.inFrame]); }
    else if (d.kind === "framedraw") {
      marq.hidden = true; setTool("select");
      const w = toW(e.clientX, e.clientY);
      if (d.moved && Math.abs(w.x - d.w0.x) > 40 && Math.abs(w.y - d.w0.y) > 40) create("frame", w, { x: Math.min(d.w0.x, w.x), y: Math.min(d.w0.y, w.y), w: Math.abs(w.x - d.w0.x), h: Math.abs(w.y - d.w0.y) });
      else create("frame", d.w0);
    }
    schedule("ov");
  }
  function dbl(e) {
    if (S.dead) return;
    const hi = hitInfo(e);
    if (hi.qbar || hi.anc || hi.hd) return;
    const id = hi.el && hi.el.dataset.id, it = id && S.items.get(id);
    if (hi.lk && owner) { editLinkLabel(hi.lk.dataset.lid); return; }
    if (it) {
      if (it.t === "page") return opts.openPage && opts.openPage(it);
      if (it.t === "image") return viewImage(it);
      if (it.t === "link") return window.open(it.url, "_blank", "noopener");
      if (!owner || it.locked) return;
      if (it.t === "frame" && !hi.el.querySelector(".bd-frt").contains(e.target)) { const w = toW(e.clientX, e.clientY); create("sticky", w); return; }
      return startEdit(id);
    }
    if (owner) create("sticky", toW(e.clientX, e.clientY)); // quick note: double-click anywhere
  }
  function tapRead(it, e) {
    if (it.t === "page") return opts.openPage && opts.openPage(it);
    if (it.t === "image") return viewImage(it);
    if (it.t === "link") return window.open(it.url, "_blank", "noopener");
  }
  function wheel(e) {
    if (S.dead) return;
    if (e.target.closest(".bd-qbar")) return;
    e.preventDefault(); closeMenu(); rect();
    const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? R.height : 1;
    if (e.ctrlKey || e.metaKey) { const dy = clamp(e.deltaY * k, -120, 120), f = Math.exp(-dy * (Math.abs(dy) < 40 ? 0.011 : 0.0016)); zoomAt(e.clientX, e.clientY, f); }
    else { let dx = e.deltaX * k, dy = e.deltaY * k; if (e.shiftKey && !dx) { dx = dy; dy = 0; } S.view.x -= dx; S.view.y -= dy; }
    moving(); schedule("view");
  }
  function zoomAt(cx, cy, f) {
    const v = S.view, z = clamp(v.z * f, MINZ, MAXZ), px = cx - R.left, py = cy - R.top;
    v.x = px - (px - v.x) * (z / v.z); v.y = py - (py - v.y) * (z / v.z); v.z = z;
  }
  let animT = 0;
  function animateTo(t, ms = 260) {
    cancelAnimationFrame(animT);
    const f = { ...S.view }, t0 = performance.now(), ease = (x) => 1 - Math.pow(1 - x, 3);
    const step = (now) => { const k = Math.min(1, (now - t0) / ms), e = ease(k); S.view.x = f.x + (t.x - f.x) * e; S.view.y = f.y + (t.y - f.y) * e; S.view.z = f.z + (t.z - f.z) * e; moving(); schedule("view"); if (k < 1) animT = requestAnimationFrame(step); };
    animT = requestAnimationFrame(step);
  }
  function zoomBy(f) { rect(); const z = clamp(S.view.z * f, MINZ, MAXZ), cx = R.width / 2, cy = R.height / 2; animateTo({ z, x: cx - (cx - S.view.x) * (z / S.view.z), y: cy - (cy - S.view.y) * (z / S.view.z) }, 180); }
  function fitTo(b, { max = 1, pad = 80, now, tries = 0 } = {}) {
    rect(); if (R.width < 20 && tries < 20) { setTimeout(() => fitTo(b, { max, pad, now, tries: tries + 1 }), 40); return; } if (!b) { const t = { x: R.width / 2, y: R.height / 2, z: 1 }; now ? Object.assign(S.view, t) : animateTo(t); schedule("view"); return; }
    const z = clamp(Math.min((R.width - pad * 2) / Math.max(b.w, 1), (R.height - pad * 2) / Math.max(b.h, 1), max), MINZ, MAXZ);
    const t = { z, x: R.width / 2 - (b.x + b.w / 2) * z, y: R.height / 2 - (b.y + b.h / 2) * z };
    if (now) { Object.assign(S.view, t); schedule("view"); } else animateTo(t);
  }
  const fitAll = (o) => fitTo(bbox(S.items.keys()), o);

  /* ---------- editing text in place ---------- */
  function startEdit(id, fresh) {
    const it = S.items.get(id), el = S.els.get(id); if (!it || !el || !owner || it.locked) return;
    if (S.editing && S.editing !== id) finishEdit();
    const tx = it.t === "frame" ? el.querySelector(".bd-frt span") : el.querySelector(".bd-tx"); if (!tx) return;
    begin(); touchI(id);
    S.editing = id; el.classList.add("editing");
    tx.contentEditable = plainOnly ? "plaintext-only" : "true"; tx.spellcheck = true;
    tx.focus({ preventScroll: true });
    const r = document.createRange(); r.selectNodeContents(tx); if (!fresh) r.collapse(false);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    tx.oninput = () => {
      const v = tx.innerText.replace(/\n$/, "");
      if (it.t === "frame") it.title = v; else it.text = v;
      if (it.t === "sticky") fitSticky(el, it); if (autoH(it)) measure(it);
    };
    tx.onpaste = (e) => { if (plainOnly) return; e.preventDefault(); document.execCommand("insertText", false, e.clipboardData.getData("text/plain")); };
    tx.onkeydown = (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finishEdit(); stage.focus({ preventScroll: true }); }
      else if (e.key === "Enter" && (e.metaKey || e.ctrlKey || (it.t === "frame" && !e.shiftKey))) { e.preventDefault(); finishEdit(); stage.focus({ preventScroll: true }); }
      else if (e.key === "Tab" && it.t === "sticky") { // brainstorm fast: Tab makes the next note beside this one, Shift+Tab below
        e.preventDefault(); finishEdit();
        const nx = e.shiftKey ? { x: it.x, y: it.y + it.h + 24 } : { x: it.x + it.w + 24, y: it.y };
        const n = make("sticky", nx, { x: nx.x, y: nx.y, w: it.w, h: it.h, color: it.color, size: it.size }); put(n);
        for (const l of linksOf(it.id)) if (l.b === it.id) putLink({ ...clone(l), id: rid(), b: n.id }); // same parent as this one
        select([n.id]); startEdit(n.id, true); ensureVisible(n);
      }
      e.stopPropagation();
    };
    schedule("ov");
  }
  function finishEdit() {
    const id = S.editing; if (!id) return;
    S.editing = null;
    const el = S.els.get(id), it = S.items.get(id);
    if (el) { el.classList.remove("editing"); const tx = el.querySelector("[contenteditable]"); if (tx) { tx.contentEditable = "false"; tx.removeAttribute("contenteditable"); tx.oninput = tx.onkeydown = tx.onpaste = null; } }
    if (it) {
      if (it.t === "text" && !(it.text || "").trim()) { remove([id]); done(); return; } // an empty text box goes away by itself
      paint(it); mark(id);
    }
    done(); try { getSelection().removeAllRanges(); } catch {}
    schedule("ov");
  }
  function editLinkLabel(lid) {
    const l = S.links.get(lid); if (!l || !owner) return;
    S.editingLink = lid; paintLink(l);
    const lb = S.lels.get(lid).__lb; if (!lb) return;
    begin(); touchL(lid);
    lb.classList.add("editing"); lb.contentEditable = plainOnly ? "plaintext-only" : "true"; lb.focus();
    const r = document.createRange(); r.selectNodeContents(lb); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    lb.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); finishLinkEdit(); stage.focus({ preventScroll: true }); } };
    lb.onblur = () => finishLinkEdit();
  }
  function finishLinkEdit() {
    const lid = S.editingLink; if (!lid) return; S.editingLink = null;
    const l = S.links.get(lid), g = S.lels.get(lid), lb = g && g.__lb;
    if (lb) { const v = lb.innerText.trim().slice(0, 200); lb.removeAttribute("contenteditable"); lb.classList.remove("editing"); lb.onkeydown = lb.onblur = null; if (l) { if (v) l.label = v; else delete l.label; markL(lid); paintLink(l); } }
    done();
  }

  /* ---------- commands ---------- */
  function duplicate(ids, off = 28, inPlace) {
    begin(); const map = new Map(), z = topZ(); let n = 0;
    for (const id of ids) {
      const it = S.items.get(id); if (!it) continue;
      const c = clone(it); c.id = rid(); c.x += off; c.y += off; if (c.t !== "frame") c.z = z + ++n; delete c.locked;
      map.set(id, c.id); put(c);
      if (c.t === "page" && opts.copyPage) opts.copyPage(id, c.id);
    }
    for (const l of [...S.links.values()]) if (map.has(l.a) && map.has(l.b)) putLink({ ...clone(l), id: rid(), a: map.get(l.a), b: map.get(l.b) });
    const out = [...map.values()];
    if (!inPlace) { done(); select(out); }
    else select(out);
    return out;
  }
  function align(k) {
    const items = selItems().filter((x) => !x.locked); if (items.length < 2) return; const b = bbox(items.map((x) => x.id));
    for (const it of items) {
      const p = k === "l" ? { x: b.x } : k === "r" ? { x: b.x + b.w - it.w } : k === "c" ? { x: Math.round(b.x + b.w / 2 - it.w / 2) } : k === "t" ? { y: b.y } : k === "b" ? { y: b.y + b.h - it.h } : { y: Math.round(b.y + b.h / 2 - it.h / 2) };
      upd(it.id, p);
    }
    done();
  }
  function distribute(axis) {
    const items = selItems().filter((x) => !x.locked); if (items.length < 3) return;
    const a = axis === "h" ? "x" : "y", s = axis === "h" ? "w" : "h";
    items.sort((p, q) => p[a] - q[a]);
    const first = items[0], last = items[items.length - 1], total = items.reduce((t, x) => t + x[s], 0);
    const gap = (last[a] + last[s] - first[a] - total) / (items.length - 1);
    let cur = first[a]; for (const it of items) { upd(it.id, { [a]: Math.round(cur) }); cur += it[s] + gap; }
    done();
  }
  // Tidy up: rows of even height, like a moodboard
  function tidy() {
    const items = selItems().filter((x) => !x.locked && x.t !== "frame"); if (items.length < 2) return;
    const b = bbox(items.map((x) => x.id)), gap = 24;
    items.sort((p, q) => (Math.round(p.y / 80) - Math.round(q.y / 80)) || p.x - q.x);
    const area = items.reduce((t, x) => t + (x.w + gap) * (x.h + gap), 0), maxW = Math.max(Math.sqrt(area) * 1.35, ...items.map((x) => x.w));
    let x = b.x, y = b.y, rowH = 0;
    for (const it of items) { if (x > b.x && x + it.w > b.x + maxW) { x = b.x; y += rowH + gap; rowH = 0; } upd(it.id, { x: Math.round(x), y: Math.round(y) }); x += it.w + gap; rowH = Math.max(rowH, it.h); }
    done();
  }
  function wrapSection() {
    const ids = [...S.sel]; const b = bbox(ids); if (!b) return;
    const pad = 48, f = make("frame", { x: 0, y: 0 }, { x: b.x - pad, y: b.y - pad - 12, w: b.w + pad * 2, h: b.h + pad * 2 + 12, z: Math.min(...ids.map((id) => S.items.get(id).z)) - 1 });
    put(f); select([f.id]); startEdit(f.id, true);
  }
  function order(front) {
    const items = selItems(); if (!items.length) return;
    let z = front ? topZ() : lowZ();
    items.sort((a, b) => a.z - b.z); if (!front) items.reverse();
    for (const it of items) upd(it.id, { z: front ? ++z : --z });
    done();
  }
  function lock(v) { selItems().forEach((it) => upd(it.id, { locked: v || undefined })); done(); }
  function delSel() { if (S.lsel) { removeLink(S.lsel); done(); return; } const ids = [...S.sel].filter((id) => !S.items.get(id)?.locked); if (!ids.length) { if (S.sel.size) toast("Unlock it first to delete it"); return; } remove(ids); done(); }
  function selectAll() { select([...S.items.keys()]); }
  function ensureVisible(it) { const p = toS(it.x, it.y), q = toS(it.x + it.w, it.y + it.h); if (p.x < 0 || p.y < 0 || q.x > R.width || q.y > R.height) animateTo({ z: S.view.z, x: R.width / 2 - (it.x + it.w / 2) * S.view.z, y: R.height / 2 - (it.y + it.h / 2) * S.view.z }, 220); }

  /* ---------- copy, cut, paste, drop ---------- */
  const CLIP = "bdClip";
  function copySel(cut) {
    const ids = [...S.sel]; if (!ids.length) return null;
    const items = ids.map((id) => clone(S.items.get(id))).filter(Boolean), set = new Set(ids);
    const links = [...S.links.values()].filter((l) => set.has(l.a) && set.has(l.b)).map(clone);
    const data = { v: 1, items, links, from: opts.boardId, ts: Date.now() };
    try { localStorage.setItem(CLIP, JSON.stringify(data)); } catch {}
    if (cut) { remove(ids.filter((id) => !S.items.get(id)?.locked)); done(); }
    return "rkboard:" + JSON.stringify(data);
  }
  function pasteData(data, at) {
    if (!data || !Array.isArray(data.items) || !data.items.length) return;
    const b = { x: Math.min(...data.items.map((x) => x.x)), y: Math.min(...data.items.map((x) => x.y)) };
    const bb = data.items.reduce((a, x) => ({ r: Math.max(a.r, x.x + x.w), b: Math.max(a.b, x.y + x.h) }), { r: -Infinity, b: -Infinity });
    const ox = at.x - (b.x + bb.r) / 2, oy = at.y - (b.y + bb.b) / 2, map = new Map(); let z = topZ();
    begin();
    for (const src of data.items) { const c = clone(src); c.id = rid(); c.x = Math.round(c.x + ox); c.y = Math.round(c.y + oy); if (c.t !== "frame") c.z = ++z; delete c._up; map.set(src.id, c.id); put(c); if (c.t === "page" && opts.copyPage) opts.copyPage(src.id, c.id); }
    for (const l of data.links || []) if (map.has(l.a) && map.has(l.b)) putLink({ ...l, id: rid(), a: map.get(l.a), b: map.get(l.b) });
    done(); select([...map.values()]);
  }
  const pasteAt = () => { const c = center(); if (S.last && S.lastInside) return S.last; return c; };
  stage.addEventListener("pointerenter", () => (S.lastInside = true)); stage.addEventListener("pointerleave", () => (S.lastInside = false));
  stage.addEventListener("pointermove", (e) => { if (!S.drag) S.last = toW(e.clientX, e.clientY); }, { passive: true });
  host.addEventListener("copy", (e) => { if (!owner || isEditable(e.target) || !S.sel.size) return; const t = copySel(false); if (t) { e.clipboardData.setData("text/plain", t); e.preventDefault(); } });
  host.addEventListener("cut", (e) => { if (!owner || isEditable(e.target) || !S.sel.size) return; const t = copySel(true); if (t) { e.clipboardData.setData("text/plain", t); e.preventDefault(); } });
  host.addEventListener("paste", (e) => { if (!owner || isEditable(e.target)) return; e.preventDefault(); handleData(e.clipboardData, pasteAt()); });
  stage.addEventListener("dragover", (e) => { if (!owner) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; stage.classList.add("dropping"); });
  stage.addEventListener("dragleave", (e) => { if (e.target === stage) stage.classList.remove("dropping"); });
  stage.addEventListener("drop", (e) => { if (!owner) return; e.preventDefault(); stage.classList.remove("dropping"); rect(); handleData(e.dataTransfer, toW(e.clientX, e.clientY)); });
  function handleData(dt, at) {
    if (!dt) return;
    const files = [...(dt.files || [])];
    if (files.length) return addImages(files, at);
    const txt = (dt.getData("text/plain") || "").trim(), uri = (dt.getData("text/uri-list") || "").split("\n").find((x) => x && !x.startsWith("#")), html = dt.getData("text/html") || "";
    if (txt.startsWith("rkboard:")) { try { return pasteData(JSON.parse(txt.slice(8)), at); } catch {} }
    const img = html.match(/<img[^>]+src=["'](https?:[^"']+)["']/i);
    if (img && (!txt || isImgUrl(txt) || txt === uri)) return addLink(img[1].replace(/&amp;/g, "&"), at);
    const url = isUrl(txt) ? txt : uri && isUrl(uri) ? uri : "";
    if (url) return addLink(url, at);
    if (!txt) return;
    const lines = txt.split(/\n/);
    if (txt.length <= 300 && lines.length <= 8) return create("sticky", at, { text: txt });
    create("text", at, { text: txt.slice(0, 20000), w: 480 });
  }
  async function pickImages(at) { const files = await Up.pick("image/*", true); if (files.length) addImages(files, at || center()); }
  function askLink(at) {
    at = at || center(); const p = toS(at.x, at.y);
    const box = h("form", { class: "bd-ask" }, h("span", { html: I("link", 18) }), h("input", { type: "url", placeholder: "Paste a link and press Enter", "aria-label": "Web address", autocomplete: "off" }), h("button", { type: "submit", class: "bd-askb" }, "Add"));
    box.style.left = clamp(p.x - 180, 8, R.width - 368) + "px"; box.style.top = clamp(p.y - 24, 8, R.height - 60) + "px";
    stage.append(box); const inp = box.querySelector("input"); inp.focus();
    const close = () => box.remove();
    box.onsubmit = (e) => { e.preventDefault(); const v = inp.value.trim(); close(); stage.focus({ preventScroll: true }); if (v) addLink(v, at); };
    inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Escape") { close(); stage.focus({ preventScroll: true }); } };
    inp.onblur = () => setTimeout(close, 150);
    box.addEventListener("pointerdown", (e) => e.stopPropagation());
  }
  function viewImage(it) {
    const imgs = [...S.items.values()].filter((x) => x.t === "image" && !x._up).sort((a, b) => a.y - b.y || a.x - b.x);
    lightbox(imgs.map((x) => ({ src: x.src, alt: x.name || "" })), Math.max(0, imgs.findIndex((x) => x.id === it.id)));
  }
  function download(it) {
    const a = document.createElement("a"); a.href = it.src; a.download = (it.name || "picture").replace(/[^\w.-]+/g, "-"); a.rel = "noopener";
    if (!/^\/|^blob:/.test(it.src) && new URL(it.src, location.href).origin !== location.origin) a.target = "_blank";
    document.body.append(a); a.click(); a.remove();
  }

  /* ---------- keyboard ---------- */
  host.addEventListener("keydown", (e) => {
    if (S.dead || isEditable(e.target)) return;
    const k = e.key, mod = e.ctrlKey || e.metaKey;
    if (k === " " && !S.space) { S.space = true; stage.classList.add("space"); e.preventDefault(); return; }
    if (mod && (k === "z" || k === "Z")) { e.preventDefault(); if (!owner) return; e.shiftKey ? redo() : undo(); return; }
    if (mod && (k === "y" || k === "Y")) { e.preventDefault(); if (owner) redo(); return; }
    if (mod && (k === "=" || k === "+")) { e.preventDefault(); zoomBy(1.25); return; }
    if (mod && k === "-") { e.preventDefault(); zoomBy(0.8); return; }
    if (mod && k === "0") { e.preventDefault(); zoomTo(1); return; }
    if (e.shiftKey && (k === "!" || e.code === "Digit1")) { e.preventDefault(); fitAll(); return; }
    if (e.shiftKey && (k === "@" || e.code === "Digit2")) { e.preventDefault(); fitTo(bbox(S.sel.size ? S.sel : S.items.keys()), { max: 2 }); return; }
    if (k === "Escape") { if (S.tool !== "select") setTool("select"); else clearSel(); closeMenu(); return; }
    if (!owner) return;
    if (mod && (k === "a" || k === "A")) { e.preventDefault(); selectAll(); return; }
    if (mod && (k === "d" || k === "D")) { e.preventDefault(); duplicate([...S.sel]); return; }
    if (mod && (k === "g" || k === "G")) { e.preventDefault(); if (S.sel.size) wrapSection(); return; }
    if (mod && e.shiftKey && (k === "l" || k === "L")) { e.preventDefault(); lock(!selItems().every((x) => x.locked)); return; }
    if (k === "]" && mod) { e.preventDefault(); order(true); return; }
    if (k === "[" && mod) { e.preventDefault(); order(false); return; }
    if (k === "Delete" || k === "Backspace") { e.preventDefault(); delSel(); return; }
    if (k === "Enter" && S.sel.size === 1) { const it = selItems()[0]; e.preventDefault(); if (it.t === "page") opts.openPage && opts.openPage(it); else if (it.t === "link") window.open(it.url, "_blank", "noopener"); else if (it.t === "image") viewImage(it); else startEdit(it.id); return; }
    if (k.startsWith("Arrow") && S.sel.size) {
      e.preventDefault(); const st = e.shiftKey ? 10 : 1, dx = k === "ArrowLeft" ? -st : k === "ArrowRight" ? st : 0, dy = k === "ArrowUp" ? -st : k === "ArrowDown" ? st : 0;
      selItems().filter((x) => !x.locked).forEach((it) => upd(it.id, { x: it.x + dx, y: it.y + dy })); clearTimeout(S.nudgeT); S.nudgeT = setTimeout(done, 400); return;
    }
    if (!mod && !e.altKey) {
      const map = { v: "select", h: "hand", p: "page", s: "sticky", t: "text", i: "image", l: "link", f: "frame", c: "connector" }, t = map[k.toLowerCase()];
      if (t) { e.preventDefault(); if (t === "image") { setTool("select"); pickImages(); } else if (t === "link") { setTool("select"); askLink(); } else setTool(t); }
    }
  });
  host.addEventListener("keyup", (e) => { if (e.key === " ") { S.space = false; stage.classList.remove("space"); } });
  window.addEventListener("blur", () => { S.space = false; stage.classList.remove("space"); });

  /* ---------- toolbar and zoom ---------- */
  function setTool(t) {
    S.tool = t; stage.dataset.tool = t;
    host.querySelectorAll("[data-tool]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tool === t)));
    if (t !== "select" && t !== "hand") clearSel();
    schedule("ov");
  }
  host.querySelectorAll("[data-tool]").forEach((b) => b.addEventListener("click", () => {
    const t = b.dataset.tool;
    if (t === "image") { setTool("select"); pickImages(); return; }
    if (t === "link") { setTool("select"); askLink(); return; }
    if (t === "sticky" && S.tool === "sticky") { const r = b.getBoundingClientRect(); M(r.left, r.top - 8, [{ head: "Sticky colour" }, { swatches: STICKY.map((c) => ({ c, name: COLORS[c].name, on: S.color === c, run: () => { S.color = c; b.dataset.c = c; setTool("sticky"); } })) }]); return; }
    setTool(S.tool === t && t !== "select" ? "select" : t);
  }));
  host.querySelectorAll("[data-z]").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.z;
    if (k === "in") zoomBy(1.25); else if (k === "out") zoomBy(0.8); else if (k === "fit") fitAll();
    else { const r = b.getBoundingClientRect(); M(r.left, r.top - 8, [{ t: "Zoom in", i: "zoom-in", k: "Ctrl +", run: () => zoomBy(1.25) }, { t: "Zoom out", i: "zoom-out", k: "Ctrl −", run: () => zoomBy(0.8) }, "-", { t: "Zoom to 50%", run: () => zoomTo(0.5) }, { t: "Zoom to 100%", k: "Ctrl 0", run: () => zoomTo(1) }, { t: "Zoom to 200%", run: () => zoomTo(2) }, "-", { t: "Show everything", i: "fit", k: "Shift 1", run: () => fitAll() }, { t: "Zoom to selection", k: "Shift 2", disabled: !S.sel.size, run: () => fitTo(bbox(S.sel), { max: 2 }) }]); }
  }));
  function zoomTo(z) { rect(); const cx = R.width / 2, cy = R.height / 2; animateTo({ z, x: cx - (cx - S.view.x) * (z / S.view.z), y: cy - (cy - S.view.y) * (z / S.view.z) }, 200); }

  /* ---------- right-click menus ---------- */
  function itemMenu() {
    const items = selItems(), one = items.length === 1 ? items[0] : null, locked = items.length && items.every((x) => x.locked), types = new Set(items.map((x) => x.t));
    const out = [];
    if (one) {
      if (one.t === "page") out.push({ t: "Open page", i: "open", k: "Enter", run: () => opts.openPage && opts.openPage(one) }, { t: "Download as Markdown", i: "download", run: () => opts.pageDownload && opts.pageDownload(one, "md") }, { t: "Save as PDF", i: "print", run: () => opts.pageDownload && opts.pageDownload(one, "pdf") }, "-");
      if (one.t === "image") out.push({ t: "View full size", i: "eye", k: "Enter", run: () => viewImage(one) }, { t: "Download picture", i: "download", run: () => download(one) }, { t: "Copy picture address", i: "link", run: () => copyText(new URL(one.src, location.href).href) }, { t: one.cap ? "Edit caption" : "Add caption", i: "pencil", run: () => caption(one) }, "-");
      if (one.t === "link") out.push({ t: "Open link", i: "external", k: "Enter", run: () => window.open(one.url, "_blank", "noopener") }, { t: "Copy link address", i: "link", run: () => copyText(one.url) }, { t: "Refresh preview", i: "refresh", run: () => refreshLink(one) }, "-");
      if (["sticky", "text"].includes(one.t) && !locked) out.push({ t: "Edit text", i: "pencil", k: "Enter", run: () => startEdit(one.id) }, { t: "Copy text", i: "copy", run: () => copyText(one.text || "") });
      if (one.t === "sticky" && !locked) out.push({ t: "Turn into a page", i: "page", run: () => stickyToPage(one) });
      if (one.t === "frame" && !locked) out.push({ t: "Rename section", i: "pencil", run: () => startEdit(one.id) }, { t: "Select what's inside", i: "frame", run: () => select([...S.items.values()].filter((o) => o.id !== one.id && inside(o, one)).map((o) => o.id)) }, { t: "Remove section, keep items", i: "ungroup", run: () => { remove([one.id]); done(); } });
      if (out.length && out[out.length - 1] !== "-") out.push("-");
    }
    if (!locked && (types.size === 1 && (types.has("sticky") || types.has("frame")))) out.push({ head: "Colour" }, { swatches: STICKY.map((c) => ({ c, name: COLORS[c].name, on: items.every((x) => x.color === c), run: () => { items.forEach((x) => upd(x.id, { color: c })); done(); } })) }, "-");
    if (!locked && types.size === 1 && types.has("text")) out.push({ head: "Text size" }, { chips: [["s", "S"], ["m", "M"], ["l", "L"], ["xl", "XL"]].map(([s, t]) => ({ t, on: items.every((x) => (x.size || "m") === s), run: () => { items.forEach((x) => upd(x.id, { size: s })); done(); } })) }, "-");
    if (items.length > 1 && !locked) out.push({ t: "Align", i: "al-left", sub: [{ t: "Left", i: "al-left", run: () => align("l") }, { t: "Centre", i: "al-center", run: () => align("c") }, { t: "Right", i: "al-right", run: () => align("r") }, "-", { t: "Top", i: "al-top", run: () => align("t") }, { t: "Middle", i: "al-middle", run: () => align("m") }, { t: "Bottom", i: "al-bottom", run: () => align("b") }, "-", { t: "Space out across", i: "dist-h", disabled: items.length < 3, run: () => distribute("h") }, { t: "Space out down", i: "dist-v", disabled: items.length < 3, run: () => distribute("v") }] }, { t: "Tidy up", i: "tidy", run: () => tidy() });
    out.push({ t: "Put in a section", i: "section", k: "Ctrl G", run: () => wrapSection() });
    out.push("-", { t: "Copy", i: "copy", k: "Ctrl C", run: () => { const t = copySel(false); copyText(t, true); } }, ...(locked ? [] : [{ t: "Cut", i: "x", k: "Ctrl X", run: () => { const t = copySel(true); copyText(t, true); } }]), { t: "Duplicate", i: "dup", k: "Ctrl D", run: () => duplicate([...S.sel]) });
    out.push("-", { t: "Bring to front", i: "front", k: "Ctrl ]", run: () => order(true) }, { t: "Send to back", i: "back", k: "Ctrl [", run: () => order(false) });
    out.push({ t: locked ? "Unlock" : "Lock", i: locked ? "unlock" : "lock", k: "Ctrl ⇧ L", run: () => lock(!locked) });
    out.push({ t: "Zoom to selection", i: "fit", k: "Shift 2", run: () => fitTo(bbox(S.sel), { max: 2 }) });
    if (!locked) out.push("-", { t: "Delete", i: "trash", k: "Del", danger: true, run: () => delSel() });
    return out;
  }
  function linkMenu(l) {
    return [
      { head: "Line" }, { chips: ["curve", "straight", "elbow"].map((s) => ({ i: s, t: { curve: "Curve", straight: "Straight", elbow: "Elbow" }[s], on: l.style === s, run: () => { updLink(l.id, { style: s }); done(); } })) },
      { head: "Ends" }, { chips: [["end", "arrow1", "Arrow"], ["both", "arrow2", "Both"], ["none", "arrow0", "None"]].map(([v, ic, t]) => ({ i: ic, t, on: l.ends === v, run: () => { updLink(l.id, { ends: v }); done(); } })) },
      { head: "Colour" }, { swatches: LINE.map((c) => ({ c, name: COLORS[c].name, on: l.color === c, run: () => { updLink(l.id, { color: c }); done(); } })) },
      "-", { t: l.dash ? "Solid line" : "Dashed line", i: "dash", run: () => { updLink(l.id, { dash: l.dash ? undefined : true }); done(); } },
      { t: "Thickness", i: "width", sub: [1, 2, 3].map((w) => ({ t: { 1: "Thin", 2: "Regular", 3: "Thick" }[w], i: (l.w || 2) === w ? "check" : "", run: () => { updLink(l.id, { w }); done(); } })) },
      { t: l.label ? "Edit label" : "Add label", i: "pencil", run: () => editLinkLabel(l.id) },
      { t: "Reverse direction", i: "swap", run: () => { updLink(l.id, { a: l.b, b: l.a, as: l.bs, bs: l.as }); done(); } },
      "-", { t: "Delete connector", i: "trash", danger: true, run: () => { removeLink(l.id); done(); } },
    ];
  }
  function canvasMenu(at) {
    const clip = (() => { try { return JSON.parse(localStorage.getItem(CLIP) || "null"); } catch { return null; } })();
    return [
      { t: "Add a page", i: "page", k: "P", run: () => create("page", at) }, { t: "Add a sticky note", i: "sticky", k: "S", run: () => create("sticky", at) }, { t: "Add text", i: "type", k: "T", run: () => create("text", at) },
      { t: "Add pictures…", i: "image", k: "I", run: () => pickImages(at) }, { t: "Add a link…", i: "link", k: "L", run: () => askLink(at) }, { t: "Add a section", i: "frame", k: "F", run: () => create("frame", at) },
      "-", { t: "Paste here", i: "copy", k: "Ctrl V", disabled: !clip, run: async () => { let used = false; try { const t = await navigator.clipboard.readText(); if (t && !t.startsWith("rkboard:")) { handleData({ files: [], getData: (k) => (k === "text/plain" ? t : "") }, at); used = true; } } catch {} if (!used && clip) pasteData(clip, at); } },
      { t: "Select all", i: "checkbox", k: "Ctrl A", disabled: !S.items.size, run: () => selectAll() },
      "-", { t: "Show everything", i: "fit", k: "Shift 1", run: () => fitAll() }, { t: "Zoom to 100%", i: "search", k: "Ctrl 0", run: () => zoomTo(1) },
      { t: "Undo", i: "undo", k: "Ctrl Z", disabled: !hist.undo.length, run: () => undo() }, { t: "Redo", i: "redo", k: "Ctrl ⇧ Z", disabled: !hist.redo.length, run: () => redo() },
      ...(opts.boardMenu ? ["-", ...opts.boardMenu()] : []),
    ];
  }
  function menuAt(e) {
    rect(); if (S.editing) { const ed = S.els.get(S.editing); if (ed && ed.contains(e.target)) return false; finishEdit(); }
    const hi = hitInfo(e);
    if (!owner) {
      const id = hi.el && hi.el.dataset.id, it = id && S.items.get(id);
      const ro = it && it.t === "page" ? [{ t: "Open page", i: "open", run: () => opts.openPage(it) }, { t: "Download as Markdown", i: "download", run: () => opts.pageDownload && opts.pageDownload(it, "md") }] : it && it.t === "image" ? [{ t: "View full size", i: "eye", run: () => viewImage(it) }, { t: "Download picture", i: "download", run: () => download(it) }] : it && it.t === "link" ? [{ t: "Open link", i: "external", run: () => window.open(it.url, "_blank", "noopener") }] : [];
      M(e.clientX, e.clientY, [...ro, ...(ro.length ? ["-"] : []), { t: "Show everything", i: "fit", run: () => fitAll() }]); return true;
    }
    const id = hi.el && hi.el.dataset.id;
    if (id) {
      const it = S.items.get(id);
      if (it.t === "frame" && !hi.el.querySelector(".bd-frt").contains(e.target) && !S.sel.has(id)) { clearSel(); M(e.clientX, e.clientY, canvasMenu(toW(e.clientX, e.clientY))); return true; }
      if (!S.sel.has(id)) select([id]);
      M(e.clientX, e.clientY, itemMenu()); return true;
    }
    if (hi.lk) { const l = S.links.get(hi.lk.dataset.lid); if (l) { selectLink(l.id); M(e.clientX, e.clientY, linkMenu(l)); } return true; }
    clearSel(); M(e.clientX, e.clientY, canvasMenu(toW(e.clientX, e.clientY))); return true;
  }
  async function copyText(t, quiet) { try { await navigator.clipboard.writeText(t); if (!quiet) toast("Copied"); } catch { if (!quiet) toast("Could not copy"); } }
  function caption(it) {
    const v = prompt("Caption for this picture", it.cap || ""); if (v == null) return;
    upd(it.id, { cap: v.trim().slice(0, 300) || undefined }); done();
  }
  async function refreshLink(it) {
    upd(it.id, { _busy: true }); const meta = opts.unfurl ? await opts.unfurl(it.url) : null; const cur = S.items.get(it.id); if (!cur) return;
    delete cur._busy; if (meta) Object.assign(cur, { title: meta.title || cur.title, desc: meta.desc || "", img: meta.img || "", site: meta.site || cur.site, fav: meta.fav || cur.fav, ...(meta.yt ? { yt: meta.yt } : {}) });
    paint(cur); mark(cur.id); hist.cur = null;
  }
  function stickyToPage(st) {
    const lines = (st.text || "").split("\n"), title = (lines[0] || "").slice(0, 160), rest = lines.slice(1).join("\n").trim();
    const p = make("page", { x: 0, y: 0 }, { x: st.x, y: st.y, w: Math.max(300, st.w), h: Math.max(200, st.h), z: st.z, title, snip: rest.slice(0, 320), cover: null });
    begin(); put(p);
    for (const l of linksOf(st.id)) { touchL(l.id); if (l.a === st.id) l.a = p.id; else l.b = p.id; markL(l.id); }
    remove([st.id]); for (const l of linksOf(p.id)) paintLink(l);
    done(); select([p.id]);
    if (opts.seedPage) opts.seedPage(p.id, rest);
  }

  /* ---------- empty board hint ---------- */
  function refreshEmpty() {
    const empty = !S.items.size; if (emptyEl.hidden !== !empty) emptyEl.hidden = !empty;
    if (empty && !emptyEl.childElementCount) emptyEl.innerHTML = owner ? `<div class="bd-ec"><span class="bd-eci">${I("sparkles", 26)}</span><b>A blank canvas</b><p>Double-click anywhere for a sticky note, drop pictures in, paste a link, or pick a tool below.</p><div class="bd-ek"><span><kbd>S</kbd> Sticky</span><span><kbd>P</kbd> Page</span><span><kbd>T</kbd> Text</span><span><kbd>Space</kbd> + drag to move</span></div></div>` : `<div class="bd-ec"><b>Nothing here yet</b></div>`;
  }

  /* ---------- loading ---------- */
  function load(doc, view) {
    S.items.clear(); S.links.clear(); S.sel.clear(); S.lsel = null;
    itemsL.textContent = ""; framesL.textContent = ""; linkG.textContent = ""; labelsL.textContent = ""; S.els.clear(); S.lels.clear();
    for (const it of Object.values(doc.items || {})) S.items.set(it.id, it);
    for (const l of Object.values(doc.links || {})) S.links.set(l.id, l);
    for (const it of S.items.values()) paint(it);
    for (const l of S.links.values()) paintLink(l);
    refreshEmpty(); rect();
    if (view && view.z && !mobile()) { Object.assign(S.view, view); schedule("view"); } else fitAll({ now: true, max: 1, pad: mobile() ? 24 : 80 });
    schedule("view");
  }
  function applyPending(p) {
    if (!p) return;
    for (const it of p.up || []) { S.items.set(it.id, it); paint(it); Q.up.add(it.id); }
    for (const id of p.del || []) { S.items.delete(id); unpaint(id); Q.del.add(id); }
    for (const l of p.lup || []) { S.links.set(l.id, l); Q.lup.add(l.id); }
    for (const id of p.ldel || []) { S.links.delete(id); Q.ldel.add(id); }
    for (const l of S.links.values()) paintLink(l);
    for (const [id, g] of S.lels) if (!S.links.has(id)) { g.remove(); g.__lb && g.__lb.remove(); S.lels.delete(id); }
    refreshEmpty(); queue();
  }

  return {
    load, applyPending, flush, pending, setTool, fitAll, zoomTo, menuAt, undo, redo, create: (t, at) => create(t, at || center()),
    get view() { return { ...S.view }; }, get items() { return S.items; }, get owner() { return owner; },
    hasPending: () => !!(Q.up.size || Q.del.size || Q.lup.size || Q.ldel.size || Q.busy),
    item: (id) => S.items.get(id),
    // changes from outside (the page window): title, icon, cover, preview text. Not part of undo.
    patchItem(id, patch, { history = false } = {}) { const it = S.items.get(id); if (!it) return; if (history) begin(), touchI(id); Object.assign(it, patch); paint(it); mark(id); if (history) done(); },
    addPageCard(extra = {}) { const o = { ...extra }; delete o.noOpen; const it = make("page", center(), o); put(it); done(); return it; },
    removeItem(id) { remove([id]); done(); },
    snapshot: () => ({ items: Object.fromEntries([...S.items].filter(([, v]) => !v._up).map(([k, v]) => [k, v])), links: Object.fromEntries(S.links), updated: Date.now() }),
    focusItem(id) { const it = S.items.get(id); if (!it) return; select([id]); fitTo(it, { max: Math.max(1, S.view.z) }); },
    select, elOf: (id) => S.els.get(id), rectOf(id) { const it = S.items.get(id); if (!it) return null; rect(); const p = toS(it.x, it.y); return { left: R.left + p.x, top: R.top + p.y, width: it.w * S.view.z, height: it.h * S.view.z }; },
    stageRect: () => rect(),
    destroy() { S.dead = true; ro.disconnect(); cancelAnimationFrame(raf); closeMenu(); clearTimeout(Q.t); },
  };
}
