// Boards: private infinite canvases for brainstorming, notes, scripts and moodboards. Owner only.
// The board list and home live here; the canvas is in board-canvas.mjs and the page windows in board-page.mjs.
import { h, $, $$, esc, api, isAdmin, toast, mobile, confirmBox } from "/js/lib.mjs";
import { R } from "/js/os-ext.mjs";
import { ICONS } from "/shared/icons.mjs";
import { createCanvas, menu, closeMenu, I, shortcuts } from "/js/board-canvas.mjs";
import { pageWindows, download } from "/js/board-page.mjs";
import { COVERS, coverCss, COLORS } from "/js/board-covers.mjs";

if (!document.querySelector('link[href="/css/boards.css"]')) document.head.append(h("link", { rel: "stylesheet", href: "/css/boards.css" }));

const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }, del(k) { try { localStorage.removeItem(k); } catch {} } };
const rid = () => Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8);
const name = (b) => (b && b.title && b.title.trim()) || "Untitled board";
const ago = (ts) => { if (!ts) return ""; const s = (Date.now() - ts) / 1000; if (s < 60) return "just now"; if (s < 3600) return Math.round(s / 60) + " min ago"; if (s < 86400) return Math.round(s / 3600) + " h ago"; if (s < 86400 * 7) return Math.round(s / 86400) + " d ago"; return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }); };
const COVER_KEYS = Object.keys(COVERS);
const BOARD_ICONS = ["sparkles", "bulb", "palette", "video", "pencil", "rocket", "target", "camera", "music", "brain", "star", "heart", "flame", "leaf", "globe", "chart", "calendar", "book", "home", "coffee"].filter((n) => ICONS[n]);
const STATUS = { saved: ["cloud-done", "All changes saved"], saving: ["cloud-up", "Saving…"], unsaved: ["cloud", "Saving soon…"], offline: ["cloud-off", "Offline. Your changes are kept on this device and saved when you're back online."] };
const PV = { page: "var(--surface)", image: "var(--bd-img)", frame: "transparent", link: "var(--surface)", text: "transparent" };

