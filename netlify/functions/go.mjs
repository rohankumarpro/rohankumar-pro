// /go/<slug or id>  Short links for the Links hub. Counts the click, then sends the visitor on.
import { connectLambda } from "@netlify/blobs";
import { contentStore } from "../lib/store.mjs";
import { loadHub } from "./hub.mjs";
import { visibleItems, hrefOf } from "../lib/hub.mjs";

export const handler = async (event) => {
  try {
    connectLambda(event);
    const store = contentStore(event);
    const key = String((event.queryStringParameters || {}).k || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
    const hub = await loadHub(store);
    const it = visibleItems(hub).find((i) => (i.slug && i.slug === key) || i.id.toLowerCase() === key);
    const to = it && hrefOf(it);
    if (!to) return { statusCode: 302, headers: { location: "/links", "cache-control": "no-store" }, body: "" };
    try {
      const st = (await store.get("hub-stats", { type: "json" })) ?? { views: 0, clicks: 0, items: {}, days: {}, refs: {}, dev: { m: 0, d: 0 } };
      const d = new Date().toISOString().slice(0, 10); st.days[d] = st.days[d] || { v: 0, c: 0 };
      st.clicks++; st.days[d].c++; st.items[it.id] = (st.items[it.id] || 0) + 1;
      await store.setJSON("hub-stats", st);
    } catch {}
    return { statusCode: 302, headers: { location: to, "cache-control": "no-store", "x-robots-tag": "noindex" }, body: "" };
  } catch {
    return { statusCode: 302, headers: { location: "/links" }, body: "" };
  }
};
