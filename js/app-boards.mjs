// Boards: private infinite canvases for brainstorming, notes, scripts and moodboards. Owner only.
// The board list and home live here; the canvas is in board-canvas.mjs and the page windows in board-page.mjs.
import { h, $, $$, esc, api, isAdmin, toast, mobile, confirmBox } from "/js/lib.mjs";
import { R } from "/js/os-ext.mjs";
import { ICONS } from "/shared/icons.mjs";
import { createCanvas, menu, closeMenu, I, shortcuts } from "/js/board-canvas.mjs";
import { pageWindows, download, Bodies } from "/js/board-page.mjs";
import { mountDb } from "/js/board-db.mjs";
import { COVERS, coverCss, COLORS } from "/js/board-covers.mjs";
import { WS, DB, fmtDate } from "/js/ws-core.mjs";
import { mountDatabase, WI, choose, askText, iconPick } from "/js/ws-db.mjs";
import { openDoc } from "/js/ws-page.mjs";

const DB_TPL = { blank: ["Empty database", "table", "Your own columns"], tasks: ["Tasks", "checkbox", "To do, doing, done, with due dates"], content: ["Content calendar", "video", "Ideas to published, by date"], projects: ["Projects", "rocket", "Clients, deadlines and budgets"], reading: ["Library", "bookmark", "Books with covers and notes"] };

if (!document.querySelector('link[href="/css/boards.css"]')) document.head.append(h("link", { rel: "stylesheet", href: "/css/boards.css" }));

