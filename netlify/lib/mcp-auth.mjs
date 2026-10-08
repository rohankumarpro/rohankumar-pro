// Sign-in for the owner's private Claude connector (/api/mcp). OAuth 2.1 with PKCE, the way Claude's custom connectors
// expect it: Claude registers itself, sends the owner to /oauth/authorize, the owner types the site password once,
// and Claude gets a token. Only the owner can approve it; visitors never see any of this.
//
// Storage (new keys only; nothing else is read or written, and none of these go into backups):
//   mcp-client-<id>      {id, name, redirects, created}       an app that registered itself (Claude)
//   mcp-code-<hash>      {client, redirect, challenge, exp}   a one-time code, five minutes
//   mcp-tok-<hash>       {grant, exp}                         an access token (only its hash is kept)
//   mcp-ref-<hash>       {grant, exp}                         a refresh token (only its hash is kept)
//   mcp-grants           [{id, client, name, created, last}]  connections the owner allowed (the Assistant app lists and ends them)
//   rl-mcp               {n, t}                               wrong passwords, to slow down guessing
import { createHash, randomBytes } from "node:crypto";

export const ACCESS_TTL = 8 * 3600e3, REFRESH_TTL = 90 * 864e5, CODE_TTL = 5 * 60e3;
export const GRANTS = "mcp-grants";
export const clientKey = (id) => `mcp-client-${id}`;
export const codeKey = (h) => `mcp-code-${h}`;
export const tokKey = (h) => `mcp-tok-${h}`;
export const refKey = (h) => `mcp-ref-${h}`;
export const hash = (s) => createHash("sha256").update(String(s)).digest("hex").slice(0, 48);
export const secret = (n = 32) => randomBytes(n).toString("base64url");
export const okClient = (v) => typeof v === "string" && /^[\w-]{8,64}$/.test(v);

// where Claude (web, desktop and Claude Code) sends people back after signing in
export function okRedirect(u) {
  try {
    const x = new URL(u);
    if (x.protocol === "https:" && /^(claude\.ai|claude\.com|[\w-]+\.claude\.ai|[\w-]+\.claude\.com)$/.test(x.hostname)) return true;
    if (x.protocol === "http:" && /^(localhost|127\.0\.0\.1)$/.test(x.hostname)) return true;
  } catch {}
  return false;
}

export const s256 = (verifier) => createHash("sha256").update(String(verifier)).digest("base64url");

export function origin(req) {
  const u = new URL(req.url), h = req.headers.get("x-forwarded-host") || req.headers.get("host") || u.host;
  const proto = /^(localhost|127\.)/.test(h) ? "http" : "https";
  return `${proto}://${h}`;
}

export async function issue(store, grant) {
  const access = secret(), refresh = secret(), now = Date.now();
  await store.setJSON(tokKey(hash(access)), { grant, exp: now + ACCESS_TTL });
  await store.setJSON(refKey(hash(refresh)), { grant, exp: now + REFRESH_TTL });
  return { access_token: access, token_type: "Bearer", expires_in: Math.round(ACCESS_TTL / 1000), refresh_token: refresh, scope: "workspace" };
}

// the grant behind a bearer token, or null (also null once the owner ends that connection in Settings)
export async function checkToken(store, header) {
  const m = String(header || "").match(/^Bearer\s+([\w-]{20,200})$/i); if (!m) return null;
  const t = await store.get(tokKey(hash(m[1])), { type: "json" });
  if (!t || t.exp < Date.now()) return null;
  const grants = (await store.get(GRANTS, { type: "json" })) ?? [];
  const g = grants.find((x) => x.id === t.grant); if (!g) return null;
  if (!g.last || Date.now() - g.last > 10 * 60e3) { g.last = Date.now(); await store.setJSON(GRANTS, grants); }
  return g;
}

// wrong passwords: after 8 in a quarter of an hour the page waits until the quarter is over
export async function tooMany(store) { const r = (await store.get("rl-mcp", { type: "json" })) ?? { n: 0, t: 0 }; return Date.now() - r.t < 15 * 60e3 && r.n >= 8; }
export async function missed(store) { const r = (await store.get("rl-mcp", { type: "json" })) ?? { n: 0, t: 0 }; const fresh = Date.now() - r.t > 15 * 60e3; await store.setJSON("rl-mcp", { n: fresh ? 1 : r.n + 1, t: fresh ? Date.now() : r.t }); }
