// Every ten minutes on the live site: keeps Docs in step with Google Docs and Notes with Google Keep.
// Does nothing until the Google keys are set in Netlify (see Settings > Sync on the site).
import { getStore } from "@netlify/blobs";
import { runSync, configured } from "../lib/gsync.mjs";

export default async () => {
  if (!configured()) return new Response("not set up", { status: 200 });
  try {
    const r = await runSync(getStore("site-content"), { budgetMs: 22000 });
    return new Response(JSON.stringify(r), { status: 200 });
  } catch (e) { return new Response(String(e?.message || e), { status: 500 }); }
};
export const config = { schedule: "*/10 * * * *" };
