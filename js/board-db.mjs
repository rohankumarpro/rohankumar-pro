// The database view of a board: the same items as the canvas, shown as a table, a gallery or a list (like a Notion
// database). It reads and changes the canvas's own items, so both views always show the same thing, with one undo and one
// way of saving. Pages open as full documents; notes are edited right in their row or card.
import { h, esc, mobile, lightbox } from "/js/lib.mjs";
import { renderBlocks } from "/shared/blocks.mjs";
import { ICONS } from "/shared/icons.mjs";
import { I, menu } from "/js/board-canvas.mjs";
import { coverCss, COLORS, STICKY } from "/js/board-covers.mjs";

const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const KIND = { page: ["Page", "page"], sticky: ["Note", "sticky"], text: ["Text", "type"], image: ["Picture", "image"], link: ["Link", "link"] };
const FILTERS = [["all", "All"], ["page", "Pages"], ["sticky", "Notes"], ["text", "Text"], ["image", "Pictures"], ["link", "Links"]];
const SORTS = [["edited", "Last edited"], ["name", "Name"], ["type", "Type"], ["board", "Board order"]];
const GROUPS = [["none", "No groups"], ["section", "Section"], ["type", "Type"]];
const ago = (ts) => { if (!ts) return ""; const s = (Date.now() - ts) / 1000; if (s < 60) return "just now"; if (s < 3600) return Math.round(s / 60) + " min ago"; if (s < 86400) return Math.round(s / 3600) + " h ago"; if (s < 86400 * 7) return Math.round(s / 86400) + " d ago"; return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }); };
const firstLine = (t) => String(t || "").split("\n").find((l) => l.trim()) || "";
const titleOf = (it) => it.t === "page" ? it.title || "Untitled" : it.t === "sticky" || it.t === "text" ? firstLine(it.text) || "Empty note" : it.t === "image" ? it.cap || it.name || "Picture" : it.t === "link" ? it.title || it.url : "";
const plainOnly = (() => { try { const d = document.createElement("div"); d.contentEditable = "plaintext-only"; return d.contentEditable === "plaintext-only"; } catch { return false; } })();

