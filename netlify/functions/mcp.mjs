// /api/mcp   The owner's private connector for Claude (Model Context Protocol, streamable HTTP, JSON answers).
// Add it in Claude: Settings, Connectors, Add custom connector, https://rohankumar.pro/api/mcp. Claude then sends the
// owner to /oauth/authorize to type the site password once. Without a valid token every call is refused.
// What it can do is in netlify/lib/mcp-tools.mjs. The vault is never reachable from here.
import { getStore } from "@netlify/blobs";
import { isPreviewHost } from "../lib/store.mjs";
import { maybeSnapshot } from "../lib/snapshots.mjs";
import { checkToken, origin } from "../lib/mcp-auth.mjs";
import { TOOLS, callTool } from "../lib/mcp-tools.mjs";

const VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, GET, DELETE, OPTIONS", "access-control-allow-headers": "content-type, authorization, mcp-protocol-version, mcp-session-id", "access-control-expose-headers": "mcp-session-id, www-authenticate" };
const J = (d, status = 200, extra = {}) => new Response(d == null ? null : JSON.stringify(d), { status, headers: { ...(d == null ? {} : { "content-type": "application/json" }), "cache-control": "no-store", ...CORS, ...extra } });
const INSTRUCTIONS = "This is Rohan's private workspace (his personal OS at rohankumar.pro): tasks, pages, databases, planner (Google Calendar and important Gmail), Content Studio (YouTube video plans and reusable hooks), Library and Subscriptions. Start with `today` for planning questions and `search` to find things. Dates are YYYY-MM-DD in Asia/Kolkata unless told otherwise. Prefer appending over replacing page content.";

let strongOk = true;
function sStore(name) {
  const strong = getStore({ name, consistency: "strong" }), plain = getStore(name);
  return { async get(k, o) { if (strongOk) { try { return await strong.get(k, o); } catch (e) { if (e && e.name === "BlobsConsistencyError") strongOk = false; else throw e; } } return plain.get(k, o); }, set: (k, v, o) => plain.set(k, v, o), setJSON: (k, v, o) => plain.setJSON(k, v, o), delete: (k) => plain.delete(k), list: (o) => plain.list(o) };
}

async function handle(store, msg, wrote) {
  const { id, method, params = {} } = msg || {};
  const ok = (result) => ({ jsonrpc: "2.0", id, result }), err = (code, message) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
  if (!msg || msg.jsonrpc !== "2.0" || typeof method !== "string") return err(-32600, "Invalid request");
  if (id === undefined) return null; // a notification (initialized, cancelled...): nothing to answer
  if (method === "initialize") return ok({ protocolVersion: VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : VERSIONS[0], capabilities: { tools: { listChanged: false } }, serverInfo: { name: "rohankumar-pro", title: "Rohan's workspace", version: "1.0.0" }, instructions: INSTRUCTIONS });
  if (method === "ping") return ok({});
  if (method === "tools/list") return ok({ tools: TOOLS });
  if (method === "resources/list") return ok({ resources: [] });
  if (method === "prompts/list") return ok({ prompts: [] });
  if (method === "tools/call") {
    const t = TOOLS.find((x) => x.name === params.name); if (!t) return err(-32602, "Unknown tool " + params.name);
    try {
      const out = await callTool(store, t.name, params.arguments || {});
      if (!t.annotations?.readOnlyHint) wrote.yes = true;
      return ok({ content: [{ type: "text", text: JSON.stringify(out, null, 1) }], structuredContent: out });
    } catch (e) {
      if (!e.user) console.error("mcp tool", t.name, e);
      return ok({ content: [{ type: "text", text: e.user ? e.message : "Something went wrong: " + String(e?.message || e).slice(0, 300) }], isError: true });
    }
  }
  return err(-32601, "Method not found: " + method);
}

export default async (req) => {
  const m = req.method, event = { headers: Object.fromEntries(req.headers) };
  if (m === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const preview = isPreviewHost(event), store = sStore(preview ? "site-content-dev" : "site-content");
  const grant = await checkToken(store, req.headers.get("authorization"));
  if (!grant) return J({ error: "invalid_token", error_description: "Sign in through Claude's connector settings" }, 401, { "www-authenticate": `Bearer resource_metadata="${origin(req)}/.well-known/oauth-protected-resource/api/mcp"` });
  if (m === "GET") return J({ error: "This server answers POST only" }, 405, { allow: "POST" });
  if (m === "DELETE") return J(null, 204);
  if (m !== "POST") return J({ error: "Method not allowed" }, 405);
  let body; try { body = JSON.parse(await req.text()); } catch { return J({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400); }
  const wrote = { yes: false };
  const many = Array.isArray(body), answers = (await Promise.all((many ? body : [body]).map((x) => handle(store, x, wrote)))).filter(Boolean);
  if (wrote.yes) await maybeSnapshot(store, getStore(preview ? "site-backups-dev" : "site-backups")).catch(() => {});
  if (!answers.length) return J(null, 202);
  return J(many ? answers : answers[0]);
};
