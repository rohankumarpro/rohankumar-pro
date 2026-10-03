// Tiling: put windows side by side in any grid you like (desktop only).
//
// The layout is a tree. A "split" lays its children out in a row (side by side) or a column (stacked); a "leaf" is one
// tile that holds one app, or several apps as tabs, or nothing (an empty slot with a + to add an app).
//   - Drag a window by its title bar to the left or right edge of the screen: it takes that side, the rest becomes a slot.
//   - Drag a window onto a tile: the edge you hover splits that tile in that direction, the middle adds it as a tab.
//   - Drag the gap between two tiles to resize them. Double-click the gap to make them equal.
//   - Any shape works: two columns with the first split in two rows, three over two, a 4x4 grid...
// Windows that are not in the layout float as before. Nothing here is saved between visits.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const GAP = 10, MINW = 200, MINH = 130, EDGE = 26;
const html = document.documentElement;
const mob = () => innerWidth <= 760;
let seq = 0;
const T = { root: null, layer: null, ghost: null, pick: null, raf: 0, locked: false, full: false };
const say = (m) => window.toast && window.toast(m);

const leaf = (tabs = [], hole = false) => ({ t: "leaf", id: ++seq, tabs: tabs.slice(), active: tabs[0] || null, hole: hole || !tabs.length });
const split = (dir, kids, sizes) => ({ t: "split", dir, kids, sizes: sizes || kids.map(() => 1 / kids.length) });
const desk = () => document.getElementById("desk");
const wins = () => document.getElementById("wins");

/* ---------------- tree helpers ---------------- */
function walk(n, f, parent = null) { if (!n) return; f(n, parent); if (n.t === "split") n.kids.slice().forEach((k) => walk(k, f, n)); }
const leaves = () => { const o = []; walk(T.root, (n) => n.t === "leaf" && o.push(n)); return o; };
const parentOf = (n) => { let p = null; walk(T.root, (x, par) => { if (x === n) p = par; }); return p; };
const leafOf = (id) => leaves().find((l) => l.tabs.includes(id));
const winOf = (id) => open[id] || null; // `open` is the OS table of running windows (a global const), not window.open
const apps = () => { const o = []; leaves().forEach((l) => o.push(...l.tabs)); return o; };

function replaceNode(oldN, newN) { const p = parentOf(oldN); if (!p) T.root = newN; else p.kids[p.kids.indexOf(oldN)] = newN; }
function normalize() {
  let again = true;
  while (again) {
    again = false;
    walk(T.root, (n, p) => {
      if (n.t !== "split") return;
      // a split with one child is just that child
      if (n.kids.length === 1) { replaceNode(n, n.kids[0]); again = true; return; }
      // a split inside a split of the same direction joins it
      n.kids.slice().forEach((k, i) => {
        if (k.t === "split" && k.dir === n.dir) {
          const share = n.sizes[i], at = n.kids.indexOf(k);
          n.kids.splice(at, 1, ...k.kids); n.sizes.splice(at, 1, ...k.sizes.map((s) => s * share)); again = true;
        }
      });
    });
  }
  walk(T.root, (n) => { if (n.t === "split") { const sum = n.sizes.reduce((a, b) => a + b, 0) || 1; n.sizes = n.sizes.map((s) => s / sum); } });
  // a layout made only of empty slots is no layout
  if (T.root && !leaves().some((l) => l.tabs.length)) T.root = null;
}
function removeNode(n) {
  const p = parentOf(n);
  if (!p) { T.root = null; return; }
  const i = p.kids.indexOf(n); p.kids.splice(i, 1); p.sizes.splice(i, 1);
  normalize();
}
function removeApp(id) {
  const l = leafOf(id); if (!l) return;
  l.tabs = l.tabs.filter((x) => x !== id);
  if (l.active === id) l.active = l.tabs[l.tabs.length - 1] || null;
  if (!l.tabs.length) removeNode(l);
  normalize();
}

