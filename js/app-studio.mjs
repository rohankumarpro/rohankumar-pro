// Content Studio: plan a whole video. The pipeline (idea to published), a timeline of parts you build by dragging
// reusable blocks (hooks, rehooks, stakes, points…) or applying a formula, a script with read-aloud timing, b-roll
// for every part, checks that catch problems before you film, the shot list, the publish kit, a schedule worked
// back from the publish date, and a coach with fixes for common problems. Owner only.
// Videos are rows of the Content calendar database (Workspace); each video's plan is saved through /api/studio.
import { h, esc, api, toast, isAdmin, mobile, confirmBox } from "/js/lib.mjs";
import { R } from "/js/os-ext.mjs";
import { WS, DB, fmtDate, today, rid } from "/js/ws-core.mjs";
import { WI, popover, closePop, choose, askText, mountDatabase } from "/js/ws-db.mjs";
import { KIND, SEG_KINDS, STAGES, words, readSec, segSec, clock, timeline, total, holes, fill, fillMap, allHoles, shotList, chapters, chaptersText, planBack, checks, COACH, COACH_BY } from "/js/studio-data.mjs";

for (const css of ["/css/planner.css", "/css/studio.css"]) if (!document.querySelector(`link[href="${css}"]`)) document.head.append(h("link", { rel: "stylesheet", href: css }));
const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const GEAR = ["Camera and a charged battery", "Microphone (and its battery)", "Lights", "Memory card, emptied", "Tripod", "Script on the phone or printed", "Water"];
const kindChip = (k) => `<span class="st-k" data-c="${KIND[k]?.c || "grey"}">${WI(KIND[k]?.ico || "bulb", 13)}${esc(KIND[k]?.name || k)}</span>`;

