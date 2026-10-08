// /api/assistant   Owner only. The chat inside the Assistant app (web and phone): Google Gemini, using the same workspace
// tools as the Claude connector (netlify/lib/mcp-tools.mjs). The vault is never reachable from here.
//   POST {contents, approve?}  ->  {contents, text}                  an answer
//                              ->  {contents, pending:[{name,title,args}]}   it wants to change something: show Apply / Cancel,
//                                                                             then POST again with approve true or false
//                              ->  {contents, more:true}              out of time for one request: POST again to carry on
//   `contents` is the conversation in Gemini's own format; the browser keeps it and sends it back each time.
// Nothing is stored here: no new keys. Reading is free; every change waits for the owner's Apply.
//   GET ?a=models             ->  {models:[{id,name}], default}     the Gemini models this key can chat with (for the picker)
//   POST {model}               which model to use for this chat (default: GEMINI_MODEL, else gemini-flash-latest)
// Needs the GEMINI_API_KEY environment variable.
import { getStore } from "@netlify/blobs";
import { isAdmin } from "../lib/session.mjs";
import { isPreviewHost } from "../lib/store.mjs";
import { maybeSnapshot } from "../lib/snapshots.mjs";
import { TOOLS, callTool } from "../lib/mcp-tools.mjs";

const J = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const MAX_BODY = 400_000, MAX_TURNS = 60, MAX_ROUNDS = 6, BUDGET_MS = 14_000, MAX_RESULT = 30_000;

let strongOk = true;
function sStore(name) {
  const strong = getStore({ name, consistency: "strong" }), plain = getStore(name);
  return { async get(k, o) { if (strongOk) { try { return await strong.get(k, o); } catch (e) { if (e && e.name === "BlobsConsistencyError") strongOk = false; else throw e; } } return plain.get(k, o); }, set: (k, v, o) => plain.set(k, v, o), setJSON: (k, v, o) => plain.setJSON(k, v, o), delete: (k) => plain.delete(k), list: (o) => plain.list(o) };
}

/* ---------- the tools, in Gemini's schema dialect ---------- */
// Gemini has no "object with any keys" and no additionalProperties: those become text holding JSON, read back by coerce()
function gs(s) {
  if (!s || typeof s !== "object") return { type: "string" };
  const o = {}; if (s.description) o.description = s.description;
  if (s.type === "object") {
    const keys = Object.keys(s.properties || {});
    if (!keys.length) return { type: "string", description: ((s.description || "") + " (give it as JSON text)").trim() };
    o.type = "object"; o.properties = Object.fromEntries(keys.map((k) => [k, gs(s.properties[k])])); if (s.required?.length) o.required = s.required; return o;
  }
  if (s.type === "array") { o.type = "array"; o.items = gs(s.items); return o; }
  o.type = s.type || "string"; if (s.enum) o.enum = s.enum; return o;
}
const DECLS = TOOLS.map((t) => { const d = { name: t.name, description: t.description }; if (Object.keys(t.inputSchema.properties || {}).length) d.parameters = gs(t.inputSchema); return d; });
{ // a video plan's parts have a fixed shape; tell Gemini instead of leaving it as text
  const parts = DECLS.find((d) => d.name === "update_video_plan")?.parameters?.properties?.parts;
  if (parts) parts.items = { type: "object", properties: { kind: { type: "string" }, title: { type: "string" }, script: { type: "string" }, seconds: { type: "integer" }, broll: { type: "array", items: { type: "string" } } } };
}
function coerce(s, v) {
  if (!s || v == null) return v;
  if (s.type === "object" && !Object.keys(s.properties || {}).length) { if (typeof v === "string") { try { return JSON.parse(v); } catch { return v; } } return v; }
  if (s.type === "object" && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, coerce(s.properties?.[k], x)]));
  if (s.type === "array" && Array.isArray(v)) return v.map((x) => coerce(s.items, x));
  return v;
}
// a name that is not one of the tools is never a change: run() just answers it with an error
const isWrite = (name) => { const t = TOOLS.find((x) => x.name === name); return !!t && !t.annotations?.readOnlyHint; };
const callsOf = (c) => (c?.parts || []).filter((p) => p.functionCall).map((p) => p.functionCall);