/* ---------------- geometry ---------------- */
function work() {
  const d = desk(), H = d.clientHeight, sh = document.getElementById("shelf");
  // in the installed app the window buttons float over the top of the page, so start below them
  if (T.full) { const o = navigator.windowControlsOverlay, y = o && o.visible ? Math.round(o.getTitlebarAreaRect().height) + 6 : 12; return { x: 12, y, w: d.clientWidth - 24, h: H - y - 12 }; }
  let bottom = 34;
  if (sh && !/dock-(auto|peek)/.test(html.className)) { const r = sh.getBoundingClientRect(), top = r.top - d.getBoundingClientRect().top; if (r.height && top < H - 20) bottom = Math.max(34, H - top + 10); else bottom = 92; }
  return { x: 12, y: 48, w: d.clientWidth - 24, h: H - 48 - bottom };
}
function place(n, r) {
  n.rect = r;
  if (n.t !== "split") return;
  const row = n.dir === "row", total = row ? r.w : r.h; let pos = row ? r.x : r.y;
  n.kids.forEach((k, i) => {
    const last = i === n.kids.length - 1, len = last ? (row ? r.x + r.w : r.y + r.h) - pos : Math.round(total * n.sizes[i]);
    place(k, row ? { x: pos, y: r.y, w: len, h: r.h } : { x: r.x, y: pos, w: r.w, h: len });
    pos += len;
  });
}
const inset = (r) => ({ x: r.x + GAP / 2, y: r.y + GAP / 2, w: r.w - GAP, h: r.h - GAP });

/* ---------------- drawing ---------------- */
function ensureLayer() {
  if (T.layer && T.layer.isConnected) return T.layer;
  T.layer = document.createElement("div"); T.layer.id = "tiles"; T.layer.setAttribute("aria-hidden", "false");
  desk().insertBefore(T.layer, wins());
  return T.layer;
}
function paintTabs(l) {
  l.tabs.forEach((id) => {
    const w = winOf(id); if (!w) return; const ttl = $(".ttl", w); if (!ttl) return;
    if (!w.dataset.title) w.dataset.title = ttl.textContent;
    if (l.tabs.length > 1 && l.active === id) {
      ttl.classList.add("tabs"); ttl.textContent = "";
      l.tabs.forEach((tid) => {
        const tw = winOf(tid), b = document.createElement("button"); b.type = "button"; b.className = "tab" + (tid === l.active ? " on" : ""); b.textContent = (tw && (tw.dataset.title || $(".ttl", tw)?.textContent)) || tid;
        b.onclick = (e) => { e.stopPropagation(); activate(l, tid); };
        b.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); const wt = winOf(tid); if (!wt) return; window.showCtx(e.clientX, e.clientY, [["Move out of the tabs", () => float(tid)], ["Close", () => { const x = $(".x", wt); x && x.click(); }, "danger"]]); };
        ttl.appendChild(b);
      });
    } else { ttl.classList.remove("tabs"); ttl.textContent = w.dataset.title; }
  });
}
function build() {
  const layer = ensureLayer(); layer.innerHTML = "";
  if (!T.root) return;
  walk(T.root, (n) => {
    if (n.t === "split") {
      for (let i = 0; i < n.kids.length - 1; i++) {
        const d = document.createElement("div"); d.className = "tile-div " + n.dir; d.setAttribute("role", "separator"); d.setAttribute("aria-orientation", n.dir === "row" ? "vertical" : "horizontal"); d.tabIndex = 0;
        d.title = "Drag to resize. Double-click to make equal."; d.dataset.i = i; d.__split = n;
        d.innerHTML = '<i></i>'; wireDivider(d, n, i); layer.appendChild(d);
      }
    } else if (!n.tabs.length) {
      const s = document.createElement("div"); s.className = "tile-slot"; s.__leaf = n;
      s.innerHTML = '<button class="add" aria-label="Add an app here"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button><span>Add an app</span><button class="x" aria-label="Remove this slot" title="Remove this slot"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>';
      $(".add", s).onclick = () => pickFor(n);
      $(".x", s).onclick = (e) => { e.stopPropagation(); removeNode(n); render(); };
      s.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); window.showCtx(e.clientX, e.clientY, [["Add an app", () => pickFor(n)], ["Split right", () => splitHole(n, "right")], ["Split below", () => splitHole(n, "bottom")], null, ["Remove this slot", () => { removeNode(n); render(); }, "danger"]]); };
      layer.appendChild(s);
    }
  });
  apply();
}
function apply() {
  if (!T.root) return;
  const a = work(); place(T.root, { x: a.x - GAP / 2, y: a.y - GAP / 2, w: a.w + GAP, h: a.h + GAP });
  const layer = T.layer;
  walk(T.root, (n) => {
    if (n.t === "leaf") {
      const r = inset(n.rect);
      if (n.tabs.length) {
        n.tabs.forEach((id) => {
          const w = winOf(id); if (!w) return;
          if (w.classList.contains("min") || w.classList.contains("minimizing")) return; // resting in the dock: its slot waits for it
          w.classList.remove("max"); w.classList.add("tiled"); w.classList.toggle("tabhid", id !== n.active);
          Object.assign(w.style, { left: r.x + "px", top: r.y + "px", width: r.w + "px", height: r.h + "px" });
        });
      }
    }
  });
  $$(".tile-div", layer).forEach((d) => {
    const n = d.__split, i = +d.dataset.i, k = n.kids[i], row = n.dir === "row", r = n.rect;
    if (row) Object.assign(d.style, { left: k.rect.x + k.rect.w - GAP / 2 + "px", top: r.y + GAP / 2 + "px", width: GAP + "px", height: r.h - GAP + "px" });
    else Object.assign(d.style, { left: r.x + GAP / 2 + "px", top: k.rect.y + k.rect.h - GAP / 2 + "px", width: r.w - GAP + "px", height: GAP + "px" });
  });
  $$(".tile-slot", layer).forEach((s) => { const r = inset(s.__leaf.rect); Object.assign(s.style, { left: r.x + "px", top: r.y + "px", width: r.w + "px", height: r.h + "px" }); });
}
function render() {
  normalize();
  leaves().forEach((l) => { l.tabs = l.tabs.filter((id) => winOf(id)); if (l.active && !l.tabs.includes(l.active)) l.active = l.tabs[0] || null; });
  normalize();
  html.classList.toggle("has-tiles", !!T.root);
  if (!T.root) { T.locked = false; if (T.full) setFull(false); html.classList.remove("grp-locked"); if (T.layer) T.layer.innerHTML = ""; return; }
  build(); leaves().forEach(paintTabs);
}
const later = () => { cancelAnimationFrame(T.raf); T.raf = requestAnimationFrame(() => T.root && apply()); };

