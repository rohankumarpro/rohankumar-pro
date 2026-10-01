// What a real desktop has that this one was missing: search, notifications, window snapping, installable app,
// text size, a services page, a booking window, testimonials and the owner's local time.
import { h, $, $$, esc, api, isAdmin, toast, mobile } from "/js/lib.mjs";
import { R, Install, registerApp, lazyApp } from "/js/os-ext.mjs";
import { slugify, stripTags } from "/shared/blocks.mjs";

const ls = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const svg = (p, s = 18) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICO = { search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>', bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>', app: '<rect x="4" y="4" width="16" height="16" rx="4"/>', post: '<path d="M5 3h10l4 4v14H5z"/><path d="M9 12h6M9 16h6"/>', proj: '<path d="M3 18V6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>', link: '<path d="M10 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>', bolt: '<path d="M13 3 5 13h6l-1 8 8-10h-6z"/>', note: '<path d="M5 3h14v12l-6 6H5z"/><path d="M13 21v-6h6"/>' };

/* ================= top bar: search and notifications ================= */
function topbar() {
  const st = $("#stBtn"); if (!st || $(".tb-right")) return;
  const wrap = h("div", { class: "tb-right" });
  const sb = h("button", { class: "pill topbtn tb-ic", id: "spotBtn", "aria-label": "Search", title: "Search (Ctrl K)", html: svg(ICO.search) });
  const bb = h("button", { class: "pill topbtn tb-ic", id: "bellBtn", "aria-label": "Notifications", "aria-expanded": "false", title: "Notifications", html: svg(ICO.bell) + '<i class="tb-dot" hidden></i>' });
  st.before(wrap); wrap.append(sb, bb, st);
  sb.onclick = () => Spot.show(); bb.onclick = (e) => { e.stopPropagation(); Notif.toggle(); };
}

