// /api/yt?url=<a YouTube link>   Owner only. Reads the public title, channel and thumbnail of one video (YouTube's own oEmbed address, no key needed),
// so the YouTube app can show a small card without embedding anything. Nothing is stored here: the app saves the result with the site settings.
import { isAdmin, json } from "../lib/session.mjs";

export const ytId = (u) => {
  const s = String(u || "").trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  let m;
  if ((m = s.match(/^https?:\/\/(?:www\.|m\.|music\.)?youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/)([\w-]{11})/i))) return m[1];
  if ((m = s.match(/^https?:\/\/youtu\.be\/([\w-]{11})/i))) return m[1];
  return "";
};

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "GET") return json({ error: "Method not allowed" }, 405);
    if (!isAdmin(event)) return json({ error: "Not signed in" }, 401);
    const url = event.queryStringParameters?.url || "";
    const id = ytId(url);
    if (!id) return json({ error: "That does not look like a YouTube video link." }, 400);
    const watch = `https://www.youtube.com/watch?v=${id}`;
    let info = {};
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
      const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`, { signal: ctl.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; rohankumar-pro)" } });
      clearTimeout(t);
      if (r.status === 404 || r.status === 401 || r.status === 403) return json({ error: "YouTube says that video is private, removed or can't be shown." }, 404);
      if (r.ok) info = await r.json();
    } catch { /* YouTube did not answer: still return the id so the owner can type a title */ }
    return json({ id, url: watch, title: String(info.title || "").slice(0, 140), author: String(info.author_name || "").slice(0, 80), manual: !info.title });
  } catch (e) {
    return json({ error: "Server error", detail: String(e?.message || e) }, 500);
  }
};
