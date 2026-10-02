// Docs: a workspace of pages inside pages, written in the same block editor as the Journal (like Notion).
// Private by default. The owner can publish a page to the web, and it then has its own address, /docs/<slug>.
import { h, $, $$, esc, api, isAdmin, toast, mobile, showBlocks, wireBlocks, makeEditor, Up, share, confirmBox, ago } from "/js/lib.mjs";
import { blocksToMd, blocksText, slugify } from "/shared/blocks.mjs";
import { R } from "/js/os-ext.mjs";
import { icon, ICONS } from "/shared/icons.mjs";
const I = (n, size = 16) => icon(n, { size });
const pageIco = (p, size = 17) => I(p && p.icon && ICONS[p.icon] ? p.icon : "file-text", size);

const D = { pages: null, open: null, ed: null, saveT: null, blocks: [], status: "", loaded: false };
const CACHE = {}; // pages just made here: the server can take a moment to list them, so open them from what we sent
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const PAGE_ICONS = ["file-text", "file", "folder", "bookmark", "checkbox", "target", "rocket", "bulb", "star", "heart", "flame", "sparkles", "leaf", "globe", "home", "wallet", "brain", "palette", "video", "music", "camera", "laptop", "settings", "wrench", "chart", "trend", "calendar", "clock", "chat", "mail", "phone", "lock", "flask", "compass", "coffee", "plane", "trophy", "gift", "graduation", "cat", "shield", "map", "user", "pencil", "tag", "image", "table", "code"];
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
    const pages = live(), favs = pages.filter((p) => p.fav), trashed = (D.pages || []).filter((p) => p.trashed && !(p.parent && byId(p.parent)?.trashed));
    const row = (p, depth) => {
      const ch = kids(p.id), isOpen = !!open[p.id];
      return `<div class="dx-node"><div class="dx-it${D.open && D.open.id === p.id ? " on" : ""}" data-id="${p.id}" style="--d:${depth}" ${owner ? 'draggable="true"' : ""} role="treeitem" aria-level="${depth + 1}" ${ch.length ? `aria-expanded="${isOpen}"` : ""}>
        <button class="dx-tw${ch.length ? "" : " nokid"}" data-tw="${p.id}" aria-label="${isOpen ? "Collapse" : "Expand"}">${I("chevron-right", 14)}</button>
        <button class="dx-nm" data-go="${p.id}"><span class="dx-em">${pageIco(p)}</span><span class="dx-t">${esc(label(p))}</span>${p.pub ? '<i class="dx-pubdot" title="Published"></i>' : ""}</button>
        ${owner ? `<button class="dx-add" data-add="${p.id}" aria-label="Add a page inside" title="Add a page inside">${I("plus", 15)}</button>` : ""}</div>${ch.length && isOpen ? `<div class="dx-kids" role="group">${ch.map((c) => row(c, depth + 1)).join("")}</div>` : ""}</div>`;
    };
    let tree;
    if (q.text) {
      const m = pages.filter((p) => label(p).toLowerCase().includes(q.text.toLowerCase()));
      tree = m.length ? m.map((p) => `<div class="dx-node"><div class="dx-it${D.open && D.open.id === p.id ? " on" : ""}" data-id="${p.id}" style="--d:0"><span class="dx-tw nokid"></span><button class="dx-nm" data-go="${p.id}"><span class="dx-em">${pageIco(p)}</span><span class="dx-t">${esc(label(p))}</span></button></div></div>`).join("") : '<p class="dx-none">No pages match.</p>';
    } else tree = kids(null).map((p) => row(p, 0)).join("") || `<p class="dx-none">${owner ? "No pages yet. Make your first one." : "Nothing is published yet."}</p>`;
    side.innerHTML = `<div class="dx-sh"><b>Docs</b><button class="dx-ib dx-tg" data-tg aria-label="Hide the sidebar" title="Hide the sidebar (Ctrl+\\)">${I("panel-left", 18)}</button></div>
      ${owner ? `<button class="dx-newrow" data-new>${I("plus", 16)}<span>New page</span></button>` : ""}
      <label class="dx-search">${I("search", 16)}<input type="search" placeholder="Search pages" value="${esc(q.text)}" aria-label="Search pages" autocomplete="off"></label>
      <div class="dx-scroll"><button class="dx-home${D.open ? "" : " on"}" data-home>${I("home", 16)}<span>Home</span></button>
      ${!q.text && favs.length ? `<h4>Favorites</h4>${favs.map((p) => `<div class="dx-node"><div class="dx-it${D.open && D.open.id === p.id ? " on" : ""}" data-id="${p.id}" style="--d:0"><span class="dx-tw nokid"></span><button class="dx-nm" data-go="${p.id}"><span class="dx-em">${pageIco(p)}</span><span class="dx-t">${esc(label(p))}</span></button></div></div>`).join("")}` : ""}
      <h4>${q.text ? "Results" : owner ? "Pages" : "Published"}</h4><div role="tree">${tree}</div>
      ${owner ? `<button class="dx-home dx-trash" data-trash>${I("trash", 16)}<span>Bin${trashed.length ? ` (${trashed.length})` : ""}</span></button>` : ""}</div>`;
    const search = $(".dx-search input", side);
    search.oninput = () => { q.text = search.value; const pos = search.selectionStart; drawSide(); const s2 = $(".dx-search input", side); s2.focus(); s2.setSelectionRange(pos, pos); };
    $$("[data-go]", side).forEach((b) => (b.onclick = () => openId(b.dataset.go)));
    $$("[data-tw]", side).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const id = b.dataset.tw; open[id] = !open[id]; ls.set("dxOpen", open); drawSide(); }));
    $$("[data-add]", side).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); open[b.dataset.add] = true; ls.set("dxOpen", open); newPage({ parent: b.dataset.add }); }));
    $("[data-new]", side)?.addEventListener("click", () => newPage({}));
    $("[data-tg]", side)?.addEventListener("click", () => toggleSide());
    $("[data-home]", side).onclick = () => home();
    $("[data-trash]", side)?.addEventListener("click", showTrash);
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

  /* ----- pages ----- */
  async function newPage({ parent = null } = {}) {
    const r = await api("/api/docs", { method: "POST", body: { title: "", icon: "", parent, blocks: [] } });
    if (!r.ok) return toast(r.data.error || "Could not create the page");
    const pg = r.data.page; D.pages.push(pg); CACHE[pg.id] = { blocks: [] };
    if (mobile()) root.dataset.view = "page";
    drawSide(); await openId(pg.id, { fresh: true });
  }
  function home(mode = "push") {
    flush(); D.open = null; root.dataset.view = "list"; drawSide();
    const recent = live().slice().sort((a, b) => b.updated - a.updated).slice(0, 12);
    main.innerHTML = `<div class="dx-top">${mobile() ? "" : `<button class="dx-ib dx-tg" data-tg aria-label="Show the sidebar" title="Show the sidebar">${I("panel-left", 18)}</button>`}<span class="dx-crumbs"></span></div>
      <div class="dx-scrollmain"><div class="dx-home-view"><h1>${owner ? "Your workspace" : "Docs"}</h1><p class="dx-lead">${owner ? "Notes, plans and write-ups. Pages are private until you publish them." : "Guides and write-ups published by Rohan."}</p>
      ${owner ? `<button class="btn dx-hbtn" data-new>${I("plus", 16)}<span>New page</span></button>` : ""}
      ${recent.length ? `<h3>${owner ? "Recently edited" : "Pages"}</h3><div class="dx-recent">${recent.map((p) => `<button data-go="${p.id}"><span class="dx-em">${pageIco(p)}</span><b>${esc(label(p))}</b><small>${ago(p.updated)}${p.pub ? " · Published" : ""}</small></button>`).join("")}</div>` : (owner ? '<div class="dx-empty"><h2>No pages yet</h2><p>Make your first one with “New page”.</p></div>' : '<div class="dx-empty"><h2>Nothing here yet</h2><p>Pages published by Rohan will show up here.</p></div>')}</div></div>`;
    $$("[data-go]", main).forEach((b) => (b.onclick = () => openId(b.dataset.go)));
    $("[data-new]", main)?.addEventListener("click", () => newPage({}));
    $("[data-tg]", main)?.addEventListener("click", () => toggleSide());
    R.item(body, "", "Docs — Rohan Kumar", mode);
  }
  function openKey(key, mode) { const p = find(key); if (p) return openId(p.id, { mode }); toast("That page isn't available."); return home(mode); }

  async function openId(id, { mode = "push", fresh } = {}) {
    await flush();
    const meta = byId(id); if (!meta) return home(mode);
    let blocks;
    if (CACHE[id]) blocks = CACHE[id].blocks;
    else { const r = await api("/api/docs?id=" + id); if (!r.ok) { toast(r.status === 404 ? "That page isn't available." : "Could not open the page"); return home(mode); } blocks = r.data.blocks; }
    delete CACHE[id];
    let recovered = false; { const dr = owner && !meta.trashed ? draftRead(id) : null;
      if (dr && Array.isArray(dr.blocks) && JSON.stringify(dr.blocks) !== JSON.stringify(blocks)) {
        if ((meta.updated || 0) <= (dr.base || 0)) { blocks = dr.blocks; if (dr.title != null) meta.title = dr.title; recovered = true; } // nothing newer was saved since: carry on from the draft
        else { await api("/api/docs", { method: "POST", body: { title: (dr.title || "Untitled") + " (my edit)", parent: meta.parent || null, blocks: dr.blocks } }); draftClear(); await load(true); drawSide(); toast("Text that was not saved is kept as a separate page."); } // the page changed meanwhile: keep both
      } else if (dr) draftClear(); }
    D.open = { ...meta }; D.blocks = blocks; D.status = "";
    root.dataset.view = "page"; drawSide();
    const editable = owner && !meta.trashed;
    main.innerHTML = `<div class="dx-top"><button class="dx-back" data-back aria-label="Back to pages">${I("chevron-left", 20)}</button><button class="dx-ib dx-tg" data-tg aria-label="Show the sidebar" title="Show the sidebar (Ctrl+\\)">${I("panel-left", 18)}</button><nav class="dx-crumbs" aria-label="Breadcrumb"></nav><span class="dx-st"></span>
        ${editable ? `<button class="dx-b" data-share>Share</button><button class="dx-b icon" data-menu aria-label="More" title="More">${I("more", 18)}</button>` : `<button class="dx-b" data-copy>Copy link</button><button class="dx-b icon" data-pdf aria-label="Save as PDF" title="Save as PDF">${I("download", 18)}</button>`}</div>
      <div class="dx-scrollmain"><div class="dx-page${ls.get("dxWide", false) ? " wide" : ""}"><div class="dx-cover" data-cover></div>
        <div class="dx-head"><button class="dx-icon" data-icon aria-label="Page icon"></button>${editable ? '<div class="dx-adds"></div>' : ""}<textarea class="dx-title" rows="1" placeholder="Untitled" maxlength="160" aria-label="Page title" ${editable ? "" : "readonly"}></textarea></div>
        <div class="dx-body"></div><div class="dx-subs"></div><footer class="dx-foot"></footer></div></div>`;
    const title = $(".dx-title", main), host = $(".dx-body", main);
    title.value = meta.title || "";
    const fit = () => { title.style.height = "auto"; title.style.height = title.scrollHeight + "px"; };
    setTimeout(fit, 0); title.addEventListener("input", () => { fit(); D.open.title = title.value; const m = byId(id); if (m) m.title = title.value; touch(); drawCrumbs(); const t = $(`.dx-it[data-id="${id}"] .dx-t`, side); if (t) t.textContent = label(D.open); });
    title.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); D.ed && D.ed.focus("start"); } });
    $("[data-back]", main).onclick = () => { home(); };
    $("[data-tg]", main).onclick = () => toggleSide();
    $("[data-pdf]", main)?.addEventListener("click", () => exportPdf());
    drawCrumbs(); drawCover(); drawIcon(); drawAdds(); drawSubs(); drawFoot();
    if (editable) {
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
  async function flush() { if (D.ed) { try { D.ed.flush && D.ed.flush(); } catch {} } if (D.saveT) { clearTimeout(D.saveT); D.saveT = null; await save(); } if (D.ed) { try { D.ed.destroy(); } catch {} D.ed = null; } }
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
        { t: "Duplicate", i: "copy", run: async () => { await flush(); const r0 = await api("/api/docs?id=" + p.id); const r = await api("/api/docs", { method: "POST", body: { title: label(p) + " (copy)", icon: p.icon, parent: p.parent, cover: p.cover, blocks: r0.data.blocks } }); if (r.ok) { D.pages.push(r.data.page); openId(r.data.page.id); } } },
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
    await flush(); D.open = null; root.dataset.view = "page"; drawSide();
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
          ["Duplicate", async () => { await flush(); const r0 = await api("/api/docs?id=" + id); const r = await api("/api/docs", { method: "POST", body: { title: label(pg) + " (copy)", icon: pg.icon, parent: pg.parent, cover: pg.cover, blocks: r0.ok ? r0.data.blocks : [] } }); if (r.ok) { D.pages.push(r.data.page); drawSide(); openId(r.data.page.id); } }]);
      }
      if (pg.pub) items.push(["Copy public link", () => copyUrl(pg)]);
      if (owner) items.push(null, ["Move to bin", async () => { await flush(); const r = await api("/api/docs?id=" + id, { method: "PUT", body: { trashed: true } }); if (r.ok) { await load(true); toast("Moved to the bin"); if (D.open && D.open.id === id) home(); else drawSide(); } }, "danger"]);
      return items;
    }
    if (el.closest(".dx-side")) { if (owner) items.push(["New page", () => newPage({})]); items.push(["Home", () => home()], sideTg); return items; }
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
  body.addEventListener("keydown", (e) => {
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === "s") { e.preventDefault(); if (owner) { save().then(() => toast("Saved")); } }
    else if (mod && e.key === "\\") { e.preventDefault(); toggleSide(); }
    else if (mod && e.altKey && k === "n" && owner) { e.preventDefault(); newPage({ parent: D.open ? D.open.id : null }); }
  });
}
