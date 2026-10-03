// Projects: a portfolio like Behance or Dribbble. A grid of covers, a full page for each project, and a studio for the owner
// with a cover, rich content blocks, tags, tools, credits, extra links, licence and search settings. Each project has its own address.
import { h, $, $$, esc, api, isAdmin, toast, mobile, showBlocks, makeEditor, Up, share, chips, confirmBox, fmtNum } from "/js/lib.mjs";
import { slugify, upSrc, upThumb } from "/shared/blocks.mjs";
import { R } from "/js/os-ext.mjs";
import { icon as _ic, ICONS as _ICONS } from "/shared/icons.mjs";
const I = (n, size = 16) => _ic(n, { size });

const PR = { list: null, seeded: false, cache: {}, status: "", saving: false, again: false };
const FIELDS = ["Branding", "Logo Design", "Graphic Design", "Illustration", "UI / UX", "Web Design", "Packaging", "Typography", "Motion Graphics", "Photography", "Art Direction", "Social Media", "Print Design", "Product Design", "Icon Design"];
const TOOLS = ["Figma", "Illustrator", "Photoshop", "InDesign", "After Effects", "Blender", "Procreate", "Webflow", "Framer", "Lightroom", "Cinema 4D", "Sketch"];
const LICENSES = { "all-rights": "All rights reserved", "cc-by": "CC BY 4.0", "cc-by-sa": "CC BY-SA 4.0", "cc-by-nc": "CC BY-NC 4.0", "cc-by-nd": "CC BY-ND 4.0", "cc-by-nc-sa": "CC BY-NC-SA 4.0", "cc0": "CC0 (public domain)" };
const uid = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "").slice(0, 14) : Math.random().toString(36).slice(2, 16));
const liked = () => { try { return new Set(JSON.parse(localStorage.getItem("pjLikes") || "[]")); } catch { return new Set(); } };
const saveLiked = (s) => { try { localStorage.setItem("pjLikes", JSON.stringify([...s])); } catch {} };
const setStatus = (t) => { PR.status = t; $$(".pj .nt-status,.pjed-st").forEach((e) => (e.textContent = t)); };

async function loadList(force) {
  if (PR.list && !force) return;
  const r = await api("/api/projects");
  PR.list = r.ok ? r.data.projects : [];
  PR.seeded = !!(r.ok && r.data.seeded);
}
const listShown = () => (isAdmin() ? PR.list : PR.list.filter((p) => p.status === "published"));

export async function projectsApp(body, slug) {
  window.registerCtx && window.registerCtx("projects", (el) => {
    const card = el.closest(".pj-card[data-id]"), own = isAdmin(), items = [];
    if (card) {
      const p = (PR.list || []).find((x) => x.id === card.dataset.id); if (!p) return items;
      const url = location.origin + "/projects/" + p.slug, i = PR.list.findIndex((x) => x.id === p.id);
      items.push(["Open project", () => card.click()], ["Copy link", async () => { try { await navigator.clipboard.writeText(url); toast("Link copied"); } catch { toast("Could not copy"); } }], ["Share", () => share(url, p.title)]);
      if (own) items.push(null, ["Edit", () => studio(body, p)], [p.status === "published" ? "Unpublish" : "Publish", () => quick(p, { status: p.status === "published" ? "draft" : "published" }, body)], [p.featured ? "Remove from featured" : "Feature", () => quick(p, { featured: !p.featured }, body)], ["Move earlier", () => move(i, -1, body)], ["Move later", () => move(i, 1, body)], ["Duplicate", () => dup(p, body)], ["Delete", () => del(p, body), "danger"]);
    } else if (own && body.querySelector(".pj-new")) items.push(["New project", () => body.querySelector(".pj-new").click()]);
    return items;
  });
  R.handlers.projects = (b, s) => route(b, s);
  await loadList();
  return route(body, slug || "");
}
async function route(body, slug) {
  await loadList();
  body.classList.remove("pj-editing"); body.onscroll = null; body.onclick = null;
  if (!slug) return grid(body, true);
  const m = PR.list.find((p) => p.slug === slug);
  if (!m || (m.status === "draft" && !isAdmin())) { grid(body, true); toast("That project wasn't found."); return; }
  return detail(body, m.slug, true);
}

