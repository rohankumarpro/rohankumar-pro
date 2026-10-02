// Design: the owner's own design tool. Frames, shapes, text and pictures on an infinite canvas, exports, and decks
// presented full screen or shared with a client through a private link. Owner only (phones get a view-only version).
// The drawing is design-render.mjs, exports and presenting design-io.mjs, the side panels design-ui.mjs.
import { h, $, $$, esc, api, toast, mobile, confirmBox, Up } from "/js/lib.mjs";
import { R } from "/js/os-ext.mjs";
import { menu, closeMenu } from "/js/board-canvas.mjs";
import { drawNode, localMatrix, kidsOf, shapePath, layoutText, textSize, ready, setImageListener, loadFont, clearLayout, drawAlone, exportImage, DPR, rgba } from "/js/design-render.mjs";
import { present, exportPdf, exportSvg, saveBlob, fileName } from "/js/design-io.mjs";
import { layersPanel, propsPanel, I } from "/js/design-ui.mjs";

for (const href of ["/css/boards.css", "/css/design.css"]) if (!document.querySelector(`link[href="${href}"]`)) document.head.append(h("link", { rel: "stylesheet", href }));

const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }, del(k) { try { localStorage.removeItem(k); } catch {} } };
export const rid = () => Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
const ago = (ts) => { if (!ts) return ""; const s = (Date.now() - ts) / 1000; if (s < 60) return "just now"; if (s < 3600) return Math.round(s / 60) + " min ago"; if (s < 86400) return Math.round(s / 3600) + " h ago"; if (s < 86400 * 7) return Math.round(s / 86400) + " d ago"; return new Date(ts).toLocaleDateString([], { day: "numeric", month: "short" }); };
const title = (d) => (d && d.title && d.title.trim()) || "Untitled design";

/* ---------- frame sizes ---------- */
export const PRESETS = [
  ["Social", [["YouTube thumbnail", 1280, 720], ["Shorts, Reels, TikTok", 1080, 1920], ["Instagram post", 1080, 1350], ["Instagram square", 1080, 1080], ["Instagram story", 1080, 1920], ["X post", 1600, 900], ["LinkedIn post", 1200, 627], ["YouTube banner", 2560, 1440], ["Podcast cover", 3000, 3000]]],
  ["Slides", [["Slide 16:9", 1920, 1080], ["Slide 4:3", 1024, 768]]],
  ["Screens", [["Desktop", 1440, 1024], ["Laptop", 1280, 832], ["Tablet", 834, 1194], ["Phone", 390, 844]]],
  ["Print", [["A4", 595, 842], ["A5", 420, 595], ["Letter", 612, 792], ["Business card", 252, 144]]],
];
const START = [
  { k: "blank", name: "Blank canvas", sub: "Start from nothing" },
  { k: "thumb", name: "YouTube thumbnail", sub: "1280 × 720", f: [1280, 720] },
  { k: "deck", name: "Slide deck", sub: "Three 16:9 slides", deck: true },
  { k: "post", name: "Instagram post", sub: "1080 × 1350", f: [1080, 1350] },
  { k: "story", name: "Shorts and stories", sub: "1080 × 1920", f: [1080, 1920] },
];

const A = { list: null, body: null, ed: null };

export async function designApp(body, slug) {
  A.body = body;
  body.classList.add("dz-host");
  R.handlers.design = (b, s) => route(s);
  window.registerCtx && window.registerCtx("design", (el, e) => {
    const out = []; out.handled = true;
    if (A.ed && el.closest(".dz-stage")) { A.ed.contextMenu(e); return out; }
    if (A.ed && el.closest(".dz-layers")) { A.ed.layerMenu(e); return out; }
    const c = el.closest("[data-design]"); if (c && !A.ed) { cardMenu(e, c.dataset.design); return out; }
    out.handled = false; return [];
  });
  return route(slug || "");
}
async function route(slug) {
  if (A.ed) { await A.ed.close(); A.ed = null; }
  if (slug) return openDesign(slug);
  return home();
}
async function loadList() { const r = await api("/api/designs"); A.list = r.ok ? r.data.designs : A.list || []; return r.ok; }

/* ---------- home: every design, and a quick start ---------- */
async function home() {
  const body = A.body; body.innerHTML = `<div class="dz-home"><div class="app-loading"><span class="rb-spin"></span></div></div>`;
  R.item(body, "", "Design", "replace");
  const ok = await loadList();
  const list = (A.list || []).filter((d) => !d.trashed).sort((a, b) => (b.updated || 0) - (a.updated || 0));
  const bin = (A.list || []).filter((d) => d.trashed);
  body.innerHTML = `<div class="dz-home">
    <header class="dz-hh"><div><h1>Design</h1><p>Thumbnails, slides, posts and anything else you want to make.</p></div></header>
    ${mobile() ? `<p class="dz-note">On a phone, designs open to look at and present. Edit them on a computer.</p>` : `<section class="dz-start">${START.map((s) => `<button class="dz-st" data-start="${s.k}"><span class="dz-stp ${s.k}">${s.f ? `<i style="aspect-ratio:${s.f[0]}/${s.f[1]}"></i>` : s.deck ? "<i></i><i></i><i></i>" : `${I("plus", 26)}`}</span><b>${esc(s.name)}</b><small>${esc(s.sub)}</small></button>`).join("")}</section>`}
    <h2>Your designs <small>${list.length}</small></h2>
    ${!ok && !list.length ? `<p class="dz-note">Could not load your designs. Check the connection and try again.</p>` : ""}
    <div class="dz-grid">${list.map(card).join("") || (ok ? `<p class="dz-note">Nothing yet. Pick a start above.</p>` : "")}</div>
    ${bin.length ? `<details class="dz-bin"><summary>Bin <small>${bin.length}</small></summary><div class="dz-grid">${bin.map(card).join("")}</div></details>` : ""}
  </div>`;
  $$("[data-start]", body).forEach((b) => (b.onclick = () => create(b.dataset.start)));
  $$("[data-design]", body).forEach((c) => {
    c.addEventListener("click", (e) => { if (e.target.closest(".dz-cm")) { cardMenu(e, c.dataset.design); return; } openDesign(c.dataset.design, "push"); });
    c.addEventListener("keydown", (e) => { if (e.key === "Enter") openDesign(c.dataset.design, "push"); });
  });
}
const card = (d) => `<div class="dz-card${d.trashed ? " trashed" : ""}" data-design="${d.id}" tabindex="0" role="button" aria-label="${esc(title(d))}">
  <div class="dz-thumb">${d.thumb ? `<img src="${esc(d.thumb)}" alt="" loading="lazy">` : `<span>${I("palette", 28)}</span>`}</div>
  <div class="dz-cb"><b>${esc(title(d))}</b><small>${d.trashed ? "In the bin" : `${d.count || 0} layers · ${ago(d.updated)}`}${d.share ? " · Shared" : ""}</small></div>
  <button class="dz-cm" aria-label="More" title="More">${I("more", 18)}</button></div>`;
function cardMenu(e, id) {
  const d = (A.list || []).find((x) => x.id === id); if (!d) return;
  const items = d.trashed
    ? [{ t: "Put back", i: "undo", run: async () => { await api("/api/designs?id=" + id, { method: "PUT", body: { trashed: false } }); home(); } }, "-", { t: "Delete for good", i: "trash", danger: true, run: async () => { if (await confirmBox(`Delete “${title(d)}” for good? A last copy is kept in the backups.`, "Delete", true)) { await api("/api/designs?id=" + id, { method: "DELETE" }); home(); } } }]
    : [{ t: "Open", i: "open", run: () => openDesign(id, "push") }, { t: "Rename", i: "pencil", run: async () => { const t = prompt("Name", d.title || ""); if (t != null) { await api("/api/designs?id=" + id, { method: "PUT", body: { title: t } }); home(); } } },
      { t: "Make a copy", i: "copy", run: () => duplicateDesign(id) }, "-", { t: "Move to bin", i: "trash", run: async () => { await api("/api/designs?id=" + id, { method: "PUT", body: { trashed: true } }); home(); } }];
  menu(e.clientX, e.clientY, items);
}
async function duplicateDesign(id) {
  const r = await api("/api/designs?id=" + id); if (!r.ok) return toast("Could not copy it.");
  const map = new Map(Object.keys(r.data.doc.nodes).map((k) => [k, rid()]));
  const nodes = Object.values(r.data.doc.nodes).map((n) => ({ ...n, id: map.get(n.id), parent: n.parent ? map.get(n.parent) : undefined }));
  const c = await api("/api/designs", { method: "POST", body: { title: title(r.data.design) + " (copy)", nodes, slides: (r.data.doc.slides || []).map((s) => map.get(s)).filter(Boolean), bg: r.data.doc.bg } });
  if (c.ok) home(); else toast(c.data.error || "Could not copy it.");
}
async function create(kind) {
  const s = START.find((x) => x.k === kind) || START[0], nodes = [], slides = [];
  const frame = (name, w, hh, x = 0, y = 0) => ({ id: rid(), t: "frame", name, x, y, w, h: hh, z: nodes.length, fills: [{ t: "s", c: "#FFFFFF", a: 1 }], strokes: [], fx: [] });
  if (s.f) nodes.push(frame(s.name, s.f[0], s.f[1]));
  if (s.deck) for (let i = 0; i < 3; i++) { const f = frame("Slide " + (i + 1), 1920, 1080, i * 2020, 0); nodes.push(f); slides.push(f.id);
    nodes.push({ id: rid(), t: "text", name: i ? "Heading" : "Title", parent: f.id, x: 160, y: i ? 140 : 420, w: 1600, h: 120, z: 1, auto: "h", ta: "left", va: "top", tc: "none", fills: [], strokes: [], fx: [], runs: [{ s: i ? "Slide heading" : "Deck title", f: "Inter", w: 700, sz: i ? 88 : 120, c: "#111111", a: 1, ls: -1, lh: 1.1 }] }); }
  const r = await api("/api/designs", { method: "POST", body: { title: s.k === "blank" ? "" : s.name, nodes, slides } });
  if (!r.ok) return toast(r.data.error || "Could not make a new design.");
  openDesign(r.data.design.id, "push", { doc: r.data.doc, meta: r.data.design, fresh: true });
}

/* ================================================================================================================ */
/* the editor                                                                                                       */
/* ================================================================================================================ */
async function openDesign(id, mode = "push", pre) {
  if (A.ed) { await A.ed.close(); A.ed = null; }
  const body = A.body;
  body.innerHTML = `<div class="dz-home"><div class="app-loading"><span class="rb-spin"></span></div></div>`;
  let meta = pre && pre.meta, doc = pre && pre.doc;
  if (!doc) {
    const r = await api("/api/designs?id=" + id);
    if (!r.ok) { body.innerHTML = `<div class="dz-home"><p class="dz-note">${r.status === 404 ? "This design no longer exists." : "Could not open this design."}</p><button class="btn tonal" data-back>Back to designs</button></div>`; $("[data-back]", body).onclick = () => home(); return; }
    meta = r.data.design; doc = r.data.doc;
  }
  R.item(body, id, `${title(meta)} — Design`, mode);
  A.ed = editor(body, id, meta, doc, pre && pre.fresh);
}