/* ---------------- dividers: resize any two neighbours ---------------- */
function wireDivider(d, n, i) {
  let st = null;
  const move = (e) => {
    if (!st) return;
    const delta = ((st.row ? e.clientX : e.clientY) - st.p) / st.total, min = (st.row ? MINW : MINH) / st.total;
    const both = st.a + st.b, na = Math.max(min, Math.min(both - min, st.a + delta));
    n.sizes[i] = na; n.sizes[i + 1] = both - na; apply();
  };
  const end = () => { if (!st) return; st = null; html.classList.remove("tile-live"); d.classList.remove("on"); removeEventListener("pointermove", move); removeEventListener("pointerup", end); removeEventListener("pointercancel", end); };
  d.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return; e.preventDefault();
    try { d.setPointerCapture(e.pointerId); } catch {}
    html.classList.add("tile-live"); d.classList.add("on");
    const row = n.dir === "row"; st = { p: row ? e.clientX : e.clientY, a: n.sizes[i], b: n.sizes[i + 1], total: row ? n.rect.w : n.rect.h, row };
    addEventListener("pointermove", move); addEventListener("pointerup", end); addEventListener("pointercancel", end);
  });
  d.addEventListener("mousedown", (e) => e.preventDefault());
  d.addEventListener("dblclick", () => { const both = n.sizes[i] + n.sizes[i + 1]; n.sizes[i] = n.sizes[i + 1] = both / 2; apply(); });
  d.addEventListener("keydown", (e) => {
    const row = n.dir === "row", step = 28 / (row ? n.rect.w : n.rect.h), min = (row ? MINW : MINH) / (row ? n.rect.w : n.rect.h);
    const dec = e.key === (row ? "ArrowLeft" : "ArrowUp"), inc = e.key === (row ? "ArrowRight" : "ArrowDown"); if (!dec && !inc) return; e.preventDefault();
    const both = n.sizes[i] + n.sizes[i + 1], na = Math.max(min, Math.min(both - min, n.sizes[i] + (inc ? step : -step))); n.sizes[i] = na; n.sizes[i + 1] = both - na; apply();
  });
  d.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); window.showCtx(e.clientX, e.clientY, [["Make these equal", () => { const both = n.sizes[i] + n.sizes[i + 1]; n.sizes[i] = n.sizes[i + 1] = both / 2; apply(); }], ["Make every tile in this row equal", () => { n.sizes = n.kids.map(() => 1 / n.kids.length); apply(); }], ["Add a slot here", () => { const l = leaf([], true); n.kids.splice(i + 1, 0, l); n.sizes = n.kids.map(() => 1 / n.kids.length); render(); }]]); };
}

