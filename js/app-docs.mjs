// Docs: a workspace of pages inside pages, written in the same block editor as the Journal (like Notion).
// Private by default. The owner can publish a page to the web, and it then has its own address, /docs/<slug>.
import { h, $, $$, esc, api, isAdmin, toast, mobile, showBlocks, wireBlocks, makeEditor, Up, share, confirmBox, ago } from "/js/lib.mjs";
import { blocksToMd, blocksText, slugify } from "/shared/blocks.mjs";
import { R } from "/js/os-ext.mjs";
import { icon, ICONS } from "/shared/icons.mjs";
import { mountDb, TEMPLATES, setDone, dayKey } from "/js/docs-db.mjs";
const I = (n, size = 16) => icon(n, { size });
const pageIco = (p, size = 17) => I(p && p.icon && ICONS[p.icon] ? p.icon : p && p.kind === "db" ? (p.dbv === "board" ? "columns3" : p.dbv === "calendar" ? "calendar" : "table") : "file-text", size);
const TONES = ["c1", "c2", "c3", "c4", "c5", "c6"];
const tone = (p) => { let x = 0; for (const ch of String(p && p.id)) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return TONES[x % TONES.length]; };

const D = { pages: null, open: null, ed: null, saveT: null, blocks: [], status: "", loaded: false, dbc: null, dbT: null };
const CACHE = {}; // pages just made here: the server can take a moment to list them, so open them from what we sent
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const PAGE_ICONS = ["table", "columns3", "list", "home", "file-text", "file", "folder", "bookmark", "checkbox", "target", "rocket", "bulb", "star", "heart", "flame", "sparkles", "leaf", "globe", "home", "wallet", "brain", "palette", "video", "music", "camera", "laptop", "settings", "wrench", "chart", "trend", "calendar", "clock", "chat", "mail", "phone", "lock", "flask", "compass", "coffee", "plane", "trophy", "gift", "graduation", "cat", "shield", "map", "user", "pencil", "tag", "image", "table", "code"];
const GRADS = { g1: "linear-gradient(135deg,#a8e6cf,#dcedc1)", g2: "linear-gradient(135deg,#ffd3b6,#ffaaa5)", g3: "linear-gradient(135deg,#c3cfe2,#c3b1e1)", g4: "linear-gradient(135deg,#fddb92,#d1fdff)", g5: "linear-gradient(135deg,#84fab0,#8fd3f4)", g6: "linear-gradient(135deg,#fbc2eb,#a6c1ee)", g7: "linear-gradient(135deg,#cfd9df,#e2ebf0)", g8: "linear-gradient(135deg,#2e6b57,#1b3a30)" };
/* ---------- data helpers ---------- */
const live = () => (D.pages || []).filter((p) => !p.trashed);
const byId = (id) => (D.pages || []).find((p) => p.id === id);
const kids = (id) => live().filter((p) => (p.parent || null) === (id || null)).sort((a, b) => (a.order - b.order) || (a.created - b.created));
const keyOf = (p) => (p.pub && p.slug ? p.slug : "p-" + p.id);
const find = (key) => (D.pages || []).find((p) => p.slug === key && p.pub) || (D.pages || []).find((p) => "p-" + p.id === key || p.id === key);
const crumbs = (p) => { const out = []; let c = p, n = 0; while (c && n++ < 20) { out.unshift(c); c = c.parent && byId(c.parent); } return out; };
const within = (id, anc) => { let c = byId(id), n = 0; while (c && n++ < 30) { if (c.id === anc) return true; c = c.parent && byId(c.parent); } return false; };
const label = (p) => (p.title && p.title.trim()) || "Untitled";

async function load(force) {
  if (D.pages && !force) return;
  const r = await api("/api/docs");
  D.pages = r.ok ? r.data.pages : [];
  D.loaded = r.ok;
}

/* ---------- small UI helpers ---------- */
function popup(anchor, items, { align = "right" } = {}) {
  $$(".dx-pop").forEach((x) => x.remove());
  const m = h("div", { class: "dx-pop", role: "menu" }, items.map((it) => it === "-" ? h("hr") : h("button", { role: "menuitem", class: it.danger ? "danger" : "", onclick: () => { m.remove(); it.run(); } }, h("span", { class: "ic", html: it.i ? I(it.i, 17) : "" }), it.t, it.hint ? h("small", {}, it.hint) : "")));
  const host = anchor.closest(".dx") || document.body; host.append(m);
  const a = anchor.getBoundingClientRect(), r = host.getBoundingClientRect();
  m.style.top = Math.min(a.bottom - r.top + 4, r.height - m.offsetHeight - 8) + "px";
  if (align === "right") m.style.right = Math.max(8, r.right - a.right) + "px"; else m.style.left = Math.max(8, a.left - r.left) + "px";
  setTimeout(() => document.addEventListener("pointerdown", function f(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener("pointerdown", f, true); } }, true), 0);
  return m;
}
function dialog(root, title, content, { wide } = {}) {
  const d = h("div", { class: "dx-dlg" }, h("div", { class: "dx-card" + (wide ? " wide" : ""), role: "dialog", "aria-modal": "true", "aria-label": title }, h("div", { class: "dx-card-h" }, h("b", {}, title), h("button", { class: "dx-x", "aria-label": "Close", html: I("x", 16), onclick: () => d.remove() })), content));
  d.addEventListener("pointerdown", (e) => { if (e.target === d) d.remove(); });
  d.addEventListener("keydown", (e) => { if (e.key === "Escape") d.remove(); });
  root.append(d); return d;
}