export async function studioApp(body, slug0) {
  if (!isAdmin()) { body.innerHTML = '<p class="hint" style="padding:24px">The Studio is private. Sign in as the owner.</p>'; return; }
  body.classList.add("st-body");
  body.innerHTML = '<div class="st"><div class="wd-load"><span class="rb-spin"></span></div></div>';
  const root = body.firstElementChild;
  const meta = await WS.ensure("content");
  if (!meta) { root.innerHTML = '<p class="hint">Could not open the Studio. Check your connection.</p>'; return; }
  const dbId = meta.id;
  const S = { tab: ls.get("stTab", "pipeline"), lib: null, libRev: 0, vid: null, doc: null, rev: 0, dirty: false, saving: false, saveT: 0, side: ls.get("stSide", "blocks"), kf: "hook", q: "", sel: null, coachQ: "", pdb: null };
  const row = () => S.vid && DB.get(dbId)?.rows[S.vid];
  const P = (test) => DB.get(dbId).props.find(test);
  const stageP = () => P((p) => p.type === "status"), dateP = () => P((p) => p.type === "date"), linkP = () => P((p) => p.type === "url");
  const stageOf = (r) => { const p = stageP(); return (p && (p.opts || []).find((o) => o.id === r.v[p.id])?.name) || "Idea"; };
  const publishOf = (r) => { const p = dateP(); return p ? String(r.v[p.id] || "").slice(0, 10) : ""; };

  /* ---------- the library of blocks and formulas ---------- */
  async function loadLib() { const r = await api("/api/studio?a=lib"); if (r.ok) { S.lib = r.data; S.libRev = r.data.rev; } return S.lib; }
  let libT = 0;
  function saveLib() { clearTimeout(libT); libT = setTimeout(async () => { const r = await api("/api/studio?a=lib", { method: "PUT", body: { blocks: S.lib.blocks, formulas: S.lib.formulas, base: S.libRev } }); if (r.ok) { S.libRev = r.data.rev; } else if (r.status === 409) { const mine = S.lib; S.lib = r.data.lib; S.libRev = r.data.lib.rev; for (const b of mine.blocks) if (!S.lib.blocks.some((x) => x.id === b.id)) S.lib.blocks.push(b); for (const f of mine.formulas) if (!S.lib.formulas.some((x) => x.id === f.id)) S.lib.formulas.push(f); saveLib(); } else toast("Could not save the library"); }, 600); }
  const used = (b) => { b.uses = (b.uses || 0) + 1; saveLib(); };

  /* ---------- top level: pipeline, library, coach ---------- */
  function shell() {
    if (S.pdb) { S.pdb.destroy(); S.pdb = null; }
    root.innerHTML = `<header class="st-h"><div><h2>Studio</h2><p>Plan the whole video: hook, structure, script, b-roll, shoot and publish.</p></div>
      <div class="st-ha"><div class="pl-seg">${[["pipeline", "Pipeline"], ["library", "Blocks"], ["coach", "Coach"]].map(([k, t]) => `<button data-tab="${k}" class="${S.tab === k ? "on" : ""}">${t}</button>`).join("")}</div>
      <button class="pl-btn pri" data-a="new">${WI("plus", 16)}<span>New video</span></button></div></header><div class="st-main"></div>`;
    root.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { S.tab = b.dataset.tab; ls.set("stTab", S.tab); shell(); }));
    root.querySelector('[data-a="new"]').onclick = (e) => newVideo(e.currentTarget);
    const main = root.querySelector(".st-main");
    if (S.tab === "pipeline") pipeline(main); else if (S.tab === "library") library(main); else coach(main);
  }
  function pipeline(main) {
    // the pipeline is the Content calendar database itself, on its board view (drag videos between stages)
    const doc = DB.get(dbId), v = doc.views.find((x) => x.type === "board"); if (v) ls.set("wdView:" + dbId, v.id);
    main.innerHTML = `<div class="st-pipe"></div>`;
    S.pdb = mountDatabase(main.firstElementChild, { id: dbId, compact: true, openRow: (id) => openVideo(id) });
  }
  function newVideo(anchor) {
    const box = h("form", { class: "wd-menu pl-form" });
    box.innerHTML = `<div class="wd-mh">New video</div><input class="wd-in" name="t" placeholder="Topic or working title" required maxlength="200"><div class="pl-seg st-fmt"><button type="button" data-f="long" class="on">Long video</button><button type="button" data-f="short">Short</button></div>
      <label class="pl-lab">Formula<select class="wd-in sm" name="f"><option value="">Start empty</option>${(S.lib?.formulas || []).map((f) => `<option value="${f.id}">${esc(f.name)}</option>`).join("")}</select></label>
      <label class="pl-lab">Publish on (optional)<input class="wd-in" type="date" name="d"></label>
      <div class="pl-fb"><span class="wd-sp"></span><button type="button" class="pl-btn" data-x>Cancel</button><button class="pl-btn pri">Plan it</button></div>`;
    let fmt = "long";
    box.querySelectorAll("[data-f]").forEach((b) => (b.onclick = () => { fmt = b.dataset.f; box.querySelectorAll("[data-f]").forEach((x) => x.classList.toggle("on", x === b)); const sel = box.querySelector('[name="f"]'); const pick = (S.lib?.formulas || []).find((f) => f.fmt === fmt); if (pick) sel.value = pick.id; }));
    box.querySelector("[data-x]").onclick = () => closePop();
    const firstLong = (S.lib?.formulas || []).find((f) => f.fmt === "long"); if (firstLong) box.querySelector('[name="f"]').value = firstLong.id;
    box.onsubmit = async (e) => {
      e.preventDefault(); const f = new FormData(box), t = String(f.get("t")).trim(); if (!t) return; closePop();
      const st = stageP(), idea = st && (st.opts || []).find((o) => o.name === "Idea") || (st && st.opts[0]), dp = dateP();
      const r = DB.newRow(dbId, { title: t, order: Date.now(), v: { ...(st && idea ? { [st.id]: idea.id } : {}), ...(dp && f.get("d") ? { [dp.id]: f.get("d") } : {}) } });
      await DB.flush(dbId);
      const doc = blank(fmt, t); const formula = (S.lib?.formulas || []).find((x) => x.id === f.get("f")); if (formula) applyFormula(doc, formula);
      await api("/api/studio?v=" + r.id, { method: "PUT", body: { doc, base: 0 } });
      openVideo(r.id);
    };
    popover(anchor, box, { w: 320 }); setTimeout(() => box.querySelector("input").focus(), 30);
  }
  const blank = (fmt, topic = "") => ({ topic, promise: "", audience: "", fmt, target: fmt === "short" ? 40 : 600, wpm: 150, fill: {}, segs: [], titles: [], thumbs: [], desc: "", tags: "", shoot: { gear: GEAR.map((t) => ({ id: rid(), t })), places: [], todo: [], date: "" }, plan: [], notes: "", done: [] });
  // the best block of a kind: favourites first, then the ones you use most
  const bestBlock = (kind, skip = new Set()) => (S.lib?.blocks || []).filter((b) => b.kind === kind && !skip.has(b.id)).sort((a, b) => (b.fav - a.fav) || (b.uses - a.uses))[0];
  function applyFormula(doc, f) {
    const usedIds = new Set();
    for (const st of f.steps) { const b = (st.block && S.lib.blocks.find((x) => x.id === st.block)) || bestBlock(st.kind, usedIds); if (b) usedIds.add(b.id); doc.segs.push({ id: rid(), kind: st.kind, title: b ? b.name : KIND[st.kind]?.name || "", script: b ? b.text : "", sec: null, broll: [], notes: "", ...(b ? { block: b.id } : {}), plan: st.sec }); }
    doc.target = f.steps.reduce((a, s) => a + s.sec, 0); doc.fmt = f.fmt;
    f.uses = (f.uses || 0) + 1; saveLib();
  }

  /* ---------- the blocks library ---------- */
  function library(main) {
    const kinds = Object.keys(KIND), q = S.q.trim().toLowerCase();
    const list = (S.lib?.blocks || []).filter((b) => (S.kf === "all" || b.kind === S.kf) && (!q || (b.name + " " + b.text + " " + (b.tags || []).join(" ")).toLowerCase().includes(q))).sort((a, b) => (b.fav - a.fav) || (b.uses - a.uses));
    main.innerHTML = `<div class="st-lib"><div class="st-libbar"><div class="st-kf">${["all", ...kinds].map((k) => `<button data-kf="${k}" class="${S.kf === k ? "on" : ""}">${k === "all" ? "All" : esc(KIND[k].name)}<em>${k === "all" ? S.lib.blocks.length : S.lib.blocks.filter((b) => b.kind === k).length}</em></button>`).join("")}</div>
      <label class="wd-search">${WI("search", 16)}<input type="search" placeholder="Search blocks" value="${esc(S.q)}"></label><button class="pl-btn pri" data-a="addb">${WI("plus", 15)}<span>New block</span></button></div>
      ${S.kf !== "all" ? `<p class="st-kt">${esc(KIND[S.kf].tip)} Write {topic}, {result}, {pain}… where the video's own words go; they fill in from each video.</p>` : ""}
      <div class="st-blocks">${list.map((b) => `<article class="st-b" data-b="${b.id}"><header>${kindChip(b.kind)}<b>${esc(b.name || "Untitled")}</b><button class="st-fav${b.fav ? " on" : ""}" data-fav="${b.id}" aria-label="Favourite" title="Favourite">${WI("star", 15)}</button></header><p>${esc(b.text).replace(/\{(\w+)\}/g, '<mark>{$1}</mark>')}</p><footer>${(b.tags || []).map((t) => `<span>#${esc(t)}</span>`).join("")}<em>${b.uses ? `used ${b.uses}×` : ""}</em></footer></article>`).join("") || `<p class="pl-note">No blocks match.</p>`}</div>
      <h3 class="st-fh">Formulas</h3><p class="st-kt">A formula is a structure: parts in order, with how long each should run. Apply one to a new video and the whole plan appears, filled from your favourite blocks.</p>
      <div class="st-forms">${S.lib.formulas.map((f) => formulaCard(f)).join("")}</div></div>`;
    main.querySelectorAll("[data-kf]").forEach((b) => (b.onclick = () => { S.kf = b.dataset.kf; library(main); }));
    const qi = main.querySelector(".wd-search input"); qi.oninput = () => { S.q = qi.value; const p = qi.selectionStart; library(main); const n = main.querySelector(".wd-search input"); n.focus(); try { n.setSelectionRange(p, p); } catch {} };
    main.querySelector('[data-a="addb"]').onclick = (e) => blockForm(e.currentTarget, null, () => library(main));
    main.querySelectorAll("[data-b]").forEach((c) => (c.onclick = (e) => { if (e.target.closest("[data-fav]")) return; blockForm(c, S.lib.blocks.find((x) => x.id === c.dataset.b), () => library(main)); }));
    main.querySelectorAll("[data-fav]").forEach((b) => (b.onclick = () => { const x = S.lib.blocks.find((y) => y.id === b.dataset.fav); x.fav = !x.fav; saveLib(); library(main); }));
    main.querySelectorAll("[data-fm]").forEach((b) => (b.onclick = () => formulaMenu(b, S.lib.formulas.find((f) => f.id === b.dataset.fm), () => library(main))));
  }
  const formulaCard = (f) => { const tot = f.steps.reduce((a, s) => a + s.sec, 0); return `<article class="st-f"><header><b>${esc(f.name)}</b><em>${f.fmt === "short" ? "Short" : "Long"} · ${clock(tot)}</em><button class="pl-ib sm" data-fm="${f.id}" aria-label="Formula options">${WI("more", 15)}</button></header>${f.desc ? `<p>${esc(f.desc)}</p>` : ""}<div class="st-fbar">${f.steps.map((s) => `<i data-c="${KIND[s.kind]?.c}" style="flex:${s.sec}" title="${esc(KIND[s.kind]?.name)} · ${s.sec}s"></i>`).join("")}</div><div class="st-fsteps">${f.steps.map((s) => `<span data-c="${KIND[s.kind]?.c}">${esc(KIND[s.kind]?.name)}</span>`).join("")}</div></article>`; };
  function blockForm(anchor, b, after) {
    const box = h("form", { class: "wd-menu pl-form st-bf" });
    box.innerHTML = `<div class="wd-mh">${b ? "Block" : "New block"}</div><select class="wd-in sm" name="k">${Object.entries(KIND).map(([k, x]) => `<option value="${k}"${(b ? b.kind : S.kf !== "all" ? S.kf : "hook") === k ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select>
      <input class="wd-in" name="n" placeholder="Short name" maxlength="80" value="${esc(b ? b.name : "")}"><textarea class="wd-in" name="t" rows="5" placeholder="What you say. Use {topic}, {result}, {pain}… for the parts that change." maxlength="3000">${esc(b ? b.text : "")}</textarea>
      <input class="wd-in sm" name="g" placeholder="Tags, comma separated" value="${esc(b ? (b.tags || []).join(", ") : "")}">
      <div class="pl-fb">${b ? `<button type="button" class="pl-btn danger" data-del>${WI("trash", 15)}</button><button type="button" class="pl-btn" data-dup>${WI("dup", 15)}</button>` : ""}<span class="wd-sp"></span><button type="button" class="pl-btn" data-x>Cancel</button><button class="pl-btn pri">Save</button></div>`;
    box.querySelector("[data-x]").onclick = () => closePop();
    box.querySelector("[data-del]")?.addEventListener("click", async () => { if (!(await confirmBox("Delete this block? Videos that used it keep their text.", "Delete"))) return; S.lib.blocks = S.lib.blocks.filter((x) => x !== b); saveLib(); closePop(); after && after(); });
    box.querySelector("[data-dup]")?.addEventListener("click", () => { S.lib.blocks.unshift({ ...b, id: rid(), name: b.name + " (copy)", uses: 0, fav: false, mine: true }); saveLib(); closePop(); after && after(); });
    box.onsubmit = (e) => { e.preventDefault(); const f = new FormData(box), t = String(f.get("t")).trim(); if (!t) return; const o = { kind: String(f.get("k")), name: String(f.get("n")).trim(), text: t, tags: String(f.get("g")).split(",").map((x) => x.trim()).filter(Boolean) }; if (b) Object.assign(b, o); else S.lib.blocks.unshift({ id: rid(), ...o, uses: 0, fav: false, mine: true }); saveLib(); closePop(); after && after(); toast("Saved"); };
    popover(anchor, box, { w: 380 }); setTimeout(() => box.querySelector('[name="n"]').focus(), 30);
  }
  function formulaMenu(anchor, f, after) {
    choose(anchor, [
      { t: "Rename", i: "pencil", run: () => askText(anchor, "Formula name", f.name, (n) => { if (n) { f.name = n; saveLib(); after(); } }) },
      { t: "Describe", i: "text", run: () => askText(anchor, "What it's for", f.desc, (n) => { f.desc = n; saveLib(); after(); }) },
      { t: "Duplicate", i: "dup", run: () => { S.lib.formulas.push({ ...JSON.parse(JSON.stringify(f)), id: rid(), name: f.name + " (copy)", uses: 0, mine: true }); saveLib(); after(); } },
      "-", { t: "Delete", i: "trash", danger: true, run: async () => { if (await confirmBox(`Delete the formula “${f.name}”?`, "Delete")) { S.lib.formulas = S.lib.formulas.filter((x) => x !== f); saveLib(); after(); } } },
    ], { w: 220 });
  }

  /* ---------- the coach ---------- */
  function coach(main, focus) {
    const q = S.coachQ.trim().toLowerCase(), cats = [...new Set(COACH.map((c) => c.cat))];
    const list = COACH.filter((c) => !q || (c.p + " " + c.signs + " " + c.fix.join(" ")).toLowerCase().includes(q));
    main.innerHTML = `<div class="st-coach"><div class="st-libbar"><p class="st-kt">The problems creators run into most, how to spot them, and what fixes them. The checks in each video point here.</p><label class="wd-search">${WI("search", 16)}<input type="search" placeholder="Search problems" value="${esc(S.coachQ)}"></label></div>
      ${cats.map((cat) => { const items = list.filter((c) => c.cat === cat); return items.length ? `<h3 class="st-fh">${esc(cat)}</h3><div class="st-cl">${items.map((c) => `<details class="st-c" id="coach-${c.id}"${focus === c.id ? " open" : ""}><summary><b>${esc(c.p)}</b><small>${esc(c.signs)}</small></summary><ul>${c.fix.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></details>`).join("")}</div>` : ""; }).join("") || `<p class="pl-note">Nothing matches.</p>`}</div>`;
    const qi = main.querySelector(".wd-search input"); qi.oninput = () => { S.coachQ = qi.value; const p = qi.selectionStart; coach(main); const n = main.querySelector(".wd-search input"); n.focus(); try { n.setSelectionRange(p, p); } catch {} };
    if (focus) setTimeout(() => main.querySelector("#coach-" + focus)?.scrollIntoView({ block: "center" }), 30);
  }
  function coachPop(anchor, id) {
    const c = COACH_BY[id]; if (!c) return;
    const box = h("div", { class: "wd-menu st-cp" }); box.innerHTML = `<div class="wd-mh">${esc(c.cat)}</div><b>${esc(c.p)}</b><small>${esc(c.signs)}</small><ul>${c.fix.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
    popover(anchor, box, { w: 340 });
  }

  /* =====================================================================================================================
     One video
     ===================================================================================================================== */
  async function openVideo(id) {
    if (S.pdb) { S.pdb.destroy(); S.pdb = null; }
    await flush();
    root.innerHTML = '<div class="wd-load"><span class="rb-spin"></span></div>';
    const r = await api("/api/studio?v=" + id);
    S.vid = id; S.rev = r.ok ? r.data.rev || 0 : 0;
    const d = r.ok ? r.data.doc || {} : {};
    S.doc = Object.keys(d).length ? { ...blank(d.fmt || "long"), ...d } : blank("long", row()?.title || "");
    S.dirty = false; S.sel = null;
    drawVideo();
    R.item(body, "v/" + id, `${row()?.title || "Video"} — Studio`, "push");
  }
  function touch(redraw = "all") {
    S.dirty = true; status("Saving soon…"); clearTimeout(S.saveT); S.saveT = setTimeout(save, 900);
    if (redraw === "all") drawVideo(); else if (redraw) partial(redraw);
  }
  async function save() {
    if (!S.vid || S.saving) return; clearTimeout(S.saveT); if (!S.dirty) return;
    S.saving = true; S.dirty = false; status("Saving…");
    const vid = S.vid, doc = S.doc;
    let r = await api("/api/studio?v=" + vid, { method: "PUT", body: { doc, base: S.rev } });
    if (r.status === 409) { r = await api("/api/studio?v=" + vid, { method: "PUT", body: { doc, base: S.rev, force: true } }); if (r.ok) toast("Saved. A newer copy from another device was kept in this video's history."); }
    S.saving = false;
    if (!r.ok) { S.dirty = true; status(r.status === 0 ? "Offline. Kept here, saved when you're back." : "Not saved yet. Trying again…"); try { ls.set("stDraft:" + vid, doc); } catch {} S.saveT = setTimeout(save, 4000); return; }
    if (S.vid === vid) S.rev = r.data.rev; try { localStorage.removeItem("stDraft:" + vid); } catch {}
    status("Saved"); setTimeout(() => { if (!S.dirty && !S.saving) status(""); }, 1500);
    if (S.dirty) touch(null);
  }
  async function flush() { if (S.dirty) await save(); }
  const status = (t) => { const e = root.querySelector(".st-status"); if (e) e.textContent = t; };
  const setRow = (patch) => DB.ops(dbId, [{ op: "row", row: { id: S.vid, ...patch } }]);

  function drawVideo() {
    const r = row(); if (!r) { root.innerHTML = `<p class="pl-note">This video isn't in the Content calendar any more.</p>`; return; }
    const doc = S.doc, tl = timeline(doc), tot = tl.reduce((a, x) => a + x.dur, 0), tgt = doc.target, stage = stageOf(r), pub = publishOf(r);
    const ck = checks(doc, { title: r.title, stage, publish: pub }), nBad = ck.filter((c) => c.lvl === "bad" || c.lvl === "warn").length;
    const holesLeft = allHoles(doc);
    const sc = root.querySelector(".st-segs")?.scrollTop, sideSc = root.querySelector(".st-side .st-sb")?.scrollTop;
    root.innerHTML = `
      <header class="st-vh"><button class="pl-ib" data-a="back" aria-label="Back to the pipeline" title="Back">${WI("arrow-left", 18)}</button>
        <input class="st-title" value="${esc(r.title || "")}" placeholder="Working title" aria-label="Working title" maxlength="200">
        <span class="st-status" aria-live="polite"></span>
        <button class="pl-ib" data-a="vmore" aria-label="More" title="More">${WI("more", 18)}</button></header>
      <div class="st-meta">
        <div class="pl-seg st-stage">${STAGES.map((s) => `<button data-stage="${s}" class="${stage === s ? "on" : ""}">${s}</button>`).join("")}</div>
        <div class="pl-seg"><button data-fmt="long" class="${doc.fmt !== "short" ? "on" : ""}">Long</button><button data-fmt="short" class="${doc.fmt === "short" ? "on" : ""}">Short</button></div>
        <label class="st-ml">Publish<input type="date" data-pub value="${esc(pub)}"></label>
        <label class="st-ml">Length<input data-target value="${clock(tgt)}" size="5" aria-label="Target length (minutes:seconds)"></label>
        <label class="st-ml">Pace<input type="number" min="90" max="220" data-wpm value="${doc.wpm}" aria-label="Words per minute"><small>wpm</small></label>
      </div>
      <div class="st-brief">
        <label><span>Topic</span><input data-f="topic" value="${esc(doc.topic)}" placeholder="What it's about" maxlength="200"></label>
        <label><span>By the end they can</span><input data-f="promise" value="${esc(doc.promise)}" placeholder="The one promise" maxlength="400"></label>
        <label><span>For</span><input data-f="audience" value="${esc(doc.audience)}" placeholder="Who it's for" maxlength="200"></label>
        ${holesLeft.length ? `<div class="st-holes">${WI("pencil", 14)}<span>Fill in:</span>${holesLeft.map((k) => `<label class="st-hole"><em>{${esc(k)}}</em><input data-hole="${esc(k)}" placeholder="${esc(k)}" value="${esc((doc.fill || {})[k] || "")}"></label>`).join("")}</div>` : ""}
      </div>
      <div class="st-tl" data-drop="tl"><div class="st-tlbar">${tl.map((x) => `<button class="st-tc${S.sel === x.s.id ? " on" : ""}" draggable="true" data-tc="${x.s.id}" data-c="${KIND[x.s.kind]?.c}" style="flex:${Math.max(x.dur, 1)}" title="${esc(KIND[x.s.kind]?.name)} · ${clock(x.start)}–${clock(x.start + x.dur)}"><span>${esc(x.s.title || KIND[x.s.kind]?.name)}</span><small>${clock(x.dur)}</small></button>`).join("") || `<p class="st-tlempty">Drag blocks here, or apply a formula from the Blocks panel.</p>`}${tot < tgt ? `<i class="st-tlrest" style="flex:${tgt - tot}"></i>` : ""}</div>
        <div class="st-tlm"><span>0:00</span><span class="${tot > tgt * 1.15 ? "over" : ""}">${clock(tot)} of ${clock(tgt)}</span></div></div>
      <div class="st-work">
        <div class="st-segs" data-drop="list">${tl.map((x, i) => segCard(x, i)).join("")}<button class="st-addseg" data-add="end">${WI("plus", 16)}Add a part</button></div>
        <aside class="st-side"><div class="st-st">${[["blocks", "Blocks"], ["checks", `Checks${nBad ? ` <em>${nBad}</em>` : ""}`], ["shoot", "Shoot"], ["publish", "Publish"], ["plan", "Schedule"]].map(([k, t]) => `<button data-side="${k}" class="${S.side === k ? "on" : ""}">${t}</button>`).join("")}</div><div class="st-sb"></div></aside>
      </div>`;
    wireVideo(ck);
    drawSide(ck);
    if (sc != null) root.querySelector(".st-segs").scrollTop = sc;
    if (sideSc != null) root.querySelector(".st-side .st-sb").scrollTop = sideSc;
  }
  function segCard(x, i) {
    const s = x.s, doc = S.doc, txt = s.script || "", w = words(fill(txt, doc)), hs = holes(txt).filter((k) => !fillMap(doc)[k]);
    return `<article class="st-seg${S.sel === s.id ? " sel" : ""}" data-seg="${s.id}" data-c="${KIND[s.kind]?.c}">
      <header><span class="st-grip" draggable="true" data-drag="${s.id}" title="Drag to move" aria-label="Drag to move">${WI("grip", 14)}</span><button class="st-kb" data-kind="${s.id}">${kindChip(s.kind)}</button>
        <input class="st-st2" data-seg-title="${s.id}" value="${esc(s.title || "")}" placeholder="${esc(KIND[s.kind]?.name || "Part")}" maxlength="120">
        <span class="st-time" title="${s.sec != null ? "Fixed length" : "Read-aloud time at " + doc.wpm + " words a minute"}">${clock(x.start)} · <b>${clock(x.dur)}</b></span>
        <button class="pl-ib sm" data-segm="${s.id}" aria-label="More" title="More">${WI("more", 15)}</button></header>
      <textarea class="st-script" data-script="${s.id}" rows="2" placeholder="${esc(KIND[s.kind]?.tip || "What you say")}">${esc(txt)}</textarea>
      <div class="st-sf"><span>${w} words${s.plan ? ` · planned ${clock(s.plan)}` : ""}</span>${hs.length ? `<span class="st-hs">${hs.map((k) => `<em>{${esc(k)}}</em>`).join("")}</span>` : ""}<span class="wd-sp"></span><button class="st-lk" data-swap="${s.id}" title="Swap for another ${esc((KIND[s.kind]?.name || "").toLowerCase())} from your blocks">${WI("swap", 13)}Swap</button></div>
      <div class="st-br">${(s.broll || []).map((b) => `<label class="st-bi${b.done ? " done" : ""}"><input type="checkbox" data-brd="${s.id}|${b.id}"${b.done ? " checked" : ""}><span>${esc(b.t)}</span><button class="st-x" data-brx="${s.id}|${b.id}" aria-label="Remove">${WI("x", 12)}</button></label>`).join("")}
        <form class="st-bra" data-bra="${s.id}"><span>${WI("camera", 14)}</span><input placeholder="B-roll for this part…" maxlength="300" list="st-brl"><button type="button" class="st-lk" data-brlib="${s.id}">Ideas</button></form></div>
    </article><div class="st-gap" data-gap="${i + 1}"><button data-add="${i + 1}" aria-label="Add a part here">${WI("plus", 13)}</button></div>`;
  }
  // after typing in a script: refresh the times and counts without redrawing the textarea being typed in
  function partial(segId) {
    const doc = S.doc, tl = timeline(doc), tot = tl.reduce((a, x) => a + x.dur, 0);
    for (const x of tl) { const el = root.querySelector(`[data-seg="${x.s.id}"]`); if (!el) continue; el.querySelector(".st-time").innerHTML = `${clock(x.start)} · <b>${clock(x.dur)}</b>`; if (x.s.id === segId) el.querySelector(".st-sf span").textContent = `${words(fill(x.s.script, doc))} words${x.s.plan ? ` · planned ${clock(x.s.plan)}` : ""}`; const tc = root.querySelector(`[data-tc="${x.s.id}"]`); if (tc) { tc.style.flex = Math.max(x.dur, 1); tc.querySelector("small").textContent = clock(x.dur); } }
    const m = root.querySelector(".st-tlm span:last-child"); if (m) { m.textContent = `${clock(tot)} of ${clock(doc.target)}`; m.classList.toggle("over", tot > doc.target * 1.15); }
    const rest = root.querySelector(".st-tlrest"); if (rest) rest.style.flex = Math.max(0, doc.target - tot);
    clearTimeout(S.ckT); S.ckT = setTimeout(() => { if (S.side === "checks" || S.side === "shoot" || S.side === "publish") drawSide(); const r = row(), n = checks(S.doc, { title: r?.title, stage: stageOf(r), publish: publishOf(r) }).filter((c) => c.lvl === "bad" || c.lvl === "warn").length; const b = root.querySelector('[data-side="checks"]'); if (b) b.innerHTML = `Checks${n ? ` <em>${n}</em>` : ""}`; }, 500);
  }
  const seg = (id) => S.doc.segs.find((s) => s.id === id);
  function addSeg(at, kind = "point", block) {
    const b = block || null, s = { id: rid(), kind: b ? b.kind : kind, title: b ? b.name : "", script: b ? b.text : "", sec: null, broll: [], notes: "", ...(b ? { block: b.id } : {}) };
    if (b && b.kind === "broll") { const target = S.doc.segs[Math.max(0, Math.min(at, S.doc.segs.length) - 1)]; if (target) { target.broll.push({ id: rid(), t: b.text }); used(b); touch(); return; } }
    S.doc.segs.splice(at == null ? S.doc.segs.length : at, 0, s); S.sel = s.id; if (b) used(b);
    touch(); setTimeout(() => root.querySelector(`[data-script="${s.id}"]`)?.focus(), 30);
  }

  function wireVideo(ck) {
    const r = row();
    root.querySelector('[data-a="back"]').onclick = async () => { await flush(); S.vid = null; S.doc = null; shell(); R.item(body, "", "Studio", "push"); };
    const t = root.querySelector(".st-title"); t.oninput = () => { clearTimeout(t.__t); t.__t = setTimeout(() => setRow({ title: t.value }), 500); };
    root.querySelector('[data-a="vmore"]').onclick = (e) => choose(e.currentTarget, [
      { t: "Open as a page (notes, research)", i: "page", run: () => { window.openApp("boards"); setTimeout(() => R.apply(`/boards/db/${dbId}/${S.vid}`), 60); } },
      { t: "Save this structure as a formula", i: "list", run: () => askText(e.currentTarget, "Formula name", r.title || "My formula", (n) => { if (!n) return; S.lib.formulas.push({ id: rid(), name: n, desc: "", fmt: S.doc.fmt, steps: timeline(S.doc).map((x) => ({ kind: x.s.kind, sec: Math.round(x.dur), ...(x.s.block ? { block: x.s.block } : {}) })), uses: 0, mine: true }); saveLib(); toast("Formula saved"); }) },
      { t: "Copy the full script", i: "copy", run: () => { const txt = timeline(S.doc).map((x) => `[${clock(x.start)}] ${(x.s.title || KIND[x.s.kind]?.name).toUpperCase()}\n${fill(x.s.script, S.doc)}`).join("\n\n"); try { navigator.clipboard.writeText(txt); toast("Script copied"); } catch {} } },
      { t: "Earlier versions", i: "history", run: () => history(e.currentTarget) },
      "-", { t: "Delete this video", i: "trash", danger: true, run: async () => { if (await confirmBox("Delete this video from the Content calendar? Its plan stays in the history.", "Delete")) { DB.ops(dbId, [{ op: "delrow", id: S.vid }]); S.vid = null; S.doc = null; shell(); } } },
    ], { w: 290 });
    root.querySelectorAll("[data-stage]").forEach((b) => (b.onclick = () => { const p = stageP(); if (!p) return; let o = (p.opts || []).find((x) => x.name === b.dataset.stage); if (!o) return; setRow({ v: { [p.id]: o.id } }); root.querySelectorAll("[data-stage]").forEach((x) => x.classList.toggle("on", x === b)); if (b.dataset.stage === "Published") toast("Published. Nice work!"); }));
    root.querySelectorAll("[data-fmt]").forEach((b) => (b.onclick = () => { S.doc.fmt = b.dataset.fmt; if (S.doc.fmt === "short" && S.doc.target > 90) S.doc.target = 40; if (S.doc.fmt === "long" && S.doc.target < 120) S.doc.target = 600; touch(); }));
    root.querySelector("[data-pub]").onchange = (e) => { const p = dateP(); if (p) setRow({ v: { [p.id]: e.target.value || null } }); setTimeout(drawVideo, 50); };
    root.querySelector("[data-target]").onchange = (e) => { const [m, s2] = String(e.target.value).split(":").map((x) => parseInt(x, 10)); const v = s2 == null ? (m || 0) * 60 : (m || 0) * 60 + (s2 || 0); if (v > 0) { S.doc.target = v; touch(); } };
    root.querySelector("[data-wpm]").onchange = (e) => { S.doc.wpm = Math.max(90, Math.min(220, +e.target.value || 150)); touch(); };
    root.querySelectorAll("[data-f]").forEach((i) => (i.oninput = () => { S.doc[i.dataset.f] = i.value; clearTimeout(i.__t); i.__t = setTimeout(() => touch(null), 10); }));
    root.querySelectorAll("[data-f]").forEach((i) => (i.onchange = () => drawVideo()));
    root.querySelectorAll("[data-hole]").forEach((i) => (i.onchange = () => { S.doc.fill = { ...(S.doc.fill || {}), [i.dataset.hole]: i.value.trim() }; touch(); }));
    // parts
    root.querySelectorAll("[data-script]").forEach((ta) => { const fit = () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + 2 + "px"; }; fit(); ta.oninput = () => { fit(); seg(ta.dataset.script).script = ta.value; touch(ta.dataset.script); }; ta.onfocus = () => { S.sel = ta.dataset.script; root.querySelectorAll(".st-seg.sel,.st-tc.on").forEach((x) => x.classList.remove("sel", "on")); root.querySelector(`[data-seg="${S.sel}"]`)?.classList.add("sel"); root.querySelector(`[data-tc="${S.sel}"]`)?.classList.add("on"); }; });
    root.querySelectorAll("[data-seg-title]").forEach((i) => (i.oninput = () => { seg(i.dataset.segTitle).title = i.value; touch(null); const tc = root.querySelector(`[data-tc="${i.dataset.segTitle}"] span`); if (tc) tc.textContent = i.value || KIND[seg(i.dataset.segTitle).kind]?.name; }));
    root.querySelectorAll("[data-kind]").forEach((b) => (b.onclick = () => choose(b, SEG_KINDS.map((k) => ({ t: KIND[k].name, i: KIND[k].ico, on: seg(b.dataset.kind).kind === k, run: () => { seg(b.dataset.kind).kind = k; touch(); } })), { w: 210 })));
    root.querySelectorAll("[data-segm]").forEach((b) => (b.onclick = () => { const s = seg(b.dataset.segm), i = S.doc.segs.indexOf(s); choose(b, [
      { t: "Move up", i: "arrow-up", run: () => { if (i > 0) { S.doc.segs.splice(i, 1); S.doc.segs.splice(i - 1, 0, s); touch(); } } },
      { t: "Move down", i: "arrow-down", run: () => { if (i < S.doc.segs.length - 1) { S.doc.segs.splice(i, 1); S.doc.segs.splice(i + 1, 0, s); touch(); } } },
      { t: s.sec != null ? "Time it from the script" : "Set a fixed length…", i: "clock", run: () => { if (s.sec != null) { s.sec = null; touch(); } else askText(b, "Seconds", String(segSec(s, S.doc)), (v) => { const n = parseInt(v, 10); if (n > 0) { s.sec = n; touch(); } }); } },
      { t: "Save as a block", i: "bookmark", run: () => { S.lib.blocks.unshift({ id: rid(), kind: s.kind, name: s.title || KIND[s.kind].name, text: s.script, tags: [], uses: 0, fav: false, mine: true }); saveLib(); toast("Saved to your blocks"); } },
      { t: "Duplicate", i: "dup", run: () => { S.doc.segs.splice(i + 1, 0, { ...JSON.parse(JSON.stringify(s)), id: rid() }); touch(); } },
      "-", { t: "Remove", i: "trash", danger: true, run: () => { S.doc.segs.splice(i, 1); touch(); } },
    ], { w: 230 }); }));
    root.querySelectorAll("[data-swap]").forEach((b) => (b.onclick = () => { const s = seg(b.dataset.swap); const list = S.lib.blocks.filter((x) => x.kind === s.kind).sort((a, b2) => (b2.fav - a.fav) || (b2.uses - a.uses)); if (!list.length) return toast("No other blocks of this kind yet"); const box = h("div", { class: "wd-menu st-swap" }); box.innerHTML = `<div class="wd-mh">${esc(KIND[s.kind].name)}s from your blocks</div>${list.map((x) => `<button class="st-sw" data-pick="${x.id}"><b>${esc(x.name)}${x.fav ? " ★" : ""}</b><span>${esc(fill(x.text, S.doc))}</span></button>`).join("")}`; box.querySelectorAll("[data-pick]").forEach((p) => (p.onclick = async () => { const x = S.lib.blocks.find((y) => y.id === p.dataset.pick); if (s.script && s.script !== (S.lib.blocks.find((y) => y.id === s.block)?.text || "") && !(await confirmBox("Replace what you wrote with this block?", "Replace"))) return; closePop(); s.script = x.text; s.title = x.name; s.block = x.id; used(x); touch(); })); popover(b, box, { w: 380 }); }));
    root.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => { const at = b.dataset.add === "end" ? S.doc.segs.length : +b.dataset.add; choose(b, [{ head: "Add a part" }, ...SEG_KINDS.map((k) => ({ t: KIND[k].name, i: KIND[k].ico, run: () => { const best = bestBlock(k); addSeg(at, k, best || null); } }))], { w: 220 }); }));
    // b-roll
    root.querySelectorAll("[data-bra]").forEach((f) => (f.onsubmit = (e) => { e.preventDefault(); const i = f.querySelector("input"), v = i.value.trim(); if (!v) return; seg(f.dataset.bra).broll.push({ id: rid(), t: v }); touch(); setTimeout(() => root.querySelector(`[data-bra="${f.dataset.bra}"] input`)?.focus(), 20); }));
    root.querySelectorAll("[data-brd]").forEach((c) => (c.onchange = () => { const [sid, bid] = c.dataset.brd.split("|"); const b = seg(sid).broll.find((x) => x.id === bid); b.done = c.checked; c.closest(".st-bi").classList.toggle("done", c.checked); touch(null); }));
    root.querySelectorAll("[data-brx]").forEach((b) => (b.onclick = (e) => { e.preventDefault(); const [sid, bid] = b.dataset.brx.split("|"); const s = seg(sid); s.broll = s.broll.filter((x) => x.id !== bid); touch(); }));
    root.querySelectorAll("[data-brlib]").forEach((b) => (b.onclick = () => { const s = seg(b.dataset.brlib); choose(b, [{ head: "B-roll ideas" }, ...S.lib.blocks.filter((x) => x.kind === "broll").map((x) => ({ t: x.text, i: "camera", run: () => { s.broll.push({ id: rid(), t: x.text }); used(x); touch(); } }))], { w: 330 }); }));
    // timeline: select, and drag to reorder (also drop blocks onto it)
    root.querySelectorAll("[data-tc]").forEach((b) => (b.onclick = () => { S.sel = b.dataset.tc; const el = root.querySelector(`[data-seg="${S.sel}"]`); el?.scrollIntoView({ block: "center", behavior: "smooth" }); root.querySelectorAll(".st-seg.sel,.st-tc.on").forEach((x) => x.classList.remove("sel", "on")); el?.classList.add("sel"); b.classList.add("on"); }));
    dnd();
  }
  /* drag and drop: parts (by their grip or on the timeline) and blocks from the panel */
  function dnd() {
    const set = (e, o) => { e.dataTransfer.setData("text/plain", JSON.stringify(o)); e.dataTransfer.effectAllowed = "copyMove"; root.classList.add("dragging"); };
    root.querySelectorAll("[data-drag],[data-tc]").forEach((el) => { if (el.__dnd) return; el.__dnd = 1; el.addEventListener("dragstart", (e) => { set(e, { seg: el.dataset.drag || el.dataset.tc }); el.closest(".st-seg")?.classList.add("moving"); }); el.addEventListener("dragend", () => { root.classList.remove("dragging"); root.querySelectorAll(".moving,.drop-b,.drop-a,.drop-on").forEach((x) => x.classList.remove("moving", "drop-b", "drop-a", "drop-on")); }); });
    root.querySelectorAll("[data-blk]").forEach((el) => { if (el.__dnd) return; el.__dnd = 1; el.addEventListener("dragstart", (e) => set(e, { block: el.dataset.blk })); el.addEventListener("dragend", () => { root.classList.remove("dragging"); root.querySelectorAll(".drop-b,.drop-a,.drop-on").forEach((x) => x.classList.remove("drop-b", "drop-a", "drop-on")); }); });
    const where = (e) => {
      const tc = e.target.closest("[data-tc]"); if (tc) { const r = tc.getBoundingClientRect(), before = e.clientX < r.left + r.width / 2, i = S.doc.segs.findIndex((s) => s.id === tc.dataset.tc); return { el: tc, cls: before ? "drop-b" : "drop-a", at: before ? i : i + 1 }; }
      const sg = e.target.closest("[data-seg]"); if (sg) { const r = sg.getBoundingClientRect(), before = e.clientY < r.top + r.height / 2, i = S.doc.segs.findIndex((s) => s.id === sg.dataset.seg); return { el: sg, cls: before ? "drop-b" : "drop-a", at: before ? i : i + 1 }; }
      const zone = e.target.closest("[data-drop]"); if (zone) return { el: zone, cls: "drop-on", at: S.doc.segs.length };
      return null;
    };
    root.querySelectorAll("[data-drop]").forEach((z) => {
      if (z.__dnd) return; z.__dnd = 1;
      z.addEventListener("dragover", (e) => { const w = where(e); if (!w) return; e.preventDefault(); root.querySelectorAll(".drop-b,.drop-a,.drop-on").forEach((x) => x.classList.remove("drop-b", "drop-a", "drop-on")); w.el.classList.add(w.cls); });
      z.addEventListener("drop", (e) => {
        e.preventDefault(); const w = where(e); root.querySelectorAll(".drop-b,.drop-a,.drop-on").forEach((x) => x.classList.remove("drop-b", "drop-a", "drop-on")); root.classList.remove("dragging"); if (!w) return;
        let o = null; try { o = JSON.parse(e.dataTransfer.getData("text/plain")); } catch {} if (!o) return;
        if (o.seg) { const i = S.doc.segs.findIndex((s) => s.id === o.seg); if (i < 0) return; const [s] = S.doc.segs.splice(i, 1); S.doc.segs.splice(w.at > i ? w.at - 1 : w.at, 0, s); touch(); }
        else if (o.block) { const b = S.lib.blocks.find((x) => x.id === o.block); if (b) addSeg(w.at, b.kind, b); }
      });
    });
  }

  /* ----- the side panel ----- */
  function drawSide(ck) {
    const sb = root.querySelector(".st-side .st-sb"); if (!sb) return;
    root.querySelectorAll("[data-side]").forEach((b) => (b.onclick = () => { S.side = b.dataset.side; ls.set("stSide", S.side); root.querySelectorAll("[data-side]").forEach((x) => x.classList.toggle("on", x === b)); drawSide(); }));
    const r = row(), doc = S.doc; ck = ck || checks(doc, { title: r?.title, stage: stageOf(r), publish: publishOf(r) });
    if (S.side === "blocks") {
      const list = S.lib.blocks.filter((b) => b.kind === S.kf || (S.kf === "all")).sort((a, b) => (b.fav - a.fav) || (b.uses - a.uses));
      sb.innerHTML = `<div class="st-kf sm">${Object.keys(KIND).map((k) => `<button data-skf="${k}" class="${S.kf === k ? "on" : ""}" data-c="${KIND[k].c}">${esc(KIND[k].name)}</button>`).join("")}</div>
        <p class="st-kt">${esc(KIND[S.kf]?.tip || "")} Drag one onto the timeline or between parts, or press +.</p>
        <div class="st-pal">${list.map((b) => `<div class="st-pb" draggable="true" data-blk="${b.id}"><div><b>${esc(b.name)}${b.fav ? " ★" : ""}</b><span>${esc(fill(b.text, doc))}</span></div><button class="pl-ib sm" data-padd="${b.id}" aria-label="Add">${WI("plus", 15)}</button></div>`).join("") || `<p class="pl-note">No ${esc(KIND[S.kf]?.name.toLowerCase())} blocks yet. Add some in the Blocks tab of the Studio.</p>`}</div>
        <h4 class="st-sh">Formulas</h4><div class="st-pf">${S.lib.formulas.filter((f) => f.fmt === doc.fmt).concat(S.lib.formulas.filter((f) => f.fmt !== doc.fmt)).map((f) => `<button class="st-pfi" data-apply="${f.id}"><b>${esc(f.name)}</b><span class="st-fbar">${f.steps.map((s) => `<i data-c="${KIND[s.kind]?.c}" style="flex:${s.sec}"></i>`).join("")}</span><small>${f.fmt === "short" ? "Short" : "Long"} · ${clock(f.steps.reduce((a, s) => a + s.sec, 0))} · ${f.steps.length} parts</small></button>`).join("")}</div>`;
      sb.querySelectorAll("[data-skf]").forEach((b) => (b.onclick = () => { S.kf = b.dataset.skf; drawSide(); }));
      sb.querySelectorAll("[data-padd]").forEach((b) => (b.onclick = () => { const x = S.lib.blocks.find((y) => y.id === b.dataset.padd); const at = S.sel ? S.doc.segs.findIndex((s) => s.id === S.sel) + 1 : S.doc.segs.length; addSeg(at, x.kind, x); }));
      sb.querySelectorAll("[data-apply]").forEach((b) => (b.onclick = async () => { const f = S.lib.formulas.find((x) => x.id === b.dataset.apply); if (S.doc.segs.length && !(await confirmBox(`Apply “${f.name}”? Its parts are added after what you have. (Remove what you don't need.)`, "Apply"))) return; applyFormula(S.doc, f); touch(); toast("Formula applied"); }));
      dnd();
    } else if (S.side === "checks") {
      const icon = { bad: "alert", warn: "warning", tip: "bulb", good: "check" };
      sb.innerHTML = `<p class="st-kt">Checked as you write: structure, timing, retention, script, packaging and schedule.</p><div class="st-cks">${ck.map((c, i) => `<div class="st-ck ${c.lvl}"><span class="st-cki">${WI(icon[c.lvl], 16)}</span><div><b>${esc(c.msg)}</b><p>${esc(c.fix)}</p><div class="st-cka">${c.seg ? `<button class="st-lk" data-goto="${c.seg}">Show me</button>` : ""}${c.coach ? `<button class="st-lk" data-coach="${c.coach}">More on this</button>` : ""}</div></div></div>`).join("")}</div>`;
      sb.querySelectorAll("[data-goto]").forEach((b) => (b.onclick = () => { const el = root.querySelector(`[data-seg="${b.dataset.goto}"]`); el?.scrollIntoView({ block: "center", behavior: "smooth" }); el?.classList.add("flash"); setTimeout(() => el?.classList.remove("flash"), 1200); }));
      sb.querySelectorAll("[data-coach]").forEach((b) => (b.onclick = () => coachPop(b, b.dataset.coach)));
    } else if (S.side === "shoot") {
      const shots = shotList(doc), done = new Set(doc.done || []);
      const isDone = (x) => (x.id ? x.done : done.has(x.key));
      const left = shots.filter((x) => !isDone(x)).length;
      sb.innerHTML = `<label class="st-ml blk">Shoot day<input type="date" data-shoot value="${esc(doc.shoot.date || "")}"></label>
        <h4 class="st-sh">Shot list <em>${shots.length - left} of ${shots.length} done</em><button class="st-lk" data-copyshots>Copy</button></h4>
        <div class="st-shots">${shots.map((x) => `<label class="st-shot ${x.kind}${isDone(x) ? " done" : ""}"><input type="checkbox" data-shot="${esc(x.key)}"${isDone(x) ? " checked" : ""}><span class="st-shk">${x.kind === "aroll" ? "A-roll" : x.kind === "cue" ? "From script" : "B-roll"}</span><span>${esc(x.t)}</span><small>${clock(x.at)}</small></label>`).join("") || `<p class="pl-note">Write the script and add b-roll; the shot list builds itself.</p>`}</div>
        ${list2("Gear", "gear", doc.shoot.gear)}${list2("Places", "places", doc.shoot.places)}${list2("To do on the day", "todo", doc.shoot.todo)}`;
      sb.querySelector("[data-shoot]").onchange = (e) => { doc.shoot.date = e.target.value; touch(null); };
      sb.querySelectorAll("[data-shot]").forEach((c) => (c.onchange = () => { const x = shots.find((y) => y.key === c.dataset.shot); if (x.id) { const b = seg(x.seg).broll.find((y) => y.id === x.id); b.done = c.checked; } else { const s = new Set(doc.done || []); c.checked ? s.add(x.key) : s.delete(x.key); doc.done = [...s]; } touch(null); drawSide(); }));
      sb.querySelector("[data-copyshots]").onclick = () => { try { navigator.clipboard.writeText(shots.map((x) => `[${isDone(x) ? "x" : " "}] ${clock(x.at)}  ${x.kind === "aroll" ? "A" : "B"}  ${x.t}`).join("\n")); toast("Shot list copied"); } catch {} };
      wireList2(sb);
    } else if (S.side === "publish") {
      const ch = chapters(doc), link = linkP() ? r.v[linkP().id] || "" : "";
      sb.innerHTML = `<h4 class="st-sh">Title ideas <small>Write ten, pick one</small></h4>
        <div class="st-ti">${(doc.titles || []).map((x) => `<div class="st-tir${x.pick ? " pick" : ""}"><button class="st-pick" data-tpick="${x.id}" aria-label="Use this title" title="Use this title">${WI(x.pick ? "check" : "star", 14)}</button><span>${esc(x.t)}</span><em class="${x.t.length > 60 ? "over" : ""}">${x.t.length}</em><button class="st-x" data-tx="${x.id}" aria-label="Remove">${WI("x", 12)}</button></div>`).join("")}</div>
        <form data-tadd><input class="wd-in sm" placeholder="Another title…" maxlength="140"></form>
        <h4 class="st-sh">Thumbnail <small>3–4 words that add to the title</small></h4>
        <div class="st-ti">${(doc.thumbs || []).map((x) => `<div class="st-tir"><span>${esc(x.t)}</span><button class="st-x" data-hx="${x.id}" aria-label="Remove">${WI("x", 12)}</button></div>`).join("")}</div>
        <form data-hadd><input class="wd-in sm" placeholder="Thumbnail text or idea…" maxlength="120"></form>
        <h4 class="st-sh">Description <button class="st-lk" data-chap>${ch.length ? "Add chapters" : "Chapters need 3 titled parts"}</button><button class="st-lk" data-desc>Draft it</button></h4>
        <textarea class="wd-in st-desc" data-descv rows="8" maxlength="5000" placeholder="What the video is about, links, chapters…">${esc(doc.desc || "")}</textarea>
        <h4 class="st-sh">Tags</h4><input class="wd-in sm" data-tags value="${esc(doc.tags || "")}" placeholder="brand design, logo, …">
        <h4 class="st-sh">Video link</h4><input class="wd-in sm" data-link value="${esc(link)}" placeholder="https://youtube.com/…"><div class="st-pubb"><button class="pl-btn" data-yt>${WI("play", 15)}Open the YouTube app</button></div>`;
      sb.querySelectorAll("[data-tpick]").forEach((b) => (b.onclick = () => { for (const x of doc.titles) x.pick = x.id === b.dataset.tpick; const x = doc.titles.find((y) => y.pick); setRow({ title: x.t }); touch(); }));
      sb.querySelectorAll("[data-tx]").forEach((b) => (b.onclick = () => { doc.titles = doc.titles.filter((x) => x.id !== b.dataset.tx); touch(null); drawSide(); }));
      sb.querySelectorAll("[data-hx]").forEach((b) => (b.onclick = () => { doc.thumbs = doc.thumbs.filter((x) => x.id !== b.dataset.hx); touch(null); drawSide(); }));
      sb.querySelector("[data-tadd]").onsubmit = (e) => { e.preventDefault(); const i = e.target.querySelector("input"); if (!i.value.trim()) return; doc.titles.push({ id: rid(), t: i.value.trim() }); touch(null); drawSide(); setTimeout(() => root.querySelector("[data-tadd] input")?.focus(), 20); };
      sb.querySelector("[data-hadd]").onsubmit = (e) => { e.preventDefault(); const i = e.target.querySelector("input"); if (!i.value.trim()) return; doc.thumbs.push({ id: rid(), t: i.value.trim() }); touch(null); drawSide(); setTimeout(() => root.querySelector("[data-hadd] input")?.focus(), 20); };
      const dv = sb.querySelector("[data-descv]"); dv.oninput = () => { doc.desc = dv.value; touch(null); };
      sb.querySelector("[data-chap]").onclick = () => { if (!ch.length) return toast("Give at least three parts a title (Points, Stories, Proof) to make chapters"); doc.desc = (doc.desc || "").replace(/\n*Chapters\n(?:\d+:\d{2} .*\n?)+/g, "").trim() + "\n\nChapters\n" + chaptersText(doc); touch(null); drawSide(); };
      sb.querySelector("[data-desc]").onclick = () => { const first = (doc.promise ? `In this video: ${doc.promise}.` : "") || fill(doc.segs[0]?.script || "", doc); doc.desc = [first, doc.audience ? `For ${doc.audience}.` : "", ch.length ? "\nChapters\n" + chaptersText(doc) : "", "\nMore from me: https://rohankumar.pro"].filter(Boolean).join("\n").trim(); touch(null); drawSide(); };
      sb.querySelector("[data-tags]").oninput = (e) => { doc.tags = e.target.value; touch(null); };
      sb.querySelector("[data-link]").onchange = (e) => { const p = linkP(); if (p) setRow({ v: { [p.id]: e.target.value.trim() || null } }); };
      sb.querySelector("[data-yt]").onclick = () => window.openApp("content");
    } else if (S.side === "plan") {
      const pub = publishOf(r), plan = planBack(pub, doc.fmt), td = today();
      sb.innerHTML = pub ? `<p class="st-kt">Worked back from publishing on <b>${esc(fmtDate(pub))}</b>.</p><ol class="st-plan">${plan.map((p) => { const linked = (doc.plan || []).find((x) => x.k === p.k && x.task); return `<li class="${p.d < td ? "past" : p.d === td ? "now" : ""}"><span>${esc(fmtDate(p.d, { rel: true }))}</span><b>${esc(p.t)}</b>${linked ? `<em>${WI("check", 13)} in Tasks</em>` : ""}</li>`; }).join("")}</ol><button class="pl-btn pri" data-totasks>${WI("checkbox", 15)}Put these in my Tasks</button><p class="pl-note">They show in the Planner on their days.</p>` : `<p class="pl-note">Set a publish date above, and the steps are worked back from it: idea, script, filming, edit, packaging.</p>`;
      sb.querySelector("[data-totasks]")?.addEventListener("click", async () => {
        const t = await WS.ensure("tasks"); if (!t) return; const td2 = DB.get(t.id), due = td2.props.find((p) => p.type === "date"), st = td2.props.find((p) => p.type === "status"), todo = st && st.opts.find((o) => (o.group || "todo") === "todo"), area = td2.props.find((p) => p.name === "Area"), content = area && (area.opts || []).find((o) => o.name === "Content");
        doc.plan = doc.plan || []; let n = 0;
        for (const p of plan) { if (p.k === "publish") continue; const have = doc.plan.find((x) => x.k === p.k); if (have && have.task && td2.rows[have.task]) { DB.ops(t.id, [{ op: "row", row: { id: have.task, v: { [due.id]: p.d } } }]); continue; } const rr = DB.newRow(t.id, { title: `${p.t}: ${r.title || "video"}`, order: Date.now(), v: { [due.id]: p.d, ...(todo ? { [st.id]: todo.id } : {}), ...(content ? { [area.id]: content.id } : {}) } }); doc.plan = doc.plan.filter((x) => x.k !== p.k).concat([{ k: p.k, d: p.d, task: rr.id }]); n++; }
        touch(null); drawSide(); toast(n ? `${n} task${n === 1 ? "" : "s"} added` : "Tasks updated to the new dates");
      });
    }
  }
  const list2 = (title, key, items) => `<h4 class="st-sh">${title}</h4><div class="st-l2">${(items || []).map((x) => `<label class="st-bi${x.done ? " done" : ""}"><input type="checkbox" data-l2="${key}|${x.id}"${x.done ? " checked" : ""}><span>${esc(x.t)}</span><button class="st-x" data-l2x="${key}|${x.id}" aria-label="Remove">${WI("x", 12)}</button></label>`).join("")}<form data-l2a="${key}"><input class="wd-in sm" placeholder="Add…" maxlength="200"></form></div>`;
  function wireList2(sb) {
    const doc = S.doc;
    sb.querySelectorAll("[data-l2]").forEach((c) => (c.onchange = () => { const [k, id] = c.dataset.l2.split("|"); const x = doc.shoot[k].find((y) => y.id === id); x.done = c.checked; c.closest(".st-bi").classList.toggle("done", c.checked); touch(null); }));
    sb.querySelectorAll("[data-l2x]").forEach((b) => (b.onclick = (e) => { e.preventDefault(); const [k, id] = b.dataset.l2x.split("|"); doc.shoot[k] = doc.shoot[k].filter((y) => y.id !== id); touch(null); drawSide(); }));
    sb.querySelectorAll("[data-l2a]").forEach((f) => (f.onsubmit = (e) => { e.preventDefault(); const i = f.querySelector("input"); if (!i.value.trim()) return; doc.shoot[f.dataset.l2a].push({ id: rid(), t: i.value.trim() }); touch(null); drawSide(); setTimeout(() => root.querySelector(`[data-l2a="${f.dataset.l2a}"] input`)?.focus(), 20); }));
  }
  async function history(anchor) {
    const r = await api(`/api/studio?v=${S.vid}&a=history`); const list = (r.ok && r.data.history) || [];
    if (!list.length) return toast("No earlier versions yet. One is kept every ten minutes while you work.");
    choose(anchor, [{ head: "Put back an earlier version" }, ...list.slice(0, 20).map((v) => ({ t: `${new Date(v.ts).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · ${v.segs} parts`, i: "history", run: async () => { if (!(await confirmBox("Put this version back? What's here now is kept as a version too.", "Put back"))) return; await flush(); const x = await api(`/api/studio?v=${S.vid}&a=restore`, { method: "POST", body: { ts: v.ts } }); if (x.ok) { S.doc = { ...blank(x.data.doc.fmt), ...x.data.doc }; S.rev = x.data.doc.rev; drawVideo(); toast("Put back"); } } }))], { w: 280 });
  }

  /* ---------- go ---------- */
  await loadLib();
  const off = DB.on(dbId, () => { if (!body.isConnected) return; if (S.vid) { const t = root.querySelector(".st-title"); if (t && document.activeElement !== t && row()) t.value = row().title || ""; } });
  addEventListener("pagehide", () => { if (S.dirty && S.vid) api("/api/studio?v=" + S.vid, { method: "PUT", body: { doc: S.doc, base: S.rev, force: true }, keepalive: true }); });
  body.__flush = async () => { await flush(); off(); if (S.pdb) S.pdb.destroy(); closePop(); };
  R.handlers.studio = (b, slug) => { if (slug && slug.startsWith("v/")) openVideo(slug.slice(2)); else { flush().then(() => { S.vid = null; shell(); }); } };
  if (slug0 && slug0.startsWith("v/")) openVideo(slug0.slice(2)); else shell();
}