/* ---------- templates: a quick start for the kinds of boards made most ---------- */
const T = {
  blank: { name: "Blank board", desc: "An empty canvas", cover: "m1", icon: "sparkles", make: () => ({ items: [], links: [] }) },
  brainstorm: { name: "Brainstorm", desc: "One idea in the middle, thoughts around it", cover: "m2", icon: "bulb", make() {
    const c = { id: rid(), t: "sticky", x: -130, y: -130, w: 260, h: 260, z: 5, color: "yellow", text: "The big idea", size: "l" };
    const around = [[-520, -360, "pink"], [260, -360, "blue"], [-520, 100, "green"], [260, 100, "purple"]].map(([x, y, color], i) => ({ id: rid(), t: "sticky", x, y, w: 220, h: 220, z: 6 + i, color, text: "" }));
    return { items: [c, ...around], links: around.map((a) => ({ id: rid(), a: c.id, b: a.id, as: "auto", bs: "auto", style: "curve", ends: "none", color: "grey" })) };
  } },
  moodboard: { name: "Moodboard", desc: "Sections for colour, type and imagery", cover: "m5", icon: "palette", make() {
    const f = (x, y, w, hh, title, color) => ({ id: rid(), t: "frame", x, y, w, h: hh, z: -10, title, color });
    return { items: [f(-900, -420, 860, 520, "Imagery", "blue"), f(20, -420, 560, 520, "Colour", "pink"), f(-900, 160, 860, 380, "Type and texture", "purple"), f(20, 160, 560, 380, "References", "green"),
      { id: rid(), t: "text", x: -900, y: -560, w: 900, h: 60, z: 1, text: "Moodboard", size: "xl" }, { id: rid(), t: "sticky", x: 60, y: 220, w: 200, h: 200, z: 2, color: "green", text: "Drop pictures straight onto the board" }], links: [] };
  } },
  video: { name: "Video plan", desc: "Hook, script, shots and thumbnail", cover: "m4", icon: "video", make() {
    const f = (x, title, color) => ({ id: rid(), t: "frame", x, y: -300, w: 380, h: 640, z: -10, title, color });
    const fr = [f(-820, "Hook", "red"), f(-400, "Story", "blue"), f(20, "Shots and B-roll", "teal"), f(440, "Thumbnail", "yellow")];
    const pg = { id: rid(), t: "page", x: -380, y: -220, w: 340, h: 230, z: 3, title: "Script", icon: "video", cover: { k: "m4" }, snip: "", words: 0, edited: Date.now() };
    const s = (x, y, color, text) => ({ id: rid(), t: "sticky", x, y, w: 300, h: 160, z: 4, color, text });
    return { items: [...fr, pg, s(-780, -220, "pink", "First 5 seconds: what makes them stay?"), s(-780, -40, "pink", ""), s(-380, 40, "blue", "Key points"), s(60, -220, "teal", "Shot list"), s(480, -220, "yellow", "Thumbnail idea"),
      { id: rid(), t: "text", x: -820, y: -420, w: 900, h: 60, z: 1, text: "Video plan", size: "xl" }], links: [] };
  } },
  article: { name: "Article outline", desc: "Research, outline and the draft", cover: "m3", icon: "pencil", make() {
    const f = (x, title, color) => ({ id: rid(), t: "frame", x, y: -300, w: 420, h: 600, z: -10, title, color });
    const pg = { id: rid(), t: "page", x: 520, y: -260, w: 360, h: 250, z: 3, title: "Draft", icon: "pencil", cover: { k: "m3" }, snip: "", words: 0, edited: Date.now() };
    const a = { id: rid(), t: "sticky", x: -420, y: -220, w: 340, h: 150, z: 4, color: "green", text: "Sources and links" };
    const b = { id: rid(), t: "sticky", x: 60, y: -220, w: 340, h: 150, z: 4, color: "yellow", text: "1. Intro\n2. Main point\n3. Close" };
    return { items: [f(-460, "Research", "green"), f(20, "Outline", "yellow"), pg, a, b, { id: rid(), t: "text", x: -460, y: -420, w: 900, h: 60, z: 1, text: "Article", size: "xl" }],
      links: [{ id: rid(), a: a.id, b: b.id, as: "auto", bs: "auto", style: "curve", ends: "end", color: "grey" }, { id: rid(), a: b.id, b: pg.id, as: "auto", bs: "auto", style: "curve", ends: "end", color: "blue" }] };
  } },
};

/* ---------- a small picture of a board, drawn from its saved outline ---------- */
function previewSvg(p) {
  if (!p || !p.length) return "";
  const rects = p.map(([x, y, w, hh, c]) => {
    const fill = COLORS[c] ? "var(--f)" : PV[c] || "var(--surface)";
    const stroke = c === "frame" ? "var(--line)" : c === "page" || c === "link" ? "var(--line)" : "none";
    return `<rect${COLORS[c] ? ` data-c="${c}"` : ""} x="${x}" y="${y}" width="${w}" height="${hh}" rx="${c === "frame" ? 18 : 10}" style="fill:${fill};stroke:${stroke}" stroke-width="${c === "frame" ? 6 : 4}"/>`;
  }).join("");
  return `<svg viewBox="-40 -40 1080 1080" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${rects}</svg>`;
}

/* =====================================================================================================================
   The app
   ===================================================================================================================== */