/* ================= search (Ctrl K) ================= */
const Spot = {
  el: null, data: null, at: 0, idx: 0, items: [],
  async load() { if (Spot.data && Date.now() - Spot.at < 60000) return; const [j, p, hb, n] = await Promise.all([api("/api/journal"), api("/api/projects"), api("/api/hub"), api("/api/notes")]); Spot.data = { posts: (j.ok ? j.data.posts : []).filter((x) => !x.draft), projects: (p.ok ? p.data.projects : []).filter((x) => x.status === "published"), hub: hb.ok ? hb.data.hub : null, notes: n.ok && n.data.notes ? n.data.notes : [] }; Spot.at = Date.now(); },
  actions() {
    const A = [
      { k: "Action", t: isDark() ? "Switch to light mode" : "Switch to dark mode", s: "Appearance", i: "bolt", run: () => { document.documentElement.dataset.theme = isDark() ? "light" : "dark"; save(); } },
      { k: "Action", t: "Lock screen", s: "Show the lock screen", i: "bolt", run: () => lock() },
      { k: "Action", t: "Close all windows", s: "Tidy the desktop", i: "bolt", run: () => closeAll() },
      { k: "Action", t: "Copy link to this page", s: location.pathname, i: "link", run: () => navigator.clipboard.writeText(location.href).then(() => toast("Link copied")) },
      { k: "Action", t: "Book a call", s: "Free intro call", i: "bolt", run: () => openApp("book") },
      { k: "Action", t: "Show keyboard shortcuts", s: "Press ? anywhere", i: "bolt", run: () => shortcuts() },
    ];
    if (Install.can()) A.push({ k: "Action", t: "Install as an app", s: "Add to your device", i: "bolt", run: () => Install.prompt() });
    if (isAdmin()) A.push({ k: "Owner", t: "Write a new article", s: "Journal", i: "post", run: () => { openApp("journal"); setTimeout(() => $(".win[data-app=journal] .j-new")?.click(), 700); } }, { k: "Owner", t: "Add a new project", s: "Projects", i: "proj", run: () => { openApp("projects"); setTimeout(() => $(".win[data-app=projects] .pj-new")?.click(), 700); } });
    return A;
  },
  corpus() {
    const D = Spot.data || { posts: [], projects: [], hub: null, notes: [] }, C = [];
    for (const a of APPS) if (appVisible(a.id)) C.push({ k: "Apps", t: a.title, s: a.drawer ? "Tool" : "App", i: "app", ih: icon(a), text: a.id, run: () => openApp(a.id), w: 3 });
    for (const p of D.posts) C.push({ k: "Journal", t: p.title, s: p.excerpt || "", i: "post", text: [p.title, p.excerpt, p.tag, (p.tags || []).join(" "), (p.body || "").slice(0, 2500)].join(" "), run: () => R.apply("/journal/" + p.slug), w: 2 });
    for (const p of D.projects) C.push({ k: "Projects", t: p.title, s: [p.field, p.year].filter(Boolean).join(" · "), i: "proj", text: [p.title, p.summary, p.field, (p.tags || []).join(" "), (p.tools || []).join(" "), p.client].join(" "), run: () => R.apply("/projects/" + p.slug), w: 2 });
    for (const n of D.notes) C.push({ k: "Notes", t: n.title || "Untitled", s: (n.text || "").slice(0, 70), i: "note", text: (n.title || "") + " " + (n.text || ""), run: () => openApp("notes"), w: 1 });
    for (const i of (D.hub && D.hub.items) || []) if (["link", "app", "email", "embed"].includes(i.type) && i.title) C.push({ k: "Links", t: i.title, s: i.sub || (i.url || "").replace(/^https?:\/\//, ""), i: "link", text: [i.title, i.sub, i.url].join(" "), run: () => (i.type === "app" ? openApp(i.app) : window.open(i.type === "email" ? "mailto:" + i.url : i.url, "_blank", "noopener")), w: 1 });
    for (const x of Spot.actions()) C.push({ ...x, text: x.t + " " + x.s, w: 1 });
    return C;
  },
  search(q) {
    const all = Spot.corpus(), toks = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!toks.length) { const rec = ls.get("rkRecent", []); const recent = rec.map((t) => all.find((c) => c.t === t)).filter(Boolean); return [...recent.map((c) => ({ ...c, k: "Recent" })), ...all.filter((c) => c.k === "Apps" && !c.s.includes("Tool")).slice(0, 8), ...all.filter((c) => c.k === "Action").slice(0, 4)].filter((c, i, a) => a.findIndex((x) => x.t === c.t && x.k === c.k) === i); }
    return all.map((c) => { let sc = 0; const t = c.t.toLowerCase(), tx = (c.text || "").toLowerCase(); for (const w of toks) { if (t === w) sc += 12; else if (t.startsWith(w)) sc += 8; else if (t.includes(w)) sc += 5; else if (tx.includes(w)) sc += 2; else return null; } return { ...c, score: sc * (c.w || 1) }; }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 24);
  },
  show() {
    if (Spot.el) return Spot.hide();
    hideLauncher && hideLauncher();
    const ov = h("div", { class: "spot-ov", role: "dialog", "aria-modal": "true", "aria-label": "Search" }), card = h("div", { class: "spot" });
    const inp = h("input", { class: "spot-in", type: "search", placeholder: "Search articles, projects, apps, links…", "aria-label": "Search", autocomplete: "off", spellcheck: "false", enterkeyhint: "go" });
    const list = h("div", { class: "spot-list", role: "listbox" });
    card.append(h("div", { class: "spot-bar" }, h("span", { html: svg(ICO.search, 20) }), inp, h("button", { class: "spot-x", "aria-label": "Close search", onclick: () => Spot.hide() }, "Esc")), list, h("div", { class: "spot-foot" }, "↑ ↓ to move · Enter to open · Esc to close"));
    ov.append(card); document.body.append(ov); Spot.el = ov;
    const draw = () => {
      Spot.items = Spot.search(inp.value.trim()); Spot.idx = Math.min(Spot.idx, Math.max(0, Spot.items.length - 1));
      let g = "", out = [];
      Spot.items.forEach((it, n) => { if (it.k !== g) { g = it.k; out.push(h("div", { class: "spot-g" }, g)); } out.push(h("button", { class: "spot-it" + (n === Spot.idx ? " on" : ""), role: "option", "data-i": n, onclick: () => pick(n), onpointermove: () => { if (Spot.idx !== n) { Spot.idx = n; $$(".spot-it", list).forEach((b) => b.classList.toggle("on", +b.dataset.i === n)); } } }, h("span", { class: "spot-ic" + (it.ih ? " app" : ""), html: it.ih || svg(ICO[it.i] || ICO.app, 18) }), h("span", { class: "spot-t" }, h("b", {}, it.t), it.s ? h("small", {}, stripTags(it.s).slice(0, 90)) : null))); });
      list.replaceChildren(...(out.length ? out : [h("div", { class: "spot-none" }, "Nothing found. Try another word.")]));
      $(".spot-it.on", list)?.scrollIntoView({ block: "nearest" });
    };
    const pick = (n) => { const it = Spot.items[n]; if (!it) return; const rec = ls.get("rkRecent", []).filter((t) => t !== it.t); rec.unshift(it.t); ls.set("rkRecent", rec.slice(0, 5)); Spot.hide(); setTimeout(() => it.run(), 60); };
    inp.addEventListener("input", () => { Spot.idx = 0; draw(); });
    ov.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); Spot.hide(); }
      if (e.key === "ArrowDown") { e.preventDefault(); Spot.idx = Math.min(Spot.items.length - 1, Spot.idx + 1); draw(); }
      if (e.key === "ArrowUp") { e.preventDefault(); Spot.idx = Math.max(0, Spot.idx - 1); draw(); }
      if (e.key === "Enter") { e.preventDefault(); pick(Spot.idx); }
    });
    ov.addEventListener("pointerdown", (e) => { if (e.target === ov) Spot.hide(); });
    draw(); inp.focus(); Spot.load().then(() => Spot.el && draw());
    SFX && SFX.play("open");
  },
  hide() { if (Spot.el) { Spot.el.remove(); Spot.el = null; } },
};
/* ================= keyboard shortcuts (they all really work; the list below is what the ? sheet shows) ================= */
const GO = { a: "about", p: "projects", j: "journal", n: "notes", d: "docs", l: "links", m: "messages", s: "settings", r: "resume", c: "contact", g: "guestbook", t: "timeline", h: "photos", w: "documents", v: "services", b: "book", x: "content" };
const topWin = () => { const w = (window.Router || {}).top && Router.top(); return w || null; };
const winId = (w) => w && w.dataset.app;
function snapWin(w, side) {
  if (!w || mobile()) return; w.classList.add("resizing-anim");
  if (side === "max") w.classList.toggle("max");
  else if (side === "restore") { w.classList.remove("max"); }
  else { w.classList.remove("max"); const a = { top: 48, h: innerHeight - 140 }; w.style.top = a.top + "px"; w.style.height = a.h + "px"; w.style.width = innerWidth / 2 - 12 + "px"; w.style.left = (side === "l" ? 8 : innerWidth / 2 + 4) + "px"; }
  setTimeout(() => w.classList.remove("resizing-anim"), 380);
}
function cycleWin(dir) {
  const ws = $$(".win").filter((w) => !w.classList.contains("closing")); if (ws.length < 2) return;
  const order = ws.sort((a, b) => (+a.style.zIndex || 0) - (+b.style.zIndex || 0)), cur = topWin(), i = order.indexOf(cur);
  const nxt = dir > 0 ? order[0] : order[order.length - 2] || order[0]; // bring the back-most (or second) window forward
  if (nxt.classList.contains("min")) openApp(winId(nxt)); else focus(nxt);
}
let chord = 0;
document.addEventListener("keydown", (e) => {
  const ae = document.activeElement, typing = /^(INPUT|TEXTAREA|SELECT)$/.test(ae?.tagName) || ae?.isContentEditable;
  const mod = e.ctrlKey || e.metaKey, k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (mod && k === "k" && !ae?.closest?.(".rte, .ed-host")) { e.preventDefault(); Spot.show(); return; }
  if (document.getElementById("lock") && !document.getElementById("lock").classList.contains("off")) return; if ($(".own-dlg") && k !== "?") return;
  // Alt shortcuts work even while typing
  if (e.altKey && !mod) {
    const w = topWin(); let used = true;
    if (k === "w" || k === "x") { if (w) closeWin(w, winId(w)); }
    else if (k === "m") { if (w) minimizeWin(w, winId(w)); }
    else if (k === "Enter" || k === "ArrowUp") snapWin(w, "max");
    else if (k === "ArrowDown") snapWin(w, "restore");
    else if (k === "ArrowLeft") snapWin(w, "l");
    else if (k === "ArrowRight") snapWin(w, "r");
    else if (k === "]" || k === "`") cycleWin(1);
    else if (k === "[") cycleWin(-1);
    else if (k === "d") minimizeAll();
    else if (k === "l" || k === " ") toggleLauncher();
    else if (k === "n") Notif.toggle();
    else if (k === "s") openApp("settings");
    else if (/^[1-9]$/.test(k)) { const ids = [...$$(".shelf .app, .shelf [data-app]")].map((b) => b.dataset.app).filter(Boolean); if (ids[+k - 1]) openApp(ids[+k - 1]); else used = false; }
    else used = false;
    if (used) { e.preventDefault(); e.stopPropagation(); }
    return;
  }
  if (typing || mod) return;
  if (chord && Date.now() - chord < 1600) { chord = 0; const id = GO[k]; if (id) { e.preventDefault(); openApp(id); } return; }
  if (k === "/" && !e.shiftKey) { e.preventDefault(); Spot.show(); }
  else if (k === "?" || (k === "/" && e.shiftKey)) { e.preventDefault(); shortcuts(); }
  else if (k === "g") { chord = Date.now(); toast("Go to… press a letter. ? lists them"); }
}, true);

