// A database, shown like Notion: table, board, calendar, gallery and list views over the same rows, with typed
// properties, filters, sorting and grouping. Every row is also a page (opened with ctx.openRow).
//   const db = mountDatabase(host, { id, openRow(rowId), compact })   ->   { destroy() }
import { h, esc, mobile, confirmBox } from "/js/lib.mjs";
import { ICONS } from "/shared/icons.mjs";
import { I as BI } from "/js/board-canvas.mjs";
import { coverCss } from "/js/board-covers.mjs";
import { WS, DB, TYPES, OPT_COLORS, ICO, fmtNum, fmtDate, dateOf, today, ymd, parseDay, rid, opsFor, rowsFor, valueOf, textOf } from "/js/ws-core.mjs";

if (!document.querySelector('link[href="/css/workspace.css"]')) document.head.append(h("link", { rel: "stylesheet", href: "/css/workspace.css" }));
export const WI = (n, s = 16) => (ICO[n] ? `<svg class="ic" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[n]}</svg>` : BI(n, s));
const VIEWS = { table: ["Table", "db"], board: ["Board", "board"], calendar: ["Calendar", "calendar"], gallery: ["Gallery", "gallery"], list: ["List", "list"], todo: ["To-do", "checkbox"] };
const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const optOf = (p, id) => (p.opts || []).find((o) => o.id === id);
const chip = (o) => (o ? `<span class="wd-opt" data-c="${o.color || "grey"}">${esc(o.name)}</span>` : "");

/* ---------- a small floating panel anchored to something ---------- */
let curPop = null;
export function closePop() { if (curPop) { const p = curPop; curPop = null; p.__close && p.__close(); p.classList.add("out"); setTimeout(() => p.remove(), 110); } }
export function popover(anchor, content, { w, cls = "", onClose, at } = {}) {
  closePop();
  const p = h("div", { class: "wd-pop " + cls, role: "dialog" }, content);
  if (w) p.style.width = w + "px";
  document.body.append(p); curPop = p; p.__close = onClose;
  const r = at || anchor.getBoundingClientRect(), vw = innerWidth, vh = (visualViewport ? visualViewport.height : innerHeight);
  const pw = p.offsetWidth, ph = p.offsetHeight;
  let x = Math.min(Math.max(8, r.left), vw - pw - 8), y = r.bottom + 6;
  if (y + ph > vh - 8) y = r.top - ph - 6 >= 8 ? r.top - ph - 6 : Math.max(8, vh - ph - 8);
  p.style.left = x + "px"; p.style.top = y + "px";
  const out = (e) => { if (!p.contains(e.target) && !e.target.closest(".wd-pop")) { document.removeEventListener("pointerdown", out, true); if (curPop === p) closePop(); } };
  setTimeout(() => document.addEventListener("pointerdown", out, true), 0);
  p.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closePop(); } });
  return p;
}
// a simple list of choices in a popover
export function choose(anchor, items, opts = {}) {
  const box = h("div", { class: "wd-menu" });
  for (const it of items) {
    if (it === "-") { box.append(h("hr")); continue; }
    if (it.head) { box.append(h("div", { class: "wd-mh" }, it.head)); continue; }
    const b = h("button", { type: "button", class: "wd-mi" + (it.danger ? " danger" : "") + (it.on ? " on" : ""), html: `<span class="ic">${it.i ? WI(it.i, 17) : ""}</span><span class="t">${esc(it.t)}</span>${it.on ? `<span class="ck">${WI("check", 15)}</span>` : ""}${it.k ? `<kbd>${esc(it.k)}</kbd>` : ""}` });
    b.onclick = () => { if (!it.keep) closePop(); it.run && it.run(b); };
    box.append(b);
  }
  return popover(anchor, box, { w: opts.w || 230, at: opts.at });
}

/* =====================================================================================================================
   The database
   ===================================================================================================================== */
