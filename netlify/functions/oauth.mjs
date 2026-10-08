// Sign-in for the owner's Claude connector (see netlify/lib/mcp-auth.mjs). Reached through these addresses:
//   /.well-known/oauth-protected-resource[/api/mcp]   which sign-in serves /api/mcp
//   /.well-known/oauth-authorization-server            what this sign-in can do
//   POST /oauth/register                               Claude registers itself
//   GET|POST /oauth/authorize                          the page where the owner allows it (site password)
//   POST /oauth/token                                  codes and refresh tokens become access tokens
//   GET /api/oauth?a=grants  DELETE /api/oauth?a=grants&id=   (owner, signed in) list and end connections
import { getStore } from "@netlify/blobs";
import { isAdmin, passwordOk } from "../lib/session.mjs";
import { isPreviewHost } from "../lib/store.mjs";
import { GRANTS, CODE_TTL, clientKey, codeKey, tokKey, refKey, hash, secret, okClient, okRedirect, s256, origin, issue, tooMany, missed } from "../lib/mcp-auth.mjs";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type, authorization, mcp-protocol-version" };
const J = (d, status = 200, extra = {}) => new Response(JSON.stringify(d), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS, ...extra } });
const E = (error, desc, status = 400) => J({ error, error_description: desc }, status);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function readBody(req) {
  const t = await req.text(); if (!t) return {};
  if ((req.headers.get("content-type") || "").includes("json")) { try { return JSON.parse(t) || {}; } catch { return {}; } }
  return Object.fromEntries(new URLSearchParams(t));
}