function shortcuts() {
  if ($(".kbd-ov")) return;
  const grp = (t, rows) => [h("h4", {}, t), h("dl", {}, rows.map(([k, v]) => [h("dt", {}, k), h("dd", {}, v)]))];
  const d = h("div", { class: "own-dlg kbd-ov" }, h("div", { class: "own-card kbd", role: "dialog", "aria-modal": "true", "aria-label": "Keyboard shortcuts" }, h("b", {}, "Keyboard shortcuts"),
    grp("Anywhere", [["Ctrl K  or  /", "Search everything"], ["?", "Show this list"], ["Esc", "Close the top box"], ["Ctrl Shift E", "Owner sign-in"]]),
    grp("Go to an app: press G, then a letter", [["G A", "About"], ["G P", "Projects"], ["G J", "Journal"], ["G N", "Notes"], ["G D", "Docs"], ["G L", "Links"], ["G M", "Messages"], ["G R", "Resume"], ["G C", "Contact"], ["G G", "Guestbook"], ["G T", "Timeline"], ["G H", "Photos"], ["G W", "Wallet"], ["G V", "Services"], ["G B", "Book a call"], ["G X", "Content"], ["G S", "Settings"]]),
    grp("Windows (hold Alt)", [["Alt W", "Close the window"], ["Alt M", "Minimise"], ["Alt Enter  or  Alt ↑", "Maximise or restore"], ["Alt ↓", "Restore size"], ["Alt ←  /  Alt →", "Snap to left or right half"], ["Alt ]  /  Alt [", "Switch window"], ["Alt D", "Show the desktop"], ["Alt L  or  Alt Space", "App launcher"], ["Alt N", "Notifications"], ["Alt S", "Settings"], ["Alt 1 … 9", "Open the nth app in the dock"]]),
    grp("Writing (Journal, Projects, Docs, Notes)", [["/", "Insert a block (heading, image, video…)"], ["Ctrl B / I / U", "Bold, italic, underline"], ["Ctrl K", "Add a link"], ["Ctrl Z / Ctrl Shift Z", "Undo and redo"], ["Ctrl S", "Save now"], ["Tab / Shift Tab", "Indent or outdent a list item"], ["# , ## , - , 1. , [] , > , ```", "Markdown shortcuts at the start of a line"]]),
    h("div", { class: "own-row" }, h("button", { onclick: () => d.remove() }, "Close"))));
  d.addEventListener("click", (e) => { if (e.target === d) d.remove(); }); d.addEventListener("keydown", (e) => { if (e.key === "Escape") d.remove(); }); document.body.append(d); d.querySelector("button").focus();
}

