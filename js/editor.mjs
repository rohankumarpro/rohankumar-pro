// A block editor in the style of Notion, for the Journal, Projects, Notes and About.
//   const ed = createEditor(hostElement, { blocks, onChange, upload, library, placeholder, onError })
// The page is the source of truth: blocks are read back from it when something changes.
import { cleanInline, embedInfo, mdToBlocks, rid, stripTags, safeUrl, COLORS, CALLOUT_TONES, esc, isTexty } from "/shared/blocks.mjs";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === "class") e.className = v; else if (k === "html") e.innerHTML = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
}
const isTouch = () => matchMedia("(pointer:coarse)").matches || innerWidth <= 760;
const TEXT_TYPES = ["p", "h1", "h2", "h3", "quote", "callout", "ul", "ol", "todo", "toggle"];
const LIST_TYPES = ["ul", "ol", "todo"];
const ZW = /[\u200B\uFEFF]/g;
const isZW = (c) => c === "\u200B" || c === "\uFEFF";

/* what the "/" menu offers */
const ITEMS = [
  { id: "p", g: "Basic", label: "Text", desc: "Just start writing", ico: "¶", kw: "text paragraph plain" },
  { id: "h1", g: "Basic", label: "Heading 1", desc: "Big section heading", ico: "H1", kw: "h1 heading title large" },
  { id: "h2", g: "Basic", label: "Heading 2", desc: "Medium section heading", ico: "H2", kw: "h2 heading subtitle" },
  { id: "h3", g: "Basic", label: "Heading 3", desc: "Small section heading", ico: "H3", kw: "h3 heading small" },
  { id: "ul", g: "Basic", label: "Bulleted list", desc: "A simple list", ico: "•", kw: "bullet list ul unordered" },
  { id: "ol", g: "Basic", label: "Numbered list", desc: "A list with numbers", ico: "1.", kw: "number list ol ordered" },
  { id: "todo", g: "Basic", label: "To-do list", desc: "Track tasks with checkboxes", ico: "☑", kw: "todo task checkbox check" },
  { id: "toggle", g: "Basic", label: "Toggle", desc: "Hide and show content inside", ico: "▸", kw: "toggle collapse accordion details" },
  { id: "quote", g: "Basic", label: "Quote", desc: "Capture a quote", ico: "❝", kw: "quote blockquote pull" },
  { id: "callout", g: "Basic", label: "Callout", desc: "Make writing stand out", ico: "💡", kw: "callout note tip highlight box" },
  { id: "divider", g: "Basic", label: "Divider", desc: "Visually divide sections", ico: "—", kw: "divider line rule hr separator" },
  { id: "code", g: "Basic", label: "Code", desc: "A block of code", ico: "</>", kw: "code snippet pre" },
  { id: "image", g: "Media", label: "Image", desc: "Upload or link a picture", ico: "🖼", kw: "image picture photo upload cover" },
  { id: "gallery", g: "Media", label: "Gallery", desc: "Grid, masonry or carousel", ico: "▦", kw: "gallery grid carousel slider images masonry" },
  { id: "embed", g: "Media", label: "Video or embed", desc: "YouTube, Vimeo, Figma, Loom…", ico: "▶", kw: "video embed youtube vimeo figma loom spotify soundcloud codepen instagram behance" },
  { id: "file", g: "Media", label: "File", desc: "A PDF people can download", ico: "📎", kw: "file pdf download attachment" },
  { id: "bookmark", g: "Media", label: "Web bookmark", desc: "A card that links to a page", ico: "🔖", kw: "bookmark link card url" },
  { id: "cols2", g: "Layout", label: "2 columns", desc: "Side by side", ico: "◫", kw: "columns two 2 layout side" },
  { id: "cols3", g: "Layout", label: "3 columns", desc: "Three across", ico: "▥", kw: "columns three 3 layout" },
  { id: "table", g: "Layout", label: "Table", desc: "Rows and columns", ico: "▦", kw: "table grid rows" },
  { id: "toc", g: "Layout", label: "Table of contents", desc: "Links to your headings", ico: "☰", kw: "toc contents outline headings" },
  { id: "button", g: "Layout", label: "Button", desc: "A call-to-action link", ico: "◉", kw: "button cta link action" },
];
const TURN = ["p", "h1", "h2", "h3", "ul", "ol", "todo", "toggle", "quote", "callout"];
const label = (t) => (ITEMS.find((i) => i.id === t) || {}).label || t;
const LANGS = ["", "html", "css", "js", "ts", "json", "python", "bash", "sql", "php", "go", "rust", "java", "c", "cpp", "swift", "md"];
const EMOJI = ["💡", "📌", "⚠️", "✅", "❗", "📞", "🎯", "✨", "🔥", "💬", "📝", "🚀", "❤️", "👀", "🧠", "🎨"];

