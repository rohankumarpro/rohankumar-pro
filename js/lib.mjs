// Small helpers shared by the desktop's newer apps (Journal, Projects, Links, Notes ...).
// They use the desktop's own globals (esc, LIVE, toast, openApp ...) so everything feels like one system.
import { renderBlocks, esc as escape, stripTags, safeUrl } from "/shared/blocks.mjs";

import { icon } from "/shared/icons.mjs";
export const esc = escape;
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === "class") e.className = v; else if (k === "html") e.innerHTML = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
}
export const G = () => window;
export const toast = (m) => (window.toast ? window.toast(m) : console.log(m));
export const isAdmin = () => !!(window.LIVE && window.LIVE.admin);
export const mobile = () => matchMedia("(max-width:760px)").matches;

/* ---------- talking to the server ---------- */
export async function api(path, { method = "GET", body, headers, keepalive } = {}) {
  try {
    const r = await fetch(path, { method, cache: "no-store", ...(keepalive ? { keepalive: true } : {}), headers: body !== undefined ? { "content-type": "application/json", ...headers } : headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    let data = {};
    try { data = await r.json(); } catch {}
    if (r.status === 401 && isAdmin()) { window.LIVE.admin = false; window.ownerChanged && window.ownerChanged(); }
    return { ok: r.ok, status: r.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: { error: "Offline" } };
  }
}

/* ---------- pictures ---------- */
function loadImg(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => { URL.revokeObjectURL(url); res(im); };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Could not read that picture. Try a JPEG or PNG.")); };
    im.src = url;
  });
}
function scaled(im, max, q, png) {
  let w = im.naturalWidth, hh = im.naturalHeight; const k = Math.min(1, max / Math.max(w, hh));
  w = Math.max(1, Math.round(w * k)); hh = Math.max(1, Math.round(hh * k));
  const c = document.createElement("canvas"); c.width = w; c.height = hh; const x = c.getContext("2d");
  if (!png) { x.fillStyle = "#fff"; x.fillRect(0, 0, w, hh); }
  x.drawImage(im, 0, 0, w, hh);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res({ blob: b, w, h: hh }) : rej(new Error("encode"))), png ? "image/png" : "image/jpeg", q));
}
// Confirms a stored picture can really be fetched (retrying briefly), so an upload that "worked" but cannot be served is reported.
async function mustLoad(url) {
  let status = 0;
  for (let i = 0; i < 4; i++) {
    try { const r = await fetch(url, { cache: "no-store" }); status = r.status; if (r.ok && /^image\//.test(r.headers.get("content-type") || "")) return; } catch { status = 0; }
    await new Promise((res) => setTimeout(res, 400 * (i + 1)));
  }
  throw new Error(`The picture was saved but the server could not show it back (${status || "no connection"}). Try again in a moment.`);
}
const b64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(blob); });
const uploadError = (r) => r.status === 401 ? "You are signed out. Sign in again as the owner." : r.status === 0 ? "No connection, or the picture is too big for the server. Try a smaller one." : r.status === 413 ? "That picture is too big to upload. Try a smaller one." : (r.data.error || "Upload failed") + (r.data.detail ? ": " + r.data.detail : "") + " (" + r.status + ")";
// The picture social sites show when a page is shared: 1200 x 630, cropped from the middle of a picture already on the site
// (a little above the middle for tall pictures, where faces and titles usually are), saved as a small JPEG every app accepts.
export async function shareImage(src) {
  const im = await new Promise((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = () => rej(new Error("Could not read that picture.")); i.src = src; });
  const W = 1200, H = 630, sw = im.naturalWidth, sh = im.naturalHeight; if (!sw || !sh) throw new Error("Could not read that picture.");
  const k = Math.max(W / sw, H / sh), cw = W / k, ch = H / k, cx = (sw - cw) / 2, cy = Math.max(0, Math.min(sh - ch, (sh - ch) * (sh > sw ? 0.3 : 0.5)));
  const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  x.fillStyle = "#fff"; x.fillRect(0, 0, W, H); x.imageSmoothingQuality = "high"; x.drawImage(im, cx, cy, cw, ch, 0, 0, W, H);
  const enc = (q) => new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", q));
  let blob = await enc(0.84); if (blob.size > 330000) blob = await enc(0.74); if (blob.size > 330000) blob = await enc(0.62);
  const r = await api("/api/upload", { method: "POST", body: { full: await b64(blob), name: "share.jpg", w: W, h: H } });
  if (!r.ok) throw new Error(uploadError(r));
  return r.data.url.replace(/^\/api\/u\?f=/, "/u/"); // the clean address every share preview accepts
}