/* ================= notifications ================= */
const Notif = {
  el: null, items: [], busy: false,
  async gather() {
    const seen = ls.get("rkSeen", 0), out = [];
    const [j, p] = await Promise.all([api("/api/journal"), api("/api/projects")]);
    const posts = j.ok ? j.data.posts.filter((x) => !x.draft) : [], projects = p.ok ? p.data.projects.filter((x) => x.status === "published") : [];
    const first = !ls.get("rkVisited", 0);
    for (const x of posts) { const t = Date.parse((x.published || "") + "T00:00:00Z") || 0; if (t > seen && !first) out.push({ id: "post:" + x.slug, ts: t, icon: "post", title: "New in the Journal", text: x.title, run: () => R.apply("/journal/" + x.slug) }); }
    for (const x of projects) { const t = x.publishedAt || 0; if (t > seen && !first) out.push({ id: "proj:" + x.slug, ts: t, icon: "proj", title: "New project", text: x.title, run: () => R.apply("/projects/" + x.slug) }); }
    if (isAdmin()) {
      const [m, g, s] = await Promise.all([api("/api/mochi"), api("/api/guestbook"), api("/api/hub?a=subs")]);
      if (m.ok) { const ms = ls.get("mochiSeen", 0), n = m.data.visitors.filter((v) => (v.updated || 0) > ms).length; if (n) out.push({ id: "msgs:" + (m.data.visitors.map((v) => v.updated || 0).sort().pop() || 0), ts: Date.now(), icon: "note", title: "Messages", text: `${n} new from visitors. Open Mochi's inbox in Settings.`, run: () => openApp("settings"), sticky: true }); }
      if (g.ok) { const n = g.data.entries.filter((e) => e.status === "pending").length; if (n) out.push({ id: "gb:" + n, ts: Date.now(), icon: "note", title: "Guestbook", text: `${n} note${n > 1 ? "s" : ""} waiting for your approval.`, run: () => openApp("guestbook"), sticky: true }); }
      if (s.ok) { const ss = ls.get("rkSubsSeen", 0), n = Math.max(0, s.data.subs.length - ss); if (n) out.push({ id: "subs:" + s.data.subs.length, ts: Date.now(), icon: "link", title: "Subscribers", text: `${n} new email sign-up${n > 1 ? "s" : ""}.`, run: () => { openApp("links"); }, sticky: true, onOpen: () => ls.set("rkSubsSeen", s.data.subs.length) }); }
      const drafts = posts.length; // placeholder to keep structure simple
    }
    if (Install.can()) out.push({ id: "install", ts: Date.now(), icon: "bolt", title: "Install this site", text: "Add it to your home screen and open it like an app.", run: () => Install.prompt(), sticky: true });
    else if (Install.ios()) out.push({ id: "ios", ts: Date.now(), icon: "bolt", title: "Add to Home Screen", text: "In Safari tap Share, then “Add to Home Screen” to open this like an app.", sticky: true });
    Notif.items = out.sort((a, b) => b.ts - a.ts);
    ls.set("rkVisited", 1); Notif.updateDot();
  },
  async toggle() { if (Notif.el) return Notif.hide(); Notif.show(); Notif.refresh(); },
  async refresh() { if (Notif.busy) return; Notif.busy = true; try { await Notif.gather(); } catch {} Notif.busy = false; if (Notif.el) Notif.paint(); },
  list() { const dis = ls.get("rkDismiss", []); return Notif.items.filter((n) => !dis.includes(n.id)); },
  paint() {
    const p = Notif.el; if (!p) return; const items = Notif.list(), keep = p.scrollTop;
    p.innerHTML = `<div class="notif-h"><b>Notifications</b>${items.length ? '<button class="notif-clear">Clear all</button>' : ""}</div>${items.length ? items.map((n, i) => `<div class="notif-row"><button class="notif-i" data-i="${i}"><span class="spot-ic">${svg(ICO[n.icon] || ICO.bolt, 18)}</span><span class="spot-t"><b>${esc(n.title)}</b><small>${esc(n.text)}</small></span></button><button class="notif-x" data-x="${i}" aria-label="Dismiss">✕</button></div>`).join("") : `<p class="hint notif-empty">${Notif.busy ? "Checking…" : "You are all caught up."}</p>`}`;
    $$(".notif-i", p).forEach((b) => (b.onclick = () => { const n = items[+b.dataset.i]; Notif.hide(); n.onOpen && n.onOpen(); n.run && n.run(); }));
    $$(".notif-x", p).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const n = items[+b.dataset.x], row = b.closest(".notif-row"); const dis = ls.get("rkDismiss", []); dis.push(n.id); ls.set("rkDismiss", dis.slice(-200)); n.onOpen && n.onOpen(); row.classList.add("gone"); setTimeout(() => { Notif.updateDot(); Notif.paint(); }, 180); }));
    const c = $(".notif-clear", p); if (c) c.onclick = () => { ls.set("rkSeen", Date.now()); const dis = ls.get("rkDismiss", []); items.forEach((n) => { dis.push(n.id); n.onOpen && n.onOpen(); }); ls.set("rkDismiss", dis.slice(-200)); Notif.updateDot(); Notif.paint(); };
    p.scrollTop = keep;
  },
  updateDot() { const seen = ls.get("rkSeen", 0), dot = $("#bellBtn .tb-dot"); if (dot) dot.hidden = !Notif.list().some((n) => n.sticky || n.ts > seen); },
  show() {
    hideQS && hideQS();
    const p = h("div", { class: "qs notif", role: "dialog", "aria-label": "Notifications" });
    $("#desk").append(p); Notif.el = p; $("#bellBtn").setAttribute("aria-expanded", "true");
    Notif.paint();
    setTimeout(() => document.addEventListener("pointerdown", Notif.out, true), 0);
    const mine = Math.max(...Notif.items.filter((n) => !n.sticky).map((n) => n.ts), 0); if (mine) ls.set("rkSeen", Math.max(ls.get("rkSeen", 0), mine));
    Notif.updateDot();
  },
  out(e) { if (Notif.el && !Notif.el.contains(e.target) && !e.target.closest("#bellBtn")) Notif.hide(); },
  hide() {
    const p = Notif.el; if (!p) return; Notif.el = null; $("#bellBtn")?.setAttribute("aria-expanded", "false"); document.removeEventListener("pointerdown", Notif.out, true);
    p.classList.add("closing"); setTimeout(() => p.remove(), 170);
  },
};
setInterval(() => { if (!document.hidden) Notif.refresh(); }, 90000);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && Notif.el) { Notif.hide(); } });