/* ---------- the app ---------- */
export async function docsApp(body, slug) {
  const owner = isAdmin();
  body.classList.add("dx-body");
  body.innerHTML = `<div class="dx" data-view="list"><aside class="dx-side" aria-label="Pages"></aside><section class="dx-main" aria-live="polite"></section></div>`;
  const root = $(".dx", body), side = $(".dx-side", root), main = $(".dx-main", root);
  const open = ls.get("dxOpen", {}), q = { text: "" };
  R.handlers.docs = (b, key) => (key ? openKey(key, "replace") : home("replace"));
  body.__dx = D;

  await load(true);
  if (!D.loaded) { main.innerHTML = '<div class="dx-empty"><h2>Docs could not load</h2><p>Check your connection and try again.</p></div>'; }

  /* ----- sidebar ----- */
  function drawSide() {
    const pages = live(), trashed = (D.pages || []).filter((p) => p.trashed && !(p.parent && byId(p.parent)?.trashed));
    const tasks = pages.find((p) => p.role === "tasks"), favs = pages.filter((p) => p.fav);
    const row = (p, depth) => {
      const ch = kids(p.id), isOpen = !!open[p.id];
      const em = depth === 0 ? `<span class="dx-em dx-tile" style="--tc:var(--${tone(p)})">${pageIco(p, 15)}</span>` : `<span class="dx-em">${pageIco(p)}</span>`;
      return `<div class="dx-node"><div class="dx-it${D.open && D.open.id === p.id ? " on" : ""}" data-id="${p.id}" style="--d:${depth}" ${owner ? 'draggable="true"' : ""} role="treeitem" aria-level="${depth + 1}" ${ch.length ? `aria-expanded="${isOpen}"` : ""}>
        <button class="dx-tw${ch.length ? "" : " nokid"}" data-tw="${p.id}" aria-label="${isOpen ? "Collapse" : "Expand"}">${I("chevron-right", 14)}</button>
        <button class="dx-nm" data-go="${p.id}">${em}<span class="dx-t">${esc(label(p))}</span>${p.pub ? '<i class="dx-pubdot" title="Published"></i>' : ""}</button>
        ${owner ? `<button class="dx-add" data-add="${p.id}" aria-label="Add a page inside" title="Add a page inside">${I("plus", 15)}</button>` : ""}</div>${ch.length && isOpen ? `<div class="dx-kids" role="group">${ch.map((c) => row(c, depth + 1)).join("")}</div>` : ""}</div>`;
    };
    const ids = new Set(pages.map((p) => p.id));
    const top = owner ? kids(null) : pages.filter((p) => !p.parent || !ids.has(p.parent)).sort((a, b) => (a.order - b.order) || (a.created - b.created));
    const sec = (name, key, list, empty) => `<div class="dx-sec"><span>${name}</span>${owner ? `<button class="dx-secadd" data-newsec="${key}" aria-label="New in ${name}" title="New in ${name}">${I("plus", 15)}</button>` : ""}</div><div role="tree">${list.map((p) => row(p, 0)).join("") || `<p class="dx-none">${empty}</p>`}</div>`;
    const nav = (k, ic, t, extra = "", on = false) => `<button class="dx-home${on ? " on" : ""}" data-nav="${k}">${I(ic, 18)}<span>${t}</span>${extra}</button>`;
    const openTasks = D.agenda ? D.agenda.filter((x) => tasks && x.db === tasks.id && !x.done).length : 0;
    side.innerHTML = `<div class="dx-sh"><span class="dx-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span><b>Docs</b><button class="dx-ib dx-tg" data-tg aria-label="Hide the sidebar" title="Hide the sidebar (Ctrl+\\)">${I("panel-left", 18)}</button></div>
      <div class="dx-scroll"><nav class="dx-nav">${nav("home", "home", "Home", "", !D.open && !D.trashView)}${nav("find", "search", "Search", '<kbd>Ctrl K</kbd>')}
      ${owner ? nav("tasks", "checkbox", "Tasks", openTasks ? `<span class="dx-badge">${openTasks}</span>` : "", !!(D.open && tasks && D.open.id === tasks.id)) : ""}
      ${owner ? nav("new", "plus", "New page") : ""}</nav>
      ${owner && favs.length ? `<div class="dx-sec"><span>Favorites</span></div>${favs.map((p) => `<div class="dx-node"><div class="dx-it${D.open && D.open.id === p.id ? " on" : ""}" data-id="${p.id}" style="--d:0"><span class="dx-tw nokid"></span><button class="dx-nm" data-go="${p.id}"><span class="dx-em">${pageIco(p)}</span><span class="dx-t">${esc(label(p))}</span></button></div></div>`).join("")}` : ""}
      ${owner ? sec("Spaces", "space", top.filter((p) => p.sec === "space"), "Make a space for each part of life, like Work or Personal.") + sec("Private", "private", top.filter((p) => p.sec !== "space"), "Pages only you can see.") : sec("Published", "", top, "Nothing is published yet.")}
      ${owner ? `<div class="dx-nav dx-nav2">${nav("bin", "trash", "Bin", trashed.length ? `<span class="dx-badge muted">${trashed.length}</span>` : "", !!D.trashView)}</div>` : ""}</div>`;
    $$("[data-go]", side).forEach((b) => (b.onclick = () => openId(b.dataset.go)));
    $$("[data-tw]", side).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const id = b.dataset.tw; open[id] = !open[id]; ls.set("dxOpen", open); drawSide(); }));
    $$("[data-add]", side).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); open[b.dataset.add] = true; ls.set("dxOpen", open); newPage({ parent: b.dataset.add }); }));
    $$("[data-newsec]", side).forEach((b) => (b.onclick = () => newPage(b.dataset.newsec === "space" ? { sec: "space", icon: "folder" } : {})));
    $$("[data-nav]", side).forEach((b) => (b.onclick = () => { const k = b.dataset.nav; if (k === "home") home("push", true); else if (k === "find") findDialog(); else if (k === "tasks") openTasksDb(); else if (k === "new") newPage({}); else if (k === "bin") showTrash(); }));
    $("[data-tg]", side)?.addEventListener("click", () => toggleSide());
    if (owner) wireDrag();
  }

  function wireDrag() {
    let dragId = null;
    $$(".dx-it[draggable]", side).forEach((el) => {
      el.addEventListener("dragstart", (e) => { dragId = el.dataset.id; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragId); el.classList.add("drag"); });
      el.addEventListener("dragend", () => { dragId = null; el.classList.remove("drag"); $$(".dz-b,.dz-a,.dz-in", side).forEach((x) => x.classList.remove("dz-b", "dz-a", "dz-in")); });
      el.addEventListener("dragover", (e) => {
        if (!dragId || dragId === el.dataset.id || within(el.dataset.id, dragId)) return; e.preventDefault();
        const r = el.getBoundingClientRect(), y = (e.clientY - r.top) / r.height;
        el.classList.toggle("dz-b", y < 0.28); el.classList.toggle("dz-a", y > 0.72); el.classList.toggle("dz-in", y >= 0.28 && y <= 0.72);
      });
      el.addEventListener("dragleave", () => el.classList.remove("dz-b", "dz-a", "dz-in"));
      el.addEventListener("drop", async (e) => {
        e.preventDefault(); const mode = el.classList.contains("dz-b") ? "before" : el.classList.contains("dz-a") ? "after" : "in"; el.classList.remove("dz-b", "dz-a", "dz-in");
        if (!dragId || dragId === el.dataset.id || within(el.dataset.id, dragId)) return;
        await moveTo(dragId, el.dataset.id, mode);
      });
    });
  }
  async function moveTo(id, targetId, mode) {
    const t = byId(targetId), parent = mode === "in" ? t.id : (t.parent || null);
    let sibs = kids(parent).filter((p) => p.id !== id);
    let at = mode === "in" ? sibs.length : sibs.findIndex((p) => p.id === targetId) + (mode === "after" ? 1 : 0);
    sibs.splice(at, 0, byId(id));
    if (mode === "in") { open[t.id] = true; ls.set("dxOpen", open); }
    const jobs = [];
    sibs.forEach((p, i) => { const patch = {}; if (p.id === id && (p.parent || null) !== parent) patch.parent = parent; if ((p.order || 0) !== i || p.id === id) patch.order = i; if (Object.keys(patch).length) { Object.assign(p, patch); jobs.push(api("/api/docs?id=" + p.id, { method: "PUT", body: patch })); } });
    await Promise.all(jobs); drawSide();
  }

  /* ----- creating things ----- */
  async function newPage({ parent = null, kind = "page", db, sec, role, title = "", icon: ic = "", go = true } = {}) {
    const r = await api("/api/docs", { method: "POST", body: { title, icon: ic, parent, blocks: [], ...(kind === "db" ? { kind, db } : {}), ...(sec ? { sec } : {}), ...(role ? { role } : {}) } });
    if (!r.ok) { toast(r.data.error || "Could not create the page"); return null; }
    const pg = r.data.page; D.pages.push(pg); CACHE[pg.id] = { blocks: [], db: r.data.db };
    if (!go) { drawSide(); return pg; }
    if (mobile()) root.dataset.view = "page";
    drawSide(); await openId(pg.id, { fresh: true }); return pg;
  }
  async function ensureRole(role) {
    const ex = live().find((p) => p.role === role); if (ex) return ex;
    return role === "tasks" ? newPage({ kind: "db", db: TEMPLATES.tasks(), role, title: "Tasks", icon: "checkbox", go: false }) : newPage({ role, title: "Notes", icon: "pencil", go: false });
  }
  async function openTasksDb() { const t = await ensureRole("tasks"); if (t) openId(t.id); }
  async function newNote() { const n = await ensureRole("notes"); if (!n) return; open[n.id] = true; ls.set("dxOpen", open); newPage({ parent: n.id, icon: "pencil" }); }
  /* a task goes into the Tasks database, on the day you pick */
  async function addTask(title, day) {
    const t = await ensureRole("tasks"); if (!t) return false;
    const r = await api("/api/docs?id=" + t.id); if (!r.ok || !r.data.db) { toast("Could not reach your tasks"); return false; }
    const db = r.data.db, tc = db.cols.find((c) => c.type === "title"), sc = db.cols.find((c) => c.type === "status"), dc = db.cols.find((c) => c.id === db.dateCol) || db.cols.find((c) => c.type === "date");
    const row = { id: Math.random().toString(36).slice(2, 12), c: {}, created: Date.now(), updated: Date.now() };
    if (tc) row.c[tc.id] = title; if (sc && sc.opts[0]) row.c[sc.id] = sc.opts[0].id; if (dc && day) row.c[dc.id] = day;
    db.rows.push(row);
    const w = await api("/api/docs?id=" + t.id, { method: "PUT", body: { db, base: r.data.page.updated } });
    if (!w.ok) { toast(w.status === 409 ? "Your tasks changed somewhere else. Try again." : "Could not add the task"); return false; }
    const m = byId(t.id); if (m) Object.assign(m, w.data.page); return true;
  }
  async function toggleItem(it) {
    const r = await api("/api/docs?id=" + it.db); if (!r.ok || !r.data.db) return toast("Could not update the task");
    const row = r.data.db.rows.find((x) => x.id === it.row); if (!row) return;
    setDone(r.data.db, row, !it.done);
    const w = await api("/api/docs?id=" + it.db, { method: "PUT", body: { db: r.data.db, base: r.data.page.updated } });
    if (!w.ok) return toast("Could not update the task");
    it.done = !it.done; const m = byId(it.db); if (m) Object.assign(m, w.data.page);
  }
  function taskDialog(day) {
    const c = h("form", { class: "dx-task" }); c.innerHTML = `<input name="t" placeholder="What needs doing?" maxlength="300" aria-label="Task" autocomplete="off" required><label class="ow-f">Day<input name="d" type="date" value="${day || dayKey(new Date())}"></label><div class="dx-row"><span style="flex:1"></span><button class="btn" type="submit">Add task</button></div>`;
    const d = dialog(root, "New task", c); setTimeout(() => c.t.focus(), 30);
    c.onsubmit = async (e) => { e.preventDefault(); const v = c.t.value.trim(); if (!v) return; c.querySelector("button").disabled = true; if (await addTask(v, c.d.value)) { d.remove(); toast("Task added"); await refreshAgenda(); } else c.querySelector("button").disabled = false; };
  }
  async function refreshAgenda() { if (!owner) return; const r = await api("/api/docs?a=agenda"); D.agenda = r.ok ? r.data.items : []; if (!D.open && $(".dxh", main)) { drawRail(); drawViews(); drawRecent(); } drawSide(); }

  /* ----- search everything by title ----- */
  function findDialog() {
    const c = h("div", { class: "dx-find" }); c.innerHTML = `<label class="dx-fq">${I("search", 18)}<input type="search" placeholder="Search pages and databases" aria-label="Search" autocomplete="off"></label><div class="dx-fr" role="listbox"></div>`;
    const d = dialog(root, "Search", c, { wide: true }); d.classList.add("dx-findd");
    const inp = $("input", c), out = $(".dx-fr", c); let sel = 0, res = [];
    const draw = () => {
      const q = inp.value.trim().toLowerCase();
      res = live().filter((p) => !q || label(p).toLowerCase().includes(q) || (p.desc || "").toLowerCase().includes(q)).sort((a, b) => b.updated - a.updated).slice(0, 30);
      if (sel >= res.length) sel = 0;
      out.innerHTML = res.map((p, i) => `<button role="option" data-go="${p.id}" class="${i === sel ? "on" : ""}" aria-selected="${i === sel}"><span class="dx-em dx-tile" style="--tc:var(--${tone(crumbs(p)[0])})">${pageIco(p, 15)}</span><span class="dx-ft"><b>${esc(label(p))}</b><small>${crumbs(p).slice(0, -1).map((x) => esc(label(x))).join(" / ") || (p.kind === "db" ? "Database" : "Page")}</small></span><small>${ago(p.updated)}</small></button>`).join("") || '<p class="dx-none">Nothing matches.</p>';
      $$("[data-go]", out).forEach((b) => (b.onclick = () => { d.remove(); openId(b.dataset.go); }));
    };
    inp.oninput = () => { sel = 0; draw(); };
    inp.onkeydown = (e) => { if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(res.length - 1, sel + 1); draw(); } else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); } else if (e.key === "Enter" && res[sel]) { d.remove(); openId(res[sel].id); } };
    draw(); setTimeout(() => inp.focus(), 30);
  }

  /* ----- home ----- */
  const HS = { filter: "all", day: dayKey(new Date()), month: null };
  const COVER = `<svg viewBox="0 0 1200 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="1200" height="260" fill="var(--dxh-bg)"/><path d="M-40 260 L-40 40 Q-40 -20 30 -20 L560 -20 Q470 60 420 160 Q370 260 300 260Z" fill="#3B6FE0"/><path d="M380 260 C420 120 520 40 640 -20 L700 -20 C640 60 560 150 540 260Z" fill="var(--dxh-bg2)"/><circle cx="770" cy="175" r="120" fill="#E5482F"/><path d="M1000 -30 L1240 -30 L1240 180 Q1150 200 1110 120 Z" fill="#F2B53A"/><path d="M960 -20 Q1040 0 1110 120 Q1150 200 1240 180 L1240 260 L1060 260 Q980 140 960 -20Z" fill="#F2B53A" opacity=".85"/><circle cx="910" cy="275" r="58" fill="#2F9E55"/></svg>`;
  const HOME_ART = `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 30 32 9l24 21" fill="none" stroke="#E5482F" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 29v23a4 4 0 0 0 4 4h26a4 4 0 0 0 4-4V29L32 14z" fill="var(--dxh-house)"/><rect x="26" y="38" width="12" height="18" rx="3" fill="#3B6FE0"/></svg>`;
  const QUICK = [["page", "New page", "file-text", "blue"], ["task", "New task", "checkbox", "blue"], ["note", "New note", "pencil", "yellow"], ["db", "New database", "table", "green"], ["board", "New board", "columns3", "orange"]];
  function homeGreeting() { const hr = new Date().getHours(); return hr < 5 ? "Working late." : hr < 12 ? "Good morning. A place for everything that matters." : hr < 17 ? "Good afternoon. A place for everything that matters." : "Good evening. A place for everything that matters."; }
  async function home(mode = "push", show) {
    await flush(); D.open = null; D.trashView = false; root.dataset.view = mobile() && show ? "page" : "list"; drawSide();
    const top = `<div class="dx-top"><button class="dx-back" data-back aria-label="Back to pages">${I("chevron-left", 20)}</button><button class="dx-ib dx-tg" data-tg aria-label="Show the sidebar" title="Show the sidebar">${I("panel-left", 18)}</button><nav class="dx-crumbs"><button aria-current="page"><span class="dx-cic">${I("home", 15)}</span>Home</button></nav><span class="dx-st"></span><button class="dx-b icon" data-find aria-label="Search" title="Search (Ctrl+K)">${I("search", 18)}</button></div>`;
    if (!owner) {
      const pub = live().sort((a, b) => b.updated - a.updated);
      main.innerHTML = `${top}<div class="dx-scrollmain"><div class="dxh solo"><div class="dxh-main"><div class="dxh-cover">${COVER}</div><div class="dxh-head"><span class="dxh-ic">${HOME_ART}</span><div><h1>Docs</h1><p>Guides and write-ups published by ${esc(typeof P !== "undefined" && P.name ? P.name : "the owner")}.</p></div></div>
        <div class="dxh-sec"><h2>Pages</h2></div><div class="dxh-recent">${pub.map(recentRow).join("") || '<p class="dx-none">Nothing is published yet.</p>'}</div></div></div></div>`;
    } else {
      main.innerHTML = `${top}<div class="dx-scrollmain"><div class="dxh"><div class="dxh-main"><div class="dxh-cover">${COVER}</div>
        <div class="dxh-head"><span class="dxh-ic">${HOME_ART}</span><div><h1>Home</h1><p>${homeGreeting()}</p></div></div>
        <div class="dxh-quick">${QUICK.map(([k, t, ic, c]) => `<button data-q="${k}"><span class="qi q-${c}">${I(ic, 18)}</span><span>${t}</span></button>`).join("")}</div>
        <div class="dxh-sec"><h2>Quick views</h2></div><div class="dxh-views"></div>
        <div class="dxh-sec"><h2>Recent</h2></div><div class="dxh-chips" role="tablist">${[["all", "All"], ["page", "Pages"], ["db", "Databases"], ["board", "Boards"], ["fav", "Favorites"]].map(([k, t]) => `<button role="tab" data-f="${k}" aria-selected="${HS.filter === k}" class="${HS.filter === k ? "on" : ""}">${t}</button>`).join("")}</div><div class="dxh-recent"></div></div>
        <aside class="dxh-rail" aria-label="Calendar, today and pinned"><div class="dxh-cal"></div><div class="dxh-today"></div><div class="dxh-pins"></div></aside></div></div>`;
      $$("[data-q]", main).forEach((b) => (b.onclick = () => { const k = b.dataset.q; if (k === "page") newPage({}); else if (k === "task") taskDialog(HS.day); else if (k === "note") newNote(); else if (k === "db") newPage({ kind: "db", db: TEMPLATES.table(), icon: "table" }); else if (k === "board") newPage({ kind: "db", db: TEMPLATES.board(), icon: "columns3" }); }));
      $$("[data-f]", main).forEach((b) => (b.onclick = () => { HS.filter = b.dataset.f; $$("[data-f]", main).forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-selected", String(x === b)); }); drawRecent(); }));
      drawRecent(); drawViews(); drawRail();
      refreshAgenda();
    }
    wireRecent(main);
    $("[data-back]", main).onclick = () => { root.dataset.view = "list"; };
    $("[data-tg]", main)?.addEventListener("click", () => toggleSide());
    $("[data-find]", main)?.addEventListener("click", findDialog);
    R.item(body, "", "Docs — Rohan Kumar", mode); document.title = "Docs";
  }
  function recentRow(p) {
    const rootP = crumbs(p)[0], kind = p.kind === "db" ? (p.dbv === "board" ? "board" : "db") : "page";
    return `<div class="dxr" data-id="${p.id}"><button class="dxr-m" data-go="${p.id}"><span class="dxr-i k-${kind}">${pageIco(p, 17)}</span><span class="dxr-t">${esc(label(p))}</span><span class="dxr-a">Edited ${ago(p.updated)}</span>${rootP && rootP.id !== p.id ? `<span class="dxr-s" style="--tc:var(--${tone(rootP)})">${esc(label(rootP))}</span>` : `<span class="dxr-s none"></span>`}</button>${owner ? `<button class="dxr-x" data-more="${p.id}" aria-label="More">${I("more", 17)}</button>` : ""}</div>`;
  }
  function drawRecent() {
    const el = $(".dxh-recent", main); if (!el) return; const f = HS.filter;
    const list = live().filter((p) => p.role !== "notes" || kids(p.id).length === 0).filter((p) => f === "all" || (f === "page" && p.kind !== "db") || (f === "db" && p.kind === "db") || (f === "board" && p.kind === "db" && p.dbv === "board") || (f === "fav" && p.fav)).sort((a, b) => b.updated - a.updated).slice(0, 14);
    el.innerHTML = list.map(recentRow).join("") || `<p class="dx-none">${f === "fav" ? "Star a page to see it here." : "Nothing here yet."}</p>`;
    wireRecent(el);
  }
  function wireRecent(el) {
    $$("[data-go]", el).forEach((b) => (b.onclick = () => openId(b.dataset.go)));
    $$("[data-more]", el).forEach((b) => (b.onclick = () => { const p = byId(b.dataset.more); popup(b, [
      { t: "Open", i: "panel-left", run: () => openId(p.id) },
      { t: p.fav ? "Remove from favorites" : "Add to favorites", i: "star", run: async () => { p.fav = !p.fav; await api("/api/docs?id=" + p.id, { method: "PUT", body: { fav: p.fav } }); drawSide(); drawRecent(); drawRail(); drawViews(); } },
      { t: "Duplicate", i: "copy", run: () => duplicate(p) },
      "-", { t: "Move to bin", i: "trash", danger: true, run: async () => { const r = await api("/api/docs?id=" + p.id, { method: "PUT", body: { trashed: true } }); if (r.ok) { await load(true); toast("Moved to the bin"); drawSide(); drawRecent(); drawViews(); drawRail(); } } },
    ]); }));
  }
  async function duplicate(p) {
    await flush(); const r0 = await api("/api/docs?id=" + p.id); if (!r0.ok) return toast("Could not copy");
    const r = await api("/api/docs", { method: "POST", body: { title: label(p) + " (copy)", icon: p.icon, parent: p.parent, cover: p.cover, blocks: r0.data.blocks || [], ...(p.kind === "db" ? { kind: "db", db: r0.data.db } : {}), ...(p.sec === "space" && !p.parent ? { sec: "space" } : {}) } });
    if (r.ok) { D.pages.push(r.data.page); CACHE[r.data.page.id] = { blocks: r.data.blocks || [], db: r.data.db }; drawSide(); openId(r.data.page.id); }
  }
  function drawViews() {
    const el = $(".dxh-views", main); if (!el) return;
    const ag = D.agenda || [], today = dayKey(new Date()), wk = dayKey(new Date(Date.now() + 6 * 864e5)), t = live().find((p) => p.role === "tasks"), n = live().find((p) => p.role === "notes");
    const due = ag.filter((x) => !x.done && x.date >= today && x.date <= wk).length, late = ag.filter((x) => !x.done && x.date < today).length;
    const cards = [
      ["tasks", "Tasks", "checkbox", "blue", t ? `${due} due this week${late ? ` · ${late} late` : ""}` : "Plan your days"],
      ["notes", "Notes", "pencil", "yellow", n ? `${kids(n.id).length} notes` : "Jot things down"],
      ["dbs", "Databases", "table", "green", `${live().filter((p) => p.kind === "db").length} databases`],
      ["favs", "Favorites", "star", "purple", `${live().filter((p) => p.fav).length} starred`],
    ];
    el.innerHTML = cards.map(([k, tt, ic, c, sub]) => `<button class="dxv" data-v="${k}"><span class="qi q-${c}">${I(ic, 18)}</span><span class="dxv-t"><b>${tt}</b><small>${sub}</small></span>${I("chevron-right", 16)}</button>`).join("");
    $$("[data-v]", el).forEach((b) => (b.onclick = () => { const k = b.dataset.v; if (k === "tasks") openTasksDb(); else if (k === "notes") { const nn = live().find((p) => p.role === "notes"); nn ? openId(nn.id) : newNote(); } else { HS.filter = k === "dbs" ? "db" : "fav"; $$("[data-f]", main).forEach((x) => { const on = x.dataset.f === HS.filter; x.classList.toggle("on", on); x.setAttribute("aria-selected", String(on)); }); drawRecent(); $(".dxh-chips", main)?.scrollIntoView({ behavior: "smooth", block: "start" }); } }));
  }
  function drawRail() {
    const cal = $(".dxh-cal", main), td = $(".dxh-today", main), pins = $(".dxh-pins", main); if (!cal) return;
    const now = new Date(), m0 = HS.month || new Date(now.getFullYear(), now.getMonth(), 1), ag = D.agenda || [];
    const first = (m0.getDay() + 6) % 7, days = new Date(m0.getFullYear(), m0.getMonth() + 1, 0).getDate(), today = dayKey(now);
    const has = new Set(ag.filter((x) => !x.done).map((x) => x.date));
    let cells = ""; for (let i = 0; i < first; i++) cells += "<span></span>";
    for (let d = 1; d <= days; d++) { const k = dayKey(new Date(m0.getFullYear(), m0.getMonth(), d)); cells += `<button data-day="${k}" class="${k === HS.day ? "sel" : ""}${k === today ? " today" : ""}" aria-label="${k}" aria-pressed="${k === HS.day}">${d}${has.has(k) ? "<i></i>" : ""}</button>`; }
    cal.innerHTML = `<div class="dxc-h"><b>${m0.toLocaleDateString([], { month: "long", year: "numeric" })}</b><button class="dx-b icon" data-cm="-1" aria-label="Previous month">${I("chevron-left", 17)}</button><button class="dx-b icon" data-cm="1" aria-label="Next month">${I("chevron-right", 17)}</button></div><div class="dxc-g">${["M", "T", "W", "T", "F", "S", "S"].map((x) => `<small>${x}</small>`).join("")}${cells}</div>`;
    $$("[data-cm]", cal).forEach((b) => (b.onclick = () => { HS.month = new Date(m0.getFullYear(), m0.getMonth() + +b.dataset.cm, 1); drawRail(); }));
    $$("[data-day]", cal).forEach((b) => (b.onclick = () => { HS.day = b.dataset.day; drawRail(); }));
    const items = ag.filter((x) => x.date === HS.day).sort((a, b) => a.done - b.done);
    const late = HS.day === today ? ag.filter((x) => !x.done && x.date < today) : [];
    const name = HS.day === today ? "Today" : new Date(HS.day + "T12:00").toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });
    const li = (x) => `<label class="dxt${x.done ? " done" : ""}"><input type="checkbox" ${x.done ? "checked" : ""} data-db="${x.db}" data-row="${x.row}"><span>${esc(x.title || "Untitled")}</span>${x.date !== HS.day ? `<small class="late">${new Date(x.date + "T12:00").toLocaleDateString([], { day: "numeric", month: "short" })}</small>` : `<small>${esc(label(byId(x.db) || {}))}</small>`}</label>`;
    td.innerHTML = `<div class="dxh-rh"><h3>${name}</h3><button class="dx-b icon" data-addt aria-label="Add a task" title="Add a task">${I("plus", 18)}</button></div>${items.map(li).join("")}${late.map(li).join("")}${!items.length && !late.length ? `<p class="dx-none">${D.agenda ? "Nothing planned." : "Loading…"}</p>` : ""}`;
    $("[data-addt]", td).onclick = () => taskDialog(HS.day);
    $$("input[data-row]", td).forEach((c) => (c.onchange = async () => { const it = ag.find((x) => x.db === c.dataset.db && x.row === c.dataset.row); if (!it) return; c.disabled = true; await toggleItem(it); drawRail(); drawViews(); drawSide(); }));
    const favs = live().filter((p) => p.fav).slice(0, 8);
    pins.innerHTML = `<div class="dxh-rh"><h3>Pinned</h3></div>${favs.map((p) => `<button class="dxp" data-go="${p.id}"><span class="dxp-th" style="${p.cover && p.cover.grad ? `background:${GRADS[p.cover.grad]}` : `--tc:var(--${tone(p)})`}">${p.cover && p.cover.src ? `<img src="${esc(p.cover.src)}" alt="" loading="lazy">` : p.cover && p.cover.grad ? "" : pageIco(p, 18)}</span><span>${esc(label(p))}</span></button>`).join("") || '<p class="dx-none">Star a page to pin it here.</p>'}`;
    $$("[data-go]", pins).forEach((b) => (b.onclick = () => openId(b.dataset.go)));
  }
  function openKey(key, mode) { const p = find(key); if (p) return openId(p.id, { mode }); toast("That page isn't available."); return home(mode); }

  async function openId(id, { mode = "push", fresh } = {}) {
    await flush();
    const meta = byId(id); if (!meta) return home(mode);
    let blocks, db = null;
    if (CACHE[id]) { blocks = CACHE[id].blocks; db = CACHE[id].db || null; }
    else { const r = await api("/api/docs?id=" + id); if (!r.ok) { toast(r.status === 404 ? "That page isn't available." : "Could not open the page"); return home(mode); } blocks = r.data.blocks; db = r.data.db || null; if (r.data.page) Object.assign(meta, r.data.page); }
    const isDb = meta.kind === "db";
    if (isDb && owner && !meta.trashed) { const dd = dbDraftRead(id); // a table edit that never reached the server
      if (dd && JSON.stringify(dd.db) !== JSON.stringify(db)) { if ((meta.updated || 0) <= (dd.base || 0)) { db = dd.db; D.dbRecovered = true; } else { await api("/api/docs", { method: "POST", body: { kind: "db", title: label(meta) + " (my edit)", parent: meta.parent || null, db: dd.db } }); dbDraftClear(); await load(true); toast("Changes that were not saved are kept as a separate database."); } }
      else if (dd) dbDraftClear(); }
    delete CACHE[id];
    let recovered = false; { const dr = owner && !meta.trashed && !isDb ? draftRead(id) : null;
      if (dr && Array.isArray(dr.blocks) && JSON.stringify(dr.blocks) !== JSON.stringify(blocks)) {
        if ((meta.updated || 0) <= (dr.base || 0)) { blocks = dr.blocks; if (dr.title != null) meta.title = dr.title; recovered = true; } // nothing newer was saved since: carry on from the draft
        else { await api("/api/docs", { method: "POST", body: { title: (dr.title || "Untitled") + " (my edit)", parent: meta.parent || null, blocks: dr.blocks } }); draftClear(); await load(true); drawSide(); toast("Text that was not saved is kept as a separate page."); } // the page changed meanwhile: keep both
      } else if (dr) draftClear(); }
    D.open = { ...meta }; D.blocks = blocks; D.status = ""; D.trashView = false;
    root.dataset.view = "page"; drawSide();
    const editable = owner && !meta.trashed;
    main.innerHTML = `<div class="dx-top"><button class="dx-back" data-back aria-label="Back to pages">${I("chevron-left", 20)}</button><button class="dx-ib dx-tg" data-tg aria-label="Show the sidebar" title="Show the sidebar (Ctrl+\\)">${I("panel-left", 18)}</button><nav class="dx-crumbs" aria-label="Breadcrumb"></nav><span class="dx-st"></span>
        ${editable ? `<button class="dx-b" data-share>Share</button><button class="dx-b icon" data-menu aria-label="More" title="More">${I("more", 18)}</button>` : `<button class="dx-b" data-copy>Copy link</button><button class="dx-b icon" data-pdf aria-label="Save as PDF" title="Save as PDF">${I("download", 18)}</button>`}</div>
      <div class="dx-scrollmain"><div class="dx-page${isDb ? " db" : ls.get("dxWide", false) ? " wide" : ""}"><div class="dx-cover" data-cover></div>
        <div class="dx-head"><button class="dx-icon" data-icon aria-label="Page icon"></button>${editable ? '<div class="dx-adds"></div>' : ""}<textarea class="dx-title" rows="1" placeholder="Untitled" maxlength="160" aria-label="Page title" ${editable ? "" : "readonly"}></textarea></div>
        ${isDb ? '<div class="dx-dbhost"></div>' : '<div class="dx-body"></div><div class="dx-subs"></div><footer class="dx-foot"></footer>'}</div></div>`;
    const title = $(".dx-title", main), host = $(".dx-body", main) || $(".dx-dbhost", main);
    title.value = meta.title || "";
    const fit = () => { title.style.height = "auto"; title.style.height = title.scrollHeight + "px"; };
    setTimeout(fit, 0); title.addEventListener("input", () => { fit(); D.open.title = title.value; const m = byId(id); if (m) m.title = title.value; touch(); drawCrumbs(); const t = $(`.dx-it[data-id="${id}"] .dx-t`, side); if (t) t.textContent = label(D.open); });
    title.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); D.ed && D.ed.focus("start"); } });
    $("[data-back]", main).onclick = () => { home(); };
    $("[data-tg]", main).onclick = () => toggleSide();
    $("[data-pdf]", main)?.addEventListener("click", () => exportPdf());
    drawCrumbs(); drawCover(); drawIcon(); drawAdds(); drawSubs(); drawFoot();
    if (isDb) {
      D.dbc = mountDb(host, { db, owner: editable, onChange: () => touchDb() });
      if (fresh || !meta.title) setTimeout(() => title.focus(), 50);
      if (D.dbRecovered) { D.dbRecovered = false; toast("Recovered changes that were not saved yet."); touchDb(); }
    } else if (editable) {
      D.ed = await makeEditor(host, { blocks: D.blocks, placeholder: "Type '/' for blocks, or just start writing…", onChange: () => { touch(); drawFoot(); }, onStatus: (s) => { if (s) setStatus(s); } });
      if (fresh || !meta.title) setTimeout(() => title.focus(), 50);
      if (recovered) { toast("Recovered text that was not saved yet."); touch(true); }
    } else { showBlocks(host, D.blocks); wireBlocks(host); }
    R.item(body, keyOf(meta), `${label(meta)} — Docs`, mode);
    wireTop(editable);
    document.title = `${label(meta)} — Docs`;
  }

  function drawCrumbs() {
    const c = $(".dx-crumbs", main); if (!c || !D.open) return;
    c.innerHTML = crumbs(D.open).map((p, i, a) => `${i ? `<span class="sep">${I("chevron-right", 13)}</span>` : ""}<button data-go="${p.id}"${i === a.length - 1 ? ' aria-current="page"' : ""}><span class="dx-cic">${pageIco(p, 15)}</span>${esc(label(p))}</button>`).join("");
    $$("[data-go]", c).forEach((b) => (b.onclick = () => openId(b.dataset.go)));
  }
  function drawIcon() {
    const b = $("[data-icon]", main); if (!b) return; const ic = D.open.icon;
    b.innerHTML = ic && ICONS[ic] ? I(ic, 44) : ""; b.classList.toggle("empty", !(ic && ICONS[ic]));
    b.onclick = () => { if (owner) iconPicker(b); };
  }
  function drawAdds() {
    const el = $(".dx-adds", main); if (!el || !D.open) return;
    el.innerHTML = `${D.open.icon && ICONS[D.open.icon] ? "" : `<button data-ai>${I("smile", 15)}Add icon</button>`}${D.open.cover ? "" : `<button data-ac>${I("image", 15)}Add cover</button>`}`;
    $("[data-ai]", el)?.addEventListener("click", (e) => iconPicker(e.currentTarget));
    $("[data-ac]", el)?.addEventListener("click", (e) => coverPicker(e.currentTarget));
  }
  function iconPicker(anchor) {
    const m = popup(anchor, [], { align: "left" }); m.classList.add("dx-emoji");
    const draw = (qx = "") => {
      const list = PAGE_ICONS.filter((e) => !qx || e.replace(/-/g, " ").includes(qx.toLowerCase()));
      $(".dx-eg", m).innerHTML = list.map((e) => `<button data-e="${e}" aria-label="${e.replace(/-/g, " ")}" title="${e.replace(/-/g, " ")}">${I(e, 20)}</button>`).join("") || '<p class="hint" style="grid-column:1/-1;margin:6px">No icon matches.</p>';
      $$("[data-e]", m).forEach((b) => (b.onclick = () => set(b.dataset.e)));
    };
    m.innerHTML = `<input class="dx-isr" type="search" placeholder="Search icons" aria-label="Search icons" autocomplete="off"><div class="dx-eg"></div><div class="dx-er"><button data-rm>Remove icon</button></div>`;
    const set = (v) => { D.open.icon = v; const mm = byId(D.open.id); if (mm) mm.icon = v; m.remove(); drawIcon(); drawAdds(); drawCrumbs(); drawSide(); touch(true); };
    draw(); $(".dx-isr", m).oninput = (e) => draw(e.target.value.trim()); $("[data-rm]", m).onclick = () => set("");
    setTimeout(() => $(".dx-isr", m)?.focus(), 30);
  }
  function coverPicker(anchor) {
    const m = popup(anchor, [], { align: "left" }); m.classList.add("dx-coverpick");
    m.innerHTML = `<div class="dx-gr">${Object.keys(GRADS).map((g) => `<button data-g="${g}" style="background:${GRADS[g]}" aria-label="Colour ${g}"></button>`).join("")}</div><button class="dx-up" data-up>${I("upload", 16)}<span>Upload a picture</span></button>`;
    $$("[data-g]", m).forEach((x) => (x.onclick = () => { D.open.cover = { grad: x.dataset.g }; m.remove(); drawCover(); drawAdds(); touch(true); }));
    $("[data-up]", m).onclick = async () => { m.remove(); try { const f = (await Up.pick("image/*"))[0]; if (!f) return; setStatus("Uploading…"); const r = await Up.image(f); D.open.cover = { src: r.url, fy: 50 }; drawCover(); drawAdds(); touch(true); } catch (e) { toast(e.message || "Upload failed"); } };
  }
  function drawCover() {
    const el = $("[data-cover]", main); if (!el || !D.open) return; const c = D.open.cover;
    el.className = "dx-cover" + (c ? " has" : "");
    el.style.background = c && c.grad ? GRADS[c.grad] : "";
    el.innerHTML = c && c.src ? `<img src="${esc(c.src)}" alt="" draggable="false" style="object-position:50% ${c.fy ?? 50}%">` : "";
    if (!owner || !c) return;
    el.insertAdjacentHTML("beforeend", `<div class="dx-cb">${c.src ? '<button data-c="pos">Reposition</button>' : ""}<button data-c="change">Change cover</button><button data-c="remove">Remove</button></div>`);
    $$("[data-c]", el).forEach((b) => (b.onclick = () => {
      const a = b.dataset.c;
      if (a === "remove") { D.open.cover = null; drawCover(); drawAdds(); touch(true); return; }
      if (a === "change") { coverPicker(b); return; }
      /* reposition: drag the picture up or down, then press Done */
      el.classList.add("repos"); const img = $("img", el), bar = $(".dx-cb", el); bar.innerHTML = '<button data-done>Done</button>';
      let y0 = null, fy0 = c.fy ?? 50;
      const down = (e) => { y0 = e.clientY; fy0 = c.fy ?? 50; el.setPointerCapture(e.pointerId); };
      const move = (e) => { if (y0 == null) return; const h = el.getBoundingClientRect().height || 200; c.fy = Math.max(0, Math.min(100, fy0 - ((e.clientY - y0) / h) * 120)); img.style.objectPosition = `50% ${c.fy}%`; };
      const up = () => { y0 = null; };
      el.addEventListener("pointerdown", down); el.addEventListener("pointermove", move); el.addEventListener("pointerup", up);
      $("[data-done]", bar).onclick = (ev) => { ev.stopPropagation(); el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); touch(true); drawCover(); };
    }));
  }
  function drawSubs() {
    const el = $(".dx-subs", main); if (!el || !D.open) return; const ch = kids(D.open.id);
    el.innerHTML = `${ch.length ? `<h3>Pages inside</h3><div class="dx-recent">${ch.map((p) => `<button data-go="${p.id}"><span class="dx-em">${pageIco(p)}</span><b>${esc(label(p))}</b><small>${ago(p.updated)}</small></button>`).join("")}</div>` : ""}${owner && !D.open.trashed ? `<button class="dx-addsub" data-sub>${I("plus", 16)}<span>Add a page inside</span></button>` : ""}`;
    $$("[data-go]", el).forEach((b) => (b.onclick = () => openId(b.dataset.go)));
    $("[data-sub]", el)?.addEventListener("click", () => { open[D.open.id] = true; ls.set("dxOpen", open); newPage({ parent: D.open.id }); });
  }
  function drawFoot() {
    const el = $(".dx-foot", main); if (!el || !D.open) return;
    const bl = D.ed ? D.ed.getBlocks() : D.blocks, words = (blocksText(bl, " ").match(/\S+/g) || []).length;
    el.textContent = `${words} word${words === 1 ? "" : "s"} · ${Math.max(1, Math.round(words / 220))} min read${D.open.updated ? " · Edited " + ago(D.open.updated) : ""}`;
  }
  function setStatus(s) { D.status = s; const e = $(".dx-st", main); if (e) e.textContent = s; }

  /* ----- sidebar: hide it for more room (remembered) ----- */
  const applySide = () => { root.dataset.side = ls.get("dxSide", true) ? "on" : "off"; };
  function toggleSide() { ls.set("dxSide", !ls.get("dxSide", true)); applySide(); }
  applySide();

  /* ----- save as PDF: print only this page (title, cover, text), so the browser's "Save as PDF" gets a clean document ----- */
  async function exportPdf() {
    if (!D.open) return; const p = D.open;
    const blocksNow = D.ed ? D.ed.getBlocks() : D.blocks;
    const c = h("div", { id: "print-one" });
    const cov = p.cover && p.cover.src ? `<img src="${esc(p.cover.src)}" alt="" style="width:100%;max-height:220px;object-fit:cover;border-radius:10px;margin-bottom:14px">` : "";
    c.innerHTML = `${cov}<h1>${esc(label(p))}</h1><div class="bk-doc"></div>`;
    showBlocks($(".bk-doc", c), blocksNow);
    document.body.append(c); document.body.classList.add("print-one");
    const imgs = $$("img", c).filter((i) => !i.complete); await Promise.race([Promise.all(imgs.map((i) => new Promise((r) => { i.onload = i.onerror = r; }))), new Promise((r) => setTimeout(r, 2500))]);
    const fin = () => { c.remove(); document.body.classList.remove("print-one"); window.removeEventListener("afterprint", fin); };
    window.addEventListener("afterprint", fin); setTimeout(() => window.print(), 60);
    toast("Choose “Save as PDF” as the printer");
  }

  /* ----- saving ----- */
  /* a local copy of what is being typed, so a closed tab, a dead connection or a crash can never cost text */
  const DRAFT = "dxDraft";
  const draftClear = () => { try { localStorage.removeItem(DRAFT); } catch {} };
  const draftWrite = () => { const cur = D.open; if (!cur || !D.ed || !owner) return; try { const t = $(".dx-title", main); localStorage.setItem(DRAFT, JSON.stringify({ id: cur.id, ts: Date.now(), base: cur.updated || 0, title: t ? t.value : cur.title, blocks: D.ed.getBlocks() })); } catch {} };
  const draftRead = (id) => { try { const d = JSON.parse(localStorage.getItem(DRAFT) || "null"); return d && d.id === id ? d : null; } catch { return null; } };
  addEventListener("pagehide", () => { const d = draftRead(D.open && D.open.id); if (d && D.saveT) api("/api/docs?id=" + d.id, { method: "PUT", body: { title: d.title, blocks: d.blocks, base: d.base }, keepalive: true }); });
  function touch(now) { if (!owner || !D.open) return; clearTimeout(D.saveT); setStatus("Unsaved…"); draftWrite(); D.saveT = setTimeout(save, now ? 0 : 1100); }
  async function save() {
    clearTimeout(D.saveT); D.saveT = null; const cur = D.open; if (!cur || !owner) return true;
    const title = $(".dx-title", main); const patch = { title: title ? title.value : cur.title, icon: cur.icon || "", cover: cur.cover || null };
    if (D.ed) { patch.blocks = D.ed.getBlocks(); patch.base = cur.updated || 0; }
    setStatus("Saving…");
    const r = await api("/api/docs?id=" + cur.id, { method: "PUT", body: patch });
    if (r.status === 409 && r.data.conflict) { // changed on another tab or device: keep your text as its own page, then show the newer version
      const id = cur.id;
      await api("/api/docs", { method: "POST", body: { title: (patch.title || "Untitled") + " (my edit)", parent: cur.parent || null, blocks: patch.blocks || [] } });
      toast("This page was changed somewhere else. Your edit is kept as a separate page.");
      draftClear();
      D.open = null; CACHE[id] = { blocks: r.data.blocks }; await load(true); if (byId(id)) Object.assign(byId(id), r.data.page); await openId(id, { mode: "replace" }); return false;
    }
    if (!r.ok) { setStatus("Not saved. Retrying…"); D.saveT = setTimeout(save, 4000); return false; }
    Object.assign(cur, r.data.page); const m = byId(cur.id); if (m) Object.assign(m, r.data.page);
    if (!D.saveT) { clearTimeout(D.draftT); draftClear(); }
    setStatus("Saved"); drawFoot(); return true;
  }
  const DBDRAFT = "dxDbDraft";
  const dbDraftClear = () => { try { localStorage.removeItem(DBDRAFT); } catch {} };
  const dbDraftRead = (id) => { try { const d = JSON.parse(localStorage.getItem(DBDRAFT) || "null"); return d && d.id === id ? d : null; } catch { return null; } };
  function touchDb() { if (!owner || !D.open || !D.dbc) return; clearTimeout(D.dbT); setStatus("Unsaved…"); try { localStorage.setItem(DBDRAFT, JSON.stringify({ id: D.open.id, ts: Date.now(), base: D.open.updated || 0, db: D.dbc.get() })); } catch {} D.dbT = setTimeout(saveDb, 700); }
  async function saveDb() {
    clearTimeout(D.dbT); D.dbT = null; const cur = D.open; if (!cur || !D.dbc || !owner) return true;
    const db = JSON.parse(JSON.stringify(D.dbc.get()));
    setStatus("Saving…");
    const r = await api("/api/docs?id=" + cur.id, { method: "PUT", body: { db, base: cur.updated || 0 } });
    if (r.status === 409 && r.data.conflict) { // changed elsewhere: keep this version as its own database, then show the newer one
      const id = cur.id; await api("/api/docs", { method: "POST", body: { kind: "db", title: label(cur) + " (my edit)", parent: cur.parent || null, db } });
      toast("This database was changed somewhere else. Your version is kept as a separate database."); dbDraftClear();
      D.dbc && D.dbc.destroy(); D.dbc = null; D.open = null; CACHE[id] = { blocks: r.data.blocks || [], db: r.data.db }; await load(true); await openId(id, { mode: "replace" }); return false;
    }
    if (!r.ok) { setStatus("Not saved. Retrying…"); D.dbT = setTimeout(saveDb, 4000); return false; }
    Object.assign(cur, r.data.page); const m = byId(cur.id); if (m) Object.assign(m, r.data.page);
    if (!D.dbT) dbDraftClear();
    setStatus("Saved"); return true;
  }
  addEventListener("pagehide", () => { const d = dbDraftRead(D.open && D.open.id); if (d && D.dbT) api("/api/docs?id=" + d.id, { method: "PUT", body: { db: d.db, base: d.base }, keepalive: true }); });
  async function flush() {
    if (D.dbT) { clearTimeout(D.dbT); D.dbT = null; await saveDb(); }
    if (D.dbc) { try { D.dbc.destroy(); } catch {} D.dbc = null; } if (D.ed) { try { D.ed.flush && D.ed.flush(); } catch {} } if (D.saveT) { clearTimeout(D.saveT); D.saveT = null; await save(); } if (D.ed) { try { D.ed.destroy(); } catch {} D.ed = null; } }
  body.__flush = flush;

  /* ----- top bar ----- */
  function wireTop(editable) {
    $("[data-copy]", main)?.addEventListener("click", () => share(location.origin + "/docs/" + keyOf(D.open), label(D.open)));
    if (!editable) return;
    $("[data-share]", main).onclick = (e) => shareDialog();
    $("[data-menu]", main).onclick = (e) => {
      const p = D.open;
      popup(e.currentTarget, [
        { t: p.fav ? "Remove from favorites" : "Add to favorites", i: "star", run: async () => { p.fav = !p.fav; const m = byId(p.id); if (m) m.fav = p.fav; await api("/api/docs?id=" + p.id, { method: "PUT", body: { fav: p.fav } }); drawSide(); } },
        { t: "Add a page inside", i: "plus", run: () => { open[p.id] = true; ls.set("dxOpen", open); newPage({ parent: p.id }); } },
        { t: "Duplicate", i: "copy", run: () => duplicate(p) },
        { t: "Move to…", i: "move", run: moveDialog },
        "-",
        { t: ls.get("dxWide", false) ? "Normal width" : "Full width", i: "width", run: () => { const w = !ls.get("dxWide", false); ls.set("dxWide", w); $(".dx-page", main).classList.toggle("wide", w); } },
        { t: "Export as Markdown", i: "download", run: () => { const md = `# ${label(p)}\n\n${blocksToMd(D.ed ? D.ed.getBlocks() : D.blocks)}\n`, a = h("a", { href: URL.createObjectURL(new Blob([md], { type: "text/markdown" })), download: (slugify(label(p)) || "page") + ".md" }); a.click(); } },
        { t: "Page history", i: "history", run: historyDialog },
        { t: "Save as PDF", i: "print", run: exportPdf },
        "-",
        { t: "Move to bin", i: "trash", danger: true, run: async () => { await flush(); const r = await api("/api/docs?id=" + p.id, { method: "PUT", body: { trashed: true } }); if (r.ok) { await load(true); toast("Moved to the bin"); home(); } } },
      ]);
    };
  }
  function shareDialog() {
    const p = D.open, url = () => location.origin + "/docs/" + (p.slug || "your-page");
    const c = h("div", { class: "dx-share" });
    const d = dialog(root, "Share", c);
    const draw = () => {
      c.innerHTML = `<label class="dx-sw"><input type="checkbox" ${p.pub ? "checked" : ""} data-pub><span><b>Publish to the web</b><small>Anyone with the link can read it, and search engines can find it.</small></span></label>
        ${p.pub ? `<div class="dx-link"><input readonly value="${esc(url())}" aria-label="Public link"><button data-cp>Copy</button></div>
        <label class="ow-f">Address <span class="dx-slug">/docs/<input data-slug value="${esc(p.slug || "")}" maxlength="80"></span></label>
        <label class="ow-f">Summary for Google <textarea data-desc rows="2" maxlength="200" placeholder="One or two sentences">${esc(p.desc || "")}</textarea></label>
        <label class="dx-sw small"><input type="checkbox" ${p.noindex ? "checked" : ""} data-noidx><span>Don't show in search engines</span></label>
        <div class="dx-row"><a class="btn tonal" href="${esc(url())}" target="_blank" rel="noopener">Open live page</a></div>` : '<p class="hint">This page is private. Only you can see it.</p>'}`;
      $("[data-pub]", c).onchange = async (e) => { await save(); const r = await api("/api/docs?id=" + p.id, { method: "PUT", body: { pub: e.target.checked } }); if (r.ok) { Object.assign(p, r.data.page); const m = byId(p.id); if (m) Object.assign(m, r.data.page); drawSide(); R.item(body, keyOf(p), `${label(p)} — Docs`, "replace"); draw(); toast(p.pub ? "Published" : "Unpublished"); } };
      $("[data-cp]", c)?.addEventListener("click", () => share(url(), label(p)));
      const upd = (patch) => async () => { const r = await api("/api/docs?id=" + p.id, { method: "PUT", body: patch() }); if (r.ok) { Object.assign(p, r.data.page); const m = byId(p.id); if (m) Object.assign(m, r.data.page); $(".dx-link input", c).value = url(); R.item(body, keyOf(p), `${label(p)} — Docs`, "replace"); } };
      const sl = $("[data-slug]", c); if (sl) sl.onchange = upd(() => ({ slug: sl.value }));
      const ds = $("[data-desc]", c); if (ds) ds.onchange = upd(() => ({ desc: ds.value }));
      const ni = $("[data-noidx]", c); if (ni) ni.onchange = upd(() => ({ noindex: ni.checked }));
    };
    draw();
  }
  function moveDialog() {
    const p = D.open, list = [];
    const walk = (parent, depth) => kids(parent).forEach((x) => { if (x.id === p.id || within(x.id, p.id)) return; list.push([x, depth]); walk(x.id, depth + 1); });
    walk(null, 0);
    const c = h("div", { class: "dx-move" }, h("button", { class: p.parent ? "" : "on", "data-p": "" }, "Top level"), ...list.map(([x, d]) => h("button", { "data-p": x.id, class: p.parent === x.id ? "on" : "", style: `padding-left:${12 + d * 18}px`, html: pageIco(x, 16) + "<span>" + esc(label(x)) + "</span>" })));
    const dlg = dialog(root, "Move to…", c);
    $$("button", c).forEach((b) => (b.onclick = async () => { dlg.remove(); const parent = b.dataset.p || null; const r = await api("/api/docs?id=" + p.id, { method: "PUT", body: { parent } }); if (r.ok) { Object.assign(p, r.data.page); const m = byId(p.id); if (m) Object.assign(m, r.data.page); if (parent) { open[parent] = true; ls.set("dxOpen", open); } drawSide(); drawCrumbs(); } }));
  }
  async function historyDialog() {
    const p = D.open; await save();
    const r = await api("/api/docs?id=" + p.id + "&a=history"), hist = r.ok ? r.data.history : [];
    const c = h("div", { class: "dx-hist" });
    c.innerHTML = hist.length ? hist.map((x) => `<div class="dx-hr"><span><b>${new Date(x.ts).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</b><small>${(blocksText(x.blocks, " ").match(/\S+/g) || []).length} words</small></span><button data-r="${x.ts}">Restore</button></div>`).join("") : '<p class="hint">No earlier versions yet. They are saved automatically as you write.</p>';
    const dlg = dialog(root, "Page history", c);
    $$("[data-r]", c).forEach((b) => (b.onclick = async () => { if (!(await confirmBox("Replace the page with this earlier version? The current text is kept in the history.", "Restore", false))) return; const rr = await api("/api/docs?id=" + p.id, { method: "PUT", body: { restore: +b.dataset.r } }); dlg.remove(); if (rr.ok) { D.open = null; await load(true); openId(p.id, { mode: "replace" }); toast("Restored"); } }));
  }
  async function showTrash() {
    await flush(); D.open = null; D.trashView = true; root.dataset.view = "page"; drawSide();
    const t = (D.pages || []).filter((p) => p.trashed && !(p.parent && byId(p.parent)?.trashed));
    main.innerHTML = `<div class="dx-top"><button class="dx-back" data-back aria-label="Back">${I("chevron-left", 20)}</button><b class="dx-bt">Bin</b><span class="dx-st"></span>${t.length ? '<button class="dx-b danger" data-empty>Empty bin</button>' : ""}</div>
      <div class="dx-scrollmain"><div class="dx-page"><p class="hint">Pages you delete wait here. Restore them or delete them for good.</p>${t.length ? t.map((p) => `<div class="dx-hr"><span><b>${esc(label(p))}</b><small>Deleted ${ago(p.trashed)}</small></span><span><button data-rs="${p.id}">Restore</button><button class="danger" data-del="${p.id}">Delete forever</button></span></div>`).join("") : '<div class="dx-empty"><h2>The bin is empty</h2></div>'}</div></div>`;
    $("[data-back]", main).onclick = () => home();
    $$("[data-rs]", main).forEach((b) => (b.onclick = async () => { await api("/api/docs?id=" + b.dataset.rs, { method: "PUT", body: { trashed: false } }); await load(true); showTrash(); }));
    $$("[data-del]", main).forEach((b) => (b.onclick = async () => { if (!(await confirmBox("Delete this page and everything inside it for good?"))) return; await api("/api/docs?id=" + b.dataset.del, { method: "DELETE" }); await load(true); showTrash(); }));
    $("[data-empty]", main)?.addEventListener("click", async () => { if (!(await confirmBox("Delete everything in the bin for good?", "Empty bin"))) return; for (const p of t) await api("/api/docs?id=" + p.id, { method: "DELETE" }); await load(true); showTrash(); });
  }

  /* ----- right-click items for this app ----- */
  const copyUrl = async (pg) => { try { await navigator.clipboard.writeText(location.origin + "/docs/" + keyOf(pg)); toast("Link copied"); } catch { toast("Could not copy"); } };
  window.registerCtx && window.registerCtx("docs", (el) => {
    const row = el.closest(".dx-it[data-id], [data-go]"), id = row && (row.dataset.id || row.dataset.go), pg = id && byId(id), items = [];
    const sideTg = ls.get("dxSide", true) ? ["Hide the sidebar", () => toggleSide()] : ["Show the sidebar", () => toggleSide()];
    if (pg) {
      items.push(["Open", () => openId(id)]);
      if (owner) {
        items.push(["Add a page inside", () => { open[id] = true; ls.set("dxOpen", open); newPage({ parent: id }); }],
          [pg.fav ? "Remove from favorites" : "Add to favorites", async () => { pg.fav = !pg.fav; await api("/api/docs?id=" + id, { method: "PUT", body: { fav: pg.fav } }); drawSide(); }],
          ["Duplicate", () => duplicate(pg)]);
      }
      if (pg.pub) items.push(["Copy public link", () => copyUrl(pg)]);
      if (owner) items.push(null, ["Move to bin", async () => { await flush(); const r = await api("/api/docs?id=" + id, { method: "PUT", body: { trashed: true } }); if (r.ok) { await load(true); toast("Moved to the bin"); if (D.open && D.open.id === id) home(); else drawSide(); } }, "danger"]);
      return items;
    }
    if (el.closest(".dx-side")) { if (owner) items.push(["New page", () => newPage({})], ["New space", () => newPage({ sec: "space", icon: "folder" })], ["New database", () => newPage({ kind: "db", db: TEMPLATES.table(), icon: "table" })]); items.push(["Home", () => home()], sideTg); return items; }
    if (owner) items.push(["New page", () => newPage({})]);
    if (D.open) {
      if (owner && !D.open.trashed) items.push(["Add a page inside", () => { open[D.open.id] = true; ls.set("dxOpen", open); newPage({ parent: D.open.id }); }]);
      items.push([ls.get("dxWide", false) ? "Use normal width" : "Use full width", () => { const w = !ls.get("dxWide", false); ls.set("dxWide", w); $(".dx-page", main)?.classList.toggle("wide", w); }], ["Save as PDF", () => exportPdf()]);
      if (D.open.pub) items.push(["Copy public link", () => copyUrl(D.open)]);
    }
    items.push(sideTg);
    return items;
  });

  /* ----- start ----- */
  drawSide();
  if (slug) openKey(slug, "replace"); else home("replace");
  if (mobile()) root.dataset.view = slug ? "page" : "list";
  // keep the window address and the page in step when the user presses the back button
  const keys = (e) => {
    if (!body.isConnected) { document.removeEventListener("keydown", keys, true); return; }
    const w = body.closest(".win"); if (w && (!w.classList.contains("top") || w.classList.contains("min"))) return;
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === "k" && !document.activeElement?.closest?.(".rte, .ed-host")) { e.preventDefault(); e.stopPropagation(); findDialog(); }
    else if (mod && k === "s") { e.preventDefault(); if (owner) { save().then(() => toast("Saved")); } }
    else if (mod && e.key === "\\") { e.preventDefault(); toggleSide(); }
    else if (mod && e.altKey && k === "n" && owner) { e.preventDefault(); newPage({ parent: D.open ? D.open.id : null }); }
  };
  document.addEventListener("keydown", keys, true);
}
