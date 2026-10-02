// Page windows for Boards: a page card opens as a floating window over the canvas, with the cover, icon, title and the
// full block editor. Windows can be dragged, resized, maximised, minimised to the tray and stacked.
import { h, esc, api, toast, mobile, showBlocks, makeEditor, Up, confirmBox } from "/js/lib.mjs";
import { blocksToMd, blocksText } from "/shared/blocks.mjs";
import { ICONS } from "/shared/icons.mjs";
import { I, menu } from "/js/board-canvas.mjs";
import { COVERS, coverCss } from "/js/board-covers.mjs";

const PAGE_ICONS = ["file-text", "bulb", "sparkles", "target", "rocket", "star", "heart", "flame", "video", "camera", "mic", "music", "pencil", "book", "bookmark", "palette", "image", "brain", "chat", "calendar", "clock", "checkbox", "list", "chart", "trend", "globe", "map", "compass", "home", "folder", "tag", "link", "code", "laptop", "coffee", "plane", "leaf", "gift", "trophy", "flask", "wrench", "settings", "user", "mail", "phone", "lock", "shield", "cat", "graduation", "wallet"].filter((n) => ICONS[n]);
const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }, del(k) { try { localStorage.removeItem(k); } catch {} } };
/* ---------- the writing of every page card, shared by the cards on the board, in-place editing and page windows ---------- */
const BODY = new Map(); // page id -> {blocks, updated}: the newest copy this tab has seen, so a stale server copy never wins
const listeners = new Set();
const setBody = (id, blocks, updated) => { const cur = BODY.get(id); if (cur && cur.updated > updated) return; BODY.set(id, { blocks, updated }); listeners.forEach((f) => f(id)); };
let wantQ = new Set(), wantT = 0;
export const Bodies = {
  get: (id) => BODY.get(id) || null,
  onChange(f) { listeners.add(f); return () => listeners.delete(f); },
  // ask for the writing of some cards; they arrive in one request and each card is redrawn
  refresh(id) { Bodies.want(id, true); }, // another device saved this page: fetch it again
  want(id, force) {
    if ((BODY.has(id) && !force) || wantQ.has(id)) return; wantQ.add(id); clearTimeout(wantT);
    wantT = setTimeout(async () => {
      const ids = [...wantQ]; wantQ = new Set();
      for (let i = 0; i < ids.length; i += 60) {
        const part = ids.slice(i, i + 60), r = await api("/api/boards?pages=" + part.join(","));
        if (r.ok) for (const [id, v] of Object.entries(r.data.pages || {})) setBody(id, v.blocks || [], v.updated || 0);
      }
    }, 60);
  },
  set: setBody,
};
const SAVED = { get: (id) => BODY.get(id), set: (id, v) => setBody(id, v.blocks, v.updated) };
const label = (it) => (it && it.title && it.title.trim()) || "Untitled";
const slug = (s) => String(s || "page").toLowerCase().replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "page";