/* ================= window snapping (desktop) ================= */
function snapping() {
  const wins = $("#wins"); if (!wins) return;
  let prev = null, st = null;
  const area = () => ({ top: 48, h: innerHeight - 140 });
  const zone = (x, y) => (x < 10 ? "l" : x > innerWidth - 10 ? "r" : y < 52 ? "t" : null);
  const show = (z) => {
    if (!z) { prev && prev.remove(); prev = null; return; }
    if (!prev) { prev = h("div", { class: "snap-prev" }); document.body.append(prev); }
    const a = area(); const g = z === "l" ? [8, a.top, innerWidth / 2 - 12, a.h] : z === "r" ? [innerWidth / 2 + 4, a.top, innerWidth / 2 - 12, a.h] : [12, a.top, innerWidth - 24, a.h];
    prev.style.cssText = `left:${g[0]}px;top:${g[1]}px;width:${g[2]}px;height:${g[3]}px`;
  };
  wins.addEventListener("pointerdown", (e) => { const bar = e.target.closest(".bar"); if (!bar || e.target.closest("button") || mobile()) return; const w = bar.closest(".win"); if (w.classList.contains("max")) return; st = { w, moved: false }; });
  document.addEventListener("pointermove", (e) => { if (!st) return; st.moved = true; show(zone(e.clientX, e.clientY)); });
  document.addEventListener("pointerup", (e) => {
    if (!st) return; const z = zone(e.clientX, e.clientY); show(null); const w = st.w; const moved = st.moved; st = null;
    if (!z || !moved) return;
    w.classList.add("resizing-anim");
    if (z === "t") { w.classList.add("max"); } else { const a = area(); w.classList.remove("max"); w.style.top = a.top + "px"; w.style.height = a.h + "px"; w.style.width = innerWidth / 2 - 12 + "px"; w.style.left = (z === "l" ? 8 : innerWidth / 2 + 4) + "px"; }
    setTimeout(() => w.classList.remove("resizing-anim"), 380);
  });
}