function editor(body, id, meta, doc, fresh) {
  const ro = mobile();
  body.innerHTML = `<div class="dz${ro ? " ro" : ""}">
    <header class="dz-top">
      <button class="dz-ib" data-a="back" title="All designs" aria-label="All designs">${I("chevron-left", 20)}</button>
      <input class="dz-name" value="${esc(meta.title || "")}" placeholder="Untitled design" aria-label="Design name" ${ro ? "readonly" : ""}>
      <span class="dz-status" aria-live="polite"></span>
      ${ro ? "" : `<div class="dz-tools" role="toolbar" aria-label="Tools">
        ${tb("move", "cursor", "Move", "V")}${tb("frame", "frame", "Frame", "F")}${tb("rect", "dz-rect", "Rectangle", "R")}${tb("ellipse", "dz-ell", "Ellipse", "O")}${tb("line", "minus", "Line", "L")}
        <button class="dz-tb dz-more" data-a="shapes" title="More shapes" aria-label="More shapes">${I("chevron-down", 16)}</button>${tb("text", "type", "Text", "T")}${tb("image", "image", "Place a picture", "Shift Ctrl K")}${tb("hand", "hand", "Hand", "H")}
      </div>`}
      <div class="dz-right">
        <button class="dz-zoom" data-a="zoom" title="Zoom">100%</button>
        <button class="dz-btn" data-a="share" title="Share a view-only link">${I("link", 18)}<span>Share</span></button>
        <button class="dz-btn primary" data-a="present" title="Present (Ctrl Alt Enter)">${I("play", 18)}<span>Present</span></button>
      </div>
    </header>
    <aside class="dz-left">${ro ? "" : `<div class="dz-tabs" role="tablist"><button role="tab" data-tab="layers" aria-selected="true">Layers</button><button role="tab" data-tab="slides" aria-selected="false">Slides</button></div>`}<div class="dz-layers"></div></aside>
    <main class="dz-stage" tabindex="0" data-own-keys aria-label="Design canvas"><canvas class="dz-cv"></canvas><div class="dz-over"></div></main>
    <aside class="dz-props"></aside>
  </div>`;
  const root = $(".dz", body), stage = $(".dz-stage", body), cv = $(".dz-cv", body), ctx = cv.getContext("2d"), over = $(".dz-over", body);
  const layersEl = $(".dz-layers", body), propsEl = $(".dz-props", body), stEl = $(".dz-status", body), zoomEl = $("[data-a=zoom]", body);

  /* ---------- state ---------- */
  const D = { nodes: doc.nodes || {}, slides: doc.slides || [], bg: doc.bg || "#E9EBEE", sw: doc.sw || [] };
  const S = { sel: new Set(), hover: null, tool: "move", view: ls.get("dzView:" + id, null) || { x: 0, y: 0, z: 1 }, drag: null, edit: null, scope: null, space: false, guides: [], measure: null, dirty: true, tab: "layers", dead: false };
  let kidsFn = kidsOf(D.nodes), structDirty = false;
  const kids = (pid) => { if (structDirty) { kidsFn = kidsOf(D.nodes); structDirty = false; } return kidsFn(pid); };
  const restructure = () => { structDirty = true; };
  const N = (i) => D.nodes[i];
  const parentOf = (n) => (n && n.parent ? D.nodes[n.parent] : null);
  const ancestors = (n) => { const out = []; let p = parentOf(n); while (p) { out.push(p); p = parentOf(p); } return out; };
  const isDesc = (n, anc) => ancestors(n).some((a) => a.id === anc.id);
  const worldM = (n) => { const chain = []; let x = n; while (x) { chain.unshift(x); x = parentOf(x); } return chain.reduce((m, y) => m.multiply(localMatrix(y)), new DOMMatrix()); };
  const parentM = (n) => (n.parent && D.nodes[n.parent] ? worldM(D.nodes[n.parent]) : new DOMMatrix());
  const corners = (n, m = worldM(n)) => [[0, 0], [n.w, 0], [n.w, n.h], [0, n.h]].map(([x, y]) => m.transformPoint(new DOMPoint(x, y)));
  const aabb = (pts) => { const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y); const x = Math.min(...xs), y = Math.min(...ys); return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }; };
  const boxOf = (n) => aabb(corners(n));
  const selNodes = () => [...S.sel].map(N).filter(Boolean);
  // the selection without anything already inside another selected node
  const selTops = () => { const s = selNodes(); return s.filter((n) => !ancestors(n).some((a) => S.sel.has(a.id))); };
  const selBox = () => { const s = selTops(); if (!s.length) return null; return aabb(s.flatMap((n) => corners(n))); };
  const nextZ = (pid) => { const l = kids(pid || ""); return l.length ? Math.max(...l.map((x) => x.z || 0)) + 1 : 0; };

  /* ---------- history: every change is one step to undo ---------- */
  const H = { undo: [], redo: [], cur: null };
  function begin() { if (!H.cur) H.cur = { n: new Map(), slides: null, bg: null }; }
  function touch(i) { begin(); if (!H.cur.n.has(i)) H.cur.n.set(i, clone(D.nodes[i] || null)); }
  function touchDoc(k) { begin(); if (H.cur[k] == null) H.cur[k] = clone(D[k]); }
  function commit() {
    const c = H.cur; H.cur = null; if (!c) return;
    const e = { n: [], slides: null, bg: null };
    for (const [i, before] of c.n) { const after = clone(D.nodes[i] || null); if (JSON.stringify(before) !== JSON.stringify(after)) { e.n.push([i, before, after]); mark(i); } }
    if (c.slides && JSON.stringify(c.slides) !== JSON.stringify(D.slides)) { e.slides = [c.slides, clone(D.slides)]; Q.meta = true; }
    if (c.bg != null && c.bg !== D.bg) { e.bg = [c.bg, D.bg]; Q.meta = true; }
    if (e.n.length || e.slides || e.bg) { H.undo.push(e); if (H.undo.length > 300) H.undo.shift(); H.redo.length = 0; queue(); }
    panels(); paint();
  }
  function replay(e, back) {
    for (const [i, b, a] of e.n) { const v = back ? b : a; if (v) D.nodes[i] = clone(v); else { delete D.nodes[i]; S.sel.delete(i); } mark(i); }
    if (e.slides) { D.slides = clone(back ? e.slides[0] : e.slides[1]); Q.meta = true; }
    if (e.bg) { D.bg = back ? e.bg[0] : e.bg[1]; Q.meta = true; }
    restructure(); queue(); panels(); paint();
  }
  function undo() { endText(); const e = H.undo.pop(); if (e) { replay(e, true); H.redo.push(e); } }
  function redo() { endText(); const e = H.redo.pop(); if (e) { replay(e, false); H.undo.push(e); } }

  /* ---------- saving ---------- */
  const Q = { up: new Set(), del: new Set(), meta: false, t: 0, busy: false, again: false, rev: doc.rev || 0, thumbT: 0, thumbAt: 0, fails: 0 };
  function mark(i) { if (D.nodes[i]) { Q.up.add(i); Q.del.delete(i); } else { Q.del.add(i); Q.up.delete(i); } }
  const pendKey = "dzPend:" + id;
  function persistPend() { if (!Q.up.size && !Q.del.size && !Q.meta) { ls.del(pendKey); return; } ls.set(pendKey, { up: [...Q.up].map(N).filter(Boolean), del: [...Q.del], meta: Q.meta ? { slides: D.slides, bg: D.bg, sw: D.sw } : null, rev: Q.rev }); }
  function queue() { status("unsaved"); persistPend(); clearTimeout(Q.t); Q.t = setTimeout(flush, 700); clearTimeout(Q.thumbT); Q.thumbT = setTimeout(makeThumb, 6000); }
  async function flush(extra) {
    clearTimeout(Q.t); if (ro) return true;
    if (Q.busy) { Q.again = true; return false; }
    if (!Q.up.size && !Q.del.size && !Q.meta && !extra) return true;
    Q.busy = true; status("saving");
    const up = [...Q.up], del = [...Q.del], meta = Q.meta; Q.up.clear(); Q.del.clear(); Q.meta = false;
    const body2 = { up: up.map(N).filter(Boolean), del, base: Q.rev, ...(meta ? { slides: D.slides, bg: D.bg, sw: D.sw } : {}), ...(extra || {}) };
    let r = await api(`/api/designs?id=${id}&a=patch`, { method: "POST", body: body2 });
    if (r.status === 409 && r.data.stale) { // an older copy was read: send everything this editor holds
      r = await api(`/api/designs?id=${id}&a=patch`, { method: "POST", body: { full: true, nodes: Object.values(D.nodes), slides: D.slides, bg: D.bg, sw: D.sw, base: Q.rev, ...(extra || {}) } });
    }
    Q.busy = false;
    if (r.ok) { Q.rev = r.data.rev; Q.fails = 0; persistPend(); status(Q.up.size || Q.del.size ? "unsaved" : "saved"); }
    else { up.forEach((i) => Q.up.add(i)); del.forEach((i) => Q.del.add(i)); if (meta) Q.meta = true; persistPend(); Q.fails++; status(r.status === 0 ? "offline" : "error"); clearTimeout(Q.t); Q.t = setTimeout(flush, Math.min(30000, 2000 * Q.fails)); }
    if (Q.again) { Q.again = false; flush(); }
    return r.ok;
  }
  function status(k) { const t = { saved: "Saved", saving: "Saving…", unsaved: "", offline: "Offline. Kept on this device.", error: "Not saved yet. Retrying…" }[k] ?? ""; stEl.textContent = t; stEl.dataset.k = k; }
  // a small picture for the design list: the first slide or frame
  async function makeThumb() {
    if (ro || S.dead) return;
    const frames = slideIds(); const fid = frames[0];
    let url = "";
    try {
      if (fid) { const n = N(fid), k = 420 / Math.max(Math.abs(n.w), Math.abs(n.h)); const b = await exportImage(D.nodes, fid, { scale: k, type: "image/jpeg", quality: 0.72, bg: "#FFFFFF" }); url = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); }); }
    } catch {}
    if (url && url.length < 110000) flush({ thumb: url });
  }
  // what this device had not saved when it last closed
  { const p = ls.get(pendKey, null); if (p && !ro) { for (const n of p.up || []) { D.nodes[n.id] = n; Q.up.add(n.id); } for (const i of p.del || []) { delete D.nodes[i]; Q.del.add(i); } if (p.meta) { D.slides = p.meta.slides || D.slides; D.bg = p.meta.bg || D.bg; D.sw = p.meta.sw || D.sw; Q.meta = true; } restructure(); if (Q.up.size || Q.del.size || Q.meta) setTimeout(flush, 300); } }

  /* ---------- view ---------- */
  let rect = stage.getBoundingClientRect();
  const sizeCanvas = () => { rect = stage.getBoundingClientRect(); const d = DPR(); cv.width = Math.max(1, Math.round(rect.width * d)); cv.height = Math.max(1, Math.round(rect.height * d)); cv.style.width = rect.width + "px"; cv.style.height = rect.height + "px"; paint(); };
  const rs = new ResizeObserver(sizeCanvas); rs.observe(stage);
  const toW = (cx, cy) => ({ x: (cx - rect.left - S.view.x) / S.view.z, y: (cy - rect.top - S.view.y) / S.view.z });
  const toS = (x, y) => ({ x: x * S.view.z + S.view.x, y: y * S.view.z + S.view.y });
  const viewM = () => { const d = DPR(), z = S.view.z; return new DOMMatrix([d * z, 0, 0, d * z, d * S.view.x, d * S.view.y]); };
  let viewSaveT = 0;
  function setView(v) { Object.assign(S.view, v); S.view.z = clamp(S.view.z, 0.02, 64); zoomEl.textContent = Math.round(S.view.z * 100) + "%"; clearTimeout(viewSaveT); viewSaveT = setTimeout(() => ls.set("dzView:" + id, S.view), 400); paint(); placeTextEdit(); }
  function zoomAt(f, cx, cy) { const w = toW(cx, cy), z = clamp(S.view.z * f, 0.02, 64); setView({ z, x: cx - rect.left - w.x * z, y: cy - rect.top - w.y * z }); }
  function fitTo(b, pad = 80, max = 1) { if (!b || !rect.width) return; const z = clamp(Math.min((rect.width - pad * 2) / Math.max(1, b.w), (rect.height - pad * 2) / Math.max(1, b.h), max), 0.02, 64); setView({ z, x: rect.width / 2 - (b.x + b.w / 2) * z, y: rect.height / 2 - (b.y + b.h / 2) * z }); }
  const allBox = () => { const tops = kids(""); return tops.length ? aabb(tops.flatMap((n) => corners(n))) : null; };

  /* ---------- drawing ---------- */
  let raf = 0;
  function paint() { S.dirty = true; if (!raf) raf = requestAnimationFrame(draw); }
  setImageListener(() => paint());
  const onFonts = () => { clearLayout(); for (const n of Object.values(D.nodes)) if (n.t === "text" && n.auto !== "fixed") { const s = textSize(n); if (Math.abs(s.w - n.w) > 0.5 || Math.abs(s.h - n.h) > 0.5) { n.w = s.w; n.h = s.h; } } paint(); };
  document.fonts.addEventListener("loadingdone", onFonts);
  function draw() {
    raf = 0; if (S.dead) return;
    const d = DPR(), W = cv.width, Hh = cv.height, z = S.view.z;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = D.bg || "#E9EBEE"; ctx.fillRect(0, 0, W, Hh);
    const vm = viewM(), visW = { x: -S.view.x / z, y: -S.view.y / z, w: rect.width / z, h: rect.height / z };
    const edit = S.edit && S.edit.id;
    for (const n of kids("")) {
      const b = boxOf(n); if (b.x > visW.x + visW.w || b.y > visW.y + visW.h || b.x + b.w < visW.x || b.y + b.h < visW.y) continue;
      drawNode(ctx, edit ? hideEditing(n) : n, vm.multiply(localMatrix(n)), edit ? (pid) => kids(pid).map(hideEditing) : kids);
    }
    overlay(d, z);
  }
  const hideEditing = (n) => (S.edit && n.id === S.edit.id ? { ...n, hide: 1 } : n);
  function overlay(d, z) {
    ctx.setTransform(d, 0, 0, d, 0, 0);
    const blue = "#0D99FF";
    // frame names above top-level frames
    ctx.font = "500 11px Inter, system-ui, sans-serif"; ctx.textBaseline = "bottom";
    for (const n of kids("")) if (n.t === "frame") { const p = toS(n.x, n.y); ctx.fillStyle = S.sel.has(n.id) ? blue : "rgba(60,64,72,.72)"; ctx.fillText(n.name || "Frame", p.x, p.y - 4); }
    // hover outline
    if (S.hover && !S.sel.has(S.hover) && !S.drag && N(S.hover)) outline(N(S.hover), blue, 1.5);
    // selection
    const s = selTops();
    if (s.length && !S.edit) {
      for (const n of selNodes()) outline(n, blue, 1);
      if (s.length === 1 && s[0].t === "line") { const n = s[0], m = worldM(n), a = m.transformPoint(new DOMPoint(0, 0)), b = m.transformPoint(new DOMPoint(n.w, n.h)); [a, b].forEach((p) => handle(toS(p.x, p.y))); }
      else {
        const one = s.length === 1 ? s[0] : null, pts = one ? corners(one).map((p) => toS(p.x, p.y)) : (() => { const b = selBox(); return [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]].map(([x, y]) => toS(x, y)); })();
        ctx.strokeStyle = blue; ctx.lineWidth = 1; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.stroke();
        if (!(one && one.lock)) pts.forEach(handle);
        // size under the selection
        const b = one ? { w: Math.abs(one.w), h: Math.abs(one.h) } : selBox(), lowest = pts.reduce((a, p) => (p.y > a.y ? p : a), pts[0]), mid = pts.reduce((t, p) => t + p.x, 0) / 4;
        const label = `${round(b.w)} × ${round(b.h)}`; ctx.font = "600 11px Inter, system-ui, sans-serif"; const tw = ctx.measureText(label).width + 12;
        ctx.fillStyle = blue; roundBox(mid - tw / 2, lowest.y + 8, tw, 18, 4); ctx.fill(); ctx.fillStyle = "#fff"; ctx.textBaseline = "middle"; ctx.fillText(label, mid - tw / 2 + 6, lowest.y + 17);
      }
    }
    // smart guides and distances
    ctx.strokeStyle = "#F24822"; ctx.fillStyle = "#F24822"; ctx.lineWidth = 1;
    for (const g of S.guides) { const a = toS(g.x1, g.y1), b = toS(g.x2, g.y2); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); if (g.label) pill(g.label, (a.x + b.x) / 2, (a.y + b.y) / 2); }
    if (S.measure) for (const g of S.measure) { const a = toS(g.x1, g.y1), b = toS(g.x2, g.y2); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); pill(g.label, (a.x + b.x) / 2, (a.y + b.y) / 2); }
    // the box being drawn or dragged out
    if (S.drag && S.drag.marq) { const m = S.drag.marq, a = toS(m.x, m.y); ctx.fillStyle = "rgba(13,153,255,.08)"; ctx.strokeStyle = blue; ctx.fillRect(a.x, a.y, m.w * z, m.h * z); ctx.strokeRect(a.x + 0.5, a.y + 0.5, m.w * z, m.h * z); }
  }
  const round = (v) => Math.round(v * 100) / 100;
  function roundBox(x, y, w, hh, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + hh, r); ctx.arcTo(x + w, y + hh, x, y + hh, r); ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function pill(t, x, y) { ctx.font = "600 10.5px Inter, system-ui, sans-serif"; const w = ctx.measureText(t).width + 10; ctx.fillStyle = "#F24822"; roundBox(x - w / 2, y - 8, w, 16, 3); ctx.fill(); ctx.fillStyle = "#fff"; ctx.textBaseline = "middle"; ctx.fillText(t, x - w / 2 + 5, y); ctx.fillStyle = "#F24822"; }
  function outline(n, col, w) {
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w;
    const m = new DOMMatrix([DPR(), 0, 0, DPR(), 0, 0]).multiply(new DOMMatrix([S.view.z, 0, 0, S.view.z, S.view.x, S.view.y])).multiply(worldM(n));
    if (n.t === "text" || n.t === "group" || n.t === "frame" || n.t === "bool") { const pts = corners(n).map((p) => toS(p.x, p.y)); ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.stroke(); }
    else { ctx.setTransform(m); ctx.lineWidth = (w * DPR()) / Math.hypot(m.a, m.b); ctx.stroke(shapePath(n)); }
    ctx.restore();
  }
  function handle(p) { ctx.fillStyle = "#fff"; ctx.strokeStyle = "#0D99FF"; ctx.lineWidth = 1; ctx.beginPath(); ctx.rect(Math.round(p.x) - 3.5, Math.round(p.y) - 3.5, 7, 7); ctx.fill(); ctx.stroke(); }

  /* ---------- finding what is under the pointer ---------- */
  const probe = document.createElement("canvas").getContext("2d");
  function hitNode(n, wx, wy, m) {
    if (n.hide) return false;
    const inv = m.inverse(), p = inv.transformPoint(new DOMPoint(wx, wy));
    if (n.t === "text" || n.t === "frame" || n.t === "group" || n.t === "bool") return p.x >= Math.min(0, n.w) && p.x <= Math.max(0, n.w) && p.y >= Math.min(0, n.h) && p.y <= Math.max(0, n.h);
    const path = shapePath(n), tol = 6 / S.view.z / Math.hypot(m.a, m.b);
    probe.setTransform(1, 0, 0, 1, 0, 0); probe.lineWidth = Math.max(tol * 2, ...(n.strokes || []).map((s) => s.w || 0));
    if (n.t === "line") return probe.isPointInStroke(path, p.x, p.y);
    const filled = (n.fills || []).some((f) => f.v !== false) || !(n.strokes || []).length;
    return (filled && probe.isPointInPath(path, p.x, p.y)) || probe.isPointInStroke(path, p.x, p.y);
  }
  // the deepest node under a point, top-most first
  function deepAt(wx, wy, list = kids(""), m = new DOMMatrix(), clipOk = true) {
    for (let i = list.length - 1; i >= 0; i--) {
      const n = list[i]; if (n.hide) continue;
      const mm = m.multiply(localMatrix(n));
      const inside = hitNode(n, wx, wy, mm);
      if ((n.t === "frame" || n.t === "group" || n.t === "bool") && (inside || (n.t !== "frame" || n.clip === false))) {
        const c = n.t === "bool" ? null : deepAt(wx, wy, kids(n.id), mm, n.t === "frame" ? n.clip !== false : clipOk);
        if (c) return c;
      }
      if (inside) return n;
    }
    return null;
  }
  // what a click selects: groups and boolean shapes are picked as a whole until you go inside them (double-click)
  function pickAt(wx, wy, deep) {
    let n = deepAt(wx, wy); if (!n) return null;
    if (deep) return n;
    const climb = (x) => { let c = x; for (let p = parentOf(c); p; p = parentOf(p)) { if ((p.t === "group" || p.t === "bool") && !(S.scope && (S.scope === p.id || isDesc(N(S.scope), p)))) c = p; } return c; };
    n = climb(n);
    // an empty spot of a top-level frame that has things inside is open canvas (drag a box), like in Figma
    if (n.t === "frame" && !n.parent && kids(n.id).length && !S.sel.has(n.id)) return { frameBg: n };
    return n;
  }
  const labelAt = (cx, cy) => { for (const n of [...kids("")].reverse()) if (n.t === "frame") { const p = toS(n.x, n.y); ctx.font = "500 11px Inter"; const w = ctx.measureText(n.name || "Frame").width; if (cx - rect.left >= p.x && cx - rect.left <= p.x + w && cy - rect.top >= p.y - 18 && cy - rect.top <= p.y - 2) return n; } return null; };
  function handleAt(cx, cy) {
    const s = selTops(); if (!s.length || S.edit) return null;
    const px = cx - rect.left, py = cy - rect.top;
    if (s.length === 1 && s[0].t === "line") { const n = s[0], m = worldM(n), ends = [m.transformPoint(new DOMPoint(0, 0)), m.transformPoint(new DOMPoint(n.w, n.h))].map((p) => toS(p.x, p.y)); for (let i = 0; i < 2; i++) if (Math.hypot(ends[i].x - px, ends[i].y - py) < 8) return { end: i }; return null; }
    const one = s.length === 1 ? s[0] : null; if (one && one.lock) return null;
    const pts = one ? corners(one).map((p) => toS(p.x, p.y)) : (() => { const b = selBox(); return [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]].map(([x, y]) => toS(x, y)); })();
    const names = ["nw", "ne", "se", "sw"];
    for (let i = 0; i < 4; i++) if (Math.hypot(pts[i].x - px, pts[i].y - py) < 7) return { hk: names[i] };
    const edges = [["n", 0, 1], ["e", 1, 2], ["s", 2, 3], ["w", 3, 0]];
    for (const [k, a, b] of edges) { const A2 = pts[a], B = pts[b], L = Math.hypot(B.x - A2.x, B.y - A2.y); if (L < 1) continue; const t = ((px - A2.x) * (B.x - A2.x) + (py - A2.y) * (B.y - A2.y)) / (L * L); if (t < 0.1 || t > 0.9) continue; const qx = A2.x + t * (B.x - A2.x), qy = A2.y + t * (B.y - A2.y); if (Math.hypot(qx - px, qy - py) < 5) return { hk: k }; }
    for (let i = 0; i < 4; i++) { const dd = Math.hypot(pts[i].x - px, pts[i].y - py); if (dd >= 7 && dd < 22) return { rot: true }; }
    return null;
  }
  const CUR = { nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize", n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize" };

  /* ---------- making things ---------- */
  const DEF = { rect: "#D9D9D9", ellipse: "#D9D9D9", polygon: "#D9D9D9", star: "#D9D9D9", frame: "#FFFFFF" };
  const NAMES = { frame: "Frame", rect: "Rectangle", ellipse: "Ellipse", line: "Line", polygon: "Polygon", star: "Star", text: "Text", group: "Group", bool: "Union" };
  function newName(t) { const base = NAMES[t] || "Layer", n = Object.values(D.nodes).filter((x) => x.t === t).length + 1; return t === "frame" || t === "group" ? `${base} ${n}` : base; }
  function make(t, x, y, w, hh, extra = {}) {
    const n = { id: rid(), t, name: newName(t), x, y, w, h: hh, z: 0, fills: DEF[t] ? [{ t: "s", c: DEF[t], a: 1 }] : [], strokes: t === "line" ? [{ c: "#1E1E1E", a: 1, w: 2, al: "c" }] : [], fx: [], ...extra };
    if (t === "polygon") n.n = 3; if (t === "star") { n.n = 5; n.ratio = 0.45; } if (t === "line") { n.ea = "none"; n.eb = extra.eb || "none"; }
    if (t === "text") Object.assign(n, { fills: [], auto: extra.auto || "w", ta: "left", va: "top", tc: "none", runs: extra.runs || [{ s: "", f: lastFont.f, w: lastFont.w, sz: lastFont.sz, c: "#1E1E1E", a: 1, ls: 0, lh: 0 }] });
    return n;
  }
  const lastFont = ls.get("dzFont", { f: "Inter", w: 400, sz: 24 });
  // put a node into a parent (keeping where it sits on screen)
  function adopt(n, pid) {
    const before = worldM(n), P = pid ? N(pid) : null, pm = P ? worldM(P) : new DOMMatrix();
    const lm = pm.inverse().multiply(before); // the node's own transform, seen from the new parent
    const rot = Math.atan2(lm.b, lm.a) * 180 / Math.PI;
    const c = lm.transformPoint(new DOMPoint(n.w / 2, n.h / 2));
    n.parent = pid || undefined; if (!pid) delete n.parent;
    n.rot = n.t === "line" ? 0 : Math.round(rot * 100) / 100; if (!n.rot) delete n.rot;
    n.x = c.x - n.w / 2; n.y = c.y - n.h / 2; n.z = nextZ(pid);
    restructure();
  }
  function insert(n, pid) { n.parent = pid || undefined; if (!pid) delete n.parent; n.z = nextZ(pid); touch(n.id); D.nodes[n.id] = n; restructure(); }
  // the frame under a point that a new or moved thing should go into
  function frameAt(wx, wy, not) {
    const walk = (list, m) => { for (let i = list.length - 1; i >= 0; i--) { const f = list[i]; if (f.hide || (not && (not.has(f.id) || [...not].some((x) => N(x) && isDesc(f, N(x)))))) continue; const mm = m.multiply(localMatrix(f)); if (f.t === "frame" && hitNode(f, wx, wy, mm)) return walk(kids(f.id), mm) || f; if (f.t === "group") { const g = walk(kids(f.id), mm); if (g) return g; } } return null; };
    return walk(kids(""), new DOMMatrix());
  }
  // groups and boolean shapes are as big as what they hold
  function fitGroup(gid) {
    const g = N(gid); if (!g || (g.t !== "group" && g.t !== "bool")) return;
    const list = kids(gid); if (!list.length) { touch(gid); delete D.nodes[gid]; restructure(); return; }
    const pts = list.flatMap((c) => corners(c, localMatrix(c))), b = aabb(pts);
    if (Math.abs(b.x) < 0.01 && Math.abs(b.y) < 0.01 && Math.abs(b.w - g.w) < 0.01 && Math.abs(b.h - g.h) < 0.01) return;
    touch(gid); const m = localMatrix(g), np = m.transformPoint(new DOMPoint(b.x, b.y)), op = m.transformPoint(new DOMPoint(0, 0));
    for (const c of list) { touch(c.id); c.x -= b.x; c.y -= b.y; }
    g.w = b.w; g.h = b.h;
    // keep the group where it was on screen (also when turned)
    const m2 = localMatrix({ ...g, x: 0, y: 0 }), p2 = m2.transformPoint(new DOMPoint(0, 0));
    g.x += np.x - op.x - (p2.x - 0); g.y += np.y - op.y - (p2.y - 0);
    if (!g.rot) { g.x = Math.round((g.x) * 100) / 100; g.y = Math.round(g.y * 100) / 100; }
    if (g.parent) fitGroup(g.parent);
  }
  const fitParents = (list) => { const ps = new Set(list.map((n) => n && n.parent).filter(Boolean)); for (const p of ps) fitGroup(p); };

  /* ---------- pointer ---------- */
  stage.addEventListener("pointerdown", down);
  stage.addEventListener("pointermove", (e) => { if (!S.drag) hoverAt(e); });
  stage.addEventListener("pointerleave", () => { if (S.hover) { S.hover = null; paint(); } });
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  stage.addEventListener("dblclick", dbl);
  stage.addEventListener("wheel", wheel, { passive: false });
  function hoverAt(e) {
    if (ro) return;
    const hd = handleAt(e.clientX, e.clientY);
    stage.style.cursor = S.space || S.tool === "hand" ? "grab" : hd ? (hd.rot ? "alias" : hd.end != null ? "move" : CUR[hd.hk] || "default") : ["move"].includes(S.tool) ? "default" : "crosshair";
    const w = toW(e.clientX, e.clientY), p = labelAt(e.clientX, e.clientY) || pickAt(w.x, w.y);
    const id2 = p && !p.frameBg ? p.id : null;
    if (id2 !== S.hover) { S.hover = id2; paint(); }
    if (e.altKey && S.sel.size) measureTo(id2); else if (S.measure) { S.measure = null; paint(); }
  }
  function down(e) {
    if (S.dead) return; closeMenu(); rect = stage.getBoundingClientRect();
    if (e.button === 2) return;
    if (S.edit && !e.target.closest(".dz-te")) endText();
    if (e.target.closest(".dz-te")) return;
    stage.focus({ preventScroll: true });
    const w = toW(e.clientX, e.clientY);
    if (e.button === 1 || S.space || S.tool === "hand" || ro) return startPan(e);
    if (["rect", "ellipse", "line", "frame", "polygon", "star", "text", "arrow"].includes(S.tool)) return startCreate(e, w);
    const hd = handleAt(e.clientX, e.clientY);
    if (hd) { if (hd.rot) return startRotate(e, w); if (hd.end != null) return startLineEnd(e, hd.end); return startResize(e, w, hd.hk); }
    const lab = labelAt(e.clientX, e.clientY);
    const p = lab || pickAt(w.x, w.y, e.ctrlKey || e.metaKey);
    if (!p || p.frameBg) { if (!e.shiftKey) setSel([]); return startMarquee(e, w); }
    if (e.shiftKey) { if (S.sel.has(p.id)) { S.sel.delete(p.id); selChanged(); return; } S.sel.add(p.id); selChanged(); }
    else if (!S.sel.has(p.id)) setSel([p.id]);
    if (selTops().some((n) => n.lock)) return;
    startMove(e, w);
  }
  function capture(e) { try { stage.setPointerCapture(e.pointerId); } catch {} }
  function startPan(e) { S.drag = { k: "pan", sx: e.clientX, sy: e.clientY, vx: S.view.x, vy: S.view.y }; stage.style.cursor = "grabbing"; capture(e); }
  function startMarquee(e, w) { S.drag = { k: "marq", w0: w, base: e.shiftKey ? new Set(S.sel) : new Set(), marq: { x: w.x, y: w.y, w: 0, h: 0 } }; capture(e); }
  function startMove(e, w) {
    begin();
    let ids = selTops().map((n) => n.id);
    if (e.altKey) { ids = duplicateNodes(ids, 0, true); } // Alt-drag leaves a copy behind
    ids.forEach(touch);
    const pm = new Map(ids.map((i) => [i, parentM(N(i)).inverse()]));
    S.drag = { k: "move", w0: w, sx: e.clientX, sy: e.clientY, started: false, ids, start: new Map(ids.map((i) => [i, { x: N(i).x, y: N(i).y }])), pm, box0: selBox() };
    capture(e);
  }
  function startCreate(e, w) {
    begin();
    const t = S.tool === "arrow" ? "line" : S.tool;
    const into = t === "frame" && !e.altKey ? frameAt(w.x, w.y) : frameAt(w.x, w.y);
    S.drag = { k: "create", t, arrow: S.tool === "arrow", w0: w, sx: e.clientX, sy: e.clientY, id: null, into: into ? into.id : null };
    capture(e);
  }
  function startResize(e, w, hk) {
    begin(); const s = selTops(); s.forEach((n) => touch(n.id)); s.forEach((n) => kidsDeep(n.id).forEach(touch));
    const one = s.length === 1 ? s[0] : null;
    S.drag = { k: "resize", hk, w0: w, one: one ? one.id : null, start: new Map(s.map((n) => [n.id, clone(n)])), deep: new Map(s.flatMap((n) => kidsDeep(n.id)).map((i) => [i, clone(N(i))])), box0: selBox(), pm: one ? parentM(one) : null };
    capture(e);
  }
  function startRotate(e, w) {
    begin(); const s = selTops(); s.forEach((n) => touch(n.id));
    const b = selBox(), c = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    S.drag = { k: "rotate", c, a0: Math.atan2(w.y - c.y, w.x - c.x), start: new Map(s.map((n) => [n.id, { ...clone(n), wc: worldM(n).transformPoint(new DOMPoint(n.w / 2, n.h / 2)) }])) };
    capture(e);
  }
  function startLineEnd(e, end) { const n = selTops()[0]; begin(); touch(n.id); S.drag = { k: "lineEnd", id: n.id, end, start: clone(n), pm: parentM(n) }; capture(e); }
  const kidsDeep = (pid) => { const out = []; const walk = (p) => { for (const c of kids(p)) { out.push(c.id); walk(c.id); } }; walk(pid); return out; };

  function move(e) {
    const d = S.drag; if (!d) return;
    const w = toW(e.clientX, e.clientY);
    if (d.k === "pan") { setView({ x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy }); return; }
    if (d.k === "marq") {
      const x = Math.min(d.w0.x, w.x), y = Math.min(d.w0.y, w.y); d.marq = { x, y, w: Math.abs(w.x - d.w0.x), h: Math.abs(w.y - d.w0.y) };
      const r2 = d.marq, ids = new Set(d.base);
      // inside a frame the box picks that frame's things; on open canvas, top-level things
      const scopeList = S.scope ? kids(S.scope) : (() => { const f = frameAt(d.w0.x, d.w0.y); return f && !f.parent ? kids(f.id) : kids(""); })();
      for (const n of scopeList) { if (n.hide || n.lock) continue; const b = boxOf(n); if (b.x < r2.x + r2.w && b.x + b.w > r2.x && b.y < r2.y + r2.h && b.y + b.h > r2.y) ids.add(n.id); }
      S.sel = ids; selChanged(true); paint(); return;
    }
    if (d.k === "create") {
      let dx = w.x - d.w0.x, dy = w.y - d.w0.y;
      if (!d.id && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 3) return;
      if (e.shiftKey && d.t !== "line") { const m = Math.max(Math.abs(dx), Math.abs(dy)); dx = Math.sign(dx || 1) * m; dy = Math.sign(dy || 1) * m; }
      if (e.shiftKey && d.t === "line") { const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4), L = Math.hypot(dx, dy); dx = Math.cos(a) * L; dy = Math.sin(a) * L; }
      let x = d.t === "line" ? d.w0.x : Math.min(d.w0.x, d.w0.x + dx), y = d.t === "line" ? d.w0.y : Math.min(d.w0.y, d.w0.y + dy), ww = d.t === "line" ? dx : Math.abs(dx), hh = d.t === "line" ? dy : Math.abs(dy);
      if (e.altKey && d.t !== "line") { x = d.w0.x - Math.abs(dx); y = d.w0.y - Math.abs(dy); ww *= 2; hh *= 2; }
      if (!d.id) { const n = make(d.t, x, y, Math.max(1, ww), Math.max(1, hh), d.t === "text" ? { auto: "h" } : d.arrow ? { eb: "arrow" } : {}); if (d.t === "frame") n.name = newName("frame"); insert(n, null); d.id = n.id; if (d.into && d.t !== "frame") adopt(n, d.into); else if (d.into && d.t === "frame") adopt(n, d.into); }
      const n = N(d.id), pm = parentM(n).inverse(), p0 = pm.transformPoint(new DOMPoint(x, y)), p1 = pm.transformPoint(new DOMPoint(x + ww, y + hh));
      n.x = p0.x; n.y = p0.y; n.w = d.t === "line" ? p1.x - p0.x : Math.max(1, p1.x - p0.x); n.h = d.t === "line" ? p1.y - p0.y : Math.max(1, p1.y - p0.y);
      setSel([n.id], true); paint(); return;
    }
    if (d.k === "move") {
      if (!d.started) { if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 3) return; d.started = true; }
      let dx = w.x - d.w0.x, dy = w.y - d.w0.y;
      if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      const sn = snap(d.box0, dx, dy, d.ids, e); dx = sn.dx; dy = sn.dy; S.guides = sn.guides;
      for (const i of d.ids) { const n = N(i), st = d.start.get(i), m = d.pm.get(i), a = m.transformPoint(new DOMPoint(0, 0)), b = m.transformPoint(new DOMPoint(dx, dy)); n.x = round(st.x + b.x - a.x); n.y = round(st.y + b.y - a.y); }
      paint(); panelsSoon(); return;
    }
    if (d.k === "resize") { resizeTo(d, w, e); paint(); panelsSoon(); return; }
    if (d.k === "rotate") {
      let da = (Math.atan2(w.y - d.c.y, w.x - d.c.x) - d.a0) * 180 / Math.PI;
      if (e.shiftKey) da = Math.round(da / 15) * 15;
      for (const [i, st] of d.start) {
        const n = N(i), r = da * Math.PI / 180, cx = d.c.x + (st.wc.x - d.c.x) * Math.cos(r) - (st.wc.y - d.c.y) * Math.sin(r), cy = d.c.y + (st.wc.x - d.c.x) * Math.sin(r) + (st.wc.y - d.c.y) * Math.cos(r);
        const pc = parentM(n).inverse().transformPoint(new DOMPoint(cx, cy));
        let rot = ((st.rot || 0) + da) % 360; if (rot > 180) rot -= 360; if (rot < -180) rot += 360;
        n.rot = round(rot); if (!n.rot) delete n.rot; n.x = round(pc.x - n.w / 2); n.y = round(pc.y - n.h / 2);
      }
      paint(); panelsSoon(); return;
    }
    if (d.k === "lineEnd") {
      const n = N(d.id), st = d.start, p = d.pm.inverse().transformPoint(new DOMPoint(w.x, w.y));
      const ax = d.end === 0 ? st.x + st.w : st.x, ay = d.end === 0 ? st.y + st.h : st.y;
      let px = p.x, py = p.y; if (e.shiftKey) { const a = Math.round(Math.atan2(py - ay, px - ax) / (Math.PI / 4)) * (Math.PI / 4), L = Math.hypot(px - ax, py - ay); px = ax + Math.cos(a) * L; py = ay + Math.sin(a) * L; }
      if (d.end === 0) { n.x = round(px); n.y = round(py); n.w = round(ax - px); n.h = round(ay - py); } else { n.w = round(px - st.x); n.h = round(py - st.y); }
      paint(); panelsSoon();
    }
  }
  function up(e) {
    const d = S.drag; if (!d) return; S.drag = null; S.guides = [];
    try { stage.releasePointerCapture(e.pointerId); } catch {}
    if (d.k === "pan") { stage.style.cursor = ""; return; }
    if (d.k === "marq") { paint(); return; }
    if (d.k === "create") {
      if (!d.id) { // a click: a default size
        const sz = d.t === "frame" ? [400, 300] : d.t === "line" ? [160, 0] : d.t === "text" ? [1, 1] : [100, 100];
        const n = make(d.t, d.t === "text" ? d.w0.x : d.w0.x - sz[0] / 2, d.t === "text" ? d.w0.y : d.w0.y - sz[1] / 2, sz[0], sz[1], d.arrow ? { eb: "arrow" } : {});
        insert(n, null); if (d.into) adopt(n, d.into); d.id = n.id;
      }
      const n = N(d.id); setTool("move");
      if (n.parent) fitParents([n]);
      setSel([n.id]);
      if (n.t === "text") { commitSoon = false; startText(n.id, true); return; }
      commit(); return;
    }
    if (d.k === "move") {
      if (!d.started) { H.cur = null; // a plain click on something already in a multi-selection picks just it
        const w = toW(e.clientX, e.clientY), p = pickAt(w.x, w.y, e.ctrlKey || e.metaKey); if (p && !p.frameBg && !e.shiftKey && S.sel.size > 1) setSel([p.id]); panels(); paint(); return; }
      // dropped into a frame (or out of one onto the canvas)
      const w = toW(e.clientX, e.clientY), moving = new Set(d.ids), f = frameAt(w.x, w.y, moving);
      const target = f ? f.id : null, olds = d.ids.map(N);
      for (const n of olds) { const P = parentOf(n); if (P && (P.t === "group" || P.t === "bool")) continue; if ((n.parent || null) !== target) adopt(n, target); }
      fitParents(olds);
      commit(); return;
    }
    if (d.k === "resize" || d.k === "rotate" || d.k === "lineEnd") { fitParents([...(d.start ? [...d.start.keys()] : [d.id])].map(N)); commit(); return; }
  }
  let commitSoon = false;
  function resizeTo(d, w, e) {
    const hk = d.hk;
    if (d.one) {
      const st = d.start.get(d.one), n = N(d.one), pm = d.pm.inverse();
      // the pointer in the node's own (unturned) axes
      const pp = pm.transformPoint(new DOMPoint(w.x, w.y)), cx = st.x + st.w / 2, cy = st.y + st.h / 2, r = -(st.rot || 0) * Math.PI / 180;
      const lx = (pp.x - cx) * Math.cos(r) - (pp.y - cy) * Math.sin(r) + st.w / 2, ly = (pp.x - cx) * Math.sin(r) + (pp.y - cy) * Math.cos(r) + st.h / 2;
      let x0 = 0, y0 = 0, x1 = st.w, y1 = st.h;
      if (hk.includes("w")) x0 = lx; if (hk.includes("e")) x1 = lx; if (hk.includes("n")) y0 = ly; if (hk.includes("s")) y1 = ly;
      if (e.altKey) { if (hk.includes("w")) x1 = st.w - x0; if (hk.includes("e")) x0 = st.w - x1; if (hk.includes("n")) y1 = st.h - y0; if (hk.includes("s")) y0 = st.h - y1; }
      let nw = Math.max(1, Math.abs(x1 - x0)), nh = Math.max(1, Math.abs(y1 - y0));
      const keep = e.shiftKey || (n.t === "frame" ? false : !!n.keep);
      if (keep && st.w && st.h) { const k = hk.length === 2 ? Math.max(nw / st.w, nh / st.h) : hk === "n" || hk === "s" ? nh / st.h : nw / st.w; nw = st.w * k; nh = st.h * k; if (hk.includes("w")) x0 = x1 - nw; else x1 = x0 + nw; if (hk.includes("n")) y0 = y1 - nh; else y1 = y0 + nh; if (hk === "n" || hk === "s") { x0 = (st.w - nw) / 2; x1 = x0 + nw; } if (hk === "e" || hk === "w") { y0 = (st.h - nh) / 2; y1 = y0 + nh; } }
      const lx0 = Math.min(x0, x1), ly0 = Math.min(y0, y1);
      // keep the far side where it was: the new box's corner, back in the parent's space
      const rr = (st.rot || 0) * Math.PI / 180, ccx = lx0 + nw / 2 - st.w / 2, ccy = ly0 + nh / 2 - st.h / 2;
      const ncx = cx + ccx * Math.cos(rr) - ccy * Math.sin(rr), ncy = cy + ccx * Math.sin(rr) + ccy * Math.cos(rr);
      n.w = round(nw); n.h = round(nh); n.x = round(ncx - nw / 2); n.y = round(ncy - nh / 2);
      if (n.t === "text") { if (hk === "n" || hk === "s" || hk.length === 2) n.auto = "fixed"; else if (n.auto === "w") n.auto = "h"; const sz = textSize(n); if (n.auto === "h") n.h = sz.h; }
      // a group or boolean shape scales what it holds
      if ((n.t === "group" || n.t === "bool") && st.w && st.h) { const kx = n.w / st.w, ky = n.h / st.h; for (const i of kidsDeep(n.id)) { const c = N(i), s0 = d.deep.get(i); if (!c || !s0) continue; if (c.parent === n.id || true) { c.x = round(s0.x * kx); c.y = round(s0.y * ky); c.w = round(s0.w * kx); c.h = round(s0.h * ky); } } }
      return;
    }
    // several things: scale them all with the box around them
    const b0 = d.box0; let x0 = b0.x, y0 = b0.y, x1 = b0.x + b0.w, y1 = b0.y + b0.h;
    if (hk.includes("w")) x0 = w.x; if (hk.includes("e")) x1 = w.x; if (hk.includes("n")) y0 = w.y; if (hk.includes("s")) y1 = w.y;
    if (e.shiftKey) { const k = Math.max(Math.abs(x1 - x0) / b0.w, Math.abs(y1 - y0) / b0.h); if (hk.includes("w")) x0 = x1 - b0.w * k; else x1 = x0 + b0.w * k; if (hk.includes("n")) y0 = y1 - b0.h * k; else y1 = y0 + b0.h * k; }
    const kx = Math.max(0.01, Math.abs(x1 - x0) / b0.w), ky = Math.max(0.01, Math.abs(y1 - y0) / b0.h), ox = Math.min(x0, x1), oy = Math.min(y0, y1);
    for (const [i, st] of d.start) {
      const n = N(i), pm = parentM(n), wc = pm.transformPoint(new DOMPoint(st.x + st.w / 2, st.y + st.h / 2));
      const ncx = ox + (wc.x - b0.x) * kx, ncy = oy + (wc.y - b0.y) * ky, pc = pm.inverse().transformPoint(new DOMPoint(ncx, ncy));
      n.w = round(st.w * kx); n.h = round(st.h * ky); n.x = round(pc.x - n.w / 2); n.y = round(pc.y - n.h / 2);
    }
  }
  // snapping to the edges and middles of nearby things, with red guides
  function snap(b0, dx, dy, ids, e) {
    if (!b0 || e.ctrlKey || e.metaKey) return { dx, dy, guides: [] };
    const tol = 5 / S.view.z, moving = new Set(ids), first = N(ids[0]);
    const pid = first ? first.parent || "" : "";
    const others = kids(pid).filter((n) => !moving.has(n.id) && !n.hide).map(boxOf);
    if (pid && N(pid) && N(pid).t !== "group") others.push(boxOf(N(pid)));
    if (!pid) for (const n of kids("")) if (!moving.has(n.id)) others.push(boxOf(n));
    const b = { x: b0.x + dx, y: b0.y + dy, w: b0.w, h: b0.h };
    const xs = [b.x, b.x + b.w / 2, b.x + b.w], ys = [b.y, b.y + b.h / 2, b.y + b.h];
    let bx = null, by = null;
    for (const o of others) {
      for (const ox of [o.x, o.x + o.w / 2, o.x + o.w]) for (const x of xs) { const dd = ox - x; if (Math.abs(dd) <= tol && (!bx || Math.abs(dd) < Math.abs(bx.d))) bx = { d: dd, x: ox, o }; }
      for (const oy of [o.y, o.y + o.h / 2, o.y + o.h]) for (const y of ys) { const dd = oy - y; if (Math.abs(dd) <= tol && (!by || Math.abs(dd) < Math.abs(by.d))) by = { d: dd, y: oy, o }; }
    }
    const guides = [];
    if (bx) { dx += bx.d; const nb = { y: b0.y + dy, h: b0.h }; guides.push({ x1: bx.x, y1: Math.min(nb.y, bx.o.y), x2: bx.x, y2: Math.max(nb.y + nb.h, bx.o.y + bx.o.h) }); }
    if (by) { dy += by.d; const nb = { x: b0.x + dx, w: b0.w }; guides.push({ x1: Math.min(nb.x, by.o.x), y1: by.y, x2: Math.max(nb.x + nb.w, by.o.x + by.o.w), y2: by.y }); }
    return { dx, dy, guides };
  }
  // hold Alt: the distances from the selection to what is under the pointer
  function measureTo(otherId) {
    const a = selBox(); if (!a) { S.measure = null; return; }
    const o = otherId && !S.sel.has(otherId) ? boxOf(N(otherId)) : (() => { const p = parentOf(selTops()[0]); return p ? boxOf(p) : null; })();
    if (!o) { S.measure = null; paint(); return; }
    const out = [], my = a.y + a.h / 2, mx = a.x + a.w / 2, f = (v) => String(Math.round(v * 10) / 10);
    const inside = a.x >= o.x && a.x + a.w <= o.x + o.w && a.y >= o.y && a.y + a.h <= o.y + o.h;
    if (inside) { out.push({ x1: o.x, y1: my, x2: a.x, y2: my, label: f(a.x - o.x) }, { x1: a.x + a.w, y1: my, x2: o.x + o.w, y2: my, label: f(o.x + o.w - a.x - a.w) }, { x1: mx, y1: o.y, x2: mx, y2: a.y, label: f(a.y - o.y) }, { x1: mx, y1: a.y + a.h, x2: mx, y2: o.y + o.h, label: f(o.y + o.h - a.y - a.h) }); }
    else {
      if (o.x >= a.x + a.w) out.push({ x1: a.x + a.w, y1: my, x2: o.x, y2: my, label: f(o.x - a.x - a.w) }); else if (o.x + o.w <= a.x) out.push({ x1: o.x + o.w, y1: my, x2: a.x, y2: my, label: f(a.x - o.x - o.w) });
      if (o.y >= a.y + a.h) out.push({ x1: mx, y1: a.y + a.h, x2: mx, y2: o.y, label: f(o.y - a.y - a.h) }); else if (o.y + o.h <= a.y) out.push({ x1: mx, y1: o.y + o.h, x2: mx, y2: a.y, label: f(a.y - o.y - o.h) });
    }
    S.measure = out.filter((g) => Math.hypot(g.x2 - g.x1, g.y2 - g.y1) > 0.01); paint();
  }
  function wheel(e) {
    e.preventDefault(); rect = stage.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) { const f = Math.exp(-e.deltaY * (Math.abs(e.deltaY) < 30 ? 0.01 : 0.0022)); zoomAt(f, e.clientX, e.clientY); }
    else setView({ x: S.view.x - (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX), y: S.view.y - (e.shiftKey && !e.deltaX ? 0 : e.deltaY) });
  }
  function dbl(e) {
    if (ro) return;
    const w = toW(e.clientX, e.clientY), d2 = deepAt(w.x, w.y); if (!d2) return;
    const sel = selTops()[0];
    if (sel && (sel.t === "group" || sel.t === "bool") && isDesc(d2, sel)) { S.scope = sel.id; let c = d2; while (c.parent && c.parent !== sel.id) c = parentOf(c); setSel([c.id]); return; }
    if (d2.t === "text") { setSel([d2.id]); startText(d2.id); return; }
    const lab = labelAt(e.clientX, e.clientY); if (lab) { renameNode(lab.id); return; }
  }

  /* ---------- selection ---------- */
  function setSel(ids, quiet) { S.sel = new Set(ids); if (!ids.length) S.scope = null; selChanged(quiet); }
  function selChanged(quiet) {
    // leaving a group's inside when picking something outside it
    if (S.scope && ![...S.sel].some((i) => N(i) && (isDesc(N(i), N(S.scope)) || i === S.scope))) S.scope = null;
    paint(); if (!quiet) panels(); else panelsSoon();
  }
  let pT = 0; const panelsSoon = () => { if (pT) return; pT = setTimeout(() => { pT = 0; panels(); }, 60); };
  function panels() { if (S.dead) return; layersPanel(layersEl, API); if (!ro) propsPanel(propsEl, API); }

  /* ---------- text editing: a real text box laid over the canvas ---------- */
  let te = null;
  function runCss(r) { return `font-family:'${(r.f || "Inter").replace(/'/g, "")}',system-ui,sans-serif;font-weight:${r.w || 400};font-size:${r.sz || 16}px;color:${rgba(r.c || "#1A1A1A", r.a ?? 1)};letter-spacing:${r.ls || 0}px;line-height:${r.lh ? r.lh : 1.2};${r.i ? "font-style:italic;" : ""}${r.u || r.st ? `text-decoration:${r.u ? "underline " : ""}${r.st ? "line-through" : ""};` : ""}`; }
  const styleOf = (r) => { const o = { ...r }; delete o.s; return o; };
  function runsHtml(runs) { const list = runs.length ? runs : [{ s: "" }]; return list.map((r) => `<span data-r="${esc(JSON.stringify(styleOf(r)))}" style="${runCss(r)}">${esc(r.s || "") || "​"}</span>`).join(""); }
  function domRuns(el) {
    const out = []; let last = null;
    const walk = (node, style) => {
      for (const c of node.childNodes) {
        if (c.nodeType === 3) { const s = c.data.replace(/​/g, ""); if (s) push(s, style); }
        else if (c.nodeName === "BR") push("\n", style);
        else if (c.nodeType === 1) { const st = c.dataset && c.dataset.r ? (() => { try { return JSON.parse(c.dataset.r); } catch { return style; } })() : style; if ((c.nodeName === "DIV" || c.nodeName === "P") && out.length) push("\n", st); walk(c, st); }
      }
    };
    const push = (s, st) => { const style = st || last || {}; const prev = out[out.length - 1]; if (prev && JSON.stringify(styleOf(prev)) === JSON.stringify(style)) prev.s += s; else out.push({ ...style, s }); last = style; };
    walk(el, (te && te.base) || null);
    return out.length ? out : [{ ...((te && te.base) || {}), s: "" }];
  }
  function textOffsets(el) {
    const sl = getSelection(); if (!sl.rangeCount || !el.contains(sl.anchorNode)) return null;
    const off = (node, o) => { let n = 0; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT); let x; while ((x = w.nextNode())) { if (x === node) return n + (x.nodeType === 3 ? x.data.slice(0, o).replace(/​/g, "").length : [...x.childNodes].slice(0, o).reduce((t, c) => t + (c.textContent || "").replace(/​/g, "").length + (c.nodeName === "BR" ? 1 : 0), 0)); if (x.nodeType === 3) n += x.data.replace(/​/g, "").length; else if (x.nodeName === "BR") n += 1; } return n; };
    const r = sl.getRangeAt(0); const a = off(r.startContainer, r.startOffset), b = off(r.endContainer, r.endOffset); return { a: Math.min(a, b), b: Math.max(a, b) };
  }
  function setOffsets(el, a, b) {
    const find = (target) => { let n = 0; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let x, last = null; while ((x = w.nextNode())) { const s = x.data.replace(/​/g, "").length; if (n + s >= target) return [x, Math.min(x.data.length, target - n)]; n += s; last = x; } return last ? [last, last.data.length] : [el, 0]; };
    const [sa, oa] = find(a), [sb, ob] = find(b), r = document.createRange(); r.setStart(sa, oa); r.setEnd(sb, ob); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r);
  }
  function startText(nid, fresh) {
    endText(); const n = N(nid); if (!n || n.t !== "text" || n.lock) return;
    begin(); touch(nid);
    const el = h("div", { class: "dz-te", contenteditable: "true", spellcheck: "true", role: "textbox", "aria-label": "Text" });
    el.innerHTML = runsHtml(n.runs || []);
    over.append(el); te = { id: nid, el, base: styleOf((n.runs || [])[0] || {}), fresh }; S.edit = te;
    placeTextEdit(); paint();
    el.focus({ preventScroll: true });
    const r = document.createRange(); r.selectNodeContents(el); if (!fresh && !(n.runs || []).some((x) => x.s)) r.collapse(false); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r);
    el.addEventListener("input", () => { const nn = N(nid); if (!nn) return; nn.runs = domRuns(el); if (nn.runs.length && nn.runs[nn.runs.length - 1]) te.base = styleOf(nn.runs[nn.runs.length - 1]); const s = textSize(nn); if (nn.auto !== "fixed") { nn.w = s.w; nn.h = s.h; } if (nn.name === "Text" || te.autoName) { te.autoName = true; nn.name = (nn.runs.map((x) => x.s).join("").trim().slice(0, 40)) || "Text"; } placeTextEdit(); paint(); panelsSoon(); });
    el.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); endText(); setSel([nid]); stage.focus({ preventScroll: true }); return; }
      if (e.key === "Enter" && !e.shiftKey && !(e.ctrlKey || e.metaKey)) { e.preventDefault(); document.execCommand("insertText", false, "\n"); return; }
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); endText(); setSel([nid]); stage.focus({ preventScroll: true }); return; }
      if ((e.ctrlKey || e.metaKey) && ["b", "i", "u"].includes(e.key.toLowerCase())) { e.preventDefault(); const k = e.key.toLowerCase(); const cur = curRunStyle(); textStyle(k === "b" ? { w: (cur.w || 400) >= 600 ? 400 : 700 } : k === "i" ? { i: cur.i ? 0 : 1 } : { u: cur.u ? 0 : 1 }); return; }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "x") { e.preventDefault(); const cur = curRunStyle(); textStyle({ st: cur.st ? 0 : 1 }); return; }
      e.stopPropagation();
    });
    el.addEventListener("paste", (e) => { e.preventDefault(); const t = (e.clipboardData.getData("text/plain") || "").replace(/\r\n?/g, "\n"); document.execCommand("insertText", false, t); });
    el.addEventListener("keyup", panelsSoon); el.addEventListener("mouseup", panelsSoon);
  }
  function placeTextEdit() {
    if (!te) return; const n = N(te.id); if (!n) return endText();
    const m = worldM(n), p = m.transformPoint(new DOMPoint(0, 0)), s = toS(p.x, p.y), rot = Math.atan2(m.b, m.a) * 180 / Math.PI, k = Math.hypot(m.a, m.b) * S.view.z;
    const L = layoutText(n), off = n.auto === "fixed" ? (n.va === "middle" ? (n.h - L.h) / 2 : n.va === "bottom" ? n.h - L.h : 0) : 0;
    Object.assign(te.el.style, { left: s.x + "px", top: s.y + "px", transform: `rotate(${rot}deg) scale(${k}) translateY(${off}px)`, width: n.auto === "w" ? "auto" : Math.abs(n.w) + "px", minWidth: n.auto === "w" ? "1px" : "", whiteSpace: n.auto === "w" ? "pre" : "pre-wrap", textAlign: n.ta === "justify" ? "justify" : n.ta, textTransform: n.tc === "upper" ? "uppercase" : n.tc === "lower" ? "lowercase" : n.tc === "title" ? "capitalize" : "none" });
  }
  function endText() {
    if (!te) return; const t = te; te = null; S.edit = null;
    const n = N(t.id);
    if (n) {
      n.runs = domRuns(t.el);
      if (!n.runs.some((r) => (r.s || "").trim())) { delete D.nodes[t.id]; S.sel.delete(t.id); restructure(); fitParents([n]); } // an empty text box goes away
      else { const s = textSize(n); if (n.auto !== "fixed") { n.w = s.w; n.h = s.h; } fitParents([n]); }
    }
    t.el.remove(); commit();
  }
  function curRunStyle() { if (!te) { const n = selTops().find((x) => x.t === "text"); return (n && n.runs && n.runs[0]) || {}; } const o = textOffsets(te.el), runs = domRuns(te.el); if (!o) return runs[0] || {}; let pos = 0; for (const r of runs) { if (o.a < pos + (r.s || "").length || r === runs[runs.length - 1]) return r; pos += (r.s || "").length; } return runs[0] || {}; }
  // style for the selected letters while typing, or for whole text boxes
  function textStyle(patch) {
    const fam = patch.f; if (fam) loadFont(fam).then(() => { clearLayout(); for (const n of Object.values(D.nodes)) if (n.t === "text" && n.auto !== "fixed") { const s = textSize(n); n.w = s.w; n.h = s.h; } paint(); placeTextEdit(); });
    if (patch.f || patch.w || patch.sz) { const lf = { ...lastFont, ...(patch.f ? { f: patch.f } : {}), ...(patch.w ? { w: patch.w } : {}), ...(patch.sz ? { sz: patch.sz } : {}) }; Object.assign(lastFont, lf); ls.set("dzFont", lf); }
    const apply = (runs, a, b) => {
      const out = []; let pos = 0;
      for (const r of runs) { const s = r.s || "", e = pos + s.length;
        if (e <= a || pos >= b || a === b) out.push(r);
        else { const i0 = Math.max(0, a - pos), i1 = Math.min(s.length, b - pos); if (i0 > 0) out.push({ ...r, s: s.slice(0, i0) }); out.push({ ...r, ...patch, s: s.slice(i0, i1) }); if (i1 < s.length) out.push({ ...r, s: s.slice(i1) }); }
        pos = e; }
      const merged = []; for (const r of out) { const p = merged[merged.length - 1]; if (p && JSON.stringify(styleOf(p)) === JSON.stringify(styleOf(r))) p.s += r.s; else if (r.s || !merged.length) merged.push({ ...r }); } return merged.length ? merged : [{ ...runs[0], ...patch, s: "" }];
    };
    if (te) {
      const n = N(te.id), o = textOffsets(te.el), runs = domRuns(te.el), total = runs.reduce((t, r) => t + (r.s || "").length, 0);
      const a = o && o.b > o.a ? o.a : 0, b = o && o.b > o.a ? o.b : total;
      n.runs = total ? apply(runs, a, b) : [{ ...runs[0], ...patch, s: "" }];
      te.base = { ...te.base, ...patch };
      te.el.innerHTML = runsHtml(n.runs); setOffsets(te.el, a, b);
      const s = textSize(n); if (n.auto !== "fixed") { n.w = s.w; n.h = s.h; } placeTextEdit(); paint(); panelsSoon(); return;
    }
    begin(); for (const n of selTops().filter((x) => x.t === "text")) { touch(n.id); n.runs = (n.runs || []).map((r) => ({ ...r, ...patch })); const s = textSize(n); if (n.auto !== "fixed") { n.w = s.w; n.h = s.h; } } fitParents(selTops()); commit();
  }

  /* ---------- commands ---------- */
  function setTool(t) { if (te) endText(); S.tool = t; $$("[data-tool]", root).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tool === t || (t === "polygon" || t === "star" || t === "arrow") && b.dataset.a === "shapes"))); stage.style.cursor = t === "hand" ? "grab" : t === "move" ? "default" : "crosshair"; if (t === "frame") panels(); }
  function del() { const s = selTops(); if (!s.length) return; begin(); const parents = s.map((n) => n.parent).filter(Boolean); for (const n of s) for (const i of [n.id, ...kidsDeep(n.id)]) { touch(i); delete D.nodes[i]; } restructure(); for (const p of new Set(parents)) if (N(p)) fitGroup(p); D.slides = D.slides.filter((i) => D.nodes[i]); setSel([]); commit(); }
  function duplicateNodes(ids, off = 20, inPlace) {
    const out = [], map = new Map();
    const copy = (i, pid, top) => { const n = N(i); const c = clone(n); c.id = rid(); map.set(i, c.id); if (top) { c.x += off; c.y += off; c.z = nextZ(pid); } c.parent = pid || undefined; if (!pid) delete c.parent; touch(c.id); D.nodes[c.id] = c; restructure(); for (const k of kids(i)) copy(k.id, c.id, false); return c.id; };
    for (const i of ids) out.push(copy(i, N(i).parent, true));
    if (!inPlace) setSel(out);
    else { S.sel = new Set(out); }
    return out;
  }
  function duplicate() { const s = selTops(); if (!s.length) return; begin(); duplicateNodes(s.map((n) => n.id), 20); fitParents(selTops()); commit(); }
  function groupSel(type = "group", op2) {
    const s = selTops(); if (!s.length || (type === "bool" && s.length < 2)) return;
    const pid = s[0].parent || null; if (s.some((n) => (n.parent || null) !== pid)) return toast("Pick things that are inside the same frame or group.");
    begin(); const b = aabb(s.flatMap((n) => corners(n))), pm = pid ? worldM(N(pid)) : new DOMMatrix(), lp = pm.inverse().transformPoint(new DOMPoint(b.x, b.y));
    const g = { id: rid(), t: type, name: type === "bool" ? { union: "Union", subtract: "Subtract", intersect: "Intersect", exclude: "Exclude" }[op2] : newName("group"), x: lp.x, y: lp.y, w: b.w, h: b.h, z: Math.max(...s.map((n) => n.z || 0)), fills: type === "bool" ? clone(s[0].fills && s[0].fills.length ? s[0].fills : [{ t: "s", c: "#D9D9D9", a: 1 }]) : [], strokes: [], fx: [], ...(type === "bool" ? { op2 } : {}) };
    if (pid) g.parent = pid; touch(g.id); D.nodes[g.id] = g; restructure();
    for (const n of s.sort((a, c) => (a.z || 0) - (c.z || 0))) { touch(n.id); adopt(n, g.id); }
    fitGroup(g.id); setSel([g.id]); commit();
  }
  function ungroup() {
    const s = selTops().filter((n) => n.t === "group" || n.t === "bool" || n.t === "frame"); if (!s.length) return;
    begin(); const out = [];
    for (const g of s) { const pid = g.parent || null; for (const c of [...kids(g.id)]) { touch(c.id); adopt(c, pid); out.push(c.id); } touch(g.id); delete D.nodes[g.id]; restructure(); if (pid) fitGroup(pid); }
    D.slides = D.slides.filter((i) => D.nodes[i]); setSel(out); commit();
  }
  function frameSel() { // wrap the selection in a frame that fits it
    const s = selTops(); if (!s.length) return; const pid = s[0].parent || null; begin();
    const b = aabb(s.flatMap((n) => corners(n))), pm = pid ? worldM(N(pid)) : new DOMMatrix(), lp = pm.inverse().transformPoint(new DOMPoint(b.x, b.y));
    const f = make("frame", lp.x, lp.y, b.w, b.h); f.fills = []; insert(f, pid);
    for (const n of s) { touch(n.id); adopt(n, f.id); }
    setSel([f.id]); commit();
  }
  function mask() { const s = selTops(); if (s.length < 2) return toast("Pick the shape to mask with and what it should cut, then mask."); begin(); const low = s.reduce((a, n) => ((n.z || 0) < (a.z || 0) ? n : a), s[0]); groupSel("group"); const g = selTops()[0]; if (!g) { commit(); return; } touch(low.id); N(low.id).mask = 1; N(g.id).name = "Mask group"; commit(); }
  function order(k) { // forward, backward, front, back
    const s = selTops(); if (!s.length) return; begin();
    for (const n of s) {
      const list = kids(n.parent || "").slice(), i = list.indexOf(n); list.splice(i, 1);
      const j = k === "front" ? list.length : k === "back" ? 0 : clamp(i + (k === "fwd" ? 1 : -1), 0, list.length); list.splice(j, 0, n);
      list.forEach((x, idx) => { if ((x.z || 0) !== idx) { touch(x.id); x.z = idx; } }); restructure();
    }
    commit();
  }
  function align(k) {
    const s = selTops(); if (!s.length) return; begin();
    const box = s.length === 1 ? (s[0].parent ? boxOf(N(s[0].parent)) : null) : selBox(); if (!box) { H.cur = null; return; }
    for (const n of s) { const b = boxOf(n); let dx = 0, dy = 0;
      if (k === "l") dx = box.x - b.x; if (k === "c") dx = box.x + box.w / 2 - (b.x + b.w / 2); if (k === "r") dx = box.x + box.w - (b.x + b.w);
      if (k === "t") dy = box.y - b.y; if (k === "m") dy = box.y + box.h / 2 - (b.y + b.h / 2); if (k === "b") dy = box.y + box.h - (b.y + b.h);
      moveBy(n, dx, dy); }
    fitParents(s); commit();
  }
  function distribute(axis) {
    const s = selTops(); if (s.length < 3) return; begin();
    const items = s.map((n) => ({ n, b: boxOf(n) })).sort((a, c) => (axis === "h" ? a.b.x - c.b.x : a.b.y - c.b.y));
    const first = items[0].b, last = items[items.length - 1].b, total = items.reduce((t, x) => t + (axis === "h" ? x.b.w : x.b.h), 0);
    const gap = ((axis === "h" ? last.x + last.w - first.x : last.y + last.h - first.y) - total) / (items.length - 1);
    let pos = axis === "h" ? first.x : first.y;
    for (const it of items) { const d2 = pos - (axis === "h" ? it.b.x : it.b.y); moveBy(it.n, axis === "h" ? d2 : 0, axis === "h" ? 0 : d2); pos += (axis === "h" ? it.b.w : it.b.h) + gap; }
    fitParents(s); commit();
  }
  function moveBy(n, dx, dy) { touch(n.id); const m = parentM(n).inverse(), a = m.transformPoint(new DOMPoint(0, 0)), b = m.transformPoint(new DOMPoint(dx, dy)); n.x = round(n.x + b.x - a.x); n.y = round(n.y + b.y - a.y); }
  function nudge(dx, dy) { const s = selTops().filter((n) => !n.lock); if (!s.length) return; begin(); s.forEach((n) => moveBy(n, dx, dy)); fitParents(s); commit(); }
  function setProp(patch, ids) { const list = (ids || selTops().map((n) => n.id)).map(N).filter(Boolean); if (!list.length) return; begin(); for (const n of list) { touch(n.id); for (const [k, v] of Object.entries(patch)) { if (v === undefined) delete n[k]; else n[k] = v; } if (n.t === "text" && ("w" in patch || "auto" in patch)) { if (n.auto === "w" && "w" in patch) n.auto = "h"; const s = textSize(n); if (n.auto !== "fixed") { n.w = n.auto === "w" ? s.w : n.w; n.h = s.h; } } } fitParents(list); commit(); }
  function renameNode(nid) { const n = N(nid); if (!n) return; const t = prompt("Layer name", n.name || ""); if (t == null) return; setProp({ name: t.trim().slice(0, 120) || NAMES[n.t] }, [nid]); }
  function toggle(k) { const s = selTops(); if (!s.length) return; const v = !s.every((n) => n[k]); setProp({ [k]: v ? 1 : undefined }); }

  /* ---------- clipboard ---------- */
  function copySel(cut) {
    const s = selTops(); if (!s.length) return;
    const all = []; for (const n of s) { const top = clone(n), m = worldM(n), c = m.transformPoint(new DOMPoint(n.w / 2, n.h / 2)); top._wx = c.x - n.w / 2; top._wy = c.y - n.h / 2; top._rot = Math.atan2(m.b, m.a) * 180 / Math.PI; all.push(top); for (const i of kidsDeep(n.id)) all.push(clone(N(i))); }
    const data = { v: 1, tops: s.map((n) => n.id), nodes: all };
    ls.set("dzClip", data);
    try { navigator.clipboard.writeText("rkdesign:" + JSON.stringify(data)); } catch {}
    if (cut) del();
  }
  async function pasteData(data, at) {
    if (!data || !Array.isArray(data.nodes)) return;
    begin(); const map = new Map(data.nodes.map((n) => [n.id, rid()])), tops = new Set(data.tops || []);
    const target = selTops().length === 1 && selTops()[0].t === "frame" ? selTops()[0] : null;
    const pts = data.nodes.filter((n) => tops.has(n.id)), bx = aabb(pts.map((n) => ({ x: n._wx, y: n._wy })).concat(pts.map((n) => ({ x: n._wx + n.w, y: n._wy + n.h }))));
    const dx = at ? at.x - (bx.x + bx.w / 2) : 20, dy = at ? at.y - (bx.y + bx.h / 2) : 20, out = [];
    for (const n0 of data.nodes) {
      const n = clone(n0); n.id = map.get(n0.id);
      if (tops.has(n0.id)) { n.x = n0._wx + dx; n.y = n0._wy + dy; n.rot = n0._rot ? Math.round(n0._rot * 100) / 100 : undefined; if (!n.rot) delete n.rot; delete n.parent; out.push(n.id); }
      else n.parent = map.get(n0.parent);
      delete n._wx; delete n._wy; delete n._rot;
      touch(n.id); D.nodes[n.id] = n;
    }
    restructure();
    for (const i of out) { N(i).z = nextZ(""); if (target) adopt(N(i), target.id); }
    setSel(out); commit();
  }
  function pasteAt() { const w = S.last || toW(rect.left + rect.width / 2, rect.top + rect.height / 2); return w; }
  async function onPaste(e) {
    if (ro || te || e.defaultPrevented) return;
    const a = document.activeElement; if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
    if (!root.isConnected || !isTop()) return;
    const cd = e.clipboardData; if (!cd) return;
    const files = [...(cd.files || [])].filter((f) => /^image\//.test(f.type));
    const txt = cd.getData("text/plain") || "";
    e.preventDefault();
    if (files.length) return placeImages(files, pasteAt());
    if (txt.startsWith("rkdesign:")) { try { return pasteData(JSON.parse(txt.slice(9))); } catch {} }
    if (/^\s*<svg[\s>]/i.test(txt)) return placeSvg(txt, pasteAt());
    if (txt.trim()) { begin(); const w = pasteAt(), n = make("text", w.x, w.y, 1, 1, { runs: [{ s: txt.slice(0, 5000), f: lastFont.f, w: lastFont.w, sz: lastFont.sz, c: "#1E1E1E", a: 1, ls: 0, lh: 0 }] }); const s = textSize(n); n.w = s.w; n.h = s.h; n.x -= s.w / 2; n.y -= s.h / 2; n.name = txt.trim().slice(0, 40); insert(n, null); const f = frameAt(w.x, w.y); if (f) adopt(n, f.id); setSel([n.id]); commit(); return; }
    const d = ls.get("dzClip", null); if (d) pasteData(d);
  }
  document.addEventListener("paste", onPaste);

  /* ---------- pictures ---------- */
  async function placeImages(files, at) {
    const made = []; let x = at.x;
    status("saving"); stEl.textContent = "Uploading…";
    for (const f of files.slice(0, 20)) {
      try {
        const r = await Up.image(f, { max: 2400 });
        const k = Math.min(1, 800 / Math.max(r.w, r.h)), w = Math.round(r.w * k), hh = Math.round(r.h * k);
        begin(); const n = make("rect", x - (files.length > 1 ? 0 : w / 2), at.y - hh / 2, w, hh); n.name = (f.name || "Picture").replace(/\.\w+$/, "").slice(0, 60); n.fills = [{ t: "i", src: r.url, fit: "fill", a: 1, iw: r.w, ih: r.h }]; n.keep = 1;
        insert(n, null); const fr = frameAt(at.x, at.y); if (fr) adopt(n, fr.id); made.push(n.id); x += w + 24; commit();
      } catch (e) { toast(e.message || "Could not place that picture."); }
    }
    if (made.length) setSel(made);
    status("saved");
  }
  async function placeSvg(text, at) { // a pasted SVG (for example Figma's "Copy as SVG") becomes a crisp picture
    try {
      const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
      const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const w = im.naturalWidth || 300, hh = im.naturalHeight || 300, k = Math.min(4, 2400 / Math.max(w, hh));
      const c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(hh * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      const blob = await new Promise((res) => c.toBlob(res, "image/png"));
      await placeImages([new File([blob], "Pasted SVG.png", { type: "image/png" })], at);
    } catch { toast("That SVG could not be read."); }
  }
  stage.addEventListener("dragover", (e) => { if ([...(e.dataTransfer?.types || [])].includes("Files")) { e.preventDefault(); stage.classList.add("drop"); } });
  stage.addEventListener("dragleave", () => stage.classList.remove("drop"));
  stage.addEventListener("drop", (e) => { stage.classList.remove("drop"); const files = [...(e.dataTransfer?.files || [])].filter((f) => /^image\//.test(f.type)); if (!files.length || ro) return; e.preventDefault(); placeImages(files, toW(e.clientX, e.clientY)); });
  function pickImages() { const i = h("input", { type: "file", accept: "image/*", multiple: true, style: "display:none" }); document.body.append(i); i.onchange = () => { const f = [...i.files]; i.remove(); if (f.length) placeImages(f, pasteAt()); }; i.click(); }

  /* ---------- slides, presenting, sharing, exporting ---------- */
  function slideIds() {
    const listed = D.slides.filter((i) => N(i) && !N(i).hide);
    if (listed.length) return listed;
    return kids("").filter((n) => n.t === "frame" && !n.hide).sort((a, b) => (Math.abs(a.y - b.y) > 40 ? a.y - b.y : a.x - b.x)).map((n) => n.id);
  }
  function startPresent(from) {
    const ids = slideIds(); if (!ids.length) return toast("Add a frame first: each frame is a slide.");
    endText(); const sel = selTops()[0]; const top = sel ? [sel, ...ancestors(sel)].pop() : null;
    present(D.nodes, ids, { start: from ?? Math.max(0, top ? ids.indexOf(top.id) : 0), title: meta.title, onClose: () => stage.focus({ preventScroll: true }) });
  }
  async function share() {
    const r0 = meta.share;
    const link = (t) => `${location.origin}/present/${t}`;
    const draw = () => [{ head: meta.share ? "Anyone with the link can view and present" : "Share a view-only link" },
      meta.share ? { t: "Copy link", i: "copy", run: () => { navigator.clipboard?.writeText(link(meta.share)); toast("Link copied"); } } : { t: "Create a link", i: "link", run: setOn(true) },
      ...(meta.share ? [{ t: "Open the link", i: "external", run: () => window.open(link(meta.share), "_blank", "noopener") }, "-", { t: "Stop sharing", i: "x", run: setOn(false) }] : [])];
    const setOn = (on) => async () => { const r = await api(`/api/designs?id=${id}&a=share`, { method: "POST", body: { on } }); if (!r.ok) return toast(r.data.error || "Could not change sharing."); meta.share = r.data.design.share; if (on) { navigator.clipboard?.writeText(link(meta.share)); toast("Link created and copied. Only what is in the slides is shown."); } else toast("Sharing stopped. The old link no longer works."); };
    const b = $("[data-a=share]", root).getBoundingClientRect(); menu(b.left, b.bottom + 6, draw()); void r0;
  }
  async function exportNodes(ids, fmt, scale) {
    endText(); await flush();
    const name = (i) => fileName(N(i).name || meta.title || "design");
    try {
      if (fmt === "pdf") { const b = await exportPdf(D.nodes, ids, { scale: Math.max(2, scale) }); saveBlob(b, fileName(meta.title || N(ids[0]).name) + ".pdf"); return; }
      for (const i of ids) {
        if (fmt === "svg") saveBlob(new Blob([await exportSvg(D.nodes, i)], { type: "image/svg+xml" }), name(i) + ".svg");
        else saveBlob(await exportImage(D.nodes, i, { scale, type: fmt === "jpg" ? "image/jpeg" : "image/png", quality: 0.92 }), `${name(i)}${scale !== 1 ? "@" + scale + "x" : ""}.${fmt === "jpg" ? "jpg" : "png"}`);
      }
    } catch (e) { toast("Export failed: " + (e.message || e)); }
  }

  /* ---------- keys ---------- */
  const isTop = () => { const w = root.closest(".win"); return !!(root.offsetParent && w && !w.classList.contains("min") && (w.classList.contains("top") || document.querySelectorAll(".win:not(.min)").length === 1)); };
  function onKey(e) {
    if (S.dead || te) return;
    const a = document.activeElement; if (a && a !== stage && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
    const k = e.key, mod = e.ctrlKey || e.metaKey, lk = k.toLowerCase();
    if (k === " " && !S.space) { S.space = true; stage.style.cursor = "grab"; e.preventDefault(); return; }
    if (mod && lk === "z") { e.preventDefault(); if (!ro) e.shiftKey ? redo() : undo(); return; }
    if (mod && lk === "y") { e.preventDefault(); if (!ro) redo(); return; }
    if (mod && (k === "=" || k === "+")) { e.preventDefault(); zoomAt(1.25, rect.left + rect.width / 2, rect.top + rect.height / 2); return; }
    if (mod && k === "-") { e.preventDefault(); zoomAt(0.8, rect.left + rect.width / 2, rect.top + rect.height / 2); return; }
    if (mod && e.altKey && k === "Enter") { e.preventDefault(); startPresent(); return; }
    if (e.shiftKey && (k === "!" || e.code === "Digit1")) { e.preventDefault(); fitTo(allBox()); return; }
    if (e.shiftKey && (k === "@" || e.code === "Digit2")) { e.preventDefault(); fitTo(selBox() || allBox(), 80, 8); return; }
    if (e.shiftKey && (k === ")" || e.code === "Digit0")) { e.preventDefault(); zoomAt(1 / S.view.z, rect.left + rect.width / 2, rect.top + rect.height / 2); return; }
    if (ro) return;
    if (mod && lk === "a") { e.preventDefault(); const s = selTops()[0]; setSel(kids(s ? s.parent || "" : S.scope || "").filter((n) => !n.hide && !n.lock).map((n) => n.id)); return; }
    if (mod && lk === "c") { e.preventDefault(); copySel(false); return; }
    if (mod && lk === "x") { e.preventDefault(); copySel(true); return; }
    if (mod && lk === "d") { e.preventDefault(); duplicate(); return; }
    if (mod && e.altKey && lk === "g") { e.preventDefault(); frameSel(); return; }
    if (mod && e.shiftKey && lk === "g") { e.preventDefault(); ungroup(); return; }
    if (mod && lk === "g") { e.preventDefault(); groupSel(); return; }
    if (mod && e.altKey && lk === "m") { e.preventDefault(); mask(); return; }
    if (mod && e.shiftKey && lk === "h") { e.preventDefault(); toggle("hide"); return; }
    if (mod && e.shiftKey && lk === "l") { e.preventDefault(); toggle("lock"); return; }
    if (mod && e.shiftKey && lk === "e") { e.preventDefault(); const s = selTops(); exportNodes(s.length ? s.map((n) => n.id) : slideIds(), "png", 2); return; }
    if (mod && e.shiftKey && lk === "k") { e.preventDefault(); pickImages(); return; }
    if (mod && (k === "]" || k === "[")) { e.preventDefault(); order(e.shiftKey ? (k === "]" ? "front" : "back") : k === "]" ? "fwd" : "bwd"); return; }
    if (e.altKey && !mod) { const m = { a: "l", d: "r", w: "t", s: "b", h: "c", v: "m" }[e.code.replace("Key", "").toLowerCase()]; if (m) { e.preventDefault(); align(m); return; } }
    if (k === "Delete" || k === "Backspace") { e.preventDefault(); del(); return; }
    if (k === "Escape") { e.preventDefault(); if (S.tool !== "move") setTool("move"); else if (S.scope) { const g = S.scope; S.scope = null; setSel([g]); } else setSel([]); return; }
    if (k === "Enter" && !mod) { e.preventDefault(); const s = selTops(); if (e.shiftKey) { const p = s[0] && parentOf(s[0]); if (p) setSel([p.id]); return; } if (s.length === 1 && s[0].t === "text") { startText(s[0].id); return; } if (s.length === 1 && kids(s[0].id).length) { if (s[0].t !== "frame") S.scope = s[0].id; setSel(kids(s[0].id).map((n) => n.id)); } return; }
    if (k === "F2") { e.preventDefault(); const s = selTops(); if (s.length === 1) renameNode(s[0].id); return; }
    if (k.startsWith("Arrow")) { e.preventDefault(); const st = e.shiftKey ? 10 : 1; nudge(k === "ArrowLeft" ? -st : k === "ArrowRight" ? st : 0, k === "ArrowUp" ? -st : k === "ArrowDown" ? st : 0); return; }
    if (!mod && !e.altKey) {
      const t = e.shiftKey ? { l: "arrow" }[lk] : { v: "move", f: "frame", a: "frame", r: "rect", o: "ellipse", l: "line", t: "text", h: "hand", k: "move" }[lk];
      if (t) { e.preventDefault(); setTool(t); return; }
    }
  }
  const keyUp = (e) => { if (e.key === " ") { S.space = false; stage.style.cursor = ""; } };
  root.addEventListener("keydown", onKey); root.addEventListener("keyup", keyUp);
  const loose = () => { const a = document.activeElement; return !a || a === document.body || a === document.documentElement; };
  const docKey = (e) => { if (!e.defaultPrevented && loose() && root.isConnected && isTop()) onKey(e); };
  document.addEventListener("keydown", docKey); document.addEventListener("keyup", keyUp);
  stage.addEventListener("pointermove", (e) => { S.last = toW(e.clientX, e.clientY); });

  /* ---------- menus ---------- */
  function contextMenu(e) {
    e.preventDefault(); if (ro) return;
    const w = toW(e.clientX, e.clientY), p = pickAt(w.x, w.y, e.ctrlKey);
    if (p && !p.frameBg && !S.sel.has(p.id)) setSel([p.id]);
    const s = selTops(), one = s.length === 1 ? s[0] : null;
    const items = s.length ? [
      { t: "Copy", i: "copy", k: "Ctrl C", run: () => copySel(false) }, { t: "Paste here", k: "Ctrl V", run: () => { const d2 = ls.get("dzClip", null); if (d2) pasteData(d2, w); } }, { t: "Duplicate", i: "dup", k: "Ctrl D", run: duplicate }, { t: "Delete", i: "trash", k: "Del", run: del }, "-",
      { t: "Bring to front", i: "front", k: "Ctrl ⇧ ]", run: () => order("front") }, { t: "Send to back", i: "back", k: "Ctrl ⇧ [", run: () => order("back") }, "-",
      { t: "Group", i: "frame", k: "Ctrl G", run: () => groupSel() }, ...(s.some((n) => n.t === "group" || n.t === "bool" || n.t === "frame") ? [{ t: n0(s) === "frame" ? "Remove frame" : "Ungroup", i: "ungroup", k: "Ctrl ⇧ G", run: ungroup }] : []),
      { t: "Frame selection", i: "frame", k: "Ctrl Alt G", run: frameSel },
      ...(s.length > 1 ? [{ t: "Use as mask", k: "Ctrl Alt M", run: mask }, { t: "Boolean", sub: [["union", "Union"], ["subtract", "Subtract"], ["intersect", "Intersect"], ["exclude", "Exclude"]].map(([k2, t2]) => ({ t: t2, run: () => groupSel("bool", k2) })) }] : []), "-",
      { t: s.every((n) => n.hide) ? "Show" : "Hide", i: "eye", k: "Ctrl ⇧ H", run: () => toggle("hide") }, { t: s.every((n) => n.lock) ? "Unlock" : "Lock", i: "lock", k: "Ctrl ⇧ L", run: () => toggle("lock") },
      ...(one ? [{ t: "Rename", i: "pencil", k: "F2", run: () => renameNode(one.id) }] : []), "-",
      { t: "Export as PNG (2x)", i: "download", k: "Ctrl ⇧ E", run: () => exportNodes(s.map((n) => n.id), "png", 2) }, { t: "Copy as PNG", i: "image", run: () => copyPng(s[0].id) },
    ] : [
      { t: "Paste here", k: "Ctrl V", run: () => { const d2 = ls.get("dzClip", null); if (d2) pasteData(d2, w); } }, { t: "Place a picture…", i: "image", run: pickImages }, "-",
      { t: "Show everything", i: "fit", k: "⇧ 1", run: () => fitTo(allBox()) }, { t: "Zoom to 100%", k: "⇧ 0", run: () => zoomAt(1 / S.view.z, e.clientX, e.clientY) },
    ];
    menu(e.clientX, e.clientY, items);
  }
  const n0 = (s) => (s.every((n) => n.t === "frame") ? "frame" : "");
  async function copyPng(nid) { try { const b = await exportImage(D.nodes, nid, { scale: 2 }); await navigator.clipboard.write([new ClipboardItem({ "image/png": b })]); toast("Copied as a picture"); } catch { toast("Your browser did not allow copying a picture."); } }
  function layerMenu(e) { const row = e.target.closest("[data-node]"); if (row && !S.sel.has(row.dataset.node)) setSel([row.dataset.node]); contextMenu({ preventDefault() {}, clientX: e.clientX, clientY: e.clientY, ctrlKey: true, target: e.target }); }

  /* ---------- top bar ---------- */
  function tb(t, ic, label, k) { return `<button class="dz-tb" data-tool="${t}" title="${label} (${k})" aria-label="${label}" aria-pressed="${t === "move"}">${I(ic, 20)}</button>`; }
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-tool],[data-a]"); if (!b || !root.contains(b)) return;
    if (b.dataset.tool) { if (b.dataset.tool === "image") { pickImages(); return; } setTool(b.dataset.tool); return; }
    const a = b.dataset.a;
    if (a === "back") { close().then(() => { A.ed = null; home(); R.item(A.body, "", "Design", "push"); }); }
    if (a === "present") startPresent();
    if (a === "share") share();
    if (a === "shapes") { const r = b.getBoundingClientRect(); menu(r.left, r.bottom + 6, [{ t: "Arrow", i: "arrow-right", k: "⇧ L", run: () => setTool("arrow") }, { t: "Polygon", run: () => setTool("polygon") }, { t: "Star", i: "star", run: () => setTool("star") }]); }
    if (a === "zoom") { const r = b.getBoundingClientRect(); menu(r.left, r.bottom + 6, [{ t: "Zoom in", k: "Ctrl +", run: () => zoomAt(1.25, rect.left + rect.width / 2, rect.top + rect.height / 2) }, { t: "Zoom out", k: "Ctrl −", run: () => zoomAt(0.8, rect.left + rect.width / 2, rect.top + rect.height / 2) }, "-", { t: "Zoom to fit", k: "⇧ 1", run: () => fitTo(allBox()) }, { t: "Zoom to selection", k: "⇧ 2", run: () => fitTo(selBox() || allBox(), 80, 8) }, { t: "Zoom to 100%", k: "⇧ 0", run: () => zoomAt(1 / S.view.z, rect.left + rect.width / 2, rect.top + rect.height / 2) }]); }
  });
  const nameEl = $(".dz-name", root);
  nameEl.addEventListener("change", async () => { const t = nameEl.value.trim(); meta.title = t; R.item(A.body, id, `${title(meta)} — Design`, "replace"); await api("/api/designs?id=" + id, { method: "PUT", body: { title: t } }); });
  nameEl.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); nameEl.blur(); stage.focus({ preventScroll: true }); } });
  $$("[data-tab]", root).forEach((b) => (b.onclick = () => { S.tab = b.dataset.tab; $$("[data-tab]", root).forEach((x) => x.setAttribute("aria-selected", String(x === b))); panels(); }));

  /* ---------- what the panels use ---------- */
  const API = {
    get D() { return D; }, get S() { return S; }, get meta() { return meta; }, ro, N, kids, selTops, selNodes, parentOf, ancestors, boxOf, worldM,
    setSel, setProp, begin, touch, commit, touchDoc, textStyle, curRunStyle, align, distribute, order, groupSel, ungroup, mask, del, duplicate, toggle, renameNode, fitParents, fitGroup, adopt, restructure,
    paint, panels, setTool, startPresent, exportNodes, slideIds, textSize, PRESETS, lastFont, editing: () => te,
    addFrame(w, hh, name) { // a new frame next to the others, in view
      begin(); const tops = kids("").filter((n) => n.t === "frame"), right = tops.length ? Math.max(...tops.map((n) => n.x + n.w)) + 100 : 0, y = tops.length ? Math.min(...tops.map((n) => n.y)) : 0;
      const f = make("frame", right, y, w, hh); f.name = name || newName("frame"); insert(f, null); setTool("move"); setSel([f.id]); commit(); fitTo(boxOf(f), 80, 1);
    },
    setBg(c) { touchDoc("bg"); D.bg = c; commit(); },
    setSlides(list) { touchDoc("slides"); D.slides = list.filter((i) => N(i)); commit(); },
    setSwatches(list) { D.sw = list.slice(0, 40); Q.meta = true; queue(); panels(); },
    pickImages, fitTo, zoomTo: (nid) => fitTo(boxOf(N(nid)), 80, 4), reorderLayer(nid, pid, z) {
      const n = N(nid); if (!n) return; begin(); touch(nid);
      if ((n.parent || null) !== (pid || null)) adopt(n, pid);
      const list = kids(pid || "").filter((x) => x.id !== nid); list.splice(clamp(z, 0, list.length), 0, n);
      list.forEach((x, i) => { if ((x.z || 0) !== i) { touch(x.id); x.z = i; } }); restructure(); fitParents([n]); commit();
    },
    share, status,
  };

  /* ---------- start ---------- */
  async function close() {
    if (S.dead) return; endText(); await flush(); clearTimeout(Q.thumbT); if (!ro && (Q.thumbAt < Date.now() - 5000)) await makeThumb().catch(() => {});
    S.dead = true; rs.disconnect(); cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
    document.removeEventListener("keydown", docKey); document.removeEventListener("keyup", keyUp); document.removeEventListener("paste", onPaste);
    document.fonts.removeEventListener("loadingdone", onFonts); setImageListener(null); closeMenu();
  }
  addEventListener("pagehide", () => { if (!S.dead) { persistPend(); flush(); } });
  if (location.hostname === "localhost" || location.host.includes("--")) window.__dz = API; // for checking on preview copies only
  sizeCanvas(); panels();
  ready(D.nodes).then(() => { onFonts(); paint(); });
  if (!ls.get("dzView:" + id, null)) requestAnimationFrame(() => { rect = stage.getBoundingClientRect(); fitTo(allBox(), 80, 1); });
  zoomEl.textContent = Math.round(S.view.z * 100) + "%";
  stage.focus({ preventScroll: true });
  if (fresh && !kids("").length) setTool("frame");
  return { close, contextMenu, layerMenu, flush, get api() { return API; } };
}
