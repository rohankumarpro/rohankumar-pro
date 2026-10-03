// Plugs the newer parts into the desktop: an address for every window, and lazy loading for the bigger apps.
import "/js/tiling.mjs";
import "/js/music.mjs"; import "/js/app-edit.mjs"; import "/js/os-manage.mjs"; import "/js/focus-extra.mjs";
import { h, $, toast } from "/js/lib.mjs";

const SITE_NAME = () => (typeof P !== "undefined" && P.name) || "Rohan Kumar";
const baseTitle = () => `${SITE_NAME()} — ${(typeof P !== "undefined" && P.role) || "Brand Designer"}`;

/* ---------- addresses ---------- */
export const R = {
  pending: null,  // set while a window is being opened from an address, so the app can show the right item straight away
  take(id) { const p = R.pending; if (p && p.id === id && !p.used) { p.used = true; return p.slug; } return ""; },
  handlers: {},   // app id -> (body, slug, quiet) => shows that item, or the app's main view when slug is empty
  applying: false,
  alias: { wallet: "documents", youtube: "content" }, // the Wallet window keeps its old internal name "documents" so saved settings still work
  pathFor(id, slug) { const n = Object.keys(R.alias).find((k) => R.alias[k] === id) || id; return "/" + n + (slug ? "/" + slug : ""); },
  parse(path) {
    const seg = decodeURIComponent(path).replace(/^\/+|\/+$/g, "").split("/");
    const id = R.alias[seg[0]] || seg[0]; const app = APPS.find((a) => a.id === id);
    return app ? { id, slug: seg.slice(1).join("/") } : { id: "", slug: "" };
  },
  top() {
    const ws = [...document.querySelectorAll(".win")].filter((w) => !w.classList.contains("min") && !w.classList.contains("minimizing") && !w.classList.contains("closing"));
    return ws.sort((a, b) => (+a.style.zIndex || 0) - (+b.style.zIndex || 0)).pop() || null;
  },
  sync(mode = "replace") {
    if (R.applying) return;
    const t = R.top();
    const path = t ? R.pathFor(t.dataset.app, t.dataset.slug || "") : "/";
    const app = t && APPS.find((a) => a.id === t.dataset.app);
    document.title = t ? (t.dataset.title || `${app ? app.title : ""} — ${SITE_NAME()}`) : baseTitle();
    if (path !== location.pathname) { try { history[mode === "push" ? "pushState" : "replaceState"]({ p: path }, "", path); } catch {} }
  },
  // an app calls this when it shows a particular item (an article, a project ...)
  item(body, slug, title, mode = "push") {
    const w = body.closest(".win"); if (!w) return;
    w.dataset.slug = slug || ""; if (title) w.dataset.title = title; else delete w.dataset.title;
    R.sync(mode);
  },
  async apply(path, { first } = {}) {
    const { id, slug } = R.parse(path);
    R.applying = true;
    try {
      if (!id) { if (!first && Object.keys(open).length) window.closeAll(); return; }
      R.pending = { id, slug, used: false };
      window.openApp(id);
      const w = open[id]; if (!w) return;
      const body = $(".body", w), fn = R.handlers[id];
      if (fn && !R.pending.used) await fn(body, slug, true);
      await new Promise((r) => setTimeout(r, 0));
      w.dataset.slug = slug || "";
    } finally { R.applying = false; R.pending = null; R.sync("replace"); }
  },
};
window.Router = R;

const _open = window.openApp;
window.openApp = function (id, opt) { const r = _open.call(this, id, opt); setTimeout(() => R.sync("push"), 0); return r; };
const _focus = window.focus;
window.focus = function (w) { const r = _focus.call(this, w); setTimeout(() => R.sync("replace"), 0); return r; };
const _close = window.closeWin;
window.closeWin = function (w, id, quiet) { try { const b = w.querySelector(".body"); b && b.__flush && b.__flush(); } catch {} const r = _close.call(this, w, id, quiet); setTimeout(() => R.sync("replace"), 60); return r; };
window.addEventListener("popstate", () => R.apply(location.pathname));

/* ---------- lazy apps ---------- */
export function lazyApp(id, mod, fn, extra) {
  const a = APPS.find((x) => x.id === id); if (!a) return;
  const orig = a.render;
  a.render = (body) => {
    const slug = R.take(id);
    body.innerHTML = '<div class="app-loading"><span class="rb-spin"></span></div>';
    return import(mod).then((m) => m[fn](body, slug)).catch((e) => { console.error("app", id, e); if (orig) { const r = orig(body); if (typeof r === "string") body.innerHTML = r; } else body.innerHTML = "<p class='hint'>This app could not load. Check your connection and try again.</p>"; });
  };
}
export function registerApp(app) {
  if (APPS.some((a) => a.id === app.id)) return;
  const i = APPS.findIndex((a) => a.id === "settings");
  APPS.splice(i < 0 ? APPS.length : i, 0, app);
}
window.registerApp = registerApp; window.lazyApp = lazyApp;