/* ---------------- operations ---------------- */
function floatRect(w) { if (!w.classList.contains("tiled") && !w.classList.contains("max") && w.offsetWidth) w.__float = { left: w.offsetLeft, top: w.offsetTop, width: w.offsetWidth, height: w.offsetHeight }; }
function sideDir(side) { return side === "left" || side === "right" ? "row" : "col"; }
function splitLeaf(l, side, id, hole) {
  const dir = sideDir(side), before = side === "left" || side === "top", nl = hole ? leaf([], true) : leaf([id]), p = parentOf(l);
  if (p && p.dir === dir) {
    const i = p.kids.indexOf(l), share = p.sizes[i] / 2; p.sizes[i] = share; p.kids.splice(before ? i : i + 1, 0, nl); p.sizes.splice(before ? i : i + 1, 0, share);
  } else replaceNode(l, split(dir, before ? [nl, l] : [l, nl]));
  return nl;
}
const splitHole = (l, side) => { splitLeaf(l, side, null, true); render(); };
function wrapRoot(side, id) {
  const dir = sideDir(side), before = side === "left" || side === "top", nl = leaf([id]);
  if (!T.root) T.root = split(dir, before ? [nl, leaf([], true)] : [leaf([], true), nl]);
  else T.root = split(dir, before ? [nl, T.root] : [T.root, nl], before ? [0.38, 0.62] : [0.62, 0.38]);
}
/* the tile touching a side of the layout (the middle one if several do) */
function edgeLeaf(side) {
  if (!T.root) return null;
  const ls = leaves(), cy = work().y + work().h / 2, cx = work().x + work().w / 2;
  const edge = side === "left" ? Math.min(...ls.map((l) => l.rect.x)) : Math.max(...ls.map((l) => l.rect.x + l.rect.w));
  const on = ls.filter((l) => Math.abs((side === "left" ? l.rect.x : l.rect.x + l.rect.w) - edge) < 2);
  return on.find((l) => cy >= l.rect.y && cy <= l.rect.y + l.rect.h) || on[0] || null;
}
function tile(id, target) {
  const w = winOf(id); if (!w) return;
  if (T.locked && !leafOf(id)) { say("This group is locked. Release it to start a new layout."); return; }
  floatRect(w);
  removeApp(id);
  const eh = target.kind === "edge" ? edgeLeaf(target.side) : null;
  if (eh && !eh.tabs.length) { eh.tabs = [id]; eh.active = id; eh.hole = false; }
  else if (target.kind === "edge") wrapRoot(target.side, id);
  else {
    const l = target.leaf;
    if (!T.root || !leaves().includes(l)) wrapRoot("left", id);
    else if (!l.tabs.length) { l.tabs = [id]; l.active = id; l.hole = false; }
    else if (target.zone === "center") { l.tabs.push(id); l.active = id; }
    else splitLeaf(l, target.zone, id);
  }
  render(); window.focus && window.focus(w);
}
function float(id, opt = {}) {
  const w = winOf(id); const l = leafOf(id); if (!l) return;
  removeApp(id);
  if (w) {
    w.classList.remove("tiled", "tabhid"); const f = w.__float;
    if (f && !opt.keep) Object.assign(w.style, { left: f.left + "px", top: f.top + "px", width: f.width + "px", height: f.height + "px" });
    const ttl = $(".ttl", w); if (ttl && w.dataset.title) { ttl.classList.remove("tabs"); ttl.textContent = w.dataset.title; }
  }
  render();
}
function releaseAll() { setFull(false); T.locked = false; apps().forEach((id) => float(id)); T.root = null; render(); }
function equalise(n) { walk(n, (x) => { if (x.t === "split") x.sizes = x.kids.map(() => 1 / x.kids.length); }); apply(); }
function swapLeaves(a, b) {
  if (!a || !b || a === b) return;
  [a.tabs, b.tabs] = [b.tabs, a.tabs]; [a.active, b.active] = [b.active, a.active]; a.hole = !a.tabs.length; b.hole = false; render();
}
/* every open window into one tidy bento layout, in one go */
function autoGrid() {
  if (mob()) { say("Grids need a bigger screen."); return false; }
  const prior = apps(), run = Object.keys(open).filter((id) => { const w = open[id]; return w && !w.classList.contains("min") && !w.classList.contains("minimizing"); });
  const ids = [...prior.filter((id) => run.includes(id)), ...run.filter((id) => !prior.includes(id))];
  if (ids.length < 2) { say("Open two or more apps to arrange them."); return false; }
  setFull(false); T.locked = false; T.pick = null;
  prior.filter((id) => !ids.includes(id)).forEach((id) => float(id, { keep: true })); // minimised ones are not part of the new grid
  ids.forEach((id) => { const w = winOf(id); if (w) floatRect(w); });
  T.root = null; seq = 0;
  const L = (id) => leaf([id]), n = ids.length; let root;
  if (n === 2) root = split("row", ids.map(L));
  else if (n === 3) root = split("row", [L(ids[0]), split("col", [L(ids[1]), L(ids[2])])], [0.55, 0.45]);
  else {
    const rows = Math.max(2, Math.round(Math.sqrt(n / 1.6))), per = []; for (let i = 0; i < rows; i++) per.push(Math.floor(n / rows) + (i < n % rows ? 1 : 0));
    let k = 0; const rs = per.map((c) => { const cells = ids.slice(k, k + c).map(L); k += c; return cells.length === 1 ? cells[0] : split("row", cells); });
    root = split("col", rs);
  }
  T.root = root; render(); const f = winOf(ids[0]); f && window.focus && window.focus(f); return true;
}
function setLocked(on) { if (!T.root) return; T.locked = !!on; html.classList.toggle("grp-locked", T.locked); say(T.locked ? "Group locked. Drag to swap places, drag the gaps to resize." : "Group unlocked."); }
function setFull(on) {
  on = !!on && !!T.root; if (T.full === on) return; T.full = on; html.classList.toggle("grp-full", on);
  let b = document.getElementById("grpExit");
  if (on) {
    if (!b) { b = document.createElement("button"); b.id = "grpExit"; b.type = "button"; b.className = "grp-exit pill"; b.textContent = "Exit full screen"; b.onclick = () => setFull(false); document.getElementById("desk").appendChild(b); }
    b.hidden = false; try { const r = document.documentElement; if (!document.fullscreenElement && r.requestFullscreen) { T.fsOwn = true; r.requestFullscreen().catch(() => { T.fsOwn = false; }); } } catch { T.fsOwn = false; }
  } else {
    if (b) b.hidden = true;
    try { if (T.fsOwn && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); } catch {} T.fsOwn = false;
  }
  later();
}
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && T.full) setFull(false); });
document.addEventListener("fullscreenchange", () => { if (T.full && T.fsOwn && !document.fullscreenElement) setFull(false); });
function activate(l, id) { l.active = id; render(); const w = winOf(id); w && window.focus && window.focus(w); }
function pickFor(l) {
  if (T.locked) { say("This group is locked. Release it to start a new layout."); return; }
  T.pick = l; clearTimeout(T.pickT); T.pickT = setTimeout(() => (T.pick = null), 30000);
  window.toast && window.toast("Pick an app for this slot"); window.toggleLauncher && (document.getElementById("launcher").hidden ? window.toggleLauncher() : 0);
}

