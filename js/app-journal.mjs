// Journal: a list, a reader, and a Notion-style writing studio for the owner. Every article has its own address, /journal/<slug>.
import { h, $, $$, esc, api, isAdmin, toast, mobile, showBlocks, makeEditor, Up, share, chips, confirmBox, renderBlocks, stripTags } from "/js/lib.mjs";
import { mdToBlocks, blocksText, readMinutes, slugify, firstImage, headingsOf } from "/shared/blocks.mjs";
import { R } from "/js/os-ext.mjs";
import { icon as _ic, ICONS as _ICONS } from "/shared/icons.mjs";
const I = (n, size = 16) => _ic(n, { size });

const J = { posts: null, saving: false, again: false, status: "" };
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const today = () => { const d = new Date(); return `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; };
const booking = () => (typeof P !== "undefined" && P.booking) || "https://cal.com/rohankumarpro";
const blocksOf = (p) => (Array.isArray(p.blocks) && p.blocks.length ? p.blocks : mdToBlocks(p.body, { booking: booking() }));
function isoOf(p) {
  if (p.published && /^\d{4}-\d{2}-\d{2}/.test(p.published)) return p.published.slice(0, 10);
  const m = String(p.date || "").replace(",", "").split(" ");
  const mi = MON.indexOf(m[0]);
  if (m.length === 3 && mi >= 0) return `${m[2]}-${String(mi + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if (m.length === 2 && mi >= 0) return `${m[1]}-${String(mi + 1).padStart(2, "0")}-01`;
  return "";
}
const isLive = (p) => !p.draft && (!p.publishAt || Date.parse(p.publishAt) <= Date.now());
const stateOf = (p) => (p.draft ? "draft" : p.publishAt && Date.parse(p.publishAt) > Date.now() ? "scheduled" : "published");
const allTags = (p) => [p.tag, ...(p.tags || [])].filter(Boolean);
const tagSlug = (t) => slugify(t);
const coverOf = (p) => p.img || (p.hero && typeof COVERS !== "undefined" && COVERS[p.hero]) || "";

async function load(force) {
  if (J.posts && !force) return;
  const r = await api("/api/journal");
  if (r.ok && Array.isArray(r.data.posts)) J.posts = r.data.posts;
  else J.posts = (typeof JL === "function" ? JL() : []).slice();
  LIVE.posts = J.posts; LIVE.jLoaded = true;
}
const sorted = () => J.posts.slice().sort((a, b) => (isoOf(b) < isoOf(a) ? -1 : isoOf(b) > isoOf(a) ? 1 : 0));
const visiblePosts = () => (isAdmin() ? sorted() : sorted().filter(isLive));

async function persist() {
  if (J.saving) { J.again = true; return false; }
  J.saving = true; setStatus("Saving…");
  try {
    const r = await api("/api/journal", { method: "PUT", body: { posts: J.posts } });
    if (r.ok) { const mine = new Map(r.data.posts.map((p) => [p.slug, p])); J.posts = r.data.posts; LIVE.posts = J.posts; setStatus("Saved"); return true; }
    setStatus(r.status === 401 ? "Signed out. Not saved." : r.status === 0 ? "Offline. Not saved." : "Could not save (" + r.status + ")"); return false;
  } finally { J.saving = false; if (J.again) { J.again = false; persist(); } }
}
function setStatus(t) { J.status = t; $$(".jed-st,.nt-status").forEach((e) => { if (e.closest(".jr, .jed")) e.textContent = t; }); }

/* ---------- entry point ---------- */
export async function journalApp(body, slug) {
  R.handlers.journal = (b, s) => route(b, s);
  await load();
  return route(body, slug || "");
}
async function route(body, slug) {
  await load();
  body.onscroll = null; body.classList.remove("jr-editing");
  if (!slug) return list(body, "", true);
  if (slug.startsWith("tag/")) return list(body, decodeURIComponent(slug.slice(4)), true);
  const p = visiblePosts().find((x) => x.slug === slug);
  if (!p) { list(body, "", true); toast("That article wasn't found."); return; }
  return read(body, p, true);
}

/* ---------- the list ---------- */
function list(body, tag = "", quiet) {
  body.onscroll = null; body.scrollTop = 0;
  const posts = visiblePosts();
  const tags = [...new Map(posts.flatMap(allTags).map((t) => [tagSlug(t), t])).entries()];
  const cur = tag ? (tags.find(([s]) => s === tag || s === tagSlug(tag)) || [0, tag])[1] : "";
  let q = "";
  const root = h("div", { class: "jr" });
  body.replaceChildren(root);
  const draw = () => {
    const shown = posts.filter((p) => (!cur || allTags(p).some((t) => tagSlug(t) === tagSlug(cur))) && (!q || (p.title + " " + p.excerpt + " " + (p.body || "")).toLowerCase().includes(q)));
    const feat = !cur && !q && shown[0] && coverOf(shown[0]) ? shown[0] : null;
    root.innerHTML = `<header class="jr-head"><div class="nt-head"><h1>${cur ? esc(cur) : "Journal"}</h1>${isAdmin() ? `<div class="nt-tools"><span class="nt-status">${esc(J.status)}</span><button class="j-new">+ New article</button></div>` : ""}</div>
      <p class="jr-sub">${cur ? `Articles about ${esc(cur)}.` : "Notes on branding, design, and working with AI. Written as I learn, and updated when I'm wrong."}</p>
      <div class="jr-find"><input type="search" class="jr-search" placeholder="Search articles" aria-label="Search articles" value="${esc(q)}"></div>
      <div class="jtags" role="tablist"><button class="${!cur ? "on" : ""}" data-t="">All <span>${posts.length}</span></button>${tags.map(([s, t]) => `<button class="${cur && tagSlug(cur) === s ? "on" : ""}" data-t="${esc(t)}">${esc(t)}</button>`).join("")}</div></header>
      ${feat ? featCard(feat) : ""}
      <div class="jr-groups">${groups(shown.filter((p) => p !== feat))}</div>${shown.length ? "" : `<p class="nt-hint">${q ? "No articles match your search." : "No articles yet."}</p>`}`;
    $$("[data-t]", root).forEach((b) => (b.onclick = () => { const t = b.dataset.t; list(body, t); R.item(body, t ? "tag/" + tagSlug(t) : "", t ? `${t} — Journal` : "", "push"); }));
    $$("a[data-slug]", root).forEach((a) => (a.onclick = (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); read(body, posts.find((p) => p.slug === a.dataset.slug)); }));
    const nb = $(".j-new", root); if (nb) nb.onclick = () => edit(body, null);
    const se = $(".jr-search", root); se.oninput = () => { q = se.value.trim().toLowerCase(); const pos = se.selectionStart; draw(); const n = $(".jr-search", root); n.focus(); n.setSelectionRange(pos, pos); };
  };
  draw();
  if (!quiet) R.item(body, cur ? "tag/" + tagSlug(cur) : "", cur ? `${cur} — Journal` : "", "push");
}
const dateParts = (p) => { const iso = isoOf(p); if (!iso) return { d: "", m: "", g: "Undated" }; const [y, m, d] = iso.split("-"); return { d: +d, m: MON[+m - 1], g: `${MONTHS[+m - 1]} ${y}` }; };
function badges(p) { const s = stateOf(p); return `${s === "draft" ? '<em class="j-draft">Draft</em> ' : s === "scheduled" ? '<em class="j-draft">Scheduled</em> ' : ""}`; }
function featCard(p) {
  return `<a class="jr-feat" href="/journal/${esc(p.slug)}" data-slug="${esc(p.slug)}"><img src="${esc(coverOf(p))}" alt="${esc(p.imgAlt || p.title)}" loading="lazy"><span class="jr-fb"><small>${esc(dateParts(p).g)}${p.tag ? " · " + esc(p.tag) : ""}</small><b>${badges(p)}${esc(p.title)}</b><span>${esc(p.excerpt)}</span></span></a>`;
}
function groups(shown) {
  let cur = "", html = "";
  for (const p of shown) {
    const dt = dateParts(p);
    if (dt.g !== cur) { if (cur) html += "</ol>"; html += `<h2 class="jm">${esc(dt.g)}</h2><ol class="jl">`; cur = dt.g; }
    const c = coverOf(p), mins = readMinutes(blocksOf(p));
    html += `<li><a class="je" href="/journal/${esc(p.slug)}" data-slug="${esc(p.slug)}"><span class="jd"><b>${dt.d || "&nbsp;"}</b><small>${esc(dt.m)}</small></span>
      <span class="jb"><span class="jt">${badges(p)}${esc(p.title)}</span><span class="jx">${esc(p.excerpt)}</span><span class="jmeta">${esc(p.tag || "")}${p.tag ? " · " : ""}${mins} min read${p.updated ? " · <em>Updated</em>" : ""}</span></span>${c ? `<img class="jr-th" src="${esc(c)}" alt="" loading="lazy">` : ""}</a></li>`;
  }
  return html ? html + "</ol>" : "";
}

/* ---------- the reader ---------- */
function read(body, p, quiet) {
  const blocks = blocksOf(p), posts = visiblePosts(), i = posts.findIndex((x) => x.slug === p.slug);
  const newer = posts[i - 1], older = posts[i + 1];
  const rel = posts.filter((x) => x.slug !== p.slug && allTags(x).some((t) => allTags(p).includes(t))).slice(0, 3);
  const mins = readMinutes(blocks), heads = headingsOf(blocks).filter((x) => x.level <= 2), c = coverOf(p), iso = isoOf(p);
  body.scrollTop = 0; body.classList.remove("jr-editing");
  body.innerHTML = `<div class="abar jr-bar"><div class="jr-row"><button class="back">${I("chevron-left")}All posts</button><span class="sp"></span>${heads.length > 2 ? '<button class="j-toc">Contents</button>' : ""}${isAdmin() ? '<button class="j-edit">Edit</button>' : ""}<button class="j-share">Share</button></div><div class="rprog"><i></i></div></div>
  <article class="article jr-art" itemscope itemtype="https://schema.org/BlogPosting">${c ? `<img class="ahero" src="${esc(c)}" alt="${esc(p.imgAlt || "Cover image for " + p.title)}">` : ""}
  <p class="meta">${iso ? `<time datetime="${iso}">${esc(p.date || iso)}</time>` : esc(p.date || "")} · ${mins} min read · ${esc(P.name)}${stateOf(p) !== "published" ? ` · <b>${stateOf(p)}</b>` : ""}</p>${p.updated ? `<span class="upd">${esc(p.updated)}</span>` : ""}
  <h1 itemprop="headline">${esc(p.title)}</h1>${p.excerpt ? `<p class="lead">${esc(p.excerpt)}</p>` : ""}<hr><div class="jr-content"></div>
  <div class="afoot">${p.url ? `<a class="btn tonal" href="${esc(p.url)}" target="_blank" rel="noopener">Read on ${esc(p.source || "the original")}</a>` : ""}${(p.more || []).map((m) => `<a class="btn tonal" href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.label)}</a>`).join("")}</div>
  ${allTags(p).length ? `<p class="jr-tags">${allTags(p).map((t) => `<a href="/journal/tag/${esc(tagSlug(t))}" data-tag="${esc(t)}">#${esc(t)}</a>`).join("")}</p>` : ""}
  <div class="callout"><p><b>Working on a brand?</b> Let's talk it through.</p><a class="btn" href="${esc(booking())}" target="_blank" rel="noopener">Book a call</a></div>
  ${rel.length ? `<section class="jr-rel"><h2>More to read</h2>${rel.map((x) => `<a href="/journal/${esc(x.slug)}" data-slug="${esc(x.slug)}"><b>${esc(x.title)}</b><span>${esc(x.excerpt)}</span></a>`).join("")}</section>` : ""}
  <nav class="jr-pn">${newer ? `<a href="/journal/${esc(newer.slug)}" data-slug="${esc(newer.slug)}"><small>${I("chevron-left", 13)}Newer</small><b>${esc(newer.title)}</b></a>` : "<span></span>"}${older ? `<a href="/journal/${esc(older.slug)}" data-slug="${esc(older.slug)}"><small>Older${I("chevron-right", 13)}</small><b>${esc(older.title)}</b></a>` : "<span></span>"}</nav></article>`;
  showBlocks($(".jr-content", body), blocks, { hBase: 2 });
  const bar = $(".rprog i", body);
  body.onscroll = () => { if (!bar.isConnected) { body.onscroll = null; return; } const m = body.scrollHeight - body.clientHeight; bar.style.width = (m > 0 ? (body.scrollTop / m) * 100 : 0) + "%"; };
  $(".back", body).onclick = () => { body.onscroll = null; list(body); };
  $$("a[data-slug]", body).forEach((a) => (a.onclick = (e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); read(body, posts.find((x) => x.slug === a.dataset.slug)); }));
  $$("a[data-tag]", body).forEach((a) => (a.onclick = (e) => { e.preventDefault(); list(body, a.dataset.tag); }));
  const eb = $(".j-edit", body); if (eb) eb.onclick = () => edit(body, p);
  $(".j-share", body).onclick = () => share("/journal/" + p.slug, p.title);
  const tb = $(".j-toc", body);
  if (tb) tb.onclick = () => {
    const old = $(".jr-tocp", body); if (old) { old.remove(); return; }
    const pop = h("div", { class: "jr-tocp" }, heads.map((x) => h("button", { class: "l" + x.level, onclick: () => { const t = body.querySelector("#" + CSS.escape(slugify(x.text) || x.id)); if (t) body.scrollTo({ top: t.offsetTop - 70, behavior: "smooth" }); pop.remove(); } }, x.text)));
    tb.after(pop); setTimeout(() => document.addEventListener("pointerdown", (e) => { if (!pop.contains(e.target)) pop.remove(); }, { once: true }), 0);
  };
  if (!quiet) R.item(body, p.slug, `${p.title} — ${P.name}`, "push"); else R.item(body, p.slug, `${p.title} — ${P.name}`, "replace");
}