export function pageWindows(layer, ctx) {
  // ctx: { canvas(), owner, boardId() }
  const W = new Map(); // item id -> window state
  let zTop = 10, cascade = 0;
  const tray = h("div", { class: "bp-tray", role: "toolbar", "aria-label": "Minimised pages" });
  // live sync: an open page follows what another device saved, unless there is typing here that is not saved yet
  const offLive = Bodies.onChange((id) => {
    const w = W.get(id), bd = BODY.get(id);
    if (!w || !w.ed || w.dirty || w.saveT || w.saving || !bd || bd.updated <= w.updated) return;
    w.updated = bd.updated; w.blocks = bd.blocks; w.ed.setBlocks(bd.blocks); foot(w);
    if (!w.inline) { status(w, "Updated from your other device"); setTimeout(() => { if (w.stEl && /other device/.test(w.stEl.textContent)) status(w, ""); }, 4000); }
  });
  layer.append(tray);
  const bounds = () => layer.getBoundingClientRect();

  function drawTray() {
    tray.innerHTML = "";
    for (const w of W.values()) if (w.min) {
      const it = ctx.canvas()?.item(w.id);
      const b = h("button", { class: "bp-chip", title: "Show " + label(it) }, h("span", { class: "bp-ci", html: I(it && it.icon && ICONS[it.icon] ? it.icon : "file-text", 16) }), h("span", { class: "bp-ct" }, label(it)), h("span", { class: "bp-cx", role: "button", "aria-label": "Close", html: I("x", 14) }));
      b.onclick = (e) => { if (e.target.closest(".bp-cx")) { close(w.id); return; } restore(w.id); };
      tray.append(b);
    }
    tray.classList.toggle("on", !!tray.childElementCount);
  }

  async function open(it, { fresh, docked } = {}) {
    let ex = W.get(it.id);
    if (ex && ex.inline) { await ex.finish(); ex = null; }
    if (ex) { if (ex.min) restore(it.id); else front(ex); return; }
    if (docked) for (const o of [...W.values()]) if (o.docked) await close(o.id); // one document at a time in the database view
    const owner = ctx.owner && !mobile();
    const b = bounds(), phone = mobile();
    const saved = ls.get("bpGeo", null);
    const ww = phone ? b.width : Math.min(saved?.w || 780, b.width - 40), hh = phone ? b.height : Math.min(saved?.h || Math.round(b.height * 0.86), b.height - 32);
    const off = (cascade++ % 6) * 28;
    const geo = { x: phone ? 0 : Math.max(12, Math.round((b.width - ww) / 2) + off - 40), y: phone ? 0 : Math.max(12, Math.round((b.height - hh) / 2) + off - 20), w: ww, h: hh };
    const el = h("section", { class: "bp-win" + (phone ? " phone" : "") + (docked ? " docked max" : ""), role: docked ? "region" : "dialog", "aria-label": label(it) });
    el.innerHTML = `<header class="bp-bar">${docked ? `<button class="bp-wb bp-back" data-a="close" title="Back to the database (Esc)" aria-label="Back">${I("arrow-left", 19)}</button>` : ""}<span class="bp-bi"></span><span class="bp-crumb"></span><b class="bp-bt"></b><span class="bp-st" aria-live="polite"></span>
        <button class="bp-wb" data-a="more" title="More" aria-label="More">${I("more", 18)}</button>${phone || docked ? "" : `<button class="bp-wb" data-a="min" title="Minimise" aria-label="Minimise">${I("minus", 18)}</button><button class="bp-wb" data-a="max" title="Maximise (double-click the bar)" aria-label="Maximise">${I("fit", 17)}</button>`}${docked ? "" : `<button class="bp-wb" data-a="close" title="Close" aria-label="Close">${I("x", 18)}</button>`}</header>
      <div class="bp-scroll"><div class="bp-page"><div class="bp-cover"></div><div class="bp-head"><button class="bp-icon" aria-label="Page icon"></button>${owner ? '<div class="bp-adds"></div>' : ""}<textarea class="bp-title" rows="1" placeholder="Untitled" maxlength="160" aria-label="Page title" ${owner ? "" : "readonly"}></textarea></div><div class="bp-body"><div class="bp-load"><span class="rb-spin"></span></div></div><footer class="bp-foot"></footer></div></div>
      ${phone || docked ? "" : '<i class="bp-rz" data-rz="se"></i><i class="bp-rz e" data-rz="e"></i><i class="bp-rz s" data-rz="s"></i><i class="bp-rz w" data-rz="w"></i>'}`;
    layer.append(el);
    const w = { id: it.id, el, geo, min: false, max: !!docked, docked: !!docked, ed: null, blocks: [], updated: 0, saveT: 0, dirty: false, owner, saving: false,
      bodyEl: el.querySelector(".bp-body"), titleEl: el.querySelector(".bp-title"), stEl: el.querySelector(".bp-st"), footEl: el.querySelector(".bp-foot") };
    W.set(it.id, w); front(w); applyGeo(w);
    // grow out of the card
    const from = docked ? null : ctx.canvas()?.rectOf(it.id);
    if (from && !phone) { const lb = bounds(); flip(el, { x: from.left - lb.left, y: from.top - lb.top, w: from.width, h: from.height }, geo, true); }
    else el.animate(docked ? [{ opacity: 0, transform: "translateX(24px)" }, { opacity: 1, transform: "none" }] : [{ opacity: 0, transform: "translateY(12px) scale(.98)" }, { opacity: 1, transform: "none" }], { duration: 200, easing: "cubic-bezier(.2,0,0,1)" });
    wire(w); drawHead(w);
    await loadBody(w, fresh);
  }

  function applyGeo(w) {
    const s = w.el.style;
    if (w.max || w.el.classList.contains("phone")) { s.left = s.top = "0px"; s.width = s.height = "100%"; w.el.classList.toggle("max", !!w.max); return; }
    w.el.classList.remove("max");
    s.left = w.geo.x + "px"; s.top = w.geo.y + "px"; s.width = w.geo.w + "px"; s.height = w.geo.h + "px";
  }
  function front(w) { w.el.style.zIndex = String(++zTop); for (const o of W.values()) o.el.classList.toggle("top", o === w); }
  function flip(el, a, b, grow) {
    const sx = a.w / b.w, sy = a.h / b.h, tx = a.x - b.x, ty = a.y - b.y;
    const kf = [{ transform: `translate(${tx}px,${ty}px) scale(${sx},${sy})`, opacity: grow ? 0.4 : 1, borderRadius: "24px" }, { transform: "none", opacity: 1 }];
    return el.animate(grow ? kf : kf.reverse(), { duration: grow ? 260 : 220, easing: "cubic-bezier(.2,0,0,1)", transformOrigin: "0 0" });
  }

  function wire(w) {
    const el = w.el, bar = el.querySelector(".bp-bar");
    el.addEventListener("pointerdown", () => front(w), true);
    el.querySelectorAll("[data-a]").forEach((b) => (b.onclick = (e) => {
      const a = b.dataset.a;
      if (a === "close") close(w.id); else if (a === "min") minimize(w.id); else if (a === "max") { w.max = !w.max; applyGeo(w); }
      else if (a === "more") { const r = b.getBoundingClientRect(); menu(r.right - 240, r.bottom + 6, moreMenu(w)); }
    }));
    bar.addEventListener("dblclick", (e) => { if (e.target.closest("button") || el.classList.contains("phone") || w.docked) return; w.max = !w.max; applyGeo(w); });
    // drag by the bar
    bar.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest("button") || w.max || w.docked || el.classList.contains("phone")) return;
      const sx = e.clientX, sy = e.clientY, g = { ...w.geo }, lb = bounds(); bar.setPointerCapture(e.pointerId); el.classList.add("moving");
      const mv = (ev) => { w.geo.x = Math.round(Math.max(-g.w + 120, Math.min(lb.width - 120, g.x + ev.clientX - sx))); w.geo.y = Math.round(Math.max(0, Math.min(lb.height - 48, g.y + ev.clientY - sy))); applyGeo(w); };
      const upf = () => { bar.removeEventListener("pointermove", mv); bar.removeEventListener("pointerup", upf); bar.removeEventListener("pointercancel", upf); el.classList.remove("moving"); };
      bar.addEventListener("pointermove", mv); bar.addEventListener("pointerup", upf); bar.addEventListener("pointercancel", upf);
    });
    // resize from the edges
    el.querySelectorAll("[data-rz]").forEach((hd) => hd.addEventListener("pointerdown", (e) => {
      if (w.max) return; e.preventDefault(); e.stopPropagation();
      const k = hd.dataset.rz, sx = e.clientX, sy = e.clientY, g = { ...w.geo }; hd.setPointerCapture(e.pointerId); el.classList.add("moving");
      const mv = (ev) => { const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (k.includes("e") || k === "se") w.geo.w = Math.max(380, g.w + dx);
        if (k === "w") { w.geo.w = Math.max(380, g.w - dx); w.geo.x = g.x + g.w - w.geo.w; }
        if (k.includes("s")) w.geo.h = Math.max(300, g.h + dy);
        applyGeo(w); };
      const upf = () => { hd.removeEventListener("pointermove", mv); hd.removeEventListener("pointerup", upf); el.classList.remove("moving"); ls.set("bpGeo", { w: w.geo.w, h: w.geo.h }); };
      hd.addEventListener("pointermove", mv); hd.addEventListener("pointerup", upf);
    }));
    const title = el.querySelector(".bp-title");
    const fit = () => { title.style.height = "auto"; title.style.height = title.scrollHeight + "px"; };
    title.addEventListener("input", () => { fit(); setItem(w, { title: title.value.slice(0, 160) }); drawBar(w); });
    title.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); w.ed && w.ed.focus("start"); } });
    w.fitTitle = fit;
    el.addEventListener("keydown", (e) => { if (e.key === "Escape" && !e.defaultPrevented && !document.querySelector(".rte-pop,.rte-menu,.bd-menu")) { e.preventDefault(); if (w.docked) close(w.id); else minimize(w.id); } });
  }

  const item = (w) => ctx.canvas()?.item(w.id);
  function setItem(w, patch) { ctx.canvas()?.patchItem(w.id, patch); }
  function drawBar(w) {
    const it = item(w); if (!it) return;
    w.el.querySelector(".bp-bt").textContent = label(it);
    const cr = w.el.querySelector(".bp-crumb"); if (cr && ctx.boardName) cr.textContent = ctx.boardName();
    w.el.querySelector(".bp-bi").innerHTML = I(it.icon && ICONS[it.icon] ? it.icon : "file-text", 17);
    w.el.setAttribute("aria-label", label(it));
    const chip = [...tray.children].find((c) => c.title === "Show " + label(it)); if (chip) drawTray();
  }
  function drawHead(w) {
    const it = item(w); if (!it) return;
    const el = w.el, cov = el.querySelector(".bp-cover"), ic = el.querySelector(".bp-icon"), adds = el.querySelector(".bp-adds"), title = el.querySelector(".bp-title");
    if (document.activeElement !== title) title.value = it.title || "";
    setTimeout(() => w.fitTitle && w.fitTitle(), 0);
    const c = it.cover;
    cov.className = "bp-cover" + (c ? " has" : "");
    cov.style.background = c && c.k ? coverCss(c) : "";
    cov.innerHTML = c && c.src ? `<img src="${esc(c.src)}" alt="" draggable="false" style="object-position:50% ${c.fy ?? 50}%">` : "";
    if (w.owner && c) {
      cov.insertAdjacentHTML("beforeend", `<div class="bp-cb">${c.src ? '<button data-c="pos">Reposition</button>' : ""}<button data-c="change">Change cover</button><button data-c="remove">Remove</button></div>`);
      cov.querySelectorAll("[data-c]").forEach((b) => (b.onclick = (e) => {
        const a = b.dataset.c;
        if (a === "remove") { setItem(w, { cover: null }); drawHead(w); return; }
        if (a === "change") { coverPicker(w, b); return; }
        reposition(w, cov);
      }));
    }
    ic.innerHTML = it.icon && ICONS[it.icon] ? I(it.icon, 40) : ""; ic.classList.toggle("empty", !(it.icon && ICONS[it.icon]));
    ic.onclick = () => { if (w.owner) iconPicker(w, ic); };
    if (adds) {
      adds.innerHTML = `${it.icon && ICONS[it.icon] ? "" : `<button data-ai>${I("smile", 15)}Add icon</button>`}${it.cover ? "" : `<button data-ac>${I("image", 15)}Add cover</button>`}`;
      adds.querySelector("[data-ai]")?.addEventListener("click", (e) => iconPicker(w, e.currentTarget));
      adds.querySelector("[data-ac]")?.addEventListener("click", (e) => coverPicker(w, e.currentTarget));
    }
    drawBar(w);
  }
  function pop(anchor, cls) {
    document.querySelectorAll(".bp-pop").forEach((x) => x.remove());
    const m = h("div", { class: "bp-pop bdc " + cls }); document.body.append(m);
    const r = anchor.getBoundingClientRect();
    requestAnimationFrame(() => { m.style.left = Math.max(8, Math.min(innerWidth - m.offsetWidth - 8, r.left)) + "px"; m.style.top = Math.max(8, Math.min(innerHeight - m.offsetHeight - 8, r.bottom + 6)) + "px"; });
    m.style.left = r.left + "px"; m.style.top = r.bottom + 6 + "px";
    setTimeout(() => document.addEventListener("pointerdown", function off(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener("pointerdown", off, true); } }, true), 0);
    m.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); m.remove(); } });
    return m;
  }
  function iconPicker(w, anchor) {
    const m = pop(anchor, "bp-icons");
    const draw = (q = "") => {
      const list = PAGE_ICONS.filter((n) => !q || n.replace(/-/g, " ").includes(q.toLowerCase()));
      m.querySelector(".bp-ig").innerHTML = list.map((n) => `<button data-i="${n}" title="${n.replace(/-/g, " ")}" aria-label="${n.replace(/-/g, " ")}">${I(n, 20)}</button>`).join("") || '<p class="hint">No icon matches.</p>';
      m.querySelectorAll("[data-i]").forEach((b) => (b.onclick = () => { setItem(w, { icon: b.dataset.i }); m.remove(); drawHead(w); }));
    };
    m.innerHTML = `<input type="search" placeholder="Search icons" aria-label="Search icons" autocomplete="off"><div class="bp-ig"></div><button class="bp-rm" data-rm>Remove icon</button>`;
    draw(); m.querySelector("input").oninput = (e) => draw(e.target.value.trim()); m.querySelector("[data-rm]").onclick = () => { setItem(w, { icon: "" }); m.remove(); drawHead(w); };
    setTimeout(() => m.querySelector("input")?.focus(), 30);
  }
  function coverPicker(w, anchor) {
    const m = pop(anchor, "bp-covers");
    m.innerHTML = `<div class="bp-mh">Covers</div><div class="bp-cg">${Object.entries(COVERS).map(([k, c]) => `<button data-k="${k}" title="${c.name}" aria-label="${c.name}" style="background:${coverCss({ k })}"></button>`).join("")}</div><button class="bp-up" data-up>${I("upload", 16)}<span>Upload a picture</span></button>`;
    m.querySelectorAll("[data-k]").forEach((b) => (b.onclick = () => { setItem(w, { cover: { k: b.dataset.k } }); m.remove(); drawHead(w); }));
    m.querySelector("[data-up]").onclick = async () => { m.remove(); try { const f = (await Up.pick("image/*"))[0]; if (!f) return; status(w, "Uploading…"); const r = await Up.image(f); setItem(w, { cover: { src: r.url, fy: 50 } }); drawHead(w); status(w, ""); } catch (e) { toast(e.message || "Upload failed"); status(w, ""); } };
  }
  function reposition(w, cov) {
    const it = item(w); if (!it || !it.cover || !it.cover.src) return;
    const img = cov.querySelector("img"), bar = cov.querySelector(".bp-cb"); cov.classList.add("repos"); bar.innerHTML = "<button data-done>Done</button>";
    let y0 = null, fy0 = it.cover.fy ?? 50, fy = fy0;
    const down = (e) => { if (e.target.closest("button")) return; y0 = e.clientY; fy0 = fy; cov.setPointerCapture(e.pointerId); };
    const mv = (e) => { if (y0 == null) return; fy = Math.max(0, Math.min(100, fy0 - ((e.clientY - y0) / (cov.offsetHeight || 200)) * 120)); img.style.objectPosition = `50% ${fy}%`; };
    const upf = () => { y0 = null; };
    cov.addEventListener("pointerdown", down); cov.addEventListener("pointermove", mv); cov.addEventListener("pointerup", upf);
    bar.querySelector("[data-done]").onclick = () => { cov.removeEventListener("pointerdown", down); cov.removeEventListener("pointermove", mv); cov.removeEventListener("pointerup", upf); cov.classList.remove("repos"); setItem(w, { cover: { src: it.cover.src, fy: Math.round(fy) } }); drawHead(w); };
  }
  function status(w, s) { if (w.stEl) w.stEl.textContent = s; }
  function foot(w) {
    const e = w.footEl; if (!e) return;
    const bl = w.ed ? w.ed.getBlocks() : w.blocks, n = (blocksText(bl, " ").match(/\S+/g) || []).length;
    e.textContent = `${n} word${n === 1 ? "" : "s"} · ${Math.max(1, Math.round(n / 220))} min read`;
  }

  /* ---------- the writing ---------- */
  const DK = (id) => "bpDraft:" + id;
  async function loadBody(w, fresh) {
    const cached = BODY.get(w.id);
    const r = cached && w.inline ? { ok: true, data: cached } : await api("/api/boards?page=" + w.id); // in place: start at once from what the card shows
    if (!W.has(w.id) || W.get(w.id) !== w) return;
    if (!r.ok) { w.bodyEl.innerHTML = `<p class="hint">${r.status === 0 ? "You're offline. This page will open when you're back online." : "Could not open this page."}</p>`; return; }
    let blocks = r.data.blocks || []; w.updated = r.data.updated || 0;
    const mine = SAVED.get(w.id); if (mine && mine.updated > w.updated) { blocks = mine.blocks; w.updated = mine.updated; }
    const dr = ls.get(DK(w.id), null);
    if (w.owner && dr && JSON.stringify(dr.blocks) !== JSON.stringify(blocks)) {
      if ((dr.base || 0) >= w.updated) { blocks = dr.blocks; w.dirty = true; toast("Recovered writing that was not saved yet."); }
      else { await keepCopy(w, dr.blocks, "Writing that was not saved is kept as a separate page."); ls.del(DK(w.id)); }
    } else if (dr) ls.del(DK(w.id));
    if (!blocks.length && ctx.seed && ctx.seed[w.id]) { blocks = ctx.seed[w.id]; delete ctx.seed[w.id]; w.dirty = true; }
    w.blocks = blocks;
    const host = w.bodyEl; host.innerHTML = "";
    if (w.owner) {
      w.ed = await makeEditor(host, { blocks, escLeaves: w.inline, placeholder: w.inline ? "Type '/' for blocks…" : "Type '/' for blocks, or just start writing…", onChange: () => touch(w), onStatus: (s) => { if (s) status(w, s); } });
      if (!W.has(w.id) || W.get(w.id) !== w) { try { w.ed.destroy(); } catch {} return; }
      if (w.focusAt === "body") w.ed.focus("end");
      else if (fresh || !(item(w)?.title)) setTimeout(() => w.titleEl?.focus(), 80);
      if (w.dirty) touch(w, true);
    } else showBlocks(host, blocks);
    foot(w);
  }
  function touch(w, now) {
    if (!w.owner) return; w.dirty = true; status(w, "Unsaved");
    try { ls.set(DK(w.id), { base: w.updated, blocks: w.ed.getBlocks(), ts: Date.now() }); } catch {}
    clearTimeout(w.saveT); w.saveT = setTimeout(() => save(w), now ? 0 : 900); foot(w);
  }
  async function save(w) {
    clearTimeout(w.saveT); w.saveT = 0;
    if (!w.ed || !w.dirty) return true;
    if (w.saving) { w.saveT = setTimeout(() => save(w), 400); return false; }
    if (w.ed.uploading && w.ed.uploading()) { w.saveT = setTimeout(() => save(w), 800); return false; }
    w.saving = true; w.dirty = false; status(w, "Saving…");
    const blocks = w.ed.getBlocks();
    const r = await api("/api/boards?page=" + w.id, { method: "PUT", body: { blocks, base: w.updated, title: label(item(w)) } });
    w.saving = false;
    if (r.status === 409 && r.data.conflict) {
      await keepCopy(w, blocks, "This page was changed somewhere else. Your version is kept as a separate page next to it.");
      w.updated = r.data.updated; w.blocks = r.data.blocks || []; if (w.ed) w.ed.setBlocks(w.blocks); ls.del(DK(w.id)); status(w, "Saved"); return false;
    }
    if (!r.ok) { w.dirty = true; status(w, r.status === 0 ? "Offline · kept on this device" : "Not saved · retrying"); w.saveT = setTimeout(() => save(w), 4000); return false; }
    w.updated = r.data.updated; SAVED.set(w.id, { blocks, updated: w.updated });
    if (!w.dirty) ls.del(DK(w.id));
    ctx.canvas()?.patchItem(w.id, { snip: r.data.snip || "", words: r.data.words || 0, edited: Date.now() });
    status(w, w.dirty ? "Unsaved" : "Saved"); return true;
  }
  async function keepCopy(w, blocks, msg) {
    const cv = ctx.canvas(), it = item(w); if (!cv || !it) return;
    const id = cv.addPageCard({ x: it.x + it.w + 40, y: it.y, w: it.w, h: it.h, title: label(it) + " (my edit)", icon: it.icon, cover: it.cover, noOpen: true }).id;
    await api("/api/boards?page=" + id, { method: "PUT", body: { blocks, base: 0 } });
    toast(msg);
  }
  const report = (w) => { if (w.ed) { try { w.ed.flush(true); } catch {} } }; // writing from the last moment counts too
  async function flushAll() { await Promise.all([...W.values()].map((w) => (report(w), w.saveT || w.dirty ? save(w) : true))); }
  function beacon() { for (const w of W.values()) if ((report(w), w.dirty) && w.ed) api("/api/boards?page=" + w.id, { method: "PUT", body: { blocks: w.ed.getBlocks(), base: w.updated }, keepalive: true }); }

  /* ---------- window actions ---------- */
  async function minimize(id) {
    const w = W.get(id); if (!w || w.min) return;
    save(w);
    const to = ctx.canvas()?.rectOf(id), lb = bounds();
    if (to && to.width > 8 && to.left < lb.right && to.top < lb.bottom && to.left + to.width > lb.left && to.top + to.height > lb.top && !w.max) {
      const a = flip(w.el, { x: to.left - lb.left, y: to.top - lb.top, w: to.width, h: to.height }, w.geo, false); await a.finished.catch(() => {});
    } else await w.el.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(30px) scale(.94)" }], { duration: 180, easing: "cubic-bezier(.2,0,0,1)" }).finished.catch(() => {});
    w.min = true; w.el.hidden = true; drawTray(); ctx.onClosed && ctx.onClosed();
  }
  function restore(id) {
    const w = W.get(id); if (!w) return;
    w.min = false; w.el.hidden = false; front(w); drawTray(); drawHead(w);
    w.el.animate([{ opacity: 0, transform: "translateY(24px) scale(.96)" }, { opacity: 1, transform: "none" }], { duration: 200, easing: "cubic-bezier(.2,0,0,1)" });
  }
  async function close(id) {
    const w = W.get(id); if (!w) return;
    if (w.inline) return w.finish();
    if (w.ed) { try { w.ed.flush(true); } catch {} }
    if (w.saveT || w.dirty) await save(w);
    W.delete(id);
    if (w.docked) await w.el.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(24px)" }], { duration: 160, easing: "cubic-bezier(.2,0,0,1)" }).finished.catch(() => {});
    else if (!w.el.hidden && !w.el.classList.contains("phone")) { const to = ctx.canvas()?.rectOf(id), lb = bounds(); if (to && to.width > 8 && !w.max) await flip(w.el, { x: to.left - lb.left, y: to.top - lb.top, w: to.width, h: to.height }, w.geo, false).finished.catch(() => {}); }
    if (w.ed) { try { w.ed.destroy(); } catch {} }
    w.el.remove(); drawTray(); ctx.onClosed && ctx.onClosed(w);
  }
  function moreMenu(w) {
    const it = item(w);
    return [
      { t: "Show on the board", i: "fit", run: () => { if (w.docked) { close(w.id); ctx.showOnBoard && ctx.showOnBoard(w.id); } else { minimize(w.id); ctx.canvas()?.focusItem(w.id); } } },
      ...(w.docked ? [] : [{ t: w.max ? "Restore size" : "Maximise", i: "fit", run: () => { w.max = !w.max; applyGeo(w); } }]),
      "-",
      { t: "Download as Markdown", i: "download", run: () => download(it, w.ed ? w.ed.getBlocks() : w.blocks, "md") },
      { t: "Save as PDF", i: "print", run: () => download(it, w.ed ? w.ed.getBlocks() : w.blocks, "pdf") },
      { t: "Copy all text", i: "copy", run: async () => { try { await navigator.clipboard.writeText(blocksText(w.ed ? w.ed.getBlocks() : w.blocks)); toast("Copied"); } catch { toast("Could not copy"); } } },
      ...(w.owner ? ["-", { t: "Version history", i: "history", run: () => history(w) },
        { t: "Delete page", i: "trash", danger: true, run: async () => { if (!(await confirmBox("Delete this page from the board? You can undo it with Ctrl+Z.", "Delete"))) return; await close(w.id); ctx.removeItem && ctx.removeItem(w.id); } }] : []),
    ];
  }
  async function history(w) {
    await save(w);
    const r = await api("/api/boards?page=" + w.id + "&a=history"); const list = r.ok ? r.data.history : [];
    const d = h("div", { class: "own-dlg" }), card = h("div", { class: "own-card bp-hist", role: "dialog", "aria-modal": "true" }, h("b", {}, "Version history"));
    if (!list.length) card.append(h("p", { class: "hint" }, "No earlier versions yet. A copy is kept every few minutes while you write."));
    for (const v of list) card.append(h("div", { class: "bp-hr" }, h("span", {}, new Date(v.ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })), h("small", {}, `${(blocksText(v.blocks, " ").match(/\S+/g) || []).length} words`), h("button", { class: "btn tonal", onclick: () => { d.remove(); if (w.ed) { w.ed.setBlocks(v.blocks); touch(w, true); toast("Earlier version put back. Ctrl+Z in the text undoes it."); } } }, "Restore")));
    card.append(h("div", { class: "own-row" }, h("button", { type: "button", onclick: () => d.remove() }, "Close")));
    d.append(card); document.body.append(d); d.addEventListener("pointerdown", (e) => { if (e.target === d) d.remove(); });
  }

  /* ---------- editing right on the board: the card itself becomes the page ---------- */
  async function inline(it, card, { at } = {}) {
    if (W.has(it.id)) { const ex = W.get(it.id); if (!ex.inline) { if (ex.min) restore(it.id); else front(ex); return null; } return ex; }
    const titleEl = card.querySelector(".bd-pgt"), bodyEl = card.querySelector(".bd-pgx"), stEl = card.querySelector(".bd-pgm");
    if (!titleEl || !bodyEl) return null;
    const ta = h("textarea", { class: "bd-pgti", rows: "1", maxlength: "160", placeholder: "Untitled", "aria-label": "Page title" }); ta.value = it.title || "";
    titleEl.replaceWith(ta);
    const fit = () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; }; fit();
    ta.addEventListener("input", () => { fit(); const cv = ctx.canvas(), cur = cv && cv.item(it.id); if (cur) { cur.title = ta.value.slice(0, 160); cv.patchItem(it.id, { title: cur.title }); } });
    ta.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); w.ed && w.ed.focus("start"); } });
    const w = { id: it.id, el: card, inline: true, ed: null, blocks: [], updated: 0, saveT: 0, dirty: false, owner: true, saving: false, bodyEl, titleEl: ta, stEl, footEl: null, focusAt: at === "title" ? "title" : "body" };
    w.finish = async () => {
      if (W.get(it.id) !== w) return;
      if (w.ed) { try { w.ed.flush(true); } catch {} }
      if (w.saveT || w.dirty) await save(w);
      W.delete(it.id);
      if (w.ed) { try { w.ed.destroy(); } catch {} }
      listeners.forEach((f) => f(it.id));
    };
    W.set(it.id, w);
    if (at === "title") setTimeout(() => { ta.focus(); ta.select(); }, 30);
    // keep the line being written in view: scroll inside the card, and pan the board if the card runs off screen
    const keepCaret = () => requestAnimationFrame(() => {
      const sl = getSelection(); if (!sl.rangeCount || !bodyEl.contains(sl.anchorNode)) return;
      let r = sl.getRangeAt(0).getBoundingClientRect(); if (!r.height) { const n = sl.anchorNode.nodeType === 1 ? sl.anchorNode : sl.anchorNode.parentElement; r = n.getBoundingClientRect(); }
      const c = bodyEl.getBoundingClientRect();
      if (r.bottom > c.bottom - 8) bodyEl.scrollTop += r.bottom - c.bottom + 28; else if (r.top < c.top + 4) bodyEl.scrollTop -= c.top - r.top + 28;
      const r2 = sl.getRangeAt(0).getBoundingClientRect(); if (r2.height) ctx.canvas()?.reveal(r2);
    });
    bodyEl.addEventListener("input", keepCaret); bodyEl.addEventListener("keyup", (e) => { if (/^(Enter|Arrow|Page|Home|End|Backspace)/.test(e.key)) keepCaret(); });
    await loadBody(w, false);
    return w;
  }

  return {
    open, close, minimize, restore, flushAll, beacon, inline, isOpen: (id) => W.has(id) && !W.get(id).inline,
    refresh(id) { const w = W.get(id); if (w) drawHead(w); },
    closeAll: async () => { for (const id of [...W.keys()]) await close(id); offLive(); },
    finishInline: async () => { for (const w of [...W.values()]) if (w.inline) await w.finish(); },
    dirty: () => [...W.values()].some((w) => w.dirty || w.saveT),
  };
}