lazyApp("projects", "/js/app-projects.mjs", "projectsApp");
lazyApp("links", "/js/app-links.mjs", "linksApp");
lazyApp("journal", "/js/app-journal.mjs", "journalApp");
lazyApp("notes", "/js/app-notes.mjs", "notesApp");
lazyApp("about", "/js/app-about.mjs", "aboutApp");
lazyApp("resume", "/js/app-resume.mjs", "resumeApp");
lazyApp("content", "/js/app-youtube.mjs", "youtubeApp");
/* pages that get a free-form editor under their fixed content */
export function enrichApp(id, key) {
  const a = APPS.find((x) => x.id === id); if (!a) return; const prev = a.render;
  a.render = (body) => {
    const r = prev(body); const done = () => import("/js/rich-section.mjs").then((m) => m.richSection(body, key)).catch((e) => console.error("rich", e));
    if (r && typeof r.then === "function") return r.then(done);
    if (typeof r === "string") body.innerHTML = r; done();
  };
}
window.enrichApp = enrichApp;
for (const [id, key] of [["contact", "contact"], ["timeline", "timeline"]]) enrichApp(id, key);
for (const id of ["projects", "links", "resume"]) { const i = EDITABLE.indexOf(id); if (i >= 0) EDITABLE.splice(i, 1); }