/* ---------- the writing studio ---------- */
async function edit(body, post) {
  const w = body.closest(".win"), wasMax = w.classList.contains("max");
  const isNew = !post;
  const S = isNew
    ? { title: "", excerpt: "", tags: [], date: today(), draft: true, blocks: [], img: "", imgAlt: "", seoTitle: "", seoDesc: "", noindex: false, publishAt: "", source: "", url: "", more: [], slug: "", extra: {} }
    : { title: post.title, excerpt: post.excerpt || "", tags: allTags(post), date: post.date || today(), draft: !!post.draft, blocks: blocksOf(post), img: post.img || "", imgAlt: post.imgAlt || "", seoTitle: post.seoTitle || "", seoDesc: post.seoDesc || "", noindex: !!post.noindex, publishAt: post.publishAt || "", source: post.source || "", url: post.url || "", more: (post.more || []).map((m) => ({ ...m })), slug: post.slug, extra: { hero: post.hero, quote: post.quote, color: post.color, cover: post.cover, updated: post.updated, published: post.published, modified: post.modified } };
  body.__jed = S;
  let slugTouched = !isNew, orig = isNew ? "" : post.slug, saveT = null, ed = null, preview = false;
  if (!mobile()) w.classList.add("max");
  body.onscroll = null; body.scrollTop = 0; body.classList.add("jr-editing");
  body.innerHTML = `<div class="jed">
    <div class="jed-bar"><button class="back">${I("chevron-left")}${isNew ? "Cancel" : "Back"}</button><span class="jed-st">${esc(J.status || "")}</span><span class="sp"></span>
      <span class="jed-live" hidden>Live</span><button data-a="preview">Preview</button><button data-a="settings">Settings</button><button class="btn" data-a="publish"></button></div>
    <div class="jed-scroll"><div class="jed-main"><div class="jed-cover"></div>
      <textarea class="jed-title" rows="1" placeholder="Article title" maxlength="200" aria-label="Title"></textarea>
      <textarea class="jed-excerpt" rows="2" placeholder="A short summary for lists and Google results" maxlength="400" aria-label="Summary"></textarea>
      <div class="jed-body"></div><div class="jed-prev bk-doc" hidden></div></div></div>
    <aside class="jed-side" hidden aria-label="Article settings"></aside></div>`;
  const q = (s) => $(s, body);
  const title = q(".jed-title"), exc = q(".jed-excerpt"), host = q(".jed-body");
  title.value = S.title; exc.value = S.excerpt;
  const fit = (t) => { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; };
  [title, exc].forEach((t) => { t.addEventListener("input", () => { fit(t); touch(); }); setTimeout(() => fit(t), 0); });
  title.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); exc.focus(); } });
  exc.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); ed && ed.focus("start"); } });
  title.addEventListener("input", () => { if (!slugTouched) S.slug = slugify(title.value); });

  function snapshot() {
    const tags = S.tags;
    const o = { ...S.extra, slug: S.slug || slugify(title.value) || "article", title: title.value.trim(), excerpt: exc.value.trim(), tag: tags[0] || "", tags: tags.slice(1), date: S.date, blocks: ed ? ed.getBlocks() : S.blocks, img: S.img || undefined, imgAlt: S.imgAlt || undefined, seoTitle: S.seoTitle || undefined, seoDesc: S.seoDesc || undefined, noindex: S.noindex || undefined, publishAt: S.publishAt || undefined, draft: S.draft || undefined, source: S.source || undefined, url: S.url || undefined, more: S.more.length ? S.more : undefined, body: "" };
    for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k];
    return o;
  }
  function uniqueSlug(s) { let slug = s, n = 2; while (J.posts.some((x) => x.slug === slug && x.slug !== orig)) slug = `${s}-${n++}`; return slug; }
  function touch(now) { clearTimeout(saveT); setStatus("Unsaved changes"); saveT = setTimeout(save, now ? 0 : 1300); updBtn(); }
  async function save() {
    clearTimeout(saveT);
    const p = snapshot();
    if (!p.title && !(p.blocks && p.blocks.length)) return;
    if (!p.title) p.title = "Untitled article";
    p.slug = uniqueSlug(p.slug); S.slug = p.slug;
    const i = orig ? J.posts.findIndex((x) => x.slug === orig) : -1;
    if (i >= 0) J.posts[i] = p; else J.posts.unshift(p);
    orig = p.slug; const bk = $(".jed-bar .back", body); if (bk) bk.innerHTML = I("chevron-left") + "Back"; const slugEl = q("[data-f=slug]"); if (slugEl && slugEl !== document.activeElement) slugEl.value = p.slug;
    await persist();
  }
  const updBtn = () => {
    const b = q("[data-a=publish]"), live = q(".jed-live"), st = S.draft ? "draft" : S.publishAt && Date.parse(S.publishAt) > Date.now() ? "scheduled" : "published";
    b.textContent = st === "draft" ? "Publish" : st === "scheduled" ? "Scheduled · change" : "Unpublish";
    b.className = st === "published" ? "btn tonal" : "btn"; live.hidden = st !== "published";
  };
  /* cover */
  const drawCover = () => {
    const c = q(".jed-cover");
    if (S.img) {
      c.innerHTML = `<img src="${esc(S.img)}" alt="${esc(S.imgAlt || "")}"><div class="jed-ct"><button data-c="replace">Replace</button><button data-c="alt">Alt text</button><button data-c="remove">Remove</button></div>`;
    } else c.innerHTML = `<button class="jed-add" data-c="add"><span>${I("image", 20)}</span> Add a cover image <small>Shown on the list, the article page, Google and social shares</small></button>`;
    $$("[data-c]", c).forEach((b) => (b.onclick = async () => {
      const a = b.dataset.c;
      if (a === "remove") { S.img = ""; S.imgAlt = ""; drawCover(); touch(); return; }
      if (a === "alt") { const v = prompt("Describe the cover image (for search engines and screen readers)", S.imgAlt || ""); if (v != null) { S.imgAlt = v.trim(); drawCover(); touch(); } return; }
      const f = (await Up.pick("image/*"))[0]; if (!f) return; await setCover(f);
    }));
  };
  async function setCover(f) { const c = q(".jed-cover"); c.classList.add("busy"); try { const r = await Up.image(f); S.img = r.url; if (!S.imgAlt) S.imgAlt = ""; drawCover(); touch(true); } catch (e) { toast(e.message); } c.classList.remove("busy"); }
  const cv = q(".jed-cover");
  cv.addEventListener("dragover", (e) => { e.preventDefault(); cv.classList.add("over"); }); cv.addEventListener("dragleave", () => cv.classList.remove("over"));
  cv.addEventListener("drop", (e) => { e.preventDefault(); cv.classList.remove("over"); const f = e.dataTransfer.files[0]; if (f) setCover(f); });
  drawCover();
  /* the editor */
  ed = await makeEditor(host, { blocks: S.blocks, onChange: () => touch(), onStatus: ({ uploading }) => { if (uploading) setStatus("Uploading…"); } });
  if (isNew) title.focus(); updBtn();
  if (!isNew && !S.blocks.length) ed.focus("start");

  /* settings drawer */
  const side = q(".jed-side");
  function drawSide() {
    const st = S.draft ? "draft" : S.publishAt && Date.parse(S.publishAt) > Date.now() ? "scheduled" : "published";
    const sTitle = S.seoTitle || title.value || "Article title", sDesc = S.seoDesc || exc.value || "Your summary shows here.";
    side.innerHTML = `<div class="jed-sh"><b>Article settings</b><button data-a="closeside" aria-label="Close settings">${I("x", 16)}</button></div>
      <label class="ow-f">Status<select data-f="state"><option value="draft"${st === "draft" ? " selected" : ""}>Draft (only you can see it)</option><option value="published"${st === "published" ? " selected" : ""}>Published</option><option value="scheduled"${st === "scheduled" ? " selected" : ""}>Scheduled</option></select></label>
      <label class="ow-f" data-sched ${st === "scheduled" ? "" : "hidden"}>Publish on<input type="datetime-local" data-f="publishAt" value="${S.publishAt ? toLocalInput(S.publishAt) : ""}"></label>
      <label class="ow-f">Date shown<input type="date" data-f="dateIso" value="${isoOf({ date: S.date, published: S.extra.published })}"></label>
      <div class="ow-f">Tags <small>The first one is the main category</small><div class="chipin" data-chips></div></div>
      <label class="ow-f">Address <small>rohankumar.pro/journal/<b>${esc(S.slug || "…")}</b></small><input data-f="slug" maxlength="80" value="${esc(S.slug)}" ${isNew || st === "draft" ? "" : ""}></label>
      ${st === "published" && orig ? '<p class="hint">Changing the address of a published article breaks old links to it.</p>' : ""}
      <h3>Search and sharing</h3>
      <label class="ow-f">Title for Google <small data-cnt="t">${sTitle.length}/60</small><input data-f="seoTitle" maxlength="70" placeholder="${esc(title.value || "Same as the article title")}" value="${esc(S.seoTitle)}"></label>
      <label class="ow-f">Description for Google <small data-cnt="d">${sDesc.length}/160</small><textarea data-f="seoDesc" rows="3" maxlength="200" placeholder="Same as the summary">${esc(S.seoDesc)}</textarea></label>
      <div class="serp"><small>rohankumar.pro / journal / ${esc(S.slug || "")}</small><b>${esc(sTitle.slice(0, 60))}</b><span>${esc(sDesc.slice(0, 160))}</span></div>
      <label class="ow-app"><input type="checkbox" data-f="noindex" ${S.noindex ? "checked" : ""}><span>Hide this article from search engines</span></label>
      <h3>Original source</h3>
      <label class="ow-f">Where else is it published?<input data-f="source" maxlength="40" placeholder="LinkedIn" value="${esc(S.source)}"></label>
      <label class="ow-f">Link<input data-f="url" maxlength="300" placeholder="https://…" value="${esc(S.url)}" inputmode="url"></label>
      <div class="ed-ctl">${orig ? '<button data-a="dup">Duplicate</button><button class="ed-del" data-a="del">Delete article</button>' : ""}</div>`;
    chips($("[data-chips]", side), S.tags, { placeholder: "Add a tag", suggestions: [...new Set(J.posts.flatMap(allTags))], max: 8, onChange: () => touch() });
    const f = (n) => $(`[data-f=${n}]`, side);
    $$("[data-f]", side).forEach((el) => {
      const ev = el.tagName === "SELECT" || el.type === "checkbox" || el.type === "date" || el.type === "datetime-local" ? "change" : "input";
      el.addEventListener(ev, () => {
        const k = el.dataset.f;
        if (k === "state") { const v = el.value; if (v === "draft") { S.draft = true; S.publishAt = ""; } else if (v === "published") { S.draft = false; S.publishAt = ""; } else { S.draft = false; if (!S.publishAt) S.publishAt = new Date(Date.now() + 86400000).toISOString(); } drawSide(); updBtn(); touch(true); return; }
        if (k === "publishAt") { S.publishAt = el.value ? new Date(el.value).toISOString() : ""; touch(); return; }
        if (k === "dateIso") { if (el.value) { const [y, m, d] = el.value.split("-"); S.date = `${MON[+m - 1]} ${+d}, ${y}`; S.extra.published = el.value; touch(); } return; }
        if (k === "slug") { slugTouched = true; S.slug = slugify(el.value) || ""; touch(); const b = $("small b", el.closest("label")); if (b) b.textContent = S.slug || "…"; return; }
        if (k === "noindex") { S.noindex = el.checked; touch(); return; }
        S[k] = el.value.trim();
        const t = f("seoTitle").value || title.value || "", d = f("seoDesc").value || exc.value || "";
        $("[data-cnt=t]", side).textContent = t.length + "/60"; $("[data-cnt=d]", side).textContent = d.length + "/160";
        const sp = $(".serp", side); sp.querySelector("b").textContent = t.slice(0, 60); sp.querySelector("span").textContent = d.slice(0, 160);
        touch();
      });
    });
  }
  const toLocalInput = (iso) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  body.onclick = async (e) => {
    const a = e.target.closest("[data-a]")?.dataset.a; if (!a && !e.target.closest(".back")) return;
    if (e.target.closest(".back")) { await finish(); return; }
    if (a === "settings") { side.hidden = !side.hidden; if (!side.hidden) drawSide(); }
    if (a === "closeside") side.hidden = true;
    if (a === "publish") {
      const stNow = S.draft ? "draft" : S.publishAt && Date.parse(S.publishAt) > Date.now() ? "scheduled" : "published";
      if (stNow === "draft") {
        const miss = []; if (!title.value.trim()) { toast("Add a title first."); title.focus(); return; } if (!exc.value.trim()) miss.push("a summary"); if (!S.img) miss.push("a cover image"); if (!S.tags.length) miss.push("a tag");
        if (miss.length && !(await confirmBox("Publish without " + miss.join(", ") + "? They help search engines and social shares.", "Publish anyway", false))) return;
        S.draft = false; S.publishAt = ""; if (!S.extra.published) { S.date = today(); } toast("Published. It now has its own page.");
      } else if (stNow === "published") { if (!(await confirmBox("Unpublish this article? It becomes a draft only you can see.", "Unpublish", false))) return; S.draft = true; }
      else { S.publishAt = ""; S.draft = true; }
      updBtn(); touch(true); if (!side.hidden) drawSide();
    }
    if (a === "preview") {
      preview = !preview; q("[data-a=preview]").textContent = preview ? "Edit" : "Preview";
      const pv = q(".jed-prev"); host.hidden = preview; pv.hidden = !preview; title.readOnly = exc.readOnly = preview;
      if (preview) showBlocks(pv, ed.getBlocks(), { hBase: 2 });
    }
    if (a === "dup") { const p = { ...snapshot(), title: title.value.trim() + " (copy)", slug: uniqueSlug(S.slug + "-copy"), draft: true }; J.posts.unshift(p); await persist(); toast("Duplicated as a draft."); orig = ""; edit(body, p); }
    if (a === "del") { if (await confirmBox("Delete this article for good?")) { clearTimeout(saveT); const i = J.posts.findIndex((x) => x.slug === orig); if (i >= 0) J.posts.splice(i, 1); await persist(); ed.destroy(); w.classList.toggle("max", wasMax); list(body); R.item(body, "", "", "push"); } }
  };
  async function finish() {
    clearTimeout(saveT); await save(); const fl = ed ? ed.flush() : null; ed && ed.destroy();
    body.onclick = null; body.classList.remove("jr-editing"); w.classList.toggle("max", wasMax);
    const p = orig && J.posts.find((x) => x.slug === orig);
    if (p) read(body, p); else list(body);
  }
  body.addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); } });
  R.item(body, "", "Writing — Journal", "replace");
}
