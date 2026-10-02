// Runs every week on the live site and keeps a safety copy of all content in the separate "site-backups" store.
import { getStore } from "@netlify/blobs";
import { takeSnapshot } from "../lib/snapshots.mjs";

export default async () => {
  try {
    const r = await takeSnapshot(getStore("site-content"), getStore("site-backups"));
    return new Response(JSON.stringify(r || { skipped: "empty" }), { status: 200 });
  } catch (e) { return new Response(String(e?.message || e), { status: 500 }); }
};
export const config = { schedule: "@weekly" };