export async function boardsApp(body, key) {
  body.classList.add("ba-body");
  if (!isAdmin()) {
    body.innerHTML = `<div class="ba-lock"><span class="ba-lki">${I("lock", 28)}</span><h2>Boards are private</h2><p>Sign in as the owner to open your boards.</p></div>`;
    R.handlers.boards = () => {};
    return;
  }
  body.innerHTML = `<div class="ba bdc" data-side="${ls.get("baSide", !mobile()) ? "on" : "off"}"><aside class="ba-side" aria-label="Boards"></aside><section class="ba-main"></section><div class="ba-scrim"></div></div>`;
  const root = $(".ba", body), side = $(".ba-side", root), main = $(".ba-main", root);
  const A = { boards: [], cur: null, cv: null, pw: null, view: "home", status: "saved", q: "" };
  R.handlers.boards = (b, k) => (k ? openBoard(k, "replace") : home("replace"));

  async function load() { const r = await api("/api/boards"); if (r.ok) A.boards = r.data.boards; else if (!A.boards.length) A.boards = ls.get("baList", []); if (r.ok) ls.set("baList", A.boards.map((b) => ({ ...b, preview: b.preview }))); return r.ok; }
  const live = () => A.boards.filter((b) => !b.trashed).sort((a, b) => (b.fav - a.fav) || (b.updated - a.updated));
  const found = () => { const q = A.q.trim().toLowerCase(); return q ? live().filter((b) => name(b).toLowerCase().includes(q)) : live(); };
  const byId = (id) => A.boards.find((b) => b.id === id);

  /* ----- sidebar ----- */
  function drawSide() {
    const list = found(), bin = A.boards.filter((b) => b.trashed).length;
    side.innerHTML = `<div class="ba-sh"><button class="ba-new" data-new>${I("plus", 20)}<span>New board</span></button><button class="ba-ib" data-tg title="Hide the sidebar" aria-label="Hide the sidebar">${I("panel-left", 18)}</button></div>
      <label class="ba-search">${I("search", 18)}<input type="search" placeholder="Search boards" aria-label="Search boards" autocomplete="off" value="${esc(A.q)}"></label>
      <nav class="ba-nav"><button class="ba-nv${A.view === "home" ? " on" : ""}" data-home>${I("home", 18)}<span>Home</span></button></nav>
      <div class="ba-sec"><span>Your boards</span>${live().length ? `<em>${live().length}</em>` : ""}</div>
      <div class="ba-list" role="list">${list.map((b) => `<button class="ba-row${A.cur && A.cur.id === b.id ? " on" : ""}" role="listitem" data-open="${b.id}"><span class="ba-th" style="${b.cover ? `background:${coverCss(b.cover) || `url('${esc(b.cover.src || "")}') center/cover`}` : ""}">${b.icon && ICONS[b.icon] ? I(b.icon, 14) : ""}</span><span class="ba-rt">${esc(name(b))}</span>${b.fav ? `<span class="ba-fav">${I("star", 13)}</span>` : ""}</button>`).join("") || `<p class="ba-none">${A.q ? "No board matches." : "No boards yet."}</p>`}</div>
      <nav class="ba-nav ba-nav2"><button class="ba-nv${A.view === "bin" ? " on" : ""}" data-bin>${I("trash", 18)}<span>Bin</span>${bin ? `<em>${bin}</em>` : ""}</button></nav>`;
    $("[data-tg]", side).onclick = () => toggleSide();
    const sq = $(".ba-search input", side);
    sq.oninput = () => { A.q = sq.value; const pos = sq.selectionStart; drawSide(); const n = $(".ba-search input", side); n.focus(); try { n.setSelectionRange(pos, pos); } catch {} if (A.view === "home") drawGrid(); };
    sq.onkeydown = (e) => { if (e.key === "Escape" && sq.value) { e.preventDefault(); sq.value = ""; sq.oninput(); } if (e.key === "Enter") { const f = found()[0]; if (f) openBoard(f.id); } };
    $("[data-new]", side).onclick = (e) => newBoardMenu(e.currentTarget);
    $("[data-home]", side).onclick = () => home();
    $("[data-bin]", side).onclick = () => showBin();
    $$("[data-open]", side).forEach((b) => (b.onclick = () => { openBoard(b.dataset.open); if (mobile()) setSide(false); }));
  }
  function setSide(on) { ls.set("baSide", on); root.dataset.side = on ? "on" : "off"; }
  function toggleSide() { setSide(root.dataset.side !== "on"); }
  $(".ba-scrim", root).onclick = () => setSide(false);

  /* ----- home: all boards ----- */
  async function home(mode = "push") {
    await leaveBoard();
    A.view = "home"; A.cur = null; drawSide();
    const hr = new Date().getHours(), hi = hr < 5 ? "Working late" : hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
    main.innerHTML = `<div class="ba-home"><header class="ba-hh"><button class="ba-ib ba-tg2" data-tg aria-label="Show the sidebar">${I("panel-left", 18)}</button><div><h1>${hi}</h1><p>Your boards for ideas, notes, scripts and moodboards.</p></div></header>
      <section class="ba-tpl" aria-label="Start a board">${Object.entries(T).map(([k, t]) => `<button class="ba-tc" data-tpl="${k}"><span class="ba-tcv" style="background:${coverCss({ k: t.cover })}"><span class="ba-tci">${I(k === "blank" ? "plus" : t.icon, 22)}</span></span><b>${t.name}</b><small>${t.desc}</small></button>`).join("")}</section>
      <div class="ba-gh"><h2>Recent boards</h2><span class="ba-cnt"></span></div>
      <section class="ba-grid"></section></div>`;
    drawGrid();
    $("[data-tg]", main).onclick = () => toggleSide();
    $$("[data-tpl]", main).forEach((b) => (b.onclick = () => newBoard(b.dataset.tpl)));
    R.item(body, "", "Boards", mode);
  }
  function drawGrid() {
    const g = $(".ba-grid", main); if (!g) return; const list = found();
    $(".ba-cnt", main).textContent = A.q ? `${list.length} found` : live().length || "";
    g.innerHTML = list.map(card).join("") || (A.q ? `<div class="ba-empty">${I("search", 26)}<b>No board matches “${esc(A.q)}”</b></div>` : `<div class="ba-empty">${I("sparkles", 26)}<b>No boards yet</b><p>Pick a starting point above.</p></div>`);
    wireCards(main);
  }
  function card(b) {
    const cv = b.cover ? (b.cover.k ? coverCss(b.cover) : `url('${esc(b.cover.src)}') center/cover`) : "";
    return `<article class="ba-card" data-card="${b.id}" tabindex="0"><div class="ba-cv">${cv ? `<span class="ba-cvb" style="background:${cv}"></span>` : ""}<span class="ba-pv">${previewSvg(b.preview)}</span></div>
      <div class="ba-cb"><span class="ba-ci">${I(b.icon && ICONS[b.icon] ? b.icon : "grid", 16)}</span><div class="ba-ct"><b>${esc(name(b))}</b><small>${b.count ? `${b.count} item${b.count === 1 ? "" : "s"} · ` : ""}${ago(b.updated)}</small></div>
      ${b.fav ? `<span class="ba-fav">${I("star", 15)}</span>` : ""}<button class="ba-ib" data-cm="${b.id}" aria-label="More" title="More">${I("more", 18)}</button></div></article>`;
  }
  function wireCards(el) {
    $$("[data-card]", el).forEach((c) => {
      c.onclick = (e) => { if (e.target.closest("[data-cm]")) return; openBoard(c.dataset.card); };
      c.onkeydown = (e) => { if (e.key === "Enter") openBoard(c.dataset.card); };
    });
    $$("[data-cm]", el).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const r = b.getBoundingClientRect(); menu(r.right - 220, r.bottom + 4, boardMenu(byId(b.dataset.cm))); }));
  }
  function boardMenu(b, inBoard) {
    if (!b) return [];
    return [
      ...(inBoard ? [] : [{ t: "Open", i: "open", run: () => openBoard(b.id) }]),
      { t: "Rename", i: "pencil", run: () => rename(b) },
      { t: "Change cover", i: "image", sub: [{ tiles: COVER_KEYS.map((k) => ({ bg: coverCss({ k }), name: COVERS[k].name, on: !!(b.cover && b.cover.k === k), run: () => setMeta(b, { cover: { k } }) })) }, "-", { t: "No cover", i: "x", run: () => setMeta(b, { cover: null }) }] },
      { t: "Change icon", i: "smile", sub: [{ chips: BOARD_ICONS.map((n) => ({ i: n, title: n.replace(/-/g, " "), on: b.icon === n, run: () => setMeta(b, { icon: n }) })) }, "-", { t: "No icon", i: "x", run: () => setMeta(b, { icon: "" }) }] },
      { t: b.fav ? "Remove from favourites" : "Add to favourites", i: "star", run: () => setMeta(b, { fav: !b.fav }) },
      { t: "Duplicate", i: "dup", run: () => duplicateBoard(b) },
      ...(inBoard ? [{ t: "Safety copies", i: "history", run: () => boardHistory(b) }, { t: "Download a backup (.json)", i: "download", run: () => exportJson(b) }] : []),
      "-", { t: "Move to bin", i: "trash", danger: true, run: () => trash(b) },
    ];
  }
  async function setMeta(b, patch) {
    Object.assign(b, patch); refreshChrome();
    const r = await api("/api/boards?id=" + b.id, { method: "PUT", body: patch });
    if (r.ok) Object.assign(b, r.data.board); else toast("Could not save that change");
    refreshChrome();
  }
  function refreshChrome() { drawSide(); if (A.view === "home") drawGrid(); if (A.view === "board") drawTop(); }
  async function rename(b) {
    if (A.view === "board" && A.cur && A.cur.id === b.id) { const t = $(".ba-title", main); if (t) { t.focus(); t.select(); return; } }
    const v = prompt("Board name", b.title || ""); if (v == null) return; setMeta(b, { title: v.trim().slice(0, 120) });
  }
  async function trash(b) {
    if (A.cur && A.cur.id === b.id) await home();
    setMeta(b, { trashed: true }); toast("Moved to the bin");
  }
  function newBoardMenu(anchor) {
    const r = anchor.getBoundingClientRect();
    menu(r.left, r.bottom + 6, [{ head: "Start from" }, ...Object.entries(T).map(([k, t]) => ({ t: t.name, i: k === "blank" ? "plus" : t.icon, run: () => newBoard(k) }))]);
  }
  async function newBoard(tpl = "blank", extra = {}) {
    const t = T[tpl] || T.blank, made = t.make();
    const r = await api("/api/boards", { method: "POST", body: { title: tpl === "blank" ? "" : t.name, cover: { k: t.cover }, icon: tpl === "blank" ? "" : t.icon, ...made, ...extra } });
    if (!r.ok) { toast(r.data.error || "Could not make a board. Check your connection."); return; }
    A.boards.push(r.data.board); ls.set("bdDoc:" + r.data.board.id, null);
    await openBoard(r.data.board.id, "push", { doc: r.data.doc, fresh: tpl === "blank" });
  }
  async function duplicateBoard(b) {
    const r = await api("/api/boards?id=" + b.id); if (!r.ok) { toast("Could not copy the board"); return; }
    const map = new Map(); const items = Object.values(r.data.doc.items).map((it) => { const n = { ...it, id: rid() }; map.set(it.id, n.id); return n; });
    const links = Object.values(r.data.doc.links).map((l) => ({ ...l, id: rid(), a: map.get(l.a), b: map.get(l.b) }));
    const c = await api("/api/boards", { method: "POST", body: { title: name(b) + " (copy)", cover: b.cover, icon: b.icon, items, links } });
    if (!c.ok) { toast(c.data.error || "Could not copy the board"); return; }
    for (const [from, to] of map) if (r.data.doc.items[from].t === "page") await api("/api/boards?a=copypage", { method: "POST", body: { from, to } });
    A.boards.push(c.data.board); refreshChrome(); toast("Board copied");
  }
  async function exportJson(b) {
    await flushBoard();
    const r = await api("/api/boards?id=" + b.id); if (!r.ok) { toast("Could not download"); return; }
    const pages = {}; for (const it of Object.values(r.data.doc.items)) if (it.t === "page") { const p = await api("/api/boards?page=" + it.id); if (p.ok) pages[it.id] = p.data.blocks; }
    const blob = new Blob([JSON.stringify({ kind: "rohankumar-board", v: 1, board: r.data.board, doc: r.data.doc, pages }, null, 1)], { type: "application/json" });
    const a = h("a", { href: URL.createObjectURL(blob), download: (name(b).replace(/[^\w]+/g, "-").toLowerCase() || "board") + ".json" }); document.body.append(a); a.click(); a.remove();
  }
  async function boardHistory(b) {
    await flushBoard();
    const r = await api("/api/boards?id=" + b.id + "&a=history"); const list = r.ok ? r.data.history : [];
    const d = h("div", { class: "own-dlg" }), c = h("div", { class: "own-card bp-hist", role: "dialog", "aria-modal": "true" }, h("b", {}, "Safety copies of this board"), h("p", { class: "hint" }, "A copy is kept every 10 minutes while you work, and before any change that removes most of the board."));
    if (!list.length) c.append(h("p", { class: "hint" }, "No copies yet."));
    for (const v of list) c.append(h("div", { class: "bp-hr" }, h("span", {}, new Date(v.ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })), h("small", {}, `${v.count} items`), h("button", { class: "btn tonal", onclick: async () => {
      d.remove(); const x = await api("/api/boards?id=" + b.id + "&a=restore", { method: "POST", body: { ts: v.ts } });
      if (!x.ok) { toast(x.data.error || "Could not put it back"); return; }
      ls.del("bdPend:" + b.id); A.cv.load(x.data.doc, A.cv.view); toast("Board put back. What was there is kept as a safety copy too.");
    } }, "Put back")));
    c.append(h("div", { class: "own-row" }, h("button", { type: "button", onclick: () => d.remove() }, "Close")));
    d.append(c); document.body.append(d); d.addEventListener("pointerdown", (e) => { if (e.target === d) d.remove(); });
  }

  /* ----- bin ----- */
  async function showBin() {
    await leaveBoard(); A.view = "bin"; A.cur = null; drawSide();
    const list = A.boards.filter((b) => b.trashed).sort((a, b) => b.trashed - a.trashed);
    main.innerHTML = `<div class="ba-home"><header class="ba-hh"><button class="ba-ib ba-tg2" data-tg aria-label="Show the sidebar">${I("panel-left", 18)}</button><div><h1>Bin</h1><p>Boards you moved here. Put them back, or delete them for good.</p></div></header>
      <section class="ba-binl">${list.map((b) => `<div class="ba-binr"><span class="ba-th" style="${b.cover && b.cover.k ? `background:${coverCss(b.cover)}` : ""}"></span><b>${esc(name(b))}</b><small>${b.count || 0} items · binned ${ago(b.trashed)}</small><button class="btn tonal" data-rs="${b.id}">Restore</button><button class="btn tonal danger" data-rm="${b.id}">Delete for good</button></div>`).join("") || '<div class="ba-empty"><b>The bin is empty</b></div>'}</section></div>`;
    $("[data-tg]", main).onclick = () => toggleSide();
    $$("[data-rs]", main).forEach((b) => (b.onclick = async () => { await setMeta(byId(b.dataset.rs), { trashed: false }); showBin(); }));
    $$("[data-rm]", main).forEach((b) => (b.onclick = async () => {
      const bd = byId(b.dataset.rm); if (!(await confirmBox(`Delete “${name(bd)}” for good? Its pages go too. A last copy is kept in the backup store.`, "Delete"))) return;
      const r = await api("/api/boards?id=" + bd.id, { method: "DELETE" }); if (!r.ok) { toast("Could not delete"); return; }
      A.boards = A.boards.filter((x) => x.id !== bd.id); ls.del("bdDoc:" + bd.id); ls.del("bdView:" + bd.id); showBin();
    }));
    R.item(body, "", "Bin — Boards", "push");
  }

  /* ----- one board ----- */
  async function leaveBoard() {
    if (!A.cv) return;
    await flushBoard();
    if (A.pw) await A.pw.closeAll();
    A.cv.destroy(); A.cv = null; A.pw = null;
  }
  async function flushBoard() { if (A.pw) await A.pw.flushAll(); if (A.cv) await A.cv.flush(); }
  async function openBoard(id, mode = "push", { doc, fresh } = {}) {
    if (A.cur && A.cur.id === id && A.cv) return;
    await leaveBoard();
    let b = byId(id);
    if (!b) { await load(); b = byId(id); }
    if (!b) { toast("That board isn't here any more."); return home("replace"); }
    A.view = "board"; A.cur = b; drawSide();
    main.innerHTML = `<div class="ba-board"><div class="ba-canvas"></div><div class="ba-pages"></div>
      <div class="ba-top"><button class="ba-ib" data-tg title="Show the sidebar" aria-label="Show the sidebar">${I("panel-left", 18)}</button><button class="ba-bi" data-bi title="Cover and icon" aria-label="Cover and icon"></button><input class="ba-title" maxlength="120" aria-label="Board name" placeholder="Untitled board"><span class="ba-st" role="status" tabindex="-1"></span><button class="ba-ib" data-bm title="Board options" aria-label="Board options">${I("more", 18)}</button></div></div>`;
    const cvHost = $(".ba-canvas", main), pages = $(".ba-pages", main);
    $("[data-tg]", main).onclick = () => toggleSide();
    $("[data-bm]", main).onclick = (e) => { const r = e.currentTarget.getBoundingClientRect(); menu(r.left, r.bottom + 6, boardMenu(b, true), { ret: $(".bd-stage", main) }); };
    $("[data-bi]", main).onclick = (e) => { const r = e.currentTarget.getBoundingClientRect(); menu(r.left, r.bottom + 6, [{ head: "Cover" }, { tiles: COVER_KEYS.map((k) => ({ bg: coverCss({ k }), name: COVERS[k].name, on: !!(b.cover && b.cover.k === k), run: () => setMeta(b, { cover: { k } }) })) }, { head: "Icon" }, { chips: BOARD_ICONS.map((n) => ({ i: n, title: n, on: b.icon === n, run: () => setMeta(b, { icon: n }) })) }, "-", { t: "No icon", i: "x", run: () => setMeta(b, { icon: "" }) }, { t: "No cover", i: "image", run: () => setMeta(b, { cover: null }) }], { ret: $(".bd-stage", main) }); };
    const title = $(".ba-title", main);
    title.oninput = () => { b.title = title.value; drawSide(); clearTimeout(A.tT); A.tT = setTimeout(() => setMeta(b, { title: title.value.trim().slice(0, 120) }), 700); };
    title.onkeydown = (e) => { if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); title.blur(); $(".bd-stage", main)?.focus(); } };
    drawTop(); setStatus("saved");
    const cv = createCanvas(cvHost, {
      owner: true, boardId: id,
      send: async (patch) => {
        const r = await api("/api/boards?id=" + id + "&a=patch", { method: "POST", body: patch });
        if (r.ok) { Object.assign(b, r.data.stat || {}); clearTimeout(A.cT); A.cT = setTimeout(() => { if (A.cv === cv) { try { const snap = cv.snapshot(); if (JSON.stringify(snap).length < 1_500_000) ls.set("bdDoc:" + id, snap); } catch {} } }, 1500); return { ok: true, rev: r.data.rev }; }
        if (r.status === 409 && r.data.stale) return { stale: true };
        if (r.status === 404) { toast("This board no longer exists on the server. Your copy is kept on this device."); return { ok: false }; }
        if (r.status === 400) { toast(r.data.error || "A change could not be saved"); return { ok: true }; } // refused for good (too big): keep going
        return { ok: false }; // offline, signed out or a server hiccup: kept on this device and retried
      },
      persist: (p) => { if (p) ls.set("bdPend:" + id, p); else ls.del("bdPend:" + id); },
      onStatus: (s) => setStatus(s),
      onView: (v) => { clearTimeout(A.vT); A.vT = setTimeout(() => ls.set("bdView:" + id, v), 400); },
      openPage: (it, o) => A.pw && A.pw.open(it, o),
      copyPage: (from, to) => api("/api/boards?a=copypage", { method: "POST", body: { from, to } }),
      seedPage: (pid, text) => { if (text) api("/api/boards?page=" + pid, { method: "PUT", body: { blocks: text.split(/\n+/).filter(Boolean).map((t) => ({ t: "p", h: esc(t) })), base: 0 } }); },
      pageDownload: (it, kind) => download(it, null, kind),
      unfurl: async (url) => { const r = await api("/api/boards?a=link&url=" + encodeURIComponent(url)); return r.ok ? r.data : null; },
      boardMenu: () => [{ t: "Board options", i: "settings", sub: boardMenu(b, true) }],
    });
    A.cv = cv;
    A.pw = pageWindows(pages, { canvas: () => A.cv, owner: true, removeItem: (pid) => A.cv && A.cv.removeItem(pid), boardName: () => name(A.cur), onClosed: () => A.cv && A.cv.focus() });
    // show the last copy straight away, then the server's
    const cached = ls.get("bdDoc:" + id, null), view = ls.get("bdView:" + id, null);
    if (doc) cv.load(doc, view);
    else if (cached) cv.load(cached, view);
    R.item(body, id, `${name(b)} — Boards`, mode);
    if (!doc) {
      const r = await api("/api/boards?id=" + id);
      if (A.cv !== cv) return;
      if (r.ok) {
        Object.assign(b, r.data.board);
        const sdoc = r.data.doc, newer = !cached || (sdoc.rev || 0) >= (cached.rev || 0); // never let an older copy replace a newer one this device already saw saved
        if (newer && (!cached || JSON.stringify(cached.items) !== JSON.stringify(sdoc.items) || JSON.stringify(cached.links) !== JSON.stringify(sdoc.links))) cv.load(sdoc, cv.view.z ? cv.view : view);
        if (newer) { try { if (JSON.stringify(sdoc).length < 1_500_000) ls.set("bdDoc:" + id, sdoc); } catch {} }
        drawTop();
      }
      else if (!cached) { main.querySelector(".ba-canvas").innerHTML = `<div class="ba-empty">${r.status === 0 ? "You're offline and this board hasn't been opened on this device yet." : "Could not open this board."}</div>`; return; }
    } else ls.set("bdDoc:" + id, doc);
    cv.applyPending(ls.get("bdPend:" + id, null));
    if (fresh) setTimeout(() => { title.focus(); }, 60);
    else setTimeout(() => $(".bd-stage", main)?.focus({ preventScroll: true }), 30);
  }
  function setStatus(s) {
    A.status = s; const e = $(".ba-st", main); if (!e || e.dataset.s === s) return;
    const [ic, tip] = STATUS[s] || STATUS.saved;
    e.dataset.s = s; e.dataset.tip = tip; e.setAttribute("aria-label", tip);
    e.innerHTML = I(ic, 19) + (s === "offline" ? "<span>Offline</span>" : "");
  }
  function drawTop() {
    const b = A.cur; if (!b) return; const t = $(".ba-title", main), bi = $(".ba-bi", main); if (!t) return;
    if (document.activeElement !== t) t.value = b.title || "";
    bi.innerHTML = b.icon && ICONS[b.icon] ? I(b.icon, 16) : ""; bi.style.background = b.cover ? (b.cover.k ? coverCss(b.cover) : `url('${esc(b.cover.src)}') center/cover`) : "var(--surface2)";
    document.title = `${name(b)} — Boards`;
  }

  /* ----- right-click: the canvas has its own menus; cards and rows get board menus ----- */
  window.registerCtx && window.registerCtx("boards", (el, e) => {
    const out = []; out.handled = true;
    if (el.closest(".bd-stage") && A.cv) { if (A.cv.menuAt(e) === false) { out.handled = false; return []; } return out; }
    const c = el.closest("[data-card],[data-open]");
    if (c) { const b = byId(c.dataset.card || c.dataset.open); if (b) { menu(e.clientX, e.clientY, boardMenu(b)); return out; } }
    if (el.closest(".bp-win,.ba-top input,input,textarea,[contenteditable]")) { out.handled = false; return []; }
    if (el.closest(".ba-home")) { menu(e.clientX, e.clientY, [{ head: "New board" }, ...Object.entries(T).map(([k, t]) => ({ t: t.name, i: k === "blank" ? "plus" : t.icon, run: () => newBoard(k) }))]); return out; }
    out.handled = false; return [];
  });

  /* ----- leaving: never lose a change ----- */
  const onHide = () => { if (A.pw) A.pw.beacon(); if (A.cv && A.cv.hasPending()) { const p = A.cv.pending(); if (A.cur && (p.up.length || p.del.length || p.lup.length || p.ldel.length)) api("/api/boards?id=" + A.cur.id + "&a=patch", { method: "POST", body: p, keepalive: true }); } };
  addEventListener("pagehide", onHide);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushBoard(); });
  // the window is closing: save everything, then let go
  body.__flush = async () => { await flushBoard(); setTimeout(() => { if (!body.isConnected) { removeEventListener("pagehide", onHide); closeMenu(); if (A.cv) { A.cv.destroy(); A.cv = null; } } }, 800); };

  /* ----- go ----- */
  const cachedList = ls.get("baList", null); if (cachedList) A.boards = cachedList;
  if (key) { drawSide(); openBoard(key, "replace"); load().then(drawSide); }
  else { if (cachedList) home("replace"); await load(); if (A.view === "home") home("replace"); else drawSide(); }
}