export function mountDatabase(host, ctx) {
  const id = ctx.id;
  const S = { view: ls.get("wdView:" + id, ""), q: "", month: null, busy: false, editing: false, redraw: false, collapsed: new Set() };
  host.classList.add("wd-host");
  host.innerHTML = `<div class="wd${ctx.compact ? " compact" : ""}"><div class="wd-load"><span class="rb-spin"></span></div></div>`;
  const root = host.firstElementChild;
  let doc = null;
  const meta = () => WS.db(id) || { title: "Untitled database" };
  const view = () => doc.views.find((v) => v.id === S.view) || doc.views[0];
  const setView = (v) => DB.ops(id, [{ op: "view", view: v }]);
  const prop = (pid) => doc.props.find((p) => p.id === pid);
  const ops = (o) => DB.ops(id, o);
  const VE = valueEditors(id, { busy: (on) => { S.editing = on; if (!on && S.redraw) { S.redraw = false; draw(); } } });
  const { setVal, editCell, cellHtml, optMenu, isDone } = VE;

  const off = DB.on(id, () => { doc = DB.get(id); if (S.editing) { S.redraw = true; return; } draw(); });
  const offList = WS.on(() => { if (doc && !S.editing) drawHead(); });
  DB.open(id).then((d) => { if (!d) { root.innerHTML = `<p class="wd-empty">This database could not be opened. Check your connection and try again.</p>`; return; } doc = d; setup(); draw(); });
  const syncT = setInterval(() => { if (document.visibilityState === "visible" && host.isConnected) DB.sync(id); }, 20000);

  /* ----- header and toolbar ----- */
  function drawHead() {
    const m = meta(), hd = root.querySelector(".wd-head"); if (!hd) return;
    hd.querySelector(".wd-ico").innerHTML = WI(m.icon && ICONS[m.icon] ? m.icon : "db", ctx.compact ? 22 : 30);
    const t = hd.querySelector(".wd-title"); if (document.activeElement !== t) t.value = m.title || "";
  }
  // an app can ask for a kind of view to be there, first and open by default (Tasks does, for its To-do list). Only ever adds one view.
  function setup() {
    const want = ctx.view; if (!want) return;
    let t = doc.views.find((x) => x.type === want.type);
    if (!t) { t = { id: rid(), name: want.name, type: want.type }; ops([{ op: "view", view: t }, { op: "vorder", ids: [t.id, ...doc.views.filter((x) => x.id !== t.id).map((x) => x.id)] }]); doc = DB.get(id) || doc; }
    S.view = t.id;
  }
  function draw() {
    if (!doc) return;
    S.tdFocus = !!root.querySelector(".td-add input:focus");
    if (!doc.views.find((v) => v.id === S.view)) S.view = doc.views[0].id;
    const v = view(), m = meta(); root.dataset.vt = v.type;
    const sc = root.querySelector(".wd-body")?.scrollLeft || 0, st = root.querySelector(".wd-body")?.scrollTop || 0;
    root.innerHTML = `
      <header class="wd-head">${m.cover && !ctx.compact ? `<div class="wd-cover" style="background:${m.cover.k ? coverCss(m.cover) : `url('${esc(m.cover.src)}') center/cover`}"></div>` : ""}
        <div class="wd-tl"><button class="wd-ico" data-a="icon" title="Change icon" aria-label="Change icon"></button><input class="wd-title" maxlength="120" placeholder="Untitled database" aria-label="Database name"></div>
        ${m.desc ? `<p class="wd-desc">${esc(m.desc)}</p>` : ""}</header>
      <div class="wd-bar">
        <div class="wd-tabs" role="tablist">${doc.views.map((x) => `<button role="tab" data-view="${x.id}" aria-selected="${x.id === v.id}">${WI(VIEWS[x.type][1], 16)}<span>${esc(x.name)}</span></button>`).join("")}<button class="wd-addv" data-a="addview" title="Add a view" aria-label="Add a view">${WI("plus", 16)}</button></div>
        <span class="wd-sp"></span>
        <label class="wd-search" title="Search">${WI("search", 16)}<input type="search" placeholder="Search" aria-label="Search this database" value="${esc(S.q)}"></label>
        <button class="wd-tb${(v.filter || []).length ? " on" : ""}" data-a="filter" title="Filter">${WI("filter", 16)}<span>Filter</span></button>
        <button class="wd-tb${(v.sort || []).length ? " on" : ""}" data-a="sort" title="Sort">${WI("sort", 16)}<span>Sort</span></button>
        <button class="wd-tb" data-a="props" title="Properties">${WI("props", 16)}<span>Properties</span></button>
        <button class="wd-tb icon" data-a="vmore" title="View options" aria-label="View options">${WI("more", 16)}</button>
        <button class="wd-new" data-a="new">${WI("plus", 16)}<span>New</span></button>
      </div>
      ${(v.filter || []).length || (v.sort || []).length ? `<div class="wd-chips">${(v.sort || []).map((s, i) => `<button class="wd-fc" data-sort="${i}">${WI("sort", 13)}${esc(s.p === "title" ? "Name" : s.p === "created" ? "Created" : s.p === "updated" ? "Edited" : prop(s.p)?.name || "")}${s.d === "desc" ? " ↓" : " ↑"}</button>`).join("")}${(v.filter || []).map((f, i) => `<button class="wd-fc" data-filter="${i}">${WI("filter", 13)}${esc(filterLabel(f))}</button>`).join("")}<button class="wd-fc add" data-a="filter">${WI("plus", 13)}Add filter</button></div>` : ""}
      <div class="wd-body" data-type="${v.type}"></div>`;
    drawHead();
    const body = root.querySelector(".wd-body");
    const rows = rowsFor(doc, v, S.q);
    if (v.type === "table") body.append(table(v, rows));
    else if (v.type === "board") body.append(board(v, rows));
    else if (v.type === "calendar") body.append(calendar(v, rows));
    else if (v.type === "gallery") body.append(gallery(v, rows));
    else if (v.type === "todo") body.append(todo(v, rows));
    else body.append(list(v, rows));
    body.scrollLeft = sc; body.scrollTop = st;
    wireBar();
  }
  function filterLabel(f) {
    const p = f.p === "title" ? { name: "Name", type: "text" } : prop(f.p); if (!p) return "";
    const op = (opsFor(p.type).find((o) => o[0] === f.op) || ["", ""])[1];
    let val = f.val || "";
    if (["select", "status", "multi"].includes(p.type)) val = optOf(p, f.val)?.name || "";
    if (p.type === "date" && val) val = fmtDate(val);
    return `${p.name} ${op}${val && !["empty", "full", "today", "week", "past", "on", "off"].includes(f.op) ? " " + val : ""}`;
  }
  function wireBar() {
    const t = root.querySelector(".wd-title");
    t.oninput = () => { clearTimeout(t.__t); t.__t = setTimeout(() => WS.setDb(id, { title: t.value }), 500); };
    t.onkeydown = (e) => { if (e.key === "Enter") t.blur(); };
    root.querySelector('[data-a="icon"]').onclick = (e) => iconPick(e.currentTarget, meta().icon, (ic) => WS.setDb(id, { icon: ic }));
    root.querySelectorAll("[data-view]").forEach((b) => {
      b.onclick = () => { if (S.view === b.dataset.view) return viewMenu(b); S.view = b.dataset.view; ls.set("wdView:" + id, S.view); draw(); };
      b.oncontextmenu = (e) => { e.preventDefault(); S.view = b.dataset.view; draw(); viewMenu(root.querySelector(`[data-view="${b.dataset.view}"]`)); };
    });
    const q = root.querySelector(".wd-search input");
    q.oninput = () => { S.q = q.value; const pos = q.selectionStart; draw(); const n = root.querySelector(".wd-search input"); n.focus(); try { n.setSelectionRange(pos, pos); } catch {} };
    root.querySelectorAll('[data-a="filter"]').forEach((b) => (b.onclick = () => filterAdd(b)));
    root.querySelector('[data-a="sort"]').onclick = (e) => sortMenu(e.currentTarget);
    root.querySelector('[data-a="props"]').onclick = (e) => propsMenu(e.currentTarget);
    root.querySelector('[data-a="vmore"]').onclick = (e) => viewMenu(e.currentTarget);
    root.querySelector('[data-a="addview"]').onclick = (e) => choose(e.currentTarget, [{ head: "Add a view" }, ...Object.entries(VIEWS).map(([k, [n, ic]]) => ({ t: n, i: ic, run: () => addView(k) }))]);
    root.querySelector('[data-a="new"]').onclick = () => newRow();
    root.querySelectorAll("[data-filter]").forEach((b) => (b.onclick = () => filterEdit(b, +b.dataset.filter)));
    root.querySelectorAll("[data-sort]").forEach((b) => (b.onclick = () => sortMenu(b)));
  }

  /* ----- views ----- */
  function addView(type) {
    const v = { id: rid(), name: VIEWS[type][0], type };
    const sel = doc.props.find((p) => p.type === "status") || doc.props.find((p) => p.type === "select"), dt = doc.props.find((p) => p.type === "date");
    if (type === "board") { if (!sel) { const p = { id: rid(), name: "Status", type: "status", opts: [{ id: rid(), name: "To do", color: "grey", group: "todo" }, { id: rid(), name: "Doing", color: "blue", group: "doing" }, { id: rid(), name: "Done", color: "green", group: "done" }] }; ops([{ op: "prop", prop: p }]); v.group = p.id; } else v.group = sel.id; }
    if (type === "calendar") { if (!dt) { const p = { id: rid(), name: "Date", type: "date" }; ops([{ op: "prop", prop: p }]); v.date = p.id; } else v.date = dt.id; }
    S.view = v.id; ls.set("wdView:" + id, v.id); setView(v);
  }
  function viewMenu(anchor) {
    const v = view();
    const items = [{ head: "Layout" }, ...Object.entries(VIEWS).map(([k, [n, ic]]) => ({ t: n, i: ic, on: v.type === k, run: () => { const nv = { ...v, type: k }; if (k === "board" && !nv.group) { const s = doc.props.find((p) => ["status", "select"].includes(p.type)); if (!s) return addView("board"); nv.group = s.id; } if (k === "calendar" && !nv.date) { const d = doc.props.find((p) => p.type === "date"); if (!d) return addView("calendar"); nv.date = d.id; } setView(nv); } }))];
    if (v.type === "board") items.push("-", { head: "Group by" }, ...doc.props.filter((p) => ["status", "select"].includes(p.type)).map((p) => ({ t: p.name, i: TYPES[p.type].ico, on: v.group === p.id, run: () => setView({ ...v, group: p.id }) })));
    if (v.type === "calendar") items.push("-", { head: "Show by" }, ...doc.props.filter((p) => ["date", "created", "edited"].includes(p.type)).map((p) => ({ t: p.name, i: "calendar", on: v.date === p.id, run: () => setView({ ...v, date: p.id }) })));
    if (v.type === "gallery") items.push("-", { head: "Card size" }, ...[["s", "Small"], ["m", "Medium"], ["l", "Large"]].map(([k, t]) => ({ t, on: (v.size || "m") === k, run: () => setView({ ...v, size: k }) })));
    if (v.type === "table") items.push("-", { head: "Group by" }, { t: "None", on: !v.group, run: () => setView({ ...v, group: undefined }) }, ...doc.props.filter((p) => ["status", "select"].includes(p.type)).map((p) => ({ t: p.name, i: TYPES[p.type].ico, on: v.group === p.id, run: () => setView({ ...v, group: p.id }) })));
    if (v.type === "table") items.push("-", { t: v.wrap ? "Don't wrap text" : "Wrap text in cells", i: "text", run: () => setView({ ...v, wrap: !v.wrap }) });
    items.push("-", { t: "Rename view", i: "pencil", run: () => askText(anchor, "View name", v.name, (n) => n && setView({ ...v, name: n })) },
      { t: "Duplicate view", i: "dup", run: () => { const nv = { ...JSON.parse(JSON.stringify(v)), id: rid(), name: v.name + " copy" }; S.view = nv.id; setView(nv); } });
    if (doc.views.length > 1) items.push({ t: "Delete view", i: "trash", danger: true, run: () => { ops([{ op: "delview", id: v.id }]); S.view = ""; } });
    choose(anchor, items, { w: 240 });
  }
  // which properties a view shows: tables show all but hidden ones; cards show the ones picked
  const shown = (v) => {
    if (v.type === "table") return doc.props.filter((p) => !p.hide);
    const picked = v.show ? v.show.map(prop).filter(Boolean) : doc.props.filter((p) => !["created", "edited"].includes(p.type) && !p.hide).slice(0, 3);
    return picked.filter((p) => p.id !== v.group && p.id !== v.date);
  };
  function propsMenu(anchor) {
    const isTable = view().type === "table", on = (p) => (isTable ? !prop(p.id)?.hide : shown(view()).some((x) => x.id === p.id));
    const box = h("div", { class: "wd-menu wd-props" });
    const draw2 = () => {
      box.innerHTML = `<div class="wd-mh">${isTable ? "Columns" : "Shown on cards"}</div>`;
      for (const p of doc.props) {
        if (!isTable && (p.id === view().group || p.id === view().date)) continue;
        const b = h("div", { class: "wd-pr" + (on(p) ? " on" : ""), html: `<span class="ic">${WI(TYPES[p.type].ico, 16)}</span><span class="t">${esc(p.name)}</span><button class="wd-sw" aria-label="${on(p) ? "Hide" : "Show"} ${esc(p.name)}" role="switch" aria-checked="${on(p)}"><i></i></button>` });
        b.querySelector(".wd-sw").onclick = () => {
          if (isTable) ops([{ op: "prop", prop: { ...p, hide: !p.hide || undefined } }]);
          else { const cur = (view().show ? view().show : shown(view()).map((x) => x.id)).filter((x) => x !== "__none"); const i = cur.indexOf(p.id); if (i >= 0) cur.splice(i, 1); else cur.push(p.id); setView({ ...view(), show: cur.length ? cur : ["__none"] }); }
          setTimeout(draw2, 0);
        };
        b.querySelector(".t").onclick = () => { closePop(); setTimeout(() => propMenu(anchor, p), 0); };
        box.append(b);
      }
      const add = h("button", { type: "button", class: "wd-mi", html: `<span class="ic">${WI("plus", 17)}</span><span class="t">New property</span>` });
      add.onclick = () => { closePop(); setTimeout(() => newProp(anchor), 0); };
      box.append(h("hr"), add);
    };
    draw2(); popover(anchor, box, { w: 270 });
  }

  /* ----- properties ----- */
  function newProp(anchor, after) {
    choose(anchor, [{ head: "Property type" }, ...Object.entries(TYPES).map(([k, t]) => ({ t: t.name, i: t.ico, run: () => {
      const p = { id: rid(), name: t.name === "Created time" ? "Created" : t.name === "Edited time" ? "Edited" : t.name, type: k };
      if (["select", "multi"].includes(k)) p.opts = [];
      if (k === "status") p.opts = [{ id: rid(), name: "To do", color: "grey", group: "todo" }, { id: rid(), name: "Doing", color: "blue", group: "doing" }, { id: rid(), name: "Done", color: "green", group: "done" }];
      if (k === "relation") { const other = WS.dbs.find((d) => d.id !== id && !d.trashed); p.db = other ? other.id : id; }
      const o = [{ op: "prop", prop: p }];
      if (after) { const ids = doc.props.map((x) => x.id); ids.splice(ids.indexOf(after) + 1, 0, p.id); o.push({ op: "porder", ids }); }
      ops(o); setTimeout(() => { const th = root.querySelector(`[data-th="${p.id}"]`); propMenu(th || anchor, prop(p.id), true); }, 60);
    } }))], { w: 230 });
  }
  function propMenu(anchor, p, rename) {
    if (!p) return;
    const box = h("div", { class: "wd-menu wd-pm" });
    const name = h("input", { class: "wd-in", value: p.name, "aria-label": "Property name", maxlength: "60" });
    name.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); closePop(); } };
    box.append(h("div", { class: "wd-pmh", html: `<span class="ic">${WI(TYPES[p.type].ico, 17)}</span>` }, name));
    const items = [];
    const typeBtn = h("button", { type: "button", class: "wd-mi", html: `<span class="ic">${WI("swap", 17)}</span><span class="t">Type</span><span class="v">${TYPES[p.type].name}</span>` });
    typeBtn.onclick = () => { const nm = name.value; closePop(); setTimeout(() => choose(anchor, Object.entries(TYPES).map(([k, t]) => ({ t: t.name, i: t.ico, on: k === p.type, run: () => {
      const np = { ...p, name: nm || p.name, type: k }; if (["select", "multi", "status"].includes(k) && !np.opts) {
        // text that becomes a select: every different value becomes an option
        const vals = [...new Set(Object.values(doc.rows).map((r) => String(r.v[p.id] ?? "").trim()).filter(Boolean))].slice(0, 60);
        np.opts = vals.map((n, i) => ({ id: rid(), name: n.slice(0, 60), color: OPT_COLORS[i % OPT_COLORS.length] }));
        if (k === "status" && !np.opts.length) np.opts = [{ id: rid(), name: "To do", color: "grey", group: "todo" }, { id: rid(), name: "Doing", color: "blue", group: "doing" }, { id: rid(), name: "Done", color: "green", group: "done" }];
        const conv = Object.values(doc.rows).filter((r) => r.v[p.id] != null).map((r) => ({ op: "row", row: { id: r.id, v: { [p.id]: (() => { const o = np.opts.find((x) => x.name === String(r.v[p.id]).trim().slice(0, 60)); return o ? (k === "multi" ? [o.id] : o.id) : null; })() } } }));
        ops([{ op: "prop", prop: np }, ...conv]); return;
      }
      ops([{ op: "prop", prop: np }]);
    } }))), 0); };
    box.append(typeBtn);
    if (["select", "multi", "status"].includes(p.type)) {
      box.append(h("div", { class: "wd-mh" }, "Options"));
      const ol = h("div", { class: "wd-optl" });
      const drawOpts = () => { ol.innerHTML = ""; for (const o of (prop(p.id) || p).opts || []) { const b = h("button", { type: "button", class: "wd-optr", html: `${chip(o)}<span class="ic">${WI("more", 15)}</span>` }); b.onclick = () => optMenu(b, prop(p.id), o, drawOpts); ol.append(b); } };
      drawOpts(); box.append(ol);
      const add = h("input", { class: "wd-in sm", placeholder: "Add an option…", maxlength: "60" });
      add.onkeydown = (e) => { if (e.key === "Enter" && add.value.trim()) { e.preventDefault(); const cur = prop(p.id); ops([{ op: "prop", prop: { ...cur, opts: [...(cur.opts || []), { id: rid(), name: add.value.trim(), color: OPT_COLORS[(cur.opts || []).length % OPT_COLORS.length], ...(cur.type === "status" ? { group: "todo" } : {}) }] } }]); add.value = ""; drawOpts(); } };
      box.append(add);
    }
    if (p.type === "number") box.append(...["plain", "comma", "percent", "inr", "usd", "eur", "gbp"].map((f) => { const b = h("button", { type: "button", class: "wd-mi" + ((p.fmt || "plain") === f ? " on" : ""), html: `<span class="ic"></span><span class="t">${{ plain: "Number", comma: "Number with commas", percent: "Percent", inr: "Rupee", usd: "Dollar", eur: "Euro", gbp: "Pound" }[f]}</span>` }); b.onclick = () => { ops([{ op: "prop", prop: { ...prop(p.id), fmt: f } }]); closePop(); }; return b; }));
    if (p.type === "date") { const b = h("button", { type: "button", class: "wd-mi", html: `<span class="ic">${WI("clock", 17)}</span><span class="t">${p.time ? "Dates only" : "Include a time"}</span>` }); b.onclick = () => { ops([{ op: "prop", prop: { ...prop(p.id), time: !p.time } }]); closePop(); }; box.append(b); }
    if (p.type === "relation") { box.append(h("div", { class: "wd-mh" }, "Links to")); for (const d of WS.dbs.filter((x) => !x.trashed)) { const b = h("button", { type: "button", class: "wd-mi" + (p.db === d.id ? " on" : ""), html: `<span class="ic">${WI(d.icon || "db", 16)}</span><span class="t">${esc(d.title || "Untitled")}</span>` }); b.onclick = () => { ops([{ op: "prop", prop: { ...prop(p.id), db: d.id } }]); closePop(); }; box.append(b); } }
    const v = view();
    box.append(h("hr"));
    const act = (t, ic, fn, danger) => { const b = h("button", { type: "button", class: "wd-mi" + (danger ? " danger" : ""), html: `<span class="ic">${WI(ic, 17)}</span><span class="t">${t}</span>` }); b.onclick = () => { closePop(); fn(); }; box.append(b); };
    act("Sort ascending", "arrow-up", () => setView({ ...view(), sort: [{ p: p.id, d: "asc" }] }));
    act("Sort descending", "arrow-down", () => setView({ ...view(), sort: [{ p: p.id, d: "desc" }] }));
    act("Filter", "filter", () => filterEdit(anchor, -1, p.id));
    if (v.type === "table") act("Insert property to the right", "plus", () => newProp(anchor, p.id));
    act("Hide", "eye-off", () => ops([{ op: "prop", prop: { ...prop(p.id), hide: true } }]));
    act("Duplicate", "dup", () => { const np = { ...JSON.parse(JSON.stringify(p)), id: rid(), name: p.name + " copy" }; const ids = doc.props.map((x) => x.id); ids.splice(ids.indexOf(p.id) + 1, 0, np.id); ops([{ op: "prop", prop: np }, { op: "porder", ids }, ...Object.values(doc.rows).filter((r) => r.v[p.id] != null).map((r) => ({ op: "row", row: { id: r.id, v: { [np.id]: r.v[p.id] } } }))]); });
    act("Delete property", "trash", async () => { if (await confirmBox(`Delete “${p.name}”? Its values go with it (an earlier copy of the database is kept).`, "Delete")) ops([{ op: "delprop", id: p.id }]); }, true);
    popover(anchor, box, { w: 260, onClose: () => { const n = name.value.trim(); const cur = prop(p.id); if (cur && n && n !== cur.name) ops([{ op: "prop", prop: { ...cur, name: n } }]); } });
    if (rename) setTimeout(() => { name.focus(); name.select(); }, 20);
  }
  /* ----- filters and sorts ----- */
  function filterAdd(anchor) {
    choose(anchor, [{ head: "Filter by" }, { t: "Name", i: "text", run: () => filterEdit(anchor, -1, "title") }, ...doc.props.map((p) => ({ t: p.name, i: TYPES[p.type].ico, run: () => filterEdit(anchor, -1, p.id) }))], { w: 230 });
  }
  function filterEdit(anchor, i, pid) {
    const v = view(), list = (v.filter || []).slice();
    const f = i >= 0 ? { ...list[i] } : { p: pid, op: "", val: "" };
    const p = f.p === "title" ? { id: "title", name: "Name", type: "text" } : prop(f.p); if (!p) return;
    const opl = opsFor(p.type); if (!f.op) f.op = opl[0][0];
    const box = h("div", { class: "wd-menu wd-fe" });
    const save = () => { const nl = (view().filter || []).slice(); if (i >= 0) nl[i] = f; else { nl.push(f); i = nl.length - 1; } setView({ ...view(), filter: nl }); };
    const drawF = () => {
      box.innerHTML = "";
      const top = h("div", { class: "wd-feh", html: `<b>${esc(p.name)}</b>` });
      const sel = h("select", { class: "wd-in sm", "aria-label": "Condition" }, ...opl.map(([k, t]) => h("option", { value: k, selected: f.op === k }, t)));
      sel.onchange = () => { f.op = sel.value; save(); drawF(); };
      top.append(sel); box.append(top);
      const needs = !["empty", "full", "today", "week", "past", "on", "off"].includes(f.op);
      if (needs) {
        if (["select", "status", "multi"].includes(p.type)) { for (const o of p.opts || []) { const b = h("button", { type: "button", class: "wd-mi" + (f.val === o.id ? " on" : ""), html: `${chip(o)}` }); b.onclick = () => { f.val = o.id; save(); drawF(); }; box.append(b); } }
        else if (["date", "created", "edited"].includes(p.type)) { const d = h("input", { type: "date", class: "wd-in", value: f.val || "" }); d.onchange = () => { f.val = d.value; save(); }; box.append(d); }
        else { const t = h("input", { class: "wd-in", value: f.val || "", placeholder: "Type a value…", type: p.type === "number" ? "number" : "text" }); t.oninput = () => { f.val = t.value; clearTimeout(t.__t); t.__t = setTimeout(save, 300); }; box.append(t); setTimeout(() => t.focus(), 20); }
      }
      const del = h("button", { type: "button", class: "wd-mi danger", html: `<span class="ic">${WI("trash", 16)}</span><span class="t">Remove filter</span>` });
      del.onclick = () => { if (i >= 0) { const nl = (view().filter || []).slice(); nl.splice(i, 1); setView({ ...view(), filter: nl }); } closePop(); };
      box.append(h("hr"), del);
    };
    drawF(); if (i < 0 && !["empty", "full"].includes(f.op) && (["checkbox"].includes(p.type) || f.op === "today")) save();
    popover(anchor, box, { w: 270 });
  }
  function sortMenu(anchor) {
    const v = view(), cur = v.sort || [];
    const fields = [["title", "Name"], ...doc.props.filter((p) => p.type !== "relation").map((p) => [p.id, p.name]), ["created", "Created"], ["updated", "Last edited"]];
    const items = [{ head: "Sort by" }];
    for (const [k, t] of fields) { const s = cur.find((x) => x.p === k); items.push({ t: t + (s ? (s.d === "desc" ? "  ↓" : "  ↑") : ""), on: !!s, run: () => { let ns; if (!s) ns = [{ p: k, d: "asc" }]; else if (s.d === "asc") ns = [{ p: k, d: "desc" }]; else ns = []; setView({ ...view(), sort: ns }); } }); }
    if (cur.length) items.push("-", { t: "Remove sorting", i: "x", run: () => setView({ ...view(), sort: [] }) });
    choose(anchor, items, { w: 240 });
  }

  /* ----- making and changing rows ----- */
  const setTitle = (row, t) => ops([{ op: "row", row: { id: row.id, title: t } }]);
  // a new row takes the values the view is filtered or grouped to, so it stays in sight
  function seed(v, extra = {}) {
    const vals = {};
    for (const f of v.filter || []) { const p = prop(f.p); if (!p) continue; if (["select", "status"].includes(p.type) && f.op === "is" && f.val) vals[p.id] = f.val; if (p.type === "multi" && f.op === "has" && f.val) vals[p.id] = [f.val]; if (p.type === "checkbox" && f.op === "on") vals[p.id] = true; if (p.type === "date" && f.op === "today") vals[p.id] = today(); }
    // a status starts at its first "not started" option, as in Notion
    for (const p of doc.props) if (p.type === "status" && vals[p.id] === undefined && extra[p.id] === undefined) { const o = (p.opts || []).find((x) => (x.group || "todo") === "todo"); if (o) vals[p.id] = o.id; }
    return { ...vals, ...extra };
  }
  function newRow(extra = {}, { open = null } = {}) {
    const v = view(), rows = rowsFor(doc, v, "");
    const order = (rows.length ? Math.max(...rows.map((r) => r.order ?? r.created ?? 0)) : 0) + 1;
    const r = DB.newRow(id, { v: seed(v, extra.v || {}), order, ...(extra.title ? { title: extra.title } : {}) });
    const go = open ?? !["table", "board", "todo"].includes(v.type);
    if (go) ctx.openRow && ctx.openRow(r.id);
    else setTimeout(() => { const el = root.querySelector(`[data-row="${r.id}"] [data-title]`); if (el) editTitle(r, el, true); }, 40);
    return r;
  }
  function rowMenu(anchor, row, at) {
    choose(anchor, [
      { t: "Open as page", i: "open", run: () => ctx.openRow && ctx.openRow(row.id) },
      { t: "Duplicate", i: "dup", run: () => DB.newRow(id, { title: (row.title || "") + " (copy)", v: JSON.parse(JSON.stringify(row.v || {})), icon: row.icon, order: (row.order ?? 0) + 0.5 }) },
      { t: "Copy link", i: "link", run: () => { try { navigator.clipboard.writeText(location.origin + "/boards/db/" + id + "/" + row.id); } catch {} } },
      "-", { t: "Delete", i: "trash", danger: true, run: () => ops([{ op: "delrow", id: row.id }]) },
    ], { w: 220, at });
  }
  function editTitle(row, el, isNew) {
    const r = el.getBoundingClientRect();
    const inp = h("input", { class: "wd-cellin", value: row.title || "", placeholder: "Untitled", "aria-label": "Name" });
    Object.assign(inp.style, { left: r.left + "px", top: r.top + "px", width: Math.max(160, r.width) + "px", height: r.height + "px" });
    document.body.append(inp); S.editing = true; inp.focus(); inp.select();
    let done = false;
    const finish = (keep, next) => {
      if (done) return; done = true; S.editing = false; const val = inp.value.trim(); inp.remove();
      // a row just made and left without a name (Esc, or clicking away) is taken back
      if (isNew && !val) { const cur = doc.rows[row.id]; if (cur && !cur.title && Object.keys(cur.v || {}).every((k) => JSON.stringify(cur.v[k]) === JSON.stringify(seed(view())[k]))) { ops([{ op: "delrow", id: row.id }]); return; } }
      if (keep && val !== (row.title || "")) setTitle(row, val); else if (S.redraw) { S.redraw = false; draw(); }
      if (next) setTimeout(() => newRow(), 30);
    };
    inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); finish(true, view().type === "table" && !e.shiftKey && !!inp.value.trim()); } if (e.key === "Escape") finish(false); };
    inp.onblur = () => finish(true);
  }
  const titleHtml = (row) => `<span class="wd-rt">${row.icon && ICONS[row.icon] ? `<span class="wd-ri">${WI(row.icon, 15)}</span>` : ""}<span class="wd-rn${row.title ? "" : " un"}" data-title>${esc(row.title || "Untitled")}</span></span>`;


  /* ----- table ----- */
  function table(v, rows) {
    const cols = shown(v);
    const wrap = h("div", { class: "wd-tw" + (v.wrap ? " wrap" : "") });
    const groups = groupRows(v, rows);
    wrap.innerHTML = `<table class="wd-t"><thead><tr><th class="c-title" data-th="title" style="width:${(v.tw || 280)}px">${WI("text", 15)}<span>Name</span></th>${cols.map((p) => `<th data-th="${p.id}" style="width:${p.w || (p.type === "text" ? 240 : 170)}px">${WI(TYPES[p.type].ico, 15)}<span>${esc(p.name)}</span></th>`).join("")}<th class="c-add"><button data-a="addprop" title="Add a property" aria-label="Add a property">${WI("plus", 15)}</button></th></tr></thead>
      ${groups.map((g) => `<tbody>${g.name != null ? `<tr class="wd-gr"><td colspan="${cols.length + 2}"><button class="wd-gt" data-g="${esc(g.key)}">${WI(S.collapsed.has(g.key) ? "chevron-right" : "chevron-down", 15)}${g.chip || esc(g.name)}<em>${g.rows.length}</em></button></td></tr>` : ""}${S.collapsed.has(g.key) ? "" : g.rows.map((r) => `<tr data-row="${r.id}"><td class="c-title"><div class="wd-tc">${titleHtml(r)}<button class="wd-open" data-open="${r.id}" title="Open as page">${WI("open", 13)}<span>Open</span></button></div></td>${cols.map((p) => `<td data-cell="${p.id}" class="t-${p.type}">${cellHtml(r, p)}</td>`).join("")}<td></td></tr>`).join("")}
      <tr class="wd-addr"><td colspan="${cols.length + 2}"><button data-new="${esc(g.key)}">${WI("plus", 15)}New</button></td></tr></tbody>`).join("")}
      <tfoot><tr><td class="c-title"><span class="wd-count">${rows.length} ${rows.length === 1 ? "row" : "rows"}</span></td>${cols.map((p) => `<td>${p.type === "number" ? `<span class="wd-sum">${esc(fmtNum(rows.reduce((a, r) => a + (+r.v[p.id] || 0), 0), p.fmt))}</span>` : p.type === "checkbox" ? `<span class="wd-sum">${rows.filter((r) => r.v[p.id]).length} of ${rows.length}</span>` : ""}</td>`).join("")}<td></td></tr></tfoot></table>`;
    wrap.addEventListener("click", (e) => {
      const t = e.target;
      if (t.closest("a")) return;
      const add = t.closest('[data-a="addprop"]'); if (add) return newProp(add);
      const th = t.closest("[data-th]"); if (th && !t.closest(".wd-rs")) { if (th.dataset.th === "title") return choose(th, [{ t: "Sort A → Z", i: "arrow-up", run: () => setView({ ...view(), sort: [{ p: "title", d: "asc" }] }) }, { t: "Sort Z → A", i: "arrow-down", run: () => setView({ ...view(), sort: [{ p: "title", d: "desc" }] }) }, { t: "Filter", i: "filter", run: () => filterEdit(th, -1, "title") }]); return propMenu(th, prop(th.dataset.th)); }
      const gt = t.closest("[data-g]"); if (gt) { const k = gt.dataset.g; S.collapsed.has(k) ? S.collapsed.delete(k) : S.collapsed.add(k); draw(); return; }
      const nw = t.closest("[data-new]"); if (nw) { const g = groupVal(v, nw.dataset.new); return newRow(g ? { v: g } : {}, { open: false }); }
      const op = t.closest("[data-open]"); if (op) return ctx.openRow && ctx.openRow(op.dataset.open);
      const tr = t.closest("[data-row]"); if (!tr) return; const row = doc.rows[tr.dataset.row]; if (!row) return;
      const td = t.closest("[data-cell]"); if (td) return editCell(row, prop(td.dataset.cell), td);
      if (t.closest(".c-title")) return editTitle(row, tr.querySelector("[data-title]"));
    });
    wrap.addEventListener("contextmenu", (e) => { const tr = e.target.closest("[data-row]"); if (!tr) return; e.preventDefault(); rowMenu(tr, doc.rows[tr.dataset.row], { left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY }); });
    resizer(wrap, v); dragRows(wrap, v, rows);
    return wrap;
  }
  // drag the edge of a column header to make it wider or narrower
  function resizer(wrap, v) {
    wrap.querySelectorAll("th[data-th]").forEach((th) => {
      const g = h("span", { class: "wd-rs", "aria-hidden": "true" }); th.append(g);
      g.onpointerdown = (e) => { e.preventDefault(); e.stopPropagation(); const x0 = e.clientX, w0 = th.offsetWidth; g.setPointerCapture(e.pointerId);
        g.onpointermove = (m) => { th.style.width = Math.max(100, w0 + m.clientX - x0) + "px"; };
        g.onpointerup = () => { g.onpointermove = g.onpointerup = null; const w = th.offsetWidth; if (th.dataset.th === "title") setView({ ...view(), tw: w }); else { const p = prop(th.dataset.th); if (p) ops([{ op: "prop", prop: { ...p, w } }]); } };
      };
    });
  }
  function dragRows(wrap, v, rows) {
    if (mobile() || (v.sort || []).length) return; // a sorted view keeps its own order
    wrap.querySelectorAll("tr[data-row]").forEach((tr) => {
      const grip = h("span", { class: "wd-grip", title: "Drag to move", html: WI("grip", 14) }); tr.firstElementChild.prepend(grip);
      grip.onpointerdown = (e) => {
        e.preventDefault(); grip.setPointerCapture(e.pointerId); tr.classList.add("drag"); let target = null, before = true;
        grip.onpointermove = (m) => { wrap.querySelectorAll(".drop-b,.drop-a").forEach((x) => x.classList.remove("drop-b", "drop-a")); const el = document.elementFromPoint(m.clientX, m.clientY)?.closest("tr[data-row]"); if (!el || el === tr) { target = null; return; } const r = el.getBoundingClientRect(); before = m.clientY < r.top + r.height / 2; el.classList.add(before ? "drop-b" : "drop-a"); target = el; };
        grip.onpointerup = () => { grip.onpointermove = grip.onpointerup = null; tr.classList.remove("drag"); wrap.querySelectorAll(".drop-b,.drop-a").forEach((x) => x.classList.remove("drop-b", "drop-a")); if (!target) return; moveRow(tr.dataset.row, target.dataset.row, before, rows); };
      };
    });
  }
  function moveRow(rowId, targetId, before, rows, patch = {}) {
    const list = rows.filter((r) => r.id !== rowId), i = list.findIndex((r) => r.id === targetId);
    const ord = (r) => r.order ?? r.created ?? 0;
    let o;
    if (i < 0) o = (list.length ? ord(list[list.length - 1]) : 0) + 1;
    else if (before) o = i === 0 ? ord(list[0]) - 1 : (ord(list[i - 1]) + ord(list[i])) / 2;
    else o = i === list.length - 1 ? ord(list[i]) + 1 : (ord(list[i]) + ord(list[i + 1])) / 2;
    ops([{ op: "row", row: { id: rowId, order: o, ...patch } }]);
  }
  function groupRows(v, rows) {
    const p = v.type === "table" && v.group ? prop(v.group) : null;
    if (!p) return [{ key: "", name: null, rows }];
    const out = (p.opts || []).map((o) => ({ key: o.id, name: o.name, chip: chip(o), rows: rows.filter((r) => r.v[p.id] === o.id) }));
    const none = rows.filter((r) => !optOf(p, r.v[p.id])); if (none.length) out.push({ key: "__none", name: "No " + p.name.toLowerCase(), rows: none });
    return out;
  }
  const groupVal = (v, key) => { const gp = prop(v.group); return gp && key && key !== "__none" ? { [gp.id]: key } : null; };

  /* ----- board ----- */
  function board(v, rows) {
    const gp = prop(v.group), wrap = h("div", { class: "wd-board" });
    if (!gp) { wrap.innerHTML = `<p class="wd-empty">Pick a Select or Status property to group the board by (View options).</p>`; return wrap; }
    const cols = [...(gp.opts || []).map((o) => ({ key: o.id, o, rows: rows.filter((r) => r.v[gp.id] === o.id) }))];
    const none = rows.filter((r) => !optOf(gp, r.v[gp.id])); if (none.length) cols.unshift({ key: "", o: null, rows: none });
    const props = shown(v);
    wrap.innerHTML = cols.map((c) => `<section class="wd-col" data-col="${c.key}"${c.o ? ` data-c="${c.o.color}"` : ""}><header>${c.o ? chip(c.o) : `<span class="wd-opt" data-c="grey">No ${esc(gp.name.toLowerCase())}</span>`}<em>${c.rows.length}</em><button class="wd-cadd" data-cadd="${c.key}" title="Add here" aria-label="Add here">${WI("plus", 15)}</button></header>
      <div class="wd-cards">${c.rows.map((r) => card(r, props)).join("")}</div><button class="wd-cnew" data-cadd="${c.key}">${WI("plus", 15)}New</button></section>`).join("") + `<button class="wd-coladd" data-a="addopt">${WI("plus", 16)}<span>Add a group</span></button>`;
    wrap.addEventListener("click", (e) => {
      const t = e.target; if (t.closest("a")) return;
      const add = t.closest("[data-cadd]"); if (add) { const r = newRow({ v: add.dataset.cadd ? { [gp.id]: add.dataset.cadd } : {} }, { open: false }); return; }
      if (t.closest('[data-a="addopt"]')) return askText(t.closest("button"), "New group", "", (n) => n && ops([{ op: "prop", prop: { ...gp, opts: [...(gp.opts || []), { id: rid(), name: n, color: OPT_COLORS[(gp.opts || []).length % OPT_COLORS.length], ...(gp.type === "status" ? { group: "doing" } : {}) }] } }]));
      const cd = t.closest("[data-row]"); if (cd && !cd.classList.contains("dragged")) { const row = doc.rows[cd.dataset.row]; if (t.closest("[data-more]")) return rowMenu(t.closest("[data-more]"), row); return ctx.openRow && ctx.openRow(row.id); }
    });
    cardDrag(wrap, (rowId, colEl, before, targetId) => { const key = colEl.dataset.col; moveRow(rowId, targetId, before, rows.filter((r) => (r.v[gp.id] || "") === key), { v: { [gp.id]: key || null } }); });
    return wrap;
  }
  function card(r, props, cover) {
    const vals = props.map((p) => [p, cellHtml(r, p)]).filter(([, x]) => x);
    const cv = cover && r.cover ? (r.cover.k ? coverCss(r.cover) : `url('${esc(r.cover.src)}') center/cover`) : "";
    return `<article class="wd-card" data-row="${r.id}" tabindex="0">${cover ? `<div class="wd-ccv"${cv ? ` style="background:${cv}"` : ""}>${cv ? "" : `<p>${esc((r.snip || "").slice(0, 160))}</p>`}</div>` : ""}<div class="wd-cbd"><b class="${r.title ? "" : "un"}">${r.icon && ICONS[r.icon] ? WI(r.icon, 15) : ""}${esc(r.title || "Untitled")}</b>${vals.map(([p, x]) => `<div class="wd-cv t-${p.type}" title="${esc(p.name)}">${x}</div>`).join("")}</div><button class="wd-cmore" data-more aria-label="More">${WI("more", 15)}</button></article>`;
  }
  // drag a card to another column (or between cards); works with a mouse, a pen or a finger (press and hold)
  function cardDrag(wrap, drop) {
    wrap.addEventListener("pointerdown", (e) => {
      const cd = e.target.closest(".wd-card"); if (!cd || e.button > 0 || e.target.closest("button,a")) return;
      const x0 = e.clientX, y0 = e.clientY, touch = e.pointerType !== "mouse"; let ghost = null, timer = 0, ready = !touch, lastCol = null, lastBefore = true, lastTarget = null;
      if (touch) timer = setTimeout(() => { ready = true; cd.classList.add("lift"); navigator.vibrate && navigator.vibrate(8); }, 280);
      const move = (m) => {
        if (!ghost) { if (!ready) { if (Math.hypot(m.clientX - x0, m.clientY - y0) > 8) cleanup(); return; } if (Math.hypot(m.clientX - x0, m.clientY - y0) < 5) return;
          const r = cd.getBoundingClientRect(); ghost = cd.cloneNode(true); ghost.classList.add("wd-ghost"); Object.assign(ghost.style, { width: r.width + "px", left: r.left + "px", top: r.top + "px" }); ghost.__dx = x0 - r.left; ghost.__dy = y0 - r.top; document.body.append(ghost); cd.classList.add("dragged"); }
        m.preventDefault(); ghost.style.left = m.clientX - ghost.__dx + "px"; ghost.style.top = m.clientY - ghost.__dy + "px";
        wrap.querySelectorAll(".drop-b,.drop-a,.over").forEach((x) => x.classList.remove("drop-b", "drop-a", "over"));
        const under = document.elementFromPoint(m.clientX, m.clientY); const col = under && under.closest(".wd-col"); if (!col) { lastCol = null; return; }
        col.classList.add("over"); lastCol = col; const t = under.closest(".wd-card"); lastTarget = t && t !== cd ? t.dataset.row : null;
        if (t && t !== cd) { const r = t.getBoundingClientRect(); lastBefore = m.clientY < r.top + r.height / 2; t.classList.add(lastBefore ? "drop-b" : "drop-a"); }
        const sc = col.querySelector(".wd-cards"), sr = sc.getBoundingClientRect(); if (m.clientY > sr.bottom - 30) sc.scrollTop += 8; else if (m.clientY < sr.top + 30) sc.scrollTop -= 8;
        const bw = wrap.getBoundingClientRect(); if (m.clientX > bw.right - 40) wrap.scrollLeft += 12; else if (m.clientX < bw.left + 40) wrap.scrollLeft -= 12;
      };
      const up = () => { const had = !!ghost; cleanup(); if (had && lastCol) { drop(cd.dataset.row, lastCol, lastBefore, lastTarget); setTimeout(() => cd.classList.remove("dragged"), 0); } };
      const cleanup = () => { clearTimeout(timer); removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", cleanup); if (ghost) ghost.remove(); ghost = null; cd.classList.remove("lift"); wrap.querySelectorAll(".drop-b,.drop-a,.over").forEach((x) => x.classList.remove("drop-b", "drop-a", "over")); setTimeout(() => cd.classList.remove("dragged"), 0); };
      addEventListener("pointermove", move, { passive: false }); addEventListener("pointerup", up); addEventListener("pointercancel", cleanup);
    });
  }

  /* ----- calendar ----- */
  function calendar(v, rows) {
    const dp = prop(v.date), wrap = h("div", { class: "wd-cal" });
    if (!dp) { wrap.innerHTML = `<p class="wd-empty">Add a Date property to see this database on a calendar.</p>`; return wrap; }
    const base = S.month ? parseDay(S.month + "-01") : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const first = new Date(base.getFullYear(), base.getMonth(), 1), start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
    const days = []; for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(d); }
    const by = new Map(); for (const r of rows) { const d = dateOf(valueOf(r, dp)).slice(0, 10); if (!d) continue; if (!by.has(d)) by.set(d, []); by.get(d).push(r); }
    const td = today(), mobileList = mobile();
    const undated = rows.filter((r) => !dateOf(valueOf(r, dp)));
    wrap.innerHTML = `<div class="wd-calh"><b>${base.toLocaleDateString([], { month: "long", year: "numeric" })}</b><span class="wd-sp"></span><button class="wd-tb" data-m="0">Today</button><button class="wd-tb icon" data-m="-1" aria-label="Previous month">${WI("chevron-left", 17)}</button><button class="wd-tb icon" data-m="1" aria-label="Next month">${WI("chevron-right", 17)}</button></div>
      <div class="wd-calg"><div class="wd-dow">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((x) => `<span>${x}</span>`).join("")}</div>
      <div class="wd-days">${days.map((d) => { const k = ymd(d), list = by.get(k) || [], max = mobileList ? 2 : 4; return `<div class="wd-day${d.getMonth() !== base.getMonth() ? " out" : ""}${k === td ? " now" : ""}" data-day="${k}"><div class="wd-dh"><span>${d.getDate()}</span><button class="wd-dadd" data-dadd="${k}" aria-label="Add on ${k}">${WI("plus", 13)}</button></div>${list.slice(0, max).map((r) => `<button class="wd-ev" data-row="${r.id}"${evColor(r)}>${esc(r.title || "Untitled")}</button>`).join("")}${list.length > max ? `<button class="wd-evm" data-daymore="${k}">${list.length - max} more</button>` : ""}</div>`; }).join("")}</div></div>
      ${undated.length ? `<details class="wd-und"><summary>${undated.length} without a date</summary>${undated.map((r) => `<button class="wd-ev" data-row="${r.id}">${esc(r.title || "Untitled")}</button>`).join("")}</details>` : ""}`;
    wrap.addEventListener("click", (e) => {
      const t = e.target;
      const m = t.closest("[data-m]"); if (m) { const n = +m.dataset.m; const d = n ? new Date(base.getFullYear(), base.getMonth() + n, 1) : new Date(); S.month = ymd(d).slice(0, 7); draw(); return; }
      const a = t.closest("[data-dadd]"); if (a) return newRow({ v: { [dp.id]: a.dataset.dadd } }, { open: true });
      const more = t.closest("[data-daymore]"); if (more) { const list = by.get(more.dataset.daymore) || []; return choose(more, [{ head: fmtDate(more.dataset.daymore) }, ...list.map((r) => ({ t: r.title || "Untitled", i: "page", run: () => ctx.openRow(r.id) }))], { w: 240 }); }
      const ev = t.closest("[data-row]"); if (ev && !ev.classList.contains("dragged")) return ctx.openRow && ctx.openRow(ev.dataset.row);
    });
    if (dp.type === "date") evDrag(wrap, dp);
    return wrap;
  }
  const evColor = (r) => { const st = doc.props.find((p) => ["status", "select"].includes(p.type)); const o = st && optOf(st, r.v[st.id]); return o ? ` data-c="${o.color}"` : ""; };
  function evDrag(wrap, dp) {
    wrap.addEventListener("pointerdown", (e) => {
      const ev = e.target.closest(".wd-ev[data-row]"); if (!ev || e.pointerType !== "mouse") return;
      const x0 = e.clientX, y0 = e.clientY; let ghost = null, day = null;
      const move = (m) => { if (!ghost) { if (Math.hypot(m.clientX - x0, m.clientY - y0) < 5) return; ghost = ev.cloneNode(true); ghost.classList.add("wd-ghost"); ghost.style.width = ev.offsetWidth + "px"; document.body.append(ghost); ev.classList.add("dragged"); }
        ghost.style.left = m.clientX - 20 + "px"; ghost.style.top = m.clientY - 12 + "px"; wrap.querySelectorAll(".over").forEach((x) => x.classList.remove("over")); const d = document.elementFromPoint(m.clientX, m.clientY)?.closest("[data-day]"); day = d ? d.dataset.day : null; d && d.classList.add("over"); };
      const up = () => { removeEventListener("pointermove", move); removeEventListener("pointerup", up); if (ghost) { ghost.remove(); wrap.querySelectorAll(".over").forEach((x) => x.classList.remove("over")); const row = doc.rows[ev.dataset.row]; if (day && row) { const cur = dateOf(row.v[dp.id]); setVal(row, dp, cur.length > 10 ? day + cur.slice(10) : day); } setTimeout(() => ev.classList.remove("dragged"), 0); } };
      addEventListener("pointermove", move); addEventListener("pointerup", up);
    });
  }

  /* ----- gallery and list ----- */
  function gallery(v, rows) {
    const wrap = h("div", { class: "wd-gal s-" + (v.size || "m") }), props = shown(v);
    wrap.innerHTML = rows.map((r) => card(r, props, true)).join("") + `<button class="wd-gnew" data-a="gnew">${WI("plus", 18)}<span>New</span></button>`;
    wrap.addEventListener("click", (e) => { const t = e.target; if (t.closest("a")) return; if (t.closest('[data-a="gnew"]')) return newRow({}, { open: true }); const cd = t.closest("[data-row]"); if (!cd) return; if (t.closest("[data-more]")) return rowMenu(t.closest("[data-more]"), doc.rows[cd.dataset.row]); ctx.openRow && ctx.openRow(cd.dataset.row); });
    return wrap;
  }
  /* ----- to-do: a plain checklist (tick it off, add one at the top, done ones tuck away below) ----- */
  function todo(v, rows) {
    const st = doc.props.find((p) => p.type === "status"), cb = !st && doc.props.find((p) => p.type === "checkbox");
    const due = doc.props.find((p) => p.type === "date" && /due|deadline/i.test(p.name)) || doc.props.find((p) => p.type === "date");
    const pri = doc.props.find((p) => p.type === "select" && /priorit/i.test(p.name));
    const doneOf = (r) => (st ? optOf(st, r.v[st.id])?.group === "done" : cb ? !!r.v[cb.id] : false);
    const ord = (r) => r.order ?? r.created ?? 0, day = (r) => (due ? dateOf(r.v[due.id]).slice(0, 10) : "");
    let open = rows.filter((r) => !doneOf(r)); const done = rows.filter(doneOf).sort((a, b) => (b.updated || 0) - (a.updated || 0));
    if (!(v.sort || []).length && due) open = open.slice().sort((a, b) => (day(a) || "9999").localeCompare(day(b) || "9999") || ord(a) - ord(b));   // soonest first, no date last
    const td = today();
    const rowHtml = (r, isDone) => {
      const dd = day(r), po = pri && optOf(pri, r.v[pri.id]);
      const dueHtml = dd ? `<span class="td-due${!isDone && dd < td ? " over" : !isDone && dd === td ? " today" : ""}">${esc(fmtDate(r.v[due.id], { rel: true }))}</span>` : "";
      const priHtml = po && !isDone && /^(high|urgent|p1)/i.test(po.name) ? `<span class="td-pri">${esc(po.name)}</span>` : "";
      return `<div class="td-row${isDone ? " done" : ""}" data-row="${r.id}"><button type="button" class="td-cb" role="checkbox" aria-checked="${isDone}" aria-label="${isDone ? "Mark as not done" : "Mark as done"}" data-a="tick"></button><span class="td-t${r.title ? "" : " un"}" data-title tabindex="0">${esc(r.title || "Untitled")}</span><span class="td-m">${priHtml}${dueHtml}</span><button type="button" class="td-more" data-a="more" aria-label="More">${WI("more", 16)}</button></div>`;
    };
    const wrap = h("div", { class: "wd-todo" });
    wrap.innerHTML = `<form class="td-add">${WI("plus", 18)}<input placeholder="Add a task" aria-label="Add a task" maxlength="300" autocomplete="off"></form>
      ${open.length ? `<div class="td-h"><span>To do</span><b>${open.length}</b></div><div class="td-list">${open.map((r) => rowHtml(r, false)).join("")}</div>` : done.length ? `<p class="td-empty">All done. Nice work.</p>` : `<p class="td-empty">Nothing to do yet.<br>Add your first task above.</p>`}
      ${done.length ? `<button type="button" class="td-h td-dh" data-a="doneh" aria-expanded="${!!S.tdDone}"><span>Completed</span><b>${done.length}</b>${WI(S.tdDone ? "chevron-up" : "chevron-down", 14)}</button>${S.tdDone ? `<div class="td-list">${done.map((r) => rowHtml(r, true)).join("")}</div>` : ""}` : ""}`;
    const form = wrap.querySelector(".td-add"), inp = form.querySelector("input");
    inp.value = S.tdText || ""; inp.addEventListener("input", () => (S.tdText = inp.value));
    form.onsubmit = (e) => {
      e.preventDefault(); const t = inp.value.trim(); if (!t) return;
      S.tdText = ""; inp.value = ""; const all = Object.values(doc.rows);
      DB.newRow(id, { title: t, v: seed(v), order: (all.length ? Math.max(...all.map(ord)) : 0) + 1 });
    };
    if (S.tdFocus) setTimeout(() => inp.isConnected && inp.focus(), 0);
    const tick = (r, row) => {
      const now = !doneOf(r); row.classList.toggle("done", now); row.querySelector(".td-cb").setAttribute("aria-checked", String(now));
      setTimeout(() => { if (st) { const o = (st.opts || []).find((x) => (x.group || "todo") === (now ? "done" : "todo")); if (o) setVal(r, st, o.id); } else if (cb) setVal(r, cb, now); }, 200);   // a beat, so the tick is seen
    };
    wrap.addEventListener("click", (e) => {
      const t = e.target;
      if (t.closest('[data-a="doneh"]')) { S.tdDone = !S.tdDone; return draw(); }
      const row = t.closest("[data-row]"), r = row && doc.rows[row.dataset.row]; if (!r) return;
      if (t.closest('[data-a="tick"]')) return tick(r, row);
      if (t.closest('[data-a="more"]')) return rowMenu(t.closest('[data-a="more"]'), r);
      const ti = t.closest("[data-title]"); if (ti) editTitle(r, ti, false);
    });
    wrap.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches("[data-title]")) { e.preventDefault(); const r = doc.rows[e.target.closest("[data-row]").dataset.row]; if (r) editTitle(r, e.target, false); } });
    wrap.addEventListener("contextmenu", (e) => { const row = e.target.closest("[data-row]"); if (!row || !doc.rows[row.dataset.row]) return; e.preventDefault(); rowMenu(row, doc.rows[row.dataset.row], { left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY }); });
    return wrap;
  }
  function list(v, rows) {
    const wrap = h("div", { class: "wd-list" }), props = shown(v);
    wrap.innerHTML = rows.map((r) => `<div class="wd-li" data-row="${r.id}" tabindex="0">${WI(r.icon && ICONS[r.icon] ? r.icon : "page", 16)}<span class="wd-lt${r.title ? "" : " un"}">${esc(r.title || "Untitled")}</span><span class="wd-lv">${props.map((p) => cellHtml(r, p)).filter(Boolean).map((x) => `<span>${x}</span>`).join("")}</span></div>`).join("") + `<button class="wd-lnew" data-a="lnew">${WI("plus", 15)}New</button>`;
    wrap.addEventListener("click", (e) => { const t = e.target; if (t.closest("a")) return; if (t.closest('[data-a="lnew"]')) return newRow({}, { open: true }); const li = t.closest("[data-row]"); if (li) ctx.openRow && ctx.openRow(li.dataset.row); });
    wrap.addEventListener("contextmenu", (e) => { const li = e.target.closest("[data-row]"); if (!li) return; e.preventDefault(); rowMenu(li, doc.rows[li.dataset.row], { left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY }); });
    return wrap;
  }

  return { destroy() { off(); offList(); clearInterval(syncT); closePop(); DB.flush(id); host.textContent = ""; } };
}