/* ---------- the grid ---------- */
const coverStyle = (c) => (c ? `object-position:${c.fx ?? 50}% ${c.fy ?? 50}%` : "");
function card(p) {
  const likes = p.likes || 0, views = p.views || 0;
  return `<a class="pj-card${p.status !== "published" ? " dim" : ""}" href="/projects/${esc(p.slug)}" data-slug="${esc(p.slug)}" data-id="${esc(p.id)}">
    <span class="pj-cv" style="--bgc:var(--${esc(p.color || "c2")})">${p.cover ? `<img src="${esc(upSrc(p.cover.src))}" ${upThumb(upSrc(p.cover.src)) ? `srcset="${esc(upThumb(upSrc(p.cover.src)))} 640w, ${esc(upSrc(p.cover.src))} 1800w" sizes="(max-width:760px) 50vw, 240px"` : ""} alt="${esc(p.cover.alt || p.title)}" loading="lazy" style="${coverStyle(p.cover)}">` : `<span class="pj-ph">${esc((p.title || "?").slice(0, 1).toUpperCase())}</span>`}
      ${p.featured ? `<em class="pj-b">${I("star", 12)} Featured</em>` : ""}${p.status !== "published" && isAdmin() ? `<em class="pj-b d">${p.status === "draft" ? "Draft" : "Unlisted"}</em>` : ""}</span>
    <span class="pj-m"><b>${esc(p.title)}</b><small>${esc([p.field, p.year].filter(Boolean).join(" · "))}</small></span>
    ${views || likes ? `<span class="pj-st"><span title="Appreciations">${I("heart", 13)} ${fmtNum(likes)}</span><span title="Views">${I("eye", 13)} ${fmtNum(views)}</span></span>` : ""}
    ${isAdmin() ? `<button class="pj-more" data-id="${esc(p.id)}" aria-label="Project options" title="Options"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="18.5" cy="12" r="1.9"/></svg></button>` : ""}</a>`;
}
function grid(body, quiet) {
  body.scrollTop = 0; body.onscroll = null;
  const root = h("div", { class: "pj" }); body.replaceChildren(root);
  let field = "", q = "", sort = "order";
  const draw = () => {
    const all = listShown(), fields = [...new Set(all.map((p) => p.field).filter(Boolean))];
    let shown = all.filter((p) => (!field || p.field === field) && (!q || (p.title + " " + p.summary + " " + (p.tags || []).join(" ") + " " + p.field).toLowerCase().includes(q)));
    if (sort === "new") shown = shown.slice().sort((a, b) => (b.publishedAt || b.ts || 0) - (a.publishedAt || a.ts || 0));
    if (sort === "popular") shown = shown.slice().sort((a, b) => (b.likes || 0) + (b.views || 0) / 10 - ((a.likes || 0) + (a.views || 0) / 10));
    if (sort === "order") shown = [...shown.filter((p) => p.featured), ...shown.filter((p) => !p.featured)];
    root.innerHTML = `<div class="nt-head"><h1>Projects</h1>${isAdmin() ? `<div class="nt-tools"><span class="nt-status">${esc(PR.status)}</span>${(PR.list.some((p) => /^dr\d+$/.test(p.id)) && !importLeft()) || PR.importing ? "" : '<button class="pj-imp">Import from Dribbble</button>'}<button class="pj-new">+ New project</button></div>` : ""}</div>
      ${isAdmin() && PR.seeded ? '<p class="hint">These are sample projects. Edit one, or add your own.</p>' : ""}
      <div class="pj-tools"><input type="search" class="jr-search" placeholder="Search projects" aria-label="Search projects" value="${esc(q)}"><div class="seg pj-sort" role="group" aria-label="Sort">${[["order","Featured"],["new","Newest"],["popular","Popular"]].map(([k, l]) => `<button data-s="${k}" class="${sort === k ? "on" : ""}">${l}</button>`).join("")}</div></div>
      ${fields.length > 1 ? `<div class="jtags"><button class="${!field ? "on" : ""}" data-f="">All <span>${all.length}</span></button>${fields.map((f) => `<button class="${field === f ? "on" : ""}" data-f="${esc(f)}">${esc(f)}</button>`).join("")}</div>` : ""}
      ${shown.length ? `<div class="pj-grid">${shown.map(card).join("")}</div>` : `<p class="nt-hint">${q || field ? "Nothing matches that." : "No projects yet."}</p>`}`;
    $$("[data-f]", root).forEach((b) => (b.onclick = () => { field = b.dataset.f; draw(); }));
    $$("a.pj-card", root).forEach((a) => (a.onclick = (e) => { if (e.target.closest(".pj-more")) { e.preventDefault(); return; } if (e.metaKey || e.ctrlKey) return; e.preventDefault(); detail(body, a.dataset.slug); }));
    $$(".pj-more", root).forEach((b) => (b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); cardMenu(b, body); }));
    const se = $(".jr-search", root); se.oninput = () => { q = se.value.trim().toLowerCase(); const pos = se.selectionStart; draw(); const n = $(".jr-search", root); n.focus(); n.setSelectionRange(pos, pos); };
    $$(".pj-sort [data-s]", root).forEach((b) => (b.onclick = () => { sort = b.dataset.s; draw(); }));
    const nb = $(".pj-new", root); if (nb) nb.onclick = () => studio(body, null);
    const ib = $(".pj-imp", root); if (ib) ib.onclick = () => importPicks(body);
  };
  draw();
  if (!quiet) R.item(body, "", "", "push");
}
function cardMenu(btn, body) {
  const id = btn.dataset.id, p = PR.list.find((x) => x.id === id); if (!p) return;
  document.querySelectorAll(".pj-menu").forEach((m) => m.remove());
  const i = PR.list.findIndex((x) => x.id === id);
  const items = [["Edit", () => studio(body, p)], [p.status === "published" ? "Unpublish" : "Publish", () => quick(p, { status: p.status === "published" ? "draft" : "published" }, body)], [p.featured ? "Remove from featured" : "Feature", () => quick(p, { featured: !p.featured }, body)],
    ["Move earlier", () => move(i, -1, body)], ["Move later", () => move(i, 1, body)], ["Duplicate", () => dup(p, body)], ["Delete", () => del(p, body), true]];
  const m = h("div", { class: "pj-menu rte-pop" }, items.map(([l, fn, d]) => h("button", { class: "rte-mi" + (d ? " danger" : ""), onclick: () => { m.remove(); fn(); } }, l)));
  document.body.append(m); const r = btn.getBoundingClientRect(); m.style.left = Math.min(r.left, innerWidth - 200) + "px"; m.style.top = Math.min(r.bottom + 4, innerHeight - m.offsetHeight - 8) + "px";
  setTimeout(() => document.addEventListener("pointerdown", (e) => { if (!m.contains(e.target)) m.remove(); }, { once: true, capture: true }), 0);
}
async function quick(meta, patch, body) {
  const full = await fetchFull(meta.id); if (!full) return;
  const r = await api("/api/projects", { method: "PUT", body: { project: { ...full, ...patch } } });
  if (r.ok) { PR.list = r.data.projects; delete PR.cache[meta.id]; PR.seeded = false; grid(body, true); toast("Saved"); } else toast("Could not save (" + r.status + ")");
}
async function move(i, d, body) {
  const j = i + d; if (j < 0 || j >= PR.list.length) return;
  const ids = PR.list.map((p) => p.id); [ids[i], ids[j]] = [ids[j], ids[i]];
  const r = await api("/api/projects", { method: "PUT", body: { order: ids } }); if (r.ok) { PR.list = r.data.projects; grid(body, true); }
}
async function dup(meta, body) {
  const full = await fetchFull(meta.id); if (!full) return;
  const p = { ...full, id: uid(), title: full.title + " (copy)", slug: full.slug + "-copy", status: "draft", featured: false };
  const r = await api("/api/projects", { method: "PUT", body: { project: p } }); if (r.ok) { PR.list = r.data.projects; PR.seeded = false; grid(body, true); toast("Duplicated as a draft"); }
}
async function del(meta, body) {
  if (!(await confirmBox(`Delete “${meta.title}” for good?`))) return;
  const r = await api("/api/projects?id=" + encodeURIComponent(meta.id), { method: "DELETE" }); if (r.ok) { PR.list = r.data.projects; PR.seeded = false; grid(body, true); } else toast("Could not delete");
}
/* ---------- one-time import of the handpicked Dribbble shots ---------- */
const importLeft = () => { try { return !!localStorage.getItem("pjImport"); } catch { return false; } };
// Copies every picture to this site (shrunk, with a small copy, like any upload), saves each shot as a published project,
// and only then deletes the projects that are not part of the picks. Pictures already copied are remembered, so a retry resumes.
async function importPicks(body) {
  const { PICKS } = await import("/js/dribbble-picks.mjs");
  const ids = new Set(PICKS.map((k) => k.id)), old = PR.list.filter((p) => !ids.has(p.id));
  const pics = PICKS.reduce((n, k) => n + 1 + k.body.filter((x) => typeof x === "string").length, 0);
  const msg = `Import ${PICKS.length} projects from Dribbble (${pics} pictures)?` + (old.length ? ` Afterwards ${old.length === 1 ? "this project is" : "these projects are"} deleted: ${old.map((p) => `“${p.title}”`).join(", ")}.` : "") + " It takes a few minutes. Keep this window open.";
  if (!(await confirmBox(msg, "Import", false))) return;
  let done = {}; try { done = JSON.parse(localStorage.getItem("pjImport") || "{}"); } catch {}
  const remember = () => { try { localStorage.setItem("pjImport", JSON.stringify(done)); } catch {} };
  const copy = async (src, label) => {
    if (done[src]) return done[src];
    setStatus(label);
    const res = await fetch(src + (src.includes("?") ? "&" : "?") + "format=webp");
    if (!res.ok) throw new Error(`Dribbble did not send a picture (${res.status}).`);
    const blob = await res.blob();
    const r = await Up.image(new File([blob], src.split("/").pop().split("?")[0].replace(/\.\w+$/, ".webp"), { type: blob.type || "image/webp" }));
    done[src] = { url: r.url, w: r.w, h: r.h }; remember();
    return done[src];
  };
  PR.importing = true; grid(body, true);
  let n = 0;
  try {
    for (const k of PICKS) {
      const total = k.body.filter((x) => typeof x === "string").length;
      const cover = await copy(k.cover, `${k.title}: cover (${++n} of ${pics})`);
      const blocks = []; let i = 0;
      for (const x of k.body) {
        if (typeof x === "string") { const im = await copy(x, `${k.title}: picture ${++i} of ${total} (${++n} of ${pics})`); blocks.push({ t: "image", src: im.url, alt: `${k.title}, picture ${i} of ${total}`, w: "w", rw: im.w, rh: im.h }); }
        else if (x.h) blocks.push({ t: "h2", h: esc(x.h) });
        else blocks.push({ t: "p", h: esc(x.p) });
      }
      const project = { id: k.id, title: k.title, summary: k.summary, field: k.field, tags: k.tags, tools: [], year: k.year, client: "", role: "", color: "c2", status: "published", featured: false, license: "all-rights",
        cover: { src: cover.url, fx: 50, fy: 50, alt: k.title }, links: [{ label: "View on Dribbble", url: k.link }], credits: [], blocks, slug: slugify(k.title) };
      setStatus(`Saving ${k.title}…`);
      const r = await api("/api/projects", { method: "PUT", body: { project } });
      if (!r.ok) throw new Error(r.status === 401 ? "You are signed out. Sign in again, then press Import again." : `Could not save ${k.title} (${r.status}).`);
      PR.list = r.data.projects; PR.seeded = false;
    }
    for (const p of old) {
      setStatus(`Removing ${p.title}…`);
      const r = await api("/api/projects?id=" + encodeURIComponent(p.id), { method: "DELETE" });
      if (r.ok) PR.list = r.data.projects;
    }
    const r = await api("/api/projects", { method: "PUT", body: { order: PICKS.map((k) => k.id) } }); if (r.ok) PR.list = r.data.projects;
    try { localStorage.removeItem("pjImport"); } catch {}
    setStatus(""); toast(`Imported ${PICKS.length} projects from Dribbble`);
  } catch (e) {
    setStatus("Import stopped"); toast(e.message + " Press Import again to carry on where it stopped.");
  } finally { PR.importing = false; PR.cache = {}; await loadList(true); grid(body, true); }
}
async function fetchFull(id) {
  if (PR.cache[id]) return PR.cache[id];
  const r = await api("/api/projects?id=" + encodeURIComponent(id)); if (!r.ok) { toast("Could not load that project"); return null; }
  return (PR.cache[id] = r.data.project);
}