/* ================= desktop widgets: owner's local time, testimonials ================= */
function widgets() {
  const s = (typeof SITE !== "undefined" && SITE.s) || {};
  const st = $(".wcard.st");
  if (st && !$(".wtime", st)) st.append(h("p", { class: "wtime" }));
  const tick = () => { const el = $(".wtime"); if (!el) return; const tz = s.tz || "Asia/Kolkata"; try { const t = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: tz, timeZoneName: "short" }).format(new Date()); const hr = +new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: tz }).format(new Date()); el.innerHTML = `<span class="tdot ${hr >= 9 && hr < 20 ? "on" : ""}"></span>My time: ${esc(t.replace(/\s+/g, " "))}`; } catch { el.remove(); } };
  tick(); clearInterval(widgets.iv); widgets.iv = setInterval(tick, 30000);
  const list = s.testimonials || [];
  let tw = $(".wcard.tw");
  if (!list.length) { tw && tw.remove(); return; }
  if (!tw) { tw = h("button", { class: "wcard tw", "aria-label": "Read what clients say" }); $(".widgets")?.append(tw); tw.onclick = () => openApp("services"); }
  let i = 0; const show = () => { const t = list[i % list.length]; tw.innerHTML = `<p class="tq">“${esc(t.text.length > 130 ? t.text.slice(0, 127) + "…" : t.text)}”</p><small>${esc(t.name)}${t.role ? ", " + esc(t.role) : ""}</small>`; i++; };
  show(); clearInterval(widgets.tv); if (list.length > 1) widgets.tv = setInterval(show, 7000);
}
const _applyText = window.applyText;
window.applyText = function () { const r = _applyText.apply(this, arguments); try { widgets(); } catch {} return r; };

