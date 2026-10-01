// /api/site  GET: anyone reads the site settings.  PUT: only the signed-in owner saves them.
import { connectLambda, getStore } from "@netlify/blobs";
import { isAdmin, body, json } from "../lib/session.mjs";

// Notes and Settings can never be hidden, so the owner can always get back in.
const LOCKED = ["settings", "notes"];

export const handler = async (event) => {
  try {
    connectLambda(event);
    const store = getStore("site-content");
    if (event.httpMethod === "GET") {
      return json({ settings: (await store.get("site", { type: "json" })) ?? null });
    }
    if (event.httpMethod === "PUT") {
      if (!isAdmin(event)) return json({ error: "Not signed in" }, 401);
      const b = body(event);
      const s = b?.settings;
      if (!s || typeof s !== "object" || Array.isArray(s)) return json({ error: "Bad JSON" }, 400);
      if (JSON.stringify(s).length > 20000) return json({ error: "Too large" }, 413);
      s.hiddenApps = (Array.isArray(s.hiddenApps) ? s.hiddenApps : [])
        .map(String).filter((x) => !LOCKED.includes(x)).slice(0, 100);
      await store.setJSON("site", s);
      return json({ ok: true, settings: s });
    }
    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: "Server error", detail: String(e?.message || e) }, 500);
  }
};
