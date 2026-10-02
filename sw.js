// Service worker: makes the site open instantly, keeps it usable without a connection, and lets it be installed.
// Pages and the API are always fetched fresh first; only static files are served from the cache.
const VERSION = "rk-v15";
const STATIC = `${VERSION}-static`, PAGES = `${VERSION}-pages`;
const PRECACHE = ["/css/tokens.css", "/css/core.css", "/css/blocks.css", "/css/apps.css", "/js/os-ext.mjs", "/js/lib.mjs", "/shared/blocks.mjs", "/img/avatar.jpg", "/img/icon-192.png", "/manifest.webmanifest"];

self.addEventListener("install", (e) => { e.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE).catch(() => {})).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const isStatic = (u) => /^\/(js|css|shared|img|u)\//.test(u.pathname) || /\.(png|jpe?g|webp|svg|woff2?|ico)$/.test(u.pathname);
async function swr(req, cacheName) {
  const c = await caches.open(cacheName), hit = await c.match(req);
  const net = fetch(req).then((r) => { if (r.ok && r.type === "basic") c.put(req, r.clone()); return r; }).catch(() => hit || Response.error());
  return hit || net;
}
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (u.origin !== location.origin) return;
  if (u.pathname.startsWith("/api/") || u.pathname.startsWith("/go/")) return; // always live (this includes /api/u uploads)
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const c = await caches.open(PAGES);
      try {
        const r = await Promise.race([fetch(req), new Promise((_, rej) => setTimeout(() => rej(new Error("slow")), 4500))]);
        if (r.ok) c.put(req, r.clone());
        return r;
      } catch {
        return (await c.match(req)) || (await c.match("/")) || new Response("You're offline, and this page hasn't been opened before.", { status: 503, headers: { "content-type": "text/plain" } });
      }
    })());
    return;
  }
  if (isStatic(u)) e.respondWith(swr(req, STATIC));
});
self.addEventListener("message", (e) => { if (e.data === "SKIP_WAITING") self.skipWaiting(); });
