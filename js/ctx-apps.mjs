// Right-click items that belong to one app. Each entry gets what was clicked and returns a list of [label, action, "danger"?].
// The shell (index.html) adds text, link and picture actions before these, and the window actions after them.
// Apps with private state (Docs, Notes, Projects, YouTube, Music) register their own items from inside their module.
const reg = (id, fn) => window.registerCtx(id, fn);
const click = (root, sel) => () => { const b = root.querySelector(sel); if (b) b.click(); };
const owner = () => !!(window.LIVE && LIVE.admin);
const has = (root, sel) => !!root.querySelector(sel);
const copy = async (t, m) => { try { await navigator.clipboard.writeText(t); window.toast(m || "Copied"); } catch { window.toast("Could not copy"); } };
const first = (...l) => l.filter(Boolean);

reg("about", (el, e, w) => first(
  ...(owner() && has(w, ".ed-btn") ? [["Edit About me", click(w, ".ed-btn")]] : []),
  ["Copy email address", () => copy(P.email, "Email copied")],
  ["Book a call", () => openApp("book")],
  ["Open contact", () => openApp("contact")]));

reg("contact", (el, e, w) => first(
  ["Copy email address", () => copy(P.email, "Email copied")],
  ["Book a call", () => openApp("book")],
  ...(owner() && has(w, ".ed-btn") ? [null, ["Edit contact", click(w, ".ed-btn")]] : [])));

reg("resume", (el, e, w) => first(
  has(w, ".rs-act a[download]") ? ["Download the PDF", click(w, ".rs-act a[download]")] : ["Print or save as PDF", click(w, ".rs-act .btn")],
  ...(owner() ? [null, ...[...w.querySelectorAll(".rs-act button")].filter((b) => /edit page/i.test(b.textContent)).map((b) => ["Edit the resume", () => b.click()])] : [])));

reg("timeline", (el, e, w) => first(
  ...["all", "now", "next", "done"].filter((k) => has(w, `[data-f="${k}"]`)).map((k) => [{ all: "Show everything", now: "Show what I'm working on", next: "Show what's next", done: "Show what's done" }[k], click(w, `[data-f="${k}"]`)]),
  ...(owner() && has(w, ".tl-edit") ? [null, ["Edit the timeline", click(w, ".tl-edit")]] : [])));

reg("journal", (el, e, w) => {
  const row = el.closest("a[data-slug]"), items = [];
  if (row) {
    const url = location.origin + "/journal/" + row.dataset.slug;
    items.push(["Read this post", () => row.click()], ["Copy link to the post", () => copy(url, "Link copied")], ["Share", () => (window.share ? window.share(url, row.textContent.trim().slice(0, 60)) : copy(url))]);
  } else if (has(w, ".jr-art")) {
    items.push(["Copy link to this post", () => copy(location.href, "Link copied")]);
    if (has(w, ".j-toc")) items.push(["Contents", click(w, ".j-toc")]);
    items.push(["Back to all posts", click(w, ".back")]);
    if (owner() && has(w, ".j-edit")) items.push(null, ["Edit this post", click(w, ".j-edit")]);
  } else if (owner() && has(w, ".j-new")) items.push(["New post", click(w, ".j-new")]);
  if (row) items.replace = true;
  return items;
});

reg("links", (el, e, w) => {
  const it = el.closest(".hb-it[data-id]"), items = [];
  if (it && it.dataset.app) items.push(["Open " + (it.textContent.trim().split("\n")[0] || "app"), () => it.click()]);
  if (it && it.dataset.copy) items.push(["Copy this text", () => copy(it.dataset.copy)]);
  items.push(["Copy link to my Links page", () => copy(location.origin + "/links", "Link copied")], ["Open the Links page on its own", () => window.open("/links", "_blank", "noopener")]);
  if (owner() && has(w, ".hb-edit")) items.push(null, ["Edit this page", click(w, ".hb-edit")]);
  return items;
});