/* ---------- editing values: shared by the database views and a row's own page ---------- */
export function valueEditors(id, { busy = () => {} } = {}) {
  const D = () => DB.get(id), prop = (pid) => D().props.find((p) => p.id === pid), ops = (o) => DB.ops(id, o);
  const setVal = (row, p, val) => ops([{ op: "row", row: { id: row.id, v: { [p.id]: val } } }]);
  // editing one value: what opens depends on the kind of property
  function editCell(row, p, el) {
    if (!p || p.type === "created" || p.type === "edited") return;
    if (p.type === "checkbox") return setVal(row, p, !row.v[p.id]);
    const cur = row.v[p.id];
    if (["select", "status", "multi"].includes(p.type)) return optPicker(el, row, p);
    if (p.type === "date") return datePicker(el, row, p);
    if (p.type === "relation") return relPicker(el, row, p);
    const r = el.getBoundingClientRect(), multi = p.type === "text";
    const inp = h(multi ? "textarea" : "input", { class: "wd-cellin" + (multi ? " area" : ""), type: p.type === "number" ? "number" : p.type === "email" ? "email" : p.type === "url" ? "url" : "text", "aria-label": p.name });
    inp.value = cur ?? "";
    Object.assign(inp.style, { left: r.left + "px", top: r.top + "px", width: Math.max(200, r.width) + "px", minHeight: r.height + "px" });
    document.body.append(inp); busy(true); inp.focus(); if (inp.select) inp.select();
    if (multi) { const fit = () => { inp.style.height = "auto"; inp.style.height = Math.min(320, inp.scrollHeight + 2) + "px"; }; fit(); inp.oninput = fit; }
    let done = false;
    const finish = (keep) => { if (done) return; done = true; busy(false); const val = inp.value; inp.remove(); if (keep && String(val) !== String(cur ?? "")) setVal(row, p, p.type === "number" ? (val === "" ? null : +val) : val.trim() || null);  };
    inp.onkeydown = (e) => { if (e.key === "Enter" && (!multi || !e.shiftKey)) { e.preventDefault(); finish(true); } if (e.key === "Escape") finish(false); };
    inp.onblur = () => finish(true);
  }
  function optPicker(anchor, row, p) {
    const box = h("div", { class: "wd-menu wd-opick" });
    const q = h("input", { class: "wd-in", placeholder: p.type === "multi" ? "Search or add options" : "Search or add an option", "aria-label": "Find an option" });
    const sel = h("div", { class: "wd-osel" }), list = h("div", { class: "wd-olist" });
    box.append(sel, q, list);
    const val = () => { const v = (D().rows[row.id] || row).v[p.id]; return p.type === "multi" ? v || [] : v; };
    const drawO = () => {
      const cp = prop(p.id) || p, v = val(), s = q.value.trim().toLowerCase();
      sel.innerHTML = ""; const chosen = p.type === "multi" ? v : v ? [v] : [];
      for (const x of chosen) { const o = optOf(cp, x); if (!o) continue; const c = h("span", { class: "wd-opt", "data-c": o.color, html: `${esc(o.name)}<button aria-label="Remove ${esc(o.name)}">${WI("x", 12)}</button>` }); c.querySelector("button").onclick = () => { setVal(row, cp, p.type === "multi" ? v.filter((y) => y !== x) : null); setTimeout(drawO, 0); }; sel.append(c); }
      sel.hidden = !chosen.length;
      list.innerHTML = `<div class="wd-mh">${s ? "Options" : "Pick an option or type to add one"}</div>`;
      const opts = (cp.opts || []).filter((o) => !s || o.name.toLowerCase().includes(s));
      if (p.type === "status") for (const g of [["todo", "Not started"], ["doing", "In progress"], ["done", "Done"]]) { const og = opts.filter((o) => (o.group || "todo") === g[0]); if (!og.length) continue; list.append(h("div", { class: "wd-mh sm" }, g[1])); og.forEach(addOpt); }
      else opts.forEach(addOpt);
      if (s && !(cp.opts || []).some((o) => o.name.toLowerCase() === s)) { const b = h("button", { type: "button", class: "wd-mi", html: `<span class="t">Add <span class="wd-opt" data-c="${OPT_COLORS[(cp.opts || []).length % OPT_COLORS.length]}">${esc(q.value.trim())}</span></span>` }); b.onclick = create; list.append(b); }
      function addOpt(o) { const on = chosen.includes(o.id); const b = h("button", { type: "button", class: "wd-mi wd-oi" + (on ? " on" : ""), html: `${chip(o)}${on ? `<span class="ck">${WI("check", 15)}</span>` : ""}<span class="wd-om" role="button" aria-label="Edit option">${WI("more", 14)}</span>` }); b.onclick = (e) => { if (e.target.closest(".wd-om")) { e.stopPropagation(); return optMenu(b, prop(p.id), o, drawO); } pick(o.id); }; list.append(b); }
    };
    const pick = (oid) => { const v = val(); if (p.type === "multi") { setVal(row, p, v.includes(oid) ? v.filter((x) => x !== oid) : [...v, oid]); q.value = ""; setTimeout(drawO, 0); q.focus(); } else { setVal(row, p, v === oid ? null : oid); closePop(); } };
    const create = () => { const n = q.value.trim(); if (!n) return; const cp = prop(p.id), o = { id: rid(), name: n.slice(0, 60), color: OPT_COLORS[(cp.opts || []).length % OPT_COLORS.length], ...(cp.type === "status" ? { group: "todo" } : {}) }; ops([{ op: "prop", prop: { ...cp, opts: [...(cp.opts || []), o] } }]); pick(o.id); };
    q.oninput = drawO;
    q.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); const s = q.value.trim().toLowerCase(); const m = (prop(p.id).opts || []).find((o) => o.name.toLowerCase() === s) || (prop(p.id).opts || []).find((o) => o.name.toLowerCase().includes(s)); if (m && s) pick(m.id); else create(); } };
    drawO(); busy(true);
    popover(anchor, box, { w: 280, onClose: () => busy(false) });
    setTimeout(() => q.focus(), 20);
  }
  function datePicker(anchor, row, p) {
    const cur = dateOf(row.v[p.id]), box = h("div", { class: "wd-menu wd-dp" });
    const d = h("input", { type: "date", class: "wd-in", value: cur.slice(0, 10), "aria-label": p.name });
    const t = p.time ? h("input", { type: "time", class: "wd-in sm", value: cur.slice(11, 16), "aria-label": "Time" }) : null;
    const set = (day) => { const v = day ? (t && t.value ? `${day}T${t.value}` : day) : null; setVal(row, p, v); };
    d.onchange = () => set(d.value); if (t) t.onchange = () => d.value && set(d.value);
    box.append(h("div", { class: "wd-dpr" }, d, t || ""));
    const quick = h("div", { class: "wd-quick" });
    const add = (n) => ymd(new Date(Date.now() + n * 864e5));
    const nextMon = () => { const x = new Date(); x.setDate(x.getDate() + ((8 - x.getDay()) % 7 || 7)); return ymd(x); };
    for (const [l, v] of [["Today", add(0)], ["Tomorrow", add(1)], ["Next week", nextMon()], ["In a month", ymd(new Date(new Date().setMonth(new Date().getMonth() + 1)))]]) { const b = h("button", { type: "button" }, l); b.onclick = () => { set(v); closePop(); }; quick.append(b); }
    box.append(quick);
    if (cur) { const c = h("button", { type: "button", class: "wd-mi danger", html: `<span class="ic">${WI("x", 16)}</span><span class="t">Clear</span>` }); c.onclick = () => { setVal(row, p, null); closePop(); }; box.append(h("hr"), c); }
    popover(anchor, box, { w: 260 });
    setTimeout(() => { try { d.showPicker && !mobile() && d.focus(); } catch {} }, 20);
  }
  async function relPicker(anchor, row, p) {
    const other = await DB.open(p.db || id); if (!other) return;
    const box = h("div", { class: "wd-menu wd-opick" }), q = h("input", { class: "wd-in", placeholder: "Find a page", "aria-label": "Find a page" }), list = h("div", { class: "wd-olist" });
    box.append(q, list);
    const drawR = () => {
      const v = (D().rows[row.id] || row).v[p.id] || [], s = q.value.trim().toLowerCase(); list.innerHTML = "";
      for (const r of Object.values(other.rows).filter((r) => r.id !== row.id && (!s || (r.title || "").toLowerCase().includes(s))).slice(0, 60)) { const on = v.includes(r.id); const b = h("button", { type: "button", class: "wd-mi" + (on ? " on" : ""), html: `<span class="ic">${WI(r.icon || "page", 16)}</span><span class="t">${esc(r.title || "Untitled")}</span>${on ? `<span class="ck">${WI("check", 15)}</span>` : ""}` }); b.onclick = () => { setVal(row, p, on ? v.filter((x) => x !== r.id) : [...v, r.id]); setTimeout(drawR, 0); }; list.append(b); }
      if (!list.childElementCount) list.innerHTML = `<p class="wd-none">No pages${s ? " match" : " yet"}.</p>`;
    };
    q.oninput = drawR; drawR(); popover(anchor, box, { w: 280 }); setTimeout(() => q.focus(), 20);
  }

  /* ----- showing values ----- */
  function cellHtml(row, p) {
    const v = valueOf(row, p);
    if (p.type === "checkbox") return `<span class="wd-cb${v ? " on" : ""}" role="checkbox" aria-checked="${!!v}"></span>`;
    if (v == null || v === "" || (Array.isArray(v) && !v.length)) return "";
    switch (p.type) {
      case "select": case "status": return chip(optOf(p, v));
      case "multi": return v.map((x) => chip(optOf(p, x))).join("");
      case "number": return `<span class="wd-num">${esc(fmtNum(v, p.fmt))}</span>`;
      case "date": case "created": case "edited": { const d = dateOf(v), over = p.type === "date" && d.slice(0, 10) < today() && !isDone(row); return `<span class="wd-date${over ? " over" : ""}">${esc(fmtDate(p.type === "date" ? v : d, { rel: true }))}</span>`; }
      case "url": return `<a class="wd-link" href="${esc(/^https?:/i.test(v) ? v : "https://" + v)}" target="_blank" rel="noopener">${esc(String(v).replace(/^https?:\/\/(www\.)?/, "").slice(0, 60))}</a>`;
      case "email": return `<a class="wd-link" href="mailto:${esc(v)}">${esc(v)}</a>`;
      case "phone": return `<a class="wd-link" href="tel:${esc(v)}">${esc(v)}</a>`;
      case "relation": { const o = DB.get(p.db || id); return v.map((x) => `<span class="wd-rel">${WI("page", 13)}${esc((o && o.rows[x] && o.rows[x].title) || "Untitled")}</span>`).join(""); }
      default: return `<span class="wd-txt">${esc(v)}</span>`;
    }
  }
  const isDone = (row) => { const st = D().props.find((p) => p.type === "status"); if (!st) return false; const o = optOf(st, row.v[st.id]); return o && o.group === "done"; };
  function optMenu(anchor, p, o, after) {
    const box = h("div", { class: "wd-menu" });
    const nm = h("input", { class: "wd-in", value: o.name, maxlength: "60", "aria-label": "Option name" });
    box.append(nm, h("div", { class: "wd-mh" }, "Colour"));
    const save = (patch) => { const cur = prop(p.id); ops([{ op: "prop", prop: { ...cur, opts: cur.opts.map((x) => (x.id === o.id ? { ...x, ...patch } : x)) } }]); Object.assign(o, patch); after && after(); };
    const sw = h("div", { class: "wd-cols" }); for (const c of OPT_COLORS) { const b = h("button", { type: "button", class: "wd-swc" + (o.color === c ? " on" : ""), "data-c": c, "aria-label": c, title: c }); b.onclick = () => { save({ color: c }); sw.querySelectorAll(".on").forEach((x) => x.classList.remove("on")); b.classList.add("on"); }; sw.append(b); }
    box.append(sw);
    if (p.type === "status") { box.append(h("div", { class: "wd-mh" }, "Counts as")); const g = h("div", { class: "wd-seg" }); for (const [k, t] of [["todo", "Not started"], ["doing", "In progress"], ["done", "Done"]]) { const b = h("button", { type: "button", class: (o.group || "todo") === k ? "on" : "" }, t); b.onclick = () => { save({ group: k }); g.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); }; g.append(b); } box.append(g); }
    const del = h("button", { type: "button", class: "wd-mi danger", html: `<span class="ic">${WI("trash", 17)}</span><span class="t">Delete option</span>` });
    del.onclick = () => { const cur = prop(p.id); ops([{ op: "prop", prop: { ...cur, opts: cur.opts.filter((x) => x.id !== o.id) } }]); closePop(); };
    box.append(h("hr"), del);
    nm.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); closePop(); } };
    popover(anchor, box, { w: 230, onClose: () => { const n = nm.value.trim(); if (n && n !== o.name) save({ name: n }); } });
    setTimeout(() => nm.focus(), 20);
  }

  return { setVal, editCell, cellHtml, optMenu, isDone };
}