/* ---------- Gemini ---------- */
function system() {
  const now = new Date(), day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", weekday: "long", hour: "2-digit", minute: "2-digit" }).format(now);
  return "You are the assistant inside Rohan's private workspace at rohankumar.pro, shown as a small friendly face. You help him run his day: tasks, pages, databases, planner (Google Calendar and important Gmail), Content Studio (YouTube video plans and reusable hooks), Library and Subscriptions. " +
    `Today is ${day} (${clock}, Asia/Kolkata). Dates are YYYY-MM-DD. ` +
    "Use the tools to look things up instead of guessing; start with `today` for planning questions and `search` to find things. Never invent ids: get them from a tool first. " +
    "Anything that changes data waits for Rohan's Apply button, so just call the tool; do not ask for permission in words first. Only say something is done after the tool has succeeded. Prefer appending to pages over replacing them. " +
    "Keep answers short and plain. No emoji. Use short lists only when they help.";
}
class Soft extends Error { constructor(code, message, detail) { super(message); this.code = code; this.detail = detail; } }
const DEFAULT_MODEL = () => (process.env.GEMINI_MODEL || "gemini-flash-latest").replace(/[^\w.-]/g, "");
const okModel = (m) => typeof m === "string" && /^gemini-[\w.-]{1,50}$/.test(m);
async function gemini(contents, pick) {
  const key = process.env.GEMINI_API_KEY; if (!key) throw new Soft("no_key", "The assistant needs a Gemini key.");
  const model = okModel(pick) ? pick : DEFAULT_MODEL();
  // Gemini 3 models think for a long time by default; a chat with tools wants a quick answer, so ask for little thinking.
  // A model that does not take the setting answers 400 about "thinking", and then we ask again without it.
  const ask = async (think) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, body: JSON.stringify({ systemInstruction: { parts: [{ text: system() }] }, contents, tools: [{ functionDeclarations: DECLS }], generationConfig: { temperature: 0.4, ...(think ? { thinkingConfig: { thinkingLevel: "low" } } : {}) } }), signal: AbortSignal.timeout(25_000) });
  let r, t0 = Date.now();
  try {
    const think = /^gemini-(3|flash-latest|pro-latest)/.test(model);
    r = await ask(think);
    if (think && r.status === 400) { const m = await r.clone().json().then((j) => j?.error?.message || "").catch(() => ""); if (/think/i.test(m)) r = await ask(false); }
  } catch (e) { console.error("assistant gemini", model, e?.name, Date.now() - t0, "ms"); throw new Soft("busy", e?.name === "TimeoutError" ? "Gemini took too long. Try again, or pick another model." : "Could not reach Gemini. Try again.", e?.name === "TimeoutError" ? `no answer from ${model} in 25 seconds` : undefined); }
  if (!r.ok) {
    let msg = ""; try { msg = (await r.json())?.error?.message || ""; } catch {}
    console.error("assistant gemini", r.status, msg.slice(0, 200));
    const why = `${r.status}: ${msg}`.slice(0, 300);
    if (r.status === 429) throw new Soft("rate", "Gemini's free limit is reached for now. Try again in a little while.", why);
    if (r.status === 400 && /api key/i.test(msg)) throw new Soft("bad_key", "Gemini did not accept the key.", why);
    if (r.status === 403 || r.status === 401) throw new Soft("bad_key", "Gemini did not accept the key.", why);
    if (r.status === 404) throw new Soft("bad_model", "Gemini could not use that model. Try another one in the Model list.", why);
    throw new Soft("busy", "Gemini had a problem (" + r.status + "). Try again.", why);
  }
  const data = await r.json(), cand = data.candidates?.[0], parts = cand?.content?.parts;
  if (!parts?.length) throw new Soft("empty", data.promptFeedback?.blockReason ? "Gemini would not answer that." : "Gemini sent an empty answer. Try again.");
  return { role: "model", parts };
}

/* ---------- running tools ---------- */
async function run(store, name, raw) {
  const t = TOOLS.find((x) => x.name === name);
  if (!t) return { error: "Unknown tool " + name };
  try {
    const out = await callTool(store, name, coerce(t.inputSchema, raw && typeof raw === "object" ? raw : {}));
    const s = JSON.stringify(out); return s.length > MAX_RESULT ? { result: s.slice(0, MAX_RESULT), note: "Shortened. Ask for less at once." } : { result: out };
  } catch (e) {
    if (!e.user) console.error("assistant tool", name, e);
    return { error: e.user ? e.message : "Something went wrong: " + String(e?.message || e).slice(0, 200) };
  }
}