export const Up = {
  // Shrinks a picture in the browser, then stores a full size and a small copy. Returns {url, thumb, w, h, name}.
  async image(file, { max = 2000 } = {}) {
    if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name)) throw new Error("That isn't a picture file.");
    const im = await loadImg(file);
    const png = file.type === "image/png";
    let full = await scaled(im, max, 0.86, png);
    if (png && full.blob.size > 1700000) full = await scaled(im, max, 0.86, false);
    if (full.blob.size > 2300000) full = await scaled(im, Math.round(max * 0.75), 0.78, false);
    if (full.blob.size > 3000000) throw new Error("That picture is too large even after shrinking it. Try a smaller one.");
    const thumb = await scaled(im, 640, 0.8, false);
    const r = await api("/api/upload", { method: "POST", body: { full: await b64(full.blob), thumb: await b64(thumb.blob), name: file.name, w: full.w, h: full.h } });
    if (!r.ok) throw new Error(uploadError(r));
    await mustLoad(r.data.thumb); // never hand back a picture that cannot be shown: say why instead of leaving a broken icon
    return { url: r.data.url, thumb: r.data.thumb, w: full.w, h: full.h, name: file.name, id: r.data.item.id };
  },
  async file(file) {
    if (file.type !== "application/pdf") throw new Error("Only PDF files can be uploaded.");
    if (file.size > 3 * 1024 * 1024) throw new Error("That file is over 3 MB.");
    const r = await api("/api/upload", { method: "POST", body: { full: await b64(file), name: file.name } });
    if (!r.ok) throw new Error(uploadError(r));
    return { url: r.data.url, name: file.name, size: file.size };
  },
  async list() { const r = await api("/api/upload"); return r.ok ? r.data.items.map((i) => ({ ...i, url: `/api/u?f=${i.id}.${i.ext}`, thumb: `/api/u?f=${i.id}${i.thumb ? "-t" : ""}.${i.ext}` })) : []; },
  pick(accept = "image/*", multiple = false) {
    return new Promise((res) => {
      const i = h("input", { type: "file", accept, style: "display:none", ...(multiple ? { multiple: true } : {}) });
      i.addEventListener("change", () => { res([...i.files]); i.remove(); }); i.addEventListener("cancel", () => { res([]); i.remove(); });
      document.body.append(i); i.click();
    });
  },
};

window.Up = Up; // the desktop's own owner forms use it too

/* ---------- the editor, loaded only when someone starts writing ---------- */
let edP = null;
export function loadEditor() {
  if (!edP) {
    if (!document.querySelector('link[href="/css/editor.css"]')) document.head.append(h("link", { rel: "stylesheet", href: "/css/editor.css" }));
    edP = import("/js/editor.mjs");
  }
  return edP;
}
export async function makeEditor(host, { blocks, onChange, placeholder, onStatus, escLeaves, reveal } = {}) {
  const { createEditor } = await loadEditor();
  return createEditor(host, {
    blocks, onChange, placeholder, onStatus, escLeaves, reveal,
    upload: (f) => (f.type === "application/pdf" ? Up.file(f) : Up.image(f)),
    library: () => Up.list(), onError: (m) => toast(m),
  });
}