export function createEditor(host, opts = {}) {
  const E = { hist: [], hi: -1, uploading: 0, sel: null, dirty: false, timers: {} };
  host.classList.add("rte");
  const root = h("div", { class: "rte-doc bk-doc" });
  const tail = h("div", { class: "rte-tail", contenteditable: "false", title: "Click to add a block" });
  host.append(root, tail);
  E.root = root;
  const ph = opts.placeholder || "Type “/” for blocks, or just start writing…";

  /* ---------- reading the page back into blocks ---------- */
  const htmlOf = (ed) => {
    const c = ed.cloneNode(true);
    $$(".rte-ui", c).forEach((n) => n.remove());
    let s = c.innerHTML.replace(ZW, "").replace(/<br\s*\/?>\s*$/i, "");
    if (/^\s*(<br\s*\/?>)?\s*$/i.test(s)) s = "";
    return cleanInline(s);
  };
  const edOf = (el) => $(":scope > .rb-body > .rb-row > .rb-e, :scope > .rb-body > .rb-e", el);
  function ser(el) {
    const t = el.dataset.t, b = { ...el.__b, id: el.dataset.id, t };
    delete b.uploading;
    if (TEXT_TYPES.includes(t)) b.h = htmlOf(edOf(el));
    if (t === "toggle") b.k = serList($(":scope > .rb-body > .rb-kids", el));
    if (t === "code") b.x = $("textarea", el).value;
    if (t === "image") { const c = $(".rb-cap", el); b.cap = c ? htmlOf(c) : ""; }
    if (t === "embed") { const c = $(".rb-cap", el); b.cap = c ? htmlOf(c) : ""; }
    if (t === "table") b.rows = $$("tr", el).map((tr) => $$("td,th", tr).map((c) => htmlOf(c)));
    if (t === "columns") b.cols = $$(":scope > .rb-body > .rb-cols > .rb-col", el).map(serList);
    return b;
  }
  const serList = (list) => (list ? [...list.children].filter((c) => c.classList.contains("rb")).map(ser) : []);
  const blocks = () => serList(root);

  /* ---------- building blocks ---------- */
  function mk(b) {
    const el = h("div", { class: "rb", "data-t": b.t, "data-id": /^[\w-]{3,16}$/.test(b.id || "") ? b.id : rid() });
    el.__b = { ...b }; delete el.__b.h; delete el.__b.k; delete el.__b.t; delete el.__b.id;
    el.style.setProperty("--d", b.d || 0);
    const side = h("div", { class: "rb-side rte-ui", contenteditable: "false" },
      h("button", { type: "button", class: "rb-plus", tabindex: "-1", title: "Add a block below", "aria-label": "Add a block below" }, "+"),
      h("button", { type: "button", class: "rb-grip", tabindex: "-1", title: "Drag to move, click for options", "aria-label": "Block options" }, "⋮⋮"));
    const body = h("div", { class: "rb-body" });
    el.append(side, body);
    build(el, body, b);
    return el;
  }
  const editable = (cls, html, phText) => {
    const e = h("div", { class: "rb-e " + (cls || ""), contenteditable: "true", spellcheck: "true", "data-ph": phText ?? "", role: "textbox", "aria-multiline": "true" });
    e.innerHTML = cleanInline(html || "");
    return e;
  };
  function build(el, body, b) {
    const t = b.t;
    if (TEXT_TYPES.includes(t)) {
      const phText = t === "p" ? ph : t === "h1" ? "Heading 1" : t === "h2" ? "Heading 2" : t === "h3" ? "Heading 3" : t === "quote" ? "Empty quote" : t === "callout" ? "Write a callout…" : t === "toggle" ? "Toggle title" : "List";
      const ed = editable("", b.h, phText);
      if (b.a) ed.dataset.a = b.a;
      const row = h("div", { class: "rb-row" });
      if (t === "ul" || t === "ol") row.append(h("span", { class: "rb-mk rte-ui", contenteditable: "false" }, t === "ul" ? "•" : "1."));
      if (t === "todo") row.append(h("button", { type: "button", class: "rb-cb rte-ui" + (b.c ? " on" : ""), contenteditable: "false", tabindex: "-1", "aria-label": "Done", "aria-pressed": b.c ? "true" : "false" }));
      if (t === "callout") row.append(h("button", { type: "button", class: "rb-ce rte-ui", contenteditable: "false", tabindex: "-1", title: "Change icon" }, b.e || "💡"));
      if (t === "toggle") row.append(h("button", { type: "button", class: "rb-tg rte-ui" + (b.open ? " open" : ""), contenteditable: "false", tabindex: "-1", "aria-label": "Open or close" }));
      row.append(ed);
      body.append(row);
      if (t === "callout") el.dataset.tone = b.tone || "gray";
      if (t === "toggle") {
        const kids = h("div", { class: "rb-kids rb-list" });
        (b.k && b.k.length ? b.k : []).forEach((k) => kids.append(mk(k)));
        if (!b.open) kids.hidden = true;
        body.append(kids);
        kids.append(h("button", { type: "button", class: "rb-addkid rte-ui", contenteditable: "false" }, "+ Add inside"));
      }
      return;
    }
    if (t === "divider") { body.append(h("hr", { class: "rb-hr", contenteditable: "false" })); el.tabIndex = -1; return; }
    if (t === "code") {
      const ta = h("textarea", { class: "rb-code-t", spellcheck: "false", rows: "3", placeholder: "Paste or type code", "aria-label": "Code" });
      ta.value = b.x || "";
      const sel = h("select", { class: "rb-lang rte-ui", "aria-label": "Language" }, LANGS.map((l) => h("option", { value: l }, l || "Plain text")));
      sel.value = b.lang || "";
      body.append(h("div", { class: "rb-codew" }, sel, ta));
      autosize(ta); return;
    }
    if (t === "image") return buildImage(el, body, b);
    if (t === "gallery") return buildGallery(el, body, b);
    if (t === "embed") return buildEmbed(el, body, b);
    if (t === "button") {
      body.append(h("div", { class: "rb-btnw", contenteditable: "false" },
        h("input", { class: "rb-in", "data-k": "label", placeholder: "Button label", value: b.label || "", "aria-label": "Button label" }),
        h("input", { class: "rb-in", "data-k": "url", placeholder: "https://…", value: b.url || "", "aria-label": "Button link", inputmode: "url" }),
        h("button", { type: "button", class: "rb-mini", "data-act": "btnstyle" }, b.style === "outline" ? "Outline" : "Solid")));
      return;
    }
    if (t === "bookmark") {
      body.append(h("div", { class: "rb-bmw", contenteditable: "false" },
        h("input", { class: "rb-in", "data-k": "url", placeholder: "Paste a link", value: b.url || "", "aria-label": "Link", inputmode: "url" }),
        h("input", { class: "rb-in", "data-k": "title", placeholder: "Title", value: b.title || "", "aria-label": "Title" }),
        h("input", { class: "rb-in", "data-k": "desc", placeholder: "Short description (optional)", value: b.desc || "", "aria-label": "Description" })));
      return;
    }
    if (t === "file") {
      body.append(h("div", { class: "rb-filew", contenteditable: "false" }, b.src
        ? [h("span", {}, "📎 "), h("b", {}, b.name || "File"), h("button", { type: "button", class: "rb-mini", "data-act": "filepick" }, "Replace")]
        : [h("button", { type: "button", class: "rb-pick-btn", "data-act": "filepick" }, "Upload a PDF"), h("small", {}, "up to 3 MB")]));
      return;
    }
    if (t === "table") {
      const rows = b.rows && b.rows.length ? b.rows : [["", ""], ["", ""]];
      const tb = h("table", {}, h("tbody", {}, rows.map((r, ri) => h("tr", {}, r.map((c) => { const cell = h(ri === 0 && b.hr !== false ? "th" : "td", { class: "rb-e rb-cell", contenteditable: "true", spellcheck: "true" }); cell.innerHTML = cleanInline(c); return cell; })))));
      const ctl = h("div", { class: "rb-tblctl rte-ui", contenteditable: "false" }, ["+ Row", "+ Column", "− Row", "− Column", "Header"].map((l, i) => h("button", { type: "button", class: "rb-mini", "data-act": ["addrow", "addcol", "delrow", "delcol", "hdr"][i] }, l)));
      body.append(h("div", { class: "rb-tblw bk-tablew" }, tb), ctl);
      return;
    }
    if (t === "columns") {
      const n = (b.cols || []).length || 2;
      const cols = h("div", { class: "rb-cols bk-cols bk-n" + n });
      for (let i = 0; i < n; i++) {
        const c = h("div", { class: "rb-col rb-list bk-col" });
        const src = (b.cols && b.cols[i]) || [];
        (src.length ? src : [{ t: "p", h: "" }]).forEach((k) => c.append(mk(k)));
        cols.append(c);
      }
      body.append(cols, h("div", { class: "rb-colctl rte-ui", contenteditable: "false" }, [2, 3, 4].map((k) => h("button", { type: "button", class: "rb-mini" + (k === n ? " on" : ""), "data-act": "cols", "data-n": k }, k + " columns"))));
      return;
    }
    if (t === "toc") { body.append(h("div", { class: "rb-toc", contenteditable: "false" }, "Table of contents · built from your headings")); return; }
    if (t === "carousel") { body.append(h("div", { class: "rb-toc", contenteditable: "false" }, `Carousel “${b.ref}”`)); return; }
  }
  const autosize = (ta) => { const f = () => { ta.style.height = "auto"; ta.style.height = Math.max(60, ta.scrollHeight + 2) + "px"; }; ta.addEventListener("input", f); setTimeout(f, 0); ta.__fit = f; };

  function buildImage(el, body, b) {
    const fig = h("figure", { class: "rb-fig bk-fig bk-w-" + (b.w || "n"), contenteditable: "false" });
    if (b.src) {
      const img = h("img", { src: b.thumb || b.src, alt: b.alt || "", draggable: "false" });
      const tools = h("div", { class: "rb-imgtools rte-ui" },
        ["n", "w", "f"].map((w) => h("button", { type: "button", class: "rb-mini" + ((b.w || "n") === w ? " on" : ""), "data-act": "imgw", "data-w": w, title: { n: "Normal width", w: "Wide", f: "Full width" }[w] }, { n: "▭", w: "▬", f: "▣" }[w])),
        h("button", { type: "button", class: "rb-mini", "data-act": "alt" }, "Alt text"), h("button", { type: "button", class: "rb-mini", "data-act": "imglink" }, "Link"),
        h("button", { type: "button", class: "rb-mini", "data-act": "imgreplace" }, "Replace"), h("button", { type: "button", class: "rb-mini rb-x", "data-act": "remove", "aria-label": "Remove" }, "✕"));
      fig.append(h("div", { class: "rb-imgwrap" }, img, tools));
      const cap = editable("rb-cap", b.cap, "Add a caption"); cap.setAttribute("contenteditable", "true"); fig.append(cap);
    } else if (b.uploading) {
      fig.append(h("div", { class: "rb-pick" }, h("span", { class: "rb-spin" }), "Uploading…"));
    } else {
      fig.append(h("div", { class: "rb-pick" },
        h("div", { class: "rb-pickt" }, "Add an image"),
        h("div", { class: "rb-pickb" }, h("button", { type: "button", class: "rb-pick-btn", "data-act": "imgupload" }, "Upload"), opts.library ? h("button", { type: "button", class: "rb-pick-btn", "data-act": "imglib" }, "Library") : null, h("button", { type: "button", class: "rb-pick-btn", "data-act": "imgurl" }, "Link")),
        h("small", {}, "or drop a picture here")));
    }
    body.append(fig);
  }
  function buildGallery(el, body, b) {
    const imgs = b.imgs || [];
    const g = h("div", { class: "rb-galw", contenteditable: "false" });
    const grid = h("div", { class: "rb-gal" + (b.mode === "carousel" ? " car" : "") });
    imgs.forEach((im, i) => grid.append(h("div", { class: "rb-gi" }, h("img", { src: im.src, alt: im.alt || "", draggable: "false" }),
      h("div", { class: "rb-gt rte-ui" }, h("button", { type: "button", "data-act": "gl", "data-i": i, "aria-label": "Move earlier" }, "‹"), h("button", { type: "button", "data-act": "gr", "data-i": i, "aria-label": "Move later" }, "›"), h("button", { type: "button", "data-act": "gx", "data-i": i, "aria-label": "Remove" }, "✕")))));
    grid.append(h("button", { type: "button", class: "rb-gadd rte-ui", "data-act": "gadd" }, b.uploading ? "Uploading…" : "+ Add images"));
    g.append(grid, h("div", { class: "rb-galc rte-ui" }, ["grid", "masonry", "carousel"].map((m) => h("button", { type: "button", class: "rb-mini" + ((b.mode || "grid") === m ? " on" : ""), "data-act": "gmode", "data-m": m }, m[0].toUpperCase() + m.slice(1))), [2, 3, 4].map((k) => h("button", { type: "button", class: "rb-mini" + ((b.per || 3) === k ? " on" : ""), "data-act": "gcols", "data-n": k }, k + " across"))));
    body.append(g);
  }
  function buildEmbed(el, body, b) {
    const info = b.url ? embedInfo(b.url) : null;
    const w = h("div", { class: "rb-embw", contenteditable: "false" });
    if (info) {
      w.append(h("div", { class: "bk-frame rb-frame", style: info.fixedH ? `height:${info.fixedH}px` : `aspect-ratio:${info.ratio}` }, h("iframe", { src: info.src, loading: "lazy", title: info.kind, allowfullscreen: true, tabindex: "-1" }), h("div", { class: "rb-shield" })));
      const cap = editable("rb-cap", b.cap, "Add a caption"); w.append(cap, h("div", { class: "rb-embr rte-ui" }, h("small", {}, info.kind + " · "), h("button", { type: "button", class: "rb-mini", "data-act": "embedchange" }, "Change link"), h("button", { type: "button", class: "rb-mini rb-x", "data-act": "remove" }, "✕")));
    } else {
      w.append(h("div", { class: "rb-pick" }, h("div", { class: "rb-pickt" }, "Embed a video, design or player"),
        h("div", { class: "rb-pickb" }, h("input", { class: "rb-in", "data-k": "embedurl", placeholder: "Paste a YouTube, Vimeo, Figma, Loom, Spotify… link", value: b.url || "", inputmode: "url", "aria-label": "Link to embed" }), h("button", { type: "button", class: "rb-pick-btn", "data-act": "embedgo" }, "Embed")),
        b.url ? h("small", { class: "rb-warn" }, "That link can't be embedded. It will show as a plain link.") : h("small", {}, "Works with YouTube, Vimeo, Loom, Figma, Behance, Spotify, SoundCloud, CodePen, Instagram, Cal.com and Calendly.")));
    }
    body.append(w);
  }

  /* ---------- finding things ---------- */
  const flat = () => $$(".rb", root);
  const hasEd = (el) => !!edOf(el);
  const visible = (el) => !el.closest("[hidden]");
  const textBlocks = () => flat().filter((e) => hasEd(e) && visible(e));
  const prevText = (el) => { const l = textBlocks(), i = l.indexOf(el); return i > 0 ? l[i - 1] : null; };
  const nextText = (el) => { const l = textBlocks(), i = l.indexOf(el); return i >= 0 && i < l.length - 1 ? l[i + 1] : null; };
  const rbOf = (n) => (n && n.nodeType === 3 ? n.parentElement : n)?.closest?.(".rb") || null;
  const edAt = (n) => { const e = (n && n.nodeType === 3 ? n.parentElement : n)?.closest?.(".rb-e"); return e && root.contains(e) ? e : null; };
  const listOf = (el) => el.parentElement;
  const sel = () => getSelection();

  /* ---------- caret ---------- */
  function caretTo(ed, pos) {
    if (!ed) return;
    ed.focus({ preventScroll: false });
    const r = document.createRange();
    if (pos === "start") { r.selectNodeContents(ed); r.collapse(true); }
    else if (typeof pos === "number") {
      let left = pos, done = false;
      const w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode()) && !done) {
        for (let i = 0; i <= n.data.length; i++) {
          if (left === 0) { r.setStart(n, i); r.collapse(true); done = true; break; }
          if (i < n.data.length && !isZW(n.data[i])) left--;
        }
      }
      if (!done) { r.selectNodeContents(ed); r.collapse(false); }
    } else { r.selectNodeContents(ed); r.collapse(false); }
    const s = sel(); s.removeAllRanges(); s.addRange(r);
  }
  const preText = (ed) => { const s = sel(); if (!s.rangeCount) return ""; const r = s.getRangeAt(0), p = document.createRange(); p.selectNodeContents(ed); p.setEnd(r.startContainer, r.startOffset); return p.toString().replace(ZW, ""); };
  const postText = (ed) => { const s = sel(); if (!s.rangeCount) return ""; const r = s.getRangeAt(0), p = document.createRange(); p.selectNodeContents(ed); p.setStart(r.endContainer, r.endOffset); return p.toString().replace(ZW, ""); };
  const caretOffset = (ed) => preText(ed).length;
  const atStart = (ed) => sel().isCollapsed && preText(ed) === "";
  const atEnd = (ed) => sel().isCollapsed && postText(ed) === "";
  function splitHtml(ed) {
    const s = sel(), r = s.getRangeAt(0);
    if (!r.collapsed) r.deleteContents();
    const a = document.createRange(); a.selectNodeContents(ed); a.setEnd(r.startContainer, r.startOffset);
    const b = document.createRange(); b.selectNodeContents(ed); b.setStart(r.startContainer, r.startOffset);
    return { before: fragHtml(a), after: fragHtml(b) };
  }
  function fragHtml(rg) {
    const d = document.createElement("div"); d.appendChild(rg.cloneContents());
    for (let i = 0; i < 4; i++) $$("strong,em,u,s,code,mark,span,a,sub,sup", d).forEach((n) => { if (!n.textContent.replace(ZW, "") && !n.querySelector("br,img")) n.remove(); });
    return d.innerHTML;
  }
  const isEmptyHtml = (s) => !stripTags(s).replace(ZW, "").trim() && !/<img/i.test(s);
  function caretRect(ed) {
    const s = sel(); if (!s.rangeCount) return ed.getBoundingClientRect();
    const r = s.getRangeAt(0).cloneRange(); r.collapse(true);
    let rc = r.getClientRects()[0];
    if (!rc || (!rc.width && !rc.height && !rc.top)) {
      const sp = document.createElement("span"); sp.textContent = "\u200B"; r.insertNode(sp); rc = sp.getBoundingClientRect(); const par = sp.parentNode; sp.remove(); par.normalize();
      const r2 = document.createRange(); r2.setStart(r.startContainer, r.startOffset); r2.collapse(true); s.removeAllRanges(); s.addRange(r2);
    }
    return rc || ed.getBoundingClientRect();
  }
  function onFirstLine(ed) { const r = caretRect(ed), b = ed.getBoundingClientRect(), lh = parseFloat(getComputedStyle(ed).lineHeight) || 24; return r.top - b.top < lh * 0.9; }
  function onLastLine(ed) { const r = caretRect(ed), b = ed.getBoundingClientRect(), lh = parseFloat(getComputedStyle(ed).lineHeight) || 24; return b.bottom - r.bottom < lh * 0.9; }

  /* ---------- history ---------- */
  const selInfo = () => { const ed = edAt(sel().anchorNode); if (!ed) return null; const l = $$(".rb-e", root); return { n: l.indexOf(ed), o: caretOffset(ed) }; };
  const restoreSel = (i) => { if (!i) return; const l = $$(".rb-e", root); const ed = l[Math.min(i.n, l.length - 1)]; if (ed) caretTo(ed, i.o); };
  function snap(force) {
    const j = JSON.stringify(blocks());
    if (!force && E.hist[E.hi] && E.hist[E.hi].j === j) return;
    E.hist = E.hist.slice(0, E.hi + 1); E.hist.push({ j, s: selInfo() }); if (E.hist.length > 120) E.hist.shift(); E.hi = E.hist.length - 1;
  }
  function touch(now) {
    E.dirty = true;
    clearTimeout(E.timers.h); E.timers.h = setTimeout(() => snap(), now ? 0 : 450);
    clearTimeout(E.timers.c);
    E.timers.c = setTimeout(() => { if (opts.onChange) opts.onChange(blocks()); }, now ? 60 : 700);
    renumber();
  }
  function undo() { clearTimeout(E.timers.h); snap(); if (E.hi <= 0) return; E.hi--; const h0 = E.hist[E.hi]; render(JSON.parse(h0.j), true); restoreSel(h0.s || E.hist[E.hi + 1]?.s); touch(true); }
  function redo() { clearTimeout(E.timers.h); if (E.hi >= E.hist.length - 1) return; E.hi++; const h0 = E.hist[E.hi]; render(JSON.parse(h0.j), true); restoreSel(h0.s); touch(true); }

  /* ---------- numbering for numbered lists ---------- */
  function renumber() {
    const lists = [root, ...$$(".rb-list", root)];
    for (const L of lists) {
      const cnt = []; let prevType = null;
      for (const el of [...L.children].filter((c) => c.classList.contains("rb"))) {
        const t = el.dataset.t, d = el.__b.d || 0;
        if (!LIST_TYPES.includes(t)) { cnt.length = 0; prevType = null; continue; }
        el.style.setProperty("--d", d);
        cnt.length = d + 1;
        if (t === "ol") {
          cnt[d] = (cnt[d] || 0) + 1;
          const n = cnt[d], s = d % 3 === 0 ? n + "." : d % 3 === 1 ? String.fromCharCode(96 + ((n - 1) % 26) + 1) + "." : roman(n) + ".";
          const mk0 = $(":scope > .rb-body > .rb-row > .rb-mk", el); if (mk0) mk0.textContent = s;
        } else cnt[d] = 0;
        prevType = t;
      }
    }
  }
  const roman = (n) => { const m = [[10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]]; let s = ""; for (const [v, c] of m) while (n >= v) { s += c; n -= v; } return s; };

  /* ---------- rendering the whole document ---------- */
  function render(arr, quiet) {
    root.textContent = "";
    const list = Array.isArray(arr) && arr.length ? arr : [{ t: "p", h: "" }];
    list.forEach((b) => root.append(mk(b)));
    renumber();
    if (!quiet) { E.hist = []; E.hi = -1; snap(true); }
  }
  function ensureOne() { if (!root.querySelector(":scope > .rb")) root.append(mk({ t: "p", h: "" })); }

  /* ---------- block operations ---------- */
  function insertAfter(ref, b, focus = true) {
    const el = mk(b);
    if (!ref) root.append(el); else if (ref.parentElement.classList.contains("rb-kids") && ref.classList.contains("rb-addkid")) ref.before(el); else ref.after(el);
    renumber();
    if (focus) focusBlock(el, "start");
    touch(true);
    return el;
  }
  function appendTo(listEl, b, focus = true) {
    const el = mk(b), add = $(":scope > .rb-addkid", listEl);
    if (add) add.before(el); else listEl.append(el);
    if (focus) focusBlock(el, "start");
    touch(true); return el;
  }
  function removeBlock(el, focusPrev = true) {
    const prev = prevText(el), next = nextText(el), list = listOf(el);
    el.remove();
    if (list === root) ensureOne();
    else if (list.classList.contains("rb-col") && !list.querySelector(":scope > .rb")) list.append(mk({ t: "p", h: "" }));
    renumber();
    if (focusPrev) { const t = prev || next; if (t) focusBlock(t, "end"); }
    touch(true);
  }
  function focusBlock(el, where = "end") {
    if (!el) return;
    const ed = edOf(el) || $(".rb-cap", el);
    if (hasEd(el) && ed) { clearSel(); caretTo(ed, where); }
    else {
      const first = $("input,textarea", el);
      if (el.dataset.t === "code") { const ta = $("textarea", el); ta.focus(); return; }
      if (el.dataset.t === "table") { const c = $(".rb-cell", el); caretTo(c, where); return; }
      if (first && !first.value) { first.focus(); return; }
      selectBlock(el);
    }
    el.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }
  function selectBlock(el) { clearSel(); el.classList.add("sel"); el.focus({ preventScroll: true }); E.selEl = el; getSelection().removeAllRanges(); }
  function clearSel() { if (E.selEl) { E.selEl.classList.remove("sel"); E.selEl = null; } }
  function convert(el, t, extra = {}) {
    const ed = edOf(el), html = ed ? htmlOf(ed) : "", old = el.__b;
    const nb = { t, h: html, id: el.dataset.id, ...(LIST_TYPES.includes(t) ? { d: LIST_TYPES.includes(el.dataset.t) ? old.d || 0 : 0 } : {}), ...(old.a ? { a: old.a } : {}), ...extra };
    if (t === "toggle" && el.dataset.t === "toggle") return el;
    if (el.dataset.t === "toggle" && t !== "toggle") { const kids = serList($(":scope > .rb-body > .rb-kids", el)); const n = mk(nb); el.replaceWith(n); kids.reverse().forEach((k) => n.after(mk(k))); renumber(); touch(true); return n; }
    const n = mk(nb);
    el.replaceWith(n); renumber(); touch(true);
    return n;
  }
  function moveBlock(el, dir) {
    const sibs = [...listOf(el).children].filter((c) => c.classList.contains("rb"));
    const i = sibs.indexOf(el), j = i + dir; if (j < 0 || j >= sibs.length) return;
    if (dir < 0) sibs[j].before(el); else sibs[j].after(el);
    renumber(); touch(true); el.scrollIntoView?.({ block: "nearest" });
  }
  function duplicate(el) { const b = ser(el); b.id = rid(); const c = mk(cloneIds(b)); el.after(c); renumber(); touch(true); return c; }
  const cloneIds = (b) => { const o = JSON.parse(JSON.stringify(b)); const w = (x) => { x.id = rid(); (x.k || []).forEach(w); if (x.t === "columns") (x.cols || []).forEach((c) => c.forEach(w)); }; w(o); return o; };
  function indent(el, dir) {
    if (!LIST_TYPES.includes(el.dataset.t)) return false;
    const d = el.__b.d || 0;
    if (dir > 0) { const prev = el.previousElementSibling; if (!prev || !prev.classList.contains("rb") || !LIST_TYPES.includes(prev.dataset.t)) return true; if (d >= Math.min(3, (prev.__b.d || 0) + 1)) return true; el.__b.d = d + 1; }
    else { if (d === 0) return false; el.__b.d = d - 1; }
    renumber(); touch(true); return true;
  }

  /* ---------- inline formatting (our own, so the result is clean <strong>, <em>, <mark> ...) ---------- */
  const range = () => { const s = sel(); return s.rangeCount ? s.getRangeAt(0) : null; };
  const markMatch = (tag, attr) => (n) => n.nodeType === 1 && n.tagName.toLowerCase() === tag && (!attr || n.hasAttribute(attr));
  function closestMark(node, m, within) { let n = node && node.nodeType === 3 ? node.parentNode : node; while (n && n !== within) { if (m(n)) return n; n = n.parentNode; } return null; }
  function textNodesIn(r) {
    const out = [], w = document.createTreeWalker(r.commonAncestorContainer.nodeType === 3 ? r.commonAncestorContainer.parentNode : r.commonAncestorContainer, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) { if (!r.intersectsNode(n)) continue; let s = 0, e = n.data.length; if (n === r.startContainer) s = r.startOffset; if (n === r.endContainer) e = r.endOffset; if (e > s && n.data.slice(s, e).replace(ZW, "")) out.push(n); }
    return out;
  }
  function isMarked(r, m, within) { const t = textNodesIn(r); return t.length > 0 && t.every((n) => closestMark(n, m, within)); }
  function unwrapIn(frag, m) { $$("*", frag).filter(m).forEach((n) => { while (n.firstChild) n.before(n.firstChild); n.remove(); }); }
  function splitOut(r, m, within) {
    let a;
    while ((a = closestMark(r.startContainer, m, within))) {
      const tail = document.createRange(); tail.setStart(r.startContainer, r.startOffset); tail.setEnd(a, a.childNodes.length);
      const right = tail.extractContents(); const a2 = a.cloneNode(false); a2.appendChild(right); a.after(a2);
      r.setStartAfter(a); r.collapse(true);
      if (!a.textContent) a.remove(); if (!a2.textContent) a2.remove();
    }
  }
  function applyMark(tag, attrs, { replace } = {}) {
    const r0 = range(); if (!r0 || r0.collapsed) return false;
    const ed = edAt(r0.commonAncestorContainer); if (!ed) return false;
    const attr = attrs && Object.keys(attrs)[0];
    const m = markMatch(tag, replace ? attr : null);
    const r = r0.cloneRange();
    const frag = r.extractContents();
    unwrapIn(frag, markMatch(tag, replace ? attr : null));
    splitOut(r, markMatch(tag, replace ? attr : null), ed);
    const w = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) w.setAttribute(k, v);
    w.appendChild(frag); r.insertNode(w); ed.normalize();
    const nr = document.createRange(); nr.selectNodeContents(w); const s = sel(); s.removeAllRanges(); s.addRange(nr);
    cleanEmpty(ed); touch(); return true;
  }
  // The text pieces a selection covers, with the text split at the selection's edges so each piece is wholly inside.
  function segments(r) {
    let sc = r.startContainer, so = r.startOffset, ec = r.endContainer, eo = r.endOffset;
    if (ec.nodeType === 3 && eo < ec.data.length) ec.splitText(eo);
    if (sc.nodeType === 3 && so > 0) { const t = sc.splitText(so); if (sc === ec) ec = t; sc = t; }
    const out = [], root0 = r.commonAncestorContainer.nodeType === 3 ? r.commonAncestorContainer.parentNode : r.commonAncestorContainer;
    const rr = document.createRange(); if (sc.nodeType === 3) rr.setStart(sc, 0); else rr.setStart(sc, so); if (ec.nodeType === 3) rr.setEnd(ec, ec.data.length); else rr.setEnd(ec, eo);
    const w = document.createTreeWalker(root0, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) { if (rr.intersectsNode(n) && n.data.length) out.push(n); }
    return out;
  }
  function removeMark(tag, attr) {
    const r0 = range(); if (!r0 || r0.collapsed) return false;
    const ed = edAt(r0.commonAncestorContainer); if (!ed) return false;
    const m = markMatch(tag, attr);
    const nodes = segments(r0);
    for (const t of nodes) {
      const a = closestMark(t, m, ed); if (!a) continue;
      const after = document.createRange(); after.setStart(t, t.data.length); after.setEnd(a, a.childNodes.length);
      const before = document.createRange(); before.setStart(a, 0); before.setEnd(t, 0);
      const aF = after.extractContents(), bF = before.extractContents();
      const a2 = a.cloneNode(false); a2.appendChild(aF); const a3 = a.cloneNode(false); a3.appendChild(bF);
      a.before(a3); while (a.firstChild) a.before(a.firstChild); a.replaceWith(a2);
      if (!a2.textContent) a2.remove(); if (!a3.textContent) a3.remove();
    }
    cleanEmpty(ed);
    const live = nodes.filter((n) => n.isConnected);
    if (live.length) { const nr = document.createRange(); nr.setStartBefore(live[0]); nr.setEndAfter(live[live.length - 1]); const s = sel(); s.removeAllRanges(); s.addRange(nr); }
    touch(); return true;
  }
  const cleanEmpty = (ed) => { $$("strong,em,u,s,code,mark,span,a,sub,sup", ed).forEach((n) => { if (!n.textContent && !n.querySelector("br,img")) n.remove(); }); ed.normalize(); };
  function toggleMark(tag, attrs) {
    const r = range(); if (!r || r.collapsed) return;
    const ed = edAt(r.commonAncestorContainer); if (!ed) return;
    if (isMarked(r, markMatch(tag), ed)) removeMark(tag); else applyMark(tag, attrs);
    updateBars();
  }
  function setColor(kind, value) {
    const tag = kind === "bg" ? "mark" : "span", attr = kind === "bg" ? "data-bg" : "data-tc";
    if (!value) removeMark(tag, attr); else applyMark(tag, { [attr]: value }, { replace: true });
    updateBars();
  }
  function setLink(url) {
    const r = range(); if (!r) return;
    const ed = edAt(r.commonAncestorContainer); if (!ed) return;
    if (!url) { const a = closestMark(r.startContainer, markMatch("a"), ed); if (a && r.collapsed) { const nr = document.createRange(); nr.selectNodeContents(a); sel().removeAllRanges(); sel().addRange(nr); } removeMark("a"); return; }
    let u = url.trim(); if (!/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(u)) u = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u) ? "mailto:" + u : "https://" + u;
    if (!safeUrl(u)) return;
    const a = closestMark(r.startContainer, markMatch("a"), ed);
    if (a && r.collapsed) { a.setAttribute("href", u); touch(); return; }
    applyMark("a", { href: u }, { replace: true });
  }
  function clearFormatting() {
    const r = range(); if (!r || r.collapsed) return; const ed = edAt(r.commonAncestorContainer); if (!ed) return;
    const txt = document.createTextNode(r.toString()); r.deleteContents(); r.insertNode(txt); const nr = document.createRange(); nr.selectNode(txt); sel().removeAllRanges(); sel().addRange(nr); cleanEmpty(ed); touch();
  }

  /* ---------- popups ---------- */
  function closePop() {
    if (E.pop) { E.pop.remove(); E.pop = null; }
    if (E.popOut) { document.removeEventListener("pointerdown", E.popOut, true); E.popOut = null; }
    E.slash = null;
  }
  function placePop(p, rect) {
    const vv = window.visualViewport, vw = innerWidth, vh = (vv ? vv.height : innerHeight) - (E.mbar && E.mbar.classList.contains("show") ? 54 : 0);
    p.style.maxHeight = ""; const pw = p.offsetWidth, natural = p.offsetHeight;
    const below = vh - rect.bottom - 12, above = rect.top - 12;
    const x = Math.min(Math.max(8, rect.left), Math.max(8, vw - pw - 8));
    let y, mh = natural;
    if (natural <= below) y = rect.bottom + 6;
    else if (natural <= above) y = rect.top - natural - 6;
    else if (below >= above) { mh = Math.max(120, below); y = rect.bottom + 6; }
    else { mh = Math.max(120, above); y = Math.max(8, rect.top - mh - 6); }
    p.style.maxHeight = mh + "px"; p.style.left = x + "px"; p.style.top = Math.max(8, y) + "px";
  }
  function popup(content, rect, cls = "") {
    closePop();
    const p = h("div", { class: "rte-pop rte-ui " + cls }, content);
    document.body.append(p); E.pop = p; placePop(p, rect);
    p.addEventListener("pointerdown", (ev) => { if (!ev.target.closest("input,textarea,select")) ev.preventDefault(); });
    E.popOut = (ev) => { if (!p.contains(ev.target) && !ev.target.closest(".rte-fbar,.rte-mbar")) closePop(); };
    setTimeout(() => document.addEventListener("pointerdown", E.popOut, true), 0);
    return p;
  }
  const rectOf = (el) => el.getBoundingClientRect();
  function askText(rect, { title, value = "", placeholder = "", onDone, allowEmpty }) {
    const inp = h("input", { class: "rb-in", value, placeholder, "aria-label": title, inputmode: "url" });
    const ok = () => { onDone(inp.value.trim()); closePop(); };
    const p = popup(h("div", { class: "rte-ask" }, h("b", {}, title), inp, h("div", { class: "rte-askb" }, h("button", { type: "button", class: "rb-mini", onclick: closePop }, "Cancel"), allowEmpty ? h("button", { type: "button", class: "rb-mini", onclick: () => { onDone(""); closePop(); } }, "Remove") : null, h("button", { type: "button", class: "rb-mini on", onclick: ok }, "Done"))), rect);
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); ok(); } if (e.key === "Escape") closePop(); });
    placePop(p, rect); setTimeout(() => { inp.focus(); inp.select(); }, 30);
  }

  /* ---------- the "/" menu ---------- */
  const filterItems = (q) => { const t = q.toLowerCase().trim().split(/\s+/).filter(Boolean); return ITEMS.filter((i) => !t.length || t.every((w) => (i.label + " " + i.kw).toLowerCase().includes(w))); };
  function openSlash(ed, el) {
    const list = h("div", { class: "rte-slash", role: "listbox" });
    popup(list, caretRect(ed), "rte-slashp");
    E.slash = { ed, el, query: "", idx: 0, list, items: [] };
    renderSlash();
  }
  function renderSlash() {
    const S = E.slash; if (!S) return;
    S.items = filterItems(S.query);
    if (!S.items.length) { if (S.query.length > 2) { closePop(); return; } S.list.innerHTML = '<div class="rte-none">No results</div>'; return; }
    S.idx = Math.min(S.idx, S.items.length - 1);
    let g = "", out = [];
    S.items.forEach((it, i) => {
      if (it.g !== g) { g = it.g; out.push(h("div", { class: "rte-sg" }, g)); }
      out.push(h("button", { type: "button", class: "rte-si" + (i === S.idx ? " on" : ""), role: "option", "data-i": i, onclick: () => slashPick(it) }, h("span", { class: "rte-sic" }, it.ico), h("span", { class: "rte-sit" }, h("b", {}, it.label), h("small", {}, it.desc))));
    });
    S.list.textContent = ""; S.list.append(...out);
    $(".rte-si.on", S.list)?.scrollIntoView({ block: "nearest" });
    placePop(E.pop, caretRect(S.ed));
  }
  function deleteBefore(ed, n) {
    const s = sel(); if (!s.rangeCount) return;
    const r = s.getRangeAt(0); let node = r.startContainer, off = r.startOffset;
    while (n > 0 && node) {
      if (node.nodeType === 3) { const k = Math.min(n, off); node.deleteData(off - k, k); off -= k; n -= k; if (n > 0) { const prev = prevTextNode(node, ed); if (!prev) break; node = prev; off = prev.data.length; } }
      else break;
    }
    const nr = document.createRange(); nr.setStart(node, Math.max(0, Math.min(off, node.nodeType === 3 ? node.data.length : 0))); nr.collapse(true); s.removeAllRanges(); s.addRange(nr);
  }
  function prevTextNode(node, within) { const w = document.createTreeWalker(within, NodeFilter.SHOW_TEXT); w.currentNode = node; return w.previousNode(); }
  function slashPick(item) {
    const S = E.slash; if (!S) return;
    const { ed, el } = S; const n = S.query.length + 1;
    closePop(); ed.focus(); deleteBefore(ed, n);
    applyItem(item.id, el);
  }
  function applyItem(id, el) {
    const empty = isEmptyHtml(htmlOf(edOf(el) || document.createElement("div"))) && el.dataset.t === "p";
    const put = (b, focus = true) => { if (empty) { const n = mk(b); el.replaceWith(n); renumber(); touch(true); if (focus) focusBlock(n, "start"); return n; } return insertAfter(el, b, focus); };
    const withTail = (n) => { if (!n.nextElementSibling || !n.nextElementSibling.classList.contains("rb")) { const p = mk({ t: "p", h: "" }); n.after(p); } };
    if (["p", "h1", "h2", "h3", "ul", "ol", "todo", "toggle", "quote", "callout"].includes(id)) {
      if (el.dataset.t !== "p" && !empty) return void focusBlock(convert(el, id, id === "toggle" ? { open: true } : {}), "end");
      const n = convert(el, id, id === "callout" ? { e: "💡", tone: "gray" } : id === "toggle" ? { open: true } : {}); focusBlock(n, "end"); return;
    }
    if (id === "divider") { const n = put({ t: "divider" }, false); withTail(n); const nx = n.nextElementSibling; if (nx) focusBlock(nx, "start"); touch(true); return; }
    if (id === "code") { const n = put({ t: "code", x: "", lang: "" }, false); withTail(n); $("textarea", n).focus(); return; }
    if (id === "image") { const n = put({ t: "image", src: "" }, false); withTail(n); selectBlock(n); if (isTouch()) setTimeout(() => act(n, "imgupload"), 50); return; }
    if (id === "gallery") { const n = put({ t: "gallery", imgs: [], mode: "grid", per: 3 }, false); withTail(n); setTimeout(() => act(n, "gadd"), 30); return; }
    if (id === "embed") { const n = put({ t: "embed", url: "" }, false); withTail(n); $(".rb-in", n)?.focus(); return; }
    if (id === "file") { const n = put({ t: "file", src: "" }, false); withTail(n); selectBlock(n); return; }
    if (id === "bookmark") { const n = put({ t: "bookmark", url: "" }, false); withTail(n); $(".rb-in", n)?.focus(); return; }
    if (id === "button") { const n = put({ t: "button", label: "", url: "", style: "solid" }, false); withTail(n); $(".rb-in", n)?.focus(); return; }
    if (id === "toc") { const n = put({ t: "toc" }, false); withTail(n); selectBlock(n); touch(true); return; }
    if (id === "table") { const n = put({ t: "table", rows: [["", ""], ["", ""]], hr: true }, false); withTail(n); caretTo($(".rb-cell", n), "start"); touch(true); return; }
    if (id === "cols2" || id === "cols3") { const k = id === "cols2" ? 2 : 3; const n = put({ t: "columns", cols: Array.from({ length: k }, () => [{ t: "p", h: "" }]) }, false); withTail(n); const f = $(".rb-e", n); if (f) caretTo(f, "start"); touch(true); }
  }

  /* ---------- the formatting bars ---------- */
  const markBtns = [
    ["b", "Bold", "<b>B</b>", () => toggleMark("strong")], ["i", "Italic", "<i>I</i>", () => toggleMark("em")], ["u", "Underline", "<u>U</u>", () => toggleMark("u")],
    ["s", "Strikethrough", "<s>S</s>", () => toggleMark("s")], ["c", "Code", "&lt;/&gt;", () => toggleMark("code")],
  ];
  function linkAsk(anchorRect) {
    const r = range(); const ed = r && edAt(r.commonAncestorContainer); if (!ed) return;
    const a = closestMark(r.startContainer, markMatch("a"), ed); const saved = r.cloneRange();
    askText(anchorRect, { title: "Link", value: a ? a.getAttribute("href") : "", placeholder: "Paste or type a link", allowEmpty: !!a, onDone: (v) => { const s = sel(); s.removeAllRanges(); s.addRange(saved); setLink(v); } });
  }
  function colorPop(anchorRect) {
    const saved = range()?.cloneRange();
    const row = (kind, title) => h("div", { class: "rte-cr" }, h("small", {}, title), h("div", {}, h("button", { type: "button", class: "rte-cw def", title: "Default", onclick: () => pick(kind, "") }, "A"), COLORS.map((c) => h("button", { type: "button", class: "rte-cw " + kind, "data-c": c, title: c, "aria-label": c + (kind === "bg" ? " background" : " text"), onclick: () => pick(kind, c) }, "A"))));
    const pick = (kind, c) => { if (saved) { const s = sel(); s.removeAllRanges(); s.addRange(saved); } setColor(kind, c); closePop(); };
    popup(h("div", { class: "rte-colors" }, row("tc", "Text colour"), row("bg", "Background")), anchorRect);
  }
  function turnPop(anchorRect, el) {
    popup(h("div", { class: "rte-menu" }, TURN.map((t) => h("button", { type: "button", class: "rte-mi" + (el.dataset.t === t ? " on" : ""), onclick: () => { closePop(); const n = convert(el, t, t === "callout" ? { e: "💡", tone: "gray" } : {}); focusBlock(n, "end"); } }, h("span", { class: "rte-sic" }, ITEMS.find((i) => i.id === t).ico), label(t)))), anchorRect);
  }
  function buildFbar() {
    const bar = h("div", { class: "rte-fbar rte-ui", role: "toolbar", "aria-label": "Formatting" });
    bar.append(h("button", { type: "button", class: "rte-fb turn", "data-k": "turn", title: "Turn into" }, "Text ▾"));
    markBtns.forEach(([k, t, ico, fn]) => bar.append(h("button", { type: "button", class: "rte-fb", "data-k": k, title: t, "aria-label": t, html: ico, onclick: fn })));
    bar.append(h("button", { type: "button", class: "rte-fb", "data-k": "link", title: "Link (Ctrl+K)", "aria-label": "Link", html: "🔗", onclick: (e) => linkAsk(e.currentTarget.getBoundingClientRect()) }));
    bar.append(h("button", { type: "button", class: "rte-fb", "data-k": "color", title: "Colour", "aria-label": "Colour", html: '<span class="rte-ca">A</span>', onclick: (e) => colorPop(e.currentTarget.getBoundingClientRect()) }));
    bar.append(h("button", { type: "button", class: "rte-fb", "data-k": "clear", title: "Clear formatting", "aria-label": "Clear formatting", html: "⌫", onclick: clearFormatting }));
    bar.addEventListener("pointerdown", (e) => { if (!e.target.closest("input")) e.preventDefault(); });
    $(".turn", bar).onclick = (e) => { const el = rbOf(sel().anchorNode); if (el) turnPop(e.currentTarget.getBoundingClientRect(), el); };
    document.body.append(bar); return bar;
  }
  function buildMbar() {
    const bar = h("div", { class: "rte-mbar rte-ui", role: "toolbar", "aria-label": "Formatting" });
    const B = (html, title, fn, k) => h("button", { type: "button", class: "rte-fb", title, "aria-label": title, "data-k": k || "", html, onclick: fn });
    bar.append(
      B("＋", "Add block", () => { const ed = edAt(sel().anchorNode); const el = ed && rbOf(ed); if (!el) return; const n = isEmptyHtml(htmlOf(ed)) && el.dataset.t === "p" ? el : insertAfter(el, { t: "p", h: "" }); focusBlock(n, "start"); const e2 = edOf(n); document.execCommand("insertText", false, "/"); }),
      B("<b>B</b>", "Bold", () => toggleMark("strong"), "b"), B("<i>I</i>", "Italic", () => toggleMark("em"), "i"), B("<u>U</u>", "Underline", () => toggleMark("u"), "u"), B("<s>S</s>", "Strikethrough", () => toggleMark("s"), "s"), B("&lt;/&gt;", "Code", () => toggleMark("code"), "c"),
      B("🔗", "Link", (e) => linkAsk(e.currentTarget.getBoundingClientRect())), B('<span class="rte-ca">A</span>', "Colour", (e) => colorPop(e.currentTarget.getBoundingClientRect())),
      B("Aa", "Turn into", (e) => { const el = rbOf(sel().anchorNode); if (el) turnPop(e.currentTarget.getBoundingClientRect(), el); }),
      B("⇥", "Indent", () => { const el = rbOf(sel().anchorNode); if (el) indent(el, 1); }), B("⇤", "Outdent", () => { const el = rbOf(sel().anchorNode); if (el) indent(el, -1); }),
      B("↶", "Undo", undo), B("↷", "Redo", redo), B("⌄", "Hide keyboard", () => { document.activeElement?.blur(); }));
    bar.addEventListener("pointerdown", (e) => e.preventDefault());
    document.body.append(bar); return bar;
  }
  function updateBars() {
    if (E.destroyed) return;
    const s = sel(), r = s.rangeCount ? s.getRangeAt(0) : null;
    const ed = r ? edAt(r.commonAncestorContainer) : null;
    const inside = ed && host.contains(ed);
    // floating bar over a selection
    if (inside && !r.collapsed && !isTouch() && r.toString().trim()) {
      const bar = E.fbar || (E.fbar = buildFbar());
      const rc = r.getBoundingClientRect(), el = rbOf(ed);
      $(".turn", bar).textContent = (el ? label(el.dataset.t) : "Text") + " ▾";
      $(".turn", bar).style.display = el && ed === edOf(el) ? "" : "none";
      bar.classList.add("show");
      const bw = bar.offsetWidth, bh = bar.offsetHeight;
      let y = rc.top - bh - 10; if (y < 8) y = rc.bottom + 10;
      bar.style.left = Math.min(Math.max(8, rc.left + rc.width / 2 - bw / 2), innerWidth - bw - 8) + "px"; bar.style.top = y + "px";
      const m = (tag, attr) => isMarked(r, markMatch(tag, attr), ed);
      const st = { b: m("strong"), i: m("em"), u: m("u"), s: m("s"), c: m("code"), link: m("a"), color: m("span", "data-tc") || m("mark", "data-bg") };
      $$(".rte-fb[data-k]", bar).forEach((b) => b.classList.toggle("on", !!st[b.dataset.k]));
    } else if (E.fbar) E.fbar.classList.remove("show");
    // bar docked above the keyboard on touch screens
    if (isTouch() && (inside || host.contains(document.activeElement) && document.activeElement.closest(".rb"))) {
      const bar = E.mbar || (E.mbar = buildMbar());
      bar.classList.add("show");
      const vv = window.visualViewport; const bottom = vv ? innerHeight - (vv.height + vv.offsetTop) : 0;
      bar.style.bottom = Math.max(0, bottom) + "px";
      if (inside) { const m = (tag, attr) => !r.collapsed && isMarked(r, markMatch(tag, attr), ed) || (r.collapsed && !!closestMark(r.startContainer, markMatch(tag, attr), ed)); const st = { b: m("strong"), i: m("em"), u: m("u"), s: m("s"), c: m("code") }; $$(".rte-fb[data-k]", bar).forEach((b) => b.classList.toggle("on", !!st[b.dataset.k])); }
    } else if (E.mbar) E.mbar.classList.remove("show");
  }
  const rafBars = () => { cancelAnimationFrame(E.raf); E.raf = requestAnimationFrame(updateBars); };

  /* ---------- uploads ---------- */
  const status = () => opts.onStatus && opts.onStatus({ uploading: E.uploading });
  const fail = (m) => (opts.onError ? opts.onError(m) : alert(m));
  function pickFiles(accept, multiple) {
    return new Promise((res) => {
      const i = h("input", { type: "file", accept, style: "display:none", ...(multiple ? { multiple: true } : {}) });
      i.addEventListener("change", () => { res([...i.files]); i.remove(); });
      i.addEventListener("cancel", () => { res([]); i.remove(); });
      document.body.append(i); i.click();
    });
  }
  async function up(file) {
    if (!opts.upload) throw new Error("Uploading isn't available here.");
    E.uploading++; status();
    try { return await opts.upload(file); } finally { E.uploading--; status(); }
  }
  const byId = (id) => $(`.rb[data-id="${id}"]`, root);
  function rebuild(el, patch = {}) {
    const b = { ...ser(el), ...patch }; const n = mk(b); el.replaceWith(n); renumber(); return n;
  }
  async function fillImages(id, files) {
    let el = byId(id); if (!el) return;
    el = rebuild(el, { uploading: true, src: "" }); const myId = el.dataset.id;
    let last = el, first = true;
    for (const f of files) {
      try {
        const r = await up(f);
        if (first) { first = false; const cur = byId(myId); if (!cur) return; last = rebuild(cur, { src: r.url, thumb: r.thumb, rw: r.w, rh: r.h, alt: "", uploading: false }); }
        else last = insertAfter(last, { t: "image", src: r.url, thumb: r.thumb, rw: r.w, rh: r.h, alt: "" }, false);
      } catch (e) { fail(e.message || "Could not upload that file."); if (first) { const cur = byId(myId); if (cur) rebuild(cur, { uploading: false, src: "" }); first = false; } }
    }
    touch(true);
  }
  function addImages(files, afterEl) {
    const imgs = files.filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name));
    if (!imgs.length) { fail("Choose picture files (JPEG, PNG, WebP or GIF)."); return; }
    const empty = afterEl && afterEl.dataset.t === "p" && edOf(afterEl) && isEmptyHtml(htmlOf(edOf(afterEl)));
    let n;
    if (empty) { n = mk({ t: "image", src: "", uploading: true }); afterEl.replaceWith(n); } else n = insertAfter(afterEl, { t: "image", src: "", uploading: true }, false);
    fillImages(n.dataset.id, imgs);
  }

  /* ---------- clicks on the controls inside blocks ---------- */
  async function act(el, name, btn) {
    const B = el.__b, rc = (btn || el).getBoundingClientRect();
    switch (name) {
      case "remove": removeBlock(el); break;
      case "imgupload": { const f = await pickFiles("image/*", true); if (f.length) fillImages(el.dataset.id, f); break; }
      case "imgreplace": { const f = await pickFiles("image/*", false); if (f.length) fillImages(el.dataset.id, f); break; }
      case "imglib": {
        const items = await (opts.library ? opts.library() : []);
        const grid = h("div", { class: "rte-lib" }, items.length ? items.filter((i) => i.kind !== "file").slice(0, 80).map((i) => h("button", { type: "button", class: "rte-lt", onclick: () => { closePop(); const cur = byId(el.dataset.id); if (cur) { rebuild(cur, { src: i.url, thumb: i.thumb, rw: i.w || undefined, rh: i.h || undefined }); touch(true); } } }, h("img", { src: i.thumb || i.url, alt: i.name || "", loading: "lazy" }))) : h("div", { class: "rte-none" }, "No uploads yet"));
        popup(h("div", {}, h("b", { class: "rte-ptitle" }, "Your uploads"), grid), rc, "rte-libp"); break;
      }
      case "imgurl": askText(rc, { title: "Picture link", placeholder: "https://…/picture.jpg", onDone: (v) => { const u = safeUrl(v, { relative: false }); if (!u) return; const cur = byId(el.dataset.id); rebuild(cur, { src: u, uploading: false }); touch(true); } }); break;
      case "imgw": { B.w = btn.dataset.w; const n = rebuild(el); touch(true); selectBlock(n); break; }
      case "alt": askText(rc, { title: "Alt text (describes the picture for search engines and screen readers)", value: B.alt || "", onDone: (v) => { B.alt = v.slice(0, 300); $("img", el)?.setAttribute("alt", B.alt); touch(true); } }); break;
      case "imglink": askText(rc, { title: "Make the picture a link", value: B.link || "", placeholder: "https://…", allowEmpty: !!B.link, onDone: (v) => { B.link = v ? safeUrl(v) : ""; if (!B.link) delete B.link; touch(true); } }); break;
      case "btnstyle": B.style = B.style === "outline" ? "solid" : "outline"; btn.textContent = B.style === "outline" ? "Outline" : "Solid"; touch(true); break;
      case "embedgo": { const inp = $(".rb-in", el); const u = safeUrl(inp.value, { relative: false }); if (!u) { inp.focus(); return; } const n = rebuild(el, { url: u }); touch(true); selectBlock(n); break; }
      case "embedchange": { rebuild(el, { url: "" }); touch(true); break; }
      case "filepick": {
        const f = (await pickFiles("application/pdf", false))[0]; if (!f) break;
        if (f.size > 3 * 1024 * 1024) { fail("That file is over 3 MB."); break; }
        try { const r = await up(f); const cur = byId(el.dataset.id); rebuild(cur, { src: r.url, name: f.name, size: f.size }); touch(true); } catch (e) { fail(e.message); } break;
      }
      case "gadd": {
        const f = await pickFiles("image/*", true); if (!f.length) break;
        const id = el.dataset.id; let cur = byId(id); cur.__b.uploading = true; cur = rebuild(cur);
        for (const file of f) { try { const r = await up(file); cur = byId(id); cur.__b.imgs = [...(cur.__b.imgs || []), { src: r.url, alt: "" }]; cur.__b.uploading = true; cur = rebuild(cur); } catch (e) { fail(e.message); } }
        cur = byId(id); if (cur) { cur.__b.uploading = false; rebuild(cur); } touch(true); break;
      }
      case "gx": case "gl": case "gr": {
        const i = +btn.dataset.i, a = B.imgs || [];
        if (name === "gx") a.splice(i, 1); else { const j = name === "gl" ? i - 1 : i + 1; if (j < 0 || j >= a.length) break; [a[i], a[j]] = [a[j], a[i]]; }
        B.imgs = a; rebuild(el); touch(true); break;
      }
      case "gmode": B.mode = btn.dataset.m; rebuild(el); touch(true); break;
      case "gcols": B.per = +btn.dataset.n; rebuild(el); touch(true); break;
      case "cols": {
        const n = +btn.dataset.n, b = ser(el); const cols = b.cols || [];
        while (cols.length < n) cols.push([{ t: "p", h: "" }]);
        while (cols.length > n) { const x = cols.pop(); cols[cols.length - 1].push(...x.filter((k) => !(k.t === "p" && !k.h))); }
        b.cols = cols; const nn = mk(b); el.replaceWith(nn); touch(true); break;
      }
      case "addrow": { const t = $("table tbody", el), n = $$("tr:first-child > *", t).length, tr = h("tr", {}, Array.from({ length: n }, () => h("td", { class: "rb-e rb-cell", contenteditable: "true" }))); t.append(tr); caretTo($(".rb-cell", tr), "start"); touch(true); break; }
      case "addcol": { $$("tr", el).forEach((tr, i) => tr.append(h(i === 0 && B.hr !== false ? "th" : "td", { class: "rb-e rb-cell", contenteditable: "true" }))); touch(true); break; }
      case "delrow": { const rows = $$("tr", el); if (rows.length > 1) { rows[rows.length - 1].remove(); touch(true); } break; }
      case "delcol": { const rows = $$("tr", el); if (rows[0].children.length > 1) { rows.forEach((tr) => tr.lastElementChild.remove()); touch(true); } break; }
      case "hdr": { B.hr = B.hr === false; const n = rebuild(el); touch(true); break; }
    }
  }
  function emojiPop(el, rc) {
    const tones = h("div", { class: "rte-tones" }, CALLOUT_TONES.map((t) => h("button", { type: "button", class: "rte-tone", "data-tone": t, "aria-label": t + " callout", onclick: () => { el.dataset.tone = t; el.__b.tone = t; touch(true); closePop(); } })));
    const grid = h("div", { class: "rte-emoji" }, EMOJI.map((e) => h("button", { type: "button", onclick: () => { el.__b.e = e; $(".rb-ce", el).textContent = e; touch(true); closePop(); } }, e)));
    popup(h("div", {}, grid, tones), rc);
  }
  function blockMenu(el, rc) {
    const t = el.dataset.t, items = [];
    if (TEXT_TYPES.includes(t)) items.push(["Turn into…", "↻", () => turnPop(rc, el), true]);
    items.push(["Duplicate", "⧉", () => { const c = duplicate(el); focusBlock(c, "end"); }]);
    items.push(["Move up", "↑", () => moveBlock(el, -1)], ["Move down", "↓", () => moveBlock(el, 1)]);
    if (TEXT_TYPES.includes(t) && !["ul", "ol", "todo"].includes(t)) items.push(["Align", "≡", () => { const order = ["l", "c", "r"], cur = el.__b.a || "l"; const nx = order[(order.indexOf(cur) + 1) % 3]; if (nx === "l") delete el.__b.a; else el.__b.a = nx; const ed = edOf(el); if (nx === "l") delete ed.dataset.a; else ed.dataset.a = nx; touch(true); }]);
    if (t === "callout") items.push(["Colour & icon", "🎨", () => emojiPop(el, rc), true]);
    if (t === "toggle") items.push([el.__b.open ? "Collapse" : "Expand", "▸", () => { $(".rb-tg", el)?.click(); }]);
    items.push(["Delete", "🗑", () => removeBlock(el), false, true]);
    const p = popup(h("div", { class: "rte-menu" }, items.map(([l, ico, fn, keep, danger]) => h("button", { type: "button", class: "rte-mi" + (danger ? " danger" : ""), onclick: () => { if (!keep) closePop(); fn(); } }, h("span", { class: "rte-sic" }, ico), l))), rc);
  }
  root.addEventListener("click", (e) => {
    const t = e.target, el = rbOf(t); if (!el) return;
    const b = t.closest("button,[data-act]");
    if (t.closest(".rb-plus")) { const ed = edOf(el); const empty = el.dataset.t === "p" && ed && isEmptyHtml(htmlOf(ed)); const n = empty ? el : insertAfter(el, { t: "p", h: "" }, false); focusBlock(n, "start"); document.execCommand("insertText", false, "/"); return; }
    if (t.closest(".rb-cb")) { const on = !el.__b.c; el.__b.c = on; const bt = t.closest(".rb-cb"); bt.classList.toggle("on", on); bt.setAttribute("aria-pressed", on); touch(true); return; }
    if (t.closest(".rb-ce")) { emojiPop(el, t.closest(".rb-ce").getBoundingClientRect()); return; }
    if (t.closest(".rb-tg")) { const o = !el.__b.open; el.__b.open = o; t.closest(".rb-tg").classList.toggle("open", o); $(":scope > .rb-body > .rb-kids", el).hidden = !o; touch(true); if (o && !$(":scope > .rb-body > .rb-kids > .rb", el)) appendTo($(":scope > .rb-body > .rb-kids", el), { t: "p", h: "" }, true); return; }
    if (t.closest(".rb-addkid")) { appendTo(listOf(t.closest(".rb-addkid")), { t: "p", h: "" }, true); return; }
    const a = t.closest("[data-act]");
    if (a) { e.preventDefault(); act(rbOf(a), a.dataset.act, a); return; }
    if (hasEd(el) || t.closest(".rb-e,input,textarea,select,a,iframe")) { if (hasEd(el)) clearSel(); return; }
    if (!t.closest(".rb-side")) selectBlock(el);
  });
  root.addEventListener("change", (e) => {
    const t = e.target, el = rbOf(t); if (!el) return;
    if (t.matches(".rb-lang")) { el.__b.lang = t.value; touch(true); }
  });
  host.addEventListener("click", (e) => { if (e.target === tail) { const last = [...root.children].filter((c) => c.classList.contains("rb")).pop(); const ed = last && edOf(last); if (last && last.dataset.t === "p" && ed && isEmptyHtml(htmlOf(ed))) focusBlock(last, "end"); else insertAfter(last, { t: "p", h: "" }); } });

  /* ---------- typing ---------- */
  const MD_RULES = [
    [/^#\s$/, "h1"], [/^##\s$/, "h2"], [/^###\s$/, "h3"], [/^[-*+]\s$/, "ul"], [/^\d{1,3}[.)]\s$/, "ol"], [/^\[\s?\]\s$/, "todo"], [/^\[[xX]\]\s$/, "todo-done"],
    [/^>\s$/, "toggle"], [/^["“]\s$/, "quote"], [/^!>\s$/, "callout"], [/^```\s?$/, "code"],
  ];
  function mdShortcut(ed, el) {
    if (el.dataset.t !== "p") return false;
    const pre = preText(ed).replace(/ /g, " ");
    if (/^(---|___|\*\*\*)$/.test(pre) && !postText(ed)) { deleteBefore(ed, 3); const n = convert(el, "divider"); const p = n.nextElementSibling?.classList.contains("rb") ? n.nextElementSibling : insertAfter(n, { t: "p", h: "" }, false); focusBlock(p, "start"); return true; }
    for (const [re, type] of MD_RULES) {
      if (!re.test(pre)) continue;
      deleteBefore(ed, pre.length);
      let n;
      if (type === "todo-done") n = convert(el, "todo", { c: true });
      else if (type === "code") { const x = ""; n = convert(el, "code", { x, lang: "" }); $("textarea", n).focus(); return true; }
      else if (type === "callout") n = convert(el, "callout", { e: "💡", tone: "gray" });
      else if (type === "toggle") n = convert(el, "toggle", { open: true });
      else n = convert(el, type);
      focusBlock(n, "start"); return true;
    }
    return false;
  }
  const INLINE_MD = [[/(^|[\s(])(\*\*)([^*\s](?:[^*]*[^*\s])?)\*\*$/, "strong", 2], [/(^|[\s(])(__)([^_\s](?:[^_]*[^_\s])?)__$/, "strong", 2], [/(^|[\s(])(~~)([^~\s](?:[^~]*[^~\s])?)~~$/, "s", 2], [/(^|[\s(])(`)([^`]+)`$/, "code", 1], [/(^|[\s(])(\*)([^*\s](?:[^*]*[^*\s])?)\*$/, "em", 1], [/(^|[\s(])(_)([^_\s](?:[^_]*[^_\s])?)_$/, "em", 1], [/(^|[\s(])(~)([^~\s](?:[^~]*[^~\s])?)~$/, "s", 1]];
  function inlineMd(ed, ev) {
    if (!ev || ev.inputType !== "insertText" || !ev.data || !"*_`~)".includes(ev.data)) return false;
    const s = sel(); if (!s.rangeCount || !s.isCollapsed) return false;
    const n = s.anchorNode, off = s.anchorOffset; if (!n || n.nodeType !== 3) return false;
    if (n.parentElement.closest("code,a")) return false;
    const before = n.data.slice(0, off);
    // [text](url)
    const lk = ev.data === ")" && /\[([^\]]+)\]\(([^)\s]+)\)$/.exec(before);
    if (lk) {
      const u = safeUrl(lk[2]) || (/^[\w.-]+\.\w{2,}/.test(lk[2]) ? "https://" + lk[2] : ""); if (!u) return false;
      const start = before.length - lk[0].length; const r = document.createRange(); r.setStart(n, start); r.setEnd(n, off); r.deleteContents();
      const a = h("a", { href: u }, lk[1]); r.insertNode(a); const sp = document.createTextNode("​"); a.after(sp); const nr = document.createRange(); nr.setStart(sp, 1); nr.collapse(true); s.removeAllRanges(); s.addRange(nr); return true;
    }
    for (const [re, tag, dl] of INLINE_MD) {
      const m = re.exec(before); if (!m) continue;
      const start = before.length - m[0].length + m[1].length, txt = m[3];
      const r = document.createRange(); r.setStart(n, start); r.setEnd(n, off); r.deleteContents();
      const w = h(tag, {}, txt); r.insertNode(w);
      const sp = document.createTextNode("​"); w.after(sp);
      const nr = document.createRange(); nr.setStart(sp, 1); nr.collapse(true); s.removeAllRanges(); s.addRange(nr); return true;
    }
    return false;
  }
  function slashDetect(ed, el) {
    if (!el || ed !== edOf(el) || !["p", "h1", "h2", "h3", "ul", "ol", "todo", "quote", "callout", "toggle"].includes(el.dataset.t)) { if (E.slash) closePop(); return; }
    const m = /(^|\s)\/([\w -]{0,24})$/.exec(preText(ed).replace(/\u00a0/g, " "));
    if (!m) { if (E.slash) closePop(); return; }
    if (!E.slash) openSlash(ed, el);
    if (E.slash.query !== m[2]) { E.slash.query = m[2]; E.slash.idx = 0; }
    renderSlash();
  }
  root.addEventListener("input", (e) => {
    const t = e.target;
    if (t.matches("textarea.rb-code-t")) { t.__fit && t.__fit(); const el = rbOf(t); el.__b.x = t.value; touch(); return; }
    if (t.matches(".rb-in")) { const el = rbOf(t); if (t.dataset.k !== "embedurl") { el.__b[t.dataset.k] = t.value; touch(); } return; }
    const ed = t.closest(".rb-e"); if (!ed) return;
    if (/^(<br>)?$/.test(ed.innerHTML)) ed.innerHTML = "";
    const el = rbOf(ed);
    if (el && ed === edOf(el) && e.inputType === "insertText" && mdShortcut(ed, el)) return;
    inlineMd(ed, e); slashDetect(ed, el); touch();
  });

  /* ---------- keys ---------- */
  const prevAny = (el) => { const l = flat().filter(visible), i = l.indexOf(el); return i > 0 ? l[i - 1] : null; };
  const nextAny = (el) => { const l = flat().filter(visible), i = l.indexOf(el); return i >= 0 && i < l.length - 1 ? l[i + 1] : null; };
  const crossSel = () => { const s = sel(); if (!s.rangeCount || s.isCollapsed) return false; const a = edAt(s.anchorNode), b = edAt(s.focusNode); if (!a || !b || a === b) return false; const A = rbOf(a), B = rbOf(b); return edOf(A) === a && edOf(B) === b; };
  function deleteCross() {
    const r = range(), a = edAt(r.startContainer), b = edAt(r.endContainer);
    const f = fragHtml;
    const ra = document.createRange(); ra.selectNodeContents(a); ra.setEnd(r.startContainer, r.startOffset);
    const rb = document.createRange(); rb.selectNodeContents(b); rb.setStart(r.endContainer, r.endOffset);
    const head = f(ra), tl = f(rb), off = ra.toString().replace(ZW, "").length;
    const A = rbOf(a), B = rbOf(b), fl = flat(), ia = fl.indexOf(A), ib = fl.indexOf(B);
    for (let k = ib; k > ia; k--) { const x = fl[k]; if (x.isConnected && !x.contains(A)) x.remove(); }
    a.innerHTML = cleanInline(head + tl); ensureOne(); renumber(); caretTo(a, off); touch(true);
  }
  function enter(el, ed) {
    const t = el.dataset.t;
    const { before, after } = splitHtml(ed);
    const emptyAll = isEmptyHtml(before) && isEmptyHtml(after);
    if (LIST_TYPES.includes(t) && emptyAll) { if ((el.__b.d || 0) > 0) { indent(el, -1); caretTo(ed, "end"); } else focusBlock(convert(el, "p"), "start"); return; }
    if (t === "p" && emptyAll && listOf(el).classList.contains("rb-kids")) { const parent = rbOf(listOf(el)); parent.after(el); renumber(); touch(true); caretTo(ed, "start"); return; }
    if ((t === "quote" || t === "callout") && emptyAll) { focusBlock(convert(el, "p"), "start"); return; }
    if (isEmptyHtml(before) && !isEmptyHtml(after)) { ed.innerHTML = cleanInline(after); const n = mk({ t: "p", h: "" }); el.before(n); caretTo(ed, "start"); touch(true); return; }
    ed.innerHTML = cleanInline(before);
    if (t === "toggle" && el.__b.open) { const kids = $(":scope > .rb-body > .rb-kids", el), first = $(":scope > .rb", kids); const n = mk({ t: "p", h: after }); kids.insertBefore(n, first || $(".rb-addkid", kids)); focusBlock(n, "start"); touch(true); return; }
    const nt = LIST_TYPES.includes(t) ? t : "p";
    const n = insertAfter(el, { t: nt, h: after, ...(LIST_TYPES.includes(t) ? { d: el.__b.d || 0 } : {}), ...(t === "todo" ? { c: false } : {}) }, false);
    focusBlock(n, "start");
  }
  function backspaceStart(el, ed) {
    const t = el.dataset.t;
    if (t !== "p") { if (LIST_TYPES.includes(t) && (el.__b.d || 0) > 0) { indent(el, -1); caretTo(ed, "start"); return; } focusBlock(convert(el, "p"), "start"); return; }
    const pv = prevAny(el); if (!pv) return;
    if (hasEd(pv)) {
      const pe = edOf(pv), off = pe.textContent.replace(ZW, "").length, cur = htmlOf(ed);
      pe.insertAdjacentHTML("beforeend", cur); pe.normalize(); el.remove(); ensureOne(); renumber(); caretTo(pe, off); touch(true);
    } else if (isEmptyHtml(htmlOf(ed))) { el.remove(); ensureOne(); renumber(); selectBlock(pv); touch(true); }
    else selectBlock(pv);
  }
  function keyText(e, ed) {
    const el = rbOf(ed), t = el.dataset.t, k = e.key;
    if (crossSel() && (k === "Backspace" || k === "Delete" || k === "Enter" || (k.length === 1 && !e.metaKey && !e.ctrlKey))) {
      e.preventDefault(); deleteCross();
      if (k.length === 1) document.execCommand("insertText", false, k);
      return;
    }
    if (k === "Enter" && !e.shiftKey && !e.altKey) { e.preventDefault(); enter(el, ed); return; }
    if (k === "Enter" && e.shiftKey) { e.preventDefault(); document.execCommand("insertLineBreak"); touch(); return; }
    if (k === "Backspace" && !e.altKey && atStart(ed)) { e.preventDefault(); backspaceStart(el, ed); return; }
    if (k === "Delete" && atEnd(ed)) {
      const nx = nextText(el);
      if (nx && !nx.contains(el) && nx.dataset.t !== "toggle") { e.preventDefault(); const off = ed.textContent.replace(ZW, "").length; ed.insertAdjacentHTML("beforeend", htmlOf(edOf(nx))); ed.normalize(); nx.remove(); renumber(); caretTo(ed, off); touch(true); }
      return;
    }
    if (k === "Tab" && LIST_TYPES.includes(t)) { e.preventDefault(); const o = caretOffset(ed); indent(el, e.shiftKey ? -1 : 1); caretTo(ed, o); return; }
    if (k === "ArrowUp" && !e.shiftKey && !e.metaKey && !e.altKey && onFirstLine(ed)) { const pv = prevAny(el); if (pv) { e.preventDefault(); focusBlock(pv, "end"); } return; }
    if (k === "ArrowDown" && !e.shiftKey && !e.metaKey && !e.altKey && onLastLine(ed)) { const nx = nextAny(el); if (nx) { e.preventDefault(); focusBlock(nx, "start"); } return; }
    if (k === "ArrowLeft" && !e.shiftKey && atStart(ed)) { const pv = prevAny(el); if (pv) { e.preventDefault(); focusBlock(pv, "end"); } return; }
    if (k === "ArrowRight" && !e.shiftKey && atEnd(ed)) { const nx = nextAny(el); if (nx) { e.preventDefault(); focusBlock(nx, "start"); } return; }
    if (k === "Escape") { e.preventDefault(); selectBlock(el); }
  }
  function keySelected(e, el) {
    const k = e.key;
    if (k === "Backspace" || k === "Delete") { e.preventDefault(); const pv = prevAny(el), nx = nextAny(el); el.remove(); ensureOne(); renumber(); touch(true); clearSel(); const t = pv || nx || root.firstElementChild; if (t) focusBlock(t, "end"); return; }
    if (k === "Enter") { e.preventDefault(); const n = insertAfter(el, { t: "p", h: "" }, false); focusBlock(n, "start"); return; }
    if (k === "ArrowUp" || k === "ArrowLeft") { e.preventDefault(); const pv = prevAny(el); if (pv) focusBlock(pv, "end"); return; }
    if (k === "ArrowDown" || k === "ArrowRight") { e.preventDefault(); const nx = nextAny(el); if (nx) focusBlock(nx, "start"); return; }
    if (k === "Escape") { clearSel(); return; }
    if (k.length === 1 && !e.metaKey && !e.ctrlKey) { e.preventDefault(); const n = insertAfter(el, { t: "p", h: "" }, false); focusBlock(n, "start"); document.execCommand("insertText", false, k); }
  }
  function keyCode(e, ta) {
    const el = rbOf(ta), k = e.key;
    if (k === "Tab") { e.preventDefault(); document.execCommand("insertText", false, "  "); return; }
    if (k === "Backspace" && !ta.value) { e.preventDefault(); removeBlock(el); return; }
    if (k === "Escape") { e.preventDefault(); selectBlock(el); return; }
    if (k === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); const n = el.nextElementSibling?.classList.contains("rb") ? el.nextElementSibling : insertAfter(el, { t: "p", h: "" }, false); focusBlock(n, "start"); return; }
    if (k === "ArrowUp" && ta.selectionStart === 0 && !ta.value.slice(0, 0).includes("\n")) { const pv = prevAny(el); if (pv && ta.selectionStart === 0 && ta.selectionEnd === 0) { e.preventDefault(); focusBlock(pv, "end"); } return; }
    if (k === "ArrowDown" && ta.selectionStart === ta.value.length) { const nx = nextAny(el); if (nx) { e.preventDefault(); focusBlock(nx, "start"); } }
  }
  function keyCell(e, c) {
    const k = e.key, cells = $$(".rb-cell", rbOf(c)), i = cells.indexOf(c), el = rbOf(c);
    const cols = $$("tr:first-child > *", el).length;
    if (k === "Tab") { e.preventDefault(); const j = i + (e.shiftKey ? -1 : 1); if (j >= cells.length) { act(el, "addrow"); return; } if (j >= 0) caretTo(cells[j], "start"); return; }
    if (k === "Enter") { e.preventDefault(); const j = i + cols; if (j >= cells.length) { act(el, "addrow"); return; } caretTo(cells[j], "start"); return; }
    if (k === "ArrowUp" && onFirstLine(c)) { const j = i - cols; if (j >= 0) { e.preventDefault(); caretTo(cells[j], "end"); } else { const pv = prevAny(el); if (pv) { e.preventDefault(); focusBlock(pv, "end"); } } return; }
    if (k === "ArrowDown" && onLastLine(c)) { const j = i + cols; if (j < cells.length) { e.preventDefault(); caretTo(cells[j], "start"); } else { const nx = nextAny(el); if (nx && !el.contains(nx)) { e.preventDefault(); focusBlock(nx, "start"); } } }
  }
  function onKey(e) {
    if (e.isComposing || e.keyCode === 229) return;
    const k = e.key, mod = e.metaKey || e.ctrlKey, t = e.target;
    if (E.slash) {
      if (k === "ArrowDown" || k === "ArrowUp") { e.preventDefault(); const n = E.slash.items.length; if (n) { E.slash.idx = (E.slash.idx + (k === "ArrowDown" ? 1 : n - 1)) % n; renderSlash(); } return; }
      if ((k === "Enter" || k === "Tab") && E.slash.items.length) { e.preventDefault(); slashPick(E.slash.items[E.slash.idx]); return; }
      if (k === "Escape") { e.preventDefault(); closePop(); return; }
    }
    if (mod) {
      const lk = k.toLowerCase();
      if (!e.altKey) {
        if (!e.shiftKey) {
          if (lk === "z") { e.preventDefault(); undo(); return; }
          if (lk === "y") { e.preventDefault(); redo(); return; }
          if (t.closest(".rb-e")) {
            if (lk === "b") { e.preventDefault(); toggleMark("strong"); return; }
            if (lk === "i") { e.preventDefault(); toggleMark("em"); return; }
            if (lk === "u") { e.preventDefault(); toggleMark("u"); return; }
            if (lk === "e") { e.preventDefault(); toggleMark("code"); return; }
            if (lk === "k") { e.preventDefault(); const r = range(); linkAsk(r ? r.getBoundingClientRect() : t.getBoundingClientRect()); return; }
          }
        } else {
          if (lk === "z") { e.preventDefault(); redo(); return; }
          if (t.closest(".rb-e")) {
            if (lk === "x" || lk === "s") { e.preventDefault(); toggleMark("s"); return; }
            if (lk === "h") { e.preventDefault(); const r = range(); const ed = r && edAt(r.commonAncestorContainer); if (ed && !r.collapsed) { if (isMarked(r, markMatch("mark"), ed)) removeMark("mark"); else applyMark("mark", { "data-bg": "yellow" }, { replace: true }); updateBars(); } return; }
          }
          if (k === "ArrowUp" || k === "ArrowDown") { const el = rbOf(t); if (el) { e.preventDefault(); moveBlock(el, k === "ArrowUp" ? -1 : 1); const ed = edOf(el); if (ed) ed.focus(); } return; }
        }
      }
    }
    if (t.classList && t.classList.contains("rb")) return keySelected(e, t);
    if (t.matches("textarea.rb-code-t")) return keyCode(e, t);
    if (t.matches(".rb-cell")) return keyCell(e, t);
    if (t.matches(".rb-cap")) { if (k === "Enter") { e.preventDefault(); const el = rbOf(t); const n = el.nextElementSibling?.classList.contains("rb") ? el.nextElementSibling : insertAfter(el, { t: "p", h: "" }, false); focusBlock(n, "start"); } return; }
    if (t.matches(".rb-in")) { if (k === "Enter") { e.preventDefault(); const el = rbOf(t); if (t.dataset.k === "embedurl") act(el, "embedgo"); else { const n = el.nextElementSibling?.classList.contains("rb") ? el.nextElementSibling : insertAfter(el, { t: "p", h: "" }, false); focusBlock(n, "start"); } } return; }
    if (t.matches(".rb-e")) keyText(e, t);
  }
  root.addEventListener("keydown", onKey);

  /* ---------- paste, cut, drop ---------- */
  const INLINE_TAGS = new Set(["b", "strong", "i", "em", "u", "s", "strike", "del", "code", "a", "span", "mark", "br", "sub", "sup", "kbd", "font", "small", "big", "abbr", "cite", "q", "label", "time"]);
  function domBlocks(node, depth = 0) {
    const out = [], buf = [];
    const flush = () => { const s = cleanInline(buf.join("")); if (stripTags(s).replace(/ /g, " ").trim()) out.push({ t: "p", h: s }); buf.length = 0; };
    for (const n of node.childNodes) {
      if (n.nodeType === 3) { buf.push(esc(n.data.replace(/\s+/g, " "))); continue; }
      if (n.nodeType !== 1) continue;
      const tag = n.tagName.toLowerCase();
      if (["script", "style", "meta", "link", "title", "head"].includes(tag)) continue;
      if (INLINE_TAGS.has(tag)) { buf.push(n.outerHTML); continue; }
      flush();
      if (/^h[1-6]$/.test(tag)) { const lv = Math.min(3, +tag[1]); out.push({ t: "h" + lv, h: cleanInline(n.innerHTML) }); }
      else if (tag === "ul" || tag === "ol") { for (const li of n.children) { if (li.tagName.toLowerCase() !== "li") continue; const clone = li.cloneNode(true); $$("ul,ol", clone).forEach((x) => x.remove()); const cb = li.querySelector('input[type="checkbox"]'); out.push({ t: cb ? "todo" : tag, h: cleanInline(clone.innerHTML), d: Math.min(3, depth), ...(cb && cb.checked ? { c: true } : {}) }); $$(":scope > ul, :scope > ol", li).forEach((sub) => out.push(...domBlocks({ childNodes: [sub] }, depth + 1))); } }
      else if (tag === "blockquote") out.push({ t: "quote", h: cleanInline(n.innerHTML.replace(/<\/?p[^>]*>/g, " ")) });
      else if (tag === "pre") out.push({ t: "code", x: n.textContent.replace(/\n$/, ""), lang: "" });
      else if (tag === "hr") out.push({ t: "divider" });
      else if (tag === "img") { const u = safeUrl(n.getAttribute("src"), { relative: false }); if (u) out.push({ t: "image", src: u, alt: n.getAttribute("alt") || "" }); }
      else if (tag === "table") { const rows = $$("tr", n).map((tr) => $$("th,td", tr).map((c) => cleanInline(c.innerHTML))); if (rows.length) out.push({ t: "table", rows, hr: !!n.querySelector("th") }); }
      else if (tag === "figure") out.push(...domBlocks(n, depth));
      else if (tag === "p" || (tag === "div" && !n.querySelector("p,div,h1,h2,h3,h4,h5,h6,ul,ol,pre,blockquote,table,img,hr"))) { const s = cleanInline(n.innerHTML); if (stripTags(s).trim() || /<img/.test(n.innerHTML)) { if (n.querySelector("img") && !stripTags(s).trim()) out.push(...domBlocks(n, depth)); else out.push({ t: "p", h: s }); } }
      else out.push(...domBlocks(n, depth));
    }
    flush(); return out;
  }
  function insertBlocks(list, afterEl) {
    let ref = afterEl, firstNew = null;
    const empty = afterEl.dataset.t === "p" && edOf(afterEl) && isEmptyHtml(htmlOf(edOf(afterEl)));
    list.forEach((b, i) => {
      const n = mk(b);
      if (i === 0 && empty) { afterEl.replaceWith(n); ref = n; } else { ref.after(n); ref = n; }
      firstNew = firstNew || n;
    });
    renumber(); touch(true); focusBlock(ref, "end");
  }
  root.addEventListener("paste", (e) => {
    const t = e.target; if (t.matches("input,textarea")) return;
    const ed = edAt(t); if (!ed && !t.closest(".rb-cell")) return;
    const cd = e.clipboardData; if (!cd) return;
    const files = [...(cd.files || [])].filter((f) => /^image\//.test(f.type));
    const el = rbOf(t);
    if (files.length) { e.preventDefault(); addImages(files, el); return; }
    const html = cd.getData("text/html"), text = (cd.getData("text/plain") || "").replace(/\r\n?/g, "\n");
    e.preventDefault();
    const url = /^https?:\/\/\S+$/.test(text.trim()) ? text.trim() : "";
    const r = range();
    if (url && r && !r.collapsed) { setLink(url); return; }
    if (url && ed === edOf(el) && el.dataset.t === "p" && isEmptyHtml(htmlOf(ed)) && embedInfo(url)) { const n = mk({ t: "embed", url }); el.replaceWith(n); const p = mk({ t: "p", h: "" }); n.after(p); renumber(); touch(true); focusBlock(p, "start"); return; }
    if (url) { document.execCommand("insertHTML", false, `<a href="${esc(url)}">${esc(url)}</a>`); touch(); return; }
    if (t.closest(".rb-cell") || el.dataset.t === "code") { document.execCommand("insertText", false, text.replace(/\n+/g, " ")); return; }
    let list = null;
    if (html && /<(p|div|h[1-6]|ul|ol|li|pre|blockquote|table|img|hr)\b/i.test(html)) { const doc = new DOMParser().parseFromString(html, "text/html"); list = domBlocks(doc.body); }
    else if (/\n/.test(text) || /^(#{1,3}\s|[-*]\s|\d+\.\s|>\s)/.test(text)) list = mdToBlocks(text.replace(/\n(?!\n)/g, "\n\n"));
    if (!list || !list.length) { if (html && !/<(p|div|h[1-6]|ul|ol|li|pre)\b/i.test(html)) { const d = new DOMParser().parseFromString(html, "text/html"); document.execCommand("insertHTML", false, cleanInline(d.body.innerHTML)); } else document.execCommand("insertText", false, text); touch(); return; }
    if (list.length === 1 && list[0].t === "p") { document.execCommand("insertHTML", false, list[0].h); touch(); return; }
    insertBlocks(list, el);
  });
  root.addEventListener("cut", (e) => { if (crossSel()) { const text = sel().toString(); e.clipboardData?.setData("text/plain", text); e.preventDefault(); deleteCross(); } });
  const overFiles = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
  host.addEventListener("dragover", (e) => { if (overFiles(e)) { e.preventDefault(); host.classList.add("drop-files"); } });
  host.addEventListener("dragleave", (e) => { if (!host.contains(e.relatedTarget)) host.classList.remove("drop-files"); });
  host.addEventListener("drop", (e) => {
    host.classList.remove("drop-files");
    const files = [...(e.dataTransfer?.files || [])]; if (!files.length) return;
    e.preventDefault();
    const bl = flat().filter(visible); let ref = bl[bl.length - 1];
    for (const b of bl) { const rc = b.getBoundingClientRect(); if (e.clientY < rc.bottom) { ref = b; break; } }
    addImages(files, ref);
  });

  /* ---------- dragging blocks around ---------- */
  const scroller = () => { let n = host.parentElement; while (n && n !== document.body) { const o = getComputedStyle(n).overflowY; if (/(auto|scroll)/.test(o) && n.scrollHeight > n.clientHeight) return n; n = n.parentElement; } return null; };
  root.addEventListener("pointerdown", (e) => {
    const g = e.target.closest(".rb-grip"); if (!g) return;
    const el = rbOf(g); e.preventDefault();
    const d = (E.pd = { el, x: e.clientX, y: e.clientY, moved: false, rc: g.getBoundingClientRect() });
    const mv = (ev) => {
      if (!d.moved && Math.hypot(ev.clientX - d.x, ev.clientY - d.y) < 7) return;
      if (!d.moved) { d.moved = true; el.classList.add("dragging"); host.classList.add("is-dragging"); d.ghost = h("div", { class: "rte-ghost rte-ui" }, stripTags(htmlOf(edOf(el) || document.createElement("div"))).slice(0, 60) || label(el.dataset.t)); d.ind = h("div", { class: "rte-drop rte-ui" }); document.body.append(d.ghost, d.ind); d.sc = scroller(); }
      d.ghost.style.left = ev.clientX + 12 + "px"; d.ghost.style.top = ev.clientY + 8 + "px";
      if (d.sc) { const sr = d.sc.getBoundingClientRect(); if (ev.clientY < sr.top + 60) d.sc.scrollTop -= 14; else if (ev.clientY > sr.bottom - 60) d.sc.scrollTop += 14; }
      let ref = null, before = true; const bl = flat().filter((b) => visible(b) && b !== el && !el.contains(b));
      for (const b of bl) { const rc = b.getBoundingClientRect(); if (ev.clientY < rc.bottom && rc.height) { ref = b; before = ev.clientY < rc.top + rc.height / 2; break; } }
      if (!ref && bl.length) { ref = bl[bl.length - 1]; before = false; }
      d.drop = ref ? { ref, before } : null;
      if (ref) { const rc = ref.getBoundingClientRect(); d.ind.style.cssText = `left:${rc.left}px;width:${rc.width}px;top:${(before ? rc.top : rc.bottom) - 1}px;display:block`; } else d.ind.style.display = "none";
    };
    const up = (ev) => {
      document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
      el.classList.remove("dragging"); host.classList.remove("is-dragging"); d.ghost?.remove(); d.ind?.remove(); E.pd = null;
      if (!d.moved) { blockMenu(el, d.rc); return; }
      if (d.drop && ev.type !== "pointercancel") { if (d.drop.before) d.drop.ref.before(el); else d.drop.ref.after(el); ensureOne(); renumber(); touch(true); }
    };
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
  });

  /* ---------- listeners that live on the document ---------- */
  const onSel = () => { rafBars(); if (E.slash) { const a = edAt(sel().anchorNode); if (a !== E.slash.ed) closePop(); } };
  document.addEventListener("selectionchange", onSel);
  const onVV = () => rafBars();
  window.visualViewport?.addEventListener("resize", onVV); window.visualViewport?.addEventListener("scroll", onVV);
  host.addEventListener("focusin", (e) => { if (e.target.closest(".rb-e,.rb-cell,.rb-cap,textarea,.rb-in")) clearSel(); rafBars(); });
  host.addEventListener("focusout", () => setTimeout(() => { if (E.destroyed) return; if (!host.contains(document.activeElement) && !(E.pop && E.pop.contains(document.activeElement))) { E.fbar?.classList.remove("show"); E.mbar?.classList.remove("show"); } }, 150));
  host.addEventListener("keyup", rafBars); host.addEventListener("mouseup", rafBars);
  window.addEventListener("scroll", () => E.fbar?.classList.remove("show"), true);

  /* ---------- go ---------- */
  render(opts.blocks);
  const api = {
    root, host,
    getBlocks: blocks,
    setBlocks(arr) { render(arr); },
    focus(where = "end") { const l = textBlocks(); const t = where === "start" ? l[0] : l[l.length - 1]; if (t) focusBlock(t, where); },
    undo, redo,
    flush() { clearTimeout(E.timers.c); clearTimeout(E.timers.h); snap(); return blocks(); },
    uploading: () => E.uploading,
    isEmpty() { const b = blocks(); return !b.length || (b.length === 1 && b[0].t === "p" && !b[0].h); },
    insertImages(files) { const l = flat(); addImages([...files], l[l.length - 1]); },
    destroy() {
      E.destroyed = true; closePop(); E.fbar?.remove(); E.mbar?.remove();
      document.removeEventListener("selectionchange", onSel); window.visualViewport?.removeEventListener("resize", onVV); window.visualViewport?.removeEventListener("scroll", onVV);
      clearTimeout(E.timers.h); clearTimeout(E.timers.c); host.textContent = ""; host.classList.remove("rte");
    },
  };
  return api;
}