/* ---------- downloads ---------- */
export async function download(it, blocks, kind) {
  const title = label(it);
  if (!blocks) { const r = await api("/api/boards?page=" + it.id); blocks = r.ok ? r.data.blocks : []; }
  if (kind === "md") {
    const md = `# ${title}\n\n${blocksToMd(blocks || [])}\n`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown;charset=utf-8" })); a.download = slug(title) + ".md";
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); return;
  }
  const c = h("div", { id: "print-one" });
  const cov = it.cover && it.cover.src ? `<img src="${esc(it.cover.src)}" alt="" style="width:100%;max-height:220px;object-fit:cover;border-radius:10px;margin-bottom:14px">` : "";
  c.innerHTML = `${cov}<h1>${esc(title)}</h1><div class="bk-doc"></div>`;
  showBlocks(c.querySelector(".bk-doc"), blocks || []);
  document.body.append(c); document.body.classList.add("print-one");
  const imgs = [...c.querySelectorAll("img")].filter((i) => !i.complete); await Promise.race([Promise.all(imgs.map((i) => new Promise((r) => { i.onload = i.onerror = r; }))), new Promise((r) => setTimeout(r, 2500))]);
  const fin = () => { c.remove(); document.body.classList.remove("print-one"); window.removeEventListener("afterprint", fin); };
  window.addEventListener("afterprint", fin); setTimeout(() => window.print(), 60);
  toast("Choose “Save as PDF” as the printer");
}
