// Notes: sticky notes that open into full pages written with the block editor. Anyone can read; the owner writes.
import { h, $, $$, esc, api, isAdmin, toast, mobile, showBlocks, makeEditor, confirmBox, ago } from "/js/lib.mjs";
import { blocksText } from "/shared/blocks.mjs";
import { R } from "/js/os-ext.mjs";

const N = { list: null, status: "", saving: false, again: false };
const COLORS = ["c1", "c2", "c3", "c4", "c5", "c6"];
const uid = () => Math.random().toString(36).slice(2, 10);

async function load(force) {
  if (N.list && !force) return;
  const r = await api("/api/notes");
  const saved = r.ok && Array.isArray(r.data.notes) ? r.data.notes : null;
  N.fromSeed = !saved;
  N.list = (saved || (typeof NOTES !== "undefined" ? NOTES : []).map((n) => ({ ...n }))).map((n) => ({ ...n, id: n.id || uid() }));
  LIVE.notes = N.list; LIVE.loaded = true;
}
async function persist() {
  if (N.saving) { N.again = true; return; }
  N.saving = true; setSt("Saving…");
  try {
    const r = await api("/api/notes", { method: "PUT", body: { notes: N.list } });
    if (r.ok) { N.list = r.data.notes; LIVE.notes = N.list; N.fromSeed = false; setSt("Saved"); } else setSt(r.status === 401 ? "Signed out. Not saved." : "Could not save (" + r.status + ")");
  } finally { N.saving = false; if (N.again) { N.again = false; persist(); } }
}
const setSt = (t) => { N.status = t; $$(".nt-status").forEach((e) => { if (e.closest(".nts")) e.textContent = t; }); };
const preview = (n) => (n.blocks && n.blocks.length ? blocksText(n.blocks, " ") : n.text || "").slice(0, 220);

export async function notesApp(body) {
  R.handlers.notes = (b) => notesApp(b);
  await load(true);
  grid(body);
}
function grid(body) {
  body.scrollTop = 0; body.classList.remove("jr-editing");
  const ed = isAdmin();
  const list = N.list.slice().sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0));
  body.innerHTML = `<div class="nts"><div class="nt-head"><h1>Notes</h1>${ed ? `<div class="nt-tools"><span class="nt-status">${esc(N.status)}</span><button class="nt-add">+ New note</button><button class="nt-out">Sign out</button></div>` : ""}</div>
    <div class="notes">${list.map((n) => `<button class="note" data-id="${esc(n.id)}" style="background:var(--${COLORS.includes(n.color) ? n.color : "c4"})"><b style="color:var(--glyph)">${n.pin ? "📌 " : ""}${esc(n.title || "Untitled")}</b><p>${esc(preview(n))}</p></button>`).join("")}</div>${list.length ? "" : '<p class="nt-hint">No notes yet.</p>'}</div>`;
  $$(".note", body).forEach((b) => (b.onclick = () => open(body, b.dataset.id)));
  const add = $(".nt-add", body);
  if (add) add.onclick = () => { const n = { id: uid(), title: "", text: "", color: "c4", blocks: [] }; N.list.unshift(n); open(body, n.id, true); };
  const out = $(".nt-out", body);
  if (out) out.onclick = async () => { try { await fetch("/api/auth", { method: "DELETE" }); } catch {} LIVE.admin = false; LIVE.status = ""; ownerChanged(); notesApp(body); };
}
async function open(body, id, isNew) {
  const n = N.list.find((x) => x.id === id); if (!n) return grid(body);
  const edit = isAdmin();
  body.scrollTop = 0;
  if (!edit) {
    body.innerHTML = `<div class="abar jr-bar"><div class="jr-row"><button class="back">‹ All notes</button></div></div><article class="article"><h1>${esc(n.title || "Untitled")}</h1><div class="nt-doc"></div></article>`;
    showBlocks($(".nt-doc", body), n.blocks && n.blocks.length ? n.blocks : [{ t: "p", h: esc(n.text || "").replace(/\n/g, "<br>") }]);
    $(".back", body).onclick = () => grid(body); return;
  }
  const w = body.closest(".win"), wasMax = w.classList.contains("max"); if (!mobile()) w.classList.add("max");
  body.classList.add("jr-editing");
  body.innerHTML = `<div class="jed nts"><div class="jed-bar"><button class="back">‹ Back</button><span class="jed-st nt-status">${esc(N.status)}</span><span class="sp"></span><button data-a="pin">${n.pin ? "Unpin" : "Pin"}</button><span class="nt-sw">${COLORS.map((c) => `<button class="nt-c${n.color === c ? " on" : ""}" data-c="${c}" style="background:var(--${c})" aria-label="Colour ${c}"></button>`).join("")}</span><button class="ed-del" data-a="del">Delete</button></div>
    <div class="jed-scroll"><div class="jed-main"><textarea class="jed-title" rows="1" maxlength="120" placeholder="Note title" aria-label="Title"></textarea><div class="jed-body"></div></div></div></div>`;
  const title = $(".jed-title", body), host = $(".jed-body", body); title.value = n.title || "";
  const fit = () => { title.style.height = "auto"; title.style.height = title.scrollHeight + "px"; }; setTimeout(fit, 0);
  let t = null, editor = null;
  const touch = () => { setSt("Unsaved changes"); clearTimeout(t); t = setTimeout(save, 1200); };
  const save = () => { clearTimeout(t); n.title = title.value.trim(); n.blocks = editor.getBlocks(); n.text = blocksText(n.blocks).slice(0, 4000); if (!n.title && !n.text && isNew) return; persist(); };
  title.addEventListener("input", () => { fit(); touch(); });
  title.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); editor && editor.focus("start"); } });
  editor = await makeEditor(host, { blocks: n.blocks && n.blocks.length ? n.blocks : n.text ? [{ t: "p", h: esc(n.text).replace(/\n/g, "<br>") }] : [{ t: "p", h: "" }], onChange: touch, placeholder: "Write your note. Type “/” for headings, lists, images and more" });
  if (isNew) title.focus();
  const done = async () => { save(); await new Promise((r) => setTimeout(r, 30)); editor.destroy(); body.classList.remove("jr-editing"); w.classList.toggle("max", wasMax); grid(body); };
  body.onclick = async (e) => {
    if (e.target.closest(".back")) { await done(); return; }
    const c = e.target.closest("[data-c]"); if (c) { n.color = c.dataset.c; $$(".nt-c", body).forEach((x) => x.classList.toggle("on", x === c)); touch(); }
    const a = e.target.closest("[data-a]")?.dataset.a;
    if (a === "pin") { n.pin = !n.pin; if (!n.pin) delete n.pin; e.target.textContent = n.pin ? "Unpin" : "Pin"; touch(); }
    if (a === "del" && (await confirmBox("Delete this note?"))) { N.list = N.list.filter((x) => x.id !== n.id); editor.destroy(); body.onclick = null; body.classList.remove("jr-editing"); w.classList.toggle("max", wasMax); persist(); grid(body); }
  };
}
