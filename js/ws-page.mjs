// A page shown on its own, full size: a workspace page, a database row (with its properties above the writing),
// or a page card from a board. The writing is saved through /api/boards?page=<id> like every other page.
//   openDoc(host, { kind: "page" | "row" | "bpage", id, db?, board? }, ctx)  ->  { destroy(), flush() }
//   ctx: { back(), openPage(id), openDb(id), openRow(dbId, rowId), openBoard(id), crumbs() }
import { h, esc, api, toast, mobile, makeEditor, confirmBox } from "/js/lib.mjs";
import { blocksToMd, blocksText } from "/shared/blocks.mjs";
import { ICONS } from "/shared/icons.mjs";
import { COVERS, coverCss } from "/js/board-covers.mjs";
import { WS, DB, TYPES, rid } from "/js/ws-core.mjs";
import { WI, valueEditors, iconPick, choose, popover, closePop } from "/js/ws-db.mjs";

const coverStyle = (c) => (!c ? "" : c.k ? coverCss(c) : `url('${esc(c.src)}') center/cover`);
const words = (blocks) => (blocksText(blocks || [], " ").match(/\S+/g) || []).length;

export function openDoc(host, src, ctx = {}) {
  const P = { blocks: [], updated: 0, dirty: false, saving: false, saveT: 0, ed: null, dead: false, board: null, item: null, conflict: null };
  host.innerHTML = `<div class="wp"><div class="wd-load"><span class="rb-spin"></span></div></div>`;
  const root = host.firstElementChild;
  const VE = src.kind === "row" ? valueEditors(src.db, { busy: () => {} }) : null;

  /* ----- what this page is called, and where it lives ----- */
  function meta() {
    if (src.kind === "page") return WS.page(src.id) || { title: "", icon: "" };
    if (src.kind === "row") { const d = DB.get(src.db); return (d && d.rows[src.id]) || { title: "", icon: "", v: {} }; }
    return P.item || { title: "", icon: "" };
  }
  async function setMeta(patch) {
    if (src.kind === "page") return WS.setPage(src.id, patch);
    if (src.kind === "row") return DB.ops(src.db, [{ op: "row", row: { id: src.id, ...patch } }]);
    // a page card on a board: change the card on the board
    for (let tries = 0; tries < 2; tries++) {
      const r = await api("/api/boards?id=" + src.board); if (!r.ok) return toast("Could not save the page details");
      const it = r.data.doc.items[src.id]; if (!it) return;
      Object.assign(it, patch); P.item = it;
      const s = await api(`/api/boards?id=${src.board}&a=patch`, { method: "POST", body: { up: [it], base: r.data.doc.rev } });
      if (s.ok) return; if (s.status !== 409) return toast("Could not save the page details");
    }
  }
  function crumbs() {
    const out = [];
    if (src.kind === "page") { let p = WS.page(meta().parent), n = 0; while (p && n++ < 8) { out.unshift({ t: p.title || "Untitled", i: p.icon, go: ((id) => () => ctx.openPage(id))(p.id) }); p = WS.page(p.parent); } }
    if (src.kind === "row") { const d = WS.db(src.db); if (d) out.push({ t: d.title || "Untitled database", i: d.icon || "db", go: () => ctx.openDb(src.db) }); }
    if (src.kind === "bpage" && P.board) out.push({ t: P.board.title || "Untitled board", i: P.board.icon || "grid", go: () => ctx.openBoard(src.board) });
    return out;
  }

  /* ----- drawing ----- */
  function draw() {
    const m = meta(), full = src.kind === "page" && m.full;
    root.className = "wp" + (full ? " full" : "");
    root.innerHTML = `
      <div class="wp-top"><button class="wp-ib" data-a="back" title="Back" aria-label="Back">${WI("arrow-left", 18)}</button>
        <nav class="wp-crumbs" aria-label="Where this page is"><button data-a="home">${WI("home", 15)}<span>Home</span></button>${crumbs().map((c, i) => `<span class="wp-sep">${WI("chevron-right", 14)}</span><button data-crumb="${i}">${c.i && (ICONS[c.i] || c.i === "db") ? WI(c.i, 15) : ""}<span>${esc(c.t)}</span></button>`).join("")}<span class="wp-sep">${WI("chevron-right", 14)}</span><span class="cur">${esc(m.title || "Untitled")}</span></nav>
        <span class="wp-st" aria-live="polite"></span>
        ${src.kind === "page" ? `<button class="wp-ib${m.fav ? " on" : ""}" data-a="fav" title="${m.fav ? "Remove from favourites" : "Add to favourites"}" aria-label="Favourite">${WI("star", 18)}</button>` : ""}
        <button class="wp-ib" data-a="more" title="More" aria-label="More">${WI("more", 18)}</button></div>
      <div class="wp-scroll">
        ${ctx.head ? "" : m.cover ? `<div class="wp-cover" style="background:${coverStyle(m.cover)}"><div class="wp-cvb"><button data-a="cover">Change cover</button><button data-a="nocover">Remove</button></div></div>` : ""}
        <div class="wp-in${m.cover && !ctx.head ? " has-cover" : ""}">
          ${ctx.head ? `<div class="wp-head">${ctx.head(m)}</div>` : `${m.icon && ICONS[m.icon] ? `<button class="wp-icon" data-a="icon" title="Change icon" aria-label="Change icon">${WI(m.icon, 40)}</button>` : ""}
          <div class="wp-add">${!(m.icon && ICONS[m.icon]) ? `<button data-a="icon">${WI("smile", 15)}Add icon</button>` : ""}${!m.cover ? `<button data-a="cover">${WI("image", 15)}Add cover</button>` : ""}</div>`}
          <textarea class="wp-title" rows="1" placeholder="Untitled" aria-label="Page title" maxlength="200"></textarea>
          ${src.kind === "row" && !ctx.noProps ? `<div class="wp-props"></div>` : ""}${ctx.afterTitle ? ctx.afterTitle(m) : ""}
          ${P.conflict ? `<div class="wp-conf">${WI("warning", 18)}<span>This page was changed on another device while you were writing.</span><button data-a="mine">Keep mine</button><button data-a="theirs">Use theirs</button></div>` : ""}
          ${ctx.edLabel ? `<div class="wp-edl">${ctx.edLabel}</div>` : ""}<div class="wp-ed"></div>
          ${src.kind === "page" ? `<div class="wp-kids"></div>` : ""}
        </div>
      </div>`;
    const t = root.querySelector(".wp-title"); t.value = m.title || "";
    const fit = () => { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }; requestAnimationFrame(fit);
    t.oninput = () => { fit(); clearTimeout(t.__t); t.__t = setTimeout(() => setMeta({ title: t.value }), 400); const c = root.querySelector(".wp-crumbs .cur"); if (c) c.textContent = t.value || "Untitled"; };
    t.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); P.ed && P.ed.focus && P.ed.focus("start"); root.querySelector(".wp-ed .rb-e")?.focus(); } };
    root.querySelector('[data-a="back"]').onclick = () => ctx.back && ctx.back();
    root.querySelector('[data-a="home"]').onclick = () => ctx.home && ctx.home();
    const cr = crumbs(); root.querySelectorAll("[data-crumb]").forEach((b) => (b.onclick = () => cr[+b.dataset.crumb].go()));
    root.querySelectorAll('[data-a="icon"]').forEach((b) => (b.onclick = () => iconPick(b, meta().icon, (ic) => { setMeta({ icon: ic }); setTimeout(redrawHead, 30); })));
    root.querySelectorAll('[data-a="cover"]').forEach((b) => (b.onclick = () => coverPick(b)));
    root.querySelector('[data-a="nocover"]')?.addEventListener("click", () => { setMeta({ cover: null }); setTimeout(redrawHead, 30); });
    root.querySelector('[data-a="fav"]')?.addEventListener("click", (e) => { const on = !meta().fav; setMeta({ fav: on }); e.currentTarget.classList.toggle("on", on); });
    root.querySelector('[data-a="more"]').onclick = (e) => moreMenu(e.currentTarget);
    root.querySelector('[data-a="mine"]')?.addEventListener("click", () => { P.conflict = null; save(true); draw(); mountEd(); });
    root.querySelector('[data-a="theirs"]')?.addEventListener("click", () => { const c = P.conflict; P.conflict = null; P.blocks = c.blocks; P.updated = c.updated; P.dirty = false; draw(); mountEd(); });
    if (src.kind === "row" && !ctx.noProps) drawProps();
    if (ctx.wireHead) ctx.wireHead(root, m, { redraw: () => redrawHead() });
    if (src.kind === "page") drawKids();
  }
  // icon or cover changed: draw again but keep the editor (and the caret) as it is
  function redrawHead() { const ed = root.querySelector(".wp-ed"), keep = ed && ed.firstChild ? ed : null; const blocks = P.ed ? P.ed.getBlocks() : P.blocks; P.blocks = blocks; if (keep) { const frag = [...keep.childNodes]; draw(); const n = root.querySelector(".wp-ed"); n.replaceWith(keep); } else { draw(); mountEd(); } }
  function coverPick(anchor) {
    const box = h("div", { class: "wd-menu" }); box.append(h("div", { class: "wd-mh" }, "Cover"));
    const g = h("div", { class: "wp-covers" });
    for (const k of Object.keys(COVERS)) { const b = h("button", { type: "button", style: `background:${coverCss({ k })}`, "aria-label": "Cover " + k }); b.onclick = () => { closePop(); setMeta({ cover: { k, y: 50 } }); setTimeout(redrawHead, 30); }; g.append(b); }
    box.append(g); popover(anchor, box, { w: 300 });
  }
  function moreMenu(anchor) {
    const m = meta(), items = [];
    if (src.kind === "page") items.push({ t: m.full ? "Normal width" : "Full width", i: "width", run: () => { setMeta({ full: !m.full }); setTimeout(() => root.classList.toggle("full", !m.full), 30); } });
    items.push({ t: "Download as Markdown", i: "download", run: () => { const blocks = P.ed ? P.ed.getBlocks() : P.blocks; const md = `# ${m.title || "Untitled"}\n\n` + blocksToMd(blocks); const a = h("a", { href: URL.createObjectURL(new Blob([md], { type: "text/markdown" })), download: (m.title || "page").replace(/[^\w -]+/g, "").slice(0, 60) + ".md" }); a.click(); } });
    items.push({ t: "Copy text", i: "copy", run: () => { try { navigator.clipboard.writeText(blocksText(P.ed ? P.ed.getBlocks() : P.blocks, "\n")); toast("Copied"); } catch {} } });
    items.push({ t: "Earlier versions", i: "history", run: () => history(anchor) });
    if (src.kind === "page") items.push("-", { t: "Move to the bin", i: "trash", danger: true, run: async () => { if (await confirmBox("Move this page to the bin? You can bring it back from the bin.", "Move to bin")) { await setMeta({ trashed: true }); ctx.back && ctx.back(); } } });
    if (src.kind === "row") items.push("-", { t: "Delete row", i: "trash", danger: true, run: async () => { if (await confirmBox("Delete this row? An earlier copy of the database is kept.", "Delete")) { DB.ops(src.db, [{ op: "delrow", id: src.id }]); ctx.back && ctx.back(); } } });
    if (src.kind === "bpage") items.push("-", { t: "Show on its board", i: "grid", run: () => ctx.openBoard && ctx.openBoard(src.board, src.id) });
    choose(anchor, items, { w: 240 });
  }
  async function history(anchor) {
    const r = await api(`/api/boards?page=${src.id}&a=history`); const list = (r.ok && r.data.history) || [];
    if (!list.length) return toast("No earlier versions yet. They are kept every few minutes while you write.");
    choose(anchor, [{ head: "Put back an earlier version" }, ...list.slice(0, 20).map((v) => ({ t: new Date(v.ts).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) + ` · ${words(v.blocks)} words`, i: "history", run: async () => { if (!(await confirmBox("Replace the writing with this version? What is here now is kept as a version too.", "Put back"))) return; P.blocks = v.blocks; P.ed && P.ed.setBlocks(v.blocks); touch(true); } }))], { w: 300 });
  }

  /* ----- a row's properties ----- */
  function drawProps() {
    const box = root.querySelector(".wp-props"), d = DB.get(src.db); if (!box || !d) return;
    const row = d.rows[src.id]; if (!row) { box.innerHTML = `<p class="wd-empty">This row was deleted.</p>`; return; }
    box.innerHTML = d.props.map((p) => `<div class="wp-pr" data-p="${p.id}"><span class="wp-pn">${WI(TYPES[p.type].ico, 15)}<span>${esc(p.name)}</span></span><span class="wp-pv t-${p.type}" tabindex="0">${VE.cellHtml(row, p) || `<span class="wp-empty">Empty</span>`}</span></div>`).join("") + `<button class="wp-addp" data-a="addp">${WI("plus", 15)}Add a property</button>`;
    box.querySelectorAll(".wp-pr").forEach((el) => { const pv = el.querySelector(".wp-pv"); const go = (e) => { if (e.target.closest("a")) return; const p = d.props.find((x) => x.id === el.dataset.p); VE.editCell(DB.get(src.db).rows[src.id], p, pv); }; pv.onclick = go; pv.onkeydown = (e) => { if (e.key === "Enter") go(e); }; });
    box.querySelector('[data-a="addp"]').onclick = (e) => choose(e.currentTarget, [{ head: "Property type" }, ...Object.entries(TYPES).filter(([k]) => k !== "relation").map(([k, t]) => ({ t: t.name, i: t.ico, run: () => DB.ops(src.db, [{ op: "prop", prop: { id: rid(), name: t.name, type: k, ...(["select", "multi"].includes(k) ? { opts: [] } : {}), ...(k === "status" ? { opts: [{ id: rid(), name: "To do", color: "grey", group: "todo" }, { id: rid(), name: "Doing", color: "blue", group: "doing" }, { id: rid(), name: "Done", color: "green", group: "done" }] } : {}) } }]) }))], { w: 230 });
  }
  /* ----- pages and databases inside a page ----- */
  function drawKids() {
    const box = root.querySelector(".wp-kids"); if (!box) return;
    const kids = [...WS.pages.filter((p) => p.parent === src.id && !p.trashed).map((p) => ({ ...p, k: "page" })), ...WS.dbs.filter((d) => d.parent === src.id && !d.trashed).map((d) => ({ ...d, k: "db" }))];
    box.innerHTML = `${kids.length ? `<div class="wp-kh">Inside this page</div>` : ""}${kids.map((k) => `<button class="wp-kid" data-kid="${k.id}" data-k="${k.k}">${WI(k.icon && ICONS[k.icon] ? k.icon : k.k === "db" ? "db" : "file-text", 17)}<span>${esc(k.title || (k.k === "db" ? "Untitled database" : "Untitled"))}</span></button>`).join("")}
      <div class="wp-kadd"><button data-a="kpage">${WI("plus", 15)}Page inside</button><button data-a="kdb">${WI("db", 15)}Database inside</button></div>`;
    box.querySelectorAll("[data-kid]").forEach((b) => (b.onclick = () => (b.dataset.k === "db" ? ctx.openDb(b.dataset.kid) : ctx.openPage(b.dataset.kid))));
    box.querySelector('[data-a="kpage"]').onclick = async () => { const p = await WS.newPage({ parent: src.id }); if (p) ctx.openPage(p.id, { fresh: true }); };
    box.querySelector('[data-a="kdb"]').onclick = (e) => ctx.newDb && ctx.newDb(e.currentTarget, src.id);
  }

  /* ----- the writing ----- */
  const status = (t) => { const s = root.querySelector(".wp-st"); if (s) s.textContent = t; };
  function touch(now) { P.dirty = true; status("Saving soon…"); clearTimeout(P.saveT); P.saveT = setTimeout(() => save(), now ? 50 : 900); }
  async function save(force) {
    if (!P.ed || P.saving || P.conflict) return; clearTimeout(P.saveT); P.saveT = 0;
    if (!P.dirty && !force) return;
    P.saving = true; P.dirty = false; status("Saving…");
    const blocks = P.ed.getBlocks();
    const r = await api("/api/boards?page=" + src.id, { method: "PUT", body: { blocks, base: P.updated, title: meta().title || "", force: !!force } });
    P.saving = false;
    if (r.status === 409) { P.conflict = { blocks: r.data.blocks || [], updated: r.data.updated || 0 }; P.blocks = blocks; status(""); draw(); mountEd(); return; }
    if (!r.ok) { P.dirty = true; status(r.status === 0 ? "Offline. Saved here, sent when you're back." : "Not saved yet. Trying again…"); try { localStorage.setItem("wpDraft:" + src.id, JSON.stringify({ blocks, ts: Date.now() })); } catch {} P.saveT = setTimeout(() => save(), 4000); return; }
    P.updated = r.data.updated; P.blocks = blocks; try { localStorage.removeItem("wpDraft:" + src.id); } catch {}
    status("Saved"); setTimeout(() => { if (!P.dirty && !P.saving) status(""); }, 1600);
    const snip = r.data.snip || "";
    if (src.kind === "page") WS.setPage(src.id, { snip });
    else if (src.kind === "row") DB.ops(src.db, [{ op: "row", row: { id: src.id, snip } }]);
    else if (P.item) setMeta({ snip, words: r.data.words || 0, edited: Date.now() });
    if (P.dirty) touch();
  }
  async function mountEd() {
    const host2 = root.querySelector(".wp-ed"); if (!host2) return;
    P.ed = await makeEditor(host2, { blocks: P.blocks, placeholder: "Type '/' for blocks, or just start writing…", onChange: () => touch() });
  }
  async function load() {
    if (src.kind === "row") { await DB.open(src.db); }
    if (src.kind === "page" && !WS.page(src.id)) await WS.load();
    if (src.kind === "bpage") { const r = await api("/api/boards?id=" + src.board); if (r.ok) { P.board = r.data.board; P.item = r.data.doc.items[src.id] || null; } }
    const r = await api("/api/boards?page=" + src.id);
    if (P.dead) return;
    P.blocks = r.ok ? r.data.blocks || [] : []; P.updated = r.ok ? r.data.updated || 0 : 0;
    // writing that never reached the server last time comes back
    try { const d = JSON.parse(localStorage.getItem("wpDraft:" + src.id) || "null"); if (d && d.ts > P.updated) { P.blocks = d.blocks; P.dirty = true; setTimeout(() => touch(true), 300); } } catch {}
    draw(); await mountEd();
    if (src.fresh) setTimeout(() => root.querySelector(".wp-title")?.focus(), 60);
  }
  const offDb = src.kind === "row" ? DB.on(src.db, () => { if (P.dead) return; if (!ctx.noProps) drawProps(); if (ctx.onRowChange) ctx.onRowChange(root, meta()); }) : null;
  const offWs = WS.on(() => { if (!P.dead && src.kind === "page") drawKids(); });
  // live: another device's saved writing comes in while nothing is being typed here
  const live = setInterval(async () => {
    if (P.dead || P.dirty || P.saving || P.conflict || document.visibilityState !== "visible" || !P.ed) return;
    const r = await api("/api/boards?page=" + src.id); if (!r.ok || P.dirty || P.saving) return;
    if ((r.data.updated || 0) > P.updated) { P.updated = r.data.updated; P.blocks = r.data.blocks || []; P.ed.setBlocks(P.blocks); status("Updated from your other device"); setTimeout(() => status(""), 3000); }
  }, 15000);
  const onHide = () => { if (P.dirty && P.ed) { const blocks = P.ed.getBlocks(); try { localStorage.setItem("wpDraft:" + src.id, JSON.stringify({ blocks, ts: Date.now() })); } catch {} api("/api/boards?page=" + src.id, { method: "PUT", body: { blocks, base: P.updated }, keepalive: true }); } };
  addEventListener("pagehide", onHide);
  load();
  return {
    async flush() { if (P.dirty) await save(); },
    destroy() { P.dead = true; clearInterval(live); removeEventListener("pagehide", onHide); offDb && offDb(); offWs(); if (P.dirty) save(); closePop(); },
  };
}
