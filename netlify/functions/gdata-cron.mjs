// Every 30 minutes on the live site: refreshes the copy of your calendars and important email the Planner shows,
// and reads a few more receipts for Subscriptions. Does nothing until a Google account is connected.
import { getStore } from "@netlify/blobs";
import { accounts, refresh } from "../lib/gapi.mjs";

export default async () => {
  try {
    const store = getStore("site-content");
    if (!(await accounts(store)).length) return new Response("no accounts", { status: 200 });
    const r = await refresh(store, { budgetMs: 22000, subs: true });
    return new Response(JSON.stringify({ ok: true, subs: r.subs?.progress || null }), { status: 200 });
  } catch (e) { return new Response(String(e?.message || e), { status: 500 }); }
};
export const config = { schedule: "*/30 * * * *" };