reg("photos", (el, e, w) => {
  const pic = el.closest(".pic[data-i]"), items = [];
  if (pic) {
    const i = +pic.dataset.i, p = (typeof PL === "function" ? PL() : [])[i], img = pic.querySelector("img");
    items.push(["Open photo", () => pic.click()]);
    if (img) items.push(["Download picture", () => { const a = document.createElement("a"); a.href = img.currentSrc || img.src; a.download = (p && p.caption ? p.caption : "photo").replace(/[^\w-]+/g, "-") + ".jpg"; a.click(); }]);
    if (owner() && p && p.id) {
      const url = img && (img.currentSrc || img.src);
      items.push(null, ["Use as my profile photo", () => { const s = SITE.s || (SITE.s = { hiddenApps: [] }); s.photo = url; siteSave(); applyText(); window.toast("Profile photo updated"); }],
        ["Delete this photo", async () => { if (!confirm("Delete this photo for good?")) return; const L = PL(), at = L.indexOf(p); if (at < 0) return; const [gone] = L.splice(at, 1); await phSave([gone.id]); phRefresh(); }, "danger"]);
    }
  } else if (owner() && has(w, ".ph-add input")) items.push(["Add photos", click(w, ".ph-add input")]);
  return items;
});

reg("guestbook", (el, e, w) => {
  const card = el.closest(".gbe"), items = [];
  if (card) {
    items.push(["Copy this note", () => copy(card.querySelector("p")?.textContent || "", "Note copied")]);
    if (owner()) {
      const act = (k, label, danger) => has(card, `[data-gm="${k}"]`) && items.push([label, click(card, `[data-gm="${k}"]`), danger]);
      items.push(null); act("approve", "Approve and publish"); act("hide", "Hide this note"); act("unpublish", "Unpublish"); act("delete", "Delete this note", "danger");
    }
  }
  return items;
});

reg("sketch", (el, e, w) => first(
  ["Undo the last stroke", click(w, ".sk-undo")],
  ["Save as a picture", () => { const c = w.querySelector(".sk-cv"); if (!c) return; const o = document.createElement("canvas"); o.width = c.width; o.height = c.height; const x = o.getContext("2d"); x.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim() || "#fff"; x.fillRect(0, 0, o.width, o.height); x.drawImage(c, 0, 0); const a = document.createElement("a"); a.href = o.toDataURL("image/png"); a.download = "sketch.png"; a.click(); }],
  null, ["Clear the canvas", click(w, ".sk-clear"), "danger"]));

reg("calculator", (el, e, w) => first(
  ["Copy the result", () => copy((w.querySelector(".calc-ex")?.textContent || "").replace(/,/g, ""), "Copied")],
  ["Clear", click(w, '.ck[data-k="AC"]')]));

reg("focus", (el, e, w) => first(
  [(w.querySelector(".ft-go")?.textContent || "Start") + " the timer", click(w, ".ft-go")],
  ["Reset", click(w, ".ft-reset")],
  ["Set the time", click(w, ".ft-edit")]));

reg("palette", (el, e, w) => {
  const sw = el.closest(".sw"), items = [];
  if (sw) { const hex = (sw.textContent.match(/#[0-9a-fA-F]{6}/) || [])[0]; if (hex) items.push(["Copy " + hex.toUpperCase(), () => copy(hex.toUpperCase(), "Colour copied")]); }
  items.push(["Make a new palette", click(w, ".pal-gen")], ["Copy the whole palette", click(w, ".pal-all")]);
  return items;
});

reg("documents", (el, e, w) => {
  const card = el.closest(".dc-card"), items = [];
  if (card) {
    const qr = card.querySelector(".dc-qr");
    if (qr) items.push(["Enlarge the QR code", () => qr.click()]);
    const link = card.querySelector("a[href]"); if (link) items.push(["Copy this link", () => copy(link.href)]);
  }
  if (owner() && has(w, ".ed-btn")) items.push(null, ["Edit the wallet", click(w, ".ed-btn")]);
  return items;
});

reg("services", (el, e, w) => first(["Book a call", () => openApp("book")], ["Copy email address", () => copy(P.email, "Email copied")]));
reg("book", () => first(["Open booking in a new tab", () => window.open(P.booking, "_blank", "noopener")], ["Copy booking link", () => copy(P.booking)]));