// the models this key can chat with that also understand tools (no image, voice, embedding or live-audio models)
let modelsAt = 0, modelsList = [];
async function models() {
  const key = process.env.GEMINI_API_KEY; if (!key) return [];
  if (Date.now() - modelsAt < 10 * 60e3 && modelsList.length) return modelsList;
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return modelsList;
    const list = ((await r.json()).models || []).filter((m) => (m.supportedGenerationMethods || []).includes("generateContent") && /^models\/gemini-/.test(m.name) && !/image|tts|embed|live|audio|robot|computer|aqa|learnlm|-exp-/.test(m.name))
      .map((m) => ({ id: m.name.slice(7), name: m.displayName || m.name.slice(7) })).sort((a, b) => a.id.localeCompare(b.id));
    // Google keeps older models in the list that new keys can no longer use: show the newest generation and the "-latest" shortcuts
    const major = Math.max(0, ...list.map((m) => +(m.id.match(/^gemini-(\d+)/) || [])[1] || 0));
    const fresh = list.filter((m) => /-latest$/.test(m.id) || (+(m.id.match(/^gemini-(\d+)/) || [])[1] || 0) === major);
    modelsList = fresh.length ? fresh : list; modelsAt = Date.now();
  } catch {}
  return modelsList;
}

function valid(c) {
  if (!Array.isArray(c) || !c.length || c.length > MAX_TURNS) return false;
  return c.every((x) => x && (x.role === "user" || x.role === "model") && Array.isArray(x.parts) && x.parts.length && x.parts.every((p) => p && typeof p === "object"));
}

export default async (req) => {
  const event = { headers: Object.fromEntries(req.headers) };
  if (!isAdmin(event)) return J({ error: "Not signed in" }, 401);
  if (req.method === "GET" && new URL(req.url).searchParams.get("a") === "models") return J({ models: await models(), default: DEFAULT_MODEL() });
  if (req.method !== "POST") return J({ error: "Method not allowed" }, 405);
  const preview = isPreviewHost(event), store = sStore(preview ? "site-content-dev" : "site-content");
  let body; try { const t = await req.text(); if (t.length > MAX_BODY) return J({ error: "This chat got long. Start a new one.", code: "long" }, 413); body = JSON.parse(t); } catch { return J({ error: "Bad request" }, 400); }
  const contents = body?.contents; if (!valid(contents)) return J({ error: "Bad request" }, 400);
  const t0 = Date.now(); let wrote = false;
  try {
    // the owner answered an Apply / Cancel card: run (or refuse) what the last model turn asked for, then carry on
    const last = contents[contents.length - 1];
    if (last.role === "model") {
      const calls = callsOf(last); if (!calls.length || typeof body.approve !== "boolean") return J({ error: "Bad request" }, 400);
      const res = [];
      for (const c of calls) {
        if (isWrite(c.name)) { if (body.approve) { const r = await run(store, c.name, c.args); if (!r.error) wrote = true; res.push({ functionResponse: { name: c.name, response: r } }); } else res.push({ functionResponse: { name: c.name, response: { error: "Rohan chose not to apply this change." } } }); }
        else res.push({ functionResponse: { name: c.name, response: await run(store, c.name, c.args) } });
      }
      contents.push({ role: "user", parts: res });
    }
    for (let round = 0; round < MAX_ROUNDS; round++) {
      if (round && Date.now() - t0 > BUDGET_MS) { if (wrote) await snap(store, preview); return J({ contents, more: true }); }
      const turn = await gemini(contents, body.model); contents.push(turn);
      const calls = callsOf(turn);
      if (!calls.length) { if (wrote) await snap(store, preview); return J({ contents, text: turn.parts.map((p) => (p.thought ? "" : p.text || "")).join("").trim() || "Done." }); }
      if (calls.some((c) => isWrite(c.name))) {
        return J({ contents, pending: calls.filter((c) => isWrite(c.name)).map((c) => ({ name: c.name, title: TOOLS.find((x) => x.name === c.name)?.title || c.name, args: coerce(TOOLS.find((x) => x.name === c.name)?.inputSchema, c.args || {}) })) });
      }
      contents.push({ role: "user", parts: await Promise.all(calls.map(async (c) => ({ functionResponse: { name: c.name, response: await run(store, c.name, c.args) } }))) });
    }
    if (wrote) await snap(store, preview);
    return J({ contents, more: true });
  } catch (e) {
    if (wrote) await snap(store, preview);
    if (e instanceof Soft) return J({ error: e.message, code: e.code, detail: e.detail }, e.code === "no_key" ? 503 : 502);
    console.error("assistant", e); return J({ error: "Something went wrong. Try again.", code: "error" }, 500);
  }
};

async function snap(store, preview) { await maybeSnapshot(store, getStore(preview ? "site-backups-dev" : "site-backups")).catch(() => {}); }