function page({ name, q, error }) {
  const hidden = ["client_id", "redirect_uri", "state", "code_challenge", "code_challenge_method", "scope", "resource"].map((k) => q[k] != null ? `<input type="hidden" name="${k}" value="${esc(q[k])}">` : "").join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Allow ${esc(name)}</title><style>
:root{--bg:#f6f7fb;--card:#fff;--fg:#1b1c1f;--mut:#5d6068;--line:#dfe1e7;--pri:#0b57d0;--on:#fff;--err:#b3261e;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--bg:#111318;--card:#1d2026;--fg:#e3e3e8;--mut:#a5a8b1;--line:#353841;--pri:#a8c7fa;--on:#062e6f;--err:#f2b8b5}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:16px}
.c{width:100%;max-width:420px;background:var(--card);border:1px solid var(--line);border-radius:28px;padding:28px}
h1{font-size:22px;font-weight:600;margin:14px 0 6px}p{margin:0 0 12px;color:var(--mut)}ul{margin:0 0 18px;padding-left:20px;color:var(--mut)}li{margin:3px 0}
.ic{width:48px;height:48px;border-radius:16px;background:var(--pri);color:var(--on);display:grid;place-items:center}
label{display:block;font-size:13px;color:var(--mut);margin-bottom:6px}input[type=password]{width:100%;font:inherit;color:inherit;background:transparent;border:1px solid var(--line);border-radius:12px;padding:12px 14px}
input[type=password]:focus{outline:2px solid var(--pri);border-color:transparent}.err{color:var(--err);font-size:14px;margin:10px 0 0}
.row{display:flex;gap:10px;justify-content:flex-end;margin-top:20px}button{font:inherit;font-weight:600;border-radius:999px;padding:10px 20px;cursor:pointer;border:0}
.ok{background:var(--pri);color:var(--on)}.no{background:transparent;color:var(--pri);border:1px solid var(--line)}
</style></head><body><form class="c" method="post" action="/oauth/authorize">
<div class="ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></div>
<h1>Allow ${esc(name)} into your workspace?</h1>
<p>It will be able to read and change, on your behalf:</p>
<ul><li>Workspace pages, databases and tasks</li><li>Planner: calendar and important email</li><li>Studio videos and blocks, Library, Subscriptions</li><li>Your notes (read only)</li></ul>
<p>It never sees the vault. You can end this any time in the Assistant app.</p>
${hidden}<label for="pw">Site password</label><input id="pw" type="password" name="password" autocomplete="current-password" required autofocus>
${error ? `<p class="err" role="alert">${esc(error)}</p>` : ""}
<div class="row"><button class="no" type="submit" name="deny" value="1" formnovalidate>Cancel</button><button class="ok" type="submit">Allow</button></div>
</form></body></html>`;
}
const html = (s, status = 200) => new Response(s, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-frame-options": "DENY", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://claude.ai https://claude.com http://localhost:* http://127.0.0.1:*; frame-ancestors 'none'" } });
const back = (redirect, params) => { const u = new URL(redirect); for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, v); return new Response(null, { status: 302, headers: { location: u.toString(), "cache-control": "no-store" } }); };

export default async (req) => {
  const u = new URL(req.url), q = Object.fromEntries(u.searchParams), m = req.method, event = { headers: Object.fromEntries(req.headers) };
  if (m === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const store = getStore({ name: isPreviewHost(event) ? "site-content-dev" : "site-content", consistency: "strong" });
  const base = origin(req), path = u.pathname;
  // Netlify hands this function the address that was asked for (not the rewritten one), so the step comes from the path
  const r = q.r || (path.startsWith("/.well-known/oauth-protected-resource") ? "resource" : path.startsWith("/.well-known/oauth-authorization-server") ? "as" : (path.match(/^\/oauth\/(register|authorize|token)\/?$/) || [])[1] || "");
  try {
    if (r === "resource") return J({ resource: base + "/api/mcp", authorization_servers: [base], bearer_methods_supported: ["header"], resource_name: "Rohan's workspace" });
    if (r === "as") return J({ issuer: base, authorization_endpoint: base + "/oauth/authorize", token_endpoint: base + "/oauth/token", registration_endpoint: base + "/oauth/register", response_types_supported: ["code"], grant_types_supported: ["authorization_code", "refresh_token"], code_challenge_methods_supported: ["S256"], token_endpoint_auth_methods_supported: ["none"], scopes_supported: ["workspace"] });

    if (r === "register" && m === "POST") {
      const b = await readBody(req), redirects = (Array.isArray(b.redirect_uris) ? b.redirect_uris : []).map(String).slice(0, 10);
      if (!redirects.length || !redirects.every(okRedirect)) return E("invalid_redirect_uri", "Only Claude can connect here.");
      const id = secret(18), c = { id, name: String(b.client_name || "Claude").slice(0, 60), redirects, created: Date.now() };
      await store.setJSON(clientKey(id), c);
      return J({ client_id: id, client_name: c.name, redirect_uris: redirects, grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none", client_id_issued_at: Math.floor(c.created / 1000) }, 201);
    }

    if (r === "authorize") {
      const p = m === "POST" ? await readBody(req) : q;
      const c = okClient(p.client_id) ? await store.get(clientKey(p.client_id), { type: "json" }) : null;
      if (!c) return html(page({ name: "This app", q: {}, error: "This sign-in link is not valid. Start again from Claude." }), 400);
      if (!p.redirect_uri || !c.redirects.includes(p.redirect_uri)) return html(page({ name: c.name, q: {}, error: "This sign-in link is not valid. Start again from Claude." }), 400);
      if (p.response_type && p.response_type !== "code" && m === "GET") return back(p.redirect_uri, { error: "unsupported_response_type", state: p.state });
      if (!p.code_challenge || (p.code_challenge_method || "S256") !== "S256") return back(p.redirect_uri, { error: "invalid_request", error_description: "PKCE (S256) is required", state: p.state });
      if (m === "GET") return html(page({ name: c.name, q: p }));
      if (p.deny) return back(p.redirect_uri, { error: "access_denied", state: p.state });
      if (await tooMany(store)) return html(page({ name: c.name, q: p, error: "Too many wrong passwords. Wait fifteen minutes and try again." }), 429);
      if (!passwordOk(p.password)) { await missed(store); await new Promise((x) => setTimeout(x, 800)); return html(page({ name: c.name, q: p, error: "That password is not right." }), 401); }
      const code = secret();
      await store.setJSON(codeKey(hash(code)), { client: c.id, redirect: p.redirect_uri, challenge: p.code_challenge, exp: Date.now() + CODE_TTL });
      return back(p.redirect_uri, { code, state: p.state });
    }

    if (r === "token" && m === "POST") {
      const b = await readBody(req);
      if (b.grant_type === "authorization_code") {
        const k = codeKey(hash(b.code || "")), c = await store.get(k, { type: "json" });
        if (!c) return E("invalid_grant", "Unknown or used code");
        await store.delete(k); // one use only
        if (c.exp < Date.now() || c.client !== b.client_id || c.redirect !== b.redirect_uri || s256(b.code_verifier || "") !== c.challenge) return E("invalid_grant", "The code does not match");
        const client = await store.get(clientKey(c.client), { type: "json" });
        const grants = (await store.get(GRANTS, { type: "json" })) ?? [], g = { id: secret(9), client: c.client, name: (client && client.name) || "Claude", created: Date.now(), last: Date.now() };
        await store.setJSON(GRANTS, [g, ...grants].slice(0, 20));
        return J(await issue(store, g.id));
      }
      if (b.grant_type === "refresh_token") {
        const k = refKey(hash(b.refresh_token || "")), t = await store.get(k, { type: "json" });
        if (!t || t.exp < Date.now()) return E("invalid_grant", "Sign in again");
        const grants = (await store.get(GRANTS, { type: "json" })) ?? [];
        if (!grants.some((x) => x.id === t.grant)) return E("invalid_grant", "This connection was ended");
        await store.delete(k); // a refresh token works once; the new one replaces it
        return J(await issue(store, t.grant));
      }
      return E("unsupported_grant_type", "Use authorization_code or refresh_token");
    }

    // the owner's own list of connections, in Settings
    if (q.a === "grants") {
      if (!isAdmin(event)) return J({ error: "Not signed in" }, 401);
      const grants = (await store.get(GRANTS, { type: "json" })) ?? [];
      if (m === "GET") return J({ grants: grants.map(({ id, name, created, last }) => ({ id, name, created, last })), url: base + "/api/mcp" });
      if (m === "DELETE") { await store.setJSON(GRANTS, grants.filter((x) => x.id !== q.id)); return J({ ok: true }); }
    }
    return J({ error: "Not found" }, 404);
  } catch (e) {
    return J({ error: "server_error", error_description: String(e?.message || e).slice(0, 200) }, 500);
  }
};
