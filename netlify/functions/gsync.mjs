// /api/gsync  Owner only. Google Docs and Google Keep sync (see netlify/lib/gsync.mjs).
//   GET            -> status: set up or not, what is on, the last run
//   POST           -> sync now
//   PUT {docsOn, keepOn}
// Only the live site syncs. Preview addresses use a sandbox copy of the content and must never write into your Google account.
import { connectLambda } from "@netlify/blobs";
import { isAdmin, body, json } from "../lib/session.mjs";
import { contentStore, isPreviewHost } from "../lib/store.mjs";
import { runSync, status, setOptions } from "../lib/gsync.mjs";

export const handler = async (event) => {
  try {
    if (!isAdmin(event)) return json({ error: "Not signed in" }, 401);
    connectLambda(event);
    const store = contentStore(event), preview = isPreviewHost(event), m = event.httpMethod;
    if (m === "GET") return json({ ...(await status(store)), preview });
    if (preview) return json({ error: "Google sync only runs on the live site, so your Google account never gets the preview's test content." }, 400);
    if (m === "POST") { const r = await runSync(store, { budgetMs: 18000 }); return json(r, r.ok || r.error === "busy" ? 200 : 400); }
    if (m === "PUT") { await setOptions(store, body(event) || {}); return json(await status(store)); }
    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: "Server error", detail: String(e?.message || e) }, 500);
  }
};