/* ---------------- dropping a dragged window ---------------- */
function zoneOf(r, x, y) {
  const bx = Math.min(150, r.w * 0.26), by = Math.min(110, r.h * 0.26);
  const dl = x - r.x, dr = r.x + r.w - x, dt = y - r.y, db = r.y + r.h - y;
  const near = [["left", dl / bx], ["right", dr / bx], ["top", dt / by], ["bottom", db / by]].filter((z) => z[1] < 1).sort((a, b) => a[1] - b[1]);
  return near.length ? near[0][0] : "center";
}
function targetAt(x, y) {
  const a = work(), d = desk().getBoundingClientRect(); x -= d.left; y -= d.top;
  if (y < a.y - 6 || y > a.y + a.h + 6) return null;
  if (x < a.x + EDGE - 12) return { kind: "edge", side: "left" };
  if (x > a.x + a.w - EDGE + 12) return { kind: "edge", side: "right" };
  if (!T.root) return null;
  const l = leaves().find((l) => x >= l.rect.x && x <= l.rect.x + l.rect.w && y >= l.rect.y && y <= l.rect.y + l.rect.h);
  if (!l) return null;
  return { kind: "leaf", leaf: l, zone: l.tabs.length ? zoneOf(l.rect, x, y) : "center" };
}
function ghostRect(t) {
  const a = work();
  if (t.kind === "edge") {
    const eh = edgeLeaf(t.side); if (eh && !eh.tabs.length) return { ...eh.rect, label: "Fill this slot" };
    const whole = T.root ? 0.38 : 0.5, w = a.w * whole;
    const g = t.side === "left" ? { x: a.x, y: a.y, w, h: a.h } : { x: a.x + a.w - w, y: a.y, w, h: a.h };
    return { ...g, label: T.root ? "New column" : "Half screen" };
  }
  const r = t.leaf.rect, z = t.zone; let g;
  if (z === "center") g = r; else if (z === "left") g = { x: r.x, y: r.y, w: r.w / 2, h: r.h }; else if (z === "right") g = { x: r.x + r.w / 2, y: r.y, w: r.w / 2, h: r.h }; else if (z === "top") g = { x: r.x, y: r.y, w: r.w, h: r.h / 2 }; else g = { x: r.x, y: r.y + r.h / 2, w: r.w, h: r.h / 2 };
  return { ...g, label: t.swap ? "Swap places" : !t.leaf.tabs.length ? "Fill this slot" : z === "center" ? "Add as a tab" : "Split " + z };
}
function showGhost(t) {
  if (!t) { if (T.ghost) T.ghost.hidden = true; return; }
  if (!T.ghost) { T.ghost = document.createElement("div"); T.ghost.className = "tile-ghost"; desk().appendChild(T.ghost); }
  const g = ghostRect(t), plain = g.label === "New column" || g.label === "Half screen", r = plain ? g : inset(g);
  T.ghost.hidden = false; T.ghost.innerHTML = `<b>${g.label}</b>`;
  Object.assign(T.ghost.style, { left: r.x + "px", top: r.y + "px", width: r.w + "px", height: r.h + "px" });
}

