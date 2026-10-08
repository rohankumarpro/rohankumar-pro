// The site's own visitor counts (see /api/sv). No cookies and nothing personal: just what was opened, from where,
// on what kind of device. Never the owner: signed in now, or ever before on this browser. Never robots or the desktop app.
const NO = "noTrack";
const off = () => { try { return localStorage.getItem(NO) === "1"; } catch { return false; } };
const markOwner = () => { try { localStorage.setItem(NO, "1"); } catch {} };

function send(o) {
  if (off()) return;
  const data = JSON.stringify({ ...o, w: screen.width, t: navigator.maxTouchPoints > 1 ? 1 : 0 });
  // a normal request when the page is open (it can tell us the owner is signed in), a beacon when it is closing
  if (o.k === "e" || document.visibilityState === "hidden") { try { navigator.sendBeacon("/api/sv", new Blob([data], { type: "application/json" })); } catch {} return; }
  fetch("/api/sv", { method: "POST", body: data, headers: { "content-type": "application/json" }, keepalive: true, credentials: "same-origin" })
    .then((r) => (r.status === 200 ? r.json() : null)).then((d) => { if (d && d.own) markOwner(); }).catch(() => {});
}

export function startTracking() {
  if (off() || navigator.webdriver || window.__TAURI__ || window.LIVE?.admin) return;
  // the page view is counted once the page is actually seen (a tab opened in the background and never looked at is not a visit)
  const q = new URLSearchParams(location.search);
  const view = () => send({ k: "v", p: location.pathname, r: document.referrer, s: q.get("utm_source") || q.get("ref") || "" });
  if (document.visibilityState === "visible") view();
  else { const once = () => { if (document.visibilityState === "visible") { document.removeEventListener("visibilitychange", once); view(); } }; document.addEventListener("visibilitychange", once); }

  // apps opened (each window once when it opens)
  const openApp = window.openApp;
  // `open` is the desktop's list of open windows (the page's own variable, not the browser's window.open)
  const isOpen = (id) => { try { return typeof open === "object" && !!open[id]; } catch { return false; } };
  if (typeof openApp === "function") window.openApp = function (id, opt) {
    const was = typeof id === "string" && isOpen(id);
    const r = openApp.call(this, id, opt);
    if (typeof id === "string" && !was && isOpen(id)) send({ k: "a", a: id });
    return r;
  };
  // links that leave the site
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[href]"); if (!a) return;
    try { const u = new URL(a.href, location.href); if (u.protocol === "mailto:") send({ k: "o", h: "email" }); else if (/^https?:$/.test(u.protocol) && u.hostname !== location.hostname) send({ k: "o", h: u.hostname }); } catch {}
  }, true);
  // time actually spent looking at the site, sent when the tab is hidden or closed
  let since = document.visibilityState === "visible" ? Date.now() : 0, acc = 0;
  const flush = () => { if (since) { acc += Date.now() - since; since = 0; } const n = Math.round(acc / 1000); if (n >= 1) { send({ k: "e", n }); acc = 0; } };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); else since = Date.now(); });
  addEventListener("pagehide", flush);
  // signing in partway through a visit stops counting on this browser for good
  const oc = window.ownerChanged;
  if (typeof oc === "function") window.ownerChanged = function () { const r = oc.apply(this, arguments); if (window.LIVE?.admin) markOwner(); return r; };
}
