// The address a visitor asked for. Rules in netlify.toml forward pretty addresses to functions with the value in the query
// (/projects/x -> page?p=/projects/x, /u/abc.jpg -> u?f=abc.jpg), but Netlify does not always pass those query values on.
// The original address always arrives, so functions fall back to reading it.
export function reqPath(event) {
  const cands = [event.rawUrl, event.headers && (event.headers["x-nf-original-pathname"] || event.headers["x-original-uri"]), event.path];
  for (const c of cands) {
    if (!c) continue;
    let p = String(c);
    try { if (/^https?:/i.test(p)) p = new URL(p).pathname; } catch { continue; }
    p = p.split("?")[0];
    try { p = decodeURIComponent(p); } catch {}
    if (p && !p.startsWith("/.netlify/") && !p.startsWith("/api/")) return p;
  }
  return "/";
}
// the part of the address after a prefix such as "/u/" or "/go/" ("" when the address does not start with it)
export function afterPrefix(event, prefix) { const p = reqPath(event); return p.startsWith(prefix) ? p.slice(prefix.length) : ""; }