/* ================= settings: text size ================= */
window.settingsExtra = function (body) {
  const cur = ls.get("rkScale", 100);
  const sec = h("div", { class: "set-extra" }, h("h3", {}, "Text size"), h("div", { class: "seg" }, [90, 100, 112, 125].map((v) => h("button", { class: v === cur ? "on" : "", onclick: () => { ls.set("rkScale", v); applyScale(); $$(".seg button", sec).forEach((b) => b.classList.toggle("on", +b.dataset.v === v)); }, "data-v": v }, v === 100 ? "Normal" : v + "%"))), h("h3", {}, "This site as an app"), Install.installed ? h("p", { class: "hint" }, "You are using the installed app.") : Install.can() ? h("button", { class: "btn tonal", onclick: () => Install.prompt() }, "Install on this device") : h("p", { class: "hint" }, Install.ios() ? "In Safari tap Share, then “Add to Home Screen”." : "Use your browser's menu and choose “Install app” or “Add to Home Screen”."), h("p", {}, h("button", { class: "btn tonal", onclick: shortcuts }, "Keyboard shortcuts")));
  if (isAdmin()) {
    const msg = h("p", { class: "hint" }, "Everything you write in Owner mode is stored on the server, so updating the website never resets it. A backup is a copy you can keep.");
    sec.append(h("h3", {}, "Backup"), msg, h("div", { class: "ow-row" },
      h("a", { class: "btn tonal", href: "/api/backup", download: "" }, "Download backup"),
      h("button", { class: "btn tonal", onclick: async () => {
        const i = h("input", { type: "file", accept: "application/json,.json", style: "display:none" }); document.body.append(i);
        i.onchange = async () => { const f = i.files[0]; i.remove(); if (!f) return; let data; try { data = JSON.parse(await f.text()); } catch { return toast("That file can't be read."); }
          if (!confirm("Put this backup back? Items with the same name are replaced with the backup's version.")) return;
          const r = await api("/api/backup", { method: "POST", body: data }); toast(r.ok ? `Restored ${r.data.restored} items. Reloading…` : r.data.error || "Restore failed"); if (r.ok) setTimeout(() => location.reload(), 1200); };
        i.click();
      } }, "Restore from file")));
  }
  const own = $(".own-sec", body); own ? own.before(sec) : body.append(sec);
};
function applyScale() { const v = ls.get("rkScale", 100); document.body.style.zoom = v === 100 ? "" : v / 100; }
applyScale();

