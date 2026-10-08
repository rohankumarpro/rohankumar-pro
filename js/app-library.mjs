// Library: the books you're reading, want to read and have finished, with their covers, how far you are, and a
// page of notes for each (the same editor as everywhere, with "/" for blocks). Lives in the Library database of
// the Workspace (role "reading"). Owner only.
import { h, esc, api, toast, isAdmin, mobile, Up, confirmBox } from "/js/lib.mjs";
import { R } from "/js/os-ext.mjs";
import { WS, DB, fmtDate, today, rid } from "/js/ws-core.mjs";
import { WI, popover, closePop, choose } from "/js/ws-db.mjs";
import { openDoc } from "/js/ws-page.mjs";

for (const css of ["/css/planner.css", "/css/studio.css"]) if (!document.querySelector(`link[href="${css}"]`)) document.head.append(h("link", { rel: "stylesheet", href: css }));
const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const NEED = [["Author", "text"], ["Progress", "number", { fmt: "percent" }], ["Pages", "number"], ["Started", "date"], ["Finished", "date"], ["Rating", "select", { opts: ["5", "4", "3", "2", "1"].map((n, i) => ({ id: rid(), name: n, color: ["green", "blue", "yellow", "orange", "red"][i] })) }]];
const big = (src) => String(src || "").replace(/^http:/, "https:").replace(/&edge=curl/, "").replace(/zoom=\d/, "zoom=1");

// find a book: Google Books first (better covers), Open Library if that finds nothing
async function findBooks(q) {
  const out = [];
  try {
    const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=10&printType=books`).then((x) => x.json());
    for (const it of r.items || []) { const v = it.volumeInfo || {}; out.push({ t: v.title + (v.subtitle ? ": " + v.subtitle : ""), a: (v.authors || []).join(", "), y: (v.publishedDate || "").slice(0, 4), pages: v.pageCount || null, cover: big(v.imageLinks && (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail)), link: v.infoLink || "" }); }
  } catch {}
  if (out.length < 3) {
    try {
      const r = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8&fields=title,author_name,first_publish_year,number_of_pages_median,cover_i,key`).then((x) => x.json());
      for (const d of r.docs || []) out.push({ t: d.title, a: (d.author_name || []).join(", "), y: String(d.first_publish_year || ""), pages: d.number_of_pages_median || null, cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : "", link: d.key ? "https://openlibrary.org" + d.key : "" });
    } catch {}
  }
  return out.filter((b) => b.t).slice(0, 12);
}

