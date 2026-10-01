// Notes: a simple notes app in the spirit of Google Keep and Apple Notes. Quick capture, checklists, colours, labels,
// pinning, archive and a bin. Anyone can read the notes the owner leaves public; only the owner writes.
import { h, $, $$, esc, api, isAdmin, toast, mobile, showBlocks, makeEditor, Up, share, chips, confirmBox, ago } from "/js/lib.mjs";
import { blocksText } from "/shared/blocks.mjs";
import { R } from "/js/os-ext.mjs";

const N = { list: null, status: "", saving: false, again: false, q: "", filter: "notes", fromSeed: false };
const COLORS = ["c0", "c1", "c2", "c3", "c4", "c5", "c6"];
const COLOR_NAMES = { c0: "Default", c1: "Blue", c2: "Peach", c3: "Lilac", c4: "Sun", c5: "Mint", c6: "Rose" };
const BIN_DAYS = 30;
const uid = () => Math.random().toString(36).slice(2, 10);
const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

async function load(force) {
  if (N.list && !force) return;
  const r = await api("/api/notes");
  const saved = r.ok && Array.isArray(r.data.notes) ? r.data.notes : null;
  N.fromSeed = !saved;
  const now = Date.now();
  N.list = (saved || (typeof NOTES !== "undefined" ? NOTES : []).map((n) => ({ ...n }))).map((n, i) => ({ ...n, id: n.id || uid(), color: COLORS.includes(n.color) ? n.color : "c0", ts: n.ts || now - i }));
  // the bin empties itself after a month
  if (isAdmin() && !N.fromSeed) { const keep = N.list.filter((n) => !n.trashed || now - n.trashed < BIN_DAYS * 864e5); if (keep.length !== N.list.length) { N.list = keep; persist(); } }
  window.LIVE && (LIVE.notes = N.list, LIVE.loaded = true);
}
let saveT = null;
function queue() { clearTimeout(saveT); setSt("Unsaved…"); saveT = setTimeout(persist, 700); }
async function persist() {
  clearTimeout(saveT);
  if (!isAdmin()) return;
  if (N.saving) { N.again = true; return; }
  N.saving = true; setSt("Saving…");
  try {
    const r = await api("/api/notes", { method: "PUT", body: { notes: N.list } });
    if (r.ok) { N.fromSeed = false; setSt("Saved"); window.LIVE && (LIVE.notes = N.list); } else setSt(r.status === 401 ? "Signed out. Not saved." : "Could not save (" + r.status + ")");
  } finally { N.saving = false; if (N.again) { N.again = false; persist(); } }
}
const setSt = (t) => { N.status = t; $$(".kn-st").forEach((e) => (e.textContent = t)); };
const textOf = (n) => (n.blocks && n.blocks.length ? blocksText(n.blocks, " ") : n.items ? n.items.map((i) => i.t).join(" ") : n.text || "");
const labelsAll = () => [...new Set(N.list.filter((n) => !n.trashed).flatMap((n) => n.labels || []))].sort((a, b) => a.localeCompare(b));
const touchNote = (n) => { n.ts = Date.now(); queue(); };

function visibleList() {
  const q = N.q.trim().toLowerCase(), f = N.filter, owner = isAdmin();
  let l = N.list.filter((n) => (f === "bin" ? !!n.trashed : !n.trashed && (f === "archive" ? !!n.archived : f.startsWith("l:") ? (n.labels || []).includes(f.slice(2)) && !n.archived : !n.archived)));
  if (!owner) l = l.filter((n) => !n.private && !n.archived && !n.trashed);
  if (q) l = l.filter((n) => (n.title + " " + textOf(n) + " " + (n.labels || []).join(" ")).toLowerCase().includes(q));
  return l.sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || (b.ts || 0) - (a.ts || 0));
}

export async function notesApp(body, slug) {
  body.classList.add("kn-body");
  R.handlers.notes = (b, key) => (key ? openNote(body, key, "replace") : closeModal(body, "replace"));
  body.innerHTML = '<div class="app-loading"><span class="rb-spin"></span></div>';
  await load(true);
  shell(body);
  if (slug) openNote(body, slug, "replace");
}