/* ================= new apps: Services, Book a call ================= */
const ART_ADD = {
  docs: `<rect class="l1" x="24" y="20" width="50" height="60" rx="10" fill="#fff" stroke="${IK}" stroke-width="4.5"/><path class="up" d="M35 36h28M35 47h28M35 58h14" stroke="${IK}" stroke-width="4.5" stroke-linecap="round"/><rect class="rise" x="52" y="55" width="26" height="22" rx="6" fill="${IG}" stroke="${IK}" stroke-width="3.5"/><path d="M59 66h12" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>`,
  documents: `<rect class="l1" x="20" y="30" width="60" height="44" rx="11" fill="${IG}"/><path class="up" d="M24 34 62 21a4 4 0 0 1 5.4 3.8V32" fill="#fff" stroke="${IK}" stroke-width="3.5" stroke-linejoin="round"/><rect x="54" y="46" width="28" height="18" rx="9" fill="#fff"/><circle class="rise" cx="65" cy="55" r="3.6" fill="${IK}"/>`,
  services: `<rect class="l1" x="26" y="38" width="48" height="34" rx="8" fill="${IG}"/><path class="up" d="M41 38v-5a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v5" fill="none" stroke="${IK}" stroke-width="5" stroke-linecap="round"/><rect x="26" y="52" width="48" height="4" fill="#2a8a45"/><circle class="rise" cx="50" cy="56" r="5" fill="#fff"/>`,
  book: `<rect class="l1" x="24" y="30" width="52" height="46" rx="8" fill="${IR}"/><rect x="24" y="44" width="52" height="32" rx="7" fill="#fff"/><path class="up" d="M36 24v12M64 24v12" stroke="${IK}" stroke-width="5" stroke-linecap="round"/><g class="dots" fill="${IR}"><circle cx="38" cy="56" r="3.5"/><circle cx="50" cy="56" r="3.5"/><circle cx="62" cy="56" r="3.5"/><circle cx="38" cy="67" r="3.5"/><circle cx="50" cy="67" r="3.5"/></g>`,
};
function newApps() {
  if (typeof ART !== "undefined") Object.assign(ART, ART_ADD);
  const SV = { id: "services", title: "Services", shape: "clover", color: "c1", glyph: G.work || G.folder, w: 640, h: 640, render: () => "" };
  const BK = { id: "book", title: "Book a call", shape: "cookie", color: "c2", glyph: G.mail, w: 560, h: 680, render: () => "" };
  const DX = { id: "docs", title: "Docs", shape: "squircle", color: "c3", glyph: G.docs || G.folder, w: 940, h: 640, render: () => "" };
  registerApp(DX); registerApp(SV); registerApp(BK);
  lazyApp("docs", "/js/app-docs.mjs", "docsApp");
  lazyApp("services", "/js/app-services.mjs", "servicesApp"); lazyApp("book", "/js/app-book.mjs", "bookApp");
  if (!EDITABLE.includes("services")) EDITABLE.push("services");
  renderIcons();
}

/* ================= go ================= */
function init() {
  topbar(); newApps(); snapping(); widgets();
  try { window.__resolveMore && window.__resolveMore(); } catch {}
  Notif.gather().catch(() => {});
  if (isAdmin()) setInterval(() => Notif.gather().catch(() => {}), 120000);
  document.addEventListener("owner-changed", () => Notif.gather().catch(() => {}));
}
const _oc = window.ownerChanged; window.ownerChanged = function () { const r = _oc.apply(this, arguments); setTimeout(() => { widgets(); Notif.gather().catch(() => {}); }, 50); return r; };
if (document.readyState === "complete") init(); else addEventListener("load", init);
