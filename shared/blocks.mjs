// Shared by the browser and the Netlify functions: the block format used by the Journal, Projects, Notes and About.
// It cleans untrusted content, turns blocks into HTML (the same HTML for visitors, search engines and the editor preview),
// extracts plain text, and converts the older markdown articles into blocks. No DOM is needed, so it runs anywhere.

import { icon, iconName } from "./icons.mjs";
export const COLORS = ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"];
export const CALLOUT_TONES = ["gray", "yellow", "green", "blue", "purple", "pink", "red", "orange"];
export const TYPES = ["p", "h1", "h2", "h3", "quote", "callout", "ul", "ol", "todo", "toggle", "code", "divider", "image", "gallery", "embed", "button", "table", "columns", "bookmark", "file", "toc", "carousel"];
const TEXTY = new Set(["p", "h1", "h2", "h3", "quote", "callout", "ul", "ol", "todo", "toggle"]);
export const isTexty = (t) => TEXTY.has(t);

export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const str = (v, n) => String(v ?? "").slice(0, n);
export const slugify = (t) => String(t || "").toLowerCase().replace(/<[^>]*>/g, "").replace(/\*/g, "").replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
export const rid = () => Math.random().toString(36).slice(2, 10);

/* ---------- URLs ---------- */
export function safeUrl(u, { relative = true } = {}) {
  const s = String(u ?? "").trim().replace(/[\u0000-\u001f\u007f\s]+/g, (m) => (m.includes(" ") ? "%20" : ""));
  if (!s || s.length > 2000) return "";
  if (/^(https?:\/\/|mailto:|tel:)/i.test(s)) return s;
  if (relative && /^(\/(?!\/)|#)/.test(s)) return s;
  return "";
}
// Pictures may come from this site's uploads, other web addresses, or the old inline data pictures.
export function safeImg(u) {
  const s = String(u ?? "").trim();
  if (/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(s) && s.length < 400000) return s;
  return safeUrl(s).startsWith("mailto") || /^tel:/i.test(s) ? "" : safeUrl(s);
}

/* ---------- inline HTML (bold, links, colour ...) ---------- */
const INLINE_MAP = { b: "strong", strong: "strong", i: "em", em: "em", u: "u", s: "s", strike: "s", del: "s", code: "code", a: "a", mark: "mark", span: "span", br: "br", sub: "sub", sup: "sup", kbd: "kbd" };
const VOID = new Set(["br"]);
const ENT = /^&(amp|lt|gt|quot|#39|nbsp|#\d{1,5}|#x[0-9a-f]{1,4});/i;
function escText(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "&") out += ENT.test(s.slice(i, i + 12)) ? "&" : "&amp;";
    else if (c === "<") out += "&lt;";
    else if (c === ">") out += "&gt;";
    else out += c;
  }
  return out;
}
export function cleanInline(html, max = 20000) {
  const src = String(html ?? "").slice(0, max);
  const parts = src.split(/(<[^>]*>)/);
  const stack = [];
  let out = "";
  for (const p of parts) {
    if (!p) continue;
    if (p[0] !== "<" || p.length < 3) { out += escText(p); continue; }
    const m = p.match(/^<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)([^>]*)>$/);
    if (!m) { out += escText(p); continue; }
    const close = !!m[1], name = INLINE_MAP[m[2].toLowerCase()];
    if (!name) continue;
    if (close) {
      const i = stack.lastIndexOf(name);
      if (i < 0) continue;
      while (stack.length > i) out += `</${stack.pop()}>`;
      continue;
    }
    if (name === "br") { out += "<br>"; continue; }
    let attrs = "";
    const attr = (n) => { const r = new RegExp(`\\b${n}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(m[3]); return r ? (r[1] ?? r[2] ?? r[3] ?? "") : ""; };
    if (name === "a") { const h = safeUrl(attr("href").replace(/&amp;/g, "&")); if (!h) { continue; } attrs = ` href="${esc(h)}"`; }
    if (name === "span") { const c = attr("data-tc"); if (!COLORS.includes(c)) continue; attrs = ` data-tc="${c}"`; }
    if (name === "mark") { const c = attr("data-bg") || "yellow"; attrs = ` data-bg="${COLORS.includes(c) ? c : "yellow"}"`; }
    out += `<${name}${attrs}>`; stack.push(name);
  }
  while (stack.length) out += `</${stack.pop()}>`;
  return out;
}
export const stripTags = (h) => String(h ?? "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

/* ---------- embeds ---------- */
export function embedInfo(url) {
  const u = safeUrl(url, { relative: false });
  if (!/^https?:/i.test(u)) return null;
  let m;
  if ((m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i)))
    return { kind: "YouTube", src: `https://www.youtube-nocookie.com/embed/${m[1]}`, ratio: u.includes("/shorts/") ? "9/16" : "16/9", thumb: `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` };
  if ((m = u.match(/vimeo\.com\/(?:video\/)?(\d{5,12})/i))) return { kind: "Vimeo", src: `https://player.vimeo.com/video/${m[1]}`, ratio: "16/9" };
  if ((m = u.match(/loom\.com\/(?:share|embed)\/([a-f0-9]{20,40})/i))) return { kind: "Loom", src: `https://www.loom.com/embed/${m[1]}`, ratio: "16/9" };
  if (/^https:\/\/(www\.)?figma\.com\/(file|design|proto|board|slides)\//i.test(u)) return { kind: "Figma", src: `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(u)}`, ratio: "4/3" };
  if ((m = u.match(/open\.spotify\.com\/(track|album|playlist|episode|show|artist)\/([\w]+)/i))) return { kind: "Spotify", src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, ratio: m[1] === "track" || m[1] === "episode" ? "16/5" : "4/5", fixedH: m[1] === "track" || m[1] === "episode" ? 152 : 380 };
  if ((m = u.match(/soundcloud\.com\/[\w-]+\/[\w-]+/i))) return { kind: "SoundCloud", src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(u)}`, ratio: "16/9", fixedH: 166 };
  if ((m = u.match(/codepen\.io\/([\w-]+)\/(?:pen|full|embed)\/(\w+)/i))) return { kind: "CodePen", src: `https://codepen.io/${m[1]}/embed/${m[2]}?default-tab=result`, ratio: "16/9" };
  if ((m = u.match(/instagram\.com\/(p|reel|tv)\/([\w-]+)/i))) return { kind: "Instagram", src: `https://www.instagram.com/${m[1]}/${m[2]}/embed`, ratio: "4/5", fixedH: 640 };
  if (/^https:\/\/(www\.)?behance\.net\/gallery\/(\d+)/i.test(u) && (m = u.match(/gallery\/(\d+)/))) return { kind: "Behance", src: `https://www.behance.net/embed/project/${m[1]}?ilo0=1`, ratio: "4/3" };
  if (/^https:\/\/(www\.)?google\.com\/maps\/embed/i.test(u)) return { kind: "Google Maps", src: u, ratio: "4/3" };
  if ((m = u.match(/^https:\/\/(?:www\.)?(?:cal\.com|calendly\.com)\/[\w./-]+/i))) return { kind: "Booking", src: u + (u.includes("?") ? "&" : "?") + "embed=true", ratio: "4/5", fixedH: 640 };
  return null;
}

/* ---------- cleaning blocks ---------- */
const ALIGN = ["l", "c", "r"];
function cleanOne(b, depth) {
  if (!b || typeof b !== "object" || !TYPES.includes(b.t)) return null;
  const o = { id: /^[\w-]{3,16}$/.test(b.id || "") ? b.id : rid(), t: b.t };
  const t = b.t;
  if (TEXTY.has(t)) {
    o.h = cleanInline(b.h);
    if (ALIGN.includes(b.a) && b.a !== "l") o.a = b.a;
  }
  if ((t === "ul" || t === "ol" || t === "todo") && Number.isInteger(b.d)) o.d = Math.max(0, Math.min(3, b.d));
  if (t === "todo" && b.c) o.c = true;
  if (t === "callout") { o.e = iconName(b.e, "bulb"); o.tone = CALLOUT_TONES.includes(b.tone) ? b.tone : "gray"; }
  if (t === "toggle") { o.k = depth < 3 ? cleanBlocks(b.k, depth + 1) : []; if (b.open) o.open = true; }
  if (t === "code") { o.x = str(b.x, 30000); o.lang = str(b.lang, 20).replace(/[^\w+#.-]/g, ""); }
  if (t === "image") {
    o.src = safeImg(b.src); if (!o.src) return null;
    o.alt = str(b.alt, 300); o.cap = cleanInline(b.cap, 1000);
    o.w = ["n", "w", "f"].includes(b.w) ? b.w : "n";
    if (b.link) o.link = safeUrl(b.link);
    if (Number(b.rw) > 0 && Number(b.rh) > 0) { o.rw = Math.min(10000, Math.round(b.rw)); o.rh = Math.min(10000, Math.round(b.rh)); }
  }
  if (t === "gallery") {
    o.imgs = (Array.isArray(b.imgs) ? b.imgs : []).slice(0, 60).map((i) => ({ src: safeImg(i?.src), alt: str(i?.alt, 300), cap: str(i?.cap, 300) })).filter((i) => i.src);
    o.per = [2, 3, 4].includes(b.per) ? b.per : [2, 3, 4].includes(b.cols) ? b.cols : 3; o.mode = ["grid", "masonry", "carousel"].includes(b.mode) ? b.mode : "grid";
    if (!o.imgs.length) return null;
  }
  if (t === "carousel") { o.ref = str(b.ref, 60).replace(/[^\w-]/g, ""); if (!o.ref) return null; }
  if (t === "embed") { const u = safeUrl(b.url, { relative: false }); if (!u) return null; o.url = u; o.cap = cleanInline(b.cap, 600); }
  if (t === "button") { o.label = str(b.label, 80); o.url = safeUrl(b.url); if (!o.label || !o.url) return null; o.style = ["solid", "outline"].includes(b.style) ? b.style : "solid"; }
  if (t === "bookmark") { o.url = safeUrl(b.url, { relative: false }); if (!o.url) return null; o.title = str(b.title, 160); o.desc = str(b.desc, 300); }
  if (t === "file") { o.src = safeUrl(b.src); if (!o.src) return null; o.name = str(b.name || "Download", 160); o.size = Math.max(0, Math.min(1e9, Number(b.size) || 0)); }
  if (t === "table") {
    o.rows = (Array.isArray(b.rows) ? b.rows : []).slice(0, 40).map((r) => (Array.isArray(r) ? r : []).slice(0, 8).map((c) => cleanInline(c, 1000)));
    const w = Math.max(1, ...o.rows.map((r) => r.length)); o.rows = o.rows.map((r) => { while (r.length < w) r.push(""); return r; });
    if (!o.rows.length) o.rows = [["", ""], ["", ""]];
    o.hr = b.hr !== false;
  }
  if (t === "columns") {
    if (depth >= 2) return null;
    o.cols = (Array.isArray(b.cols) ? b.cols : []).slice(0, 4).map((c) => cleanBlocks(c, depth + 1));
    if (o.cols.length < 2) return null;
  }
  return o;
}
export function cleanBlocks(list, depth = 0) {
  const out = [];
  for (const b of (Array.isArray(list) ? list : []).slice(0, depth ? 300 : 1500)) { const c = cleanOne(b, depth); if (c) out.push(c); }
  return out;
}

/* ---------- plain text ---------- */
export function blocksText(blocks, sep = "\n") {
  const out = [];
  const walk = (list) => (list || []).forEach((b) => {
    if (TEXTY.has(b.t)) out.push(stripTags(b.h));
    if (b.t === "code") out.push(b.x);
    if (b.t === "image") { if (b.cap) out.push(stripTags(b.cap)); }
    if (b.t === "embed" && b.cap) out.push(stripTags(b.cap));
    if (b.t === "button") out.push(b.label);
    if (b.t === "bookmark") out.push(`${b.title || ""} ${b.desc || ""}`.trim());
    if (b.t === "table") b.rows.forEach((r) => out.push(r.map(stripTags).join(" | ")));
    if (b.k) walk(b.k);
    if (b.t === "columns") b.cols.forEach(walk);
  });
  walk(blocks);
  return out.filter(Boolean).join(sep);
}
export const wordCount = (blocks) => { const t = blocksText(blocks, " "); return t ? t.split(/\s+/).length : 0; };
export const readMinutes = (blocks) => Math.max(1, Math.round(wordCount(blocks) / 220));
export function firstImage(blocks) {
  let found = "";
  const walk = (list) => { for (const b of list || []) { if (found) return; if (b.t === "image") found = b.src; else if (b.t === "gallery") found = b.imgs[0]?.src || ""; else if (b.k) walk(b.k); else if (b.t === "columns") b.cols.forEach(walk); } };
  walk(blocks); return found;
}
export function headingsOf(blocks) {
  const out = []; const walk = (list) => (list || []).forEach((b) => { if (b.t === "h1" || b.t === "h2" || b.t === "h3") out.push({ id: b.id, level: +b.t[1], text: stripTags(b.h) }); if (b.k) walk(b.k); if (b.t === "columns") b.cols.forEach(walk); });
  walk(blocks); return out;
}

/* ---------- rendering ---------- */
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
function inlineOut(h) {
  // external links open in a new tab and don't pass ranking by default for unknown sites
  return cleanInline(h).replace(/<a href="([^"]*)">/g, (m, href) => {
    const ext = /^https?:/i.test(href.replace(/&amp;/g, "&"));
    return ext ? `<a href="${href}" target="_blank" rel="noopener">` : `<a href="${href}">`;
  });
}
function imgTag(src, alt, o = {}) {
  const m = src.match(/^\/u\/([\w-]+?)(-t)?\.(jpe?g|webp|png)$/);
  const w = o.rw && o.rh ? ` width="${o.rw}" height="${o.rh}"` : "";
  const set = m ? ` srcset="/u/${m[1]}-t.jpg 600w, /u/${m[1]}.jpg 1800w" sizes="${o.sizes || "(max-width: 760px) 100vw, 760px"}"` : "";
  return `<img src="${esc(src)}"${set} alt="${esc(alt || "")}"${w} loading="${o.eager ? "eager" : "lazy"}" decoding="async">`;
}
export function renderBlocks(blocks, opts = {}) {
  const hBase = opts.hBase ?? 2;
  const media = opts.media || {};
  const all = blocks || [];
  const toc = headingsOf(all);
  const heading = (b) => `h${Math.min(6, hBase + (+b.t[1] - 1))}`;
  const al = (b) => (b.a ? ` class="bk-a-${b.a}"` : "");
  function list(items, i) {
    // consecutive ul / ol / todo blocks become nested lists
    let html = "", stack = [];
    const close = (to) => { while (stack.length > to) { html += `</li></${stack.pop().tag}>`; } };
    let j = i;
    for (; j < items.length && ["ul", "ol", "todo"].includes(items[j].t); j++) {
      const b = items[j], d = b.d || 0, tag = b.t === "ol" ? "ol" : "ul", cls = b.t === "todo" ? ' class="bk-todo"' : "";
      if (!stack.length) { html += `<${tag}${cls}>`; stack.push({ tag, d, cls }); }
      else if (d > stack[stack.length - 1].d) { html += `<${tag}${cls}>`; stack.push({ tag, d, cls }); }
      else {
        while (stack.length > 1 && d < stack[stack.length - 1].d) { html += `</li></${stack.pop().tag}>`; }
        const top = stack[stack.length - 1];
        if (top.tag !== tag || top.cls !== cls) { html += `</li></${stack.pop().tag}><${tag}${cls}>`; stack.push({ tag, d, cls }); }
        else html += "</li>";
      }
      html += b.t === "todo"
        ? `<li role="checkbox" aria-checked="${b.c ? "true" : "false"}"${b.c ? ' class="done"' : ""}><span class="bk-cb" aria-hidden="true"></span><span>${inlineOut(b.h)}</span>`
        : `<li>${inlineOut(b.h)}`;
    }
    close(0);
    return { html, next: j };
  }
  function one(b) {
    switch (b.t) {
      case "p": return b.h && stripTags(b.h) ? `<p${al(b)}>${inlineOut(b.h)}</p>` : "";
      case "h1": case "h2": case "h3": return `<${heading(b)} id="${esc(slugify(stripTags(b.h)) || b.id)}"${al(b)}>${inlineOut(b.h)}</${heading(b)}>`;
      case "quote": return `<blockquote${al(b)}>${inlineOut(b.h)}</blockquote>`;
      case "callout": return `<aside class="bk-callout" data-tone="${b.tone}"><span class="bk-ce" aria-hidden="true">${icon(b.e, { size: 22 })}</span><div>${inlineOut(b.h)}</div></aside>`;
      case "toggle": return `<details class="bk-toggle"${b.open ? " open" : ""}><summary>${inlineOut(b.h)}</summary><div>${many(b.k)}</div></details>`;
      case "code": return `<pre class="bk-code"${b.lang ? ` data-lang="${esc(b.lang)}"` : ""}><code>${esc(b.x)}</code></pre>`;
      case "divider": return "<hr>";
      case "image": {
        const img = imgTag(b.src, b.alt, { rw: b.rw, rh: b.rh, sizes: b.w === "f" ? "100vw" : undefined });
        const inner = b.link ? `<a href="${esc(b.link)}"${/^https?:/i.test(b.link) ? ' target="_blank" rel="noopener"' : ""}>${img}</a>` : img;
        return `<figure class="bk-fig bk-w-${b.w}">${inner}${b.cap && stripTags(b.cap) ? `<figcaption>${inlineOut(b.cap)}</figcaption>` : ""}</figure>`;
      }
      case "gallery": return `<div class="bk-gal bk-${b.mode} bk-cols-${b.per}" role="group" aria-label="Gallery">${b.imgs.map((i, n) => `<figure>${imgTag(i.src, i.alt || `Image ${n + 1} of ${b.imgs.length}`, { sizes: "(max-width: 760px) 100vw, 380px" })}${i.cap ? `<figcaption>${esc(i.cap)}</figcaption>` : ""}</figure>`).join("")}</div>`;
      case "carousel": {
        const c = (media.carousels || {})[b.ref]; const S = c ? (Array.isArray(c) ? c : c.slides) : null;
        if (!S?.length) return "";
        return `<div class="bk-gal bk-carousel" style="--ar:${esc(String((c && c.ar) || "4 / 5").replace(/[^0-9 /.]/g, ""))}" role="group" aria-label="Slides">${S.map((s, n) => `<figure>${imgTag(s, `Slide ${n + 1} of ${S.length}`)}</figure>`).join("")}</div>`;
      }
      case "embed": {
        const e = embedInfo(b.url);
        if (!e) return `<p><a href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.url)}</a></p>`;
        const style = e.fixedH ? `height:${e.fixedH}px` : `aspect-ratio:${e.ratio}`;
        return `<figure class="bk-embed" data-kind="${esc(e.kind)}"><div class="bk-frame" style="${style}"><iframe src="${esc(e.src)}" loading="lazy" allowfullscreen title="${esc(e.kind)}" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write"></iframe></div><figcaption>${b.cap && stripTags(b.cap) ? inlineOut(b.cap) + " · " : ""}<a href="${esc(b.url)}" target="_blank" rel="noopener">Open on ${esc(e.kind)}</a></figcaption></figure>`;
      }
      case "button": return `<p class="bk-btn"><a class="btn ${b.style === "outline" ? "tonal" : ""}" href="${esc(b.url)}"${/^https?:/i.test(b.url) ? ' target="_blank" rel="noopener"' : ""}>${esc(b.label)}</a></p>`;
      case "bookmark": return `<a class="bk-bm" href="${esc(b.url)}" target="_blank" rel="noopener"><b>${esc(b.title || host(b.url))}</b>${b.desc ? `<span>${esc(b.desc)}</span>` : ""}<small>${esc(host(b.url))}</small></a>`;
      case "file": return `<a class="bk-file" href="${esc(b.src)}" download><span aria-hidden="true">${icon("paperclip", { size: 20 })}</span><b>${esc(b.name)}</b>${b.size ? `<small>${b.size < 1048576 ? Math.round(b.size / 1024) + " KB" : (b.size / 1048576).toFixed(1) + " MB"}</small>` : ""}</a>`;
      case "table": {
        const [head, ...rest] = b.hr ? b.rows : [null, ...b.rows];
        const cell = (tag) => (c) => `<${tag}>${inlineOut(c)}</${tag}>`;
        return `<div class="bk-tablew"><table>${head ? `<thead><tr>${head.map(cell("th")).join("")}</tr></thead>` : ""}<tbody>${rest.map((r) => `<tr>${r.map(cell("td")).join("")}</tr>`).join("")}</tbody></table></div>`;
      }
      case "columns": return `<div class="bk-cols bk-n${b.cols.length}">${b.cols.map((c) => `<div class="bk-col">${many(c)}</div>`).join("")}</div>`;
      case "toc": return toc.length ? `<nav class="bk-toc" aria-label="Contents"><b>Contents</b><ol>${toc.map((h) => `<li class="l${h.level}"><a href="#${esc(slugify(h.text) || h.id)}">${esc(h.text)}</a></li>`).join("")}</ol></nav>` : "";
      default: return "";
    }
  }
  function many(items) {
    let html = "";
    for (let i = 0; i < (items || []).length;) {
      const b = items[i];
      if (["ul", "ol", "todo"].includes(b.t)) { const r = list(items, i); html += r.html; i = r.next; }
      else { html += one(b); i++; }
    }
    return html;
  }
  return many(all);
}

/* ---------- older markdown articles -> blocks ---------- */
export function mdInline(src) {
  let t = esc(String(src ?? "").replace(/\\\*/g, "\u0001"));
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, "$1<em>$2</em>")
    .replace(/~~(.+?)~~/g, "<s>$1</s>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, a, h) => `<a href="${h.replace(/&amp;/g, "&")}">${a}</a>`);
  return cleanInline(t.replace(/\u0001/g, "*"));
}
export function mdToBlocks(md, { booking = "https://cal.com/rohankumarpro" } = {}) {
  const out = [];
  for (const block of String(md || "").trim().split(/\n\s*\n/)) {
    const L = block.split("\n").map((x) => x.trim()).filter(Boolean);
    if (!L.length) continue;
    if (L.every((x) => /^[-*] /.test(x))) { L.forEach((x) => out.push({ id: rid(), t: "ul", h: mdInline(x.slice(2)), d: 0 })); continue; }
    if (L.every((x) => /^\d+\.\s/.test(x))) { L.forEach((x) => out.push({ id: rid(), t: "ol", h: mdInline(x.replace(/^\d+\.\s/, "")), d: 0 })); continue; }
    const t = L.join(" ");
    let m;
    if (t.startsWith("### ")) out.push({ id: rid(), t: "h3", h: mdInline(t.slice(4)) });
    else if (t.startsWith("## ")) out.push({ id: rid(), t: "h2", h: mdInline(t.slice(3)) });
    else if (t.startsWith("# ")) out.push({ id: rid(), t: "h1", h: mdInline(t.slice(2)) });
    else if (t.startsWith("> ")) out.push({ id: rid(), t: "quote", h: mdInline(L.map((x) => x.replace(/^>\s?/, "")).join(" ")) });
    else if ((m = t.match(/^\[\[carousel:(\w+)\]\]$/))) out.push({ id: rid(), t: "carousel", ref: m[1] });
    else if (t.startsWith("!! ")) { out.push({ id: rid(), t: "callout", e: "phone", tone: "green", h: mdInline(t.slice(3)) }, { id: rid(), t: "button", label: "Book a call", url: booking, style: "solid" }); }
    else if (/^(---|\*\*\*)$/.test(t)) out.push({ id: rid(), t: "divider" });
    else out.push({ id: rid(), t: "p", h: mdInline(t) });
  }
  return out;
}
// A short markdown-ish copy of the blocks, kept next to them for search, old clients and plain-text uses.
export function blocksToMd(blocks) {
  const inl = (h) => String(h || "").replace(/<strong>(.*?)<\/strong>/g, "**$1**").replace(/<em>(.*?)<\/em>/g, "*$1*").replace(/<a href="([^"]*)">(.*?)<\/a>/g, "[$2]($1)").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ");
  const out = []; let prev = "";
  const walk = (list) => (list || []).forEach((b) => {
    let s = "";
    if (b.t === "p") s = inl(b.h); else if (b.t === "h1") s = "# " + inl(b.h); else if (b.t === "h2") s = "## " + inl(b.h); else if (b.t === "h3") s = "### " + inl(b.h);
    else if (b.t === "quote") s = "> " + inl(b.h); else if (b.t === "callout") s = `> ${inl(b.h)}`;
    else if (b.t === "ul") s = "- " + inl(b.h); else if (b.t === "todo") s = `- [${b.c ? "x" : " "}] ` + inl(b.h); else if (b.t === "ol") s = "1. " + inl(b.h);
    else if (b.t === "toggle") { s = inl(b.h); out.push(s); walk(b.k); prev = "toggle"; return; }
    else if (b.t === "code") s = "```\n" + b.x + "\n```"; else if (b.t === "divider") s = "---";
    else if (b.t === "image") s = `![${b.alt || ""}](${b.src})`; else if (b.t === "button") s = `[${b.label}](${b.url})`;
    else if (b.t === "columns") { b.cols.forEach(walk); return; }
    else if (b.t === "embed") s = b.url; else if (b.t === "table") s = b.rows.map((r) => r.map(inl).join(" | ")).join("\n");
    else if (b.t === "gallery") s = b.imgs.map((i) => `![${i.alt || ""}](${i.src})`).join(" ");
    if (!s) return;
    const list = ["ul", "ol", "todo"].includes(b.t);
    out.push(list && ["ul", "ol", "todo"].includes(prev) ? "\u0000" + s : s); prev = b.t;
  });
  walk(blocks);
  return out.join("\n\n").replace(/\n\n\u0000/g, "\n");
}