/* ---------- the list ---------- */
function shell(body) {
  const owner = isAdmin();
  body.scrollTop = 0; body.classList.remove("jr-editing");
  const view = ls.get("knView", "grid");
  body.innerHTML = `<div class="kn" data-view="${view}">
    <header class="kn-top"><label class="kn-search"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input type="search" placeholder="Search notes" aria-label="Search notes" value="${esc(N.q)}" autocomplete="off"></label>
      <button class="kn-ib" data-view-toggle aria-label="${view === "grid" ? "Switch to list view" : "Switch to grid view"}" title="${view === "grid" ? "List view" : "Grid view"}">${view === "grid" ? "☰" : "▦"}</button>
      ${owner ? '<span class="kn-st"></span>' : ""}</header>
    <nav class="kn-nav" aria-label="Notes filters"></nav>
    <div class="kn-scroll">${owner ? '<div class="kn-compose"></div>' : ""}<div class="kn-lists"></div></div>
    <div class="kn-modal-host"></div></div>`;
  const root = $(".kn", body);
  const search = $(".kn-search input", root);
  search.oninput = () => { N.q = search.value; drawLists(body); };
  $("[data-view-toggle]", root).onclick = () => { ls.set("knView", view === "grid" ? "list" : "grid"); shell(body); };
  drawNav(body); if (owner) composer(body); drawLists(body);
}
function drawNav(body) {
  const nav = $(".kn-nav", body), owner = isAdmin(), labels = labelsAll();
  const chip = (k, t, n) => `<button class="${N.filter === k ? "on" : ""}" data-f="${esc(k)}">${t}${n ? `<i>${n}</i>` : ""}</button>`;
  const bin = N.list.filter((n) => n.trashed).length, arch = N.list.filter((n) => n.archived && !n.trashed).length;
  nav.innerHTML = chip("notes", "Notes") + labels.map((l) => chip("l:" + l, "# " + esc(l))).join("") + (owner ? chip("archive", "Archive", arch) + chip("bin", "Bin", bin) : "");
  $$("[data-f]", nav).forEach((b) => (b.onclick = () => { N.filter = b.dataset.f; drawNav(body); drawLists(body); }));
}
function card(n, owner) {
  const items = n.items || [];
  const todo = items.filter((i) => !i.d), done = items.filter((i) => i.d);
  const content = n.kind === "list" || items.length
    ? `<ul class="kn-li">${todo.slice(0, 8).map((i) => `<li><button class="kn-cb" data-chk="${i.id}" aria-label="Mark done"></button><span>${esc(i.t)}</span></li>`).join("")}${todo.length > 8 ? `<li class="more">+ ${todo.length - 8} more</li>` : ""}${done.length ? `<li class="more">${done.length} completed</li>` : ""}</ul>`
    : `<p class="kn-tx">${esc(textOf(n).slice(0, 360))}</p>`;
  return `<article class="kn-card ${n.color || "c0"}" data-id="${esc(n.id)}" tabindex="0" role="button" aria-label="Open note ${esc(n.title || "Untitled")}">${n.img ? `<img class="kn-img" src="${esc(n.img)}" alt="" loading="lazy">` : ""}
    <div class="kn-in">${n.title ? `<h3>${esc(n.title)}</h3>` : ""}${content}${(n.labels || []).length ? `<div class="kn-lb">${n.labels.map((l) => `<span>${esc(l)}</span>`).join("")}</div>` : ""}</div>
    ${n.pin ? '<span class="kn-pin" title="Pinned">📌</span>' : ""}${n.private && owner ? '<span class="kn-priv" title="Only you can see this">🔒</span>' : ""}
    ${owner && !n.trashed ? `<div class="kn-act"><button data-a="pin" aria-label="${n.pin ? "Unpin" : "Pin"}" title="${n.pin ? "Unpin" : "Pin"}">${n.pin ? "📍" : "📌"}</button><button data-a="color" aria-label="Colour" title="Colour">🎨</button><button data-a="archive" aria-label="${n.archived ? "Unarchive" : "Archive"}" title="${n.archived ? "Unarchive" : "Archive"}">🗄️</button><button data-a="trash" aria-label="Move to bin" title="Move to bin">🗑️</button></div>` : ""}
    ${owner && n.trashed ? `<div class="kn-act on"><button data-a="restore">Restore</button><button data-a="purge" class="danger">Delete forever</button></div>` : ""}</article>`;
}
function drawLists(body) {
  const host = $(".kn-lists", body); if (!host) return; const owner = isAdmin(), l = visibleList();
  const pinned = l.filter((n) => n.pin), others = l.filter((n) => !n.pin);
  const grid = (arr) => `<div class="kn-grid">${arr.map((n) => card(n, owner)).join("")}</div>`;
  let html = "";
  if (N.filter === "bin" && owner) html += `<p class="kn-hint">Notes in the bin are deleted after ${BIN_DAYS} days. ${l.length ? '<button class="kn-link danger" data-empty>Empty bin</button>' : ""}</p>`;
  if (pinned.length) html += `<h4 class="kn-h">Pinned</h4>${grid(pinned)}${others.length ? '<h4 class="kn-h">Others</h4>' : ""}`;
  html += others.length ? grid(others) : "";
  if (!l.length) html = `<div class="kn-empty"><div>${N.filter === "bin" ? "🗑️" : N.filter === "archive" ? "🗄️" : N.q ? "🔍" : "📝"}</div><p>${N.q ? "No notes match your search." : N.filter === "bin" ? "The bin is empty." : N.filter === "archive" ? "Archived notes show up here." : owner ? "Notes you add appear here." : "No notes yet."}</p></div>`;
  host.innerHTML = html;
  $$(".kn-card", host).forEach((el) => {
    const id = el.dataset.id, n = N.list.find((x) => x.id === id);
    el.onclick = (e) => {
      const act = e.target.closest("[data-a]")?.dataset.a, chk = e.target.closest("[data-chk]");
      if (chk && owner) { e.stopPropagation(); const it = n.items.find((i) => i.id === chk.dataset.chk); if (it) { it.d = true; touchNote(n); drawLists(body); } return; }
      if (act) { e.stopPropagation(); return action(body, n, act, e.target.closest("[data-a]")); }
      openNote(body, id);
    };
    el.onkeydown = (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === el) { e.preventDefault(); openNote(body, id); } };
  });
  $("[data-empty]", host)?.addEventListener("click", async () => { if (!(await confirmBox("Delete everything in the bin for good?", "Empty bin"))) return; N.list = N.list.filter((n) => !n.trashed); queue(); drawNav(body); drawLists(body); });
}
function colorPop(anchor, n, done) {
  $$(".kn-pop").forEach((x) => x.remove());
  const p = h("div", { class: "kn-pop", role: "menu" }, COLORS.map((c) => h("button", { class: `kn-sw ${c}${n.color === c ? " on" : ""}`, "aria-label": COLOR_NAMES[c], title: COLOR_NAMES[c], onclick: (e) => { e.stopPropagation(); n.color = c; touchNote(n); p.remove(); done(); } })));
  anchor.closest(".kn-card, .kn-edit, .kn-compose-card").append(p);
  setTimeout(() => document.addEventListener("pointerdown", function f(e) { if (!p.contains(e.target)) { p.remove(); document.removeEventListener("pointerdown", f, true); } }, true), 0);
}
function action(body, n, a, anchor) {
  const again = () => { drawNav(body); drawLists(body); };
  if (a === "pin") { n.pin = !n.pin; if (!n.pin) delete n.pin; touchNote(n); again(); }
  else if (a === "color") colorPop(anchor, n, again);
  else if (a === "archive") { n.archived = !n.archived; if (!n.archived) delete n.archived; else delete n.pin; touchNote(n); again(); toast(n.archived ? "Note archived" : "Note unarchived"); }
  else if (a === "trash") { n.trashed = Date.now(); delete n.pin; touchNote(n); again(); toast("Moved to the bin"); }
  else if (a === "restore") { delete n.trashed; touchNote(n); again(); toast("Note restored"); }
  else if (a === "purge") confirmBox("Delete this note for good?").then((ok) => { if (!ok) return; N.list = N.list.filter((x) => x.id !== n.id); queue(); again(); });
}