/* ---------- showing blocks ---------- */
export function showBlocks(el, blocks, opts = {}) {
  el.classList.add("bk-doc");
  el.innerHTML = renderBlocks(blocks, { hBase: opts.hBase ?? 2, media: opts.media || { carousels: typeof CAROUSELS !== "undefined" ? CAROUSELS : {} } });
  wireBlocks(el);
}
const LB_SEL = ".lb-z, .bk-fig img, .bk-gal img";
const fullOf = (i) => (i.dataset.full || i.currentSrc || i.src).replace(/-t\.(jpe?g|png|webp)(\?|$)/, ".$1$2");
// every zoomable picture in the same article (the project cover too), in page order, opening on the one tapped
export function zoomFrom(img) {
  const root = img.closest("[data-lb-root]") || img.closest(".bk-doc") || img.parentElement;
  const all = [...root.querySelectorAll(LB_SEL)].filter((i) => i.offsetParent !== null || i === img);
  lightbox(all.map((i) => ({ src: fullOf(i), thumb: i.currentSrc || i.src, alt: i.alt })), Math.max(0, all.indexOf(img)));
}
export function wireBlocks(el) {
  el.querySelectorAll(".bk-fig img, .bk-gal img").forEach((img) => { img.classList.add("bk-img-zoom"); });
  if (el.__lbWired) return; el.__lbWired = true; // showing the same page again never adds a second viewer
  el.addEventListener("click", (e) => {
    const img = e.target.closest(".bk-fig img, .bk-gal img"); if (!img || e.target.closest("a")) return;
    e.preventDefault(); zoomFrom(img);
  });
}
export function lightbox(items, start = 0) {
  if (!items.length) return;
  document.querySelector(".lb-ov")?.remove();
  let i = Math.min(Math.max(0, start), items.length - 1), tok = 0, swiped = false;
  const back = document.activeElement;
  const ov = h("div", { class: "lb-ov", role: "dialog", "aria-modal": "true", "aria-label": "Picture viewer" });
  const img = h("img", { alt: "", class: "lb-img", draggable: "false" }), cap = h("div", { class: "lb-c" });
  const ready = new Map(), load = (src) => { if (!src) return Promise.resolve(); if (!ready.has(src)) { const im = new Image(); im.decoding = "async"; ready.set(src, new Promise((r) => { im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(r); im.onerror = r; })); im.src = src; } return ready.get(src); };
  const show = async (dir) => {
    const it = items[i], my = ++tok;
    cap.textContent = (it.alt || "") + (items.length > 1 ? `${it.alt ? "  ·  " : ""}${i + 1} / ${items.length}` : "");
    if (dir) { img.style.setProperty("--dx", (dir > 0 ? -30 : 30) + "px"); img.classList.add("out"); }
    else if (!img.src && it.thumb) img.src = it.thumb; // the small picture straight away, the large one when it arrives
    await Promise.all([load(it.src), new Promise((r) => setTimeout(r, dir ? 150 : 0))]); if (my !== tok) return;
    img.style.transition = "none"; img.style.setProperty("--dx", (dir > 0 ? 30 : dir < 0 ? -30 : 0) + "px"); img.src = it.src; img.alt = it.alt || ""; void img.offsetWidth; img.style.transition = "";
    requestAnimationFrame(() => { if (my === tok) { img.style.setProperty("--dx", "0px"); img.classList.remove("out"); } });
    if (items.length > 1) { load(items[(i + 1) % items.length].src); load(items[(i - 1 + items.length) % items.length].src); }
  };
  const close = () => { tok++; document.removeEventListener("keydown", key, true); ov.classList.add("lb-out"); setTimeout(() => ov.remove(), 160); back && back.focus && back.focus({ preventScroll: true }); };
  const go = (d) => { if (items.length < 2) return; i = (i + d + items.length) % items.length; show(d); };
  const key = (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); e.stopPropagation(); go(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); go(-1); }
  };
  const x = h("button", { class: "lb-x", "aria-label": "Close", onclick: close, html: icon("x", { size: 22 }) });
  ov.append(img, cap, x, items.length > 1 ? [h("button", { class: "lb-p", "aria-label": "Previous picture", onclick: () => go(-1), html: icon("chevron-left", { size: 26 }) }), h("button", { class: "lb-n", "aria-label": "Next picture", onclick: () => go(1), html: icon("chevron-right", { size: 26 }) })] : null);
  ov.addEventListener("click", (e) => { if (swiped) { swiped = false; return; } if (e.target === ov) close(); }); // a swipe never closes it
  let sx = null, sy = 0;
  ov.addEventListener("pointerdown", (e) => { if (e.target.closest("button")) return; sx = e.clientX; sy = e.clientY; });
  ov.addEventListener("pointerup", (e) => { if (sx == null) return; const dx = e.clientX - sx, dy = e.clientY - sy; sx = null; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { swiped = true; go(dx < 0 ? 1 : -1); } else if (dy > 90) { swiped = true; close(); } });
  ov.addEventListener("pointercancel", () => (sx = null));
  document.body.append(ov); document.addEventListener("keydown", key, true); x.focus({ preventScroll: true }); show(0);
}

