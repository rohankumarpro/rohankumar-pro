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
const b64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(blob); });
const uploadError = (r) => r.status === 401 ? "You are signed out. Sign in again as the owner." : r.status === 0 ? "No connection, or the picture is too big for the server. Try a smaller one." : r.status === 413 ? "That picture is too big to upload. Try a smaller one." : (r.data.error || "Upload failed") + (r.data.detail ? ": " + r.data.detail : "") + " (" + r.status + ")";
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
    return { url: r.data.url, thumb: r.data.thumb, w: full.w, h: full.h, name: file.name, id: r.data.item.id };
  },
  async file(file) {
    if (file.type !== "application/pdf") throw new Error("Only PDF files can be uploaded.");
    if (file.size > 3 * 1024 * 1024) throw new Error("That file is over 3 MB.");
    const r = await api("/api/upload", { method: "POST", body: { full: await b64(file), name: file.name } });
    if (!r.ok) throw new Error(uploadError(r));
    return { url: r.data.url, name: file.name, size: file.size };
  },
  async list() { const r = await api("/api/upload"); return r.ok ? r.data.items.map((i) => ({ ...i, url: `/u/${i.id}.${i.ext}`, thumb: i.thumb ? `/u/${i.id}-t.${i.ext}` : `/u/${i.id}.${i.ext}` })) : []; },
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
export async function makeEditor(host, { blocks, onChange, placeholder, onStatus } = {}) {
  const { createEditor } = await loadEditor();
  return createEditor(host, {
    blocks, onChange, placeholder, onStatus,
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
export function wireBlocks(el) {
  el.querySelectorAll(".bk-fig img, .bk-gal img").forEach((img) => { img.classList.add("bk-img-zoom"); });
  el.addEventListener("click", (e) => {
    const img = e.target.closest(".bk-fig img, .bk-gal img"); if (!img || e.target.closest("a")) return;
    const all = [...el.querySelectorAll(".bk-fig img, .bk-gal img")];
    lightbox(all.map((i) => ({ src: (i.getAttribute("srcset") ? i.src.replace(/-t\.(jpe?g|png|webp)/, ".$1") : i.currentSrc || i.src).replace(/-t\./, "."), alt: i.alt })), all.indexOf(img));
  });
}
export function lightbox(items, start = 0) {
  let i = start;
  const ov = h("div", { class: "lb-ov", role: "dialog", "aria-modal": "true", "aria-label": "Picture viewer" });
  const img = h("img", { alt: "" }), cap = h("div", { class: "lb-c" });
  const show = () => { img.src = items[i].src; img.alt = items[i].alt || ""; cap.textContent = (items[i].alt || "") + (items.length > 1 ? `  ·  ${i + 1} / ${items.length}` : ""); };
  const close = () => { ov.remove(); document.removeEventListener("keydown", key, true); };
  const go = (d) => { i = (i + d + items.length) % items.length; show(); };
  const key = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } if (e.key === "ArrowRight" && items.length > 1) go(1); if (e.key === "ArrowLeft" && items.length > 1) go(-1); };
  ov.append(img, cap, h("button", { class: "lb-x", "aria-label": "Close", onclick: close, html: icon("x", { size: 22 }) }), items.length > 1 ? [h("button", { class: "lb-p", "aria-label": "Previous", onclick: () => go(-1), html: icon("chevron-left", { size: 26 }) }), h("button", { class: "lb-n", "aria-label": "Next", onclick: () => go(1), html: icon("chevron-right", { size: 26 }) })] : null);
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  let sx = null; ov.addEventListener("pointerdown", (e) => { sx = e.clientX; }); ov.addEventListener("pointerup", (e) => { if (sx != null && items.length > 1) { const dx = e.clientX - sx; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); } sx = null; });
  document.body.append(ov); document.addEventListener("keydown", key, true); show();
}

/* ---------- small interface pieces ---------- */
export async function share(url, title) {
  const full = url.startsWith("http") ? url : location.origin + url;
  if (navigator.share) { try { await navigator.share({ url: full, title }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
  try { await navigator.clipboard.writeText(full); toast("Link copied"); } catch { prompt("Copy this link", full); }
}
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