/* ---------- quick capture (owner) ---------- */
function composer(body) {
  const host = $(".kn-compose", body); let open = false, mode = "text";
  const draw = () => {
    if (!open) {
      host.innerHTML = `<div class="kn-compose-bar"><button class="kn-take" data-open>Take a note…</button><button class="kn-ib" data-open="list" aria-label="New checklist" title="New checklist">☑</button><button class="kn-ib" data-open="img" aria-label="New note with image" title="New note with image">🖼️</button></div>`;
      $$("[data-open]", host).forEach((b) => (b.onclick = () => { open = true; mode = b.dataset.open === "list" ? "list" : "text"; draw(); if (b.dataset.open === "img") pickImg(); }));
      return;
    }
    const n = draw.n || (draw.n = { id: uid(), title: "", text: "", color: "c0", kind: mode === "list" ? "list" : undefined, items: mode === "list" ? [{ id: uid(), t: "" }] : undefined, created: Date.now(), ts: Date.now() });
    host.innerHTML = `<div class="kn-compose-card ${n.color}">${n.img ? `<img class="kn-img" src="${esc(n.img)}" alt="">` : ""}<input class="kn-ti" placeholder="Title" maxlength="120" aria-label="Title" value="${esc(n.title)}">
      ${n.kind === "list" ? '<div class="kn-items"></div>' : `<textarea class="kn-ta" rows="3" placeholder="Take a note…" aria-label="Note text" maxlength="10000">${esc(n.text)}</textarea>`}
      <div class="kn-bar"><button data-a="color" aria-label="Colour" title="Colour">🎨</button><button data-a="img" aria-label="Add image" title="Add image">🖼️</button><button data-a="mode" aria-label="${n.kind === "list" ? "Show as text" : "Show as checklist"}" title="${n.kind === "list" ? "Show as text" : "Show as checklist"}">${n.kind === "list" ? "¶" : "☑"}</button><button data-a="pin" class="${n.pin ? "on" : ""}" aria-label="Pin" title="Pin">📌</button><span class="sp"></span><button class="kn-done" data-a="done">Close</button></div></div>`;
    const card = $(".kn-compose-card", host);
    const ti = $(".kn-ti", host), ta = $(".kn-ta", host);
    const fit = (t) => { t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 320) + "px"; };
    ti.oninput = () => (n.title = ti.value);
    if (ta) { ta.oninput = () => { n.text = ta.value; fit(ta); }; fit(ta); }
    if (n.kind === "list") itemsEditor($(".kn-items", host), n, () => {});
    (ta || ti).focus({ preventScroll: true });
    card.onclick = async (e) => {
      const a = e.target.closest("[data-a]")?.dataset.a; if (!a) return;
      if (a === "color") colorPop(e.target, n, draw);
      if (a === "pin") { n.pin = !n.pin; draw(); }
      if (a === "img") pickImg();
      if (a === "mode") { n.title = ti.value; if (n.kind === "list") { n.text = n.items.map((i) => i.t).filter(Boolean).join("\n"); delete n.items; delete n.kind; } else { n.items = (ta.value || "").split("\n").map((t) => t.trim()).filter(Boolean).map((t) => ({ id: uid(), t })); if (!n.items.length) n.items = [{ id: uid(), t: "" }]; n.kind = "list"; n.text = ""; } draw(); }
      if (a === "done") finish();
    };
    card.onkeydown = (e) => { if (e.key === "Escape" || ((e.ctrlKey || e.metaKey) && e.key === "Enter")) { e.preventDefault(); finish(); } };
  };
  async function pickImg() {
    try { const f = (await Up.pick("image/*"))[0]; if (!f) return; const n = draw.n || (draw.n = { id: uid(), title: "", text: "", color: "c0", created: Date.now(), ts: Date.now() }); setSt("Uploading…"); const r = await Up.image(f, { max: 1600 }); n.img = r.url; setSt(""); draw(); } catch (e) { toast(e.message || "Upload failed"); }
  }
  function finish() {
    const n = draw.n; open = false; draw.n = null;
    if (n) { if (n.kind === "list") n.items = n.items.filter((i) => i.t.trim()); const empty = !n.title.trim() && !(n.text || "").trim() && !(n.items && n.items.length) && !n.img; if (!empty) { n.title = n.title.trim(); if (!n.pin) delete n.pin; N.list.unshift(n); queue(); N.filter = "notes"; drawNav(body); drawLists(body); } }
    draw();
  }
  draw();
}
function itemsEditor(host, n, onChange) {
  const fit = (t) => { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; };
  const draw = (focusId) => {
    const open = n.items.filter((i) => !i.d), done = n.items.filter((i) => i.d);
    const row = (i) => `<div class="kn-row${i.d ? " d" : ""}" data-id="${i.id}"><span class="kn-grip" aria-hidden="true">⋮⋮</span><button class="kn-cb${i.d ? " on" : ""}" data-t aria-label="${i.d ? "Mark not done" : "Mark done"}"></button><textarea rows="1" maxlength="300" aria-label="List item" placeholder="List item">${esc(i.t)}</textarea><button class="kn-rm" data-rm aria-label="Delete item">✕</button></div>`;
    host.innerHTML = `${open.map(row).join("")}<button class="kn-addrow" data-add>＋ List item</button>${done.length ? `<details class="kn-doneblk"${n.__openDone ? " open" : ""}><summary>${done.length} completed</summary>${done.map(row).join("")}</details>` : ""}`;
    $$("textarea", host).forEach(fit);
    if (focusId) { const t = $(`[data-id="${focusId}"] textarea`, host); t && t.focus(); }
    $$(".kn-row", host).forEach((r) => {
      const it = n.items.find((x) => x.id === r.dataset.id), ta = $("textarea", r);
      ta.oninput = () => { it.t = ta.value.replace(/\n/g, " "); fit(ta); onChange(); };
      ta.onkeydown = (e) => {
        if (e.key === "Enter") { e.preventDefault(); const at = n.items.indexOf(it), ni = { id: uid(), t: "" }; n.items.splice(at + 1, 0, ni); onChange(); draw(ni.id); }
        if (e.key === "Backspace" && !ta.value && n.items.length > 1) { e.preventDefault(); const at = n.items.indexOf(it); n.items.splice(at, 1); onChange(); draw((n.items[Math.max(0, at - 1)] || {}).id); }
        if (e.key === "ArrowUp" && ta.selectionStart === 0) { const p = r.previousElementSibling; if (p && p.matches(".kn-row")) { e.preventDefault(); $("textarea", p).focus(); } }
        if (e.key === "ArrowDown" && ta.selectionStart === ta.value.length) { const nx = r.nextElementSibling; if (nx && nx.matches(".kn-row")) { e.preventDefault(); $("textarea", nx).focus(); } }
      };
      $("[data-t]", r).onclick = () => { it.d = !it.d; n.__openDone = true; if (it.d) { n.items.splice(n.items.indexOf(it), 1); n.items.push(it); } onChange(); draw(); };
      $("[data-rm]", r).onclick = () => { n.items.splice(n.items.indexOf(it), 1); onChange(); draw(); };
    });
    $("[data-add]", host).onclick = () => { const ni = { id: uid(), t: "" }; const firstDone = n.items.findIndex((i) => i.d); n.items.splice(firstDone < 0 ? n.items.length : firstDone, 0, ni); onChange(); draw(ni.id); };
  };
  draw();
}