/* ---------------- our own window dragging (replaces the plain one) ---------------- */
function drag(w) {
  const bar = w.querySelector(".bar"); let st = null;
  bar.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest("button:not(.tab)") || mob() || w.classList.contains("max")) return;
    if (e.target.closest(".tab")) return;
    const tiled = w.classList.contains("tiled"), r0 = w.getBoundingClientRect();
    st = { sx: e.clientX, sy: e.clientY, id: e.pointerId, moved: false, tiled, r0, ox: w.offsetLeft, oy: w.offsetTop, t: null, lock: tiled && T.locked };
    bar.setPointerCapture(e.pointerId); bar.style.cursor = "grabbing";
  });
  bar.addEventListener("pointermove", (e) => {
    if (!st || e.pointerId !== st.id) return;
    let dx = e.clientX - st.sx, dy = e.clientY - st.sy;
    if (!st.moved) {
      if (Math.hypot(dx, dy) < 5) return; st.moved = true;
      if (st.lock) w.classList.add("lifting");
      else if (st.tiled) { // lift the window out of the layout, back to the size it had before
        const id = w.dataset.app, f = w.__float || { width: Math.min(760, innerWidth - 100), height: Math.min(540, innerHeight - 160) };
        const rel = Math.max(0.1, Math.min(0.9, (st.sx - st.r0.left) / st.r0.width));
        float(id, { keep: true });
        Object.assign(w.style, { width: f.width + "px", height: f.height + "px" });
        st.ox = e.clientX - rel * f.width; st.oy = e.clientY - (st.sy - st.r0.top); st.sx = e.clientX; st.sy = e.clientY; dx = 0; dy = 0;
        w.style.left = st.ox + "px"; w.style.top = st.oy + "px";
      }
      html.classList.add("tile-dragging");
    }
    w.style.left = Math.min(innerWidth - 80, Math.max(-w.offsetWidth + 80, st.ox + dx)) + "px";
    w.style.top = Math.min(innerHeight - 120, Math.max(44, st.oy + dy)) + "px";
    if (st.lock) { const t = targetAt(e.clientX, e.clientY); st.t = t && t.kind === "leaf" && t.leaf !== leafOf(w.dataset.app) ? { kind: "leaf", leaf: t.leaf, zone: "center", swap: true } : null; }
    else st.t = T.locked ? null : targetAt(e.clientX, e.clientY);
    showGhost(st.t);
  });
  const end = (e) => {
    if (!st || (e && e.pointerId !== st.id)) return;
    const s = st; st = null; bar.style.cursor = ""; html.classList.remove("tile-dragging"); showGhost(null);
    if (s.lock) { w.classList.remove("lifting"); if (s.moved && s.t && e && e.type === "pointerup") swapLeaves(leafOf(w.dataset.app), s.t.leaf); else apply(); }
    else if (s.moved && s.t && e && e.type === "pointerup") tile(w.dataset.app, s.t); else if (s.moved) { const f = { left: w.offsetLeft, top: w.offsetTop, width: w.offsetWidth, height: w.offsetHeight }; w.__float = f; }
  };
  bar.addEventListener("pointerup", end); bar.addEventListener("pointercancel", end);
  bar.addEventListener("dblclick", (e) => {
    if (e.target.closest("button") || mob()) return;
    if (w.classList.contains("tiled")) { if (!T.locked) float(w.dataset.app); return; }
    w.classList.add("resizing-anim"); w.classList.toggle("max"); setTimeout(() => w.classList.remove("resizing-anim"), 380);
  });
}