export function mountDb(host, ctx) {
  // ctx: { cv(), board(), owner, openPage(it), showOnBoard(id), setTitle(v), bodies, boardId }
  const owner = ctx.owner && !mobile();
  const key = "bdDb:" + ctx.boardId;
  const st = Object.assign({ view: mobile() ? "list" : "table", type: "all", sort: "edited", group: "none", q: "" }, ls.get(key, {}));
  const save = () => ls.set(key, { view: st.view, type: st.type, sort: st.sort, group: st.group });
  let editing = null, stale = false, collapsed = new Set();

  host.innerHTML = `<div class="db bdc"><div class="db-in">
      <header class="db-hero"><div class="db-cover"></div><span class="db-icon"></span><input class="db-title" maxlength="120" aria-label="Board name" placeholder="Untitled board" ${owner ? "" : "readonly"}><p class="db-meta"></p></header>
      <div class="db-bar">
        <div class="db-tabs" role="tablist">${[["table", "table", "Table"], ["gallery", "grid", "Gallery"], ["list", "list", "List"]].map(([v, ic, t]) => `<button role="tab" data-view="${v}" aria-selected="${st.view === v}">${I(ic, 17)}<span>${t}</span></button>`).join("")}</div>
        <span class="db-sp"></span>
        <label class="db-search">${I("search", 17)}<input type="search" placeholder="Search" aria-label="Search this board" autocomplete="off"></label>
        <button class="db-btn" data-a="sort">${I("swap", 16)}<span></span></button>
        <button class="db-btn" data-a="group">${I("rows", 16)}<span></span></button>
        ${owner ? `<button class="db-new" data-a="new">${I("plus", 18)}<span>New</span></button>` : ""}
      </div>
      <div class="db-chips" role="group" aria-label="Show">${FILTERS.map(([v, t]) => `<button data-type="${v}" aria-pressed="${st.type === v}">${t}<em></em></button>`).join("")}</div>
      <div class="db-body"></div>
    </div></div>`;
  const root = host.querySelector(".db"), body = host.querySelector(".db-body"), titleIn = host.querySelector(".db-title"), search = host.querySelector(".db-search input");
  search.value = st.q || "";

  /* ---------- data ---------- */
  function rows() {
    const cv = ctx.cv(); if (!cv) return { rows: [], all: [] };
    const order = cv.order(), pos = new Map(order.map((it, i) => [it.id, i]));
    let list = order.filter((it) => KIND[it.t]);
    const q = st.q.trim().toLowerCase();
    const all = list;
    if (st.type !== "all") list = list.filter((it) => it.t === st.type);
    if (q) list = list.filter((it) => [it.text, it.title, it.snip, it.desc, it.url, it.name, it.cap].filter(Boolean).join(" ").toLowerCase().includes(q));
    const r = list.map((it) => ({ it, title: titleOf(it), kind: KIND[it.t][0], ic: it.t === "page" && it.icon && ICONS[it.icon] ? it.icon : KIND[it.t][1], section: (cv.frameOf(it) || {}).title || "", edited: it.edited && it.t === "page" ? Math.max(it.edited, it.ts || 0) : it.ts || 0, pos: pos.get(it.id) }));
    const by = { edited: (a, b) => b.edited - a.edited, name: (a, b) => a.title.localeCompare(b.title), type: (a, b) => a.kind.localeCompare(b.kind) || a.pos - b.pos, board: (a, b) => a.pos - b.pos }[st.sort] || ((a, b) => a.pos - b.pos);
    r.sort(by);
    return { rows: r, all };
  }

  /* ---------- drawing ---------- */
  function draw() {
    if (editing) { stale = true; return; }
    stale = false;
    const b = ctx.board() || {}, { rows: list, all } = rows();
    // header
    const cov = host.querySelector(".db-cover"); cov.style.background = b.cover ? (b.cover.k ? coverCss(b.cover) : `url('${esc(b.cover.src)}') center/cover`) : ""; cov.classList.toggle("has", !!b.cover);
    host.querySelector(".db-icon").innerHTML = I(b.icon && ICONS[b.icon] ? b.icon : "grid", 30);
    if (document.activeElement !== titleIn) titleIn.value = b.title || "";
    const counts = {}; for (const it of all) counts[it.t] = (counts[it.t] || 0) + 1;
    host.querySelector(".db-meta").textContent = [[counts.page, "page"], [counts.sticky, "note"], [counts.text, "text"], [counts.image, "picture"], [counts.link, "link"]].filter(([n]) => n).map(([n, w]) => `${n} ${w}${n === 1 || w === "text" ? "" : "s"}`).join(" · ") || "Nothing here yet";
    host.querySelectorAll(".db-chips button").forEach((c) => { const v = c.dataset.type; c.setAttribute("aria-pressed", String(st.type === v)); c.querySelector("em").textContent = v === "all" ? all.length || "" : counts[v] || ""; c.hidden = v !== "all" && !counts[v] && st.type !== v; });
    host.querySelectorAll("[data-view]").forEach((t) => t.setAttribute("aria-selected", String(st.view === t.dataset.view)));
    host.querySelector('[data-a="sort"] span').textContent = SORTS.find((x) => x[0] === st.sort)[1];
    host.querySelector('[data-a="group"] span').textContent = st.group === "none" ? "Group" : "By " + GROUPS.find((x) => x[0] === st.group)[1].toLowerCase();
    root.dataset.view = st.view;
    // body
    if (!list.length) {
      body.innerHTML = `<div class="db-empty">${I(st.q ? "search" : "sparkles", 26)}<b>${st.q ? `Nothing matches “${esc(st.q)}”` : all.length ? "Nothing of this kind here" : "This board is empty"}</b>${owner && !all.length ? "<p>Add a page or a note with New, or switch to the board.</p>" : ""}</div>`;
      return;
    }
    const groups = [];
    if (st.group === "none") groups.push({ key: "", name: "", rows: list });
    else { const m = new Map(); for (const r of list) { const g = st.group === "section" ? r.section || "Not in a section" : r.kind; if (!m.has(g)) m.set(g, []); m.get(g).push(r); } for (const [k, v] of m) groups.push({ key: k, name: k, rows: v }); }
    body.innerHTML = groups.map((g) => {
      const shut = g.name && collapsed.has(g.key);
      const head = g.name ? `<button class="db-gh" data-g="${esc(g.key)}" aria-expanded="${!shut}">${I("chevron-down", 16)}<b>${esc(g.name)}</b><em>${g.rows.length}</em></button>` : "";
      if (shut) return `<section class="db-g">${head}</section>`;
      const inner = st.view === "table" ? table(g.rows) : st.view === "gallery" ? `<div class="db-gal">${g.rows.map(card).join("")}</div>` : `<div class="db-list">${g.rows.map(line).join("")}</div>`;
      return `<section class="db-g">${head}${inner}</section>`;
    }).join("");
  }
  const dot = (it) => it.color && COLORS[it.color] ? `<i class="db-dot" data-c="${it.color}"></i>` : "";
  const icTile = (r) => `<span class="db-ic t-${r.it.t}"${r.it.t === "sticky" ? ` data-c="${r.it.color || "yellow"}"` : ""}>${I(r.ic, 16)}</span>`;
  const editable = (it) => owner && !it.locked && (it.t === "sticky" || it.t === "text");
  function table(list) {
    return `<div class="db-tw"><table class="db-t"><thead><tr><th class="c-name">Name</th><th>Type</th><th>Section</th><th>Colour</th><th class="c-ed">Edited</th><th class="c-more"></th></tr></thead><tbody>${list.map((r) => `<tr data-id="${r.it.id}">
      <td class="c-name"><div class="db-nm">${icTile(r)}<span class="db-tt${editable(r.it) ? " ed" : ""}" data-edit="${r.it.id}">${esc(r.it.t === "sticky" || r.it.t === "text" ? r.it.text || "" : r.title)}</span>${r.it.t === "page" ? `<span class="db-open">${I("open", 14)}Open</span>` : ""}</div></td>
      <td><span class="db-kind">${r.kind}</span></td><td>${r.section ? `<span class="db-sec">${esc(r.section)}</span>` : '<span class="db-mute">—</span>'}</td>
      <td>${dot(r.it) || '<span class="db-mute">—</span>'}</td><td class="c-ed">${r.edited ? ago(r.edited) : '<span class="db-mute">—</span>'}</td>
      <td class="c-more"><button class="db-mb" data-more="${r.it.id}" aria-label="More" title="More">${I("more", 17)}</button></td></tr>`).join("")}</tbody></table></div>`;
  }
  function pagePreview(it) {
    const bd = ctx.bodies && ctx.bodies.get(it.id); if (!bd && ctx.bodies) ctx.bodies.want(it.id);
    if (bd && bd.blocks && bd.blocks.length) { try { return `<div class="db-pv bk-doc">${renderBlocks(bd.blocks.slice(0, 8), { hBase: 4 })}</div>`; } catch {} }
    return `<div class="db-pv"><p>${esc(it.snip || "Empty page")}</p></div>`;
  }
  function card(r) {
    const it = r.it, more = `<button class="db-mb" data-more="${it.id}" aria-label="More" title="More">${I("more", 17)}</button>`;
    if (it.t === "page") {
      const cv = coverCss(it.cover), img = it.cover && it.cover.src;
      return `<article class="db-card k-page" data-id="${it.id}" tabindex="0">${cv ? `<div class="db-cc" style="background:${cv}"></div>` : img ? `<div class="db-cc"><img src="${esc(img)}" alt="" loading="lazy"></div>` : ""}<div class="db-cb">${icTile(r)}<b>${esc(r.title)}</b>${pagePreview(it)}<small>${it.words ? it.words + " words · " : ""}${r.edited ? ago(r.edited) : ""}</small></div>${more}</article>`;
    }
    if (it.t === "sticky") return `<article class="db-card k-sticky${it.font === "hand" ? " hand" : ""}" data-id="${it.id}" data-c="${it.color || "yellow"}" tabindex="0"><div class="db-st${editable(it) ? " ed" : ""}" data-edit="${it.id}">${esc(it.text || "")}</div>${r.section ? `<small>${esc(r.section)}</small>` : ""}${more}</article>`;
    if (it.t === "text") return `<article class="db-card k-text${it.font === "hand" ? " hand" : ""}" data-id="${it.id}" tabindex="0"><div class="db-st${editable(it) ? " ed" : ""}" data-edit="${it.id}">${esc(it.text || "")}</div>${more}</article>`;
    if (it.t === "image") return `<article class="db-card k-image" data-id="${it.id}" tabindex="0"><div class="db-im"><img src="${esc(it.thumb || it.src)}" alt="${esc(it.name || "")}" loading="lazy"></div><div class="db-cb"><b>${esc(r.title)}</b></div>${more}</article>`;
    const img = it.yt ? `https://i.ytimg.com/vi/${it.yt}/hqdefault.jpg` : it.img;
    return `<article class="db-card k-link" data-id="${it.id}" tabindex="0">${img ? `<div class="db-im"><img src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"></div>` : ""}<div class="db-cb"><b>${esc(r.title)}</b><small>${esc(it.site || "")}</small></div>${more}</article>`;
  }
  function line(r) {
    const it = r.it;
    return `<div class="db-li" data-id="${it.id}" tabindex="0">${icTile(r)}<span class="db-tt${editable(it) ? " ed" : ""}" data-edit="${it.id}">${esc(it.t === "sticky" || it.t === "text" ? firstLine(it.text) || "" : r.title)}</span>${r.section ? `<span class="db-sec">${esc(r.section)}</span>` : ""}<span class="db-when">${r.edited ? ago(r.edited) : ""}</span><button class="db-mb" data-more="${it.id}" aria-label="More" title="More">${I("more", 17)}</button></div>`;
  }

  /* ---------- acting on items ---------- */
  const item = (id) => ctx.cv() && ctx.cv().item(id);
  function open(it, at) {
    if (!it) return;
    if (it.t === "page") return ctx.openPage(it);
    if (it.t === "image") { const imgs = rows().all.filter((x) => x.t === "image"); return lightbox(imgs.map((x) => ({ src: x.src, alt: x.name || "" })), Math.max(0, imgs.findIndex((x) => x.id === it.id))); }
    if (it.t === "link") return window.open(it.url, "_blank", "noopener");
    if (editable(it)) edit(it.id, at);
  }
  // notes are written right where they are: in the row, the card or the list line
  function edit(id, at) {
    const it = item(id), el = at || body.querySelector(`[data-edit="${id}"]`); if (!it || !el || editing) return;
    editing = id; const row = el.closest("[data-id]"); row && row.classList.add("editing");
    el.textContent = it.text || ""; el.contentEditable = plainOnly ? "plaintext-only" : "true"; el.spellcheck = true; el.focus();
    const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    const finish = (keep = true) => {
      if (editing !== id) return; editing = null;
      const v = el.innerText.replace(/\n$/, "");
      el.removeAttribute("contenteditable"); el.onkeydown = el.onblur = el.onpaste = null; row && row.classList.remove("editing");
      if (keep && v !== (it.text || "")) ctx.cv().patchItem(id, { text: v.slice(0, it.t === "text" ? 20000 : 6000) }, { history: true });
      if (stale) draw(); else draw();
    };
    el.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Escape") { e.preventDefault(); finish(true); } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); finish(true); } };
    el.onpaste = (e) => { if (plainOnly) return; e.preventDefault(); document.execCommand("insertText", false, e.clipboardData.getData("text/plain")); };
    el.onblur = () => finish(true);
  }
  function itemMenu(it, x, y) {
    if (!it) return;
    const cv = ctx.cv(), m = [];
    if (it.t === "page") m.push({ t: "Open", i: "open", run: () => ctx.openPage(it) });
    else if (editable(it)) m.push({ t: "Edit text", i: "pencil", run: () => edit(it.id) });
    else if (it.t === "image") m.push({ t: "View full size", i: "eye", run: () => open(it) });
    else if (it.t === "link") m.push({ t: "Open link", i: "external", run: () => open(it) });
    m.push({ t: "Show on the board", i: "fit", run: () => ctx.showOnBoard(it.id) });
    if (owner && !it.locked) {
      if (it.t === "sticky") m.push("-", { head: "Colour" }, { swatches: STICKY.map((c) => ({ c, name: COLORS[c].name, on: it.color === c, run: () => cv.patchItem(it.id, { color: c }, { history: true }) })) });
      if (it.t === "sticky" || it.t === "text") m.push({ head: "Font" }, { chips: [["", "Normal"], ["hand", "Handwriting"]].map(([f, t]) => ({ t, on: (it.font || "") === f, run: () => cv.patchItem(it.id, { font: f || undefined }, { history: true }) })) });
      m.push("-", { t: "Duplicate", i: "dup", run: () => cv.duplicateItems([it.id]) }, { t: "Delete", i: "trash", danger: true, run: () => cv.removeItems([it.id]) });
    }
    menu(x, y, m);
  }
  function newMenu(anchor) {
    const r = anchor.getBoundingClientRect(), cv = ctx.cv();
    menu(r.right - 220, r.bottom + 6, [
      { t: "Page", i: "page", run: () => { const it = cv.addFree("page", { title: "" }); ctx.openPage(it, { fresh: true }); } },
      { t: "Sticky note", i: "sticky", run: () => { const it = cv.addFree("sticky", { text: "" }); draw(); setTimeout(() => edit(it.id), 30); } },
      { t: "Text", i: "type", run: () => { const it = cv.addFree("text", { text: "" }); draw(); setTimeout(() => edit(it.id), 30); } },
    ]);
  }

  /* ---------- wiring ---------- */
  host.querySelectorAll("[data-view]").forEach((t) => (t.onclick = () => { st.view = t.dataset.view; save(); draw(); }));
  host.querySelectorAll("[data-type]").forEach((c) => (c.onclick = () => { st.type = c.dataset.type; save(); draw(); }));
  search.oninput = () => { st.q = search.value; draw(); };
  search.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Escape" && search.value) { search.value = ""; st.q = ""; draw(); } };
  titleIn.oninput = () => ctx.setTitle && ctx.setTitle(titleIn.value);
  titleIn.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Enter") titleIn.blur(); };
  host.querySelector('[data-a="sort"]').onclick = (e) => { const r = e.currentTarget.getBoundingClientRect(); menu(r.left, r.bottom + 6, [{ head: "Sort by" }, ...SORTS.map(([v, t]) => ({ t, i: st.sort === v ? "check" : "", run: () => { st.sort = v; save(); draw(); } }))]); };
  host.querySelector('[data-a="group"]').onclick = (e) => { const r = e.currentTarget.getBoundingClientRect(); menu(r.left, r.bottom + 6, [{ head: "Group by" }, ...GROUPS.map(([v, t]) => ({ t, i: st.group === v ? "check" : "", run: () => { st.group = v; collapsed = new Set(); save(); draw(); } }))]); };
  host.querySelector('[data-a="new"]')?.addEventListener("click", (e) => newMenu(e.currentTarget));
  body.addEventListener("click", (e) => {
    const more = e.target.closest("[data-more]"); if (more) { e.stopPropagation(); const r = more.getBoundingClientRect(); itemMenu(item(more.dataset.more), r.right - 230, r.bottom + 4); return; }
    const gh = e.target.closest("[data-g]"); if (gh) { const k = gh.dataset.g; collapsed.has(k) ? collapsed.delete(k) : collapsed.add(k); draw(); return; }
    if (e.target.closest("[contenteditable]")) return;
    const row = e.target.closest("[data-id]"); if (!row) return;
    const it = item(row.dataset.id), ed = e.target.closest("[data-edit]");
    open(it, ed && editable(it) ? ed : null);
  });
  body.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches("[data-id]")) { e.preventDefault(); open(item(e.target.dataset.id)); } });
  const offBodies = ctx.bodies && ctx.bodies.onChange(() => { if (st.view !== "table") draw(); });
  draw();

  return {
    el: root, refresh: draw,
    menuAt(e) { const row = e.target.closest("[data-id]"); if (row && !e.target.closest("[contenteditable]")) { itemMenu(item(row.dataset.id), e.clientX, e.clientY); return true; } return false; },
    destroy() { if (offBodies) offBodies(); host.textContent = ""; },
  };
}
