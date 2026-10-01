// Tells search engines (Bing, Yandex, Seznam, Naver and others that share IndexNow) the moment a page is published or changed.
// The key file at /<key>.txt proves the site is ours. Only the real site pings; preview addresses stay quiet.
import { isPreviewHost } from "./store.mjs";

export const INDEXNOW_KEY = "65ec03ba89adf0dbbcaa67725bff2714";
export const SITE = "https://rohankumar.pro";

export async function pingIndexNow(event, paths) {
  try {
    if (isPreviewHost(event)) return;
    const urlList = [...new Set(paths)].filter(Boolean).map((p) => (p.startsWith("http") ? p : SITE + p)).slice(0, 50);
    if (!urlList.length) return;
    await Promise.race([
      fetch("https://api.indexnow.org/indexnow", {
        method: "POST", headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ host: "rohankumar.pro", key: INDEXNOW_KEY, keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`, urlList }),
      }),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
  } catch {}
}