/* ---------- first load: open the window the address asks for ---------- */
export const moreReady = new Promise((res) => { window.__resolveMore = res; });
(async function boot() {
  const rt = window.__ROUTE__ || {};
  const p = location.pathname;
  if (window.__STANDALONE === "links") {
    const box = document.createElement("div"); box.id = "standalone"; box.className = "body"; document.body.append(box);
    try { const m = await import("/js/app-links.mjs"); await m.linksStandalone(box); } catch (e) { console.error("links page", e); box.innerHTML = '<p style="padding:40px;text-align:center">Could not load the links. <a href="/">Open the desktop</a></p>'; }
    return;
  }
  if (rt.status === 404 && p !== "/") { setTimeout(() => toast("That page doesn't exist. Here is the desktop."), 900); history.replaceState({}, "", "/"); return; }
  if (p === "/") return;
  // Apps added by the extras file (Docs, Services, Book a call) exist only once it has loaded, so wait for it before opening an address.
  await Promise.race([moreReady, new Promise((r) => setTimeout(r, 5000))]);
  const want = R.parse(p).id;
  if (!want) return;
  try { window.unlock(); } catch {}
  const go = () => R.apply(p, { first: true });
  if (document.readyState === "complete") setTimeout(go, 120); else window.addEventListener("load", () => setTimeout(go, 120));
})();
/* ---------- installable app + offline ---------- */
export const Install = { evt: null, installed: matchMedia("(display-mode: standalone), (display-mode: window-controls-overlay)").matches || navigator.standalone === true,
  async prompt() { if (!Install.evt) return false; Install.evt.prompt(); const r = await Install.evt.userChoice.catch(() => ({})); Install.evt = null; return r.outcome === "accepted"; },
  can() { return !!Install.evt && !Install.installed; },
  ios() { return /iphone|ipad|ipod/i.test(navigator.userAgent) && !Install.installed; } };
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); Install.evt = e; document.dispatchEvent(new CustomEvent("install-ready")); });
window.addEventListener("appinstalled", () => { Install.installed = true; Install.evt = null; toast("Installed. Find it on your home screen."); });
window.Install = Install;
/* ---------- installed app: the strip behind the window buttons takes the colour of what is under it ---------- */
// Chrome paints that strip in the theme colour and can't make it see-through, so find what sits under the buttons
// (an app window, the lock screen or the wallpaper) and use its colour. Runs again when any of those change.
(function titleBarTint() {
  const wco = navigator.windowControlsOverlay, mq = matchMedia("(display-mode: window-controls-overlay)");
  if (!wco) return;
  const metas = [...document.querySelectorAll('meta[name="theme-color"]')], orig = metas.map((m) => m.content);
  const set = (c) => metas.forEach((m, i) => { const v = c || orig[i]; if (m.content !== v) m.content = v; });
  const hex = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  // any CSS colour (rgb(), color(srgb …), color-mix() …) to [r, g, b, alpha], read back from a 1px canvas
  const px = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const rgba = (s) => { px.clearRect(0, 0, 1, 1); px.fillStyle = "rgba(0,0,0,0)"; px.fillStyle = s || "rgba(0,0,0,0)"; px.fillRect(0, 0, 1, 1); const d = px.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  // the buttons sit on the right on Windows and Linux, on the left on macOS
  const area = () => { const r = wco.getTitlebarAreaRect(), W = innerWidth; return r.x > 0 ? { x: 0, w: Math.round(r.x), h: Math.max(1, Math.round(r.height)) } : { x: Math.round(r.x + r.width), w: W - Math.round(r.x + r.width), h: Math.max(1, Math.round(r.height)) }; };
  let busy = false, again = false, t = 0, wallKey = "", wallCol = "";
  // the colour of the wallpaper under the buttons: drawn off-screen, most common colour wins so a shape edge doesn't give a muddy average
  async function wallpaper(a, desk) {
    const svg = document.querySelector("#wall svg"); if (!svg) return "";
    const W = innerWidth, H = innerHeight, cs = getComputedStyle(desk);
    const key = [desk.dataset.wall, document.documentElement.dataset.theme, matchMedia("(prefers-color-scheme: dark)").matches, W, H, a.x, a.w, a.h].join("|");
    if (key === wallKey) return wallCol;
    const c = svg.cloneNode(true); c.setAttribute("xmlns", "http://www.w3.org/2000/svg"); c.setAttribute("width", W); c.setAttribute("height", H);
    const src = new XMLSerializer().serializeToString(c).replace(/var\((--[\w-]+)\)/g, (_, n) => cs.getPropertyValue(n).trim() || "transparent");
    const img = new Image(); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(src); await img.decode();
    const cv = document.createElement("canvas"); cv.width = a.w; cv.height = a.h;
    const g = cv.getContext("2d", { willReadFrequently: true }); g.drawImage(img, -a.x, 0, W, H);
    const d = g.getImageData(0, 0, a.w, a.h).data, bins = new Map();
    for (let i = 0; i < d.length; i += 16) { const k = (d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | d[i + 2] >> 3, b = bins.get(k) || [0, 0, 0, 0]; b[0]++; b[1] += d[i]; b[2] += d[i + 1]; b[3] += d[i + 2]; bins.set(k, b); }
    let best = null; for (const b of bins.values()) if (!best || b[0] > best[0]) best = b;
    wallKey = key; wallCol = best ? hex(best[1] / best[0], best[2] / best[0], best[3] / best[0]) : "";
    return wallCol;
  }
  // whatever sits under the buttons decides the colour: an app window when one covers that corner, otherwise the wallpaper
  async function tint() {
    if (busy) { again = true; return; }
    const desk = document.getElementById("desk");
    if (!mq.matches || !wco.visible || !desk) return set(null);
    busy = true;
    try {
      const a = area(); if (a.w <= 0) return;
      let layers = [];
      for (const el of document.elementsFromPoint(a.x + a.w / 2, Math.min(a.h - 1, 12))) {
        if (el.id === "wall" || el.closest("#wall") || el === desk || el === document.body || el === document.documentElement) break;
        // the lock screen is a gradient that starts with the third wallpaper colour at 62%
        const c = el.classList.contains("lock") ? [...rgba(getComputedStyle(desk).getPropertyValue("--w3").trim()).slice(0, 3), .62] : rgba(getComputedStyle(el).backgroundColor);
        if (c && c[3] > 0) { layers.push(c); if (c[3] >= .98) break; }
      }
      let base = layers.length && layers[layers.length - 1][3] >= .98 ? null : await wallpaper(a, desk);
      let rgb = base ? [parseInt(base.slice(1, 3), 16), parseInt(base.slice(3, 5), 16), parseInt(base.slice(5, 7), 16)] : null;
      if (!rgb && !layers.length) return set(null);
      // lay the see-through layers (the lock screen tint, glassy panels) over what is below them
      for (const l of layers.reverse()) rgb = rgb ? rgb.map((v, i) => v * (1 - l[3]) + l[i] * l[3]) : l.slice(0, 3);
      set(hex(...rgb));
    } catch (e) { set(null); }
    finally { busy = false; if (again) { again = false; queue(); } }
  }
  // at most one check every 150ms, so a window being dragged or a busy page can't keep postponing it
  const queue = () => { if (!t) t = setTimeout(() => { t = 0; tint(); }, 150); };
  const watch = () => {
    // windows opening, moving and closing, the lock screen, the boot screen leaving, wallpaper and theme changes
    new MutationObserver(queue).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "data-wall"] });
    new MutationObserver(queue).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });
    queue();
  };
  wco.addEventListener("geometrychange", queue); mq.addEventListener("change", queue);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", queue);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch); else watch();
})();
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost") && !/--/.test(location.hostname)) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
window.addEventListener("offline", () => toast("You're offline. What you've already opened still works."));
window.addEventListener("online", () => toast("Back online"));
window.__extReady = true;
setTimeout(() => import("/js/os-more.mjs").catch((e) => console.error("os-more", e)), 400);
import("/js/ctx-apps.mjs").catch((e) => console.error("ctx-apps", e));