export async function libraryApp(body, slug0) {
  if (!isAdmin()) { body.innerHTML = '<p class="hint" style="padding:24px">The Library is private. Sign in as the owner.</p>'; return; }
  body.classList.add("lb2-body");
  body.innerHTML = '<div class="lb2"><div class="wd-load"><span class="rb-spin"></span></div></div>';
  const meta = await WS.ensure("reading"), root = body.firstElementChild;
  if (!meta) { root.innerHTML = '<p class="hint">Could not open the Library. Check your connection.</p>'; return; }
  const id = meta.id, S = { tab: ls.get("lbTab", "reading"), book: null, doc: null, q: "" };
  const doc = () => DB.get(id);
  // older Library databases get the fields the shelf uses
  { const ops = []; for (const [n, t, x] of NEED) if (!doc().props.some((p) => p.name === n)) ops.push({ op: "prop", prop: { id: rid(), name: n, type: t, ...(x || {}) } }); if (ops.length) DB.ops(id, ops); }
  const P = (n) => doc().props.find((p) => p.name === n);
  const st = () => doc().props.find((p) => p.type === "status");
  const stName = (r) => (st() && (st().opts || []).find((o) => o.id === r.v[st().id])?.name) || "To read";
  const stId = (name) => st() && (st().opts || []).find((o) => o.name === name)?.id;
  const val = (r, n) => { const p = P(n); return p ? r.v[p.id] : undefined; };
  const rating = (r) => { const p = P("Rating"); const o = p && (p.opts || []).find((x) => x.id === r.v[p.id]); return o ? +o.name : 0; };
  const book = (r) => ({ r, t: r.title || "Untitled", a: val(r, "Author") || "", st: stName(r), pct: Math.max(0, Math.min(100, +val(r, "Progress") || 0)), pages: val(r, "Pages"), cover: r.cover && r.cover.src, rating: rating(r), fin: val(r, "Finished"), start: val(r, "Started") });
  const coverHtml = (b, cls = "") => b.cover ? `<img class="lb2-img ${cls}" src="${esc(b.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'lb2-ph ${cls}',style:'--h:${[...b.t].reduce((a, c) => a + c.charCodeAt(0), 0) % 360}',innerHTML:this.dataset.ph}))" data-ph="${esc(`<b>${esc(b.t)}</b><small>${esc(b.a)}</small>`)}">` : `<span class="lb2-ph ${cls}" style="--h:${[...b.t].reduce((a, c) => a + c.charCodeAt(0), 0) % 360}"><b>${esc(b.t)}</b><small>${esc(b.a)}</small></span>`;

  function shelf() {
    if (S.book) return;
    const all = Object.values(doc().rows).map(book), year = String(new Date().getFullYear());
    const reading = all.filter((b) => b.st === "Reading"), toRead = all.filter((b) => b.st === "To read"), done = all.filter((b) => b.st === "Finished").sort((a, b) => String(b.fin || "").localeCompare(String(a.fin || "")));
    const list = S.tab === "reading" ? reading : S.tab === "toread" ? toRead : S.tab === "finished" ? done : all;
    const thisYear = done.filter((b) => String(b.fin || "").startsWith(year)).length;
    root.innerHTML = `
      <header class="lb2-h"><div><h2>Library</h2><p>${reading.length} reading · ${toRead.length} to read · ${thisYear} finished in ${year}</p></div>
        <div class="lb2-act"><button class="pl-btn" data-a="db" title="Open as a database">${WI("db", 16)}<span>Table</span></button><button class="pl-btn pri" data-a="add">${WI("plus", 16)}<span>Add a book</span></button></div></header>
      <div class="pl-seg lb2-tabs">${[["reading", "Reading", reading.length], ["toread", "To read", toRead.length], ["finished", "Finished", done.length], ["all", "All", all.length]].map(([k, t, n]) => `<button data-tab="${k}" class="${S.tab === k ? "on" : ""}">${t}${n ? ` <em>${n}</em>` : ""}</button>`).join("")}</div>
      ${S.tab === "reading" && reading.length ? `<div class="lb2-now">${reading.map((b) => `<button class="lb2-cur" data-book="${b.r.id}"><span class="lb2-cv">${coverHtml(b)}</span><span class="lb2-ci"><b>${esc(b.t)}</b><small>${esc(b.a)}</small><span class="lb2-bar"><i style="width:${b.pct}%"></i></span><em>${b.pct}%${b.pages ? ` · page ${Math.round((b.pct / 100) * b.pages)} of ${b.pages}` : ""}</em></span></button>`).join("")}</div>` : ""}
      ${S.tab !== "reading" || !reading.length ? (list.length ? `<div class="lb2-shelf">${list.map((b) => `<button class="lb2-bk" data-book="${b.r.id}" title="${esc(b.t)}"><span class="lb2-cv">${coverHtml(b)}${b.st === "Reading" ? `<span class="lb2-pc">${b.pct}%</span>` : ""}</span><b>${esc(b.t)}</b><small>${esc(b.a)}</small>${b.rating ? `<span class="lb2-st">${"★".repeat(b.rating)}<i>${"★".repeat(5 - b.rating)}</i></span>` : ""}</button>`).join("")}</div>` : `<div class="lb2-empty">${WI("bookmark", 28)}<b>${S.tab === "reading" ? "Not reading anything right now" : S.tab === "toread" ? "Nothing waiting to be read" : S.tab === "finished" ? "No finished books yet" : "Your library is empty"}</b><p>Add a book and its cover comes with it.</p><button class="pl-btn pri" data-a="add2">${WI("plus", 16)}Add a book</button></div>`) : ""}`;
    root.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { S.tab = b.dataset.tab; ls.set("lbTab", S.tab); shelf(); }));
    root.querySelectorAll("[data-book]").forEach((b) => (b.onclick = () => openBook(b.dataset.book)));
    root.querySelectorAll('[data-a="add"],[data-a="add2"]').forEach((b) => (b.onclick = () => addBook(b)));
    root.querySelector('[data-a="db"]').onclick = () => { window.openApp("boards"); setTimeout(() => R.apply("/boards/db/" + id), 60); };
  }

  /* ----- adding a book ----- */
  function addBook(anchor) {
    const box = h("div", { class: "wd-menu lb2-add" });
    box.innerHTML = `<div class="wd-mh">Add a book</div><input class="wd-in" placeholder="Title, author or ISBN" aria-label="Find a book"><div class="lb2-res"><p class="pl-note">Type to search. Covers come with the book.</p></div>`;
    const q = box.querySelector("input"), res = box.querySelector(".lb2-res");
    let t = 0, n = 0;
    q.oninput = () => { clearTimeout(t); const s = q.value.trim(); if (s.length < 2) { res.innerHTML = '<p class="pl-note">Type to search. Covers come with the book.</p>'; return; } t = setTimeout(async () => { const my = ++n; res.innerHTML = '<p class="pl-note">Looking…</p>'; const list = await findBooks(s); if (my !== n) return; res.innerHTML = list.map((b, i) => `<button class="lb2-r" data-i="${i}">${b.cover ? `<img src="${esc(b.cover)}" alt="" referrerpolicy="no-referrer">` : `<span class="lb2-rph">${WI("bookmark", 16)}</span>`}<span><b>${esc(b.t)}</b><small>${esc([b.a, b.y].filter(Boolean).join(" · "))}</small></span></button>`).join("") + `<button class="wd-mi" data-own>${WI("plus", 16)}<span class="t">Add “${esc(s)}” by hand</span></button>`; res.querySelectorAll("[data-i]").forEach((x) => (x.onclick = () => pick(list[+x.dataset.i]))); res.querySelector("[data-own]").onclick = () => pick({ t: s, a: "", cover: "" }); }, 350); };
    const pick = (b) => {
      closePop();
      const status = S.tab === "toread" ? "To read" : S.tab === "finished" ? "Finished" : "Reading";
      const v = { [P("Author").id]: b.a || null, [P("Pages").id]: b.pages || null, [st().id]: stId(status), [P("Progress").id]: status === "Finished" ? 100 : 0 };
      if (status === "Reading") v[P("Started").id] = today(); if (status === "Finished") v[P("Finished").id] = today();
      if (b.link && P("Link")) v[P("Link").id] = b.link;
      const row = DB.newRow(id, { title: String(b.t).slice(0, 300), v, order: Date.now(), ...(b.cover ? { cover: { src: b.cover, y: 50 } } : {}) });
      toast(`${b.t} added`); setTimeout(() => openBook(row.id), 120);
    };
    popover(anchor, box, { w: mobile() ? innerWidth - 24 : 420 }); setTimeout(() => q.focus(), 30);
  }

  /* ----- one book: its cover, how far you are, and your notes ----- */
  function openBook(rowId) {
    S.book = rowId; root.innerHTML = '<div class="lb2-book"></div>';
    S.doc = openDoc(root.firstElementChild, { kind: "row", db: id, id: rowId }, {
      noProps: true, edLabel: "Your notes",
      back: () => closeBook(), home: () => closeBook(), openDb: () => closeBook(),
      head: (m) => { const b = book(m.id ? m : doc().rows[rowId] || m); return `<div class="lb2-bh"><button class="lb2-bcv" data-cv title="Change the cover">${coverHtml(b, "lg")}</button><div class="lb2-bi">
        <input class="lb2-au" data-f="Author" value="${esc(b.a)}" placeholder="Author" aria-label="Author">
        <div class="pl-seg lb2-ss">${["To read", "Reading", "Finished"].map((s) => `<button data-st="${s}" class="${b.st === s ? "on" : ""}">${s}</button>`).join("")}</div>
        <label class="lb2-pr"><span>Progress</span><input type="range" min="0" max="100" step="1" value="${b.pct}" data-pct aria-label="Progress"><b>${b.pct}%</b></label>
        <div class="lb2-meta"><label>Pages<input type="number" min="0" data-f="Pages" value="${esc(b.pages || "")}"></label><label>Started<input type="date" data-f="Started" value="${esc(String(b.start || "").slice(0, 10))}"></label><label>Finished<input type="date" data-f="Finished" value="${esc(String(b.fin || "").slice(0, 10))}"></label></div>
        <div class="lb2-rate" role="radiogroup" aria-label="Rating">${[1, 2, 3, 4, 5].map((n) => `<button data-rate="${n}" class="${n <= b.rating ? "on" : ""}" aria-label="${n} star${n > 1 ? "s" : ""}">★</button>`).join("")}</div></div></div>`; },
      wireHead: (r, m) => wireBook(r, rowId),
      onRowChange: (r, m) => { const b = book(doc().rows[rowId] || m); const pb = r.querySelector(".lb2-pr b"); if (pb) pb.textContent = b.pct + "%"; },
    });
    R.item(body, "book/" + rowId, (doc().rows[rowId]?.title || "Book") + " — Library", "push");
  }
  function wireBook(r, rowId) {
    const row = () => doc().rows[rowId], set = (v) => DB.ops(id, [{ op: "row", row: { id: rowId, v } }]);
    r.querySelectorAll("[data-st]").forEach((b) => (b.onclick = () => { const s = b.dataset.st, v = { [st().id]: stId(s) }; if (s === "Reading" && !val(row(), "Started")) v[P("Started").id] = today(); if (s === "Finished") { v[P("Finished").id] = val(row(), "Finished") || today(); v[P("Progress").id] = 100; } set(v); r.querySelectorAll("[data-st]").forEach((x) => x.classList.toggle("on", x === b)); if (s === "Finished") { const rg = r.querySelector("[data-pct]"); rg.value = 100; r.querySelector(".lb2-pr b").textContent = "100%"; toast("Finished. Well read!"); } }));
    const rg = r.querySelector("[data-pct]"); rg.oninput = () => { r.querySelector(".lb2-pr b").textContent = rg.value + "%"; }; rg.onchange = () => { const v = { [P("Progress").id]: +rg.value }; if (+rg.value > 0 && stName(row()) === "To read") { v[st().id] = stId("Reading"); v[P("Started").id] = today(); } set(v); };
    r.querySelectorAll("[data-f]").forEach((inp) => (inp.onchange = () => { const p = P(inp.dataset.f); set({ [p.id]: p.type === "number" ? (inp.value === "" ? null : +inp.value) : inp.value || null }); }));
    r.querySelectorAll("[data-rate]").forEach((b) => (b.onclick = () => { const n = +b.dataset.rate, p = P("Rating"), cur = rating(row()), o = (p.opts || []).find((x) => +x.name === (cur === n ? 0 : n)); set({ [p.id]: o ? o.id : null }); r.querySelectorAll("[data-rate]").forEach((x) => x.classList.toggle("on", +x.dataset.rate <= (cur === n ? 0 : n))); }));
    r.querySelector("[data-cv]").onclick = (e) => coverMenu(e.currentTarget, rowId);
  }
  function coverMenu(anchor, rowId) {
    const r0 = doc().rows[rowId];
    choose(anchor, [
      { t: "Find a cover online", i: "search", run: async () => { const list = await findBooks([r0.title, val(r0, "Author")].filter(Boolean).join(" ")); const withCv = list.filter((b) => b.cover); if (!withCv.length) return toast("No covers found. Upload one instead."); const box = h("div", { class: "wd-menu" }); box.innerHTML = `<div class="wd-mh">Pick a cover</div><div class="lb2-covers">${withCv.map((b, i) => `<button data-i="${i}" title="${esc(b.t)}"><img src="${esc(b.cover)}" alt="" referrerpolicy="no-referrer"></button>`).join("")}</div>`; box.querySelectorAll("[data-i]").forEach((x) => (x.onclick = () => { closePop(); DB.ops(id, [{ op: "row", row: { id: rowId, cover: { src: withCv[+x.dataset.i].cover, y: 50 } } }]); setTimeout(() => openBook(rowId), 80); })); popover(anchor, box, { w: 360 }); } },
      { t: "Upload a picture", i: "upload", run: () => { const f = h("input", { type: "file", accept: "image/*" }); f.onchange = async () => { const file = f.files[0]; if (!file) return; toast("Uploading…"); try { const u = await Up.image(file, { max: 1200 }); DB.ops(id, [{ op: "row", row: { id: rowId, cover: { src: u.url, y: 50 } } }]); setTimeout(() => openBook(rowId), 80); } catch (e) { toast(e.message || "Could not upload"); } }; f.click(); } },
      ...(r0.cover ? [{ t: "Remove the cover", i: "x", run: () => { DB.ops(id, [{ op: "row", row: { id: rowId, cover: null } }]); setTimeout(() => openBook(rowId), 80); } }] : []),
      "-", { t: "Remove this book", i: "trash", danger: true, run: async () => { if (await confirmBox("Remove this book and its notes from the Library?", "Remove")) { DB.ops(id, [{ op: "delrow", id: rowId }]); closeBook(); } } },
    ], { w: 240 });
  }
  async function closeBook() { if (S.doc) { await S.doc.flush(); S.doc.destroy(); S.doc = null; } S.book = null; shelf(); R.item(body, "", "Library", "push"); }

  const off = DB.on(id, () => { if (body.isConnected && !S.book) shelf(); });
  body.__flush = async () => { off(); if (S.doc) { await S.doc.flush(); S.doc.destroy(); } DB.flush(id); };
  R.handlers.library = (b, slug) => { if (slug && slug.startsWith("book/")) openBook(slug.slice(5)); else if (S.book) closeBook(); };
  const slug = slug0 || ""; if (slug && slug.startsWith("book/") && doc().rows[slug.slice(5)]) openBook(slug.slice(5)); else shelf();
}