/* ---------- one project ---------- */
async function detail(body, slug, quiet) {
  body.scrollTop = 0; body.onscroll = null;
  const meta = PR.list.find((p) => p.slug === slug); if (!meta) return grid(body);
  body.innerHTML = '<div class="app-loading"><span class="rb-spin"></span></div>';
  const r = await api("/api/projects?slug=" + encodeURIComponent(slug));
  if (!r.ok) { grid(body); toast("That project wasn't found."); return; }
  const p = r.data.project, prev = r.data.prev, next = r.data.next; PR.cache[p.id] = p;
  const L = liked(), pub = PR.list.filter((x) => x.status === "published");
  const more = pub.filter((x) => x.id !== p.id && (x.field === p.field || (x.tags || []).some((t) => (p.tags || []).includes(t)))).slice(0, 3);
  body.innerHTML = `<div class="abar jr-bar"><div class="jr-row"><button class="back">${I("chevron-left")}All projects</button><span class="sp"></span><button class="pj-like${L.has(p.id) ? " on" : ""}" aria-pressed="${L.has(p.id)}">${I("heart", 16)} <span>${fmtNum(p.likes || 0)}</span></button><button class="j-share">Share</button>${isAdmin() ? '<button class="j-edit">Edit</button>' : ""}</div><div class="rprog"><i></i></div></div>
  <article class="article pj-art" itemscope itemtype="https://schema.org/CreativeWork">
    ${p.cover ? `<img class="ahero pj-hero" src="${esc(p.cover.src)}" alt="${esc(p.cover.alt || p.title)}" style="${coverStyle(p.cover)}">` : ""}
    <h1 itemprop="name">${esc(p.title)}</h1>${p.status !== "published" ? `<span class="upd">${p.status === "draft" ? "Draft: only you can see this" : "Unlisted: only people with the link can see this"}</span>` : ""}
    ${p.summary ? `<p class="lead">${esc(p.summary)}</p>` : ""}
    <dl class="pj-facts">${[["Field", p.field], ["Year", p.year], ["Client", p.client], ["Role", p.role]].filter((x) => x[1]).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}${p.tools?.length ? `<div class="wide"><dt>Tools</dt><dd>${p.tools.map((t) => `<span class="chip">${esc(t)}</span>`).join(" ")}</dd></div>` : ""}</dl>
    ${p.link || (p.links || []).length ? `<div class="afoot">${p.link ? `<a class="btn" href="${esc(p.link)}" target="_blank" rel="noopener">View the project ${I("external", 14)}</a>` : ""}${(p.links || []).map((l) => `<a class="btn tonal" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ${I("external", 14)}</a>`).join("")}</div>` : ""}
    <div class="pj-content"></div>
    ${p.credits?.length ? `<section class="pj-credits"><h2>Credits</h2><ul>${p.credits.map((c) => `<li>${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.name)}</a>` : esc(c.name)}${c.role ? ` <span>${esc(c.role)}</span>` : ""}</li>`).join("")}</ul></section>` : ""}
    ${p.tags?.length ? `<p class="jr-tags">${p.tags.map((t) => `<span>#${esc(t)}</span>`).join("")}</p>` : ""}
    <p class="pj-lic"><small>${esc(LICENSES[p.license] || LICENSES["all-rights"])} · ${fmtNum(p.views || 0)} views</small></p>
    <div class="callout"><p><b>Like what you see?</b> Let's make something together.</p><a class="btn" href="${esc((typeof P !== "undefined" && P.booking) || "#")}" target="_blank" rel="noopener">Book a call</a></div>
    ${more.length ? `<section class="jr-rel"><h2>More projects</h2><div class="pj-grid mini">${more.map((m) => card({ ...m })).join("")}</div></section>` : ""}
    <nav class="jr-pn">${prev ? `<a href="/projects/${esc(prev.slug)}" data-slug="${esc(prev.slug)}"><small>${I("chevron-left", 13)}Previous</small><b>${esc(prev.title)}</b></a>` : "<span></span>"}${next ? `<a href="/projects/${esc(next.slug)}" data-slug="${esc(next.slug)}"><small>Next${I("chevron-right", 13)}</small><b>${esc(next.title)}</b></a>` : "<span></span>"}</nav></article>`;
  showBlocks($(".pj-content", body), p.blocks, { hBase: 2 });
  const bar = $(".rprog i", body);
  body.onscroll = () => { if (!bar.isConnected) { body.onscroll = null; return; } const m = body.scrollHeight - body.clientHeight; bar.style.width = (m > 0 ? (body.scrollTop / m) * 100 : 0) + "%"; };
  $(".back", body).onclick = () => grid(body);
  $$("a[data-slug]", body).forEach((a) => (a.onclick = (e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); if (e.target.closest(".pj-more")) return; detail(body, a.dataset.slug); }));
  $(".j-share", body).onclick = () => share("/projects/" + p.slug, p.title);
  const eb = $(".j-edit", body); if (eb) eb.onclick = () => studio(body, p);
  const lk = $(".pj-like", body);
  lk.onclick = async () => { const s = liked(), on = s.has(p.id); on ? s.delete(p.id) : s.add(p.id); saveLiked(s); lk.classList.toggle("on", !on); lk.setAttribute("aria-pressed", !on); const r2 = await api("/api/projects?a=like", { method: "POST", body: { id: p.id, undo: on } }); if (r2.ok) $("span", lk).textContent = fmtNum(r2.data.likes); if (!on && window.SFX) SFX.play("pop"); };
  try { if (!isAdmin() && !sessionStorage.getItem("pv:" + p.id)) { sessionStorage.setItem("pv:" + p.id, "1"); api("/api/projects?a=view", { method: "POST", body: { id: p.id } }); } } catch {}
  R.item(body, p.slug, `${p.title} — ${P.name}`, quiet ? "replace" : "push");
}

/* ---------- the studio ---------- */
async function studio(body, meta) {
  const w = body.closest(".win"), wasMax = w.classList.contains("max");
  const isNew = !meta;
  let full = isNew ? null : await fetchFull(meta.id);
  if (!isNew && !full) return;
  const S = isNew
    ? { id: uid(), title: "", summary: "", field: "", tags: [], tools: [], year: String(new Date().getFullYear()), client: "", role: "", color: "c2", status: "draft", featured: false, license: "all-rights", cover: null, link: "", links: [], credits: [], seo: { title: "", desc: "", image: "" }, blocks: [], slug: "" }
    : { ...JSON.parse(JSON.stringify(full)), seo: { title: "", desc: "", image: "", ...(full.seo || {}) }, links: full.links || [], credits: full.credits || [], tags: full.tags || [], tools: full.tools || [], blocks: full.blocks || [], link: full.link || "" };
  body.__pj = S;
  let slugTouched = !isNew, saveT = null, ed = null, preview = false, created = !isNew;
  if (!mobile()) w.classList.add("max");
  body.onscroll = null; body.scrollTop = 0; body.classList.add("jr-editing", "pj-editing");
  body.innerHTML = `<div class="jed pjed"><div class="jed-bar"><button class="back">${I("chevron-left")}${isNew ? "Cancel" : "Back"}</button><span class="jed-st pjed-st">${esc(PR.status)}</span><span class="sp"></span><span class="jed-live" hidden>Live</span><button data-a="preview">Preview</button><button data-a="settings">Settings</button><button class="btn" data-a="publish"></button></div>
    <div class="jed-scroll"><div class="jed-main"><div class="pj-cover jed-cover"></div>
      <textarea class="jed-title" rows="1" maxlength="160" placeholder="Project title" aria-label="Project title"></textarea>
      <textarea class="jed-excerpt" rows="2" maxlength="400" placeholder="One or two sentences: the problem, your role, the result" aria-label="Summary"></textarea>
      <div class="jed-body"></div><div class="jed-prev bk-doc" hidden></div></div></div>
    <aside class="jed-side pj-side" hidden aria-label="Project settings"></aside></div>`;
  const q = (s) => $(s, body), title = q(".jed-title"), exc = q(".jed-excerpt"), host = q(".jed-body");
  title.value = S.title; exc.value = S.summary;
  const fit = (t) => { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; };
  [title, exc].forEach((t) => { t.addEventListener("input", () => { fit(t); touch(); }); setTimeout(() => fit(t), 0); });
  title.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); exc.focus(); } });
  exc.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); ed && ed.focus("start"); } });
  title.addEventListener("input", () => { if (!slugTouched) S.slug = slugify(title.value); });

  const collect = () => ({ ...S, title: title.value.trim(), summary: exc.value.trim(), blocks: ed ? ed.getBlocks() : S.blocks, link: S.link || "", slug: S.slug || slugify(title.value) || "project", cover: S.cover && S.cover.src ? S.cover : undefined });
  function touch(now) { clearTimeout(saveT); setStatus("Unsaved changes"); saveT = setTimeout(save, now ? 0 : 1300); updBtn(); }
  async function save() {
    clearTimeout(saveT);
    if (PR.saving) { PR.again = true; return; }
    const p = collect(); if (!p.title && !(p.blocks && p.blocks.length) && !created) return;
    if (!p.title) p.title = "Untitled project";
    PR.saving = true; setStatus("Saving…");
    try {
      const r = await api("/api/projects", { method: "PUT", body: { project: p } });
      if (r.ok) { created = true; PR.list = r.data.projects; PR.cache[S.id] = r.data.project; PR.seeded = false; S.slug = r.data.project.slug; const bk = $(".jed-bar .back", body); if (bk) bk.innerHTML = I("chevron-left") + "Back"; const se = q("[data-f=slug]"); if (se && se !== document.activeElement) se.value = S.slug; setStatus("Saved"); }
      else setStatus(r.status === 401 ? "Signed out. Not saved." : r.status === 0 ? "Offline. Not saved." : r.data.error || "Could not save (" + r.status + ")");
    } finally { PR.saving = false; if (PR.again) { PR.again = false; save(); } }
  }
  const updBtn = () => {
    const b = q("[data-a=publish]"), live = q(".jed-live");
    b.textContent = S.status === "published" ? "Unpublish" : S.status === "unlisted" ? "Publish" : "Publish";
    b.className = S.status === "published" ? "btn tonal" : "btn"; live.hidden = S.status !== "published";
  };
  /* cover with a focus point */
  const drawCover = () => {
    const c = q(".pj-cover");
    if (S.cover && S.cover.src) {
      c.innerHTML = `<img src="${esc(S.cover.src)}" alt="" style="${coverStyle(S.cover)}"><i class="pj-focus" style="left:${S.cover.fx ?? 50}%;top:${S.cover.fy ?? 50}%"></i><div class="jed-ct"><button data-c="replace">Replace</button><button data-c="alt">Alt text</button><button data-c="remove">Remove</button></div><small class="pj-hint">Click the picture to choose which part stays in view when it is cropped</small>`;
    } else c.innerHTML = `<button class="jed-add" data-c="add"><span>${I("image", 20)}</span> Add a cover image <small>Shows on the projects grid, the project page, Google and social shares. 4:3 works best.</small></button>`;
    $$("[data-c]", c).forEach((b) => (b.onclick = async (e) => {
      e.stopPropagation(); const a = b.dataset.c;
      if (a === "remove") { S.cover = null; drawCover(); touch(); return; }
      if (a === "alt") { const v = prompt("Describe the cover image", (S.cover && S.cover.alt) || ""); if (v != null && S.cover) { S.cover.alt = v.trim(); touch(); } return; }
      const f = (await Up.pick("image/*"))[0]; if (f) setCover(f);
    }));
    const img = $("img", c); if (img) img.onclick = (e) => { const r = img.getBoundingClientRect(); S.cover.fx = Math.round(((e.clientX - r.left) / r.width) * 100); S.cover.fy = Math.round(((e.clientY - r.top) / r.height) * 100); drawCover(); touch(); };
  };
  async function setCover(f) { const c = q(".pj-cover"); c.classList.add("busy"); try { const r = await Up.image(f); S.cover = { src: r.url, fx: 50, fy: 50, alt: (S.cover && S.cover.alt) || "" }; drawCover(); touch(true); } catch (e) { toast(e.message); } c.classList.remove("busy"); }
  const cv = q(".pj-cover");
  cv.addEventListener("dragover", (e) => { e.preventDefault(); cv.classList.add("over"); }); cv.addEventListener("dragleave", () => cv.classList.remove("over"));
  cv.addEventListener("drop", (e) => { e.preventDefault(); cv.classList.remove("over"); const f = e.dataTransfer.files[0]; if (f) setCover(f); });
  drawCover();
  ed = await makeEditor(host, { blocks: S.blocks, onChange: () => touch(), onStatus: ({ uploading }) => { if (uploading) setStatus("Uploading…"); }, placeholder: "Tell the story of the project: type “/” to add images, galleries, video and more" });
  if (isNew) title.focus(); updBtn();

  /* settings drawer */
  const side = q(".jed-side");
  function drawSide() {
    const sT = S.seo.title || title.value || "Project title", sD = S.seo.desc || exc.value || "Your summary shows here.";
    side.innerHTML = `<div class="jed-sh"><b>Project settings</b><button data-a="closeside" aria-label="Close settings">${I("x", 16)}</button></div>
      <label class="ow-f">Visibility<select data-f="status"><option value="draft"${S.status === "draft" ? " selected" : ""}>Draft (only you)</option><option value="published"${S.status === "published" ? " selected" : ""}>Published</option><option value="unlisted"${S.status === "unlisted" ? " selected" : ""}>Unlisted (anyone with the link)</option></select></label>
      <label class="ow-app"><input type="checkbox" data-f="featured" ${S.featured ? "checked" : ""}><span>Feature this project (shown first)</span></label>
      <h3>About the project</h3>
      <label class="ow-f">Creative field<input data-f="field" list="pjFields" maxlength="60" value="${esc(S.field)}" placeholder="Branding"><datalist id="pjFields">${FIELDS.map((f) => `<option value="${esc(f)}">`).join("")}</datalist></label>
      <div class="pj-two"><label class="ow-f">Year<input data-f="year" maxlength="10" value="${esc(S.year)}"></label><label class="ow-f">Colour<select data-f="color">${["c1", "c2", "c3", "c4", "c5", "c6"].map((c) => `<option value="${c}"${S.color === c ? " selected" : ""}>${c.replace("c", "Tone ")}</option>`).join("")}</select></label></div>
      <label class="ow-f">Client<input data-f="client" maxlength="80" value="${esc(S.client)}" placeholder="Who it was for"></label>
      <label class="ow-f">Your role<input data-f="role" maxlength="80" value="${esc(S.role)}" placeholder="Brand designer"></label>
      <div class="ow-f">Tags <small>Help people find it</small><div data-chips="tags"></div></div>
      <div class="ow-f">Tools used<div data-chips="tools"></div></div>
      <h3>Links</h3>
      <label class="ow-f">Main link <small>Live site, Behance, App Store…</small><input data-f="link" maxlength="300" value="${esc(S.link)}" placeholder="https://…" inputmode="url"></label>
      <div class="pj-rows" data-rows="links"></div><button class="rb-mini" data-a="addlink">+ Add another link</button>
      <h3>Credits</h3><div class="pj-rows" data-rows="credits"></div><button class="rb-mini" data-a="addcredit">+ Add a person</button>
      <label class="ow-f">Licence<select data-f="license">${Object.entries(LICENSES).map(([k, v]) => `<option value="${k}"${S.license === k ? " selected" : ""}>${v}</option>`).join("")}</select></label>
      <h3>Address and search</h3>
      <label class="ow-f">Address <small>rohankumar.pro/projects/<b>${esc(S.slug || "…")}</b></small><input data-f="slug" maxlength="80" value="${esc(S.slug)}"></label>
      <label class="ow-f">Title for Google <small data-cnt="t">${sT.length}/60</small><input data-f="seo.title" maxlength="70" value="${esc(S.seo.title)}" placeholder="${esc(title.value || "Same as the title")}"></label>
      <label class="ow-f">Description for Google <small data-cnt="d">${sD.length}/160</small><textarea data-f="seo.desc" rows="3" maxlength="200" placeholder="Same as the summary">${esc(S.seo.desc)}</textarea></label>
      <div class="serp"><small>rohankumar.pro / projects / ${esc(S.slug || "")}</small><b>${esc(sT.slice(0, 60))}</b><span>${esc(sD.slice(0, 160))}</span></div>
      <div class="ed-ctl"><button data-a="dup">Duplicate</button><button class="ed-del" data-a="del">Delete project</button></div>`;
    chips($("[data-chips=tags]", side), S.tags, { placeholder: "Add a tag", max: 12, suggestions: [...new Set(PR.list.flatMap((p) => p.tags || []))], onChange: () => touch() });
    chips($("[data-chips=tools]", side), S.tools, { placeholder: "Add a tool", max: 20, suggestions: TOOLS, onChange: () => touch() });
    const rows = (key, blank, fields) => {
      const box = $(`[data-rows=${key}]`, side); box.textContent = "";
      S[key].forEach((it, i) => box.append(h("div", { class: "pj-row" }, fields.map(([k, ph]) => h("input", { value: it[k] || "", placeholder: ph, "aria-label": ph, maxlength: "300", oninput: (e) => { it[k] = e.target.value; touch(); } })), h("button", { class: "rb-mini rb-x", "aria-label": "Remove", onclick: () => { S[key].splice(i, 1); rows(key, blank, fields); touch(); }, html: I("x", 14), "aria-label": "Remove" }))));
    };
    rows("links", { label: "", url: "" }, [["label", "Label"], ["url", "https://…"]]); rows("credits", { name: "", role: "", url: "" }, [["name", "Name"], ["role", "Role"], ["url", "Link (optional)"]]);
    $$("[data-f]", side).forEach((el) => {
      const ev = el.tagName === "SELECT" || el.type === "checkbox" ? "change" : "input";
      el.addEventListener(ev, () => {
        const k = el.dataset.f; const v = el.type === "checkbox" ? el.checked : el.value;
        if (k.startsWith("seo.")) S.seo[k.slice(4)] = v.trim(); else if (k === "slug") { slugTouched = true; S.slug = slugify(v) || ""; const b = $("small b", el.closest("label")); if (b) b.textContent = S.slug || "…"; } else S[k] = typeof v === "string" ? v.trim() : v;
        if (k === "status") { updBtn(); touch(true); drawSide(); return; }
        const t = S.seo.title || title.value || "", d = S.seo.desc || exc.value || "";
        $("[data-cnt=t]", side).textContent = t.length + "/60"; $("[data-cnt=d]", side).textContent = d.length + "/160";
        const sp = $(".serp", side); sp.querySelector("b").textContent = t.slice(0, 60); sp.querySelector("span").textContent = d.slice(0, 160); sp.querySelector("small").textContent = "rohankumar.pro / projects / " + (S.slug || "");
        touch();
      });
    });
  }
  body.onclick = async (e) => {
    const bk = e.target.closest(".back"); if (bk) { await finish(); return; }
    const a = e.target.closest("[data-a]")?.dataset.a; if (!a) return;
    if (a === "settings") { side.hidden = !side.hidden; if (!side.hidden) drawSide(); }
    if (a === "closeside") side.hidden = true;
    if (a === "addlink") { S.links.push({ label: "", url: "" }); drawSide(); }
    if (a === "addcredit") { S.credits.push({ name: "", role: "", url: "" }); drawSide(); }
    if (a === "publish") {
      if (S.status !== "published") {
        if (!title.value.trim()) { toast("Add a title first."); title.focus(); return; }
        const miss = []; if (!(S.cover && S.cover.src)) miss.push("a cover image"); if (!exc.value.trim()) miss.push("a summary"); if (!S.field) miss.push("a creative field"); if (!S.tags.length) miss.push("tags");
        if (miss.length && !(await confirmBox("Publish without " + miss.join(", ") + "? They help people and search engines find your work.", "Publish anyway", false))) return;
        S.status = "published"; toast("Published. It now has its own page.");
      } else { if (!(await confirmBox("Unpublish this project? It becomes a draft only you can see.", "Unpublish", false))) return; S.status = "draft"; }
      updBtn(); touch(true); if (!side.hidden) drawSide();
    }
    if (a === "preview") { preview = !preview; q("[data-a=preview]").textContent = preview ? "Edit" : "Preview"; const pv = q(".jed-prev"); host.hidden = preview; pv.hidden = !preview; title.readOnly = exc.readOnly = preview; if (preview) showBlocks(pv, ed.getBlocks(), { hBase: 2 }); }
    if (a === "dup") { await save(); ed.destroy(); body.onclick = null; w.classList.toggle("max", wasMax); await dup(S, body); }
    if (a === "del") { if (await confirmBox("Delete this project for good?")) { clearTimeout(saveT); ed.destroy(); w.classList.toggle("max", wasMax); body.onclick = null; body.classList.remove("jr-editing", "pj-editing"); if (created) { const r = await api("/api/projects?id=" + encodeURIComponent(S.id), { method: "DELETE" }); if (r.ok) PR.list = r.data.projects; } grid(body); R.item(body, "", "", "push"); } }
  };
  async function finish() {
    clearTimeout(saveT); await save(); ed && ed.flush(); ed && ed.destroy(); body.onclick = null; body.classList.remove("jr-editing", "pj-editing"); w.classList.toggle("max", wasMax);
    PR.cache[S.id] = undefined; await loadList(true);
    if (created && S.slug && PR.list.some((p) => p.slug === S.slug)) detail(body, S.slug); else grid(body);
  }
  R.item(body, "", "Editing — Projects", "replace");
}