// each open tab is its own "device" for live sync
const DEV = (() => { try { let d = sessionStorage.getItem("bdDev"); if (!d) { d = Math.random().toString(36).slice(2, 12); sessionStorage.setItem("bdDev", d); } return d; } catch { return Math.random().toString(36).slice(2, 12); } })();
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
  const A = { boards: [], cur: null, cv: null, pw: null, view: "home", status: "saved", q: "", openB: new Set(ls.get("baOpenB", [])), openP: new Set(ls.get("baOpenP", [])), fetching: new Set(), hist: [] };
  const offWs = WS.on(() => { if (body.isConnected) { drawSide(); if (A.view === "home") drawHomeWs(); } });
  let sideT = 0; const sideSoon = () => { clearTimeout(sideT); sideT = setTimeout(() => { if (!side.contains(document.activeElement) || !document.activeElement.matches("input")) drawSide(); }, 250); };
  // the pages on a board, for the sidebar: from the open board, the copy kept on this device, or the server
  function pagesOf(bid) {
    let items = null;
    if (A.cur && A.cur.id === bid && A.cv) return A.cv.order().filter((x) => x.t === "page");
    const doc = ls.get("bdDoc:" + bid, null); if (doc) items = Object.values(doc.items || {});
    if (!items && !A.fetching.has(bid)) { A.fetching.add(bid); api("/api/boards?id=" + bid).then((r) => { A.fetching.delete(bid); if (r.ok) { try { ls.set("bdDoc:" + bid, r.data.doc); } catch {} drawSide(); } }); }
    return (items || []).filter((x) => x.t === "page").sort((a, b) => a.y - b.y || a.x - b.x);
  }
  R.handlers.boards = (b, k) => route(k, "replace");
  function route(k, mode) {
    const s = String(k || "").split("/");
    if (!k) return home(mode);
    if (s[0] === "page" && s[1]) return openPage(s[1], mode);
    if (s[0] === "db" && s[1]) return s[2] ? openRow(s[1], s[2], { mode }) : openDbView(s[1], { mode });
    if (s[0] === "bp" && s[1] && s[2]) return openBPage(s[1], s[2], { mode });
    if (s[0] === "notes") return openNotes();
    return openBoard(s[0], mode);
  }

  async function load() { const r = await api("/api/boards"); if (r.ok) A.boards = r.data.boards; else if (!A.boards.length) A.boards = ls.get("baList", []); if (r.ok) ls.set("baList", A.boards.map((b) => ({ ...b, preview: b.preview }))); return r.ok; }
  const live = () => A.boards.filter((b) => !b.trashed).sort((a, b) => (b.fav - a.fav) || (b.updated - a.updated));
  const found = () => { const q = A.q.trim().toLowerCase(); return q ? live().filter((b) => name(b).toLowerCase().includes(q)) : live(); };
  // the sidebar keeps the owner's own order (drag to arrange); new boards arrive at the top
  const arranged = (list) => list.slice().sort((a, b) => (a.order || 0) - (b.order || 0) || (b.created || 0) - (a.created || 0));
  const byId = (id) => A.boards.find((b) => b.id === id);

  /* ----- sidebar ----- */
  function drawSide() {
    const list = arranged(found()), bin = A.boards.filter((b) => b.trashed).length + WS.pages.filter((p) => p.trashed).length + WS.dbs.filter((d) => d.trashed).length;
    const q = A.q.trim().toLowerCase(), hit = (t) => !q || String(t || "").toLowerCase().includes(q);
    const pages = WS.pages.filter((p) => !p.trashed), dbs = WS.dbs.filter((d) => !d.trashed && hit(d.title));
    const favs = [...pages.filter((p) => p.fav).map((p) => ({ k: "page", id: p.id, t: p.title || "Untitled", i: p.icon || "file-text" })), ...WS.dbs.filter((d) => d.fav && !d.trashed).map((d) => ({ k: "db", id: d.id, t: d.title || "Untitled database", i: d.icon || "db" })), ...live().filter((b) => b.fav).map((b) => ({ k: "board", id: b.id, t: name(b), i: b.icon || "grid" }))];
    const kids = (pid) => pages.filter((p) => (p.parent || null) === pid).sort((a, b) => (a.order || 0) - (b.order || 0));
    const pageRow = (p, d = 0) => { const ch = kids(p.id), open = A.openP.has(p.id), on = A.view === "page" && A.curPage === p.id;
      if (q && !hit(p.title) && !ch.some((c) => hit(c.title))) return "";
      return `<button class="ba-row ba-pg${on ? " on" : ""}" style="--d:${d}" data-pg="${p.id}"><span class="ba-tw${open ? " open" : ""}" role="button" data-ptw="${p.id}" aria-label="${open ? "Hide" : "Show"} pages inside"${ch.length ? "" : " hidden"}>${I("chevron-right", 15)}</span><span class="ba-pi">${WI(p.icon && ICONS[p.icon] ? p.icon : "file-text", 16)}</span><span class="ba-rt">${esc(p.title || "Untitled")}</span></button>${open || q ? ch.map((c) => pageRow(c, d + 1)).join("") : ""}`; };
    side.innerHTML = `<div class="ba-sh"><button class="ba-new" data-new>${I("plus", 20)}<span>New</span></button><button class="ba-ib" data-tg title="Hide the sidebar" aria-label="Hide the sidebar">${I("panel-left", 18)}</button></div>
      <label class="ba-search">${I("search", 18)}<input type="search" placeholder="Search" aria-label="Search the workspace" autocomplete="off" value="${esc(A.q)}"></label>
      <nav class="ba-nav"><button class="ba-nv${A.view === "home" ? " on" : ""}" data-home>${I("home", 18)}<span>Home</span></button><button class="ba-nv${A.view === "notes" ? " on" : ""}" data-notes>${I("pin", 18)}<span>Notes</span></button></nav>
      <div class="ba-scroll">
      ${favs.length && !q ? `<div class="ba-sec"><span>Favourites</span></div><div class="ba-list">${favs.map((f) => `<button class="ba-row" data-fav="${f.k}:${f.id}"><span class="ba-pi">${WI(ICONS[f.i] || f.i === "db" ? f.i : "file-text", 16)}</span><span class="ba-rt">${esc(f.t)}</span></button>`).join("")}</div>` : ""}
      <div class="ba-sec"><span>Pages</span><button class="ba-sadd" data-newpage title="New page" aria-label="New page">${I("plus", 15)}</button></div>
      <div class="ba-list">${kids(null).map((p) => pageRow(p)).join("") || `<p class="ba-none">${q ? "No page matches." : "No pages yet."}</p>`}</div>
      <div class="ba-sec"><span>Databases</span><button class="ba-sadd" data-newdb title="New database" aria-label="New database">${I("plus", 15)}</button></div>
      <div class="ba-list">${dbs.map((d) => `<button class="ba-row${A.view === "db" && A.curDb === d.id ? " on" : ""}" data-db="${d.id}"><span class="ba-pi">${WI(d.icon && ICONS[d.icon] ? d.icon : "db", 16)}</span><span class="ba-rt">${esc(d.title || "Untitled database")}</span>${d.count ? `<em class="ba-n">${d.count}</em>` : ""}</button>`).join("") || `<p class="ba-none">${q ? "No database matches." : "No databases yet."}</p>`}</div>
      <div class="ba-sec"><span>Your boards</span>${live().length ? `<em>${live().length}</em>` : ""}</div>
      <div class="ba-list" role="list">${list.map((b) => `<button class="ba-row${A.cur && A.cur.id === b.id ? " on" : ""}" role="listitem" data-open="${b.id}" draggable="${A.q ? "false" : "true"}"><span class="ba-th" style="${b.cover ? `background:${coverCss(b.cover) || `url('${esc(b.cover.src || "")}') center/cover`}` : ""}">${b.icon && ICONS[b.icon] ? I(b.icon, 14) : ""}</span><span class="ba-rt">${esc(name(b))}</span>${b.fav ? `<span class="ba-fav">${I("star", 13)}</span>` : ""}<span class="ba-tw${A.openB.has(b.id) ? " open" : ""}" role="button" data-tw="${b.id}" aria-label="${A.openB.has(b.id) ? "Hide pages" : "Show pages"}" title="${A.openB.has(b.id) ? "Hide pages" : "Show pages"}">${I("chevron-right", 15)}</span></button>${A.openB.has(b.id) ? subPages(b) : ""}`).join("") || `<p class="ba-none">${A.q ? "No board matches." : "No boards yet."}</p>`}</div>
      </div>
      <nav class="ba-nav ba-nav2"><button class="ba-nv${A.view === "bin" ? " on" : ""}" data-bin>${I("trash", 18)}<span>Bin</span>${bin ? `<em>${bin}</em>` : ""}</button></nav>`;
    $("[data-tg]", side).onclick = () => toggleSide();
    const sq = $(".ba-search input", side);
    sq.oninput = () => { A.q = sq.value; const pos = sq.selectionStart; drawSide(); const n = $(".ba-search input", side); n.focus(); try { n.setSelectionRange(pos, pos); } catch {} if (A.view === "home") drawGrid(); };
    sq.onkeydown = (e) => { if (e.key === "Escape" && sq.value) { e.preventDefault(); sq.value = ""; sq.oninput(); } if (e.key === "Enter") { const f = found()[0]; if (f) openBoard(f.id); } };
    $("[data-new]", side).onclick = (e) => newMenu(e.currentTarget);
    $("[data-home]", side).onclick = () => home();
    $("[data-notes]", side).onclick = () => { openNotes(); if (mobile()) setSide(false); };
    $("[data-newpage]", side).onclick = () => newPage();
    $("[data-newdb]", side).onclick = (e) => newDbMenu(e.currentTarget);
    $$("[data-pg]", side).forEach((b) => (b.onclick = (e) => { const tw = e.target.closest("[data-ptw]"); if (tw) { e.stopPropagation(); const id = tw.dataset.ptw; A.openP.has(id) ? A.openP.delete(id) : A.openP.add(id); ls.set("baOpenP", [...A.openP]); drawSide(); return; } openPage(b.dataset.pg); if (mobile()) setSide(false); }));
    $$("[data-db]", side).forEach((b) => (b.onclick = () => { openDbView(b.dataset.db); if (mobile()) setSide(false); }));
    $$("[data-fav]", side).forEach((b) => (b.onclick = () => { const [k, id] = b.dataset.fav.split(":"); if (k === "page") openPage(id); else if (k === "db") openDbView(id); else openBoard(id); if (mobile()) setSide(false); }));
    $("[data-bin]", side).onclick = () => showBin();
    $$("[data-open]", side).forEach((b) => (b.onclick = (e) => {
      const tw = e.target.closest("[data-tw]");
      if (tw) { e.stopPropagation(); const id = tw.dataset.tw; A.openB.has(id) ? A.openB.delete(id) : A.openB.add(id); ls.set("baOpenB", [...A.openB]); drawSide(); return; }
      openBoard(b.dataset.open); if (mobile()) setSide(false);
    }));
    $$("[data-sub]", side).forEach((x) => (x.onclick = () => { openBPage(x.dataset.board, x.dataset.sub); if (mobile()) setSide(false); }));
    wireArrange();
  }
  function subPages(b) {
    const ps = pagesOf(b.id);
    return `<div class="ba-subs" role="group">${ps.map((p) => `<button class="ba-sub" data-sub="${p.id}" data-board="${b.id}">${I(p.icon && ICONS[p.icon] ? p.icon : "file-text", 15)}<span>${esc((p.title || "").trim() || "Untitled")}</span></button>`).join("") || `<p class="ba-none sm">${A.fetching.has(b.id) ? "Loading…" : "No pages yet"}</p>`}</div>`;
  }
  /* drag boards in the sidebar to put them in any order */
  function wireArrange() {
    const listEl = $(".ba-list", side); if (!listEl || A.q) return;
    let dragId = null;
    listEl.querySelectorAll("[data-open]").forEach((row) => {
      row.addEventListener("dragstart", (e) => { dragId = row.dataset.open; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragId); requestAnimationFrame(() => row.classList.add("dragging")); });
      row.addEventListener("dragend", () => { dragId = null; listEl.querySelectorAll(".dragging,.drop-b,.drop-a").forEach((x) => x.classList.remove("dragging", "drop-b", "drop-a")); });
      row.addEventListener("dragover", (e) => { if (!dragId || dragId === row.dataset.open) return; e.preventDefault(); const r = row.getBoundingClientRect(), before = e.clientY < r.top + r.height / 2; row.classList.toggle("drop-b", before); row.classList.toggle("drop-a", !before); });
      row.addEventListener("dragleave", () => row.classList.remove("drop-b", "drop-a"));
      row.addEventListener("drop", (e) => {
        e.preventDefault(); const before = row.classList.contains("drop-b"); row.classList.remove("drop-b", "drop-a"); if (!dragId || dragId === row.dataset.open) return;
        const ids = arranged(live()).map((b) => b.id).filter((id) => id !== dragId), at = ids.indexOf(row.dataset.open);
        ids.splice(before ? at : at + 1, 0, dragId);
        ids.forEach((id, i) => { const b = byId(id); if (b) b.order = i; });
        drawSide(); api("/api/boards?a=order", { method: "PUT", body: { ids } }).then((r) => { if (!r.ok) toast("Could not save the new order"); });
      });
    });
  }
  function setSide(on) { ls.set("baSide", on); root.dataset.side = on ? "on" : "off"; }
  function toggleSide() { setSide(root.dataset.side !== "on"); }
  $(".ba-scrim", root).onclick = () => setSide(false);

  /* ----- home: all boards ----- */
  async function home(mode = "push") {
    await leaveBoard();
    A.view = "home"; A.cur = null; A.where = { k: "home" }; A.hist = []; drawSide();
    const hr = new Date().getHours(), hi = hr < 5 ? "Working late" : hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
    main.innerHTML = `<div class="ba-home"><header class="ba-hh"><button class="ba-ib ba-tg2" data-tg aria-label="Show the sidebar">${I("panel-left", 18)}</button><div><h1>${hi}</h1><p>${new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}. Your pages, databases, notes and boards in one place.</p></div></header>
      <form class="wh-cap" autocomplete="off"><span class="wh-ci">${I("plus", 20)}</span><input name="t" maxlength="200" placeholder="Capture something: a page title, a task…" aria-label="Capture something"><div class="wh-cb"><button type="submit" data-to="page">${WI("file-text", 15)}<span>Page</span></button><button type="button" data-to="task">${WI("checkbox", 15)}<span>Task</span></button></div></form>
      <div class="wh-ws"></div>
      <div class="ba-gh"><h2>Start a board</h2></div>
      <section class="ba-tpl" aria-label="Start a board">${Object.entries(T).map(([k, t]) => `<button class="ba-tc" data-tpl="${k}"><span class="ba-tcv" style="background:${coverCss({ k: t.cover })}"><span class="ba-tci">${I(k === "blank" ? "plus" : t.icon, 22)}</span></span><b>${t.name}</b><small>${t.desc}</small></button>`).join("")}</section>
      <div class="ba-docs" hidden></div>
      <div class="ba-gh"><h2>Recent boards</h2><span class="ba-cnt"></span></div>
      <section class="ba-grid"></section></div>`;
    drawGrid(); drawHomeWs();
    $("[data-tg]", main).onclick = () => toggleSide();
    $$("[data-tpl]", main).forEach((b) => (b.onclick = () => newBoard(b.dataset.tpl)));
    const cap = $(".wh-cap", main), ci = cap.querySelector("input");
    cap.onsubmit = async (e) => { e.preventDefault(); const t = ci.value.trim(); if (!t) return ci.focus(); ci.value = ""; const p = await WS.newPage({ title: t }); if (p) { toast("Page made"); openPage(p.id); } };
    cap.querySelector('[data-to="task"]').onclick = async () => { const t = ci.value.trim(); if (!t) return ci.focus(); ci.value = ""; let d = WS.dbByRole("tasks"); if (!d) d = await WS.newDb({ tpl: "tasks" }); if (!d) return; await DB.open(d.id); DB.newRow(d.id, { title: t }); toast(`Added to ${d.title || "Tasks"}`); drawHomeWs(); };
    offerDocs();
    R.item(body, "", "Boards", mode);
  }
  /* ----- the workspace part of home: recent pages, databases, what is due, notes ----- */
  async function drawHomeWs() {
    const el = $(".wh-ws", main); if (!el || A.view !== "home") return;
    const pages = WS.pages.filter((p) => !p.trashed), dbs = WS.dbs.filter((d) => !d.trashed);
    // board pages, from the copies of boards kept on this device
    const bpages = []; for (const b of live()) { const d = ls.get("bdDoc:" + b.id, null); if (d) for (const it of Object.values(d.items || {})) if (it.t === "page") bpages.push({ k: "bpage", id: it.id, board: b.id, t: it.title || "Untitled", i: it.icon, ts: Math.max(it.edited || 0, it.ts || 0), sub: name(b) }); }
    const recent = [...pages.map((p) => ({ k: "page", id: p.id, t: p.title || "Untitled", i: p.icon, ts: p.updated || 0, cover: p.cover, sub: p.snip || "" })), ...bpages, ...dbs.map((d) => ({ k: "db", id: d.id, t: d.title || "Untitled database", i: d.icon || "db", ts: d.updated || 0, cover: d.cover, sub: `${d.count || 0} ${d.count === 1 ? "row" : "rows"}` }))].sort((a, b) => b.ts - a.ts).slice(0, 8);
    const tasks = WS.dbByRole("tasks"); let due = [];
    if (tasks) { const doc = DB.get(tasks.id) || (await DB.open(tasks.id)); if (doc) { const st = doc.props.find((p) => p.type === "status"), dp = doc.props.find((p) => p.type === "date"), lim = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10); due = Object.values(doc.rows).filter((r) => { const o = st && (st.opts || []).find((x) => x.id === r.v[st.id]); if (o && o.group === "done") return false; const d = dp && String(r.v[dp.id] || "").slice(0, 10); return d && d <= lim; }).sort((a, b) => String(a.v[dp.id]).localeCompare(String(b.v[dp.id]))).slice(0, 6).map((r) => ({ r, d: r.v[dp.id] })); } }
    if (!$(".wh-ws", main)) return;
    if (!A.gAsked) { A.gAsked = true; api("/api/gdata").then((r) => { if (r.ok) { A.gdata = r.data; drawHomeWs(); } }); }
    const mails = []; for (const a of Object.values((A.gdata && A.gdata.mail && A.gdata.mail.accounts) || {})) for (const m of a.msgs || []) mails.push({ ...m, acctEmail: a.email });
    mails.sort((a, b) => (b.vip - a.vip) || (b.ts - a.ts));
    if (!(window.LIVE && LIVE.notes) && !A.notesAsked) { A.notesAsked = true; api("/api/notes").then((r) => { if (r.ok && Array.isArray(r.data.notes) && window.LIVE && !LIVE.notes) { LIVE.notes = r.data.notes; drawHomeWs(); } }); }
    const notes = (window.LIVE && LIVE.notes ? LIVE.notes : []).filter((n) => !n.trashed && !n.archived).sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || (b.ts || 0) - (a.ts || 0)).slice(0, 6);
    el.innerHTML = `
      ${recent.length ? `<div class="ba-gh"><h2>Jump back in</h2></div><div class="wh-rec">${recent.map((x) => `<button class="wh-rc" data-go="${x.k}:${x.id}${x.board ? ":" + x.board : ""}"><span class="wh-rcv"${x.cover ? ` style="background:${x.cover.k ? coverCss(x.cover) : `url('${esc(x.cover.src)}') center/cover`}"` : ""}><span class="wh-rci">${WI(x.i && ICONS[x.i] ? x.i : x.k === "db" ? "db" : "file-text", 18)}</span></span><b>${esc(x.t)}</b><small>${esc(x.sub ? String(x.sub).slice(0, 80) : "")}</small><em>${ago(x.ts)}</em></button>`).join("")}</div>` : ""}
      <div class="wh-two">
        <section class="wh-card"><header><h3>${WI("checkbox", 17)}Due this week</h3>${tasks ? `<button class="wh-lk" data-go="db:${tasks.id}">Open ${esc(tasks.title || "Tasks")}</button>` : ""}</header>
          ${tasks ? (due.length ? `<ul class="wh-due">${due.map(({ r, d }) => `<li><button data-go="row:${r.id}:${tasks.id}"><span class="wh-dd${String(d).slice(0, 10) < new Date().toISOString().slice(0, 10) ? " over" : ""}">${esc(fmtDate(d, { rel: true }))}</span><span>${esc(r.title || "Untitled")}</span></button></li>`).join("")}</ul>` : `<p class="wh-empty">Nothing due in the next 7 days.</p>`) : `<p class="wh-empty">Make a Tasks database to see what's due here.</p><button class="btn tonal" data-mk="tasks">Make Tasks</button>`}</section>
        <section class="wh-card"><header><h3>${WI("mail", 17)}Important email</h3><button class="wh-lk" data-planner>Open Planner</button></header>
          ${mails.length ? `<ul class="wh-due">${mails.slice(0, 5).map((m) => `<li><a class="wh-mail" href="https://mail.google.com/mail/u/${encodeURIComponent(m.acctEmail)}/#inbox/${encodeURIComponent(m.thread)}" target="_blank" rel="noopener"><b>${esc(m.from)}</b><span>${esc(m.subj)}</span></a></li>`).join("")}</ul>` : `<p class="wh-empty">${A.gdata && (A.gdata.accounts || []).some((a) => a.mail) ? "Nothing important waiting." : "Connect Gmail in Settings → Sync to see important email here."}</p>`}</section>
        <section class="wh-card"><header><h3>${WI("pin", 17)}Notes</h3><button class="wh-lk" data-notes2>All notes</button></header>
          ${notes.length ? `<div class="wh-notes">${notes.map((n) => `<button class="wh-note" data-note="${n.id}" style="background:var(--${String(n.color || "c0").startsWith("k-") ? "keep-" + n.color.slice(2) : n.color === "c0" || !n.color ? "surface" : n.color},var(--surface))">${n.title ? `<b>${esc(n.title)}</b>` : ""}<span>${esc(String(n.kind === "list" ? (n.items || []).map((i) => (i.d ? "✓ " : "· ") + i.t).join("\n") : n.text || "").slice(0, 160))}</span></button>`).join("")}</div>` : `<p class="wh-empty">No notes yet.</p>`}</section>
      </div>
      <div class="ba-gh"><h2>Databases</h2></div>
      <div class="wh-dbs">${dbs.map((d) => `<button class="wh-db" data-go="db:${d.id}"><span class="wh-dbi">${WI(d.icon && ICONS[d.icon] ? d.icon : "db", 20)}</span><span><b>${esc(d.title || "Untitled database")}</b><small>${d.count || 0} ${d.count === 1 ? "row" : "rows"} · ${ago(d.updated)}</small></span></button>`).join("")}
        ${Object.entries(DB_TPL).filter(([k]) => !dbs.some((d) => d.role && d.role === k)).map(([k, [t, ic, sub]]) => `<button class="wh-db tpl" data-mk="${k}"><span class="wh-dbi">${WI(k === "blank" ? "plus" : ic, 20)}</span><span><b>${t}</b><small>${sub}</small></span></button>`).join("")}</div>`;
    el.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => { const [k, id, x] = b.dataset.go.split(":"); if (k === "page") openPage(id); else if (k === "db") openDbView(id); else if (k === "row") openRow(x, id); else if (k === "bpage") openBPage(x, id); }));
    el.querySelectorAll("[data-mk]").forEach((b) => (b.onclick = () => newDb(b.dataset.mk)));
    el.querySelector("[data-notes2]")?.addEventListener("click", () => openNotes());
    el.querySelector("[data-planner]")?.addEventListener("click", () => window.openApp("planner"));
    el.querySelectorAll("[data-note]").forEach((b) => (b.onclick = () => openNotes(b.dataset.note)));
  }

  /* ----- pages, databases and rows, each on their own ----- */
  const docCtx = () => ({ back: () => goBack(), home: () => home(), openPage: (id, o) => openPage(id, "push", o), openDb: (id) => openDbView(id), openRow: (db, id) => openRow(db, id), openBoard: (id, item) => (item ? openBoard(id, "push", { page: item }) : openBoard(id)), newDb: (anchor, parent) => newDbMenu(anchor, parent) });
  function remember() { if (A.view !== "home" || A.hist.length) A.hist.push(A.where || { k: "home" }); A.hist = A.hist.slice(-30); }
  function goBack() { const w = A.hist.pop(); if (!w || w.k === "home") return home(); if (w.k === "page") return openPage(w.id, "push", { noHist: true }); if (w.k === "db") return openDbView(w.id, { noHist: true }); if (w.k === "row") return openRow(w.db, w.id, { noHist: true }); if (w.k === "board") return openBoard(w.id); return home(); }
  async function openPage(id, mode = "push", o = {}) {
    if (!o.noHist) remember();
    await leaveBoard(); if (!WS.page(id)) await WS.load();
    const p = WS.page(id); if (!p) { toast("That page isn't here any more."); return home("replace"); }
    A.view = "page"; A.curPage = id; A.cur = null; A.where = { k: "page", id }; drawSide();
    main.innerHTML = `<div class="ba-doc"></div>`;
    A.docv = openDoc($(".ba-doc", main), { kind: "page", id, fresh: o.fresh }, docCtx());
    R.item(body, "page/" + id, `${p.title || "Untitled"} — Workspace`, mode);
  }
  async function openDbView(id, o = {}) {
    if (!o.noHist) remember();
    await leaveBoard(); if (!WS.db(id)) await WS.load();
    const d = WS.db(id); if (!d) { toast("That database isn't here any more."); return home("replace"); }
    A.view = "db"; A.curDb = id; A.cur = null; A.where = { k: "db", id }; drawSide();
    main.innerHTML = `<div class="ba-wdb"><div class="ba-wtop"><button class="ba-ib ba-tg2" data-tg aria-label="Show the sidebar">${I("panel-left", 18)}</button><button class="ba-ib" data-back aria-label="Back" title="Back">${WI("arrow-left", 18)}</button><span class="ba-sp"></span><button class="ba-ib" data-dbm aria-label="Database options" title="Database options">${I("more", 18)}</button></div><div class="ba-wdbh"></div></div>`;
    $("[data-tg]", main).onclick = () => toggleSide(); $("[data-back]", main).onclick = () => goBack();
    $("[data-dbm]", main).onclick = (e) => dbMenu(e.currentTarget, d);
    A.wdb = mountDatabase($(".ba-wdbh", main), { id, openRow: (rid2) => openRow(id, rid2) });
    R.item(body, "db/" + id, `${d.title || "Untitled database"} — Workspace`, o.mode || "push");
  }
  async function openRow(dbId, rowId, o = {}) {
    if (!o.noHist) remember();
    await leaveBoard(); await DB.open(dbId);
    A.view = "row"; A.cur = null; A.where = { k: "row", db: dbId, id: rowId }; drawSide();
    main.innerHTML = `<div class="ba-doc"></div>`;
    A.docv = openDoc($(".ba-doc", main), { kind: "row", db: dbId, id: rowId }, docCtx());
    const r = DB.get(dbId)?.rows[rowId];
    R.item(body, `db/${dbId}/${rowId}`, `${(r && r.title) || "Untitled"} — Workspace`, o.mode || "push");
  }
  async function openBPage(boardId, itemId, o = {}) {
    if (!o.noHist) remember();
    await leaveBoard();
    A.view = "bpage"; A.cur = null; A.where = { k: "bpage", board: boardId, id: itemId }; drawSide();
    main.innerHTML = `<div class="ba-doc"></div>`;
    A.docv = openDoc($(".ba-doc", main), { kind: "bpage", board: boardId, id: itemId }, docCtx());
    R.item(body, `bp/${boardId}/${itemId}`, "Page — Workspace", o.mode || "push");
  }
  async function openNotes(noteId) {
    remember(); await leaveBoard();
    A.view = "notes"; A.cur = null; A.where = { k: "notes" }; drawSide();
    main.innerHTML = `<div class="ba-notes"><div class="ba-wtop"><button class="ba-ib ba-tg2" data-tg aria-label="Show the sidebar">${I("panel-left", 18)}</button></div><div class="ba-nh win-body"></div></div>`;
    $("[data-tg]", main).onclick = () => toggleSide();
    const host = $(".ba-nh", main);
    const m = await import("/js/app-notes.mjs");
    await m.notesApp(host, noteId ? "" : "");
    A.notes = async () => { try { host.__flush && (await host.__flush()); } catch {} };
    if (noteId) setTimeout(() => host.querySelector(`.kn-card[data-id="${noteId}"]`)?.click(), 300);
    R.item(body, "notes", "Notes — Workspace", "push");
  }
  // the notes app inside the workspace says where it is with addresses of its own; keep them under /boards/notes
  if (!R.__wsNotes) { R.__wsNotes = true; const orig = R.item.bind(R); R.item = (b, slug, title, mode) => { const host = b && b.closest && b.closest(".ba-nh"); if (host) { const w = host.closest(".win"); return orig(w ? w.querySelector(".body") : b, "notes" + (slug ? "/" + slug : ""), title, mode); } return orig(b, slug, title, mode); }; }
  function dbMenu(anchor, d) {
    choose(anchor, [
      { t: "Rename", i: "pencil", run: () => askText(anchor, "Database name", d.title, (v) => v && WS.setDb(d.id, { title: v })) },
      { t: "Change icon", i: "smile", run: () => iconPick(anchor, d.icon, (ic) => WS.setDb(d.id, { icon: ic })) },
      { t: d.fav ? "Remove from favourites" : "Add to favourites", i: "star", run: () => WS.setDb(d.id, { fav: !d.fav }) },
      { t: "Describe it", i: "text", run: () => askText(anchor, "A short description", d.desc || "", (v) => WS.setDb(d.id, { desc: v })) },
      { t: "Download as CSV", i: "download", run: () => csv(d) },
      "-", { t: "Move to the bin", i: "trash", danger: true, run: async () => { if (await confirmBox(`Move “${d.title || "this database"}” to the bin? You can bring it back from the bin.`, "Move to bin")) { await WS.setDb(d.id, { trashed: true }); home(); } } },
    ], { w: 240 });
  }
  function csv(d) {
    const doc = DB.get(d.id); if (!doc) return;
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const name2 = (p, r) => { const v = r.v[p.id]; if (v == null) return ""; if (["select", "status"].includes(p.type)) return (p.opts.find((o) => o.id === v) || {}).name || ""; if (p.type === "multi") return v.map((x) => (p.opts.find((o) => o.id === x) || {}).name).filter(Boolean).join("; "); if (p.type === "date") return typeof v === "object" ? v.s + " → " + v.e : v; return v === true ? "yes" : v; };
    const lines = [["Name", ...doc.props.map((p) => p.name)].map(q).join(","), ...Object.values(doc.rows).map((r) => [r.title, ...doc.props.map((p) => name2(p, r))].map(q).join(","))];
    const a = h("a", { href: URL.createObjectURL(new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv" })), download: (d.title || "database").replace(/[^\w -]+/g, "") + ".csv" }); a.click();
  }
  async function newPage(parent) { const p = await WS.newPage(parent ? { parent } : {}); if (p) openPage(p.id, "push", { fresh: true }); }
  async function newDb(tpl, parent) { const m = await WS.newDb({ tpl, ...(parent ? { parent } : {}) }); if (m) openDbView(m.id); }
  function newDbMenu(anchor, parent) { choose(anchor, [{ head: "New database" }, ...Object.entries(DB_TPL).map(([k, [t, ic]]) => ({ t, i: k === "blank" ? "table" : ic, run: () => newDb(k, parent) }))], { w: 240 }); }
  function newMenu(anchor) {
    const r = anchor.getBoundingClientRect();
    menu(r.left, r.bottom + 6, [{ t: "Page", i: "page", run: () => newPage() }, { t: "Database", i: "table", sub: Object.entries(DB_TPL).map(([k, [t, ic]]) => ({ t, i: k === "blank" ? "table" : ic, run: () => newDb(k) })) }, { t: "Board", i: "frame", sub: Object.entries(T).map(([k, t]) => ({ t: t.name, i: k === "blank" ? "plus" : t.icon, run: () => newBoard(k) })) }]);
  }

  // Docs was retired: its pages are still stored, and can be copied onto a board in one go
  async function offerDocs() {
    const r = await api("/api/boards?a=docs"); const el = $(".ba-docs", main);
    if (!el || !r.ok || !r.data.count || r.data.imported) return;
    const n = r.data.count;
    el.hidden = false;
    el.innerHTML = `<span class="ba-dci">${I("file-text", 22)}</span><div><b>Your ${n} Docs page${n === 1 ? "" : "s"} can live here now</b><p>Docs has been retired. Bring its pages onto a board, where you can write in them, arrange them and see them in the Database view. Your Docs pages stay saved as they are.</p></div><button class="btn" data-imp>Bring them in</button>`;
    $("[data-imp]", el).onclick = async (e) => {
      e.currentTarget.disabled = true; e.currentTarget.textContent = "Bringing them in…";
      const x = await api("/api/boards?a=importdocs", { method: "POST", body: {} });
      if (!x.ok) { toast(x.data.error || "Could not bring them in. Try again."); e.currentTarget.disabled = false; e.currentTarget.textContent = "Bring them in"; return; }
      A.boards.push(x.data.board); toast(`${n} page${n === 1 ? "" : "s"} brought in`);
      openBoard(x.data.board.id, "push", { doc: x.data.doc });
    };
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
    const tp = WS.pages.filter((p) => p.trashed), td = WS.dbs.filter((d) => d.trashed);
    main.innerHTML = `<div class="ba-home"><header class="ba-hh"><button class="ba-ib ba-tg2" data-tg aria-label="Show the sidebar">${I("panel-left", 18)}</button><div><h1>Bin</h1><p>What you moved here. Put it back any time.</p></div></header>
      ${tp.length || td.length ? `<section class="ba-binl">${[...tp.map((p) => ({ k: "page", id: p.id, t: p.title || "Untitled", i: p.icon || "file-text" })), ...td.map((d) => ({ k: "db", id: d.id, t: d.title || "Untitled database", i: d.icon || "db" }))].map((x) => `<div class="ba-binr"><span class="ba-th">${WI(x.i, 15)}</span><b>${esc(x.t)}</b><small>${x.k === "db" ? "Database" : "Page"}</small><button class="btn tonal" data-wrs="${x.k}:${x.id}">Put back</button></div>`).join("")}</section>` : ""}
      <section class="ba-binl">${list.map((b) => `<div class="ba-binr"><span class="ba-th" style="${b.cover && b.cover.k ? `background:${coverCss(b.cover)}` : ""}"></span><b>${esc(name(b))}</b><small>${b.count || 0} items · binned ${ago(b.trashed)}</small><button class="btn tonal" data-rs="${b.id}">Restore</button><button class="btn tonal danger" data-rm="${b.id}">Delete for good</button></div>`).join("") || '<div class="ba-empty"><b>The bin is empty</b></div>'}</section></div>`;
    $("[data-tg]", main).onclick = () => toggleSide();
    $$("[data-rs]", main).forEach((b) => (b.onclick = async () => { await setMeta(byId(b.dataset.rs), { trashed: false }); showBin(); }));
    $$("[data-wrs]", main).forEach((b) => (b.onclick = async () => { const [k, id] = b.dataset.wrs.split(":"); if (k === "page") await WS.setPage(id, { trashed: false }); else await WS.setDb(id, { trashed: false }); showBin(); }));
    $$("[data-rm]", main).forEach((b) => (b.onclick = async () => {
      const bd = byId(b.dataset.rm); if (!(await confirmBox(`Delete “${name(bd)}” for good? Its pages go too. A last copy is kept in the backup store.`, "Delete"))) return;
      const r = await api("/api/boards?id=" + bd.id, { method: "DELETE" }); if (!r.ok) { toast("Could not delete"); return; }
      A.boards = A.boards.filter((x) => x.id !== bd.id); ls.del("bdDoc:" + bd.id); ls.del("bdView:" + bd.id); showBin();
    }));
    R.item(body, "", "Bin — Boards", "push");
  }

  /* ----- one board ----- */
  async function leaveBoard() {
    if (A.docv) { await A.docv.flush(); A.docv.destroy(); A.docv = null; }
    if (A.wdb) { A.wdb.destroy(); A.wdb = null; }
    if (A.notes) { try { await A.notes(); } catch {} A.notes = null; }
    if (A.stopLive) { A.stopLive(); A.stopLive = null; }
    if (!A.cv) return;
    await flushBoard();
    if (A.pw) await A.pw.closeAll();
    if (A.db) { A.db.destroy(); A.db = null; }
    A.cv.destroy(); A.cv = null; A.pw = null;
  }
  async function flushBoard() { if (A.pw) await A.pw.flushAll(); if (A.cv) await A.cv.flush(); }
  async function openBoard(id, mode = "push", { doc, fresh, page } = {}) {
    if (A.cur && A.cur.id === id && A.cv) { if (page) openInDb(page); return; }
    await leaveBoard();
    let b = byId(id);
    if (!b) { await load(); b = byId(id); }
    if (!b) { toast("That board isn't here any more."); return home("replace"); }
    A.view = "board"; A.cur = b; A.where = { k: "board", id }; drawSide();
    main.innerHTML = `<div class="ba-board"><div class="ba-canvas"></div><div class="ba-dbv"></div><div class="ba-pages"></div>
      <div class="ba-top"><button class="ba-ib" data-tg title="Show the sidebar" aria-label="Show the sidebar">${I("panel-left", 18)}</button><button class="ba-bi" data-bi title="Cover and icon" aria-label="Cover and icon"></button><input class="ba-title" maxlength="120" aria-label="Board name" placeholder="Untitled board"><span class="ba-st" role="status" tabindex="-1"></span>
        <div class="ba-seg" role="tablist" aria-label="View"><button role="tab" data-v="board" title="Board view (B)">${I("frame", 17)}<span>Board</span></button><button role="tab" data-v="db" title="Database view (D)">${I("table", 17)}<span>Database</span></button></div>
        <button class="ba-ib" data-bm title="Board options" aria-label="Board options">${I("more", 18)}</button></div></div>`;
    const cvHost = $(".ba-canvas", main), pages = $(".ba-pages", main);
    $("[data-tg]", main).onclick = () => toggleSide();
    $("[data-bm]", main).onclick = (e) => { const r = e.currentTarget.getBoundingClientRect(); menu(r.left, r.bottom + 6, boardMenu(b, true), { ret: $(".bd-stage", main) }); };
    $("[data-bi]", main).onclick = (e) => { const r = e.currentTarget.getBoundingClientRect(); menu(r.left, r.bottom + 6, [{ head: "Cover" }, { tiles: COVER_KEYS.map((k) => ({ bg: coverCss({ k }), name: COVERS[k].name, on: !!(b.cover && b.cover.k === k), run: () => setMeta(b, { cover: { k } }) })) }, { head: "Icon" }, { chips: BOARD_ICONS.map((n) => ({ i: n, title: n, on: b.icon === n, run: () => setMeta(b, { icon: n }) })) }, "-", { t: "No icon", i: "x", run: () => setMeta(b, { icon: "" }) }, { t: "No cover", i: "image", run: () => setMeta(b, { cover: null }) }], { ret: $(".bd-stage", main) }); };
    const title = $(".ba-title", main);
    title.oninput = () => { b.title = title.value; drawSide(); clearTimeout(A.tT); A.tT = setTimeout(() => setMeta(b, { title: title.value.trim().slice(0, 120) }), 700); };
    title.onkeydown = (e) => { if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); title.blur(); $(".bd-stage", main)?.focus(); } };
    drawTop(); setStatus("saved");
    const cv = createCanvas(cvHost, {
      owner: true, boardId: id, dev: DEV,
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
      editPage: (it, el, o) => (A.pw ? A.pw.inline(it, el, o) : null),
      bodies: Bodies,
      // a copy takes the writing as it is on screen now (even if it is not saved yet), shows it at once, then saves it
      copyPage: async (from, to) => {
        const live = A.pw && A.pw.liveBlocks(from), seen = Bodies.get(from), blocks = live || (seen && seen.blocks.length ? seen.blocks : null);
        if (!blocks) { await api("/api/boards?a=copypage", { method: "POST", body: { from, to } }); Bodies.refresh(to); return; }
        Bodies.set(to, blocks, 0); // shown at once; the saved time comes from the server
        const r = await api("/api/boards?page=" + to, { method: "PUT", body: { blocks, base: 0 } });
        if (r.ok) Bodies.set(to, blocks, r.data.updated || Date.now());
      },
      seedPage: (pid, text) => { if (text) api("/api/boards?page=" + pid, { method: "PUT", body: { blocks: text.split(/\n+/).filter(Boolean).map((t) => ({ t: "p", h: esc(t) })), base: 0 } }); },
      pageDownload: (it, kind) => download(it, null, kind),
      unfurl: async (url) => { const r = await api("/api/boards?a=link&url=" + encodeURIComponent(url)); return r.ok ? r.data : null; },
      boardMenu: () => [{ t: "Board options", i: "settings", sub: boardMenu(b, true) }, { t: "Database view", i: "table", k: "D", run: () => setView("db") }],
      onItems: () => { if (A.db && A.bview === "db") A.db.refresh(); if (A.openB.has(id)) sideSoon(); },
    });
    A.cv = cv;
    A.pw = pageWindows(pages, { canvas: () => A.cv, owner: true, removeItem: (pid) => A.cv && A.cv.removeItem(pid), boardName: () => name(A.cur), showOnBoard: (pid) => { setView("board"); A.cv && A.cv.focusItem(pid); },
      onClosed: (w) => { if (A.bview === "db") { A.db && A.db.refresh(); } else A.cv && A.cv.focus(); } });
    /* ----- two views of the same items: the board, and the database ----- */
    const dbHost = $(".ba-dbv", main);
    A.db = null; A.bview = null;
    function setView(v, { quiet } = {}) {
      if (v === A.bview) return; A.bview = v; ls.set("bdMode:" + id, v);
      $(".ba-board", main).dataset.v = v;
      $$(".ba-seg [data-v]", main).forEach((x) => x.setAttribute("aria-selected", String(x.dataset.v === v)));
      if (v === "db") {
        cv.setActive(false);
        if (!A.db) A.db = mountDb(dbHost, { cv: () => A.cv, board: () => A.cur, owner: true, boardId: id, bodies: Bodies, openPage: (it, o) => A.pw && A.pw.open(it, { ...(o || {}), docked: true }), showOnBoard: (pid) => { setView("board"); A.cv && A.cv.focusItem(pid); }, setTitle: (val) => { const t = $(".ba-title", main); if (t) { t.value = val; t.oninput(); } } });
        else A.db.refresh();
      } else {
        $$(".bp-win.docked", main).forEach((w) => w.querySelector('[data-a="close"]')?.click());
        cv.setActive(true); if (!quiet) setTimeout(() => cv.focus(), 30);
      }
    }
    A.setView = setView;
    function openInDb(pid) { setView("db"); const it = A.cv && A.cv.item(pid); if (it) A.pw.open(it, { docked: true }); }
    A.openInDb = openInDb;
    $$(".ba-seg [data-v]", main).forEach((x) => (x.onclick = () => setView(x.dataset.v)));
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
        if (newer && (!cached || JSON.stringify(cached.items) !== JSON.stringify(sdoc.items) || JSON.stringify(cached.links) !== JSON.stringify(sdoc.links))) cv.load(sdoc, cached ? cv.view : view); // first time on this device: no view yet, so the board is fitted to the screen
        if (newer) { try { if (JSON.stringify(sdoc).length < 1_500_000) ls.set("bdDoc:" + id, sdoc); } catch {} }
        drawTop();
      }
      else if (!cached) { main.querySelector(".ba-canvas").innerHTML = `<div class="ba-empty">${r.status === 0 ? "You're offline and this board hasn't been opened on this device yet." : "Could not open this board."}</div>`; return; }
    } else ls.set("bdDoc:" + id, doc);
    cv.applyPending(ls.get("bdPend:" + id, null));
    A.stopLive = startLive(id, cv);
    setView(page ? "db" : ls.get("bdMode:" + id, mobile() ? "db" : "board"), { quiet: true });
    if (page) openInDb(page);
    if (fresh) setTimeout(() => { title.focus(); }, 60);
    else if (A.bview === "board") setTimeout(() => $(".bd-stage", main)?.focus({ preventScroll: true }), 30);
  }
  /* ----- live sync between devices: ask for what changed since this board's revision ----- */
  // every 2.5 s while another device is editing this board; otherwise every 12 s, only while this window has focus,
  // and at once when you come back to it. Tabs you are not looking at never ask.
  function startLive(id, cv) {
    let t = 0, fastUntil = 0, inflight = false, stopped = false, cacheT = 0;
    const tick = async () => {
      clearTimeout(t); if (stopped || A.cv !== cv || document.visibilityState !== "visible") return;
      if (!inflight) {
        inflight = true;
        const r = await api(`/api/boards?id=${id}&a=since&rev=${cv.syncRev}`);
        inflight = false;
        if (stopped || A.cv !== cv) return;
        if (r.ok) {
          if (!r.data.same) {
            const res = cv.applyRemote(r.data);
            res.pages.forEach((pid) => Bodies.refresh(pid));
            if (res.n) { clearTimeout(cacheT); cacheT = setTimeout(() => { if (A.cv === cv) { try { const snap = cv.snapshot(); if (JSON.stringify(snap).length < 1_500_000) ls.set("bdDoc:" + id, snap); } catch {} } }, 1500); }
          }
          if (r.data.by && r.data.by !== DEV && r.data.now - r.data.updated < 90000) fastUntil = Date.now() + 90000;
        }
      }
      const fast = Date.now() < fastUntil;
      if (!fast && !document.hasFocus()) return; // idle and looking elsewhere: wait until you come back
      t = setTimeout(tick, fast ? 2500 : 12000);
    };
    const wake = () => { if (document.visibilityState === "visible") tick(); };
    addEventListener("focus", wake); document.addEventListener("visibilitychange", wake);
    setTimeout(tick, 1500);
    return () => { stopped = true; clearTimeout(t); clearTimeout(cacheT); removeEventListener("focus", wake); document.removeEventListener("visibilitychange", wake); };
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
    if (el.closest(".db") && A.db) { if (A.db.menuAt(e)) return out; out.handled = false; return []; }
    const pg = el.closest("[data-pg]"); if (pg) { const p = WS.page(pg.dataset.pg); if (p) menu(e.clientX, e.clientY, [{ t: "Open", i: "open", run: () => openPage(p.id) }, { t: "Page inside", i: "plus", run: () => newPage(p.id) }, { t: p.fav ? "Remove from favourites" : "Add to favourites", i: "star", run: () => WS.setPage(p.id, { fav: !p.fav }) }, { t: "Move out to the top", i: "arrow-up", disabled: !p.parent, run: () => WS.setPage(p.id, { parent: null }) }, "-", { t: "Move to the bin", i: "trash", danger: true, run: () => { WS.setPage(p.id, { trashed: true }); if (A.curPage === p.id) home(); } }]); return out; }
    const dbr = el.closest("[data-db]"); if (dbr) { const d = WS.db(dbr.dataset.db); if (d) { const r = { getBoundingClientRect: () => ({ left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY }) }; dbMenu(r, d); } return out; }
    const sub = el.closest("[data-sub]"); if (sub) { menu(e.clientX, e.clientY, [{ t: "Open as a page", i: "open", run: () => openBoard(sub.dataset.board, "push", { page: sub.dataset.sub }) }]); return out; }
    const c = el.closest("[data-card],[data-open]");
    if (c) { const b = byId(c.dataset.card || c.dataset.open); if (b) { menu(e.clientX, e.clientY, boardMenu(b)); return out; } }
    if (el.closest(".bp-win,.ba-top input,input,textarea,[contenteditable]")) { out.handled = false; return []; }
    if (el.closest(".ba-home")) { menu(e.clientX, e.clientY, [{ head: "New board" }, ...Object.entries(T).map(([k, t]) => ({ t: t.name, i: k === "blank" ? "plus" : t.icon, run: () => newBoard(k) }))]); return out; }
    out.handled = false; return [];
  });

  document.addEventListener("keydown", (e) => {
    if (!A.cv || !A.setView || e.ctrlKey || e.metaKey || e.altKey || !body.isConnected) return;
    const a = document.activeElement; if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
    if (!(a && (a.closest(".bd-stage") || a.closest(".db"))) && !(a === document.body && body.closest(".win.top"))) return;
    if (e.key === "d" || e.key === "D") { if (A.bview !== "db") { e.preventDefault(); e.stopPropagation(); A.setView("db"); } }
    else if (e.key === "b" || e.key === "B") { if (A.bview !== "board") { e.preventDefault(); e.stopPropagation(); A.setView("board"); } }
  }, true);

  /* ----- leaving: never lose a change ----- */
  const onHide = () => { if (A.pw) A.pw.beacon(); if (A.cv && A.cv.hasPending()) { const p = A.cv.pending(); if (A.cur && (p.up.length || p.del.length || p.lup.length || p.ldel.length)) api("/api/boards?id=" + A.cur.id + "&a=patch", { method: "POST", body: p, keepalive: true }); } };
  addEventListener("pagehide", onHide);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushBoard(); });
  // the window is closing: save everything, then let go
  body.__flush = async () => { await flushBoard(); setTimeout(() => { if (!body.isConnected) { removeEventListener("pagehide", onHide); closeMenu(); if (A.cv) { A.cv.destroy(); A.cv = null; } } }, 800); };

  /* ----- go ----- */
  const cachedList = ls.get("baList", null); if (cachedList) A.boards = cachedList;
  WS.load();
  if (key) { drawSide(); route(key, "replace"); load().then(drawSide); }
  else { if (cachedList) home("replace"); await load(); if (A.view === "home") home("replace"); else drawSide(); }
}
