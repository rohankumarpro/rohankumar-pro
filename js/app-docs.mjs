// Docs: a workspace of pages inside pages, written in the same block editor as the Journal (like Notion).
// Private by default. The owner can publish a page to the web, and it then has its own address, /docs/<slug>.
import { h, $, $$, esc, api, isAdmin, toast, mobile, showBlocks, wireBlocks, makeEditor, Up, share, confirmBox, ago } from "/js/lib.mjs";
import { blocksToMd, blocksText, slugify } from "/shared/blocks.mjs";
import { R } from "/js/os-ext.mjs";

const D = { pages: null, open: null, ed: null, saveT: null, blocks: [], status: "", loaded: false };
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const EMOJI = "📄 📝 📓 📔 📒 📚 📖 🗂️ 📌 📎 ✅ ☑️ 🎯 🚀 💡 ⭐ ❤️ 🔥 ✨ 🌱 🌍 🏠 💼 🧠 🎨 🖌️ 🎬 🎧 📷 💻 ⚙️ 🔧 📊 📈 🗓️ ⏰ 💬 📣 🔒 🧪 🧭 🍀 ☕ 🍕 ✈️ 🏆 🎁 🎓 🪴 🐱".split(" ");
const GRADS = { g1: "linear-gradient(135deg,#a8e6cf,#dcedc1)", g2: "linear-gradient(135deg,#ffd3b6,#ffaaa5)", g3: "linear-gradient(135deg,#c3cfe2,#c3b1e1)", g4: "linear-gradient(135deg,#fddb92,#d1fdff)", g5: "linear-gradient(135deg,#84fab0,#8fd3f4)", g6: "linear-gradient(135deg,#fbc2eb,#a6c1ee)", g7: "linear-gradient(135deg,#cfd9df,#e2ebf0)", g8: "linear-gradient(135deg,#2e6b57,#1b3a30)" };
const P = (t) => ({ t: "p", h: esc(t) });
const H = (n, t) => ({ t: "h" + n, h: esc(t) });
const LI = (t) => ({ t: "ul", h: esc(t) });
const TD = (t, c) => ({ t: "todo", h: esc(t), ...(c ? { c: true } : {}) });
const TEMPLATES = [
  { name: "Blank page", icon: "📄", title: "", blocks: [] },
  { name: "Meeting notes", icon: "🗓️", title: "Meeting notes", blocks: [H(2, "Details"), P("Date · People · Goal"), H(2, "Agenda"), LI("Topic one"), LI("Topic two"), H(2, "Notes"), P(""), H(2, "Action items"), TD("First action"), TD("Second action")] },
  { name: "Project brief", icon: "🎯", title: "Project brief", blocks: [{ t: "callout", h: esc("One sentence on what this project is and why it matters."), e: "🎯", tone: "blue" }, H(2, "Goals"), LI("Goal"), H(2, "Scope"), P(""), H(2, "Timeline"), LI("Week 1"), LI("Week 2"), H(2, "Deliverables"), TD("Deliverable")] },
  { name: "To-do list", icon: "✅", title: "To-do", blocks: [TD("First thing"), TD("Second thing"), TD("Third thing")] },
  { name: "Daily log", icon: "📓", title: "Today", blocks: [H(2, "Focus"), P(""), H(2, "Wins"), LI(""), H(2, "Tomorrow"), TD("")] },
  { name: "Wiki page", icon: "📚", title: "Wiki page", blocks: [{ t: "toc" }, H(2, "Overview"), P(""), H(2, "Details"), P(""), H(2, "Related"), P("")] },
];

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
  const m = h("div", { class: "dx-pop", role: "menu" }, items.map((it) => it === "-" ? h("hr") : h("button", { role: "menuitem", class: it.danger ? "danger" : "", onclick: () => { m.remove(); it.run(); } }, h("span", { class: "ic" }, it.i || ""), it.t, it.hint ? h("small", {}, it.hint) : "")));
  const host = anchor.closest(".dx") || document.body; host.append(m);
  const a = anchor.getBoundingClientRect(), r = host.getBoundingClientRect();
  m.style.top = Math.min(a.bottom - r.top + 4, r.height - m.offsetHeight - 8) + "px";
  if (align === "right") m.style.right = Math.max(8, r.right - a.right) + "px"; else m.style.left = Math.max(8, a.left - r.left) + "px";
  setTimeout(() => document.addEventListener("pointerdown", function f(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener("pointerdown", f, true); } }, true), 0);
  return m;
}
function dialog(root, title, content, { wide } = {}) {
  const d = h("div", { class: "dx-dlg" }, h("div", { class: "dx-card" + (wide ? " wide" : ""), role: "dialog", "aria-modal": "true", "aria-label": title }, h("div", { class: "dx-card-h" }, h("b", {}, title), h("button", { class: "dx-x", "aria-label": "Close", onclick: () => d.remove() }, "✕")), content));
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
        <button class="dx-tw${ch.length ? "" : " nokid"}" data-tw="${p.id}" aria-label="${isOpen ? "Collapse" : "Expand"}"><svg viewBox="0 0 24 24" width="14" height="14"><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <button class="dx-nm" data-go="${p.id}"><span class="dx-em">${esc(p.icon || "📄")}</span><span class="dx-t">${esc(label(p))}</span>${p.pub ? '<i class="dx-pubdot" title="Published"></i>' : ""}</button>
        ${owner ? `<button class="dx-add" data-add="${p.id}" aria-label="Add a page inside" title="Add a page inside">＋</button>` : ""}</div>${ch.length && isOpen ? `<div class="dx-kids" role="group">${ch.map((c) => row(c, depth + 1)).join("")}</div>` : ""}</div>`;
    };
    let tree;
    if (q.text) {
      const m = pages.filter((p) => label(p).toLowerCase().includes(q.text.toLowerCase()));
      tree = m.length ? m.map((p) => `<div class="dx-node"><div class="dx-it${D.open && D.open.id === p.id ? " on" : ""}" data-id="${p.id}" style="--d:0"><span class="dx-tw nokid"></span><button class="dx-nm" data-go="${p.id}"><span class="dx-em">${esc(p.icon || "📄")}</span><span class="dx-t">${esc(label(p))}</span></button></div></div>`).join("") : '<p class="dx-none">No pages match.</p>';
    } else tree = kids(null).map((p) => row(p, 0)).join("") || `<p class="dx-none">${owner ? "No pages yet. Make your first one." : "Nothing is published yet."}</p>`;
    side.innerHTML = `<div class="dx-sh"><b>Docs</b>${owner ? '<button class="dx-new" data-new aria-label="New page" title="New page">＋ New</button>' : ""}</div>
      <label class="dx-search"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input type="search" placeholder="Search pages" value="${esc(q.text)}" aria-label="Search pages" autocomplete="off"></label>
      <div class="dx-scroll"><button class="dx-home${D.open ? "" : " on"}" data-home>🏠 <span>Home</span></button>
      ${!q.text && favs.length ? `<h4>Favorites</h4>${favs.map((p) => `<div class="dx-node"><div class="dx-it${D.open && D.open.id === p.id ? " on" : ""}" data-id="${p.id}" style="--d:0"><span class="dx-tw nokid"></span><button class="dx-nm" data-go="${p.id}"><span class="dx-em">${esc(p.icon || "📄")}</span><span class="dx-t">${esc(label(p))}</span></button></div></div>`).join("")}` : ""}
      <h4>${q.text ? "Results" : owner ? "Pages" : "Published"}</h4><div role="tree">${tree}</div>
      ${owner ? `<button class="dx-home dx-trash" data-trash>🗑️ <span>Bin${trashed.length ? ` (${trashed.length})` : ""}</span></button>` : ""}</div>`;
    const search = $(".dx-search input", side);
    search.oninput = () => { q.text = search.value; const pos = search.selectionStart; drawSide(); const s2 = $(".dx-search input", side); s2.focus(); s2.setSelectionRange(pos, pos); };
    $$("[data-go]", side).forEach((b) => (b.onclick = () => openId(b.dataset.go)));
    $$("[data-tw]", side).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const id = b.dataset.tw; open[id] = !open[id]; ls.set("dxOpen", open); drawSide(); }));
    $$("[data-add]", side).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); open[b.dataset.add] = true; ls.set("dxOpen", open); newPage({ parent: b.dataset.add }); }));
    $("[data-new]", side)?.addEventListener("click", () => newPage({}));
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
  async function newPage({ parent = null, template } = {}) {
    const t = template || TEMPLATES[0];
    const r = await api("/api/docs", { method: "POST", body: { title: t.title, icon: t.icon === "📄" ? "" : t.icon, parent, blocks: t.blocks } });
    if (!r.ok) return toast(r.data.error || "Could not create the page");
    D.pages.push(r.data.page); drawSide(); await openId(r.data.page.id, { fresh: true });
  }
  function home(mode = "push") {
    flush(); D.open = null; root.dataset.view = "list"; drawSide();
    const recent = live().slice().sort((a, b) => b.updated - a.updated).slice(0, 6);
    main.innerHTML = `<div class="dx-home-view">${mobile() ? "" : ""}<h1>${owner ? "Your workspace" : "Docs"}</h1><p class="dx-lead">${owner ? "Notes, plans and write-ups. Pages are private until you publish them." : "Guides and write-ups published by Rohan."}</p>
      ${owner ? `<h3>Start with a template</h3><div class="dx-tpl">${TEMPLATES.map((t, i) => `<button data-tpl="${i}"><span>${esc(t.icon)}</span><b>${esc(t.name)}</b></button>`).join("")}</div>` : ""}
      ${recent.length ? `<h3>${owner ? "Recently edited" : "Pages"}</h3><div class="dx-recent">${recent.map((p) => `<button data-go="${p.id}"><span class="dx-em">${esc(p.icon || "📄")}</span><b>${esc(label(p))}</b><small>${ago(p.updated)}${p.pub ? " · Published" : ""}</small></button>`).join("")}</div>` : (owner ? "" : '<div class="dx-empty"><h2>Nothing here yet</h2><p>Pages published by Rohan will show up here.</p></div>')}</div>`;
    $$("[data-tpl]", main).forEach((b) => (b.onclick = () => newPage({ template: TEMPLATES[+b.dataset.tpl] })));
    $$("[data-go]", main).forEach((b) => (b.onclick = () => openId(b.dataset.go)));
    R.item(body, "", "Docs — Rohan Kumar", mode);
  }
  function openKey(key, mode) { const p = find(key); if (p) return openId(p.id, { mode }); toast("That page isn't available."); return home(mode); }

  async function openId(id, { mode = "push", fresh } = {}) {
    await flush();
    const meta = byId(id); if (!meta) return home(mode);
    const r = await api("/api/docs?id=" + id);
    if (!r.ok) { toast(r.status === 404 ? "That page isn't available." : "Could not open the page"); return home(mode); }
    D.open = { ...meta }; D.blocks = r.data.blocks; D.status = "";
    root.dataset.view = "page"; drawSide();
    const editable = owner && !meta.trashed;
    main.innerHTML = `<div class="dx-top"><button class="dx-back" data-back aria-label="Back to pages">‹</button><nav class="dx-crumbs" aria-label="Breadcrumb"></nav><span class="dx-st"></span>
        ${editable ? `<button class="dx-b" data-share>Share</button><button class="dx-b icon" data-menu aria-label="More" title="More">⋯</button>` : `<button class="dx-b" data-copy>Copy link</button>`}</div>
      <div class="dx-scrollmain"><div class="dx-page${ls.get("dxWide", false) ? " wide" : ""}"><div class="dx-cover" data-cover></div>
        <div class="dx-head"><button class="dx-icon" data-icon aria-label="Page icon"></button><textarea class="dx-title" rows="1" placeholder="Untitled" maxlength="160" aria-label="Page title" ${editable ? "" : "readonly"}></textarea></div>
        <div class="dx-body"></div><div class="dx-subs"></div><footer class="dx-foot"></footer></div></div>`;
    const title = $(".dx-title", main), host = $(".dx-body", main);
    title.value = meta.title || "";
    const fit = () => { title.style.height = "auto"; title.style.height = title.scrollHeight + "px"; };
    setTimeout(fit, 0); title.addEventListener("input", () => { fit(); D.open.title = title.value; const m = byId(id); if (m) m.title = title.value; touch(); drawCrumbs(); const t = $(`.dx-it[data-id="${id}"] .dx-t`, side); if (t) t.textContent = label(D.open); });
    title.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); D.ed && D.ed.focus("start"); } });
    $("[data-back]", main).onclick = () => { home(); };
    drawCrumbs(); drawCover(); drawIcon(); drawSubs(); drawFoot();
    if (editable) {
      D.ed = await makeEditor(host, { blocks: D.blocks, placeholder: "Type '/' for blocks, or just start writing…", onChange: () => { touch(); drawFoot(); }, onStatus: (s) => { if (s) setStatus(s); } });
      if (fresh || !meta.title) setTimeout(() => title.focus(), 50);
    } else { showBlocks(host, D.blocks); wireBlocks(host); }
    R.item(body, keyOf(meta), `${label(meta)} — Docs`, mode);
    wireTop(editable);
    document.title = `${label(meta)} — Docs`;
  }

  function drawCrumbs() {
    const c = $(".dx-crumbs", main); if (!c || !D.open) return;
    c.innerHTML = crumbs(D.open).map((p, i, a) => `${i ? '<span class="sep">/</span>' : ""}<button data-go="${p.id}"${i === a.length - 1 ? ' aria-current="page"' : ""}>${esc(p.icon || "📄")} ${esc(label(p))}</button>`).join("");
    $$("[data-go]", c).forEach((b) => (b.onclick = () => openId(b.dataset.go)));
  }
  function drawIcon() {
    const b = $("[data-icon]", main); if (!b) return; const ic = D.open.icon;
    b.textContent = ic || (owner ? "☺" : "📄"); b.classList.toggle("empty", !ic); if (!ic && !owner) b.hidden = true;
    b.onclick = () => { if (!owner) return; iconPicker(b); };
  }
  function iconPicker(anchor) {
    const m = popup(anchor, [], { align: "left" }); m.classList.add("dx-emoji");
    m.innerHTML = `<div class="dx-eg">${EMOJI.map((e) => `<button data-e="${e}">${e}</button>`).join("")}</div><div class="dx-er"><input maxlength="4" placeholder="Type any emoji" aria-label="Custom emoji"><button data-rm>Remove</button></div>`;
    const set = (v) => { D.open.icon = v; const mm = byId(D.open.id); if (mm) mm.icon = v; m.remove(); drawIcon(); drawCrumbs(); drawSide(); touch(true); };
    $$("[data-e]", m).forEach((b) => (b.onclick = () => set(b.dataset.e)));
    $("[data-rm]", m).onclick = () => set("");
    const inp = $("input", m); inp.onkeydown = (e) => { if (e.key === "Enter" && inp.value.trim()) set(inp.value.trim()); }; setTimeout(() => inp.focus(), 30);
  }
  function drawCover() {
    const el = $("[data-cover]", main); if (!el || !D.open) return; const c = D.open.cover;
    el.className = "dx-cover" + (c ? " has" : "");
    el.style.background = c && c.grad ? GRADS[c.grad] : "";
    el.innerHTML = c && c.src ? `<img src="${esc(c.src)}" alt="" style="object-position:50% ${c.fy ?? 50}%">` : "";
    if (!owner) return;
    el.insertAdjacentHTML("beforeend", c ? `<div class="dx-cb"><button data-c="change">Change cover</button><button data-c="remove">Remove</button></div>` : `<button class="dx-addcover" data-c="add">＋ Add cover</button>`);
    $$("[data-c]", el).forEach((b) => (b.onclick = () => {
      if (b.dataset.c === "remove") { D.open.cover = null; drawCover(); touch(true); return; }
      const m = popup(b, [], { align: "left" }); m.classList.add("dx-coverpick");
      m.innerHTML = `<div class="dx-gr">${Object.keys(GRADS).map((g) => `<button data-g="${g}" style="background:${GRADS[g]}" aria-label="Colour ${g}"></button>`).join("")}</div><button class="dx-up" data-up>Upload a picture</button>`;
      $$("[data-g]", m).forEach((x) => (x.onclick = () => { D.open.cover = { grad: x.dataset.g }; m.remove(); drawCover(); touch(true); }));
      $("[data-up]", m).onclick = async () => { m.remove(); try { const f = (await Up.pick("image/*"))[0]; if (!f) return; setStatus("Uploading…"); const r = await Up.image(f); D.open.cover = { src: r.url, fy: 50 }; drawCover(); touch(true); } catch (e) { toast(e.message || "Upload failed"); } };
    }));
  }
  function drawSubs() {
    const el = $(".dx-subs", main); if (!el || !D.open) return; const ch = kids(D.open.id);
    el.innerHTML = ch.length ? `<h3>Pages inside</h3><div class="dx-recent">${ch.map((p) => `<button data-go="${p.id}"><span class="dx-em">${esc(p.icon || "📄")}</span><b>${esc(label(p))}</b><small>${ago(p.updated)}</small></button>`).join("")}</div>` : "";
    $$("[data-go]", el).forEach((b) => (b.onclick = () => openId(b.dataset.go)));
  }
  function drawFoot() {
    const el = $(".dx-foot", main); if (!el || !D.open) return;
    const bl = D.ed ? D.ed.getBlocks() : D.blocks, words = (blocksText(bl, " ").match(/\S+/g) || []).length;
    el.textContent = `${words} word${words === 1 ? "" : "s"} · ${Math.max(1, Math.round(words / 220))} min read${D.open.updated ? " · Edited " + ago(D.open.updated) : ""}`;
  }
  function setStatus(s) { D.status = s; const e = $(".dx-st", main); if (e) e.textContent = s; }

  /* ----- saving ----- */
  function touch(now) { if (!owner || !D.open) return; clearTimeout(D.saveT); setStatus("Unsaved…"); D.saveT = setTimeout(save, now ? 0 : 1100); }
  async function save() {
    clearTimeout(D.saveT); const cur = D.open; if (!cur || !owner) return true;
    const title = $(".dx-title", main); const patch = { title: title ? title.value : cur.title, icon: cur.icon || "", cover: cur.cover || null };
    if (D.ed) patch.blocks = D.ed.getBlocks();
    setStatus("Saving…");
    const r = await api("/api/docs?id=" + cur.id, { method: "PUT", body: patch });
    if (!r.ok) { setStatus("Not saved. Retrying…"); D.saveT = setTimeout(save, 4000); return false; }
    Object.assign(cur, r.data.page); const m = byId(cur.id); if (m) Object.assign(m, r.data.page);
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
        { t: p.fav ? "Remove from favorites" : "Add to favorites", i: p.fav ? "★" : "☆", run: async () => { p.fav = !p.fav; const m = byId(p.id); if (m) m.fav = p.fav; await api("/api/docs?id=" + p.id, { method: "PUT", body: { fav: p.fav } }); drawSide(); } },
        { t: "Add a page inside", i: "＋", run: () => { open[p.id] = true; ls.set("dxOpen", open); newPage({ parent: p.id }); } },
        { t: "Duplicate", i: "⧉", run: async () => { await flush(); const r0 = await api("/api/docs?id=" + p.id); const r = await api("/api/docs", { method: "POST", body: { title: label(p) + " (copy)", icon: p.icon, parent: p.parent, cover: p.cover, blocks: r0.data.blocks } }); if (r.ok) { D.pages.push(r.data.page); openId(r.data.page.id); } } },
        { t: "Move to…", i: "↪", run: moveDialog },
        "-",
        { t: ls.get("dxWide", false) ? "Normal width" : "Full width", i: "↔", run: () => { const w = !ls.get("dxWide", false); ls.set("dxWide", w); $(".dx-page", main).classList.toggle("wide", w); } },
        { t: "Export as Markdown", i: "⇩", run: () => { const md = `# ${label(p)}\n\n${blocksToMd(D.ed ? D.ed.getBlocks() : D.blocks)}\n`, a = h("a", { href: URL.createObjectURL(new Blob([md], { type: "text/markdown" })), download: (slugify(label(p)) || "page") + ".md" }); a.click(); } },
        { t: "Page history", i: "⟲", run: historyDialog },
        { t: "Print / Save as PDF", i: "⎙", run: () => window.print() },
        "-",
        { t: "Move to bin", i: "🗑", danger: true, run: async () => { await flush(); const r = await api("/api/docs?id=" + p.id, { method: "PUT", body: { trashed: true } }); if (r.ok) { await load(true); toast("Moved to the bin"); home(); } } },
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
    const c = h("div", { class: "dx-move" }, h("button", { class: p.parent ? "" : "on", "data-p": "" }, "Top level"), ...list.map(([x, d]) => h("button", { "data-p": x.id, class: p.parent === x.id ? "on" : "", style: `padding-left:${12 + d * 18}px` }, (x.icon || "📄") + " " + label(x))));
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
    main.innerHTML = `<div class="dx-top"><button class="dx-back" data-back aria-label="Back">‹</button><b class="dx-bt">Bin</b><span class="dx-st"></span>${t.length ? '<button class="dx-b danger" data-empty>Empty bin</button>' : ""}</div>
      <div class="dx-scrollmain"><div class="dx-page"><p class="hint">Pages you delete wait here. Restore them or delete them for good.</p>${t.length ? t.map((p) => `<div class="dx-hr"><span><b>${esc(p.icon || "📄")} ${esc(label(p))}</b><small>Deleted ${ago(p.trashed)}</small></span><span><button data-rs="${p.id}">Restore</button><button class="danger" data-del="${p.id}">Delete forever</button></span></div>`).join("") : '<div class="dx-empty"><h2>The bin is empty</h2></div>'}</div></div>`;
    $("[data-back]", main).onclick = () => home();
    $$("[data-rs]", main).forEach((b) => (b.onclick = async () => { await api("/api/docs?id=" + b.dataset.rs, { method: "PUT", body: { trashed: false } }); await load(true); showTrash(); }));
    $$("[data-del]", main).forEach((b) => (b.onclick = async () => { if (!(await confirmBox("Delete this page and everything inside it for good?"))) return; await api("/api/docs?id=" + b.dataset.del, { method: "DELETE" }); await load(true); showTrash(); }));
    $("[data-empty]", main)?.addEventListener("click", async () => { if (!(await confirmBox("Delete everything in the bin for good?", "Empty bin"))) return; for (const p of t) await api("/api/docs?id=" + p.id, { method: "DELETE" }); await load(true); showTrash(); });
  }

  /* ----- start ----- */
  drawSide();
  if (slug) openKey(slug, "replace"); else home("replace");
  if (mobile()) root.dataset.view = slug ? "page" : "list";
  // keep the window address and the page in step when the user presses the back button
  body.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (owner) { save().then(() => toast("Saved")); } } });
}