/* ---------- one note, open ---------- */
function closeModal(body, mode = "push") {
  const mh = $(".kn-modal-host", body); if (!mh || !mh.firstChild) return;
  if (mh.__close) return mh.__close(mode);
}
async function openNote(body, id, mode = "push") {
  const n = N.list.find((x) => x.id === id); const mh = $(".kn-modal-host", body);
  if (!n || !mh) { if (!n) toast("That note isn't available."); return; }
  const owner = isAdmin(), editable = owner && !n.trashed;
  let editor = null;
  const close = async (m = "push") => {
    if (editor) { n.blocks = editor.getBlocks(); n.text = blocksText(n.blocks).slice(0, 10000); try { editor.destroy(); } catch {} editor = null; }
    if (editable) { if (n.kind === "list") n.items = (n.items || []).filter((i) => i.t.trim() || false); const empty = !(n.title || "").trim() && !(n.text || "").trim() && !(n.items && n.items.length) && !n.img && !(n.blocks && n.blocks.length); if (empty) N.list = N.list.filter((x) => x.id !== n.id); persist(); }
    mh.innerHTML = ""; mh.__close = null; body.classList.remove("kn-open");
    R.item(body, "", "Notes — Rohan Kumar", m === "replace" ? "replace" : "push"); drawNav(body); drawLists(body);
  };
  mh.__close = close;
  body.classList.add("kn-open");
  const labelsFor = () => (n.labels || []);
  mh.innerHTML = `<div class="kn-scrim"><div class="kn-edit ${n.color || "c0"}" role="dialog" aria-modal="true" aria-label="${editable ? "Edit note" : "Note"}">
    ${n.img ? `<div class="kn-eimg"><img src="${esc(n.img)}" alt="">${editable ? '<button data-a="rmimg" aria-label="Remove image">✕</button>' : ""}</div>` : ""}
    <div class="kn-ebody">${editable ? `<input class="kn-ti" placeholder="Title" maxlength="120" aria-label="Title" value="${esc(n.title || "")}">` : `<h2>${esc(n.title || "")}</h2>`}
      <div class="kn-content"></div><div class="kn-lbl"></div></div>
    <div class="kn-bar">${editable ? `<button data-a="color" aria-label="Colour" title="Colour">🎨</button><button data-a="img" aria-label="Add image" title="Add image">🖼️</button><button data-a="label" aria-label="Labels" title="Labels">🏷️</button><button data-a="pin" class="${n.pin ? "on" : ""}" aria-label="Pin" title="Pin">📌</button><button data-a="private" class="${n.private ? "on" : ""}" aria-label="Private" title="${n.private ? "Only you can see this" : "Public note"}">${n.private ? "🔒" : "🔓"}</button>${n.blocks && n.blocks.length ? "" : `<button data-a="mode" title="${n.kind === "list" ? "Show as text" : "Show as checklist"}" aria-label="${n.kind === "list" ? "Show as text" : "Show as checklist"}">${n.kind === "list" ? "¶" : "☑"}</button>`}<button data-a="archive" aria-label="Archive" title="Archive">🗄️</button><button data-a="trash" aria-label="Move to bin" title="Move to bin">🗑️</button>` : `<button data-a="share" title="Share this note">Share</button>`}<span class="sp"></span><span class="kn-st"></span><span class="kn-when">${n.ts ? "Edited " + ago(n.ts) : ""}</span><button class="kn-done" data-a="close">Close</button></div></div></div>`;
  const edit = $(".kn-edit", mh), content = $(".kn-content", mh), lbl = $(".kn-lbl", mh);
  const drawLabels = () => { lbl.innerHTML = labelsFor().map((l) => `<span class="kn-chip">${esc(l)}${editable ? `<button data-rl="${esc(l)}" aria-label="Remove label ${esc(l)}">✕</button>` : ""}</span>`).join(""); $$("[data-rl]", lbl).forEach((b) => (b.onclick = () => { n.labels = labelsFor().filter((x) => x !== b.dataset.rl); if (!n.labels.length) delete n.labels; touchNote(n); drawLabels(); })); };
  drawLabels();
  const fit = (t) => { t.style.height = "auto"; t.style.height = Math.max(120, t.scrollHeight) + "px"; };
  const drawContent = async () => {
    if (editor) { try { editor.destroy(); } catch {} editor = null; }
    content.innerHTML = "";
    if (n.blocks && n.blocks.length) {
      if (editable) editor = await makeEditor(content, { blocks: n.blocks, onChange: () => { n.blocks = editor.getBlocks(); n.text = blocksText(n.blocks).slice(0, 10000); touchNote(n); }, placeholder: "Write…" });
      else showBlocks(content, n.blocks);
    } else if (n.kind === "list" || (n.items && n.items.length)) {
      if (!n.items) n.items = [];
      if (editable) itemsEditor(content, n, () => touchNote(n));
      else content.innerHTML = `<ul class="kn-li">${n.items.map((i) => `<li class="${i.d ? "d" : ""}"><span class="kn-cb${i.d ? " on" : ""}"></span><span>${esc(i.t)}</span></li>`).join("")}</ul>`;
    } else if (editable) {
      content.innerHTML = `<textarea class="kn-ta" placeholder="Note" maxlength="10000" aria-label="Note text">${esc(n.text || "")}</textarea>`;
      const ta = $("textarea", content); fit(ta); ta.oninput = () => { n.text = ta.value; fit(ta); touchNote(n); };
      if (!n.title && !n.text) $(".kn-ti", mh).focus(); else if (!n.title) ta.focus();
    } else content.innerHTML = `<p class="kn-tx full">${esc(n.text || "").replace(/\n/g, "<br>")}</p>`;
  };
  await drawContent();
  const ti = $(".kn-ti", mh); if (ti) ti.oninput = () => { n.title = ti.value; touchNote(n); };
  const swap = () => { edit.className = `kn-edit ${n.color || "c0"}`; };
  edit.onclick = async (e) => {
    const a = e.target.closest("[data-a]")?.dataset.a; if (!a) return;
    if (a === "close") return close();
    if (a === "share") return share(location.origin + "/notes/" + n.id, n.title || "Note");
    if (a === "color") { colorPop(e.target.closest("[data-a]"), n, swap); }
    if (a === "pin") { n.pin = !n.pin; if (!n.pin) delete n.pin; e.target.closest("[data-a]").classList.toggle("on", !!n.pin); touchNote(n); }
    if (a === "private") { n.private = !n.private; if (!n.private) delete n.private; const b = e.target.closest("[data-a]"); b.classList.toggle("on", !!n.private); b.textContent = n.private ? "🔒" : "🔓"; b.title = n.private ? "Only you can see this" : "Public note"; touchNote(n); toast(n.private ? "Private: only you can see this note" : "Public: visitors can read this note"); }
    if (a === "archive") { n.archived = !n.archived; if (!n.archived) delete n.archived; else delete n.pin; touchNote(n); toast(n.archived ? "Note archived" : "Note unarchived"); return close(); }
    if (a === "trash") { n.trashed = Date.now(); delete n.pin; touchNote(n); toast("Moved to the bin"); return close(); }
    if (a === "rmimg") { delete n.img; touchNote(n); $(".kn-eimg", mh)?.remove(); }
    if (a === "img") { try { const f = (await Up.pick("image/*"))[0]; if (!f) return; setSt("Uploading…"); const r = await Up.image(f, { max: 1600 }); n.img = r.url; touchNote(n); let box = $(".kn-eimg", mh); if (!box) { box = h("div", { class: "kn-eimg" }); edit.prepend(box); } box.innerHTML = `<img src="${esc(n.img)}" alt=""><button data-a="rmimg" aria-label="Remove image">✕</button>`; } catch (er) { toast(er.message || "Upload failed"); } }
    if (a === "mode") { const ta = $(".kn-ta", content); if (n.kind === "list") { n.text = (n.items || []).map((i) => i.t).filter(Boolean).join("\n"); delete n.items; delete n.kind; } else { const src = ta ? ta.value : n.text || ""; n.items = src.split("\n").map((t) => t.trim()).filter(Boolean).map((t) => ({ id: uid(), t })); if (!n.items.length) n.items = [{ id: uid(), t: "" }]; n.kind = "list"; n.text = ""; } touchNote(n); const b = e.target.closest("[data-a]"); b.textContent = n.kind === "list" ? "¶" : "☑"; await drawContent(); }
    if (a === "label") {
      lbl.insertAdjacentHTML("beforeend", '<div class="kn-newlbl"><input list="kn-labels" maxlength="24" placeholder="Add a label, press Enter" aria-label="New label"><datalist id="kn-labels">' + labelsAll().map((l) => `<option value="${esc(l)}">`).join("") + "</datalist></div>");
      const inp = $(".kn-newlbl input", lbl); inp.focus();
      inp.onkeydown = (ev) => { if (ev.key === "Enter") { ev.preventDefault(); const v = inp.value.trim(); if (v) { n.labels = [...new Set([...(n.labels || []), v])].slice(0, 8); touchNote(n); } $(".kn-newlbl", lbl)?.remove(); drawLabels(); } if (ev.key === "Escape") { ev.stopPropagation(); $(".kn-newlbl", lbl)?.remove(); } };
      inp.onblur = () => setTimeout(() => $(".kn-newlbl", lbl)?.remove(), 120);
    }
  };
  $(".kn-scrim", mh).addEventListener("pointerdown", (e) => { if (e.target.classList.contains("kn-scrim")) close(); });
  mh.onkeydown = (e) => { if (e.key === "Escape" && !e.defaultPrevented) { e.stopPropagation(); close(); } if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); close(); } };
  R.item(body, n.id, `${n.title || "Note"} — Notes`, mode);
}