/* ---------- small interface pieces ---------- */
// The share panel: the link with a copy button and the usual places to post it, right on the page.
// The device's own share sheet is one option inside it ("More"), never the first thing people see.
export function share(url, title) {
  const full = url.startsWith("http") ? url : location.origin + url;
  document.querySelector(".shr-dlg")?.remove();
  const back = document.activeElement, e = encodeURIComponent, u = e(full), t = e(title || "");
  const places = [
    ["X", `https://twitter.com/intent/tweet?url=${u}&text=${t}`],
    ["LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${u}`],
    ["Facebook", `https://www.facebook.com/sharer/sharer.php?u=${u}`],
    ["WhatsApp", `https://wa.me/?text=${e((title ? title + " " : "") + full)}`],
    ["Email", `mailto:?subject=${t}&body=${u}`],
  ];
  const close = () => { d.remove(); document.removeEventListener("keydown", onKey, true); back && back.focus && back.focus(); };
  const onKey = (ev) => { if (ev.key === "Escape") { ev.stopPropagation(); close(); } };
  const field = h("input", { class: "shr-url", value: full, readonly: true, "aria-label": "Link", onfocus: (ev) => ev.target.select() });
  const copyBtn = h("button", { type: "button", class: "btn shr-copy", onclick: async () => {
    try { await navigator.clipboard.writeText(full); } catch { field.focus(); field.select(); try { document.execCommand("copy"); } catch {} }
    copyBtn.innerHTML = `${icon("check", { size: 16 })}Copied`; copyBtn.classList.add("done");
    setTimeout(() => { if (copyBtn.isConnected) { copyBtn.innerHTML = `${icon("copy", { size: 16 })}Copy`; copyBtn.classList.remove("done"); } }, 1800);
  }, html: `${icon("copy", { size: 16 })}Copy` });
  const card = h("div", { class: "shr-card", role: "dialog", "aria-modal": "true", "aria-label": "Share" },
    h("div", { class: "shr-head" }, h("b", {}, "Share"), h("button", { type: "button", class: "shr-x", "aria-label": "Close", onclick: close, html: icon("x", { size: 18 }) })),
    title ? h("p", { class: "shr-t" }, title) : null,
    h("div", { class: "shr-row" }, field, copyBtn),
    h("div", { class: "shr-to" }, places.map(([l, href]) => h("a", { class: "shr-p", href, target: "_blank", rel: "noopener", onclick: () => setTimeout(close, 0) }, l)),
      navigator.share ? h("button", { type: "button", class: "shr-p", onclick: async () => { try { await navigator.share({ url: full, title }); close(); } catch {} }, html: `${icon("share", { size: 15 })}More` }) : null));
  const d = h("div", { class: "shr-dlg", onclick: (ev) => { if (ev.target === d) close(); } }, card);
  document.body.append(d); document.addEventListener("keydown", onKey, true);
  copyBtn.focus();
}
window.share = share;
export function chips(host, values, { placeholder = "Add…", suggestions = [], max = 12, onChange } = {}) {
  host.classList.add("chipin");
  const draw = () => {
    host.textContent = "";
    values.forEach((v, i) => host.append(h("span", { class: "chip x" }, v, h("button", { type: "button", "aria-label": "Remove " + v, onclick: () => { values.splice(i, 1); draw(); onChange && onChange(values); } }, "×"))));
    const dl = suggestions.length ? "dl" + Math.random().toString(36).slice(2, 7) : "";
    const inp = h("input", { placeholder, "aria-label": placeholder, maxlength: "40", list: dl });
    const add = () => { const v = inp.value.replace(/,/g, "").trim(); if (v && values.length < max && !values.includes(v)) { values.push(v); draw(); onChange && onChange(values); host.querySelector("input").focus(); } else inp.value = ""; };
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } if (e.key === "Backspace" && !inp.value && values.length) { values.pop(); draw(); onChange && onChange(values); host.querySelector("input").focus(); } });
    inp.addEventListener("blur", add);
    host.append(inp);
    if (dl) host.append(h("datalist", { id: dl }, suggestions.filter((s) => !values.includes(s)).map((s) => h("option", { value: s }))));
  };
  draw();
}
export const fmtNum = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k" : String(n || 0));
export const ago = (ts) => { const s = (Date.now() - ts) / 1000; if (s < 60) return "just now"; if (s < 3600) return Math.round(s / 60) + " min ago"; if (s < 86400) return Math.round(s / 3600) + " h ago"; if (s < 86400 * 30) return Math.round(s / 86400) + " d ago"; return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }); };
export { renderBlocks, stripTags, safeUrl };
// A modal question box in the desktop's own style.
export function confirmBox(msg, ok = "Delete", danger = true) {
  return new Promise((res) => {
    const d = h("div", { class: "own-dlg" }, h("div", { class: "own-card", role: "alertdialog", "aria-modal": "true" }, h("b", {}, msg), h("div", { class: "own-row" }, h("button", { type: "button", onclick: () => { d.remove(); res(false); } }, "Cancel"), h("button", { type: "button", class: danger ? "dangerb" : "", onclick: () => { d.remove(); res(true); } }, ok))));
    document.body.append(d); d.addEventListener("keydown", (e) => { if (e.key === "Escape") { d.remove(); res(false); } }); d.querySelector("button:last-child").focus();
  });
}
