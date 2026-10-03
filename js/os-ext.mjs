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
/* ---------- installed app: the strip behind the window buttons takes the wallpaper's colour ---------- */
// Chrome paints that strip in the theme colour and can't make it see-through, so draw the wallpaper off-screen,
// read the colour under the buttons and use it. Runs again when the wallpaper, theme, lock state or window size changes.
(function titleBarTint() {
  const wco = navigator.windowControlsOverlay, mq = matchMedia("(display-mode: window-controls-overlay)");
  if (!wco) return;
  const metas = [...document.querySelectorAll('meta[name="theme-color"]')], orig = metas.map((m) => m.content);
  const set = (c) => metas.forEach((m, i) => { const v = c || orig[i]; if (m.content !== v) m.content = v; });
  const hex = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  let busy = false, again = false, t = 0;
  async function tint() {
    if (busy) { again = true; return; }
    const desk = document.getElementById("desk"), svg = document.querySelector("#wall svg");
    if (!mq.matches || !wco.visible || !desk || !svg) return set(null);
    busy = true;
    try {
      const r = wco.getTitlebarAreaRect(), W = innerWidth, H = innerHeight;
      // the buttons sit on the right on Windows and Linux, on the left on macOS
      const x0 = r.x > 0 ? 0 : Math.round(r.x + r.width), w = r.x > 0 ? Math.round(r.x) : W - x0, h = Math.max(1, Math.round(r.height));
      if (w <= 0) return;
      const cs = getComputedStyle(desk), c = svg.cloneNode(true);
      c.setAttribute("xmlns", "http://www.w3.org/2000/svg"); c.setAttribute("width", W); c.setAttribute("height", H);
      const src = new XMLSerializer().serializeToString(c).replace(/var\((--[\w-]+)\)/g, (_, n) => cs.getPropertyValue(n).trim() || "transparent");
      const img = new Image(); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(src); await img.decode();
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      const g = cv.getContext("2d", { willReadFrequently: true }); g.drawImage(img, -x0, 0, W, H);
      // the most common colour, so a shape edge under the buttons doesn't give a muddy average
      const d = g.getImageData(0, 0, w, h).data, bins = new Map();
      for (let i = 0; i < d.length; i += 16) { const k = (d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | d[i + 2] >> 3, b = bins.get(k) || [0, 0, 0, 0]; b[0]++; b[1] += d[i]; b[2] += d[i + 1]; b[3] += d[i + 2]; bins.set(k, b); }
      let best = null; for (const b of bins.values()) if (!best || b[0] > best[0]) best = b;
      if (!best) return;
      let col = hex(best[1] / best[0], best[2] / best[0], best[3] / best[0]);
      // the lock screen lays a tint of the third wallpaper colour over the desktop
      if (desk.classList.contains("is-locked")) {
        const k = cv.getContext("2d"); k.fillStyle = col; k.fillRect(0, 0, 1, 1); k.globalAlpha = .62; k.fillStyle = cs.getPropertyValue("--w3").trim() || col; k.fillRect(0, 0, 1, 1);
        const p = k.getImageData(0, 0, 1, 1).data; col = hex(p[0], p[1], p[2]);
      }
      set(col);
    } catch (e) { set(null); }
    finally { busy = false; if (again) { again = false; queue(); } }
  }
  const queue = () => { clearTimeout(t); t = setTimeout(tint, 120); };
  const watch = () => {
    const wall = document.getElementById("wall"), desk = document.getElementById("desk");
    if (wall) new MutationObserver(queue).observe(wall, { childList: true });
    if (desk) new MutationObserver(queue).observe(desk, { attributes: true, attributeFilter: ["class", "data-wall"] });
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