/* ---------- small shared pickers ---------- */
export function askText(anchor, title, value, done) {
  const box = h("div", { class: "wd-menu wd-ask" }), inp = h("input", { class: "wd-in", value: value || "", placeholder: title, "aria-label": title, maxlength: "120" });
  box.append(h("div", { class: "wd-mh" }, title), inp);
  inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); const v = inp.value.trim(); closePop(); done(v); } };
  popover(anchor, box, { w: 260 }); setTimeout(() => { inp.focus(); inp.select(); }, 20);
}
export const PICK_ICONS = ["page", "file-text", "db", "checkbox", "calendar", "bulb", "sparkles", "target", "rocket", "star", "heart", "flame", "video", "camera", "mic", "music", "pencil", "book", "bookmark", "palette", "image", "brain", "chat", "clock", "list", "chart", "trend", "globe", "home", "coffee", "leaf", "gift", "trophy", "graduation", "plane", "wallet", "mail", "user", "laptop", "link", "pin", "tag", "lock", "flask", "compass", "map", "sun", "shield"];
export function iconPick(anchor, cur, done) {
  const box = h("div", { class: "wd-menu wd-icons" });
  box.append(h("div", { class: "wd-mh" }, "Icon"));
  const g = h("div", { class: "wd-ig" });
  for (const n of PICK_ICONS.filter((x) => ICONS[x])) { const b = h("button", { type: "button", class: cur === n ? "on" : "", title: n, "aria-label": n, html: WI(n, 18) }); b.onclick = () => { closePop(); done(n); }; g.append(b); }
  box.append(g);
  if (cur) { const c = h("button", { type: "button", class: "wd-mi", html: `<span class="ic">${WI("x", 16)}</span><span class="t">Remove icon</span>` }); c.onclick = () => { closePop(); done(""); }; box.append(h("hr"), c); }
  popover(anchor, box, { w: 300 });
}
