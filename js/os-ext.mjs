// Plugs the newer parts into the desktop: an address for every window, and lazy loading for the bigger apps.
import { h, $, toast } from "/js/lib.mjs";

const SITE_NAME = () => (typeof P !== "undefined" && P.name) || "Rohan Kumar";
const baseTitle = () => `${SITE_NAME()} — ${(typeof P !== "undefined" && P.role) || "Brand Designer"}`;

/* ---------- addresses ---------- */
export const R = {
  pending: null,  // set while a window is being opened from an address, so the app can show the right item straight away
  take(id) { const p = R.pending; if (p && p.id === id && !p.used) { p.used = true; return p.slug; } return ""; },
  handlers: {},   // app id -> (body, slug, quiet) => shows that item, or the app's main view when slug is empty
  applying: false,
  pathFor(id, slug) { return "/" + id + (slug ? "/" + slug : ""); },
  parse(path) {
    const seg = decodeURIComponent(path).replace(/^\/+|\/+$/g, "").split("/");
    const id = seg[0]; const app = APPS.find((a) => a.id === id);
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
window.closeWin = function (w, id, quiet) { const r = _close.call(this, w, id, quiet); setTimeout(() => R.sync("replace"), 60); return r; };
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
for (const id of ["projects", "links"]) { const i = EDITABLE.indexOf(id); if (i >= 0) EDITABLE.splice(i, 1); }

/* ---------- first load: open the window the address asks for ---------- */
(function boot() {
  const rt = window.__ROUTE__ || {};
  const p = location.pathname;
  const want = R.parse(p).id;
  if (rt.status === 404 && p !== "/") { setTimeout(() => toast("That page doesn't exist. Here is the desktop."), 900); history.replaceState({}, "", "/"); return; }
  if (want) {
    try { window.unlock(); } catch {}
    const go = () => R.apply(p, { first: true });
    if (document.readyState === "complete") setTimeout(go, 120); else window.addEventListener("load", () => setTimeout(go, 120));
  }
})();
window.__extReady = true;
