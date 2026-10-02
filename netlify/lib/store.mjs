// One place that decides which storage a request uses.
// The live site (rohankumar.pro) keeps its real content. Any preview address
// (dev--rohankumar-pro.netlify.app, deploy previews) gets its own sandbox store,
// so testing never touches the live notes, articles or settings.
import { getStore } from "@netlify/blobs";

export function isPreviewHost(event) {
  const h = String(event?.headers?.["x-forwarded-host"] || event?.headers?.host || "").toLowerCase();
  return h.includes("--") || h.startsWith("localhost") || h.startsWith("127.0.0.1");
}

export const contentStore = (event) => getStore(isPreviewHost(event) ? "site-content-dev" : "site-content");

// A second store, only for safety copies (automatic backups and pages deleted for good). Nothing else reads or writes it.
export const backupStore = (event) => getStore(isPreviewHost(event) ? "site-backups-dev" : "site-backups");
export const backupStoreLive = () => getStore("site-backups");
