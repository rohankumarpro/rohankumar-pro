// Plugs the newer parts into the desktop: an address for every window, and lazy loading for the bigger apps.
import "/js/tiling.mjs";
import { h, $, toast } from "/js/lib.mjs";

const SITE_NAME = () => (typeof P !== "undefined" && P.name) || "Rohan Kumar";
const baseTitle = () => `${SITE_NAME()} — ${(typeof P !== "undefined" && P.role) || "Brand Designer"}`;

/* ---------- addresses ---------- */
export const R = {
  pending: null,  // set while a window is being opened from an address, so the app can show the right item straight away
  take(id) { const p = R.pending; if (p && p.id === id && !p.used) { p.used = true; return p.slug; } return ""; },
  handlers: {},   // app id -> (body, slug, quiet) => shows that item, or the app's main view when slug is empty
  applying: false,
  alias: { wallet: "documents" }, // the Wallet window keeps its old internal name "documents" so saved settings still work
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
export const Install = { evt: null, installed: matchMedia("(display-mode: standalone)").matches || navigator.standalone === true,
  async prompt() { if (!Install.evt) return false; Install.evt.prompt(); const r = await Install.evt.userChoice.catch(() => ({})); Install.evt = null; return r.outcome === "accepted"; },
  can() { return !!Install.evt && !Install.installed; },
  ios() { return /iphone|ipad|ipod/i.test(navigator.userAgent) && !Install.installed; } };
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); Install.evt = e; document.dispatchEvent(new CustomEvent("install-ready")); });
window.addEventListener("appinstalled", () => { Install.installed = true; Install.evt = null; toast("Installed. Find it on your home screen."); });
window.Install = Install;
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost") && !/--/.test(location.hostname)) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
window.addEventListener("offline", () => toast("You're offline. What you've already opened still works."));
window.addEventListener("online", () => toast("Back online"));
window.__extReady = true;
setTimeout(() => import("/js/os-more.mjs").catch((e) => console.error("os-more", e)), 400);
import("/js/ctx-apps.mjs").catch((e) => console.error("ctx-apps", e));