/* ---------------- wiring into the OS ---------------- */
const _close = window.closeWin, _min = window.minimizeWin;
window.closeWin = function (w, id, ...r) { if (w.classList.contains("tiled")) { removeApp(id); render(); } return _close.call(this, w, id, ...r); };
window.minimizeWin = function (w, id, ...r) { return _min.call(this, w, id, ...r); }; // a minimised tile keeps its place in the layout, and comes back to it
window.drag = drag;
/* maximise on a tiled window takes it out of the layout first */
document.addEventListener("click", (e) => { const b = e.target.closest(".win.tiled .wb.mx"); if (b && !T.locked) float(b.closest(".win").dataset.app); else if (b) { e.stopPropagation(); e.preventDefault(); say("Unlock the group to maximise a window."); } }, true);
/* opening an app from an empty slot's + puts it in that slot; opening a hidden tab shows it */
window.__tileOpen = (w, id) => {
  if (mob()) return;
  if (T.pick && leaves().includes(T.pick) && !T.pick.tabs.includes(id)) { const l = T.pick; T.pick = null; floatRect(w); removeApp(id); if (leaves().includes(l)) { l.tabs = [id]; l.active = id; l.hole = false; } else wrapRoot("left", id); render(); return; }
  const l = leafOf(id); if (l) { if (l.active !== id) activate(l, id); else apply(); }
};
/* what the right-click menu offers for a window */
const groupItems = () => !T.root ? [] : [
  [T.locked ? "Unlock this group" : "Lock this group (no new apps)", () => setLocked(!T.locked)],
  [T.full ? "Exit full screen group" : "Full screen this group", () => setFull(!T.full)],
];
window.__tileMenu = (w) => {
  if (mob()) return [];
  const id = w.dataset.app, l = leafOf(id), o = [];
  if (l) {
    if (!T.locked) {
      o.push(["Split right (new slot)", () => splitHole(l, "right")], ["Split below (new slot)", () => splitHole(l, "bottom")]);
      if (l.tabs.length > 1) o.push(["Move out of the tabs", () => float(id)]);
      o.push(["Float this window", () => float(id)]);
    }
    const p = parentOf(l); if (p) o.push(["Make these tiles equal", () => equalise(p)]);
    o.push(...groupItems(), ["Release all tiles", releaseAll]);
  } else if (!T.locked) {
    o.push(["Tile to the left", () => { tile(id, { kind: "edge", side: "left" }); }], ["Tile to the right", () => { tile(id, { kind: "edge", side: "right" }); }]);
    if (T.root) o.push(...groupItems(), ["Release all tiles", releaseAll]);
  }
  return o;
};
window.__tileDesktop = () => {
  const n = Object.keys(open).filter((id) => !open[id].classList.contains("min")).length, o = [];
  if (!mob() && n > 1) o.push(["Arrange open apps in a grid", autoGrid]);
  if (T.root) o.push(...groupItems(), ["Release all tiles", releaseAll]);
  return o;
};
addEventListener("resize", later);
new MutationObserver(later).observe(html, { attributes: true, attributeFilter: ["class"] });
window.Tiles = { tile, float, releaseAll, autoGrid, lock: setLocked, full: setFull, locked: () => T.locked, isFull: () => T.full, active: () => !!T.root, state: () => T.root };
