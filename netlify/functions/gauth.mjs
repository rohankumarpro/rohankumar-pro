// /api/gauth   Owner only. Google accounts for the Planner (Calendar and Gmail), see netlify/lib/gapi.mjs.
//   GET ?a=start                 sign in with Google (sends you to Google, which sends you back here)
//   GET ?code=…&state=…          Google sending you back: the account is saved, then you land in Settings
//   GET                          {oauth, redirect, accounts}
//   PUT ?id=<id> {cal, mail, color, cals}    what an account is used for
//   POST ?a=test&id=<id>         tries Calendar and Gmail and says exactly what is missing
//   DELETE ?id=<id>              disconnects an account (and tells Google to forget the login)
// Only the live site connects accounts; preview addresses never touch your Google account.
import { connectLambda } from "@netlify/blobs";
import { isAdmin, body, json } from "../lib/session.mjs";
import { contentStore, isPreviewHost } from "../lib/store.mjs";
import { ACCTS, accounts, saveAccounts, tokKey, seal, unseal, signState, readState, oauthReady, g, SCOPES, COLORS } from "../lib/gapi.mjs";

const env = (k) => String(process.env[k] || "").trim();
const host = (event) => String(event.headers["x-forwarded-host"] || event.headers.host || "rohankumar.pro").split(",")[0].trim();
const redirectUri = (event) => `https://${host(event)}/api/gauth`;
const go = (to) => ({ statusCode: 302, headers: { location: to, "cache-control": "no-store" }, body: "" });
const rid = () => Math.random().toString(36).slice(2, 10);

export const handler = async (event) => {
  try {
    connectLambda(event);
    const q = event.queryStringParameters || {}, m = event.httpMethod, store = contentStore(event), preview = isPreviewHost(event);
    // Google sending the owner back. The sign-in cookie is not sent on this hop (it is strict), so the signed state is the proof.
    if (m === "GET" && (q.code || q.error)) {
      const st = readState(q.state); if (!st) return go("/settings?google=expired");
      if (q.error) return go("/settings?google=" + encodeURIComponent(q.error === "access_denied" ? "cancelled" : "failed"));
      const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code: q.code, client_id: env("GOOGLE_OAUTH_CLIENT_ID"), client_secret: env("GOOGLE_OAUTH_CLIENT_SECRET"), redirect_uri: redirectUri(event), grant_type: "authorization_code" }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.access_token) return go("/settings?google=failed");
      const who = await (await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: "Bearer " + d.access_token } })).json().catch(() => ({}));
      const email = String(who.email || "").toLowerCase(); if (!email) return go("/settings?google=failed");
      const list = (await store.get(ACCTS, { type: "json" })) ?? [];
      let a = list.find((x) => x.kind === "oauth" && x.email === email);
      if (!a) { a = { id: rid(), email, kind: "oauth", added: Date.now(), cal: true, mail: true, color: COLORS[list.length % COLORS.length] }; list.push(a); }
      const granted = String(d.scope || "");
      a.scopes = { cal: granted.includes(SCOPES.cal), mail: granted.includes(SCOPES.mail) };
      // Google only sends a lasting login the first time; keep the one we have if none came this time
      if (d.refresh_token) await store.setJSON(tokKey(a.id), seal(d.refresh_token));
      else if (!(await store.get(tokKey(a.id), { type: "json" }))) return go("/settings?google=norefresh");
      await store.setJSON(ACCTS, list);
      return go("/settings?google=connected&email=" + encodeURIComponent(email));
    }
    if (!isAdmin(event)) return m === "GET" && q.a === "start" ? go("/settings?google=signin") : json({ error: "Not signed in" }, 401);
    if (m === "GET" && q.a === "start") {
      if (preview) return go("/settings?google=preview");
      if (!oauthReady()) return go("/settings?google=setup");
      const p = new URLSearchParams({ client_id: env("GOOGLE_OAUTH_CLIENT_ID"), redirect_uri: redirectUri(event), response_type: "code", access_type: "offline", prompt: "consent select_account", include_granted_scopes: "true", scope: ["openid", "email", SCOPES.cal, SCOPES.mail].join(" "), state: signState({ n: rid() }) });
      return go("https://accounts.google.com/o/oauth2/v2/auth?" + p);
    }
    if (m === "GET") { const list = await accounts(store); return json({ oauth: oauthReady(), preview, redirect: redirectUri(event), accounts: list.map(({ id, email, kind, added, cal, mail, color, scopes, cals }) => ({ id, email, kind, added, cal: cal !== false, mail: mail !== false, color, scopes, cals })) }); }
    const list = await accounts(store), a = list.find((x) => x.id === q.id);
    if (m === "PUT") {
      if (!a) return json({ error: "Not found" }, 404);
      const b = body(event) || {};
      if (typeof b.cal === "boolean") a.cal = b.cal; if (typeof b.mail === "boolean") a.mail = b.mail;
      if (/^#[0-9a-f]{6}$/i.test(b.color || "")) a.color = b.color;
      if (Array.isArray(b.cals)) a.cals = b.cals.map((x) => String(x).slice(0, 200)).slice(0, 50);
      await saveAccounts(store, list); return json({ ok: true });
    }
    if (m === "POST" && q.a === "test") {
      if (!a) return json({ error: "Not found" }, 404);
      if (preview) return json({ cal: "Only the live site talks to Google.", mail: "Only the live site talks to Google." });
      const out = {};
      try { const c = await g(store, a, SCOPES.cal, "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50"); out.cal = true; out.cals = (c.items || []).length; } catch (e) { out.cal = String(e.message || e); }
      try { const p = await g(store, a, SCOPES.mail, "https://gmail.googleapis.com/gmail/v1/users/me/profile"); out.mail = true; out.messages = p.messagesTotal; } catch (e) { out.mail = String(e.message || e); }
      return json(out);
    }
    if (m === "DELETE") {
      if (!a) return json({ error: "Not found" }, 404);
      if (a.kind === "sa") { a.cal = false; a.mail = false; await saveAccounts(store, list); return json({ ok: true, note: "The Workspace account is switched off (it comes from the Docs/Keep setup)." }); }
      try { const s = await store.get(tokKey(a.id), { type: "json" }); if (s) await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(unseal(s)), { method: "POST" }); } catch {}
      await store.delete(tokKey(a.id));
      await saveAccounts(store, list.filter((x) => x.id !== a.id));
      return json({ ok: true });
    }
    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: "Server error", detail: String(e?.message || e) }, 500);
  }
};
