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
export const Install = { evt: null, installed: matchMedia("(display-mode: standalone)").matches || navigator.standalone === true,
  async prompt() { if (!Install.evt) return false; Install.evt.prompt(); const r = await Install.evt.userChoice.catch(() => ({})); Install.evt = null; return r.outcome === "accepted"; },
  can() { return !!Install.evt && !Install.installed; },
  ios() { return /iphone|ipad|ipod/i.test(navigator.userAgent) && !Install.installed; } };
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); Install.evt = e; document.dispatchEvent(new CustomEvent("install-ready")); });
window.addEventListener("appinstalled", () => { Install.installed = true; Install.evt = null; toast("Installed. Find it on your home screen."); });
window.Install = Install;
/* ---------- owner's desktop app: the site draws its own window buttons ---------- */
// Only inside the personal desktop app (desktop/ in this repo), whose window has no title bar. Visitors never get this.
(function desktopApp() {
  const T = window.__TAURI__;
  if (!T || !T.window) return;
  const win = T.window.getCurrentWindow(), html = document.documentElement;
  html.classList.add("desk-app");
  const svg = (p) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const IC = { min: '<path d="M6 12h12"/>', max: '<rect x="6" y="6" width="12" height="12" rx="2.5"/>',
    res: '<rect x="5" y="9" width="10" height="10" rx="2.5"/><path d="M9 6.5A1.5 1.5 0 0 1 10.5 5H17a2 2 0 0 1 2 2v6.5a1.5 1.5 0 0 1-1.5 1.5"/>', close: '<path d="M7 7l10 10M17 7 7 17"/>' };
  const box = document.createElement("div"); box.className = "wctl"; box.setAttribute("role", "group"); box.setAttribute("aria-label", "Window");
  const btn = (k, label, fn) => { const b = document.createElement("button"); b.className = "pill topbtn tb-ic wctl-" + k; b.innerHTML = svg(IC[k]); b.title = label; b.setAttribute("aria-label", label); b.onclick = fn; box.append(b); return b; };
  btn("min", "Minimise", () => win.minimize());
  const mx = btn("max", "Maximise", () => win.toggleMaximize().then(() => setTimeout(sync, 150)));
  btn("close", "Close", () => win.close());
  const sync = async () => { const m = await win.isMaximized().catch(() => false); const l = m ? "Restore" : "Maximise"; mx.innerHTML = svg(m ? IC.res : IC.max); mx.title = l; mx.setAttribute("aria-label", l); html.classList.toggle("desk-app-max", m); };
  sync(); win.onResized(sync).catch(() => {});
  // the empty part of the top bar moves the window; a double-click maximises
  document.addEventListener("mousedown", (e) => {
    if (e.button !== 0 || !e.target.matches(".topbar")) return;
    if (e.detail === 2) win.toggleMaximize(); else win.startDragging();
  });
  const mount = () => document.body.append(box);
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
  // once a day, a copy of the owner's backup goes to Documents\Rohan Kumar backups on this PC (the app keeps 14 days).
  // Read only: it downloads /api/backup, the same file Settings offers, and never changes anything on the site.
  const backup = async () => {
    const day = new Date().toLocaleDateString("en-CA"); let last = "";
    try { last = localStorage.getItem("deskBackup") || ""; } catch {}
    if (last === day || !T.core) return;
    try {
      const r = await fetch("/api/backup", { credentials: "same-origin", cache: "no-store" });
      if (!r.ok) return; // not signed in as the owner: nothing to save
      const where = await T.core.invoke("save_backup", { day, json: await r.text() });
      try { localStorage.setItem("deskBackup", day); } catch {}
      console.info("Backup saved to", where);
    } catch (e) { console.warn("Daily backup failed", e); }
  };
  setTimeout(backup, 15000); setInterval(backup, 3 * 60 * 60 * 1000);
})();
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost") && !/--/.test(location.hostname)) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
window.addEventListener("offline", () => toast("You're offline. What you've already opened still works."));
window.addEventListener("online", () => toast("Back online"));
window.__extReady = true;
setTimeout(() => import("/js/os-more.mjs").catch((e) => console.error("os-more", e)), 400);
import("/js/ctx-apps.mjs").catch((e) => console.error("ctx-apps", e));

/* ---------- visitor analytics: Microsoft Clarity (recordings and heatmaps) ---------- */
// Visitors on the live site only. Never the owner (signed in now, or ever before on this browser), the desktop app,
// previews or localhost, so Owner mode, the vault and editing are never recorded. Typed text is masked by Clarity.
// Each app a visitor opens is tagged ("app"), and sent messages, guestbook entries, sign-ups and outbound clicks are events.
(function analytics() {
  const CLARITY = "yrz7r3hbnx";
  if (!/^(www\.)?rohankumar\.pro$/.test(location.hostname) || window.__TAURI__) return;
  const isOwner = () => { try { return localStorage.getItem("noTrack") === "1"; } catch { return false; } };
  const markOwner = () => { try { localStorage.setItem("noTrack", "1"); } catch {} };
  if (isOwner()) return;
  fetch("/api/auth", { cache: "no-store" }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((d) => {
    if (d && d.admin) return markOwner();
    start();
  });
  function start() {
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, "clarity", "script", CLARITY);
    const cl = (...a) => { try { window.clarity(...a); } catch {} };
    // which apps visitors open
    const open = window.openApp;
    if (typeof open === "function") window.openApp = function (id, opt) { if (typeof id === "string") { cl("set", "app", id); cl("event", "open-" + id); } return open.call(this, id, opt); };
    // things visitors send
    const EV = [[/^\/api\/mochi/, "message"], [/^\/api\/guestbook/, "guestbook"], [/^\/api\/hub\?a=subscribe/, "subscribe"]];
    const f = window.fetch;
    window.fetch = function (input, init) {
      const p = f.apply(this, arguments);
      try {
        const url = typeof input === "string" ? input : input && input.url || "", m = (init && init.method || "GET").toUpperCase();
        const path = url.startsWith(location.origin) ? url.slice(location.origin.length) : url;
        const hit = m === "POST" && EV.find(([re]) => re.test(path));
        if (hit) p.then((r) => { if (r.ok) cl("event", hit[1]); }).catch(() => {});
        // the owner signing in partway through a visit: never load Clarity on this browser again, and mask the rest of this one
        if (path.startsWith("/api/auth") && m === "POST") p.then((r) => { if (r.ok) { markOwner(); document.documentElement.setAttribute("data-clarity-mask", "true"); cl("consentv2", { ad_Storage: "denied", analytics_Storage: "denied" }); } }).catch(() => {});
      } catch {}
      return p;
    };
    // clicks that leave the site (Behance, Dribbble, LinkedIn, mail…)
    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest("a[href]"); if (!a) return;
      try { const u = new URL(a.href, location.href); if (u.protocol === "mailto:") cl("event", "out-mail"); else if (u.hostname !== location.hostname) cl("event", "out-" + u.hostname.replace(/^www\./, "")); } catch {}
    }, true);
  }
})();
